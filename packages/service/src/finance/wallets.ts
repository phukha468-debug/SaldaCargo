/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CUBE_FUEL_PRICE_PER_LITER,
  DEFAULT_ORGANIZATION_ID,
  logger,
  type OrganizationSettings,
} from '@saldacargo/shared';
import { syncTBankBalance } from '../integrations/tbank';
import {
  getIntegrationConfig,
  resolveOrganizationFinanceIds,
  type TBankIntegrationCredentials,
} from '../organization';

export interface WalletsSummary {
  bank: {
    id: string;
    name: string;
    balance: string;
    available: string;
    authorized: string;
    api_synced: boolean;
    synced_at: string;
    account_number: string;
  };
  cash: { id: string; name: string; balance: string };
  fuel_card: { id: string; name: string; balance: string };
  fuel_cube: {
    id: string;
    name: string;
    balance: string;
    liters: number;
    price_per_liter: number;
  };
  garage: { id: string; name: string; balance: string };
}

export interface GetWalletsSummaryOptions {
  forceRefresh?: boolean;
  organizationId?: string;
  orgSettings?: OrganizationSettings;
}

const sumAmounts = (rows: Array<{ amount?: string | number | null }> | null | undefined): number =>
  (rows ?? []).reduce((s, r) => s + parseFloat(String(r.amount ?? '0')), 0);

const walletsCache = new Map<string, { data: WalletsSummary; timestamp: number }>();
const inFlightWalletsPromises = new Map<string, Promise<WalletsSummary>>();
const WALLETS_CACHE_TTL_MS = 25000;

export function invalidateWalletsCache(organizationId?: string): void {
  if (organizationId) {
    walletsCache.delete(organizationId);
  } else {
    walletsCache.clear();
  }
}

/**
 * Единый сервис расчёта динамических балансов всех кошельков (Web + MiniApp) с изоляцией по organization_id.
 * Сохраняет все финансовые инварианты:
 * - Двухосный фильтр транзакций: lifecycle_status = 'approved' AND settlement_status = 'completed'
 * - Приоритет фактического остатка Т-Банк Open API (otb)
 * - Базовая точка отсчёта сейфа/ГСМ от последнего подтверждённого суточного аудита
 */
