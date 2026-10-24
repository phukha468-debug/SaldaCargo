// Утилиты, которые используются во ВСЕХ модулях

import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

/**
 * Генерирует детерминированный UUID на основе сида (строки).
 * Защищает от задвоений в БД за счёт PostgreSQL UNIQUE ограничения на idempotency_key.
 */
export function generateDeterministicUuid(seed: string): string {
  const hash = crypto.createHash('md5').update(seed).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    '8' + hash.substring(17, 20),
    hash.substring(20, 32),
  ].join('-');
}

/**
 * Генерирует idempotency_key при открытии формы.
 * Передаётся с каждой мутацией чтобы сервер отбрасывал дубли.
 */
export function generateIdempotencyKey(): string {
  return uuidv4();
}

/**
 * Форматирует деньги для отображения.
 * ВАЖНО: хранение всегда в строке/DECIMAL, никогда в float.
 */
export function formatMoney(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Форматирует дату для отображения в UI.
 * Все даты в БД в UTC, отображаем в Asia/Yekaterinburg (UTC+5, Верхняя Салда).
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dateOnly.getTime() === today.getTime()) return 'Сегодня';
  if (dateOnly.getTime() === yesterday.getTime()) return 'Вчера';

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Yekaterinburg',
  });
}

/**
 * Форматирует время.
 */
export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Yekaterinburg',
  });
}

