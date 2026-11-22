/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_ORGANIZATION_SETTINGS,
  FINANCIAL_CATEGORIES,
  FINANCIAL_WALLETS,
  SALDA_MODULES,
  isValidModule,
  parseOrganizationSettings,
  type OrganizationSettings,
  type SaldaModule,
} from '@saldacargo/shared';

export interface OrganizationRuntimeContext {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  enabledModules: SaldaModule[];
  settings: OrganizationSettings;
}

export interface OrganizationFinanceIds {
  bankId: string;
  cashId: string;
  fuelCardId: string;
  fuelCubeId: string;
  garageId: string;
  tripRevenueCat: string;
  payrollDriverCat: string;
  payrollLoaderCat: string;
  fuelCat: string;
  otherCat: string;
  cashCollectCat: string;
}

const DEFAULT_GARAGE_WALLET_ID = '10000000-0000-0000-0000-000000000005';

const ORG_CACHE_TTL_MS = 30_000;
const orgContextCache = new Map<string, { data: OrganizationRuntimeContext; timestamp: number }>();

export function invalidateOrganizationCache(organizationId?: string): void {
  if (organizationId) {
    orgContextCache.delete(organizationId);
  } else {
    orgContextCache.clear();
  }
}

/**
 * Возвращает системные UUID кошельков и категорий для организации
 * (из `organizations.settings.finance` с fallback на системные ID по умолчанию).
 */
export function resolveOrganizationFinanceIds(
  orgSettings?: OrganizationSettings,
): OrganizationFinanceIds {
  const wallets = orgSettings?.finance?.wallets;
  const categories = orgSettings?.finance?.categories;

  return {
    bankId: wallets?.bank ?? FINANCIAL_WALLETS.BANK,
    cashId: wallets?.cash ?? FINANCIAL_WALLETS.CASH,
    fuelCardId: wallets?.fuel_card ?? FINANCIAL_WALLETS.FUEL_CARD,
    fuelCubeId: wallets?.fuel_cube ?? FINANCIAL_WALLETS.FUEL_CUBE,
    garageId: wallets?.garage ?? DEFAULT_GARAGE_WALLET_ID,
    tripRevenueCat: categories?.trip_revenue ?? FINANCIAL_CATEGORIES.TRIP_REVENUE,
    payrollDriverCat: categories?.payroll_driver ?? FINANCIAL_CATEGORIES.PAYROLL_DRIVER,
    payrollLoaderCat: categories?.payroll_loader ?? FINANCIAL_CATEGORIES.PAYROLL_LOADER,
    fuelCat: categories?.fuel ?? FINANCIAL_CATEGORIES.FUEL,
    otherCat: categories?.other ?? FINANCIAL_CATEGORIES.OTHER,
    cashCollectCat: categories?.cash_collect ?? FINANCIAL_CATEGORIES.CASH_COLLECT,
  };
}

/**
 * Загружает контекст организации (модули, настройки, активность) с in-memory кэшем (TTL 30с).
 * Для переходного периода, пока таблица `organizations` может отсутствовать в старом стенде,
 * для `DEFAULT_ORGANIZATION_ID` возвращает безопасный fallback со всеми модулями.
 */
export async function getOrganizationContext(
  supabase: SupabaseClient<any, any, any>,
  organizationId: string = DEFAULT_ORGANIZATION_ID,
  options?: { forceRefresh?: boolean },
): Promise<OrganizationRuntimeContext | null> {
  const orgId = organizationId || DEFAULT_ORGANIZATION_ID;

  if (!options?.forceRefresh) {
    const cached = orgContextCache.get(orgId);
    if (cached && Date.now() - cached.timestamp < ORG_CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const { data, error } = await (supabase.from('organizations') as any)
    .select('id, slug, name, is_active, enabled_modules, settings')
    .eq('id', orgId)
    .maybeSingle();

  if (error) {
    // Graceful fallback только для Тенанта №1, если миграция 20261122000001 ещё не применена в БД
    if (orgId === DEFAULT_ORGANIZATION_ID) {
      const fallback: OrganizationRuntimeContext = {
        id: DEFAULT_ORGANIZATION_ID,
        slug: 'tk501',
        name: 'ТК501',
        isActive: true,
        enabledModules: [...SALDA_MODULES],
        settings: DEFAULT_ORGANIZATION_SETTINGS,
      };
      return fallback;
    }
    return null;
  }

  if (!data) {
    return null;
  }

  const rawModules = Array.isArray(data.enabled_modules) ? data.enabled_modules : [];
  const enabledModules = rawModules.filter(
    (m: unknown): m is SaldaModule => typeof m === 'string' && isValidModule(m),
  );

  const ctx: OrganizationRuntimeContext = {
    id: String(data.id),
    slug: String(data.slug ?? ''),
    name: String(data.name ?? ''),
    isActive: data.is_active !== false,
    enabledModules,
    settings: parseOrganizationSettings(data.settings),
  };

  orgContextCache.set(orgId, { data: ctx, timestamp: Date.now() });
  return ctx;
}
