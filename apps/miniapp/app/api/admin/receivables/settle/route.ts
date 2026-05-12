/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuid } from 'uuid';

const TRIP_REVENUE_CATEGORY = '74008cf7-0527-4e9f-afd2-d232b8f8125a';
const BANK_ID = '10000000-0000-0000-0000-000000000001';
const CASH_ID = '10000000-0000-0000-0000-000000000002';
const CARD_ID = '10000000-0000-0000-0000-000000000003';

function walletForPaymentMethod(pm: string): string {
  if (pm === 'qr') return BANK_ID;
  if (pm === 'card_driver') return CARD_ID;
  return CASH_ID; // debt_cash и всё остальное → наличные в сейф
}

/** POST /api/admin/receivables/settle — погасить долг по заказу */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const adminId = cookieStore.get('salda_user_id')?.value;
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as {
    order_id: string;
    note?: string;
  };

  const supabase = createAdminClient();

  // Получаем заказ вместе с payment_method для маршрутизации в кошелёк
  const { data: order, error: orderErr } = await (supabase
    .from('trip_orders')
    .select(
      'id, amount, counterparty_id, payment_method, counterparty:counterparties(name), settlement_status',
    )
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

  // Создаём доходную транзакцию с маршрутизацией в нужный кошелёк
  const cpName = order.counterparty?.name ?? 'Должник';
  const toWalletId = walletForPaymentMethod(order.payment_method);
  const description = body.note ? body.note : `Погашение: ${cpName}`;

  const { error: txErr } = await (supabase.from('transactions') as any).insert({
    direction: 'income',
    category_id: TRIP_REVENUE_CATEGORY,
    amount: order.amount,
    counterparty_id: order.counterparty_id ?? null,
    to_wallet_id: toWalletId,
    description,
    lifecycle_status: 'approved',
    settlement_status: 'completed',
    created_by: adminId,
    idempotency_key: uuid(),
  });

  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
