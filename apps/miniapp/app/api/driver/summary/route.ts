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

  // Параллельный запуск всех независимых запросов к БД в один такт
  const [
    activeTripRes,
    reviewTripsRes,
    recentTripsRes,
    cashTripsRes,
    collectionsRes,
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

    // 4. Рейсы с наличными для точного подотчёта (согласно LL-ARCH-001)
    supabase
      .from('trips')
      .select(
        `
        id, trip_number, started_at, ended_at,
        trip_orders(amount, payment_method, lifecycle_status, created_at),
        trip_expenses(amount, payment_method)
      `,
      )
      .eq('driver_id', driverId)
      .neq('lifecycle_status', 'cancelled')
      .order('started_at', { ascending: false })
      .limit(30) as any,

    // 5. Инкассации наличных
    supabase.from('cash_collections').select('amount, created_at').eq('driver_id', driverId) as any,

    // 6. ЗП за текущий месяц (из утверждённых рейсов)
    supabase
      .from('trip_orders')
      .select('driver_pay, lifecycle_status, trips!inner(driver_id, started_at, lifecycle_status)')
      .eq('trips.driver_id', driverId)
      .gte('trips.started_at', monthStart)
      .neq('trips.lifecycle_status', 'cancelled') as any,

    // 7. Количество ЗП-транзакций, ожидающих подтверждения сотрудника
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
  const cashTrips = cashTripsRes.data;
  const collections = collectionsRes.data;
  const monthOrders = monthOrdersRes.data;
  const pendingPayrollCount = pendingPayrollCountRes.count;

  // Точный расчёт подотчёта водителя (нал на руках)
  const lastCollectedAt =
    (collections ?? []).length > 0
      ? (collections ?? []).sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )[0].created_at
      : null;

  let cashIn = 0;
  let cashSpent = 0;

  for (const t of cashTrips ?? []) {
    for (const o of t.trip_orders ?? []) {
      if (
        o.lifecycle_status !== 'cancelled' &&
        o.payment_method === 'cash' &&
        (!lastCollectedAt || o.created_at > lastCollectedAt)
      ) {
        cashIn += parseFloat(o.amount ?? '0');
      }
    }
    for (const e of t.trip_expenses ?? []) {
      if (
        e.payment_method === 'cash' &&
        (!lastCollectedAt || (t.ended_at && t.ended_at > lastCollectedAt))
      ) {
        cashSpent += parseFloat(e.amount ?? '0');
      }
    }
  }

  const accountableBalance = Math.max(0, cashIn - cashSpent).toFixed(2);

  const approvedPay = (monthOrders ?? [])
    .filter((o: any) => o.lifecycle_status === 'approved')
    .reduce((sum: number, o: any) => sum + parseFloat(o.driver_pay), 0);

  const draftPay = (monthOrders ?? [])
    .filter(
      (o: any) => o.lifecycle_status === 'draft' && (o.trips as any)?.lifecycle_status === 'draft',
    )
    .reduce((sum: number, o: any) => sum + parseFloat(o.driver_pay), 0);

  return NextResponse.json({
    activeTrip,
    reviewTrips: reviewTrips ?? [],
    recentTrips: recentTrips ?? [],
    accountableBalance,
    monthPayApproved: approvedPay.toFixed(2),
    monthPayDraft: draftPay.toFixed(2),
    pendingPayrollCount: pendingPayrollCount ?? 0,
  });
}
