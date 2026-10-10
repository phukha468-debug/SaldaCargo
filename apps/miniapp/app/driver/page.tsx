/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Money, LifecycleBadge, cn } from '@saldacargo/ui';
import { formatDate, formatDuration } from '@saldacargo/shared';

type TripCard = {
  id: string;
  trip_number: number;
  status: string;
  lifecycle_status: string;
  started_at: string;
  asset: { short_name: string };
  trip_orders: Array<{ amount: string; driver_pay: string; lifecycle_status: string }>;
};

// Тип ответа API
interface DriverSummary {
  activeTrip: {
    id: string;
    trip_number: number;
    started_at: string;
    trip_type: string;
    asset: { short_name: string; reg_number: string };
    loader: { name: string } | null;
  } | null;
  reviewTrips: TripCard[];
  recentTrips: TripCard[];
  accountableBalance: string;
  monthPayApproved: string;
  monthPayDraft: string;
  pendingPayrollCount: number;
}

// ── Карточка заявки на ремонт ────────────────────────────────

interface RepairRequestCard {
  id: string;
  status: 'new' | 'approved' | 'rejected';
  custom_description: string | null;
  created_at: string;
  asset: { short_name: string; reg_number: string } | null;
  fault: { name: string } | null;
  service_order: { order_number: number; status: string } | null;
}

