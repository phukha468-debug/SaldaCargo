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

async function getAdminId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.split('Bearer ')[1] ?? null;
  }
  const cookieStore = await cookies();
  const token = cookieStore.get('salda_auth_token')?.value;
  if (token) return token;

  const supabase = createAdminClient();
  const { data: adminUser } = await (supabase.from('users') as any)
    .select('id')
    .filter('roles', 'cs', '{"admin"}')
    .limit(1)
    .single();
  return adminUser?.id ?? null;
}

/**
 * GET /api/staff/settle?user_id=...
 * Возвращает сводку: сколько pending ЗП, сколько аванса, сколько к выплате
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');
  if (!userId) return NextResponse.json({ error: 'user_id обязателен' }, { status: 400 });

  const supabase = createAdminClient();

  const [{ data: pendingPayroll }, { data: advanceGiven }, { data: advanceOffset }] =
    await Promise.all([
      // Начисленная, но не выплаченная ЗП (отсутствует списание из кошелька)
      (supabase.from('transactions') as any)
        .select('id, amount, description, created_at, category_id')
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'pending')
        .is('from_wallet_id', null)
        .not('description', 'ilike', 'Выплата зарплаты%')
        .eq('related_user_id', userId)
        .in('category_id', PAYROLL_CATEGORY_IDS)
        .order('created_at', { ascending: true }),

      // Всего выдано авансов
      (supabase.from('transactions') as any)
        .select('amount')
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .eq('category_id', ADVANCE_CATEGORY_ID)
        .eq('related_user_id', userId),

      // Уже зачтено авансов (через выплату ЗП)
      (supabase.from('transactions') as any)
        .select('amount')
        .eq('direction', 'income')
        .eq('lifecycle_status', 'approved')
        .eq('category_id', ADVANCE_CATEGORY_ID)
        .eq('related_user_id', userId),
    ]);

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
    pending_transactions: pendingPayroll ?? [],
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
 * POST /api/staff/settle — выплатить ЗП сотруднику
 * Body: { user_id, from_wallet_id?, wallet_splits?, partial_offset?, partial_amount? }
 *
 * Логика:
 * 1. Берём все pending PAYROLL транзакции сотрудника
 * 2. Считаем остаток аванса (выдано − уже зачтено)
 * 3. offset = min(salary, advance_balance) → зачитывается без списания со счёта
 * 4. payout = salary − offset → списывается с указанных кошельков (from_wallet_id или wallet_splits)
 * 5. Все pending PAYROLL → settlement_status: completed
 * 6. Если offset > 0 → INSERT ADVANCE_PAYMENT income = запись о зачёте
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      user_id: string;
      from_wallet_id?: string;
      wallet_splits?: Array<{ wallet_id: string; amount: number | string }>;
      partial_offset?: string;
      partial_amount?: string; // если задано — платим только эту сумму, остальное остаётся pending
      idempotency_key?: string;
    };

    if (!body.user_id) {
      return NextResponse.json({ error: 'user_id обязателен' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const adminId = await getAdminId(request);

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
    ] = await Promise.all([
      (supabase.from('transactions') as any)
        .select(
          `
          id, amount, description, created_at, category_id, service_order_id, trip_id, direction, lifecycle_status, related_user_id, created_by,
          trip:trips(trip_number, started_at)
        `,
        )
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'pending')
        .is('from_wallet_id', null)
        .not('description', 'ilike', 'Выплата зарплаты%')
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
    ]);

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

    if (!pendingPayroll || (pendingPayroll as any[]).length === 0) {
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
          salary_total: directAmount.toFixed(2),
          advance_balance: advanceBalance.toFixed(2),
          offset: '0.00',
          payout: directAmount.toFixed(2),
          settled_count: 0,
          splits,
        });
      }
      return NextResponse.json({ error: 'Нет начисленной ЗП к выплате' }, { status: 400 });
    }

    const salaryTotal = (pendingPayroll as any[]).reduce(
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
    const payout = salaryTotal - offset;

    let idsToSettle: string[];
    let splitTxn: any = null;
    let splitNeeded = 0;
    let actualPayout: number;
    let actualOffset: number;

    if (partialAmountRaw !== undefined) {
      const requestedAmount = Math.min(Math.max(0, parseFloat(partialAmountRaw) || 0), salaryTotal);

      const sorted = [...(pendingPayroll as any[])].sort(
        (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
      );

      let accumulated = 0;
      idsToSettle = [];
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
          {
            error: `Сумма выплаты слишком мала или равна нулю.`,
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
      actualPayout = payout;
    }

    const { splits, error: splitErr } = resolveSplits(body, actualPayout);
    if (splitErr) {
      return NextResponse.json({ error: splitErr }, { status: 400 });
    }

    // Собираем детализацию по рейсам для описания транзакции выплаты
    const settledTxns =
      (pendingPayroll as any[])?.filter((t: any) => idsToSettle.includes(t.id)) ?? [];
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
    const baseBatchKey = body.idempotency_key || crypto.randomUUID();

    // 1. Создаём транзакции списания с кошельков на СЕГОДНЯШНЮЮ ДАТУ
    if (actualPayout > 0 && splits.length > 0) {
      splits.forEach((s, idx) => {
        const wLabel = WALLET_LABELS[s.wallet_id] || `Кошелёк ${idx + 1}`;
        const desc =
          splits.length > 1
            ? `Выплата зарплаты (${wLabel}): ${employeeName}${breakdownText}`
            : payoutDescription;
        const idempKey = splits.length > 1 ? `${baseBatchKey}_split_${s.wallet_id}` : baseBatchKey;

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

    // 2. Закрываем начисленные pending транзакции (списываем долг сотрудника), не вешая на них wallet_id
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

    if (actualOffset > 0) {
      // Запись о зачёте аванса (income = уменьшает остаток долга, плюсует кошелёк для баланса)
      ops.push(
        (supabase.from('transactions') as any).insert({
          direction: 'income',
          category_id: ADVANCE_CATEGORY_ID,
          amount: actualOffset.toFixed(2),
          description: `Зачёт аванса в счёт ЗП: ${employeeName} — ${dateLabel}`,
          transaction_date: new Date().toISOString(),
          lifecycle_status: 'approved',
          settlement_status: 'completed',
          to_wallet_id: body.from_wallet_id || null,
          related_user_id: body.user_id,
          created_by: adminId,
          idempotency_key: crypto.randomUUID(),
        }),
      );
    }

    const results = await Promise.all(ops);
    const errors = results.filter((r) => r && r.error);
    if (errors.length > 0) {
      console.error('Errors in settle:', errors);
      throw new Error(`Transaction failed: ${errors[0].error.message}`);
    }

    return NextResponse.json({
      ok: true,
      salary_total: salaryTotal.toFixed(2),
      advance_balance: advanceBalance.toFixed(2),
      offset: actualOffset.toFixed(2),
      payout: actualPayout.toFixed(2),
      settled_count: idsToSettle.length,
      splits,
      remaining: (
        salaryTotal -
        idsToSettle.reduce((s, id) => {
          const t = (pendingPayroll as any[]).find((x: any) => x.id === id);
          return s + parseFloat(t?.amount ?? '0');
        }, 0)
      ).toFixed(2),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
