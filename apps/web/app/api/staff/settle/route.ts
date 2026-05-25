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

async function getAdminId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('salda_auth_token')?.value ?? null;
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
      // Начисленная, но не выплаченная ЗП
      (supabase.from('transactions') as any)
        .select('id, amount, description, created_at, category_id')
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'pending')
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

/**
 * POST /api/staff/settle — выплатить ЗП сотруднику
 * Body: { user_id, from_wallet_id? }
 *
 * Логика:
 * 1. Берём все pending PAYROLL транзакции сотрудника
 * 2. Считаем остаток аванса (выдано − уже зачтено)
 * 3. offset = min(salary, advance_balance) → зачитывается без списания со счёта
 * 4. payout = salary − offset → списывается с кошелька (from_wallet_id обязателен если > 0)
 * 5. Все pending PAYROLL → settlement_status: completed
 * 6. Если offset > 0 → INSERT ADVANCE_PAYMENT income = запись о зачёте
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      user_id: string;
      from_wallet_id?: string;
      partial_offset?: string;
    };

    if (!body.user_id) {
      return NextResponse.json({ error: 'user_id обязателен' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const adminId = await getAdminId();

    const [
      { data: pendingPayroll },
      { data: advanceGiven },
      { data: advanceOffset },
      { data: userRow },
    ] = await Promise.all([
      (supabase.from('transactions') as any)
        .select('id, amount, description')
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'pending')
        .eq('related_user_id', body.user_id)
        .in('category_id', PAYROLL_CATEGORY_IDS),

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
    const payout = salaryTotal - offset;

    if (payout > 0 && !body.from_wallet_id) {
      return NextResponse.json(
        {
          error: 'Укажите кошелёк для выплаты',
          salary_total: salaryTotal.toFixed(2),
          advance_balance: advanceBalance.toFixed(2),
          offset: offset.toFixed(2),
          payout: payout.toFixed(2),
        },
        { status: 400 },
      );
    }

    const pendingIds = (pendingPayroll as any[]).map((t: any) => t.id);
    const employeeName = userRow?.name ?? 'Сотрудник';
    const dateLabel = new Date().toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const ops: Promise<any>[] = [
      // Все pending PAYROLL → completed
      (supabase.from('transactions') as any)
        .update({
          settlement_status: 'completed',
          from_wallet_id: payout > 0 ? body.from_wallet_id : null,
        })
        .in('id', pendingIds),
    ];

    if (offset > 0) {
      // Запись о зачёте аванса (income = уменьшает остаток долга)
      ops.push(
        (supabase.from('transactions') as any).insert({
          direction: 'income',
          category_id: ADVANCE_CATEGORY_ID,
          amount: offset.toFixed(2),
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
      salary_total: salaryTotal.toFixed(2),
      advance_balance: advanceBalance.toFixed(2),
      offset: offset.toFixed(2),
      payout: payout.toFixed(2),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
