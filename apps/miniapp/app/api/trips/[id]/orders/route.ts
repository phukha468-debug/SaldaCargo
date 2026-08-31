/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** POST /api/trips/:id/orders — добавить заказ */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const body = (await request.json()) as {
    direction?: string;
    is_driver_loader?: boolean;
    counterparty_id?: string;
    description?: string;
    amount: string;
    driver_car_pay?: string;
    driver_loader_pay?: string;
    driver_pay: string;
    loaders_data?: Array<{ id: string; name?: string; pay: string }>;
    loader_id?: string;
    loader_pay?: string;
    loader2_id?: string;
    loader2_pay?: string;
    payment_method: string;
    idempotency_key: string;
  };

  const supabase = createAdminClient();

  // settlement_status: только долг = pending; наличка и QR — деньги получены сразу
  const settlementStatus = body.payment_method === 'debt_cash' ? 'pending' : 'completed';

  const loaders = Array.isArray(body.loaders_data) ? body.loaders_data : [];
  const loader1 =
    loaders[0] || (body.loader_id ? { id: body.loader_id, pay: body.loader_pay || '0' } : null);
  const loader2 =
    loaders[1] || (body.loader2_id ? { id: body.loader2_id, pay: body.loader2_pay || '0' } : null);

  const { data, error } = await ((supabase.from('trip_orders') as any)
    .insert({
      trip_id: tripId,
      direction: body.direction || 'local',
      is_driver_loader: Boolean(body.is_driver_loader),
      counterparty_id: body.counterparty_id || null,
      description: body.description || null,
      amount: body.amount,
      driver_car_pay: body.driver_car_pay || '0',
      driver_loader_pay: body.driver_loader_pay || '0',
      driver_pay: body.driver_pay,
      loaders_data: loaders,
      loader_id: loader1?.id || null,
      loader_pay: loader1?.pay ? String(loader1.pay) : '0',
      loader2_id: loader2?.id || null,
      loader2_pay: loader2?.pay ? String(loader2.pay) : '0',
      payment_method: body.payment_method,
      settlement_status: settlementStatus,
      lifecycle_status: 'draft',
      idempotency_key: body.idempotency_key,
    })
    .select()
    .single() as any);

  if (error) {
    // Idempotency: если ключ уже есть — возвращаем существующий
    if (error.code === '23505') {
      const { data: existing } = await (supabase
        .from('trip_orders')
        .select()
        .eq('idempotency_key', body.idempotency_key)
        .single() as any);
      return NextResponse.json(existing, { status: 200 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
