'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@saldacargo/ui';
import { ClientsSection } from '@/features/garage/clients/ClientsSection';
import { MaintenanceSection } from '@/features/garage/maintenance/MaintenanceSection';
import { CreateOrderModal } from '@/features/garage/orders/CreateOrderModal';
import { GarageMetricsBar, type GarageTab } from '@/features/garage/orders/GarageMetricsBar';
import { GarageOrdersTab } from '@/features/garage/orders/GarageOrdersTab';
import { OrderDetailModal } from '@/features/garage/orders/detail/OrderDetailModal';
import { DatePeriodNav } from '@/features/garage/settings/DatePeriodNav';
import { SettingsModal } from '@/features/garage/settings/SettingsModal';
import type { Asset, MaintenanceItem, Mechanic, TabOrder } from '@/features/garage/types';
import { getArchiveWeekDates, todayStr } from '@/features/garage/utils';
import { WarehouseSection } from './warehouse-section';

function resolveInitialTab(tabFromQuery: string | null): GarageTab {
  if (
    tabFromQuery === 'warehouse' ||
    tabFromQuery === 'clients' ||
    tabFromQuery === 'archive' ||
    tabFromQuery === 'pending_payment' ||
    tabFromQuery === 'maintenance'
  ) {
    return tabFromQuery;
  }
  return 'active';
}

