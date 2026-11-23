import type { SupabaseClient } from '@supabase/supabase-js';
import type { TelematicsKnownGeofence } from '@saldacargo/shared';
import type { Database } from '@saldacargo/shared-types';
import { calculateDistanceMeters } from '../providers/telematics/types';

export interface GeocodedStopInfo {
  geofenceId: string | null;
  name: string;
  city: string;
  rawAddress: string;
  isKnown: boolean;
  isServiceOrRestStop: boolean;
  role?: 'loading' | 'unloading' | 'any';
}

export type StopGeocoder = (lat: number, lon: number) => Promise<GeocodedStopInfo>;

const FUEL_KEYWORDS = [
  'азс',
  'заправка',
  'газпромнефть',
  'лукойл',
  'роснефть',
  'татнефть',
  'башнефть',
  'тебойл',
];

const FOOD_KEYWORDS = ['кафе', 'столовая', 'пит-стоп', 'вкусно — и точка', 'шаурма', 'ресторан'];

const REST_KEYWORDS = ['стоянка дальнобой', 'место отдыха', 'автостоянка'];

export function classifyServiceOrRestStop(
  amenity: string,
  osmType: string,
  displayName: string,
): boolean {
  const amen = amenity.toLowerCase();
  const type = osmType.toLowerCase();
  const disp = displayName.toLowerCase();

  if (amen === 'fuel' || FUEL_KEYWORDS.some((k) => disp.includes(k))) return true;
  if (
    amen === 'cafe' ||
    amen === 'fast_food' ||
    amen === 'restaurant' ||
    FOOD_KEYWORDS.some((k) => disp.includes(k))
  ) {
    return true;
  }
  if (
    amen === 'parking' ||
    type === 'rest_area' ||
    type === 'services' ||
    REST_KEYWORDS.some((k) => disp.includes(k))
  ) {
    return true;
  }
  return false;
}

export function matchKnownGeofence(
  lat: number,
  lon: number,
  knownGeofences: readonly TelematicsKnownGeofence[],
): GeocodedStopInfo | null {
  for (const gf of knownGeofences) {
    if (calculateDistanceMeters(lat, lon, gf.lat, gf.lon) <= gf.radius_m) {
      return {
        geofenceId: gf.id,
        name: gf.name,
        city: gf.city,
        rawAddress: gf.raw_address,
        isKnown: true,
        isServiceOrRestStop: false,
        role: gf.role,
      };
    }
  }
  return null;
}

/**
 * Создаёт геокодер с 3 уровнями разрешения:
 * 1. Каталог `known_geofences` организации (0 мс, 0 сетевых запросов)
 * 2. БД-кэш `telematics_geocode_cache` по сетке ~100 м (TTL 30 дней)
 * 3. OpenStreetMap Nominatim (таймаут 4с) с сохранением результата в кэш
 */
export function createCachedStopGeocoder(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  knownGeofences: readonly TelematicsKnownGeofence[],
  options?: { disableExternalFetch?: boolean },
): StopGeocoder {
  const memoryCache = new Map<string, GeocodedStopInfo>();

  return async (lat: number, lon: number): Promise<GeocodedStopInfo> => {
    // 1. Известные геозоны организации
    const known = matchKnownGeofence(lat, lon, knownGeofences);
    if (known) return known;

    const latGrid = Math.round(lat * 1000);
    const lonGrid = Math.round(lon * 1000);
    const memKey = `${latGrid}:${lonGrid}`;
    const inMem = memoryCache.get(memKey);
    if (inMem) return inMem;

    // 2. БД-кэш
    const { data: cached } = await supabase
      .from('telematics_geocode_cache')
      .select('city, raw_address, name, is_service_stop, expires_at')
      .eq('organization_id', organizationId)
      .eq('lat_grid', latGrid)
      .eq('lon_grid', lonGrid)
      .maybeSingle();

    if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
      const hit: GeocodedStopInfo = {
        geofenceId: null,
        name: cached.name,
        city: cached.city,
        rawAddress: cached.raw_address,
        isKnown: false,
        isServiceOrRestStop: cached.is_service_stop,
      };
      memoryCache.set(memKey, hit);
      return hit;
    }

    // 3. Внешний Nominatim (если не отключён)
    if (!options?.disableExternalFetch) {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=16&addressdetails=1`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'SaldaCargoFleet/2.0 (contact@saldacargo.ru)' },
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          const json = (await res.json()) as {
            address?: Record<string, string | undefined>;
            type?: string;
            category?: string;
            display_name?: string;
          };
          const addr = json.address ?? {};
          const amen = String(addr.amenity ?? json.type ?? json.category ?? '');
          const disp = String(json.display_name ?? '');
          const isService = classifyServiceOrRestStop(amen, String(json.type ?? ''), disp);
          const city =
            addr.city ?? addr.town ?? addr.village ?? addr.hamlet ?? addr.county ?? 'Неизвестно';
          const rawAddress = disp.split(',').slice(0, 3).join(',').trim() || city;

          const resolved: GeocodedStopInfo = {
            geofenceId: null,
            name: city,
            city,
            rawAddress,
            isKnown: false,
            isServiceOrRestStop: isService,
          };

          memoryCache.set(memKey, resolved);

          // Сохраняем в БД-кэш (игнорируем ошибки записи кэша)
          await supabase.from('telematics_geocode_cache').upsert(
            {
              organization_id: organizationId,
              lat_grid: latGrid,
              lon_grid: lonGrid,
              city,
              raw_address: rawAddress,
              name: city,
              is_service_stop: isService,
              expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
            },
            { onConflict: 'organization_id,lat_grid,lon_grid' },
          );

          return resolved;
        }
      } catch {
        // Fallback ниже — не блокируем обработку машины
      }
    }

    const fallback: GeocodedStopInfo = {
      geofenceId: null,
      name: `Точка (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
      city: `GPS ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      rawAddress: `GPS координаты: ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      isKnown: false,
      isServiceOrRestStop: false,
    };
    memoryCache.set(memKey, fallback);
    return fallback;
  };
}
