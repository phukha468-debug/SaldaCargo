'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { getWeekDates } from '@saldacargo/shared';
import { cn } from '@saldacargo/ui';
import { CreatePrrModal } from '@/components/CreatePrrModal';
import { SmartTripOrderModal } from '@/components/SmartTripOrderModal';
import { DateNav } from '@/features/admin-trips/DateNav';
import { FleetHistorySummary, VehicleGroupCard } from '@/features/admin-trips/FleetHistoryViews';
import { HistoryTripCard } from '@/features/admin-trips/HistoryTripCard';
import { ServiceOrderEditModal } from '@/features/admin-trips/ServiceOrderEditModal';
import { ServiceOrderReviewCard } from '@/features/admin-trips/ServiceOrderReviewCard';
import { SimpleTripCard } from '@/features/admin-trips/SimpleTripCard';
import type { MiniappServiceOrder, MiniappTrip, VehicleGroup } from '@/features/admin-trips/types';
import { buildVehicleGroups, summarizeVehicleGroups } from '@/features/admin-trips/utils';
import { VehicleDetailSheet } from '@/features/admin-trips/VehicleDetailSheet';

function Skeleton() {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-zinc-200 rounded-2xl h-20" />
      ))}
    </div>
  );
}

function TripsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const filter = (searchParams.get('filter') ?? 'review') as 'review' | 'active' | 'history';
  const sectionParam = searchParams.get('section') === 'garage' ? 'garage' : 'auto';
  const [section, setSection] = useState<'auto' | 'garage'>(sectionParam);
  const queryClient = useQueryClient();

  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedDate, setSelectedDate] = useState(today);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month');
  const [tripSearch, setTripSearch] = useState('');
  const searchTripNumber = tripSearch.trim().replace(/[^0-9]/g, '');
  const [editTrip, setEditTrip] = useState<MiniappTrip | null>(null);
  const [editOrder, setEditOrder] = useState<MiniappServiceOrder | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [showPrrModal, setShowPrrModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<VehicleGroup | null>(null);

  const { data: searchTrips = [], isLoading: searchTripsLoading } = useQuery<MiniappTrip[]>({
    queryKey: ['admin-trips-search', searchTripNumber],
    queryFn: () => fetch(`/api/admin/trips?trip_number=${searchTripNumber}`).then((r) => r.json()),
    enabled: filter === 'history' && searchTripNumber.length > 0,
    staleTime: 30000,
  });

  const { data: simpleTrips = [], isLoading: simpleLoading } = useQuery<MiniappTrip[]>({
    queryKey: ['admin-trips', filter],
    queryFn: () => fetch(`/api/admin/trips?filter=${filter}`).then((r) => r.json()),
    enabled: filter !== 'history',
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const { data: historyTrips = [], isLoading: historyLoading } = useQuery<MiniappTrip[]>({
    queryKey: ['admin-trips-history', selectedDate, period],
    queryFn: () => {
      let url = `/api/admin/trips?filter=history`;
      if (period === 'month') {
        url += `&month=${selectedDate.slice(0, 7)}`;
      } else if (period === 'week') {
        const { weekStart, weekEnd } = getWeekDates(selectedDate);
        url += `&weekStart=${weekStart}&weekEnd=${weekEnd}`;
      } else {
        url += `&date=${selectedDate}`;
      }
      return fetch(url).then((r) => r.json());
    },
    enabled: filter === 'history',
    staleTime: 30000,
  });

  const { data: simpleOrders = [], isLoading: ordersSimpleLoading } = useQuery<
    MiniappServiceOrder[]
  >({
    queryKey: ['admin-service-orders', filter],
    queryFn: () => fetch(`/api/admin/service-orders?filter=${filter}`).then((r) => r.json()),
    enabled: filter !== 'history',
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const { data: historyOrders = [], isLoading: ordersHistoryLoading } = useQuery<
    MiniappServiceOrder[]
  >({
    queryKey: ['admin-service-orders-history', selectedDate, period],
    queryFn: () => {
      let url = `/api/admin/service-orders?filter=history&machine_type=own`;
      if (period === 'month') {
        url += `&month=${selectedDate.slice(0, 7)}`;
      } else if (period === 'week') {
        const { weekStart, weekEnd } = getWeekDates(selectedDate);
        url += `&weekStart=${weekStart}&weekEnd=${weekEnd}`;
      } else {
        url += `&date=${selectedDate}`;
      }
      return fetch(url).then((r) => r.json());
    },
    enabled: filter === 'history',
    staleTime: 30000,
  });

  const vehicleGroups = useMemo<VehicleGroup[]>(() => {
    if (filter !== 'history') return [];
    return buildVehicleGroups(historyTrips, historyOrders);
  }, [filter, historyTrips, historyOrders]);

  const fleetSummary = useMemo(() => summarizeVehicleGroups(vehicleGroups), [vehicleGroups]);

  const activeSelectedGroup = selectedGroup
    ? vehicleGroups.find((g) => g.assetKey === selectedGroup.assetKey) || selectedGroup
    : null;

  const trips =
    filter === 'history' ? (searchTripNumber.length > 0 ? searchTrips : historyTrips) : simpleTrips;
  const serviceOrders = filter === 'history' ? historyOrders : simpleOrders;
  const isLoading =
    section === 'auto'
      ? filter === 'history'
        ? searchTripNumber.length > 0
          ? searchTripsLoading
          : historyLoading
        : simpleLoading
      : filter === 'history'
        ? ordersHistoryLoading
        : ordersSimpleLoading;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-summary'] });
    if (filter === 'history') {
      queryClient.invalidateQueries({ queryKey: ['admin-trips-history'] });
      queryClient.invalidateQueries({ queryKey: ['admin-service-orders-history'] });
    } else {
      queryClient.invalidateQueries({ queryKey: ['admin-trips', filter] });
      queryClient.invalidateQueries({ queryKey: ['admin-service-orders', filter] });
    }
  };

  async function handleApprove(tripId: string, cashNotSurrendered?: boolean) {
    setApprovingId(tripId);
    try {
      const res = await fetch(`/api/admin/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          ...(cashNotSurrendered !== undefined ? { cash_not_surrendered: cashNotSurrendered } : {}),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка');
      refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setApprovingId(null);
    }
  }

  async function handleReturn(tripId: string) {
    if (!confirm('Вернуть рейс водителю на доработку?')) return;
    setApprovingId(tripId);
    try {
      const res = await fetch(`/api/admin/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'return' }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка');
      refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setApprovingId(null);
    }
  }

  async function handleDelete(tripId: string) {
    if (
      !confirm(
        'ВНИМАНИЕ: Это полностью удалит рейс и ВСЕ связанные с ним доходы, расходы и начисления ЗП! Вы уверены?',
      )
    )
      return;
    setApprovingId(tripId);
    try {
      const res = await fetch(`/api/admin/trips/${tripId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка удаления');
      refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setApprovingId(null);
    }
  }

  async function handleApproveOrder(orderId: string) {
    setApprovingId(orderId);
    try {
      const res = await fetch(`/api/admin/service-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка утверждения');
      refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setApprovingId(null);
    }
  }

  async function handleReturnOrder(orderId: string) {
    const note = prompt('Причина возврата механика на доработку (необязательно):');
    if (note === null) return;
    setApprovingId(orderId);
    try {
      const res = await fetch(`/api/admin/service-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'return', admin_note: note || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка возврата');
      refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setApprovingId(null);
    }
  }

  async function handleDeleteOrder(orderId: string) {
    if (!confirm('Удалить заказ-наряд и все связанные с ним начисления?')) return;
    setApprovingId(orderId);
    try {
      const res = await fetch(`/api/admin/service-orders/${orderId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка удаления');
      refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setApprovingId(null);
    }
  }

  const FILTERS = [
    { key: 'review', label: '📋 На ревью' },
    { key: 'active', label: section === 'auto' ? '🚛 Активные' : '🔧 В работе' },
    { key: 'history', label: '📅 История' },
  ];

  const emptyLabel =
    section === 'auto'
      ? filter === 'history' && searchTripNumber.length > 0
        ? `Рейс №${searchTripNumber} не найден`
        : filter === 'review'
          ? 'Нет рейсов на ревью'
          : filter === 'active'
            ? 'Нет активных рейсов'
            : period === 'month'
              ? 'Нет рейсов за этот месяц'
              : period === 'week'
                ? 'Нет рейсов за эту неделю'
                : 'Нет рейсов за этот день'
      : filter === 'review'
        ? 'Нет заказ-нарядов на ревью'
        : filter === 'active'
          ? 'Нет нарядов в работе'
          : period === 'month'
            ? 'Нет заказ-нарядов за этот месяц'
            : period === 'week'
              ? 'Нет заказ-нарядов за эту неделю'
              : 'Нет заказ-нарядов за этот день';

  const emptyIcon = filter === 'review' ? '✅' : section === 'auto' ? '🚛' : '🔧';
  const autoCount = Array.isArray(simpleTrips) ? simpleTrips.length : 0;
  const garageCount = Array.isArray(simpleOrders) ? simpleOrders.length : 0;

  return (
    <div>
      <header className="bg-white border-b border-zinc-200 px-4 h-16 flex items-center justify-between sticky top-0 z-40">
        <h1 className="font-black text-zinc-900 text-lg uppercase tracking-tight">
          Ревью · {section === 'auto' ? 'Авто' : 'Гараж'}
        </h1>
        {section === 'auto' && (
          <button
            type="button"
            onClick={() => setShowPrrModal(true)}
            className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-black px-3.5 py-2 rounded-xl uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all"
          >
            <span className="text-sm">👷</span>
            <span>+ ПРР без авто</span>
          </button>
        )}
      </header>

      <div className="bg-white px-4 pt-3 pb-2 border-b border-zinc-100">
        <div className="grid grid-cols-2 gap-2.5 bg-zinc-100 p-1.5 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setSection('auto');
              router.replace(`/admin/trips?filter=${filter}&section=auto`);
            }}
            className={cn(
              'py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all',
              section === 'auto'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800',
            )}
          >
            <span className="text-base">🚛</span>
            <span>Авто</span>
            {filter !== 'history' && autoCount > 0 && (
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-black',
                  section === 'auto' ? 'bg-orange-500 text-white' : 'bg-zinc-200 text-zinc-700',
                )}
              >
                {autoCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setSection('garage');
              router.replace(`/admin/trips?filter=${filter}&section=garage`);
            }}
            className={cn(
              'py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all',
              section === 'garage'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800',
            )}
          >
            <span className="text-base">🔧</span>
            <span>Гараж</span>
            {filter !== 'history' && garageCount > 0 && (
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-black',
                  section === 'garage'
                    ? 'bg-white text-emerald-700'
                    : 'bg-emerald-100 text-emerald-800',
                )}
              >
                {garageCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white border-b border-zinc-100 px-4 py-2 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => router.replace(`/admin/trips?filter=${f.key}&section=${section}`)}
            className={cn(
              'flex-shrink-0 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all',
              filter === f.key
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100 text-zinc-500 active:bg-zinc-200',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filter === 'history' && (
        <DateNav
          date={selectedDate}
          period={period}
          onChange={setSelectedDate}
          setPeriod={setPeriod}
          tripSearch={tripSearch}
          onTripSearchChange={(val) => {
            setTripSearch(val);
            if (val.trim().length > 0 && section !== 'auto') {
              setSection('auto');
            }
          }}
        />
      )}

      {filter === 'history' && searchTripNumber.length > 0 && (
        <div className="mx-4 mt-2 px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-xs flex items-center justify-between text-sky-800">
          <span>
            🔍 Рейс №{searchTripNumber} (найдено: {searchTrips.length})
          </span>
          <button
            type="button"
            onClick={() => setTripSearch('')}
            className="text-[10px] font-bold text-sky-600 hover:underline cursor-pointer"
          >
            ✕ Сбросить
          </button>
        </div>
      )}

      {isLoading ? (
        <Skeleton />
      ) : filter === 'history' && searchTripNumber.length > 0 ? (
        searchTrips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
            <span className="text-5xl mb-4">🔍</span>
            <p className="font-bold uppercase tracking-widest text-sm">
              Рейс №{searchTripNumber} не найден
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {searchTrips.map((trip) => (
              <HistoryTripCard
                key={trip.id}
                trip={trip}
                onEdit={(t) => setEditTrip(t)}
                onApprove={handleApprove}
                onReturn={handleReturn}
                onDelete={handleDelete}
                approving={approvingId === trip.id}
              />
            ))}
          </div>
        )
      ) : filter === 'history' ? (
        vehicleGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
            <span className="text-5xl mb-4">📅</span>
            <p className="font-bold uppercase tracking-widest text-sm">
              Нет данных за выбранный период
            </p>
          </div>
        ) : (
          <>
            <FleetHistorySummary
              totalRevenue={fleetSummary.totalRevenue}
              totalPayroll={fleetSummary.totalPayroll}
              totalFuel={fleetSummary.totalFuel}
              totalMaintenance={fleetSummary.totalMaintenance}
              totalNetProfit={fleetSummary.totalNetProfit}
              tripsCount={fleetSummary.tripsCount}
              ordersCount={fleetSummary.ordersCount}
            />

            <div className="px-3 pb-6 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1 flex items-center justify-between">
                <span>Машины автопарка ({vehicleGroups.length})</span>
                <span className="text-[9px] text-sky-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  Тап для деталей
                </span>
              </div>

              {vehicleGroups.map((group) => (
                <VehicleGroupCard
                  key={group.assetKey}
                  group={group}
                  onClick={() => setSelectedGroup(group)}
                />
              ))}
            </div>
          </>
        )
      ) : section === 'auto' ? (
        trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
            <span className="text-5xl mb-4">{emptyIcon}</span>
            <p className="font-bold uppercase tracking-widest text-sm">{emptyLabel}</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {trips.map((trip) =>
              filter === 'review' ? (
                <HistoryTripCard
                  key={trip.id}
                  trip={trip}
                  onEdit={(t) => setEditTrip(t)}
                  onApprove={handleApprove}
                  onReturn={handleReturn}
                  onDelete={handleDelete}
                  approving={approvingId === trip.id}
                />
              ) : (
                <SimpleTripCard key={trip.id} trip={trip} />
              ),
            )}
          </div>
        )
      ) : serviceOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
          <span className="text-5xl mb-4">{emptyIcon}</span>
          <p className="font-bold uppercase tracking-widest text-sm">{emptyLabel}</p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {serviceOrders.map((order) => (
            <ServiceOrderReviewCard
              key={order.id}
              order={order}
              onEdit={(o) => setEditOrder(o)}
              onApprove={handleApproveOrder}
              onReturn={handleReturnOrder}
              onDelete={handleDeleteOrder}
              approving={approvingId === order.id}
            />
          ))}
        </div>
      )}

      {activeSelectedGroup && (
        <VehicleDetailSheet
          group={activeSelectedGroup}
          onClose={() => setSelectedGroup(null)}
          onEditTrip={(trip) => setEditTrip(trip)}
        />
      )}

      {editTrip && (
        <SmartTripOrderModal
          trip={editTrip}
          isOpen={Boolean(editTrip)}
          onClose={() => setEditTrip(null)}
          onSaved={() => {
            setEditTrip(null);
            refresh();
          }}
        />
      )}

      {editOrder && (
        <ServiceOrderEditModal
          order={editOrder}
          onClose={() => setEditOrder(null)}
          onSaved={() => {
            setEditOrder(null);
            refresh();
          }}
        />
      )}

      <CreatePrrModal
        isOpen={showPrrModal}
        onClose={() => setShowPrrModal(false)}
        role="admin"
        onSuccess={refresh}
      />
    </div>
  );
}

export default function AdminTripsPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <TripsContent />
    </Suspense>
  );
}
