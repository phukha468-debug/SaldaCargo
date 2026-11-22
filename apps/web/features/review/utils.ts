import { isInternalCounterparty, isTruckAsset } from '@saldacargo/shared';
import type { ReviewServiceOrder, TripForReview, TripOrder } from './types';

export function calcServiceOrder(o: ReviewServiceOrder) {
  const parts = o.parts ?? [];
  const works = o.works ?? [];

  const desc = o.problem_description || '';
  const note = o.admin_note || '';

  // Reliable detection of external services and contractor name
  const externalMatch =
    desc.match(/\[Сторонний сервис(?::\s*([^\]]+))?\]/i) ||
    note.match(/\[Сторонний сервис(?::\s*([^\]]+))?\]/i) ||
    note.match(/Исполнитель:\s*([^.]+)/i);

  const isExternal =
    Boolean(externalMatch) ||
    desc.includes('[Сторонний сервис') ||
    note.includes('[Сторонний сервис');

  let contractorName: string | null = null;
  if (externalMatch && externalMatch[1]) {
    contractorName = externalMatch[1].trim();
  } else if (note.includes('Исполнитель:')) {
    const m = note.match(/Исполнитель:\s*([^.]+)/i);
    if (m && m[1]) contractorName = m[1].trim();
  }

  // Equipment / tuning detection
  const fullText =
    `${desc} ${note} ${works.map((w) => w.custom_work_name || '').join(' ')} ${parts.map((p) => p.custom_part_name || '').join(' ')}`.toLowerCase();
  const isEquipment =
    fullText.includes('доп. оборудован') ||
    fullText.includes('допоборудован') ||
    fullText.includes('установка доп') ||
    fullText.includes('пневмо') ||
    fullText.includes('вебасто') ||
    fullText.includes('автономк') ||
    fullText.includes('тахограф') ||
    fullText.includes('рация') ||
    fullText.includes('спойлер') ||
    fullText.includes('фаркоп');

  const partsCost = parts.reduce(
    (sum, p) => sum + (Number(p.unit_price) || 0) * (Number(p.quantity) || 1),
    0,
  );

  let salaryCost = 0;
  let worksCost = 0;

  if (isExternal) {
    // 100% of work cost is an external expense paid to the contractor
    worksCost = works
      .filter((w) => w.status !== 'cancelled')
      .reduce((sum, w) => sum + (Number(w.price_client) || 0), 0);
    salaryCost = 0;
  } else {
    const m1Pay = Number(o.mechanic_pay) || 0;
    const m2Pay = Number(o.second_mechanic_pay) || 0;
    salaryCost = m1Pay + m2Pay;
    if (salaryCost <= 0) {
      salaryCost = works
        .filter((w) => w.status !== 'cancelled')
        .reduce((sum, w) => {
          const customPctMatch = w.notes
            ? String(w.notes).match(/\[salary_pct:(\d+(?:\.\d+)?)\]/)
            : null;
          const pct =
            customPctMatch && customPctMatch[1] ? parseFloat(customPctMatch[1]) / 100 : 0.5;
          return sum + (Number(w.price_client) || 0) * pct;
        }, 0);
    }
  }

  const totalCost = isExternal ? partsCost + worksCost : partsCost + salaryCost;
  return { partsCost, salaryCost, worksCost, totalCost, isExternal, contractorName, isEquipment };
}

// Систему заработка компании 30% с услуг грузчиков ввели 1 сентября 2026 года (миграция 20260901000000_order_payroll_v2.sql).
// До 01.09.2026 компания не брала маржу с услуг погрузки, поэтому статистика прибыли с грузчиков ведётся строго с 01.09.2026.
export const LOADER_PROFIT_START_DATE = '2026-09-01';

export function isLoaderProfitEligible(tripStartedAt?: string | null): boolean {
  if (!tripStartedAt) return true;
  return tripStartedAt.slice(0, 10) >= LOADER_PROFIT_START_DATE;
}

