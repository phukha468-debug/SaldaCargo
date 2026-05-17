/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Нал',
  qr: 'QR / Р/С',
  bank_invoice: 'Р/С (договор)',
  card_driver: 'Карта',
  debt_cash: 'Долг нал',
};

function breakdownByPayment(orders: any[]): Record<string, string> {
  const acc: Record<string, number> = {};
  for (const o of orders) {
    const method = o.payment_method ?? 'unknown';
    acc[method] = (acc[method] ?? 0) + parseFloat(o.amount ?? '0');
  }
  const result: Record<string, string> = {};
  for (const [method, total] of Object.entries(acc)) {
    result[method] = total.toFixed(2);
  }
  return result;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const direction = searchParams.get('direction');
    const limit = parseInt(searchParams.get('limit') ?? '50');

    const supabase = createAdminClient();

    const month = searchParams.get('month');
    if (month) {
      const [yearStr, monStr] = month.split('-');
      const year = parseInt(yearStr);
      const mon = parseInt(monStr);
      const monthStart = new Date(year, mon - 1, 1).toISOString();
      const monthEnd = new Date(year, mon, 0, 23, 59, 59, 999).toISOString();

      const [expRes, incRes, revenueRes] = await Promise.all([
        (supabase as any)
          .from('transactions')
          .select(
            'id, amount, description, created_at, category:transaction_categories(name, code)',
          )
          .eq('direction', 'expense')
          .eq('lifecycle_status', 'approved')
          .eq('settlement_status', 'completed')
          .neq('description', 'Корректировка остатка')
          .gte('created_at', monthStart)
          .lte('created_at', monthEnd)
          .order('created_at', { ascending: false }),
        (supabase as any)
          .from('transactions')
          .select(
            'id, amount, description, created_at, category:transaction_categories(name, code), counterparty:counterparties(name), to_wallet:wallets!to_wallet_id(name)',
          )
          .eq('direction', 'income')
          .eq('lifecycle_status', 'approved')
          .eq('settlement_status', 'completed')
          .neq('description', 'Корректировка остатка')
          .gte('created_at', monthStart)
          .lte('created_at', monthEnd)
          .order('created_at', { ascending: false }),
        (supabase as any)
          .from('trip_orders')
          .select('amount, payment_method, trips!inner(started_at, lifecycle_status)')
          .eq('lifecycle_status', 'approved')
          .eq('settlement_status', 'completed')
          .eq('trips.lifecycle_status', 'approved')
          .gte('trips.started_at', monthStart)
          .lte('trips.started_at', monthEnd),
      ]);

      const orders = (revenueRes.data ?? []) as any[];
      const revenue = orders.reduce((s: number, o: any) => s + parseFloat(o.amount ?? '0'), 0);

      return NextResponse.json({
        pnl: [],
        transactions: expRes.data ?? [],
        income_transactions: incRes.data ?? [],
        payrollTotal: '0',
        revenue: revenue.toFixed(2),
        revenue_breakdown: breakdownByPayment(orders),
        revenue_labels: PAYMENT_LABELS,
      });
    }

    const now = new Date();

    // Last 6 months P&L: revenue from trip_orders + expenses from transactions
    const months: { label: string; start: string; end: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: d.toLocaleString('ru-RU', { month: 'short', year: '2-digit' }),
        start: d.toISOString(),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString(),
      });
    }

    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

    const [{ data: allOrders }, { data: allExpenseTx }, { data: transactions }] = await Promise.all(
      [
        // Revenue: cash-basis — только settled trip_orders одобренных рейсов
        (supabase as any)
          .from('trip_orders')
          .select('amount, payment_method, trips!inner(started_at, lifecycle_status)')
          .eq('lifecycle_status', 'approved')
          .eq('settlement_status', 'completed')
          .eq('trips.lifecycle_status', 'approved')
          .gte('trips.started_at', sixMonthsAgo),

        // Expenses: все approved транзакции включая ФОТ (без корректировок остатков)
        (supabase as any)
          .from('transactions')
          .select('amount, created_at')
          .eq('direction', 'expense')
          .eq('lifecycle_status', 'approved')
          .eq('settlement_status', 'completed')
          .neq('description', 'Корректировка остатка')
          .gte('created_at', sixMonthsAgo),

        // Journal: по дате или последние N
        (() => {
          const date = searchParams.get('date'); // YYYY-MM-DD
          let q = (supabase as any)
            .from('transactions')
            .select(
              'id, amount, direction, description, created_at, lifecycle_status, category:transaction_categories(name, code)',
            )
            .eq('lifecycle_status', 'approved')
            .eq('settlement_status', 'completed')
            .neq('description', 'Корректировка остатка')
            .order('created_at', { ascending: false });
          if (direction) q = q.eq('direction', direction);
          if (date) {
            q = q
              .gte('created_at', `${date}T00:00:00.000Z`)
              .lte('created_at', `${date}T23:59:59.999Z`);
          } else {
            q = q.limit(limit);
          }
          return q;
        })(),
      ],
    );

    const allOrdersArr = (allOrders ?? []) as any[];

    // Build P&L by month (with revenue breakdown per month)
    const pnl = months.map((m) => {
      const monthOrders = allOrdersArr.filter((o: any) => {
        const d = o.trips?.started_at;
        return d && d >= m.start && d <= m.end;
      });

      const revenue = monthOrders.reduce((s: number, o: any) => s + parseFloat(o.amount ?? '0'), 0);

      const expenses = ((allExpenseTx as any[]) ?? [])
        .filter((t: any) => t.created_at >= m.start && t.created_at <= m.end)
        .reduce((s: number, t: any) => s + parseFloat(t.amount ?? '0'), 0);

      return {
        label: m.label,
        revenue: revenue.toFixed(2),
        expenses: expenses.toFixed(2),
        profit: (revenue - expenses).toFixed(2),
        revenue_breakdown: breakdownByPayment(monthOrders),
      };
    });

    return NextResponse.json({
      pnl,
      transactions: transactions ?? [],
      revenue_labels: PAYMENT_LABELS,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
