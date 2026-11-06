/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';
import { handleVehicleDeparture, handleVehicleArrival } from './wialonOrderSync';

// Координаты центра Верхней Салды и радиус границы города (в метрах)
const SALDA_BASE_LAT = parseFloat(process.env.WIALON_BASE_LAT || '58.053');
const SALDA_BASE_LON = parseFloat(process.env.WIALON_BASE_LON || '60.552');
const SALDA_BASE_RADIUS = parseFloat(process.env.WIALON_BASE_RADIUS_METERS || '8000'); // 8 км

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
 * 2. Опрос 4 Валдаев и получение их текущих координат и одометров
 */
export async function fetchWialonValdaiPositions(
  host: string,
  token: string,
): Promise<WialonUnitPosition[]> {
  const cleanHost = host.replace(/\/+$/, '');
  const eid = await getWialonSession(cleanHost, token);

  // Флаги: 1 (base info) + 1024 (pos) + 4096 (counters)
  const flags = 1 + 1024 + 4096;
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
    const lat = pos.y || 0;
    const lon = pos.x || 0;
    const speed = pos.s || 0;
    const time = pos.t || 0;

    // Одометр в Wialon (cnm — счетчик пробега)
    let odoKm = 0;
    if (item.cnm) {
      odoKm = Math.round(Number(item.cnm));
    }

    const distMeters = calculateDistanceMeters(lat, lon, SALDA_BASE_LAT, SALDA_BASE_LON);
    const distKm = Number((distMeters / 1000).toFixed(2));
    const isInsideBase = distMeters <= SALDA_BASE_RADIUS;

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
    const effectiveOdo = pos.odometerKm > 0 ? pos.odometerKm : asset.odometer_current || 120000;

    // СОБЫТИЕ 1: Выезд за пределы Верхней Салды (СТАРТ РЕЙСА)
    if (prevInside && !currentInside) {
      console.log(
        `[Wialon Tracker] 🚀 Валдай ${pos.regNumber} ВЫЕХАЛ из Салды (${pos.distanceFromBaseKm} км от центра)`,
      );
      const res = await handleVehicleDeparture(supabase, {
        vehicleId: asset.id,
        odometer: effectiveOdo,
        timestamp: new Date().toISOString(),
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
      const res = await handleVehicleArrival(supabase, {
        vehicleId: asset.id,
        odometer: effectiveOdo,
        timestamp: new Date().toISOString(),
      });
      eventsTriggered.push({
        event: 'arrival',
        regNumber: pos.regNumber,
        distanceFromBaseKm: pos.distanceFromBaseKm,
        res,
      });
    }

    // Сохраняем обновленное состояние в заметки актива
    stateData.is_inside = currentInside;
    stateData.last_lat = pos.lat;
    stateData.last_lon = pos.lon;

    const cleanNotes = notes.replace(/\[WIALON_STATE:\{.*?\}\]/g, '').trim();
    const updatedNotes = `${cleanNotes ? cleanNotes + '\n' : ''}[WIALON_STATE:${JSON.stringify(stateData)}]`;

    await supabase
      .from('assets')
      .update({
        notes: updatedNotes,
        odometer_current: effectiveOdo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', asset.id);
  }

  return {
    success: true,
    checkedCount: positions.length,
    positions,
    eventsTriggered,
  };
}
