/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const WALLET_TRANSFER_CAT = 'b9946a5e-4a33-4ed9-a272-5dee12d4ca93';

const WALLET_NAMES: Record<string, string> = {
  '10000000-0000-0000-0000-000000000001': 'Расчётный счёт',
  '10000000-0000-0000-0000-000000000002': 'Сейф (Наличные)',
  '10000000-0000-0000-0000-000000000003': 'Карта',
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('salda_user_id')?.value;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as {
    from_wallet_id: string;
    to_wallet_id: string;
    amount: string;
    description?: string;
  };

  if (!body.from_wallet_id || !body.to_wallet_id || !body.amount) {
    return NextResponse.json({ error: 'Все поля обязательны' }, { status: 400 });
  }
  if (body.from_wallet_id === body.to_wallet_id) {
    return NextResponse.json({ error: 'Нельзя переводить в тот же кошелёк' }, { status: 400 });
  }
  if (!WALLET_NAMES[body.from_wallet_id] || !WALLET_NAMES[body.to_wallet_id]) {
    return NextResponse.json({ error: 'Неверный кошелёк' }, { status: 400 });
  }
  const amt = parseFloat(body.amount);
  if (isNaN(amt) || amt <= 0) {
    return NextResponse.json({ error: 'Сумма должна быть больше 0' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const description =
    body.description?.trim() ||
    `Перевод: ${WALLET_NAMES[body.from_wallet_id]} → ${WALLET_NAMES[body.to_wallet_id]}`;

  const { data, error } = await (supabase.from('transactions') as any)
    .insert({
      direction: 'transfer',
      amount: amt.toFixed(2),
      category_id: WALLET_TRANSFER_CAT,
      from_wallet_id: body.from_wallet_id,
      to_wallet_id: body.to_wallet_id,
      lifecycle_status: 'approved',
      settlement_status: 'completed',
      description,
      created_by: userId,
      idempotency_key: crypto.randomUUID(),
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
