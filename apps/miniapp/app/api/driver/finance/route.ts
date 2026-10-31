/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const PAYROLL_DRIVER_CAT = 'd79213ee-3bc6-4433-b58a-ca7ea1040d00';
const PAYROLL_LOADER_CAT = '18792fa8-fda8-472d-8e04-e19d2c6c053c';
const DRIVER_PAYROLL_CATS = [PAYROLL_DRIVER_CAT, PAYROLL_LOADER_CAT];

/** GET /api/driver/finance — финансовая информация текущего водителя/грузчика */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cookieStore = await cookies();
  const driverId =
    searchParams.get('user_id') ||
    request.headers.get('x-salda-user-id') ||
    cookieStore.get('salda_user_id')?.value;

  if (!driverId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();

  // 1 & 2. Параллельный запуск всех запросов к БД в один такт
  const CASH_METHODS = ['cash'];

  const [
    { data: cashTrips },
    { data: collections },
    { data: pendingConfirmation },
    { data: accumulatedRows },
    { data: monthlyAccruals },
    { data: holds },
    { data: payoutsRows },
  ] = await Promise.all([
    supabase
      .from('trips')
      .select(
        `id, trip_number, started_at, ended_at, status,
         asset:assets(short_name),
         trip_orders(id, amount, payment_method, lifecycle_status, created_at),
         trip_expenses(id, amount, payment_method)`,
      )
      .eq('driver_id', driverId)
      .neq('lifecycle_status', 'cancelled')
      .neq('lifecycle_status', 'approved')
      .order('started_at', { ascending: false })
      .limit(60) as any,

    supabase.from('cash_collections').select('amount, created_at').eq('driver_id', driverId) as any,

    // Ожидают подтверждения
    (supabase.from('transactions') as any)
      .select(
        `id, amount, description, category_id, transaction_date,
       trip:trips(id, trip_number, started_at, asset:assets(short_name), driver:users!trips_driver_id_fkey(name))`,
      )
      .eq('related_user_id', driverId)
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'pending')
      .eq('employee_confirmed', false)
      .in('category_id', DRIVER_PAYROLL_CATS)
      .order('transaction_date', { ascending: true }),

    // Подтверждено, к выплате (all-time)
    (supabase.from('transactions') as any)
      .select('amount')
      .eq('related_user_id', driverId)
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'pending')
      .or('employee_confirmed.is.null,employee_confirmed.eq.true')
      .in('category_id', DRIVER_PAYROLL_CATS),

    // История начислений (все последние начисления: к выплате и выплаченные)
    (supabase.from('transactions') as any)
      .select(
        `id, amount, description, category_id, settlement_status, transaction_date,
       trip:trips(trip_number, started_at, asset:assets(short_name), driver:users!trips_driver_id_fkey(name))`,
      )
      .eq('related_user_id', driverId)
      .eq('lifecycle_status', 'approved')
      .or('employee_confirmed.is.null,employee_confirmed.eq.true')
      .in('category_id', DRIVER_PAYROLL_CATS)
      .is('from_wallet_id', null)
      .order('transaction_date', { ascending: false })
      .limit(50),

    // Зафиксированные переносы подотчёта на руках
    (supabase.from('transactions') as any)
      .select('id, amount, description, created_at, transaction_date')
      .eq('related_user_id', driverId)
      .eq('category_id', '72f677d4-84af-4d0d-a845-a1b63c7ae607')
      .eq('settlement_status', 'pending')
      .neq('lifecycle_status', 'cancelled')
      .order('created_at', { ascending: false }),

    // История выплат ЗП (выплаты из кассы/кошелька)
    (supabase.from('transactions') as any)
      .select('id, amount, description, created_at, transaction_date, from_wallet_id')
      .eq('related_user_id', driverId)
      .eq('lifecycle_status', 'approved')
      .not('from_wallet_id', 'is', null)
      .order('transaction_date', { ascending: false })
      .limit(30),
  ]);

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
  const cashSpent = freshTrips
    .flatMap((trip: any) => (trip.trip_expenses as any[]) ?? [])
    .filter((e: any) => CASH_METHODS.includes(e.payment_method))
    .reduce((sum: number, e: any) => sum + parseFloat(e.amount ?? '0'), 0);

  // Зафиксированные переносы подотчёта на руках
  const activeHolds = (holds as any[]) ?? [];
  const carryoverTotal = activeHolds.reduce(
    (acc: number, h: any) => acc + parseFloat(h.amount ?? '0'),
    0,
  );
  const activeCarryover =
    activeHolds.length > 0
      ? {
          id: activeHolds[0].id,
          amount: carryoverTotal.toFixed(2),
          note:
            activeHolds[0].description?.replace('[CARRYOVER] ', '') ||
            'Остаток на руках, перенос на следующий день',
          date: activeHolds[0].created_at,
        }
      : null;

  const cashBalance = Math.max(0, cashIn - cashSpent + carryoverTotal).toFixed(2);

  const accumulated_total = (accumulatedRows ?? [])
    .reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0)
    .toFixed(2);

  const PAYROLL_LABELS: Record<string, string> = {
    [PAYROLL_DRIVER_CAT]: 'ЗП водителя',
    [PAYROLL_LOADER_CAT]: 'ЗП грузчика',
  };

  return NextResponse.json({
    accountable: {
      balance: cashBalance,
      carryover: carryoverTotal.toFixed(2),
      activeCarryover,
      transactions: freshCashOrders.slice(0, 20).map((o: any) => ({
        id: o.id,
        amount: o.amount,
        description: `Рейс №${o.trip_number} · ${o.asset?.short_name ?? ''}`,
        payment_method: o.payment_method,
        created_at: o.created_at,
      })),
    },
    salary: {
      pending_confirmation: (pendingConfirmation ?? []).map((t: any) => {
        const d = t.trip?.started_at ?? t.transaction_date;
        const dateStr = d
          ? new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
          : null;
        return {
          id: t.id,
          amount: t.amount,
          category_id: t.category_id,
          label: PAYROLL_LABELS[t.category_id] ?? 'ЗП',
          context: [
            t.trip ? `Рейс №${t.trip.trip_number}` : null,
            t.trip?.asset?.short_name ?? null,
            dateStr,
          ]
            .filter(Boolean)
            .join(' · '),
        };
      }),
      accumulated_total,
      accruals: (monthlyAccruals ?? []).map((t: any) => ({
        id: t.id,
        amount: t.amount,
        category_id: t.category_id,
        label: PAYROLL_LABELS[t.category_id] ?? 'ЗП',
        settlement_status: t.settlement_status,
        date: t.trip?.started_at ?? t.transaction_date,
        trip_number: t.trip?.trip_number ?? null,
        asset_name: t.trip?.asset?.short_name ?? null,
        driver_name: t.trip?.driver?.name ?? null,
        description: t.description ?? null,
      })),
      payouts: (payoutsRows ?? []).map((t: any) => ({
        id: t.id,
        amount: t.amount,
        date: t.transaction_date ?? t.created_at,
        description: t.description || 'Выплата зарплаты',
        wallet_name:
          t.from_wallet_id === '10000000-0000-0000-0000-000000000002'
            ? 'Касса (нал)'
            : t.from_wallet_id === '10000000-0000-0000-0000-000000000001'
              ? 'Б/Н (Карта)'
              : 'Касса',
        created_at: t.created_at,
      })),
    },
  });
}
