/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';
import { handleVehicleDeparture, handleVehicleArrival } from './wialonOrderSync';
import { TripRouteLeg, encodeTripRouteSheet } from '@saldacargo/shared';

// Координаты центра Верхней Салды и радиус границы города (в метрах)
const SALDA_BASE_LAT = parseFloat(process.env.WIALON_BASE_LAT || '58.053');
const SALDA_BASE_LON = parseFloat(process.env.WIALON_BASE_LON || '60.552');
const SALDA_BASE_RADIUS = parseFloat(process.env.WIALON_BASE_RADIUS_METERS || '8000'); // 8 км

// Точные координаты Шайтанки (карьер / погрузка проб керна Геостройиндустрия) и радиус геозоны
export const SHAYTANKA_LAT = parseFloat(process.env.WIALON_SHAYTANKA_LAT || '58.0361');
export const SHAYTANKA_LON = parseFloat(process.env.WIALON_SHAYTANKA_LON || '60.9110');
export const SHAYTANKA_RADIUS_METERS = parseFloat(
  process.env.WIALON_SHAYTANKA_RADIUS_METERS || '10000',
); // 10 км

// Точные координаты с. Маминское (склад 2, разгрузка Геостройиндустрия) и радиус геозоны
export const MAMINSKOE_LAT = parseFloat(process.env.WIALON_MAMINSKOE_LAT || '56.4334');
export const MAMINSKOE_LON = parseFloat(process.env.WIALON_MAMINSKOE_LON || '61.4088');
export const MAMINSKOE_RADIUS_METERS = parseFloat(
  process.env.WIALON_MAMINSKOE_RADIUS_METERS || '20000',
); // 20 км

export const GEOSTROY_CLIENT_ID = '83db41b2-c050-4013-a878-bda2ab5c226e';

export interface KnownRoutePoint {
  id: string;
  name: string;
  city: string;
  rawAddress: string;
  lat: number;
  lon: number;
  radiusMeters: number;
  isShaytankaLoading?: boolean;
}

/**
 * Каталог постоянных точек на ключевых маршрутах:
 * 1. Шайтанка (погрузка рудника)
 * 2. Маминское (склад 2, выгрузка)
 * 3. Реж
 * 4. Карпинск
 * 5. Воронцовка (рудник)
 */
export const KNOWN_ROUTE_POINTS: KnownRoutePoint[] = [
  {
    id: 'shaytanka',
    name: 'Шайтанка (Рудник)',
    city: 'Шайтанка',
    rawAddress: 'Шайтанка',
    lat: SHAYTANKA_LAT,
    lon: SHAYTANKA_LON,
    radiusMeters: 10000,
    isShaytankaLoading: true,
  },
  {
    id: 'maminskoe',
    name: 'с. Маминское (склад 2)',
    city: 'Маминское',
    rawAddress: 'с. Маминское, склад 2',
    lat: MAMINSKOE_LAT,
    lon: MAMINSKOE_LON,
    radiusMeters: 20000,
  },
  {
    id: 'rezh',
    name: 'г. Реж',
    city: 'Реж',
    rawAddress: 'г. Реж',
    lat: 57.419,
    lon: 61.4818,
    radiusMeters: 15000,
  },
  {
    id: 'karpinsk',
    name: 'г. Карпинск',
    city: 'Карпинск',
    rawAddress: 'г. Карпинск',
    lat: 59.7681,
    lon: 60.0235,
    radiusMeters: 20000,
  },
  {
    id: 'vorontsovka',
    name: 'Воронцовка (Рудник)',
    city: 'Воронцовка',
    rawAddress: 'пос. Воронцовка',
    lat: 59.654,
    lon: 60.231,
    radiusMeters: 20000,
  },
];

/**
 * Определение географического пункта стоянки:
 * Если точка входит в каталог известных геозон — берем красивое официальное название.
 * Если это новый / не учтенный маршрут — автоматически геокодируем через OpenStreetMap Nominatim.
 */
