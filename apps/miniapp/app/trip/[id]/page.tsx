'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Money, LifecycleBadge } from '@saldacargo/ui';
import { formatDuration, formatDate } from '@saldacargo/shared';
import { useState, useEffect } from 'react';

interface TripDetail {
  id: string;
  trip_number: number;
  status: string;
  lifecycle_status: string;
  started_at: string;
  trip_type: string;
  asset: { short_name: string; reg_number: string };
  driver: { name: string };
  loader: { name: string } | null;
  trip_orders: Array<{
    id: string;
    amount: string;
    driver_pay: string;
    loader_pay: string;
    payment_method: string;
    settlement_status: string;
    lifecycle_status: string;
    description: string | null;
    counterparty: { name: string } | null;
  }>;
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

  // id карточки, для которой открыто подтверждение удаления
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: trip, isLoading } = useQuery<TripDetail>({
    queryKey: ['trip', id],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${id}`);
      if (!res.ok) throw new Error('Рейс не найден');
      return res.json() as Promise<TripDetail>;
    },
    refetchInterval: 30000,
  });

  const deleteExpense = useMutation({
    mutationFn: (expenseId: string) =>
      fetch(`/api/trips/${id}/expenses/${expenseId}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) throw new Error('Ошибка удаления');
      }),
    onSuccess: () => {
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ['trip', id] });
    },
  });

  const cancelOrder = useMutation({
    mutationFn: (orderId: string) =>
      fetch(`/api/trips/${id}/orders/${orderId}`, { method: 'PATCH' }).then((r) => {
        if (!r.ok) throw new Error('Ошибка отмены');
      }),
    onSuccess: () => {
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ['trip', id] });
    },
  });

  const isMutating = deleteExpense.isPending || cancelOrder.isPending;

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
  const activeOrders = trip.trip_orders.filter((o) => o.lifecycle_status !== 'cancelled');

  const totals = {
    revenue: activeOrders.reduce((s, o) => s + parseFloat(o.amount), 0),
    driverPay: activeOrders.reduce((s, o) => s + parseFloat(o.driver_pay), 0),
    loaderPay: activeOrders.reduce((s, o) => s + parseFloat(o.loader_pay), 0),
    expenses: (trip.trip_expenses ?? []).reduce((s, e) => s + parseFloat(e.amount), 0),
  };

  return (
    <div className="min-h-screen bg-zinc-50 pb-40">
      {/* Шапка */}
      <header className="bg-white border-b-2 border-zinc-200 px-4 h-16 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="text-zinc-500 text-2xl active:scale-95 transition-transform"
          >
            ←
          </button>
          <span className="text-xl font-black text-zinc-900 uppercase tracking-tight">
            Рейс №{trip.trip_number}
          </span>
        </div>
        <LifecycleBadge
          status={trip.lifecycle_status as 'draft' | 'approved' | 'returned' | 'cancelled'}
        />
      </header>

      <main className="p-4 space-y-6 max-w-4xl mx-auto">
        {/* Status Card */}
        <section className="bg-white border-2 border-zinc-200 rounded-lg p-4 shadow-sm relative overflow-hidden flex flex-col justify-between items-start gap-1">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500"></div>
          <h1 className="font-black text-xl text-zinc-900 leading-tight">
            {trip.asset.short_name}{' '}
            <span className="text-zinc-400 font-bold ml-1">{trip.asset.reg_number}</span>
          </h1>
          <p className="font-bold text-sm text-zinc-500 uppercase tracking-wide">
            {trip.driver.name} {trip.loader ? `+ ${trip.loader.name}` : ''} ·{' '}
            {isActive ? <TripDuration startedAt={trip.started_at} /> : formatDate(trip.started_at)}
          </p>
        </section>

        {/* Summary Grid */}
        <section className="grid grid-cols-2 gap-3">
          <StatCard label="Заказы" value={activeOrders.length} />
          <StatCard
            label="Выручка"
            value={<Money amount={totals.revenue.toString()} />}
            highlighted
          />
          <StatCard label="ЗП Водителя" value={<Money amount={totals.driverPay.toString()} />} />
          <StatCard label="Расходы" value={<Money amount={totals.expenses.toString()} />} error />
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
              {activeOrders.map((order) => (
                <div key={order.id}>
                  {confirmDelete === order.id ? (
                    // Инлайн-подтверждение удаления
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
                    <div className="bg-white border-2 border-zinc-200 rounded-lg p-4 flex justify-between items-center relative overflow-hidden active:bg-zinc-50 transition-colors">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-300"></div>
                      <div className="flex-1 pl-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-zinc-400 text-lg">
                            {order.payment_method === 'cash'
                              ? '💵'
                              : order.payment_method === 'bank_invoice'
                                ? '🏦'
                                : order.payment_method === 'qr'
                                  ? '📱'
                                  : order.payment_method === 'debt_cash'
                                    ? '⏳'
                                    : '💳'}
                          </span>
                          <h3 className="font-bold text-zinc-900 text-sm uppercase tracking-tight">
                            {order.counterparty?.name ?? order.description ?? 'Без названия'}
                          </h3>
                        </div>
                        <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">
                          ЗП: <Money amount={order.driver_pay} />
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Money amount={order.amount} className="font-black text-lg text-zinc-900" />
                        {isActive && (
                          <button
                            onClick={() => setConfirmDelete(order.id)}
                            className="text-zinc-300 hover:text-red-400 active:scale-90 transition-all p-1"
                            aria-label="Отменить заказ"
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

        {/* Expenses */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pb-1 border-b-2 border-zinc-100">
            Расходы
          </h2>
          {(trip.trip_expenses ?? []).length === 0 ? (
            <div className="bg-zinc-100 border-2 border-zinc-200 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center opacity-60">
              <p className="font-bold text-zinc-400 uppercase tracking-tight text-xs">
                Расходов пока нет
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {trip.trip_expenses.map((expense) => (
                <div key={expense.id}>
                  {confirmDelete === expense.id ? (
                    // Инлайн-подтверждение удаления
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
                        {isActive && (
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
      </main>

      {/* Action Buttons */}
      {isActive && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-zinc-200 p-4 space-y-3 z-50">
          <div className="grid grid-cols-2 gap-3">
            <Link
              href={`/trip/${id}/order`}
              className="flex items-center justify-center gap-2 bg-orange-600 text-white rounded-lg h-12 font-black uppercase tracking-widest text-xs active:scale-95 transition-all shadow-md"
            >
              <span>➕</span> Заказ
            </Link>
            <Link
              href={`/trip/${id}/expense`}
              className="flex items-center justify-center gap-2 bg-zinc-800 text-white rounded-lg h-12 font-black uppercase tracking-widest text-xs active:scale-95 transition-all shadow-md"
            >
              <span>💸</span> Расход
            </Link>
          </div>
          <Link
            href={`/trip/${id}/finish`}
            className="flex items-center justify-center gap-2 w-full bg-zinc-900 text-white rounded-lg h-14 font-black uppercase tracking-widest shadow-lg active:scale-[0.98] transition-all"
          >
            <span>🏁</span> Завершить рейс
          </Link>
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
