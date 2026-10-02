/* eslint-disable @typescript-eslint/no-explicit-any */
import https from 'https';
import { createAdminClient } from '@/lib/supabase/admin';

const BANK_WALLET_ID = '10000000-0000-0000-0000-000000000001';
const TARGET_ACCOUNT_NUMBER = '40802810500001961654';

export interface TBankAccount {
  accountNumber: string;
  name?: string;
  currency?: string;
  bankBik?: string;
  balance?: {
    otb?: number;
    authorized?: number;
    pendingPayments?: number;
    pendingRequisitions?: number;
  };
}

/**
 * Запрос к Open API Т-Банка с поддержкой национального сертификата (Минцифры РФ)
 */
function requestTBankApi(host: string, path: string, token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        port: 443,
        path,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        rejectUnauthorized: false, // Т-Банк использует сертификаты Национального удостоверяющего центра Минцифры
        timeout: 2500,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch {
              reject(new Error(`Некорректный JSON ответа Т-Банка: ${body}`));
            }
          } else {
            reject(
              new Error(`Т-Банк API ошибка (${res.statusCode}): ${body || res.statusMessage}`),
            );
          }
        });
      },
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Таймаут соединения с Т-Банк API'));
    });
    req.end();
  });
}

/**
 * Получить список счетов и актуальные остатки через Open API Т-Банка
 */
export async function fetchTBankAccounts(apiToken: string): Promise<TBankAccount[]> {
  try {
    const data = await requestTBankApi(
      'business.tbank.ru',
      '/openapi/api/v3/bank-accounts',
      apiToken,
    );
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.accounts)) return data.accounts;
  } catch (err: any) {
    // Если ошибка не по таймауту, пробуем резервный хост
    if (!err?.message?.includes('Таймаут')) {
      try {
        const data2 = await requestTBankApi(
          'business.tinkoff.ru',
          '/openapi/api/v3/bank-accounts',
          apiToken,
        );
        if (Array.isArray(data2)) return data2;
        if (Array.isArray(data2?.accounts)) return data2.accounts;
      } catch {
        // ignore
      }
    }
    throw err;
  }

  throw new Error('Не удалось подключиться к Т-Банк API');
}

const TBANK_FALLBACK_TOKEN =
  't.mOBb0LuZQvgaz2LNItGsy45aAjBmikPwHaVqTTpHOGHE-YAh2rNox5C2ZD8kLZJQIstHqyg6G8rQNzVUyQ60JA';

/**
 * Синхронизировать баланс Р/С с реальными данными из Т-Банка
 */
export async function syncTBankBalance(): Promise<{
  success: boolean;
  balance?: number;
  otb?: number;
  authorized?: number;
  accountNumber?: string;
  adjustment?: string;
  error?: string;
}> {
  const token = process.env.TBANK_API_TOKEN || TBANK_FALLBACK_TOKEN;

  if (!token) {
    return {
      success: false,
      error:
        'TBANK_API_TOKEN не настроен. Выпустите токен в личном кабинете Т-Бизнес (Настройки -> Open API).',
    };
  }

  try {
    const accounts = await fetchTBankAccounts(token);
    const targetAccount =
      accounts.find((a) => a.accountNumber === TARGET_ACCOUNT_NUMBER) || accounts[0];

    if (!targetAccount) {
      return { success: false, error: 'Счёт 40802810500001961654 не найден в ответе Т-Банка' };
    }

    const otb = typeof targetAccount.balance?.otb === 'number' ? targetAccount.balance.otb : 0;
    const authorized =
      typeof targetAccount.balance?.authorized === 'number' ? targetAccount.balance.authorized : 0;
    // Полный баланс расчётного счёта в Т-Банке (включая авторизованные суммы/холды по картам)
    const realBalance =
      typeof targetAccount.balance?.otb === 'number'
        ? otb + authorized
        : Number(targetAccount.balance) || 0;

    // Автоматическая корректировка баланса кошелька в системе при расхождении
    const supabase = createAdminClient();
    const { data: adminUser } = await (supabase.from('users') as any)
      .select('id')
      .or('roles.cs.{admin},roles.cs.{owner}')
      .limit(1)
      .single();

    let adjustmentString = '0.00';

    if (adminUser) {
      const [{ data: bankOrders }, { data: txIn }, { data: txOut }] = await Promise.all([
        (supabase.from('trip_orders') as any)
          .select('amount')
          .in('payment_method', ['bank_invoice', 'qr'])
          .eq('settlement_status', 'completed')
          .eq('lifecycle_status', 'approved'),
        (supabase.from('transactions') as any)
          .select('amount, trip_order_id')
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

      // Исключаем транзакции с trip_order_id, так как эти заказы уже учтены в bankOrders
      const txInFiltered = (txIn ?? []).filter((r: any) => !r.trip_order_id);
      const currentBalance = sum(bankOrders ?? []) + sum(txInFiltered) - sum(txOut ?? []);
      const delta = realBalance - currentBalance;

      if (Math.abs(delta) >= 0.01) {
        const isIncome = delta > 0;
        const amount = Math.abs(delta).toFixed(2);
        adjustmentString = (isIncome ? '+' : '-') + amount;

        const CAT_OTHER_INCOME = '68225ea2-d7de-4442-8ed8-ce2366b5d369';
        const CAT_OTHER_EXPENSE = 'df1022df-4ea6-46fc-b9aa-f3c9eb4e7f30';

        await (supabase.from('transactions') as any).insert({
          direction: isIncome ? 'income' : 'expense',
          amount,
          category_id: isIncome ? CAT_OTHER_INCOME : CAT_OTHER_EXPENSE,
          ...(isIncome ? { to_wallet_id: BANK_WALLET_ID } : { from_wallet_id: BANK_WALLET_ID }),
          lifecycle_status: 'approved',
          settlement_status: 'completed',
          description: 'Корректировка остатка (Т-Банк API)',
          created_by: adminUser.id,
          idempotency_key: crypto.randomUUID(),
        });
      }
    }

    return {
      success: true,
      balance: realBalance,
      otb,
      authorized,
      accountNumber: targetAccount.accountNumber,
      adjustment: adjustmentString,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
