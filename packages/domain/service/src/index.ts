export { ServiceOrderStatus, WorkStatus } from '@saldacargo/shared-types';
export * from './services';

/**
 * Вычисляет фактическое время работы из сегментов таймера.
 * Несколько записей work_time_logs → суммируем stopped - started.
 */
export function calcActualMinutes(
  segments: Array<{ started_at: string; stopped_at: string | null }>,
): number {
  return segments.reduce((total, seg) => {
    if (!seg.stopped_at) return total;
    const diff = new Date(seg.stopped_at).getTime() - new Date(seg.started_at).getTime();
    return total + Math.round(diff / 60000);
  }, 0);
}

/**
 * Вычисляет эффективность механика по наряду.
 * > 100% = быстрее нормы, < 100% = медленнее.
 */
export function calcEfficiency(actualMinutes: number, normMinutes: number): number {
  if (normMinutes === 0) return 0;
  return Math.round((normMinutes / actualMinutes) * 100);
}