export function calcOrderLoaderMetrics(
  o: TripOrder,
  tripStartedAt?: string | null,
  asset?: {
    short_name?: string | null;
    reg_number?: string | null;
    asset_type_code?: string | null;
    asset_type?: { code?: string | null } | null;
  } | null,
) {
  const lp1 = parseFloat(o.loader_pay || '0');
  const lp2 = parseFloat(o.loader2_pay || '0');
  let thirdPartyPay = 0;
  if (Array.isArray(o.loaders_data) && o.loaders_data.length > 0) {
    thirdPartyPay = o.loaders_data.reduce((s, l) => s + (parseFloat(String(l.pay)) || 0), 0);
  } else {
    thirdPartyPay = lp1 + lp2;
  }
  const driverLoaderPay = o.is_driver_loader ? parseFloat(String(o.driver_loader_pay || '0')) : 0;
  const totalPaid = thirdPartyPay + driverLoaderPay;
  if (totalPaid <= 0) {
    return { profit: 0, thirdPartyPay: 0, driverLoaderPay: 0, totalPaid: 0, loadersPool: 0 };
  }

  // Для собственных внутренних нужд компании (ТК501 / ТК510) маржа не начисляется и выручки нет
  if (isInternalCounterparty(o.counterparty)) {
    return { profit: 0, thirdPartyPay, driverLoaderPay, totalPaid, loadersPool: 0 };
  }

  // До 01.09.2026 система 30% с грузчиков не действовала — маржа компании 0, весь пул шёл рабочим
  if (!isLoaderProfitEligible(tripStartedAt)) {
    return { profit: 0, thirdPartyPay, driverLoaderPay, totalPaid, loadersPool: totalPaid };
  }

  // Для тяжелых грузовиков (Валдаи, Кантер и т.п.) ставка водителя фиксированная / тарифная,
  // деление на 30% Газелей категорически не применяется!
  if (isTruckAsset(asset)) {
    return { profit: 0, thirdPartyPay, driverLoaderPay, totalPaid, loadersPool: totalPaid };
  }

  const dcp = parseFloat(String(o.driver_car_pay || '0'));
  const amt = parseFloat(o.amount || '0');
  let loadersPool = 0;
  if (o.direction === 'loaders_only' && amt > 0) {
    loadersPool = amt;
  } else if (dcp > 0 && amt > 0) {
    const mPool = Math.round(dcp / 0.3);
    loadersPool = Math.max(0, amt - mPool);
  }
  if (loadersPool < totalPaid) {
    loadersPool = Math.round(totalPaid / 0.7);
  }
  const profit = Math.max(0, loadersPool - totalPaid);
  return { profit, thirdPartyPay, driverLoaderPay, totalPaid, loadersPool };
}

export function calcTrip(trip: TripForReview, periodEndIso?: string) {
  const activeOrders = trip.trip_orders.filter((o) => o.lifecycle_status !== 'cancelled');
  const expenses = trip.trip_expenses ?? [];
  const revenue = activeOrders.reduce(
    (s, o) => s + (isInternalCounterparty(o.counterparty) ? 0 : parseFloat(o.amount || '0')),
    0,
  );
  const driverPay = activeOrders.reduce((s, o) => s + parseFloat(o.driver_pay), 0);
  const loaderPay = activeOrders.reduce(
    (s, o) => s + parseFloat(o.loader_pay) + parseFloat(o.loader2_pay ?? '0'),
    0,
  );
  const totalPayroll = driverPay + loaderPay;

  let loaderProfit = 0;
  let driverLoaderPay = 0;
  let thirdPartyLoaderPay = 0;
  let loadingBilled = 0;

  for (const o of activeOrders) {
    const m = calcOrderLoaderMetrics(o, trip.started_at, trip.asset);
    loaderProfit += m.profit;
    driverLoaderPay += m.driverLoaderPay;
    thirdPartyLoaderPay += m.thirdPartyPay;
    loadingBilled += m.loadersPool;
  }

  const driverCarPay = Math.max(0, driverPay - driverLoaderPay);
  const totalLoadingPayroll = thirdPartyLoaderPay + driverLoaderPay;

  // Оплата считается поступившей ВНУТРИ периода, если:
  // settlement_status === 'completed' И (нет invoice_paid_at — т.е. оплачено сразу в рейсе, либо invoice_paid_at <= periodEndIso).
  // Если оплата пришла позже границы периода — на конец периода этот заказ фиксируется как долг (дебиторка)!
  const isOrderPaidInPeriod = (o: TripOrder) => {
    if (o.settlement_status !== 'completed') return false;
    if (!periodEndIso) return true;
    const paidAt = o.invoice_paid_at || null;
    if (!paidAt) return true;
    return paidAt <= periodEndIso;
  };

  const collectedRevenue = activeOrders
    .filter((o) => isOrderPaidInPeriod(o) && !isInternalCounterparty(o.counterparty))
    .reduce((s, o) => s + (parseFloat(o.amount) || 0), 0);
  const pendingDebt = activeOrders
    .filter((o) => !isOrderPaidInPeriod(o) && !isInternalCounterparty(o.counterparty))
    .reduce((s, o) => s + (parseFloat(o.amount) || 0), 0);

  const fuelExpense = expenses
    .filter((e) => e.category?.name === 'ГСМ')
    .reduce((s, e) => s + parseFloat(e.amount), 0);
  const totalExpenses = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
  const mileage =
    trip.odometer_end && trip.odometer_start && trip.odometer_end >= trip.odometer_start
      ? trip.odometer_end - trip.odometer_start
      : 0;
  const profit = revenue - driverPay - loaderPay - totalExpenses;
  return {
    activeOrders,
    expenses,
    revenue,
    collectedRevenue,
    pendingDebt,
    driverPay,
    driverCarPay,
    driverLoaderPay,
    thirdPartyLoaderPay,
    totalLoadingPayroll,
    loadingBilled,
    loaderPay,
    totalPayroll,
    loaderProfit,
    fuelExpense,
    totalExpenses,
    mileage,
    profit,
  };
}

export function getWeekDates(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay();
  const monOffset = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d);
  mon.setDate(d.getDate() + monOffset);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { weekStart: mon.toISOString().slice(0, 10), weekEnd: sun.toISOString().slice(0, 10) };
}

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
  // Для своего парка реальной чистой прибыли нет — это внутренние расходы компании-перевозчика.
  // Чистая прибыль считается ТОЛЬКО с клиентских авто.
  // А цифра, которую гараж берёт с компании-перевозчика (счёт перевозчику): totalRevenue (работы + запчасти)
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
