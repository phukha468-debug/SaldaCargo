import https from 'https';
import { getTBankEnv } from '@saldacargo/shared';
import { getTBankTrustedCaList } from './russianTrustedCa';

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
    account?: string;
    inn?: string;
    kpp?: string;
    name?: string;
    bankName?: string;
    bankBic?: string;
  };
}

export interface TBankBalanceResult {
  success: boolean;
  balance?: number;
  otb?: number;
  authorized?: number;
  accountNumber?: string;
  adjustment?: string;
  error?: string;
}

const TBANK_HOSTS = ['business.tbank.ru', 'business.tinkoff.ru'] as const;

const balanceCache = new Map<string, { data: TBankBalanceResult; timestamp: number }>();
const BALANCE_CACHE_TTL = 25000;
const inFlightBalancePromises = new Map<string, Promise<TBankBalanceResult>>();

const statementCache = new Map<string, { data: TBankOperation[]; timestamp: number }>();
const STATEMENT_CACHE_TTL = 25000;
const inFlightStatementPromises = new Map<string, Promise<TBankOperation[]>>();

export interface TBankCredentialsOptions {
  token?: string;
  accountNumber?: string;
  cacheKey?: string;
  /** По умолчанию true (обратная совместимость для Тенанта №1). Для других тенантов передавать false. */
  allowEnvFallback?: boolean;
}

export function invalidateTBankCache(cacheKey?: string): void {
  if (cacheKey) {
    balanceCache.delete(cacheKey);
  } else {
    balanceCache.clear();
  }
}

/**
 * Запрос к Open API Т-Банка со строгой TLS-верификацией (НУЦ Минцифры РФ + стандартные CA).
 */
function requestTBankApi(
  host: string,
  path: string,
  token: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  bodyPayload?: unknown,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const bodyString = bodyPayload !== undefined ? JSON.stringify(bodyPayload) : undefined;
    const headers: Record<string, string | number> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (bodyString !== undefined) {
      headers['Content-Length'] = Buffer.byteLength(bodyString);
    }

    const req = https.request(
      {
        hostname: host,
        port: 443,
        path,
        method,
        headers,
        ca: getTBankTrustedCaList(),
        rejectUnauthorized: true,
        timeout: 4000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            if (!body.trim()) {
              resolve({ ok: true });
              return;
            }
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
    if (bodyString !== undefined) {
      req.write(bodyString);
    }
    req.end();
  });
}

function extractAccounts(data: unknown): TBankAccount[] | null {
  if (Array.isArray(data)) return data as TBankAccount[];
  if (
    data &&
    typeof data === 'object' &&
    Array.isArray((data as { accounts?: unknown }).accounts)
  ) {
    return (data as { accounts: TBankAccount[] }).accounts;
  }
  return null;
}

/**
 * Получить список счетов и актуальные остатки через Open API Т-Банка.
 */
export async function fetchTBankAccounts(apiToken: string): Promise<TBankAccount[]> {
  let lastError: unknown;
  for (const host of TBANK_HOSTS) {
    try {
      const data = await requestTBankApi(host, '/openapi/api/v3/bank-accounts', apiToken);
      const accounts = extractAccounts(data);
      if (accounts) return accounts;
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Таймаут')) {
        throw err;
      }
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error('Не удалось подключиться к Т-Банк API');
}

/**
 * Получить выписку операций по счёту из Open API Т-Банка.
 */
export async function fetchTBankStatement(
  fromDate: string,
  toDate?: string,
  apiToken?: string,
  accountNumber?: string,
  forceRefresh = false,
): Promise<TBankOperation[]> {
  const tbankEnv = getTBankEnv();
  const token = apiToken || tbankEnv?.token;
  const acc = accountNumber || tbankEnv?.accountNumber;
  if (!token || !acc) {
    return [];
  }

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

  const promise = (async (): Promise<TBankOperation[]> => {
    for (const host of TBANK_HOSTS) {
      try {
        const data = (await requestTBankApi(host, path, token)) as {
          operations?: TBankOperation[];
        } | null;
        const ops = Array.isArray(data?.operations) ? data.operations : [];
        statementCache.set(cacheKey, { data: ops, timestamp: Date.now() });
        return ops;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('Таймаут')) break;
      }
    }

    const fallbackCached = statementCache.get(cacheKey);
    if (fallbackCached) return fallbackCached.data;
    return [];
  })().finally(() => {
    inFlightStatementPromises.delete(cacheKey);
  });

  inFlightStatementPromises.set(cacheKey, promise);
  return promise;
}

