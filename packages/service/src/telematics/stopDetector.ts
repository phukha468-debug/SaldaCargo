import type { OrganizationTelematicsSettings } from '@saldacargo/shared';
import {
  applyOdometerCalibration,
  calculateDistanceMeters,
  type TelematicsPoint,
} from '../providers/telematics/types';

export interface DetectedStop {
  /** Детерминированный ключ стоянки для идемпотентной записи без дублей */
  stopKey: string;
  lat: number;
  lon: number;
  startTs: number;
  endTs: number;
  durationMin: number;
  isBase: boolean;
  distFromBaseKm: number;
  odometerKm: number;
  /** Была ли стоянка подтверждена через разрыв GPS в тех же координатах (ангар/сон трекера) */
  hadSignalGap: boolean;
}

export interface StopDetectionResult {
  stops: DetectedStop[];
  startOdometerKm: number | null;
  endOdometerKm: number | null;
  trackDistanceKm: number;
  hasDepartedWest: boolean;
  /** Unix-секунды последнего фактического въезда в геозону базы (после выезда из неё) */
  lastBaseEntryTs: number | null;
  /** Калиброванный одометр на момент последнего въезда в геозону базы */
  lastBaseEntryOdometerKm: number | null;
}

interface StopCluster {
  anchorLat: number;
  anchorLon: number;
  sumLat: number;
  sumLon: number;
  sampleCount: number;
  startTs: number;
  endTs: number;
  odometerKm: number;
  consecutiveSpikes: number;
  hadSignalGap: boolean;
}

/**
 * Детерминированный ключ стоянки: округление координат до ~111м и старта до 30-минутного окна.
 * Повторный прогон по тому же треку всегда генерирует идентичный ключ.
 */
export function buildStopKey(tripId: string, lat: number, lon: number, startTs: number): string {
  const latGrid = Math.round(lat * 1000);
  const lonGrid = Math.round(lon * 1000);
  const timeBucket = Math.floor(startTs / 1800);
  return `${tripId}:${latGrid}:${lonGrid}:${timeBucket}`;
}

/**
 * Устойчивый детектор остановок по GPS-треку:
 * - Пространственный кластер (радиус stop_cluster_radius_m) защищает от пробок и GPS-дрейфа.
 * - Терпимость к одиночным всплескам скорости (noise_speed_spike_limit) внутри кластера.
 * - Обработка потери GPS в ангаре / сна трекера: разрыв между точками в пределах кластера
 *   засчитывается в длительность стоянки; разрыв со смещением > кластера считается движением.
 */
