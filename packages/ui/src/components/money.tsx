import * as React from 'react';
import { cn } from '../lib/utils';

interface MoneyProps {
  amount: string | number;
  className?: string;
  showSign?: boolean;
  // Цвет по знаку (для P&L)
  colorize?: boolean;
}

/**
 * Форматирует денежную сумму в рублях.
 * Всегда принимает строку или число, форматирует в "1 234 ₽"
 * Никогда не использует float для хранения — только для отображения.
 */
export function Money({ amount, className, showSign, colorize }: MoneyProps) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  const formatted = new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);

  const sign = showSign && num > 0 ? '+' : '';
  const colorClass = colorize
    ? num > 0
      ? 'text-green-600'
      : num < 0
        ? 'text-red-600'
        : 'text-slate-500'
    : '';

  return (
    <span className={cn('font-mono tabular-nums', colorClass, className)}>
      {sign}
      {formatted}
    </span>
  );
}