/**
 * Форматирует продолжительность в минутах → "3ч 47м"
 */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}м`;
  if (m === 0) return `${h}ч`;
  return `${h}ч ${m}м`;
}

/**
 * Форматирует российский номер телефона для отображения.
 * "+79991234567" → "+7 (999) 123-45-67"
 * Работает с 10- и 11-значными номерами.
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    const d = digits.slice(1);
    return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
  }
  if (digits.length === 10) {
    return `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 10)}`;
  }
  return raw;
}

/**
 * Складывает денежные строки. Никогда не используй обычный +.
 * Пример: addMoney("100.50", "200.00") → "300.50"
 */
export function addMoney(...amounts: (string | number)[]): string {
  const sum = amounts.reduce<number>((acc, val) => {
    return acc + (typeof val === 'string' ? parseFloat(val) : val);
  }, 0);
  return sum.toFixed(2);
}

// ─── Системные финансовые идентификаторы ─────────────────────────────────────
export const FINANCIAL_WALLETS = {
  BANK: '10000000-0000-0000-0000-000000000001',
  CASH: '10000000-0000-0000-0000-000000000002',
  CARD_LEGACY: '10000000-0000-0000-0000-000000000003',
  FUEL_CARD: '10000000-0000-0000-0000-000000000004',
} as const;

export const FINANCIAL_CATEGORIES = {
  TRIP_REVENUE: '74008cf7-0527-4e9f-afd2-d232b8f8125a',
  PAYROLL_DRIVER: 'd79213ee-3bc6-4433-b58a-ca7ea1040d00',
  PAYROLL_LOADER: '18792fa8-fda8-472d-8e04-e19d2c6c053c',
  FUEL: '62cebf3f-9982-4cc6-904b-48c6169cf5e4',
  OTHER: 'df1022df-4ea6-46fc-b9aa-f3c9eb4e7f30',
} as const;

// ─── Аналитика грузчиков (ПРР) ───────────────────────────────────────────────
export const LOADER_PROFIT_START_DATE = '2026-09-01';

export interface OrderLoaderMetrics {
  profit: number; // Чистая прибыль компании с ПРР
  thirdPartyPay: number; // Выплаты сторонним грузчикам
  driverLoaderPay: number; // Доплата водителю за самостоятельную погрузку
  totalPaid: number; // Суммарные выплаты бригаде (ФОТ ПРР)
  loadersPool: number; // Выручка, начисленная клиенту за ПРР
  margin: number; // Маржинальность компании (%)
}

export function isLoaderProfitEligible(tripStartedAt?: string | null): boolean {
  if (!tripStartedAt) return true;
  return tripStartedAt.slice(0, 10) >= LOADER_PROFIT_START_DATE;
}

/**
 * Рассчитывает финансовые метрики грузчиков для заказа.
 *
 * Методология:
 * 1. totalPaid = выплаты сторонним грузчикам + доплата водителю, если грузил сам.
 * 2. Если в заказе выделена ставка машины (driver_car_pay), то машина забирает
 *    свою долю выручки (driver_car_pay / 30%), а остаток суммы заказа — это выручка ПРР.
 * 3. Если ставки машины нет, выручка ПРР берётся по базовой норме (ФОТ грузчиков / 70%).
 * 4. Чистая прибыль = Выручка ПРР - totalPaid.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function calcOrderLoaderMetrics(o: any, tripStartedAt?: string | null): OrderLoaderMetrics {
  const lp1 = parseFloat(o.loader_pay || '0');
  const lp2 = parseFloat(o.loader2_pay || '0');
  let thirdPartyPay = 0;
  if (Array.isArray(o.loaders_data) && o.loaders_data.length > 0) {
    thirdPartyPay = o.loaders_data.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: number, l: any) => s + (parseFloat(String(l.pay)) || 0),
      0,
    );
  } else {
    thirdPartyPay = lp1 + lp2;
  }
  const driverLoaderPay = o.is_driver_loader ? parseFloat(String(o.driver_loader_pay || '0')) : 0;
  const totalPaid = thirdPartyPay + driverLoaderPay;
  if (totalPaid <= 0) {
    return {
      profit: 0,
      thirdPartyPay: 0,
      driverLoaderPay: 0,
      totalPaid: 0,
      loadersPool: 0,
      margin: 0,
    };
  }

  if (!isLoaderProfitEligible(tripStartedAt)) {
    return {
      profit: 0,
      thirdPartyPay,
      driverLoaderPay,
      totalPaid,
      loadersPool: totalPaid,
      margin: 0,
    };
  }

  const dcp = parseFloat(String(o.driver_car_pay || '0'));
  const amt = parseFloat(o.amount || '0');
  let loadersPool = 0;
  if (dcp > 0 && amt > 0) {
    const mPool = Math.round(dcp / 0.3);
    loadersPool = Math.max(0, amt - mPool);
  }
  if (loadersPool < totalPaid) {
    loadersPool = Math.round(totalPaid / 0.7);
  }
  const profit = Math.max(0, loadersPool - totalPaid);
  const margin = loadersPool > 0 ? Math.round((profit / loadersPool) * 100) : 0;

  return { profit, thirdPartyPay, driverLoaderPay, totalPaid, loadersPool, margin };
}

// ─── Аналитика загрузки автомобилей ──────────────────────────────────────────
export const TRUCKS_CODES = [
  'valdai_6m',
  'valdai_5m',
  'valdai_dump',
  'canter',
  'valdai',
  'fuso',
  'heavy',
];
export const GAZELLE_CODES = [
  'gazelle_4m',
  'gazelle_3m',
  'gazelle_project',
  'gazelle_farmer',
  'gazelle',
  'gazelle_next',
  'gazelle_long',
];

/**
 * Рассчитывает загрузку автомобиля на основе выручки (70%) и количества рейсов (30%).
 *
 * Бенчмарки нормы на 1 месяц:
 * - Тяжелые грузовики (Валдай, Canter): 640 000 ₽ выручки, 15.5 рейсов
 * - Газели: 430 000 ₽ выручки, 30 рейсов
 */
export function calculateVehicleLoad(
  revenue: number,
  trips: number,
  isTruck: boolean,
  numMonths: number = 1,
): { loadPct: number; revLoad: number; tripLoad: number } {
  const safeMonths = Math.max(numMonths, 1);
  const normRev = (isTruck ? 640000 : 430000) * safeMonths;
  const normTrips = (isTruck ? 15.5 : 30) * safeMonths;

  const revLoad = Math.min(100, (revenue / normRev) * 100);
  const tripLoad = Math.min(100, (trips / normTrips) * 100);
  const loadPct = Math.min(100, Math.round(0.7 * revLoad + 0.3 * tripLoad));

  return { loadPct, revLoad, tripLoad };
}

// ─── Доменные хелперы автопарка, логистики, финансов, склада и дебиторки ───────

/**
 * Возвращает отображаемое название статуса машины.
 */
export function getAssetStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: '✅ В работе',
    repair: '🔧 В ремонте',
    reserve: '🛏 Резерв',
    sold: 'Продана',
    written_off: 'Списана',
  };
  return labels[status] ?? status;
}

/**
 * Возвращает русское название типа рейса.
 */
export function getTripTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    local: 'По городу',
    intercity: 'Межгород',
    moving: 'Переезд',
    hourly: 'Почасовой',
  };
  return labels[type] ?? type;
}

/**
 * Вычисляет итоги рейса из списка заказов.
 */
export function calcTripTotals(
  orders: Array<{
    amount: string;
    driver_pay: string;
    loader_pay: string;
    lifecycle_status: string;
  }>,
) {
  const active = orders.filter((o) => o.lifecycle_status !== 'cancelled');
  return {
    revenue: active.reduce((s, o) => s + parseFloat(o.amount || '0'), 0).toFixed(2),
    driverPay: active.reduce((s, o) => s + parseFloat(o.driver_pay || '0'), 0).toFixed(2),
    loaderPay: active.reduce((s, o) => s + parseFloat(o.loader_pay || '0'), 0).toFixed(2),
  };
}

/**
 * Вычисляет дни просрочки от даты транзакции до сегодня.
 */
export function calcOverdueDays(transactionDate: string): number {
  const diff = Date.now() - new Date(transactionDate).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Возвращает статус просрочки для UI.
 */
export function getOverdueStatus(days: number): 'ok' | 'warning' | 'critical' {
  if (days <= 0) return 'ok';
  if (days <= 7) return 'warning';
  return 'critical';
}

/**
 * Вычисляет остаток позиции склада из движений.
 */
export function calcPartStock(
  movements: Array<{ quantity: number; direction: 'in' | 'out' }>,
): number {
  return movements.reduce((stock, m) => {
    return m.direction === 'in' ? stock + m.quantity : stock - m.quantity;
  }, 0);
}

/**
 * Возвращает статус остатка запчасти на складе.
 */
export function getStockStatus(current: number, minimum: number): 'ok' | 'low' | 'empty' {
  if (current <= 0) return 'empty';
  if (current <= minimum) return 'low';
  return 'ok';
}

/**
 * Вычисляет баланс кошелька из завершённых и подтверждённых транзакций.
 */
export function calculateWalletBalance(
  transactions: Array<{
    direction: string;
    amount: string;
    from_wallet_id: string | null;
    to_wallet_id: string | null;
    lifecycle_status: string;
    settlement_status: string;
  }>,
  walletId: string,
): string {
  const relevant = transactions.filter(
    (t) =>
      t.lifecycle_status === 'approved' &&
      t.settlement_status === 'completed' &&
      (t.from_wallet_id === walletId || t.to_wallet_id === walletId),
  );

  let balance = 0;
  for (const t of relevant) {
    const amount = parseFloat(t.amount || '0');
    if (t.to_wallet_id === walletId) balance += amount;
    if (t.from_wallet_id === walletId) balance -= amount;
  }
  return balance.toFixed(2);
}

/**
 * Возвращает иконку способа оплаты.
 */
export function getPaymentMethodIcon(method: string): string {
  const icons: Record<string, string> = {
    cash: '💵',
    qr: '📱',
    bank_invoice: '🏦',
    debt_cash: '⏳',
    card_driver: '💳',
  };
  return icons[method] ?? '💰';
}

/**
 * Возвращает русское название способа оплаты.
 */
export function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: 'Наличные',
    qr: 'QR на р/с',
    bank_invoice: 'Безнал по счёту',
    debt_cash: 'Долг наличными',
    card_driver: 'На карту водителя',
  };
  return labels[method] ?? method;
}

/**
 * Паттерны наименований контрагентов, для которых запрещена наличная оплата.
 * Эти компании работают строго по безналичному расчету или через дебиторскую задолженность (ждут выставления счёта):
 * - Геостройиндустрия
 * - ВСМПО
 * - УВС
 * - Территория
 * - Эко-дело
 * - Теострой
 */
export const NO_CASH_COUNTERPARTY_PATTERNS: RegExp[] = [
  /геострой/i,
  /всмпо/i,
  /(?:^|[\s"«»'.,(])увс(?:$|[\s"«»'.,)])/i,
  /территори/i,
  /эко[\s-]?дело/i,
  /теострой/i,
];

/**
 * Проверяет, запрещена ли контрагенту оплата наличными.
 * Принимает объект контрагента (с полем name), либо строку с названием.
 */
export function isNoCashCounterparty(
  cp: { name?: string | null; is_legal_entity?: boolean } | string | null | undefined,
): boolean {
  if (!cp) return false;
  const name = typeof cp === 'string' ? cp : cp.name || '';
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  return NO_CASH_COUNTERPARTY_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Проверяет, является ли контрагент «Территорией».
 * Для «Территории» действует специальное строгое правило:
 * обязательно указывается Адрес (улица + дом) и Описание работы для выставления счетов.
 */
export function isTerritoryCounterparty(
  cp: { name?: string | null; is_legal_entity?: boolean } | string | null | undefined,
): boolean {
  if (!cp) return false;
  const name = typeof cp === 'string' ? cp : cp.name || '';
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  return /территори/i.test(trimmed);
}

/**
 * Форматирует строку описания для заказов контрагента «Территория»:
 * «{улица + дом} — {описание работы}»
 */
export function formatTerritoryDescription(address: string, work: string): string {
  const cleanAddr = address.trim();
  const cleanWork = work.trim();
  if (cleanAddr && cleanWork) {
    return `${cleanAddr} — ${cleanWork}`;
  }
  return cleanAddr || cleanWork || '';
}

/**
 * Разбирает сохранённое описание заказа «Территории» обратно на адрес и работу.
 */
export function parseTerritoryDescription(desc: string | null | undefined): {
  address: string;
  work: string;
} {
  if (!desc) return { address: '', work: '' };
  const str = desc.trim();
  // Формат: "ул. Ленина, д. 45 — Вывоз мусора"
  const dashParts = str.split(' — ');
  if (dashParts.length >= 2 && dashParts[0] !== undefined) {
    return {
      address: dashParts[0].trim(),
      work: dashParts.slice(1).join(' — ').trim(),
    };
  }
  // Формат с разделителем "|"
  const pipeParts = str.split('|');
  if (pipeParts.length >= 2 && pipeParts[0] !== undefined) {
    return {
      address: pipeParts[0].replace(/^(?:адрес:?\s*)/i, '').trim(),
      work: pipeParts
        .slice(1)
        .join('|')
        .replace(/^(?:работа:?\s*)/i, '')
        .trim(),
    };
  }
  return { address: '', work: str };
}

/**
 * Проверяет, является ли контрагент «ООО Геостройиндустрия».
 * Для «Геостройиндустрии» водитель обязательно должен указывать Маршрут и Дату начала маршрута.
 */
export function isGeostroyCounterparty(
  cp: { name?: string | null; is_legal_entity?: boolean } | string | null | undefined,
): boolean {
  if (!cp) return false;
  const name = typeof cp === 'string' ? cp : cp.name || '';
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  return /геострой/i.test(trimmed);
}

/**
 * Маска ввода даты: принимает пользовательский ввод и форматирует в "ДД.ММ.ГГГГ".
 */
export function maskDateInput(val: string): string {
  if (!val) return '';
  const digits = val.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

/**
 * Проверяет, является ли строка корректной датой формата ДД.ММ.ГГГГ.
 */
export function isValidDateString(val: string | null | undefined): boolean {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  const match = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return false;
  const d = parseInt(match[1]!, 10);
  const m = parseInt(match[2]!, 10);
  const y = parseInt(match[3]!, 10);
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  if (y < 2020 || y > 2099) return false;
  const daysInMonth = new Date(y, m, 0).getDate();
  if (d > daysInMonth) return false;
  return true;
}

/**
 * Форматирует строку описания для заказов контрагента «ООО Геостройиндустрия»:
 * «Маршрут: {маршрут} | Дата: {дата начала}»
 */
export function formatGeostroyDescription(route: string, startDate: string): string {
  const cleanRoute = route.trim();
  const cleanDate = startDate.trim();
  if (cleanRoute && cleanDate) {
    return `Маршрут: ${cleanRoute} | Дата: ${cleanDate}`;
  }
  return cleanRoute || cleanDate || '';
}

/**
 * Разбирает описание заказа «ООО Геостройиндустрия» на Маршрут и Дату начала.
 */
export function parseGeostroyDescription(desc: string | null | undefined): {
  route: string;
  startDate: string;
} {
  if (!desc) return { route: '', startDate: '' };
  const str = desc.trim();

  let startDate = '';
  const dateMatch = str.match(/\b(\d{2}\.\d{2}\.\d{4})\b/);
  if (dateMatch && dateMatch[1]) {
    startDate = dateMatch[1];
  } else {
    const isoMatch = str.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (isoMatch && isoMatch[1] && isoMatch[2] && isoMatch[3]) {
      startDate = `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`;
    }
  }

  let route = str;
  if (startDate) {
    route = route
      .replace(new RegExp(`\\b${startDate.replace(/\./g, '\\.')}\\b`, 'g'), '')
      .replace(/Маршрут:\s*/gi, '')
      .replace(/Дата начала:\s*/gi, '')
      .replace(/Дата:\s*/gi, '')
      .replace(/[|()\[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } else {
    route = route.replace(/Маршрут:\s*/gi, '').trim();
  }

  return { route, startDate };
}

/**
 * Проверяет, заполнены ли корректно данные для заказа «ООО Геостройиндустрия».
 */
export function isGeostroyOrderValid(description: string | null | undefined): boolean {
  const { route, startDate } = parseGeostroyDescription(description);
  return Boolean(route.trim() && isValidDateString(startDate));
}

/**
 * Возвращает сегодняшнюю дату (Asia/Yekaterinburg) в формате ДД.ММ.ГГГГ
 */
export function getTodayDateString(): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Yekaterinburg',
  }).format(new Date());
}

/**
 * Возвращает вчерашнюю дату (Asia/Yekaterinburg) в формате ДД.ММ.ГГГГ
 */
export function getYesterdayDateString(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Yekaterinburg',
  }).format(d);
}

// ── ODOMETER RULES (ПРАВИЛА ОДОМЕТРА) ──────────────────────────────────────

/**
 * Проверяет, относится ли автомобиль к Газелям (все типы Газелей)
 */
export function isGazelleAsset(
  asset:
    | {
        short_name?: string | null;
        reg_number?: string | null;
        asset_type_code?: string | null;
        asset_type?: { code?: string | null } | null;
      }
    | null
    | undefined,
): boolean {
  if (!asset) return false;
  const name = (asset.short_name || '').toLowerCase();
  const code = (asset.asset_type_code || asset.asset_type?.code || '').toLowerCase();
  const reg = (asset.reg_number || '').toUpperCase();
  if (reg === 'БЕЗ АВТО' || name.includes('без авто')) return false;
  return name.includes('газель') || code.includes('gazelle');
}

/**
 * Проверяет, относится ли автомобиль к грузовикам (Валдай, Митсубиси Кантер)
 */
export function isTruckAsset(
  asset:
    | {
        short_name?: string | null;
        reg_number?: string | null;
        asset_type_code?: string | null;
        asset_type?: { code?: string | null } | null;
      }
    | null
    | undefined,
): boolean {
  if (!asset) return false;
  const name = (asset.short_name || '').toLowerCase();
  const code = (asset.asset_type_code || asset.asset_type?.code || '').toLowerCase();
  const reg = (asset.reg_number || '').toUpperCase();
  if (reg === 'БЕЗ АВТО' || name.includes('без авто')) return false;
  return (
    name.includes('валдай') ||
    name.includes('кантер') ||
    code.startsWith('valdai') ||
    code === 'canter'
  );
}

/**
 * Проверяет, наступил ли конец месяца (с 25-го числа месяца по 2-е число следующего месяца)
 */
export function isEndOfMonth(d = new Date()): boolean {
  const day = d.getDate();
  return day >= 25 || day <= 2;
}

/**
 * Проверяет, относится ли работа или запчасть к замене масла или фильтров
 */
export function isOilOrFilterWork(name: string | null | undefined): boolean {
  if (!name) return false;
  const s = name.toLowerCase();
  return /масл|фильтр|то-1|то-2|регламент/i.test(s);
}

export type OdometerCheckResult = {
  required: boolean;
  reason: 'gazelle_shift' | 'truck_month_end' | null;
  message: string;
};

/**
 * Проверяет обязательность ввода одометра при сдаче смены / завершении рейса:
 * 1. Все Газели: обязательно в конце каждой смены. Без одометра нельзя сдать смену.
 * 2. Грузовики (Валдаи, Митсубиси Кантер): обязательно 1 раз в конце месяца (с 25 числа).
 */
export function checkOdometerRequirement(
  asset:
    | {
        short_name?: string | null;
        reg_number?: string | null;
        asset_type_code?: string | null;
      }
    | null
    | undefined,
  date = new Date(),
): OdometerCheckResult {
  if (!asset) {
    return { required: false, reason: null, message: '' };
  }

  // 1. Все Газели
  if (isGazelleAsset(asset)) {
    return {
      required: true,
      reason: 'gazelle_shift',
      message:
        'Для всех Газелей обязателен ввод одометра в конце смены. Без одометра смену сдать нельзя.',
    };
  }

  // 2. Грузовики: Валдаи и Митсубиши Кантер
  if (isTruckAsset(asset)) {
    if (isEndOfMonth(date)) {
      return {
        required: true,
        reason: 'truck_month_end',
        message: 'Для грузовиков (Валдай, Кантер) обязателен ввод одометра в конце месяца.',
      };
    }
    return {
      required: false,
      reason: null,
      message:
        'Одометр вводится по желанию (для грузовиков обязателен в конце месяца с 25-го числа).',
    };
  }

  return { required: false, reason: null, message: '' };
}
