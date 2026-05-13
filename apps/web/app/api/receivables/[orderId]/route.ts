/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TRIP_REVENUE_CATEGORY = '74008cf7-0527-4e9f-afd2-d232b8f8125a';
const BANK_ID = '10000000-0000-0000-0000-000000000001';
const CASH_ID = '10000000-0000-0000-0000-000000000002';
const CARD_ID = '10000000-0000-0000-0000-000000000003';

function walletForPaymentMethod(pm: string): string {
  if (pm === 'qr') return BANK_ID;
  if (pm === 'card_driver') return CARD_ID;
  return CASH_ID;
}

/** PATCH /api/receivables/[orderId] — отметить заказ как оплаченный + создать доходную транзакцию */
export async function PATCH(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const cookieStore = await cookies();
  let adminId = cookieStore.get('salda_user_id')?.value ?? null;

  const supabase = createAdminClient();

  // WebApp может работать без cookie — берём первого admin из БД
  if (!adminId) {
    const { data: adminUser } = await (supabase as any)
      .from('users')
      .select('id')
      .contains('roles', ['admin'])
      .limit(1)
      .single();
    adminId = adminUser?.id ?? null;
  }

  // Получаем заказ — включая payment_method для маршрутизации в кошелёк
  const { data: order, error: orderErr } = await (supabase
    .from('trip_orders')
    .select(
      'id, amount, counterparty_id, payment_method, settlement_status, counterparty:counterparties(name)',
    )
    .eq('id', orderId)
    .single() as any);

  if (orderErr || !order) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 });
  if (order.settlement_status === 'completed') {
    return NextResponse.json({ error: 'Долг уже погашен' }, { status: 400 });
  }

  // Помечаем заказ оплаченным
  const { error: updateErr } = await (supabase
    .from('trip_orders')
    .update({ settlement_status: 'completed' })
    .eq('id', orderId)
    .eq('settlement_status', 'pending') as any);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Создаём доходную транзакцию с маршрутизацией в нужный кошелёк
  const cpName = order.counterparty?.name ?? 'Должник';
  const toWalletId = walletForPaymentMethod(order.payment_method);

  const { error: txErr } = await (supabase.from('transactions') as any).insert({
    direction: 'income',
    category_id: TRIP_REVENUE_CATEGORY,
    amount: order.amount,
    counterparty_id: order.counterparty_id ?? null,
    to_wallet_id: toWalletId,
    description: `Погашение: ${cpName}`,
    lifecycle_status: 'approved',
    settlement_status: 'completed',
    created_by: adminId,
    idempotency_key: crypto.randomUUID(),
  });

  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
