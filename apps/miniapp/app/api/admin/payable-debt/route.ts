/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SUPPLIERS = [
  {
    id: '20000000-0000-0000-0000-000000000002',
    name: 'Новиков А.В.',
    category: '9d18370d-3228-4f2a-8530-52b168cfa8d7',
    autoAccrue: false,
  },
  {
    id: '20000000-0000-0000-0000-000000000003',
    name: 'Ромашин',
    category: '9d18370d-3228-4f2a-8530-52b168cfa8d7',
    autoAccrue: false,
  },
];

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

    const amt = parseFloat(body.amount);
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Сумма должна быть больше 0' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const cookieStore = await cookies();
    const userId =
      cookieStore.get('salda_user_id')?.value ?? '00000000-0000-0000-0000-000000000000';

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
