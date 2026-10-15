/* eslint-disable @typescript-eslint/no-explicit-any */
import https from 'https';

export const TARGET_ACCOUNT_NUMBER = '40802810500001961654';

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

export const TBANK_FALLBACK_TOKEN =
  't.mOBb0LuZQvgaz2LNItGsy45aAjBmikPwHaVqTTpHOGHE-YAh2rNox5C2ZD8kLZJQIstHqyg6G8rQNzVUyQ60JA';

export interface TBankOperation {
  operationId: string;
  operationDate: string;
  typeOfOperation: 'Credit' | 'Debit' | string;
  operationAmount: number;
  rubleAmount?: number;
  description: string;
  payPurpose?: string;
  category?: string;
  documentNumber?: string;
  payer?: {
    name?: string;
    inn?: string;
    acct?: string;
  };
  receiver?: {
    name?: string;
    inn?: string;
    acct?: string;
  };
  counterParty?: {
    name?: string;
    inn?: string;
    account?: string;
  };
}

// In-memory cache for T-Bank balance and statements
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

let balanceCache: CacheEntry<{
  success: boolean;
  balance?: number;
  otb?: number;
  authorized?: number;
  accountNumber?: string;
  adjustment?: string;
  error?: string;
}> | null = null;

const statementCache = new Map<string, CacheEntry<TBankOperation[]>>();

let inFlightBalancePromise: Promise<{
  success: boolean;
  balance?: number;
  otb?: number;
  authorized?: number;
  accountNumber?: string;
  adjustment?: string;
  error?: string;
}> | null = null;

const inFlightStatementPromises = new Map<string, Promise<TBankOperation[]>>();

const BALANCE_CACHE_TTL = 45000; // 45 секунд
const STATEMENT_CACHE_TTL = 30000; // 30 секунд

export function invalidateTBankCache() {
  balanceCache = null;
  statementCache.clear();
}

/**
 * Получить выписку операций по счёту из Open API Т-Банка
 */
export async function fetchTBankStatement(
  fromDate: string, // YYYY-MM-DDTHH:mm:ssZ
  toDate?: string,
  apiToken?: string,
  accountNumber?: string,
  forceRefresh = false,
): Promise<TBankOperation[]> {
  const token = apiToken || process.env.TBANK_API_TOKEN || TBANK_FALLBACK_TOKEN;
  const acc = accountNumber || TARGET_ACCOUNT_NUMBER;
  const cacheKey = `${acc}:${fromDate}:${toDate || ''}`;

  if (!forceRefresh) {
    const cached = statementCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < STATEMENT_CACHE_TTL) {
      return cached.data;
    }
  }

  const existingInFlight = inFlightStatementPromises.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  let path = `/openapi/api/v1/statement?accountNumber=${encodeURIComponent(acc)}&from=${encodeURIComponent(fromDate)}`;
  if (toDate) {
    path += `&to=${encodeURIComponent(toDate)}`;
  }

  const promise = (async () => {
    try {
      const data = await requestTBankApi('business.tbank.ru', path, token);
      const ops = Array.isArray(data?.operations) ? data.operations : [];
      statementCache.set(cacheKey, { data: ops, timestamp: Date.now() });
      return ops;
    } catch (err: any) {
      if (!err?.message?.includes('Таймаут')) {
        try {
          const data2 = await requestTBankApi('business.tinkoff.ru', path, token);
          const ops2 = Array.isArray(data2?.operations) ? data2.operations : [];
          statementCache.set(cacheKey, { data: ops2, timestamp: Date.now() });
          return ops2;
        } catch {
          // ignore
        }
      }
      console.error('TBank statement fetch error:', err);
      // Если есть старый кэш, отдаем его даже при ошибке/таймауте
      const fallbackCached = statementCache.get(cacheKey);
      if (fallbackCached) return fallbackCached.data;
      return [];
    }
  })().finally(() => {
    inFlightStatementPromises.delete(cacheKey);
  });

  inFlightStatementPromises.set(cacheKey, promise);
  return promise;
}

/**
 * Синхронизировать баланс Р/С с реальными данными из Т-Банка
 */
export async function syncTBankBalance(forceRefresh = false): Promise<{
  success: boolean;
  balance?: number;
  otb?: number;
  authorized?: number;
  accountNumber?: string;
  adjustment?: string;
  error?: string;
}> {
  if (!forceRefresh && balanceCache && Date.now() - balanceCache.timestamp < BALANCE_CACHE_TTL) {
    return balanceCache.data;
  }

  if (inFlightBalancePromise) {
    return inFlightBalancePromise;
  }

  const token = process.env.TBANK_API_TOKEN || TBANK_FALLBACK_TOKEN;

  if (!token) {
    return {
      success: false,
      error:
        'TBANK_API_TOKEN не настроен. Выпустите токен в личном кабинете Т-Бизнес (Настройки -> Open API).',
    };
  }

  inFlightBalancePromise = (async () => {
    try {
      const accounts = await fetchTBankAccounts(token);
      const targetAccount =
        accounts.find((a) => a.accountNumber === TARGET_ACCOUNT_NUMBER) || accounts[0];

      if (!targetAccount) {
        return { success: false, error: 'Счёт 40802810500001961654 не найден в ответе Т-Банка' };
      }

      const otb = typeof targetAccount.balance?.otb === 'number' ? targetAccount.balance.otb : 0;
      const authorized =
        typeof targetAccount.balance?.authorized === 'number'
          ? targetAccount.balance.authorized
          : 0;
      // Полный баланс расчётного счёта в Т-Банке (включая авторизованные суммы/холды по картам)
      const realBalance =
        typeof targetAccount.balance?.otb === 'number'
          ? otb + authorized
          : Number(targetAccount.balance) || 0;

      const adjustmentString = '0.00';

      const result = {
        success: true,
        balance: realBalance,
        otb,
        authorized,
        accountNumber: targetAccount.accountNumber,
        adjustment: adjustmentString,
      };

      balanceCache = { data: result, timestamp: Date.now() };
      return result;
    } catch (err: any) {
      // При таймауте или временном сбое отдаем кэшированный баланс
      if (balanceCache) {
        return balanceCache.data;
      }
      return { success: false, error: err.message };
    }
  })().finally(() => {
    inFlightBalancePromise = null;
  });

  return inFlightBalancePromise;
}