export async function reverseGeocodePoint(
  lat: number,
  lon: number,
): Promise<{
  city: string;
  raw: string;
  name: string;
  isKnown: boolean;
  isServiceOrRestStop?: boolean;
}> {
  for (const kp of KNOWN_ROUTE_POINTS) {
    if (calculateDistanceMeters(lat, lon, kp.lat, kp.lon) <= kp.radiusMeters) {
      return {
        city: kp.city,
        raw: kp.rawAddress,
        name: kp.name,
        isKnown: true,
        isServiceOrRestStop: false,
      };
    }
  }

  // Для неизвестных точек за пределами каталога — онлайн геокодирование OSM
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=16&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SaldaCargoFleet/1.0 (contact@saldacargo.ru)' },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const json = await res.json();
      const addr = json.address || {};
      const amen = String(addr.amenity || json.type || json.category || '').toLowerCase();
      const disp = String(json.display_name || '').toLowerCase();

      // Проверка на АЗС, общепит, придорожный сервис, парковку на трассе
      const isFuel =
        amen === 'fuel' ||
        disp.includes('азс') ||
        disp.includes('заправка') ||
        disp.includes('газпромнефть') ||
        disp.includes('лукойл') ||
        disp.includes('роснефть') ||
        disp.includes('татнефть') ||
        disp.includes('башнефть');
      const isFood =
        amen === 'cafe' ||
        amen === 'fast_food' ||
        amen === 'restaurant' ||
        disp.includes('кафе') ||
        disp.includes('столовая') ||
        disp.includes('пит-стоп') ||
        disp.includes('вкусно — и точка') ||
        disp.includes('шаурма');
      const isHighwayRest =
        amen === 'parking' ||
        json.type === 'rest_area' ||
        json.type === 'services' ||
        disp.includes('стоянка дальнобой') ||
        disp.includes('место отдыха');

      const isServiceOrRestStop = isFuel || isFood || isHighwayRest;

      const city =
        addr.city || addr.town || addr.village || addr.hamlet || addr.county || 'Неизвестно';
      const raw = json.display_name?.split(',').slice(0, 3).join(',').trim() || city;
      return { city, raw, name: city, isKnown: false, isServiceOrRestStop };
    }
  } catch {}

  return {
    city: `GPS ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    raw: `GPS координаты: ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    name: `Точка (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
    isKnown: false,
    isServiceOrRestStop: false,
  };
}

/**
 * Смещение одометра Wialon для калибровки к реальному спидометру на приборной панели.
 * Для А096МВ196 (Unit 11873): Wialon 195 181 км соответствует реальным 461 685 км на приборке (+266 504 км).
 */
export const WIALON_ODOMETER_OFFSETS: Record<string, number> = {
  А096МВ196: 266504,
  '11873': 266504,
};

export function calibrateWialonOdometer(regOrUnit: string, rawKm: number): number {
  if (!rawKm || rawKm <= 0) return rawKm;
  const clean = String(regOrUnit)
    .replace(/[\s\-_]/g, '')
    .toUpperCase()
    .replace(/A/g, 'А')
    .replace(/B/g, 'В')
    .replace(/E/g, 'Е')
    .replace(/K/g, 'К')
    .replace(/M/g, 'М')
    .replace(/H/g, 'Н')
    .replace(/O/g, 'О')
    .replace(/P/g, 'Р')
    .replace(/C/g, 'С')
    .replace(/T/g, 'Т')
    .replace(/Y/g, 'У')
    .replace(/X/g, 'Х');
  const offset = WIALON_ODOMETER_OFFSETS[clean] || WIALON_ODOMETER_OFFSETS[regOrUnit] || 0;
  if (offset > 0 && rawKm < 300000) {
    return rawKm + offset;
  }
  return rawKm;
}

export interface WialonUnitPosition {
  id: number;
  name: string;
  regNumber: string;
  lat: number;
  lon: number;
  speed: number;
  time: number;
  odometerKm: number;
  distanceFromBaseKm: number;
  isInsideBase: boolean;
}

/**
 * Расчет расстояния по формуле гаверсинусов (в метрах)
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3; // радиус Земли в метрах
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
 * 1. Получение сессии Wialon через токен
 */
export async function getWialonSession(host: string, token: string): Promise<string> {
  const cleanHost = host.replace(/\/+$/, '');
  const url = `${cleanHost}/wialon/ajax.html?svc=token/login&params=${encodeURIComponent(
    JSON.stringify({ token }),
  )}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) {
    throw new Error(`Ошибка HTTP при авторизации в Wialon: ${res.statusText}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`Ошибка Wialon API (код ${data.error})`);
  }

  if (!data.eid) {
    throw new Error('Wialon не вернул session ID (eid)');
  }

  return data.eid;
}

/**
 * Поиск созданной пользователем геозоны базы Салды в Wialon
 */
export async function fetchWialonBaseGeofence(
  host: string,
  eid: string,
): Promise<{ lat: number; lon: number; radiusMeters: number } | null> {
  try {
    const searchParams = {
      spec: {
        itemsType: 'avl_resource',
        propName: 'sys_name',
        propValueMask: '*',
        sortType: 'sys_name',
      },
      force: 1,
      flags: 0x1000 + 0x400 + 1,
      from: 0,
      to: 0,
    };
    const searchUrl = `${host}/wialon/ajax.html?svc=core/search_items&params=${encodeURIComponent(
      JSON.stringify(searchParams),
    )}&sid=${eid}`;
    const res = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const json = await res.json();
    for (const item of json.items || []) {
      if (item.zl) {
        for (const geo of Object.values<any>(item.zl)) {
          if (geo.n && geo.n.toLowerCase().includes('салда') && geo.b?.cen_y && geo.b?.cen_x) {
            return {
              lat: Number(geo.b.cen_y),
              lon: Number(geo.b.cen_x),
              radiusMeters: Number(geo.w || geo.r || 3500),
            };
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Wialon] Ошибка получения геозоны из Wialon:', e);
  }
  return null;
}

/**
 * Проверка истории сообщений Wialon за интервал времени:
 * Посещал ли объект геозону базы Салды в указанный период?
 */
export async function checkHistoricalBaseVisit(
  host: string,
  eid: string,
  unitId: number,
  timeFromSec: number,
  timeToSec: number,
  baseLat: number,
  baseLon: number,
  baseRadius: number,
): Promise<{ visited: boolean; timeSec: number; distanceMeters: number } | null> {
  try {
    const cleanHost = host.replace(/\/+$/, '');
    const url = `${cleanHost}/wialon/ajax.html?svc=messages/load_interval&params=${encodeURIComponent(
      JSON.stringify({
        itemId: unitId,
        timeFrom: timeFromSec,
        timeTo: timeToSec,
        flags: 0,
        flagsMask: 0,
        loadCount: 1000,
      }),
    )}&sid=${eid}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    const msgs = data.messages || [];

    for (const m of msgs) {
      if (!m.pos) continue;
      const dist = calculateDistanceMeters(m.pos.y, m.pos.x, baseLat, baseLon);
      if (dist <= baseRadius) {
        return {
          visited: true,
          timeSec: m.t,
          distanceMeters: dist,
        };
      }
    }
  } catch (e) {
    console.warn('[Wialon] Ошибка проверки истории сообщений:', e);
  }
  return null;
}

/**
 * Проверка посещения геозоны Шайтанки (зона погрузки керна/проб)
 */
export async function checkHistoricalShaytankaVisit(
  cleanHost: string,
  eid: string,
  unitId: number,
  timeFromSec: number,
  timeToSec: number,
): Promise<{ visited: boolean; timeSec: number; distanceMeters: number } | null> {
  return checkHistoricalBaseVisit(
    cleanHost,
    eid,
    unitId,
    timeFromSec,
    timeToSec,
    SHAYTANKA_LAT,
    SHAYTANKA_LON,
    SHAYTANKA_RADIUS_METERS,
  );
}

export interface RoutePointMatch {
  id: string;
  name: string;
  city: string;
  raw: string;
  isKnown: boolean;
  lat: number;
  lon: number;
  startT: number;
  endT: number;
  durMin: number;
  distBaseKm: number;
}

export interface DetectedTripRoute {
  visitedShaytanka: boolean;
  visitedMaminskoe: boolean;
  visitedRezh: boolean;
  visitedKarpinsk: boolean;
  visitedVorontsovka: boolean;
  hasUnloaded: boolean;
  hasDepartedWest: boolean;
  loadingAddress: { city: string; raw: string } | null;
  unloadingAddress: { city: string; raw: string } | null;
  clientId: string | null;
  clientName: string | null;
  cargoName: string | null;
  priceWithoutVat: number | null;
  distinctLocationsCount: number;
  points: RoutePointMatch[];
  legs: TripRouteLeg[];
  totalMileageKm: number;
  startOdometer?: number;
  endOdometer?: number;
  routeSummary: string;
}

/**
 * Автономный анализ трека Wialon и остановок автомобиля:
 * Если 1-я внешняя остановка вне Салды была в Шайтанке (карьер/керн):
 *   -> Автоматически задается погрузка: Шайтанка, Клиент: ООО "Геостройиндустрия", груз: Пробы керна (Шайтанка), ставка: 40 000 ₽.
 *   -> Любой промежуточный заезд на базу в Верхнюю Салду НЕ закрывает рейс, а считается отстоем/ночёвкой перед выгрузкой.
 * 2-я внешняя остановка (после заезда в Салду) автоматически становится местом разгрузки (с. Маминское, склад 2).
 * Рассчитывает структурированные рейсы (плечи) по стандартам Варианта 3 (№, Рейс, Выезд, В пути, Прибытие, Дата, Км).
 */