function RepairRequestsList() {
  const { data: requests = [] } = useQuery<RepairRequestCard[]>({
    queryKey: ['driver-repair-requests'],
    queryFn: async () => {
      const r = await fetch('/api/driver/repair-requests');
      if (!r.ok) throw new Error('API error');
      return r.json();
    },
    staleTime: 30000,
  });

  if (!Array.isArray(requests) || requests.length === 0) return null;

  const statusInfo: Record<string, { label: string; color: string }> = {
    new: { label: 'На рассмотрении', color: 'bg-amber-100 text-amber-700' },
    approved: { label: 'Наряд создан', color: 'bg-green-100 text-green-700' },
    rejected: { label: 'Отклонена', color: 'bg-red-100 text-red-700' },
  };

  return (
    <section className="pt-2">
      <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">
        Мои заявки на ремонт
      </h2>
      <div className="space-y-2">
        {requests.map((req) => {
          const si = statusInfo[req.status] ?? {
            label: req.status,
            color: 'bg-zinc-100 text-zinc-500',
          };
          return (
            <div key={req.id} className="bg-white rounded-lg border border-zinc-200 p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-zinc-900 text-sm truncate">
                    {req.asset?.short_name ?? '—'}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">
                    {req.fault?.name ?? req.custom_description ?? 'Без описания'}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{formatDate(req.created_at)}</p>
                  {req.service_order && (
                    <p className="text-[10px] font-bold text-green-700 mt-0.5">
                      Наряд #{req.service_order.order_number}
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    'text-[9px] font-black px-2 py-1 rounded-full flex-shrink-0',
                    si.color,
                  )}
                >
                  {si.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Главная страница водителя ────────────────────────────────

export default function RootPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [updatingVehicle, setUpdatingVehicle] = useState(false);
  const [startingTrip, setStartingTrip] = useState(false);
  const [startTripError, setStartTripError] = useState('');

  // 1. Проверяем профиль и роли
  const { data: user, isLoading: isUserLoading } = useQuery<{
    id: string;
    name: string;
    roles?: string[];
    current_asset_id?: string | null;
  }>({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch('/api/driver/me');
      if (!res.ok) throw new Error('Not authenticated');
      return res.json();
    },
    retry: false,
  });

  // Загружаем список всех активных машин
  const { data: vehicles = [] } = useQuery<
    Array<{ id: string; short_name: string; reg_number: string; odometer_current: number | null }>
  >({
    queryKey: ['driver-assets'],
    queryFn: () =>
      fetch('/api/driver/assets')
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
    staleTime: 300000,
  });

  const isPrrAdmin =
    (user?.roles || []).includes('admin') ||
    (user?.roles || []).includes('owner') ||
    Boolean(user?.name && /Нигамед|Шахмаев|Роман.*Радик|Радикович/i.test(user.name));

  const availableVehicles = vehicles.filter((v) => {
    const isPrr = v.reg_number === 'БЕЗ АВТО' || v.short_name?.toLowerCase().includes('без авто');
    return isPrr ? isPrrAdmin : true;
  });

  useEffect(() => {
    if (!isUserLoading) {
      if (!user) {
        window.location.replace('/');
        return;
      }
      const roles = user.roles || [];
      const isDriver =
        roles.includes('driver') || roles.includes('owner') || roles.includes('admin');
      const isMechanicOnly =
        !isDriver && (roles.includes('mechanic') || roles.includes('mechanic_lead'));
      if (isMechanicOnly) {
        window.location.replace('/mechanic');
      }
    }
  }, [user, isUserLoading]);

  // 2. Загружаем данные водителя (если это водитель)
  const {
    data,
    isLoading: isDataLoading,
    error,
  } = useQuery<DriverSummary>({
    queryKey: ['driver-summary'],
    queryFn: async () => {
      const res = await fetch(`/api/driver/summary`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json() as Promise<DriverSummary>;
    },
    enabled:
      !!user &&
      ((user.roles || []).includes('driver') ||
        (user.roles || []).includes('owner') ||
        (user.roles || []).includes('admin')),
  });

  const activeAssetId =
    user?.current_asset_id ||
    (typeof window !== 'undefined' ? localStorage.getItem('active_vehicle_id') : null);

  const activeAsset =
    availableVehicles.find((v) => v.id === activeAssetId) ||
    vehicles.find((v) => v.id === activeAssetId);

  useEffect(() => {
    if (showVehiclePicker) {
      setSelectedVehicleId(activeAssetId || null);
    }
  }, [showVehiclePicker, activeAssetId]);

  async function handleSwitchVehicle(assetId: string) {
    setUpdatingVehicle(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('active_vehicle_id', assetId);
      }
      queryClient.setQueryData(['me'], (old: any) =>
        old ? { ...old, current_asset_id: assetId } : old,
      );

      const res = await fetch('/api/driver/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: assetId }),
      });

      if (res.ok) {
        setShowVehiclePicker(false);
        setStartTripError('');
        queryClient.invalidateQueries({ queryKey: ['me'] });
        queryClient.invalidateQueries({ queryKey: ['driver-profile'] });
        queryClient.invalidateQueries({ queryKey: ['driver-summary'] });
        queryClient.invalidateQueries({ queryKey: ['driver-assets'] });
      }
    } catch (e) {
      console.error('Failed to switch vehicle', e);
    } finally {
      setUpdatingVehicle(false);
    }
  }

  async function handleStartTrip() {
    if (startingTrip) return;
    setStartTripError('');

    const currentVehicleId =
      user?.current_asset_id ||
      (typeof window !== 'undefined' ? localStorage.getItem('active_vehicle_id') : null);

    const asset = vehicles.find((a) => a.id === currentVehicleId);

    if (!asset) {
      setShowVehiclePicker(true);
      setStartTripError('Выберите автомобиль перед началом рейса.');
      return;
    }

    setStartingTrip(true);
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: asset.id,
          odometer_start: asset.odometer_current ?? 0,
          trip_type: 'local',
          idempotency_key: crypto.randomUUID(),
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setStartTripError(result.error ?? 'Ошибка создания рейса');
        setStartingTrip(false);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['driver-summary'] });
      router.push(`/trip/${result.id}`);
    } catch {
      setStartTripError('Ошибка сети');
      setStartingTrip(false);
    }
  }

  if (isUserLoading || isDataLoading) {
    return <DriverHomeSkeleton />;
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-600">
        Ошибка загрузки. Потяните вниз для обновления.
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="p-4 space-y-4">
      {/* Приветствие */}
      <div className="mb-2">
        <h1 className="text-2xl font-black text-zinc-900">Привет, {user.name}! 👋</h1>
      </div>

      {/* Карточка подотчёта */}
      <AccountableCard balance={data?.accountableBalance ?? '0'} />

      {/* Карточка ЗП */}
      <PayCard
        approved={data?.monthPayApproved ?? '0'}
        draft={data?.monthPayDraft ?? '0'}
        pendingCount={data?.pendingPayrollCount ?? 0}
      />

      {/* Карточка активного автомобиля с быстрой сменой */}
      {!data?.activeTrip && (
        <div className="bg-white rounded-2xl p-4 border border-zinc-200 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-xl">
              🚚
            </div>
            <div>
              <div className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">
                Активный автомобиль
              </div>
              <div className="text-sm font-black text-zinc-900">
                {activeAsset ? (
                  <>
                    {activeAsset.short_name}{' '}
                    <span className="text-xs text-zinc-500 font-bold">
                      · {activeAsset.reg_number}
                    </span>
                  </>
                ) : (
                  <span className="text-orange-600">Не выбран</span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowVehiclePicker(true)}
            className="px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl text-orange-700 text-xs font-black uppercase tracking-wider active:scale-95 transition-all"
          >
            🔄 Сменить
          </button>
        </div>
      )}

      {/* Кнопка начала рейса */}
      {!data?.activeTrip && (data?.reviewTrips ?? []).length === 0 && (
        <button
          onClick={handleStartTrip}
          disabled={startingTrip}
          className="w-full flex items-center justify-center gap-2 bg-orange-600 text-white rounded-xl py-5 text-lg font-black shadow-lg active:bg-orange-700 active:scale-[0.98] transition-all uppercase tracking-wide disabled:opacity-60"
        >
          <span>🚚</span>
          <span>{startingTrip ? 'Создаём рейс...' : 'Начать рейс'}</span>
        </button>
      )}
      {startTripError && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm font-bold">
          {startTripError}
        </div>
      )}

      {/* Модалка выбора авто */}
      {showVehiclePicker && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{
            background: 'rgba(0,0,0,0.5)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)',
          }}
          onClick={(e) => e.target === e.currentTarget && setShowVehiclePicker(false)}
        >
          <div className="bg-white rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-zinc-200 rounded-full" />
            </div>
            <div className="px-4 pt-1 pb-3 border-b border-zinc-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="font-black text-zinc-900 text-base">Выбрать автомобиль</h2>
                <p className="text-xs text-zinc-400">На каком авто вы сегодня едете?</p>
              </div>
              <button
                onClick={() => setShowVehiclePicker(false)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 text-xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto max-h-[50vh]">
              {availableVehicles.length === 0 ? (
                <p className="text-zinc-400 font-bold text-sm text-center py-4">
                  Загрузка машин...
                </p>
              ) : (
                availableVehicles.map((v) => {
                  const isSelected = (selectedVehicleId ?? activeAssetId) === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVehicleId(v.id)}
                      disabled={updatingVehicle}
                      className={`w-full text-left p-4 rounded-2xl border-2 transition-all active:scale-[0.98] flex items-center justify-between ${
                        isSelected
                          ? 'border-orange-500 bg-orange-50 shadow-sm'
                          : 'border-zinc-100 hover:border-orange-200 bg-white'
                      }`}
                    >
                      <div>
                        <div className="font-black text-zinc-900 text-sm uppercase">
                          {v.short_name}
                        </div>
                        <div className="text-xs font-bold text-zinc-400 tracking-wider uppercase mt-0.5">
                          {v.reg_number}
                        </div>
                      </div>
                      {isSelected && (
                        <span className="text-xs font-extrabold text-orange-600 bg-orange-100 px-2.5 py-1 rounded-full uppercase">
                          {v.id === activeAssetId ? 'Активен' : 'Выбран'}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
            {availableVehicles.length > 0 && (
              <div className="p-4 border-t border-zinc-100 bg-white flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const targetId = selectedVehicleId || activeAssetId;
                    if (targetId) handleSwitchVehicle(targetId);
                  }}
                  disabled={updatingVehicle || (!selectedVehicleId && !activeAssetId)}
                  className="w-full py-4 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white rounded-2xl font-black uppercase tracking-wider text-base shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updatingVehicle ? 'Сохранение...' : 'ОК'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Активный рейс */}
      {data?.activeTrip && <ActiveTripCard trip={data.activeTrip} />}

      {/* Рейсы на ревью (завершены, ожидают апрува) */}
      {(data?.reviewTrips ?? []).length > 0 && (
        <section className="pt-2">
          <h2 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-3">
            На проверке у администратора
          </h2>
          <div className="space-y-3">
            {data?.reviewTrips.map((trip) => (
              <ReviewTripCard key={trip.id} trip={trip} />
            ))}
          </div>
        </section>
      )}

      {/* Последние рейсы */}
      {(data?.recentTrips ?? []).length > 0 && (
        <section className="pt-2">
          <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">
            Последние рейсы
          </h2>
          <div className="space-y-3">
            {data?.recentTrips.map((trip) => (
              <RecentTripCard key={trip.id} trip={trip} />
            ))}
          </div>
        </section>
      )}

      {/* Заявки на ремонт */}
      <RepairRequestsList />
    </div>
  );
}

// ... (остальные компоненты карточек остаются без изменений)

function AccountableCard({ balance }: { balance: string }) {
  return (
    <Link href="/driver/finance?tab=accountable">
      <div className="bg-white rounded-lg p-4 shadow-sm border border-zinc-200 active:bg-zinc-50 transition-colors">
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">На руках</p>
        <Money amount={balance} className="text-2xl font-black text-zinc-900 mt-1" />
        <p className="text-xs text-zinc-400 mt-1 font-medium">Подотчётные наличные →</p>
      </div>
    </Link>
  );
}

function PayCard({
  approved,
  draft,
  pendingCount,
}: {
  approved: string;
  draft: string;
  pendingCount: number;
}) {
  const hasDraft = parseFloat(draft) > 0;
  return (
    <Link href="/driver/finance?tab=pay">
      <div className="bg-white rounded-lg p-4 shadow-sm border border-zinc-200 active:bg-zinc-50 transition-colors relative">
        {pendingCount > 0 && (
          <div className="absolute top-3 right-3 bg-amber-500 text-white text-[9px] font-black rounded-full px-2 py-0.5 uppercase tracking-wide">
            {pendingCount} ожидает подтв.
          </div>
        )}
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">ЗП за месяц</p>
        <Money amount={approved} className="text-2xl font-black text-green-600 mt-1" />
        {hasDraft && (
          <div className="text-xs text-amber-600 mt-1 font-bold">
            В черновиках: <Money amount={draft} />
          </div>
        )}
        <p className="text-xs text-zinc-400 mt-1 font-medium">
          {pendingCount > 0 ? '⚠️ Требует подтверждения →' : 'Детализация →'}
        </p>
      </div>
    </Link>
  );
}

function ActiveTripCard({
  trip,
}: {
  trip: {
    id: string;
    trip_number: number;
    started_at: string;
    asset: { short_name: string };
    loader: { name: string } | null;
  };
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const durationMs = now - new Date(trip.started_at).getTime();
  const durationMin = Math.floor(durationMs / 60000);

  return (
    <Link href={`/trip/${trip.id}`}>
      <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4 active:bg-orange-100 transition-colors relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500"></div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">
            Активный рейс
          </span>
          <span className="text-xs font-bold text-orange-500">⏱ {formatDuration(durationMin)}</span>
        </div>
        <p className="font-black text-zinc-900 text-lg">
          Рейс №{trip.trip_number} · {trip.asset.short_name}
        </p>
        {trip.loader && (
          <p className="text-sm text-zinc-600 font-bold mt-0.5">+ {trip.loader.name}</p>
        )}
        <p className="text-sm text-orange-600 font-black mt-2 uppercase tracking-wide">
          Открыть рейс →
        </p>
      </div>
    </Link>
  );
}

function ReviewTripCard({ trip }: { trip: TripCard }) {
  const revenue = trip.trip_orders
    .filter((o) => o.lifecycle_status !== 'cancelled')
    .reduce((s, o) => s + parseFloat(o.amount), 0);

  const driverPay = trip.trip_orders
    .filter((o) => o.lifecycle_status !== 'cancelled')
    .reduce((s, o) => s + parseFloat(o.driver_pay), 0);

  return (
    <Link href={`/trip/${trip.id}`}>
      <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 active:bg-amber-100 transition-colors relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400"></div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
            Ждёт проверки
          </span>
          <span className="text-[10px] font-bold text-amber-600">
            {formatDate(trip.started_at)}
          </span>
        </div>
        <p className="font-black text-zinc-900 text-base">
          Рейс №{trip.trip_number} · {trip.asset.short_name}
        </p>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-amber-700 font-bold">Администратор ещё не проверил</p>
          <div className="text-right">
            <Money amount={revenue.toString()} className="text-sm font-black text-zinc-900" />
            <div className="text-xs text-green-600 font-bold">
              ЗП: <Money amount={driverPay.toString()} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function RecentTripCard({ trip }: { trip: TripCard }) {
  const revenue = trip.trip_orders
    .filter((o) => o.lifecycle_status !== 'cancelled')
    .reduce((s, o) => s + parseFloat(o.amount), 0);

  const driverPay = trip.trip_orders
    .filter((o) => o.lifecycle_status !== 'cancelled')
    .reduce((s, o) => s + parseFloat(o.driver_pay), 0);

  return (
    <Link href={`/trip/${trip.id}`}>
      <div className="bg-white rounded-lg p-4 shadow-sm border border-zinc-200 flex items-center justify-between active:bg-zinc-50 transition-colors relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-300"></div>
        <div className="pl-2">
          <p className="font-bold text-zinc-900 text-sm">
            Рейс №{trip.trip_number} · {trip.asset.short_name}
          </p>
          <p className="text-[10px] text-zinc-400 font-bold uppercase mt-1">
            {formatDate(trip.started_at)}
          </p>
        </div>
        <div className="text-right">
          <Money amount={revenue.toString()} className="text-sm font-black text-zinc-900" />
          <div className="text-xs text-green-600 font-bold mt-0.5">
            ЗП: <Money amount={driverPay.toString()} />
          </div>
          <div className="mt-1">
            <LifecycleBadge
              status={trip.lifecycle_status as 'draft' | 'approved' | 'returned' | 'cancelled'}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}

function DriverHomeSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-zinc-200 rounded" />
      <div className="bg-zinc-200 rounded-lg h-24" />
      <div className="bg-zinc-200 rounded-lg h-24" />
      <div className="bg-zinc-200 rounded-lg h-20" />
      <div className="space-y-3 pt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-zinc-200 rounded-lg h-16" />
        ))}
      </div>
    </div>
  );
}
