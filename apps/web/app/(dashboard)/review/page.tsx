'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect } from 'react';
import { Money } from '@saldacargo/ui';
import { formatTime } from '@saldacargo/shared';
import { cn } from '@saldacargo/ui';

interface TripOrder {
  id: string;
  amount: string;
  driver_pay: string;
  loader_pay: string;
  payment_method: string;
  settlement_status: string;
  lifecycle_status: string;
  counterparty: { name: string } | null;
}

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
  trip_orders: TripOrder[];
  trip_expenses: Array<{
    id: string;
    amount: string;
    payment_method: string;
    description: string | null;
    category: { name: string } | null;
  }>;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Наличные',
  qr: 'QR-код',
  bank_invoice: 'Безнал',
  debt_cash: 'Долг',
  card_driver: 'Карта',
};

const PAYMENT_STYLES: Record<string, string> = {
  cash: 'bg-amber-50 text-amber-700 border-amber-200',
  qr: 'bg-purple-50 text-purple-700 border-purple-200',
  bank_invoice: 'bg-slate-100 text-slate-600 border-slate-200',
  debt_cash: 'bg-rose-50 text-rose-700 border-rose-200',
  card_driver: 'bg-blue-50 text-blue-700 border-blue-200',
};

// ── Helpers ────────────────────────────────────────────────

function calcTrip(trip: TripForReview) {
  const activeOrders = trip.trip_orders.filter((o) => o.lifecycle_status !== 'cancelled');
  const expenses = trip.trip_expenses ?? [];
  const revenue = activeOrders.reduce((s, o) => s + parseFloat(o.amount), 0);
  const driverPay = activeOrders.reduce((s, o) => s + parseFloat(o.driver_pay), 0);
  const loaderPay = activeOrders.reduce((s, o) => s + parseFloat(o.loader_pay), 0);
  const totalExpenses = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
  const mileage = trip.odometer_end ? trip.odometer_end - trip.odometer_start : 0;
  const profit = revenue - driverPay - loaderPay - totalExpenses;
  return { activeOrders, expenses, revenue, driverPay, loaderPay, totalExpenses, mileage, profit };
}

// ── Date Navigation ─────────────────────────────────────────

function DateNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const today = new Date().toISOString().slice(0, 10);

  const shift = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    const s = d.toISOString().slice(0, 10);
    if (s <= today) onChange(s);
  };

  const months = Array.from({ length: 5 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (4 - i));
    return {
      label: d.toLocaleDateString('ru-RU', { month: 'short' }),
      year: d.getFullYear(),
      month: d.getMonth(),
    };
  });

  const goMonth = (year: number, month: number) => {
    const now = new Date();
    if (year === now.getFullYear() && month === now.getMonth()) {
      onChange(today);
    } else {
      const last = new Date(year, month + 1, 0);
      onChange(last.toISOString().slice(0, 10));
    }
  };

  const curMonth = new Date(date).getMonth();
  const curYear = new Date(date).getFullYear();
  const isToday = date === today;

  return (
    <div className="bg-white rounded-2xl border border-sky-100 shadow-sm overflow-hidden">
      {/* Day nav */}
      <div className="flex items-stretch">
        <button
          onClick={() => shift(-1)}
          className="flex items-center justify-center w-40 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 transition-colors text-white shrink-0 group border-r border-sky-400"
          aria-label="Предыдущий день"
        >
          <span className="text-4xl font-black group-hover:-translate-x-1 transition-transform select-none">
            ←
          </span>
        </button>

        <div className="flex-1 flex items-center justify-center py-3 gap-3">
          <label className="cursor-pointer flex flex-col items-center gap-0.5">
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => e.target.value && onChange(e.target.value)}
              className="sr-only"
            />
            <span className="text-[10px] font-bold text-sky-400 uppercase tracking-[0.15em]">
              {isToday ? 'Сегодня' : 'Выбранная дата'}
            </span>
            <span className="text-xl font-black text-slate-900 leading-tight hover:text-sky-600 transition-colors text-center">
              {new Date(date + 'T12:00:00').toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
              })}
            </span>
            <span className="text-xs font-medium text-slate-400">
              {new Date(date + 'T12:00:00').toLocaleDateString('ru-RU', {
                weekday: 'long',
                year: 'numeric',
              })}
            </span>
          </label>
          {!isToday && (
            <button
              onClick={() => onChange(today)}
              className="text-[10px] font-bold text-sky-600 hover:text-sky-800 transition-colors bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-full border border-sky-200 whitespace-nowrap"
            >
              → сегодня
            </button>
          )}
        </div>

        <button
          onClick={() => shift(1)}
          disabled={date >= today}
          className="flex items-center justify-center w-40 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 transition-colors text-white shrink-0 disabled:bg-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed group border-l border-sky-400 disabled:border-slate-200"
          aria-label="Следующий день"
        >
          <span className="text-4xl font-black group-hover:translate-x-1 transition-transform select-none">
            →
          </span>
        </button>
      </div>

      {/* Month quick buttons */}
      <div className="flex border-t border-sky-50">
        {months.map((m) => {
          const active = m.month === curMonth && m.year === curYear;
          return (
            <button
              key={`${m.year}-${m.month}`}
              onClick={() => goMonth(m.year, m.month)}
              className={cn(
                'flex-1 py-2 text-[11px] font-bold uppercase tracking-wide transition-all border-r border-sky-50 last:border-r-0',
                active
                  ? 'bg-sky-500 text-white'
                  : 'text-slate-400 hover:bg-sky-50 hover:text-sky-700',
              )}
            >
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Edit Modal ──────────────────────────────────────────────

function EditModal({
  trip,
  onClose,
  onSaved,
}: {
  trip: TripForReview;
  onClose: () => void;
  onSaved: () => void;
}) {
  const activeOrders = trip.trip_orders.filter((o) => o.lifecycle_status !== 'cancelled');
  const [orders, setOrders] = useState(activeOrders.map((o) => ({ ...o })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (id: string, field: keyof TripOrder, value: string) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, [field]: value } : o)));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    const res = await fetch(`/api/trips/${trip.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? 'Ошибка');
      return;
    }
    onSaved();
  };

  const inputCls =
    'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-black text-slate-900 text-lg">
              Редактирование · Смена #{trip.trip_number}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {trip.asset.short_name} · {trip.driver.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 text-xl transition-colors"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {orders.map((order, idx) => (
            <div
              key={order.id}
              className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50"
            >
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Заявка {idx + 1}
                {order.counterparty?.name ? ` · ${order.counterparty.name}` : ''}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Сумма, ₽
                  </label>
                  <input
                    type="number"
                    className={inputCls}
                    value={order.amount}
                    onChange={(e) => update(order.id, 'amount', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    ЗП водителя, ₽
                  </label>
                  <input
                    type="number"
                    className={inputCls}
                    value={order.driver_pay}
                    onChange={(e) => update(order.id, 'driver_pay', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    ЗП грузчика, ₽
                  </label>
                  <input
                    type="number"
                    className={inputCls}
                    value={order.loader_pay}
                    onChange={(e) => update(order.id, 'loader_pay', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Способ оплаты
                  </label>
                  <select
                    className={inputCls}
                    value={order.payment_method}
                    onChange={(e) => update(order.id, 'payment_method', e.target.value)}
                  >
                    {Object.entries(PAYMENT_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="mx-6 mb-4 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl">
            <p className="text-sm text-rose-700 font-medium">{error}</p>
          </div>
        )}

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 bg-slate-900 text-white text-sm font-bold py-3 rounded-xl hover:bg-slate-700 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
          <button
            onClick={onClose}
            className="px-5 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors font-medium"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Trip Card ───────────────────────────────────────────────

function TripCard({
  trip,
  mode,
  expanded,
  onToggle,
  onEdit,
  onApprove,
  onReturn,
  onDelete,
  approving,
  deleting,
}: {
  trip: TripForReview;
  mode: 'review' | 'history';
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onApprove: () => void;
  onReturn: () => void;
  onDelete: () => void;
  approving: boolean;
  deleting: boolean;
}) {
  const { activeOrders, expenses, revenue, driverPay, loaderPay, totalExpenses, mileage, profit } =
    calcTrip(trip);
  const totalCosts = driverPay + loaderPay + totalExpenses;
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accentColor =
    profit > 0 ? 'border-l-emerald-400' : profit < 0 ? 'border-l-rose-400' : 'border-l-slate-300';

  const handleDeleteClick = () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      deleteTimer.current = setTimeout(() => setDeleteConfirm(false), 4000);
    } else {
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
      setDeleteConfirm(false);
      onDelete();
    }
  };

  useEffect(() => {
    if (!expanded) {
      setDeleteConfirm(false);
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
    }
  }, [expanded]);

  return (
    <div
      className={cn(
        'bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-shadow duration-200 hover:shadow-md border-l-4',
        accentColor,
      )}
    >
      {/* Collapsed header */}
      <div
        className="px-5 py-4 cursor-pointer hover:bg-slate-50/60 transition-colors select-none"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Left: info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-slate-900 text-sm">🚚 {trip.asset.short_name}</span>
              <span className="text-slate-300">·</span>
              <span className="text-sm text-slate-700 font-semibold">{trip.driver.name}</span>
              {trip.loader && (
                <span className="text-xs text-slate-400 font-medium">+ {trip.loader.name}</span>
              )}
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[10px] font-bold uppercase tracking-wider">
                #{trip.trip_number}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-1.5">
              {formatTime(trip.started_at)}
              {trip.ended_at && ` — ${formatTime(trip.ended_at)}`}
              {mileage > 0 && ` · ${mileage} км`}
              {activeOrders.length > 0 &&
                ` · ${activeOrders.length} заявк${activeOrders.length === 1 ? 'а' : activeOrders.length < 5 ? 'и' : ''}`}
            </p>

            {/* Key metrics row */}
            <div className="flex flex-wrap items-end gap-5 mt-3">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">
                  Выручка
                </span>
                <span className="text-base font-bold text-slate-800">
                  <Money amount={revenue.toFixed(2)} />
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">
                  Расходы
                </span>
                <span className="text-base font-bold text-rose-500">
                  −<Money amount={totalCosts.toFixed(2)} />
                </span>
              </div>
              <div className="ml-auto">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5 text-right">
                  Прибыль
                </span>
                <span
                  className={cn(
                    'text-xl font-black',
                    profit > 0
                      ? 'text-emerald-600'
                      : profit < 0
                        ? 'text-rose-600'
                        : 'text-slate-500',
                  )}
                >
                  {profit >= 0 ? '' : '−'}
                  <Money amount={Math.abs(profit).toFixed(2)} />
                </span>
              </div>
            </div>
          </div>

          {/* Right: edit + chevron */}
          <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-700"
              title="Редактировать заказы"
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
            </button>
            <span
              className={cn(
                'material-symbols-outlined text-slate-400 text-[20px] transition-transform duration-300',
                expanded ? 'rotate-180' : '',
              )}
            >
              expand_more
            </span>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Orders table */}
          <div className="border-t border-slate-100 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-5 py-2.5 text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                    Клиент
                  </th>
                  <th className="px-5 py-2.5 text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                    Сумма
                  </th>
                  <th className="px-5 py-2.5 text-[10px] text-slate-500 uppercase tracking-wider font-bold text-right">
                    ЗП вод.
                  </th>
                  <th className="px-5 py-2.5 text-[10px] text-slate-500 uppercase tracking-wider font-bold text-center">
                    %
                  </th>
                  <th className="px-5 py-2.5 text-[10px] text-slate-500 uppercase tracking-wider font-bold text-right">
                    ЗП груз.
                  </th>
                  <th className="px-5 py-2.5 text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                    Оплата
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {activeOrders.map((order) => {
                  const amt = parseFloat(order.amount);
                  const dp = parseFloat(order.driver_pay);
                  const split = amt > 0 ? Math.round((dp / amt) * 100) : 0;
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 text-sm font-semibold text-slate-900">
                        {order.counterparty?.name ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-sm font-bold text-slate-800">
                        <Money amount={order.amount} />
                      </td>
                      <td className="px-5 py-3 text-sm text-right text-emerald-600 font-bold">
                        <Money amount={order.driver_pay} />
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {split}%
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-right font-medium text-slate-600">
                        <Money amount={order.loader_pay} />
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-[10px] font-bold border',
                            PAYMENT_STYLES[order.payment_method] || 'bg-slate-100 border-slate-200',
                          )}
                        >
                          {PAYMENT_LABELS[order.payment_method] || order.payment_method}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {expenses.map((exp) => (
                  <tr key={exp.id} className="bg-rose-50/40 hover:bg-rose-50/70 transition-colors">
                    <td className="px-5 py-2.5 text-rose-700 font-semibold text-sm">
                      ↳ {exp.category?.name ?? 'Расход'}
                      {exp.description ? (
                        <span className="text-rose-400 font-normal"> · {exp.description}</span>
                      ) : null}
                    </td>
                    <td className="px-5 py-2.5 text-sm font-bold text-rose-600">
                      −<Money amount={exp.amount} />
                    </td>
                    <td className="px-5 py-2.5 text-slate-300 text-right text-sm">—</td>
                    <td className="px-5 py-2.5 text-slate-300 text-center text-sm">—</td>
                    <td className="px-5 py-2.5 text-slate-300 text-right text-sm">—</td>
                    <td className="px-5 py-2.5">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold border bg-rose-50 text-rose-600 border-rose-200">
                        {PAYMENT_LABELS[exp.payment_method] ?? exp.payment_method}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary bar */}
          <div className="px-5 py-4 grid grid-cols-5 gap-3 border-t border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            {[
              {
                label: 'Выручка',
                value: <Money amount={revenue.toFixed(2)} />,
                cls: 'text-slate-800 text-base font-black',
              },
              {
                label: 'ЗП итого',
                value: (
                  <>
                    −<Money amount={(driverPay + loaderPay).toFixed(2)} />
                  </>
                ),
                cls: 'text-rose-600 text-base font-bold',
              },
              {
                label: 'Расходы',
                value:
                  totalExpenses > 0 ? (
                    <>
                      −<Money amount={totalExpenses.toFixed(2)} />
                    </>
                  ) : (
                    '—'
                  ),
                cls: 'text-rose-600 text-base font-bold',
              },
              {
                label: 'Прибыль',
                value: (
                  <>
                    {profit < 0 ? '−' : ''}
                    <Money amount={Math.abs(profit).toFixed(2)} />
                  </>
                ),
                cls: cn(
                  'text-lg font-black',
                  profit > 0 ? 'text-emerald-700' : profit < 0 ? 'text-rose-700' : 'text-slate-500',
                ),
              },
              {
                label: 'Пробег',
                value: `${mileage} км`,
                cls: 'text-slate-700 text-base font-bold',
              },
            ].map(({ label, value, cls }) => (
              <div key={label} className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  {label}
                </span>
                <span className={cn(cls)}>{value}</span>
              </div>
            ))}
          </div>

          {/* Driver note */}
          {trip.driver_note && (
            <div className="px-5 py-3 border-t border-amber-100 bg-amber-50/60">
              <p className="text-sm text-amber-800 font-medium">
                <span className="font-bold">Заметка водителя:</span> {trip.driver_note}
              </p>
            </div>
          )}

          {/* Action bar */}
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-white">
            {/* Delete button — left side */}
            <button
              onClick={handleDeleteClick}
              disabled={deleting}
              className={cn(
                'flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all',
                deleteConfirm
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200',
              )}
            >
              <span className="material-symbols-outlined text-[15px]">
                {deleteConfirm ? 'warning' : 'delete_outline'}
              </span>
              {deleting
                ? 'Удаление...'
                : deleteConfirm
                  ? 'Нажмите снова — удалить рейс!'
                  : 'Удалить'}
            </button>

            {/* Approve/return — right side, review mode only */}
            {mode === 'review' && (
              <div className="flex gap-2">
                <button
                  onClick={onReturn}
                  disabled={approving}
                  className="px-4 py-2 border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 uppercase tracking-tight disabled:opacity-50 active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">replay</span>
                  Вернуть водителю
                </button>
                <button
                  onClick={onApprove}
                  disabled={approving}
                  className="px-6 py-2 bg-emerald-500 text-white hover:bg-emerald-600 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 uppercase tracking-tight disabled:opacity-50 shadow-sm shadow-emerald-200 active:scale-95"
                >
                  <span
                    className="material-symbols-outlined text-base"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  {approving ? '...' : 'Утвердить'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function ReviewPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [mode, setMode] = useState<'review' | 'history'>('review');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editTrip, setEditTrip] = useState<TripForReview | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
  });

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['trips-review'] });

  async function handleApprove(tripId: string) {
    setApprovingId(tripId);
    try {
      const res = await fetch(`/api/trips/${tripId}/approve`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || 'Ошибка');
      }
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
      const res = await fetch(`/api/trips/${tripId}/return`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || 'Ошибка');
      }
      refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setApprovingId(null);
    }
  }

  async function handleDelete(tripId: string) {
    setDeletingId(tripId);
    try {
      const res = await fetch(`/api/trips/${tripId}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || 'Ошибка');
      }
      refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  // Aggregate stats for review mode
  const totalRevenue = trips.reduce((s, t) => s + calcTrip(t).revenue, 0);
  const totalProfit = trips.reduce((s, t) => s + calcTrip(t).profit, 0);

  return (
    <div className="space-y-5 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Ревью смен</h1>
          {mode === 'review' && trips.length > 0 && (
            <p className="text-sm text-slate-500 mt-0.5">
              {trips.length} рейс{trips.length === 1 ? '' : trips.length < 5 ? 'а' : 'ов'} ожидают ·{' '}
              <span className="font-semibold text-slate-700">
                <Money amount={totalRevenue.toFixed(2)} />
              </span>{' '}
              выручка ·{' '}
              <span
                className={cn('font-bold', totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600')}
              >
                <Money amount={totalProfit.toFixed(2)} />
              </span>{' '}
              прибыль
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setMode('review')}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all',
                mode === 'review'
                  ? 'bg-amber-500 text-white shadow-sm shadow-amber-200'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              На ревью{trips.length > 0 && mode === 'review' ? ` (${trips.length})` : ''}
            </button>
            <button
              onClick={() => setMode('history')}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all',
                mode === 'history'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              История
            </button>
          </div>
        </div>
      </div>

      {/* Date navigation — history only */}
      {mode === 'history' && <DateNav date={selectedDate} onChange={setSelectedDate} />}

      {/* Summary line */}
      {!isLoading && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {mode === 'history' ? (
              <>
                <span className="font-semibold text-slate-700">
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('ru-RU', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'long',
                  })}
                </span>
                {trips.length > 0
                  ? ` · ${trips.length} рейс${trips.length < 5 ? (trips.length === 1 ? '' : 'а') : 'ов'}`
                  : ' · нет рейсов'}
              </>
            ) : trips.length === 0 ? (
              'Нет рейсов на ревью — всё проверено!'
            ) : null}
          </p>
          {trips.length > 0 && (
            <button
              onClick={() =>
                setExpandedIds((prev) =>
                  prev.size === trips.length ? new Set() : new Set(trips.map((t) => t.id)),
                )
              }
              className="text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">
                {expandedIds.size === trips.length ? 'unfold_less' : 'unfold_more'}
              </span>
              {expandedIds.size === trips.length ? 'Свернуть все' : 'Развернуть все'}
            </button>
          )}
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Trip cards */}
      {!isLoading && (
        <div className="space-y-3">
          {trips.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-14 text-center shadow-sm">
              <span className="material-symbols-outlined text-slate-200 text-[72px] mb-4 block">
                {mode === 'review' ? 'check_circle' : 'search'}
              </span>
              <p className="text-slate-500 font-semibold text-lg">
                {mode === 'review' ? 'Всё проверено' : 'Нет рейсов за эту дату'}
              </p>
              {mode === 'review' && (
                <p className="text-slate-400 text-sm mt-1">Новые рейсы появятся здесь</p>
              )}
            </div>
          ) : (
            trips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                mode={mode}
                expanded={expandedIds.has(trip.id)}
                onToggle={() => toggleExpand(trip.id)}
                onEdit={() => setEditTrip(trip)}
                onApprove={() => handleApprove(trip.id)}
                onReturn={() => handleReturn(trip.id)}
                onDelete={() => handleDelete(trip.id)}
                approving={approvingId === trip.id}
                deleting={deletingId === trip.id}
              />
            ))
          )}
        </div>
      )}

      {/* Edit modal */}
      {editTrip && (
        <EditModal
          trip={editTrip}
          onClose={() => setEditTrip(null)}
          onSaved={() => {
            setEditTrip(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
