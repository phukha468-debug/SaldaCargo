'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { cn } from '@saldacargo/ui';
import { TripEditModal } from '@/features/review/trip-card/TripEditModal';
import type {
  ReviewServiceOrder,
  ReviewServiceOrderWork,
  SettlementTransactionItem,
  TripForReview,
} from '@/features/review/types';
import { getWeekDates } from '@/features/review/utils';
import {
  aggregateFleetStats,
  computeGarageSummary,
  isRelevantFleetServiceOrder,
  type VehicleAssetGroup,
} from '@/features/review/fleetAggregation';
import { DateNav } from '@/features/review/DateNav';
import { MaintenanceDetailModal } from '@/features/review/MaintenanceDetailModal';
import { GarageOrderRow } from '@/features/review/garage-order/GarageOrderRow';
import { GarageOrderEditModal } from '@/features/review/garage-order/GarageOrderEditModal';
import { GarageWorkEditModal } from '@/features/review/garage-order/GarageWorkEditModal';
import { ReviewStatsCards } from '@/features/review/ReviewStatsCards';
import { VehicleGroupCard } from '@/features/review/VehicleGroupCard';

const VALID_MODES: Array<'review' | 'active' | 'history'> = ['review', 'active', 'history'];

export default function ReviewPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMaintenanceGroup, setSelectedMaintenanceGroup] =
    useState<VehicleAssetGroup | null>(null);

  const searchParams = useSearchParams();
  const modeFromUrl = searchParams.get('mode') as 'review' | 'active' | 'history' | null;
  const tripFromUrl =
    searchParams.get('trip') ||
    searchParams.get('trip_id') ||
    searchParams.get('trip_number') ||
    searchParams.get('id');

  const [mode, setMode] = useState<'review' | 'active' | 'history'>(
    modeFromUrl && VALID_MODES.includes(modeFromUrl)
      ? modeFromUrl
      : tripFromUrl
        ? 'history'
        : 'review',
  );
  const [reviewSection, setReviewSection] = useState<'auto' | 'garage'>(
    searchParams.get('section') === 'garage' ? 'garage' : 'auto',
  );
  const [garageMachineFilter, setGarageMachineFilter] = useState<'all' | 'client' | 'own'>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedGarageOrderIds, setExpandedGarageOrderIds] = useState<Set<string>>(new Set());
  const [openTripsSpoilers, setOpenTripsSpoilers] = useState<Set<string>>(new Set());
  const [openOrdersSpoilers, setOpenOrdersSpoilers] = useState<Set<string>>(new Set());

  const [editTrip, setEditTrip] = useState<TripForReview | null>(null);
  const [editServiceOrder, setEditServiceOrder] = useState<ReviewServiceOrder | null>(null);
  const [editServiceWork, setEditServiceWork] = useState<{
    order: ReviewServiceOrder;
    work: ReviewServiceOrderWork;
  } | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statsPeriod, setStatsPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [tripSearch, setTripSearch] = useState('');
  const searchTripNumber = tripSearch.trim().replace(/[^0-9]/g, '');

  const queryClient = useQueryClient();

  const toggleInSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const { data: fleetVehicles = [] } = useQuery({
    queryKey: ['fleet-assets-review'],
    queryFn: () =>
      fetch('/api/fleet')
        .then((r) => r.json())
        .then((data) => (Array.isArray(data) ? data : data?.assets || []))
        .catch(() => []),
    staleTime: 120000,
  });
  const { data: staffDrivers = [] } = useQuery({
    queryKey: ['drivers-review'],
    queryFn: () =>
      fetch('/api/users?role=driver')
        .then((r) => r.json())
        .then((data) => (Array.isArray(data) ? data : []))
        .catch(() => []),
    staleTime: 120000,
  });
  const { data: counterpartiesList = [] } = useQuery({
    queryKey: ['counterparties-active-review'],
    queryFn: () =>
      fetch('/api/counterparties?active=1')
        .then((r) => r.json())
        .then((data) => (Array.isArray(data) ? data : []))
        .catch(() => []),
    staleTime: 120000,
  });

  const { data: searchTrips = [], isLoading: isSearchLoading } = useQuery<TripForReview[]>({
    queryKey: ['trips-search', searchTripNumber],
    enabled: mode === 'history' && searchTripNumber.length > 0,
    staleTime: 30000,
    queryFn: async () => {
      const res = await fetch(`/api/trips?trip_number=${searchTripNumber}`);
      if (!res.ok) throw new Error('Ошибка поиска рейса');
      return res.json();
    },
  });

  const handleTripSearchChange = (val: string) => {
    setTripSearch(val);
    if (val.trim().replace(/[^0-9]/g, '').length > 0 && reviewSection !== 'auto') {
      setReviewSection('auto');
    }
  };

  const searchAutoExpand = useMemo(() => {
    const groupKeys = new Set<string>();
    const tripIds = new Set<string>();
    if (mode === 'history' && searchTripNumber && searchTrips.length > 0) {
      searchTrips.forEach((t) => {
        const isPrr = t.asset?.reg_number === 'БЕЗ АВТО';
        const key = isPrr
          ? '👷 ПРР (без авто)'
          : t.asset
            ? `${t.asset.short_name} (${t.asset.reg_number})`
            : 'Без машины';
        groupKeys.add(key);
        tripIds.add(t.id);
      });
    }
    return { groupKeys, tripIds };
  }, [mode, searchTripNumber, searchTrips]);

  useEffect(() => {
    if (!tripFromUrl) return;
    let isMounted = true;
    fetch(`/api/trips/${tripFromUrl}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: TripForReview | null) => {
        if (!isMounted || !data) return;
        setEditTrip(data);
        if (data.started_at) setSelectedDate(data.started_at.slice(0, 10));
        setMode(data.lifecycle_status === 'draft' ? 'review' : 'history');
        setExpandedIds((prev) => new Set([...prev, data.id]));
      })
      .catch((e) => console.error('Error fetching trip from URL:', e));
    return () => {
      isMounted = false;
    };
  }, [tripFromUrl]);

  const { data: trips = [], isLoading } = useQuery<TripForReview[]>({
    queryKey: ['trips-review', selectedDate, mode],
    staleTime: 60000,
    queryFn: async () => {
      if (mode === 'active') {
        const res = await fetch('/api/trips?status=in_progress&lifecycle=draft');
        if (!res.ok) throw new Error('Ошибка загрузки');
        return res.json();
      }
      const lifecycle = mode === 'review' ? 'draft' : 'approved';
      const url =
        mode === 'review'
          ? `/api/trips?lifecycle=${lifecycle}`
          : `/api/trips?lifecycle=${lifecycle}&date=${selectedDate}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
  });

  const monthKey = selectedDate.slice(0, 7);
  const { weekStart, weekEnd } = getWeekDates(selectedDate);

  const { data: monthTrips = [] } = useQuery<TripForReview[]>({
    queryKey: ['trips-month', monthKey],
    enabled: mode === 'history' && statsPeriod === 'month',
    staleTime: 120000,
    queryFn: async () => {
      const res = await fetch(`/api/trips?lifecycle=approved&month=${monthKey}`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
  });

  const { data: weekTrips = [] } = useQuery<TripForReview[]>({
    queryKey: ['trips-week', weekStart, weekEnd],
    enabled: mode === 'history' && statsPeriod === 'week',
    staleTime: 120000,
    queryFn: async () => {
      const res = await fetch(
        `/api/trips?lifecycle=approved&weekStart=${weekStart}&weekEnd=${weekEnd}`,
      );
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
  });

  const { data: dayServiceOrders = [] } = useQuery<ReviewServiceOrder[]>({
    queryKey: ['service-orders-day', selectedDate],
    enabled: mode === 'history' && statsPeriod === 'day',
    staleTime: 60000,
    queryFn: async () => {
      const res = await fetch(
        `/api/garage/orders?filter=history&machine_type=own&date=${selectedDate}`,
      );
      return res.ok ? res.json() : [];
    },
  });

  const { data: monthServiceOrders = [] } = useQuery<ReviewServiceOrder[]>({
    queryKey: ['service-orders-month', monthKey],
    enabled: mode === 'history' && statsPeriod === 'month',
    staleTime: 120000,
    queryFn: async () => {
      const res = await fetch(
        `/api/garage/orders?filter=history&machine_type=own&month=${monthKey}`,
      );
      return res.ok ? res.json() : [];
    },
  });

  const { data: weekServiceOrders = [] } = useQuery<ReviewServiceOrder[]>({
    queryKey: ['service-orders-week', weekStart, weekEnd],
    enabled: mode === 'history' && statsPeriod === 'week',
    staleTime: 120000,
    queryFn: async () => {
      const res = await fetch(
        `/api/garage/orders?filter=history&machine_type=own&weekStart=${weekStart}&weekEnd=${weekEnd}`,
      );
      return res.ok ? res.json() : [];
    },
  });

  const periodQueryKey =
    statsPeriod === 'day'
      ? selectedDate
      : statsPeriod === 'week'
        ? `${weekStart}_${weekEnd}`
        : monthKey;

  const { data: periodSettlementsData } = useQuery<{
    settlements: SettlementTransactionItem[];
    totalAmount: number;
  }>({
    queryKey: ['receivable-settlements', statsPeriod, periodQueryKey],
    enabled: mode === 'history',
    staleTime: 60000,
    queryFn: async () => {
      let url = '/api/receivables/settlements';
      if (statsPeriod === 'day') url += `?date=${selectedDate}`;
      else if (statsPeriod === 'week') url += `?weekStart=${weekStart}&weekEnd=${weekEnd}`;
      else url += `?month=${monthKey}`;
      const res = await fetch(url);
      return res.ok ? res.json() : { settlements: [], totalAmount: 0 };
    },
  });

  const { data: garageOrders = [], isLoading: isGarageLoading } = useQuery<ReviewServiceOrder[]>({
    queryKey: ['garage-review-orders', mode, statsPeriod, periodQueryKey],
    staleTime: 30000,
    queryFn: async () => {
      if (mode === 'review') {
        const res = await fetch('/api/garage/orders?filter=review');
        return res.ok ? res.json() : [];
      }
      if (mode === 'active') {
        const res = await fetch('/api/garage/orders?filter=active');
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data)
          ? data.filter((o: ReviewServiceOrder) => o.status !== 'completed')
          : [];
      }
      let url = '/api/garage/orders?filter=history';
      if (statsPeriod === 'day') url += `&date=${selectedDate}`;
      else if (statsPeriod === 'week') url += `&weekStart=${weekStart}&weekEnd=${weekEnd}`;
      else url += `&month=${monthKey}`;
      const res = await fetch(url);
      return res.ok ? res.json() : [];
    },
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['trips-review'], refetchType: 'all' }),
      queryClient.invalidateQueries({ queryKey: ['trips-week'], refetchType: 'all' }),
      queryClient.invalidateQueries({ queryKey: ['trips-month'], refetchType: 'all' }),
      queryClient.invalidateQueries({ queryKey: ['service-orders-day'], refetchType: 'all' }),
      queryClient.invalidateQueries({ queryKey: ['service-orders-week'], refetchType: 'all' }),
      queryClient.invalidateQueries({ queryKey: ['service-orders-month'], refetchType: 'all' }),
      queryClient.invalidateQueries({ queryKey: ['receivable-settlements'], refetchType: 'all' }),
      queryClient.invalidateQueries({ queryKey: ['garage-review-orders'], refetchType: 'all' }),
    ]);
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['trips-review'] }),
      queryClient.refetchQueries({ queryKey: ['trips-week'] }),
      queryClient.refetchQueries({ queryKey: ['trips-month'] }),
      queryClient.refetchQueries({ queryKey: ['receivable-settlements'] }),
    ]);
  };

  const filteredGarageOrders = useMemo(
    () =>
      garageMachineFilter === 'all'
        ? garageOrders
        : garageOrders.filter((o) => o.machine_type === garageMachineFilter),
    [garageOrders, garageMachineFilter],
  );

  const garageSummary = useMemo(
    () => computeGarageSummary(filteredGarageOrders, garageOrders),
    [filteredGarageOrders, garageOrders],
  );

  async function runAction(
    id: string,
    setter: (v: string | null) => void,
    url: string,
    options: RequestInit,
    fallbackErr: string,
  ) {
    setter(id);
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || fallbackErr);
      }
      refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setter(null);
    }
  }

  const handleApproveServiceOrder = (
    orderId: string,
    isPartialWorkReview = false,
    workId?: string,
  ) =>
    runAction(
      orderId,
      setApprovingId,
      `/api/garage/orders/${orderId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isPartialWorkReview
            ? { action: 'approve_works', ...(workId ? { work_id: workId } : {}) }
            : { action: 'approve', lifecycle_status: 'approved' },
        ),
      },
      isPartialWorkReview ? 'Ошибка фиксации оценки работ' : 'Ошибка утверждения',
    );

  const handleApproveExternalServiceOrder = (
    orderId: string,
    externalOrg: string,
    externalTitle: string,
    externalAmount: number,
  ) =>
    runAction(
      orderId,
      setApprovingId,
      `/api/garage/orders/${orderId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_external',
          external_org: externalOrg,
          external_title: externalTitle,
          external_amount: externalAmount,
        }),
      },
      'Ошибка утверждения стороннего ремонта',
    );

  const handleReturnServiceOrder = (orderId: string) => {
    const note = prompt('Причина возврата наряда механику на доработку (необязательно):');
    if (note === null) return;
    return runAction(
      orderId,
      setApprovingId,
      `/api/garage/orders/${orderId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'return',
          lifecycle_status: 'returned',
          admin_note: note || undefined,
        }),
      },
      'Ошибка возврата',
    );
  };

  const handleDeleteServiceOrder = (orderId: string) => {
    if (!confirm('Удалить заказ-наряд и все связанные с ним начисления?')) return;
    return runAction(
      orderId,
      setDeletingId,
      `/api/garage/orders/${orderId}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
      'Ошибка удаления',
    );
  };

  const handleApprove = (tripId: string) =>
    runAction(tripId, setApprovingId, `/api/trips/${tripId}/approve`, { method: 'POST' }, 'Ошибка');

  const handleReturn = (tripId: string) => {
    if (!confirm('Вернуть рейс водителю на доработку?')) return;
    return runAction(
      tripId,
      setApprovingId,
      `/api/trips/${tripId}/return`,
      { method: 'POST' },
      'Ошибка',
    );
  };

  const handleDelete = (tripId: string) =>
    runAction(tripId, setDeletingId, `/api/trips/${tripId}`, { method: 'DELETE' }, 'Ошибка');

  const listTrips =
    mode === 'history'
      ? searchTripNumber.length > 0
        ? searchTrips
        : statsPeriod === 'day'
          ? trips
          : statsPeriod === 'week'
            ? weekTrips
            : monthTrips
      : trips;

  const listServiceOrders = useMemo(() => {
    const raw =
      mode === 'history'
        ? statsPeriod === 'day'
          ? dayServiceOrders
          : statsPeriod === 'week'
            ? weekServiceOrders
            : monthServiceOrders
        : [];
    return raw.filter(isRelevantFleetServiceOrder);
  }, [mode, statsPeriod, dayServiceOrders, weekServiceOrders, monthServiceOrders]);

  const currentPeriodEndIso = useMemo(() => {
    if (mode !== 'history') return undefined;
    if (statsPeriod === 'month') {
      const [yStr, mStr] = monthKey.split('-');
      const y = parseInt(yStr!, 10);
      const m = parseInt(mStr!, 10);
      const nextM = m === 12 ? 1 : m + 1;
      const nextY = m === 12 ? y + 1 : y;
      return `${nextY}-${String(nextM).padStart(2, '0')}-01T00:00:00.000Z`;
    }
    if (statsPeriod === 'week') return `${weekEnd}T23:59:59.999Z`;
    return `${selectedDate}T23:59:59.999Z`;
  }, [mode, statsPeriod, monthKey, weekEnd, selectedDate]);

  const fleetStats = useMemo(
    () =>
      aggregateFleetStats({
        listTrips,
        listServiceOrders,
        mode,
        currentPeriodEndIso,
        settlements: periodSettlementsData?.settlements ?? [],
      }),
    [listTrips, listServiceOrders, mode, currentPeriodEndIso, periodSettlementsData],
  );

  return (
    <div className="space-y-3 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* 1. Верхнее меню раздела */}
      <div className="bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-md border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="font-black text-sm uppercase tracking-wide text-white">
              Ревью · {reviewSection === 'auto' ? 'Авто (Водители)' : 'Гараж (Механики)'}
            </h1>
          </div>

          <div className="bg-slate-800 p-1 rounded-xl border border-slate-700 flex items-center gap-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setReviewSection('auto')}
              className={cn(
                'py-1.5 px-3 rounded-lg font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer',
                reviewSection === 'auto'
                  ? 'bg-sky-500 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60',
              )}
            >
              <span>🚚</span>
              <span>Авто (Водители)</span>
              {mode !== 'history' && trips.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none bg-sky-900 text-sky-100">
                  {trips.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setReviewSection('garage')}
              className={cn(
                'py-1.5 px-3 rounded-lg font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer',
                reviewSection === 'garage'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60',
              )}
            >
              <span>🔧</span>
              <span>Гараж (Механики)</span>
              {mode !== 'history' && garageOrders.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none bg-emerald-900 text-emerald-100">
                  {garageOrders.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700 self-stretch sm:self-auto justify-end">
          <button
            type="button"
            onClick={() => setMode('review')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all cursor-pointer',
              mode === 'review'
                ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                : 'text-slate-400 hover:text-white',
            )}
          >
            На ревью
            {mode === 'review'
              ? reviewSection === 'auto' && trips.length > 0
                ? ` (${trips.length})`
                : reviewSection === 'garage' && garageOrders.length > 0
                  ? ` (${garageOrders.length})`
                  : ''
              : ''}
          </button>
          <button
            type="button"
            onClick={() => setMode('active')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all cursor-pointer',
              mode === 'active'
                ? 'bg-sky-500 text-white font-black shadow-xs'
                : 'text-slate-400 hover:text-white',
            )}
          >
            {reviewSection === 'auto' ? 'Активные' : 'В работе'}
            {mode === 'active'
              ? reviewSection === 'auto' && trips.length > 0
                ? ` (${trips.length})`
                : reviewSection === 'garage' && garageOrders.length > 0
                  ? ` (${garageOrders.length})`
                  : ''
              : ''}
          </button>
          <button
            type="button"
            onClick={() => setMode('history')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all cursor-pointer',
              mode === 'history'
                ? 'bg-indigo-600 text-white font-black shadow-xs'
                : 'text-slate-400 hover:text-white',
            )}
          >
            История ✓
          </button>
        </div>
      </div>

      {/* 2. Временной период */}
      {mode === 'history' && (
        <DateNav
          date={selectedDate}
          period={statsPeriod}
          onChange={setSelectedDate}
          setPeriod={setStatsPeriod}
          tripSearch={tripSearch}
          onTripSearchChange={handleTripSearchChange}
        />
      )}

      {/* 3. Итоговая статистика */}
      <ReviewStatsCards
        reviewSection={reviewSection}
        mode={mode}
        garageMachineFilter={garageMachineFilter}
        setGarageMachineFilter={setGarageMachineFilter}
        garageSummary={garageSummary}
        filteredGarageOrders={filteredGarageOrders}
        expandedGarageOrderIds={expandedGarageOrderIds}
        setExpandedGarageOrderIds={setExpandedGarageOrderIds}
        trips={trips}
        listTrips={listTrips}
        listServiceOrders={listServiceOrders}
        fleetStats={fleetStats}
        expandedIds={expandedIds}
        setExpandedIds={setExpandedIds}
        expandedGroups={expandedGroups}
        setExpandedGroups={setExpandedGroups}
      />

      {/* 4. Секция Гараж */}
      {reviewSection === 'garage' && (
        <div className="space-y-3">
          {isGarageLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-slate-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filteredGarageOrders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-14 text-center shadow-sm">
              <span className="material-symbols-outlined text-slate-200 text-[72px] mb-4 block">
                {mode === 'review' ? 'check_circle' : 'build_circle'}
              </span>
              <p className="text-slate-500 font-semibold text-lg">
                {garageOrders.length > 0
                  ? garageMachineFilter === 'client'
                    ? 'Нет клиентских заказ-нарядов за выбранный период'
                    : 'Нет заказ-нарядов по своим машинам за выбранный период'
                  : mode === 'review'
                    ? 'Нет заказ-нарядов на ревью — все работы механиков проверены!'
                    : mode === 'active'
                      ? 'Нет открытых заказ-нарядов в работе'
                      : 'Нет заказ-нарядов за выбранный период'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredGarageOrders.map((order) => (
                <GarageOrderRow
                  key={order.id}
                  order={order}
                  expanded={expandedGarageOrderIds.has(order.id)}
                  onToggle={() => toggleInSet(setExpandedGarageOrderIds, order.id)}
                  onEdit={() => setEditServiceOrder(order)}
                  onEditWork={(work) => setEditServiceWork({ order, work })}
                  onApprove={() =>
                    handleApproveServiceOrder(order.id, Boolean(order.is_partial_work_review))
                  }
                  onApproveWork={(workId) => handleApproveServiceOrder(order.id, true, workId)}
                  onApproveExternal={handleApproveExternalServiceOrder}
                  onReturn={() => handleReturnServiceOrder(order.id)}
                  onDelete={() => handleDeleteServiceOrder(order.id)}
                  approving={approvingId === order.id}
                  deleting={deletingId === order.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. Секция Авто */}
      {reviewSection === 'auto' &&
        (isLoading || (mode === 'history' && searchTripNumber.length > 0 && isSearchLoading)) && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

      {reviewSection === 'auto' &&
        !isLoading &&
        !(mode === 'history' && searchTripNumber.length > 0 && isSearchLoading) && (
          <div className="space-y-4">
            {mode === 'history' && searchTripNumber.length > 0 && (
              <div className="flex items-center justify-between bg-sky-50 border border-sky-200 rounded-xl px-3.5 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sky-600 text-[18px]">search</span>
                  <span className="font-bold text-sky-950">
                    Результат поиска по рейсу №{searchTripNumber}:
                  </span>
                  <span className="text-sky-700 font-semibold">
                    найдено рейсов: {searchTrips.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setTripSearch('')}
                  className="text-xs font-bold text-sky-700 hover:text-sky-900 bg-white border border-sky-200 px-2.5 py-1 rounded-lg hover:bg-sky-100 transition-colors cursor-pointer shadow-2xs"
                >
                  ✕ Сбросить поиск
                </button>
              </div>
            )}

            {fleetStats.combinedAssetGroups.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-14 text-center shadow-sm">
                <span className="material-symbols-outlined text-slate-200 text-[72px] mb-4 block">
                  {searchTripNumber
                    ? 'search_off'
                    : mode === 'review'
                      ? 'check_circle'
                      : mode === 'active'
                        ? 'local_shipping'
                        : 'search'}
                </span>
                <p className="text-slate-500 font-semibold text-lg">
                  {searchTripNumber
                    ? `Рейс №${searchTripNumber} не найден в базе`
                    : mode === 'review'
                      ? 'Всё проверено'
                      : mode === 'active'
                        ? 'Нет активных рейсов'
                        : 'Нет данных за этот период'}
                </p>
                {searchTripNumber && (
                  <button
                    type="button"
                    onClick={() => setTripSearch('')}
                    className="mt-3 inline-flex items-center gap-1 px-3 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                  >
                    ✕ Сбросить поиск
                  </button>
                )}
              </div>
            ) : (
              fleetStats.combinedAssetGroups.map((group) => {
                const effectiveExpandedGroups = new Set([
                  ...expandedGroups,
                  ...searchAutoExpand.groupKeys,
                ]);
                const effectiveExpandedIds = new Set([...expandedIds, ...searchAutoExpand.tripIds]);
                return (
                  <VehicleGroupCard
                    key={group.assetKey}
                    group={group}
                    mode={mode}
                    isExpanded={effectiveExpandedGroups.has(group.assetKey)}
                    isTripsOpen={
                      openTripsSpoilers.has(group.assetKey) ||
                      searchAutoExpand.groupKeys.has(group.assetKey)
                    }
                    isOrdersOpen={openOrdersSpoilers.has(group.assetKey)}
                    expandedIds={effectiveExpandedIds}
                    expandedGroups={effectiveExpandedGroups}
                    approvingId={approvingId}
                    deletingId={deletingId}
                    onToggleGroup={(k) => toggleInSet(setExpandedGroups, k)}
                    onToggleTripsSpoiler={(k) => toggleInSet(setOpenTripsSpoilers, k)}
                    onToggleOrdersSpoiler={(k) => toggleInSet(setOpenOrdersSpoilers, k)}
                    onToggleExpandTrip={(id) => toggleInSet(setExpandedIds, id)}
                    onSelectMaintenanceGroup={setSelectedMaintenanceGroup}
                    onEditTrip={setEditTrip}
                    onApproveTrip={handleApprove}
                    onReturnTrip={handleReturn}
                    onDeleteTrip={handleDelete}
                  />
                );
              })
            )}
          </div>
        )}

      {/* Модалки */}
      {selectedMaintenanceGroup && (
        <MaintenanceDetailModal
          group={selectedMaintenanceGroup}
          onClose={() => setSelectedMaintenanceGroup(null)}
        />
      )}

      {editTrip && (
        <TripEditModal
          trip={editTrip}
          counterparties={counterpartiesList}
          vehicles={fleetVehicles}
          drivers={staffDrivers}
          onClose={() => setEditTrip(null)}
          onSuccess={async () => {
            setEditTrip(null);
            await refresh();
            queryClient.invalidateQueries({ queryKey: ['orders-pipeline'] });
          }}
        />
      )}

      {editServiceOrder && (
        <GarageOrderEditModal
          order={editServiceOrder}
          onClose={() => setEditServiceOrder(null)}
          onSaved={() => {
            setEditServiceOrder(null);
            refresh();
          }}
        />
      )}

      {editServiceWork && (
        <GarageWorkEditModal
          order={editServiceWork.order}
          work={editServiceWork.work}
          onClose={() => setEditServiceWork(null)}
          onSaved={() => {
            setEditServiceWork(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
