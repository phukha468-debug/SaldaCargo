/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuid } from 'uuid';

/** GET /api/admin/transactions?date=YYYY-MM-DD — транзакции за день */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date'); // YYYY-MM-DD локальная дата клиента

  const supabase = createAdminClient();

  let q = (supabase.from('transactions') as any)
    .select(
      'id, amount, direction, description, created_at, lifecycle_status, category:transaction_categories(name, code)',
    )
    .neq('description', 'Корректировка остатка')
    .order('created_at', { ascending: false });

  if (date) {
    q = q.gte('created_at', `${date}T00:00:00.000Z`).lte('created_at', `${date}T23:59:59.999Z`);
  } else {
    q = q.limit(50);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

const BANK_ID = '10000000-0000-0000-0000-000000000001';
const CASH_ID = '10000000-0000-0000-0000-000000000002';
const CARD_ID = '10000000-0000-0000-0000-000000000003';

function walletIdByMethod(method: string): string | null {
  if (method === 'cash') return CASH_ID;
  if (method === 'bank_transfer') return BANK_ID;
  if (method === 'card') return CARD_ID;
  return null;
}

/** POST /api/admin/transactions — добавить доход или расход */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const adminId = cookieStore.get('salda_user_id')?.value;
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as {
    direction: 'income' | 'expense';
    category_id: string;
    amount: string;
    description?: string;
    payment_method: string;
  };

  if (!body.category_id) {
    return NextResponse.json({ error: 'Выберите категорию' }, { status: 400 });
  }
  if (!body.amount || parseFloat(body.amount) <= 0) {
    return NextResponse.json({ error: 'Введите корректную сумму' }, { status: 400 });
  }

  const walletId = walletIdByMethod(body.payment_method);
  const supabase = createAdminClient();

  const { data, error } = await (supabase.from('transactions') as any)
    .insert({
      direction: body.direction,
      category_id: body.category_id,
      amount: body.amount,
      description: body.description || null,
      // Привязка к кошельку — влияет на балансы в /api/wallets
      to_wallet_id: body.direction === 'income' ? walletId : null,
      from_wallet_id: body.direction === 'expense' ? walletId : null,
      lifecycle_status: 'approved',
      settlement_status: 'completed',
      created_by: adminId,
      idempotency_key: uuid(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
