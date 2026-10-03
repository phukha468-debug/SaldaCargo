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
  const sum = amounts.reduce((acc: number, val) => {
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
