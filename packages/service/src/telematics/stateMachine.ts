import type { OrganizationTelematicsSettings } from '@saldacargo/shared';
import { calculateDistanceMeters, type TelematicsPoint } from '../providers/telematics/types';
import type { GeocodedStopInfo } from './geocodeCache';
import type { DetectedStop } from './stopDetector';

export type VehicleState = 'AT_BASE' | 'EN_ROUTE' | 'AT_STOP' | 'IN_BASE_TRANSIT';

export type TelematicsSource = 'cron' | 'webhook' | 'manual';

export type TelematicsDecision =
  | 'trip_opened'
  | 'stop_recorded'
  | 'stop_ignored'
  | 'transit_entered'
  | 'transit_resumed'
  | 'trip_closed_to_review'
  | 'ignored_gps_noise'
  | 'ignored_gps_stale'
  | 'ignored_duplicate_lock'
  | 'error';

export interface VehicleStateSnapshot {
  state: VehicleState;
  baseConfirmSinceIso: string | null;
  departConfirmCount: number;
  transitEnteredAtIso: string | null;
  lastMsgTs: number;
  lastLat: number | null;
  lastLon: number | null;
  lastSpeed: number | null;
  lastOdometerKm: number | null;
}

export interface ActiveTripContext {
  orderId: string;
  tripId: string;
  startedAtIso: string;
  startOdometerKm: number;
  recordedStopKeys: readonly string[];
  departureDirection: 'east' | 'west' | null;
  hasDepartedWest: boolean;
  hasUnloaded: boolean;
  transitAllowed: boolean;
  visitedPresetGeofenceIds: readonly string[];
}

export interface GeocodedCandidateStop {
  stop: DetectedStop;
  geo: GeocodedStopInfo;
}

export interface StateMachineInput {
  source: TelematicsSource;
  nowMs: number;
  settings: OrganizationTelematicsSettings;
  prevState: VehicleStateSnapshot;
  position: TelematicsPoint | null;
  calibratedOdometerKm: number;
  activeTrip: ActiveTripContext | null;
  /** Новые кандидаты-остановки из детектора (уже геокодированные) */
  candidateStops?: readonly GeocodedCandidateStop[];
  /** Общий пробег по треку текущего рейса (если считался) */
  trackDistanceKm?: number;
  /** Вышла ли машина на запад (по треку) */
  trackDepartedWest?: boolean;
  /** Фактический момент последнего въезда в геозону базы по GPS-треку (unix sec) */
  trackBaseEntryTs?: number;
  /** Калиброванный одометр на момент въезда в геозону базы по треку */
  trackBaseEntryOdometerKm?: number;
  /** Явная подсказка от вебхука (если источник = webhook) */
  webhookHint?: 'departure' | 'arrival';
}

export type AutopilotCommand =
  | {
      type: 'OPEN_TRIP';
      departureTimeIso: string;
      odometerKm: number;
      lat: number;
      lon: number;
      direction: 'east' | 'west';
      transitAllowed: boolean;
    }
  | {
      type: 'RECORD_STOP';
      orderId: string;
      tripId: string;
      stop: DetectedStop;
      geo: GeocodedStopInfo;
    }
  | {
      type: 'ENTER_TRANSIT';
      orderId: string;
      tripId: string;
      timestampIso: string;
      odometerKm: number;
    }
  | {
      type: 'RESUME_FROM_TRANSIT';
      orderId: string;
      tripId: string;
      timestampIso: string;
      odometerKm: number;
      exitedWest: boolean;
    }
  | {
      type: 'CLOSE_TRIP_TO_REVIEW';
      orderId: string;
      tripId: string;
      arrivalTimeIso: string;
      odometerKm: number;
      trackDistanceKm?: number;
      reason: 'normal_arrival' | 'transit_timeout';
    };

export interface DiagnosticRecord {
  decision: TelematicsDecision;
  reasonCode: string;
  reasonText: string;
  stateBefore: VehicleState;
  stateAfter: VehicleState;
  telemetrySnapshot: Record<string, unknown>;
}

