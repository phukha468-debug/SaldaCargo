import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  encodeTripRouteSheet,
  type OrganizationSettings,
  type TelematicsRoutePreset,
  type TripRouteLeg,
} from '@saldacargo/shared';
import { resolveOrganizationFinanceIds } from '../organization/settings';
import { calculateDistanceMeters } from '../providers/telematics/types';
import type { AutopilotCommand, GeocodedCandidateStop } from './stateMachine';

export interface RouteStopRecord {
  stop_key: string;
  merged_stop_keys?: string[];
  type: 'loading' | 'unloading' | 'stop';
  geofence_id: string | null;
  name: string;
  city: string;
  raw_address: string;
  lat: number;
  lon: number;
  arrived_at: string;
  departed_at: string;
  duration_min: number;
  odometer_km?: number;
  is_known: boolean;
  had_signal_gap: boolean;
}

export interface CommandExecutionContext {
  // Используем минимальный untyped-совместимый клиент без any, т.к. таблица orders отсутствует в сгенерированном Database типе
  supabase: SupabaseClient;
  organizationId: string;
  assetId: string;
  assignedDriverId: string | null;
  currentOdometerKm: number;
  orgSettings: OrganizationSettings;
}

/**
 * Генерирует детерминированный UUID из произвольной строки (для идемпотентности trip_expenses и trip_orders).
 */
