/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SUPPLIERS } from '../route';

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
      description?: string;
    };

    if (!body.supplier_id || !body.amount) {
      return NextResponse.json({ error: 'supplier_id и amount обязательны' }, { status: 400 });
    }

    const supplier = SUPPLIERS.find((s) => s.id === body.supplier_id);
    if (!supplier) {
      return NextResponse.json({ error: 'Неверный поставщик' }, { status: 400 });
    }
    if (supplier.autoAccrue) {
      return NextResponse.json(
        { error: 'Для Опти24 долг накапливается автоматически из расходов по топливной карте' },
        { status: 400 },
      );
    }

    const amt = parseFloat(body.amount);
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Сумма должна быть больше 0' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const userId = await resolveUserId(supabase);
    const description = body.description?.trim() || `Запчасти в кредит: ${supplier.name}`;

    const { data, error } = await (supabase.from('transactions') as any)
      .insert({
        direction: 'expense',
        amount: amt.toFixed(2),
        category_id: supplier.category,
        counterparty_id: body.supplier_id,
        lifecycle_status: 'approved',
        settlement_status: 'pending',
        description,
        created_by: userId,
        idempotency_key: crypto.randomUUID(),
      })
      .select('id')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
