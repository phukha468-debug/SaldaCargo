/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import {
  isGeostroyCounterparty,
  isGeostroyOrderValid,
  checkOdometerRequirement,
} from '@saldacargo/shared';

/** POST /api/trips/:id/finish — завершить рейс */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as {
    odometer_end?: number | string;
    driver_note?: string;
    fuel_amount?: number;
    fuel_payment_method?: 'fuel_card' | 'cash';
  };

  const supabase = createAdminClient();

  // 1. Получаем рейс и данные автомобиля
  const { data: trip, error: tripErr } = await (supabase.from('trips') as any)
    .select(
      'id, asset_id, odometer_start, status, trip_type, asset:assets(id, short_name, reg_number, odometer_current, asset_type:asset_types(code))',
    )
    .eq('id', id)
    .maybeSingle();

  if (tripErr || !trip) {
    return NextResponse.json({ error: 'Рейс не найден' }, { status: 404 });
  }

  if (trip.status === 'completed') {
    return NextResponse.json(trip);
  }

  // 2. Валидация правил обязательного одометра:
  // - Все Газели: обязательно в конце каждой смены. Без одометра нельзя сдать смену.
  // - Все грузовики (Валдай, Кантер): 1 раз в конце месяца (с 25 числа).
  const odoEnd =
    body.odometer_end != null &&
    body.odometer_end !== '' &&
    !isNaN(Number(body.odometer_end)) &&
    Number(body.odometer_end) > 0
      ? Number(body.odometer_end)
      : null;

  const odoRequirement = checkOdometerRequirement(trip.asset);

  if (odoRequirement.required) {
    if (!odoEnd) {
      return NextResponse.json(
        {
          error: `${odoRequirement.message} Укажите показания одометра для завершения смены.`,
        },
        { status: 400 },
      );
    }

    const minOdo = trip.odometer_start || trip.asset?.odometer_current || 0;
    if (minOdo > 0 && odoEnd < minOdo) {
      return NextResponse.json(
        {
          error: `Конечный одометр (${odoEnd.toLocaleString('ru-RU')} км) не может быть меньше начального (${minOdo.toLocaleString('ru-RU')} км).`,
        },
        { status: 400 },
      );
    }
  }

  // 3. Защита: для заказов с контрагентом «ООО Геостройиндустрия» обязательны Маршрут и Дата начала (по маске)
  const { data: tripOrders, error: ordersError } = await (supabase.from('trip_orders') as any)
    .select('id, description, lifecycle_status, counterparty:counterparties(name)')
    .eq('trip_id', id);

  if (!ordersError && Array.isArray(tripOrders)) {
    const activeOrders = tripOrders.filter((o: any) => o.lifecycle_status !== 'cancelled');
    for (const order of activeOrders) {
      const cpName = order.counterparty?.name;
      if (isGeostroyCounterparty(cpName)) {
        if (!isGeostroyOrderValid(order.description)) {
          return NextResponse.json(
            {
              error:
                'Нельзя отправить рейс на ревью: для контрагента «ООО Геостройиндустрия» обязательно заполните маршрут и дату начала маршрута (в формате ДД.ММ.ГГГГ).',
            },
            { status: 400 },
          );
        }
      }
    }
  }

  // 4. Завершение смены
  const updatePayload: Record<string, any> = {
    status: 'completed',
    lifecycle_status: 'draft', // ждёт апрува админа
    driver_note: body.driver_note ?? null,
    ended_at: new Date().toISOString(),
  };

  if (odoEnd) {
    updatePayload.odometer_end = odoEnd;
  }

  const { data, error } = await ((supabase.from('trips') as any)
    .update(updatePayload)
    .eq('id', id)
    .eq('status', 'in_progress')
    .select()
    .maybeSingle() as any);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 5. Синхронизируем актуальный одометр автомобиля в таблице assets
  if (odoEnd && trip.asset_id) {
    const currentAssetOdo = trip.asset?.odometer_current || 0;
    if (odoEnd >= currentAssetOdo) {
      await (supabase.from('assets') as any)
        .update({
          odometer_current: odoEnd,
          updated_at: new Date().toISOString(),
        })
        .eq('id', trip.asset_id);
    }
  }

  return NextResponse.json(data);
}
