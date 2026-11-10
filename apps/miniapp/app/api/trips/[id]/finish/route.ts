/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import {
  isGeostroyCounterparty,
  isGeostroyOrderValid,
  checkOdometerRequirement,
  validateTripOdometer,
  calculateCubeFuel,
  FINANCIAL_CATEGORIES,
} from '@saldacargo/shared';

/** POST /api/trips/:id/finish — завершить рейс */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as {
    odometer_end?: number | string;
    driver_note?: string;
    fuel_amount?: number;
    fuel_payment_method?: 'fuel_card' | 'cash' | 'cube';
    is_cube_fuel?: boolean;
    cube_fuel_liters?: number | string;
    cube_fuel_amount?: number | string;
    is_handed_to_accountant?: boolean;
    is_carryover?: boolean;
    carryover_amount?: number | string;
    carryover_note?: string;
  };

  const supabase = createAdminClient();

  // 1. Получаем рейс и данные автомобиля
  const { data: trip, error: tripErr } = await (supabase.from('trips') as any)
    .select(
      'id, driver_id, trip_number, asset_id, odometer_start, status, trip_type, asset:assets(id, short_name, reg_number, odometer_current, asset_type:asset_types(code))',
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
  // Для всех авто (Газели, Валдаи, Кантер): обязательно в конце каждой смены. Без одометра нельзя сдать смену.
  const odoEnd =
    body.odometer_end != null &&
    body.odometer_end !== '' &&
    !isNaN(Number(body.odometer_end)) &&
    Number(body.odometer_end) > 0
      ? Number(body.odometer_end)
      : null;

  const isPrrTrip =
    trip.trip_type === 'loaders_only' ||
    trip.asset?.reg_number === 'БЕЗ АВТО' ||
    Boolean(trip.asset?.short_name?.toLowerCase().includes('без авто'));

  const odoRequirement = isPrrTrip
    ? { required: false, reason: null, message: '' }
    : checkOdometerRequirement(trip.asset);

  if (odoRequirement.required && !odoEnd) {
    return NextResponse.json(
      {
        error: `${odoRequirement.message} Укажите показания одометра для завершения смены.`,
      },
      { status: 400 },
    );
  }

  if (odoEnd) {
    const minOdo = trip.odometer_start || trip.asset?.odometer_current || 0;
    const odoValidation = validateTripOdometer(trip.asset, minOdo, odoEnd);
    if (!odoValidation.valid) {
      return NextResponse.json(
        {
          error: odoValidation.error,
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

  const isHanded = body.is_handed_to_accountant === true;
  const carryAmt =
    !isHanded && (body.is_carryover || body.carryover_amount)
      ? parseFloat(String(body.carryover_amount).replace(',', '.'))
      : 0;

  if (carryAmt > 0 && trip.driver_id) {
    const carryNote =
      body.carryover_note?.trim() || 'Деньги не переданы бухгалтеру, остаток на руках';
    const carryMarker = `[НЕ СДАНО В КАССУ: ${carryAmt.toLocaleString('ru-RU')} ₽ — ${carryNote}]`;
    updatePayload.driver_note = body.driver_note
      ? `${body.driver_note}\n${carryMarker}`
      : carryMarker;

    const CASH_COLLECT_CAT = '72f677d4-84af-4d0d-a845-a1b63c7ae607';
    const CASH_WALLET_ID = '10000000-0000-0000-0000-000000000002';

    const { data: driverWallet } = await (supabase.from('wallets') as any)
      .select('id')
      .eq('owner_user_id', trip.driver_id)
      .eq('type', 'driver_accountable')
      .limit(1)
      .maybeSingle();

    await (supabase.from('transactions') as any).insert({
      direction: 'transfer',
      amount: carryAmt.toFixed(2),
      category_id: CASH_COLLECT_CAT,
      from_wallet_id: driverWallet?.id ?? null,
      to_wallet_id: CASH_WALLET_ID,
      lifecycle_status: 'approved',
      settlement_status: 'pending',
      related_user_id: trip.driver_id,
      trip_id: trip.id,
      description: `[CARRYOVER] Рейс №${trip.trip_number ?? ''}: ${carryNote}`,
      created_by: trip.driver_id,
      idempotency_key: crypto.randomUUID(),
      transaction_date: new Date().toISOString(),
    });
  } else if (isHanded && trip.driver_id) {
    const handedMarker = `[ВСЕ ДЕНЬГИ ПЕРЕДАЛ В РУКИ БУХГАЛТЕРУ]`;
    updatePayload.driver_note = body.driver_note
      ? `${body.driver_note}\n${handedMarker}`
      : handedMarker;
  }

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

  // 6. Фиксация заправки из кубика (База) по одометру или введённым литрам
  if (body.is_cube_fuel) {
    const startOdo = trip.odometer_start || trip.asset?.odometer_current || 0;
    const mileage = odoEnd && startOdo > 0 && odoEnd >= startOdo ? odoEnd - startOdo : 0;
    const assetTypeCode = trip.asset?.asset_type?.code;
    const calc = calculateCubeFuel(mileage, assetTypeCode, trip.asset);

    const liters =
      body.cube_fuel_liters != null && Number(body.cube_fuel_liters) > 0
        ? Number(body.cube_fuel_liters)
        : calc.liters;

    const amount =
      body.cube_fuel_amount != null && Number(body.cube_fuel_amount) > 0
        ? Number(body.cube_fuel_amount)
        : Math.round(liters * 60);

    if (amount > 0) {
      // Проверяем, не был ли уже добавлен расход из куба в этом рейсе
      const { data: existingCubeExp } = await (supabase.from('trip_expenses') as any)
        .select('id')
        .eq('trip_id', id)
        .eq('payment_method', 'cube')
        .limit(1)
        .maybeSingle();

      const fuelCatId = FINANCIAL_CATEGORIES.FUEL;
      const desc = `Заправка из кубика: ${liters} л (норма ${calc.rate} л/100км, пробег ${mileage} км)`;

      if (existingCubeExp) {
        await (supabase.from('trip_expenses') as any)
          .update({
            amount: amount.toFixed(2),
            description: desc,
          })
          .eq('id', existingCubeExp.id);
      } else {
        await (supabase.from('trip_expenses') as any).insert({
          trip_id: id,
          category_id: fuelCatId,
          amount: amount.toFixed(2),
          payment_method: 'cube',
          description: desc,
          idempotency_key: crypto.randomUUID(),
        });
      }
    }
  }

  // 7. Автоматически переводим связанную заявку в orders в статус 'pending_review' («На ревью»)
  try {
    const orConds = [`active_trip_id.eq.${id}`];
    if (trip.trip_number) orConds.push(`order_number.eq.${trip.trip_number}`);
    if (trip.asset_id) orConds.push(`assigned_vehicle_id.eq.${trip.asset_id}`);

    const { data: linkedOrders } = await (supabase.from('orders') as any)
      .select('id, status')
      .or(orConds.join(','))
      .in('status', ['waiting_vehicle', 'assigned', 'in_progress']);

    if (linkedOrders && linkedOrders.length > 0) {
      for (const ord of linkedOrders) {
        await (supabase.from('orders') as any)
          .update({
            status: 'pending_review',
            active_trip_id: id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', ord.id);
      }
    }
  } catch (syncErr) {
    console.error('Ошибка синхронизации заказа при завершении рейса водителем:', syncErr);
  }

  return NextResponse.json(data);
}
