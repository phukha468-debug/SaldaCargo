'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Money, cn } from '@saldacargo/ui';

// ─── Types ───────────────────────────────────────────────────────────────────

type AssetType = { id: string; code: string; name: string; capacity_m?: number; has_gps?: boolean };
type Driver = { id: string; name: string };

type VehicleDocs = {
  insurance_expires_at: string;
  insurance_policy: string;
  inspection_expires_at: string;
  inspection_number: string;
  moscow_pass_required: boolean;
  moscow_pass_expires_at: string;
  moscow_pass_zone: string;
  moscow_pass_number: string;
  tacho_skzi_expires_at: string;
  tacho_calibration_expires_at: string;
  tacho_model: string;
  oil_last_date: string;
  oil_last_km: number;
  oil_interval_km: number;
  fire_extinguisher_expires_at: string;
};

type MonthlyData = {
  revenue: number;
  fuel: number;
  driverPay: number;
  loaderPay: number;
  loadingBilled?: number;
  loaderProfit?: number;
  loaderOrdersCount?: number;
  maint: number;
  km: number;
  trips: number;
  profit: number;
  margin: number;
};

type VehicleTrip = {
  id: string;
  number: number;
  date: string;
  driver: string;
  loader: string | null;
  revenue: number;
  fuel: number;
  driverPay: number;
  loaderPay: number;
  profit: number;
  km: number;
  orders: Array<{
    desc: string;
    amount: number;
    method: string;
    label: string;
    status: string;
  }>;
};

type VehicleServiceOrder = {
  id: string;
  number: string;
  date: string;
  desc: string;
  parts: number;
  works: number;
  isExternal: boolean;
  contractor: string;
};

type MonthMeta = { id: string; label: string; short: string; year: number; month: number };

type Asset = {
  id: string;
  short_name: string;
  reg_number: string;
  year: number | null;
  status: 'active' | 'repair' | 'reserve' | 'sold' | 'written_off';
  odometer_current: number;
  current_book_value: string | null;
  remaining_depreciation_months: number | null;
  monthly_fixed_cost: string;
  notes: string | null;
  asset_type: AssetType | null;
  driver: Driver | null;
  docs: VehicleDocs;
  monthly: Record<string, MonthlyData>;
  trips: VehicleTrip[];
  serviceOrders: VehicleServiceOrder[];
};

type FleetApiResponse = {
  assets: Asset[];
  months: MonthMeta[];
  summary: { total: number; active: number; repair: number; reserve: number; needsUpdate: number };
  assetTypes: AssetType[];
};

// ─── Constants ───────────────────────────────────────────────────────────────

const TRUCKS_CODES = ['valdai_6m', 'valdai_5m', 'valdai_dump', 'canter'];
const GAZELLE_CODES = ['gazelle_4m', 'gazelle_3m', 'gazelle_project'];

const STATUS_LABEL: Record<string, string> = {
  active: 'Активна',
  repair: 'В ремонте',
  reserve: 'Резерв',
};
const STATUS_COLOR: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  repair: 'bg-amber-100 text-amber-800 border-amber-300',
  reserve: 'bg-slate-100 text-slate-700 border-slate-300',
};

// ─── Regulations Helpers ──────────────────────────────────────────────────────

