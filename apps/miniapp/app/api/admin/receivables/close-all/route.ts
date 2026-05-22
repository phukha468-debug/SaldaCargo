/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TRIP_REVENUE_CATEGORY = '74008cf7-0527-4e9f-afd2-d232b8f8125a';
const BANK_ID = '10000000-0000-0000-0000-000000000001';

type OrderItem = { id: string; type: 'trip_order' | 'manual'; amount: string };

/** POST /api/admin/receivables/close-all — погасить весь долг контрагента одной транзакцией */
export async function POST(req: Request) {
  const cookieStore = await cookies();
  const adminId = cookieStore.get('salda_user_id')?.value;
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as {
    orders: OrderItem[];
    to_wallet_id?: string;
    counterparty_name?: string;
  };

  if (!Array.isArray(body.orders) || body.orders.length === 0) {
    return NextResponse.json({ error: 'orders обязателен' }, { status: 400 });
  }

  const toWalletId = body.to_wallet_id ?? BANK_ID;
  const cpName = body.counterparty_name ?? 'Должник';
  const supabase = createAdminClient();

  const tripOrders = body.orders.filter((o) => o.type === 'trip_order');
  const manuals = body.orders.filter((o) => o.type === 'manual');

  const ops: Promise<any>[] = [];

  if (tripOrders.length > 0) {
    ops.push(
      (supabase as any)
        .from('trip_orders')
        .update({ settlement_status: 'completed' })
        .in(
          'id',
          tripOrders.map((o) => o.id),
        )
        .eq('settlement_status', 'pending'),
    );
  }

  if (manuals.length > 0) {
    ops.push(
      (supabase as any)
        .from('manual_receivables')
        .update({ settled: true, settled_at: new Date().toISOString() })
        .in(
          'id',
          manuals.map((o) => o.id),
        )
        .eq('settled', false),
    );
  }

  await Promise.all(ops);

  const totalAmount = body.orders.reduce((s, o) => s + parseFloat(o.amount ?? '0'), 0).toFixed(2);

  const { error: txErr } = await (supabase as any).from('transactions').insert({
    direction: 'income',
    category_id: TRIP_REVENUE_CATEGORY,
    amount: totalAmount,
    to_wallet_id: toWalletId,
    description: `Погашение задолженности: ${cpName} (${body.orders.length} записей)`,
    lifecycle_status: 'approved',
    settlement_status: 'completed',
    created_by: adminId,
    idempotency_key: crypto.randomUUID(),
  });

  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, paid: totalAmount, count: body.orders.length });
}
