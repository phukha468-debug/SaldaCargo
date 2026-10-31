/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { invalidateWalletsCache } from '../route';

const WALLET_IDS: Record<string, string> = {
  bank: '10000000-0000-0000-0000-000000000001',
  cash: '10000000-0000-0000-0000-000000000002',
  fuel_card: '10000000-0000-0000-0000-000000000004',
  garage: '10000000-0000-0000-0000-000000000005',
};

const sum = (rows: any[]) =>
  (rows ?? []).reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0);

/** POST /api/wallets/set-balance — скорректировать баланс кошелька (сейф, топливо, гараж) */
export async function POST(request: Request) {
  try {
    const { wallet, target_amount, notes, audited_by } = (await request.json()) as {
      wallet: string;
      target_amount: string | number;
      notes?: string;
      audited_by?: string;
    };

    const walletId = WALLET_IDS[wallet];
    if (!walletId) return NextResponse.json({ error: 'Неизвестный кошелёк' }, { status: 400 });

    let target =
      typeof target_amount === 'number' ? target_amount : parseFloat(String(target_amount));
    if (isNaN(target)) {
      return NextResponse.json({ error: 'Некорректная сумма' }, { status: 400 });
    }

    // Топливный кошелёк не может иметь отрицательное значение (минимум 0)
    if (wallet === 'fuel_card') {
      target = Math.max(0, target);
    }

    const supabase = createAdminClient();

    const { data: adminUser } = await (supabase.from('users') as any)
      .select('id, name')
      .or('roles.cs.{admin},roles.cs.{owner}')
      .limit(1)
      .single();

    if (!adminUser) return NextResponse.json({ error: 'Администратор не найден' }, { status: 500 });

    const BANK_ID = WALLET_IDS.bank!;
    const CASH_ID = WALLET_IDS.cash!;
    const FUEL_CARD_ID = WALLET_IDS.fuel_card!;
    const GARAGE_ID = WALLET_IDS.garage!;

    // 1. Получаем последний подтвержденный суточный аудит
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

    // 2. Считаем фактические движения
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
        .select('amount')
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

    const bankBalance = sum(bankOrders ?? []) + sum(bankIn ?? []) - sum(bankOut ?? []);
    const cashBalance =
      baseCash +
      sum(collectionsAfterAudit ?? []) +
      sum(cashInAfterAudit ?? []) -
      sum(cashOutAfterAudit ?? []);
    const fuelBalance = Math.max(
      0,
      baseFuel + sum(fuelInAfterAudit ?? []) - sum(fuelOutAfterAudit ?? []),
    );
    const garageBalance = sum(garageIn ?? []) - sum(garageOut ?? []);

    const currentBalances: Record<string, number> = {
      bank: bankBalance,
      cash: cashBalance,
      fuel_card: fuelBalance,
      garage: garageBalance,
    };

    const current = currentBalances[wallet] ?? 0;
    const delta = target - current;

    const CAT_OTHER_INCOME = '68225ea2-d7de-4442-8ed8-ce2366b5d369';
    const CAT_OTHER_EXPENSE = 'df1022df-4ea6-46fc-b9aa-f3c9eb4e7f30';

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const isIncome = delta > 0;
    const adjustmentAmount = Math.abs(delta).toFixed(2);

    // 3. Если есть разница, создаем финансовую проводку
    if (Math.abs(delta) >= 0.01) {
      const defaultDesc =
        wallet === 'cash'
          ? isIncome
            ? 'Корректировка остатка сейфа (внесение/излишек)'
            : 'Корректировка остатка сейфа (списание/недостача)'
          : wallet === 'fuel_card'
            ? 'Корректировка топливной карты'
            : 'Корректировка остатка';

      await (supabase.from('transactions') as any).insert({
        direction: isIncome ? 'income' : 'expense',
        amount: adjustmentAmount,
        category_id: isIncome ? CAT_OTHER_INCOME : CAT_OTHER_EXPENSE,
        ...(isIncome ? { to_wallet_id: walletId } : { from_wallet_id: walletId }),
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        description: notes || defaultDesc,
        created_by: adminUser.id,
        // Записываем за 1 сек до аудита, чтобы точка отсчета аудита фиксировала новый баланс
        created_at: new Date(now.getTime() - 1000).toISOString(),
        idempotency_key: crypto.randomUUID(),
      });
    }

    // 4. Фиксируем новый подтвержденный остаток в daily_finance_audits (для сейфа или топлива)
    if (wallet === 'cash' || wallet === 'fuel_card') {
      const auditPayload = {
        id: todayStr,
        date: todayStr,
        audited_at: now.toISOString(),
        audited_by: audited_by || adminUser.name || 'Директор',
        safe_cash_actual: wallet === 'cash' ? target : cashBalance,
        safe_cash_expected: wallet === 'cash' ? current : cashBalance,
        safe_discrepancy: wallet === 'cash' ? delta : 0,
        fuel_card_balance: wallet === 'fuel_card' ? target : fuelBalance,
        status: 'confirmed',
        notes: notes || `Корректировка остатка ${wallet === 'cash' ? 'сейфа' : 'топливной карты'}`,
        updated_at: now.toISOString(),
      };

      await (supabase.from('daily_finance_audits') as any).upsert(auditPayload, {
        onConflict: 'date',
      });
    }

    // 5. Очищаем кэш балансов кошельков
    invalidateWalletsCache();

    return NextResponse.json({
      ok: true,
      adjustment: (isIncome ? '+' : '-') + adjustmentAmount,
      previous_balance: current.toFixed(2),
      new_balance: target.toFixed(2),
      delta: delta.toFixed(2),
      message: 'Остаток успешно скорректирован',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
