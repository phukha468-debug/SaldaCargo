/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * GET /api/driver/summary
 * Возвращает сводку для главного экрана водителя
 */
export async function GET(request: Request) {
  const cookieStore = await cookies();
  const driverId =
    cookieStore.get('salda_user_id')?.value || request.headers.get('x-salda-user-id');

  if (!driverId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const PAYROLL_DRIVER_CAT = 'd79213ee-3bc6-4433-b58a-ca7ea1040d00';
  const PAYROLL_LOADER_CAT = '18792fa8-fda8-472d-8e04-e19d2c6c053c';

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Вычисление подотчёта водителя в параллельном потоке
  const getAccountableBalanceTask = async (): Promise<string> => {
    try {
      const { data: wallet } = await (supabase
        .from('wallets')
        .select('id')
        .eq('owner_user_id', driverId)
        .eq('type', 'driver_accountable')
        .maybeSingle() as any);

      if (!wallet) return '0.00';

      const { data: txns } = await (supabase
        .from('transactions')
        .select('direction, amount, from_wallet_id, to_wallet_id')
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .or(`from_wallet_id.eq.${wallet.id},to_wallet_id.eq.${wallet.id}`) as any);

      if (!txns || txns.length === 0) return '0.00';

      const balance = (txns as any[]).reduce((sum, t) => {
        const amount = parseFloat(t.amount);
        if (t.to_wallet_id === wallet.id) return sum + amount;
        if (t.from_wallet_id === wallet.id) return sum - amount;
        return sum;
      }, 0);
      return balance.toFixed(2);
    } catch (e) {
      console.warn('Error fetching driver wallet balance:', e);
      return '0.00';
    }
  };

  // Параллельный запуск всех независимых запросов к БД в один такт
  const [
    activeTripRes,
    reviewTripsRes,
    recentTripsRes,
    accountableBalance,
    monthOrdersRes,
    pendingPayrollCountRes,
  ] = await Promise.all([
    // 1. Активный рейс (только in_progress и не отменённые)
    supabase
      .from('trips')
      .select(
        `
        id, trip_number, status, started_at, trip_type,
        asset:assets(short_name, reg_number)
      `,
      )
      .eq('driver_id', driverId)
      .eq('status', 'in_progress')
      .neq('lifecycle_status', 'cancelled')
      .maybeSingle() as any,

    // 2. Рейсы на ревью (завершены водителем, ожидают апрува админа)
    supabase
      .from('trips')
      .select(
        `
        id, trip_number, status, lifecycle_status, started_at, ended_at,
        asset:assets(short_name),
        trip_orders(amount, driver_pay, lifecycle_status)
      `,
      )
      .eq('driver_id', driverId)
      .eq('status', 'completed')
      .eq('lifecycle_status', 'draft')
      .order('started_at', { ascending: false }) as any,

    // 3. Последние 3 рейса (не активные)
    supabase
      .from('trips')
      .select(
        `
        id, trip_number, status, lifecycle_status, started_at, ended_at,
        asset:assets(short_name),
        trip_orders(amount, driver_pay, lifecycle_status)
      `,
      )
      .eq('driver_id', driverId)
      .eq('lifecycle_status', 'approved')
      .order('started_at', { ascending: false })
      .limit(3) as any,

    // 4. Подотчёт водителя (кошелёк + транзакции параллельно)
    getAccountableBalanceTask(),

    // 5. ЗП за текущий месяц (из утверждённых рейсов)
    supabase
      .from('trip_orders')
      .select('driver_pay, lifecycle_status, trips!inner(driver_id, started_at, lifecycle_status)')
      .eq('trips.driver_id', driverId)
      .gte('trips.started_at', monthStart)
      .neq('trips.lifecycle_status', 'cancelled') as any,

    // 6. Количество ЗП-транзакций, ожидающих подтверждения сотрудника
    (supabase.from('transactions') as any)
      .select('*', { count: 'exact', head: true })
      .eq('related_user_id', driverId)
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'pending')
      .eq('employee_confirmed', false)
      .in('category_id', [PAYROLL_DRIVER_CAT, PAYROLL_LOADER_CAT]),
  ]);

  const activeTrip = activeTripRes.data;
  const reviewTrips = reviewTripsRes.data;
  const recentTrips = recentTripsRes.data;
  const monthOrders = monthOrdersRes.data;
  const pendingPayrollCount = pendingPayrollCountRes.count;

  const approvedPay = (monthOrders ?? [])
    .filter((o: any) => o.lifecycle_status === 'approved')
    .reduce((sum: number, o: any) => sum + parseFloat(o.driver_pay), 0);

  const draftPay = (monthOrders ?? [])
    .filter(
      (o: any) => o.lifecycle_status === 'draft' && (o.trips as any)?.lifecycle_status === 'draft',
    )
    .reduce((sum: number, o: any) => sum + parseFloat(o.driver_pay), 0);

  return NextResponse.json(
    {
      activeTrip,
      reviewTrips: reviewTrips ?? [],
      recentTrips: recentTrips ?? [],
      accountableBalance,
      monthPayApproved: approvedPay.toFixed(2),
      monthPayDraft: draftPay.toFixed(2),
      pendingPayrollCount: pendingPayrollCount ?? 0,
    },
    {
      headers: {
        'Cache-Control': 'private, no-cache, stale-while-revalidate=15',
      },
    },
  );
}
