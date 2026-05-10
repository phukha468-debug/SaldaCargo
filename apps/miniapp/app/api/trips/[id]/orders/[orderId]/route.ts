/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** PATCH /api/trips/:id/orders/:orderId — отменить или отредактировать заказ */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; orderId: string }> },
) {
  const { id: tripId, orderId } = await params;
  const supabase = createAdminClient();

  let body: Record<string, any> = {};
  try {
    body = await request.json();
  } catch {
    body = { action: 'cancel' };
  }

  const action = body.action ?? 'cancel';

  if (action === 'cancel') {
    const { error } = await (supabase.from('trip_orders') as any)
      .update({ lifecycle_status: 'cancelled' })
      .eq('id', orderId)
      .eq('trip_id', tripId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'edit') {
    const { data: trip } = await (supabase.from('trips') as any)
      .select('lifecycle_status')
      .eq('id', tripId)
      .single();

    if (trip?.lifecycle_status === 'approved') {
      return NextResponse.json({ error: 'Рейс уже одобрен администратором' }, { status: 403 });
    }

    const pendingMethods = ['bank_invoice', 'debt_cash'];
    const settlementStatus = pendingMethods.includes(body.payment_method) ? 'pending' : 'completed';

    const { error } = await (supabase.from('trip_orders') as any)
      .update({
        counterparty_id: body.counterparty_id ?? null,
        description: body.description ?? null,
        amount: body.amount,
        driver_pay: body.driver_pay,
        loader_pay: body.loader_pay ?? '0',
        loader2_pay: body.loader2_pay ?? '0',
        payment_method: body.payment_method,
        settlement_status: settlementStatus,
      })
      .eq('id', orderId)
      .eq('trip_id', tripId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
}