export async function getWalletsSummary(
  supabase: SupabaseClient<any, any, any>,
  options?: GetWalletsSummaryOptions,
): Promise<WalletsSummary> {
  const forceRefresh = Boolean(options?.forceRefresh);
  const organizationId = options?.organizationId || DEFAULT_ORGANIZATION_ID;
  const orgSettings = options?.orgSettings;
  const ids = resolveOrganizationFinanceIds(orgSettings);
  const cubePrice = orgSettings?.finance?.cube_fuel_price_per_liter ?? CUBE_FUEL_PRICE_PER_LITER;

  const cached = walletsCache.get(organizationId);
  if (!forceRefresh && cached && Date.now() - cached.timestamp < WALLETS_CACHE_TTL_MS) {
    return cached.data;
  }

  const inFlight = inFlightWalletsPromises.get(organizationId);
  if (!forceRefresh && inFlight) {
    return inFlight;
  }

  const compute = async (): Promise<WalletsSummary> => {
    let apiBalance: number | null = null;
    let isApiSynced = false;
    let tbankAccountNum = '';
    let apiAuthorized = 0;
    let apiOtb = 0;

    try {
      const tbankIntegration = await getIntegrationConfig<TBankIntegrationCredentials>(
        supabase,
        organizationId,
        'tbank',
      );
      if (tbankIntegration.isEnabled && tbankIntegration.credentials.token) {
        const syncPromise = syncTBankBalance(forceRefresh, {
          token: tbankIntegration.credentials.token,
          accountNumber:
            tbankIntegration.credentials.account_number ||
            (typeof tbankIntegration.config.account_number === 'string'
              ? tbankIntegration.config.account_number
              : undefined),
          cacheKey: organizationId,
          allowEnvFallback: false,
        });
        const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) =>
          setTimeout(() => resolve({ success: false, error: 'TBank timeout' }), 2500),
        );
        const syncResult = await Promise.race([syncPromise, timeoutPromise]);
        if (syncResult.success && typeof syncResult.balance === 'number') {
          apiBalance = syncResult.balance;
          apiAuthorized = syncResult.authorized ?? 0;
          apiOtb = syncResult.otb ?? syncResult.balance;
          isApiSynced = true;
          tbankAccountNum = syncResult.accountNumber ?? '';
        }
      }
    } catch (err) {
      logger.warn(
        'TBank auto-sync failed in getWalletsSummary',
        { module: 'wallets', organizationId },
        err,
      );
    }

    const { data: latestAudit } = await (supabase.from('daily_finance_audits') as any)
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'confirmed')
      .order('date', { ascending: false })
      .order('audited_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const fallbackSafeCash =
      orgSettings?.finance?.default_safe_cash_base ??
      (organizationId === DEFAULT_ORGANIZATION_ID ? 29000 : 0);
    const fallbackFuelCard =
      orgSettings?.finance?.default_fuel_card_base ??
      (organizationId === DEFAULT_ORGANIZATION_ID ? 926.13 : 0);

    const baseCash = Number(latestAudit?.safe_cash_actual ?? fallbackSafeCash);
    const baseFuel = Math.max(0, Number(latestAudit?.fuel_card_balance ?? fallbackFuelCard));
    const auditCutoff =
      latestAudit?.audited_at ||
      (latestAudit?.date ? `${latestAudit.date}T09:57:13Z` : '1970-01-01T00:00:00Z');

    const [
      { data: bankOrders },
      { data: bankIn },
      { data: bankOut },
      { data: collectionsAfterAudit },
      { data: cashInAfterAudit },
      { data: cashOutAfterAudit },
      { data: fuelInAfterAudit },
      { data: fuelOutAfterAudit },
      { data: garageIn },
      { data: garageOut },
      { data: cubeIn },
      { data: cubeOut },
    ] = await Promise.all([
      (supabase.from('trip_orders') as any)
        .select('amount')
        .eq('organization_id', organizationId)
        .in('payment_method', ['bank_invoice', 'qr'])
        .eq('settlement_status', 'completed')
        .eq('lifecycle_status', 'approved'),

      (supabase.from('transactions') as any)
        .select('amount, trip_order_id')
        .eq('organization_id', organizationId)
        .eq('to_wallet_id', ids.bankId)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('organization_id', organizationId)
        .eq('from_wallet_id', ids.bankId)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

      (supabase.from('cash_collections') as any)
        .select('amount')
        .eq('organization_id', organizationId)
        .gt('created_at', auditCutoff),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('organization_id', organizationId)
        .eq('to_wallet_id', ids.cashId)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .neq('category_id', ids.cashCollectCat)
        .gt('created_at', auditCutoff),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('organization_id', organizationId)
        .eq('from_wallet_id', ids.cashId)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .gt('created_at', auditCutoff),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('organization_id', organizationId)
        .eq('to_wallet_id', ids.fuelCardId)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .gt('created_at', auditCutoff),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('organization_id', organizationId)
        .eq('from_wallet_id', ids.fuelCardId)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .gt('created_at', auditCutoff),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('organization_id', organizationId)
        .eq('to_wallet_id', ids.garageId)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('organization_id', organizationId)
        .eq('from_wallet_id', ids.garageId)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('organization_id', organizationId)
        .eq('to_wallet_id', ids.fuelCubeId)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('organization_id', organizationId)
        .eq('from_wallet_id', ids.fuelCubeId)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),
    ]);

    const bankInWithoutOrders = (
      (bankIn ?? []) as Array<{ amount?: string; trip_order_id?: string | null }>
    )
      .filter((r) => !r.trip_order_id)
      .reduce((s, r) => s + parseFloat(r.amount ?? '0'), 0);

    const fallbackBankBalance = sumAmounts(bankOrders) + bankInWithoutOrders - sumAmounts(bankOut);
    const bankBalance = apiBalance !== null ? apiBalance : fallbackBankBalance;

    const cashBalance =
      baseCash +
      sumAmounts(collectionsAfterAudit) +
      sumAmounts(cashInAfterAudit) -
      sumAmounts(cashOutAfterAudit);

    const fuelBalance = Math.max(
      0,
      baseFuel + sumAmounts(fuelInAfterAudit) - sumAmounts(fuelOutAfterAudit),
    );

    const garageBalance = sumAmounts(garageIn) - sumAmounts(garageOut);
    const cubeBalance = Math.max(0, sumAmounts(cubeIn) - sumAmounts(cubeOut));
    const cubeLiters = Math.round(cubeBalance / cubePrice);

    const result: WalletsSummary = {
      bank: {
        id: ids.bankId,
        name: 'Расчётный счёт',
        balance: bankBalance.toFixed(2),
        available: (apiBalance !== null ? apiOtb : bankBalance).toFixed(2),
        authorized: apiAuthorized.toFixed(2),
        api_synced: isApiSynced,
        synced_at: new Date().toISOString(),
        account_number: tbankAccountNum,
      },
      cash: { id: ids.cashId, name: 'Сейф (Наличные)', balance: cashBalance.toFixed(2) },
      fuel_card: {
        id: ids.fuelCardId,
        name: 'Топливные карты (ГСМ)',
        balance: fuelBalance.toFixed(2),
      },
      fuel_cube: {
        id: ids.fuelCubeId,
        name: 'Кубик (Дизель База)',
        balance: cubeBalance.toFixed(2),
        liters: cubeLiters,
        price_per_liter: cubePrice,
      },
      garage: {
        id: ids.garageId,
        name: 'Касса Гаража (СТО)',
        balance: garageBalance.toFixed(2),
      },
    };

    walletsCache.set(organizationId, { data: result, timestamp: Date.now() });
    return result;
  };

  const promise = compute().finally(() => {
    inFlightWalletsPromises.delete(organizationId);
  });

  inFlightWalletsPromises.set(organizationId, promise);
  return promise;
}
