// Утилиты, которые используются во ВСЕХ модулях

import { v4 as uuidv4 } from 'uuid';

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
