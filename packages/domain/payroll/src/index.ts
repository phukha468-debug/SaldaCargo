/**
 * Расчёт ЗП — ТОЛЬКО подсказка для UI.
 * Реальная ЗП вводится вручную в поле driver_pay по каждому заказу.
 * Формула никогда не перезаписывает ручной ввод автоматически.
 */
export function suggestDriverPay(
  orderAmount: number,
  ruleType: 'percent' | 'fixed',
  ruleValue: number,
): number {
  if (ruleType === 'percent') {
    return Math.round((orderAmount * ruleValue) / 100);
  }
  return ruleValue;
}

/**
 * Суммирует ЗП водителя за период из утверждённых рейсов.
 */
export function calcPeriodPay(
  orders: Array<{ driver_pay: string; lifecycle_status: string }>,
): string {
  return orders
    .filter((o) => o.lifecycle_status === 'approved')
    .reduce((sum, o) => sum + parseFloat(o.driver_pay), 0)
    .toFixed(2);
}