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
    .overlaps('roles', ['owner', 'admin'])
    .limit(1)
    .single();
  return data?.id ?? '00000000-0000-0000-0000-000000000000';
}

/** POST /api/staff/advance — выдать аванс сотруднику */
export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();
    const adminId = await resolveUserId(supabase);

    const body = (await request.json()) as {
      user_id: string;
      amount: string;
      from_wallet_id: string;
      note?: string;
    };

    if (!body.user_id || !body.amount || !body.from_wallet_id) {
      return NextResponse.json(
        { error: 'user_id, amount, from_wallet_id обязательны' },
        { status: 400 },
      );
    }

    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Некорректная сумма' }, { status: 400 });
    }

    const { data: user } = await (supabase as any)
      .from('users')
      .select('name')
      .eq('id', body.user_id)
      .single();

    if (!user) return NextResponse.json({ error: 'Сотрудник не найден' }, { status: 404 });

    const description =
      body.note?.trim() ||
      `Аванс: ${user.name} — ${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`;

    const { data, error } = await (supabase as any)
      .from('transactions')
      .insert({
        direction: 'expense',
        category_id: ADVANCE_CATEGORY_ID,
        amount: amount.toFixed(2),
        description,
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        related_user_id: body.user_id,
        from_wallet_id: body.from_wallet_id,
        created_by: adminId,
        idempotency_key: crypto.randomUUID(),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
