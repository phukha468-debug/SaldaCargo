import { z } from 'zod';

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

export const OrganizationSettingsSchema = z
  .object({
    branding: OrganizationBrandingSettingsSchema,
    finance: OrganizationFinanceSettingsSchema,
    counterparty_rules: OrganizationCounterpartyRulesSchema,
    fleet_rules: OrganizationFleetRulesSchema,
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
