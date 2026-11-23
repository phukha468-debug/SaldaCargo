import { z } from 'zod';
import { SALDA_MODULES } from './modules';

const MODULE_ENUM = z.enum(SALDA_MODULES);

export const ProvisionOrganizationSchema = z.object({
  company_name: z.string().trim().min(2, 'Укажите название компании (минимум 2 символа)').max(120),
  short_name: z.string().trim().min(2).max(40).optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/, 'Slug должен содержать латиницу, цифры и дефисы')
    .optional(),
  inn: z
    .string()
    .trim()
    .regex(/^\d{10}(\d{2})?$/, 'ИНН должен содержать 10 (ООО) или 12 (ИП) цифр')
    .optional()
    .or(z.literal('')),
  enabled_modules: z
    .array(MODULE_ENUM)
    .min(1, 'Выберите хотя бы один модуль')
    .default(['transport', 'finance']),
  owner_name: z.string().trim().min(2, 'Укажите имя владельца').max(120),
  owner_phone: z.string().trim().min(10, 'Укажите корректный номер телефона').max(24),
  owner_pin: z
    .string()
    .trim()
    .regex(/^\d{4,6}$/, 'ПИН-код должен состоять из 4–6 цифр'),
});

export type ProvisionOrganizationInput = z.infer<typeof ProvisionOrganizationSchema>;

const optionalUuidSchema = z.string().uuid().optional();

export const OrganizationBrandingSettingsSchema = z
  .object({
    short_name: z.string().trim().max(120).optional(),
    logo_url: z.string().trim().url().optional(),
    primary_color: z.string().trim().max(32).optional(),
    timezone: z.string().trim().min(1).default('Asia/Yekaterinburg'),
  })
  .default({});

export const OrganizationFinanceWalletsSchema = z
  .object({
    bank: optionalUuidSchema,
    cash: optionalUuidSchema,
    fuel_card: optionalUuidSchema,
    fuel_cube: optionalUuidSchema,
    garage: optionalUuidSchema,
  })
  .default({});

export const OrganizationFinanceCategoriesSchema = z
  .object({
    trip_revenue: optionalUuidSchema,
    payroll_driver: optionalUuidSchema,
    payroll_loader: optionalUuidSchema,
    fuel: optionalUuidSchema,
    other: optionalUuidSchema,
    cash_collect: optionalUuidSchema,
  })
  .default({});

export const OrganizationFinanceSettingsSchema = z
  .object({
    wallets: OrganizationFinanceWalletsSchema,
    categories: OrganizationFinanceCategoriesSchema,
    cube_fuel_price_per_liter: z.number().positive().default(60),
    diesel_fuel_price_per_liter: z.number().positive().default(82),
    default_safe_cash_base: z.number().min(0).default(0),
    default_fuel_card_base: z.number().min(0).default(0),
  })
  .default({});

export const OrganizationCounterpartyRulesSchema = z
  .object({
    internal_patterns: z
      .array(z.string().trim().min(1))
      .default(['наша компания', 'собственные нужды']),
    no_cash_patterns: z.array(z.string().trim().min(1)).default([]),
    strict_doc_patterns: z.array(z.string().trim().min(1)).default([]),
    territory_patterns: z.array(z.string().trim().min(1)).default([]),
    geostroy_patterns: z.array(z.string().trim().min(1)).default([]),
  })
  .default({});

export const OrganizationFleetRulesSchema = z
  .object({
    wialon_gps_plates: z.array(z.string().trim().min(1)).default([]),
    directions: z.array(z.string().trim().min(1)).default(['По городу', 'Межгород', 'Регион']),
  })
  .default({});

export const TelematicsBaseGeofenceSchema = z
  .object({
    name: z.string().trim().min(1).max(120).default('База'),
    lat: z.number().min(-90).max(90).default(58.053),
    lon: z.number().min(-180).max(180).default(60.552),
    radius_m: z.number().min(200).max(50000).default(5000),
    departure_hysteresis_m: z.number().min(100).max(15000).default(1500),
  })
  .default({});

export const TelematicsThresholdsSchema = z
  .object({
    min_moving_speed_kmh: z.number().min(1).max(60).default(10),
    stop_max_speed_kmh: z.number().min(0).max(20).default(5),
    stop_cluster_radius_m: z.number().min(50).max(2000).default(250),
    stop_min_duration_known_min: z.number().min(3).max(240).default(15),
    stop_min_duration_unknown_min: z.number().min(5).max(240).default(25),
    arrival_confirm_min: z.number().min(1).max(60).default(5),
    min_trip_distance_km: z.number().min(1).max(200).default(10),
    max_gps_age_min: z.number().min(5).max(1440).default(30),
    noise_speed_spike_limit: z.number().int().min(0).max(10).default(2),
  })
  .default({});

export const TelematicsKnownGeofenceSchema = z.object({
  id: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  city: z.string().trim().min(1).max(120),
  raw_address: z.string().trim().min(1).max(240),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  radius_m: z.number().min(100).max(50000),
  role: z.enum(['loading', 'unloading', 'any']).default('any'),
});

