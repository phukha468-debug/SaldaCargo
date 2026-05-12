/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

/** GET /api/counterparties — список клиентов с аналитикой */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const onlyActive = searchParams.get('active') === '1';

    const supabase = createAdminClient();

    // Только клиенты (не поставщики)
    let q = (supabase as any)
      .from('counterparties')
      .select('id, name, phone, credit_limit, notes, is_active')
      .in('type', ['client', 'both'])
      .order('name');

    if (onlyActive) q = q.eq('is_active', true);

    const { data: counterparties, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Все заказы по этим клиентам (не отменённые) с датой рейса
    const cpIds = (counterparties ?? []).map((c: any) => c.id);
    if (cpIds.length === 0) return NextResponse.json([]);

    const { data: orders } = await (supabase as any)
      .from('trip_orders')
      .select(
        'counterparty_id, trip_id, amount, payment_method, lifecycle_status, settlement_status, trip:trips(started_at)',
      )
      .in('counterparty_id', cpIds)
      .neq('lifecycle_status', 'cancelled');

    // Считаем статистику по каждому клиенту
    const now = Date.now();

    type Stats = {
      total_revenue: number;
      revenue_30d: number;
      revenue_orders: number;
      trip_ids: Set<string>;
      last_trip_at: string | null;
      outstanding: number;
      payments: Record<string, number>;
    };

    const statsMap = new Map<string, Stats>();

    for (const cpId of cpIds) {
      statsMap.set(cpId, {
        total_revenue: 0,
        revenue_30d: 0,
        revenue_orders: 0,
        trip_ids: new Set(),
        last_trip_at: null,
        outstanding: 0,
        payments: {},
      });
    }

    for (const o of orders ?? []) {
      const s = statsMap.get(o.counterparty_id);
      if (!s) continue;

      const amount = parseFloat(o.amount ?? '0');
      const startedAt: string | null = o.trip?.started_at ?? null;

      if (o.trip_id) s.trip_ids.add(o.trip_id);
      if (startedAt && (!s.last_trip_at || startedAt > s.last_trip_at)) {
        s.last_trip_at = startedAt;
      }

      if (o.lifecycle_status === 'approved' && o.settlement_status === 'completed') {
        s.total_revenue += amount;
        s.revenue_orders++;
        if (startedAt && now - new Date(startedAt).getTime() <= THIRTY_DAYS) {
          s.revenue_30d += amount;
        }
        s.payments[o.payment_method] = (s.payments[o.payment_method] ?? 0) + amount;
      }

      if (o.lifecycle_status === 'approved' && o.settlement_status === 'pending') {
        s.outstanding += amount;
      }
    }

    const result = (counterparties ?? []).map((cp: any) => {
      const s = statsMap.get(cp.id)!;

      // Предпочтительный способ оплаты (по сумме, исключая долг)
      const preferredPayment =
        Object.entries(s.payments)
          .filter(([pm]) => pm !== 'debt_cash')
          .sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

      // Доля каждого способа в процентах от выручки
      const totalForPct = s.total_revenue || 1;
      const paymentBreakdown: Record<string, number> = {};
      for (const [pm, val] of Object.entries(s.payments)) {
        paymentBreakdown[pm] = Math.round((val / totalForPct) * 100);
      }

      return {
        id: cp.id,
        name: cp.name,
        phone: cp.phone ?? null,
        notes: cp.notes ?? null,
        credit_limit: cp.credit_limit ?? null,
        is_active: cp.is_active,
        // аналитика
        total_revenue: s.total_revenue.toFixed(2),
        revenue_30d: s.revenue_30d.toFixed(2),
        trips_count: s.trip_ids.size,
        orders_count: s.revenue_orders,
        avg_order: s.revenue_orders > 0 ? (s.total_revenue / s.revenue_orders).toFixed(2) : '0.00',
        last_trip_at: s.last_trip_at,
        outstanding_debt: s.outstanding.toFixed(2),
        preferred_payment: preferredPayment,
        payment_breakdown: paymentBreakdown,
      };
    });

    // Сортировка: сначала по выручке за 30 дней, потом по общей
    result.sort(
      (a: any, b: any) =>
        parseFloat(b.revenue_30d) - parseFloat(a.revenue_30d) ||
        parseFloat(b.total_revenue) - parseFloat(a.total_revenue),
    );

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

/** POST /api/counterparties — создать клиента */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name: string;
      phone?: string;
      credit_limit?: string;
      notes?: string;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Название обязательно' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data, error } = await (supabase.from('counterparties') as any)
      .insert({
        name: body.name.trim(),
        type: 'client',
        phone: body.phone?.trim() || null,
        credit_limit: body.credit_limit || null,
        notes: body.notes?.trim() || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
