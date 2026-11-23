import { describe, expect, it } from 'vitest';
import {
  calcGarageOrder,
  calcOrderLoaderMetrics,
  calcServiceOrder,
  calcTrip,
  formatOrderDateRange,
  getWeekDates,
  isLoaderProfitEligible,
} from '../utils';
import { aggregateFleetStats, computeGarageSummary } from '../fleetAggregation';
import type { ReviewServiceOrder, TripForReview, TripOrder } from '../types';

function makeOrder(overrides: Partial<TripOrder> = {}): TripOrder {
  return {
    id: 'ord-1',
    amount: '10000',
    driver_pay: '3000',
    loader_pay: '0',
    loader2_pay: '0',
    loader_id: null,
    loader2_id: null,
    loader: null,
    loader2: null,
    payment_method: 'cash',
    settlement_status: 'completed',
    lifecycle_status: 'approved',
    counterparty_id: 'cp-1',
    counterparty: { name: 'ООО Клиент' },
    ...overrides,
  };
}

function makeTrip(overrides: Partial<TripForReview> = {}): TripForReview {
  return {
    id: 'trip-1',
    trip_number: 101,
    lifecycle_status: 'approved',
    started_at: '2026-10-15T08:00:00Z',
    ended_at: '2026-10-15T18:00:00Z',
    trip_type: 'city',
    odometer_start: 100000,
    odometer_end: 100250,
    driver_note: null,
    asset: {
      short_name: 'Газель 01',
      reg_number: 'А111АА96',
      asset_type: { code: 'gazelle', name: 'Газель' },
    },
    driver: { id: 'drv-1', name: 'Иванов И.И.' },
    loader: null,
    trip_orders: [],
    trip_expenses: [],
    ...overrides,
  };
}

function makeServiceOrder(overrides: Partial<ReviewServiceOrder> = {}): ReviewServiceOrder {
  return {
    id: 'so-1',
    order_number: 55,
    machine_type: 'own',
    status: 'completed',
    lifecycle_status: 'approved',
    created_at: '2026-10-10T09:00:00Z',
    problem_description: 'Замена колодок',
    mechanic_note: null,
    mechanic_pay: null,
    second_mechanic_pay: null,
    works: [],
    parts: [],
    ...overrides,
  };
}

describe('review/utils — isLoaderProfitEligible & calcOrderLoaderMetrics', () => {
  it('enforces LOADER_PROFIT_START_DATE = 2026-09-01', () => {
    expect(isLoaderProfitEligible('2026-08-31T23:59:59Z')).toBe(false);
    expect(isLoaderProfitEligible('2026-09-01T00:00:00Z')).toBe(true);
    expect(isLoaderProfitEligible(null)).toBe(true);
  });

  it('computes 30% company margin on loader pool after 2026-09-01', () => {
    const order = makeOrder({
      amount: '10000',
      driver_pay: '2100',
      driver_car_pay: '2100', // mPool = 2100 / 0.3 = 7000 -> loadersPool = 3000
      loader_pay: '2100',
    });
    const m = calcOrderLoaderMetrics(order, '2026-10-15T08:00:00Z', {
      short_name: 'Газель',
      asset_type: { code: 'gazelle' },
    });
    expect(m.totalPaid).toBe(2100);
    expect(m.loadersPool).toBe(3000);
    expect(m.profit).toBe(900);
  });

  it('returns zero loader profit before 2026-09-01 and for internal counterparties or heavy trucks', () => {
    const order = makeOrder({
      amount: '10000',
      driver_car_pay: '2100',
      loader_pay: '2100',
    });

    const beforeCutoff = calcOrderLoaderMetrics(order, '2026-08-15T08:00:00Z', {
      short_name: 'Газель',
    });
    expect(beforeCutoff.profit).toBe(0);
    expect(beforeCutoff.loadersPool).toBe(2100);

    const internalOrder = makeOrder({
      ...order,
      counterparty: { name: 'ТК501' },
    });
    const internalRes = calcOrderLoaderMetrics(internalOrder, '2026-10-15T08:00:00Z');
    expect(internalRes.profit).toBe(0);
    expect(internalRes.loadersPool).toBe(0);

    const truckRes = calcOrderLoaderMetrics(order, '2026-10-15T08:00:00Z', {
      short_name: 'Валдай 5т',
      asset_type: { code: 'truck' },
    });
    expect(truckRes.profit).toBe(0);
  });
});

