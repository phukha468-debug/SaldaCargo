/* eslint-disable @typescript-eslint/no-explicit-any */
import https from 'https';

export interface Opti24Card {
  id: string;
  number: string;
  status: string;
  statusName: string;
  product: 'wallet' | 'limit' | string;
  productName: string;
  availableAmount?: number;
  carrier?: string;
  comment?: string | null;
}

export interface Opti24ContractBalance {
  contractId: string;
  contractNumber: string;
  availableAmount: number;
  ownBalance: number;
  consumptionMonthRub: number;
  consumptionMonthLiters: number;
  currency: string;
}

export interface Opti24Transaction {
  id: string;
  cardNumber: string;
  timestamp: string;
  productName: string;
  qty: number;
  price: number;
  sum: number;
  stationAddress?: string;
}

interface Opti24Session {
  sessionId: string;
  contractId: string;
  expiresAt: number;
}

let cachedSession: Opti24Session | null = null;
const cardBalanceCache = new Map<string, { data: any; cachedAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 минут кэш для экономии лимита 500 запросов/мес

function getEnvConfig() {
  const apiUrl = process.env.OPTI24_API_URL || 'https://api-demo.opti-24.ru';
  const login = process.env.OPTI24_LOGIN || 'demo';
  const passwordHash =
    process.env.OPTI24_PASSWORD_HASH ||
    '243460ae9475d4e1120ee2ba38e8883f3999a1cb808bc482d6820e5b401173cf28abdbebf676cc063e7798957daf4b4aecbe0606e7a78190909c75b7cff101eb';
  const apiKey =
    process.env.OPTI24_API_KEY ||
    'GPN.3ce7b860ece5758d1d27c7f8b4796ea79b33927e.630c2bc76676191bd6e94222d9acaaf56bc0a750';

  return { apiUrl, login, passwordHash, apiKey };
}

function requestOpti24(
  path: string,
  method: 'GET' | 'POST',
  body?: string,
  extraHeaders?: Record<string, string>,
): Promise<any> {
  const { apiUrl, apiKey } = getEnvConfig();
  const url = new URL(path, apiUrl);

  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      api_key: apiKey,
      date_time: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ...extraHeaders,
    };

    if (body) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers['Content-Length'] = String(Buffer.byteLength(body));
    }

    const req = https.request(
      url,
      {
        method,
        headers,
        timeout: 10000,
      },
      (res) => {
        let responseText = '';
        res.on('data', (chunk) => (responseText += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(responseText);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(json);
            } else {
              reject(
                new Error(
                  `Opti24 API Error (${res.statusCode}): ${
                    json?.status?.errors?.[0]?.message || responseText
                  }`,
                ),
              );
            }
          } catch {
            reject(new Error(`Некорректный JSON ответа Opti24: ${responseText}`));
          }
        });
      },
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Таймаут подключения к Opti24 API (10 сек)'));
    });

    if (body) req.write(body);
    req.end();
  });
}

/**
 * Получение активной сессии (с кэшированием до 30 дней для экономии квоты)
 */
export async function getOpti24Session(forceRefresh = false): Promise<Opti24Session> {
  const now = Date.now();
  if (!forceRefresh && cachedSession && cachedSession.expiresAt > now + 3600000) {
    return cachedSession;
  }

  const { login, passwordHash } = getEnvConfig();
  const body = `login=${encodeURIComponent(login)}&password=${encodeURIComponent(passwordHash)}`;

  const res = await requestOpti24('/vip/v1/authUser', 'POST', body);
  if (!res?.data?.session_id) {
    throw new Error('Не удалось получить session_id от Opti24');
  }

  const contractId = res.data.last_contract || res.data.contracts?.[0]?.id || '';
  cachedSession = {
    sessionId: res.data.session_id,
    contractId,
    // Сессия в Опти24 действует 30 дней, ставим 25 дней запаса
    expiresAt: now + 25 * 24 * 3600 * 1000,
  };

  return cachedSession;
}

/**
 * Получение сводного баланса договора
 */
export async function getOpti24ContractBalance(
  contractIdOverride?: string,
): Promise<Opti24ContractBalance> {
  const session = await getOpti24Session();
  const contractId = contractIdOverride || session.contractId;

  const res = await requestOpti24(
    `/vip/v1/getPartContractData?contract_id=${contractId}`,
    'GET',
    undefined,
    {
      session_id: session.sessionId,
    },
  );

  const b = res?.data?.balanceData;
  const c = res?.data?.contractData;

  return {
    contractId,
    contractNumber: c?.contract_number || contractId,
    availableAmount: parseFloat(b?.available_amount || '0'),
    ownBalance: parseFloat(b?.own_balance || '0'),
    consumptionMonthRub: parseFloat(b?.consumption_for_month || '0'),
    consumptionMonthLiters: parseFloat(b?.consumption_for_month_volume || '0'),
    currency: b?.currency || '810',
  };
}

/**
 * Получение списка всех карт договора (1 запрос на весь автопарк)
 */
export async function getOpti24Cards(contractIdOverride?: string): Promise<Opti24Card[]> {
  const session = await getOpti24Session();
  const contractId = contractIdOverride || session.contractId;

  const cacheKey = `cards_${contractId}`;
  const cached = cardBalanceCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const res = await requestOpti24(`/vip/v2/cards?contract_id=${contractId}`, 'GET', undefined, {
    session_id: session.sessionId,
    contract_id: contractId,
  });

  const cardsRaw = res?.data?.result || [];
  const cards: Opti24Card[] = cardsRaw.map((c: any) => ({
    id: c.id,
    number: c.number,
    status: c.status,
    statusName: c.status_name,
    product: c.product,
    productName: c.product_name,
    carrier: c.carrier_name || c.carrier,
    comment: c.comment,
  }));

  cardBalanceCache.set(cacheKey, { data: cards, cachedAt: Date.now() });
  return cards;
}

/**
 * Получение баланса и статуса карты по её 16-значному номеру
 */
export async function getOpti24CardStatus(cardNumber: string): Promise<{
  cardNumber: string;
  found: boolean;
  status?: string;
  statusName?: string;
  product?: string;
  availableAmount?: number;
  contractAvailable?: number;
}> {
  const cleanNumber = cardNumber.replace(/\s+/g, '');
  const cards = await getOpti24Cards();
  const target = cards.find((c) => c.number.replace(/\s+/g, '') === cleanNumber);

  if (!target) {
    return { cardNumber: cleanNumber, found: false };
  }

  // Если это электронный кошелек, получаем детальный баланс кошелька карты
  let cardAvailable: number | undefined = undefined;
  if (target.product === 'wallet') {
    try {
      const session = await getOpti24Session();
      const detailRes = await requestOpti24(
        `/vip/v1/cards?contract_id=${session.contractId}&card_id=${target.id}`,
        'GET',
        undefined,
        { session_id: session.sessionId },
      );
      const first = detailRes?.data?.result?.[0];
      if (first?.available !== undefined) {
        cardAvailable = parseFloat(first.available);
      }
    } catch (e) {
      console.warn('Не удалось получить детальный баланс кошелька карты:', e);
    }
  }

  const contractBalance = await getOpti24ContractBalance();

  return {
    cardNumber: cleanNumber,
    found: true,
    status: target.status,
    statusName: target.statusName,
    product: target.product,
    availableAmount: cardAvailable !== undefined ? cardAvailable : contractBalance.availableAmount,
    contractAvailable: contractBalance.availableAmount,
  };
}
