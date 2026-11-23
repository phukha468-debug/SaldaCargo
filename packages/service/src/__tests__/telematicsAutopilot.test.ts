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
});