describe('review/utils — calcTrip', () => {
  it('excludes cancelled and internal orders from revenue, splits collectedRevenue vs pendingDebt by periodEndIso', () => {
    const trip = makeTrip({
      trip_orders: [
        makeOrder({
          id: 'o1',
          amount: '10000',
          driver_pay: '3000',
          settlement_status: 'completed',
          invoice_paid_at: '2026-10-15T12:00:00Z',
        }),
        makeOrder({
          id: 'o2',
          amount: '5000',
          driver_pay: '1500',
          settlement_status: 'completed',
          invoice_paid_at: '2026-10-20T12:00:00Z', // paid after periodEndIso
        }),
        makeOrder({
          id: 'o3',
          amount: '9999',
          driver_pay: '1000',
          lifecycle_status: 'cancelled',
        }),
        makeOrder({
          id: 'o4',
          amount: '4000',
          driver_pay: '500',
          counterparty: { name: 'ТК501' }, // internal: 0 revenue
        }),
      ],
      trip_expenses: [
        {
          id: 'e1',
          amount: '2000',
          payment_method: 'fuel_card',
          description: 'ДТ',
          category: { name: 'ГСМ' },
        },
        {
          id: 'e2',
          amount: '500',
          payment_method: 'cash',
          description: 'Мойка',
          category: { name: 'Мойка' },
        },
      ],
    });

    const res = calcTrip(trip, '2026-10-16T23:59:59Z');
    expect(res.activeOrders).toHaveLength(3);
    expect(res.revenue).toBe(15000);
    expect(res.collectedRevenue).toBe(10000);
    expect(res.pendingDebt).toBe(5000);
    expect(res.driverPay).toBe(5000); // 3000 + 1500 + 500
    expect(res.fuelExpense).toBe(2000);
    expect(res.totalExpenses).toBe(2500);
    expect(res.mileage).toBe(250);
    expect(res.profit).toBe(15000 - 5000 - 2500);
  });
});

