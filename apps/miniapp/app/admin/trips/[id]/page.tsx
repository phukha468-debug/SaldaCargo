/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Money, LifecycleBadge } from '@saldacargo/ui';
import { formatDate } from '@saldacargo/shared';

export default function AdminTripDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const queryClient = useQueryClient();
  const [returnNote, setReturnNote] = useState('');
  const [showReturnForm, setShowReturnForm] = useState(false);

  const { data: trip, isLoading } = useQuery<any>({
    queryKey: ['admin-trip', id],
    queryFn: () => fetch(`/api/admin/trips/${id}`).then((r) => r.json()),
    staleTime: 0,
  });

  const action = useMutation({
    mutationFn: (body: { action: 'approve' | 'return'; note?: string }) =>
      fetch(`/api/admin/trips/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['admin-summary'] });
      router.push('/admin/trips?filter=review');
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!trip) return null;

  const activeOrders = (trip.trip_orders ?? []).filter(
    (o: any) => o.lifecycle_status !== 'cancelled',
  );
  const revenue = activeOrders.reduce((s: number, o: any) => s + parseFloat(o.amount), 0);
  const driverPay = activeOrders.reduce((s: number, o: any) => s + parseFloat(o.driver_pay), 0);
  const expenses = (trip.trip_expenses ?? []).reduce(
    (s: number, e: any) => s + parseFloat(e.amount),
    0,
  );
  const mileage =
    trip.odometer_end && trip.odometer_start ? trip.odometer_end - trip.odometer_start : null;

  const isPendingReview = trip.status === 'completed' && trip.lifecycle_status === 'draft';

  const PAYMENT_LABELS: Record<string, string> = {
    cash: '💵 Нал',
    qr: '📱 QR',
    bank_invoice: '🏦 Безнал',
    debt_cash: '⏳ Долг',
    card_driver: '💳 Карта',
    fuel_card: '⛽ Топл.карта',
  };

  return (
    <div className="min-h-screen bg-zinc-50 pb-40">
      <header className="bg-white border-b-2 border-zinc-200 px-4 h-16 flex items-center gap-3 sticky top-0 z-40">
        <button onClick={() => router.back()} className="text-zinc-500 text-2xl">
          ←
        </button>
        <span className="font-black text-zinc-900 text-lg uppercase">Рейс №{trip.trip_number}</span>
        <div className="ml-auto">
          <LifecycleBadge status={trip.lifecycle_status} />
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Общая информация */}
        <section className="bg-white rounded-2xl border-2 border-zinc-100 p-4 shadow-sm space-y-2">
          <p className="font-black text-zinc-900">
            {trip.asset?.short_name}{' '}
            <span className="text-zinc-400 font-bold">{trip.asset?.reg_number}</span>
          </p>
          <p className="text-sm font-bold text-zinc-500">
            {trip.driver?.name} · {formatDate(trip.started_at)}
          </p>
          {mileage && <p className="text-sm font-bold text-zinc-500">Пробег: {mileage} км</p>}
          {trip.driver_note && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                Заметка водителя
              </p>
              <p className="text-sm text-amber-900 mt-1">{trip.driver_note}</p>
            </div>
          )}
        </section>

        {/* Итоги */}
        <section className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border-2 border-zinc-100 p-3 text-center shadow-sm">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Выручка</p>
            <Money amount={revenue.toString()} className="text-base font-black text-orange-600" />
          </div>
          <div className="bg-white rounded-2xl border-2 border-zinc-100 p-3 text-center shadow-sm">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">ЗП</p>
            <Money amount={driverPay.toString()} className="text-base font-black text-green-600" />
          </div>
          <div className="bg-white rounded-2xl border-2 border-zinc-100 p-3 text-center shadow-sm">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Расходы</p>
            <Money amount={expenses.toString()} className="text-base font-black text-red-500" />
          </div>
        </section>

        {/* Заказы */}
        <section className="space-y-2">
          <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
            Заказы ({activeOrders.length})
          </h2>
          {activeOrders.map((order: any) => (
            <div
              key={order.id}
              className="bg-white rounded-xl border border-zinc-100 p-3 flex justify-between items-center shadow-sm"
            >
              <div>
                <p className="font-bold text-zinc-900 text-sm">
                  {order.counterparty?.name ?? order.description ?? 'Без названия'}
                </p>
                <p className="text-[10px] text-zinc-400 font-bold uppercase mt-0.5">
                  {PAYMENT_LABELS[order.payment_method] ?? order.payment_method} · ЗП:{' '}
                  <Money amount={order.driver_pay} />
                </p>
              </div>
              <Money amount={order.amount} className="font-black text-zinc-900" />
            </div>
          ))}
        </section>

        {/* Расходы */}
        {(trip.trip_expenses ?? []).length > 0 && (
          <section className="space-y-2">
            <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
              Расходы ({trip.trip_expenses.length})
            </h2>
            {trip.trip_expenses.map((exp: any) => (
              <div
                key={exp.id}
                className="bg-white rounded-xl border border-zinc-100 p-3 flex justify-between items-center shadow-sm"
              >
                <div>
                  <p className="font-bold text-zinc-900 text-sm">{exp.category?.name}</p>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase mt-0.5">
                    {PAYMENT_LABELS[exp.payment_method] ?? exp.payment_method}
                    {exp.description ? ` · ${exp.description}` : ''}
                  </p>
                </div>
                <Money amount={exp.amount} className="font-black text-red-500" />
              </div>
            ))}
          </section>
        )}
      </main>

      {/* Кнопки действий (только для рейсов на ревью) */}
      {isPendingReview && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-zinc-200 p-4 space-y-3 z-50">
          {showReturnForm ? (
            <div className="space-y-3">
              <textarea
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
                placeholder="Причина возврата (необязательно)"
                rows={2}
                className="w-full rounded-lg border-2 border-zinc-200 px-3 py-2 text-sm font-bold focus:border-orange-500 focus:outline-none resize-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowReturnForm(false)}
                  className="h-12 rounded-lg border-2 border-zinc-200 font-black text-xs uppercase text-zinc-600 active:scale-95 transition-all"
                >
                  Отмена
                </button>
                <button
                  onClick={() => action.mutate({ action: 'return', note: returnNote })}
                  disabled={action.isPending}
                  className="h-12 rounded-lg bg-amber-500 text-white font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
                >
                  {action.isPending ? '...' : '↩ Вернуть'}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowReturnForm(true)}
                disabled={action.isPending}
                className="h-14 rounded-2xl border-2 border-amber-300 bg-amber-50 text-amber-700 font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
              >
                ↩ Вернуть
              </button>
              <button
                onClick={() => action.mutate({ action: 'approve' })}
                disabled={action.isPending}
                className="h-14 rounded-2xl bg-green-600 text-white font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-md disabled:opacity-50"
              >
                {action.isPending ? '...' : '✓ Одобрить'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
