/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const BANK_ID = '10000000-0000-0000-0000-000000000001';
const CASH_ID = '10000000-0000-0000-0000-000000000002';
const CARD_ID = '10000000-0000-0000-0000-000000000003';

const sum = (rows: any[]) =>
  (rows ?? []).reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0);

const sumWhere = (rows: any[], key: string, val: string) =>
  (rows ?? [])
    .filter((r: any) => r[key] === val)
    .reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0);

export async function GET() {
  try {
    const supabase = createAdminClient();

    const [
      { data: bankOrders },
      { data: cardOrders },
      { data: cashOrders },
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

      (supabase.from('trip_orders') as any)
        .select('amount')
        .eq('payment_method', 'cash')
        .eq('settlement_status', 'completed')
        .eq('lifecycle_status', 'approved'),

      (supabase.from('cash_collections') as any).select('amount'),

      (supabase.from('transactions') as any)
        .select('amount, to_wallet_id')
        .in('to_wallet_id', [BANK_ID, CASH_ID, CARD_ID])
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

      (supabase.from('transactions') as any)
        .select('amount, from_wallet_id')
        .in('from_wallet_id', [BANK_ID, CASH_ID, CARD_ID])
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

    const driversAccountable = Math.max(0, sum(cashOrders ?? []) - collectionsTotal);

    return NextResponse.json({
      bank: { name: 'Расчётный счёт', balance: bankBalance.toFixed(2) },
      cash: { name: 'Сейф (Наличные)', balance: cashBalance.toFixed(2) },
      card: { name: 'Карта', balance: cardBalance.toFixed(2) },
      drivers_accountable: driversAccountable.toFixed(2),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
