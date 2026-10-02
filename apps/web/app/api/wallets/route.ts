/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { syncTBankBalance } from '@/lib/tbank';
import { NextResponse } from 'next/server';

const BANK_ID = '10000000-0000-0000-0000-000000000001';
const CASH_ID = '10000000-0000-0000-0000-000000000002';
const CARD_ID = '10000000-0000-0000-0000-000000000003';
const FUEL_CARD_ID = '10000000-0000-0000-0000-000000000004';
const GARAGE_ID = '10000000-0000-0000-0000-000000000005';

const sum = (rows: any[]) =>
  (rows ?? []).reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0);

const sumWhere = (rows: any[], key: string, val: string, excludeTripOrders = false) =>
  (rows ?? [])
    .filter((r: any) => r[key] === val && (!excludeTripOrders || !r.trip_order_id))
    .reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0);

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 15;

export async function GET() {
  try {
    let apiBalance: number | null = null;
    let isApiSynced = false;
    let tbankAccountNum = '';
    let apiAuthorized = 0;
    let apiOtb = 0;

    // Автоматическая синхронизация с Т-Банком с защитой от зависания (макс 2.5 сек)
    try {
      const syncPromise = syncTBankBalance();
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

    const [
      { data: bankOrders },
      { data: cardOrders },
      { data: collections },
      { data: txIn },
      { data: txOut },
    ] = await Promise.all([
      (supabase.from('trip_orders') as any)
        .select('amount')
        .in('payment_method', ['bank_invoice', 'qr'])
        .eq('settlement_status', 'completed')
        .eq('lifecycle_status', 'approved'),

      (supabase.from('trip_orders') as any)
        .select('amount')
        .eq('payment_method', 'card_driver')
        .eq('settlement_status', 'completed')
        .eq('lifecycle_status', 'approved'),

      (supabase.from('cash_collections') as any).select('amount'),

      (supabase.from('transactions') as any)
        .select('amount, to_wallet_id, trip_order_id')
        .in('to_wallet_id', [BANK_ID, CASH_ID, CARD_ID, FUEL_CARD_ID, GARAGE_ID])
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

      (supabase.from('transactions') as any)
        .select('amount, from_wallet_id')
        .in('from_wallet_id', [BANK_ID, CASH_ID, CARD_ID, FUEL_CARD_ID, GARAGE_ID])
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),
    ]);

    const collectionsTotal = sum(collections ?? []);

    // Резервный расчёт по БД без задвоения заказов
    const fallbackBankBalance =
      sum(bankOrders ?? []) +
      sumWhere(txIn ?? [], 'to_wallet_id', BANK_ID, true) -
      sumWhere(txOut ?? [], 'from_wallet_id', BANK_ID);

    // БЕЗУСЛОВНЫЙ ПРИОРИТЕТ ДАННЫХ АПИ Т-БАНКА:
    // Если API вернул баланс, показываем строго его. Никакие отметки оплаченных счетов не завышают остаток.
    const bankBalance = apiBalance !== null ? apiBalance : fallbackBankBalance;

    const cashBalance =
      collectionsTotal +
      sumWhere(txIn ?? [], 'to_wallet_id', CASH_ID) -
      sumWhere(txOut ?? [], 'from_wallet_id', CASH_ID);

    const cardBalance =
      sum(cardOrders ?? []) +
      sumWhere(txIn ?? [], 'to_wallet_id', CARD_ID) -
      sumWhere(txOut ?? [], 'from_wallet_id', CARD_ID);

    const fuelBalance =
      sumWhere(txIn ?? [], 'to_wallet_id', FUEL_CARD_ID) -
      sumWhere(txOut ?? [], 'from_wallet_id', FUEL_CARD_ID);

    const garageBalance =
      sumWhere(txIn ?? [], 'to_wallet_id', GARAGE_ID) -
      sumWhere(txOut ?? [], 'from_wallet_id', GARAGE_ID);

    return NextResponse.json(
      {
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
        card: { name: 'Карта', balance: cardBalance.toFixed(2) },
        fuel_card: { name: 'Топливные карты (ГСМ)', balance: fuelBalance.toFixed(2) },
        garage: {
          id: GARAGE_ID,
          name: 'Касса Гаража (СТО)',
          balance: garageBalance.toFixed(2),
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      },
    );
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