export default function GaragePage() {
  const searchParams = useSearchParams();
  const orderFromQuery =
    searchParams.get('order') || searchParams.get('order_id') || searchParams.get('id');
  const tabFromQuery = searchParams.get('tab');

  const [activeTab, setActiveTab] = useState<GarageTab>(() => resolveInitialTab(tabFromQuery));
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [manualSelectedOrderId, setManualSelectedOrderId] = useState<string | null>(null);
  const [dismissedQueryOrderId, setDismissedQueryOrderId] = useState<string | null>(null);

  const selectedOrderId =
    manualSelectedOrderId ??
    (orderFromQuery && orderFromQuery !== dismissedQueryOrderId ? orderFromQuery : null);

  const handleCloseOrderModal = () => {
    setManualSelectedOrderId(null);
    if (orderFromQuery) setDismissedQueryOrderId(orderFromQuery);
  };

  // Фильтры и навигация по дням, неделям, месяцам
  const [period, setPeriod] = useState<'all' | 'day' | 'week' | 'month'>('all');
  const [periodDate, setPeriodDate] = useState(todayStr());
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'own' | 'client'>('all');

  const qc = useQueryClient();

  // Queries
  const { data: allOrders = [], isLoading: ordersLoading } = useQuery<TabOrder[]>({
    queryKey: ['garage-orders', 'all'],
    queryFn: () =>
      fetch('/api/garage/orders?filter=all')
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['assets-select'],
    queryFn: () => fetch('/api/garage/assets').then((r) => r.json()),
    staleTime: 300000,
  });

  const { data: mechanics = [] } = useQuery<Mechanic[]>({
    queryKey: ['mechanics-list'],
    queryFn: () => fetch('/api/users?role=mechanic').then((r) => r.json()),
    staleTime: 300000,
  });

  const { data: partsData } = useQuery<{ totals?: { totalStockVal: number } }>({
    queryKey: ['garage-parts', 'all', ''],
    queryFn: () => fetch('/api/garage/parts').then((r) => r.json()),
    staleTime: 60000,
  });

  const { data: clientsData = [] } = useQuery<unknown[]>({
    queryKey: ['garage-clients'],
    queryFn: () =>
      fetch('/api/garage/clients')
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
    staleTime: 60000,
  });

  const { data: maintenanceItems = [] } = useQuery<MaintenanceItem[]>({
    queryKey: ['garage-maintenance'],
    queryFn: () =>
      fetch('/api/garage/maintenance')
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
    staleTime: 60000,
  });

  // 1. В РАБОТЕ: не закрытые и не отменённые
  const activeOrders = useMemo(() => {
    return allOrders.filter((o) => {
      const isCancelled = o.lifecycle_status === 'cancelled' || o.status === 'cancelled';
      if (isCancelled) return false;
      if (o.lifecycle_status === 'approved') return false;
      return true;
    });
  }, [allOrders]);

  // 2. ЖДУТ ОПЛАТЫ: клиентские наряды, работы завершены, оплаты нет
  const pendingPaymentOrders = useMemo(() => {
    return allOrders.filter((o) => {
      const isCancelled = o.lifecycle_status === 'cancelled' || o.status === 'cancelled';
      if (isCancelled) return false;
      return (
        o.machine_type === 'client' &&
        !o.payment_received &&
        (o.status === 'completed' || o.lifecycle_status === 'approved')
      );
    });
  }, [allOrders]);

  // 3. АРХИВ: оплаченные клиентские, завершённые свои и отменённые
  const archiveOrders = useMemo(() => {
    return allOrders.filter((o) => {
      const isCancelled = o.lifecycle_status === 'cancelled' || o.status === 'cancelled';
      if (isCancelled) return true;
      if (o.machine_type === 'own') {
        return o.lifecycle_status === 'approved';
      }
      if (o.machine_type === 'client') {
        return (
          o.payment_received === true || (o.lifecycle_status === 'approved' && o.payment_received)
        );
      }
      return false;
    });
  }, [allOrders]);

  // Фильтрация пула по типу авто, поиску и периоду
  const filterByDateAndSearch = useCallback(
    (list: TabOrder[]) => {
      let res = list;
      if (filterType !== 'all') {
        res = res.filter((o) => o.machine_type === filterType);
      }

      const getOrderDate = (o: TabOrder) => o.completed_at || o.effective_date || o.created_at;

      if (period === 'day') {
        res = res.filter((o) => getOrderDate(o)?.startsWith(periodDate));
      } else if (period === 'week') {
        const { weekStart, weekEnd } = getArchiveWeekDates(periodDate);
        res = res.filter((o) => {
          const d = getOrderDate(o)?.slice(0, 10);
          return d && d >= weekStart && d <= weekEnd;
        });
      } else if (period === 'month') {
        const mPrefix = periodDate.slice(0, 7);
        res = res.filter((o) => getOrderDate(o)?.startsWith(mPrefix));
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        res = res.filter(
          (o) =>
            o.order_number?.toString().includes(q) ||
            o.asset?.short_name?.toLowerCase().includes(q) ||
            o.asset?.reg_number?.toLowerCase().includes(q) ||
            o.client_vehicle_brand?.toLowerCase().includes(q) ||
            o.client_vehicle_reg?.toLowerCase().includes(q) ||
            o.mechanic?.name?.toLowerCase().includes(q) ||
            o.problem_description?.toLowerCase().includes(q),
        );
      }

      return res;
    },
    [filterType, period, periodDate, search],
  );

  const filteredActiveOrders = useMemo(
    () => filterByDateAndSearch(activeOrders),
    [activeOrders, filterByDateAndSearch],
  );
  const filteredPendingOrders = useMemo(
    () => filterByDateAndSearch(pendingPaymentOrders),
    [pendingPaymentOrders, filterByDateAndSearch],
  );
  const filteredArchiveOrders = useMemo(
    () => filterByDateAndSearch(archiveOrders),
    [archiveOrders, filterByDateAndSearch],
  );

  // Counts for badges & summary
  const inWorkCount = activeOrders.length;
  const pendingPaymentCount = pendingPaymentOrders.length;
  const archiveCount = archiveOrders.length;
  const maintenanceAlertsCount = maintenanceItems.filter(
    (item) => item.alert_status === 'overdue' || item.alert_status === 'soon',
  ).length;

  const totalPendingPaymentSum = useMemo(() => {
    return pendingPaymentOrders.reduce((sum, o) => {
      const worksSum = (o.works ?? []).reduce(
        (s, w) => s + (parseFloat(w.price_client ?? '0') || 0),
        0,
      );
      const partsSum = (o.parts ?? []).reduce(
        (s, p) => s + (parseFloat(p.client_price ?? p.unit_price ?? '0') || 0) * (p.quantity || 1),
        0,
      );
      return sum + worksSum + partsSum;
    }, 0);
  }, [pendingPaymentOrders]);

  const totalWarehouseVal = partsData?.totals?.totalStockVal ?? 405000;
  const ownActiveCount = activeOrders.filter((o) => o.machine_type === 'own').length;
  const clientActiveCount = activeOrders.filter((o) => o.machine_type === 'client').length;

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* 1. ВЕРХНЯЯ ШАПКА УПРАВЛЕНИЯ */}
      <header className="bg-white border border-sky-100 rounded-2xl px-5 py-3.5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-emerald-400 flex items-center justify-center text-xl shadow-xs shrink-0 text-white">
            🛠️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Гараж и СТО
              </h1>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Свой парк + Клиенты
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Управление заказ-нарядами, складом запчастей и обслуживанием автопарка
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => setShowSettings(true)}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            title="Настройки ставок СТО и % зарплат"
          >
            <span>⚙️</span>
            <span className="hidden md:inline">Ставки нормо-часа</span>
          </button>

          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <span>➕</span>
            <span>Новый заказ-наряд</span>
          </button>
        </div>
      </header>

      {/* 2. СВОДНЫЕ МЕТРИКИ СВЕРХУ */}
      <GarageMetricsBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        inWorkCount={inWorkCount}
        ownActiveCount={ownActiveCount}
        clientActiveCount={clientActiveCount}
        pendingPaymentCount={pendingPaymentCount}
        totalPendingPaymentSum={totalPendingPaymentSum}
        archiveCount={archiveCount}
        totalWarehouseVal={totalWarehouseVal}
        clientsCount={clientsData.length}
      />

      {/* 3. ВКЛАДКИ НАВИГАЦИИ */}
      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200/80 pb-2">
        <div className="flex flex-wrap gap-1 bg-slate-100/90 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('active')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
              activeTab === 'active'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <span>🔧</span>
            <span>В работе</span>
            {inWorkCount > 0 && (
              <span className="bg-sky-500 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {inWorkCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('pending_payment')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
              activeTab === 'pending_payment'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <span>💳</span>
            <span>Ждут оплаты</span>
            {pendingPaymentCount > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {pendingPaymentCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('archive')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
              activeTab === 'archive'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <span>📚</span>
            <span>Архив</span>
            {archiveCount > 0 && (
              <span className="bg-emerald-500 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {archiveCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('warehouse')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
              activeTab === 'warehouse'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <span>📦</span>
            <span>Склад запчастей</span>
          </button>

          <button
            onClick={() => setActiveTab('clients')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
              activeTab === 'clients'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <span>👥</span>
            <span>Клиенты СТО</span>
            {clientsData.length > 0 && (
              <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {clientsData.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('maintenance')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
              activeTab === 'maintenance'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <span>🛢️</span>
            <span>Регламенты ТО</span>
            {maintenanceAlertsCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {maintenanceAlertsCount}
              </span>
            )}
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs">
          <span className="text-slate-400">Приёмка работ и зарплаты:</span>
          <a
            href="/review"
            className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1"
          >
            <span>👁️</span>
            <span>Ревью (Механики) ↗</span>
          </a>
        </div>
      </div>

      {/* НАВИГАЦИЯ ПО ДНЯМ, НЕДЕЛЯМ, МЕСЯЦАМ */}
      {(activeTab === 'active' || activeTab === 'pending_payment' || activeTab === 'archive') && (
        <DatePeriodNav
          period={period}
          setPeriod={setPeriod}
          date={periodDate}
          setDate={setPeriodDate}
        />
      )}

      {/* 4. СОДЕРЖИМОЕ АКТИВНОЙ ВКЛАДКИ */}
      {(activeTab === 'active' || activeTab === 'pending_payment' || activeTab === 'archive') && (
        <GarageOrdersTab
          activeTab={activeTab}
          ordersLoading={ordersLoading}
          filteredActiveOrders={filteredActiveOrders}
          filteredPendingOrders={filteredPendingOrders}
          filteredArchiveOrders={filteredArchiveOrders}
          totalPendingPaymentSum={totalPendingPaymentSum}
          search={search}
          setSearch={setSearch}
          filterType={filterType}
          setFilterType={setFilterType}
          onSelectOrder={(id) => setManualSelectedOrderId(id)}
        />
      )}

      {activeTab === 'warehouse' && <WarehouseSection />}
      {activeTab === 'clients' && <ClientsSection />}
      {activeTab === 'maintenance' && <MaintenanceSection />}

      {/* 5. МОДАЛЬНЫЕ ОКНА */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {showCreate && (
        <CreateOrderModal
          onClose={() => setShowCreate(false)}
          assets={assets}
          mechanics={mechanics}
          onCreated={(id) => {
            qc.invalidateQueries({ queryKey: ['garage-orders'] });
            setShowCreate(false);
            setManualSelectedOrderId(id);
          }}
        />
      )}

      {selectedOrderId && (
        <OrderDetailModal
          orderId={selectedOrderId}
          onClose={handleCloseOrderModal}
          mechanics={mechanics}
        />
      )}
    </div>
  );
}
