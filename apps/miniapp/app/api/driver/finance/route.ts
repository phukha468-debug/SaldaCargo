/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/** GET /api/driver/finance — финансовая информация текущего водителя */
export async function GET() {
  const cookieStore = await cookies();
  const driverId = cookieStore.get('salda_user_id')?.value;

  if (!driverId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();

  // 1. Подотчёт: нал на руках у водителя
  // Считаем напрямую из заказов — нал получен сразу, не ждём ревью от админа.
  // cash = наличные заказы; card_driver не считается — деньги не проходят через руки водителя
  const CASH_METHODS = ['cash'];

  const { data: cashTrips } = await (supabase
    .from('trips')
    .select(
      `id, trip_number, started_at, ended_at, status,
       asset:assets(short_name),
       trip_orders(id, amount, payment_method, lifecycle_status, created_at),
       trip_expenses(id, amount, payment_method)`,
    )
    .eq('driver_id', driverId)
    .neq('lifecycle_status', 'cancelled')
    .order('started_at', { ascending: false })
    .limit(60) as any);

  // Дата последней инкассации — считаем только рейсы ПОСЛЕ неё
  const { data: collections } = await (supabase
    .from('cash_collections')
    .select('amount, created_at')
    .eq('driver_id', driverId) as any);

  const lastCollectedAt =
    (collections ?? []).length > 0
      ? Math.max(...(collections as any[]).map((c: any) => new Date(c.created_at).getTime()))
      : null;

  const freshTrips = lastCollectedAt
    ? (cashTrips ?? []).filter((t: any) => new Date(t.started_at).getTime() > lastCollectedAt)
    : (cashTrips ?? []);

  const freshCashOrders: any[] = freshTrips.flatMap((trip: any) =>
    (trip.trip_orders ?? [])
      .filter(
        (o: any) => CASH_METHODS.includes(o.payment_method) && o.lifecycle_status !== 'cancelled',
      )
      .map((o: any) => ({ ...o, trip_number: trip.trip_number, asset: trip.asset })),
  );

  const cashIn = freshCashOrders.reduce((sum: number, o: any) => sum + parseFloat(o.amount), 0);

  // Наличные расходы водителя (только свежие рейсы)
  const cashSpent = freshTrips
    .flatMap((trip: any) => (trip.trip_expenses as any[]) ?? [])
    .filter((e: any) => CASH_METHODS.includes(e.payment_method))
    .reduce((sum: number, e: any) => sum + parseFloat(e.amount ?? '0'), 0);

  const cashBalance = Math.max(0, cashIn - cashSpent).toFixed(2);

  // 2. ЗП по рейсам (текущий месяц)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: salaryTrips } = await (supabase
    .from('trips')
    .select(
      `id, trip_number, started_at, lifecycle_status,
       asset:assets(short_name),
       trip_orders(driver_pay, lifecycle_status)`,
    )
    .eq('driver_id', driverId)
    .gte('started_at', monthStart)
    .neq('lifecycle_status', 'cancelled')
    .order('started_at', { ascending: false }) as any);

  return NextResponse.json({
    accountable: {
      balance: cashBalance,
      // Показываем последние 20 наличных заказов как историю
      transactions: freshCashOrders.slice(0, 20).map((o: any) => ({
        id: o.id,
        amount: o.amount,
        description: `Рейс №${o.trip_number} · ${o.asset?.short_name ?? ''}`,
        payment_method: o.payment_method,
        created_at: o.created_at,
      })),
    },
    salary: { trips: salaryTrips ?? [] },
  });
}
