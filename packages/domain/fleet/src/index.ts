export { AssetStatus, type Asset } from '@saldacargo/shared-types';

/**
 * Возвращает отображаемое название статуса машины.
 */
export function getAssetStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: '✅ В работе',
    repair: '🔧 В ремонте',
    reserve: '🛏 Резерв',
    sold: '💰 Продана',
    written_off: '🚫 Списана',
  };
  return labels[status] ?? status;
}

/**
 * Вычисляет, нужно ли ТО (по пробегу).
 * Возвращает: 'ok' | 'soon' | 'overdue'
 */
export function getMaintenanceStatus(
  currentOdometer: number,
  lastServiceOdometer: number,
  intervalKm: number,
): 'ok' | 'soon' | 'overdue' {
  const remaining = lastServiceOdometer + intervalKm - currentOdometer;
  if (remaining <= 0) return 'overdue';
  if (remaining <= intervalKm * 0.1) return 'soon'; // < 10% осталось
  return 'ok';
}