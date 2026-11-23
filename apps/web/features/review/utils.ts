export {
  calcOrderLoaderMetrics,
  calcServiceOrder,
  calcTrip,
  getWeekDates,
  isLoaderProfitEligible,
  LOADER_PROFIT_START_DATE,
} from '@saldacargo/shared';
import type { ReviewServiceOrder } from './types';

export function formatOrderDateRange(
  startedAt?: string | null,
  completedAt?: string | null,
  createdAt?: string,
) {
  const parse = (s?: string | null) => (s ? new Date(s.slice(0, 10) + 'T12:00:00') : null);
  const s = parse(startedAt);
  const c = parse(completedAt);
  const cr = parse(createdAt);
  const d1 = s || cr;
  const d2 = c || d1;
  if (!d1) return '—';
  const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  if (!d2 || d1.getTime() === d2.getTime()) return fmt(d1);
  return `${fmt(d1)} — ${fmt(d2)}`;
}

export function calcGarageOrder(order: ReviewServiceOrder) {
  const isOwn = order.machine_type === 'own';
  const desc = order.problem_description || '';
  const note = order.admin_note || '';

  const externalMatch =
    desc.match(/\[Сторонний сервис(?::\s*([^\]]+))?\]/i) ||
    note.match(/\[Сторонний сервис(?::\s*([^\]]+))?\]/i) ||
    note.match(/Исполнитель:\s*([^.]+)/i);

  const isExternal =
    Boolean(externalMatch) ||
    desc.includes('[Сторонний сервис') ||
    note.includes('[Сторонний сервис') ||
    desc.toLowerCase().includes('поездка на ремонт') ||
    desc.toLowerCase().includes('был на ремонте') ||
    desc.toLowerCase().includes('(сто)') ||
    note.toLowerCase().includes('[рейс_на_ремонт]');

  let contractorName: string = 'Стороннее СТО';
  if (externalMatch && externalMatch[1]) {
    contractorName = externalMatch[1].trim();
  } else if (note.includes('Исполнитель:')) {
    const m = note.match(/Исполнитель:\s*([^.]+)/i);
    if (m && m[1]) contractorName = m[1].trim();
  }

  const hourlyRate = isExternal ? 0 : isOwn ? 1600 : 2000;
  const salaryPct = isExternal ? 0 : Number(order.mechanic?.mechanic_salary_pct || 50);
  const activeWorks = (order.works ?? []).filter((w) => w.status !== 'cancelled');
  const parts = order.parts ?? [];

  const totalMinutes = activeWorks.reduce(
    (s, w) =>
      s + Number(w.actual_minutes || w.norm_minutes || 0) * Math.max(1, Number(w.quantity || 1)),
    0,
  );

  const worksSum = activeWorks.reduce((s, w) => {
    const explicit = parseFloat(w.price_client || '0');
    if (explicit > 0) return s + explicit;
    if (isExternal) return s;
    const mins =
      Number(w.actual_minutes || w.norm_minutes || 0) * Math.max(1, Number(w.quantity || 1));
    return s + (mins / 60) * hourlyRate;
  }, 0);

  const estimatedPay = isExternal
    ? 0
    : activeWorks.reduce((s, w) => {
        const mins =
          Number(w.actual_minutes || w.norm_minutes || 0) * Math.max(1, Number(w.quantity || 1));
        const explicit = parseFloat(w.price_client || '0');
        const wPrice = explicit > 0 ? explicit : (mins / 60) * hourlyRate;
        const customPctMatch = w.notes
          ? String(w.notes).match(/\[salary_pct:(\d+(?:\.\d+)?)\]/)
          : null;
        const wPct =
          customPctMatch && customPctMatch[1] ? parseFloat(customPctMatch[1]) : salaryPct;
        return s + (wPrice * wPct) / 100;
      }, 0);

  const mechanicPay = isExternal
    ? 0
    : parseFloat(order.mechanic_pay || '0') > 0
      ? parseFloat(order.mechanic_pay!)
      : estimatedPay;

  let partsUnitSum = 0;
  let partsClientSum = 0;

  for (const p of parts) {
    const qty = p.quantity || 1;
    const uPrice = parseFloat(p.unit_price || '0') || 0;
    const cPrice =
      p.client_price !== undefined &&
      p.client_price !== null &&
      String(p.client_price).trim() !== ''
        ? parseFloat(String(p.client_price)) || 0
        : uPrice;
    partsUnitSum += uPrice * qty;
    partsClientSum += cPrice * qty;
  }

  const partsMargin = isOwn ? 0 : Math.max(0, partsClientSum - partsUnitSum);
  const totalRevenue = worksSum + partsClientSum;
  const billedToCarrier = isOwn ? totalRevenue : 0;
  const netProfit = isOwn ? 0 : totalRevenue - mechanicPay - partsUnitSum;

  return {
    isOwn,
    isExternal,
    contractorName,
    hourlyRate,
    salaryPct,
    activeWorks,
    parts,
    totalMinutes,
    worksSum,
    mechanicPay,
    partsUnitSum,
    partsClientSum,
    partsMargin,
    totalRevenue,
    billedToCarrier,
    netProfit,
  };
}
