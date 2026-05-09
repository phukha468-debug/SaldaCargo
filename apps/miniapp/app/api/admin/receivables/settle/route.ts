/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuid } from 'uuid';

const TRIP_REVENUE_CATEGORY = '74008cf7-0527-4e9f-afd2-d232b8f8125a';

/** POST /api/admin/receivables/settle — погасить долг по заказу */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const adminId = cookieStore.get('salda_user_id')?.value;
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as {
    order_id: string;
    payment_method: string; // cash | bank_transfer | card
    note?: string;
  };

  const supabase = createAdminClient();

  // Получаем заказ
  const { data: order, error: orderErr } = await (supabase
    .from('trip_orders')
    .select('id, amount, counterparty_id, counterparty:counterparties(name), settlement_status')
    .eq('id', body.order_id)
    .single() as any);

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 });
  }
  if (order.settlement_status === 'completed') {
    return NextResponse.json({ error: 'Долг уже погашен' }, { status: 400 });
  }

  // Помечаем заказ оплаченным
  const { error: updateErr } = await (supabase
    .from('trip_orders')
    .update({ settlement_status: 'completed' })
    .eq('id', body.order_id) as any);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Создаём доходную транзакцию
  const cpName = order.counterparty?.name ?? 'Должник';
  const description = body.note
    ? `${body.note} [${body.payment_method}]`
    : `Погашение долга: ${cpName} [${body.payment_method}]`;

  const { error: txErr } = await (supabase.from('transactions') as any).insert({
    direction: 'income',
    category_id: TRIP_REVENUE_CATEGORY,
    amount: order.amount,
    counterparty_id: order.counterparty_id ?? null,
    description,
    lifecycle_status: 'approved',
    settlement_status: 'completed',
    created_by: adminId,
    idempotency_key: uuid(),
  });

  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
