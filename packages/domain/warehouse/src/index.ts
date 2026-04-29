/**
 * Склад запчастей.
 * Остатки вычисляются из part_movements (приход - расход).
 * Никогда не хранятся как отдельное поле (аналогично кошелькам).
 */

/**
 * Вычисляет остаток позиции из движений.
 */
export function calcPartStock(
  movements: Array<{ quantity: number; direction: 'in' | 'out' }>,
): number {
  return movements.reduce((stock, m) => {
    return m.direction === 'in' ? stock + m.quantity : stock - m.quantity;
  }, 0);
}

/**
 * Возвращает статус остатка.
 */
export function getStockStatus(current: number, minimum: number): 'ok' | 'low' | 'empty' {
  if (current <= 0) return 'empty';
  if (current <= minimum) return 'low';
  return 'ok';
}