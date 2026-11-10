/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const PAYROLL_DRIVER_CAT = 'd79213ee-3bc6-4433-b58a-ca7ea1040d00';
const PAYROLL_LOADER_CAT = '18792fa8-fda8-472d-8e04-e19d2c6c053c';
const PAYROLL_MECHANIC_CAT = '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6';
const ALL_PAYROLL_CATS = [PAYROLL_DRIVER_CAT, PAYROLL_LOADER_CAT, PAYROLL_MECHANIC_CAT];

const CATEGORY_LABELS: Record<string, string> = {
  [PAYROLL_DRIVER_CAT]: 'ЗП водителя',
  [PAYROLL_LOADER_CAT]: 'ЗП грузчика',
  [PAYROLL_MECHANIC_CAT]: 'ЗП механика',
};

/** GET /api/employee/payroll — ожидающие подтверждения + накопленная сумма + история начислений и выплат */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cookieStore = await cookies();
  const userId =
    searchParams.get('user_id') ||
    request.headers.get('x-salda-user-id') ||
    cookieStore.get('salda_user_id')?.value;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();

  const [
    { data: pendingConf },
    { data: accumulatedRows },
    { data: paidRows },
    { data: allAccruals },
    { data: payoutsRows },
    { data: activeHoldsData },
    { data: userTrips },
    { data: userCashExpenses },
  ] = await Promise.all([
    // Ожидают подтверждения (отключено — подтверждения больше не требуются)
    Promise.resolve({ data: [] }),

    (supabase.from('transactions') as any)
      .select('amount')
      .eq('related_user_id', userId)
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'pending')
      .in('category_id', ALL_PAYROLL_CATS),

    (supabase.from('transactions') as any)
      .select('amount, description')
      .eq('related_user_id', userId)
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'completed')
      .in('category_id', ALL_PAYROLL_CATS)
      .is('from_wallet_id', null),

    // Все начисления за последнее время (включая ожидающие и выплаченные)
    (supabase.from('transactions') as any)
      .select(
        `id, amount, description, category_id, settlement_status, employee_confirmed, created_at, transaction_date,
         trip:trips(id, trip_number, started_at, asset:assets(short_name), driver:users!trips_driver_id_fkey(name)),
         service_order:service_orders(id, order_number, asset:assets(short_name))`,
      )
      .eq('related_user_id', userId)
      .eq('lifecycle_status', 'approved')
      .in('category_id', ALL_PAYROLL_CATS)
      .is('from_wallet_id', null)
      .order('transaction_date', { ascending: false })
      .limit(300),

    // История выплат (списания из кассы или переводы ЗП)
    (supabase.from('transactions') as any)
      .select('id, amount, description, created_at, transaction_date, from_wallet_id')
      .eq('related_user_id', userId)
      .eq('lifecycle_status', 'approved')
      .not('from_wallet_id', 'is', null)
      .order('transaction_date', { ascending: false })
      .limit(200),

    // Зафиксированные переносы подотчёта (holds)
    (supabase.from('transactions') as any)
      .select('amount')
      .eq('related_user_id', userId)
      .eq('category_id', '72f677d4-84af-4d0d-a845-a1b63c7ae607')
      .eq('settlement_status', 'pending')
      .neq('lifecycle_status', 'cancelled'),

    // Неутверждённые рейсы (в работе / на проверке)
    (supabase.from('trips') as any)
      .select('id, trip_orders(id, amount, payment_method, lifecycle_status)')
      .eq('driver_id', userId)
      .neq('lifecycle_status', 'cancelled')
      .neq('lifecycle_status', 'approved'),

    (supabase.from('trip_expenses') as any)
      .select('amount, payment_method, trips!inner(driver_id, lifecycle_status)')
      .eq('trips.driver_id', userId)
      .neq('trips.lifecycle_status', 'cancelled')
      .neq('trips.lifecycle_status', 'approved')
      .eq('payment_method', 'cash'),
  ]);

  const holdsCash = ((activeHoldsData as any[]) ?? []).reduce(
    (s: number, h: any) => s + parseFloat(h.amount ?? '0'),
    0,
  );

  const cashReceived = ((userTrips as any[]) ?? [])
    .flatMap((t: any) => t.trip_orders ?? [])
    .filter((o: any) => o.payment_method === 'cash' && o.lifecycle_status !== 'cancelled')
    .reduce((s: number, o: any) => s + parseFloat(o.amount ?? '0'), 0);

  const cashSpent = ((userCashExpenses as any[]) ?? []).reduce(
    (s: number, e: any) => s + parseFloat(e.amount ?? '0'),
    0,
  );

  const cash_on_hands = holdsCash + Math.max(0, cashReceived - cashSpent);

  const userTripIdsWithCash = new Set(
    (userTrips ?? [])
      .filter((t: any) =>
        (t.trip_orders ?? []).some(
          (o: any) => o.payment_method === 'cash' && o.lifecycle_status !== 'cancelled',
        ),
      )
      .map((t: any) => t.id),
  );

  const accumulated_total = (accumulatedRows ?? [])
    .reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0)
    .toFixed(2);
  const total_paid = (paidRows ?? [])
    .reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0)
    .toFixed(2);

  const pendingItems = (pendingConf ?? []).map((t: any) => {
    const tripDate = t.trip?.started_at ?? t.transaction_date;
    const dateStr = tripDate
      ? new Date(tripDate).toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null;

    let context = '';
    if (t.trip) {
      context = [
        `Рейс №${t.trip.trip_number}`,
        t.trip.driver?.name ? `Водитель: ${t.trip.driver.name}` : null,
        t.trip.asset?.short_name ?? null,
        dateStr,
      ]
        .filter(Boolean)
        .join(' · ');
    } else if (t.service_order) {
      context = [
        `Наряд #${t.service_order.order_number}`,
        t.service_order.asset?.short_name ?? null,
        dateStr,
      ]
        .filter(Boolean)
        .join(' · ');
    } else {
      context = dateStr ?? '';
    }

    return {
      id: t.id,
      amount: t.amount,
      category_id: t.category_id,
      label: CATEGORY_LABELS[t.category_id] ?? 'ЗП',
      context,
      trip_id: t.trip?.id ?? null,
      service_order_id: t.service_order?.id ?? null,
      date: tripDate,
      trip_number: t.trip?.trip_number ?? null,
      driver_name: t.trip?.driver?.name ?? null,
      asset_name: t.trip?.asset?.short_name ?? null,
    };
  });

  const accrualItems = (allAccruals ?? []).map((t: any) => {
    const tripDate = t.trip?.started_at ?? t.transaction_date;
    const hasUncollectedCash =
      cash_on_hands > 0 && t.trip?.id && userTripIdsWithCash.has(t.trip.id);
    return {
      id: t.id,
      amount: t.amount,
      category_id: t.category_id,
      label: CATEGORY_LABELS[t.category_id] ?? 'ЗП',
      settlement_status: t.settlement_status,
      employee_confirmed: t.employee_confirmed,
      date: tripDate,
      trip_id: t.trip?.id ?? null,
      trip_number: t.trip?.trip_number ?? null,
      driver_name: t.trip?.driver?.name ?? null,
      asset_name: t.trip?.asset?.short_name ?? null,
      description: t.description || null,
      has_uncollected_cash: Boolean(hasUncollectedCash),
    };
  });

  const payoutItems = (payoutsRows ?? []).map((t: any) => ({
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
  }));

  return NextResponse.json({
    pending_confirmation: pendingItems,
    pending_count: pendingItems.length,
    accumulated_total,
    total_paid,
    cash_on_hands,
    accruals: accrualItems,
    payouts: payoutItems,
  });
}

/** PATCH /api/employee/payroll — подтвердить или отклонить начисление */
export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('salda_user_id')?.value || request.headers.get('x-salda-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as {
    action: 'confirm' | 'reject';
    ids?: string[];
    id?: string;
  };

  const supabase = createAdminClient();

  if (body.action === 'confirm') {
    let query = (supabase.from('transactions') as any)
      .update({ employee_confirmed: true })
      .eq('related_user_id', userId)
      .in('category_id', ALL_PAYROLL_CATS);

    if (body.ids && body.ids.length > 0) {
      query = query.in('id', body.ids);
    }

    await query;
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'reject') {
    if (!body.id) return NextResponse.json({ error: 'id обязателен' }, { status: 400 });

    const { error } = await (supabase.from('transactions') as any)
      .update({
        lifecycle_status: 'cancelled',
        cancelled_reason: 'Отклонено сотрудником — требует корректировки ЗП',
      })
      .eq('id', body.id)
      .eq('related_user_id', userId)
      .eq('employee_confirmed', false);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
}
