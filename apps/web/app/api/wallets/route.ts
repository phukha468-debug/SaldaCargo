/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { syncTBankBalance } from '@/lib/tbank';
import { NextResponse } from 'next/server';

const BANK_ID = '10000000-0000-0000-0000-000000000001';
const CASH_ID = '10000000-0000-0000-0000-000000000002';
const CARD_ID = '10000000-0000-0000-0000-000000000003';
const FUEL_CARD_ID = '10000000-0000-0000-0000-000000000004';

const sum = (rows: any[]) =>
  (rows ?? []).reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0);

const sumWhere = (rows: any[], key: string, val: string) =>
  (rows ?? [])
    .filter((r: any) => r[key] === val)
    .reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0);

export async function GET() {
  try {
    // Автоматическая синхронизация с Т-Банком (не блокирующая критически при сетевых сбоях)
    if (process.env.TBANK_API_TOKEN) {
      await syncTBankBalance().catch((e) => console.error('TBank auto-sync in wallets:', e));
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
        .select('amount, to_wallet_id')
        .in('to_wallet_id', [BANK_ID, CASH_ID, CARD_ID, FUEL_CARD_ID])
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

      (supabase.from('transactions') as any)
        .select('amount, from_wallet_id')
        .in('from_wallet_id', [BANK_ID, CASH_ID, CARD_ID, FUEL_CARD_ID])
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),
    ]);

    const collectionsTotal = sum(collections ?? []);

    const bankBalance =
      sum(bankOrders ?? []) +
      sumWhere(txIn ?? [], 'to_wallet_id', BANK_ID) -
      sumWhere(txOut ?? [], 'from_wallet_id', BANK_ID);

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

    return NextResponse.json({
      bank: { name: 'Расчётный счёт', balance: bankBalance.toFixed(2) },
      cash: { name: 'Сейф (Наличные)', balance: cashBalance.toFixed(2) },
      card: { name: 'Карта', balance: cardBalance.toFixed(2) },
      fuel_card: { name: 'Топливные карты (ГСМ)', balance: fuelBalance.toFixed(2) },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