export function detectStopsFromTrack(
  points: readonly TelematicsPoint[],
  settings: OrganizationTelematicsSettings,
  options: {
    tripId: string;
    odometerOffsetKm?: number;
  },
): StopDetectionResult {
  if (points.length === 0) {
    return {
      stops: [],
      startOdometerKm: null,
      endOdometerKm: null,
      trackDistanceKm: 0,
      hasDepartedWest: false,
      lastBaseEntryTs: null,
      lastBaseEntryOdometerKm: null,
    };
  }

  // Сортируем по времени и отбрасываем невалидные координаты
  const sorted = [...points]
    .filter(
      (p) =>
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lon) &&
        !(p.lat === 0 && p.lon === 0) &&
        p.timestampSec > 0,
    )
    .sort((a, b) => a.timestampSec - b.timestampSec);

  if (sorted.length === 0) {
    return {
      stops: [],
      startOdometerKm: null,
      endOdometerKm: null,
      trackDistanceKm: 0,
      hasDepartedWest: false,
      lastBaseEntryTs: null,
      lastBaseEntryOdometerKm: null,
    };
  }

  const { base_geofence: base, thresholds, transit_rules: transit } = settings;
  const clusterRadiusM = thresholds.stop_cluster_radius_m;
  const stopMaxSpeed = thresholds.stop_max_speed_kmh;
  const spikeLimit = thresholds.noise_speed_spike_limit;
  const minStopMin = Math.min(
    thresholds.stop_min_duration_known_min,
    thresholds.stop_min_duration_unknown_min,
  );
  const offsetKm = options.odometerOffsetKm ?? 0;
  const westThreshold = transit.west_exit_lon_threshold;
  const MAX_MICRO_SPLIT_GAP_SEC = 300; // до 5 мин манёвра у пандуса / шума GPS внутри одного объекта

  let startOdometerKm: number | null = null;
  let endOdometerKm: number | null = null;
  let totalDistMeters = 0;
  let hasDepartedWest = false;
  let hasExitedBase = false;
  let prevInsideBase = true;
  let lastBaseEntryTs: number | null = null;
  let lastBaseEntryOdometerKm: number | null = null;
  let prevPoint: TelematicsPoint | null = null;

  const candidateClusters: StopCluster[] = [];
  let active: StopCluster | null = null;

  const finalizeCluster = (cluster: StopCluster | null) => {
    if (!cluster) return;
    if (cluster.endTs > cluster.startTs) {
      candidateClusters.push(cluster);
    }
  };

  for (const pt of sorted) {
    if (westThreshold !== undefined && pt.lon < westThreshold) {
      hasDepartedWest = true;
    }

    const calOdo = applyOdometerCalibration(pt.rawOdometerKm, offsetKm);
    if (calOdo > 0) {
      if (startOdometerKm === null) startOdometerKm = calOdo;
      endOdometerKm = calOdo;
    }

    const distToBaseM = calculateDistanceMeters(pt.lat, pt.lon, base.lat, base.lon);
    const ptInsideBase = distToBaseM <= base.radius_m;
    if (!ptInsideBase) {
      hasExitedBase = true;
      lastBaseEntryTs = null;
      lastBaseEntryOdometerKm = null;
    } else if (hasExitedBase && !prevInsideBase) {
      lastBaseEntryTs = pt.timestampSec;
      lastBaseEntryOdometerKm = calOdo > 0 ? calOdo : endOdometerKm;
    }
    prevInsideBase = ptInsideBase;

    if (prevPoint) {
      const segDist = calculateDistanceMeters(prevPoint.lat, prevPoint.lon, pt.lat, pt.lon);
      // Отсекаем явные GPS-телепорты (> 50 км за < 60 сек)
      const dt = Math.max(1, pt.timestampSec - prevPoint.timestampSec);
      const impliedKmh = (segDist / dt) * 3.6;
      if (impliedKmh <= 220) {
        totalDistMeters += segDist;
      }
    }

    const isSlow = pt.speedKmh <= stopMaxSpeed;

    if (!active) {
      if (isSlow) {
        active = {
          anchorLat: pt.lat,
          anchorLon: pt.lon,
          sumLat: pt.lat,
          sumLon: pt.lon,
          sampleCount: 1,
          startTs: pt.timestampSec,
          endTs: pt.timestampSec,
          odometerKm: calOdo,
          consecutiveSpikes: 0,
          hadSignalGap: false,
        };
      }
      prevPoint = pt;
      continue;
    }

    const distFromAnchor = calculateDistanceMeters(
      active.anchorLat,
      active.anchorLon,
      pt.lat,
      pt.lon,
    );
    const gapSec = pt.timestampSec - active.endTs;

    if (distFromAnchor <= clusterRadiusM) {
      if (isSlow) {
        // Машина осталась в том же кластере и стоит (в том числе после провала GPS в ангаре)
        active.endTs = pt.timestampSec;
        active.sumLat += pt.lat;
        active.sumLon += pt.lon;
        active.sampleCount += 1;
        active.consecutiveSpikes = 0;
        if (calOdo > 0) active.odometerKm = calOdo;
        if (gapSec >= 300) active.hadSignalGap = true;
      } else {
        // Машина внутри кластера, но скорость выше порога:
        // 1) если был длительный разрыв (ангар/сон трекера) и точка всё ещё в кластере —
        //    засчитываем время до момента трогания, затем закрываем стоянку.
        if (gapSec >= 300) {
          active.endTs = pt.timestampSec;
          active.hadSignalGap = true;
          finalizeCluster(active);
          active = null;
        } else {
          // 2) Одиночный GPS-всплеск скорости (дрейф под навесом)
          active.consecutiveSpikes += 1;
          if (active.consecutiveSpikes <= spikeLimit) {
            active.endTs = pt.timestampSec;
          } else {
            finalizeCluster(active);
            active = null;
          }
        }
      }
    } else {
      // Машина вышла за пределы кластера (движение или ползущая пробка)
      finalizeCluster(active);
      active = isSlow
        ? {
            anchorLat: pt.lat,
            anchorLon: pt.lon,
            sumLat: pt.lat,
            sumLon: pt.lon,
            sampleCount: 1,
            startTs: pt.timestampSec,
            endTs: pt.timestampSec,
            odometerKm: calOdo,
            consecutiveSpikes: 0,
            hadSignalGap: false,
          }
        : null;
    }

    prevPoint = pt;
  }

  // Закрываем текущую активную стоянку (машина всё ещё стоит на точке)
  finalizeCluster(active);

  // Склеиваем микро-разрывы внутри одного объекта (<= clusterRadiusM при интервале <= 5 мин),
  // например манёвр к пандусу или кратковременный GPS-дрейф скорости во время погрузки/выгрузки
  const mergedClusters: StopCluster[] = [];
  for (const c of candidateClusters) {
    const prev = mergedClusters[mergedClusters.length - 1];
    if (prev) {
      const prevLat = prev.sumLat / prev.sampleCount;
      const prevLon = prev.sumLon / prev.sampleCount;
      const curLat = c.sumLat / c.sampleCount;
      const curLon = c.sumLon / c.sampleCount;
      const gapSec = c.startTs - prev.endTs;
      const centerDistM = calculateDistanceMeters(prevLat, prevLon, curLat, curLon);

      if (gapSec <= MAX_MICRO_SPLIT_GAP_SEC && centerDistM <= clusterRadiusM) {
        prev.endTs = Math.max(prev.endTs, c.endTs);
        prev.sumLat += c.sumLat;
        prev.sumLon += c.sumLon;
        prev.sampleCount += c.sampleCount;
        if (c.odometerKm > 0) prev.odometerKm = c.odometerKm;
        prev.hadSignalGap = prev.hadSignalGap || c.hadSignalGap;
        continue;
      }
    }
    mergedClusters.push({ ...c });
  }

  const rawClusters = mergedClusters.filter((c) => (c.endTs - c.startTs) / 60 >= minStopMin);

  const stops: DetectedStop[] = rawClusters.map((c) => {
    const lat = c.sumLat / c.sampleCount;
    const lon = c.sumLon / c.sampleCount;
    const distBaseM = calculateDistanceMeters(lat, lon, base.lat, base.lon);
    return {
      stopKey: buildStopKey(options.tripId, lat, lon, c.startTs),
      lat,
      lon,
      startTs: c.startTs,
      endTs: c.endTs,
      durationMin: Math.round((c.endTs - c.startTs) / 60),
      isBase: distBaseM <= base.radius_m,
      distFromBaseKm: Number((distBaseM / 1000).toFixed(1)),
      odometerKm: c.odometerKm || startOdometerKm || 0,
      hadSignalGap: c.hadSignalGap,
    };
  });

  const odoDiffKm =
    startOdometerKm !== null && endOdometerKm !== null && endOdometerKm >= startOdometerKm
      ? endOdometerKm - startOdometerKm
      : 0;
  const gpsDistKm = Math.round(totalDistMeters / 1000);

  return {
    stops,
    startOdometerKm,
    endOdometerKm,
    trackDistanceKm: Math.max(odoDiffKm, gpsDistKm),
    hasDepartedWest,
    lastBaseEntryTs,
    lastBaseEntryOdometerKm,
  };
}
