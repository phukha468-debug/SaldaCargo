'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Money, LifecycleBadge } from '@saldacargo/ui';
import {
  formatDuration,
  formatDate,
  isGeostroyCounterparty,
  isGeostroyOrderValid,
  checkOdometerRequirement,
} from '@saldacargo/shared';
import { getDirectionLabel } from '@saldacargo/domain-payroll';
import { useState, useEffect, useRef } from 'react';

interface TripOrder {
  id: string;
  counterparty_id: string | null;
  direction?: string;
  is_driver_loader?: boolean;
  driver_car_pay?: string;
  driver_loader_pay?: string;
  loaders_data?: Array<{ id: string; name: string; pay: string }>;
  amount: string;
  driver_pay: string;
  loader_id?: string | null;
  loader_pay?: string;
  loader2_id?: string | null;
  loader2_pay?: string;
  payment_method: string;
  settlement_status: string;
  lifecycle_status: string;
  description: string | null;
  counterparty: { name: string } | null;
}

interface TripDetail {
  id: string;
  trip_number: number;
  status: string;
  lifecycle_status: string;
  started_at: string;
  trip_type: string;
  odometer_start?: number | null;
  odometer_end?: number | null;
  asset: {
    id?: string;
    short_name: string;
    reg_number: string;
    odometer_current?: number | null;
    asset_type?: { code?: string | null } | null;
    asset_type_code?: string | null;
  };
  driver: { name: string };
  trip_orders: TripOrder[];
  trip_expenses: Array<{
    id: string;
    amount: string;
    category: { name: string };
    payment_method: string;
    description: string | null;
  }>;
}

