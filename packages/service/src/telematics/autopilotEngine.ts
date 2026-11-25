import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger, type OrganizationSettings } from '@saldacargo/shared';
import {
  applyOdometerCalibration,
  normalizePlate,
  type TelematicsPoint,
  type TelematicsProvider,
  type TelematicsUnitSnapshot,
} from '../providers/telematics/types';
import { createCachedStopGeocoder, type StopGeocoder } from './geocodeCache';
import { detectStopsFromTrack } from './stopDetector';
import {
  evaluateVehicleTelemetry,
  type ActiveTripContext,
  type DiagnosticRecord,
  type GeocodedCandidateStop,
  type TelematicsSource,
  type VehicleState,
  type VehicleStateSnapshot,
} from './stateMachine';
import { executeAutopilotCommand, type RouteStopRecord } from './tripCommands';

export interface AssetForTelematics {
  id: string;
  reg_number: string;
  short_name: string;
  wialon_id: string | null;
  odometer_current: number;
  odometer_offset_km: number;
  assigned_driver_id: string | null;
}

export interface VehicleSyncOutcome {
  assetId: string;
  regNumber: string;
  stateBefore: VehicleState;
  stateAfter: VehicleState;
  commandsExecuted: string[];
  skippedReason?: string;
  error?: string;
}

export interface OrganizationSyncReport {
  organizationId: string;
  checkedCount: number;
  processedCount: number;
  skippedByBudget: number;
  outcomes: VehicleSyncOutcome[];
  durationMs: number;
}

const LEASE_TTL_MS = 60_000;
const DEFAULT_TIME_BUDGET_MS = 45_000;
const DEFAULT_CONCURRENCY = 3;

function asRecord(val: unknown): Record<string, unknown> {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : {};
}

function parseVehicleState(raw: unknown): VehicleState {
  if (raw === 'AT_BASE' || raw === 'EN_ROUTE' || raw === 'AT_STOP' || raw === 'IN_BASE_TRANSIT') {
    return raw;
  }
  return 'AT_BASE';
}

function extractRecordedStopKeys(routesJson: unknown): string[] {
  if (!Array.isArray(routesJson)) return [];
  const keys: string[] = [];
  for (const item of routesJson) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as RouteStopRecord;
    if (typeof rec.stop_key === 'string' && rec.stop_key.length > 0) {
      keys.push(rec.stop_key);
    }
    if (Array.isArray(rec.merged_stop_keys)) {
      for (const mk of rec.merged_stop_keys) {
        if (typeof mk === 'string' && mk.length > 0) keys.push(mk);
      }
    }
  }
  return keys;
}

/**
 * Пытается захватить атомарный lease-lock на машину в `vehicle_telematics_state`.
 * Если запись отсутствует — создаёт её с локом. Если уже залочена другим воркером — возвращает null.
 */
