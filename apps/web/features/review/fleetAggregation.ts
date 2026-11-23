import type { ReviewServiceOrder, SettlementTransactionItem, TripForReview } from './types';
import { calcGarageOrder, calcServiceOrder, calcTrip } from './utils';

export interface VehicleAssetGroup {
  assetKey: string;
  assetName: string;
  regNumber: string;
  trips: TripForReview[];
  serviceOrders: ReviewServiceOrder[];
  tripsRevenue: number;
  tripsPayroll: number;
  driverPayroll: number;
  driverCarPayroll: number;
  driverLoaderPayroll: number;
  loaderPayroll: number;
  totalLoadingPayroll: number;
  loadingBilled: number;
  loaderProfit: number;
  tripsFuel: number;
  tripsExpenses: number;
  tripsProfit: number;
  maintenanceParts: number;
  maintenanceSalary: number;
  maintenanceTotal: number;
  netProfit: number;
  collectedRevenue: number;
  pendingDebt: number;
}

export interface ExternalSettlementItem {
  id: string;
  description: string;
  amount: number;
  counterpartyName: string | null;
  created_at: string;
}

export interface FleetAggregationResult {
  combinedAssetGroups: VehicleAssetGroup[];
  totalFleetRevenue: number;
  totalFleetCollectedRevenue: number;
  totalFleetPendingDebt: number;
  totalFleetPayroll: number;
  totalFleetFuel: number;
  totalFleetTripCosts: number;
  totalFleetMaintenance: number;
  totalFleetNetProfit: number;
  totalFleetExternalDebtCollected: number;
  externalSettlements: ExternalSettlementItem[];
  totalFleetActualProfit: number;
  totalFleetLoaderProfit: number;
  totalFleetLoadingBilled: number;
  totalFleetLoadingPayroll: number;
}

export interface GarageSummary {
  allCount: number;
  clientCount: number;
  ownCount: number;
  totalMinutes: number;
  totalPartsCost: number;
  ownWorks: number;
  ownMechanicPay: number;
  ownPartsCost: number;
  ownBilledToCarrier: number;
  ownTotalSpent: number;
  clientRevenue: number;
  clientMechanicPay: number;
  clientPartsCost: number;
  clientPartsMargin: number;
  clientNetProfit: number;
}

export function computeGarageSummary(
  filteredGarageOrders: ReviewServiceOrder[],
  allGarageOrders: ReviewServiceOrder[],
): GarageSummary {
  let totalMinutes = 0;
  let totalPartsCost = 0;
  let ownWorks = 0;
  let ownMechanicPay = 0;
  let ownPartsCost = 0;
  let ownBilledToCarrier = 0;
  let clientRevenue = 0;
  let clientMechanicPay = 0;
  let clientPartsCost = 0;
  let clientPartsMargin = 0;
  let clientNetProfit = 0;

  for (const o of filteredGarageOrders) {
    const m = calcGarageOrder(o);
    totalMinutes += m.totalMinutes;
    totalPartsCost += m.partsUnitSum;

    if (m.isOwn) {
      ownBilledToCarrier += m.billedToCarrier;
      ownWorks += m.worksSum;
      ownMechanicPay += m.mechanicPay;
      ownPartsCost += m.partsUnitSum;
    } else {
      clientRevenue += m.totalRevenue;
      clientMechanicPay += m.mechanicPay;
      clientPartsCost += m.partsUnitSum;
      clientPartsMargin += m.partsMargin;
      clientNetProfit += m.netProfit;
    }
  }

  const ownTotalSpent = ownMechanicPay + ownPartsCost;
  const allCount = allGarageOrders.length;
  const clientCount = allGarageOrders.filter((o) => o.machine_type === 'client').length;
  const ownCount = allGarageOrders.filter((o) => o.machine_type === 'own').length;

  return {
    allCount,
    clientCount,
    ownCount,
    totalMinutes,
    totalPartsCost,
    ownWorks,
    ownMechanicPay,
    ownPartsCost,
    ownBilledToCarrier,
    ownTotalSpent,
    clientRevenue,
    clientMechanicPay,
    clientPartsCost,
    clientPartsMargin,
    clientNetProfit,
  };
}

export function isRelevantFleetServiceOrder(so: ReviewServiceOrder): boolean {
  if (so.machine_type !== 'own' || !so.asset) return false;
  if (so.lifecycle_status === 'cancelled' || so.lifecycle_status === 'returned') return false;
  return calcServiceOrder(so).totalCost > 0;
}

