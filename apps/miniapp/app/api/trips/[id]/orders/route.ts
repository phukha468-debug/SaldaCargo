/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import {
  isNoCashCounterparty,
  isTerritoryCounterparty,
  isGeostroyCounterparty,
  isGeostroyOrderValid,
  isInternalCounterparty,
} from '@saldacargo/shared';

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

  let paymentMethod = body.payment_method;
  let isInternal = false;
  if (body.counterparty_id) {
    const { data: cp } = await (supabase.from('counterparties') as any)
      .select('name')
      .eq('id', body.counterparty_id)
      .maybeSingle();
    isInternal = isInternalCounterparty(cp?.name);
    if (isInternal) {
      paymentMethod = 'cash';
    } else if (isNoCashCounterparty(cp?.name) && paymentMethod === 'cash') {
      paymentMethod = 'debt_cash';
    }
    if (isTerritoryCounterparty(cp?.name)) {
      if (!body.description?.trim()) {
        return NextResponse.json(
          {
            error:
              'Для контрагента «Территория» обязательно укажите адрес (улица + дом) и описание работы',
          },
          { status: 400 },
        );
      }
    }
    if (isGeostroyCounterparty(cp?.name)) {
      if (!isGeostroyOrderValid(body.description)) {
        return NextResponse.json(
          {
            error:
              'Для контрагента «ООО Геостройиндустрия» обязательно укажите маршрут и дату начала маршрута по маске (ДД.ММ.ГГГГ)',
          },
          { status: 400 },
        );
      }
    }
  }

  // settlement_status: только долг = pending; наличка и QR — деньги получены сразу; для внутренних заказов — completed
  const settlementStatus =
    !isInternal &&
    (paymentMethod === 'debt_cash' || paymentMethod === 'debt' || paymentMethod === 'debt_bank')
      ? 'pending'
      : 'completed';

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
      amount: isInternal ? '0' : body.amount,
      driver_car_pay: body.driver_car_pay || '0',
      driver_loader_pay: body.driver_loader_pay || '0',
      driver_pay: body.driver_pay,
      loaders_data: loaders,
      loader_id: loader1?.id || null,
      loader_pay: loader1?.pay ? String(loader1.pay) : '0',
      loader2_id: loader2?.id || null,
      loader2_pay: loader2?.pay ? String(loader2.pay) : '0',
      payment_method: paymentMethod,
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
