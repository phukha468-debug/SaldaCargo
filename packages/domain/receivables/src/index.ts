/**
 * Дебиторка — транзакции с settlement_status = 'pending' и direction = 'income'.
 * Кредиторка — транзакции с settlement_status = 'pending' и direction = 'expense'.
 */

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