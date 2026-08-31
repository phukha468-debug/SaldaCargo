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

    const pendingMethods = ['debt_cash', 'qr', 'card_driver'];
    const settlementStatus = pendingMethods.includes(body.payment_method) ? 'pending' : 'completed';

    const loaders = Array.isArray(body.loaders_data) ? body.loaders_data : [];
    const loader1 =
      loaders[0] || (body.loader_id ? { id: body.loader_id, pay: body.loader_pay || '0' } : null);
    const loader2 =
      loaders[1] ||
      (body.loader2_id ? { id: body.loader2_id, pay: body.loader2_pay || '0' } : null);

    const updatePayload: Record<string, any> = {
      counterparty_id: body.counterparty_id || null,
      description: body.description || null,
      amount: body.amount,
      driver_pay: body.driver_pay,
      payment_method: body.payment_method,
      settlement_status: settlementStatus,
    };

    if (body.direction !== undefined) updatePayload.direction = body.direction;
    if (body.is_driver_loader !== undefined)
      updatePayload.is_driver_loader = Boolean(body.is_driver_loader);
    if (body.driver_car_pay !== undefined) updatePayload.driver_car_pay = body.driver_car_pay;
    if (body.driver_loader_pay !== undefined)
      updatePayload.driver_loader_pay = body.driver_loader_pay;
    if (body.loaders_data !== undefined) updatePayload.loaders_data = loaders;
    updatePayload.loader_id = loader1?.id || null;
    updatePayload.loader_pay = loader1?.pay ? String(loader1.pay) : '0';
    updatePayload.loader2_id = loader2?.id || null;
    updatePayload.loader2_pay = loader2?.pay ? String(loader2.pay) : '0';

    const { error } = await (supabase.from('trip_orders') as any)
      .update(updatePayload)
      .eq('id', orderId)
      .eq('trip_id', tripId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
}