function getDaysUntil(dateStr?: string | null): number | null {
  if (!dateStr || dateStr === '—') return null;
  const today = new Date();
  const target = new Date(dateStr + 'T12:00:00');
  const diffTime = target.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function checkVehicleHealth(v: Asset) {
  const issues: Array<{ type: 'danger' | 'warning'; text: string; item: string }> = [];
  const d = v.docs;
  if (!d) return { status: 'ok' as const, issues };

  // 1. Insurance
  const insDays = getDaysUntil(d.insurance_expires_at);
  if (insDays !== null) {
    if (insDays < 0)
      issues.push({
        type: 'danger',
        text: `ОСАГО просрочен на ${Math.abs(insDays)} дн!`,
        item: 'ОСАГО',
      });
    else if (insDays <= 14)
      issues.push({ type: 'danger', text: `ОСАГО истекает через ${insDays} дн!`, item: 'ОСАГО' });
    else if (insDays <= 30)
      issues.push({ type: 'warning', text: `ОСАГО истекает через ${insDays} дн.`, item: 'ОСАГО' });
  }

  // 2. Inspection TO
  const inspDays = getDaysUntil(d.inspection_expires_at);
  if (inspDays !== null) {
    if (inspDays < 0)
      issues.push({
        type: 'danger',
        text: `ТО просрочен на ${Math.abs(inspDays)} дн!`,
        item: 'ТО',
      });
    else if (inspDays <= 14)
      issues.push({ type: 'danger', text: `ТО истекает через ${inspDays} дн!`, item: 'ТО' });
    else if (inspDays <= 30)
      issues.push({ type: 'warning', text: `ТО истекает через ${inspDays} дн.`, item: 'ТО' });
  }

  // 3. Moscow Pass
  if (d.moscow_pass_required && d.moscow_pass_expires_at) {
    const moscowDays = getDaysUntil(d.moscow_pass_expires_at);
    if (moscowDays !== null) {
      if (moscowDays < 0)
        issues.push({
          type: 'danger',
          text: `Пропуск МКАД просрочен на ${Math.abs(moscowDays)} дн!`,
          item: 'Пропуск МКАД',
        });
      else if (moscowDays <= 14)
        issues.push({
          type: 'danger',
          text: `Пропуск МКАД истекает через ${moscowDays} дн!`,
          item: 'Пропуск МКАД',
        });
      else if (moscowDays <= 30)
        issues.push({
          type: 'warning',
          text: `Пропуск МКАД истекает через ${moscowDays} дн.`,
          item: 'Пропуск МКАД',
        });
    }
  }

  // 4. Tachograph SKZI
  if (d.tacho_skzi_expires_at && d.tacho_skzi_expires_at !== '—') {
    const skziDays = getDaysUntil(d.tacho_skzi_expires_at);
    if (skziDays !== null) {
      if (skziDays < 0)
        issues.push({ type: 'danger', text: `Блок СКЗИ просрочен!`, item: 'Тахограф СКЗИ' });
      else if (skziDays <= 14)
        issues.push({
          type: 'danger',
          text: `Блок СКЗИ истекает через ${skziDays} дн!`,
          item: 'Тахограф СКЗИ',
        });
      else if (skziDays <= 30)
        issues.push({
          type: 'warning',
          text: `Блок СКЗИ истекает через ${skziDays} дн.`,
          item: 'Тахограф СКЗИ',
        });
    }
  }

  // 5. Engine Oil Mileage
  if (d.oil_last_km && d.oil_interval_km) {
    const kmSince = v.odometer_current - d.oil_last_km;
    const kmLeft = d.oil_interval_km - kmSince;
    if (kmLeft < 0) {
      issues.push({
        type: 'danger',
        text: `Масло ДВС: перепробег +${Math.abs(kmLeft)} км!`,
        item: 'Масло ДВС',
      });
    } else if (kmLeft <= 1000) {
      issues.push({
        type: 'warning',
        text: `Масло ДВС: осталось ${kmLeft} км до замены`,
        item: 'Масло ДВС',
      });
    }
  }

  let overallStatus: 'ok' | 'warning' | 'danger' = 'ok';
  if (issues.some((i) => i.type === 'danger')) overallStatus = 'danger';
  else if (issues.some((i) => i.type === 'warning')) overallStatus = 'warning';

  return { status: overallStatus, issues };
}

// ─── Financial Calculations for Period ────────────────────────────────────────

function getVehiclePeriodData(v: Asset, selectedMonths: Set<string>, monthsList: MonthMeta[]) {
  let revenue = 0;
  let fuel = 0;
  let driverPay = 0;
  let loaderPay = 0;
  let loadingBilled = 0;
  let loaderProfit = 0;
  let loaderOrdersCount = 0;
  let maint = 0;
  let km = 0;
  let trips = 0;

  const monthDetails = monthsList.map((m) => {
    const isSelected = selectedMonths.has(m.id);
    const data = v.monthly?.[m.id] || {
      revenue: 0,
      fuel: 0,
      driverPay: 0,
      loaderPay: 0,
      loadingBilled: 0,
      loaderProfit: 0,
      loaderOrdersCount: 0,
      maint: 0,
      km: 0,
      trips: 0,
      profit: 0,
      margin: 0,
    };
    const costs = data.fuel + data.driverPay + data.loaderPay + data.maint;
    const profit = data.revenue - costs;
    const margin = data.revenue > 0 ? Math.round((profit / data.revenue) * 100) : 0;

    if (isSelected) {
      revenue += data.revenue;
      fuel += data.fuel;
      driverPay += data.driverPay;
      loaderPay += data.loaderPay;
      loadingBilled += data.loadingBilled ?? 0;
      loaderProfit += data.loaderProfit ?? 0;
      loaderOrdersCount += data.loaderOrdersCount ?? 0;
      maint += data.maint;
      km += data.km;
      trips += data.trips;
    }

    return {
      month: m,
      isSelected,
      ...data,
      costs,
      profit,
      margin,
    };
  });

  const totalCosts = fuel + driverPay + loaderPay + maint;
  const profit = revenue - totalCosts;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
  const costPerKm = km > 0 ? Math.round(totalCosts / km) : 0;

  return {
    revenue,
    fuel,
    driverPay,
    loaderPay,
    loadingBilled,
    loaderProfit,
    loaderOrdersCount,
    maint,
    totalCosts,
    profit,
    margin,
    km,
    trips,
    costPerKm,
    monthDetails,
  };
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function FleetPage() {
  const qc = useQueryClient();

  // Queries
  const { data, isLoading, isError } = useQuery<FleetApiResponse>({
    queryKey: ['fleet-matrix'],
    queryFn: () => fetch('/api/fleet').then((r) => r.json()),
    staleTime: 60 * 1000,
  });

  const { data: drivers = [] } = useQuery<Driver[]>({
    queryKey: ['drivers'],
    queryFn: () => fetch('/api/users?role=driver').then((r) => r.json()),
    staleTime: 300000,
  });

  // State
  const [vehicleFilter, setVehicleFilter] = useState<'all' | 'trucks' | 'gazelles'>('all');
  const [sortKey, setSortKey] = useState<'profit' | 'revenue' | 'margin' | 'trips'>('profit');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [editingAsset, setEditingAsset] = useState<Asset | 'new' | null>(null);
  const [isAllDocsModalOpen, setIsAllDocsModalOpen] = useState(false);

  // Initialize selected months once data is loaded
  const monthsList = data?.months ?? [];
  useMemo(() => {
    if (monthsList.length > 0 && selectedMonths.size === 0) {
      setSelectedMonths(new Set(monthsList.map((m) => m.id)));
    }
  }, [monthsList, selectedMonths.size]);

  // Mutations
  const patchMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      fetch(`/api/fleet/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fleet-matrix'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/fleet/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Ошибка удаления');
      return json;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fleet-matrix'] }),
    onError: (err: Error) => alert(err.message),
  });

  // Handlers
  const toggleMonth = (monthId: string) => {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthId)) {
        if (next.size > 1) next.delete(monthId);
      } else {
        next.add(monthId);
      }
      return next;
    });
  };

  const selectPreset = (type: 'all' | 'last3' | 'current') => {
    if (monthsList.length === 0) return;
    if (type === 'all') {
      setSelectedMonths(new Set(monthsList.map((m) => m.id)));
    } else if (type === 'last3') {
      const last3 = monthsList.slice(-3).map((m) => m.id);
      setSelectedMonths(new Set(last3));
    } else if (type === 'current') {
      const cur = monthsList[monthsList.length - 1];
      if (cur) setSelectedMonths(new Set([cur.id]));
    }
  };

  const toggleRow = (vehicleId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(vehicleId)) next.delete(vehicleId);
      else next.add(vehicleId);
      return next;
    });
  };

  const toggleAllRows = () => {
    const assets = data?.assets ?? [];
    if (expandedRows.size === assets.length) {
      setExpandedRows(new Set());
    } else {
      setExpandedRows(new Set(assets.map((a) => a.id)));
    }
  };

  // Filter & calculate vehicles
  // Filter & calculate vehicles
  const allAssets = data?.assets ?? [];
  const filteredAssets = useMemo(() => {
    const list = allAssets.filter((a) => {
      const code = a.asset_type?.code ?? '';
      if (vehicleFilter === 'trucks') return TRUCKS_CODES.includes(code);
      if (vehicleFilter === 'gazelles') return GAZELLE_CODES.includes(code);
      return true;
    });

    const numMonths = Math.max(selectedMonths.size, 1);
    const withMetrics = list.map((v) => {
      const isTruck = TRUCKS_CODES.includes(v.asset_type?.code ?? '');
      const d = getVehiclePeriodData(v, selectedMonths, monthsList);
      const normRev = (isTruck ? 640000 : 430000) * numMonths;
      const normTrips = (isTruck ? 15.5 : 30) * numMonths;
      const revLoad = Math.min(100, (d.revenue / normRev) * 100);
      const tripLoad = Math.min(100, (d.trips / normTrips) * 100);
      const loadPct = Math.min(100, Math.round(0.7 * revLoad + 0.3 * tripLoad));
      return { v, d, isTruck, loadPct };
    });

    withMetrics.sort((a, b) => {
      if (sortKey === 'profit') return b.d.profit - a.d.profit;
      if (sortKey === 'revenue') return b.d.revenue - a.d.revenue;
      if (sortKey === 'margin') return b.d.margin - a.d.margin;
      if (sortKey === 'trips') return b.d.trips - a.d.trips;
      return 0;
    });

    return withMetrics;
  }, [allAssets, vehicleFilter, selectedMonths, monthsList, sortKey]);

  // Sum totals across all displayed / filtered vehicles
  const fleetTotals = useMemo(() => {
    let revenue = 0;
    let fuel = 0;
    let driverPay = 0;
    let loaderPay = 0;
    let maint = 0;
    let profit = 0;
    let totalLoadSum = 0;

    filteredAssets.forEach(({ d, loadPct }) => {
      revenue += d.revenue;
      fuel += d.fuel;
      driverPay += d.driverPay;
      loaderPay += d.loaderPay;
      maint += d.maint;
      profit += d.profit;
      totalLoadSum += loadPct;
    });

    const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
    const avgLoad =
      filteredAssets.length > 0 ? Math.round(totalLoadSum / filteredAssets.length) : 0;

    return {
      revenue,
      fuel,
      driverPay,
      loaderPay,
      maint,
      profit,
      margin,
      avgLoad,
      count: filteredAssets.length,
    };
  }, [filteredAssets]);

  // Cohort statistics calculation
  const cohortStats = useMemo(() => {
    const calcCohort = (filterFn: (code: string) => boolean, isTruckCohort: boolean) => {
      let revenue = 0;
      let totalCosts = 0;
      let profit = 0;
      let fuel = 0;
      let maint = 0;
      let trips = 0;
      let count = 0;
      let totalLoadSum = 0;

      const numMonths = Math.max(selectedMonths.size, 1);
      const normRev = (isTruckCohort ? 640000 : 430000) * numMonths;
      const normTrips = (isTruckCohort ? 15.5 : 30) * numMonths;

      allAssets.forEach((v) => {
        const code = v.asset_type?.code ?? '';
        if (!filterFn(code)) return;
        count += 1;
        const d = getVehiclePeriodData(v, selectedMonths, monthsList);
        revenue += d.revenue;
        totalCosts += d.totalCosts;
        profit += d.profit;
        fuel += d.fuel;
        maint += d.maint;
        trips += d.trips;

        const revLoad = Math.min(100, (d.revenue / normRev) * 100);
        const tripLoad = Math.min(100, (d.trips / normTrips) * 100);
        const loadPct = Math.min(100, Math.round(0.7 * revLoad + 0.3 * tripLoad));
        totalLoadSum += loadPct;
      });

      const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
      const avgLoad = count > 0 ? Math.round(totalLoadSum / count) : 0;
      return { revenue, totalCosts, profit, margin, fuel, maint, trips, count, avgLoad };
    };

    const trucks = calcCohort((c) => TRUCKS_CODES.includes(c), true);
    const gazelles = calcCohort((c) => GAZELLE_CODES.includes(c), false);

    // Loaders calculation across all assets
    let totalLoaderPay = 0;
    let totalLoadingBilled = 0;
    let totalLoaderProfit = 0;
    let totalLoaderOrders = 0;
    let totalFleetRev = 0;
    let totalFleetProfit = 0;

    allAssets.forEach((v) => {
      const d = getVehiclePeriodData(v, selectedMonths, monthsList);
      totalLoaderPay += d.loaderPay;
      totalLoadingBilled += d.loadingBilled;
      totalLoaderProfit += d.loaderProfit;
      totalLoaderOrders += d.loaderOrdersCount;
      totalFleetRev += d.revenue;
      totalFleetProfit += d.profit;
    });

    if (totalLoadingBilled === 0 && totalLoaderPay > 0) {
      totalLoadingBilled = Math.round(totalLoaderPay / 0.7);
      totalLoaderProfit = Math.max(0, totalLoadingBilled - totalLoaderPay);
    }

    const loaderMargin =
      totalLoadingBilled > 0 ? Math.round((totalLoaderProfit / totalLoadingBilled) * 100) : 0;
    const avgBilledPerOrder =
      totalLoaderOrders > 0 ? Math.round(totalLoadingBilled / totalLoaderOrders) : 0;
    const avgPayPerOrder =
      totalLoaderOrders > 0 ? Math.round(totalLoaderPay / totalLoaderOrders) : 0;
    const fleetMargin =
      totalFleetRev > 0 ? Math.round((totalFleetProfit / totalFleetRev) * 100) : 0;

    return {
      trucks,
      gazelles,
      loaders: {
        billed: totalLoadingBilled,
        fund: totalLoaderPay,
        profit: totalLoaderProfit,
        margin: loaderMargin,
        count: totalLoaderOrders,
        avgBilled: avgBilledPerOrder,
        avgPay: avgPayPerOrder,
      },
      total: {
        rev: totalFleetRev,
        profit: totalFleetProfit,
        margin: fleetMargin,
      },
    };
  }, [allAssets, selectedMonths, monthsList]);

  // Uniform 10-column grid template (added dedicated "Загрузка" column)
  const gridTemplate =
    'grid-cols-[minmax(190px,2fr)_minmax(75px,0.8fr)_minmax(95px,1.1fr)_minmax(95px,1.1fr)_minmax(95px,1.1fr)_minmax(85px,1fr)_minmax(85px,1fr)_minmax(75px,0.9fr)_minmax(120px,1.4fr)_36px]';

  return (
    <div className="space-y-6 max-w-[1920px] animate-in fade-in duration-500">
      {/* ── TOP CONTEXT & MULTI-MONTH SELECTOR ───────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-xs font-black uppercase bg-emerald-100 text-emerald-800">
              Основной выбор
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Автопарк · Финансовая Матрица P&L
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl">
            Полноширинная аналитическая таблица по каждому автомобилю. Помесячная матрица прибыли,
            история рейсов со способами оплаты и наряды Гаража.
          </p>
        </div>

        {/* Period Multi-Select & Quick Buttons */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 flex-wrap">
            {monthsList.map((m) => {
              const active = selectedMonths.has(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggleMonth(m.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5',
                    active
                      ? 'bg-emerald-600 text-white shadow-xs font-black'
                      : 'text-slate-500 hover:text-slate-900',
                  )}
                >
                  {active && <span>✓</span>}
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => selectPreset('all')}
              className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 transition"
            >
              Все мес
            </button>
            <button
              onClick={() => selectPreset('last3')}
              className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 transition"
            >
              3 мес
            </button>
            <button
              onClick={() => selectPreset('current')}
              className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 transition"
            >
              Тек. месяц
            </button>
          </div>
        </div>
      </div>

      {isError && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-700 font-bold">
          Ошибка загрузки данных автопарка
        </div>
      )}

      {/* ── COHORTS KPI SUMMARY (1/3 REDUCED COMPACT HEIGHT) ─────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {/* Cohort: Trucks */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs relative overflow-hidden group hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-bl-full pointer-events-none" />
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="text-base">🚛</span>
                <div>
                  <h3 className="text-xs font-black text-slate-900 leading-tight">
                    Тяжелые грузовики
                  </h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase leading-tight">
                    Валдаи 5-6м, Canter ({cohortStats.trucks.count} ед)
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                {cohortStats.trucks.trips} рейсов
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-2">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                  Выручка
                </span>
                <span className="text-sm font-black text-slate-900">
                  <Money amount={cohortStats.trucks.revenue} />
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                  Все расходы
                </span>
                <span className="text-sm font-black text-rose-600">
                  -<Money amount={cohortStats.trucks.totalCosts} />
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                  Чистая прибыль
                </span>
                <span className="text-base font-black text-emerald-600">
                  <Money amount={cohortStats.trucks.profit} />
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                  Маржа
                </span>
                <span className="text-base font-black text-slate-800">
                  {cohortStats.trucks.margin}%
                </span>
              </div>
            </div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-medium">
            <span>
              ГСМ:{' '}
              <strong className="text-slate-700">
                <Money amount={cohortStats.trucks.fuel} />
              </strong>
            </span>
            <span>
              Ср. загр:{' '}
              <strong
                className={cn(
                  'font-bold',
                  cohortStats.trucks.avgLoad >= 50 ? 'text-emerald-700' : 'text-amber-700',
                )}
              >
                {cohortStats.trucks.avgLoad}%
              </strong>
            </span>
            <span>
              Ремонты:{' '}
              <strong className="text-slate-700">
                <Money amount={cohortStats.trucks.maint} />
              </strong>
            </span>
          </div>
        </div>

        {/* Cohort: Gazelles */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs relative overflow-hidden group hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/5 rounded-bl-full pointer-events-none" />
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="text-base">🚐</span>
                <div>
                  <h3 className="text-xs font-black text-slate-900 leading-tight">Газели</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase leading-tight">
                    3-4м, Фермер ({cohortStats.gazelles.count} ед)
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                {cohortStats.gazelles.trips} рейсов
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-2">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                  Выручка
                </span>
                <span className="text-sm font-black text-slate-900">
                  <Money amount={cohortStats.gazelles.revenue} />
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                  Все расходы
                </span>
                <span className="text-sm font-black text-rose-600">
                  -<Money amount={cohortStats.gazelles.totalCosts} />
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                  Чистая прибыль
                </span>
                <span className="text-base font-black text-emerald-600">
                  <Money amount={cohortStats.gazelles.profit} />
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                  Маржа
                </span>
                <span className="text-base font-black text-slate-800">
                  {cohortStats.gazelles.margin}%
                </span>
              </div>
            </div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-medium">
            <span>
              ГСМ:{' '}
              <strong className="text-slate-700">
                <Money amount={cohortStats.gazelles.fuel} />
              </strong>
            </span>
            <span>
              Ср. загр:{' '}
              <strong
                className={cn(
                  'font-bold',
                  cohortStats.gazelles.avgLoad >= 50 ? 'text-emerald-700' : 'text-amber-700',
                )}
              >
                {cohortStats.gazelles.avgLoad}%
              </strong>
            </span>
            <span>
              Ремонты:{' '}
              <strong className="text-slate-700">
                <Money amount={cohortStats.gazelles.maint} />
              </strong>
            </span>
          </div>
        </div>

        {/* Cohort: Loaders */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs relative overflow-hidden group hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/5 rounded-bl-full pointer-events-none" />
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="text-base">👷</span>
                <div>
                  <h3 className="text-xs font-black text-slate-900 leading-tight">
                    Бригада грузчиков
                  </h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase leading-tight">
                    Погрузка и занос (ПРР)
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                {cohortStats.loaders.count} заявок
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-2">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                  Выручка (ПРР)
                </span>
                <span className="text-sm font-black text-slate-900">
                  <Money amount={cohortStats.loaders.billed} />
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                  Выплаты бригаде
                </span>
                <span className="text-sm font-black text-purple-700">
                  -<Money amount={cohortStats.loaders.fund} />
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                  Чистая прибыль
                </span>
                <span className="text-base font-black text-emerald-600">
                  +<Money amount={cohortStats.loaders.profit} />
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                  Маржа компании
                </span>
                <span className="text-base font-black text-slate-800">
                  {cohortStats.loaders.margin}%
                </span>
              </div>
            </div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-medium">
            <span>
              Ср. чек заявки:{' '}
              <strong className="text-slate-700">
                <Money amount={cohortStats.loaders.avgBilled} />
              </strong>
            </span>
            <span>
              Ср. ЗП / заказ:{' '}
              <strong className="text-slate-700">
                <Money amount={cohortStats.loaders.avgPay} />
              </strong>
            </span>
          </div>
        </div>

        {/* Cohort: Fleet Total */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-3.5 shadow-lg border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/80">
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">
                ИТОГ ЗА ПЕРИОД
              </span>
              <span className="text-[10px] font-mono bg-slate-700/80 px-1.5 py-0.5 rounded text-slate-200">
                Выбрано: {selectedMonths.size} мес
              </span>
            </div>
            <div className="mt-1.5">
              <span className="text-[10px] text-slate-400 block leading-tight">
                Чистая прибыль парка:
              </span>
              <div className="text-2xl font-black text-emerald-400 tracking-tight">
                <Money amount={cohortStats.total.profit} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/80 text-[11px]">
            <div>
              <span className="text-slate-400 text-[9px] block">Выручка всего:</span>
              <span className="font-bold text-white text-xs">
                <Money amount={cohortStats.total.rev} />
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[9px] block">Ср. маржа парка:</span>
              <span className="font-bold text-emerald-300 text-xs">
                {cohortStats.total.margin}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── FILTER CONTROLS BAR ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-white p-3 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setVehicleFilter('all')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs transition-all',
              vehicleFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs font-black'
                : 'text-slate-500 hover:text-slate-900 font-bold',
            )}
          >
            Все машины ({allAssets.length})
          </button>
          <button
            onClick={() => setVehicleFilter('trucks')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs transition-all',
              vehicleFilter === 'trucks'
                ? 'bg-white text-slate-900 shadow-xs font-black'
                : 'text-slate-500 hover:text-slate-900 font-bold',
            )}
          >
            🚛 Грузовики ({cohortStats.trucks.count})
          </button>
          <button
            onClick={() => setVehicleFilter('gazelles')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs transition-all',
              vehicleFilter === 'gazelles'
                ? 'bg-white text-slate-900 shadow-xs font-black'
                : 'text-slate-500 hover:text-slate-900 font-bold',
            )}
          >
            🚐 Газели ({cohortStats.gazelles.count})
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
          <span className="hidden sm:inline">Сортировка:</span>
          <select
            value={sortKey}
            onChange={(e) =>
              setSortKey(e.target.value as 'profit' | 'revenue' | 'margin' | 'trips')
            }
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700 cursor-pointer"
          >
            <option value="profit">По чистой прибыли (убывание)</option>
            <option value="revenue">По выручке</option>
            <option value="margin">По маржинальности %</option>
            <option value="trips">По числу рейсов</option>
          </select>
          <button
            onClick={() => setIsAllDocsModalOpen(true)}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px] text-emerald-400">
              checklist
            </span>
            <span>Шахматка документов</span>
          </button>
          <button
            onClick={toggleAllRows}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
          >
            {expandedRows.size === allAssets.length ? 'Свернуть все' : 'Развернуть все'}
          </button>
          <button
            onClick={() => setEditingAsset('new')}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition shadow-xs"
          >
            + Добавить машину
          </button>
        </div>
      </div>

      {/* ── TABLE HEADER ROW & TOTALS SUMMARY (STRICT UNIFORM 10 COLUMNS) ── */}
      <div className="hidden lg:block bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden mb-3">
        {/* Column Titles */}
        <div
          className={cn(
            'grid items-center w-full px-5 pt-3 pb-1 gap-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 select-none border-b border-slate-100',
            gridTemplate,
          )}
        >
          <div>МАШИНА / ВОДИТЕЛЬ</div>
          <div className="text-center text-slate-500 font-bold">ЗАГРУЗКА</div>
          <div className="text-right">ВЫРУЧКА</div>
          <div className="text-right text-amber-700/80">ГСМ (ТОПЛИВО)</div>
          <div className="text-right">ЗП ВОДИТЕЛЯ</div>
          <div className="text-right text-purple-700/80">ЗП ГРУЗЧИКОВ</div>
          <div className="text-right text-rose-700/80">ГАРАЖ / РЕМОНТЫ</div>
          <div className="text-center">ДИНАМИКА</div>
          <div className="text-right text-emerald-700/80">ЧИСТАЯ ПРИБЫЛЬ</div>
          <div />
        </div>
        {/* Sum totals across all displayed vehicles */}
        <div
          className={cn(
            'grid items-center w-full px-5 py-2.5 gap-2.5 bg-slate-50/90 text-xs font-mono select-none',
            gridTemplate,
          )}
        >
          <div className="flex items-center gap-2 font-sans font-black text-slate-800 text-xs">
            <span className="material-symbols-outlined text-slate-400 text-[18px]">functions</span>
            <span>ИТОГО ПО ВЫБОРКЕ ({fleetTotals.count})</span>
          </div>
          <div className="flex justify-center">
            <span
              className={cn(
                'px-2 py-0.5 rounded-lg text-xs font-black border tracking-tight',
                fleetTotals.avgLoad >= 50
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border-amber-300',
              )}
            >
              {fleetTotals.avgLoad}% ср.
            </span>
          </div>
          <div className="text-right font-black text-slate-900 text-sm">
            <Money amount={fleetTotals.revenue} />
          </div>
          <div className="text-right font-black text-amber-600">
            -<Money amount={fleetTotals.fuel} />
          </div>
          <div className="text-right font-black text-slate-700">
            -<Money amount={fleetTotals.driverPay} />
          </div>
          <div className="text-right font-black text-purple-700">
            {fleetTotals.loaderPay > 0 ? (
              <>
                -<Money amount={fleetTotals.loaderPay} />
              </>
            ) : (
              '—'
            )}
          </div>
          <div className="text-right font-black text-rose-600">
            {fleetTotals.maint > 0 ? (
              <>
                -<Money amount={fleetTotals.maint} />
              </>
            ) : (
              '0 ₽'
            )}
          </div>
          <div className="text-center text-slate-300 font-sans text-[11px]">—</div>
          <div className="text-right">
            <span className="text-sm font-black text-emerald-600 block leading-tight">
              +<Money amount={fleetTotals.profit} />
            </span>
            <span className="text-[10px] font-black text-emerald-700 font-sans block">
              {fleetTotals.margin}% маржа
            </span>
          </div>
          <div />
        </div>
      </div>

      {/* ── VEHICLE ROWS (ACCORDION CARDS) ──────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-16 bg-white rounded-2xl border border-slate-200 animate-pulse"
            />
          ))}
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
          <p className="text-5xl mb-3">🚛</p>
          <p className="font-medium text-slate-500">Машины не найдены</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAssets.map(({ v, d, isTruck, loadPct }) => {
            const isExp = expandedRows.has(v.id);
            const profitClass = d.profit >= 0 ? 'text-emerald-600' : 'text-rose-600';
            const borderClass =
              d.profit >= 0 ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-rose-500';
            const health = checkVehicleHealth(v);

            // Sparkline calculation
            const maxProfit = Math.max(...d.monthDetails.map((m) => Math.abs(m.profit)), 1);

            return (
              <div
                key={v.id}
                className={cn(
                  'bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all',
                  borderClass,
                )}
              >
                {/* Collapsed Row */}
                <div
                  onClick={() => toggleRow(v.id)}
                  className={cn(
                    'cursor-pointer hover:bg-slate-50/80 transition-colors select-none grid items-center w-full px-5 py-3 gap-2.5',
                    gridTemplate,
                  )}
                >
                  {/* Column 1: Identity */}
                  <div className="flex items-center gap-2.5 min-w-0 pr-1">
                    <span className="text-xl shrink-0">{isTruck ? '🚛' : '🚐'}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-slate-900 text-sm tracking-tight truncate">
                          {v.short_name}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                          {v.reg_number}
                        </span>
                        {health.issues.length > 0 && (
                          <span
                            className={cn(
                              'text-[10px] font-bold px-1.5 py-0.2 rounded border flex items-center gap-0.5 shrink-0',
                              health.issues.some((i) => i.type === 'danger')
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200',
                            )}
                            title={health.issues.map((i) => i.text).join('\n')}
                          >
                            ⚠️ {health.issues.length}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5 flex-wrap">
                        <span className="truncate">
                          Водитель:{' '}
                          <strong className="text-slate-700">{v.driver?.name || '—'}</strong>
                        </span>
                        <span>·</span>
                        <span
                          className={cn(
                            'text-[10px] font-bold px-1.5 py-0.2 rounded border shrink-0',
                            STATUS_COLOR[v.status] ??
                              'bg-slate-100 text-slate-700 border-slate-300',
                          )}
                        >
                          {STATUS_LABEL[v.status] ?? v.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Загрузка */}
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block lg:hidden">
                      Загрузка
                    </span>
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-lg text-xs font-black border tracking-tight',
                        loadPct >= 80
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : loadPct >= 50
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : loadPct > 0
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-100 text-slate-400 border-slate-200',
                      )}
                      title={`Загрузка: ${loadPct}% (Выручка: ${d.revenue.toLocaleString('ru-RU')} ₽, Рейсов: ${d.trips})`}
                    >
                      {loadPct}%
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono mt-0.5">{d.trips} р.</span>
                  </div>

                  {/* Column 3: Выручка */}
                  <div className="text-right">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block lg:hidden">
                      Выручка
                    </span>
                    <span className="text-sm font-bold text-slate-900 font-mono">
                      <Money amount={d.revenue} />
                    </span>
                  </div>

                  {/* Column 3: ГСМ */}
                  <div className="text-right">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block lg:hidden">
                      ГСМ
                    </span>
                    <span className="text-sm font-bold text-amber-600 font-mono">
                      <Money amount={d.fuel} />
                    </span>
                  </div>

                  {/* Column 4: ЗП Водителя */}
                  <div className="text-right">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block lg:hidden">
                      ЗП Водителя
                    </span>
                    <span className="text-sm font-bold text-slate-700 font-mono">
                      <Money amount={d.driverPay} />
                    </span>
                  </div>

                  {/* Column 5: ЗП Грузчиков */}
                  <div className="text-right">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block lg:hidden">
                      ЗП Грузчиков
                    </span>
                    <span className="text-sm font-bold text-purple-700 font-mono">
                      {d.loaderPay > 0 ? <Money amount={d.loaderPay} /> : '—'}
                    </span>
                  </div>

                  {/* Column 6: Гараж / Ремонты */}
                  <div className="text-right">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block lg:hidden">
                      Гараж
                    </span>
                    <span className="text-sm font-bold text-rose-600 font-mono">
                      {d.maint > 0 ? <Money amount={d.maint} /> : '0 ₽'}
                    </span>
                  </div>

                  {/* Column 7: Спарклайны динамики */}
                  <div className="flex items-center justify-center">
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100">
                      {d.monthDetails.map((m) => {
                        const h = Math.max(Math.round((Math.abs(m.profit) / maxProfit) * 20), 4);
                        const color = !m.isSelected
                          ? 'bg-slate-200'
                          : m.profit >= 0
                            ? 'bg-emerald-500'
                            : 'bg-rose-500';
                        return (
                          <div
                            key={m.month.id}
                            className="flex flex-col items-center gap-0.5"
                            title={`${m.month.label}: ${m.profit >= 0 ? '+' : ''}${m.profit.toLocaleString('ru-RU')} ₽`}
                          >
                            <span className="text-[7px] font-mono text-slate-400">
                              {m.month.short}
                            </span>
                            <div className="w-1.5 bg-slate-100 rounded-xs h-5 flex items-end justify-center">
                              <div
                                className={cn('w-full rounded-xs', color)}
                                style={{ height: `${h}px` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Column 8: Чистая прибыль */}
                  <div className="text-right">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block lg:hidden">
                      Прибыль
                    </span>
                    <span
                      className={cn('text-base font-black font-mono leading-tight', profitClass)}
                    >
                      <Money amount={d.profit} />
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-black block',
                        d.margin >= 20 ? 'text-emerald-600' : 'text-amber-600',
                      )}
                    >
                      {d.margin}% маржа
                    </span>
                  </div>

                  {/* Column 9: Шеврон */}
                  <div className="flex justify-center items-center">
                    <div
                      className={cn(
                        'w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-500 shadow-2xs transition-all shrink-0',
                        isExp && 'rotate-180 bg-emerald-100 text-emerald-800 border-emerald-300',
                      )}
                    >
                      <span className="material-symbols-outlined text-[16px]">expand_more</span>
                    </div>
                  </div>
                </div>

                {/* ── EXPANDED ACCORDION ────────────────────────────────────── */}
                {isExp && (
                  <div className="border-t border-slate-200 bg-slate-50/70 p-5 space-y-5 animate-in fade-in duration-200">
                    {/* Top subheader */}
                    <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-200">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                          Финансовая детализация {v.short_name}:
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          Загрузка:{' '}
                          <strong
                            className={cn(
                              'font-bold',
                              loadPct >= 80
                                ? 'text-emerald-700'
                                : loadPct >= 50
                                  ? 'text-amber-700'
                                  : 'text-rose-700',
                            )}
                          >
                            {loadPct}%
                          </strong>{' '}
                          · Пробег: {d.km.toLocaleString('ru-RU')} км · Рейсов: {d.trips} · Всего
                          расходов: <Money amount={d.totalCosts} /> · Себестоимость: {d.costPerKm}{' '}
                          ₽/км
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-700">
                          Одометр: {v.odometer_current.toLocaleString('ru-RU')} км
                        </span>
                        <select
                          value={v.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            patchMutation.mutate({ id: v.id, body: { status: e.target.value } });
                          }}
                          className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 text-xs cursor-pointer hover:border-slate-300"
                          title="Изменить статус автомобиля"
                        >
                          <option value="active">🟢 В работе</option>
                          <option value="repair">🔴 В ремонте</option>
                          <option value="standby">🟡 В резерве</option>
                        </select>
                        <button
                          onClick={() => setEditingAsset(v)}
                          className="px-3 py-1 bg-slate-900 text-white hover:bg-slate-800 rounded-lg font-bold transition flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">edit</span>
                          <span>Редактировать</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              window.confirm(
                                `Удалить автомобиль ${v.short_name} (${v.reg_number}) из автопарка?`,
                              )
                            ) {
                              deleteMutation.mutate(v.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Удалить автомобиль"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>

                    {/* Помесячная таблица P&L */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                      <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-emerald-600">
                            calendar_month
                          </span>
                          <span>ПОМЕСЯЧНЫЙ ФИНАНСОВЫЙ РЕЗУЛЬТАТ</span>
                        </span>
                        <span className="text-[11px] text-slate-400 font-normal">
                          Подсвечены выбранные в фильтре месяцы
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
                            <tr>
                              <th className="p-3">Месяц</th>
                              <th className="p-3 text-center">Рейсов</th>
                              <th className="p-3 text-right">Пробег</th>
                              <th className="p-3 text-right">Выручка</th>
                              <th className="p-3 text-right text-amber-700">ГСМ</th>
                              <th className="p-3 text-right">ЗП Водителя</th>
                              <th className="p-3 text-right text-purple-700">ЗП Грузчиков</th>
                              <th className="p-3 text-right text-rose-700">Ремонты</th>
                              <th className="p-3 text-right text-emerald-700 font-black">
                                Чистая прибыль
                              </th>
                              <th className="p-3 text-right">Маржа</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono">
                            {d.monthDetails.map((m) => (
                              <tr
                                key={m.month.id}
                                className={cn(
                                  'hover:bg-slate-50 transition-colors',
                                  m.isSelected && 'bg-emerald-50/20 font-bold',
                                )}
                              >
                                <td className="p-3 font-sans font-medium text-slate-800 flex items-center gap-2">
                                  <span
                                    className={cn(
                                      'w-2 h-2 rounded-full',
                                      m.isSelected ? 'bg-emerald-500' : 'bg-slate-300',
                                    )}
                                  />
                                  <span>{m.month.label}</span>
                                </td>
                                <td className="p-3 text-center text-slate-700">{m.trips}</td>
                                <td className="p-3 text-right text-slate-700">
                                  {m.km.toLocaleString('ru-RU')} км
                                </td>
                                <td className="p-3 text-right text-slate-900 font-bold">
                                  <Money amount={m.revenue} />
                                </td>
                                <td className="p-3 text-right text-amber-600">
                                  {m.fuel > 0 ? (
                                    <>
                                      -<Money amount={m.fuel} />
                                    </>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td className="p-3 text-right text-slate-700">
                                  {m.driverPay > 0 ? (
                                    <>
                                      -<Money amount={m.driverPay} />
                                    </>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td className="p-3 text-right text-purple-700">
                                  {m.loaderPay > 0 ? (
                                    <>
                                      -<Money amount={m.loaderPay} />
                                    </>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td className="p-3 text-right text-rose-600">
                                  {m.maint > 0 ? (
                                    <>
                                      -<Money amount={m.maint} />
                                    </>
                                  ) : (
                                    '0 ₽'
                                  )}
                                </td>
                                <td
                                  className={cn(
                                    'p-3 text-right font-black',
                                    m.profit >= 0 ? 'text-emerald-600' : 'text-rose-600',
                                  )}
                                >
                                  <Money amount={m.profit} />
                                </td>
                                <td className="p-3 text-right font-sans text-slate-700">
                                  {m.margin}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          {/* Totals row */}
                          <tfoot className="bg-slate-100/90 font-mono font-black border-t-2 border-slate-200 text-xs">
                            <tr>
                              <td className="p-3 font-sans text-slate-900">
                                ИТОГО ЗА ВЫБРАННЫЙ ПЕРИОД
                              </td>
                              <td className="p-3 text-center text-slate-900">{d.trips}</td>
                              <td className="p-3 text-right text-slate-900">
                                {d.km.toLocaleString('ru-RU')} км
                              </td>
                              <td className="p-3 text-right text-slate-900">
                                <Money amount={d.revenue} />
                              </td>
                              <td className="p-3 text-right text-amber-600">
                                -<Money amount={d.fuel} />
                              </td>
                              <td className="p-3 text-right text-slate-900">
                                -<Money amount={d.driverPay} />
                              </td>
                              <td className="p-3 text-right text-purple-700">
                                {d.loaderPay > 0 ? (
                                  <>
                                    -<Money amount={d.loaderPay} />
                                  </>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="p-3 text-right text-rose-600">
                                {d.maint > 0 ? (
                                  <>
                                    -<Money amount={d.maint} />
                                  </>
                                ) : (
                                  '0 ₽'
                                )}
                              </td>
                              <td
                                className={cn(
                                  'p-3 text-right',
                                  d.profit >= 0 ? 'text-emerald-600' : 'text-rose-600',
                                )}
                              >
                                <Money amount={d.profit} />
                              </td>
                              <td className="p-3 text-right font-sans text-slate-900">
                                {d.margin}%
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    {/* История рейсов */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                      <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-blue-600">
                            local_shipping
                          </span>
                          <span>ПОСЛЕДНИЕ УТВЕРЖДЕННЫЕ РЕЙСЫ (ИЗ ИСТОРИИ РЕВЬЮ)</span>
                        </span>
                        <span className="text-[11px] text-slate-400 font-normal">
                          Показано до 8 недавних рейсов
                        </span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {(v.trips || []).length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-400">
                            Рейсов за этот период не зарегистрировано
                          </div>
                        ) : (
                          v.trips.map((t) => (
                            <div
                              key={t.id}
                              className="p-3.5 hover:bg-slate-50 transition-colors space-y-2"
                            >
                              <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-slate-900">
                                    Рейс №{t.number}
                                  </span>
                                  <span className="text-slate-400">·</span>
                                  <span className="text-slate-500 font-medium">{t.date}</span>
                                  <span className="text-slate-400">·</span>
                                  <span className="text-slate-600">
                                    👤 {t.driver} {t.loader ? `+ 👷 ${t.loader}` : ''}
                                  </span>
                                  {t.km > 0 && <span className="text-slate-400">({t.km} км)</span>}
                                </div>
                                <div className="flex items-center gap-4 text-xs font-mono font-bold">
                                  <span className="text-slate-900">
                                    Выручка: <Money amount={t.revenue} />
                                  </span>
                                  <span className="text-amber-600">
                                    ГСМ: -<Money amount={t.fuel} />
                                  </span>
                                  <span className="text-purple-700">
                                    ЗП: -<Money amount={t.driverPay + t.loaderPay} />
                                  </span>
                                  <span
                                    className={cn(
                                      'px-2 py-0.5 rounded font-black',
                                      t.profit >= 0
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-rose-50 text-rose-700',
                                    )}
                                  >
                                    Прибыль: <Money amount={t.profit} />
                                  </span>
                                </div>
                              </div>
                              {/* Orders inside this trip */}
                              <div className="flex items-center gap-2 flex-wrap pl-2 border-l-2 border-slate-200">
                                {t.orders.map((o, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px]"
                                  >
                                    <span className="font-medium text-slate-700">{o.desc}</span>
                                    <span className="font-bold font-mono text-slate-900">
                                      <Money amount={o.amount} />
                                    </span>
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-white border border-slate-200 text-slate-700">
                                      {o.label}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Заказ-наряды на ремонт */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                      <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-rose-600">
                            build
                          </span>
                          <span>ЗАКАЗ-НАРЯДЫ НА РЕМОНТ ИЗ РАЗДЕЛА ГАРАЖ</span>
                        </span>
                        <span className="text-[11px] text-slate-400 font-normal">
                          Всего нарядов: {(v.serviceOrders || []).length}
                        </span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {(v.serviceOrders || []).length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400">
                            Ремонтов и заказ-нарядов за данный период не зафиксировано
                          </div>
                        ) : (
                          v.serviceOrders.map((s) => (
                            <div
                              key={s.id}
                              className="p-3.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4 text-xs"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 font-mono font-bold rounded border border-rose-200 text-[11px]">
                                    НЗ-{s.number}
                                  </span>
                                  <span className="font-bold text-slate-900">{s.desc}</span>
                                  <span className="text-slate-400 text-[11px]">{s.date}</span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  Исполнитель: {s.contractor}
                                </p>
                              </div>
                              <div className="flex items-center gap-4 text-xs font-mono font-bold shrink-0">
                                <span className="text-slate-600">
                                  Запчасти: <Money amount={s.parts} />
                                </span>
                                <span className="text-slate-600">
                                  Работы: <Money amount={s.works} />
                                </span>
                                <span className="text-rose-600">
                                  Итого: <Money amount={s.parts + s.works} />
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL: ALL DOCS SHAHMATKA ───────────────────────────────────── */}
      {isAllDocsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div>
                <h2 className="text-lg font-black flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400">checklist</span>
                  <span>Шахматка регламентов и документов автопарка</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Контроль сроков ОСАГО, техосмотра, пропусков МКАД, СКЗИ и регламента замены масла
                  по всем {allAssets.length} машинам
                </p>
              </div>
              <button
                onClick={() => setIsAllDocsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3">Машина</th>
                    <th className="p-3">Водитель</th>
                    <th className="p-3">ОСАГО</th>
                    <th className="p-3">Техосмотр (ТО)</th>
                    <th className="p-3">Пропуск Москва</th>
                    <th className="p-3">Тахограф (СКЗИ)</th>
                    <th className="p-3">Масло ДВС</th>
                    <th className="p-3 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allAssets.map((v) => {
                    const d = v.docs || {};
                    const insDays = getDaysUntil(d.insurance_expires_at);
                    const inspDays = getDaysUntil(d.inspection_expires_at);
                    const moscowDays = d.moscow_pass_required
                      ? getDaysUntil(d.moscow_pass_expires_at)
                      : null;
                    const skziDays = getDaysUntil(d.tacho_skzi_expires_at);
                    const kmSinceOil = v.odometer_current - (d.oil_last_km || 0);
                    const kmLeftOil = (d.oil_interval_km || 10000) - kmSinceOil;

                    const getPill = (days: number | null) => {
                      if (days === null) return <span className="text-slate-300">—</span>;
                      if (days < 0)
                        return (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-bold">
                            Просрочен {Math.abs(days)}д
                          </span>
                        );
                      if (days <= 14)
                        return (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-black animate-pulse">
                            {days} дн!
                          </span>
                        );
                      if (days <= 30)
                        return (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                            {days} дн.
                          </span>
                        );
                      return (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
                          {days} дн.
                        </span>
                      );
                    };

                    const getOilPill = (kmLeft: number) => {
                      if (kmLeft < 0)
                        return (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-black">
                            +{Math.abs(kmLeft)} км перепробег
                          </span>
                        );
                      if (kmLeft <= 1000)
                        return (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                            {kmLeft} км
                          </span>
                        );
                      return (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
                          {kmLeft} км
                        </span>
                      );
                    };

                    return (
                      <tr key={v.id} className="hover:bg-slate-50/80">
                        <td className="p-3 font-black text-slate-900">
                          {v.short_name}
                          <span className="font-mono text-[10px] text-slate-400 block font-normal">
                            {v.reg_number}
                          </span>
                        </td>
                        <td className="p-3 text-slate-700 font-medium">{v.driver?.name || '—'}</td>
                        <td className="p-3">{getPill(insDays)}</td>
                        <td className="p-3">{getPill(inspDays)}</td>
                        <td className="p-3">
                          {d.moscow_pass_required ? (
                            getPill(moscowDays)
                          ) : (
                            <span className="text-slate-400 text-[10px]">Не треб.</span>
                          )}
                        </td>
                        <td className="p-3">{getPill(skziDays)}</td>
                        <td className="p-3">{getOilPill(kmLeftOil)}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => {
                              setIsAllDocsModalOpen(false);
                              setEditingAsset(v);
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] transition"
                          >
                            Изменить
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setIsAllDocsModalOpen(false)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
              >
                Закрыть шахматку
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT VEHICLE & REGULATIONS ───────────────────────────── */}
      {editingAsset !== null && (
        <VehicleEditModal
          asset={editingAsset === 'new' ? null : editingAsset}
          assetTypes={data?.assetTypes ?? []}
          drivers={drivers}
          onClose={() => setEditingAsset(null)}
          onSaved={() => {
            setEditingAsset(null);
            qc.invalidateQueries({ queryKey: ['fleet-matrix'] });
          }}
        />
      )}
    </div>
  );
}

// ─── Modal Component for Editing Vehicle & Regulations ───────────────────────

function VehicleEditModal({
  asset,
  assetTypes,
  drivers,
  onClose,
  onSaved,
}: {
  asset: Asset | null;
  assetTypes: AssetType[];
  drivers: Driver[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    short_name: asset?.short_name ?? '',
    reg_number: asset?.reg_number ?? '',
    asset_type_id: asset?.asset_type?.id ?? '',
    year: asset?.year?.toString() ?? '',
    status: asset?.status ?? 'active',
    odometer_current: asset?.odometer_current?.toString() ?? '0',
    assigned_driver_id:
      asset?.driver?.id && drivers.some((d) => d.id === asset.driver?.id) ? asset.driver.id : '',
    current_book_value: asset?.current_book_value ?? '',
    remaining_depreciation_months: asset?.remaining_depreciation_months?.toString() ?? '',
    monthly_fixed_cost: asset?.monthly_fixed_cost ?? '',
    notes: asset?.notes ?? '',
    // Documents
    insurance_expires_at: asset?.docs?.insurance_expires_at ?? '',
    insurance_policy: asset?.docs?.insurance_policy ?? '',
    inspection_expires_at: asset?.docs?.inspection_expires_at ?? '',
    inspection_number: asset?.docs?.inspection_number ?? '',
    moscow_pass_required: asset?.docs?.moscow_pass_required ?? false,
    moscow_pass_zone: asset?.docs?.moscow_pass_zone ?? 'МКАД (круглосуточный)',
    moscow_pass_expires_at: asset?.docs?.moscow_pass_expires_at ?? '',
    moscow_pass_number: asset?.docs?.moscow_pass_number ?? '',
    tacho_model: asset?.docs?.tacho_model ?? '',
    tacho_skzi_expires_at: asset?.docs?.tacho_skzi_expires_at ?? '',
    tacho_calibration_expires_at: asset?.docs?.tacho_calibration_expires_at ?? '',
    oil_last_date: asset?.docs?.oil_last_date ?? '',
    oil_last_km: asset?.docs?.oil_last_km?.toString() ?? '',
    oil_interval_km: asset?.docs?.oil_interval_km?.toString() ?? '10000',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const f =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const val =
        e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
      setForm((p) => ({ ...p, [k]: val }));
    };

  const handleSave = async () => {
    if (!form.short_name.trim() || !form.reg_number.trim() || !form.asset_type_id) {
      setError('Название, госномер и тип — обязательны');
      return;
    }

    setSaving(true);
    setError('');

    const docsPayload = {
      insurance_expires_at: form.insurance_expires_at || null,
      insurance_policy: form.insurance_policy || '',
      inspection_expires_at: form.inspection_expires_at || null,
      inspection_number: form.inspection_number || '',
      moscow_pass_required: Boolean(form.moscow_pass_required),
      moscow_pass_zone: form.moscow_pass_zone || '',
      moscow_pass_expires_at: form.moscow_pass_expires_at || null,
      moscow_pass_number: form.moscow_pass_number || '',
      tacho_model: form.tacho_model || '',
      tacho_skzi_expires_at: form.tacho_skzi_expires_at || null,
      tacho_calibration_expires_at: form.tacho_calibration_expires_at || null,
      oil_last_date: form.oil_last_date || null,
      oil_last_km: form.oil_last_km ? parseInt(form.oil_last_km) : 0,
      oil_interval_km: form.oil_interval_km ? parseInt(form.oil_interval_km) : 10000,
    };

    const payload = {
      short_name: form.short_name,
      reg_number: form.reg_number,
      asset_type_id: form.asset_type_id,
      year: form.year ? parseInt(form.year) : null,
      status: form.status,
      odometer_current: form.odometer_current ? parseInt(form.odometer_current) : 0,
      assigned_driver_id: form.assigned_driver_id || null,
      current_book_value: form.current_book_value
        ? parseFloat(form.current_book_value).toFixed(2)
        : '0.00',
      remaining_depreciation_months: form.remaining_depreciation_months
        ? parseInt(form.remaining_depreciation_months)
        : null,
      monthly_fixed_cost: form.monthly_fixed_cost
        ? parseFloat(form.monthly_fixed_cost).toFixed(2)
        : '0.00',
      notes: form.notes,
      docs: docsPayload,
    };

    const url = asset ? `/api/fleet/${asset.id}` : '/api/fleet';
    const method = asset ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      setSaving(false);
      if (!res.ok) {
        setError(json.error ?? 'Ошибка сохранения');
        return;
      }
      onSaved();
    } catch (e: unknown) {
      setSaving(false);
      setError(e instanceof Error ? e.message : 'Ошибка сети');
    }
  };

  const inputCls =
    'w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-medium';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div>
            <h2 className="text-base font-black">
              {asset
                ? `Редактирование: ${asset.short_name} (${asset.reg_number})`
                : 'Добавить новую машину в автопарк'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Параметры автомобиля, привязка водителя и регламенты техобслуживания
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* 1. Основные параметры машины */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider flex items-center gap-1.5 text-emerald-700">
              <span className="material-symbols-outlined text-[14px]">directions_car</span>
              <span>1. Основные параметры</span>
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-500 block mb-1">Название машины *</label>
                <input
                  className={inputCls}
                  placeholder="Валдай Самосвал 318"
                  value={form.short_name}
                  onChange={f('short_name')}
                />
              </div>
              <div>
                <label className="text-slate-500 block mb-1">Госномер *</label>
                <input
                  className={inputCls}
                  placeholder="С318ТХ 96"
                  value={form.reg_number}
                  onChange={f('reg_number')}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-slate-500 block mb-1">Тип машины *</label>
                <select
                  className={inputCls}
                  value={form.asset_type_id}
                  onChange={f('asset_type_id')}
                >
                  <option value="">— выберите тип —</option>
                  {assetTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-500 block mb-1">Статус</label>
                <select className={inputCls} value={form.status} onChange={f('status')}>
                  <option value="active">Активна</option>
                  <option value="repair">В ремонте</option>
                  <option value="reserve">Резерв</option>
                  <option value="sold">Продана</option>
                  <option value="written_off">Списана</option>
                </select>
              </div>
              <div>
                <label className="text-slate-500 block mb-1">Назначенный водитель</label>
                <select
                  className={inputCls}
                  value={form.assigned_driver_id}
                  onChange={f('assigned_driver_id')}
                >
                  <option value="">— не назначен —</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-500 block mb-1">Текущий одометр (км)</label>
                <input
                  type="number"
                  className={inputCls}
                  placeholder="165000"
                  value={form.odometer_current}
                  onChange={f('odometer_current')}
                />
              </div>
              <div>
                <label className="text-slate-500 block mb-1">Год выпуска</label>
                <input
                  type="number"
                  className={inputCls}
                  placeholder="2018"
                  value={form.year}
                  onChange={f('year')}
                />
              </div>
            </div>
          </div>

          {/* 2. Документы: ОСАГО и ТО */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider flex items-center gap-1.5 text-blue-700">
              <span className="material-symbols-outlined text-[14px]">verified_user</span>
              <span>2. ОСАГО и Техосмотр (ТО)</span>
            </h3>
            <div className="grid grid-cols-2 gap-3 bg-blue-50/40 p-3.5 rounded-2xl border border-blue-100">
              <div>
                <label className="text-slate-500 block mb-1 font-bold">ОСАГО действует до</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.insurance_expires_at}
                  onChange={f('insurance_expires_at')}
                />
                <input
                  className={cn(inputCls, 'mt-1.5')}
                  placeholder="Номер полиса и страховая"
                  value={form.insurance_policy}
                  onChange={f('insurance_policy')}
                />
              </div>
              <div>
                <label className="text-slate-500 block mb-1 font-bold">
                  Техосмотр (ТО) действует до
                </label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.inspection_expires_at}
                  onChange={f('inspection_expires_at')}
                />
                <input
                  className={cn(inputCls, 'mt-1.5')}
                  placeholder="Номер диагностической карты"
                  value={form.inspection_number}
                  onChange={f('inspection_number')}
                />
              </div>
            </div>
          </div>

          {/* 3. Пропуск Москва & Тахограф */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider flex items-center gap-1.5 text-purple-700">
              <span className="material-symbols-outlined text-[14px]">local_police</span>
              <span>3. Пропуск в Москву & Тахограф (СКЗИ)</span>
            </h3>
            <div className="grid grid-cols-2 gap-3 bg-purple-50/40 p-3.5 rounded-2xl border border-purple-100">
              {/* Пропуск Москва */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={form.moscow_pass_required}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, moscow_pass_required: e.target.checked }))
                    }
                    className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                  />
                  <span>Требуется пропуск в Москву</span>
                </label>
                {form.moscow_pass_required && (
                  <div className="space-y-1.5 animate-in fade-in">
                    <input
                      type="date"
                      className={inputCls}
                      value={form.moscow_pass_expires_at}
                      onChange={f('moscow_pass_expires_at')}
                    />
                    <input
                      className={inputCls}
                      placeholder="Зона (МКАД, ТТК)"
                      value={form.moscow_pass_zone}
                      onChange={f('moscow_pass_zone')}
                    />
                    <input
                      className={inputCls}
                      placeholder="Номер пропуска РНИС"
                      value={form.moscow_pass_number}
                      onChange={f('moscow_pass_number')}
                    />
                  </div>
                )}
              </div>

              {/* Тахограф */}
              <div className="space-y-1.5">
                <label className="text-slate-500 block font-bold">
                  Тахограф (СКЗИ / Калибровка)
                </label>
                <input
                  type="date"
                  className={inputCls}
                  placeholder="Срок СКЗИ"
                  value={form.tacho_skzi_expires_at}
                  onChange={f('tacho_skzi_expires_at')}
                />
                <input
                  className={inputCls}
                  placeholder="Модель тахографа (Атол / Штрих)"
                  value={form.tacho_model}
                  onChange={f('tacho_model')}
                />
              </div>
            </div>
          </div>

          {/* 4. Масло ДВС и Регламент Гаража */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider flex items-center gap-1.5 text-amber-700">
              <span className="material-symbols-outlined text-[14px]">oil_barrel</span>
              <span>4. Регламент замены масла ДВС</span>
            </h3>
            <div className="grid grid-cols-3 gap-3 bg-amber-50/40 p-3.5 rounded-2xl border border-amber-100">
              <div>
                <label className="text-slate-500 block mb-1">Дата последней замены</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.oil_last_date}
                  onChange={f('oil_last_date')}
                />
              </div>
              <div>
                <label className="text-slate-500 block mb-1">Пробег при замене (км)</label>
                <input
                  type="number"
                  className={inputCls}
                  placeholder="156000"
                  value={form.oil_last_km}
                  onChange={f('oil_last_km')}
                />
              </div>
              <div>
                <label className="text-slate-500 block mb-1">Интервал замены (км)</label>
                <input
                  type="number"
                  className={inputCls}
                  placeholder="10000"
                  value={form.oil_interval_km}
                  onChange={f('oil_interval_km')}
                />
              </div>
            </div>
          </div>

          {/* 5. Дополнительные примечания */}
          <div className="pt-2">
            <label className="text-slate-500 block mb-1">Примечание</label>
            <textarea
              className={cn(inputCls, 'resize-none')}
              rows={2}
              placeholder="Особые отметки, договоренности или напоминания"
              value={form.notes}
              onChange={f('notes')}
            />
          </div>

          {error && (
            <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
              {error}
            </p>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl font-bold transition"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition shadow-xs disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>
      </div>
    </div>
  );
}
