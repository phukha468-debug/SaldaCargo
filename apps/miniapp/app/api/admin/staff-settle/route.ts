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
      trip:trips(trip_number, started_at, lifecycle_status, driver:users!trips_driver_id_fkey(name)),
      service_order:service_orders(order_number, created_at)
    `,
    )
    .eq('direction', 'expense')
    .eq('lifecycle_status', 'approved')
    .eq('settlement_status', 'pending')
    .eq('related_user_id', userId)
    .in('category_id', PAYROLL_CATEGORY_IDS)
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

  const queryTrips = (supabase.from('trips') as any)
    .select(
      'driver_id, trip_orders(amount, payment_method, lifecycle_status, settlement_status), trip_expenses(amount, payment_method)',
    )
    .eq('driver_id', userId)
    .neq('lifecycle_status', 'cancelled');

  const queryCollections = (supabase.from('cash_collections') as any)
    .select('amount')
    .eq('driver_id', userId);

  const promises: Promise<any>[] = [
    queryPending,
    queryAdvanceGiven,
    queryAdvanceOffset,
    queryUnconfirmedCount,
    queryTrips,
    queryCollections,
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
  const userTrips = results[4]?.data ?? [];
  const userCollections = results[5]?.data ?? [];
  const history = results[6]?.data ?? [];

  const cashIn = ((userTrips as any[]) ?? [])
    .flatMap((t: any) => t.trip_orders ?? [])
    .filter(
      (o: any) =>
        o.payment_method === 'cash' &&
        o.lifecycle_status !== 'cancelled' &&
        o.settlement_status === 'completed',
    )
    .reduce((s: number, o: any) => s + parseFloat(o.amount ?? '0'), 0);

  const cashSpent = ((userTrips as any[]) ?? [])
    .flatMap((t: any) => t.trip_expenses ?? [])
    .filter((e: any) => e.payment_method === 'cash')
    .reduce((s: number, e: any) => s + parseFloat(e.amount ?? '0'), 0);

  const cashCollected = ((userCollections as any[]) ?? []).reduce(
    (s: number, c: any) => s + parseFloat(c.amount ?? '0'),
    0,
  );

  const uncollectedCash = Math.max(0, Math.round((cashIn - cashSpent - cashCollected) * 100) / 100);

  const activePending = ((pendingPayroll as any[]) ?? []).filter(
    (t: any) => t.trip?.lifecycle_status !== 'cancelled',
  );

  const salaryTotal = activePending.reduce(
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
    uncollected_cash: uncollectedCash.toFixed(2),
    unconfirmed_count: unconfirmedCount,
    pending_transactions: pendingPayroll ?? [],
    history: history.map((t: any) => {
      const isPayoutTx =
        t.from_wallet_id !== null ||
        (t.description && t.description.startsWith('Выплата зарплаты'));
      return {
        ...t,
        is_payroll: PAYROLL_CATEGORY_IDS.includes(t.category_id) && !isPayoutTx,
        is_payout: isPayoutTx,
        is_advance: t.category_id === ADVANCE_CATEGORY_ID,
      };
    }),
  });
}

const WALLET_LABELS: Record<string, string> = {
  '10000000-0000-0000-0000-000000000001': 'Р/С',
  '10000000-0000-0000-0000-000000000002': 'Касса (Наличные)',
  '10000000-0000-0000-0000-000000000003': 'Карта',
};

interface WalletSplit {
  wallet_id: string;
  amount: number;
}

function resolveSplits(
  body: {
    from_wallet_id?: string;
    wallet_splits?: Array<{ wallet_id: string; amount: number | string }>;
  },
  requiredAmount: number,
): { splits: WalletSplit[]; error?: string } {
  let splits: WalletSplit[] = [];
  if (Array.isArray(body.wallet_splits) && body.wallet_splits.length > 0) {
    splits = body.wallet_splits
      .map((s) => ({
        wallet_id: String(s.wallet_id || '').trim(),
        amount: Math.round((parseFloat(String(s.amount)) || 0) * 100) / 100,
      }))
      .filter((s) => s.amount > 0 && s.wallet_id);
  } else if (body.from_wallet_id) {
    splits = [{ wallet_id: body.from_wallet_id, amount: requiredAmount }];
  }

  if (requiredAmount > 0) {
    if (splits.length === 0) {
      return {
        splits: [],
        error: 'Укажите кошелёк (или распределение по кошелькам) для выплаты',
      };
    }
    const sum = Math.round(splits.reduce((acc, s) => acc + s.amount, 0) * 100) / 100;
    if (Math.abs(sum - requiredAmount) > 0.05) {
      return {
        splits,
        error: `Сумма по кошелькам (${sum.toFixed(2)} ₽) не совпадает с суммой к выплате (${requiredAmount.toFixed(2)} ₽)`,
      };
    }
  }

  return { splits };
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
      wallet_splits?: Array<{ wallet_id: string; amount: number | string }>;
      partial_offset?: string;
      partial_amount?: string;
      action?: string;
      idempotency_key?: string;
      is_netting?: boolean;
      allow_uncollected?: boolean;
      collect_surplus?: boolean;
    };

    if (!body.user_id) {
      return NextResponse.json({ error: 'user_id обязателен' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const adminId = cookieStore.get('salda_user_id')?.value;
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createAdminClient();

    if (body.idempotency_key) {
      const { data: existingTx } = await (supabase.from('transactions') as any)
        .select('id, amount, settlement_status')
        .eq('idempotency_key', body.idempotency_key)
        .maybeSingle();

      if (existingTx) {
        return NextResponse.json({
          ok: true,
          idempotent: true,
          payout: existingTx.amount,
          message: 'Выплата уже проведена (idempotent)',
        });
      }
    }

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

    const partialAmountRaw = body.partial_amount ?? (body as any).amount;

    if (partialAmountRaw && parseFloat(partialAmountRaw) > 0) {
      const requestedAmount = parseFloat(partialAmountRaw);
      const sixtySecAgo = new Date(Date.now() - 60000).toISOString();
      const { data: recentDuplicate } = await (supabase.from('transactions') as any)
        .select('id, amount, created_at')
        .eq('direction', 'expense')
        .eq('related_user_id', body.user_id)
        .eq('lifecycle_status', 'approved')
        .gte('created_at', sixtySecAgo)
        .limit(10);

      if (recentDuplicate && recentDuplicate.length > 0) {
        const match = recentDuplicate.find(
          (t: any) => Math.abs(parseFloat(t.amount ?? '0') - requestedAmount) < 0.01,
        );
        if (match) {
          return NextResponse.json({
            ok: true,
            duplicate_prevented: true,
            payout: requestedAmount.toFixed(2),
            message: 'Выплата на эту сумму уже была проведена несколько секунд назад',
          });
        }
      }
    }

    const [
      { data: pendingPayroll },
      { data: advanceGiven },
      { data: advanceOffset },
      { data: userRow },
      { data: userTrips },
      { data: userCollections },
    ] = await Promise.all([
      (supabase.from('transactions') as any)
        .select(
          `
          id, amount, description, created_at, category_id, service_order_id, trip_id, direction, lifecycle_status, related_user_id, created_by,
          trip:trips(trip_number, started_at, lifecycle_status)
        `,
        )
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'pending')
        .eq('related_user_id', body.user_id)
        .in('category_id', PAYROLL_CATEGORY_IDS)
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

      (supabase.from('users') as any).select('name, roles').eq('id', body.user_id).single(),

      (supabase.from('trips') as any)
        .select(
          'id, driver_id, trip_orders(amount, payment_method, lifecycle_status, settlement_status), trip_expenses(amount, payment_method)',
        )
        .eq('driver_id', body.user_id)
        .neq('lifecycle_status', 'cancelled'),

      (supabase.from('cash_collections') as any).select('amount').eq('driver_id', body.user_id),
    ]);

    const cashIn = ((userTrips as any[]) ?? [])
      .flatMap((t: any) => t.trip_orders ?? [])
      .filter(
        (o: any) =>
          o.payment_method === 'cash' &&
          o.lifecycle_status !== 'cancelled' &&
          o.settlement_status === 'completed',
      )
      .reduce((s: number, o: any) => s + parseFloat(o.amount ?? '0'), 0);

    const cashSpent = ((userTrips as any[]) ?? [])
      .flatMap((t: any) => t.trip_expenses ?? [])
      .filter((e: any) => e.payment_method === 'cash')
      .reduce((s: number, e: any) => s + parseFloat(e.amount ?? '0'), 0);

    const cashCollected = ((userCollections as any[]) ?? []).reduce(
      (s: number, c: any) => s + parseFloat(c.amount ?? '0'),
      0,
    );

    const uncollectedCash = Math.max(
      0,
      Math.round((cashIn - cashSpent - cashCollected) * 100) / 100,
    );

    if (uncollectedCash > 0 && !body.is_netting && !body.allow_uncollected) {
      return NextResponse.json(
        {
          error: `У сотрудника числятся несданные наличные: ${uncollectedCash.toLocaleString('ru-RU')} ₽. Сначала примите деньги в кассу или проведите взаимозачёт.`,
          uncollected_cash: uncollectedCash,
        },
        { status: 400 },
      );
    }

    const employeeName = userRow?.name ?? 'Сотрудник';
    const dateLabel = new Date().toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const advanceTotal = ((advanceGiven as any[]) ?? []).reduce(
      (s: number, t: any) => s + parseFloat(t.amount ?? '0'),
      0,
    );
    const offsetTotal = ((advanceOffset as any[]) ?? []).reduce(
      (s: number, t: any) => s + parseFloat(t.amount ?? '0'),
      0,
    );
    const advanceBalance = Math.max(0, advanceTotal - offsetTotal);

    const workshopRoles = [
      'mechanic',
      'mechanic_lead',
      'welder',
      'painter',
      'electrician',
      'handyman',
    ];
    const operationalRole = (userRow?.roles as string[] | undefined)?.find(
      (r: string) => r === 'driver' || r === 'loader' || workshopRoles.includes(r),
    );
    const categoryId =
      operationalRole === 'driver'
        ? 'd79213ee-3bc6-4433-b58a-ca7ea1040d00'
        : operationalRole === 'loader'
          ? '18792fa8-fda8-472d-8e04-e19d2c6c053c'
          : workshopRoles.includes(operationalRole ?? '')
            ? '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6'
            : 'df1022df-4ea6-46fc-b9aa-f3c9eb4e7f30';

    const activePendingPayroll = ((pendingPayroll as any[]) ?? []).filter((t: any) => {
      if (t.trip?.lifecycle_status === 'cancelled') {
        // Фоново аннулируем зависшую транзакцию отмененного рейса
        (supabase.from('transactions') as any)
          .update({
            lifecycle_status: 'cancelled',
            cancelled_reason: `Рейс №${t.trip?.trip_number || ''} отменён`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', t.id)
          .then(() => {});
        return false;
      }
      return true;
    });

    if (!activePendingPayroll || activePendingPayroll.length === 0) {
      if (partialAmountRaw && parseFloat(partialAmountRaw) > 0) {
        const directAmount = parseFloat(partialAmountRaw);
        const { splits, error: splitErr } = resolveSplits(body, directAmount);
        if (splitErr) {
          return NextResponse.json({ error: splitErr }, { status: 400 });
        }

        const baseKey = body.idempotency_key || crypto.randomUUID();
        const insertOps = splits.map((s, idx) => {
          const wLabel = WALLET_LABELS[s.wallet_id] || `Кошелёк ${idx + 1}`;
          const desc =
            splits.length > 1
              ? `Выплата зарплаты (${wLabel}): ${employeeName} — ${dateLabel}`
              : `Выплата зарплаты: ${employeeName} — ${dateLabel}`;
          const idempKey = splits.length > 1 ? `${baseKey}_split_${s.wallet_id}` : baseKey;

          return (supabase.from('transactions') as any).insert({
            direction: 'expense',
            category_id: categoryId,
            amount: s.amount.toFixed(2),
            description: desc,
            transaction_date: new Date().toISOString(),
            lifecycle_status: 'approved',
            settlement_status: 'completed',
            related_user_id: body.user_id,
            from_wallet_id: s.wallet_id,
            created_by: adminId,
            idempotency_key: idempKey,
          });
        });

        const insResults = await Promise.all(insertOps);
        const insError = insResults.find((r) => r && r.error);
        if (insError) throw new Error(insError.error.message);

        return NextResponse.json({
          ok: true,
          payout: directAmount.toFixed(2),
          offset: '0.00',
          settled_count: 0,
          splits,
        });
      }
      return NextResponse.json({ error: 'Нет начисленной ЗП к выплате' }, { status: 400 });
    }

    const salaryTotal = activePendingPayroll.reduce(
      (s: number, t: any) => s + parseFloat(t.amount ?? '0'),
      0,
    );

    const maxOffset = Math.min(salaryTotal, advanceBalance);
    const hasExplicitOffset =
      body.partial_offset !== undefined &&
      body.partial_offset !== null &&
      body.partial_offset !== '';
    const offset = hasExplicitOffset
      ? Math.min(Math.max(0, parseFloat(body.partial_offset!)), maxOffset)
      : maxOffset;

    let idsToSettle: string[];
    let splitTxn: any = null;
    let splitNeeded = 0;
    let actualPayout: number;
    let actualOffset: number;

    if (partialAmountRaw !== undefined) {
      const requestedAmount = Math.min(Math.max(0, parseFloat(partialAmountRaw) || 0), salaryTotal);
      let accumulated = 0;
      idsToSettle = [];

      const sorted = [...activePendingPayroll].sort(
        (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
      );

      for (const t of sorted) {
        const amt = parseFloat(t.amount ?? '0');
        if (accumulated + amt <= requestedAmount + 0.001) {
          idsToSettle.push(t.id);
          accumulated += amt;
        } else if (accumulated < requestedAmount) {
          splitTxn = t;
          splitNeeded = requestedAmount - accumulated;
          accumulated += splitNeeded;
          break;
        }
      }
      if (idsToSettle.length === 0 && !splitTxn) {
        return NextResponse.json(
          { error: 'Сумма выплаты слишком мала или равна нулю.' },
          { status: 400 },
        );
      }
      const settledSalary = accumulated;
      const usedOffset = Math.min(offset, settledSalary);
      actualOffset = usedOffset;
      actualPayout = Math.max(0, settledSalary - usedOffset);
    } else {
      idsToSettle = activePendingPayroll.map((t: any) => t.id);
      actualOffset = offset;
      actualPayout = salaryTotal - offset;
    }

    let nettedAmount = 0;
    if (body.is_netting && uncollectedCash > 0) {
      nettedAmount = Math.min(actualPayout, uncollectedCash);
      actualPayout = Math.max(0, Math.round((actualPayout - nettedAmount) * 100) / 100);
    }

    const { splits, error: splitErr } = resolveSplits(body, actualPayout);
    if (splitErr) {
      return NextResponse.json({ error: splitErr }, { status: 400 });
    }

    const settledTxns = activePendingPayroll.filter((t: any) => idsToSettle.includes(t.id)) ?? [];
    if (splitTxn) settledTxns.push(splitTxn);

    const tripItems = settledTxns
      .map((t: any) => {
        const tripNum = t.trip?.trip_number;
        const amt = parseFloat(t.amount ?? '0').toFixed(0);
        return tripNum ? `Рейс №${tripNum} (${amt} ₽)` : null;
      })
      .filter(Boolean);

    const breakdownText = tripItems.length > 0 ? ` (${tripItems.join(', ')})` : '';
    const payoutDescription = `Выплата зарплаты: ${employeeName}${breakdownText}`;

    const ops: Promise<any>[] = [];
    const batchId = body.idempotency_key || crypto.randomUUID();

    if (actualPayout > 0 && splits.length > 0) {
      splits.forEach((s, idx) => {
        const wLabel = WALLET_LABELS[s.wallet_id] || `Кошелёк ${idx + 1}`;
        const desc =
          splits.length > 1
            ? `Выплата зарплаты (${wLabel}): ${employeeName}${breakdownText}`
            : payoutDescription;
        const idempKey = splits.length > 1 ? `${batchId}_split_${s.wallet_id}` : batchId;

        ops.push(
          (supabase.from('transactions') as any).insert({
            direction: 'expense',
            category_id: categoryId,
            amount: s.amount.toFixed(2),
            from_wallet_id: s.wallet_id,
            description: desc,
            transaction_date: new Date().toISOString(),
            lifecycle_status: 'approved',
            settlement_status: 'completed',
            related_user_id: body.user_id,
            created_by: adminId,
            idempotency_key: idempKey,
          }),
        );
      });
    }

    if (idsToSettle.length > 0) {
      ops.push(
        (supabase.from('transactions') as any)
          .update({
            settlement_status: 'completed',
            employee_confirmed: true,
            updated_at: new Date().toISOString(),
          })
          .in('id', idsToSettle),
      );
    }

    if (splitTxn) {
      ops.push(
        (supabase.from('transactions') as any)
          .update({
            amount: splitNeeded.toFixed(2),
            settlement_status: 'completed',
            employee_confirmed: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', splitTxn.id),
      );

      const remainder = parseFloat(splitTxn.amount ?? '0') - splitNeeded;
      if (remainder > 0.001) {
        const restFields = { ...splitTxn };
        delete restFields.id;
        delete restFields.created_at;
        delete restFields.updated_at;
        delete restFields.from_wallet_id;
        delete restFields.to_wallet_id;
        delete restFields.idempotency_key;
        delete restFields.settlement_status;
        delete restFields.amount;
        delete restFields.trip;
        ops.push(
          (supabase.from('transactions') as any).insert({
            ...restFields,
            created_by: splitTxn.created_by || adminId,
            amount: remainder.toFixed(2),
            settlement_status: 'pending',
            idempotency_key: crypto.randomUUID(),
          }),
        );
      }
    }

    if (nettedAmount > 0) {
      ops.push(
        (supabase.from('cash_collections') as any).insert({
          driver_id: body.user_id,
          amount: nettedAmount.toFixed(2),
          collected_by: adminId,
          note: `Взаимозачёт ЗП: ${employeeName} (удержано из выручки)`,
        }),
      );
    }

    if (body.collect_surplus && uncollectedCash > nettedAmount) {
      const surplus = Math.round((uncollectedCash - nettedAmount) * 100) / 100;
      ops.push(
        (supabase.from('cash_collections') as any).insert({
          driver_id: body.user_id,
          amount: surplus.toFixed(2),
          collected_by: adminId,
          note: `Сдача остатка выручки после взаимозачёта: ${employeeName}`,
        }),
      );
      const CASH_ID = '10000000-0000-0000-0000-000000000002';
      const { data: cashCollCat } = await (supabase.from('transaction_categories') as any)
        .select('id')
        .eq('code', 'CASH_COLLECT')
        .maybeSingle();

      ops.push(
        (supabase.from('transactions') as any).insert({
          direction: 'transfer',
          amount: surplus.toFixed(2),
          category_id: cashCollCat?.id || categoryId,
          to_wallet_id: CASH_ID,
          lifecycle_status: 'approved',
          settlement_status: 'completed',
          description: `Инкассация остатка выручки: ${employeeName}`,
          created_by: adminId,
          idempotency_key: `${batchId}_surplus`,
        }),
      );
    }

    if (actualOffset > 0) {
      // Запись о зачёте аванса (income = уменьшает остаток долга сотрудника, но НЕ пополняет кошелёк)
      ops.push(
        (supabase.from('transactions') as any).insert({
          direction: 'income',
          category_id: ADVANCE_CATEGORY_ID,
          amount: actualOffset.toFixed(2),
          description: `Зачёт аванса в счёт ЗП: ${employeeName} — ${dateLabel}`,
          transaction_date: new Date().toISOString(),
          lifecycle_status: 'approved',
          settlement_status: 'completed',
          to_wallet_id: null,
          related_user_id: body.user_id,
          created_by: adminId,
          idempotency_key: batchId,
        }),
      );
    }

    await Promise.all(ops);

    return NextResponse.json({
      ok: true,
      payout: actualPayout.toFixed(2),
      offset: actualOffset.toFixed(2),
      netted: nettedAmount.toFixed(2),
      settled_count: idsToSettle.length,
      splits,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