export default function TripDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDeleteTrip, setConfirmDeleteTrip] = useState(false);
  const [deleteTripError, setDeleteTripError] = useState<string | null>(null);
  const deleteTripTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: trip, isLoading } = useQuery<TripDetail>({
    queryKey: ['trip', id],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${id}`);
      if (!res.ok) throw new Error('Рейс не найден');
      return res.json() as Promise<TripDetail>;
    },
    staleTime: 20000,
    refetchInterval: 30000,
  });

  const deleteExpense = useMutation({
    mutationFn: async (expenseId: string) => {
      const r = await fetch(`/api/trips/${id}/expenses/${expenseId}`, { method: 'DELETE' });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? 'Ошибка удаления');
      return body;
    },
    onSuccess: () => {
      setConfirmDelete(null);
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ['trip', id] });
    },
    onError: (err: Error) => {
      setDeleteError(err.message);
    },
  });

  const cancelOrder = useMutation({
    mutationFn: (orderId: string) =>
      fetch(`/api/trips/${id}/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      }).then((r) => {
        if (!r.ok) throw new Error('Ошибка отмены');
      }),
    onSuccess: () => {
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ['trip', id] });
    },
  });

  const deleteTrip = useMutation({
    mutationFn: () =>
      fetch(`/api/trips/${id}`, { method: 'DELETE' }).then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? 'Ошибка удаления');
        return body;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-trips'] });
      queryClient.invalidateQueries({ queryKey: ['driver-summary'] });
      router.replace('/driver');
    },
    onError: (err: Error) => {
      setDeleteTripError(err.message);
      setConfirmDeleteTrip(false);
    },
  });

  const [finishError, setFinishError] = useState<string | null>(null);
  const [showOdometerModal, setShowOdometerModal] = useState(false);
  const [odometerInput, setOdometerInput] = useState('');
  const [odometerError, setOdometerError] = useState<string | null>(null);

  const finishTrip = useMutation({
    mutationFn: async (payload?: { odometer_end?: number } | void) => {
      const res = await fetch(`/api/trips/${id}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload ?? {}),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Ошибка завершения');
      return body;
    },
    onSuccess: () => {
      setShowOdometerModal(false);
      queryClient.invalidateQueries({ queryKey: ['trip', id] });
      queryClient.invalidateQueries({ queryKey: ['driver-trips'] });
      queryClient.invalidateQueries({ queryKey: ['driver-summary'] });
      router.replace('/driver');
    },
    onError: (err: Error) => {
      setFinishError(err.message);
      setOdometerError(err.message);
    },
  });

  function handleDeleteTripClick() {
    if (!confirmDeleteTrip) {
      setConfirmDeleteTrip(true);
      if (deleteTripTimerRef.current) clearTimeout(deleteTripTimerRef.current);
      deleteTripTimerRef.current = setTimeout(() => setConfirmDeleteTrip(false), 4000);
    } else {
      if (deleteTripTimerRef.current) clearTimeout(deleteTripTimerRef.current);
      deleteTrip.mutate();
    }
  }

  const isMutating = deleteExpense.isPending || cancelOrder.isPending || finishTrip.isPending;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="animate-spin text-3xl">⚙️</div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-4xl mb-4">🔍</p>
          <p className="text-zinc-600 font-bold uppercase tracking-tight">Рейс не найден</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 text-orange-600 font-black uppercase tracking-widest text-sm"
          >
            На главную
          </button>
        </div>
      </div>
    );
  }

  const isActive = trip.status === 'in_progress';
  const canEdit = trip.lifecycle_status !== 'approved';
  const isPrrTrip =
    trip.asset?.reg_number === 'БЕЗ АВТО' ||
    Boolean(trip.asset?.short_name?.includes('Без авто')) ||
    Boolean(trip.asset?.short_name?.includes('ПРР')) ||
    trip.trip_type === 'loaders_only';
  const activeOrders = (trip.trip_orders ?? []).filter((o) => o.lifecycle_status !== 'cancelled');
  const invalidGeostroyOrders = activeOrders.filter(
    (o) => isGeostroyCounterparty(o.counterparty?.name) && !isGeostroyOrderValid(o.description),
  );
  const hasGeostroyValidationError = invalidGeostroyOrders.length > 0;

  const totalExternalLoadersPay = activeOrders.reduce((sum, o) => {
    if (Array.isArray(o.loaders_data) && o.loaders_data.length > 0) {
      return sum + o.loaders_data.reduce((sub, l) => sub + (parseFloat(l.pay || '0') || 0), 0);
    }
    return sum + (parseFloat(o.loader_pay ?? '0') || 0) + (parseFloat(o.loader2_pay ?? '0') || 0);
  }, 0);

  const totals = {
    revenue: activeOrders.reduce((s, o) => s + (parseFloat(o.amount || '0') || 0), 0),
    driverPay: activeOrders.reduce((s, o) => s + (parseFloat(o.driver_pay || '0') || 0), 0),
    loadersPay: totalExternalLoadersPay,
    expenses: (trip.trip_expenses ?? []).reduce(
      (s, e) => s + (parseFloat(e.amount || '0') || 0),
      0,
    ),
  };

  const hasLoaders = totals.loadersPay > 0;

  return (
    <div className="min-h-screen bg-zinc-50 pb-40">
      {/* Шапка */}
      <header className="bg-white border-b-2 border-zinc-200 px-4 h-16 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const currentPath = window.location.pathname;
              const savedRole =
                typeof window !== 'undefined' ? localStorage.getItem('selected_role') : null;
              const fallbackUrl =
                savedRole === 'admin' || savedRole === 'owner' ? '/admin/trips' : '/driver';

              if (typeof window !== 'undefined' && window.history.length > 1) {
                router.back();
              } else {
                router.push(fallbackUrl);
              }

              // Надежная страховка если история не переключила страницу
              setTimeout(() => {
                if (window.location.pathname === currentPath) {
                  router.push(fallbackUrl);
                }
              }, 250);
            }}
            className="text-zinc-500 text-2xl active:scale-95 transition-transform cursor-pointer p-1 -ml-1"
            title="Назад"
          >
            ←
          </button>
          <span className="text-xl font-black text-zinc-900 uppercase tracking-tight">
            Рейс №{trip.trip_number}
          </span>
          {canEdit && !isActive && (
            <Link
              href={`/trip/${id}/edit`}
              className="text-[10px] font-black text-orange-600 uppercase tracking-wide bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 active:bg-orange-100 transition-colors"
            >
              ✏️ Изменить
            </Link>
          )}
        </div>
        <LifecycleBadge
          status={trip.lifecycle_status as 'draft' | 'approved' | 'returned' | 'cancelled'}
        />
      </header>

      <main className="p-4 space-y-6 max-w-4xl mx-auto">
        {/* Status Card */}
        <section className="bg-white border-2 border-zinc-200 rounded-lg p-4 shadow-sm relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500"></div>
          <div className="pl-2 space-y-1">
            <h1 className="font-black text-xl text-zinc-900 leading-tight">
              {trip.asset?.reg_number === 'БЕЗ АВТО' ? (
                <>
                  👷 Погрузо-разгрузочные работы{' '}
                  <span className="text-amber-600 text-xs font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md ml-1 align-middle">
                    Без авто
                  </span>
                </>
              ) : (
                <>
                  {trip.asset.short_name}{' '}
                  <span className="text-zinc-400 font-bold ml-1">{trip.asset.reg_number}</span>
                </>
              )}
            </h1>
            <p className="font-bold text-sm text-zinc-500 uppercase tracking-wide">
              {trip.driver.name} ·{' '}
              {isActive ? (
                <TripDuration startedAt={trip.started_at} />
              ) : (
                formatDate(trip.started_at)
              )}
            </p>
          </div>
        </section>

        {/* Summary Grid */}
        <section className="grid grid-cols-2 gap-3">
          <StatCard label="Заказы" value={activeOrders.length} />
          <StatCard
            label="Выручка"
            value={<Money amount={totals.revenue.toString()} />}
            highlighted
          />
          {isPrrTrip ? (
            <>
              <StatCard
                label="ЗП Грузчики (70%)"
                value={<Money amount={totals.loadersPay.toString()} />}
              />
              <StatCard
                label="Компания (30%)"
                value={
                  <Money amount={Math.max(0, totals.revenue - totals.loadersPay).toString()} />
                }
              />
            </>
          ) : (
            <>
              <StatCard
                label="ЗП Водителя"
                value={<Money amount={totals.driverPay.toString()} />}
              />
              <StatCard label="ГСМ" value={<Money amount={totals.expenses.toString()} />} error />
              {hasLoaders && (
                <StatCard
                  label="ЗП Грузчики"
                  value={<Money amount={totals.loadersPay.toString()} />}
                />
              )}
            </>
          )}
        </section>

        {/* Orders List */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pb-1 border-b-2 border-zinc-100">
            Текущие Заказы
          </h2>
          {activeOrders.length === 0 ? (
            <div className="bg-zinc-100 border-2 border-zinc-200 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center">
              <span className="text-4xl mb-2">📋</span>
              <p className="font-bold text-zinc-400 uppercase tracking-tight">Заказов пока нет</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeOrders.map((order) => {
                const dirLabel = getDirectionLabel(order.direction || 'local');
                const hasDriverLoaderPay =
                  order.is_driver_loader && parseFloat(order.driver_loader_pay || '0') > 0;
                const orderLoaders = Array.isArray(order.loaders_data) ? order.loaders_data : [];

                return (
                  <div key={order.id}>
                    {confirmDelete === order.id ? (
                      <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 flex items-center justify-between gap-3">
                        <p className="text-red-700 font-black text-xs uppercase tracking-wide flex-1">
                          Отменить заказ?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmDelete(null)}
                            disabled={isMutating}
                            className="px-3 py-2 bg-white border-2 border-zinc-200 rounded-lg text-xs font-black uppercase text-zinc-600 active:scale-95 transition-all"
                          >
                            Нет
                          </button>
                          <button
                            onClick={() => cancelOrder.mutate(order.id)}
                            disabled={isMutating}
                            className="px-3 py-2 bg-red-600 rounded-lg text-xs font-black uppercase text-white active:scale-95 transition-all disabled:opacity-50"
                          >
                            {cancelOrder.isPending ? '...' : 'Да'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white border-2 border-zinc-200 rounded-lg p-4 relative overflow-hidden space-y-2">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-300"></div>
                        <div className="pl-2 flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                              {order.payment_method === 'cash' ? (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-600 text-white shadow-xs">
                                  💵 Наличные
                                </span>
                              ) : order.payment_method === 'qr' ||
                                order.payment_method === 'card_driver' ? (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-purple-600 text-white shadow-xs">
                                  ⚡ QR-код
                                </span>
                              ) : order.payment_method === 'debt_cash' ? (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-600 text-white shadow-xs">
                                  ⏳ Долг
                                </span>
                              ) : (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-600 text-white shadow-xs">
                                  🏛️ Безнал
                                </span>
                              )}
                              <h3 className="font-bold text-zinc-900 text-sm uppercase tracking-tight truncate">
                                {order.counterparty?.name ?? order.description ?? 'Без названия'}
                              </h3>
                              {order.direction === 'loaders_only' ? (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                                  👷 Без машины
                                </span>
                              ) : (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">
                                  {dirLabel}
                                </span>
                              )}
                              {order.is_driver_loader && order.direction !== 'loaders_only' && (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
                                  🚚 Грузчик
                                </span>
                              )}
                            </div>

                            {isGeostroyCounterparty(order.counterparty?.name) &&
                              !isGeostroyOrderValid(order.description) && (
                                <div className="my-1.5 flex items-center justify-between bg-rose-50 border border-rose-300 rounded-lg px-2.5 py-1 text-[11px] text-rose-900 font-bold">
                                  <span>🛑 Укажите маршрут и дату (ДД.ММ.ГГГГ)</span>
                                  <Link
                                    href={`/trip/${id}/order/${order.id}`}
                                    className="text-rose-700 underline font-black ml-2"
                                  >
                                    Заполнить →
                                  </Link>
                                </div>
                              )}

                            {order.counterparty?.name && order.description && (
                              <p className="text-xs text-zinc-600 font-bold truncate mb-1">
                                📝 {order.description}
                              </p>
                            )}

                            {parseFloat(order.driver_pay || '0') > 0 && (
                              <p className="text-[11px] font-bold text-green-700 uppercase tracking-wide">
                                ЗП водителя: <Money amount={order.driver_pay} />
                                {order.direction === 'loaders_only' ? (
                                  <span className="ml-1 text-[10px] text-zinc-400 lowercase font-medium">
                                    (погрузка/разгрузка)
                                  </span>
                                ) : hasDriverLoaderPay ? (
                                  <span className="ml-1 text-[10px] text-zinc-400 lowercase font-medium">
                                    ({order.driver_car_pay} ₽ авто + {order.driver_loader_pay} ₽
                                    погрузка)
                                  </span>
                                ) : null}
                              </p>
                            )}

                            {orderLoaders.length > 0 ? (
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {orderLoaders.map((l, i) => (
                                  <span
                                    key={i}
                                    className="text-[10px] font-bold bg-blue-50 text-blue-800 px-2 py-0.5 rounded-md border border-blue-100"
                                  >
                                    👷 {l.name || 'Грузчик'}: {l.pay} ₽
                                  </span>
                                ))}
                              </div>
                            ) : parseFloat(order.loader_pay ?? '0') > 0 ? (
                              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-0.5">
                                Грузчики:{' '}
                                <Money
                                  amount={(
                                    parseFloat(order.loader_pay ?? '0') +
                                    parseFloat(order.loader2_pay ?? '0')
                                  ).toString()}
                                />
                              </p>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Money
                              amount={order.amount}
                              className="font-black text-lg text-zinc-900"
                            />
                            {canEdit && (
                              <div className="flex flex-col gap-1">
                                <Link
                                  href={`/trip/${id}/order/${order.id}`}
                                  className="text-zinc-400 hover:text-orange-500 active:scale-90 transition-all p-1 text-base leading-none"
                                  aria-label="Редактировать заказ"
                                >
                                  ✏️
                                </Link>
                                <button
                                  onClick={() => setConfirmDelete(order.id)}
                                  className="text-zinc-300 hover:text-red-400 active:scale-90 transition-all p-1 text-base leading-none"
                                  aria-label="Отменить заказ"
                                >
                                  🗑️
                                </button>
                              </div>
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
        </section>

        {/* Expenses */}
        {(!isPrrTrip || (trip.trip_expenses ?? []).length > 0) && (
          <section className="space-y-3">
            <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pb-1 border-b-2 border-zinc-100">
              Заправки (ГСМ)
            </h2>
            {deleteError && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 text-red-700 text-xs font-bold uppercase tracking-wide">
                {deleteError}
              </div>
            )}
            {(trip.trip_expenses ?? []).length === 0 ? (
              <div className="bg-zinc-100 border-2 border-zinc-200 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center opacity-60">
                <p className="font-bold text-zinc-400 uppercase tracking-tight text-xs">
                  Заправок пока нет
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {trip.trip_expenses.map((expense) => (
                  <div key={expense.id}>
                    {confirmDelete === expense.id ? (
                      <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 flex items-center justify-between gap-3">
                        <p className="text-red-700 font-black text-xs uppercase tracking-wide flex-1">
                          Удалить расход {expense.category.name}?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmDelete(null)}
                            disabled={isMutating}
                            className="px-3 py-2 bg-white border-2 border-zinc-200 rounded-lg text-xs font-black uppercase text-zinc-600 active:scale-95 transition-all"
                          >
                            Нет
                          </button>
                          <button
                            onClick={() => deleteExpense.mutate(expense.id)}
                            disabled={isMutating}
                            className="px-3 py-2 bg-red-600 rounded-lg text-xs font-black uppercase text-white active:scale-95 transition-all disabled:opacity-50"
                          >
                            {deleteExpense.isPending ? '...' : 'Да'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white border-2 border-zinc-200 rounded-lg p-4 flex justify-between items-center relative overflow-hidden active:bg-zinc-50 transition-colors">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-400"></div>
                        <div className="flex-1 pl-2">
                          <h3 className="font-bold text-zinc-900 text-sm uppercase tracking-tight">
                            {expense.category.name}
                          </h3>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                            {expense.description ??
                              (expense.payment_method === 'fuel_card' ? 'Топливо' : 'Расход')}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Money
                            amount={expense.amount}
                            className="font-black text-lg text-red-600"
                          />
                          {canEdit && (
                            <button
                              onClick={() => setConfirmDelete(expense.id)}
                              className="text-zinc-300 hover:text-red-400 active:scale-90 transition-all p-1"
                              aria-label="Удалить расход"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Delete Trip */}
        {canEdit && (
          <section className="pt-4 border-t-2 border-zinc-100">
            {deleteTripError && (
              <div className="mb-3 bg-red-50 border-2 border-red-200 rounded-lg p-3 text-red-700 text-xs font-bold uppercase tracking-wide">
                {deleteTripError}
              </div>
            )}
            <button
              onClick={handleDeleteTripClick}
              disabled={deleteTrip.isPending}
              className={`w-full rounded-lg h-12 font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50 ${
                confirmDeleteTrip
                  ? 'bg-red-600 text-white border-2 border-red-600'
                  : 'bg-white text-red-500 border-2 border-red-200'
              }`}
            >
              {deleteTrip.isPending
                ? 'Удаляем...'
                : confirmDeleteTrip
                  ? '⚠️ Нажмите ещё раз для подтверждения'
                  : '🗑️ Удалить рейс'}
            </button>
          </section>
        )}
      </main>

      {/* Action Buttons */}
      {isActive && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-zinc-200 p-4 space-y-3 z-50">
          {finishError && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 text-red-700 text-xs font-bold uppercase tracking-wide text-center">
              {finishError}
            </div>
          )}
          {isPrrTrip ? (
            <div>
              <Link
                href={`/trip/${id}/order`}
                className="flex items-center justify-center gap-2 w-full bg-orange-600 hover:bg-orange-500 text-white rounded-lg h-12 font-black uppercase tracking-widest text-xs active:scale-95 transition-all shadow-md"
              >
                <span>➕</span> Добавить заказ ПРР
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Link
                href={`/trip/${id}/order`}
                className="flex items-center justify-center gap-2 bg-orange-600 text-white rounded-lg h-12 font-black uppercase tracking-widest text-xs active:scale-95 transition-all shadow-md"
              >
                <span>➕</span> Заказ
              </Link>
              <Link
                href={`/trip/${id}/expense`}
                className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg h-12 font-black uppercase tracking-widest text-xs active:scale-95 transition-all shadow-md"
              >
                <span>⛽</span> ГСМ
              </Link>
            </div>
          )}
          {hasGeostroyValidationError && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-3 text-rose-900 space-y-1.5 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide">
                <span>🛑</span>
                <span>Нельзя отправить рейс на ревью</span>
              </div>
              <p className="text-[11px] font-medium text-rose-800 leading-tight">
                Для заказов с контрагентом «ООО Геостройиндустрия» необходимо заполнить Маршрут и
                дату начала (ДД.ММ.ГГГГ).
              </p>
            </div>
          )}
          {finishError && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-2.5 text-red-700 text-xs font-bold uppercase tracking-wide">
              {finishError}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              if (hasGeostroyValidationError) {
                setFinishError(
                  'Нельзя завершить рейс: для контрагента «ООО Геостройиндустрия» заполните маршрут и дату начала (ДД.ММ.ГГГГ).',
                );
                return;
              }
              if (isPrrTrip) {
                finishTrip.mutate();
                return;
              }
              setOdometerError(null);
              setOdometerInput(
                trip?.odometer_end
                  ? String(trip.odometer_end)
                  : trip?.odometer_start
                    ? String(trip.odometer_start)
                    : trip?.asset?.odometer_current
                      ? String(trip.asset.odometer_current)
                      : '',
              );
              setShowOdometerModal(true);
            }}
            disabled={finishTrip.isPending || hasGeostroyValidationError}
            className="flex items-center justify-center gap-2 w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg h-14 font-black uppercase tracking-widest shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <span>🏁</span>{' '}
            {finishTrip.isPending
              ? 'Завершаем смену...'
              : hasGeostroyValidationError
                ? '🛑 Заполните данные Геостройиндустрия'
                : 'Завершить рейс'}
          </button>
        </div>
      )}

      {showOdometerModal && trip && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => {
            if (!finishTrip.isPending) setShowOdometerModal(false);
          }}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border-t-2 sm:border-2 border-zinc-200 overflow-hidden p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-black text-zinc-900 uppercase tracking-tight">
                  🏁 Сдача смены (Рейс №{trip.trip_number})
                </h2>
                <p className="text-xs font-bold text-zinc-500 mt-0.5">
                  {trip.asset?.short_name} · {trip.asset?.reg_number}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOdometerModal(false)}
                disabled={finishTrip.isPending}
                className="text-zinc-400 hover:text-zinc-600 text-xl font-bold p-1 leading-none"
              >
                ✕
              </button>
            </div>

            {(() => {
              const odoReq = checkOdometerRequirement(trip.asset);
              const startOdo = trip.odometer_start ?? trip.asset?.odometer_current ?? 0;
              const inputNum = odometerInput.trim() ? Number(odometerInput) : null;
              const delta =
                inputNum && startOdo > 0 && inputNum >= startOdo ? inputNum - startOdo : null;
              const isInvalidLower = inputNum != null && startOdo > 0 && inputNum < startOdo;
              const isRequiredMissing = odoReq.required && (!inputNum || inputNum <= 0);

              return (
                <>
                  <div
                    className={`rounded-xl p-3 border text-xs font-medium ${
                      odoReq.required
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold uppercase tracking-wide text-[11px] mb-1">
                      <span>{odoReq.required ? '⚠️' : 'ℹ️'}</span>
                      <span>
                        {odoReq.reason === 'gazelle_shift'
                          ? 'Все Газели — обязательный одометр'
                          : odoReq.reason === 'truck_month_end'
                            ? 'Грузовик — обязательный одометр в конце месяца'
                            : 'Одометр на конец рейса'}
                      </span>
                    </div>
                    <p className="leading-relaxed">{odoReq.message}</p>
                  </div>

                  <div className="bg-zinc-50 rounded-xl p-3.5 border border-zinc-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-zinc-500">
                      <span>Начальный пробег:</span>
                      <span className="font-mono text-zinc-800">
                        {startOdo > 0
                          ? `${startOdo.toLocaleString('ru-RU')} км`
                          : 'Не зафиксирован'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-700">
                        Одометр на конец смены, км{' '}
                        {odoReq.required && <span className="text-red-500">*</span>}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={odometerInput}
                          onChange={(e) => {
                            setOdometerInput(e.target.value);
                            setOdometerError(null);
                          }}
                          placeholder={startOdo > 0 ? String(startOdo) : 'например, 145200'}
                          className="w-full rounded-lg border-2 border-zinc-300 px-4 h-14 text-2xl font-black text-zinc-900 focus:border-orange-500 focus:outline-none transition-colors"
                          autoFocus
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-400 uppercase">
                          км
                        </span>
                      </div>
                    </div>

                    {delta != null && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center text-xs font-black text-emerald-700">
                        Пробег за смену: +{delta.toLocaleString('ru-RU')} км
                      </div>
                    )}

                    {isInvalidLower && (
                      <div className="bg-rose-50 border border-rose-300 rounded-lg p-2 text-center text-xs font-bold text-rose-700">
                        Одометр не может быть меньше начального ({startOdo.toLocaleString('ru-RU')}{' '}
                        км)
                      </div>
                    )}
                  </div>

                  {(odometerError || finishError) && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-2.5 text-red-700 text-xs font-bold text-center">
                      {odometerError || finishError}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowOdometerModal(false)}
                      disabled={finishTrip.isPending}
                      className="w-1/3 h-12 rounded-lg border-2 border-zinc-200 font-bold text-xs uppercase tracking-wide text-zinc-600 hover:bg-zinc-100 active:scale-95 transition-all"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (isRequiredMissing) {
                          setOdometerError(
                            odoReq.reason === 'gazelle_shift'
                              ? 'Для Газелей ввод одометра обязателен при сдаче каждой смены'
                              : 'Для грузовиков в конце месяца ввод одометра обязателен',
                          );
                          return;
                        }
                        if (isInvalidLower) {
                          setOdometerError(
                            `Одометр не может быть меньше начального (${startOdo} км)`,
                          );
                          return;
                        }
                        finishTrip.mutate({
                          odometer_end: inputNum && inputNum > 0 ? inputNum : undefined,
                        });
                      }}
                      disabled={finishTrip.isPending || isInvalidLower || isRequiredMissing}
                      className="flex-1 h-12 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white rounded-lg font-black text-xs uppercase tracking-widest shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>🏁</span>
                      <span>{finishTrip.isPending ? 'Завершаем...' : 'Сдать смену'}</span>
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  highlighted = false,
  error = false,
}: {
  label: string;
  value: React.ReactNode;
  highlighted?: boolean;
  error?: boolean;
}) {
  return (
    <div className="bg-white border-2 border-zinc-200 rounded-lg p-3 flex flex-col items-center justify-center text-center shadow-sm">
      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">
        {label}
      </span>
      <span
        className={`text-lg font-black tracking-tight ${highlighted ? 'text-orange-600' : error ? 'text-red-600' : 'text-zinc-900'}`}
      >
        {value}
      </span>
    </div>
  );
}

function TripDuration({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const durationMin = Math.floor((now - new Date(startedAt).getTime()) / 60000);
  return <>{formatDuration(durationMin)}</>;
}