export function deterministicUuid(seed: string): string {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `5${hash.slice(13, 16)}`,
    `a${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join('-');
}

function asRecord(val: unknown): Record<string, unknown> {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : {};
}

function asRouteStops(val: unknown): RouteStopRecord[] {
  if (!Array.isArray(val)) return [];
  return val.filter((item): item is RouteStopRecord => {
    const obj = asRecord(item);
    return typeof obj.stop_key === 'string' && typeof obj.name === 'string';
  });
}

function formatMoneyStr(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

function buildRouteLegs(
  stops: readonly RouteStopRecord[],
  baseName: string,
  timezone: string,
  tripStartedAtIso?: string | null,
  tripStartOdoKm?: number,
): TripRouteLeg[] {
  if (stops.length === 0) return [];
  const legs: TripRouteLeg[] = [];
  const baseDepIso = tripStartedAtIso || stops[0]!.arrived_at;
  const startOdoBase =
    Number.isFinite(tripStartOdoKm) && (tripStartOdoKm ?? 0) > 0 ? Math.round(tripStartOdoKm!) : 0;

  let runningOdo = startOdoBase;
  const points = [
    { name: baseName, arr: baseDepIso, dep: baseDepIso, odo: startOdoBase },
    ...stops.map((s) => {
      const stopOdo =
        typeof s.odometer_km === 'number' && Number.isFinite(s.odometer_km) && s.odometer_km > 0
          ? Math.round(s.odometer_km)
          : runningOdo;
      if (stopOdo > runningOdo) runningOdo = stopOdo;
      return { name: s.name, arr: s.arrived_at, dep: s.departed_at, odo: runningOdo };
    }),
  ];

  for (let i = 0; i < points.length - 1; i++) {
    const fromPt = points[i]!;
    const toPt = points[i + 1]!;
    const depDate = new Date(fromPt.dep);
    const arrDate = new Date(toPt.arr);
    const durSec = Math.max(60, Math.floor((arrDate.getTime() - depDate.getTime()) / 1000));
    const h = Math.floor(durSec / 3600);
    const m = Math.floor((durSec % 3600) / 60);
    const legStartOdo = fromPt.odo;
    const legEndOdo = toPt.odo >= fromPt.odo ? toPt.odo : fromPt.odo;
    const legKm = legStartOdo > 0 && legEndOdo > legStartOdo ? legEndOdo - legStartOdo : 0;

    legs.push({
      n: i + 1,
      from: fromPt.name,
      to: toPt.name,
      route: `${fromPt.name} ➔ ${toPt.name}`,
      dep: depDate.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone,
      }),
      dur: h > 0 ? `${h}ч ${m}м` : `${m}м`,
      arr: arrDate.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone,
      }),
      date: arrDate.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        timeZone: timezone,
      }),
      km: legKm,
      startOdo: legStartOdo,
      endOdo: legEndOdo,
    });
  }
  return legs;
}

async function resolveDriverForVehicle(ctx: CommandExecutionContext): Promise<string | null> {
  if (ctx.assignedDriverId) return ctx.assignedDriverId;

  const { data: lastTrip } = await ctx.supabase
    .from('trips')
    .select('driver_id')
    .eq('organization_id', ctx.organizationId)
    .eq('asset_id', ctx.assetId)
    .not('driver_id', 'is', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastTrip?.driver_id) return String(lastTrip.driver_id);

  const { data: anyDriver } = await ctx.supabase
    .from('users')
    .select('id')
    .eq('organization_id', ctx.organizationId)
    .contains('roles', ['driver'])
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  return anyDriver?.id ? String(anyDriver.id) : null;
}

async function syncAssetOdometer(ctx: CommandExecutionContext, newOdo: number): Promise<void> {
  if (newOdo <= ctx.currentOdometerKm) return;
  await ctx.supabase
    .from('assets')
    .update({ odometer_current: newOdo, updated_at: new Date().toISOString() })
    .eq('id', ctx.assetId)
    .eq('organization_id', ctx.organizationId);
}

async function executeOpenTrip(
  ctx: CommandExecutionContext,
  cmd: Extract<AutopilotCommand, { type: 'OPEN_TRIP' }>,
): Promise<{ orderId: string; tripId: string } | null> {
  // Идемпотентная проверка: не открыт ли уже заказ in_progress
  const { data: existing } = await ctx.supabase
    .from('orders')
    .select('id, active_trip_id')
    .eq('organization_id', ctx.organizationId)
    .eq('assigned_vehicle_id', ctx.assetId)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id && existing.active_trip_id) {
    return { orderId: String(existing.id), tripId: String(existing.active_trip_id) };
  }

  // Ищем заранее назначенную заявку (assigned / waiting_vehicle)
  const { data: assignedOrder } = await ctx.supabase
    .from('orders')
    .select('id, base_doc_number, internal_order_number, assigned_driver_id, raw_parser_payload')
    .eq('organization_id', ctx.organizationId)
    .eq('assigned_vehicle_id', ctx.assetId)
    .in('status', ['assigned', 'waiting_vehicle'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const driverId =
    (assignedOrder?.assigned_driver_id ? String(assignedOrder.assigned_driver_id) : null) ??
    (await resolveDriverForVehicle(ctx));

  if (!driverId) {
    throw new Error(`Не найден водитель для открытия рейса ТС ${ctx.assetId}`);
  }

  const isDriverUncertain = !ctx.assignedDriverId && !assignedOrder?.assigned_driver_id;
  const isEmergency = !assignedOrder;

  let targetOrderId = assignedOrder?.id ? String(assignedOrder.id) : '';
  let existingPayload = asRecord(assignedOrder?.raw_parser_payload);

  if (isEmergency) {
    const emergencyPayload = {
      ...(isDriverUncertain ? { needs_driver_clarification: true } : {}),
      departure_direction: cmd.direction,
      transit_allowed: cmd.transitAllowed,
      prevent_salda_auto_finish: cmd.transitAllowed,
      has_departed_west: cmd.direction === 'west',
      autopilot_v2: true,
    };

    const { data: createdOrder, error: orderErr } = await ctx.supabase
      .from('orders')
      .insert({
        organization_id: ctx.organizationId,
        source_type: 'direct_ad',
        status: 'in_progress',
        base_doc_name: isDriverUncertain
          ? '⚠️ ВЫЕЗД БЕЗ ЗАЯВКИ (УТОЧНИТЬ ВОДИТЕЛЯ)'
          : '⚠️ ВЫЕЗД БЕЗ ЗАЯВКИ',
        base_doc_number: '',
        base_doc_date: cmd.departureTimeIso.slice(0, 10),
        cargo_name: '',
        cargo_condition: null,
        loading_address_json: { city: '', raw: '' },
        unloading_address_json: { city: '', raw: '' },
        routes_json: [],
        price_without_vat: null,
        payment_terms: '',
        assigned_vehicle_id: ctx.assetId,
        assigned_driver_id: driverId,
        actual_loading_arrival_at: cmd.departureTimeIso,
        raw_parser_payload: emergencyPayload,
      })
      .select('id')
      .single();

    if (orderErr) {
      // Код 23505 от partial unique index idx_orders_one_in_progress_per_vehicle — гонка уже создала заказ
      if (orderErr.code === '23505') {
        const { data: raced } = await ctx.supabase
          .from('orders')
          .select('id, active_trip_id')
          .eq('organization_id', ctx.organizationId)
          .eq('assigned_vehicle_id', ctx.assetId)
          .eq('status', 'in_progress')
          .limit(1)
          .maybeSingle();
        if (raced?.id && raced.active_trip_id) {
          return { orderId: String(raced.id), tripId: String(raced.active_trip_id) };
        }
      }
      throw new Error(`Ошибка создания авто-заявки: ${orderErr.message}`);
    }

    targetOrderId = String(createdOrder.id);
    existingPayload = emergencyPayload;
  }

  // Номер рейса (trip_number) выдаётся единым PostgreSQL SEQUENCE (DEFAULT nextval),
  // чтобы автопилот и ручные рейсы никогда не создавали дубликаты номеров.
  const odoStart = cmd.odometerKm > 0 ? cmd.odometerKm : ctx.currentOdometerKm || 0;
  const notePrefix = isDriverUncertain
    ? '⚠️ УТОЧНИТЬ ВОДИТЕЛЯ! На автомобиле нет закреплённого водителя.\n'
    : '';
  const tripNote = `${notePrefix}${
    isEmergency
      ? '⚡ Автовыезд (Автопилот v2)'
      : `Авто-старт по GPS. Заявка № ${assignedOrder?.base_doc_number || ''}`
  }`;

  const { data: newTrip, error: tripErr } = await ctx.supabase
    .from('trips')
    .insert({
      organization_id: ctx.organizationId,
      asset_id: ctx.assetId,
      driver_id: driverId,
      trip_type: 'intercity',
      status: 'in_progress',
      lifecycle_status: 'draft',
      odometer_start: odoStart,
      started_at: cmd.departureTimeIso,
      driver_note: tripNote,
      ...(isDriverUncertain ? { admin_note: '[УТОЧНИТЬ_ВОДИТЕЛЯ]' } : {}),
    })
    .select('id, trip_number')
    .single();

  if (tripErr || !newTrip) {
    throw new Error(`Ошибка создания рейса: ${tripErr?.message ?? 'unknown'}`);
  }

  const finalDocNum = assignedOrder?.base_doc_number || String(newTrip.trip_number);

  await ctx.supabase
    .from('orders')
    .update({
      status: 'in_progress',
      base_doc_number: finalDocNum,
      active_trip_id: newTrip.id,
      actual_loading_arrival_at: cmd.departureTimeIso,
      raw_parser_payload: {
        ...existingPayload,
        departure_direction: cmd.direction,
        transit_allowed: cmd.transitAllowed,
        prevent_salda_auto_finish: cmd.transitAllowed,
        has_departed_west: cmd.direction === 'west',
        autopilot_v2: true,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetOrderId)
    .eq('organization_id', ctx.organizationId);

  await syncAssetOdometer(ctx, odoStart);

  return { orderId: targetOrderId, tripId: String(newTrip.id) };
}

function findMatchingPreset(
  presets: readonly TelematicsRoutePreset[],
  geofenceId: string | null,
): TelematicsRoutePreset | null {
  if (!geofenceId) return null;
  return presets.find((p) => p.trigger_geofence_id === geofenceId) ?? null;
}

async function executeRecordStop(
  ctx: CommandExecutionContext,
  cmd: Extract<AutopilotCommand, { type: 'RECORD_STOP' }>,
): Promise<void> {
  const { data: order } = await ctx.supabase
    .from('orders')
    .select(
      'id, base_doc_name, client_id, cargo_name, price_without_vat, loading_address_json, unloading_address_json, routes_json, raw_parser_payload',
    )
    .eq('id', cmd.orderId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();

  if (!order) return;

  const existingStops = asRouteStops(order.routes_json);
  const alreadyRecorded = existingStops.some(
    (s) =>
      s.stop_key === cmd.stop.stopKey ||
      (Array.isArray(s.merged_stop_keys) && s.merged_stop_keys.includes(cmd.stop.stopKey)),
  );
  if (alreadyRecorded) {
    return; // Идемпотентность: точка уже записана (или склеена с предыдущей)
  }

  const initialRole: 'loading' | 'unloading' =
    cmd.geo.role === 'loading'
      ? 'loading'
      : cmd.geo.role === 'unloading'
        ? 'unloading'
        : existingStops.length === 0
          ? 'loading'
          : 'unloading';

  const newStop: RouteStopRecord = {
    stop_key: cmd.stop.stopKey,
    type: initialRole,
    geofence_id: cmd.geo.geofenceId,
    name: cmd.geo.name,
    city: cmd.geo.city,
    raw_address: cmd.geo.rawAddress,
    lat: cmd.stop.lat,
    lon: cmd.stop.lon,
    arrived_at: new Date(cmd.stop.startTs * 1000).toISOString(),
    departed_at: new Date(cmd.stop.endTs * 1000).toISOString(),
    duration_min: cmd.stop.durationMin,
    odometer_km: cmd.stop.odometerKm > 0 ? Math.round(cmd.stop.odometerKm) : undefined,
    is_known: cmd.geo.isKnown,
    had_signal_gap: cmd.stop.hadSignalGap,
  };

  // Вставляем точку в хронологическом порядке (на случай догрузки ранних точек из «чёрного ящика» трекера)
  // и склеиваем соседние по времени стоянки на одном объекте / в одной геозоне (< 1000 м при совпадении city/name)
  const chronological = [...existingStops, newStop].sort(
    (a, b) => new Date(a.arrived_at).getTime() - new Date(b.arrived_at).getTime(),
  );

  const mergedStops: RouteStopRecord[] = [];
  for (const item of chronological) {
    const prev = mergedStops[mergedStops.length - 1];
    const isSameGeofence = Boolean(
      prev && prev.geofence_id !== null && prev.geofence_id === item.geofence_id,
    );
    const isNearbySamePlace = Boolean(
      prev &&
      (prev.city === item.city || prev.name === item.name) &&
      calculateDistanceMeters(prev.lat, prev.lon, item.lat, item.lon) < 1000,
    );

    if (prev && (isSameGeofence || isNearbySamePlace)) {
      const mergedKeys = Array.from(
        new Set([
          ...(prev.merged_stop_keys ?? []),
          prev.stop_key,
          ...(item.merged_stop_keys ?? []),
          item.stop_key,
        ]),
      );
      const prevArrMs = new Date(prev.arrived_at).getTime();
      const prevDepMs = new Date(prev.departed_at).getTime();
      const curArrMs = new Date(item.arrived_at).getTime();
      const curDepMs = new Date(item.departed_at).getTime();
      const minArrMs = Math.min(prevArrMs, curArrMs);
      const maxDepMs = Math.max(prevDepMs, curDepMs);
      const mergedDurationMin =
        curArrMs <= prevDepMs
          ? Math.max(prev.duration_min, Math.round((maxDepMs - minArrMs) / 60_000))
          : prev.duration_min + item.duration_min;

      mergedStops[mergedStops.length - 1] = {
        ...prev,
        stop_key: item.stop_key,
        merged_stop_keys: mergedKeys,
        arrived_at: new Date(minArrMs).toISOString(),
        departed_at: new Date(maxDepMs).toISOString(),
        duration_min: mergedDurationMin,
        odometer_km: item.odometer_km ?? prev.odometer_km,
        had_signal_gap: prev.had_signal_gap || item.had_signal_gap,
      };
    } else {
      mergedStops.push(item);
    }
  }

  // Нормализуем роли точек по хронологии (если у геозоны не задана жёсткая роль loading/unloading)
  const knownById = new Map(
    ctx.orgSettings.telematics.known_geofences.map((gf) => [gf.id, gf.role]),
  );
  const updatedStops: RouteStopRecord[] = mergedStops.map((stopItem, idx) => {
    if (stopItem.type === 'stop') return stopItem;
    const explicitRole = stopItem.geofence_id ? knownById.get(stopItem.geofence_id) : undefined;
    const normalizedType: 'loading' | 'unloading' =
      explicitRole === 'loading'
        ? 'loading'
        : explicitRole === 'unloading'
          ? 'unloading'
          : idx === 0
            ? 'loading'
            : 'unloading';
    return stopItem.type === normalizedType ? stopItem : { ...stopItem, type: normalizedType };
  });

  const prevPayload = asRecord(order.raw_parser_payload);
  const visitedPresets = Array.isArray(prevPayload.visited_preset_geofence_ids)
    ? prevPayload.visited_preset_geofence_ids.map(String)
    : [];

  const preset = findMatchingPreset(ctx.orgSettings.telematics.route_presets, cmd.geo.geofenceId);
  if (preset && !visitedPresets.includes(preset.trigger_geofence_id)) {
    visitedPresets.push(preset.trigger_geofence_id);
  }

  const firstStop = updatedStops[0]!;
  const lastStopItem = updatedStops[updatedStops.length - 1]!;
  const isAutoEmergencyOrder = String(order.base_doc_name ?? '').includes('ВЫЕЗД БЕЗ ЗАЯВКИ');
  const loadingAddr = asRecord(order.loading_address_json);
  const hasManualLoading =
    !isAutoEmergencyOrder && Boolean(loadingAddr.raw && String(loadingAddr.raw).trim().length > 0);

  const nextLoading = hasManualLoading
    ? loadingAddr
    : preset?.default_loading_raw
      ? { city: preset.default_loading_city ?? firstStop.city, raw: preset.default_loading_raw }
      : { city: firstStop.city, raw: firstStop.raw_address };

  const hasSecondPoint = updatedStops.length >= 2;
  const nextUnloading =
    hasSecondPoint || lastStopItem.type === 'unloading'
      ? { city: lastStopItem.city, raw: lastStopItem.raw_address }
      : preset?.default_unloading_raw
        ? { city: preset.default_unloading_city ?? '', raw: preset.default_unloading_raw }
        : { city: lastStopItem.city, raw: lastStopItem.raw_address };

  const routeSummary = updatedStops.map((s) => s.name).join(' ➔ ');
  const orderUpdate: Record<string, unknown> = {
    routes_json: updatedStops,
    loading_address_json: nextLoading,
    unloading_address_json: nextUnloading,
    raw_parser_payload: {
      ...prevPayload,
      visited_preset_geofence_ids: visitedPresets,
      has_unloaded: Boolean(prevPayload.has_unloaded) || hasSecondPoint,
      detected_route_summary: routeSummary,
      detected_points_count: updatedStops.length,
    },
    updated_at: new Date().toISOString(),
  };

  if (preset) {
    if (!order.client_id && preset.client_id) orderUpdate.client_id = preset.client_id;
    if (!order.cargo_name && preset.cargo_name) orderUpdate.cargo_name = preset.cargo_name;
    if (!order.price_without_vat && preset.price_without_vat !== undefined) {
      orderUpdate.price_without_vat = preset.price_without_vat;
    }
    if (preset.base_doc_name) orderUpdate.base_doc_name = preset.base_doc_name;
  }

  await ctx.supabase
    .from('orders')
    .update(orderUpdate)
    .eq('id', cmd.orderId)
    .eq('organization_id', ctx.organizationId);

  // Обновляем маршрутный лист в trips.driver_note для любых маршрутов
  const { data: tripRow } = await ctx.supabase
    .from('trips')
    .select('driver_note, started_at, odometer_start')
    .eq('id', cmd.tripId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();

  if (tripRow) {
    const legs = buildRouteLegs(
      updatedStops,
      ctx.orgSettings.telematics.base_geofence.name,
      ctx.orgSettings.branding.timezone,
      tripRow.started_at ? String(tripRow.started_at) : null,
      Number(tripRow.odometer_start ?? 0),
    );
    if (legs.length > 0) {
      const updatedNote = encodeTripRouteSheet(legs, String(tripRow.driver_note ?? ''), true);
      await ctx.supabase
        .from('trips')
        .update({ driver_note: updatedNote, updated_at: new Date().toISOString() })
        .eq('id', cmd.tripId)
        .eq('organization_id', ctx.organizationId);
    }
  }
}

async function executeCloseTripToReview(
  ctx: CommandExecutionContext,
  cmd: Extract<AutopilotCommand, { type: 'CLOSE_TRIP_TO_REVIEW' }>,
): Promise<void> {
  // 1. Атомарный переход заказа in_progress -> pending_review (защита от двойного закрытия)
  const { data: closedOrder } = await ctx.supabase
    .from('orders')
    .update({
      status: 'pending_review',
      actual_loading_departure_at: cmd.arrivalTimeIso,
      updated_at: new Date().toISOString(),
    })
    .eq('id', cmd.orderId)
    .eq('organization_id', ctx.organizationId)
    .eq('status', 'in_progress')
    .select('id, client_id, price_without_vat, raw_parser_payload')
    .maybeSingle();

  if (!closedOrder) {
    // Заказ уже закрыт параллельным запросом — выходим идемпотентно
    return;
  }

  const { data: trip } = await ctx.supabase
    .from('trips')
    .select('id, started_at, odometer_start, admin_note')
    .eq('id', cmd.tripId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();

  if (!trip) return;

  const odoStart = Number(trip.odometer_start ?? cmd.odometerKm);
  let odoEnd = Math.max(odoStart, cmd.odometerKm);
  let distanceKm = Math.max(1, odoEnd - odoStart);
  if (cmd.trackDistanceKm && cmd.trackDistanceKm > distanceKm) {
    distanceKm = Math.round(cmd.trackDistanceKm);
    odoEnd = odoStart + distanceKm;
  }

  const tariffs = ctx.orgSettings.telematics.tariffs;
  const fuelPrice = ctx.orgSettings.finance.diesel_fuel_price_per_liter;
  const diffHours = Math.max(
    1,
    (new Date(cmd.arrivalTimeIso).getTime() - new Date(String(trip.started_at)).getTime()) /
      (1000 * 3600),
  );
  const daysCount =
    distanceKm < tariffs.min_km_for_per_diem ? 0 : Math.max(1, Math.ceil(diffHours / 24));

  const kmPay = distanceKm * tariffs.driver_pay_per_km;
  const perDiemPay = daysCount * tariffs.driver_per_diem;
  const suggestedDriverPay = Math.floor((kmPay + perDiemPay) / 100) * 100;

  const fuelLiters = Number(((distanceKm * tariffs.fuel_rate_per_100km) / 100).toFixed(1));
  const fuelCost = Math.round((fuelLiters * fuelPrice) / 100) * 100;

  const timeoutNote =
    cmd.reason === 'transit_timeout' ? ' [АВТОЗАКРЫТИЕ: превышен лимит транзитного отстоя]' : '';
  const summaryNote = `Пробег: ${distanceKm} км | Подсказка ЗП: ${suggestedDriverPay} ₽ (${kmPay} ₽ + суточные ${perDiemPay} ₽) | Норматив ГСМ: ${fuelLiters} л (~${fuelCost} ₽)${timeoutNote}`;
  const prevAdminNote = trip.admin_note ? `${String(trip.admin_note)}\n` : '';

  // 2. Закрываем рейс в trips: status='completed', lifecycle_status='draft' (попадает на /review)
  await ctx.supabase
    .from('trips')
    .update({
      odometer_end: odoEnd,
      ended_at: cmd.arrivalTimeIso,
      status: 'completed',
      lifecycle_status: 'draft',
      admin_note: `${prevAdminNote}${summaryNote}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', cmd.tripId)
    .eq('organization_id', ctx.organizationId);

  // 3. Сохраняем suggested_driver_pay и снимаем флаги транзита в orders.raw_parser_payload
  const prevPayload = asRecord(closedOrder.raw_parser_payload);
  await ctx.supabase
    .from('orders')
    .update({
      raw_parser_payload: {
        ...prevPayload,
        prevent_salda_auto_finish: false,
        in_salda_transit: false,
        suggested_driver_pay: formatMoneyStr(suggestedDriverPay),
        suggested_fuel_cost: formatMoneyStr(fuelCost),
        suggested_distance_km: distanceKm,
        ...(cmd.reason === 'transit_timeout' ? { closed_by_transit_timeout: true } : {}),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', cmd.orderId)
    .eq('organization_id', ctx.organizationId);

  // 4. Идемпотентный расход ГСМ (детерминированный idempotency_key от trip_id)
  if (fuelCost > 0) {
    const financeIds = resolveOrganizationFinanceIds(ctx.orgSettings);
    const fuelIdemKey = deterministicUuid(`autopilot:fuel:${cmd.tripId}`);
    await ctx.supabase.from('trip_expenses').upsert(
      {
        organization_id: ctx.organizationId,
        trip_id: cmd.tripId,
        category_id: financeIds.fuelCat,
        amount: formatMoneyStr(fuelCost),
        payment_method: 'fuel_card',
        description: `Топливо по нормативу: ${fuelLiters} л (${tariffs.fuel_rate_per_100km}л/100км @ ${fuelPrice}₽/л)`,
        idempotency_key: fuelIdemKey,
      },
      { onConflict: 'idempotency_key', ignoreDuplicates: true },
    );
  }

  // 5. Связка с trip_orders: инвариант ручной ЗП — НИКОГДА не перезаписываем driver_pay > 0,
  //    а для нового автосозданного trip_order оставляем "0.00" (подсказка в admin_note и payload).
  const { data: existingTo } = await ctx.supabase
    .from('trip_orders')
    .select('id, driver_pay, amount')
    .eq('organization_id', ctx.organizationId)
    .eq('trip_id', cmd.tripId)
    .neq('lifecycle_status', 'cancelled')
    .limit(1)
    .maybeSingle();

  if (existingTo) {
    const currentAmount = Number(existingTo.amount ?? 0);
    const orderPrice = Number(closedOrder.price_without_vat ?? 0);
    if (currentAmount === 0 && orderPrice > 0) {
      await ctx.supabase
        .from('trip_orders')
        .update({
          amount: formatMoneyStr(orderPrice),
          counterparty_id: closedOrder.client_id ?? undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingTo.id)
        .eq('organization_id', ctx.organizationId);
    }
  } else {
    const orderPrice = Number(closedOrder.price_without_vat ?? 0);
    const toIdemKey = deterministicUuid(`autopilot:trip_order:${cmd.tripId}`);
    await ctx.supabase.from('trip_orders').upsert(
      {
        organization_id: ctx.organizationId,
        trip_id: cmd.tripId,
        counterparty_id: closedOrder.client_id ?? null,
        description: null,
        amount: formatMoneyStr(orderPrice),
        driver_pay: '0.00',
        payment_method: 'bank_invoice',
        settlement_status: 'pending',
        lifecycle_status: 'draft',
        idempotency_key: toIdemKey,
      },
      { onConflict: 'idempotency_key', ignoreDuplicates: true },
    );
  }

  await syncAssetOdometer(ctx, odoEnd);
}

/**
 * Исполняет одну команду State Machine в БД идемпотентно и строго в контексте organizationId.
 */
export async function executeAutopilotCommand(
  ctx: CommandExecutionContext,
  cmd: AutopilotCommand,
): Promise<{ orderId?: string; tripId?: string }> {
  switch (cmd.type) {
    case 'OPEN_TRIP': {
      const opened = await executeOpenTrip(ctx, cmd);
      return opened ?? {};
    }
    case 'RECORD_STOP': {
      await executeRecordStop(ctx, cmd);
      return { orderId: cmd.orderId, tripId: cmd.tripId };
    }
    case 'ENTER_TRANSIT': {
      const { data: ord } = await ctx.supabase
        .from('orders')
        .select('raw_parser_payload')
        .eq('id', cmd.orderId)
        .eq('organization_id', ctx.organizationId)
        .maybeSingle();
      const prev = asRecord(ord?.raw_parser_payload);
      const count = Number(prev.salda_transit_count ?? 0) + 1;
      await ctx.supabase
        .from('orders')
        .update({
          raw_parser_payload: {
            ...prev,
            in_salda_transit: true,
            prevent_salda_auto_finish: true,
            salda_transit_count: count,
            last_transit_checked_at: Math.floor(Date.now() / 1000),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', cmd.orderId)
        .eq('organization_id', ctx.organizationId);
      await syncAssetOdometer(ctx, cmd.odometerKm);
      return { orderId: cmd.orderId, tripId: cmd.tripId };
    }
    case 'RESUME_FROM_TRANSIT': {
      const { data: ord } = await ctx.supabase
        .from('orders')
        .select('raw_parser_payload')
        .eq('id', cmd.orderId)
        .eq('organization_id', ctx.organizationId)
        .maybeSingle();
      const prev = asRecord(ord?.raw_parser_payload);
      await ctx.supabase
        .from('orders')
        .update({
          raw_parser_payload: {
            ...prev,
            in_salda_transit: false,
            departed_after_transit_at: cmd.timestampIso,
            ...(cmd.exitedWest
              ? {
                  has_departed_west: true,
                  transit_allowed: false,
                  prevent_salda_auto_finish: false,
                  departed_west_at: cmd.timestampIso,
                }
              : {}),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', cmd.orderId)
        .eq('organization_id', ctx.organizationId);
      await syncAssetOdometer(ctx, cmd.odometerKm);
      return { orderId: cmd.orderId, tripId: cmd.tripId };
    }
    case 'CLOSE_TRIP_TO_REVIEW': {
      await executeCloseTripToReview(ctx, cmd);
      return { orderId: cmd.orderId, tripId: cmd.tripId };
    }
  }
}

export type { GeocodedCandidateStop };
