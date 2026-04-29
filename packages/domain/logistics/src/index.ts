export { TripType, PaymentMethod, type Trip, type TripOrder, type TripStatus } from '@saldacargo/shared-types';

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
    revenue: active.reduce((s, o) => s + parseFloat(o.amount), 0).toFixed(2),
    driverPay: active.reduce((s, o) => s + parseFloat(o.driver_pay), 0).toFixed(2),
    loaderPay: active.reduce((s, o) => s + parseFloat(o.loader_pay), 0).toFixed(2),
  };
}