export function aggregateFleetStats({
  listTrips,
  listServiceOrders,
  mode,
  currentPeriodEndIso,
  settlements,
}: {
  listTrips: TripForReview[];
  listServiceOrders: ReviewServiceOrder[];
  mode: 'review' | 'active' | 'history';
  currentPeriodEndIso?: string;
  settlements: SettlementTransactionItem[];
}): FleetAggregationResult {
  const map = new Map<string, VehicleAssetGroup>();

  const getOrCreate = (assetKey: string, assetName: string, regNumber: string) => {
    let g = map.get(assetKey);
    if (!g) {
      g = {
        assetKey,
        assetName,
        regNumber,
        trips: [],
        serviceOrders: [],
        tripsRevenue: 0,
        tripsPayroll: 0,
        driverPayroll: 0,
        driverCarPayroll: 0,
        driverLoaderPayroll: 0,
        loaderPayroll: 0,
        totalLoadingPayroll: 0,
        loadingBilled: 0,
        loaderProfit: 0,
        tripsFuel: 0,
        tripsExpenses: 0,
        tripsProfit: 0,
        maintenanceParts: 0,
        maintenanceSalary: 0,
        maintenanceTotal: 0,
        netProfit: 0,
        collectedRevenue: 0,
        pendingDebt: 0,
      };
      map.set(assetKey, g);
    }
    return g;
  };

  for (const t of listTrips) {
    const isPrr = t.asset?.reg_number === 'БЕЗ АВТО';
    const assetKey = isPrr
      ? '👷 ПРР (без авто)'
      : t.asset
        ? `${t.asset.short_name} (${t.asset.reg_number})`
        : 'Без машины';
    const g = getOrCreate(
      assetKey,
      isPrr ? '👷 ПРР' : (t.asset?.short_name ?? 'Без машины'),
      isPrr ? 'без авто' : (t.asset?.reg_number ?? ''),
    );
    g.trips.push(t);
    const ct = calcTrip(t, currentPeriodEndIso);
    g.tripsRevenue += ct.revenue;
    g.tripsPayroll += ct.totalPayroll;
    g.driverPayroll += ct.driverPay;
    g.driverCarPayroll += ct.driverCarPay;
    g.driverLoaderPayroll += ct.driverLoaderPay;
    g.loaderPayroll += ct.loaderPay;
    g.totalLoadingPayroll += ct.totalLoadingPayroll;
    g.loadingBilled += ct.loadingBilled;
    g.loaderProfit += ct.loaderProfit;
    g.tripsFuel += ct.fuelExpense;
    g.tripsExpenses += ct.totalExpenses;
    g.tripsProfit += ct.profit;
    g.collectedRevenue += ct.collectedRevenue;
    g.pendingDebt += ct.pendingDebt;
  }

  if (mode === 'history') {
    for (const so of listServiceOrders) {
      if (!isRelevantFleetServiceOrder(so) || !so.asset) continue;
      const assetKey = `${so.asset.short_name ?? 'Свой ТС'} (${so.asset.reg_number ?? ''})`;
      const g = getOrCreate(assetKey, so.asset.short_name ?? 'Свой ТС', so.asset.reg_number ?? '');
      g.serviceOrders.push(so);
      const cso = calcServiceOrder(so);
      g.maintenanceParts += cso.partsCost;
      g.maintenanceSalary += cso.salaryCost;
      g.maintenanceTotal += cso.totalCost;
    }
  }

  const combinedAssetGroups = Array.from(map.values())
    .map((g) => {
      g.netProfit = g.tripsProfit - g.maintenanceTotal;
      return g;
    })
    .sort((a, b) => a.assetKey.localeCompare(b.assetKey));

  const totalFleetRevenue = combinedAssetGroups.reduce((s, g) => s + g.tripsRevenue, 0);
  const totalFleetCollectedRevenue = combinedAssetGroups.reduce(
    (s, g) => s + (g.collectedRevenue ?? 0),
    0,
  );
  const totalFleetPendingDebt = combinedAssetGroups.reduce((s, g) => s + (g.pendingDebt ?? 0), 0);
  const totalFleetPayroll = combinedAssetGroups.reduce((s, g) => s + g.tripsPayroll, 0);
  const totalFleetFuel = combinedAssetGroups.reduce((s, g) => s + g.tripsFuel, 0);
  const totalFleetTripCosts = combinedAssetGroups.reduce(
    (s, g) => s + g.tripsPayroll + g.tripsExpenses,
    0,
  );
  const totalFleetMaintenance = combinedAssetGroups.reduce((s, g) => s + g.maintenanceTotal, 0);
  const totalFleetNetProfit = totalFleetRevenue - totalFleetTripCosts - totalFleetMaintenance;

  const periodTripOrderIds = new Set<string>();
  for (const t of listTrips) {
    for (const o of t.trip_orders ?? []) {
      periodTripOrderIds.add(o.id);
    }
  }

  let totalFleetExternalDebtCollected = 0;
  const externalSettlements: ExternalSettlementItem[] = [];

  for (const s of settlements) {
    const orders = s.orders ?? [];
    if (orders.length > 0) {
      let extAmt = 0;
      for (const ord of orders) {
        if (ord.type === 'manual' || !periodTripOrderIds.has(ord.id)) {
          extAmt += ord.amount;
        }
      }
      if (extAmt !== 0) {
        totalFleetExternalDebtCollected += extAmt;
        externalSettlements.push({
          id: s.id,
          description: s.description,
          amount: extAmt,
          counterpartyName: s.counterparty_name,
          created_at: s.created_at,
        });
      }
    } else {
      totalFleetExternalDebtCollected += s.amount;
      externalSettlements.push({
        id: s.id,
        description: s.description,
        amount: s.amount,
        counterpartyName: s.counterparty_name,
        created_at: s.created_at,
      });
    }
  }

  const totalFleetActualProfit =
    totalFleetNetProfit - totalFleetPendingDebt + totalFleetExternalDebtCollected;
  const totalFleetLoaderProfit = combinedAssetGroups.reduce((s, g) => s + g.loaderProfit, 0);
  const totalFleetLoadingBilled = combinedAssetGroups.reduce((s, g) => s + g.loadingBilled, 0);
  const totalFleetLoadingPayroll = combinedAssetGroups.reduce(
    (s, g) => s + g.totalLoadingPayroll,
    0,
  );

  return {
    combinedAssetGroups,
    totalFleetRevenue,
    totalFleetCollectedRevenue,
    totalFleetPendingDebt,
    totalFleetPayroll,
    totalFleetFuel,
    totalFleetTripCosts,
    totalFleetMaintenance,
    totalFleetNetProfit,
    totalFleetExternalDebtCollected,
    externalSettlements,
    totalFleetActualProfit,
    totalFleetLoaderProfit,
    totalFleetLoadingBilled,
    totalFleetLoadingPayroll,
  };
}
