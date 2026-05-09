'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Money } from '@saldacargo/ui';
import { formatTime } from '@saldacargo/shared';

interface TripForReview {
  id: string;
  trip_number: number;
  lifecycle_status: string;
  started_at: string;
  ended_at: string | null;
  trip_type: string;
  odometer_start: number;
  odometer_end: number | null;
  driver_note: string | null;
  asset: { short_name: string; reg_number: string };
  driver: { id: string; name: string };
  loader: { id: string; name: string } | null;
  trip_orders: Array<{
    id: string;
    amount: string;
    driver_pay: string;
    loader_pay: string;
    payment_method: string;
    settlement_status: string;
    lifecycle_status: string;
    counterparty: { name: string } | null;
  }>;
  trip_expenses: Array<{
    id: string;
    amount: string;
    payment_method: string;
    description: string | null;
    category: { name: string } | null;
  }>;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'НАЛИЧНЫЕ',
  qr: 'QR-КОД',
  bank_invoice: 'БЕЗНАЛ',
  debt_cash: 'ДОЛГ',
  card_driver: 'КАРТА',
};

const PAYMENT_STYLES: Record<string, string> = {
  cash: 'bg-amber-50 text-amber-700',
  qr: 'bg-purple-50 text-purple-700',
  bank_invoice: 'bg-slate-100 text-slate-600',
  debt_cash: 'bg-rose-50 text-rose-700',
  card_driver: 'bg-blue-50 text-blue-700',
};

