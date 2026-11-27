import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_ORGANIZATION_SETTINGS,
  OrganizationSettingsSchema,
  OrganizationTelematicsSettingsSchema,
} from '@saldacargo/shared';
import type { TelematicsProvider, TelematicsUnitSnapshot } from '../providers/telematics/types';
import {
  evaluateVehicleTelemetry,
  type ActiveTripContext,
  type VehicleStateSnapshot,
} from '../telematics/stateMachine';
import { processVehicleSnapshot, type AssetForTelematics } from '../telematics/autopilotEngine';
import { classifyServiceOrRestStop, matchKnownGeofence } from '../telematics/geocodeCache';
import { executeAutopilotCommand } from '../telematics/tripCommands';

const TENANT1_TELEMATICS = OrganizationTelematicsSettingsSchema.parse({
  autopilot_enabled: true,
  base_geofence: {
    name: 'Верхняя Салда',
    lat: 58.053,
    lon: 60.552,
    radius_m: 8000,
    departure_hysteresis_m: 1500,
  },
  thresholds: {
    min_moving_speed_kmh: 10,
    stop_max_speed_kmh: 5,
    stop_cluster_radius_m: 250,
    stop_min_duration_known_min: 15,
    stop_min_duration_unknown_min: 25,
    arrival_confirm_min: 5,
    min_trip_distance_km: 10,
    max_gps_age_min: 30,
    noise_speed_spike_limit: 2,
  },
  known_geofences: [
    {
      id: 'shaytanka',
      name: 'Шайтанка (Рудник)',
      city: 'Шайтанка',
      raw_address: 'Шайтанка',
      lat: 58.0361,
      lon: 60.911,
      radius_m: 10000,
      role: 'loading',
    },
    {
      id: 'maminskoe',
      name: 'с. Маминское (склад 2)',
      city: 'Маминское',
      raw_address: 'с. Маминское, склад 2',
      lat: 56.4334,
      lon: 61.4088,
      radius_m: 20000,
      role: 'unloading',
    },
  ],
  transit_rules: {
    enabled: true,
    east_departure_lon_threshold: 60.55,
    west_exit_lon_threshold: 60.35,
    max_transit_hours: 36,
  },
  tariffs: {
    fuel_rate_per_100km: 18,
    driver_pay_per_km: 10,
    driver_per_diem: 1000,
    min_km_for_per_diem: 100,
  },
});