export async function detectTripStopsAndRoute(
  cleanHost: string,
  eid: string,
  unitId: number,
  startTimeIso: string,
  endTimeIso?: string | null,
  baseLat = SALDA_BASE_LAT,
  baseLon = SALDA_BASE_LON,
  baseRadius = SALDA_BASE_RADIUS,
  regNumber = '',
): Promise<DetectedTripRoute | null> {
  try {
    const timeFromSec = Math.floor(new Date(startTimeIso).getTime() / 1000) - 900;
    const timeToSec = endTimeIso
      ? Math.floor(new Date(endTimeIso).getTime() / 1000) + 900
      : Math.floor(Date.now() / 1000);

    const msgUrl = `${cleanHost}/wialon/ajax.html?svc=messages/load_interval&params=${encodeURIComponent(
      JSON.stringify({
        itemId: unitId,
        timeFrom: timeFromSec,
        timeTo: timeToSec,
        flags: 0,
        flagsMask: 0,
        loadCount: 15000,
      }),
    )}&sid=${eid}`;

    const res = await fetch(msgUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const data = await res.json();
    const msgs = data.messages || [];
    if (msgs.length === 0) return null;

    // Проверка движения в сторону Нижнего Тагила / Серовского тракта (на запад, lon < 60.35)
    let hasDepartedWest = false;
    let initialStartOdo: number | null = null;
    let finalEndOdo: number | null = null;

    for (const m of msgs) {
      if (m.pos?.x && m.pos.x < 60.35) {
        hasDepartedWest = true;
      }
      const rawOdo = m.p?.mileage ?? m.p?.can_mileage ?? m.cnm;
      if (rawOdo !== undefined && rawOdo !== null && Number(rawOdo) > 0) {
        const cal = calibrateWialonOdometer(regNumber, Number(rawOdo));
        if (initialStartOdo === null) initialStartOdo = cal;
        finalEndOdo = cal;
      }
    }

    // Собираем все стоянки (скорость < 5 км/ч не менее 15 минут)
    const allStops: Array<{
      startT: number;
      endT: number;
      durMin: number;
      lat: number;
      lon: number;
      isBase: boolean;
      distBaseKm: number;
      odo: number;
    }> = [];

    let curStop: { startT: number; endT: number; pos: any; odo: number } | null = null;
    for (const m of msgs) {
      if (!m.pos) continue;
      const speed = m.pos.s || 0;
      const rawOdo = m.p?.mileage ?? m.p?.can_mileage ?? m.cnm;
      const curOdo =
        rawOdo !== undefined && rawOdo !== null && Number(rawOdo) > 0
          ? calibrateWialonOdometer(regNumber, Number(rawOdo))
          : 0;

      if (speed < 5) {
        if (!curStop) {
          curStop = { startT: m.t, endT: m.t, pos: m.pos, odo: curOdo };
        } else {
          curStop.endT = m.t;
          curStop.pos = m.pos;
          if (curOdo > 0) curStop.odo = curOdo;
        }
      } else {
        if (curStop) {
          const durMin = (curStop.endT - curStop.startT) / 60;
          if (durMin >= 15) {
            const lat = Number(curStop.pos.y);
            const lon = Number(curStop.pos.x);
            const distBase = calculateDistanceMeters(lat, lon, baseLat, baseLon);
            const isBase = distBase <= baseRadius;
            allStops.push({
              startT: curStop.startT,
              endT: curStop.endT,
              durMin: Math.round(durMin),
              lat,
              lon,
              isBase,
              distBaseKm: Number((distBase / 1000).toFixed(1)),
              odo: curStop.odo || initialStartOdo || 0,
            });
          }
          curStop = null;
        }
      }
    }

    // Если рейс еще стоит на последней точке
    if (curStop) {
      const durMin = (curStop.endT - curStop.startT) / 60;
      if (durMin >= 15) {
        const lat = Number(curStop.pos.y);
        const lon = Number(curStop.pos.x);
        const distBase = calculateDistanceMeters(lat, lon, baseLat, baseLon);
        const isBase = distBase <= baseRadius;
        allStops.push({
          startT: curStop.startT,
          endT: curStop.endT,
          durMin: Math.round(durMin),
          lat,
          lon,
          isBase,
          distBaseKm: Number((distBase / 1000).toFixed(1)),
          odo: curStop.odo || finalEndOdo || 0,
        });
      }
    }

    // Геокодируем каждую стоянку и сопоставляем с каталогом геозон
    const namedStops: Array<{
      name: string;
      city: string;
      raw: string;
      isKnown: boolean;
      startT: number;
      endT: number;
      durMin: number;
      lat: number;
      lon: number;
      isBase: boolean;
      distBaseKm: number;
      odo: number;
    }> = [];

    for (const s of allStops) {
      if (s.isBase) {
        namedStops.push({
          name: 'В.Салда',
          city: 'Верхняя Салда',
          raw: 'г. Верхняя Салда',
          isKnown: true,
          startT: s.startT,
          endT: s.endT,
          durMin: s.durMin,
          lat: s.lat,
          lon: s.lon,
          isBase: true,
          distBaseKm: s.distBaseKm,
          odo: s.odo,
        });
      } else {
        const match = await reverseGeocodePoint(s.lat, s.lon);
        // Отсекаем мелкие дорожные паузы (< 25 мин вне каталога)
        if (!match.isKnown && (match.isServiceOrRestStop || s.durMin < 25)) {
          continue;
        }
        namedStops.push({
          name: match.name,
          city: match.city,
          raw: match.raw,
          isKnown: match.isKnown,
          startT: s.startT,
          endT: s.endT,
          durMin: s.durMin,
          lat: s.lat,
          lon: s.lon,
          isBase: false,
          distBaseKm: s.distBaseKm,
          odo: s.odo,
        });
      }
    }

    // Склеиваем последовательные стоянки в одном и том же населенном пункте
    const mergedStops: typeof namedStops = [];
    for (const s of namedStops) {
      const prev = mergedStops[mergedStops.length - 1];
      if (prev && prev.name === s.name) {
        prev.endT = s.endT;
        prev.durMin += s.durMin;
        if (s.odo > 0) prev.odo = s.odo;
      } else {
        mergedStops.push({ ...s });
      }
    }

    // Формируем плечи (рейсы) для Варианта 3
    const legs: TripRouteLeg[] = [];
    for (let i = 0; i < mergedStops.length - 1; i++) {
      const stFrom = mergedStops[i];
      const stTo = mergedStops[i + 1];
      if (!stFrom || !stTo) continue;

      const depT = stFrom.endT;
      const arrT = stTo.startT;
      const durSec = Math.max(60, arrT - depT);
      const durH = Math.floor(durSec / 3600);
      const durM = Math.floor((durSec % 3600) / 60);
      const durStr = durH > 0 ? `${durH}ч ${durM}м` : `${durM}м`;

      const depDate = new Date(depT * 1000);
      const arrDate = new Date(arrT * 1000);
      const depStr = depDate.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Yekaterinburg',
      });
      const arrStr = arrDate.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Yekaterinburg',
      });
      const dateStr = arrDate.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'Asia/Yekaterinburg',
      });

      const legKm =
        stTo.odo > 0 && stFrom.odo > 0
          ? Math.max(0, Math.round(stTo.odo - stFrom.odo))
          : Math.max(
              1,
              Math.round(
                calculateDistanceMeters(stFrom.lat, stFrom.lon, stTo.lat, stTo.lon) / 1000,
              ),
            );

      legs.push({
        n: i + 1,
        from: stFrom.name,
        to: stTo.name,
        route: `${stFrom.name} ➔ ${stTo.name}`,
        dep: depStr,
        dur: durStr,
        arr: arrStr,
        date: dateStr,
        km: legKm,
        startOdo: Math.round(stFrom.odo),
        endOdo: Math.round(stTo.odo),
      });
    }

    // Внешние точки для сводки заказа
    const matchedPoints: RoutePointMatch[] = mergedStops
      .filter((s) => !s.isBase)
      .map((s) => ({
        id: s.isKnown ? KNOWN_ROUTE_POINTS.find((p) => p.name === s.name)?.id || 'known' : 'osm',
        name: s.name,
        city: s.city,
        raw: s.raw,
        isKnown: s.isKnown,
        lat: s.lat,
        lon: s.lon,
        startT: s.startT,
        endT: s.endT,
        durMin: s.durMin,
        distBaseKm: s.distBaseKm,
      }));

    const locNames = mergedStops.map((s) => s.name);
    const routeSummary =
      locNames.length > 0 ? locNames.join(' ➔ ') : matchedPoints.map((p) => p.name).join(' ➔ ');

    const totalMileageKm =
      legs.length > 0
        ? legs.reduce((sum, l) => sum + l.km, 0)
        : initialStartOdo && finalEndOdo
          ? Math.max(0, Math.round(finalEndOdo - initialStartOdo))
          : 0;

    const result: DetectedTripRoute = {
      visitedShaytanka: false,
      visitedMaminskoe: false,
      visitedRezh: false,
      visitedKarpinsk: false,
      visitedVorontsovka: false,
      hasUnloaded: false,
      hasDepartedWest,
      loadingAddress: null,
      unloadingAddress: null,
      clientId: null,
      clientName: null,
      cargoName: null,
      priceWithoutVat: null,
      distinctLocationsCount: matchedPoints.length,
      points: matchedPoints,
      legs,
      totalMileageKm,
      startOdometer: initialStartOdo || undefined,
      endOdometer: finalEndOdo || undefined,
      routeSummary,
    };

    if (matchedPoints.length > 0) {
      const firstLoc = matchedPoints[0]!;
      const isShaytanka =
        firstLoc.city.toLowerCase().includes('шайтан') ||
        calculateDistanceMeters(firstLoc.lat, firstLoc.lon, SHAYTANKA_LAT, SHAYTANKA_LON) <=
          SHAYTANKA_RADIUS_METERS;

      if (isShaytanka) {
        result.visitedShaytanka = true;
        result.loadingAddress = { city: 'Шайтанка', raw: 'Шайтанка' };
        result.clientId = GEOSTROY_CLIENT_ID;
        result.clientName = 'ООО "Геостройиндустрия"';
        result.cargoName = 'Пробы керна (Шайтанка)';
        // Фиксированная базовая ставка Шайтанка ↔ Маминское: 40 000 ₽ (без динамических накруток)
        result.priceWithoutVat = 40000;
      } else {
        result.loadingAddress = { city: firstLoc.city, raw: firstLoc.raw };
      }

      if (matchedPoints.length > 1) {
        const lastLoc = matchedPoints[matchedPoints.length - 1]!;
        result.hasUnloaded = true;
        result.unloadingAddress = { city: lastLoc.city, raw: lastLoc.raw };
        result.visitedMaminskoe = matchedPoints.some((p) => p.city === 'Маминское');
        result.visitedRezh = matchedPoints.some((p) => p.city === 'Реж');
        result.visitedKarpinsk = matchedPoints.some((p) => p.city === 'Карпинск');
        result.visitedVorontsovka = matchedPoints.some((p) => p.city === 'Воронцовка');
      }
    }

    return result;
  } catch (err) {
    console.warn('[Wialon] Ошибка авто-детекции маршрута и остановок:', err);
    return null;
  }
}