/**
 * Синхронизировать баланс Р/С с реальными данными из Т-Банка.
 */
export async function syncTBankBalance(
  forceRefresh = false,
  credentials?: TBankCredentialsOptions,
): Promise<TBankBalanceResult> {
  const allowEnvFallback = credentials?.allowEnvFallback !== false;
  const tbankEnv = allowEnvFallback ? getTBankEnv() : null;
  const token = credentials?.token || tbankEnv?.token;
  const targetAccountNumber = credentials?.accountNumber || tbankEnv?.accountNumber;
  const cacheKey = credentials?.cacheKey || targetAccountNumber || 'default';

  const cached = balanceCache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.timestamp < BALANCE_CACHE_TTL) {
    return cached.data;
  }

  const inFlight = inFlightBalancePromises.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  if (!token) {
    return {
      success: false,
      error:
        'TBANK_API_TOKEN не настроен. Выпустите токен в личном кабинете Т-Бизнес (Настройки -> Open API).',
    };
  }

  const promise = (async (): Promise<TBankBalanceResult> => {
    try {
      const accounts = await fetchTBankAccounts(token);
      const targetAccount =
        (targetAccountNumber
          ? accounts.find((a) => a.accountNumber === targetAccountNumber)
          : undefined) || accounts[0];

      if (!targetAccount) {
        return { success: false, error: 'Расчётный счёт не найден в ответе Т-Банка' };
      }

      const otb = typeof targetAccount.balance?.otb === 'number' ? targetAccount.balance.otb : 0;
      const authorized =
        typeof targetAccount.balance?.authorized === 'number'
          ? targetAccount.balance.authorized
          : 0;
      const realBalance =
        typeof targetAccount.balance?.otb === 'number' ? otb : Number(targetAccount.balance) || 0;

      const result: TBankBalanceResult = {
        success: true,
        balance: realBalance,
        otb,
        authorized,
        accountNumber: targetAccount.accountNumber,
        adjustment: '0.00',
      };

      balanceCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (err: unknown) {
      const stale = balanceCache.get(cacheKey);
      if (stale) {
        return stale.data;
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Ошибка Т-Банк API',
      };
    }
  })().finally(() => {
    inFlightBalancePromises.delete(cacheKey);
  });

  inFlightBalancePromises.set(cacheKey, promise);
  return promise;
}

export interface RegisterTBankWebhookParams {
  apiToken: string;
  url: string;
  eventType?: string;
  email?: string;
  authSecret?: string;
}

/**
 * Зарегистрировать вебхук в Open API Т-Бизнеса (по умолчанию на событие `oper-feed-operation`).
 */
export async function registerTBankWebhook(
  params: RegisterTBankWebhookParams,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const payload: Record<string, unknown> = {
    url: params.url,
    eventType: params.eventType || 'oper-feed-operation',
  };
  if (params.email) payload.email = params.email;
  if (params.authSecret) {
    payload.authType = 'Bearer';
    payload.authSecret = params.authSecret;
  }

  let lastError: unknown;
  for (const host of TBANK_HOSTS) {
    try {
      const data = await requestTBankApi(
        host,
        '/openapi/api/v1/webhook',
        params.apiToken,
        'POST',
        payload,
      );
      return { success: true, data };
    } catch (err) {
      lastError = err;
    }
  }
  return {
    success: false,
    error:
      lastError instanceof Error ? lastError.message : 'Не удалось зарегистрировать вебхук Т-Банка',
  };
}

/**
 * Получить список активных вебхуков компании в Т-Бизнесе.
 */
export async function listTBankWebhooks(
  apiToken: string,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  let lastError: unknown;
  for (const host of TBANK_HOSTS) {
    try {
      const data = await requestTBankApi(
        host,
        '/openapi/api/v1/webhooks/by-company',
        apiToken,
        'GET',
      );
      return { success: true, data };
    } catch (err) {
      lastError = err;
    }
  }
  return {
    success: false,
    error:
      lastError instanceof Error
        ? lastError.message
        : 'Не удалось получить список вебхуков Т-Банка',
  };
}
