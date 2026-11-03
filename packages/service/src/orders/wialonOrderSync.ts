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

  if (!order) {
    return { success: false, message: 'Нет назначенной заявки для выезда ТС' };
  }

  // Создаем связанный рейс в таблице trips
  const { data: newTrip, error: tripErr } = await supabase
    .from('trips')
    .insert({
      asset_id: params.vehicleId,
      driver_id: order.assigned_driver_id,
      trip_type: 'intercity',
      status: 'in_progress',
      lifecycle_status: 'draft',
      odometer_start: params.odometer,
      started_at: departureTime,
      driver_note: `Авто-старт по геозоне Wialon. Заявка № ${order.base_doc_number || order.order_number}`,
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
    .eq('id', order.id);

  // Обновляем одометр актива
  await supabase
    .from('assets')
    .update({ odometer_current: params.odometer, updated_at: new Date().toISOString() })
    .eq('id', params.vehicleId);

  return {
    success: true,
    orderId: order.id,
    tripId: newTrip.id,
    departureTime,
    status: 'in_progress',
  };
}

/**
 * 3. Авто-закрытие по возврату в радиус города/гаража -> перевод в pending_review
 */
export async function handleVehicleArrival(
  supabase: SupabaseClient<any, any, any>,
  params: { vehicleId: string; timestamp?: string; odometer: number },
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

  // 1. Обновляем рейс: статус completed, lifecycle_status = 'draft' (ждет одобрения на странице ревью)
  await supabase
    .from('trips')
    .update({
      odometer_end: odoEnd,
      ended_at: arrivalTime,
      status: 'completed',
      lifecycle_status: 'draft',
      admin_note: `Пробег: ${distanceKm} км (${kmPay} ₽) + Суточные: ${daysCount} дн (${perDiemPay} ₽) = Итого ЗП: ${totalDriverPay} ₽`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', trip.id);

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
    status: 'pending_review',
  };
}