/**
 * 2. Опрос 4 Валдаев и получение их текущих координат и одометров
 */
export async function fetchWialonValdaiPositions(
  host: string,
  token: string,
): Promise<WialonUnitPosition[]> {
  const cleanHost = host.replace(/\/+$/, '');
  const eid = await getWialonSession(cleanHost, token);

  // Получаем динамические параметры геозоны Салды из Wialon
  const remoteGeo = await fetchWialonBaseGeofence(cleanHost, eid);
  const baseLat = remoteGeo?.lat ?? SALDA_BASE_LAT;
  const baseLon = remoteGeo?.lon ?? SALDA_BASE_LON;
  const baseRadius = remoteGeo?.radiusMeters ?? SALDA_BASE_RADIUS;

  // Флаги: 1 (base info) + 1024 (pos) + 4096 (counters) + 256 (pos details) + 524288 (0x80000 - lmsg для одометра CAN/GPS)
  const flags = 1 + 1024 + 4096 + 256 + 0x80000;
  const searchParams = {
    spec: {
      itemsType: 'avl_unit',
      propName: 'sys_name',
      propValueMask: '*',
      sortType: 'sys_name',
    },
    force: 1,
    flags,
    from: 0,
    to: 0,
  };

  const searchUrl = `${cleanHost}/wialon/ajax.html?svc=core/search_items&params=${encodeURIComponent(
    JSON.stringify(searchParams),
  )}&sid=${eid}`;

  const res = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) {
    throw new Error(`Ошибка запроса объектов Wialon: ${res.statusText}`);
  }

  const json = await res.json();
  const items = json.items || [];

  const results: WialonUnitPosition[] = [];

  for (const item of items) {
    const rawName = String(item.nm || '');
    // Извлекаем номер (например "А096МВ196", "О188ТА196", "У446ВН96", "У883АР96")
    let regNumber = '';
    if (rawName.includes('096')) regNumber = 'А096МВ196';
    else if (rawName.includes('188')) regNumber = 'О188ТА196';
    else if (rawName.includes('446')) regNumber = 'У446ВН96';
    else if (rawName.includes('883')) regNumber = 'У883АР96';
    else continue;

    const pos = item.pos || {};
    const lat = Number(pos.y || 0);
    const lon = Number(pos.x || 0);
    const speed = Number(pos.s || 0);
    const time = Number(pos.t || 0);

    // Одометр в Wialon (lmsg.p.mileage, lmsg.p.can_mileage или cnm)
    let odoKm = 0;
    const rawMileage = item.lmsg?.p?.mileage ?? item.lmsg?.p?.can_mileage ?? item.cnm;
    if (rawMileage !== undefined && rawMileage !== null) {
      const num = Number(rawMileage);
      if (!isNaN(num) && num > 0) {
        odoKm = num > 2000000 ? Math.round(num / 1000) : Math.round(num);
        odoKm = calibrateWialonOdometer(regNumber, odoKm);
      }
    }

    const hasValidCoords = lat !== 0 && lon !== 0;
    const distMeters = hasValidCoords
      ? calculateDistanceMeters(lat, lon, baseLat, baseLon)
      : Infinity;
    const distKm = hasValidCoords ? Number((distMeters / 1000).toFixed(2)) : 0;
    const isInsideBase = hasValidCoords ? distMeters <= baseRadius : false;

    results.push({
      id: item.id,
      name: rawName,
      regNumber,
      lat,
      lon,
      speed,
      time,
      odometerKm: odoKm,
      distanceFromBaseKm: distKm,
      isInsideBase,
    });
  }

  return results;
}

