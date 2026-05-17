/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * GET /api/driver/summary
 * Возвращает сводку для главного экрана водителя
 */
export async function GET() {
  const cookieStore = await cookies();
  const driverId = cookieStore.get('salda_user_id')?.value;

  if (!driverId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Активный рейс (только in_progress и не отменённые)
  const { data: activeTrip } = await (supabase
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
    .maybeSingle() as any);

  // Рейсы на ревью (завершены водителем, ожидают апрува админа)
  const { data: reviewTrips } = await (supabase
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
    .order('started_at', { ascending: false }) as any);

  // Последние 3 рейса (не активные)
  const { data: recentTrips } = await (supabase
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
    .limit(3) as any);

  // Подотчёт водителя (наличные на руках)
  // Это wallet типа driver_accountable для этого водителя
  const { data: wallet } = await (supabase
    .from('wallets')
    .select('id')
    .eq('owner_user_id', driverId)
    .eq('type', 'driver_accountable')
    .maybeSingle() as any);

  let accountableBalance = '0';
  if (wallet) {
    // Баланс = сумма всех транзакций в этот кошелёк - из него
    const { data: txns } = await (supabase
      .from('transactions')
      .select('direction, amount, from_wallet_id, to_wallet_id')
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'completed')
      .or(`from_wallet_id.eq.${wallet.id},to_wallet_id.eq.${wallet.id}`) as any);

    if (txns) {
      const balance = (txns as any[]).reduce((sum, t) => {
        const amount = parseFloat(t.amount);
        if (t.to_wallet_id === wallet.id) return sum + amount;
        if (t.from_wallet_id === wallet.id) return sum - amount;
        return sum;
      }, 0);
      accountableBalance = balance.toFixed(2);
    }
  }

  // ЗП за текущий месяц (из утверждённых рейсов)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: monthOrders } = await (supabase
    .from('trip_orders')
    .select('driver_pay, lifecycle_status, trips!inner(driver_id, started_at, lifecycle_status)')
    .eq('trips.driver_id', driverId)
    .gte('trips.started_at', monthStart)
    .neq('trips.lifecycle_status', 'cancelled') as any);

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
  });
}
