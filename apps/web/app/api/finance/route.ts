/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const direction = searchParams.get('direction'); // 'income' | 'expense' | null
    const limit = parseInt(searchParams.get('limit') ?? '50');

    const supabase = createAdminClient();

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

    const PAYROLL_IDS = [
      'd79213ee-3bc6-4433-b58a-ca7ea1040d00',
      '18792fa8-fda8-472d-8e04-e19d2c6c053c',
      '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6',
    ];
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

    const [
      { data: allOrders },
      { data: allExpenseTx },
      { data: allPayrollOrders },
      { data: transactions },
    ] = await Promise.all([
      // Revenue: approved trip_orders (через trips)
      (supabase as any)
        .from('trip_orders')
        .select('amount, trips!inner(started_at, lifecycle_status)')
        .eq('lifecycle_status', 'approved')
        .gte('trips.started_at', sixMonthsAgo),

      // Expenses: approved transactions (без PAYROLL — считается через trip_orders)
      (supabase as any)
        .from('transactions')
        .select('amount, created_at')
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .not('category_id', 'in', `(${PAYROLL_IDS.join(',')})`)
        .gte('created_at', sixMonthsAgo),

      // ЗП водителей/грузчиков из рейсов для P&L
      (supabase as any)
        .from('trip_orders')
        .select('driver_pay, loader_pay, loader2_pay, trips!inner(started_at, lifecycle_status)')
        .eq('lifecycle_status', 'approved')
        .eq('trips.lifecycle_status', 'approved')
        .gte('trips.started_at', sixMonthsAgo),

      // Journal: по дате или последние N
      (() => {
        const date = searchParams.get('date'); // YYYY-MM-DD
        let q = (supabase as any)
          .from('transactions')
          .select(
            'id, amount, direction, description, created_at, lifecycle_status, category:transaction_categories(name, code)',
          )
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
    ]);

    // Build P&L by month
    const pnl = months.map((m) => {
      const revenue = ((allOrders as any[]) ?? [])
        .filter((o: any) => {
          const d = o.trips?.started_at;
          return d && d >= m.start && d <= m.end;
        })
        .reduce((s: number, o: any) => s + parseFloat(o.amount ?? '0'), 0);

      const expenses = ((allExpenseTx as any[]) ?? [])
        .filter((t: any) => t.created_at >= m.start && t.created_at <= m.end)
        .reduce((s: number, t: any) => s + parseFloat(t.amount ?? '0'), 0);

      const payroll = ((allPayrollOrders as any[]) ?? [])
        .filter((o: any) => {
          const d = o.trips?.started_at;
          return d && d >= m.start && d <= m.end;
        })
        .reduce(
          (s: number, o: any) =>
            s +
            parseFloat(o.driver_pay ?? '0') +
            parseFloat(o.loader_pay ?? '0') +
            parseFloat(o.loader2_pay ?? '0'),
          0,
        );

      return {
        label: m.label,
        revenue: revenue.toFixed(2),
        expenses: (expenses + payroll).toFixed(2),
        profit: (revenue - expenses - payroll).toFixed(2),
      };
    });

    return NextResponse.json({ pnl, transactions: transactions ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
