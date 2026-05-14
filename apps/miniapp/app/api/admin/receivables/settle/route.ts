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
  return CASH_ID;
}

/** POST /api/admin/receivables/settle — погасить долг по заказу или ручной записи */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const adminId = cookieStore.get('salda_user_id')?.value;
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as {
    id: string;
    type?: 'trip_order' | 'manual';
    note?: string;
  };

  const recordType = body.type ?? 'trip_order';
  const supabase = createAdminClient();

  if (recordType === 'manual') {
    const { data: manual, error: fetchErr } = await (supabase as any)
      .from('manual_receivables')
      .select('id, amount, counterparty_id, settled')
      .eq('id', body.id)
      .single();

    if (fetchErr || !manual)
      return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 });
    if (manual.settled) return NextResponse.json({ error: 'Долг уже погашен' }, { status: 400 });

    const { error: updateErr } = await (supabase as any)
      .from('manual_receivables')
      .update({ settled: true, settled_at: new Date().toISOString() })
      .eq('id', body.id)
      .eq('settled', false);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    const description = body.note || 'Погашение исторического долга';
    const { error: txErr } = await (supabase as any).from('transactions').insert({
      direction: 'income',
      category_id: TRIP_REVENUE_CATEGORY,
      amount: manual.amount,
      counterparty_id: manual.counterparty_id,
      to_wallet_id: CASH_ID,
      description,
      lifecycle_status: 'approved',
      settlement_status: 'completed',
      created_by: adminId,
      idempotency_key: uuid(),
    });

    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Default: trip_order
  const { data: order, error: orderErr } = await (supabase
    .from('trip_orders')
    .select(
      'id, amount, counterparty_id, payment_method, counterparty:counterparties(name), settlement_status',
    )
    .eq('id', body.id)
    .single() as any);

  if (orderErr || !order) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 });
  if (order.settlement_status === 'completed') {
    return NextResponse.json({ error: 'Долг уже погашен' }, { status: 400 });
  }

  const { error: updateErr } = await (supabase
    .from('trip_orders')
    .update({ settlement_status: 'completed' })
    .eq('id', body.id) as any);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

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
