/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const CAT_FUEL = '62cebf3f-9982-4cc6-904b-48c6169cf5e4';
const CAT_PARTS = '9d18370d-3228-4f2a-8530-52b168cfa8d7';

const SUPPLIERS: Record<string, { name: string; category: string }> = {
  '20000000-0000-0000-0000-000000000001': { name: 'Опти24', category: CAT_FUEL },
  '20000000-0000-0000-0000-000000000002': { name: 'Новиков А.В.', category: CAT_PARTS },
  '20000000-0000-0000-0000-000000000003': { name: 'Ромашин', category: CAT_PARTS },
};

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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      supplier_id: string;
      amount: string;
      from_wallet_id: string;
      description?: string;
    };

    if (!body.supplier_id || !body.amount || !body.from_wallet_id) {
      return NextResponse.json(
        { error: 'supplier_id, amount, from_wallet_id обязательны' },
        { status: 400 },
      );
    }

    const supplier = SUPPLIERS[body.supplier_id];
    if (!supplier) {
      return NextResponse.json({ error: 'Неверный поставщик' }, { status: 400 });
    }

    const amt = parseFloat(body.amount);
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Сумма должна быть больше 0' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const userId = await resolveUserId(supabase);
    const description = body.description?.trim() || `Оплата долга: ${supplier.name}`;

    const { data, error } = await (supabase.from('transactions') as any)
      .insert({
        direction: 'expense',
        amount: amt.toFixed(2),
        category_id: supplier.category,
        from_wallet_id: body.from_wallet_id,
        counterparty_id: body.supplier_id,
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        description,
        created_by: userId,
        idempotency_key: crypto.randomUUID(),
      })
      .select('id')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
