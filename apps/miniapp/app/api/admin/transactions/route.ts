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

  const supabase = createAdminClient();

  const { data, error } = await (supabase.from('transactions') as any)
    .insert({
      direction: body.direction,
      category_id: body.category_id,
      amount: body.amount,
      description: body.description
        ? `${body.description} [${body.payment_method}]`
        : `[${body.payment_method}]`,
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
