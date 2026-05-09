'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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

function fmtDay(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
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

  // Последние 5 месяцев включая текущий
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
      // последний день того месяца
      const last = new Date(year, month + 1, 0);
      onChange(last.toISOString().slice(0, 10));
    }
  };

  const curMonth = new Date(date).getMonth();
  const curYear = new Date(date).getFullYear();

  return (
    <div className="space-y-2">
      {/* Day navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => shift(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors text-slate-600 font-bold"
        >
          ‹
        </button>
        <div className="flex-1 text-center">
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => onChange(e.target.value)}
            className="text-sm font-semibold text-slate-800 border-0 bg-transparent cursor-pointer focus:outline-none text-center"
          />
        </div>
        <button
          onClick={() => shift(1)}
          disabled={date >= today}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors text-slate-600 font-bold disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ›
        </button>
      </div>

      {/* Month quick buttons */}
      <div className="flex gap-1">
        {months.map((m) => {
          const active = m.month === curMonth && m.year === curYear;
          return (
            <button
              key={`${m.year}-${m.month}`}
              onClick={() => goMonth(m.year, m.month)}
              className={cn(
                'flex-1 py-1 rounded text-[11px] font-bold uppercase tracking-wide transition-colors',
                active
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
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
    'w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Редактировать · Смена #{trip.trip_number}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {trip.asset.short_name} · {trip.driver.name}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl">
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          {orders.map((order, idx) => (
            <div key={order.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Заявка {idx + 1} · {order.counterparty?.name ?? '—'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
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
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
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
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
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
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Оплата
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

        {error && <p className="px-6 text-xs text-rose-600 font-medium">{error}</p>}

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 bg-slate-900 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
          <button
            onClick={onClose}
            className="px-4 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
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
  approving,
}: {
  trip: TripForReview;
  mode: 'review' | 'history';
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onApprove: () => void;
  onReturn: () => void;
  approving: boolean;
}) {
  const { activeOrders, expenses, revenue, driverPay, loaderPay, totalExpenses, mileage, profit } =
    calcTrip(trip);
  const totalCosts = driverPay + loaderPay + totalExpenses;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Collapsed header — always visible, clickable */}
      <div
        className="px-5 py-4 cursor-pointer hover:bg-slate-50/60 transition-colors select-none"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Left: shift info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-sm">🚚 {trip.asset.short_name}</span>
              <span className="text-slate-400 text-sm">·</span>
              <span className="text-sm text-slate-700 font-medium">{trip.driver.name}</span>
              {trip.loader && <span className="text-xs text-slate-400">+ {trip.loader.name}</span>}
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold uppercase tracking-wider">
                #{trip.trip_number}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              {new Date(trip.started_at).toLocaleDateString('ru-RU', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
              {' · '}
              {formatTime(trip.started_at)}
              {trip.ended_at && ` – ${formatTime(trip.ended_at)}`}
              {mileage > 0 && ` · ${mileage} км`}
            </p>

            {/* Summary stats — compact row */}
            <div className="flex flex-wrap gap-4 mt-2.5">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                  Выручка
                </span>
                <span className="text-sm font-bold text-slate-700">
                  <Money amount={revenue.toFixed(2)} />
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                  Расходы
                </span>
                <span className="text-sm font-bold text-rose-600">
                  −<Money amount={totalCosts.toFixed(2)} />
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                  Прибыль
                </span>
                <span
                  className={cn(
                    'text-sm font-black',
                    profit >= 0 ? 'text-emerald-600' : 'text-rose-600',
                  )}
                >
                  <Money amount={profit.toFixed(2)} />
                </span>
              </div>
            </div>
          </div>

          {/* Right: actions + chevron */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-700"
              title="Редактировать"
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
            </button>
            <span
              className={cn(
                'material-symbols-outlined text-slate-400 text-[20px] transition-transform duration-200',
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
        <>
          {/* Orders table */}
          <div className="border-t border-slate-100 overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-2 text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                    Клиент
                  </th>
                  <th className="px-5 py-2 text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                    Сумма
                  </th>
                  <th className="px-5 py-2 text-[10px] text-slate-500 uppercase tracking-wider font-bold text-right">
                    ЗП вод.
                  </th>
                  <th className="px-5 py-2 text-[10px] text-slate-500 uppercase tracking-wider font-bold text-center">
                    %
                  </th>
                  <th className="px-5 py-2 text-[10px] text-slate-500 uppercase tracking-wider font-bold text-right">
                    ЗП груз.
                  </th>
                  <th className="px-5 py-2 text-[10px] text-slate-500 uppercase tracking-wider font-bold">
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
                      <td className="px-5 py-2.5 text-sm font-medium text-slate-900">
                        {order.counterparty?.name ?? '—'}
                      </td>
                      <td className="px-5 py-2.5 text-sm font-semibold">
                        <Money amount={order.amount} />
                      </td>
                      <td className="px-5 py-2.5 text-sm text-right text-emerald-600 font-bold">
                        <Money amount={order.driver_pay} />
                      </td>
                      <td className="px-5 py-2.5 text-center text-slate-400 text-xs font-medium">
                        {split}%
                      </td>
                      <td className="px-5 py-2.5 text-sm text-right font-medium">
                        <Money amount={order.loader_pay} />
                      </td>
                      <td className="px-5 py-2.5">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                            PAYMENT_STYLES[order.payment_method] || 'bg-slate-100',
                          )}
                        >
                          {PAYMENT_LABELS[order.payment_method] || order.payment_method}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {expenses.map((exp) => (
                  <tr key={exp.id} className="bg-rose-50/40 hover:bg-rose-50/60 transition-colors">
                    <td className="px-5 py-2 text-rose-700 font-medium text-sm" colSpan={1}>
                      ↳ {exp.category?.name ?? 'Расход'}
                      {exp.description ? ` · ${exp.description}` : ''}
                    </td>
                    <td className="px-5 py-2 text-sm font-semibold text-rose-700">
                      −<Money amount={exp.amount} />
                    </td>
                    <td className="px-5 py-2 text-slate-300 text-right text-sm">—</td>
                    <td className="px-5 py-2 text-slate-300 text-center text-sm">—</td>
                    <td className="px-5 py-2 text-slate-300 text-right text-sm">—</td>
                    <td className="px-5 py-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-600">
                        {PAYMENT_LABELS[exp.payment_method] ?? exp.payment_method}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary bar */}
          <div className="px-5 py-3 grid grid-cols-5 gap-3 border-t border-slate-100 bg-slate-50/40">
            {[
              {
                label: 'Выручка',
                value: <Money amount={revenue.toFixed(2)} />,
                cls: 'text-slate-800',
              },
              {
                label: 'ЗП',
                value: (
                  <>
                    −<Money amount={(driverPay + loaderPay).toFixed(2)} />
                  </>
                ),
                cls: 'text-rose-600',
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
                cls: 'text-rose-600',
              },
              {
                label: 'Прибыль',
                value: <Money amount={profit.toFixed(2)} />,
                cls: profit >= 0 ? 'text-emerald-700 font-black' : 'text-rose-700 font-black',
              },
              { label: 'Пробег', value: `${mileage} км`, cls: 'text-slate-700' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  {label}
                </span>
                <span className={cn('text-sm font-semibold', cls)}>{value}</span>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          {mode === 'review' && (
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2 bg-white">
              <button
                onClick={onReturn}
                disabled={approving}
                className="px-4 py-2 border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1.5 uppercase tracking-tight disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">replay</span>
                Вернуть водителю
              </button>
              <button
                onClick={onApprove}
                disabled={approving}
                className="px-6 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1.5 uppercase tracking-tight disabled:opacity-50"
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

          {mode === 'history' && trip.driver_note && (
            <div className="px-5 py-3 border-t border-slate-100 bg-amber-50/50">
              <p className="text-xs text-amber-700 font-medium">
                📝 Заметка водителя: {trip.driver_note}
              </p>
            </div>
          )}
        </>
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

  return (
    <div className="space-y-5 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Ревью смен</h1>

        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setMode('review')}
              className={cn(
                'px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all',
                mode === 'review'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              На ревью {trips.length > 0 && mode === 'review' && `(${trips.length})`}
            </button>
            <button
              onClick={() => setMode('history')}
              className={cn(
                'px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all',
                mode === 'history'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              История
            </button>
          </div>
        </div>
      </div>

      {/* Date navigation — history only */}
      {mode === 'history' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <DateNav date={selectedDate} onChange={setSelectedDate} />
        </div>
      )}

      {/* Review mode: info bar */}
      {mode === 'review' && !isLoading && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {trips.length === 0
              ? 'Нет рейсов на ревью'
              : `${trips.length} рейс${trips.length === 1 ? '' : trips.length < 5 ? 'а' : 'ов'} ожидают утверждения`}
          </p>
          {trips.length > 0 && (
            <button
              onClick={() => setExpandedIds(new Set(trips.map((t) => t.id)))}
              className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
            >
              Развернуть все
            </button>
          )}
        </div>
      )}

      {/* History mode: date summary */}
      {mode === 'history' && !isLoading && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {fmtDay(selectedDate)}
            {trips.length > 0 &&
              ` · ${trips.length} рейс${trips.length === 1 ? '' : trips.length < 5 ? 'а' : 'ов'}`}
          </p>
          {trips.length > 0 && (
            <button
              onClick={() => setExpandedIds(new Set(trips.map((t) => t.id)))}
              className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
            >
              Развернуть все
            </button>
          )}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Trip cards */}
      {!isLoading && (
        <div className="space-y-3">
          {trips.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
              <span className="material-symbols-outlined text-slate-200 text-[64px] mb-4 block">
                {mode === 'review' ? 'check_circle' : 'search'}
              </span>
              <p className="text-slate-500 font-medium">
                {mode === 'review' ? 'Всё проверено' : 'Нет рейсов за эту дату'}
              </p>
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
                approving={approvingId === trip.id}
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
