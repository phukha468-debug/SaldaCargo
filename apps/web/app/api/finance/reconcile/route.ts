/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const BANK_ID = '10000000-0000-0000-0000-000000000001';
const CASH_ID = '10000000-0000-0000-0000-000000000002';
const FUEL_CARD_ID = '10000000-0000-0000-0000-000000000004';
const GARAGE_ID = '10000000-0000-0000-0000-000000000005';

const sum = (rows: any[]) =>
  (rows ?? []).reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0);

/**
 * GET /api/finance/reconcile — Полная финансовая ревизия активов, пассивов и капитала
 */
export async function GET() {
  try {
    const supabase = createAdminClient();

    const [
      { data: bankOrders },
      { data: collections },
      { data: bankIn },
      { data: bankOut },
      { data: cashIn },
      { data: cashOut },
      { data: fuelIn },
      { data: fuelOut },
      { data: garageIn },
      { data: garageOut },
      { data: loans },
      { data: receivables },
      { data: supplierDebts },
    ] = await Promise.all([
      (supabase.from('trip_orders') as any)
        .select('amount')
        .in('payment_method', ['bank_invoice', 'qr'])
        .eq('settlement_status', 'completed')
        .eq('lifecycle_status', 'approved'),

      (supabase.from('cash_collections') as any).select('amount'),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('to_wallet_id', BANK_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('from_wallet_id', BANK_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('to_wallet_id', CASH_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('from_wallet_id', CASH_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('to_wallet_id', FUEL_CARD_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('from_wallet_id', FUEL_CARD_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

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

      (supabase.from('loans') as any).select('remaining_amount').eq('is_active', true),

      (supabase.from('trip_orders') as any)
        .select('amount')
        .eq('payment_method', 'bank_invoice')
        .eq('settlement_status', 'pending')
        .eq('lifecycle_status', 'approved'),

      (supabase.from('supplier_debts') as any).select('amount'),
    ]);

    const collectionsTotal = sum(collections ?? []);

    const bankBalance = sum(bankOrders ?? []) + sum(bankIn ?? []) - sum(bankOut ?? []);

    const cashBalance = collectionsTotal + sum(cashIn ?? []) - sum(cashOut ?? []);

    // Топливный кошелёк не может быть отрицательным (минимум 0)
    const fuelBalance = Math.max(0, sum(fuelIn ?? []) - sum(fuelOut ?? []));

    const garageBalance = sum(garageIn ?? []) - sum(garageOut ?? []);

    const totalLiquid = bankBalance + cashBalance + fuelBalance + garageBalance;

    const loansTotal = (loans ?? []).reduce(
      (s: number, l: any) => s + parseFloat(l.remaining_amount ?? '0'),
      0,
    );
    const receivablesTotal = sum(receivables ?? []);
    const supplierDebtsTotal = sum(supplierDebts ?? []);

    const totalLiabilities = loansTotal + supplierDebtsTotal;
    const netWorth = totalLiquid + receivablesTotal - totalLiabilities;

    return NextResponse.json({
      liquid_assets: {
        bank: bankBalance.toFixed(2),
        cash: cashBalance.toFixed(2),
        fuel_card: fuelBalance.toFixed(2),
        garage: garageBalance.toFixed(2),
        total: totalLiquid.toFixed(2),
      },
      receivables: receivablesTotal.toFixed(2),
      liabilities: {
        loans: loansTotal.toFixed(2),
        suppliers: supplierDebtsTotal.toFixed(2),
        total: totalLiabilities.toFixed(2),
      },
      net_worth: netWorth.toFixed(2),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
