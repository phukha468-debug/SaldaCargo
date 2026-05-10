/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TRIP_REVENUE_CATEGORY = '74008cf7-0527-4e9f-afd2-d232b8f8125a';

/** PATCH /api/receivables/[orderId] — отметить заказ как оплаченный + создать доходную транзакцию */
export async function PATCH(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const cookieStore = await cookies();
  const adminId = cookieStore.get('salda_user_id')?.value ?? null;

  const supabase = createAdminClient();

  // Получаем заказ для суммы и контрагента
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

  // Создаём доходную транзакцию (как в miniapp)
  const cpName = order.counterparty?.name ?? 'Должник';
  const { error: txErr } = await (supabase.from('transactions') as any).insert({
    direction: 'income',
    category_id: TRIP_REVENUE_CATEGORY,
    amount: order.amount,
    counterparty_id: order.counterparty_id ?? null,
    description: `Погашение долга: ${cpName}`,
    lifecycle_status: 'approved',
    settlement_status: 'completed',
    created_by: adminId,
    idempotency_key: crypto.randomUUID(),
  });

  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