/**
 * 3. Автономный цикл синхронизации (проверяет переходы «база -> выезд» и «выезд -> возврат»)
 */
export async function syncValdaiTelematics(
  supabase: SupabaseClient<any, any, any>,
  options?: { host?: string; token?: string },
) {
  const host = options?.host || process.env.WIALON_HOST || 'https://host.local4.wialon.host';
  const token =
    options?.token ||
    process.env.WIALON_TOKEN ||
    '561a6efcd9ed8d38d0ff3b80c29253f01653C6698177A6D92E360BBD0D70D0B6AF5240DE';

  const cleanHost = host.replace(/\/+$/, '');
  const eid = await getWialonSession(cleanHost, token);
  const remoteGeo = await fetchWialonBaseGeofence(cleanHost, eid);
  const baseLat = remoteGeo?.lat ?? SALDA_BASE_LAT;
  const baseLon = remoteGeo?.lon ?? SALDA_BASE_LON;
  const baseRadius = remoteGeo?.radiusMeters ?? SALDA_BASE_RADIUS;

  const positions = await fetchWialonValdaiPositions(host, token);
  const eventsTriggered: any[] = [];

  for (const pos of positions) {
    // Находим актив автомобиля в Supabase
    const { data: asset } = await supabase
      .from('assets')
      .select('id, reg_number, short_name, notes, odometer_current')
      .eq('reg_number', pos.regNumber)
      .maybeSingle();

    if (!asset) continue;

    const notes = asset.notes || '';
    let stateData: { is_inside?: boolean; last_lat?: number; last_lon?: number } = {};
    const match = notes.match(/\[WIALON_STATE:(\{.*?\})\]/);
    if (match && match[1]) {
      try {
        stateData = JSON.parse(match[1]);
      } catch {}
    }

    const prevInside = stateData.is_inside !== undefined ? stateData.is_inside : true;
    const currentInside = pos.isInsideBase;

    // Защита от скручивания/занижения одометра:
    // Если трекер Wialon выдает пробег существенно меньше, чем зафиксировано у машины в базе
    // (например, трекер на Валдай 446 считает от момента установки: 63 тыс. км vs 247 тыс. км на приборке),
    // то относительный счетчик трекера НЕЛЬЗЯ использовать напрямую как одометр машины.
    const currentAssetOdo = Number(asset.odometer_current || 0);
    const isWialonRelativeCounter = currentAssetOdo > 0 && pos.odometerKm < currentAssetOdo - 1000;

    const effectiveOdo = isWialonRelativeCounter
      ? currentAssetOdo
      : pos.odometerKm > 0
        ? Math.max(pos.odometerKm, currentAssetOdo)
        : currentAssetOdo || 120000;

    // СОБЫТИЕ 1: Выезд за пределы Верхней Салды (СТАРТ РЕЙСА)
    if (prevInside && !currentInside) {
      console.log(
        `[Wialon Tracker] 🚀 Валдай ${pos.regNumber} ВЫЕХАЛ из Салды (${pos.distanceFromBaseKm} км от центра)`,
      );
      const res = await handleVehicleDeparture(supabase, {
        vehicleId: asset.id,
        odometer: effectiveOdo,
        timestamp: new Date().toISOString(),
        lat: pos.lat,
        lon: pos.lon,
      });
      eventsTriggered.push({
        event: 'departure',
        regNumber: pos.regNumber,
        distanceFromBaseKm: pos.distanceFromBaseKm,
        res,
      });
    }

    // СОБЫТИЕ 2: Возврат в Верхнюю Салду (ФИНИШ РЕЙСА -> РЕВЬЮ + ЗП + ГСМ)
    else if (!prevInside && currentInside) {
      console.log(
        `[Wialon Tracker] 🏁 Валдай ${pos.regNumber} ВЕРНУЛСЯ в Салду (${pos.distanceFromBaseKm} км от центра)`,
      );

      // Защитная авто-детекция перед закрытием: проверяем фактический маршрут трека Wialon и количество точек
      const { data: arrivingOrder } = await supabase
        .from('orders')
        .select(
          'id, base_doc_number, price_without_vat, loading_address_json, unloading_address_json, raw_parser_payload, trip:trips!orders_active_trip_id_fkey(id, started_at)',
        )
        .eq('assigned_vehicle_id', asset.id)
        .eq('status', 'in_progress')
        .maybeSingle();

      const arrivingTrip = (
        Array.isArray(arrivingOrder?.trip) ? arrivingOrder.trip[0] : arrivingOrder?.trip
      ) as { id: string; started_at?: string } | undefined;

      if (arrivingOrder && arrivingTrip?.started_at) {
        const route = await detectTripStopsAndRoute(
          cleanHost,
          eid,
          pos.id,
          arrivingTrip.started_at,
          null,
          baseLat,
          baseLon,
          baseRadius,
          pos.regNumber,
        );
        const isShaytanka =
          Boolean(route?.visitedShaytanka) ||
          Boolean(arrivingOrder.raw_parser_payload?.visited_shaytanka);

        if (isShaytanka) {
          const finalPointsCount =
            route?.points?.length || (arrivingOrder.raw_parser_payload?.detected_points_count ?? 2);
          const finalPrice = route?.priceWithoutVat || 40000;
          const finalRouteDesc =
            route?.routeSummary ||
            (route?.unloadingAddress?.raw
              ? `Шайтанка ➔ ${route.unloadingAddress.raw}`
              : arrivingOrder.unloading_address_json?.raw
                ? `Шайтанка ➔ ${arrivingOrder.unloading_address_json.raw}`
                : 'Шайтанка ➔ с. Маминское, склад 2');

          const isUnloaded = Boolean(route?.hasUnloaded);
          const hasDepartedWest = Boolean(route?.hasDepartedWest);
          const isTransitArrival = !isUnloaded && !hasDepartedWest;

          await supabase
            .from('orders')
            .update({
              raw_parser_payload: {
                ...(arrivingOrder.raw_parser_payload || {}),
                visited_shaytanka: true,
                visited_maminskoe: Boolean(
                  arrivingOrder.raw_parser_payload?.visited_maminskoe || route?.visitedMaminskoe,
                ),
                has_unloaded: isUnloaded,
                has_departed_west: hasDepartedWest,
                prevent_salda_auto_finish: isTransitArrival,
                detected_route_summary: finalRouteDesc,
                detected_points_count: finalPointsCount,
              },
              client_id: GEOSTROY_CLIENT_ID,
              cargo_name: 'Пробы керна (Шайтанка)',
              price_without_vat: finalPrice,
              base_doc_name: 'Заявка ООО "Геостройиндустрия"',
              loading_address_json: route?.loadingAddress ||
                arrivingOrder.loading_address_json || {
                  raw: 'Шайтанка',
                  city: 'Шайтанка',
                },
              unloading_address_json: route?.unloadingAddress ||
                arrivingOrder.unloading_address_json || {
                  raw: 'с. Маминское, склад 2',
                  city: 'Маминское',
                },
              updated_at: new Date().toISOString(),
            })
            .eq('id', arrivingOrder.id);

          // Обновляем структурированный маршрутный лист в заметке рейса
          if (route?.legs && route.legs.length > 0) {
            const curNote = (arrivingTrip as any).driver_note || '';
            const updatedNote = encodeTripRouteSheet(route.legs, curNote, true);
            await supabase
              .from('trips')
              .update({ driver_note: updatedNote })
              .eq('id', arrivingTrip.id);
          }

          // Синхронизируем существующий или новый trip_orders перед финишем
          const { data: curTo } = await supabase
            .from('trip_orders')
            .select('id, amount, description')
            .eq('trip_id', arrivingTrip.id)
            .filter('lifecycle_status', 'neq', 'cancelled')
            .maybeSingle();

          if (curTo) {
            await supabase
              .from('trip_orders')
              .update({
                amount: finalPrice,
                description: `Керн Геостройиндустрия${arrivingOrder.base_doc_number ? ` (Рейс №${arrivingOrder.base_doc_number})` : ''}`,
                updated_at: new Date().toISOString(),
              })
              .eq('id', curTo.id);
          }
        }
      }

      const res = await handleVehicleArrival(supabase, {
        vehicleId: asset.id,
        odometer: effectiveOdo,
        timestamp: new Date().toISOString(),
        isInsideBase: true,
        distanceFromBaseKm: pos.distanceFromBaseKm,
        lat: stateData.last_lat ?? pos.lat,
        lon: stateData.last_lon ?? pos.lon,
      });
      eventsTriggered.push({
        event: 'arrival',
        regNumber: pos.regNumber,
        distanceFromBaseKm: pos.distanceFromBaseKm,
        res,
      });
    }

    // СОБЫТИЕ 3: Машина сейчас СНАРУЖИ — проверка промежуточного транзита
    // ВАЖНО: Если машина снаружи, рейс НИКОГДА не может быть завершён!
    // Фиксируется только отметка о транзите в заметках рейса, без закрытия заявки.
    else if (!currentInside) {
      const { data: activeOrder } = await supabase
        .from('orders')
        .select(
          'id, base_doc_number, client_id, cargo_name, price_without_vat, loading_address_json, unloading_address_json, raw_parser_payload, trip:trips!orders_active_trip_id_fkey(id, started_at, driver_note)',
        )
        .eq('assigned_vehicle_id', asset.id)
        .eq('status', 'in_progress')
        .maybeSingle();

      const tripObj = (
        Array.isArray(activeOrder?.trip) ? activeOrder.trip[0] : activeOrder?.trip
      ) as { id: string; started_at?: string; driver_note?: string | null } | undefined;

      if (activeOrder && tripObj?.started_at) {
        // Снятие транзитного флага при выходе на Тагил (на запад, lon < 60.35):
        if (pos.lon < 60.35 && !activeOrder.raw_parser_payload?.has_departed_west) {
          console.log(
            `[Wialon Tracker] 🧭 Валдай ${pos.regNumber} вышел на трассу в сторону Нижнего Тагила (lon=${pos.lon}). Транзитный статус СНЯТ.`,
          );
          await supabase
            .from('orders')
            .update({
              raw_parser_payload: {
                ...(activeOrder.raw_parser_payload || {}),
                has_departed_west: true,
                transit_allowed: false,
                prevent_salda_auto_finish: false,
                departed_west_at: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', activeOrder.id);
        }

        // Автоматический опрос остановок трека Wialon:
        // Смотрим историю до 36 часов назад, чтобы не потерять вечернюю погрузку в Шайтанке перед ночёвкой на базе!
        const tripStartTs = new Date(tripObj.started_at).getTime();
        const lookbackLimitTs = Date.now() - 36 * 3600 * 1000;
        const effectiveLookupStartIso = new Date(
          Math.min(tripStartTs, lookbackLimitTs),
        ).toISOString();

        const routeInfo = await detectTripStopsAndRoute(
          cleanHost,
          eid,
          pos.id,
          effectiveLookupStartIso,
          null,
          baseLat,
          baseLon,
          baseRadius,
          pos.regNumber,
        );

        // Проверка: находится ли машина прямо сейчас в Шайтанке или Маминском
        const distToShaytanka = calculateDistanceMeters(
          pos.lat,
          pos.lon,
          SHAYTANKA_LAT,
          SHAYTANKA_LON,
        );
        const distToMaminskoe = calculateDistanceMeters(
          pos.lat,
          pos.lon,
          MAMINSKOE_LAT,
          MAMINSKOE_LON,
        );
        const isCurrentlyInShaytanka = distToShaytanka <= SHAYTANKA_RADIUS_METERS;
        const isCurrentlyInMaminskoe = distToMaminskoe <= MAMINSKOE_RADIUS_METERS;
        const isShaytankaDetected = Boolean(
          routeInfo?.visitedShaytanka ||
          isCurrentlyInShaytanka ||
          activeOrder.raw_parser_payload?.visited_shaytanka,
        );

        if (isShaytankaDetected) {
          const wasVisited = Boolean(activeOrder.raw_parser_payload?.visited_shaytanka);
          const currentPointsCount = routeInfo?.points?.length || 2;
          const prevPointsCount = activeOrder.raw_parser_payload?.detected_points_count ?? 2;
          const dynamicPrice = routeInfo?.priceWithoutVat || 40000;
          const priceOrRouteChanged =
            currentPointsCount > prevPointsCount ||
            (activeOrder.price_without_vat && dynamicPrice !== activeOrder.price_without_vat);

          const needsOrderUpdate =
            !wasVisited ||
            !activeOrder.client_id ||
            !activeOrder.price_without_vat ||
            !activeOrder.loading_address_json?.raw ||
            priceOrRouteChanged ||
            ((routeInfo?.hasUnloaded || isCurrentlyInMaminskoe) &&
              !activeOrder.raw_parser_payload?.has_unloaded);

          if (needsOrderUpdate) {
            const finalRouteSummary =
              routeInfo?.routeSummary ||
              (routeInfo?.unloadingAddress?.raw
                ? `Шайтанка ➔ ${routeInfo.unloadingAddress.raw}`
                : isCurrentlyInMaminskoe
                  ? 'Шайтанка ➔ с. Маминское, склад 2'
                  : 'Шайтанка ➔ с. Маминское, склад 2');

            console.log(
              `[Wialon Tracker] 🌲 Валдай ${pos.regNumber}: подтверждена погрузка в Шайтанке (ООО "Геостройиндустрия", ${dynamicPrice} ₽, точек: ${currentPointsCount})${routeInfo?.hasUnloaded || isCurrentlyInMaminskoe ? ', маршрут: ' + finalRouteSummary : ''}`,
            );

            const updateOrderPayload: any = {
              raw_parser_payload: {
                ...(activeOrder.raw_parser_payload || {}),
                visited_shaytanka: true,
                visited_maminskoe: Boolean(
                  activeOrder.raw_parser_payload?.visited_maminskoe ||
                  routeInfo?.visitedMaminskoe ||
                  isCurrentlyInMaminskoe,
                ),
                has_unloaded: Boolean(
                  activeOrder.raw_parser_payload?.has_unloaded || routeInfo?.hasUnloaded,
                ),
                has_departed_west: Boolean(
                  activeOrder.raw_parser_payload?.has_departed_west || routeInfo?.hasDepartedWest,
                ),
                prevent_salda_auto_finish: !routeInfo?.hasUnloaded && !routeInfo?.hasDepartedWest,
                detected_route_summary: finalRouteSummary,
                detected_points_count: currentPointsCount,
                shaytanka_detected_at:
                  activeOrder.raw_parser_payload?.shaytanka_detected_at || new Date().toISOString(),
              },
              client_id: GEOSTROY_CLIENT_ID,
              cargo_name: 'Пробы керна (Шайтанка)',
              price_without_vat: dynamicPrice,
              base_doc_name: 'Заявка ООО "Геостройиндустрия"',
              loading_address_json: routeInfo?.loadingAddress ||
                activeOrder.loading_address_json || {
                  raw: 'Шайтанка',
                  city: 'Шайтанка',
                },
              updated_at: new Date().toISOString(),
            };

            if (routeInfo?.unloadingAddress || isCurrentlyInMaminskoe) {
              updateOrderPayload.unloading_address_json = routeInfo?.unloadingAddress ||
                activeOrder.unloading_address_json || {
                  raw: 'с. Маминское, склад 2',
                  city: 'Маминское',
                };
            }

            await supabase.from('orders').update(updateOrderPayload).eq('id', activeOrder.id);

            // Синхронизируем заказ внутри рейса (trip_orders)
            const { data: existingTo } = await supabase
              .from('trip_orders')
              .select('id, amount, description')
              .eq('trip_id', tripObj.id)
              .filter('lifecycle_status', 'neq', 'cancelled')
              .maybeSingle();

            if (existingTo) {
              await supabase
                .from('trip_orders')
                .update({
                  amount: dynamicPrice,
                  description: `Керн Геостройиндустрия${activeOrder.base_doc_number ? ` (Рейс №${activeOrder.base_doc_number})` : ''}`,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingTo.id);
            } else {
              const { data: createdTo } = await supabase
                .from('trip_orders')
                .insert({
                  trip_id: tripObj.id,
                  counterparty_id: GEOSTROY_CLIENT_ID,
                  description: `Керн Геостройиндустрия${activeOrder.base_doc_number ? ` (Рейс №${activeOrder.base_doc_number})` : ''}`,
                  amount: dynamicPrice,
                  driver_pay: 7900,
                  driver_car_pay: 0,
                  driver_loader_pay: 0,
                  loader_pay: 0,
                  loader2_pay: 0,
                  direction: 'ekb',
                  payment_method: 'debt_cash',
                  settlement_status: 'pending',
                  lifecycle_status: 'draft',
                  idempotency_key: crypto.randomUUID(),
                })
                .select('id')
                .maybeSingle();

              if (createdTo?.id) {
                await supabase
                  .from('orders')
                  .update({
                    raw_parser_payload: {
                      ...updateOrderPayload.raw_parser_payload,
                      trip_order_id: createdTo.id,
                    },
                  })
                  .eq('id', activeOrder.id);
              }
            }

            if (routeInfo?.legs && routeInfo.legs.length > 0) {
              const curNote = tripObj.driver_note || '';
              const updatedNote = encodeTripRouteSheet(routeInfo.legs, curNote, true);
              await supabase
                .from('trips')
                .update({
                  driver_note: updatedNote,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', tripObj.id);
            }
          }
        }

        const saldaTransitCount = activeOrder.raw_parser_payload?.salda_transit_count || 0;
        const lastTransitTs = activeOrder.raw_parser_payload?.last_transit_checked_at || 0;
        const nowSec = Math.floor(Date.now() / 1000);

        if (nowSec - lastTransitTs > 3600) {
          const fromSec = Math.max(
            Math.floor(new Date(tripObj.started_at).getTime() / 1000),
            lastTransitTs || 0,
          );
          if (nowSec - fromSec > 1800) {
            const visit = await checkHistoricalBaseVisit(
              cleanHost,
              eid,
              pos.id,
              fromSec,
              nowSec,
              baseLat,
              baseLon,
              baseRadius,
            );

            if (visit?.visited) {
              const transitTimeStr = new Date(visit.timeSec * 1000).toLocaleTimeString('ru-RU');
              console.log(
                `[Wialon Tracker] 🔄 Обнаружен промежуточный транзит через Салду для ${pos.regNumber} в ${transitTimeStr} (${(visit.distanceMeters / 1000).toFixed(2)} км от базы)`,
              );
              await supabase
                .from('orders')
                .update({
                  raw_parser_payload: {
                    ...(activeOrder.raw_parser_payload || {}),
                    salda_transit_count: saldaTransitCount + 1,
                    last_transit_checked_at: nowSec,
                  },
                  updated_at: new Date().toISOString(),
                })
                .eq('id', activeOrder.id);

              eventsTriggered.push({
                event: 'transit_logged',
                regNumber: pos.regNumber,
                transitTimeStr,
              });
            }
          }
        }
      }
    }

    // Сохраняем обновленное состояние в заметки актива
    stateData.is_inside = currentInside;
    stateData.last_lat = pos.lat;
    stateData.last_lon = pos.lon;

    const cleanNotes = notes.replace(/\[WIALON_STATE:\{.*?\}\]/g, '').trim();
    const updatedNotes = `${cleanNotes ? cleanNotes + '\n' : ''}[WIALON_STATE:${JSON.stringify(stateData)}]`;

    const assetUpdatePayload: Record<string, any> = {
      notes: updatedNotes,
      updated_at: new Date().toISOString(),
    };
    // Обновляем одометр актива только если Wialon передает реальный абсолютный одометр
    // и он превышает текущий (одометр никогда не скручивается назад)
    if (!isWialonRelativeCounter && pos.odometerKm > currentAssetOdo) {
      assetUpdatePayload.odometer_current = pos.odometerKm;
    }

    await supabase.from('assets').update(assetUpdatePayload).eq('id', asset.id);
  }

  return {
    success: true,
    checkedCount: positions.length,
    positions,
    eventsTriggered,
  };
}

export const WIALON_VALDAI_UNITS: Record<string, number> = {
  А096МВ196: 11873,
  О188ТА196: 11876,
  У446ВН96: 11875,
  У883АР96: 11874,
};

export interface TripWialonMileageResult {
  unitId: number;
  regNumber: string;
  wialonKm: number;
  startOdo: number;
  endOdo: number;
  startTime: string;
  endTime: string;
  normLiters: number;
  normCost: number;
  driverPay: number;
  daysCount: number;
}

/**
 * Получение точного пробега, одометров и нормативов из Wialon за интервал рейса
 */
export async function fetchTripWialonMileage(options: {
  host?: string;
  token?: string;
  regNumber: string;
  startedAt: string;
  endedAt?: string | null;
}): Promise<TripWialonMileageResult | null> {
  const host = options.host || process.env.WIALON_HOST || 'https://host.local4.wialon.host';
  const token =
    options.token ||
    process.env.WIALON_TOKEN ||
    '561a6efcd9ed8d38d0ff3b80c29253f01653C6698177A6D92E360BBD0D70D0B6AF5240DE';

  const cleanHost = host.replace(/\/+$/, '');
  const cleanReg = options.regNumber.toUpperCase().replace(/\s+/g, '');

  let unitId = WIALON_VALDAI_UNITS[cleanReg];
  if (!unitId) {
    for (const [key, id] of Object.entries(WIALON_VALDAI_UNITS)) {
      if (cleanReg.includes(key.slice(1, 4))) {
        unitId = id;
        break;
      }
    }
  }

  const eid = await getWialonSession(cleanHost, token);

  if (!unitId) {
    try {
      const searchParams = {
        spec: {
          itemsType: 'avl_unit',
          propName: 'sys_name',
          propValueMask: `*${cleanReg.replace(/[^0-9]/g, '')}*`,
          sortType: 'sys_name',
        },
        force: 1,
        flags: 1,
        from: 0,
        to: 0,
      };
      const searchUrl = `${cleanHost}/wialon/ajax.html?svc=core/search_items&params=${encodeURIComponent(
        JSON.stringify(searchParams),
      )}&sid=${eid}`;
      const res = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const json = await res.json();
        const items = json.items || [];
        if (items.length > 0) {
          unitId = items[0].id;
        }
      }
    } catch {}
  }

  if (!unitId) return null;

  // Буфер 45 минут до старта рейса и после финиша рейса
  const fromSec = Math.floor(new Date(options.startedAt).getTime() / 1000) - 2700;
  const toSec = options.endedAt
    ? Math.floor(new Date(options.endedAt).getTime() / 1000) + 2700
    : Math.floor(Date.now() / 1000);

  const msgUrl = `${cleanHost}/wialon/ajax.html?svc=messages/load_interval&params=${encodeURIComponent(
    JSON.stringify({
      itemId: unitId,
      timeFrom: fromSec,
      timeTo: toSec,
      flags: 0,
      flagsMask: 0,
      loadCount: 10000,
    }),
  )}&sid=${eid}`;

  const res = await fetch(msgUrl, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return null;
  const data = await res.json();
  const msgs = data.messages || [];

  if (msgs.length === 0) return null;

  let startOdo: number | null = null;
  let endOdo: number | null = null;
  let startTime = '';
  let endTime = '';

  for (const m of msgs) {
    const rawMileage = m.p?.mileage ?? m.p?.can_mileage ?? m.cnm;
    if (rawMileage !== undefined && rawMileage !== null) {
      const num = Number(rawMileage);
      if (!isNaN(num) && num > 0) {
        const km = num > 2000000 ? Math.round(num / 1000) : Math.round(num);
        const calibratedKm = calibrateWialonOdometer(cleanReg, km);
        if (startOdo === null) {
          startOdo = calibratedKm;
          startTime = new Date(m.t * 1000).toISOString();
        }
        endOdo = calibratedKm;
        endTime = new Date(m.t * 1000).toISOString();
      }
    }
  }

  if (startOdo === null || endOdo === null) return null;

  const wialonKm = Math.max(0, endOdo - startOdo);

  const startMs = new Date(options.startedAt).getTime();
  const endMs = options.endedAt ? new Date(options.endedAt).getTime() : Date.now();
  const diffHours = Math.max(1, (endMs - startMs) / (1000 * 3600));
  const daysCount = Math.max(1, Math.ceil(diffHours / 24));

  const FUEL_RATE_PER_100KM = 18;
  const FUEL_PRICE_TK = 82;
  const normLiters = Number(((wialonKm * FUEL_RATE_PER_100KM) / 100).toFixed(1));
  // Округление ГСМ до 100 ₽ (8 963 ₽ -> 9 000 ₽)
  const normCost = Math.round((normLiters * FUEL_PRICE_TK) / 100) * 100;
  // Округление ЗП до 100 ₽ в меньшую сторону (7 070 ₽ -> 7 000 ₽)
  const driverPay = Math.floor((wialonKm * 10 + daysCount * 1000) / 100) * 100;

  return {
    unitId,
    regNumber: cleanReg,
    wialonKm,
    startOdo,
    endOdo,
    startTime,
    endTime,
    normLiters,
    normCost,
    driverPay,
    daysCount,
  };
}