describe('review/utils — calcServiceOrder & calcGarageOrder', () => {
  it('calculates own service order with custom salary_pct and detects equipment', () => {
    const so = makeServiceOrder({
      problem_description: 'Установка автономки Вебасто',
      works: [
        {
          id: 'w1',
          custom_work_name: 'Монтаж',
          status: 'completed',
          salary_paid: false,
          actual_minutes: 60,
          price_client: '4000',
          norm_minutes: 60,
          mechanic_id: 'm1',
          second_mechanic_id: null,
          notes: '[salary_pct:40]',
        },
        {
          id: 'w2',
          custom_work_name: 'Отменённая',
          status: 'cancelled',
          salary_paid: false,
          actual_minutes: 30,
          price_client: '1000',
          norm_minutes: 30,
          mechanic_id: 'm1',
          second_mechanic_id: null,
        },
      ],
      parts: [
        {
          id: 'p1',
          custom_part_name: 'Хомут',
          quantity: 2,
          unit_price: '300',
          unit: 'шт',
        },
      ],
    });

    const res = calcServiceOrder(so);
    expect(res.isExternal).toBe(false);
    expect(res.isEquipment).toBe(true);
    expect(res.partsCost).toBe(600);
    expect(res.salaryCost).toBe(1600); // 4000 * 40%
    expect(res.totalCost).toBe(2200);
  });

  it('calculates external service order with contractor name and zero salary', () => {
    const so = makeServiceOrder({
      problem_description: '[Сторонний сервис: АвтоДизель] Ремонт ТНВД',
      works: [
        {
          id: 'w1',
          custom_work_name: 'Ремонт ТНВД',
          status: 'completed',
          salary_paid: false,
          actual_minutes: 120,
          price_client: '15000',
          norm_minutes: 120,
          mechanic_id: null,
          second_mechanic_id: null,
        },
      ],
      parts: [
        {
          id: 'p1',
          custom_part_name: 'Ремкомплект',
          quantity: 1,
          unit_price: '5000',
          unit: 'шт',
        },
      ],
    });

    const res = calcServiceOrder(so);
    expect(res.isExternal).toBe(true);
    expect(res.contractorName).toBe('АвтоДизель');
    expect(res.salaryCost).toBe(0);
    expect(res.worksCost).toBe(15000);
    expect(res.totalCost).toBe(20000);
  });

  it('calcGarageOrder computes netProfit for client vehicles and billedToCarrier for own fleet', () => {
    const clientOrder = makeServiceOrder({
      machine_type: 'client',
      mechanic: { id: 'm1', name: 'Петров', mechanic_salary_pct: 50 },
      works: [
        {
          id: 'w1',
          custom_work_name: 'ТО',
          status: 'completed',
          salary_paid: false,
          actual_minutes: 60,
          price_client: '2000',
          norm_minutes: 60,
          mechanic_id: 'm1',
          second_mechanic_id: null,
        },
      ],
      parts: [
        {
          id: 'p1',
          custom_part_name: 'Фильтр',
          quantity: 2,
          unit_price: '500',
          client_price: '800',
          unit: 'шт',
        },
      ],
    });

    const c = calcGarageOrder(clientOrder);
    expect(c.isOwn).toBe(false);
    expect(c.worksSum).toBe(2000);
    expect(c.mechanicPay).toBe(1000);
    expect(c.partsUnitSum).toBe(1000);
    expect(c.partsClientSum).toBe(1600);
    expect(c.partsMargin).toBe(600);
    expect(c.totalRevenue).toBe(3600);
    expect(c.billedToCarrier).toBe(0);
    expect(c.netProfit).toBe(1600); // 3600 - 1000 - 1000

    const ownOrder = makeServiceOrder({
      ...clientOrder,
      machine_type: 'own',
    });
    const o = calcGarageOrder(ownOrder);
    expect(o.isOwn).toBe(true);
    expect(o.netProfit).toBe(0);
    expect(o.billedToCarrier).toBe(3600);
  });
});

describe('review/utils — date helpers', () => {
  it('getWeekDates returns Monday..Sunday bounds', () => {
    expect(getWeekDates('2026-10-15')).toEqual({
      weekStart: '2026-10-12',
      weekEnd: '2026-10-18',
    });
    // Sunday edge case
    expect(getWeekDates('2026-10-18')).toEqual({
      weekStart: '2026-10-12',
      weekEnd: '2026-10-18',
    });
  });

  it('formatOrderDateRange handles missing, single-day, and multi-day ranges', () => {
    expect(formatOrderDateRange(null, null, undefined)).toBe('—');
    const single = formatOrderDateRange('2026-10-10T08:00:00Z', '2026-10-10T18:00:00Z');
    expect(single).not.toContain('—');
    const range = formatOrderDateRange('2026-10-10T08:00:00Z', '2026-10-12T18:00:00Z');
    expect(range).toContain('—');
  });
});