export interface StateMachineOutput {
  nextState: VehicleStateSnapshot;
  commands: AutopilotCommand[];
  diagnostics: DiagnosticRecord[];
}

const MIN_WEBHOOK_DEPARTURE_DIST_M = 3000;

function isValidPoint(pt: TelematicsPoint | null): pt is TelematicsPoint {
  if (!pt) return false;
  if (!Number.isFinite(pt.lat) || !Number.isFinite(pt.lon)) return false;
  if (pt.lat === 0 && pt.lon === 0) return false;
  return Math.abs(pt.lat) <= 90 && Math.abs(pt.lon) <= 180 && pt.timestampSec > 0;
}

/**
 * Чистый, детерминированный конечный автомат Автопилота v2.
 * Не имеет side-effects, полностью тестируется на синтетических и реальных GPS-треках.
 */
export function evaluateVehicleTelemetry(input: StateMachineInput): StateMachineOutput {
  const { settings, prevState, position, activeTrip, nowMs, source } = input;
  const { base_geofence: base, thresholds, transit_rules: transit } = settings;

  const commands: AutopilotCommand[] = [];
  const diagnostics: DiagnosticRecord[] = [];
  const nextState: VehicleStateSnapshot = { ...prevState };
  const nowIso = new Date(nowMs).toISOString();

  // 1. Валидация координат (защита от 0,0 и битого GPS)
  if (!isValidPoint(position)) {
    diagnostics.push({
      decision: 'ignored_gps_noise',
      reasonCode: 'GPS_ZERO_OR_INVALID_COORDS',
      reasonText: 'Невалидные или нулевые GPS-координаты — состояние сохранено без изменений',
      stateBefore: prevState.state,
      stateAfter: prevState.state,
      telemetrySnapshot: { position: position ?? null },
    });
    return { nextState, commands, diagnostics };
  }

  // 2. Проверка актуальности пакета GPS (stale check)
  const msgAgeSec = Math.max(0, Math.floor(nowMs / 1000) - position.timestampSec);
  const maxAgeSec = thresholds.max_gps_age_min * 60;
  if (source !== 'webhook' && msgAgeSec > maxAgeSec) {
    diagnostics.push({
      decision: 'ignored_gps_stale',
      reasonCode: 'GPS_DATA_STALE',
      reasonText: `Последний пакет GPS устарел (${Math.round(msgAgeSec / 60)} мин > ${thresholds.max_gps_age_min} мин)`,
      stateBefore: prevState.state,
      stateAfter: prevState.state,
      telemetrySnapshot: {
        lat: position.lat,
        lon: position.lon,
        speed: position.speedKmh,
        msg_age_sec: msgAgeSec,
      },
    });
    return { nextState, commands, diagnostics };
  }

  const distBaseM = calculateDistanceMeters(position.lat, position.lon, base.lat, base.lon);
  const distBaseKm = Number((distBaseM / 1000).toFixed(2));
  const insideBase = distBaseM <= base.radius_m;
  const beyondDepartureHysteresis = distBaseM >= base.radius_m + base.departure_hysteresis_m;

  const baseSnapshot = {
    lat: position.lat,
    lon: position.lon,
    speed: position.speedKmh,
    dist_base_km: distBaseKm,
    odometer_km: input.calibratedOdometerKm,
    msg_age_sec: msgAgeSec,
  };

  nextState.lastLat = position.lat;
  nextState.lastLon = position.lon;
  nextState.lastSpeed = position.speedKmh;
  nextState.lastOdometerKm = input.calibratedOdometerKm;
  nextState.lastMsgTs = Math.max(prevState.lastMsgTs, position.timestampSec);

  const westThreshold = transit.west_exit_lon_threshold;
  const eastThreshold = transit.east_departure_lon_threshold;
  const isCurrentlyWest = westThreshold !== undefined && position.lon < westThreshold;
  const departureDirection: 'east' | 'west' =
    eastThreshold !== undefined ? (position.lon > eastThreshold ? 'east' : 'west') : 'west';

  // 3. Обработка остановок для активного рейса (до проверки возврата, чтобы не потерять последнюю выгрузку)
  const recordedKeys = new Set(activeTrip?.recordedStopKeys ?? []);
  let newlyRecordedExternalStops = 0;

  if (activeTrip && input.candidateStops && input.candidateStops.length > 0) {
    for (const cand of input.candidateStops) {
      const { stop, geo } = cand;
      if (stop.isBase) continue;
      if (recordedKeys.has(stop.stopKey)) continue;

      if (!geo.isKnown && geo.isServiceOrRestStop) {
        diagnostics.push({
          decision: 'stop_ignored',
          reasonCode: 'STOP_IS_SERVICE_OR_FUEL',
          reasonText: `Проигнорирована техстоянка (${geo.name}, ${stop.durationMin} мин — АЗС/кафе/отдых)`,
          stateBefore: prevState.state,
          stateAfter: prevState.state,
          telemetrySnapshot: {
            ...baseSnapshot,
            stop_lat: stop.lat,
            stop_lon: stop.lon,
            stop_dur_min: stop.durationMin,
            stop_name: geo.name,
          },
        });
        continue;
      }

      const requiredMin = geo.isKnown
        ? thresholds.stop_min_duration_known_min
        : thresholds.stop_min_duration_unknown_min;

      if (stop.durationMin < requiredMin) {
        diagnostics.push({
          decision: 'stop_ignored',
          reasonCode: 'STOP_BELOW_MIN_DURATION',
          reasonText: `Стоянка ${geo.name} (${stop.durationMin} мин) короче порога ${requiredMin} мин`,
          stateBefore: prevState.state,
          stateAfter: prevState.state,
          telemetrySnapshot: {
            ...baseSnapshot,
            stop_lat: stop.lat,
            stop_lon: stop.lon,
            stop_dur_min: stop.durationMin,
            required_min: requiredMin,
          },
        });
        continue;
      }

      recordedKeys.add(stop.stopKey);
      newlyRecordedExternalStops += 1;
      commands.push({
        type: 'RECORD_STOP',
        orderId: activeTrip.orderId,
        tripId: activeTrip.tripId,
        stop,
        geo,
      });
      diagnostics.push({
        decision: 'stop_recorded',
        reasonCode: geo.isKnown ? 'STOP_KNOWN_GEOFENCE' : 'STOP_EXTERNAL_CONFIRMED',
        reasonText: `Записана точка маршрута: ${geo.name} (${stop.durationMin} мин${stop.hadSignalGap ? ', с провалом GPS в ангаре' : ''})`,
        stateBefore: prevState.state,
        stateAfter: insideBase ? prevState.state : 'AT_STOP',
        telemetrySnapshot: {
          ...baseSnapshot,
          stop_key: stop.stopKey,
          stop_name: geo.name,
          stop_dur_min: stop.durationMin,
          had_signal_gap: stop.hadSignalGap,
        },
      });
    }
  }

  // 4. СЦЕНАРИЙ A: Машина ВНЕ геозоны базы (либо пришёл явный вебхук выезда за пределами 3 км от базы)
  const isWebhookDepartureOutsideGarage =
    !activeTrip && input.webhookHint === 'departure' && distBaseM >= MIN_WEBHOOK_DEPARTURE_DIST_M;

  if (!insideBase || isWebhookDepartureOutsideGarage) {
    nextState.baseConfirmSinceIso = null;

    // A1. Выход из транзита (уже есть активный рейс)
    if (activeTrip && prevState.state === 'IN_BASE_TRANSIT') {
      const exitedWest = isCurrentlyWest || Boolean(input.trackDepartedWest);
      nextState.state = 'EN_ROUTE';
      nextState.transitEnteredAtIso = null;
      nextState.departConfirmCount = 0;

      commands.push({
        type: 'RESUME_FROM_TRANSIT',
        orderId: activeTrip.orderId,
        tripId: activeTrip.tripId,
        timestampIso: nowIso,
        odometerKm: input.calibratedOdometerKm,
        exitedWest,
      });
      diagnostics.push({
        decision: 'transit_resumed',
        reasonCode: exitedWest ? 'TRANSIT_RESUMED_WEST' : 'TRANSIT_RESUMED_EAST',
        reasonText: exitedWest
          ? `Выезд из базы на трассу (запад): транзит завершён, рейс продолжается`
          : `Выезд из базы после транзита (${distBaseKm} км от базы)`,
        stateBefore: prevState.state,
        stateAfter: 'EN_ROUTE',
        telemetrySnapshot: baseSnapshot,
      });
      return { nextState, commands, diagnostics };
    }

    // A2. Активный рейс уже идёт → обновляем состояние (EN_ROUTE / AT_STOP)
    if (activeTrip) {
      nextState.departConfirmCount = 0;
      nextState.state =
        position.speedKmh <= thresholds.stop_max_speed_kmh && newlyRecordedExternalStops > 0
          ? 'AT_STOP'
          : 'EN_ROUTE';
      if (source === 'webhook' && input.webhookHint === 'arrival') {
        diagnostics.push({
          decision: 'ignored_gps_noise',
          reasonCode: 'webhook_ignored',
          reasonText: `Вебхук прибытия отклонён: машина вне геозоны базы (${Math.round(distBaseM)} м > ${base.radius_m} м)`,
          stateBefore: prevState.state,
          stateAfter: nextState.state,
          telemetrySnapshot: {
            ...baseSnapshot,
            dist_base_m: Math.round(distBaseM),
            webhook_hint: input.webhookHint,
          },
        });
      }
      return { nextState, commands, diagnostics };
    }

    // A3. Активного рейса НЕТ → проверяем подтверждение выезда (гистерезис + self-healing)
    const isMoving = position.speedKmh >= thresholds.min_moving_speed_kmh;
    const isWebhookDeparture = input.webhookHint === 'departure';
    const nextConfirmCount = prevState.departConfirmCount + 1;

    const confirmedDeparture =
      isWebhookDeparture || beyondDepartureHysteresis || (nextConfirmCount >= 2 && isMoving);

    if (!confirmedDeparture) {
      nextState.departConfirmCount = nextConfirmCount;
      diagnostics.push({
        decision: 'ignored_gps_noise',
        reasonCode: 'HYSTERESIS_NOT_CROSSED',
        reasonText: `Выезд не подтверждён: ${distBaseKm} км от базы (порог ${((base.radius_m + base.departure_hysteresis_m) / 1000).toFixed(1)} км, подтверждений: ${nextConfirmCount}/2)`,
        stateBefore: prevState.state,
        stateAfter: prevState.state,
        telemetrySnapshot: baseSnapshot,
      });
      return { nextState, commands, diagnostics };
    }

    const transitAllowed = transit.enabled && departureDirection === 'east';
    nextState.state = 'EN_ROUTE';
    nextState.departConfirmCount = 0;
    nextState.transitEnteredAtIso = null;

    commands.push({
      type: 'OPEN_TRIP',
      departureTimeIso: new Date(position.timestampSec * 1000).toISOString(),
      odometerKm: input.calibratedOdometerKm,
      lat: position.lat,
      lon: position.lon,
      direction: departureDirection,
      transitAllowed,
    });
    diagnostics.push({
      decision: 'trip_opened',
      reasonCode: prevState.state === 'EN_ROUTE' ? 'DEPARTURE_SELF_HEALED' : 'DEPARTURE_CONFIRMED',
      reasonText: `Открыт рейс: выезд за пределы базы (${distBaseKm} км, направление: ${departureDirection})`,
      stateBefore: prevState.state,
      stateAfter: 'EN_ROUTE',
      telemetrySnapshot: {
        ...baseSnapshot,
        direction: departureDirection,
        transit_allowed: transitAllowed,
      },
    });
    return { nextState, commands, diagnostics };
  }

  // 5. СЦЕНАРИЙ B: Машина ВНУТРИ геозоны базы
  nextState.departConfirmCount = 0;

  if (!activeTrip) {
    nextState.state = 'AT_BASE';
    nextState.baseConfirmSinceIso = null;
    nextState.transitEnteredAtIso = null;
    if (source === 'webhook' && input.webhookHint) {
      diagnostics.push({
        decision: 'ignored_gps_noise',
        reasonCode: 'webhook_ignored',
        reasonText:
          input.webhookHint === 'departure'
            ? `Вебхук выезда отклонён: машина слишком близко к базе (${Math.round(distBaseM)} м < ${MIN_WEBHOOK_DEPARTURE_DIST_M} м)`
            : `Вебхук прибытия отклонён: нет активного рейса (${Math.round(distBaseM)} м от базы)`,
        stateBefore: prevState.state,
        stateAfter: 'AT_BASE',
        telemetrySnapshot: {
          ...baseSnapshot,
          dist_base_m: Math.round(distBaseM),
          webhook_hint: input.webhookHint,
        },
      });
    }
    return { nextState, commands, diagnostics };
  }

  // Вычисляем пробег текущего рейса
  const odoMileageKm = Math.max(0, input.calibratedOdometerKm - activeTrip.startOdometerKm);
  const effectiveTripKm = Math.max(odoMileageKm, input.trackDistanceKm ?? 0);

  // Проверка условий транзита (например, ночёвка на базе после погрузки на Шайтанке)
  const hasDepartedWest =
    activeTrip.hasDepartedWest ||
    Boolean(input.trackDepartedWest) ||
    activeTrip.departureDirection === 'west';
  const hasUnloaded =
    activeTrip.hasUnloaded ||
    recordedKeys.size >= 2 ||
    (activeTrip.visitedPresetGeofenceIds.length > 0 &&
      newlyRecordedExternalStops > 0 &&
      recordedKeys.size >= 2);

  const transitEligible =
    transit.enabled &&
    !hasDepartedWest &&
    !hasUnloaded &&
    (activeTrip.transitAllowed ||
      activeTrip.departureDirection === 'east' ||
      activeTrip.visitedPresetGeofenceIds.length > 0);

  if (transitEligible) {
    const enteredAtIso = prevState.transitEnteredAtIso ?? nowIso;
    const transitHours = (nowMs - new Date(enteredAtIso).getTime()) / (1000 * 3600);

    if (transitHours < transit.max_transit_hours) {
      nextState.state = 'IN_BASE_TRANSIT';
      nextState.transitEnteredAtIso = enteredAtIso;
      nextState.baseConfirmSinceIso = null;

      if (prevState.state !== 'IN_BASE_TRANSIT') {
        commands.push({
          type: 'ENTER_TRANSIT',
          orderId: activeTrip.orderId,
          tripId: activeTrip.tripId,
          timestampIso: nowIso,
          odometerKm: input.calibratedOdometerKm,
        });
        diagnostics.push({
          decision: 'transit_entered',
          reasonCode: 'TRANSIT_WAIT_UNLOAD',
          reasonText: `Транзитный заезд на базу (отстой перед выгрузкой, лимит ${transit.max_transit_hours} ч)`,
          stateBefore: prevState.state,
          stateAfter: 'IN_BASE_TRANSIT',
          telemetrySnapshot: { ...baseSnapshot, transit_hours: Number(transitHours.toFixed(1)) },
        });
      }
      return { nextState, commands, diagnostics };
    }

    // Превышен лимит транзита (36ч) — принудительно переводим на ревью
    nextState.state = 'AT_BASE';
    nextState.transitEnteredAtIso = null;
    nextState.baseConfirmSinceIso = null;

    commands.push({
      type: 'CLOSE_TRIP_TO_REVIEW',
      orderId: activeTrip.orderId,
      tripId: activeTrip.tripId,
      arrivalTimeIso: nowIso,
      odometerKm: input.calibratedOdometerKm,
      trackDistanceKm: effectiveTripKm > 0 ? effectiveTripKm : undefined,
      reason: 'transit_timeout',
    });
    diagnostics.push({
      decision: 'trip_closed_to_review',
      reasonCode: 'TRANSIT_TIMEOUT_CLOSE',
      reasonText: `Рейс переведён в ревью: превышен лимит транзитного отстоя (${Math.round(transitHours)} ч ≥ ${transit.max_transit_hours} ч)`,
      stateBefore: prevState.state,
      stateAfter: 'AT_BASE',
      telemetrySnapshot: {
        ...baseSnapshot,
        transit_hours: Number(transitHours.toFixed(1)),
        trip_km: effectiveTripKm,
      },
    });
    return { nextState, commands, diagnostics };
  }

  // Подтверждение возврата на базу (anti-bounce + self-healing)
  const confirmSinceIso = prevState.baseConfirmSinceIso ?? nowIso;
  const insideBaseMinutes = (nowMs - new Date(confirmSinceIso).getTime()) / (1000 * 60);
  const isWebhookArrival = input.webhookHint === 'arrival';
  const confirmedArrival =
    isWebhookArrival ||
    insideBaseMinutes >= thresholds.arrival_confirm_min ||
    (effectiveTripKm >= thresholds.min_trip_distance_km &&
      position.speedKmh <= thresholds.stop_max_speed_kmh &&
      prevState.baseConfirmSinceIso !== null);

  if (!confirmedArrival) {
    nextState.baseConfirmSinceIso = confirmSinceIso;
    diagnostics.push({
      decision: 'ignored_gps_noise',
      reasonCode: 'ARRIVAL_AWAITING_CONFIRM',
      reasonText: `Машина в базе (${distBaseKm} км), ожидание подтверждения возврата (${insideBaseMinutes.toFixed(1)}/${thresholds.arrival_confirm_min} мин)`,
      stateBefore: prevState.state,
      stateAfter: prevState.state,
      telemetrySnapshot: { ...baseSnapshot, inside_base_min: Number(insideBaseMinutes.toFixed(1)) },
    });
    return { nextState, commands, diagnostics };
  }

  nextState.state = 'AT_BASE';
  nextState.baseConfirmSinceIso = null;
  nextState.transitEnteredAtIso = null;

  const tripStartSec = Math.floor(new Date(activeTrip.startedAtIso).getTime() / 1000);
  const nowSec = Math.floor(nowMs / 1000);
  const validTrackEntryIso =
    input.trackBaseEntryTs !== undefined &&
    input.trackBaseEntryTs >= tripStartSec &&
    input.trackBaseEntryTs <= nowSec + 60
      ? new Date(input.trackBaseEntryTs * 1000).toISOString()
      : null;
  const webhookArrivalIso =
    isWebhookArrival &&
    position.timestampSec >= tripStartSec &&
    position.timestampSec <= nowSec + 60
      ? new Date(position.timestampSec * 1000).toISOString()
      : null;

  const resolvedArrivalIso =
    validTrackEntryIso ?? prevState.baseConfirmSinceIso ?? webhookArrivalIso ?? nowIso;
  const resolvedArrivalOdo = Math.max(
    input.calibratedOdometerKm,
    input.trackBaseEntryOdometerKm ?? 0,
  );

  commands.push({
    type: 'CLOSE_TRIP_TO_REVIEW',
    orderId: activeTrip.orderId,
    tripId: activeTrip.tripId,
    arrivalTimeIso: resolvedArrivalIso,
    odometerKm: resolvedArrivalOdo,
    trackDistanceKm: effectiveTripKm > 0 ? effectiveTripKm : undefined,
    reason: 'normal_arrival',
  });
  diagnostics.push({
    decision: 'trip_closed_to_review',
    reasonCode: prevState.state === 'AT_BASE' ? 'ARRIVAL_SELF_HEALED' : 'ARRIVAL_CONFIRMED',
    reasonText: `Рейс закрыт и переведён на ревью: возврат на базу (пробег ${effectiveTripKm} км)`,
    stateBefore: prevState.state,
    stateAfter: 'AT_BASE',
    telemetrySnapshot: { ...baseSnapshot, trip_km: effectiveTripKm },
  });

  return { nextState, commands, diagnostics };
}
