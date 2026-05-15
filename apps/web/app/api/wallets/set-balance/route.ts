/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const WALLET_IDS: Record<string, string> = {
  bank: '10000000-0000-0000-0000-000000000001',
  cash: '10000000-0000-0000-0000-000000000002',
  card: '10000000-0000-0000-0000-000000000003',
};

const sum = (rows: any[]) =>
  (rows ?? []).reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0);
const sumWhere = (rows: any[], key: string, val: string) =>
  (rows ?? [])
    .filter((r: any) => r[key] === val)
    .reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0);

/** POST /api/wallets/set-balance — установить баланс кошелька через корректировочную транзакцию */
export async function POST(request: Request) {
  try {
    const { wallet, target_amount } = (await request.json()) as {
      wallet: string;
      target_amount: string;
    };

    const walletId = WALLET_IDS[wallet];
    if (!walletId) return NextResponse.json({ error: 'Неизвестный кошелёк' }, { status: 400 });

    const target = parseFloat(target_amount);
    if (isNaN(target) || target < 0) {
      return NextResponse.json({ error: 'Некорректная сумма' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: adminUser } = await (supabase.from('users') as any)
      .select('id')
      .overlaps('roles', ['admin', 'owner'])
      .limit(1)
      .single();

    if (!adminUser) return NextResponse.json({ error: 'Администратор не найден' }, { status: 500 });

    // Считаем текущий баланс кошелька
    const BANK_ID = WALLET_IDS.bank!;
    const CASH_ID = WALLET_IDS.cash!;
    const CARD_ID = WALLET_IDS.card!;

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

    const currentBalances: Record<string, number> = {
      bank:
        sum(bankOrders ?? []) +
        sumWhere(txIn ?? [], 'to_wallet_id', BANK_ID) -
        sumWhere(txOut ?? [], 'from_wallet_id', BANK_ID),
      cash:
        collectionsTotal +
        sumWhere(txIn ?? [], 'to_wallet_id', CASH_ID) -
        sumWhere(txOut ?? [], 'from_wallet_id', CASH_ID),
      card:
        sum(cardOrders ?? []) +
        sumWhere(txIn ?? [], 'to_wallet_id', CARD_ID) -
        sumWhere(txOut ?? [], 'from_wallet_id', CARD_ID),
    };

    const current = currentBalances[wallet] ?? 0;
    const delta = target - current;

    if (Math.abs(delta) < 0.01) {
      return NextResponse.json({ ok: true, adjustment: '0.00', message: 'Баланс не изменился' });
    }

    const isIncome = delta > 0;
    const adjustmentAmount = Math.abs(delta).toFixed(2);

    const { error: txErr } = await (supabase.from('transactions') as any).insert({
      direction: isIncome ? 'income' : 'expense',
      amount: adjustmentAmount,
      ...(isIncome ? { to_wallet_id: walletId } : { from_wallet_id: walletId }),
      lifecycle_status: 'approved',
      settlement_status: 'completed',
      description: 'Корректировка остатка',
      created_by: adminUser.id,
      idempotency_key: crypto.randomUUID(),
    });

    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      adjustment: (isIncome ? '+' : '-') + adjustmentAmount,
      previous_balance: current.toFixed(2),
      new_balance: target.toFixed(2),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
