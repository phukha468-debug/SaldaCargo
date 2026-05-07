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

    const [{ data: allOrders }, { data: allExpenseTx }, { data: transactions }] = await Promise.all(
      [
        // Revenue: approved trip_orders (через trips)
        (supabase as any)
          .from('trip_orders')
          .select('amount, trips!inner(started_at, lifecycle_status)')
          .eq('lifecycle_status', 'approved')
          .gte(
            'trips.started_at',
            new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString(),
          ),

        // Expenses: approved transactions
        (supabase as any)
          .from('transactions')
          .select('amount, created_at')
          .eq('direction', 'expense')
          .eq('lifecycle_status', 'approved')
          .gte('created_at', new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()),

        // Journal: last N transactions
        (() => {
          let q = (supabase as any)
            .from('transactions')
            .select(
              'id, amount, direction, description, created_at, lifecycle_status, category:transaction_categories(name, code)',
            )
            .order('created_at', { ascending: false })
            .limit(limit);
          if (direction) q = q.eq('direction', direction);
          return q;
        })(),
      ],
    );

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

      return {
        label: m.label,
        revenue: revenue.toFixed(2),
        expenses: expenses.toFixed(2),
        profit: (revenue - expenses).toFixed(2),
      };
    });

    return NextResponse.json({ pnl, transactions: transactions ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
