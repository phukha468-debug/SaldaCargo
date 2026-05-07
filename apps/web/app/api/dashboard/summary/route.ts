/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createAdminClient();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [
      { data: monthOrders },
      { data: monthExpenses },
      { data: todayOrders },
      { data: reviewTrips },
      { data: recentTransactions },
    ] = await Promise.all([
      // Выручка за месяц: одобренные заказы
      (supabase as any)
        .from('trip_orders')
        .select('amount, trips!inner(started_at, lifecycle_status)')
        .eq('lifecycle_status', 'approved')
        .eq('trips.lifecycle_status', 'approved')
        .gte('trips.started_at', monthStart)
        .lte('trips.started_at', monthEnd),

      // Расходы за месяц: транзакции + расходы в рейсах
      (supabase as any)
        .from('transactions')
        .select('amount')
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd),

      // Выручка за сегодня
      (supabase as any)
        .from('trip_orders')
        .select('amount, trips!inner(started_at, lifecycle_status, status)')
        .eq('lifecycle_status', 'approved')
        .gte('trips.started_at', todayStart),

      // Рейсы на ревью
      (supabase as any)
        .from('trips')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .eq('lifecycle_status', 'draft'),

      // Последние транзакции
      (supabase as any)
        .from('transactions')
        .select(
          'id, amount, direction, description, created_at, lifecycle_status, category:transaction_categories(name)',
        )
        .order('created_at', { ascending: false })
        .limit(8),
    ]);

    const revenue = (monthOrders ?? []).reduce(
      (s: number, o: any) => s + parseFloat(o.amount ?? '0'),
      0,
    );

    const expenses = (monthExpenses ?? []).reduce(
      (s: number, t: any) => s + parseFloat(t.amount ?? '0'),
      0,
    );

    const todayRevenue = (todayOrders ?? []).reduce(
      (s: number, o: any) => s + parseFloat(o.amount ?? '0'),
      0,
    );

    const todayTripsCount = new Set(
      (todayOrders ?? []).map((o: any) => o.trips?.id).filter(Boolean),
    ).size;

    return NextResponse.json({
      month: {
        revenue: revenue.toFixed(2),
        expenses: expenses.toFixed(2),
        profit: (revenue - expenses).toFixed(2),
      },
      today: {
        revenue: todayRevenue.toFixed(2),
        tripsCount: todayTripsCount,
      },
      alerts: {
        tripsForReview: (reviewTrips as any)?.length ?? 0,
      },
      recentTransactions: recentTransactions ?? [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
