import { SPECIALTY_LABELS } from './constants';
import type { DetailWork, Mechanic, OrderDetailPart, VehicleRule } from './types';

export function getSpecialtyLabel(roles?: string[] | null) {
  if (!roles || roles.length === 0) return '';
  const priority = [
    'welder',
    'electrician',
    'painter',
    'mechanic_lead',
    'mechanic',
    'handyman',
    'driver',
    'loader',
  ];
  for (const p of priority) {
    if (roles.includes(p) && SPECIALTY_LABELS[p]) return SPECIALTY_LABELS[p];
  }
  return '';
}

export function fmtDate(s: string | null | undefined) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function moneyVal(s: string | null | undefined): number {
  return parseFloat(s ?? '0');
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function getArchiveWeekDates(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay();
  const monOffset = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d);
  mon.setDate(d.getDate() + monOffset);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { weekStart: mon.toISOString().slice(0, 10), weekEnd: sun.toISOString().slice(0, 10) };
}

export function ruleAlert(
  rule: VehicleRule,
  odometer: number | null,
  now: Date = new Date(),
): 'ok' | 'soon' | 'overdue' | null {
  let kmStatus: 'ok' | 'soon' | 'overdue' | null = null;
  let dateStatus: 'ok' | 'soon' | 'overdue' | null = null;

  if (rule.interval_km && rule.last_done_km && odometer) {
    const nextKm = rule.last_done_km + rule.interval_km;
    const remaining = nextKm - odometer;
    if (remaining <= 0) kmStatus = 'overdue';
    else if (remaining <= rule.interval_km * 0.15) kmStatus = 'soon';
    else kmStatus = 'ok';
  }

  if (rule.interval_months && rule.last_done_at) {
    const nextDate = new Date(rule.last_done_at);
    nextDate.setMonth(nextDate.getMonth() + rule.interval_months);
    const daysLeft = Math.ceil((nextDate.getTime() - now.getTime()) / 86400000);
    if (daysLeft <= 0) dateStatus = 'overdue';
    else if (daysLeft <= 30) dateStatus = 'soon';
    else dateStatus = 'ok';
  }

  const statuses = [kmStatus, dateStatus].filter(Boolean) as Array<'ok' | 'soon' | 'overdue'>;
  if (statuses.includes('overdue')) return 'overdue';
  if (statuses.includes('soon')) return 'soon';
  if (statuses.includes('ok')) return 'ok';
  return null;
}

/**
 * Computes default per-mechanic salary payouts for unpaid active works in a service order.
 * Splits work price 50/50 when two mechanics are assigned and applies each mechanic's salary %.
 */
export function computeMechanicDefaultPays(
  works: Pick<
    DetailWork,
    'status' | 'salary_paid' | 'mechanic_id' | 'second_mechanic_id' | 'price_client'
  >[],
  mechanics: Mechanic[],
): Record<string, string> {
  const defaults: Record<string, number> = {};
  works.forEach((w) => {
    if (w.status === 'cancelled' || w.salary_paid) return;
    const mechs = [w.mechanic_id, w.second_mechanic_id].filter((x): x is string => Boolean(x));
    if (mechs.length === 0) return;
    const workPrice = parseFloat(w.price_client ?? '0');
    if (workPrice <= 0) return;
    const basePrice = mechs.length === 2 ? workPrice / 2 : workPrice;
    for (const mechId of mechs) {
      const mech = mechanics.find((m) => m.id === mechId);
      const pct = mech ? parseFloat(mech.mechanic_salary_pct ?? '50') : 50;
      defaults[mechId] = (defaults[mechId] || 0) + (basePrice * pct) / 100;
    }
  });
  const formatted: Record<string, string> = {};
  for (const [id, val] of Object.entries(defaults)) {
    formatted[id] = Math.round(val).toString();
  }
  return formatted;
}

/**
 * Computes service order financial summary: works total, parts cost/client/margin, grand total.
 */
export function calcOrderDetailTotals(
  works: Pick<DetailWork, 'status' | 'price_client' | 'norm_minutes' | 'quantity'>[],
  parts: Pick<OrderDetailPart, 'quantity' | 'unit_price' | 'client_price'>[],
) {
  const activeWorks = works.filter((w) => w.status !== 'cancelled');
  const totalNormMin = activeWorks.reduce((s, w) => s + w.norm_minutes * (w.quantity ?? 1), 0);
  const worksTotal = activeWorks.reduce((s, w) => s + parseFloat(w.price_client ?? '0'), 0);

  let partsCostTotal = 0;
  let partsClientTotal = 0;
  for (const p of parts) {
    const qty = p.quantity || 1;
    const unit = parseFloat(p.unit_price ?? '0') || 0;
    const client =
      p.client_price !== null && p.client_price !== undefined && p.client_price.trim() !== ''
        ? parseFloat(p.client_price) || 0
        : unit;
    partsCostTotal += unit * qty;
    partsClientTotal += client * qty;
  }

  const partsMargin = Math.max(0, partsClientTotal - partsCostTotal);
  const grandTotal = worksTotal + partsClientTotal;

  return {
    totalNormMin,
    worksTotal,
    partsCostTotal,
    partsClientTotal,
    partsMargin,
    grandTotal,
  };
}
