/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuid } from 'uuid';

/** GET /api/admin/transactions — последние транзакции */
export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await (supabase
    .from('transactions')
    .select(
      `
      id, amount, direction, description, created_at, lifecycle_status,
      category:transaction_categories(name, code)
    `,
    )
    .order('created_at', { ascending: false })
    .limit(30) as any);

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
