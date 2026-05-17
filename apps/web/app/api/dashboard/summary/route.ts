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

    const CAT_FUEL = '62cebf3f-9982-4cc6-904b-48c6169cf5e4';
    const CAT_PAYROLL = [
      'd79213ee-3bc6-4433-b58a-ca7ea1040d00', // ЗП водителя
      '18792fa8-fda8-472d-8e04-e19d2c6c053c', // ЗП грузчика
      '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6', // ЗП механика
    ];

    const [
      { data: monthOrders },
      { data: monthExpenses },
      { data: todayOrders },
      { count: reviewTripsCount },
      { data: recentTransactions },
      { data: tripFuelExpenses },
      { data: tripPayroll },
      { data: txFuel },
    ] = await Promise.all([
      // Выручка за месяц: одобренные заказы
      (supabase as any)
        .from('trip_orders')
        .select('amount, trips!inner(started_at, lifecycle_status)')
        .eq('lifecycle_status', 'approved')
        .eq('trips.lifecycle_status', 'approved')
        .gte('trips.started_at', monthStart)
        .lte('trips.started_at', monthEnd),

      // Расходы за месяц: прямые транзакции (без PAYROLL и без корректировок остатков)
      (supabase as any)
        .from('transactions')
        .select('amount')
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .not('category_id', 'in', `(${CAT_PAYROLL.join(',')})`)
        .neq('description', 'Корректировка остатка')
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

      // Все расходы из рейсов (trip_expenses) — для ГСМ и общей суммы
      (supabase as any)
        .from('trip_expenses')
        .select('amount, category_id, trips!inner(started_at, lifecycle_status)')
        .eq('trips.lifecycle_status', 'approved')
        .gte('trips.started_at', monthStart)
        .lte('trips.started_at', monthEnd),

      // ЗП из заказов (driver_pay + loader_pay + loader2_pay)
      (supabase as any)
        .from('trip_orders')
        .select('driver_pay, loader_pay, loader2_pay, trips!inner(started_at, lifecycle_status)')
        .eq('lifecycle_status', 'approved')
        .eq('trips.lifecycle_status', 'approved')
        .gte('trips.started_at', monthStart)
        .lte('trips.started_at', monthEnd),

      // ГСМ из прямых транзакций
      (supabase as any)
        .from('transactions')
        .select('amount')
        .eq('category_id', CAT_FUEL)
        .eq('lifecycle_status', 'approved')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd),
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

    // trip_expenses — все расходы в рейсах (ГСМ, прочее)
    const tripExpensesTotal = (tripFuelExpenses ?? []).reduce(
      (s: number, e: any) => s + parseFloat(e.amount ?? '0'),
      0,
    );

    // ГСМ из trips + прямых транзакций (для плитки)
    const fuelFromTrips = (tripFuelExpenses ?? [])
      .filter((e: any) => e.category_id === CAT_FUEL)
      .reduce((s: number, e: any) => s + parseFloat(e.amount ?? '0'), 0);
    const fuelFromTx = (txFuel ?? []).reduce(
      (s: number, t: any) => s + parseFloat(t.amount ?? '0'),
      0,
    );
    const fuelTotal = fuelFromTrips + fuelFromTx;

    // ЗП из trip_orders (не попадает в transactions — отдельный источник)
    const payrollFromOrders = (tripPayroll ?? []).reduce(
      (s: number, o: any) =>
        s +
        parseFloat(o.driver_pay ?? '0') +
        parseFloat(o.loader_pay ?? '0') +
        parseFloat(o.loader2_pay ?? '0'),
      0,
    );
    // Плитка ЗП = начисленная ЗП из рейсов (единственный источник)
    const payrollTotal = payrollFromOrders;

    // Итог: transactions + trip_expenses + driver_pay (без двойного счёта)
    const totalExpenses = expenses + tripExpensesTotal + payrollFromOrders;

    return NextResponse.json({
      month: {
        revenue: revenue.toFixed(2),
        expenses: totalExpenses.toFixed(2),
        profit: (revenue - totalExpenses).toFixed(2),
        fuel: fuelTotal.toFixed(2),
        payroll: payrollTotal.toFixed(2),
      },
      today: {
        revenue: todayRevenue.toFixed(2),
        tripsCount: todayTripsCount,
      },
      alerts: {
        tripsForReview: reviewTripsCount ?? 0,
      },
      recentTransactions: recentTransactions ?? [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
