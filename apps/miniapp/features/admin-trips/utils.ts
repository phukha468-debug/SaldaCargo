import { calcServiceOrder, calcTrip, isTruckAsset } from '@saldacargo/shared';
import type { MiniappServiceOrder, MiniappTrip, VehicleGroup } from './types';

function createEmptyGroup(
  assetKey: string,
  assetName: string,
  regNumber: string,
  isPrr: boolean,
  isTruck: boolean,
): VehicleGroup {
  return {
    assetKey,
    assetName,
    regNumber,
    isPrr,
    isTruck,
    trips: [],
    serviceOrders: [],
    tripsRevenue: 0,
    tripsPayroll: 0,
    driverPayroll: 0,
    loaderPayroll: 0,
    loaderProfit: 0,
    tripsFuel: 0,
    tripsExpenses: 0,
    tripsProfit: 0,
    maintenanceParts: 0,
    maintenanceSalary: 0,
    maintenanceTotal: 0,
    netProfit: 0,
  };
}

export function buildVehicleGroups(
  historyTrips: MiniappTrip[],
  historyOrders: MiniappServiceOrder[],
): VehicleGroup[] {
  const map = new Map<string, VehicleGroup>();
  const safeTrips = Array.isArray(historyTrips) ? historyTrips : [];
  const safeOrders = Array.isArray(historyOrders) ? historyOrders : [];

  for (const t of safeTrips) {
    const isPrr =
      t.asset?.reg_number === 'БЕЗ АВТО' || t.asset?.short_name === 'БЕЗ АВТО' || !t.asset;
    const isTruck = isTruckAsset(t.asset);
    const assetKey = isPrr
      ? '👷 ПРР (без авто)'
      : `${t.asset?.short_name ?? ''} (${t.asset?.reg_number ?? ''})`;

    if (!map.has(assetKey)) {
      map.set(
        assetKey,
        createEmptyGroup(
          assetKey,
          isPrr ? '👷 ПРР' : t.asset?.short_name || 'Машина',
          isPrr ? 'без авто' : t.asset?.reg_number || '',
          isPrr,
          isTruck,
        ),
      );
    }
    const g = map.get(assetKey)!;
    g.trips.push(t);
    const ct = calcTrip(t);
    g.tripsRevenue += ct.revenue;
    g.tripsPayroll += ct.totalPayroll;
    g.driverPayroll += ct.driverPay;
    g.loaderPayroll += ct.loaderPay;
    g.loaderProfit += ct.loaderProfit;
    g.tripsFuel += ct.fuelExpense;
    g.tripsExpenses += ct.totalExpenses;
    g.tripsProfit += ct.profit;
  }

  for (const so of safeOrders) {
    if (so.machine_type !== 'own' || !so.asset) continue;
    const isTruck = isTruckAsset(so.asset);
    const assetKey = `${so.asset.short_name ?? 'Свой ТС'} (${so.asset.reg_number ?? ''})`;
    if (!map.has(assetKey)) {
      map.set(
        assetKey,
        createEmptyGroup(
          assetKey,
          so.asset.short_name ?? 'Свой ТС',
          so.asset.reg_number ?? '',
          false,
          isTruck,
        ),
      );
    }
    const g = map.get(assetKey)!;
    g.serviceOrders.push(so);
    const cso = calcServiceOrder(so);
    g.maintenanceParts += cso.partsCost;
    g.maintenanceSalary += cso.salaryCost;
    g.maintenanceTotal += cso.totalCost;
  }

  const groups = Array.from(map.values()).map((g) => {
    g.netProfit = g.tripsProfit - g.maintenanceTotal;
    return g;
  });

  return groups.sort((a, b) => {
    if (a.isPrr) return 1;
    if (b.isPrr) return -1;
    return a.assetKey.localeCompare(b.assetKey);
  });
}

export function summarizeVehicleGroups(groups: VehicleGroup[]) {
  return {
    totalRevenue: groups.reduce((s, g) => s + g.tripsRevenue, 0),
    totalPayroll: groups.reduce((s, g) => s + g.tripsPayroll, 0),
    totalFuel: groups.reduce((s, g) => s + g.tripsFuel, 0),
    totalMaintenance: groups.reduce((s, g) => s + g.maintenanceTotal, 0),
    totalNetProfit: groups.reduce((s, g) => s + g.netProfit, 0),
    tripsCount: groups.reduce((s, g) => s + g.trips.length, 0),
    ordersCount: groups.reduce((s, g) => s + g.serviceOrders.length, 0),
  };
}
