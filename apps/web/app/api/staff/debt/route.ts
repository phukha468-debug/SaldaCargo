/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ADVANCE_CATEGORY_ID = 'a0000000-0000-0000-0000-000000000001';

async function resolveUserId(supabase: any): Promise<string> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get('salda_user_id')?.value;
  if (fromCookie) return fromCookie;
  const { data } = await (supabase.from('users') as any)
    .select('id')
    .or('roles.cs.{owner},roles.cs.{admin}')
    .limit(1)
    .single();
  return data?.id ?? '00000000-0000-0000-0000-000000000000';
}

/**
 * POST /api/staff/debt
 * Запись долга/аванса сотруднику или его погашение (возврат в кассу).
 */
export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();
    const adminId = await resolveUserId(supabase);

    const body = (await request.json()) as {
      action?: 'add' | 'repay' | 'adjust';
      user_id: string;
      amount?: string;
      target_amount?: string;
      from_wallet_id?: string | null;
      to_wallet_id?: string | null;
      note?: string;
    };

    if (!body.user_id) {
      return NextResponse.json({ error: 'user_id обязателен' }, { status: 400 });
    }

    const { data: user } = await (supabase as any)
      .from('users')
      .select('name')
      .eq('id', body.user_id)
      .single();

    if (!user) return NextResponse.json({ error: 'Сотрудник не найден' }, { status: 404 });

    if (body.action === 'adjust') {
      const targetVal = parseFloat(body.target_amount ?? '0');
      if (isNaN(targetVal) || targetVal < 0) {
        return NextResponse.json({ error: 'Некорректная целевая сумма' }, { status: 400 });
      }

      // Calculate current advance balance
      const [{ data: advanceGiven }, { data: advanceOffset }] = await Promise.all([
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
      ]);

      const advanceTotal = ((advanceGiven as any[]) ?? []).reduce(
        (s: number, t: any) => s + parseFloat(t.amount ?? '0'),
        0,
      );
      const offsetTotal = ((advanceOffset as any[]) ?? []).reduce(
        (s: number, t: any) => s + parseFloat(t.amount ?? '0'),
        0,
      );
      const currentBalance = Math.max(0, advanceTotal - offsetTotal);
      const diff = targetVal - currentBalance;

      if (Math.abs(diff) < 0.01) {
        return NextResponse.json({ ok: true, message: 'Долг равен целевой сумме' });
      }

      const isIncrease = diff > 0;
      const absDiff = Math.abs(diff);
      const noteText = body.note?.trim() ? ` (${body.note.trim()})` : '';

      const { data, error } = await (supabase as any)
        .from('transactions')
        .insert({
          direction: isIncrease ? 'expense' : 'income',
          category_id: ADVANCE_CATEGORY_ID,
          amount: absDiff.toFixed(2),
          description: `Корректировка долга: ${user.name} — ${currentBalance.toFixed(0)} ₽ → ${targetVal.toFixed(0)} ₽${noteText}`,
          lifecycle_status: 'approved',
          settlement_status: 'completed',
          related_user_id: body.user_id,
          created_by: adminId,
          idempotency_key: crypto.randomUUID(),
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data, { status: 201 });
    }

    if (!body.amount) {
      return NextResponse.json({ error: 'amount обязателен' }, { status: 400 });
    }

    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Некорректная сумма' }, { status: 400 });
    }

    const isRepay = body.action === 'repay';
    const defaultNote = isRepay
      ? `Возврат долга: ${user.name}`
      : `Долг / Аванс: ${user.name} — ${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`;

    const description = body.note?.trim() || defaultNote;

    const payload: any = {
      direction: isRepay ? 'income' : 'expense',
      category_id: ADVANCE_CATEGORY_ID,
      amount: amount.toFixed(2),
      description,
      lifecycle_status: 'approved',
      settlement_status: 'completed',
      related_user_id: body.user_id,
      created_by: adminId,
      idempotency_key: crypto.randomUUID(),
    };

    if (isRepay) {
      if (body.to_wallet_id && body.to_wallet_id !== 'none') {
        payload.to_wallet_id = body.to_wallet_id;
      }
    } else {
      if (body.from_wallet_id && body.from_wallet_id !== 'none') {
        payload.from_wallet_id = body.from_wallet_id;
      }
    }

    const { data, error } = await (supabase as any)
      .from('transactions')
      .insert(payload)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
