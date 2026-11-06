/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Money, LifecycleBadge } from '@saldacargo/ui';
import { formatDate, formatDuration } from '@saldacargo/shared';
import { CreatePrrModal } from '@/components/CreatePrrModal';
import { TripDetailsModal } from '@/components/TripDetailsModal';

type TripCard = {
  id: string;
  trip_number: number;
  status: string;
  lifecycle_status: string;
  started_at: string;
  asset: { short_name: string } | null;
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
  activeCarryover?: { id: string; amount: string; note: string; date: string } | null;
  monthPayApproved: string;
  monthPayDraft: string;
  pendingPayrollCount: number;
}

// ── Главная страница водителя ────────────────────────────────

export default function RootPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [showPrrModal, setShowPrrModal] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedTripIdForModal, setSelectedTripIdForModal] = useState<string | null>(null);
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

  const availableVehicles = vehicles;

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

  // 2. Загружаем данные водителя (сразу в параллель)
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
      !user ||
      (user.roles || []).includes('driver') ||
      (user.roles || []).includes('owner') ||
      (user.roles || []).includes('admin'),
  });

  const activeAssetId =
    user?.current_asset_id ||
    (typeof window !== 'undefined' ? localStorage.getItem('active_vehicle_id') : null);

  const activeAsset =
    availableVehicles.find((v) => v.id === activeAssetId) ||
    vehicles.find((v) => v.id === activeAssetId);

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
      setSelectedVehicleId(activeAssetId || null);
      setShowVehiclePicker(true);
      setStartTripError('Выберите автомобиль перед началом рейса.');
      return;
    }

    const isPrr =
      asset.reg_number === 'БЕЗ АВТО' || asset.short_name?.toLowerCase().includes('без авто');

    setStartingTrip(true);
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: asset.id,
          odometer_start: asset.odometer_current ?? 0,
          trip_type: isPrr ? 'loaders_only' : 'local',
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
    <div className="p-3 space-y-2">
      {/* Приветствие (в 2 раза меньше по высоте) */}
      <div className="mb-0.5">
        <h1 className="text-base font-black text-zinc-900 leading-tight">
          Привет, {user.name}! 👋
        </h1>
      </div>

      {/* Карточки подотчёта и ЗП (по высоте уменьшены в 3 раза, только суммы и мелкие подписи) */}
      <AccountableCard
        balance={data?.accountableBalance ?? '0'}
        carryover={data?.activeCarryover}
      />

      <PayCard
        approved={data?.monthPayApproved ?? '0'}
        draft={data?.monthPayDraft ?? '0'}
        pendingCount={data?.pendingPayrollCount ?? 0}
      />

      {/* Карточка активного автомобиля с быстрой сменой (в 2 раза меньше по высоте) */}
      {!data?.activeTrip && (
        <div className="bg-white rounded-xl px-3 py-2 border border-zinc-200 shadow-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base shrink-0">
              {activeAsset?.reg_number === 'БЕЗ АВТО' ? '👷' : '🚚'}
            </span>
            <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">
                Авто:
              </span>
              <span className="text-xs font-black text-zinc-900 truncate">
                {activeAsset ? (
                  <>
                    {activeAsset.short_name}{' '}
                    <span className="text-[11px] text-zinc-500 font-bold">
                      · {activeAsset.reg_number}
                    </span>
                  </>
                ) : (
                  <span className="text-orange-600 font-bold">Не выбран</span>
                )}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              setSelectedVehicleId(activeAssetId || null);
              setShowVehiclePicker(true);
            }}
            className="px-2.5 py-1 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all shrink-0"
          >
            🔄 Сменить
          </button>
        </div>
      )}

      {/* Кнопка начала рейса */}
      <div>
        {!data?.activeTrip && (data?.reviewTrips ?? []).length === 0 && (
          <div className="space-y-2">
            <button
              onClick={handleStartTrip}
              disabled={startingTrip}
              className="w-full flex items-center justify-center gap-2 bg-orange-600 text-white rounded-xl py-2.5 text-xs font-black shadow-sm active:bg-orange-700 active:scale-[0.98] transition-all uppercase tracking-wide disabled:opacity-60 cursor-pointer"
            >
              <span>{activeAsset?.reg_number === 'БЕЗ АВТО' ? '👷' : '🚚'}</span>
              <span>
                {startingTrip
                  ? 'Создаём рейс...'
                  : activeAsset?.reg_number === 'БЕЗ АВТО'
                    ? 'Начать рейс (без авто)'
                    : 'Начать рейс'}
              </span>
            </button>

            <button
              onClick={() => setShowPrrModal(true)}
              className="w-full flex items-center justify-center gap-2 bg-white border border-zinc-200 text-zinc-800 hover:bg-zinc-50 rounded-xl py-2 text-xs font-black shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>👷</span>
              <span>Создать заказ (ПРР)</span>
            </button>
          </div>
        )}
      </div>

      {startTripError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-xs font-bold">
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
                  const isPrr =
                    v.reg_number === 'БЕЗ АВТО' || v.short_name?.toLowerCase().includes('без авто');
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
                        <div className="font-black text-zinc-900 text-sm uppercase flex items-center gap-1.5">
                          <span>{isPrr ? '👷' : '🚚'}</span>
                          <span>{v.short_name}</span>
                        </div>
                        <div className="text-xs font-bold text-zinc-400 tracking-wider uppercase mt-0.5">
                          {isPrr ? 'Погрузка без транспорта (ПРР)' : v.reg_number}
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

      {/* Активный рейс (компактный) */}
      {data?.activeTrip && <ActiveTripCard trip={data.activeTrip} />}

      {/* Рейсы на ревью (завершены, ожидают апрува, уменьшены в 2 раза по высоте) */}
      {(data?.reviewTrips ?? []).length > 0 && (
        <section className="pt-1">
          <h2 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1.5">
            На проверке у администратора
          </h2>
          <div className="space-y-1.5">
            {data?.reviewTrips.map((trip) => (
              <ReviewTripCard
                key={trip.id}
                trip={trip}
                onClick={() => setSelectedTripIdForModal(trip.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Последние рейсы (уменьшены в 2 раза по высоте) */}
      {(data?.recentTrips ?? []).length > 0 && (
        <section className="pt-1">
          <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
            Последние рейсы
          </h2>
          <div className="space-y-1.5">
            {data?.recentTrips.map((trip) => (
              <RecentTripCard
                key={trip.id}
                trip={trip}
                onClick={() => setSelectedTripIdForModal(trip.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Детали рейса (модальное окно с клиентами и заказами) */}
      {selectedTripIdForModal && (
        <TripDetailsModal
          tripId={selectedTripIdForModal}
          onClose={() => setSelectedTripIdForModal(null)}
        />
      )}

      {/* Модалка быстрого создания ПРР */}
      {showPrrModal && (
        <CreatePrrModal
          isOpen={showPrrModal}
          onClose={() => setShowPrrModal(false)}
          defaultCreatorId={user?.id}
          creatorName={user?.name}
          role="driver"
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['driver-summary'] });
          }}
        />
      )}
    </div>
  );
}

function AccountableCard({
  balance,
  carryover,
}: {
  balance: string;
  carryover?: { id: string; amount: string; note: string; date: string } | null;
}) {
  return (
    <Link href="/driver/finance?tab=accountable" className="block">
      <div
        className={`rounded-xl px-3 py-1.5 shadow-2xs border transition-colors flex items-center justify-between ${
          carryover
            ? 'bg-orange-50 border-orange-300'
            : 'bg-white border-zinc-200 active:bg-zinc-50'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
            Подотчёт
          </span>
          {carryover && (
            <span className="text-[8px] bg-red-100 text-red-700 font-black px-1 rounded">
              ⚠️ перенос
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Money amount={balance} className="text-sm font-black text-zinc-900" />
          <span className="text-zinc-300 text-xs font-bold">→</span>
        </div>
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
    <Link href="/driver/finance?tab=salary" className="block">
      <div className="bg-white rounded-xl px-3 py-1.5 shadow-2xs border border-zinc-200 active:bg-zinc-50 transition-colors flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
            ЗП за месяц
          </span>
          {pendingCount > 0 && (
            <span className="bg-amber-500 text-white text-[8px] font-black rounded-full px-1.5 py-0.2">
              {pendingCount} ждёт
            </span>
          )}
          {hasDraft && (
            <span className="text-[9px] text-amber-600 font-bold">
              (+
              <Money amount={draft} />)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Money amount={approved} className="text-sm font-black text-green-600" />
          <span className="text-zinc-300 text-xs font-bold">→</span>
        </div>
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
    <Link href={`/trip/${trip.id}`} className="block">
      <div className="bg-orange-50/70 border border-orange-300 rounded-xl px-3 py-2 active:bg-orange-100 transition-colors relative overflow-hidden flex items-center justify-between">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500"></div>
        <div className="pl-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] font-bold text-orange-700 uppercase bg-orange-100 px-1 rounded">
              В рейсе
            </span>
            <span className="font-black text-zinc-900 text-xs">Рейс №{trip.trip_number}</span>
            <span className="text-[11px] text-zinc-600 font-medium truncate">
              · {trip.asset?.short_name ?? 'Без авто'}
            </span>
            {trip.loader && (
              <span className="text-[10px] text-zinc-500 font-medium truncate">
                · + {trip.loader.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <span className="text-[11px] font-bold text-orange-600">
            ⏱ {formatDuration(durationMin)}
          </span>
          <span className="text-orange-600 text-xs font-bold">→</span>
        </div>
      </div>
    </Link>
  );
}

function ReviewTripCard({ trip, onClick }: { trip: TripCard; onClick: () => void }) {
  const orders = trip.trip_orders ?? [];
  const revenue = orders
    .filter((o) => o?.lifecycle_status !== 'cancelled')
    .reduce((s, o) => s + (parseFloat(o?.amount || '0') || 0), 0);

  const driverPay = orders
    .filter((o) => o?.lifecycle_status !== 'cancelled')
    .reduce((s, o) => s + (parseFloat(o?.driver_pay || '0') || 0), 0);

  return (
    <div
      onClick={onClick}
      className="bg-amber-50/60 border border-amber-300 rounded-xl px-3 py-2 active:bg-amber-100 transition-colors relative overflow-hidden flex items-center justify-between cursor-pointer"
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400"></div>
      <div className="pl-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-black text-zinc-900 text-xs">Рейс №{trip.trip_number}</span>
          <span className="text-[11px] text-zinc-600 font-medium truncate">
            · {trip.asset?.short_name ?? 'Без авто'}
          </span>
          <span className="text-[9px] text-amber-700 font-bold bg-amber-100 px-1 rounded">
            Ждёт проверки
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <div className="text-right">
          <Money amount={revenue.toString()} className="text-xs font-black text-zinc-900" />
          <div className="text-[10px] text-green-600 font-bold">
            ЗП: <Money amount={driverPay.toString()} />
          </div>
        </div>
        <span className="text-zinc-400 text-xs font-bold">ℹ️</span>
      </div>
    </div>
  );
}

function RecentTripCard({ trip, onClick }: { trip: TripCard; onClick: () => void }) {
  const orders = trip.trip_orders ?? [];
  const revenue = orders
    .filter((o) => o?.lifecycle_status !== 'cancelled')
    .reduce((s, o) => s + (parseFloat(o?.amount || '0') || 0), 0);

  const driverPay = orders
    .filter((o) => o?.lifecycle_status !== 'cancelled')
    .reduce((s, o) => s + (parseFloat(o?.driver_pay || '0') || 0), 0);

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl px-3 py-2 border border-zinc-200 flex items-center justify-between active:bg-zinc-50 transition-colors relative overflow-hidden cursor-pointer"
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-300"></div>
      <div className="pl-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-zinc-900 text-xs">Рейс №{trip.trip_number}</span>
          <span className="text-[11px] text-zinc-500 font-medium truncate">
            · {trip.asset?.short_name ?? 'Без авто'}
          </span>
          <span className="text-[10px] text-zinc-400 font-medium">
            · {trip.started_at ? formatDate(trip.started_at) : ''}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <div className="text-right">
          <Money amount={revenue.toString()} className="text-xs font-black text-zinc-900" />
          <div className="text-[10px] text-green-600 font-bold">
            ЗП: <Money amount={driverPay.toString()} />
          </div>
        </div>
        <LifecycleBadge
          status={trip.lifecycle_status as 'draft' | 'approved' | 'returned' | 'cancelled'}
        />
        <span className="text-zinc-400 text-xs font-bold">ℹ️</span>
      </div>
    </div>
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
