/**
 * Абстрактный слой телематики (GPS-провайдеры: Wialon, ГЛОНАССSoft, АвтоГРАФ и др.).
 * Бизнес-логика Автопилота работает строго через этот интерфейс, без прямых вызовов Wialon API.
 */

export interface TelematicsPoint {
  lat: number;
  lon: number;
  speedKmh: number;
  /** UNIX timestamp в секундах */
  timestampSec: number;
  /** Сырой одометр из трекера (в км, до применения offset) */
  rawOdometerKm?: number;
  /** Количество спутников (если доступно) */
  satellites?: number;
  /** Признак включённого зажигания (если доступно) */
  ignition?: boolean;
}

export interface TelematicsUnitSnapshot {
  externalUnitId: string;
  unitName: string;
  /** Извлечённый или нормализованный госномер (опционально) */
  plateHint?: string;
  position: TelematicsPoint | null;
  isOnline: boolean;
}

export interface TelematicsGeofence {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radiusMeters: number;
}

export interface TelematicsProvider {
  readonly providerId: string;
  /**
   * Возвращает текущие снимки позиций всех объектов провайдера
   * (или только указанных externalUnitIds, если переданы).
   */
  fetchUnitsSnapshot(externalUnitIds?: readonly string[]): Promise<TelematicsUnitSnapshot[]>;
  /**
   * Загружает историю GPS-точек объекта за интервал [fromSec, toSec] с чанкованием.
   */
  fetchTrack(
    externalUnitId: string,
    fromSec: number,
    toSec: number,
    options?: { maxMessages?: number },
  ): Promise<TelematicsPoint[]>;
  /**
   * Опциональная загрузка геозон из провайдера.
   */
  fetchGeofences?(): Promise<TelematicsGeofence[]>;
}

/**
 * Нормализация госномера: удаление пробелов/разделителей и приведение латинских букв к кириллице.
 */
export function normalizePlate(raw: string): string {
  if (!raw) return '';
  const latToCyr: Record<string, string> = {
    A: 'А',
    B: 'В',
    E: 'Е',
    K: 'К',
    M: 'М',
    H: 'Н',
    O: 'О',
    P: 'Р',
    C: 'С',
    T: 'Т',
    Y: 'У',
    X: 'Х',
  };
  const upper = raw.toUpperCase().replace(/[^A-ZА-Я0-9]/g, '');
  let out = '';
  for (const ch of upper) {
    out += latToCyr[ch] ?? ch;
  }
  return out;
}

/**
 * Расчёт расстояния между двумя координатами по формуле гаверсинусов (в метрах).
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Преобразование сырого пробега (метры или километры) + калибровочного смещения актива.
 */
export function applyOdometerCalibration(rawValue: number | undefined, offsetKm = 0): number {
  if (rawValue === undefined || !Number.isFinite(rawValue) || rawValue <= 0) {
    return 0;
  }
  const km = rawValue > 2_000_000 ? Math.round(rawValue / 1000) : Math.round(rawValue);
  if (offsetKm > 0 && km < 600_000) {
    return km + offsetKm;
  }
  return km;
}
