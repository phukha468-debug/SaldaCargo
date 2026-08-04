/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TRIP_REVENUE_CATEGORY = '74008cf7-0527-4e9f-afd2-d232b8f8125a';
const BANK_ID = '10000000-0000-0000-0000-000000000001';
const CASH_ID = '10000000-0000-0000-0000-000000000002';

function walletForDebt(isLegalEntity: boolean): string {
  return isLegalEntity ? BANK_ID : CASH_ID;
}

/** PUT /api/receivables/[orderId] — привязать trip_order к контрагенту */
export async function PUT(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const { counterparty_id } = await req.json();
  if (!counterparty_id) {
    return NextResponse.json({ error: 'counterparty_id обязателен' }, { status: 400 });
  }
  const supabase = createAdminClient();
  const { error } = await (supabase.from('trip_orders') as any)
    .update({ counterparty_id })
    .eq('id', orderId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** PATCH /api/receivables/[orderId] — отметить заказ как оплаченный + создать доходную транзакцию */
export async function PATCH(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const cookieStore = await cookies();
  let adminId = cookieStore.get('salda_user_id')?.value ?? null;

  const supabase = createAdminClient();

  if (!adminId) {
    const { data: adminUser } = await (supabase as any)
      .from('users')
      .select('id')
      .contains('roles', ['admin'])
      .limit(1)
      .maybeSingle();
    adminId = adminUser?.id ?? 'e9a1c980-eb1e-5c87-9f6d-c7f67eb28a1d';
  }

  const body = await req.json().catch(() => ({}));
  const partialAmount = body.partial_amount ? parseFloat(body.partial_amount) : null;
  const customWalletId: string | null = body.to_wallet_id ?? null;

  // Получаем заказ — включая is_legal_entity контрагента для маршрутизации в кошелёк
  const { data: order, error: orderErr } = await (supabase
    .from('trip_orders')
    .select(
      'id, amount, counterparty_id, payment_method, settlement_status, counterparty:counterparties(name, is_legal_entity)',
    )
    .eq('id', orderId)
    .single() as any);

  if (orderErr || !order) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 });
  if (order.settlement_status === 'completed') {
    return NextResponse.json({ error: 'Долг уже погашен' }, { status: 400 });
  }

  const fullAmount = parseFloat(order.amount);
  const isPartial =
    partialAmount !== null &&
    !isNaN(partialAmount) &&
    partialAmount > 0 &&
    partialAmount < fullAmount;

  const payAmount = isPartial ? partialAmount : fullAmount;

  if (isPartial) {
    const newAmount = (fullAmount - partialAmount).toFixed(2);
    const { error: updateErr } = await (supabase
      .from('trip_orders')
      .update({ amount: newAmount })
      .eq('id', orderId) as any);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  } else {
    // Помечаем заказ полностью оплаченным
    const { error: updateErr } = await (supabase
      .from('trip_orders')
      .update({ settlement_status: 'completed' })
      .eq('id', orderId)
      .eq('settlement_status', 'pending') as any);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Юрлицо → Р/С; физлицо → Касса (если не передан кастомный walletId)
  const cpName = order.counterparty?.name ?? 'Должник';
  const isLegal = order.counterparty?.is_legal_entity ?? false;
  const toWalletId = customWalletId ?? walletForDebt(isLegal);

  const { error: txErr } = await (supabase.from('transactions') as any).insert({
    direction: 'income',
    category_id: TRIP_REVENUE_CATEGORY,
    amount: payAmount.toFixed(2),
    counterparty_id: order.counterparty_id ?? null,
    to_wallet_id: toWalletId,
    description: isPartial ? `Частичное погашение: ${cpName}` : `Погашение: ${cpName}`,
    lifecycle_status: 'approved',
    settlement_status: 'completed',
    created_by: adminId,
    idempotency_key: crypto.randomUUID(),
  });

  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, paid: payAmount.toFixed(2), partial: isPartial });
}
