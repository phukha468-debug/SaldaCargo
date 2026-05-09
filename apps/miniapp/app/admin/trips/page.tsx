/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { Money, LifecycleBadge, cn } from '@saldacargo/ui';
import { formatDate, formatTime } from '@saldacargo/shared';

// ── Константы ────────────────────────────────────────────────

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Наличные',
  qr: 'QR',
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

// ── Вспомогательные функции ──────────────────────────────────

function calcTrip(trip: any) {
  const activeOrders = (trip.trip_orders ?? []).filter(
    (o: any) => o.lifecycle_status !== 'cancelled',
  );
  const expenses = trip.trip_expenses ?? [];
  const revenue = activeOrders.reduce((s: number, o: any) => s + parseFloat(o.amount), 0);
  const driverPay = activeOrders.reduce((s: number, o: any) => s + parseFloat(o.driver_pay), 0);
  const loaderPay = activeOrders.reduce(
    (s: number, o: any) => s + parseFloat(o.loader_pay ?? '0'),
    0,
  );
  const totalExpenses = expenses.reduce((s: number, e: any) => s + parseFloat(e.amount), 0);
  const mileage =
    trip.odometer_end && trip.odometer_start ? trip.odometer_end - trip.odometer_start : null;
  const profit = revenue - driverPay - loaderPay - totalExpenses;
  return { activeOrders, expenses, revenue, driverPay, loaderPay, totalExpenses, mileage, profit };
}

// ── DateNav (мобильная навигация по датам) ──────────────────

function DateNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const today = new Date().toISOString().slice(0, 10);

  const shift = (days: number) => {
    const d = new Date(date + 'T12:00:00');
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

  const dt = new Date(date + 'T12:00:00');
  const curMonth = dt.getMonth();
  const curYear = dt.getFullYear();
  const isToday = date === today;

  const dateLabel = dt.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    weekday: 'short',
  });

  return (
    <div className="bg-zinc-900">
      {/* Навигация по дням */}
      <div className="flex items-stretch h-14">
        <button
          onClick={() => shift(-1)}
          className="flex items-center justify-center w-16 bg-sky-600 active:bg-sky-700 transition-colors text-white shrink-0"
          aria-label="Предыдущий день"
        >
          <span className="text-2xl font-black select-none">←</span>
        </button>

        <label className="flex-1 flex items-center justify-center gap-2 cursor-pointer px-2">
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && onChange(e.target.value)}
            className="sr-only"
          />
          <span className="text-white font-black text-sm text-center leading-tight">
            {dateLabel}
          </span>
          {!isToday && (
            <span className="text-[9px] font-bold text-sky-300 bg-sky-600/30 border border-sky-500/30 px-1.5 py-0.5 rounded-full whitespace-nowrap">
              → сег.
            </span>
          )}
        </label>

        <button
          onClick={() => shift(1)}
          disabled={date >= today}
          className="flex items-center justify-center w-16 bg-sky-600 active:bg-sky-700 transition-colors text-white shrink-0 disabled:bg-zinc-800 disabled:text-zinc-600"
          aria-label="Следующий день"
        >
          <span className="text-2xl font-black select-none">→</span>
        </button>
      </div>

      {/* Быстрые кнопки месяцев */}
      <div className="flex border-t border-zinc-800">
        {months.map((m) => {
          const active = m.month === curMonth && m.year === curYear;
          return (
            <button
              key={`${m.year}-${m.month}`}
              onClick={() => goMonth(m.year, m.month)}
              className={cn(
                'flex-1 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors border-r border-zinc-800 last:border-r-0',
                active
                  ? 'bg-sky-600 text-white'
                  : 'text-zinc-500 active:bg-zinc-800 active:text-zinc-200',
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

// ── Итоги за день ────────────────────────────────────────────

function DailyTotals({ trips }: { trips: any[] }) {
  const totalRevenue = trips.reduce((s, t) => s + calcTrip(t).revenue, 0);
  const totalCosts = trips.reduce((s, t) => {
    const c = calcTrip(t);
    return s + c.driverPay + c.loaderPay + c.totalExpenses;
  }, 0);
  const totalProfit = trips.reduce((s, t) => s + calcTrip(t).profit, 0);

  return (
    <div className="mx-4 mb-4 rounded-2xl bg-zinc-900 text-white overflow-hidden">
      <div className="px-4 py-2 border-b border-zinc-800">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
          Итого за день · {trips.length} рейс
          {trips.length === 1 ? '' : trips.length < 5 ? 'а' : 'ов'}
        </span>
      </div>
      <div className="flex px-4 py-3 gap-0">
        <div className="flex-1 text-center">
          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">
            Выручка
          </p>
          <p className="font-black text-white text-sm">
            <Money amount={totalRevenue.toFixed(2)} />
          </p>
        </div>
        <div className="text-zinc-700 flex items-center text-sm px-1">−</div>
        <div className="flex-1 text-center">
          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">
            Расходы
          </p>
          <p className="font-black text-rose-400 text-sm">
            <Money amount={totalCosts.toFixed(2)} />
          </p>
        </div>
        <div className="text-zinc-700 flex items-center text-sm px-1">=</div>
        <div className="flex-1 text-center">
          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">
            Прибыль
          </p>
          <p
            className={cn(
              'font-black text-base',
              totalProfit > 0
                ? 'text-emerald-400'
                : totalProfit < 0
                  ? 'text-rose-400'
                  : 'text-zinc-400',
            )}
          >
            {totalProfit < 0 ? '−' : ''}
            <Money amount={Math.abs(totalProfit).toFixed(2)} />
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Модал редактирования (мобильный bottom-sheet) ────────────

function EditModal({
  trip,
  onClose,
  onSaved,
}: {
  trip: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const activeOrders = (trip.trip_orders ?? []).filter(
    (o: any) => o.lifecycle_status !== 'cancelled',
  );
  const [orders, setOrders] = useState(activeOrders.map((o: any) => ({ ...o })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (id: string, field: string, value: string) => {
    setOrders((prev: any[]) => prev.map((o: any) => (o.id === id ? { ...o, [field]: value } : o)));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    const res = await fetch(`/api/admin/trips/${trip.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit_orders', orders }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? 'Ошибка сохранения');
      return;
    }
    onSaved();
  };

  const inputCls =
    'w-full border border-zinc-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-zinc-400 transition-all';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Хэндл */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-zinc-200 rounded-full" />
        </div>

        {/* Заголовок */}
        <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h2 className="font-black text-zinc-900 text-base">
              Рейс #{trip.trip_number} · {trip.asset?.short_name}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">{trip.driver?.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 text-xl font-bold active:bg-zinc-200"
          >
            ×
          </button>
        </div>

        {/* Список заказов */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {orders.map((order: any, idx: number) => (
            <div key={order.id} className="space-y-3">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                Заявка {idx + 1}
                {order.counterparty?.name ? ` · ${order.counterparty.name}` : ''}
              </p>
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5">
                  Сумма, ₽
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  className={inputCls}
                  value={order.amount}
                  onChange={(e) => update(order.id, 'amount', e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5">
                  ЗП водителя, ₽
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  className={inputCls}
                  value={order.driver_pay}
                  onChange={(e) => update(order.id, 'driver_pay', e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5">
                  ЗП грузчика, ₽
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  className={inputCls}
                  value={order.loader_pay}
                  onChange={(e) => update(order.id, 'loader_pay', e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5">
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
              {idx < orders.length - 1 && <div className="border-t border-zinc-100" />}
            </div>
          ))}
        </div>

        {error && (
          <div className="mx-5 mb-3 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl">
            <p className="text-sm text-rose-700 font-medium">{error}</p>
          </div>
        )}

        {/* Кнопки */}
        <div className="px-5 pb-8 pt-3 flex gap-3 border-t border-zinc-100">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 bg-zinc-900 text-white font-black py-4 rounded-2xl active:bg-zinc-700 disabled:opacity-50 transition-all text-sm"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            onClick={onClose}
            className="px-5 text-sm text-zinc-500 border border-zinc-200 rounded-2xl active:bg-zinc-50 font-bold"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

// ── История: карточка рейса (expandable) ─────────────────────

function HistoryTripCard({
  trip,
  onEdit,
  onApprove,
  onReturn,
  approving,
}: {
  trip: any;
  onEdit: (t: any) => void;
  onApprove: (id: string) => void;
  onReturn: (id: string) => void;
  approving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { activeOrders, expenses, revenue, driverPay, loaderPay, totalExpenses, mileage, profit } =
    calcTrip(trip);
  const totalCosts = driverPay + loaderPay + totalExpenses;
  const canReview = trip.status === 'completed' && trip.lifecycle_status === 'draft';

  return (
    <div
      className={cn(
        'bg-white rounded-2xl border-2 overflow-hidden shadow-sm transition-shadow',
        canReview ? 'border-orange-300' : 'border-zinc-100',
      )}
    >
      {/* Акцентная полоска + заголовок */}
      <button
        className="w-full text-left active:bg-zinc-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-stretch">
          <div
            className={cn(
              'w-1 shrink-0',
              profit > 0 ? 'bg-emerald-400' : profit < 0 ? 'bg-rose-400' : 'bg-zinc-200',
            )}
          />
          <div className="flex-1 p-4">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-black text-zinc-900 text-sm">
                    {trip.asset?.short_name ?? '—'}
                  </span>
                  <span className="text-[9px] font-bold bg-zinc-100 text-zinc-400 px-1.5 py-0.5 rounded">
                    #{trip.trip_number}
                  </span>
                  <LifecycleBadge status={trip.lifecycle_status} />
                </div>
                <p className="text-[11px] text-zinc-400 font-medium">
                  {trip.driver?.name ?? '—'} · {formatTime(trip.started_at)}
                  {trip.ended_at ? `–${formatTime(trip.ended_at)}` : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-black text-zinc-900 text-base">
                  <Money amount={revenue.toFixed(2)} />
                </p>
                <p
                  className={cn(
                    'text-xs font-bold',
                    profit >= 0 ? 'text-emerald-600' : 'text-rose-500',
                  )}
                >
                  {profit < 0 ? '−' : '+'}
                  <Money amount={Math.abs(profit).toFixed(2)} />
                </p>
              </div>
              <span
                className={cn(
                  'text-zinc-300 text-xl shrink-0 mt-0.5 transition-transform duration-200',
                  expanded ? 'rotate-180' : '',
                )}
              >
                ↓
              </span>
            </div>
          </div>
        </div>
      </button>

      {/* Развёрнутый контент */}
      {expanded && (
        <div className="border-t border-zinc-100">
          {/* Заказы */}
          <div className="px-4 py-3 space-y-3">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Заявки</p>
            {activeOrders.length === 0 ? (
              <p className="text-xs text-zinc-400">Нет заявок</p>
            ) : (
              activeOrders.map((order: any, i: number) => {
                const amt = parseFloat(order.amount);
                const dp = parseFloat(order.driver_pay);
                const lp = parseFloat(order.loader_pay ?? '0');
                const split = amt > 0 ? Math.round((dp / amt) * 100) : 0;
                return (
                  <div key={order.id} className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">
                        {order.counterparty?.name ?? `Заявка ${i + 1}`}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-emerald-600 font-medium">
                          ЗП {split}% · <Money amount={order.driver_pay} />
                        </span>
                        {lp > 0 && (
                          <span className="text-[11px] text-blue-500 font-medium">
                            Груз: <Money amount={order.loader_pay} />
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-zinc-800 text-sm">
                        <Money amount={order.amount} />
                      </p>
                      <span
                        className={cn(
                          'text-[9px] font-bold px-1.5 py-0.5 rounded border',
                          PAYMENT_STYLES[order.payment_method] ??
                            'bg-zinc-100 border-zinc-200 text-zinc-500',
                        )}
                      >
                        {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Расходы */}
          {expenses.length > 0 && (
            <div className="px-4 pb-3 space-y-2 border-t border-zinc-50 pt-3">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                Расходы
              </p>
              {expenses.map((exp: any) => (
                <div key={exp.id} className="flex items-center justify-between text-sm gap-2">
                  <span className="text-rose-500 font-medium truncate flex-1">
                    ↳ {exp.category?.name ?? 'Расход'}
                    {exp.description ? (
                      <span className="text-rose-400 font-normal"> · {exp.description}</span>
                    ) : null}
                  </span>
                  <span className="font-bold text-rose-600 shrink-0">
                    −<Money amount={exp.amount} />
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Итоги */}
          <div className="grid grid-cols-3 border-t border-zinc-100 bg-zinc-50">
            <div className="text-center px-2 py-3 border-r border-zinc-100">
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                Выручка
              </p>
              <p className="font-bold text-zinc-800 text-sm">
                <Money amount={revenue.toFixed(2)} />
              </p>
            </div>
            <div className="text-center px-2 py-3 border-r border-zinc-100">
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                Расходы
              </p>
              <p className="font-bold text-rose-500 text-sm">
                <Money amount={totalCosts.toFixed(2)} />
              </p>
            </div>
            <div className="text-center px-2 py-3">
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                Прибыль
              </p>
              <p
                className={cn(
                  'font-black text-sm',
                  profit >= 0 ? 'text-emerald-600' : 'text-rose-600',
                )}
              >
                {profit < 0 ? '−' : ''}
                <Money amount={Math.abs(profit).toFixed(2)} />
              </p>
            </div>
          </div>

          {/* Пробег + заметка водителя */}
          {(mileage || trip.driver_note) && (
            <div className="px-4 py-2.5 border-t border-zinc-100 flex items-center gap-3">
              {mileage !== null && mileage > 0 && (
                <span className="text-xs text-zinc-500">
                  🛣 <span className="font-bold">{mileage} км</span>
                </span>
              )}
              {trip.driver_note && (
                <span className="text-xs text-amber-700 flex-1">
                  💬 <span className="font-medium">{trip.driver_note}</span>
                </span>
              )}
            </div>
          )}

          {/* Действия */}
          <div className="px-4 pb-4 pt-3 border-t border-zinc-100 flex items-center gap-2">
            <button
              onClick={() => onEdit(trip)}
              className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 border border-zinc-200 px-4 py-2.5 rounded-xl active:bg-zinc-100 shrink-0"
            >
              ✏️ Изменить
            </button>
            {canReview && (
              <>
                <button
                  onClick={() => onReturn(trip.id)}
                  disabled={approving}
                  className="flex-1 text-xs font-bold text-red-600 border border-red-200 bg-red-50 py-2.5 rounded-xl active:bg-red-100 text-center disabled:opacity-50"
                >
                  Вернуть
                </button>
                <button
                  onClick={() => onApprove(trip.id)}
                  disabled={approving}
                  className="flex-1 text-xs font-black text-white bg-emerald-500 py-2.5 rounded-xl active:bg-emerald-600 text-center disabled:opacity-50 shadow-sm"
                >
                  {approving ? '...' : '✓ Одобрить'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Режим "На ревью" / "Активные": простые карточки (ссылки) ─

function SimpleTripCard({ trip }: { trip: any }) {
  const activeOrders = (trip.trip_orders ?? []).filter(
    (o: any) => o.lifecycle_status !== 'cancelled',
  );
  const revenue = activeOrders.reduce((s: number, o: any) => s + parseFloat(o.amount), 0);
  const driverPay = activeOrders.reduce((s: number, o: any) => s + parseFloat(o.driver_pay), 0);
  const expenses = (trip.trip_expenses ?? []).reduce(
    (s: number, e: any) => s + parseFloat(e.amount),
    0,
  );
  const isPendingReview = trip.status === 'completed' && trip.lifecycle_status === 'draft';

  return (
    <Link href={`/admin/trips/${trip.id}`}>
      <div
        className={cn(
          'bg-white rounded-2xl p-4 border-2 shadow-sm active:scale-[0.98] transition-all relative overflow-hidden',
          isPendingReview ? 'border-orange-300' : 'border-zinc-100',
        )}
      >
        <div
          className={cn(
            'absolute left-0 top-0 bottom-0 w-1',
            isPendingReview ? 'bg-orange-500' : 'bg-zinc-300',
          )}
        />
        <div className="pl-2">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="font-black text-zinc-900 text-sm">
                №{trip.trip_number} · {trip.asset?.short_name ?? '—'}
              </span>
              <p className="text-[10px] text-zinc-400 font-bold uppercase mt-0.5">
                {trip.driver?.name ?? '—'} · {formatDate(trip.started_at)}
              </p>
            </div>
            <LifecycleBadge status={trip.lifecycle_status} />
          </div>
          <div className="flex gap-4 text-xs">
            <span className="text-zinc-900 font-bold">
              Выручка: <Money amount={revenue.toString()} className="font-black" />
            </span>
            <span className="text-green-600 font-bold">
              ЗП: <Money amount={driverPay.toString()} />
            </span>
            {expenses > 0 && (
              <span className="text-red-500 font-bold">
                Расх: <Money amount={expenses.toString()} />
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Скелетон загрузки ────────────────────────────────────────

function Skeleton() {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-zinc-200 rounded-2xl h-20" />
      ))}
    </div>
  );
}

// ── Основной контент ─────────────────────────────────────────

function TripsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const filter = (searchParams.get('filter') ?? 'review') as 'review' | 'active' | 'history';
  const queryClient = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [editTrip, setEditTrip] = useState<any>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Запрос для review/active
  const { data: simpleTrips = [], isLoading: simpleLoading } = useQuery<any[]>({
    queryKey: ['admin-trips', filter],
    queryFn: () => fetch(`/api/admin/trips?filter=${filter}`).then((r) => r.json()),
    enabled: filter !== 'history',
    staleTime: 15000,
    refetchInterval: 30000,
  });

  // Запрос для history
  const { data: historyTrips = [], isLoading: historyLoading } = useQuery<any[]>({
    queryKey: ['admin-trips-history', selectedDate],
    queryFn: () =>
      fetch(`/api/admin/trips?filter=history&date=${selectedDate}`).then((r) => r.json()),
    enabled: filter === 'history',
    staleTime: 30000,
  });

  const trips = filter === 'history' ? historyTrips : simpleTrips;
  const isLoading = filter === 'history' ? historyLoading : simpleLoading;

  const refresh = () => {
    if (filter === 'history') {
      queryClient.invalidateQueries({ queryKey: ['admin-trips-history', selectedDate] });
    } else {
      queryClient.invalidateQueries({ queryKey: ['admin-trips', filter] });
    }
  };

  async function handleApprove(tripId: string) {
    setApprovingId(tripId);
    try {
      const res = await fetch(`/api/admin/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка');
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
      const res = await fetch(`/api/admin/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'return' }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка');
      refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setApprovingId(null);
    }
  }

  const FILTERS = [
    { key: 'review', label: '📋 На ревью' },
    { key: 'active', label: '🚛 Активные' },
    { key: 'history', label: '📅 История' },
  ];

  const emptyLabel =
    filter === 'review'
      ? 'Нет рейсов на ревью'
      : filter === 'active'
        ? 'Нет активных рейсов'
        : 'Нет рейсов за этот день';

  const emptyIcon = filter === 'review' ? '✅' : filter === 'active' ? '🚛' : '📅';

  return (
    <div>
      {/* Шапка */}
      <header className="bg-white border-b-2 border-zinc-200 px-4 h-16 flex items-center sticky top-0 z-40">
        <h1 className="font-black text-zinc-900 text-lg uppercase tracking-tight">Рейсы</h1>
      </header>

      {/* Фильтры */}
      <div className="bg-white border-b border-zinc-100 px-4 py-2 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => router.replace(`/admin/trips?filter=${f.key}`)}
            className={cn(
              'flex-shrink-0 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all',
              filter === f.key
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100 text-zinc-500 active:bg-zinc-200',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* DateNav для режима История */}
      {filter === 'history' && <DateNav date={selectedDate} onChange={setSelectedDate} />}

      {/* Контент */}
      {isLoading ? (
        <Skeleton />
      ) : trips.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
          <span className="text-5xl mb-4">{emptyIcon}</span>
          <p className="font-bold uppercase tracking-widest text-sm">{emptyLabel}</p>
        </div>
      ) : filter === 'history' ? (
        <>
          <div className="p-4 space-y-3">
            {trips.map((trip: any) => (
              <HistoryTripCard
                key={trip.id}
                trip={trip}
                onEdit={(t) => setEditTrip(t)}
                onApprove={handleApprove}
                onReturn={handleReturn}
                approving={approvingId === trip.id}
              />
            ))}
          </div>
          <DailyTotals trips={trips} />
        </>
      ) : (
        <div className="p-4 space-y-3">
          {trips.map((trip: any) => (
            <SimpleTripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}

      {/* Модал редактирования */}
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

// ── Страница с Suspense (обязательно для useSearchParams) ────

export default function AdminTripsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-zinc-200 rounded-2xl h-20" />
          ))}
        </div>
      }
    >
      <TripsContent />
    </Suspense>
  );
}
