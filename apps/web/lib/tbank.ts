/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';

const TBANK_API_URL = 'https://business.tbank.ru/openapi/api/v1';
const BANK_WALLET_ID = '10000000-0000-0000-0000-000000000001';
const TARGET_ACCOUNT_NUMBER = '40802810500001961654';

export interface TBankBalanceItem {
  accountNumber: string;
  balance: number;
  currency: string;
  status: string;
}

/**
 * Получить баланс счетов через Open API Т-Бизнес
 */
export async function fetchTBankBalances(apiToken: string): Promise<TBankBalanceItem[]> {
  const res = await fetch(`${TBANK_API_URL}/bank-accounts/balance`, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Т-Банк API ошибка (${res.status}): ${errorText || res.statusText}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : data.balances || [];
}

/**
 * Синхронизировать баланс Р/С с реальными данными из Т-Банка
 */
export async function syncTBankBalance(): Promise<{
  success: boolean;
  balance?: number;
  error?: string;
}> {
  const token = process.env.TBANK_API_TOKEN;
  if (!token) {
    return {
      success: false,
      error:
        'TBANK_API_TOKEN не настроен. Выпустите токен в личном кабинете Т-Бизнес (Настройки -> Open API).',
    };
  }

  try {
    const balances = await fetchTBankBalances(token);
    const targetAccount =
      balances.find((b) => b.accountNumber === TARGET_ACCOUNT_NUMBER) || balances[0];

    if (!targetAccount) {
      return { success: false, error: 'Счёт 40802810500001961654 не найден в ответе Т-Банка' };
    }

    const realBalance = targetAccount.balance;

    // Автоматическая корректировка баланса кошелька в системе
    const supabase = createAdminClient();
    const { data: adminUser } = await (supabase.from('users') as any)
      .select('id')
      .or('roles.cs.{admin},roles.cs.{owner}')
      .limit(1)
      .single();

    if (adminUser) {
      // Подсчитываем текущий баланс по транзакциям
      const [{ data: bankOrders }, { data: txIn }, { data: txOut }] = await Promise.all([
        (supabase.from('trip_orders') as any)
          .select('amount')
          .in('payment_method', ['bank_invoice', 'qr'])
          .eq('settlement_status', 'completed')
          .eq('lifecycle_status', 'approved'),
        (supabase.from('transactions') as any)
          .select('amount')
          .eq('to_wallet_id', BANK_WALLET_ID)
          .eq('lifecycle_status', 'approved')
          .eq('settlement_status', 'completed'),
        (supabase.from('transactions') as any)
          .select('amount')
          .eq('from_wallet_id', BANK_WALLET_ID)
          .eq('lifecycle_status', 'approved')
          .eq('settlement_status', 'completed'),
      ]);

      const sum = (rows: any[]) =>
        (rows ?? []).reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0);

      const currentBalance = sum(bankOrders ?? []) + sum(txIn ?? []) - sum(txOut ?? []);
      const delta = realBalance - currentBalance;

      if (Math.abs(delta) >= 0.01) {
        const isIncome = delta > 0;
        const amount = Math.abs(delta).toFixed(2);
        const CAT_OTHER_INCOME = '68225ea2-d7de-4442-8ed8-ce2366b5d369';
        const CAT_OTHER_EXPENSE = 'df1022df-4ea6-46fc-b9aa-f3c9eb4e7f30';

        await (supabase.from('transactions') as any).insert({
          direction: isIncome ? 'income' : 'expense',
          amount,
          category_id: isIncome ? CAT_OTHER_INCOME : CAT_OTHER_EXPENSE,
          ...(isIncome ? { to_wallet_id: BANK_WALLET_ID } : { from_wallet_id: BANK_WALLET_ID }),
          lifecycle_status: 'approved',
          settlement_status: 'completed',
          description: 'Синхронизация с Т-Банк API',
          created_by: adminUser.id,
          idempotency_key: crypto.randomUUID(),
        });
      }
    }

    return { success: true, balance: realBalance };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
