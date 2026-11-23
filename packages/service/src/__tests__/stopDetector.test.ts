import { describe, expect, it } from 'vitest';
import { OrganizationTelematicsSettingsSchema } from '@saldacargo/shared';
import type { TelematicsPoint } from '../providers/telematics/types';
import { detectStopsFromTrack } from '../telematics/stopDetector';

const BASE_SETTINGS = OrganizationTelematicsSettingsSchema.parse({
  autopilot_enabled: true,
  base_geofence: {
    name: 'Верхняя Салда',
    lat: 58.053,
    lon: 60.552,
    radius_m: 8000,
    departure_hysteresis_m: 1500,
  },
  thresholds: {
    stop_max_speed_kmh: 5,
    stop_cluster_radius_m: 250,
    stop_min_duration_known_min: 15,
    stop_min_duration_unknown_min: 25,
    noise_speed_spike_limit: 2,
  },
  transit_rules: {
    enabled: true,
    east_departure_lon_threshold: 60.55,
    west_exit_lon_threshold: 60.35,
    max_transit_hours: 36,
  },
});

describe('detectStopsFromTrack — GPS track simulations', () => {
  it('1. Погрузка с GPS-шумом: одиночные всплески скорости 9 км/ч внутри 150м не разрывают стоянку', () => {
    const t0 = 1_760_000_000;
    const points: TelematicsPoint[] = [];

    // 40 минут стоянки на складе в Шайтанке (каждые 2 минуты пакет),
    // на 12-й и 26-й минуте — одиночный GPS-выброс скорости 9 км/ч внутри 100 м
    for (let m = 0; m <= 40; m += 2) {
      const isSpike = m === 12 || m === 26;
      points.push({
        lat: 58.0361 + (isSpike ? 0.0005 : 0),
        lon: 60.911 + (isSpike ? 0.0005 : 0),
        speedKmh: isSpike ? 9 : 0,
        timestampSec: t0 + m * 60,
        rawOdometerKm: 100_000,
      });
    }
    // Отъезд
    points.push({
      lat: 58.05,
      lon: 60.95,
      speedKmh: 55,
      timestampSec: t0 + 44 * 60,
      rawOdometerKm: 100_005,
    });

    const res = detectStopsFromTrack(points, BASE_SETTINGS, { tripId: 'trip-1' });
    expect(res.stops).toHaveLength(1);
    expect(res.stops[0]?.durationMin).toBeGreaterThanOrEqual(38);
    expect(res.stops[0]?.isBase).toBe(false);

    // Повторный прогон генерирует идентичный детерминированный stopKey
    const res2 = detectStopsFromTrack(points, BASE_SETTINGS, { tripId: 'trip-1' });
    expect(res2.stops[0]?.stopKey).toBe(res.stops[0]?.stopKey);
  });

  it('2. Пробка на трассе: 25 мин со скоростью 3 км/ч и смещением на 1.2 км не создаёт ложную точку', () => {
    const t0 = 1_760_000_000;
    const points: TelematicsPoint[] = [];

    // 25 минут ползём со скоростью 3 км/ч, каждую минуту смещаясь на ~50 м (всего 1.25 км)
    for (let m = 0; m <= 25; m++) {
      points.push({
        lat: 57.8 + m * 0.00045, // ~50 м по широте за минуту
        lon: 60.2,
        speedKmh: 3,
        timestampSec: t0 + m * 60,
        rawOdometerKm: 100_000 + Math.floor(m / 20),
      });
    }

    const res = detectStopsFromTrack(points, BASE_SETTINGS, { tripId: 'trip-2' });
    expect(res.stops).toHaveLength(0);
    expect(res.hasDepartedWest).toBe(true);
  });

  it('3. Потеря GPS в ангаре: тишина 55 мин в тех же координатах фиксируется как стоянка (hadSignalGap=true)', () => {
    const t0 = 1_760_000_000;
    const points: TelematicsPoint[] = [
      // Подъезд
      { lat: 56.45, lon: 61.4, speedKmh: 50, timestampSec: t0, rawOdometerKm: 100_100 },
      // Остановка перед въездом в ангар
      { lat: 56.4334, lon: 61.4088, speedKmh: 0, timestampSec: t0 + 300, rawOdometerKm: 100_102 },
      // 55 минут полной тишины GPS, затем выезд из того же ангара (+80 м, скорость 18 км/ч)
      {
        lat: 56.434,
        lon: 61.4092,
        speedKmh: 18,
        timestampSec: t0 + 300 + 55 * 60,
        rawOdometerKm: 100_102,
      },
      // Движение по трассе
      {
        lat: 56.5,
        lon: 61.35,
        speedKmh: 70,
        timestampSec: t0 + 300 + 62 * 60,
        rawOdometerKm: 100_110,
      },
    ];

    const res = detectStopsFromTrack(points, BASE_SETTINGS, { tripId: 'trip-3' });
    expect(res.stops).toHaveLength(1);
    expect(res.stops[0]?.durationMin).toBe(55);
    expect(res.stops[0]?.hadSignalGap).toBe(true);
  });

  it('4. Потеря GPS в движении: тишина 55 мин со смещением на 45 км НЕ засчитывается как стоянка', () => {
    const t0 = 1_760_000_000;
    const points: TelematicsPoint[] = [
      { lat: 57.5, lon: 60.8, speedKmh: 0, timestampSec: t0, rawOdometerKm: 100_100 },
      // Пропал GPS на 55 минут, машина уехала на 45 км южнее
      { lat: 57.1, lon: 60.8, speedKmh: 65, timestampSec: t0 + 55 * 60, rawOdometerKm: 100_145 },
    ];

    const res = detectStopsFromTrack(points, BASE_SETTINGS, { tripId: 'trip-4' });
    expect(res.stops).toHaveLength(0);
    expect(res.trackDistanceKm).toBeGreaterThanOrEqual(40);
  });
});
