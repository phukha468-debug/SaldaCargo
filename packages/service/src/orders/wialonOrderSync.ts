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

export interface VehicleDepartureParams {
  vehicleId: string;
  timestamp?: string;
  odometer: number;
  lat?: number;
  lon?: number;
  direction?: 'east' | 'west';
}

/**
 * 2. Авто-старт заявки и создание рейса при выезде грузовика из геозоны гаража/города
 * Реализует правила геозон и направлений:
 * 1. Транзитный статус активен только при старте на восток (Шайтанка, Н.Салда, Басьяновский).
 * 2. Снятие транзитного флага при выходе на Тагил (на запад).
 */
export async function handleVehicleDeparture(
  supabase: SupabaseClient<any, any, any>,
  params: VehicleDepartureParams,
) {
  const departureTime = params.timestamp || new Date().toISOString();

  // Определение направления выезда:
  // Долгота центра Салды 60.552. Выезд на восток (Н.Салда, Шайтанка) > 60.55, на запад (Н.Тагил) <= 60.55.
  const direction: 'east' | 'west' =
    params.direction ||
    (params.lon !== undefined ? (params.lon > 60.55 ? 'east' : 'west') : 'east');
  const isExitingWest = direction === 'west';
  const isEastStart = direction === 'east';

  // 0. Проверяем, есть ли уже активная заявка в статусе in_progress (выезд после промежуточного транзита через Салду)
  const { data: inProgressOrder } = await supabase
    .from('orders')
    .select('*, trip:trips!orders_active_trip_id_fkey(*)')
    .eq('assigned_vehicle_id', params.vehicleId)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (inProgressOrder) {
    console.log(
      `[Wialon] 🚚 Автомобиль ${params.vehicleId} выехал из Салды в направлении ${direction.toUpperCase()} (${isExitingWest ? 'на Нижний Тагил / трассу' : 'на восток'}), продолжая текущий рейс.`,
    );

    // Обновляем одометр актива (только если новый одометр больше текущего)
    const { data: curAsset } = await supabase
      .from('assets')
      .select('odometer_current')
      .eq('id', params.vehicleId)
      .single();

    if (params.odometer > (curAsset?.odometer_current || 0)) {
      await supabase
        .from('assets')
        .update({ odometer_current: params.odometer, updated_at: new Date().toISOString() })
        .eq('id', params.vehicleId);
    }

    // Снятие транзитного флага при выходе на Тагил:
    // Как только машина покидает геозону Верхней Салды в западном направлении (на Нижний Тагил),
    // признак транзита ПОЛНОСТЬЮ отключается (transit_allowed: false, prevent_salda_auto_finish: false).
    await supabase
      .from('orders')
      .update({
        raw_parser_payload: {
          ...(inProgressOrder.raw_parser_payload || {}),
          in_salda_transit: false,
          departed_after_transit_at: departureTime,
          ...(isExitingWest
            ? {
                has_departed_west: true,
                transit_allowed: false,
                prevent_salda_auto_finish: false,
                departed_west_at: departureTime,
              }
            : {}),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', inProgressOrder.id);

    return {
      success: true,
      isEmergency: false,
      isTransitContinuation: true,
      direction,
      orderId: inProgressOrder.id,
      tripId: inProgressOrder.active_trip_id,
      departureTime,
      status: 'in_progress',
      message: isExitingWest
        ? 'Выезд на Нижний Тагил: транзитный статус снят, рейс продолжается по межгороду'
        : 'Продолжение активного рейса после выезда из Салды (восток)',
    };
  }

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

  // Получаем карточку автомобиля для проверки закрепленного водителя
  const { data: assetData } = await supabase
    .from('assets')
    .select('id, reg_number, short_name, assigned_driver_id')
    .eq('id', params.vehicleId)
    .maybeSingle();

  const isValdai446 =
    assetData?.reg_number?.includes('446') || assetData?.short_name?.includes('446') || false;
  // Валдай 446 или любой автомобиль без закрепленного водителя требует обязательного уточнения
  const isDriverUncertain = isValdai446 || !assetData?.assigned_driver_id;

  // Если заявка не была создана заранее — создаем экстренную заявку со знаком внимания ⚠️
  if (!targetOrder) {
    // Приоритет 1: Закрепленный за автомобилем постоянный водитель из карточки ТС (если водитель определен)
    if (!driverId && !isDriverUncertain && assetData?.assigned_driver_id) {
      driverId = assetData.assigned_driver_id;
    }

    // Приоритет 2: Ищем последнего водителя этого автомобиля из прошлых рейсов (как временный fallback из-за NOT NULL)
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

    const docName = isValdai446
      ? '⚠️ ВЫЕЗД БЕЗ ЗАЯВКИ (Валдай 446 - УТОЧНИТЬ ВОДИТЕЛЯ)'
      : '⚠️ ВЫЕЗД БЕЗ ЗАЯВКИ';

    const isEastStart = direction === 'east';

    const { data: emergencyOrder, error: emergErr } = await supabase
      .from('orders')
      .insert({
        source_type: 'direct_ad',
        status: 'in_progress',
        base_doc_name: docName,
        base_doc_number: '',
        base_doc_date: departureTime.slice(0, 10),
        cargo_name: '',
        cargo_condition: null,
        loading_address_json: { city: '', raw: '' },
        unloading_address_json: { city: '', raw: '' },
        price_without_vat: null,
        payment_terms: '',
        assigned_vehicle_id: params.vehicleId,
        assigned_driver_id: driverId,
        actual_loading_arrival_at: departureTime,
        raw_parser_payload: {
          ...(isDriverUncertain ? { needs_driver_clarification: true } : {}),
          departure_direction: isEastStart ? 'east' : 'west',
          transit_allowed: isEastStart,
          prevent_salda_auto_finish: isEastStart,
          has_departed_west: !isEastStart,
        },
      })
      .select()
      .single();

    if (emergErr) {
      throw new Error(`Ошибка создания экстренной заявки: ${emergErr.message}`);
    }

    targetOrder = emergencyOrder;
  }

  const isEmergency = !order;
  let tripNote = isEmergency
    ? '⚡ Автовыезд'
    : `Авто-старт по геозоне Wialon. Заявка № ${targetOrder.base_doc_number || targetOrder.order_number}`;

  if (isDriverUncertain) {
    tripNote = `⚠️ УТОЧНИТЬ ВОДИТЕЛЯ! На автомобиле нет закрепленного водителя.\n${tripNote}`;
  }

  // Парсим номер рейса из номера заявки, если рейс создавался по заранее заведенной заявке
  const rawOrderNum = targetOrder.base_doc_number || targetOrder.internal_order_number;
  const cleanNumStr = String(rawOrderNum || '')
    .replace(/^№\s*/, '')
    .replace(/^Заявка\s*№?\s*/i, '');
  const isEpeWithSlash = cleanNumStr.includes('/') || cleanNumStr.includes('\\');
  const parsedTripNum = !isEpeWithSlash
    ? parseInt((cleanNumStr.split('/')[0] || '').trim(), 10)
    : NaN;

  // Определение сквозного номера рейса:
  // Если рейс по заявке и номер валидный — используем его.
  // Иначе (выезд без заявки Wialon) — СТРОГО берем max(trip_number) + 1 из сквозного счетчика автопарка (>1050),
  // чтобы номера всегда шли непрерывной чередой 1056, 1057... и не брали локальный id из таблицы orders!
  let finalTripNumber: number;
  if (!isEmergency && !isNaN(parsedTripNum) && parsedTripNum > 0 && parsedTripNum < 100000) {
    finalTripNumber = parsedTripNum;
  } else {
    const { data: maxTrip } = await supabase
      .from('trips')
      .select('trip_number')
      .order('trip_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    finalTripNumber = Math.max(1000, Number(maxTrip?.trip_number || 0)) + 1;
  }

  const tripInsertPayload: Record<string, any> = {
    asset_id: params.vehicleId,
    driver_id: driverId,
    trip_number: finalTripNumber,
    trip_type: 'intercity',
    status: 'in_progress',
    lifecycle_status: 'draft',
    odometer_start: params.odometer,
    started_at: departureTime,
    driver_note: tripNote,
    ...(isDriverUncertain ? { admin_note: '[УТОЧНИТЬ_ВОДИТЕЛЯ]' } : {}),
  };

  // Создаем связанный рейс в таблице trips
  const { data: newTrip, error: tripErr } = await supabase
    .from('trips')
    .insert(tripInsertPayload)
    .select()
    .single();

  if (tripErr) {
    throw new Error(`Ошибка создания рейса trips: ${tripErr.message}`);
  }

  // Обновляем заказ: переводим в статус in_progress и привязываем active_trip_id
  // Если у авто-заявки не было номера, связываем номер заявки с номером рейса 1:1
  const finalDocNumber =
    targetOrder.base_doc_number || (newTrip.trip_number ? String(newTrip.trip_number) : '');

  await supabase
    .from('orders')
    .update({
      status: 'in_progress',
      base_doc_number: finalDocNumber,
      active_trip_id: newTrip.id,
      actual_loading_arrival_at: departureTime,
      raw_parser_payload: {
        ...(targetOrder.raw_parser_payload || {}),
        departure_direction: isEastStart ? 'east' : 'west',
        transit_allowed: isEastStart,
        prevent_salda_auto_finish: isEastStart,
        has_departed_west: !isEastStart,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetOrder.id);

  // Обновляем одометр актива (только если новый одометр больше текущего)
  const { data: curAssetDep } = await supabase
    .from('assets')
    .select('odometer_current')
    .eq('id', params.vehicleId)
    .single();

  if (params.odometer > (curAssetDep?.odometer_current || 0)) {
    await supabase
      .from('assets')
      .update({ odometer_current: params.odometer, updated_at: new Date().toISOString() })
      .eq('id', params.vehicleId);
  }

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

export interface VehicleArrivalParams {
  vehicleId: string;
  timestamp?: string;
  odometer: number;
  forceFinish?: boolean;
  isInsideBase?: boolean;
  distanceFromBaseKm?: number;
  lat?: number;
  lon?: number;
}

/**
 * 3. Авто-закрытие по возврату в радиус города/гаража -> перевод в pending_review
 */
export async function handleVehicleArrival(
  supabase: SupabaseClient<any, any, any>,
  params: VehicleArrivalParams,
) {
  const arrivalTime = params.timestamp || new Date().toISOString();

  // Если машина физически снаружи базы — рейс не может быть автоматически закрыт
  if (params.isInsideBase === false && !params.forceFinish) {
    console.log(`[Wialon] ⚠️ ТС ${params.vehicleId} снаружи базы. Автозавершение рейса отменено.`);
    return {
      success: false,
      message: 'Транспортное средство находится вне геозоны базы. Автозавершение отклонено.',
    };
  }

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

  const startDate = new Date(trip.started_at);
  const arrivalDate = new Date(arrivalTime);
  const diffMinutes = Math.max(1, (arrivalDate.getTime() - startDate.getTime()) / (1000 * 60));

  // Текущий фактический пробег рейса
  const currentOdo = params.odometer || trip.odometer_end || trip.odometer_start || 0;
  const startOdo = trip.odometer_start || currentOdo;
  const currentTripMileage = Math.max(0, currentOdo - startOdo);

  // Маршрут Шайтанка: посещение геозоны Шайтанки или указание Шайтанки в адресе/маршруте
  const isShaytankaRoute = Boolean(
    order.raw_parser_payload?.visited_shaytanka ||
    order.loading_address_json?.raw?.toLowerCase().includes('шайтан') ||
    order.loading_address_json?.city?.toLowerCase().includes('шайтан') ||
    order.cargo_name?.toLowerCase().includes('шайтан') ||
    (trip.driver_note && trip.driver_note.toLowerCase().includes('шайтан')),
  );

  const minRequiredMileage = order.raw_parser_payload?.min_return_distance_km || 300;

  const hasUnloaded = Boolean(
    order.raw_parser_payload?.has_unloaded ||
    order.raw_parser_payload?.unloaded ||
    (order.raw_parser_payload?.visited_maminskoe && currentTripMileage >= minRequiredMileage),
  );

  // До Маминского и обратно кругорейс более 450-500 км!
  // Если машина проехала меньше 300 км или ещё не выгрузилась во второй точке — она ещё НЕ завершила рейс (погрузка на Шайтанке, отстой/ночёвка в Салде).
  // Автозакрытие СТРОГО БЛОКИРУЕТСЯ, рейс остаётся в пути!
  // 1. БЕЗУСЛОВНЫЙ ФИНИШ ПРИ ВОЗВРАТЕ С ТАГИЛА:
  // Любой следующий въезд в Верхнюю Салду со стороны Тагила (с запада) или после выезда на запад
  // сразу и окончательно завершает рейс (status: 'completed'), фиксирует конечный одометр с Wialon и выставляет рейс на Ревью!
  const hasDepartedWest = Boolean(
    order.raw_parser_payload?.has_departed_west ||
    order.raw_parser_payload?.departure_direction === 'west' ||
    (params.lon !== undefined && params.lon < 60.45) ||
    order.raw_parser_payload?.visited_maminskoe ||
    order.raw_parser_payload?.visited_karpinsk ||
    order.raw_parser_payload?.visited_vorontsovka,
  );

  // Проверка: погрузка НЕ в Салде (например, Шайтанка или внешний склад)
  const isExternalOrigin = Boolean(
    order.loading_address_json?.raw &&
    !order.loading_address_json.raw.toLowerCase().includes('салда'),
  );

  // 2. ТРАНЗИТНЫЙ СТАТУС АКТИВЕН ТОЛЬКО ПРИ СТАРТЕ НА ВОСТОК:
  // Если первый выезд зафиксирован в сторону Шайтанки / Н. Салды / Басьяновского,
  // заезд обратно в Верхнюю Салду фиксируется как «Отстой / транзит перед выездом на трассу» (рейс остаётся in_progress).
  // При возврате с Тагила транзит СТРОГО ЗАПРЕЩЕН (hasDepartedWest === false).
  const isTransitEligible =
    !hasDepartedWest &&
    !params.forceFinish &&
    (Boolean(order.raw_parser_payload?.transit_allowed) ||
      order.raw_parser_payload?.departure_direction === 'east' ||
      order.raw_parser_payload?.visited_shaytanka ||
      isShaytankaRoute ||
      isExternalOrigin) &&
    !hasUnloaded;

  if (isTransitEligible) {
    const transitCount =
      ((order.raw_parser_payload?.salda_transit_count ?? order.salda_transit_count) || 0) + 1;
    console.log(
      `[Wialon] 🔄 Отстой / транзит перед выездом на трассу для ТС ${params.vehicleId}. Заезд #${transitCount} (${Math.round(diffMinutes)} мин с начала). Рейс продолжается (in_progress)!`,
    );

    // Обновляем одометр актива (только если новый одометр больше текущего)
    const { data: curAssetTransit } = await supabase
      .from('assets')
      .select('odometer_current')
      .eq('id', params.vehicleId)
      .single();

    if (params.odometer > (curAssetTransit?.odometer_current || 0)) {
      await supabase
        .from('assets')
        .update({ odometer_current: params.odometer, updated_at: new Date().toISOString() })
        .eq('id', params.vehicleId);
    }

    // Сохраняем флаг транзита в order
    await supabase
      .from('orders')
      .update({
        raw_parser_payload: {
          ...(order.raw_parser_payload || {}),
          prevent_salda_auto_finish: true,
          in_salda_transit: true,
          salda_transit_count: transitCount,
          last_transit_checked_at: Math.floor(Date.now() / 1000),
          visited_shaytanka: Boolean(
            order.raw_parser_payload?.visited_shaytanka || isShaytankaRoute,
          ),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    return {
      success: true,
      transit: true,
      salda_transit_count: transitCount,
      orderId: order.id,
      tripId: trip.id,
      message: 'Отстой / транзит перед выездом на трассу. Рейс продолжается (in_progress).',
    };
  }

  const odoStart = trip.odometer_start || params.odometer;
  const odoEnd = Math.max(odoStart, params.odometer);
  const distanceKm = Math.max(1, odoEnd - odoStart);

  // Расчет продолжительности в днях для суточных:
  // 1. Если пробег меньше 100 км — суточных НЕТ (0 дн / 0 ₽).
  // 2. Ночные / вечерние погрузки с отстоем/ночевкой в Салде не считаются в суточные (водитель ночует дома).
  //    Время ночного отстоя на базе (~10-12 ч) вычитается из дорожного времени.
  const diffHours = Math.max(1, (arrivalDate.getTime() - startDate.getTime()) / (1000 * 3600));
  const hadSaldaOvernight = Boolean(
    order.raw_parser_payload?.in_salda_transit !== undefined ||
    (order.raw_parser_payload?.salda_transit_count || 0) > 0 ||
    (trip.driver_note && trip.driver_note.includes('Отстой в Салде')) ||
    (trip.driver_note && trip.driver_note.includes('Промежуточный заезд')) ||
    (isShaytankaRoute && diffHours >= 12),
  );
  const roadHours = hadSaldaOvernight ? Math.max(1, diffHours - 10) : diffHours;
  const daysCount = distanceKm < 100 ? 0 : Math.max(1, Math.ceil(roadHours / 24));

  // Тариф водителя: 10 руб/км + 1000 руб/сутки (только при пробеге >= 100 км)
  const kmPay = distanceKm * 10;
  const perDiemPay = daysCount * 1000;
  // Округление ЗП до 100 ₽ в меньшую сторону (например 7 070 ₽ -> 7 000 ₽)
  const totalDriverPay = Math.floor((kmPay + perDiemPay) / 100) * 100;

  // Расчет расхода топлива по нормативу для Валдая: 18 л / 100 км
  // Актуализируемая базовая цена: 82 руб/л (ТК и нал), льготный Кубик: 60 руб/л
  const FUEL_RATE_PER_100KM = 18;
  const FUEL_PRICE_TK = 82;
  const fuelLiters = Number(((distanceKm * FUEL_RATE_PER_100KM) / 100).toFixed(1));
  // Округление суммы топлива до 100 ₽ (например 8 963 ₽ -> 9 000 ₽)
  const defaultFuelCost = Math.round((fuelLiters * FUEL_PRICE_TK) / 100) * 100;

  // Проверяем: является ли этот выезд поездкой на ремонт (СТО)
  const isRepairTrip = Boolean(
    order.raw_parser_payload?.is_repair ||
    order.raw_parser_payload?.trip_type === 'repair' ||
    (trip.driver_note && trip.driver_note.includes('[РЕЙС_НА_РЕМОНТ]')) ||
    (trip.admin_note && trip.admin_note.includes('[РЕЙС_НА_РЕМОНТ]')) ||
    (order.base_doc_name && order.base_doc_name.toLowerCase().includes('ремонт')),
  );

  if (isRepairTrip) {
    console.log(
      `[Wialon] 🔧 ТС ${params.vehicleId} вернулось из поездки на ремонт! Завершаем рейс и переводим заказ-наряд на РЕВЬЮ ГАРАЖА.`,
    );

    // 1. Завершаем служебный дорожный рейс
    await supabase
      .from('trips')
      .update({
        odometer_end: odoEnd,
        ended_at: arrivalTime,
        status: 'completed',
        lifecycle_status: 'approved',
        admin_note: `[РЕЙС_НА_РЕМОНТ] Сервисный перегон на СТО завершен. Пробег: ${distanceKm} км | Норматив ГСМ: ${fuelLiters} л (~${defaultFuelCost} ₽). Переведено на Ревью Гаража.`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', trip.id);

    // 1.1 Добавляем нормативный расход на ГСМ
    if (defaultFuelCost > 0) {
      const CAT_FUEL_ID = '62cebf3f-9982-4cc6-904b-48c6169cf5e4';
      await supabase.from('trip_expenses').insert({
        trip_id: trip.id,
        category_id: CAT_FUEL_ID,
        amount: defaultFuelCost,
        payment_method: 'fuel_card',
        description: `Топливо по нормативу (Валдай, рейс на ремонт): ${fuelLiters} л (18л/100км @ ${FUEL_PRICE_TK}₽/л)`,
        idempotency_key: crypto.randomUUID(),
      });
    }

    // 2. Завершаем заявку без выставления коммерческого счета клиенту
    await supabase
      .from('orders')
      .update({
        status: 'completed',
        actual_loading_departure_at: arrivalTime,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    // 3. Находим или создаем заказ-наряд в service_orders и переводим в status='completed', lifecycle_status='draft' (НА РЕВЬЮ ГАРАЖА)
    let serviceOrderId = order.raw_parser_payload?.service_order_id;
    if (!serviceOrderId) {
      const { data: activeSo } = await (supabase.from('service_orders') as any)
        .select('id, admin_note')
        .eq('asset_id', params.vehicleId)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      serviceOrderId = activeSo?.id;
    }

    if (serviceOrderId) {
      const { data: curSo } = await (supabase.from('service_orders') as any)
        .select('admin_note')
        .eq('id', serviceOrderId)
        .single();

      const appendNote = `[Возврат с ремонта: пробег ${distanceKm} км, ГСМ ${fuelLiters} л (~${defaultFuelCost} ₽)]`;
      const updatedAdminNote = curSo?.admin_note
        ? `${curSo.admin_note}\n${appendNote}`
        : appendNote;

      await (supabase.from('service_orders') as any)
        .update({
          status: 'completed',
          lifecycle_status: 'draft',
          odometer_end: odoEnd,
          admin_note: updatedAdminNote,
          mechanic_pay: 0,
          second_mechanic_pay: 0,
          assigned_mechanic_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', serviceOrderId);
    } else {
      const { data: adminUser } = await (supabase.from('users') as any)
        .select('id')
        .filter('roles', 'cs', '{"admin"}')
        .limit(1)
        .maybeSingle();

      const createdById = adminUser?.id || trip.driver_id || '595e749a-6271-4799-b9e6-6132c2d89913';

      const { data: createdSo } = await (supabase.from('service_orders') as any)
        .insert({
          asset_id: params.vehicleId,
          machine_type: 'own',
          status: 'completed',
          lifecycle_status: 'draft',
          problem_description: '[Сторонний сервис: СТО] Поездка на ремонт по геозоне Wialon',
          admin_note: `Пробег перегона: ${distanceKm} км, Норматив ГСМ: ${fuelLiters} л (~${defaultFuelCost} ₽)`,
          odometer_start: odoStart,
          odometer_end: odoEnd,
          created_by: createdById,
          priority: 'normal',
          mechanic_pay: 0,
          second_mechanic_pay: 0,
          assigned_mechanic_id: null,
        })
        .select('id')
        .single();

      serviceOrderId = createdSo?.id;
    }

    // 4. Обновляем одометр ТС
    const { data: curAssetArr } = await supabase
      .from('assets')
      .select('odometer_current')
      .eq('id', params.vehicleId)
      .single();

    if (odoEnd > (curAssetArr?.odometer_current || 0)) {
      await supabase
        .from('assets')
        .update({ odometer_current: odoEnd, updated_at: new Date().toISOString() })
        .eq('id', params.vehicleId);
    }

    return {
      success: true,
      isRepairTrip: true,
      orderId: order.id,
      tripId: trip.id,
      serviceOrderId,
      distanceKm,
      daysCount,
      fuelLiters,
      fuelCost: defaultFuelCost,
      status: 'pending_garage_review',
      message: 'Поездка на ремонт завершена. Заказ-наряд переведен на РЕВЬЮ ГАРАЖА.',
    };
  }

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
  if (defaultFuelCost > 0) {
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
  }

  // 2. Определяем контрагента и добавляем заказ в trip_orders для связки с финансовой системой
  let resolvedClientId = order.client_id;
  if (!resolvedClientId && order.loading_org_name) {
    const cleanOrg = order.loading_org_name
      .replace(/\(ЛОП\)|\(ПРР\)|\(ООО\)|\(ИП\)/gi, '')
      .replace(/["'«»]/g, '')
      .trim();
    if (cleanOrg.length > 2) {
      const { data: matchedCp } = await supabase
        .from('counterparties')
        .select('id')
        .eq('is_active', true)
        .ilike('name', `%${cleanOrg}%`)
        .order('is_legal_entity', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (matchedCp) {
        resolvedClientId = matchedCp.id;
        await supabase
          .from('orders')
          .update({ client_id: matchedCp.id, updated_at: new Date().toISOString() })
          .eq('id', order.id);
      }
    }
  }

  const billingDocs = order.raw_parser_payload?.billing_docs;
  const invNumber = billingDocs?.invoice_number?.trim() || null;
  const invDate = invNumber ? billingDocs?.invoice_date || arrivalTime.slice(0, 10) : null;

  const subOrders = order.raw_parser_payload?.client_orders;
  if (Array.isArray(subOrders) && subOrders.length > 1) {
    // Несколько клиентов в одном рейсе -> создаем отдельные строки trip_orders для раздельного биллинга
    for (let idx = 0; idx < subOrders.length; idx++) {
      const sub = subOrders[idx];
      let subClientId = sub.client_id || null;
      if (!subClientId && sub.client_name) {
        const cleanSub = sub.client_name
          .replace(/\(ЛОП\)|\(ПРР\)|\(ООО\)|\(ИП\)/gi, '')
          .replace(/["'«»]/g, '')
          .trim();
        const { data: matchedSubCp } = await supabase
          .from('counterparties')
          .select('id')
          .eq('is_active', true)
          .ilike('name', `%${cleanSub}%`)
          .limit(1)
          .maybeSingle();
        if (matchedSubCp) subClientId = matchedSubCp.id;
      }

      const subAmount = Number(sub.price_without_vat) || 0;
      const subCargo = sub.cargo_name || order.cargo_name || 'Груз';
      const subDoc = sub.base_doc_number ? ` (№ ${sub.base_doc_number})` : '';
      const subClientLabel = sub.client_name ? ` [${sub.client_name}]` : '';

      await supabase.from('trip_orders').insert({
        trip_id: trip.id,
        counterparty_id: subClientId || resolvedClientId,
        description: `Заказ #${idx + 1}${subDoc}: ${subCargo}${subClientLabel}`,
        amount: subAmount,
        driver_pay: idx === 0 ? totalDriverPay : 0,
        payment_method: sub.payment_method || 'bank_invoice',
        settlement_status: 'pending',
        lifecycle_status: 'draft',
        invoice_number: idx === 0 ? invNumber : null,
        invoice_date: idx === 0 ? invDate : null,
        invoice_status: 'unbilled',
        idempotency_key: crypto.randomUUID(),
      });
    }
  } else {
    // Проверяем, существует ли уже созданный trip_order для данного рейса (например, предварительно созданный при авто-детекции)
    const { data: existingTo } = await supabase
      .from('trip_orders')
      .select('id, amount, description')
      .eq('trip_id', trip.id)
      .filter('lifecycle_status', 'neq', 'cancelled')
      .maybeSingle();

    if (existingTo) {
      const finalRouteDesc = order.raw_parser_payload?.detected_route_summary
        ? 'Керн Геостройиндустрия'
        : existingTo.description;

      await supabase
        .from('trip_orders')
        .update({
          counterparty_id: resolvedClientId || undefined,
          amount: order.price_without_vat || existingTo.amount || 0,
          driver_pay: totalDriverPay,
          description: finalRouteDesc || existingTo.description,
          invoice_number: invNumber || undefined,
          invoice_date: invDate || undefined,
          invoice_status: invNumber ? 'issued' : 'unbilled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingTo.id);
    } else {
      const defaultDesc = order.raw_parser_payload?.detected_route_summary
        ? 'Керн Геостройиндустрия'
        : `Заявка ${order.base_doc_number || order.order_number}: ${order.cargo_name || 'Груз'} (${distanceKm} км)`;

      const { error: tripOrderErr } = await supabase.from('trip_orders').insert({
        trip_id: trip.id,
        counterparty_id: resolvedClientId,
        description: defaultDesc,
        amount: order.price_without_vat || 0,
        driver_pay: totalDriverPay,
        payment_method: 'bank_invoice',
        settlement_status: 'pending',
        lifecycle_status: 'draft',
        invoice_number: invNumber,
        invoice_date: invDate,
        invoice_status: invNumber ? 'issued' : 'unbilled',
        idempotency_key: crypto.randomUUID(),
      });

      if (tripOrderErr) {
        console.error('Ошибка добавления trip_order:', tripOrderErr);
      }
    }
  }

  // 3. Переводим заявку в статус pending_review
  await supabase
    .from('orders')
    .update({
      status: 'pending_review',
      actual_loading_departure_at: arrivalTime,
      raw_parser_payload: {
        ...(order.raw_parser_payload || {}),
        prevent_salda_auto_finish: false,
        in_salda_transit: false,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  // 4. Обновляем одометр ТС (только если новый одометр больше текущего)
  const { data: curAssetArr } = await supabase
    .from('assets')
    .select('odometer_current')
    .eq('id', params.vehicleId)
    .single();

  if (odoEnd > (curAssetArr?.odometer_current || 0)) {
    await supabase
      .from('assets')
      .update({ odometer_current: odoEnd, updated_at: new Date().toISOString() })
      .eq('id', params.vehicleId);
  }

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