async function acquireVehicleLock(
  supabase: SupabaseClient,
  organizationId: string,
  assetId: string,
  providerId: string,
  externalUnitId: string,
  lockOwner: string,
): Promise<VehicleStateSnapshot | null> {
  const nowIso = new Date().toISOString();
  const lockUntilIso = new Date(Date.now() + LEASE_TTL_MS).toISOString();

  // Сначала пробуем атомарно захватить существующую строку
  const { data: locked } = await supabase
    .from('vehicle_telematics_state')
    .update({
      locked_until: lockUntilIso,
      locked_by: lockOwner,
      external_unit_id: externalUnitId,
      provider: providerId,
    })
    .eq('organization_id', organizationId)
    .eq('asset_id', assetId)
    .or(`locked_until.is.null,locked_until.lt.${nowIso}`)
    .select(
      'state, base_confirm_since, depart_confirm_count, transit_entered_at, last_msg_ts, last_lat, last_lon, last_speed, last_odometer_km',
    )
    .maybeSingle();

  if (locked) {
    return {
      state: parseVehicleState(locked.state),
      baseConfirmSinceIso: locked.base_confirm_since ? String(locked.base_confirm_since) : null,
      departConfirmCount: Number(locked.depart_confirm_count ?? 0),
      transitEnteredAtIso: locked.transit_entered_at ? String(locked.transit_entered_at) : null,
      lastMsgTs: Number(locked.last_msg_ts ?? 0),
      lastLat: locked.last_lat !== null ? Number(locked.last_lat) : null,
      lastLon: locked.last_lon !== null ? Number(locked.last_lon) : null,
      lastSpeed: locked.last_speed !== null ? Number(locked.last_speed) : null,
      lastOdometerKm: locked.last_odometer_km !== null ? Number(locked.last_odometer_km) : null,
    };
  }

  // Строки могло не быть — пробуем вставить (onConflict вернёт ошибку 23505 если строка есть и занята)
  const { data: inserted, error: insertErr } = await supabase
    .from('vehicle_telematics_state')
    .insert({
      organization_id: organizationId,
      asset_id: assetId,
      provider: providerId,
      external_unit_id: externalUnitId,
      state: 'AT_BASE',
      locked_until: lockUntilIso,
      locked_by: lockOwner,
    })
    .select('state')
    .maybeSingle();

  if (insertErr || !inserted) {
    return null; // Занято параллельным процессом
  }

  return {
    state: 'AT_BASE',
    baseConfirmSinceIso: null,
    departConfirmCount: 0,
    transitEnteredAtIso: null,
    lastMsgTs: 0,
    lastLat: null,
    lastLon: null,
    lastSpeed: null,
    lastOdometerKm: null,
  };
}