export const TelematicsRoutePresetSchema = z.object({
  id: z.string().trim().min(1).max(64),
  trigger_geofence_id: z.string().trim().min(1).max(64),
  client_id: optionalUuidSchema,
  base_doc_name: z.string().trim().max(160).optional(),
  cargo_name: z.string().trim().max(160).optional(),
  price_without_vat: z.number().min(0).optional(),
  default_loading_city: z.string().trim().max(120).optional(),
  default_loading_raw: z.string().trim().max(240).optional(),
  default_unloading_city: z.string().trim().max(120).optional(),
  default_unloading_raw: z.string().trim().max(240).optional(),
  min_return_distance_km: z.number().min(0).optional(),
  fallback_distance_km: z.number().min(0).optional(),
});

export const TelematicsTransitRulesSchema = z
  .object({
    enabled: z.boolean().default(false),
    east_departure_lon_threshold: z.number().min(-180).max(180).optional(),
    west_exit_lon_threshold: z.number().min(-180).max(180).optional(),
    max_transit_hours: z.number().min(1).max(168).default(36),
  })
  .default({});

export const TelematicsTariffsSchema = z
  .object({
    fuel_rate_per_100km: z.number().positive().max(100).default(18),
    driver_pay_per_km: z.number().min(0).max(500).default(10),
    driver_per_diem: z.number().min(0).max(50000).default(1000),
    min_km_for_per_diem: z.number().min(0).max(2000).default(100),
  })
  .default({});

export const OrganizationTelematicsSettingsSchema = z
  .object({
    autopilot_enabled: z.boolean().default(false),
    base_geofence: TelematicsBaseGeofenceSchema,
    thresholds: TelematicsThresholdsSchema,
    known_geofences: z.array(TelematicsKnownGeofenceSchema).max(100).default([]),
    route_presets: z.array(TelematicsRoutePresetSchema).max(50).default([]),
    transit_rules: TelematicsTransitRulesSchema,
    tariffs: TelematicsTariffsSchema,
  })
  .default({});

export type TelematicsKnownGeofence = z.infer<typeof TelematicsKnownGeofenceSchema>;
export type TelematicsRoutePreset = z.infer<typeof TelematicsRoutePresetSchema>;
export type OrganizationTelematicsSettings = z.infer<typeof OrganizationTelematicsSettingsSchema>;

export const OrganizationSettingsSchema = z
  .object({
    branding: OrganizationBrandingSettingsSchema,
    finance: OrganizationFinanceSettingsSchema,
    counterparty_rules: OrganizationCounterpartyRulesSchema,
    fleet_rules: OrganizationFleetRulesSchema,
    telematics: OrganizationTelematicsSettingsSchema,
  })
  .default({});

export type OrganizationSettings = z.infer<typeof OrganizationSettingsSchema>;

export const DEFAULT_ORGANIZATION_SETTINGS: OrganizationSettings = OrganizationSettingsSchema.parse(
  {},
);

/**
 * Безопасно парсит JSONB-поле `organizations.settings` в типизированный объект с нейтральными дефолтами.
 * При повреждённой или неполной структуре не падает, а откатывается к дефолтам для невалидных секций.
 */
export function parseOrganizationSettings(raw: unknown): OrganizationSettings {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_ORGANIZATION_SETTINGS;
  }
  const parsed = OrganizationSettingsSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }

  const obj = raw as Record<string, unknown>;
  return {
    branding: OrganizationBrandingSettingsSchema.safeParse(obj.branding).success
      ? OrganizationBrandingSettingsSchema.parse(obj.branding)
      : DEFAULT_ORGANIZATION_SETTINGS.branding,
    finance: OrganizationFinanceSettingsSchema.safeParse(obj.finance).success
      ? OrganizationFinanceSettingsSchema.parse(obj.finance)
      : DEFAULT_ORGANIZATION_SETTINGS.finance,
    counterparty_rules: OrganizationCounterpartyRulesSchema.safeParse(obj.counterparty_rules)
      .success
      ? OrganizationCounterpartyRulesSchema.parse(obj.counterparty_rules)
      : DEFAULT_ORGANIZATION_SETTINGS.counterparty_rules,
    fleet_rules: OrganizationFleetRulesSchema.safeParse(obj.fleet_rules).success
      ? OrganizationFleetRulesSchema.parse(obj.fleet_rules)
      : DEFAULT_ORGANIZATION_SETTINGS.fleet_rules,
    telematics: OrganizationTelematicsSettingsSchema.safeParse(obj.telematics).success
      ? OrganizationTelematicsSettingsSchema.parse(obj.telematics)
      : DEFAULT_ORGANIZATION_SETTINGS.telematics,
  };
}

/**
 * Проверяет совпадение строки с массивом подстрок (case-insensitive) или regex-паттернов.
 */
export function matchesAnyOrgPattern(value: string, patterns: readonly string[]): boolean {
  if (!value || patterns.length === 0) return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;

  for (const rawPattern of patterns) {
    const p = rawPattern.trim();
    if (!p) continue;
    if (p.startsWith('/') && p.endsWith('/') && p.length > 2) {
      try {
        const regex = new RegExp(p.slice(1, -1), 'i');
        if (regex.test(value)) return true;
      } catch {
        // Невалидный regex трактуем как обычную подстроку
        if (normalized.includes(p.toLowerCase())) return true;
      }
    } else if (normalized.includes(p.toLowerCase())) {
      return true;
    }
  }
  return false;
}
