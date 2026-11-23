import { isInternalCounterparty, isTruckAsset } from './index';

export interface CalcServiceOrderPartInput {
  unit_price?: number | string | null;
  quantity?: number | string | null;
  custom_part_name?: string | null;
}

export interface CalcServiceOrderWorkInput {
  status?: string | null;
  price_client?: number | string | null;
  custom_work_name?: string | null;
  notes?: string | null;
}

export interface CalcServiceOrderInput {
  parts?: CalcServiceOrderPartInput[] | null;
  works?: CalcServiceOrderWorkInput[] | null;
  problem_description?: string | null;
  admin_note?: string | null;
  mechanic_pay?: number | string | null;
  raw_mechanic_pay?: number | string | null;
  second_mechanic_pay?: number | string | null;
}

export function calcServiceOrder(o: CalcServiceOrderInput) {
  const parts = o.parts ?? [];
  const works = o.works ?? [];

  const desc = o.problem_description || '';
  const note = o.admin_note || '';

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
    worksCost = works
      .filter((w) => w.status !== 'cancelled')
      .reduce((sum, w) => sum + (Number(w.price_client) || 0), 0);
    salaryCost = 0;
  } else {
    const rawPay = o.raw_mechanic_pay != null ? o.raw_mechanic_pay : o.mechanic_pay;
    const m1Pay = Number(rawPay) || 0;
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

/**
 * Систему заработка компании 30% с услуг грузчиков ввели 1 сентября 2026 года
 * (миграция 20260901000000_order_payroll_v2.sql).
 */
export const LOADER_PROFIT_START_DATE = '2026-09-01';

export function isLoaderProfitEligible(tripStartedAt?: string | null): boolean {
  if (!tripStartedAt) return true;
  return tripStartedAt.slice(0, 10) >= LOADER_PROFIT_START_DATE;
}

export interface CalcTripAssetInput {
  short_name?: string | null;
  reg_number?: string | null;
  asset_type_code?: string | null;
  asset_type?: { code?: string | null } | null;
}

export interface CalcTripOrderInput {
  lifecycle_status?: string | null;
  settlement_status?: string | null;
  invoice_paid_at?: string | null;
  amount?: string | number | null;
  driver_pay?: string | number | null;
  driver_car_pay?: string | number | null;
  loader_pay?: string | number | null;
  loader2_pay?: string | number | null;
  loaders_data?: Array<{ pay?: string | number | null }> | null;
  is_driver_loader?: boolean | null;
  driver_loader_pay?: string | number | null;
  direction?: string | null;
  counterparty?: { name?: string | null; is_legal_entity?: boolean } | string | null;
}

export interface CalcTripExpenseInput {
  amount?: string | number | null;
  category?: { name?: string | null } | string | null;
  expense_category?: { name?: string | null } | null;
}

export interface CalcTripInput<
  TOrder extends CalcTripOrderInput = CalcTripOrderInput,
  TExpense extends CalcTripExpenseInput = CalcTripExpenseInput,
> {
  trip_orders?: TOrder[] | null;
  trip_expenses?: TExpense[] | null;
  started_at?: string | null;
  odometer_start?: number | null;
  odometer_end?: number | null;
  asset?: CalcTripAssetInput | null;
}

export function calcOrderLoaderMetrics(
  o: CalcTripOrderInput,
  tripStartedAt?: string | null,
  asset?: CalcTripAssetInput | null,
) {
  const lp1 = parseFloat(String(o.loader_pay || '0')) || 0;
  const lp2 = parseFloat(String(o.loader2_pay || '0')) || 0;
  let thirdPartyPay = 0;
  if (Array.isArray(o.loaders_data) && o.loaders_data.length > 0) {
    thirdPartyPay = o.loaders_data.reduce((s, l) => s + (parseFloat(String(l.pay)) || 0), 0);
  } else {
    thirdPartyPay = lp1 + lp2;
  }
  const driverLoaderPay = o.is_driver_loader
    ? parseFloat(String(o.driver_loader_pay || '0')) || 0
    : 0;
  const totalPaid = thirdPartyPay + driverLoaderPay;
  if (totalPaid <= 0) {
    return { profit: 0, thirdPartyPay: 0, driverLoaderPay: 0, totalPaid: 0, loadersPool: 0 };
  }

  if (isInternalCounterparty(o.counterparty)) {
    return { profit: 0, thirdPartyPay, driverLoaderPay, totalPaid, loadersPool: 0 };
  }

  if (!isLoaderProfitEligible(tripStartedAt)) {
    return { profit: 0, thirdPartyPay, driverLoaderPay, totalPaid, loadersPool: totalPaid };
  }

  if (isTruckAsset(asset)) {
    return { profit: 0, thirdPartyPay, driverLoaderPay, totalPaid, loadersPool: totalPaid };
  }

  const dcp = parseFloat(String(o.driver_car_pay || '0')) || 0;
  const amt = parseFloat(String(o.amount || '0')) || 0;
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

export function calcTrip<
  TOrder extends CalcTripOrderInput = CalcTripOrderInput,
  TExpense extends CalcTripExpenseInput = CalcTripExpenseInput,
>(trip: CalcTripInput<TOrder, TExpense>, periodEndIso?: string) {
  const activeOrders = (trip.trip_orders ?? []).filter((o) => o.lifecycle_status !== 'cancelled');
  const expenses = trip.trip_expenses ?? [];
  const revenue = activeOrders.reduce(
    (s, o) =>
      s + (isInternalCounterparty(o.counterparty) ? 0 : parseFloat(String(o.amount || '0')) || 0),
    0,
  );
  const driverPay = activeOrders.reduce(
    (s, o) => s + (parseFloat(String(o.driver_pay || '0')) || 0),
    0,
  );
  const loaderPay = activeOrders.reduce(
    (s, o) =>
      s +
      (parseFloat(String(o.loader_pay || '0')) || 0) +
      (parseFloat(String(o.loader2_pay || '0')) || 0),
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

  const isOrderPaidInPeriod = (o: TOrder) => {
    if (o.settlement_status !== 'completed') return false;
    if (!periodEndIso) return true;
    const paidAt = o.invoice_paid_at || null;
    if (!paidAt) return true;
    return paidAt <= periodEndIso;
  };

  const collectedRevenue = activeOrders
    .filter((o) => isOrderPaidInPeriod(o) && !isInternalCounterparty(o.counterparty))
    .reduce((s, o) => s + (parseFloat(String(o.amount || '0')) || 0), 0);
  const pendingDebt = activeOrders
    .filter((o) => !isOrderPaidInPeriod(o) && !isInternalCounterparty(o.counterparty))
    .reduce((s, o) => s + (parseFloat(String(o.amount || '0')) || 0), 0);

  const fuelExpense = expenses
    .filter((e) => {
      const cat = e.category;
      const name = (typeof cat === 'string' ? cat : cat?.name) || e.expense_category?.name || '';
      return String(name).toUpperCase() === 'ГСМ';
    })
    .reduce((s, e) => s + (parseFloat(String(e.amount || '0')) || 0), 0);
  const totalExpenses = expenses.reduce(
    (s, e) => s + (parseFloat(String(e.amount || '0')) || 0),
    0,
  );
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
