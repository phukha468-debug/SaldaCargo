/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { syncTBankBalance } from '@/lib/tbank';
import { NextResponse } from 'next/server';

const BANK_ID = '10000000-0000-0000-0000-000000000001';
const CASH_ID = '10000000-0000-0000-0000-000000000002';
const FUEL_CARD_ID = '10000000-0000-0000-0000-000000000004';
const GARAGE_ID = '10000000-0000-0000-0000-000000000005';

const sum = (rows: any[]) =>
  (rows ?? []).reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0);

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 15;

let walletsCache: { data: any; timestamp: number } | null = null;
let inFlightWalletsPromise: Promise<any> | null = null;
const WALLETS_CACHE_TTL = 25000; // 25 секунд

export function invalidateWalletsCache() {
  walletsCache = null;
}

export async function GET(request?: Request) {
  try {
    const url = request ? new URL(request.url) : null;
    const forceRefresh = url?.searchParams.get('force') === '1';

    if (!forceRefresh && walletsCache && Date.now() - walletsCache.timestamp < WALLETS_CACHE_TTL) {
      return NextResponse.json(walletsCache.data);
    }

    if (inFlightWalletsPromise) {
      const data = await inFlightWalletsPromise;
      return NextResponse.json(data);
    }

    let apiBalance: number | null = null;
    let isApiSynced = false;
    let tbankAccountNum = '';
    let apiAuthorized = 0;
    let apiOtb = 0;

    // Автоматическая синхронизация с Т-Банком с защитой от зависания (макс 2.5 сек)
    try {
      const syncPromise = syncTBankBalance(forceRefresh);
      const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) =>
        setTimeout(() => resolve({ success: false, error: 'TBank timeout' }), 2500),
      );
      const syncResult = (await Promise.race([syncPromise, timeoutPromise])) as any;
      if (syncResult?.success && typeof syncResult.balance === 'number') {
        apiBalance = syncResult.balance;
        apiAuthorized = syncResult.authorized || 0;
        apiOtb = syncResult.otb || 0;
        isApiSynced = true;
        tbankAccountNum = syncResult.accountNumber || '';
      }
    } catch (e) {
      console.error('TBank auto-sync in wallets:', e);
    }

    const supabase = createAdminClient();

    // Получаем последний подтвержденный вечерний аудит (базовая точка отсчета)
    const { data: latestAudit } = await (supabase.from('daily_finance_audits') as any)
      .select('*')
      .eq('status', 'confirmed')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const baseCash = Number(latestAudit?.safe_cash_actual ?? 29000);
    const baseFuel = Number(latestAudit?.fuel_card_balance ?? 926.13);
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
    ]);

    const bankInWithoutOrders = (bankIn ?? [])
      .filter((r: any) => !r.trip_order_id)
      .reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0);

    // Резервный расчёт по БД без задвоения заказов
    const fallbackBankBalance = sum(bankOrders ?? []) + bankInWithoutOrders - sum(bankOut ?? []);

    // БЕЗУСЛОВНЫЙ ПРИОРИТЕТ ДАННЫХ АПИ Т-БАНКА:
    // Если API вернул баланс, показываем строго его. Никакие отметки оплаченных счетов не завышают остаток.
    const bankBalance = apiBalance !== null ? apiBalance : fallbackBankBalance;

    const cashBalance =
      baseCash +
      sum(collectionsAfterAudit ?? []) +
      sum(cashInAfterAudit ?? []) -
      sum(cashOutAfterAudit ?? []);

    const fuelBalance = baseFuel + sum(fuelInAfterAudit ?? []) - sum(fuelOutAfterAudit ?? []);

    const garageBalance = sum(garageIn ?? []) - sum(garageOut ?? []);

    const result = {
      bank: {
        name: 'Расчётный счёт',
        balance: bankBalance.toFixed(2),
        available: (apiBalance !== null ? apiOtb : bankBalance).toFixed(2),
        authorized: apiAuthorized.toFixed(2),
        api_synced: isApiSynced,
        synced_at: new Date().toISOString(),
        account_number: tbankAccountNum,
      },
      cash: { name: 'Сейф (Наличные ТК)', balance: cashBalance.toFixed(2) },
      fuel_card: { name: 'Топливные карты (ГСМ)', balance: fuelBalance.toFixed(2) },
      garage: {
        id: GARAGE_ID,
        name: 'Касса Гаража (СТО)',
        balance: garageBalance.toFixed(2),
      },
    };

    walletsCache = { data: result, timestamp: Date.now() };

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