async function releaseAndSaveVehicleState(
  supabase: SupabaseClient,
  organizationId: string,
  assetId: string,
  lockOwner: string,
  nextState: VehicleStateSnapshot,
): Promise<void> {
  await supabase
    .from('vehicle_telematics_state')
    .update({
      state: nextState.state,
      base_confirm_since: nextState.baseConfirmSinceIso,
      depart_confirm_count: nextState.departConfirmCount,
      transit_entered_at: nextState.transitEnteredAtIso,
      last_msg_ts: nextState.lastMsgTs,
      last_lat: nextState.lastLat,
      last_lon: nextState.lastLon,
      last_speed: nextState.lastSpeed,
      last_odometer_km: nextState.lastOdometerKm,
      locked_until: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', organizationId)
    .eq('asset_id', assetId)
    .eq('locked_by', lockOwner);
}

async function recordDiagnostics(
  supabase: SupabaseClient,
  organizationId: string,
  assetId: string,
  source: TelematicsSource,
  records: readonly DiagnosticRecord[],
  refs?: { orderId?: string | null; tripId?: string | null },
): Promise<void> {
  if (records.length === 0) return;
  const rows = records.map((r) => ({
    organization_id: organizationId,
    asset_id: assetId,
    order_id: refs?.orderId ?? null,
    trip_id: refs?.tripId ?? null,
    source,
    decision: r.decision,
    reason_code: r.reasonCode,
    reason_text: r.reasonText,
    state_before: r.stateBefore,
    state_after: r.stateAfter,
    telemetry_snapshot: r.telemetrySnapshot,
  }));
  await supabase.from('telematics_events').insert(rows);
}

async function loadActiveTripContext(
  supabase: SupabaseClient,
  organizationId: string,
  assetId: string,
): Promise<ActiveTripContext | null> {
  const { data: order } = await supabase
    .from('orders')
    .select(
      'id, active_trip_id, routes_json, raw_parser_payload, trip:trips!orders_active_trip_id_fkey(id, started_at, odometer_start)',
    )
    .eq('organization_id', organizationId)
    .eq('assigned_vehicle_id', assetId)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!order?.id || !order.active_trip_id) return null;
  const tripRaw = Array.isArray(order.trip) ? order.trip[0] : order.trip;
  if (!tripRaw?.id || !tripRaw.started_at) return null;

  const payload = asRecord(order.raw_parser_payload);
  const visitedPresets = Array.isArray(payload.visited_preset_geofence_ids)
    ? payload.visited_preset_geofence_ids.map(String)
    : payload.visited_shaytanka
      ? ['shaytanka']
      : [];

  return {
    orderId: String(order.id),
    tripId: String(tripRaw.id),
    startedAtIso: String(tripRaw.started_at),
    startOdometerKm: Number(tripRaw.odometer_start ?? 0),
    recordedStopKeys: extractRecordedStopKeys(order.routes_json),
    departureDirection:
      payload.departure_direction === 'east' || payload.departure_direction === 'west'
        ? payload.departure_direction
        : null,
    hasDepartedWest: Boolean(payload.has_departed_west),
    hasUnloaded: Boolean(payload.has_unloaded),
    transitAllowed: Boolean(payload.transit_allowed),
    visitedPresetGeofenceIds: visitedPresets,
  };
}

/**
 * Обработка одного автомобиля под lease-lock через State Machine.
 */
export async function processVehicleSnapshot(params: {
  supabase: SupabaseClient;
  organizationId: string;
  orgSettings: OrganizationSettings;
  asset: AssetForTelematics;
  provider: TelematicsProvider;
  snapshot: TelematicsUnitSnapshot;
  source: TelematicsSource;
  geocoder?: StopGeocoder;
  webhookHint?: 'departure' | 'arrival';
  nowMs?: number;
}): Promise<VehicleSyncOutcome> {
  const { supabase, organizationId, orgSettings, asset, provider, snapshot, source, webhookHint } =
    params;
  const nowMs = params.nowMs ?? Date.now();
  const lockOwner = `${source}:${crypto.randomUUID().slice(0, 8)}`;

  const prevState = await acquireVehicleLock(
    supabase,
    organizationId,
    asset.id,
    provider.providerId,
    snapshot.externalUnitId,
    lockOwner,
  );

  if (!prevState) {
    await recordDiagnostics(supabase, organizationId, asset.id, source, [
      {
        decision: 'ignored_duplicate_lock',
        reasonCode: 'LOCKED_BY_CONCURRENT_RUN',
        reasonText: 'Пропущено: машина уже обрабатывается параллельным запросом (cron/webhook)',
        stateBefore: 'AT_BASE',
        stateAfter: 'AT_BASE',
        telemetrySnapshot: { unit_id: snapshot.externalUnitId },
      },
    ]);
    return {
      assetId: asset.id,
      regNumber: asset.reg_number,
      stateBefore: 'AT_BASE',
      stateAfter: 'AT_BASE',
      commandsExecuted: [],
      skippedReason: 'locked_by_concurrent_run',
    };
  }

  let nextState = prevState;
  const commandsExecuted: string[] = [];
  let activeOrderId: string | null = null;
  let activeTripId: string | null = null;

  try {
    const activeTrip = await loadActiveTripContext(supabase, organizationId, asset.id);
    activeOrderId = activeTrip?.orderId ?? null;
    activeTripId = activeTrip?.tripId ?? null;

    // Калиброванный одометр с защитой от скручивания назад
    const rawCalibrated = applyOdometerCalibration(
      snapshot.position?.rawOdometerKm,
      asset.odometer_offset_km,
    );
    const isRelative =
      asset.odometer_current > 0 &&
      rawCalibrated > 0 &&
      rawCalibrated < asset.odometer_current - 1000;
    const calibratedOdo = isRelative
      ? asset.odometer_current
      : Math.max(rawCalibrated, asset.odometer_current);

    // Если есть активный рейс — инкрементально догружаем трек и ищем остановки
    let candidateStops: GeocodedCandidateStop[] = [];
    let trackDistanceKm: number | undefined;
    let trackDepartedWest = false;

    if (activeTrip && snapshot.externalUnitId) {
      const toSec = Math.floor(nowMs / 1000);
      const tripStartSec = Math.floor(new Date(activeTrip.startedAtIso).getTime() / 1000);
      const fromSec = Math.max(tripStartSec - 900, toSec - 6 * 3600);

      const track = await provider.fetchTrack(snapshot.externalUnitId, fromSec, toSec);
      const detected = detectStopsFromTrack(track, orgSettings.telematics, {
        tripId: activeTrip.tripId,
        odometerOffsetKm: asset.odometer_offset_km,
      });

      trackDistanceKm = detected.trackDistanceKm > 0 ? detected.trackDistanceKm : undefined;
      trackDepartedWest = detected.hasDepartedWest;

      if (detected.stops.length > 0) {
        const geocoder =
          params.geocoder ??
          createCachedStopGeocoder(
            supabase,
            organizationId,
            orgSettings.telematics.known_geofences,
          );
        const alreadyRecorded = new Set(activeTrip.recordedStopKeys);
        const externalNewStops = detected.stops.filter(
          (s) => !s.isBase && !alreadyRecorded.has(s.stopKey),
        );
        candidateStops = await Promise.all(
          externalNewStops.map(async (stop) => ({
            stop,
            geo: await geocoder(stop.lat, stop.lon),
          })),
        );
      }
    }

    const evaluation = evaluateVehicleTelemetry({
      source,
      nowMs,
      settings: orgSettings.telematics,
      prevState,
      position: snapshot.position,
      calibratedOdometerKm: calibratedOdo,
      activeTrip,
      candidateStops,
      trackDistanceKm,
      trackDepartedWest,
      webhookHint,
    });

    for (const cmd of evaluation.commands) {
      const refs = await executeAutopilotCommand(
        {
          supabase,
          organizationId,
          assetId: asset.id,
          assignedDriverId: asset.assigned_driver_id,
          currentOdometerKm: asset.odometer_current,
          orgSettings,
        },
        cmd,
      );
      if (refs.orderId) activeOrderId = refs.orderId;
      if (refs.tripId) activeTripId = refs.tripId;
      commandsExecuted.push(cmd.type);
    }

    // Сохраняем nextState только после успешного выполнения всех команд (иначе в finally сохранится prevState)
    nextState = evaluation.nextState;

    await recordDiagnostics(supabase, organizationId, asset.id, source, evaluation.diagnostics, {
      orderId: activeOrderId,
      tripId: activeTripId,
    });

    return {
      assetId: asset.id,
      regNumber: asset.reg_number,
      stateBefore: prevState.state,
      stateAfter: nextState.state,
      commandsExecuted,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Autopilot v2 vehicle sync error', { organizationId, assetId: asset.id }, err);
    await recordDiagnostics(
      supabase,
      organizationId,
      asset.id,
      source,
      [
        {
          decision: 'error',
          reasonCode: 'VEHICLE_SYNC_EXCEPTION',
          reasonText: `Ошибка обработки телематики: ${message.slice(0, 200)}`,
          stateBefore: prevState.state,
          stateAfter: prevState.state,
          telemetrySnapshot: { unit_id: snapshot.externalUnitId },
        },
      ],
      { orderId: activeOrderId, tripId: activeTripId },
    );
    return {
      assetId: asset.id,
      regNumber: asset.reg_number,
      stateBefore: prevState.state,
      stateAfter: prevState.state,
      commandsExecuted,
      error: message,
    };
  } finally {
    await releaseAndSaveVehicleState(supabase, organizationId, asset.id, lockOwner, nextState);
  }
}

/**
 * Сопоставляет актив организации с объектом телематики по wialon_id или госномера.
 */
export function matchAssetToSnapshot(
  asset: AssetForTelematics,
  snapshots: readonly TelematicsUnitSnapshot[],
): TelematicsUnitSnapshot | null {
  if (asset.wialon_id) {
    const byId = snapshots.find((s) => s.externalUnitId === String(asset.wialon_id));
    if (byId) return byId;
  }
  const normReg = normalizePlate(asset.reg_number);
  const normShort = normalizePlate(asset.short_name);
  for (const snap of snapshots) {
    const hint = snap.plateHint ?? normalizePlate(snap.unitName);
    if (!hint) continue;
    if (normReg && (hint === normReg || hint.includes(normReg) || normReg.includes(hint))) {
      return snap;
    }
    if (normShort && normShort.length >= 3 && hint.includes(normShort)) {
      return snap;
    }
  }
  return null;
}

/**
 * Полный цикл синхронизации автопарка организации с контролем бюджета времени и параллелизма.
 */
export async function syncOrganizationTelematics(params: {
  supabase: SupabaseClient;
  organizationId: string;
  orgSettings: OrganizationSettings;
  provider: TelematicsProvider;
  source?: TelematicsSource;
  timeBudgetMs?: number;
  concurrency?: number;
}): Promise<OrganizationSyncReport> {
  const startedAt = Date.now();
  const timeBudgetMs = params.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const concurrency = Math.max(1, params.concurrency ?? DEFAULT_CONCURRENCY);
  const source = params.source ?? 'cron';

  const { data: assetsRaw } = await params.supabase
    .from('assets')
    .select(
      'id, reg_number, short_name, wialon_id, odometer_current, odometer_offset_km, assigned_driver_id',
    )
    .eq('organization_id', params.organizationId)
    .eq('status', 'active');

  const assets = (assetsRaw ?? []) as AssetForTelematics[];
  if (assets.length === 0) {
    return {
      organizationId: params.organizationId,
      checkedCount: 0,
      processedCount: 0,
      skippedByBudget: 0,
      outcomes: [],
      durationMs: Date.now() - startedAt,
    };
  }

  const snapshots = await params.provider.fetchUnitsSnapshot();
  const geocoder = createCachedStopGeocoder(
    params.supabase,
    params.organizationId,
    params.orgSettings.telematics.known_geofences,
  );

  const pairs: Array<{ asset: AssetForTelematics; snapshot: TelematicsUnitSnapshot }> = [];
  for (const asset of assets) {
    const snap = matchAssetToSnapshot(asset, snapshots);
    if (snap) pairs.push({ asset, snapshot: snap });
  }

  const outcomes: VehicleSyncOutcome[] = [];
  let skippedByBudget = 0;

  for (let i = 0; i < pairs.length; i += concurrency) {
    if (Date.now() - startedAt >= timeBudgetMs) {
      skippedByBudget = pairs.length - i;
      break;
    }
    const batch = pairs.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map(({ asset, snapshot }) =>
        processVehicleSnapshot({
          supabase: params.supabase,
          organizationId: params.organizationId,
          orgSettings: params.orgSettings,
          asset,
          provider: params.provider,
          snapshot,
          source,
          geocoder,
        }),
      ),
    );
    for (const item of settled) {
      if (item.status === 'fulfilled') {
        outcomes.push(item.value);
      }
    }
  }

  return {
    organizationId: params.organizationId,
    checkedCount: pairs.length,
    processedCount: outcomes.length,
    skippedByBudget,
    outcomes,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Вспомогательный синтетический snapshot для вебхука, если провайдер не передал координаты.
 */
export function buildWebhookSnapshot(params: {
  externalUnitId: string;
  unitName: string;
  lat: number;
  lon: number;
  speedKmh?: number;
  timestampSec: number;
  rawOdometerKm?: number;
}): TelematicsUnitSnapshot {
  const pos: TelematicsPoint = {
    lat: params.lat,
    lon: params.lon,
    speedKmh: params.speedKmh ?? 0,
    timestampSec: params.timestampSec,
    rawOdometerKm: params.rawOdometerKm,
  };
  return {
    externalUnitId: params.externalUnitId,
    unitName: params.unitName,
    plateHint: normalizePlate(params.unitName),
    position: pos,
    isOnline: true,
  };
}
