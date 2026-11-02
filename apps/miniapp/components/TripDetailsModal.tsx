/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Money, LifecycleBadge } from '@saldacargo/ui';
import { formatDate } from '@saldacargo/shared';

interface TripDetailsModalProps {
  tripId: string | null;
  onClose: () => void;
}

export function TripDetailsModal({ tripId, onClose }: TripDetailsModalProps) {
  const { data: trip, isLoading } = useQuery({
    queryKey: ['trip-modal', tripId],
    queryFn: async () => {
      if (!tripId) return null;
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) throw new Error('Не удалось загрузить данные рейса');
      return res.json();
    },
    enabled: Boolean(tripId),
    staleTime: 30000,
  });

  if (!tripId) return null;

  const orders = (trip?.trip_orders ?? []).filter((o: any) => o.lifecycle_status !== 'cancelled');
  const revenue = orders.reduce((s: number, o: any) => s + (parseFloat(o.amount) || 0), 0);
  const driverPay = orders.reduce((s: number, o: any) => s + (parseFloat(o.driver_pay) || 0), 0);
  const expenses = (trip?.trip_expenses ?? []).reduce(
    (s: number, e: any) => s + (parseFloat(e.amount) || 0),
    0,
  );

  const mileage =
    trip?.odometer_end != null &&
    trip?.odometer_start != null &&
    trip.odometer_end >= trip.odometer_start
      ? trip.odometer_end - trip.odometer_start
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{
        background: 'rgba(0,0,0,0.5)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 60px)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
        {/* Ручка шторки */}
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-zinc-200 rounded-full" />
        </div>

        {/* Заголовок модалки */}
        <div className="px-4 py-2 border-b border-zinc-100 flex items-center justify-between flex-shrink-0">
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-black text-zinc-900 text-base">
                Рейс №{trip?.trip_number ?? '...'}
              </h2>
              {trip?.lifecycle_status && (
                <LifecycleBadge
                  status={trip.lifecycle_status as 'draft' | 'approved' | 'returned' | 'cancelled'}
                />
              )}
            </div>
            <p className="text-[11px] text-zinc-500 font-medium truncate mt-0.5">
              {trip?.asset?.short_name ?? 'Без авто'}{' '}
              {trip?.asset?.reg_number && `(${trip.asset.reg_number})`} ·{' '}
              {trip?.started_at ? formatDate(trip.started_at) : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 text-lg font-bold shrink-0 active:scale-95 transition-transform"
          >
            ×
          </button>
        </div>

        {/* Тело модалки */}
        <div className="p-4 space-y-3 overflow-y-auto">
          {isLoading ? (
            <div className="py-8 space-y-3 text-center">
              <div className="animate-spin text-2xl">⚙️</div>
              <p className="text-xs text-zinc-400 font-bold uppercase">Загрузка деталей рейса...</p>
            </div>
          ) : !trip ? (
            <p className="text-center py-6 text-xs text-red-500 font-bold">
              Не удалось загрузить данные
            </p>
          ) : (
            <>
              {/* Компактная сводка в 1 строку */}
              <div className="bg-zinc-50 rounded-xl p-2.5 border border-zinc-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase block">
                    Выручка
                  </span>
                  <Money amount={revenue.toString()} className="font-black text-zinc-900" />
                </div>
                <div className="border-l border-zinc-200 pl-3">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase block">
                    ЗП водит.
                  </span>
                  <Money amount={driverPay.toString()} className="font-black text-green-600" />
                </div>
                {expenses > 0 && (
                  <div className="border-l border-zinc-200 pl-3">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase block">ГСМ</span>
                    <Money amount={expenses.toString()} className="font-black text-red-600" />
                  </div>
                )}
                {mileage != null && (
                  <div className="border-l border-zinc-200 pl-3">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase block">
                      Пробег
                    </span>
                    <span className="font-black text-zinc-800">
                      {mileage.toLocaleString('ru-RU')} км
                    </span>
                  </div>
                )}
              </div>

              {/* Список заказов и клиенты */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                    Клиенты и заказы ({orders.length})
                  </span>
                </div>

                {orders.length === 0 ? (
                  <div className="p-3 text-center text-xs text-zinc-400 font-medium bg-zinc-50 rounded-xl border border-zinc-100">
                    В этом рейсе нет заказов
                  </div>
                ) : (
                  <div className="space-y-2">
                    {orders.map((order: any) => {
                      const clientName =
                        order.counterparty?.name || order.description || 'Клиент не указан';
                      const payMethodLabel =
                        order.payment_method === 'cash'
                          ? '💵 Нал'
                          : order.payment_method === 'qr' || order.payment_method === 'card_driver'
                            ? '⚡ QR'
                            : order.payment_method === 'debt_cash'
                              ? '⏳ Долг'
                              : '🏛️ Безнал';

                      const payMethodColor =
                        order.payment_method === 'cash'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : order.payment_method === 'qr' || order.payment_method === 'card_driver'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : order.payment_method === 'debt_cash'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200';

                      return (
                        <div
                          key={order.id}
                          className="bg-white rounded-xl p-2.5 border border-zinc-200 shadow-2xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border shrink-0 ${payMethodColor}`}
                              >
                                {payMethodLabel}
                              </span>
                              <span className="font-black text-zinc-900 text-xs truncate">
                                {clientName}
                              </span>
                            </div>
                            <Money
                              amount={order.amount}
                              className="font-black text-xs text-zinc-900 shrink-0"
                            />
                          </div>

                          {/* Описание / маршрут если отличается от названия клиента */}
                          {order.description && order.counterparty?.name && (
                            <p className="text-[11px] text-zinc-600 font-medium truncate">
                              📝 {order.description}
                            </p>
                          )}

                          {/* ЗП и грузчики по заказу */}
                          <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-0.5 border-t border-zinc-100">
                            {parseFloat(order.driver_pay || '0') > 0 ? (
                              <span className="font-bold text-green-700">
                                ЗП водителя: <Money amount={order.driver_pay} />
                              </span>
                            ) : (
                              <span>—</span>
                            )}

                            {Array.isArray(order.loaders_data) && order.loaders_data.length > 0 ? (
                              <span className="font-medium text-blue-700 truncate">
                                👷 Грузчики: {order.loaders_data.map((l: any) => l.name).join(', ')}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Расходы рейса если есть */}
              {(trip.trip_expenses ?? []).length > 0 && (
                <div>
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">
                    Расходы рейса
                  </span>
                  <div className="space-y-1">
                    {trip.trip_expenses.map((exp: any) => (
                      <div
                        key={exp.id}
                        className="bg-zinc-50 rounded-lg px-2.5 py-1.5 border border-zinc-200 flex items-center justify-between text-xs"
                      >
                        <span className="font-bold text-zinc-700 truncate">
                          ⛽ {exp.category?.name || 'Расход'}{' '}
                          {exp.description ? `(${exp.description})` : ''}
                        </span>
                        <Money
                          amount={exp.amount}
                          className="font-black text-red-600 text-xs shrink-0 ml-2"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Футер: переход на страницу рейса */}
        <div className="p-3 border-t border-zinc-100 bg-white flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/trip/${tripId}`}
            onClick={onClose}
            className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white rounded-xl font-black uppercase tracking-wider text-xs shadow-xs text-center transition-all"
          >
            Открыть рейс полностью →
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-zinc-200 text-zinc-700 rounded-xl font-bold uppercase tracking-wider text-xs active:bg-zinc-50"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
