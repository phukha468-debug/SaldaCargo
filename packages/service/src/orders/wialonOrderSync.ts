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
      `[Wialon] 🚚 Автомобиль ${params.vehicleId} выехал из Салды, продолжая текущий рейс (заявка ${inProgressOrder.base_doc_number || inProgressOrder.order_number}). Новая заявка НЕ создается.`,
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

    // При выезде из геозоны Салды после транзита:
    // фиксируем время выезда и снимаем in_salda_transit / prevent_salda_auto_finish,
    // чтобы при следующем окончательном возвращении на базу рейс смог штатно перейти на ревью.
    if (
      inProgressOrder.prevent_salda_auto_finish ||
      inProgressOrder.raw_parser_payload?.prevent_salda_auto_finish ||
      inProgressOrder.raw_parser_payload?.in_salda_transit
    ) {
      await supabase
        .from('orders')
        .update({
          raw_parser_payload: {
            ...(inProgressOrder.raw_parser_payload || {}),
            prevent_salda_auto_finish: false,
            in_salda_transit: false,
            departed_after_transit_at: departureTime,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', inProgressOrder.id);
    }

    // Фиксируем выезд после транзита в заметке рейса
    const tripObj = Array.isArray(inProgressOrder.trip)
      ? inProgressOrder.trip[0]
      : inProgressOrder.trip;
    if (tripObj?.id) {
      const prevNote = tripObj.driver_note || '';
      const departNote = `[Выезд из Салды (продолжение рейса): ${departureTime.slice(11, 16)}, одометр: ${params.odometer} км]`;
      if (!prevNote.includes(departNote)) {
        await supabase
          .from('trips')
          .update({
            driver_note: `${prevNote}\n${departNote}`.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', tripObj.id);
      }
    }

    return {
      success: true,
      isEmergency: false,
      isTransitContinuation: true,
      orderId: inProgressOrder.id,
      tripId: inProgressOrder.active_trip_id,
      departureTime,
      status: 'in_progress',
      message: 'Продолжение активного рейса после выезда из Салды (транзит)',
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

  // Парсим номер рейса из номера заявки, чтобы связать их строго 1:1
  const rawOrderNum =
    targetOrder.base_doc_number || targetOrder.internal_order_number || targetOrder.order_number;
  const cleanNumStr = String(rawOrderNum || '')
    .replace(/^№\s*/, '')
    .replace(/^Заявка\s*№?\s*/i, '');
  const isEpeWithSlash = cleanNumStr.includes('/') || cleanNumStr.includes('\\');
  const parsedTripNum = !isEpeWithSlash
    ? parseInt((cleanNumStr.split('/')[0] || '').trim(), 10)
    : NaN;

  const tripInsertPayload: Record<string, any> = {
    asset_id: params.vehicleId,
    driver_id: driverId,
    trip_type: 'intercity',
    status: 'in_progress',
    lifecycle_status: 'draft',
    odometer_start: params.odometer,
    started_at: departureTime,
    driver_note: tripNote,
  };

  if (!isNaN(parsedTripNum) && parsedTripNum > 0 && parsedTripNum < 100000) {
    tripInsertPayload.trip_number = parsedTripNum;
  }

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
  await supabase
    .from('orders')
    .update({
      status: 'in_progress',
      active_trip_id: newTrip.id,
      actual_loading_arrival_at: departureTime,
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

  // Явный запрет автозавершения (выставляется вручную или при первом транзитном заезде)
  const isTransitExplicitlyAllowed = Boolean(
    order.prevent_salda_auto_finish || order.raw_parser_payload?.prevent_salda_auto_finish,
  );

  // Проверка: погрузка НЕ в Салде (например, Шайтанка) — машина могла заехать в Салду транзитом
  // в начале рейса, не завершив его. Только с этим условием блокируем автофиниш.
  // isExternalDestination (разгрузка не в Салде) — НАМЕРЕННО исключено: это норма для 100% рейсов
  // и не должно блокировать завершение.
  const isExternalOrigin =
    order.loading_address_json?.raw &&
    !order.loading_address_json.raw.toLowerCase().includes('салда');

  // Если машина в пути менее 45 минут И погрузка была НЕ из Салды — транзитный проезд на старте
  const isEarlyTransit = diffMinutes < 45 && Boolean(isExternalOrigin);

  // hasMultipleLegs убран: наличие нескольких точек в заявке не означает незавершённость рейса
  // и приводило к тому, что рейс застревал навсегда без ревью.

  if ((isTransitExplicitlyAllowed || isEarlyTransit) && !params.forceFinish) {
    const transitCount =
      ((order.raw_parser_payload?.salda_transit_count ?? order.salda_transit_count) || 0) + 1;
    const transitReason = isTransitExplicitlyAllowed
      ? 'явный запрет (prevent_salda_auto_finish)'
      : `ранний заезд (${Math.round(diffMinutes)} мин, погрузка вне Салды)`;
    console.log(
      `[Wialon] 🔄 Промежуточный транзит через Салду для ТС ${params.vehicleId}. Заезд #${transitCount} (${Math.round(diffMinutes)} мин с начала). Причина: ${transitReason}. Рейс продолжается!`,
    );

    // Обновляем одометр актива (только если новый одометр больше текущего) и фиксируем отметку в рейсе
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

    const prevNote = trip.driver_note || '';
    const noteMarker = `[Промежуточный заезд в Салду: ${arrivalTime.slice(11, 16)}`;
    const newNote = prevNote.includes(noteMarker)
      ? prevNote
      : `${prevNote}\n[Промежуточный заезд в Салду: ${arrivalTime.slice(11, 16)}, одометр: ${params.odometer} км]`.trim();

    if (newNote !== prevNote) {
      await supabase
        .from('trips')
        .update({
          driver_note: newNote,
          updated_at: new Date().toISOString(),
        })
        .eq('id', trip.id);
    }

    // При промежуточном заезде в Салду: сохраняем флаг транзита (prevent_salda_auto_finish: true)
    // и помечаем in_salda_transit: true, чтобы повторные опросы телематики, пока машина находится внутри Салды,
    // ни в коем случае НЕ закрывали рейс!
    // Флаг снимется только при фактическом ВЫЕЗДЕ из геозоны Салды (handleVehicleDeparture).
    await supabase
      .from('orders')
      .update({
        raw_parser_payload: {
          ...(order.raw_parser_payload || {}),
          prevent_salda_auto_finish: true,
          in_salda_transit: true,
          salda_transit_count: transitCount,
          last_transit_checked_at: Math.floor(Date.now() / 1000),
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
      message: `Промежуточный заезд в Салду (заезд #${transitCount}). Заявка продолжается в пути.`,
    };
  }

  const odoStart = trip.odometer_start || params.odometer;
  const odoEnd = Math.max(odoStart, params.odometer);
  const distanceKm = Math.max(1, odoEnd - odoStart);

  // Расчет продолжительности в днях для суточных
  const diffHours = Math.max(1, (arrivalDate.getTime() - startDate.getTime()) / (1000 * 3600));
  const daysCount = Math.max(1, Math.ceil(diffHours / 24));

  // Тариф водителя: 10 руб/км + 1000 руб/сутки
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
    const CAT_FUEL_ID = '62cebf3f-9982-4cc6-904b-48c6169cf5e4';
    await supabase.from('trip_expenses').insert({
      trip_id: trip.id,
      category_id: CAT_FUEL_ID,
      amount: defaultFuelCost,
      payment_method: 'fuel_card',
      description: `Топливо по нормативу (Валдай, рейс на ремонт): ${fuelLiters} л (18л/100км @ ${FUEL_PRICE_TK}₽/л)`,
      idempotency_key: crypto.randomUUID(),
    });

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
          problem_description: 'Поездка на ремонт (СТО) по геозоне Wialon',
          admin_note: `Пробег перегона: ${distanceKm} км, Норматив ГСМ: ${fuelLiters} л (~${defaultFuelCost} ₽)`,
          odometer_start: odoStart,
          odometer_end: odoEnd,
          created_by: createdById,
          priority: 'normal',
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

  const { error: tripOrderErr } = await supabase.from('trip_orders').insert({
    trip_id: trip.id,
    counterparty_id: resolvedClientId,
    description: `Заявка ${order.base_doc_number || order.order_number}: ${order.cargo_name || 'Груз'} (${distanceKm} км)`,
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

  // 3. Переводим заявку в статус pending_review
  await supabase
    .from('orders')
    .update({
      status: 'pending_review',
      actual_loading_departure_at: arrivalTime,
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
