/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const OPTI24_ID = '20000000-0000-0000-0000-000000000001';
const CAT_FUEL = '62cebf3f-9982-4cc6-904b-48c6169cf5e4';
const CAT_OTHER_EXPENSE = 'df1022df-4ea6-46fc-b9aa-f3c9eb4e7f30';

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

    const amt = parseFloat(body.amount);
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Сумма должна быть больше 0' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Получаем данные поставщика из БД
    const { data: supplier, error: supplierError } = await (supabase.from('counterparties') as any)
      .select('id, name, payable_amount')
      .eq('id', body.supplier_id)
      .single();

    if (supplierError || !supplier) {
      return NextResponse.json({ error: 'Поставщик не найден' }, { status: 404 });
    }

    const userId = await resolveUserId(supabase);
    const isOpti24 = body.supplier_id === OPTI24_ID;
    const category = isOpti24 ? CAT_FUEL : CAT_OTHER_EXPENSE;
    const description = body.description?.trim() || `Оплата долга: ${supplier.name}`;

    // Создаём транзакцию оплаты
    const { data, error } = await (supabase.from('transactions') as any)
      .insert({
        direction: 'expense',
        amount: amt.toFixed(2),
        category_id: category,
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

    // Для не-Опти24: уменьшаем payable_amount на оплаченную сумму
    if (!isOpti24) {
      const currentPayable = parseFloat(supplier.payable_amount ?? '0');
      const newPayable = Math.max(0, currentPayable - amt);
      await (supabase.from('counterparties') as any)
        .update({ payable_amount: newPayable.toFixed(2) })
        .eq('id', body.supplier_id);
    }

    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
