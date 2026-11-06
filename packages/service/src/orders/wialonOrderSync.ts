/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AssignVehicleParams {
  orderId: string;
  vehicleId: string;
  driverId: string;
}

export interface GeofenceEventParams {
  vehicleId: string;
  eventType: 'departed_garage' | 'arrived_garage';
  timestamp?: string; // ISO
  odometer: number;
}

/**
 * 1. Назначение машины и водителя на заявку из листа ожидания
 */
export async function assignVehicleAndDriver(
  supabase: SupabaseClient<any, any, any>,
  params: AssignVehicleParams,
) {
  // Генерируем номер путевого листа: серия + номер заказа
  const now = new Date();
  const yearSuffix = String(now.getFullYear()).slice(-2);
  const waybillNumber = `ПЛ-${yearSuffix}/${Math.floor(1000 + Math.random() * 9000)}`;

  const { data: updatedOrder, error } = await supabase
    .from('orders')
    .update({
      assigned_vehicle_id: params.vehicleId,
      assigned_driver_id: params.driverId,
      status: 'assigned',
      waybill_number: waybillNumber,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.orderId)
    .select('*, vehicle:assets(*), driver:users(*), client:counterparties!orders_client_id_fkey(*)')
    .single();

  if (error) {
    throw new Error(`Ошибка назначения ТС на заявку: ${error.message}`);
  }

  return updatedOrder;
}

/**
 * 2. Авто-старт заявки и создание рейса при выезде грузовика из геозоны гаража/города
 */
export async function handleVehicleDeparture(
  supabase: SupabaseClient<any, any, any>,
  params: { vehicleId: string; timestamp?: string; odometer: number },
) {
  const departureTime = params.timestamp || new Date().toISOString();

  // Ищем активную назначенную заявку на этот автомобиль
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*')
    .eq('assigned_vehicle_id', params.vehicleId)
    .in('status', ['assigned', 'waiting_vehicle'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (orderErr) {
    throw new Error(`Ошибка поиска заявки: ${orderErr.message}`);
  }

  let targetOrder = order;
  let driverId = order?.assigned_driver_id;

  // Если заявка не была создана заранее — создаем экстренную заявку со знаком внимания ⚠️
  if (!targetOrder) {
    // Ищем последнего водителя этого автомобиля из прошлых рейсов
    if (!driverId) {
      const { data: lastTrip } = await supabase
        .from('trips')
        .select('driver_id')
        .eq('asset_id', params.vehicleId)
        .not('driver_id', 'is', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      driverId = lastTrip?.driver_id;
    }

    if (!driverId) {
      const { data: defaultDriver } = await supabase
        .from('users')
        .select('id')
        .contains('roles', ['driver'])
        .limit(1)
        .maybeSingle();
      driverId = defaultDriver?.id;
    }

    const autoDocNumber = `АВТО-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: emergencyOrder, error: emergErr } = await supabase
      .from('orders')
      .insert({
        source_type: 'direct_ad',
        status: 'in_progress',
        base_doc_name: '⚠️ ВЫЕЗД БЕЗ ЗАЯВКИ',
        base_doc_number: autoDocNumber,
        base_doc_date: departureTime.slice(0, 10),
        cargo_name: '⚠️ Выезд без заявки (Wialon)',
        cargo_condition: '⚠️ Необходимо заполнить данные груза',
        loading_address_json: { city: 'Верхняя Салда', address: 'База Салда' },
        unloading_address_json: {
          city: '⚠️ Требуется заполнить',
          address: '⚠️ Требуется заполнить',
        },
        price_without_vat: 0,
        payment_terms: '⚠️ Требуется заполнить условия оплаты',
        assigned_vehicle_id: params.vehicleId,
        assigned_driver_id: driverId,
        actual_loading_arrival_at: departureTime,
      })
      .select()
      .single();

    if (emergErr) {
      throw new Error(`Ошибка создания экстренной заявки: ${emergErr.message}`);
    }

    targetOrder = emergencyOrder;
  }

  const isEmergency = !order;
  const tripNote = isEmergency
    ? `⚠️ Внимание: Автомашина выехала без заявки по геозоне Wialon! Заявка № ${targetOrder.base_doc_number}. Необходимо заполнить все данные.`
    : `Авто-старт по геозоне Wialon. Заявка № ${targetOrder.base_doc_number || targetOrder.order_number}`;

  // Создаем связанный рейс в таблице trips
  const { data: newTrip, error: tripErr } = await supabase
    .from('trips')
    .insert({
      asset_id: params.vehicleId,
      driver_id: driverId,
      trip_type: 'intercity',
      status: 'in_progress',
      lifecycle_status: 'draft',
      odometer_start: params.odometer,
      started_at: departureTime,
      driver_note: tripNote,
    })
    .select()
    .single();

  if (tripErr) {
    throw new Error(`Ошибка создания рейса trips: ${tripErr.message}`);
  }

  // Обновляем заказ: переводим в статус in_progress и привязываем active_trip_id
  await supabase
    .from('orders')
    .update({
      status: 'in_progress',
      active_trip_id: newTrip.id,
      actual_loading_arrival_at: departureTime,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetOrder.id);

  // Обновляем одометр актива
  await supabase
    .from('assets')
    .update({ odometer_current: params.odometer, updated_at: new Date().toISOString() })
    .eq('id', params.vehicleId);

  return {
    success: true,
    isEmergency,
    orderId: targetOrder.id,
    tripId: newTrip.id,
    departureTime,
    status: 'in_progress',
    message: isEmergency
      ? '⚠️ Заявка создана автоматически (выезд без заявки). Требуется заполнение.'
      : 'Рейс успешно запущен по заявке',
  };
}

/**
 * 3. Авто-закрытие по возврату в радиус города/гаража -> перевод в pending_review
 */
export async function handleVehicleArrival(
  supabase: SupabaseClient<any, any, any>,
  params: { vehicleId: string; timestamp?: string; odometer: number; forceFinish?: boolean },
) {
  const arrivalTime = params.timestamp || new Date().toISOString();

  // Ищем заказ со статусом in_progress для данного ТС
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*, client:counterparties!orders_client_id_fkey(*)')
    .eq('assigned_vehicle_id', params.vehicleId)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (orderErr) {
    throw new Error(`Ошибка поиска активной заявки: ${orderErr.message}`);
  }

  if (!order || !order.active_trip_id) {
    return { success: false, message: 'Нет активной заявки in_progress для фиксации прибытия' };
  }

  // Получаем связанный рейс
  const { data: trip, error: tripFetchErr } = await supabase
    .from('trips')
    .select('*')
    .eq('id', order.active_trip_id)
    .single();

  if (tripFetchErr || !trip) {
    throw new Error(`Связанный рейс не найден: ${tripFetchErr?.message}`);
  }

  // Проверка: Составной / круговой маршрут с промежуточным заездом в Верхнюю Салду
  const isTransitAllowed = Boolean(
    order.prevent_salda_auto_finish || order.raw_parser_payload?.prevent_salda_auto_finish,
  );

  if (isTransitAllowed && !params.forceFinish) {
    const transitCount =
      ((order.raw_parser_payload?.salda_transit_count ?? order.salda_transit_count) || 0) + 1;
    console.log(
      `[Wialon] 🔄 Промежуточный транзит через Салду для ТС ${params.vehicleId}. Заезд #${transitCount}. Заявка НЕ закрывается!`,
    );

    // Обновляем одометр актива и фиксируем промежуточную отметку в рейсе и заявке
    await supabase
      .from('assets')
      .update({ odometer_current: params.odometer, updated_at: new Date().toISOString() })
      .eq('id', params.vehicleId);

    const prevNote = trip.driver_note || '';
    const newNote =
      `${prevNote}\n[Промежуточный заезд в Салду: ${arrivalTime.slice(11, 16)}, одометр: ${params.odometer} км]`.trim();

    await supabase
      .from('trips')
      .update({
        driver_note: newNote,
        updated_at: new Date().toISOString(),
      })
      .eq('id', trip.id);

    // Однократный промежуточный заезд в зону: фиксируем транзит и автоматически СНИМАЕМ галочку prevent_salda_auto_finish в raw_parser_payload.
    // Второй заезд в Салду уже штатно завершит заявку и переведет её на ревью.
    await supabase
      .from('orders')
      .update({
        raw_parser_payload: {
          ...(order.raw_parser_payload || {}),
          prevent_salda_auto_finish: false,
          salda_transit_count: transitCount,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    return {
      success: true,
      transit: true,
      prevent_salda_auto_finish_cleared: true,
      salda_transit_count: transitCount,
      orderId: order.id,
      tripId: trip.id,
      message: `Промежуточный заезд в Салду (заезд #${transitCount}). Флаг составного рейса автоматически снят — следующий заезд закроет заявку.`,
    };
  }

  const odoStart = trip.odometer_start || params.odometer;
  const odoEnd = Math.max(odoStart, params.odometer);
  const distanceKm = Math.max(1, odoEnd - odoStart);

  // Расчет продолжительности в днях для суточных
  const startDate = new Date(trip.started_at);
  const endDate = new Date(arrivalTime);
  const diffHours = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 3600));
  const daysCount = Math.max(1, Math.ceil(diffHours / 24));

  // Тариф водителя: 10 руб/км + 1000 руб/сутки
  const kmPay = distanceKm * 10;
  const perDiemPay = daysCount * 1000;
  const totalDriverPay = kmPay + perDiemPay;

  // Расчет расхода топлива по нормативу для Валдая: 18 л / 100 км
  // Актуализируемая базовая цена: 82 руб/л (ТК и нал), льготный Кубик: 60 руб/л
  const FUEL_RATE_PER_100KM = 18;
  const FUEL_PRICE_TK = 82;
  const fuelLiters = Number(((distanceKm * FUEL_RATE_PER_100KM) / 100).toFixed(1));
  const defaultFuelCost = Math.round(fuelLiters * FUEL_PRICE_TK);

  // 1. Обновляем рейс: статус completed, lifecycle_status = 'draft' (ждет одобрения на странице ревью)
  await supabase
    .from('trips')
    .update({
      odometer_end: odoEnd,
      ended_at: arrivalTime,
      status: 'completed',
      lifecycle_status: 'draft',
      admin_note: `Пробег: ${distanceKm} км (${kmPay} ₽) + Суточные: ${daysCount} дн (${perDiemPay} ₽) = Итого ЗП: ${totalDriverPay} ₽ | Норматив ГСМ: ${fuelLiters} л (~${defaultFuelCost} ₽)`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', trip.id);

  // 1.1 Добавляем нормативный расход на ГСМ в trip_expenses (по умолчанию через ТК)
  const CAT_FUEL_ID = '62cebf3f-9982-4cc6-904b-48c6169cf5e4';
  const { error: fuelExpErr } = await supabase.from('trip_expenses').insert({
    trip_id: trip.id,
    category_id: CAT_FUEL_ID,
    amount: defaultFuelCost,
    payment_method: 'fuel_card',
    description: `Топливо по нормативу (Валдай): ${fuelLiters} л (18л/100км @ ${FUEL_PRICE_TK}₽/л)`,
    idempotency_key: crypto.randomUUID(),
  });

  if (fuelExpErr) {
    console.error('Ошибка создания записи ГСМ trip_expenses:', fuelExpErr);
  }

  // 2. Добавляем заказ в trip_orders для связки с финансовой системой
  const { error: tripOrderErr } = await supabase.from('trip_orders').insert({
    trip_id: trip.id,
    counterparty_id: order.client_id,
    description: `Заявка ${order.base_doc_number || order.order_number}: ${order.cargo_name} (${distanceKm} км)`,
    amount: order.price_without_vat || 0,
    driver_pay: totalDriverPay,
    payment_method: 'bank_invoice',
    settlement_status: 'pending',
    lifecycle_status: 'draft',
    idempotency_key: crypto.randomUUID(),
  });

  if (tripOrderErr) {
    console.error('Ошибка добавления trip_order:', tripOrderErr);
  }

  // 3. Переводим заявку в статус pending_review
  await supabase
    .from('orders')
    .update({
      status: 'pending_review',
      actual_loading_departure_at: arrivalTime,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  // 4. Обновляем одометр ТС
  await supabase
    .from('assets')
    .update({ odometer_current: odoEnd, updated_at: new Date().toISOString() })
    .eq('id', params.vehicleId);

  return {
    success: true,
    orderId: order.id,
    tripId: trip.id,
    distanceKm,
    daysCount,
    kmPay,
    perDiemPay,
    totalDriverPay,
    fuelLiters,
    fuelCost: defaultFuelCost,
    status: 'pending_review',
  };
}