describe('review/fleetAggregation — aggregateFleetStats & computeGarageSummary', () => {
  it('groups trips and own service orders, deduplicates current-period settlements, and computes actual cash profit', () => {
    const trip = makeTrip({
      trip_orders: [
        makeOrder({
          id: 'ord-paid',
          amount: '10000',
          driver_pay: '3000',
          settlement_status: 'completed',
        }),
        makeOrder({
          id: 'ord-debt',
          amount: '4000',
          driver_pay: '1000',
          settlement_status: 'pending',
        }),
      ],
    });
    const ownService = makeServiceOrder({
      machine_type: 'own',
      asset: { short_name: 'Газель 01', reg_number: 'А111АА96' },
      mechanic_pay: '1000',
      parts: [{ id: 'p1', custom_part_name: 'Ремень', quantity: 1, unit_price: '500', unit: 'шт' }],
    });

    const stats = aggregateFleetStats({
      listTrips: [trip],
      listServiceOrders: [ownService],
      mode: 'history',
      currentPeriodEndIso: '2026-10-15T23:59:59.999Z',
      settlements: [
        {
          id: 'tx-1',
          amount: 12000,
          direction: 'income',
          description: 'Оплата',
          created_at: '2026-10-15T10:00:00Z',
          counterparty_id: 'cp-1',
          counterparty_name: 'ООО Клиент',
          orders: [
            { id: 'ord-paid', type: 'trip_order', amount: 10000 }, // already in period -> ignored
            { id: 'ord-old', type: 'trip_order', amount: 2000 }, // past period -> counted
          ],
        },
      ],
    });

    expect(stats.combinedAssetGroups).toHaveLength(1);
    expect(stats.totalFleetRevenue).toBe(14000);
    expect(stats.totalFleetPayroll).toBe(4000);
    expect(stats.totalFleetMaintenance).toBe(1500);
    expect(stats.totalFleetNetProfit).toBe(14000 - 4000 - 1500); // 8500
    expect(stats.totalFleetPendingDebt).toBe(4000);
    expect(stats.totalFleetExternalDebtCollected).toBe(2000);
    expect(stats.totalFleetActualProfit).toBe(8500 - 4000 + 2000); // 6500
  });

  it('computeGarageSummary separates client net profit from own billedToCarrier', () => {
    const clientOrder = makeServiceOrder({
      id: 'c1',
      machine_type: 'client',
      works: [
        {
          id: 'w1',
          custom_work_name: 'ТО',
          status: 'completed',
          salary_paid: false,
          actual_minutes: 60,
          price_client: '2000',
          norm_minutes: 60,
          mechanic_id: 'm1',
          second_mechanic_id: null,
        },
      ],
    });
    const ownOrder = makeServiceOrder({
      id: 'o1',
      machine_type: 'own',
      works: [
        {
          id: 'w2',
          custom_work_name: 'Ремонт',
          status: 'completed',
          salary_paid: false,
          actual_minutes: 60,
          price_client: '1600',
          norm_minutes: 60,
          mechanic_id: 'm1',
          second_mechanic_id: null,
        },
      ],
    });

    const summary = computeGarageSummary([clientOrder, ownOrder], [clientOrder, ownOrder]);
    expect(summary.allCount).toBe(2);
    expect(summary.clientCount).toBe(1);
    expect(summary.ownCount).toBe(1);
    expect(summary.clientNetProfit).toBe(1000);
    expect(summary.ownBilledToCarrier).toBe(1600);
  });

  it('filters out zero-cost, cancelled, and returned service orders from fleet history while keeping real repair expenses', () => {
    const paidRepair = makeServiceOrder({
      id: 'so-paid',
      machine_type: 'own',
      lifecycle_status: 'approved',
      asset: { short_name: 'Валдай 6м', reg_number: 'А096МВ196' },
      parts: [
        { id: 'p1', custom_part_name: 'Сцепление', quantity: 1, unit_price: '17600', unit: 'шт' },
      ],
    });
    const zeroCostOrder = makeServiceOrder({
      id: 'so-zero',
      machine_type: 'own',
      lifecycle_status: 'approved',
      asset: { short_name: 'Газель', reg_number: 'Х866КМ66' },
      mechanic_pay: '0',
      parts: [],
    });
    const cancelledOrder = makeServiceOrder({
      id: 'so-cancelled',
      machine_type: 'own',
      lifecycle_status: 'cancelled',
      asset: { short_name: 'Газель 2', reg_number: 'В222ВВ96' },
      mechanic_pay: '5000',
    });
    const returnedOrder = makeServiceOrder({
      id: 'so-returned',
      machine_type: 'own',
      lifecycle_status: 'returned',
      asset: { short_name: 'Газель 3', reg_number: 'С333СС96' },
      mechanic_pay: '3000',
    });

    const stats = aggregateFleetStats({
      listTrips: [],
      listServiceOrders: [paidRepair, zeroCostOrder, cancelledOrder, returnedOrder],
      mode: 'history',
      settlements: [],
    });

    expect(stats.combinedAssetGroups).toHaveLength(1);
    expect(stats.combinedAssetGroups[0]?.assetName).toBe('Валдай 6м');
    expect(stats.combinedAssetGroups[0]?.maintenanceTotal).toBe(17600);
    expect(stats.combinedAssetGroups[0]?.netProfit).toBe(-17600);
    expect(stats.totalFleetMaintenance).toBe(17600);
  });
});