const INITIAL_STATE: VehicleStateSnapshot = {
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

describe('evaluateVehicleTelemetry — State Machine simulations', () => {
  const nowMs = Date.parse('2026-11-23T08:00:00Z');
  const nowSec = Math.floor(nowMs / 1000);

  it('1. Выезд с базы + гистерезис: 8.3 км игнорируется, 10.5 км открывает рейс (без дублей)', () => {
    // 8.3 км на запад (внутри гистерезиса 8 + 1.5 = 9.5 км), скорость 5 км/ч
    const nearEdge = evaluateVehicleTelemetry({
      source: 'cron',
      nowMs,
      settings: TENANT1_TELEMATICS,
      prevState: INITIAL_STATE,
      position: { lat: 58.053, lon: 60.411, speedKmh: 5, timestampSec: nowSec - 10 },
      calibratedOdometerKm: 150_000,
      activeTrip: null,
    });
    expect(nearEdge.commands).toHaveLength(0);
    expect(nearEdge.diagnostics[0]?.reasonCode).toBe('HYSTERESIS_NOT_CROSSED');

    // 11 км на запад (за гистерезисом) -> OPEN_TRIP
    const departed = evaluateVehicleTelemetry({
      source: 'cron',
      nowMs: nowMs + 60_000,
      settings: TENANT1_TELEMATICS,
      prevState: nearEdge.nextState,
      position: { lat: 58.053, lon: 60.36, speedKmh: 62, timestampSec: nowSec + 50 },
      calibratedOdometerKm: 150_003,
      activeTrip: null,
    });
    expect(departed.commands).toHaveLength(1);
    expect(departed.commands[0]?.type).toBe('OPEN_TRIP');
    expect(departed.nextState.state).toBe('EN_ROUTE');
  });

  it('2. Заправка/кафе на трассе: стоянка 35 мин на АЗС игнорируется (STOP_IS_SERVICE_OR_FUEL)', () => {
    const activeTrip: ActiveTripContext = {
      orderId: 'ord-1',
      tripId: 'trip-1',
      startedAtIso: '2026-11-23T06:00:00Z',
      startOdometerKm: 150_000,
      recordedStopKeys: [],
      departureDirection: 'west',
      hasDepartedWest: true,
      hasUnloaded: false,
      transitAllowed: false,
      visitedPresetGeofenceIds: [],
    };

    const res = evaluateVehicleTelemetry({
      source: 'cron',
      nowMs,
      settings: TENANT1_TELEMATICS,
      prevState: { ...INITIAL_STATE, state: 'EN_ROUTE' },
      position: { lat: 57.5, lon: 60.2, speedKmh: 0, timestampSec: nowSec - 10 },
      calibratedOdometerKm: 150_080,
      activeTrip,
      candidateStops: [
        {
          stop: {
            stopKey: 'trip-1:57500:60200:100',
            lat: 57.5,
            lon: 60.2,
            startTs: nowSec - 2100,
            endTs: nowSec,
            durationMin: 35,
            isBase: false,
            distFromBaseKm: 65,
            odometerKm: 150_080,
            hadSignalGap: false,
          },
          geo: {
            geofenceId: null,
            name: 'АЗС Газпромнефть',
            city: 'Нижний Тагил',
            rawAddress: 'АЗС Газпромнефть, Серовский тракт',
            isKnown: false,
            isServiceOrRestStop: true,
          },
        },
      ],
    });

    expect(res.commands).toHaveLength(0);
    expect(res.diagnostics[0]?.decision).toBe('stop_ignored');
    expect(res.diagnostics[0]?.reasonCode).toBe('STOP_IS_SERVICE_OR_FUEL');
  });

  it('3. Запись точки погрузки/выгрузки и идемпотентность (повторный stopKey не дублируется)', () => {
    const stopKey = 'trip-1:58036:60911:100';
    const baseTrip: ActiveTripContext = {
      orderId: 'ord-1',
      tripId: 'trip-1',
      startedAtIso: '2026-11-23T06:00:00Z',
      startOdometerKm: 150_000,
      recordedStopKeys: [],
      departureDirection: 'east',
      hasDepartedWest: false,
      hasUnloaded: false,
      transitAllowed: true,
      visitedPresetGeofenceIds: [],
    };

    const stopCandidate = {
      stop: {
        stopKey,
        lat: 58.0361,
        lon: 60.911,
        startTs: nowSec - 1200,
        endTs: nowSec,
        durationMin: 20,
        isBase: false,
        distFromBaseKm: 21,
        odometerKm: 150_022,
        hadSignalGap: false,
      },
      geo: {
        geofenceId: 'shaytanka',
        name: 'Шайтанка (Рудник)',
        city: 'Шайтанка',
        rawAddress: 'Шайтанка',
        isKnown: true,
        isServiceOrRestStop: false,
        role: 'loading' as const,
      },
    };

    const first = evaluateVehicleTelemetry({
      source: 'cron',
      nowMs,
      settings: TENANT1_TELEMATICS,
      prevState: { ...INITIAL_STATE, state: 'EN_ROUTE' },
      position: { lat: 58.0361, lon: 60.911, speedKmh: 0, timestampSec: nowSec - 10 },
      calibratedOdometerKm: 150_022,
      activeTrip: baseTrip,
      candidateStops: [stopCandidate],
    });
    expect(first.commands).toHaveLength(1);
    expect(first.commands[0]?.type).toBe('RECORD_STOP');

    // Повторный прогон с тем же stopKey в recordedStopKeys -> 0 команд
    const second = evaluateVehicleTelemetry({
      source: 'cron',
      nowMs: nowMs + 120_000,
      settings: TENANT1_TELEMATICS,
      prevState: first.nextState,
      position: { lat: 58.0361, lon: 60.911, speedKmh: 0, timestampSec: nowSec + 110 },
      calibratedOdometerKm: 150_022,
      activeTrip: { ...baseTrip, recordedStopKeys: [stopKey] },
      candidateStops: [stopCandidate],
    });
    expect(second.commands).toHaveLength(0);
  });

  it('4. Транзит Тенанта №1 (ночёвка в Салде) -> выезд на запад -> возврат на базу -> review', () => {
    const shaytankaTrip: ActiveTripContext = {
      orderId: 'ord-sh',
      tripId: 'trip-sh',
      startedAtIso: '2026-11-22T18:00:00Z',
      startOdometerKm: 150_000,
      recordedStopKeys: ['trip-sh:58036:60911:100'],
      departureDirection: 'east',
      hasDepartedWest: false,
      hasUnloaded: false,
      transitAllowed: true,
      visitedPresetGeofenceIds: ['shaytanka'],
    };

    // Въезд на базу после Шайтанки -> IN_BASE_TRANSIT (рейс НЕ закрыт)
    const transit = evaluateVehicleTelemetry({
      source: 'cron',
      nowMs,
      settings: TENANT1_TELEMATICS,
      prevState: { ...INITIAL_STATE, state: 'EN_ROUTE' },
      position: { lat: 58.053, lon: 60.552, speedKmh: 0, timestampSec: nowSec - 10 },
      calibratedOdometerKm: 150_045,
      activeTrip: shaytankaTrip,
    });
    expect(transit.nextState.state).toBe('IN_BASE_TRANSIT');
    expect(transit.commands[0]?.type).toBe('ENTER_TRANSIT');

    // Утром выезд на запад (на Тагил / Маминское) -> RESUME_FROM_TRANSIT (exitedWest=true)
    const morningMs = nowMs + 10 * 3600 * 1000;
    const resumed = evaluateVehicleTelemetry({
      source: 'cron',
      nowMs: morningMs,
      settings: TENANT1_TELEMATICS,
      prevState: transit.nextState,
      position: {
        lat: 58.053,
        lon: 60.3,
        speedKmh: 65,
        timestampSec: Math.floor(morningMs / 1000) - 10,
      },
      calibratedOdometerKm: 150_070,
      activeTrip: shaytankaTrip,
    });
    expect(resumed.nextState.state).toBe('EN_ROUTE');
    expect(resumed.commands[0]).toMatchObject({ type: 'RESUME_FROM_TRANSIT', exitedWest: true });

    // Вечером возврат на базу после выгрузки (hasDepartedWest=true) + подтверждение 6 мин -> CLOSE_TRIP_TO_REVIEW
    const eveningMs = morningMs + 8 * 3600 * 1000;
    const arrive1 = evaluateVehicleTelemetry({
      source: 'cron',
      nowMs: eveningMs,
      settings: TENANT1_TELEMATICS,
      prevState: resumed.nextState,
      position: {
        lat: 58.053,
        lon: 60.552,
        speedKmh: 12,
        timestampSec: Math.floor(eveningMs / 1000) - 10,
      },
      calibratedOdometerKm: 150_590,
      activeTrip: { ...shaytankaTrip, hasDepartedWest: true, hasUnloaded: true },
    });
    expect(arrive1.commands).toHaveLength(0); // ждём arrival_confirm_min

    const arrive2 = evaluateVehicleTelemetry({
      source: 'cron',
      nowMs: eveningMs + 6 * 60 * 1000,
      settings: TENANT1_TELEMATICS,
      prevState: arrive1.nextState,
      position: {
        lat: 58.053,
        lon: 60.552,
        speedKmh: 0,
        timestampSec: Math.floor((eveningMs + 6 * 60 * 1000) / 1000) - 10,
      },
      calibratedOdometerKm: 150_590,
      activeTrip: { ...shaytankaTrip, hasDepartedWest: true, hasUnloaded: true },
    });
    expect(arrive2.nextState.state).toBe('AT_BASE');
    expect(arrive2.commands[0]).toMatchObject({
      type: 'CLOSE_TRIP_TO_REVIEW',
      reason: 'normal_arrival',
    });
  });

  it('5. Защита от «вечного транзита» (36ч) и Тенант №2 без транзита', () => {
    const trip: ActiveTripContext = {
      orderId: 'ord-t',
      tripId: 'trip-t',
      startedAtIso: '2026-11-21T10:00:00Z',
      startOdometerKm: 150_000,
      recordedStopKeys: [],
      departureDirection: 'east',
      hasDepartedWest: false,
      hasUnloaded: false,
      transitAllowed: true,
      visitedPresetGeofenceIds: ['shaytanka'],
    };

    // 37 часов в транзите (>= 36ч) -> принудительное закрытие в review
    const after37h = nowMs + 37 * 3600 * 1000;
    const timeoutRes = evaluateVehicleTelemetry({
      source: 'cron',
      nowMs: after37h,
      settings: TENANT1_TELEMATICS,
      prevState: {
        ...INITIAL_STATE,
        state: 'IN_BASE_TRANSIT',
        transitEnteredAtIso: new Date(nowMs).toISOString(),
      },
      position: {
        lat: 58.053,
        lon: 60.552,
        speedKmh: 0,
        timestampSec: Math.floor(after37h / 1000) - 10,
      },
      calibratedOdometerKm: 150_045,
      activeTrip: trip,
    });
    expect(timeoutRes.commands[0]).toMatchObject({
      type: 'CLOSE_TRIP_TO_REVIEW',
      reason: 'transit_timeout',
    });
    expect(timeoutRes.diagnostics[0]?.reasonCode).toBe('TRANSIT_TIMEOUT_CLOSE');

    // Тенант №2 (transit_rules.enabled = false): возврат сразу закрывает рейс
    const tenant2Settings = OrganizationTelematicsSettingsSchema.parse({
      ...TENANT1_TELEMATICS,
      transit_rules: { enabled: false, max_transit_hours: 36 },
    });
    const t2Res = evaluateVehicleTelemetry({
      source: 'webhook',
      webhookHint: 'arrival',
      nowMs,
      settings: tenant2Settings,
      prevState: { ...INITIAL_STATE, state: 'EN_ROUTE' },
      position: { lat: 58.053, lon: 60.552, speedKmh: 0, timestampSec: nowSec - 5 },
      calibratedOdometerKm: 150_045,
      activeTrip: trip,
    });
    expect(t2Res.commands[0]?.type).toBe('CLOSE_TRIP_TO_REVIEW');
  });

  it('6. Self-Healing (пропущенный выезд и пропущенный возврат) + битый/устаревший GPS', () => {
    // Битый GPS (0, 0)
    const badGps = evaluateVehicleTelemetry({
      source: 'cron',
      nowMs,
      settings: TENANT1_TELEMATICS,
      prevState: { ...INITIAL_STATE, state: 'EN_ROUTE' },
      position: { lat: 0, lon: 0, speedKmh: 0, timestampSec: nowSec },
      calibratedOdometerKm: 150_000,
      activeTrip: null,
    });
    expect(badGps.commands).toHaveLength(0);
    expect(badGps.nextState.state).toBe('EN_ROUTE');
    expect(badGps.diagnostics[0]?.reasonCode).toBe('GPS_ZERO_OR_INVALID_COORDS');

    // Устаревший GPS (90 мин > 30 мин)
    const staleGps = evaluateVehicleTelemetry({
      source: 'cron',
      nowMs,
      settings: TENANT1_TELEMATICS,
      prevState: INITIAL_STATE,
      position: { lat: 57.5, lon: 60.2, speedKmh: 60, timestampSec: nowSec - 90 * 60 },
      calibratedOdometerKm: 150_000,
      activeTrip: null,
    });
    expect(staleGps.commands).toHaveLength(0);
    expect(staleGps.diagnostics[0]?.reasonCode).toBe('GPS_DATA_STALE');

    // Self-healing выезда: машина уже EN_ROUTE (в 40 км от базы), но activeTrip=null -> OPEN_TRIP
    const selfHealOpen = evaluateVehicleTelemetry({
      source: 'cron',
      nowMs,
      settings: TENANT1_TELEMATICS,
      prevState: { ...INITIAL_STATE, state: 'EN_ROUTE' },
      position: { lat: 57.7, lon: 60.1, speedKmh: 65, timestampSec: nowSec - 10 },
      calibratedOdometerKm: 150_040,
      activeTrip: null,
    });
    expect(selfHealOpen.commands[0]?.type).toBe('OPEN_TRIP');
    expect(selfHealOpen.diagnostics[0]?.reasonCode).toBe('DEPARTURE_SELF_HEALED');
  });
});

describe('processVehicleSnapshot — concurrency lock & manual driver_pay invariant', () => {
  it('7. Гонка Cron ↔ Webhook: занятый lease-lock безопасно пропускает второй запуск (ignored_duplicate_lock)', async () => {
    const insertedEvents: Array<Record<string, unknown>> = [];

    const mockSupabase = {
      from: (table: string) => {
        if (table === 'vehicle_telematics_state') {
          return {
            update: () => ({
              eq: () => ({
                eq: () => ({
                  or: () => ({
                    select: () => ({
                      maybeSingle: async () => ({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
            insert: () => ({
              select: () => ({
                maybeSingle: async () => ({
                  data: null,
                  error: { code: '23505', message: 'duplicate key' },
                }),
              }),
            }),
          };
        }
        if (table === 'telematics_events') {
          return {
            insert: async (rows: Array<Record<string, unknown>>) => {
              insertedEvents.push(...rows);
              return { error: null };
            },
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    } as unknown as SupabaseClient;

    const provider: TelematicsProvider = {
      providerId: 'wialon',
      fetchUnitsSnapshot: vi.fn(async () => []),
      fetchTrack: vi.fn(async () => []),
    };

    const asset: AssetForTelematics = {
      id: 'asset-1',
      reg_number: 'А096МВ196',
      short_name: 'Валдай 096',
      wialon_id: '11873',
      odometer_current: 460_000,
      odometer_offset_km: 266_504,
      assigned_driver_id: 'drv-1',
    };

    const snapshot: TelematicsUnitSnapshot = {
      externalUnitId: '11873',
      unitName: 'А096МВ196',
      position: {
        lat: 58.053,
        lon: 60.552,
        speedKmh: 0,
        timestampSec: Math.floor(Date.now() / 1000),
      },
      isOnline: true,
    };

    const outcome = await processVehicleSnapshot({
      supabase: mockSupabase,
      organizationId: '00000000-0000-4000-8000-000000000001',
      orgSettings: OrganizationSettingsSchema.parse({
        ...DEFAULT_ORGANIZATION_SETTINGS,
        telematics: TENANT1_TELEMATICS,
      }),
      asset,
      provider,
      snapshot,
      source: 'webhook',
      webhookHint: 'arrival',
    });

    expect(outcome.skippedReason).toBe('locked_by_concurrent_run');
    expect(outcome.commandsExecuted).toHaveLength(0);
    expect(insertedEvents).toHaveLength(1);
    expect(insertedEvents[0]?.decision).toBe('ignored_duplicate_lock');
    expect(insertedEvents[0]?.reason_code).toBe('LOCKED_BY_CONCURRENT_RUN');
  });

  it('8. CLOSE_TRIP_TO_REVIEW: переводит заказ в pending_review, рейс в completed/draft, создаёт ГСМ и НЕ перезаписывает driver_pay', async () => {
    const orderUpdates: Array<Record<string, unknown>> = [];
    const tripUpdates: Array<Record<string, unknown>> = [];
    const tripOrderUpserts: Array<Record<string, unknown>> = [];
    const fuelUpserts: Array<Record<string, unknown>> = [];

    const mockSupabase = {
      from: (table: string) => {
        if (table === 'orders') {
          return {
            update: (payload: Record<string, unknown>) => {
              orderUpdates.push(payload);
              return {
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      select: () => ({
                        maybeSingle: async () => ({
                          data: {
                            id: 'ord-close-1',
                            client_id: 'client-1',
                            price_without_vat: 40000,
                            raw_parser_payload: {},
                          },
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              };
            },
          };
        }
        if (table === 'trips') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: 'trip-close-1',
                      started_at: '2026-11-23T04:00:00Z',
                      odometer_start: 150_000,
                      admin_note: null,
                    },
                    error: null,
                  }),
                }),
              }),
            }),
            update: (payload: Record<string, unknown>) => {
              tripUpdates.push(payload);
              return { eq: () => ({ eq: async () => ({ error: null }) }) };
            },
          };
        }
        if (table === 'trip_expenses') {
          return {
            upsert: async (payload: Record<string, unknown>) => {
              fuelUpserts.push(payload);
              return { error: null };
            },
          };
        }
        if (table === 'trip_orders') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  neq: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
            upsert: async (payload: Record<string, unknown>) => {
              tripOrderUpserts.push(payload);
              return { error: null };
            },
          };
        }
        if (table === 'assets') {
          return {
            update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    } as unknown as SupabaseClient;

    await executeAutopilotCommand(
      {
        supabase: mockSupabase,
        organizationId: '00000000-0000-4000-8000-000000000001',
        assetId: 'asset-1',
        assignedDriverId: 'drv-1',
        currentOdometerKm: 150_000,
        orgSettings: OrganizationSettingsSchema.parse({
          ...DEFAULT_ORGANIZATION_SETTINGS,
          telematics: TENANT1_TELEMATICS,
        }),
      },
      {
        type: 'CLOSE_TRIP_TO_REVIEW',
        orderId: 'ord-close-1',
        tripId: 'trip-close-1',
        arrivalTimeIso: '2026-11-23T14:00:00Z',
        odometerKm: 150_500,
        reason: 'normal_arrival',
      },
    );

    expect(orderUpdates[0]?.status).toBe('pending_review');
    expect(
      (orderUpdates[1]?.raw_parser_payload as Record<string, unknown>)?.suggested_driver_pay,
    ).toBe('6000.00');
    expect(tripUpdates[0]?.status).toBe('completed');
    expect(tripUpdates[0]?.lifecycle_status).toBe('draft');
    expect(String(tripUpdates[0]?.admin_note)).toContain('Подсказка ЗП: 6000 ₽');
    expect(fuelUpserts).toHaveLength(1);
    expect(typeof fuelUpserts[0]?.idempotency_key).toBe('string');
    expect(tripOrderUpserts).toHaveLength(1);
    // Инвариант ручной ЗП: автосозданный trip_order всегда с driver_pay = "0.00"
    expect(tripOrderUpserts[0]?.driver_pay).toBe('0.00');
  });

  it('10. После паузы крона > 6 ч (22 ч в пути) fetchTrack запрашивает трек с начала рейса, а не обрезает 6 часами', async () => {
    const tripStartedIso = '2026-11-26T05:03:27Z';
    const tripStartSec = Math.floor(Date.parse(tripStartedIso) / 1000);
    const nowMs = Date.parse('2026-11-27T03:35:00Z'); // +22.5 ч от выезда
    const nowSec = Math.floor(nowMs / 1000);

    const fetchTrackMock = vi.fn(async () => []);
    const provider: TelematicsProvider = {
      providerId: 'wialon',
      fetchUnitsSnapshot: vi.fn(async () => []),
      fetchTrack: fetchTrackMock,
    };

    const mockSupabase = {
      from: (table: string) => {
        if (table === 'vehicle_telematics_state') {
          return {
            update: () => ({
              eq: () => ({
                eq: () => ({
                  or: () => ({
                    select: () => ({
                      maybeSingle: async () => ({
                        data: {
                          state: 'EN_ROUTE',
                          base_confirm_since: null,
                          depart_confirm_count: 0,
                          transit_entered_at: null,
                          last_msg_ts: tripStartSec,
                          last_lat: 58.025,
                          last_lon: 60.498,
                          last_speed: 62,
                          last_odometer_km: 468596,
                        },
                        error: null,
                      }),
                    }),
                  }),
                  eq: async () => ({ error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'orders') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    order: () => ({
                      limit: () => ({
                        maybeSingle: async () => ({
                          data: {
                            id: 'ord-1096',
                            active_trip_id: 'trip-1096',
                            routes_json: [],
                            raw_parser_payload: {
                              autopilot_v2: true,
                              departure_direction: 'west',
                              has_departed_west: true,
                            },
                            trip: {
                              id: 'trip-1096',
                              started_at: tripStartedIso,
                              odometer_start: 468596,
                            },
                          },
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'telematics_events') {
          return { insert: async () => ({ error: null }) };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    } as unknown as SupabaseClient;

    const asset: AssetForTelematics = {
      id: 'asset-1096',
      reg_number: 'А096МВ196',
      short_name: 'Валдай 6м',
      wialon_id: '11873',
      odometer_current: 468596,
      odometer_offset_km: 0,
      assigned_driver_id: 'drv-1',
    };

    const snapshot: TelematicsUnitSnapshot = {
      externalUnitId: '11873',
      unitName: 'Нигамедьянов А096МВ196',
      plateHint: 'А096МВ196',
      isOnline: true,
      position: {
        lat: 59.668,
        lon: 60.235,
        speedKmh: 69,
        timestampSec: nowSec - 15,
        rawOdometerKm: 469100,
      },
    };

    await processVehicleSnapshot({
      supabase: mockSupabase,
      organizationId: '00000000-0000-4000-8000-000000000001',
      orgSettings: OrganizationSettingsSchema.parse({
        ...DEFAULT_ORGANIZATION_SETTINGS,
        telematics: TENANT1_TELEMATICS,
      }),
      asset,
      provider,
      snapshot,
      source: 'cron',
      nowMs,
    });

    expect(fetchTrackMock).toHaveBeenCalledTimes(1);
    const [, fromSec, toSec] = fetchTrackMock.mock.calls[0] as unknown as [string, number, number];
    expect(toSec).toBe(nowSec);
    // Должен запросить с начала рейса (-15 мин), а не обрезать 6 часами
    expect(fromSec).toBe(tripStartSec - 900);
    expect(toSec - fromSec).toBeGreaterThan(20 * 3600);
  });

  it('11. Self-healing: даже если last_msg_ts уже сдвинут на 22 ч вперёд, fetchTrack сканирует весь трек от начала рейса', async () => {
    const tripStartedIso = '2026-11-26T05:03:27Z';
    const tripStartSec = Math.floor(Date.parse(tripStartedIso) / 1000);
    const nowMs = Date.parse('2026-11-27T05:00:00Z');
    const nowSec = Math.floor(nowMs / 1000);

    const fetchTrackMock = vi.fn(async () => []);
    const provider: TelematicsProvider = {
      providerId: 'wialon',
      fetchUnitsSnapshot: vi.fn(async () => []),
      fetchTrack: fetchTrackMock,
    };

    const mockSupabase = {
      from: (table: string) => {
        if (table === 'vehicle_telematics_state') {
          return {
            update: () => ({
              eq: () => ({
                eq: () => ({
                  or: () => ({
                    select: () => ({
                      maybeSingle: async () => ({
                        data: {
                          state: 'AT_STOP',
                          base_confirm_since: null,
                          depart_confirm_count: 0,
                          transit_entered_at: null,
                          // last_msg_ts уже обновлялся утром (всего 59 минут назад!)
                          last_msg_ts: nowSec - 3540,
                          last_lat: 59.7677,
                          last_lon: 60.024,
                          last_speed: 0,
                          last_odometer_km: 469155,
                        },
                        error: null,
                      }),
                    }),
                  }),
                  eq: async () => ({ error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'orders') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    order: () => ({
                      limit: () => ({
                        maybeSingle: async () => ({
                          data: {
                            id: 'ord-1096',
                            active_trip_id: 'trip-1096',
                            routes_json: [],
                            raw_parser_payload: { autopilot_v2: true },
                            trip: {
                              id: 'trip-1096',
                              started_at: tripStartedIso,
                              odometer_start: 468596,
                            },
                          },
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'telematics_events') {
          return { insert: async () => ({ error: null }) };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    } as unknown as SupabaseClient;

    await processVehicleSnapshot({
      supabase: mockSupabase,
      organizationId: '00000000-0000-4000-8000-000000000001',
      orgSettings: OrganizationSettingsSchema.parse({
        ...DEFAULT_ORGANIZATION_SETTINGS,
        telematics: TENANT1_TELEMATICS,
      }),
      asset: {
        id: 'asset-1096',
        reg_number: 'А096МВ196',
        short_name: 'Валдай 6м',
        wialon_id: '11873',
        odometer_current: 469155,
        odometer_offset_km: 0,
        assigned_driver_id: 'drv-1',
      },
      provider,
      snapshot: {
        externalUnitId: '11873',
        unitName: 'А096МВ196',
        isOnline: true,
        position: { lat: 59.768, lon: 60.025, speedKmh: 0, timestampSec: nowSec - 10 },
      },
      source: 'cron',
      nowMs,
    });

    const [, fromSec] = fetchTrackMock.mock.calls[0] as unknown as [string, number, number];
    expect(fromSec).toBe(tripStartSec - 900);
  });

  it('12. Геозоны и фильтр техстоянок: выбирает ближайшую геозону и отсекает ночёвку у кафе / киоска / запчастей', () => {
    const overlapping = [
      {
        id: 'karpinsk',
        name: 'г. Карпинск',
        city: 'Карпинск',
        raw_address: 'г. Карпинск',
        lat: 59.7681,
        lon: 60.025,
        radius_m: 20_000,
        role: 'any' as const,
      },
      {
        id: 'vorontsovka',
        name: 'Воронцовка (Рудник)',
        city: 'Воронцовка',
        raw_address: 'пос. Воронцовка',
        lat: 59.64,
        lon: 60.3125,
        radius_m: 2_000,
        role: 'any' as const,
      },
    ];

    // Точка на промплощадке Воронцовки попадает и в 20-км круг Карпинска, и в 2-км круг Воронцовки → выбирается ближайшая (Воронцовка)
    const hit = matchKnownGeofence(59.6405, 60.313, overlapping);
    expect(hit?.geofenceId).toBe('vorontsovka');

    // Ночёвка в Серове (Вятчино, 59.6165, 60.4573) не попадает в 2-км геозону Воронцовки и отсекается как кафе
    const serovNight = matchKnownGeofence(59.61656, 60.45726, [overlapping[1]!]);
    expect(serovNight).toBeNull();
    expect(classifyServiceOrRestStop('cafe', 'house', 'Восточная кухня, Вятчино, Серов')).toBe(
      true,
    );
    expect(classifyServiceOrRestStop('kiosk', 'house', 'Минутка, улица Ленина, Черемисское')).toBe(
      true,
    );
    expect(classifyServiceOrRestStop('car_parts', 'house', 'Track Nord, Серовский округ')).toBe(
      true,
    );
    // Ночёвка на обочине региональной трассы 65К-2301000 без номера здания → техстоянка
    expect(
      classifyServiceOrRestStop('secondary', 'secondary', '65К-2301000, Вятчино, Серов', false),
    ).toBe(true);
    expect(
      classifyServiceOrRestStop('industrial', 'house', '16, улица Чайковского, Карпинск', true),
    ).toBe(false);
  });

  it('13. Хронологическая сборка RECORD_STOP: ретроспективная ранняя точка встаёт первой (loading), сдвигая позднюю в unloading', async () => {
    const orderUpdates: Array<Record<string, unknown>> = [];
    const tripNotes: string[] = [];

    const karpinskArrIso = '2026-11-27T03:54:47.000Z';
    const karpinskDepIso = '2026-11-27T04:58:10.000Z';

    const mockSupabase = {
      from: (table: string) => {
        if (table === 'orders') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: 'ord-1096',
                      base_doc_name: '⚠️ ВЫЕЗД БЕЗ ЗАЯВКИ',
                      client_id: null,
                      cargo_name: '',
                      price_without_vat: null,
                      loading_address_json: { city: 'Карпинск', raw: 'г. Карпинск' },
                      unloading_address_json: { city: 'Карпинск', raw: 'г. Карпинск' },
                      routes_json: [
                        {
                          stop_key: 'trip-1096:59768:60025:997640',
                          type: 'loading',
                          geofence_id: 'karpinsk',
                          name: 'г. Карпинск',
                          city: 'Карпинск',
                          raw_address: 'г. Карпинск',
                          lat: 59.7681,
                          lon: 60.025,
                          arrived_at: karpinskArrIso,
                          departed_at: karpinskDepIso,
                          duration_min: 63,
                          odometer_km: 469155,
                          is_known: true,
                          had_signal_gap: false,
                        },
                      ],
                      raw_parser_payload: { autopilot_v2: true },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
            update: (payload: Record<string, unknown>) => {
              orderUpdates.push(payload);
              return { eq: () => ({ eq: async () => ({ error: null }) }) };
            },
          };
        }
        if (table === 'trips') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      driver_note: '⚡ Автовыезд (Автопилот v2)',
                      started_at: '2026-11-26T05:03:27Z',
                      odometer_start: 468596,
                    },
                    error: null,
                  }),
                }),
              }),
            }),
            update: (payload: Record<string, unknown>) => {
              tripNotes.push(String(payload.driver_note ?? ''));
              return { eq: () => ({ eq: async () => ({ error: null }) }) };
            },
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    } as unknown as SupabaseClient;

    // Догрузилась вчерашняя точка Першино / Реж (26.11 09:40 UTC)
    const rezhStartSec = Math.floor(Date.parse('2026-11-26T09:40:29Z') / 1000);
    const rezhEndSec = Math.floor(Date.parse('2026-11-26T10:48:53Z') / 1000);

    await executeAutopilotCommand(
      {
        supabase: mockSupabase,
        organizationId: '00000000-0000-4000-8000-000000000001',
        assetId: 'asset-1096',
        assignedDriverId: 'drv-1',
        currentOdometerKm: 469155,
        orgSettings: OrganizationSettingsSchema.parse({
          ...DEFAULT_ORGANIZATION_SETTINGS,
          telematics: TENANT1_TELEMATICS,
        }),
      },
      {
        type: 'RECORD_STOP',
        orderId: 'ord-1096',
        tripId: 'trip-1096',
        stop: {
          stopKey: 'trip-1096:57419:61482:997605',
          lat: 57.419,
          lon: 61.4818,
          startTs: rezhStartSec,
          endTs: rezhEndSec,
          durationMin: 68,
          isBase: false,
          distFromBaseKm: 90.2,
          odometerKm: 468763,
          hadSignalGap: true,
        },
        geo: {
          geofenceId: 'rezh',
          name: 'г. Реж',
          city: 'Реж',
          rawAddress: 'г. Реж',
          isKnown: true,
          isServiceOrRestStop: false,
          role: 'any',
        },
      },
    );

    const savedOrderUpdate = orderUpdates[0];
    const savedTripNote = tripNotes[0] ?? '';
    const routes = (savedOrderUpdate?.routes_json ?? []) as Array<Record<string, unknown>>;
    expect(routes).toHaveLength(2);
    expect(routes[0]?.name).toBe('г. Реж');
    expect(routes[0]?.type).toBe('loading');
    expect(routes[1]?.name).toBe('г. Карпинск');
    expect(routes[1]?.type).toBe('unloading');
    expect((savedOrderUpdate?.loading_address_json as Record<string, unknown>)?.city).toBe('Реж');
    expect((savedOrderUpdate?.unloading_address_json as Record<string, unknown>)?.city).toBe(
      'Карпинск',
    );
    expect(savedTripNote).toContain('Верхняя Салда ➔ г. Реж');
    expect(savedTripNote).toContain('г. Реж ➔ г. Карпинск');
  });

  it('14. CLOSE_TRIP_TO_REVIEW: использует фактический момент въезда на базу из трека (trackBaseEntryTs), а не время крона', () => {
    const tripStartedIso = '2026-11-26T05:03:27Z';
    const actualEntryIso = '2026-11-27T10:12:00.000Z';
    const actualEntrySec = Math.floor(Date.parse(actualEntryIso) / 1000);
    const cronNowMs = Date.parse('2026-11-27T10:45:00.000Z'); // крон пришёл спустя 33 мин

    const out = evaluateVehicleTelemetry({
      source: 'cron',
      nowMs: cronNowMs,
      settings: TENANT1_TELEMATICS,
      prevState: {
        ...INITIAL_STATE,
        state: 'EN_ROUTE',
        baseConfirmSinceIso: '2026-11-27T10:15:00.000Z',
      },
      position: {
        lat: 58.053,
        lon: 60.552,
        speedKmh: 0,
        timestampSec: Math.floor(cronNowMs / 1000) - 30,
      },
      calibratedOdometerKm: 469410,
      activeTrip: {
        orderId: 'ord-1096',
        tripId: 'trip-1096',
        startedAtIso: tripStartedIso,
        startOdometerKm: 468596,
        recordedStopKeys: ['s1', 's2'],
        departureDirection: 'west',
        hasDepartedWest: true,
        hasUnloaded: true,
        transitAllowed: false,
        visitedPresetGeofenceIds: [],
      },
      trackDistanceKm: 814,
      trackBaseEntryTs: actualEntrySec,
      trackBaseEntryOdometerKm: 469408,
    });

    const closeCmd = out.commands.find((c) => c.type === 'CLOSE_TRIP_TO_REVIEW');
    expect(closeCmd).toBeDefined();
    if (closeCmd?.type === 'CLOSE_TRIP_TO_REVIEW') {
      expect(closeCmd.arrivalTimeIso).toBe(actualEntryIso);
      expect(closeCmd.odometerKm).toBe(469410);
    }
  });
});
