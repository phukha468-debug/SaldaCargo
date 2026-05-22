/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const LOAN_REPAYMENT_CATEGORY = '00000000-0000-0000-0000-000000000020';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: loanId } = await params;
    const supabase = createAdminClient();

    const cookieStore = await cookies();
    const cookieUserId = cookieStore.get('salda_user_id')?.value;
    let userId = cookieUserId;
    if (!userId) {
      const { data } = await (supabase.from('users') as any)
        .select('id')
        .or('roles.cs.{owner},roles.cs.{admin}')
        .limit(1)
        .single();
      userId = data?.id;
    }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json()) as {
      amount: string;
      from_wallet_id: string;
      description?: string;
    };

    if (!body.amount || !body.from_wallet_id) {
      return NextResponse.json({ error: 'amount и from_wallet_id обязательны' }, { status: 400 });
    }

    const amt = parseFloat(body.amount);
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Сумма должна быть больше 0' }, { status: 400 });
    }

    const { data: loan, error: loanError } = await (supabase.from('loans') as any)
      .select('id, lender_name, remaining_amount, monthly_payment, next_payment_date')
      .eq('id', loanId)
      .eq('is_active', true)
      .single();

    if (loanError || !loan) {
      return NextResponse.json({ error: 'Кредит не найден' }, { status: 404 });
    }

    const currentRemaining = parseFloat(loan.remaining_amount);
    const newRemaining = Math.max(0, currentRemaining - amt);
    const isFullyRepaid = newRemaining === 0;

    let nextPaymentDate: string | null = loan.next_payment_date;
    if (!isFullyRepaid && loan.monthly_payment && loan.next_payment_date) {
      const monthlyPmt = parseFloat(loan.monthly_payment);
      if (amt >= monthlyPmt) {
        const monthsAdvance = Math.min(Math.floor(amt / monthlyPmt), 12);
        const d = new Date(loan.next_payment_date);
        d.setMonth(d.getMonth() + monthsAdvance);
        nextPaymentDate = d.toISOString().slice(0, 10);
      }
    }
    if (isFullyRepaid) nextPaymentDate = null;

    const description = body.description?.trim() || `Платёж по кредиту: ${loan.lender_name}`;

    const { error: txError } = await (supabase.from('transactions') as any).insert({
      direction: 'expense',
      amount: amt.toFixed(2),
      category_id: LOAN_REPAYMENT_CATEGORY,
      from_wallet_id: body.from_wallet_id,
      lifecycle_status: 'approved',
      settlement_status: 'completed',
      description,
      created_by: userId,
      idempotency_key: crypto.randomUUID(),
    });

    if (txError) return NextResponse.json({ error: txError.message }, { status: 500 });

    const { error: updateError } = await (supabase.from('loans') as any)
      .update({
        remaining_amount: newRemaining.toFixed(2),
        next_payment_date: nextPaymentDate,
        is_active: !isFullyRepaid,
      })
      .eq('id', loanId);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      new_remaining: newRemaining.toFixed(2),
      next_payment_date: nextPaymentDate,
      fully_repaid: isFullyRepaid,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
