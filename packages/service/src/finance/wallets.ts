/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';
import { CUBE_FUEL_PRICE_PER_LITER, logger } from '@saldacargo/shared';
import { syncTBankBalance } from '../integrations/tbank';

const BANK_ID = '10000000-0000-0000-0000-000000000001';
const CASH_ID = '10000000-0000-0000-0000-000000000002';
const FUEL_CARD_ID = '10000000-0000-0000-0000-000000000004';
const GARAGE_ID = '10000000-0000-0000-0000-000000000005';
const FUEL_CUBE_ID = '10000000-0000-0000-0000-000000000006';
const CASH_COLLECT_CAT = '72f677d4-84af-4d0d-a845-a1b63c7ae607';

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

const sumAmounts = (rows: Array<{ amount?: string | number | null }> | null | undefined): number =>
  (rows ?? []).reduce((s, r) => s + parseFloat(String(r.amount ?? '0')), 0);

let walletsCache: { data: WalletsSummary; timestamp: number } | null = null;
let inFlightWalletsPromise: Promise<WalletsSummary> | null = null;
const WALLETS_CACHE_TTL_MS = 25000;

export function invalidateWalletsCache(): void {
  walletsCache = null;
}

/**
 * Единый сервис расчёта динамических балансов всех кошельков (Web + MiniApp).
 * Сохраняет все финансовые инварианты:
 * - Двухосный фильтр транзакций: lifecycle_status = 'approved' AND settlement_status = 'completed'
 * - Приоритет фактического остатка Т-Банк Open API (otb)
 * - Базовая точка отсчёта сейфа/ГСМ от последнего подтверждённого суточного аудита
 */
export async function getWalletsSummary(
  supabase: SupabaseClient<any, any, any>,
  options?: { forceRefresh?: boolean },
): Promise<WalletsSummary> {
  const forceRefresh = Boolean(options?.forceRefresh);

  if (!forceRefresh && walletsCache && Date.now() - walletsCache.timestamp < WALLETS_CACHE_TTL_MS) {
    return walletsCache.data;
  }

  if (!forceRefresh && inFlightWalletsPromise) {
    return inFlightWalletsPromise;
  }

  const compute = async (): Promise<WalletsSummary> => {
    let apiBalance: number | null = null;
    let isApiSynced = false;
    let tbankAccountNum = '';
    let apiAuthorized = 0;
    let apiOtb = 0;

    try {
      const syncPromise = syncTBankBalance(forceRefresh);
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
    } catch (err) {
      logger.warn('TBank auto-sync failed in getWalletsSummary', { module: 'wallets' }, err);
    }

    const { data: latestAudit } = await (supabase.from('daily_finance_audits') as any)
      .select('*')
      .eq('status', 'confirmed')
      .order('date', { ascending: false })
      .order('audited_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const baseCash = Number(latestAudit?.safe_cash_actual ?? 29000);
    const baseFuel = Math.max(0, Number(latestAudit?.fuel_card_balance ?? 926.13));
    const auditCutoff = latestAudit?.audited_at || `${latestAudit?.date ?? '2026-10-14'}T09:57:13Z`;

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
        .in('payment_method', ['bank_invoice', 'qr'])
        .eq('settlement_status', 'completed')
        .eq('lifecycle_status', 'approved'),

      (supabase.from('transactions') as any)
        .select('amount, trip_order_id')
        .eq('to_wallet_id', BANK_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('from_wallet_id', BANK_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

      (supabase.from('cash_collections') as any).select('amount').gt('created_at', auditCutoff),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('to_wallet_id', CASH_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .neq('category_id', CASH_COLLECT_CAT)
        .gt('created_at', auditCutoff),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('from_wallet_id', CASH_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .gt('created_at', auditCutoff),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('to_wallet_id', FUEL_CARD_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .gt('created_at', auditCutoff),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('from_wallet_id', FUEL_CARD_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .gt('created_at', auditCutoff),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('to_wallet_id', GARAGE_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('from_wallet_id', GARAGE_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('to_wallet_id', FUEL_CUBE_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('from_wallet_id', FUEL_CUBE_ID)
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
    const cubeLiters = Math.round(cubeBalance / CUBE_FUEL_PRICE_PER_LITER);

    const result: WalletsSummary = {
      bank: {
        id: BANK_ID,
        name: 'Расчётный счёт',
        balance: bankBalance.toFixed(2),
        available: (apiBalance !== null ? apiOtb : bankBalance).toFixed(2),
        authorized: apiAuthorized.toFixed(2),
        api_synced: isApiSynced,
        synced_at: new Date().toISOString(),
        account_number: tbankAccountNum,
      },
      cash: { id: CASH_ID, name: 'Сейф (Наличные ТК)', balance: cashBalance.toFixed(2) },
      fuel_card: {
        id: FUEL_CARD_ID,
        name: 'Топливные карты (ГСМ)',
        balance: fuelBalance.toFixed(2),
      },
      fuel_cube: {
        id: FUEL_CUBE_ID,
        name: 'Кубик (Дизель База)',
        balance: cubeBalance.toFixed(2),
        liters: cubeLiters,
        price_per_liter: CUBE_FUEL_PRICE_PER_LITER,
      },
      garage: {
        id: GARAGE_ID,
        name: 'Касса Гаража (СТО)',
        balance: garageBalance.toFixed(2),
      },
    };

    walletsCache = { data: result, timestamp: Date.now() };
    return result;
  };

  inFlightWalletsPromise = compute().finally(() => {
    inFlightWalletsPromise = null;
  });

  return inFlightWalletsPromise;
}
