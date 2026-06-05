/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ADVANCE_CATEGORY_ID = 'a0000000-0000-0000-0000-000000000001';

const PAYROLL_CATEGORY_IDS = [
  'd79213ee-3bc6-4433-b58a-ca7ea1040d00', // PAYROLL_DRIVER
  '18792fa8-fda8-472d-8e04-e19d2c6c053c', // PAYROLL_LOADER
  '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6', // PAYROLL_MECHANIC
];

/**
 * GET /api/admin/staff-settle?user_id=...&year=...&month=...
 * Возвращает сводку: сколько pending ЗП, сколько аванса, сколько к выплате.
 * Если указаны year/month — возвращает историю начислений и выплат за этот период.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');
  if (!userId) return NextResponse.json({ error: 'user_id обязателен' }, { status: 400 });

  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : null;
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null;

  const supabase = createAdminClient();

  const queryPending = (supabase.from('transactions') as any)
    .select(
      `
      id, amount, description, created_at, transaction_date, category_id,
      trip:trips(trip_number, started_at, driver:users!trips_driver_id_fkey(name)),
      service_order:service_orders(order_number, created_at)
    `,
    )
    .eq('direction', 'expense')
    .eq('lifecycle_status', 'approved')
    .eq('settlement_status', 'pending')
    .eq('related_user_id', userId)
    .in('category_id', PAYROLL_CATEGORY_IDS)
    .or('employee_confirmed.is.null,employee_confirmed.eq.true')
    .order('created_at', { ascending: true });

  const queryUnconfirmedCount = (supabase.from('transactions') as any)
    .select('*', { count: 'exact', head: true })
    .eq('direction', 'expense')
    .eq('lifecycle_status', 'approved')
    .eq('settlement_status', 'pending')
    .eq('related_user_id', userId)
    .eq('employee_confirmed', false)
    .in('category_id', PAYROLL_CATEGORY_IDS);

  const queryAdvanceGiven = (supabase.from('transactions') as any)
    .select('amount')
    .eq('direction', 'expense')
    .eq('lifecycle_status', 'approved')
    .eq('category_id', ADVANCE_CATEGORY_ID)
    .eq('related_user_id', userId);

  const queryAdvanceOffset = (supabase.from('transactions') as any)
    .select('amount')
    .eq('direction', 'income')
    .eq('lifecycle_status', 'approved')
    .eq('category_id', ADVANCE_CATEGORY_ID)
    .eq('related_user_id', userId);

  const promises: Promise<any>[] = [
    queryPending,
    queryAdvanceGiven,
    queryAdvanceOffset,
    queryUnconfirmedCount,
  ];

  let historyPromise = Promise.resolve({ data: null });
  if (year && month) {
    const start = new Date(year, month - 1, 1).toISOString();
    const end = new Date(year, month, 0, 23, 59, 59).toISOString();
    historyPromise = (supabase.from('transactions') as any)
      .select(
        `
        id, amount, direction, description, created_at, transaction_date, category_id, settlement_status,
        trip:trips(trip_number, started_at, driver:users!trips_driver_id_fkey(name)),
        service_order:service_orders(order_number, created_at)
      `,
      )
      .eq('lifecycle_status', 'approved')
      .eq('related_user_id', userId)
      .or(`category_id.in.(${[...PAYROLL_CATEGORY_IDS, ADVANCE_CATEGORY_ID].join(',')})`)
      .gte('transaction_date', start)
      .lte('transaction_date', end)
      .order('transaction_date', { ascending: false });
    promises.push(historyPromise);
  }

  const results = await Promise.all(promises);
  const pendingPayroll = results[0].data;
  const advanceGiven = results[1].data;
  const advanceOffset = results[2].data;
  const unconfirmedCount = results[3]?.count ?? 0;
  const history = results[4]?.data ?? [];

  const salaryTotal = ((pendingPayroll as any[]) ?? []).reduce(
    (s: number, t: any) => s + parseFloat(t.amount ?? '0'),
    0,
  );
  const advanceTotal = ((advanceGiven as any[]) ?? []).reduce(
    (s: number, t: any) => s + parseFloat(t.amount ?? '0'),
    0,
  );
  const offsetTotal = ((advanceOffset as any[]) ?? []).reduce(
    (s: number, t: any) => s + parseFloat(t.amount ?? '0'),
    0,
  );

  const advanceBalance = Math.max(0, advanceTotal - offsetTotal);
  const offset = Math.min(salaryTotal, advanceBalance);
  const payout = salaryTotal - offset;

  return NextResponse.json({
    salary_total: salaryTotal.toFixed(2),
    advance_balance: advanceBalance.toFixed(2),
    offset: offset.toFixed(2),
    payout: payout.toFixed(2),
    unconfirmed_count: unconfirmedCount,
    pending_transactions: pendingPayroll ?? [],
    history: history.map((t: any) => ({
      ...t,
      is_payroll: PAYROLL_CATEGORY_IDS.includes(t.category_id),
      is_advance: t.category_id === ADVANCE_CATEGORY_ID,
    })),
  });
}

/**
 * POST /api/admin/staff-settle — выплатить ЗП сотруднику
 * (Синхронизировано с логикой WebApp: закрывает pending транзакции)
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      user_id: string;
      from_wallet_id?: string;
      partial_offset?: string;
      partial_amount?: string;
      action?: string;
    };

    if (!body.user_id) {
      return NextResponse.json({ error: 'user_id обязателен' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const adminId = cookieStore.get('salda_user_id')?.value;
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createAdminClient();

    if (body.action === 'confirm_unconfirmed') {
      await (supabase.from('transactions') as any)
        .update({ employee_confirmed: true })
        .eq('related_user_id', body.user_id)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'pending')
        .eq('employee_confirmed', false)
        .in('category_id', PAYROLL_CATEGORY_IDS);
      return NextResponse.json({ ok: true });
    }

    if (!body.from_wallet_id) {
      return NextResponse.json({ error: 'from_wallet_id обязателен' }, { status: 400 });
    }

    const [
      { data: pendingPayroll },
      { data: advanceGiven },
      { data: advanceOffset },
      { data: userRow },
    ] = await Promise.all([
      (supabase.from('transactions') as any)
        .select('id, amount, description, created_at')
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'pending')
        .eq('related_user_id', body.user_id)
        .in('category_id', PAYROLL_CATEGORY_IDS)
        .or('employee_confirmed.is.null,employee_confirmed.eq.true')
        .order('created_at', { ascending: true }),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .eq('category_id', ADVANCE_CATEGORY_ID)
        .eq('related_user_id', body.user_id),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('direction', 'income')
        .eq('lifecycle_status', 'approved')
        .eq('category_id', ADVANCE_CATEGORY_ID)
        .eq('related_user_id', body.user_id),

      (supabase.from('users') as any).select('name').eq('id', body.user_id).single(),
    ]);

    if (!pendingPayroll || (pendingPayroll as any[]).length === 0) {
      return NextResponse.json({ error: 'Нет начисленной ЗП к выплате' }, { status: 400 });
    }

    const salaryTotal = (pendingPayroll as any[]).reduce(
      (s: number, t: any) => s + parseFloat(t.amount ?? '0'),
      0,
    );
    const advanceTotal = ((advanceGiven as any[]) ?? []).reduce(
      (s: number, t: any) => s + parseFloat(t.amount ?? '0'),
      0,
    );
    const offsetTotal = ((advanceOffset as any[]) ?? []).reduce(
      (s: number, t: any) => s + parseFloat(t.amount ?? '0'),
      0,
    );

    const advanceBalance = Math.max(0, advanceTotal - offsetTotal);
    const maxOffset = Math.min(salaryTotal, advanceBalance);
    const offset =
      body.partial_offset !== undefined
        ? Math.min(Math.max(0, parseFloat(body.partial_offset)), maxOffset)
        : maxOffset;

    // Logic for partial payment or full payment
    let idsToSettle: string[];
    let actualPayout: number;
    let actualOffset: number;

    if (body.partial_amount !== undefined) {
      const requestedAmount = Math.min(
        Math.max(0, parseFloat(body.partial_amount) || 0),
        salaryTotal,
      );
      let accumulated = 0;
      idsToSettle = [];
      for (const t of pendingPayroll as any[]) {
        const amt = parseFloat(t.amount ?? '0');
        if (accumulated + amt <= requestedAmount + 0.001) {
          idsToSettle.push(t.id);
          accumulated += amt;
        }
      }
      if (idsToSettle.length === 0) {
        const minAmount = Math.min(
          ...(pendingPayroll as any[]).map((t: any) => parseFloat(t.amount ?? '0')),
        );
        return NextResponse.json(
          {
            error: `Сумма слишком маленькая. Минимальное начисление: ${minAmount.toFixed(2)} ₽.`,
          },
          { status: 400 },
        );
      }
      const settledSalary = accumulated;
      const usedOffset = Math.min(offset, settledSalary);
      actualOffset = usedOffset;
      actualPayout = Math.max(0, settledSalary - usedOffset);
    } else {
      idsToSettle = (pendingPayroll as any[]).map((t: any) => t.id);
      actualOffset = offset;
      actualPayout = salaryTotal - offset;
    }

    const employeeName = userRow?.name ?? 'Сотрудник';
    const dateLabel = new Date().toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const ops: Promise<any>[] = [
      // Переводим выбранные начисления в completed
      (supabase.from('transactions') as any)
        .update({
          settlement_status: 'completed',
          from_wallet_id: actualPayout > 0 ? body.from_wallet_id : null,
        })
        .in('id', idsToSettle),
    ];

    if (actualOffset > 0) {
      // Регистрируем зачёт аванса
      ops.push(
        (supabase.from('transactions') as any).insert({
          direction: 'income',
          category_id: ADVANCE_CATEGORY_ID,
          amount: actualOffset.toFixed(2),
          description: `Зачёт аванса в счёт ЗП: ${employeeName} — ${dateLabel}`,
          lifecycle_status: 'approved',
          settlement_status: 'completed',
          related_user_id: body.user_id,
          created_by: adminId,
          idempotency_key: crypto.randomUUID(),
        }),
      );
    }

    await Promise.all(ops);

    return NextResponse.json({
      ok: true,
      payout: actualPayout.toFixed(2),
      offset: actualOffset.toFixed(2),
      settled_count: idsToSettle.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