export default function ReviewPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0] ?? '');
  const [mode, setMode] = useState<'review' | 'history'>('review');
  const [tab, setTab] = useState<'drivers' | 'mechanics'>('drivers');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: trips = [], isLoading } = useQuery<TripForReview[]>({
    queryKey: ['trips-review', selectedDate, mode],
    queryFn: async () => {
      const lifecycle = mode === 'review' ? 'draft' : 'approved';
      const url =
        mode === 'review'
          ? `/api/trips?lifecycle=${lifecycle}`
          : `/api/trips?lifecycle=${lifecycle}&date=${selectedDate}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch trips');
      }
      return res.json() as Promise<TripForReview[]>;
    },
  });

  async function handleApprove(tripId: string) {
    setApprovingId(tripId);
    try {
      const res = await fetch(`/api/trips/${tripId}/approve`, { method: 'POST' });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Ошибка при утверждении рейса');
      }
      await queryClient.invalidateQueries({ queryKey: ['trips-review'] });
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
      const res = await fetch(`/api/trips/${tripId}/return`, { method: 'POST' });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Ошибка при возврате рейса');
      }
      await queryClient.invalidateQueries({ queryKey: ['trips-review'] });
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <div className="p-gutter lg:p-container-padding space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Sub-header Filter Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="font-h1 text-h1 text-slate-900">Ревью смен</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Переключатель режима */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setMode('review')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all ${
                mode === 'review'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              На ревью
            </button>
            <button
              onClick={() => setMode('history')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all ${
                mode === 'history'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              История
            </button>
          </div>
          {/* Дата — только в режиме истории */}
          {mode === 'history' && (
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-white border border-slate-200 px-4 py-2 pr-10 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors focus:ring-1 focus:ring-slate-300 outline-none appearance-none"
              />
              <span className="material-symbols-outlined absolute right-3 top-2 text-slate-400 text-lg pointer-events-none">
                calendar_today
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-2 gap-4">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setTab('drivers')}
            className={`px-6 py-2 rounded-md text-sm font-semibold transition-all ${
              tab === 'drivers'
                ? 'bg-white shadow-sm text-slate-900'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Рейсы водителей
          </button>
          <button
            onClick={() => setTab('mechanics')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
              tab === 'mechanics'
                ? 'bg-white shadow-sm text-slate-900'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Наряды механиков
          </button>
        </div>
        <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 shadow-sm">
          <span className="material-symbols-outlined text-lg">task_alt</span>
          Утвердить всё
        </button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-6">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-white border border-slate-200 rounded-lg h-64 animate-pulse shadow-sm"
            />
          ))}
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 gap-6">
        {Array.isArray(trips) &&
          trips.map((trip) => {
            const activeOrders = trip.trip_orders.filter((o) => o.lifecycle_status !== 'cancelled');
            const expenses = trip.trip_expenses ?? [];
            const revenue = activeOrders.reduce((s, o) => s + parseFloat(o.amount), 0);
            const driverPay = activeOrders.reduce((s, o) => s + parseFloat(o.driver_pay), 0);
            const loaderPay = activeOrders.reduce((s, o) => s + parseFloat(o.loader_pay), 0);
            const totalExpenses = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
            const mileage = trip.odometer_end ? trip.odometer_end - trip.odometer_start : 0;
            const profit = revenue - driverPay - loaderPay - totalExpenses;

            return (
              <div
                key={trip.id}
                className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                {/* Card Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-h3 text-h3 text-slate-900">
                        🚚 {trip.asset.short_name} · {trip.driver.name}
                        {trip.loader && ` + ${trip.loader.name}`}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider">
                        СМЕНА #{trip.trip_number}
                      </span>
                    </div>
                    <div className="text-body-sm text-slate-500 mt-0.5 uppercase tracking-wide text-[11px] font-semibold">
                      {new Date(trip.started_at).toLocaleDateString('ru-RU', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}
                      {' • '}
                      {formatTime(trip.started_at)}
                      {trip.ended_at && ` – ${formatTime(trip.ended_at)}`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400">
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                    <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400">
                      <span className="material-symbols-outlined">more_vert</span>
                    </button>
                  </div>
                </div>

                {/* Dense Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-2.5 font-label-caps text-[10px] text-slate-500 uppercase tracking-wider">
                          КЛИЕНТ
                        </th>
                        <th className="px-6 py-2.5 font-label-caps text-[10px] text-slate-500 uppercase tracking-wider">
                          СУММА
                        </th>
                        <th className="px-6 py-2.5 font-label-caps text-[10px] text-slate-500 uppercase tracking-wider text-right">
                          ЗП ВОД.
                        </th>
                        <th className="px-6 py-2.5 font-label-caps text-[10px] text-slate-500 uppercase tracking-wider text-center">
                          % СПЛИТ
                        </th>
                        <th className="px-6 py-2.5 font-label-caps text-[10px] text-slate-500 uppercase tracking-wider text-right">
                          ЗП ГРУЗ.
                        </th>
                        <th className="px-6 py-2.5 font-label-caps text-[10px] text-slate-500 uppercase tracking-wider">
                          ОПЛАТА
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-body-sm">
                      {activeOrders.map((order) => {
                        const amountNum = parseFloat(order.amount);
                        const driverPayNum = parseFloat(order.driver_pay);
                        const splitPercent =
                          amountNum > 0 ? Math.round((driverPayNum / amountNum) * 100) : 0;

                        return (
                          <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-3 font-medium text-slate-900">
                              {order.counterparty?.name ?? '—'}
                            </td>
                            <td className="px-6 py-3 font-data-mono font-semibold">
                              <Money amount={order.amount} />
                            </td>
                            <td className="px-6 py-3 font-data-mono text-right text-emerald-600 font-bold">
                              <Money amount={order.driver_pay} />
                            </td>
                            <td className="px-6 py-3 text-center text-slate-400 font-medium">
                              {splitPercent}%
                            </td>
                            <td className="px-6 py-3 font-data-mono text-right font-medium">
                              <Money amount={order.loader_pay} />
                            </td>
                            <td className="px-6 py-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${PAYMENT_STYLES[order.payment_method] || 'bg-slate-100'}`}
                              >
                                {PAYMENT_LABELS[order.payment_method] || order.payment_method}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {expenses.map((exp) => (
                        <tr
                          key={exp.id}
                          className="bg-rose-50/40 hover:bg-rose-50/60 transition-colors"
                        >
                          <td className="px-6 py-2.5 text-rose-700 font-medium text-sm">
                            ↳ {exp.category?.name ?? 'Расход'}
                            {exp.description ? ` · ${exp.description}` : ''}
                          </td>
                          <td className="px-6 py-2.5 font-data-mono font-semibold text-rose-700">
                            −<Money amount={exp.amount} />
                          </td>
                          <td className="px-6 py-2.5 text-slate-300 text-right">—</td>
                          <td className="px-6 py-2.5 text-slate-300 text-center">—</td>
                          <td className="px-6 py-2.5 text-slate-300 text-right">—</td>
                          <td className="px-6 py-2.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-600">
                              {PAYMENT_LABELS[exp.payment_method] ?? exp.payment_method}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary Area */}
                <div className="px-6 py-3 grid grid-cols-2 md:grid-cols-5 gap-4 border-t border-slate-100 bg-slate-50/30">
                  <div className="flex flex-col">
                    <span className="font-label-caps text-[9px] text-slate-400 uppercase tracking-wider font-bold">
                      ВЫРУЧКА
                    </span>
                    <span className="font-data-mono text-sm font-semibold text-slate-900">
                      <Money amount={revenue.toString()} />
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-caps text-[9px] text-slate-400 uppercase tracking-wider font-bold">
                      ИТОГО ЗП
                    </span>
                    <span className="font-data-mono text-sm font-semibold text-rose-600">
                      -<Money amount={(driverPay + loaderPay).toString()} />
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-caps text-[9px] text-slate-400 uppercase tracking-wider font-bold">
                      РАСХОДЫ
                    </span>
                    <span className="font-data-mono text-sm font-semibold text-rose-600">
                      {totalExpenses > 0 ? (
                        <>
                          <span>−</span>
                          <Money amount={totalExpenses.toFixed(2)} />
                        </>
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-caps text-[9px] text-slate-400 uppercase tracking-wider font-bold">
                      ПРИБЫЛЬ
                    </span>
                    <span className="font-data-mono text-sm text-emerald-700 font-bold">
                      <Money amount={profit.toString()} />
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-caps text-[9px] text-slate-400 uppercase tracking-wider font-bold">
                      ПРОБЕГ
                    </span>
                    <span className="font-data-mono text-sm font-semibold text-slate-900">
                      {mileage} км
                    </span>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
                  <div className="flex gap-2">
                    <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded transition-colors flex items-center gap-2 uppercase tracking-tight shadow-sm">
                      <span className="material-symbols-outlined text-lg">photo_camera</span>
                      Фото одометров
                    </button>
                  </div>
                  {mode === 'review' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReturn(trip.id)}
                        disabled={approvingId === trip.id}
                        className="px-4 py-2 border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 text-[11px] font-bold rounded transition-colors flex items-center gap-2 uppercase tracking-tight shadow-sm disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-lg">replay</span>
                        Вернуть
                      </button>
                      <button
                        onClick={() => handleApprove(trip.id)}
                        disabled={approvingId === trip.id}
                        className="px-6 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-[11px] font-bold rounded transition-colors flex items-center gap-2 uppercase tracking-tight shadow-sm disabled:opacity-50"
                      >
                        <span
                          className="material-symbols-outlined text-lg"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          check_circle
                        </span>
                        {approvingId === trip.id ? '...' : 'Утвердить'}
                      </button>
                    </div>
                  )}
                  {mode === 'history' && (
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined !text-[14px]">check_circle</span>
                      Одобрено
                    </span>
                  )}
                </div>
              </div>
            );
          })}

        {!isLoading && trips.length === 0 && (
          <div className="text-center py-20 bg-white border border-slate-200 rounded-lg shadow-sm">
            <span className="material-symbols-outlined text-slate-200 text-[64px] mb-4">
              {mode === 'review' ? 'check_circle' : 'search'}
            </span>
            <p className="text-slate-500 font-medium">
              {mode === 'review' ? 'Нет рейсов на ревью' : 'Нет одобренных рейсов за эту дату'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
