/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export type SettlementOrderItem = {
  id: string;
  type: 'trip_order' | 'manual';
  amount: number;
};

export type SettlementTransactionItem = {
  id: string;
  amount: number;
  direction: 'income' | 'expense';
  description: string;
  created_at: string;
  counterparty_id: string | null;
  counterparty_name: string | null;
  orders: SettlementOrderItem[];
};

/**
 * GET /api/receivables/settlements
 * Возвращает транзакции погашения дебиторской задолженности (и отмены/возвраты)
 * за указанный период (день, неделя, месяц или диапазон from/to).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // YYYY-MM-DD
    const weekStart = searchParams.get('weekStart'); // YYYY-MM-DD
    const weekEnd = searchParams.get('weekEnd'); // YYYY-MM-DD
    const month = searchParams.get('month'); // YYYY-MM
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const supabase = createAdminClient();

    let query = (supabase as any)
      .from('transactions')
      .select(
        'id, amount, direction, description, created_at, photo_url, trip_order_id, counterparty_id, counterparty:counterparties(id, name)',
      )
      .eq('lifecycle_status', 'approved')
      .or(
        'description.ilike.%Погашен%,photo_url.ilike.%receivables_settlement%,photo_url.ilike.%receivables_unsettle%',
      )
      .order('created_at', { ascending: false });

    if (month) {
      const parts = month.split('-');
      const y = parseInt(parts[0]!, 10);
      const m = parseInt(parts[1]!, 10);
      const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
      const end = new Date(Date.UTC(y, m, 1)).toISOString();
      query = query.gte('created_at', start).lt('created_at', end);
    } else if (weekStart && weekEnd) {
      const start = `${weekStart}T00:00:00Z`;
      const end = `${weekEnd}T23:59:59.999Z`;
      query = query.gte('created_at', start).lte('created_at', end);
    } else if (date) {
      const start = `${date}T00:00:00Z`;
      const end = `${date}T23:59:59.999Z`;
      query = query.gte('created_at', start).lte('created_at', end);
    } else if (from && to) {
      const start = from.includes('T') ? from : `${from}T00:00:00Z`;
      const end = to.includes('T') ? to : `${to}T23:59:59.999Z`;
      query = query.gte('created_at', start).lte('created_at', end);
    } else {
      return NextResponse.json(
        { error: 'Укажите date, weekStart/weekEnd, month или from/to' },
        { status: 400 },
      );
    }

    const { data: txs, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const settlements: SettlementTransactionItem[] = (txs ?? []).map((tx: any) => {
      let orders: SettlementOrderItem[] = [];
      let meta: any = null;
      if (tx.photo_url) {
        try {
          meta = JSON.parse(tx.photo_url);
        } catch {
          meta = null;
        }
      }

      const sign = tx.direction === 'expense' ? -1 : 1;
      const totalAmount = parseFloat(tx.amount || '0') * sign || 0;

      if (meta?.type === 'receivables_settlement' && Array.isArray(meta.orders)) {
        orders = meta.orders.map((o: any) => ({
          id: String(o.id),
          type: (o.type === 'manual' ? 'manual' : 'trip_order') as 'trip_order' | 'manual',
          amount: parseFloat(String(o.amount || '0')) * sign || 0,
        }));
      } else if (tx.trip_order_id) {
        orders = [{ id: String(tx.trip_order_id), type: 'trip_order', amount: totalAmount }];
      } else if (meta?.type === 'receivables_unsettle') {
        const orderId = meta.order_id || meta.manual_id;
        if (orderId) {
          orders = [
            {
              id: String(orderId),
              type: meta.manual_id ? 'manual' : 'trip_order',
              amount: totalAmount,
            },
          ];
        }
      }

      return {
        id: tx.id,
        amount: totalAmount,
        direction: tx.direction,
        description: tx.description || '',
        created_at: tx.created_at,
        counterparty_id: tx.counterparty_id,
        counterparty_name: tx.counterparty?.name ?? null,
        orders,
      };
    });

    const totalAmount = settlements.reduce((s, it) => s + it.amount, 0);

    return NextResponse.json({
      settlements,
      totalAmount,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
