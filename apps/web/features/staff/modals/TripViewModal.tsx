'use client';

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TripRouteSheet, cn } from '@saldacargo/ui';
import type { PayrollUser } from '../types';
import {
  TripViewOrdersExpenses,
  type QuickViewTripExpense,
  type QuickViewTripOrder,
} from './TripViewOrdersExpenses';

const LIFECYCLE_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Черновик', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
  submitted: { label: 'На согласовании', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  in_review: { label: 'На согласовании', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  approved: { label: 'Одобрен', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  completed: { label: 'Завершен', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  cancelled: { label: 'Отменен', cls: 'bg-rose-100 text-rose-800 border-rose-300' },
};

export function TripViewModal({
  tripId,
  currentUser,
  onClose,
}: {
  tripId: string;
  currentUser?: PayrollUser;
  onClose: () => void;
}) {
  const backdropRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const {
    data: trip,
    isLoading,
    error,
  } = useQuery<{
    id: string;
    trip_number: number | string;
    status: string;
    lifecycle_status: string;
    started_at: string;
    ended_at: string | null;
    created_at?: string | null;
    trip_type?: string | null;
    odometer_start?: number | null;
    odometer_end?: number | null;
    driver_note?: string | null;
    asset?: { id: string; short_name: string; reg_number: string } | null;
    driver?: { id: string; name: string } | null;
    loader?: { id: string; name: string } | null;
    trip_orders?: QuickViewTripOrder[];
    trip_expenses?: QuickViewTripExpense[];
  }>({
    queryKey: ['trip-quick-view', tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Не удалось загрузить данные рейса');
      }
      return res.json();
    },
    staleTime: 30000,
  });

  const statusInfo = LIFECYCLE_LABELS[trip?.lifecycle_status || trip?.status || ''] || {
    label: trip?.lifecycle_status || trip?.status || '—',
    cls: 'bg-slate-100 text-slate-700 border-slate-300',
  };

  const vehicleTitle = trip?.asset
    ? [trip.asset.short_name, trip.asset.reg_number ? `(${trip.asset.reg_number})` : '']
        .filter(Boolean)
        .join(' ')
    : 'Автомобиль не указан';

  const activeOrders = (trip?.trip_orders || []).filter((o) => o.lifecycle_status !== 'cancelled');
  const expenses = trip?.trip_expenses || [];

  const totalRevenue = activeOrders.reduce((s, o) => s + parseFloat(o.amount || '0'), 0);
  const totalDriverPay = activeOrders.reduce((s, o) => s + parseFloat(o.driver_pay || '0'), 0);
  const totalLoader1Pay = activeOrders.reduce((s, o) => s + parseFloat(o.loader_pay || '0'), 0);
  const totalLoader2Pay = activeOrders.reduce((s, o) => s + parseFloat(o.loader2_pay || '0'), 0);
  const totalPayroll = totalDriverPay + totalLoader1Pay + totalLoader2Pay;
  const totalExpenses = expenses.reduce((s, e) => s + parseFloat(e.amount || '0'), 0);
  const netMargin = totalRevenue - totalPayroll - totalExpenses;

  const isCurrentDriver = Boolean(
    currentUser &&
    (trip?.driver?.id === currentUser.id ||
      (trip?.driver?.name &&
        trip.driver.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase())),
  );

  let currentEmployeePay = 0;
  if (currentUser) {
    if (isCurrentDriver) {
      currentEmployeePay = totalDriverPay;
    } else {
      const loaderSum = activeOrders.reduce((sum, o) => {
        let s = 0;
        const isL1 =
          o.loader_id === currentUser.id ||
          (o.loader?.name &&
            o.loader.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase()) ||
          (trip?.loader?.id === currentUser.id &&
            (!o.loader_id || o.loader_id === trip?.loader?.id));
        const isL2 =
          o.loader2_id === currentUser.id ||
          (o.loader2?.name &&
            o.loader2.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase());
        if (isL1) s += parseFloat(o.loader_pay || '0');
        if (isL2) s += parseFloat(o.loader2_pay || '0');
        return sum + s;
      }, 0);

      if (loaderSum > 0) currentEmployeePay = loaderSum;
      else if (currentUser.roles?.includes('driver') && totalDriverPay > 0)
        currentEmployeePay = totalDriverPay;
      else if (currentUser.roles?.includes('loader') && totalLoader1Pay > 0)
        currentEmployeePay = totalLoader1Pay;
    }
  }

  const hasOdometer =
    trip?.odometer_start !== undefined &&
    trip?.odometer_start !== null &&
    trip?.odometer_end !== undefined &&
    trip?.odometer_end !== null;
  const distanceKm =
    hasOdometer && (trip.odometer_end as number) >= (trip.odometer_start as number)
      ? (trip.odometer_end as number) - (trip.odometer_start as number)
      : null;

  const loader1Name =
    trip?.loader?.name || activeOrders.find((o) => o.loader?.name)?.loader?.name || null;
  const loader2Name = activeOrders.find((o) => o.loader2?.name)?.loader2?.name || null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => {
        backdropRef.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (backdropRef.current && e.target === e.currentTarget) onClose();
        backdropRef.current = false;
      }}
    >
      <div
        className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4.5 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-black text-lg">
              🚚
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white">
                  Рейс #{trip?.trip_number || tripId}
                </h3>
                {trip && (
                  <span
                    className={cn(
                      'text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border',
                      statusInfo.cls,
                    )}
                  >
                    {statusInfo.label}
                  </span>
                )}
                {trip?.trip_type && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {trip.trip_type === 'intercity' ? 'Межгород' : 'Город'}
                  </span>
                )}
              </div>
              <p className="text-xs text-indigo-200/80 font-medium">
                {isLoading ? 'Загрузка данных...' : vehicleTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {trip && (
              <a
                href={`/review?trip=${trip.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-indigo-200 hover:text-white bg-indigo-900/60 hover:bg-indigo-800/80 border border-indigo-700/60 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
                title="Открыть полный рейс в разделе Ревью"
              >
                <span>В Ревью</span>
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              </a>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="inline-block animate-spin text-3xl">⚙️</div>
              <p className="text-sm font-bold text-slate-500">
                Загрузка информации о рейсе #{tripId}...
              </p>
            </div>
          ) : error || !trip ? (
            <div className="py-12 text-center space-y-3 bg-white rounded-2xl border border-rose-200 p-6">
              <span className="material-symbols-outlined text-4xl text-rose-500">error</span>
              <p className="text-sm font-bold text-rose-700">
                {error instanceof Error ? error.message : 'Не удалось загрузить данные рейса'}
              </p>
            </div>
          ) : (
            <>
              {currentUser && currentEmployeePay > 0 && (
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-sm flex items-center justify-between gap-4 flex-wrap">
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-black uppercase tracking-wider text-emerald-100 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">payments</span>
                      Начислено сотруднику ({currentUser.name})
                    </div>
                    <p className="text-xs text-emerald-50">
                      {isCurrentDriver
                        ? `Зарплата водителя за рейс #${trip.trip_number} (${activeOrders.length} ${activeOrders.length === 1 ? 'заказ' : 'заказа'})`
                        : `Зарплата грузчика за погрузку / разгрузку в рейсе #${trip.trip_number}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black tracking-tight">
                      +&nbsp;{currentEmployeePay.toLocaleString('ru-RU')} ₽
                    </div>
                    <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded text-white inline-block mt-0.5">
                      {trip.lifecycle_status === 'approved' ? '✓ Одобрено' : 'В обработке'}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-indigo-500">
                      calendar_today
                    </span>
                    Когда был рейс
                  </div>
                  <div className="text-xs font-black text-slate-900">
                    {trip.started_at
                      ? new Date(trip.started_at).toLocaleString('ru-RU', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : trip.created_at
                        ? new Date(trip.created_at).toLocaleString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })
                        : '—'}
                  </div>
                  {trip.ended_at && (
                    <div className="text-[11px] text-slate-500 font-medium">
                      Завершен:{' '}
                      {new Date(trip.ended_at).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-blue-500">
                      local_shipping
                    </span>
                    Автомобиль
                  </div>
                  <div className="text-xs font-black text-slate-900 truncate" title={vehicleTitle}>
                    {vehicleTitle}
                  </div>
                  {hasOdometer && (
                    <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px] text-slate-400">
                        speed
                      </span>
                      {distanceKm !== null
                        ? `Пробег: ${distanceKm} км`
                        : `Одометр: ${trip.odometer_start} км`}
                    </div>
                  )}
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1 sm:col-span-2 lg:col-span-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-emerald-500">
                      group
                    </span>
                    Экипаж рейса
                  </div>
                  <div className="text-xs font-black text-slate-900">
                    <span className="text-slate-500 font-medium">Водитель: </span>
                    {trip.driver?.name || 'Не назначен'}
                  </div>
                  {(loader1Name || loader2Name) && (
                    <div className="text-[11px] text-slate-600 font-medium">
                      <span className="text-slate-400">Грузчики: </span>
                      {[loader1Name, loader2Name].filter(Boolean).join(' + ')}
                    </div>
                  )}
                </div>
              </div>

              {trip.driver_note && (
                <div className="mb-2">
                  <TripRouteSheet driverNote={trip.driver_note} />
                </div>
              )}

              <TripViewOrdersExpenses
                tripNumber={trip.trip_number}
                driverName={trip.driver?.name}
                loader1Name={loader1Name}
                loader2Name={loader2Name}
                activeOrders={activeOrders}
                expenses={expenses}
                currentUser={currentUser}
                isCurrentDriver={isCurrentDriver}
                totalRevenue={totalRevenue}
                totalPayroll={totalPayroll}
                totalExpenses={totalExpenses}
                netMargin={netMargin}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
