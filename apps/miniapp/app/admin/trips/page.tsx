/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useState, useEffect, useMemo } from 'react';
import { Money, LifecycleBadge, cn } from '@saldacargo/ui';
import { formatDate, formatTime } from '@saldacargo/shared';
import { CreatePrrModal } from '@/components/CreatePrrModal';

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
  const revenue = activeOrders.reduce(
    (s: number, o: any) => s + (parseFloat(o.amount || '0') || 0),
    0,
  );
  const driverPay = activeOrders.reduce(
    (s: number, o: any) => s + (parseFloat(o.driver_pay || '0') || 0),
    0,
  );
  const loaderPay = activeOrders.reduce((sum: number, o: any) => {
    if (Array.isArray(o.loaders_data) && o.loaders_data.length > 0) {
      return (
        sum +
        o.loaders_data.reduce((sub: number, l: any) => sub + (parseFloat(l.pay || '0') || 0), 0)
      );
    }
    return sum + (parseFloat(o.loader_pay ?? '0') || 0) + (parseFloat(o.loader2_pay ?? '0') || 0);
  }, 0);
  const fuelExpense = expenses
    .filter((e: any) => {
      const name =
        e.category?.name ||
        e.expense_category?.name ||
        (typeof e.category === 'string' ? e.category : '');
      return String(name).toUpperCase() === 'ГСМ';
    })
    .reduce((s: number, e: any) => s + (parseFloat(e.amount || '0') || 0), 0);
  const totalExpenses = expenses.reduce(
    (s: number, e: any) => s + (parseFloat(e.amount || '0') || 0),
    0,
  );
  const mileage =
    trip.odometer_end && trip.odometer_start ? trip.odometer_end - trip.odometer_start : null;
  const profit = revenue - driverPay - loaderPay - totalExpenses;
  return {
    activeOrders,
    expenses,
    revenue,
    driverPay,
    loaderPay,
    fuelExpense,
    totalExpenses,
    mileage,
    profit,
  };
}

function calcLoaderProfit(trip: any) {
  const activeOrders = (trip.trip_orders ?? []).filter(
    (o: any) => o.lifecycle_status !== 'cancelled',
  );
  let totalLoaderProfit = 0;
  for (const o of activeOrders) {
    const amt = parseFloat(o.amount || '0') || 0;
    let thirdPartyPay = 0;
    if (Array.isArray(o.loaders_data) && o.loaders_data.length > 0) {
      thirdPartyPay = o.loaders_data.reduce(
        (s: number, l: any) => s + (parseFloat(l.pay || '0') || 0),
        0,
      );
    } else {
      thirdPartyPay =
        (parseFloat(o.loader_pay || '0') || 0) + (parseFloat(o.loader2_pay || '0') || 0);
    }
    const driverLoaderPay = o.is_driver_loader ? parseFloat(o.driver_loader_pay || '0') || 0 : 0;
    const totalPaid = thirdPartyPay + driverLoaderPay;
    if (totalPaid <= 0) continue;

    let loadersPool = 0;
    if (o.direction === 'loaders_only' && amt > 0) {
      loadersPool = amt;
    } else {
      loadersPool = Math.round(totalPaid / 0.7);
    }
    const profit = Math.max(0, loadersPool - totalPaid);
    totalLoaderProfit += profit;
  }
  return totalLoaderProfit;
}

function calcServiceOrder(order: any) {
  const parts = order.parts || [];
  const works = order.works || [];
  const desc = order.problem_description || '';
  const note = order.admin_note || '';

  const externalMatch =
    desc.match(/\[Сторонний сервис(?::\s*([^\]]+))?\]/i) ||
    note.match(/\[Сторонний сервис(?::\s*([^\]]+))?\]/i) ||
    note.match(/Исполнитель:\s*([^.]+)/i);

  const isExternal =
    Boolean(externalMatch) ||
    desc.includes('[Сторонний сервис') ||
    note.includes('[Сторонний сервис');

  const partsCost = parts.reduce(
    (sum: number, p: any) =>
      sum +
      (parseFloat(p.unit_price || p.price || p.cost_price || '0') || 0) *
        (parseFloat(p.quantity || '1') || 1),
    0,
  );

  let salaryCost = 0;
  let worksCost = 0;

  if (isExternal) {
    worksCost = works
      .filter((w: any) => w.status !== 'cancelled')
      .reduce((sum: number, w: any) => sum + (parseFloat(w.price_client || '0') || 0), 0);
    salaryCost = 0;
  } else {
    const rawPay = order.raw_mechanic_pay != null ? order.raw_mechanic_pay : order.mechanic_pay;
    const m1Pay = parseFloat(rawPay || '0') || 0;
    const m2Pay = parseFloat(order.second_mechanic_pay || '0') || 0;
    salaryCost = m1Pay + m2Pay;
    if (salaryCost <= 0) {
      salaryCost = works
        .filter((w: any) => w.status !== 'cancelled')
        .reduce((sum: number, w: any) => {
          const customPctMatch = w.notes
            ? String(w.notes).match(/\[salary_pct:(\d+(?:\.\d+)?)\]/)
            : null;
          const pct =
            customPctMatch && customPctMatch[1] ? parseFloat(customPctMatch[1]) / 100 : 0.5;
          return sum + (parseFloat(w.price_client || '0') || 0) * pct;
        }, 0);
    }
  }

  const totalCost = isExternal ? partsCost + worksCost : partsCost + salaryCost;
  return { partsCost, salaryCost, worksCost, totalCost, isExternal };
}

function getWeekDates(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay();
  const monOffset = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d);
  mon.setDate(d.getDate() + monOffset);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { weekStart: mon.toISOString().slice(0, 10), weekEnd: sun.toISOString().slice(0, 10) };
}

// ── DateNav (Светлый Финтех: чистый белый стиль без черных фонов) ───

function DateNav({
  date,
  period = 'month',
  onChange,
  setPeriod,
  tripSearch = '',
  onTripSearchChange,
}: {
  date: string;
  period?: 'day' | 'week' | 'month';
  onChange: (d: string) => void;
  setPeriod?: (p: 'day' | 'week' | 'month') => void;
  tripSearch?: string;
  onTripSearchChange?: (val: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  const shift = (amount: number) => {
    const d = new Date(date + 'T12:00:00');
    if (period === 'day') {
      d.setDate(d.getDate() + amount);
    } else if (period === 'week') {
      d.setDate(d.getDate() + amount * 7);
    } else if (period === 'month') {
      d.setMonth(d.getMonth() + amount);
    }
    const s = d.toISOString().slice(0, 10);
    if (s <= today) onChange(s);
    else onChange(today);
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

  let dateLabel = '';
  if (period === 'day') {
    dateLabel = dt.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      weekday: 'short',
    });
  } else if (period === 'week') {
    const { weekStart, weekEnd } = getWeekDates(date);
    const ws = new Date(weekStart + 'T12:00:00');
    const we = new Date(weekEnd + 'T12:00:00');
    dateLabel = `${ws.getDate()} ${ws.toLocaleDateString('ru-RU', { month: 'short' })} — ${we.getDate()} ${we.toLocaleDateString('ru-RU', { month: 'short' })}`;
  } else if (period === 'month') {
    const raw = dt.toLocaleDateString('ru-RU', {
      month: 'long',
      year: 'numeric',
    });
    dateLabel = raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  const isCurrentMonth = curYear === new Date().getFullYear() && curMonth === new Date().getMonth();
  const isCurrentWeek =
    period === 'week' && getWeekDates(date).weekStart === getWeekDates(today).weekStart;
  const isFuture =
    period === 'month' ? isCurrentMonth : period === 'week' ? isCurrentWeek : date >= today;

  return (
    <div className="bg-white border-b border-slate-200">
      {/* Верхняя строка: Выбор День / Неделя / Месяц */}
      {setPeriod && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase text-slate-500">Период:</span>
            <div className="inline-flex bg-slate-200/70 p-0.5 rounded-lg border border-slate-300/60">
              {(['day', 'week', 'month'] as const).map((p) => {
                const label = p === 'day' ? 'День' : p === 'week' ? 'Неделя' : 'Месяц';
                const active = period === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={cn(
                      'px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer',
                      active
                        ? 'bg-sky-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900',
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <span className="text-[9px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
            {period === 'month' ? '📅 По машинам' : period === 'week' ? '📅 7 дней' : '📅 1 день'}
          </span>
        </div>
      )}

      {/* Центральный селектор месяца со стрелками */}
      <div className="p-2">
        <div className="flex items-center justify-between bg-slate-50 rounded-xl p-1 border border-slate-200">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 active:bg-slate-200 text-slate-700 font-black flex items-center justify-center shadow-2xs cursor-pointer transition-colors"
            aria-label="Предыдущий период"
          >
            ◀
          </button>

          <label className="flex-1 flex items-center justify-center gap-1.5 cursor-pointer px-2">
            {period === 'month' ? (
              <input
                type="month"
                value={date.slice(0, 7)}
                max={today.slice(0, 7)}
                onChange={(e) => e.target.value && onChange(`${e.target.value}-01`)}
                className="sr-only"
              />
            ) : (
              <input
                type="date"
                value={date}
                max={today}
                onChange={(e) => e.target.value && onChange(e.target.value)}
                className="sr-only"
              />
            )}
            <span className="text-slate-900 font-black text-xs sm:text-sm text-center leading-tight uppercase tracking-wider">
              {dateLabel}
            </span>
            {(period === 'month'
              ? isCurrentMonth
              : period === 'week'
                ? isCurrentWeek
                : isToday) && (
              <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                текущий
              </span>
            )}
          </label>

          <button
            type="button"
            onClick={() => shift(1)}
            disabled={isFuture}
            className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 active:bg-slate-200 text-slate-700 font-black flex items-center justify-center shadow-2xs cursor-pointer disabled:bg-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors"
            aria-label="Следующий период"
          >
            ▶
          </button>
        </div>
      </div>

      {/* Быстрые месяцы (Светлые пилюли) */}
      {period === 'month' && (
        <div className="flex gap-1 px-2 pb-2 text-[10px] font-bold uppercase">
          {months.map((m) => {
            const active = curYear === m.year && curMonth === m.month;
            return (
              <button
                key={`${m.year}-${m.month}`}
                type="button"
                onClick={() => goMonth(m.year, m.month)}
                className={cn(
                  'flex-1 py-1 rounded-md text-[10px] font-black transition-all cursor-pointer',
                  active
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80',
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Поиск по номеру рейса */}
      {onTripSearchChange && (
        <div className="px-2 pb-2">
          <div className="relative flex items-center">
            <svg
              className="w-4 h-4 text-slate-400 absolute left-2.5 pointer-events-none shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={tripSearch}
              onChange={(e) => onTripSearchChange(e.target.value)}
              placeholder="Поиск по № рейса..."
              className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none transition-all"
            />
            {tripSearch && (
              <button
                type="button"
                onClick={() => onTripSearchChange('')}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 font-black text-sm cursor-pointer"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Тип сгруппированной машины ──────────────────────────────

interface VehicleGroup {
  assetKey: string;
  assetName: string;
  regNumber: string;
  isPrr: boolean;
  trips: any[];
  serviceOrders: any[];
  tripsRevenue: number;
  tripsPayroll: number;
  driverPayroll: number;
  loaderPayroll: number;
  loaderProfit: number;
  tripsFuel: number;
  tripsExpenses: number;
  tripsProfit: number;
  maintenanceParts: number;
  maintenanceSalary: number;
  maintenanceTotal: number;
  netProfit: number;
}

// ── Сводная карточка автопарка (Светлый Финтех) ───────────────

function FleetHistorySummary({
  totalRevenue,
  totalPayroll,
  totalFuel,
  totalMaintenance,
  totalNetProfit,
  tripsCount,
  ordersCount,
}: {
  totalRevenue: number;
  totalPayroll: number;
  totalFuel: number;
  totalMaintenance: number;
  totalNetProfit: number;
  tripsCount: number;
  ordersCount: number;
}) {
  return (
    <div className="p-2.5">
      <div className="bg-white rounded-2xl border-2 border-slate-200/90 p-2.5 shadow-xs space-y-1.5">
        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-100">
          <span>
            ИТОГО АВТОПАРК · {tripsCount} РЕЙС{tripsCount === 1 ? '' : tripsCount < 5 ? 'А' : 'ОВ'}{' '}
            · {ordersCount} ТО
          </span>
          <span
            className={cn(
              'font-black px-1.5 py-0.5 rounded border text-[9px]',
              totalNetProfit >= 0
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-rose-700 bg-rose-50 border-rose-200',
            )}
          >
            {totalNetProfit >= 0 ? '+' : ''}
            {Math.round(totalNetProfit).toLocaleString('ru-RU')} ₽ ЧИСТЫМИ
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
          <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-100">
            <span className="text-[7px] text-slate-400 font-bold block uppercase">Выручка</span>
            <span className="font-black text-slate-900 text-xs sm:text-sm">
              {Math.round(totalRevenue).toLocaleString('ru-RU')} ₽
            </span>
          </div>
          <div className="bg-amber-50/60 p-1.5 rounded-xl border border-amber-100">
            <span className="text-[7px] text-amber-600 font-bold block uppercase">ЗП (ФОТ)</span>
            <span className="font-black text-amber-600 text-xs sm:text-sm">
              {Math.round(totalPayroll).toLocaleString('ru-RU')} ₽
            </span>
          </div>
          <div className="bg-rose-50/60 p-1.5 rounded-xl border border-rose-100">
            <span className="text-[7px] text-rose-600 font-bold block uppercase">ГСМ</span>
            <span className="font-black text-rose-600 text-xs sm:text-sm">
              {Math.round(totalFuel).toLocaleString('ru-RU')} ₽
            </span>
          </div>
          <div className="bg-rose-50 p-1.5 rounded-xl border border-rose-200">
            <span className="text-[7px] text-rose-700 font-bold block uppercase">Ремонт ТО</span>
            <span className="font-black text-rose-700 text-xs sm:text-sm">
              {totalMaintenance > 0
                ? `−${Math.round(totalMaintenance).toLocaleString('ru-RU')} ₽`
                : '0 ₽'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Карточка машины в режиме История (Ультра 1-Line / Плотный вид) ─

function VehicleGroupCard({ group, onClick }: { group: VehicleGroup; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-white border border-slate-200 hover:border-sky-300 rounded-2xl p-2.5 shadow-2xs cursor-pointer transition-all active:scale-[0.99] space-y-1.5"
    >
      {/* Строка 1: Машина, чипы и Прибыль */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm',
              group.isPrr ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-600',
            )}
          >
            {group.isPrr ? '👷' : '🚚'}
          </div>
          <div className="min-w-0 truncate">
            <div className="flex items-center gap-1">
              <span className="font-black text-slate-900 text-xs truncate">{group.assetName}</span>
              {group.regNumber && (
                <span className="text-[10px] text-slate-400 font-semibold truncate shrink-0">
                  ({group.regNumber})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Справа: ЧИСТАЯ ПРИБЫЛЬ */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="text-right">
            <span className="text-[7px] font-bold uppercase tracking-wider text-slate-400 block leading-none">
              Прибыль
            </span>
            <span
              className={cn(
                'text-xs font-black',
                group.netProfit > 0
                  ? 'text-emerald-600'
                  : group.netProfit < 0
                    ? 'text-rose-600'
                    : 'text-slate-500',
              )}
            >
              {group.netProfit > 0 ? '+' : ''}
              {Math.round(group.netProfit).toLocaleString('ru-RU')} ₽
            </span>
          </div>
          <span className="text-slate-300 text-sm font-bold pl-0.5">›</span>
        </div>
      </div>

      {/* Строка 2: Чипы рейсов/ТО слева + 4 метрики (Выручка, ЗП, ГСМ, ТО) */}
      <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 text-[10px]">
        {/* Бейджи рейсов и нарядов ТО */}
        <div className="flex items-center gap-1 shrink-0">
          {group.trips.length > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100 font-bold text-[9px]">
              <span>📋</span>
              <span>{group.trips.length}р</span>
            </span>
          )}
          {group.serviceOrders.length > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[9px]">
              <span>🔧</span>
              <span>{group.serviceOrders.length} ТО</span>
            </span>
          )}
          {group.trips.length === 0 && group.serviceOrders.length === 0 && (
            <span className="text-slate-400 text-[9px]">Нет рейсов</span>
          )}
        </div>

        {/* Метрики в строку: Выручка · ЗП · ГСМ · ТО */}
        <div className="flex items-center gap-1.5 shrink-0 text-right">
          <div title="Выручка">
            <span className="text-[7px] text-slate-400 block font-bold uppercase leading-none">
              Выр
            </span>
            <span className="font-bold text-slate-800 text-[10px]">
              {Math.round(group.tripsRevenue).toLocaleString('ru-RU')} ₽
            </span>
          </div>

          <div title="Зарплата (ФОТ)">
            <span className="text-[7px] text-amber-600 block font-bold uppercase leading-none">
              ЗП
            </span>
            <span className="font-bold text-amber-600 text-[10px]">
              {Math.round(group.tripsPayroll).toLocaleString('ru-RU')} ₽
            </span>
          </div>

          {!group.isPrr && (
            <div title="ГСМ">
              <span className="text-[7px] text-rose-500 block font-bold uppercase leading-none">
                ГСМ
              </span>
              <span className="font-bold text-rose-600 text-[10px]">
                {Math.round(group.tripsFuel).toLocaleString('ru-RU')} ₽
              </span>
            </div>
          )}

          {group.maintenanceTotal > 0 && (
            <div
              className="bg-rose-50 border border-rose-200 px-1 py-0.2 rounded"
              title="Ремонт ТО"
            >
              <span className="text-[7px] text-rose-700 block font-bold uppercase leading-none">
                ТО
              </span>
              <span className="font-black text-rose-700 text-[10px]">
                −{Math.round(group.maintenanceTotal).toLocaleString('ru-RU')} ₽
              </span>
            </div>
          )}

          {group.isPrr && group.loaderProfit > 0 && (
            <div
              className="bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded"
              title="Маржа компании 30%"
            >
              <span className="text-[7px] text-emerald-700 block font-bold uppercase leading-none">
                Маржа
              </span>
              <span className="font-black text-emerald-700 text-[10px]">
                +{Math.round(group.loaderProfit).toLocaleString('ru-RU')} ₽
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Мобильная шторка (Bottom Sheet) детализации по машине / ПРР ────

function VehicleDetailSheet({
  group,
  onClose,
  onEditTrip,
}: {
  group: VehicleGroup;
  onClose: () => void;
  onEditTrip: (trip: any) => void;
}) {
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{
        background: 'rgba(0,0,0,0.5)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-slate-50 rounded-t-3xl shadow-2xl flex flex-col"
        style={
          {
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            maxHeight: 'calc(100vh - 70px)',
          } as React.CSSProperties
        }
      >
        {/* Хэндл шторки */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Заголовок */}
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-lg',
                group.isPrr ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-600',
              )}
            >
              {group.isPrr ? '👷' : '🚚'}
            </div>
            <div className="min-w-0 truncate">
              <h2 className="font-black text-slate-900 text-sm truncate">{group.assetName}</h2>
              {group.regNumber && (
                <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                  Госномер: {group.regNumber}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 text-xl font-bold cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Финансовый срез */}
        <div className="p-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Финансовый результат
              </span>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-md font-black text-xs border',
                  group.netProfit >= 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200',
                )}
              >
                {group.netProfit >= 0 ? '+' : ''}
                {Math.round(group.netProfit).toLocaleString('ru-RU')} ₽ ЧИСТЫМИ
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                <span className="text-[9px] text-slate-400 font-bold uppercase block">Выручка</span>
                <span className="font-black text-slate-900 text-sm">
                  {Math.round(group.tripsRevenue).toLocaleString('ru-RU')} ₽
                </span>
              </div>
              <div className="bg-amber-50/50 p-2 rounded-xl border border-amber-100">
                <span className="text-[9px] text-amber-600 font-bold uppercase block">
                  ФОТ (ЗП)
                </span>
                <span className="font-black text-amber-600 text-sm">
                  {Math.round(group.tripsPayroll).toLocaleString('ru-RU')} ₽
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  Водитель: {Math.round(group.driverPayroll).toLocaleString('ru-RU')} ₽ · Грузчики:{' '}
                  {Math.round(group.loaderPayroll).toLocaleString('ru-RU')} ₽
                </span>
              </div>
              {!group.isPrr && (
                <div className="bg-rose-50/50 p-2 rounded-xl border border-rose-100">
                  <span className="text-[9px] text-rose-600 font-bold uppercase block">ГСМ</span>
                  <span className="font-black text-rose-600 text-sm">
                    {Math.round(group.tripsFuel).toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              )}
              {!group.isPrr && (
                <div className="bg-rose-50/50 p-2 rounded-xl border border-rose-200">
                  <span className="text-[9px] text-rose-700 font-bold uppercase block">
                    Ремонт ТО (Гараж)
                  </span>
                  <span className="font-black text-rose-700 text-sm">
                    {group.maintenanceTotal > 0
                      ? `−${Math.round(group.maintenanceTotal).toLocaleString('ru-RU')} ₽`
                      : '0 ₽'}
                  </span>
                  {group.maintenanceTotal > 0 && (
                    <span className="text-[9px] text-slate-400 block mt-0.5">
                      Запчасти: {Math.round(group.maintenanceParts).toLocaleString('ru-RU')} ₽ ·
                      Работы: {Math.round(group.maintenanceSalary).toLocaleString('ru-RU')} ₽
                    </span>
                  )}
                </div>
              )}
              {group.isPrr && (
                <div className="bg-emerald-50/60 p-2 rounded-xl border border-emerald-200 col-span-2">
                  <span className="text-[9px] text-emerald-700 font-bold uppercase block">
                    Маржа компании с грузчиков (30%)
                  </span>
                  <span className="font-black text-emerald-700 text-sm">
                    +{Math.round(group.loaderProfit).toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Список рейсов */}
        {group.trips.length > 0 && (
          <div className="px-3 pb-3 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                Рейсы ({group.trips.length})
              </span>
            </div>
            {group.trips.map((trip: any) => {
              const ct = calcTrip(trip);
              const isExp = expandedTripId === trip.id;
              return (
                <div
                  key={trip.id}
                  className="bg-white rounded-xl border border-slate-200 p-2.5 shadow-2xs space-y-1.5"
                >
                  <div
                    onClick={() => setExpandedTripId(isExp ? null : trip.id)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-slate-900 text-xs">
                          Рейс #{trip.trip_number}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatDate(trip.started_at || trip.created_at)}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                        {trip.driver?.name || 'Водитель не назначен'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] font-bold text-slate-400 block uppercase">
                        Прибыль
                      </span>
                      <span
                        className={cn(
                          'text-xs font-black',
                          ct.profit >= 0 ? 'text-emerald-600' : 'text-rose-600',
                        )}
                      >
                        {ct.profit >= 0 ? '+' : ''}
                        {Math.round(ct.profit).toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  </div>

                  {/* Краткая строка метрик */}
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-100 text-slate-600">
                    <span>
                      Выр:{' '}
                      <b className="text-slate-800">
                        {Math.round(ct.revenue).toLocaleString('ru-RU')} ₽
                      </b>
                    </span>
                    <span>
                      ЗП:{' '}
                      <b className="text-amber-600">
                        {Math.round(ct.driverPay + ct.loaderPay).toLocaleString('ru-RU')} ₽
                      </b>
                    </span>
                    <span>
                      ГСМ:{' '}
                      <b className="text-rose-600">
                        {Math.round(ct.fuelExpense).toLocaleString('ru-RU')} ₽
                      </b>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditTrip(trip);
                      }}
                      className="text-sky-600 hover:underline font-bold text-[10px] cursor-pointer"
                    >
                      ✏️ Изм.
                    </button>
                  </div>

                  {/* Раскрывающийся список заявок рейса */}
                  {isExp && ct.activeOrders.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                        Заявки рейса ({ct.activeOrders.length}):
                      </span>
                      {ct.activeOrders.map((o: any, idx: number) => (
                        <div
                          key={o.id || idx}
                          className="bg-slate-50 p-2 rounded-lg text-[11px] flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-slate-800 block">
                              #{idx + 1} {o.counterparty_name || o.counterparty?.name || 'Клиент'}
                            </span>
                            {o.address_to && (
                              <span className="text-[9px] text-slate-500 block truncate max-w-[200px]">
                                {o.address_to}
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="font-black text-slate-900 block">
                              {Math.round(parseFloat(o.amount || '0')).toLocaleString('ru-RU')} ₽
                            </span>
                            <span className="text-[9px] text-slate-500 block">
                              ЗП вод:{' '}
                              {Math.round(parseFloat(o.driver_pay || '0')).toLocaleString('ru-RU')}{' '}
                              ₽
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Список заказ-нарядов ТО */}
        {group.serviceOrders.length > 0 && (
          <div className="px-3 pb-3 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-rose-700">
                Заказ-наряды ТО ({group.serviceOrders.length})
              </span>
            </div>
            {group.serviceOrders.map((order: any) => {
              const cso = calcServiceOrder(order);
              const isExp = expandedOrderId === order.id;
              return (
                <div
                  key={order.id}
                  className="bg-white rounded-xl border border-rose-200 p-2.5 shadow-2xs space-y-1.5"
                >
                  <div
                    onClick={() => setExpandedOrderId(isExp ? null : order.id)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-rose-800 text-xs">
                          Наряд #{order.order_number || order.id?.slice(0, 6)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatDate(order.created_at)}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 mt-0.5 line-clamp-1">
                        {order.problem_description || 'Ремонт / ТО'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] font-bold text-slate-400 block uppercase">
                        Сумма ТО
                      </span>
                      <span className="text-xs font-black text-rose-600">
                        −{Math.round(cso.totalCost).toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-rose-100 text-slate-600">
                    <span>
                      Запчасти:{' '}
                      <b className="text-slate-800">
                        {Math.round(cso.partsCost).toLocaleString('ru-RU')} ₽
                      </b>
                    </span>
                    <span>
                      Работы:{' '}
                      <b className="text-slate-800">
                        {Math.round(cso.salaryCost).toLocaleString('ru-RU')} ₽
                      </b>
                    </span>
                    <span className="text-slate-500">{order.mechanic?.name || 'Механик'}</span>
                  </div>

                  {isExp && order.parts && order.parts.length > 0 && (
                    <div className="pt-2 border-t border-rose-100 space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                        Установленные запчасти:
                      </span>
                      {order.parts.map((p: any, idx: number) => (
                        <div
                          key={p.id || idx}
                          className="bg-rose-50/50 p-1.5 rounded-lg text-[10px] flex items-center justify-between"
                        >
                          <span className="text-slate-700">
                            {p.custom_part_name || p.part?.name || 'Деталь'} ({p.quantity || 1} шт)
                          </span>
                          <span className="font-bold text-rose-700">
                            {Math.round(
                              (parseFloat(p.unit_price || p.price || 0) || 0) *
                                (parseFloat(p.quantity || 1) || 1),
                            ).toLocaleString('ru-RU')}{' '}
                            ₽
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
  const [orders, setOrders] = useState(
    activeOrders.map((o: any) => ({
      ...o,
      counterparty_name: o.counterparty?.name ?? '',
      _deleted: false,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const y = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${y}px`;
    document.body.style.width = '100%';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, y);
    };
  }, []);

  const update = (id: string, field: string, value: string) => {
    setOrders((prev: any[]) => prev.map((o: any) => (o.id === id ? { ...o, [field]: value } : o)));
  };

  const addOrder = () => {
    const defaultLoaderId =
      trip.loader?.id ?? activeOrders.find((o: any) => o.loader_id)?.loader_id ?? null;
    const defaultLoader = trip.loader ?? activeOrders.find((o: any) => o.loader)?.loader ?? null;
    const defaultLoader2Id = activeOrders.find((o: any) => o.loader2_id)?.loader2_id ?? null;
    const defaultLoader2 = activeOrders.find((o: any) => o.loader2)?.loader2 ?? null;

    const newOrder = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      isNew: true,
      counterparty_name: '',
      amount: '',
      driver_pay: '',
      loader_pay: defaultLoaderId ? '0' : '0',
      loader2_pay: defaultLoader2Id ? '0' : '0',
      loader_id: defaultLoaderId,
      loader2_id: defaultLoader2Id,
      loader: defaultLoader,
      loader2: defaultLoader2,
      payment_method: 'debt_cash',
      _deleted: false,
    };
    setOrders((prev: any[]) => [...prev, newOrder]);
  };

  const removeOrder = (orderId: string) => {
    setOrders((prev: any[]) => {
      const target = prev.find((o: any) => o.id === orderId);
      if (!target) return prev;
      if (target.isNew) {
        return prev.filter((o: any) => o.id !== orderId);
      }
      return prev.map((o: any) => (o.id === orderId ? { ...o, _deleted: true } : o));
    });
  };

  const restoreOrder = (orderId: string) => {
    setOrders((prev: any[]) =>
      prev.map((o: any) => (o.id === orderId ? { ...o, _deleted: false } : o)),
    );
  };

  const save = async () => {
    const nonDeleted = orders.filter((o: any) => !o._deleted);
    if (nonDeleted.length === 0) {
      setError('В рейсе должен быть хотя бы один заказ');
      return;
    }

    for (let i = 0; i < nonDeleted.length; i++) {
      const o = nonDeleted[i];
      const amt = parseFloat(o.amount);
      if (isNaN(amt) || amt <= 0) {
        setError(`Укажите сумму для заявки ${i + 1}`);
        return;
      }
    }

    setSaving(true);
    setError('');

    const payload = nonDeleted.map((o: any) => ({
      id: o.id,
      isNew: o.isNew,
      counterparty_name: o.counterparty_name,
      amount: o.amount,
      driver_pay: o.driver_pay || '0',
      loader_pay: o.loader_pay || '0',
      loader2_pay: o.loader2_pay ?? '0',
      loader_id: o.loader_id ?? null,
      loader2_id: o.loader2_id ?? null,
      payment_method: o.payment_method,
    }));

    const deletedIds = orders.filter((o: any) => o._deleted && !o.isNew).map((o: any) => o.id);

    try {
      const res = await fetch(`/api/admin/trips/${trip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit_orders',
          orders: payload,
          deleted_order_ids: deletedIds.length > 0 ? deletedIds : undefined,
        }),
      });
      const json = await res.json();
      setSaving(false);
      if (!res.ok) {
        setError(json.error ?? 'Ошибка сохранения');
        return;
      }
      onSaved();
    } catch {
      setSaving(false);
      setError('Ошибка сети');
    }
  };

  const visibleOrders = orders.filter((o: any) => !o._deleted);
  const totalRevenue = visibleOrders.reduce(
    (s: number, o: any) => s + (parseFloat(o.amount) || 0),
    0,
  );
  const totalDriverPay = visibleOrders.reduce(
    (s: number, o: any) => s + (parseFloat(o.driver_pay) || 0),
    0,
  );

  const inputCls =
    'w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-zinc-400 transition-all bg-white';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{
        background: 'rgba(0,0,0,0.5)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-t-3xl shadow-2xl"
        style={
          {
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            maxHeight: 'calc(100vh - 80px)',
          } as React.CSSProperties
        }
      >
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

        {/* Сводка */}
        <div className="bg-zinc-50 px-5 py-2.5 border-b border-zinc-100 flex items-center justify-between text-xs">
          <div>
            <span className="text-zinc-400 font-bold uppercase text-[10px] block">Выручка</span>
            <span className="font-black text-zinc-900 text-sm">
              {totalRevenue.toLocaleString('ru-RU')} ₽
            </span>
          </div>
          <div>
            <span className="text-zinc-400 font-bold uppercase text-[10px] block">ЗП водителя</span>
            <span className="font-black text-zinc-900 text-sm">
              {totalDriverPay.toLocaleString('ru-RU')} ₽
            </span>
          </div>
          <div>
            <span className="text-zinc-400 font-bold uppercase text-[10px] block">Заявок</span>
            <span className="font-black text-zinc-900 text-sm">{visibleOrders.length}</span>
          </div>
        </div>

        {/* Список заказов + кнопки */}
        <div className="p-5 space-y-5">
          {orders.map((order: any, idx: number) => {
            if (order._deleted) {
              return (
                <div
                  key={order.id}
                  className="border border-dashed border-rose-300 bg-rose-50 rounded-2xl p-3 flex items-center justify-between text-xs"
                >
                  <span className="text-rose-800 font-medium">
                    Заявка #{idx + 1} ({order.counterparty_name || 'Без клиента'}) удалена
                  </span>
                  <button
                    type="button"
                    onClick={() => restoreOrder(order.id)}
                    className="font-bold text-indigo-600 bg-white border border-indigo-200 px-2.5 py-1 rounded-lg"
                  >
                    Вернуть
                  </button>
                </div>
              );
            }

            const amtNum = parseFloat(order.amount) || 0;
            const suggestedPay = Math.round(amtNum * 0.3);

            return (
              <div
                key={order.id}
                className="border border-zinc-200 rounded-2xl p-4 space-y-3 bg-zinc-50/50"
              >
                <div className="flex items-center justify-between pb-1 border-b border-zinc-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-zinc-800 uppercase tracking-widest">
                      Заявка {idx + 1}
                    </span>
                    {order.isNew && (
                      <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                        Новая
                      </span>
                    )}
                  </div>
                  {visibleOrders.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeOrder(order.id)}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 active:opacity-60"
                    >
                      Удалить
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                    Клиент
                  </label>
                  <input
                    type="text"
                    className={inputCls}
                    value={order.counterparty_name}
                    placeholder="Название клиента"
                    onChange={(e) => update(order.id, 'counterparty_name', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                    💬 Комментарий / примечание к заказу
                  </label>
                  <input
                    type="text"
                    className={inputCls}
                    value={order.description || ''}
                    placeholder="Детали заказа, примечание водителя"
                    onChange={(e) => update(order.id, 'description', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                    Сумма, ₽
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    className={inputCls}
                    value={order.amount}
                    onChange={(e) => {
                      const val = e.target.value;
                      update(order.id, 'amount', val);
                      if (!order.driver_pay || order.driver_pay === '0') {
                        const num = parseFloat(val);
                        if (!isNaN(num) && num > 0) {
                          update(order.id, 'driver_pay', Math.round(num * 0.3).toString());
                        }
                      }
                    }}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">
                      ЗП водителя, ₽
                    </label>
                    {amtNum > 0 && (
                      <button
                        type="button"
                        onClick={() => update(order.id, 'driver_pay', suggestedPay.toString())}
                        className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded"
                      >
                        30%: {suggestedPay} ₽
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    inputMode="numeric"
                    className={inputCls}
                    value={order.driver_pay}
                    onChange={(e) => update(order.id, 'driver_pay', e.target.value)}
                  />
                </div>
                {(order.loader_id || parseFloat(order.loader_pay) > 0 || trip.loader) && (
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                      ЗП 1-го грузчика, ₽
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      className={inputCls}
                      value={order.loader_pay}
                      onChange={(e) => update(order.id, 'loader_pay', e.target.value)}
                    />
                  </div>
                )}
                {(order.loader2_id || parseFloat(order.loader2_pay) > 0) && (
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                      ЗП 2-го грузчика, ₽
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      className={inputCls}
                      value={order.loader2_pay}
                      onChange={(e) => update(order.id, 'loader2_pay', e.target.value)}
                    />
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
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
            );
          })}

          <button
            type="button"
            onClick={addOrder}
            className="w-full border-2 border-dashed border-zinc-300 active:border-zinc-500 text-zinc-700 font-bold py-3 px-4 rounded-2xl flex items-center justify-center gap-2 text-sm"
          >
            <span>+ Добавить ещё одну заявку</span>
          </button>

          {/* Кнопки */}
          <div className="pt-3 border-t border-zinc-100 space-y-2 pb-4">
            {error && (
              <p className="text-sm text-rose-700 font-medium bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5">
                {error}
              </p>
            )}
            <div className="flex gap-3">
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
  onDelete,
  approving,
}: {
  trip: any;
  onEdit: (t: any) => void;
  onApprove: (id: string) => void;
  onReturn: (id: string) => void;
  onDelete: (id: string) => void;
  approving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { activeOrders, expenses, revenue, driverPay, loaderPay, mileage, profit } = calcTrip(trip);
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
                    {trip.asset?.reg_number === 'БЕЗ АВТО'
                      ? '👷 ПРР (без авто)'
                      : (trip.asset?.short_name ?? '—')}
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
                let lp = 0;
                if (Array.isArray(order.loaders_data) && order.loaders_data.length > 0) {
                  lp = order.loaders_data.reduce(
                    (sub: number, l: any) => sub + (parseFloat(l.pay || '0') || 0),
                    0,
                  );
                } else {
                  lp =
                    (parseFloat(order.loader_pay ?? '0') || 0) +
                    (parseFloat(order.loader2_pay ?? '0') || 0);
                }
                const split = amt > 0 ? Math.round((dp / amt) * 100) : 0;
                return (
                  <div key={order.id} className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">
                        {order.counterparty?.name ?? `Заявка ${i + 1}`}
                      </p>
                      {order.description && (
                        <div className="mt-0.5 p-1.5 bg-amber-50 border border-amber-200/90 rounded text-[11px] text-amber-950 font-medium line-clamp-2">
                          <span className="font-bold text-amber-900">💬 Водитель:</span>{' '}
                          {order.description}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-emerald-600 font-medium">
                          ЗП {split}% · <Money amount={order.driver_pay} />
                        </span>
                        {lp > 0 && (
                          <span className="text-[11px] text-blue-500 font-medium">
                            Груз: <Money amount={lp.toString()} />
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
          {(() => {
            const hasLoader = !!trip.loader;
            return (
              <div
                className={cn(
                  'border-t border-zinc-100 bg-zinc-50',
                  hasLoader ? 'grid grid-cols-2' : 'grid grid-cols-3',
                )}
              >
                <div className="text-center px-2 py-3 border-r border-zinc-100">
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                    Выручка
                  </p>
                  <p className="font-bold text-zinc-800 text-sm">
                    <Money amount={revenue.toFixed(2)} />
                  </p>
                </div>
                <div
                  className={cn('text-center px-2 py-3', !hasLoader && 'border-r border-zinc-100')}
                >
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                    ЗП Водитель
                  </p>
                  <p className="font-bold text-green-600 text-sm">
                    <Money amount={driverPay.toFixed(2)} />
                  </p>
                </div>
                {hasLoader && (
                  <div className="text-center px-2 py-3 border-r border-zinc-100">
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                      ЗП Грузчик
                    </p>
                    <p className="font-bold text-blue-500 text-sm">
                      <Money amount={loaderPay.toFixed(2)} />
                    </p>
                  </div>
                )}
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
            );
          })()}

          {/* Пробег + заметка водителя */}
          {(mileage || trip.driver_note || trip.odometer_end) && (
            <div className="px-4 py-2.5 border-t border-zinc-100 flex items-center justify-between gap-3">
              {((mileage !== null && mileage > 0) || trip.odometer_end != null) && (
                <span className="text-xs text-zinc-500 flex items-center gap-1.5 flex-wrap">
                  <span>
                    🛣 <span className="font-bold">{mileage ?? 0} км</span>
                  </span>
                  {trip.odometer_end != null && (
                    <span className="text-[11px] text-zinc-400 font-normal">
                      (на одометре: {trip.odometer_end.toLocaleString('ru-RU')} км)
                    </span>
                  )}
                </span>
              )}
              {trip.driver_note && (
                <span className="text-xs text-amber-700 flex-1 text-right">
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
            <button
              onClick={() => onDelete(trip.id)}
              disabled={approving}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-500 active:bg-rose-100 disabled:opacity-50 shrink-0"
              title="Удалить рейс"
            >
              🗑️
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

// ── Активные рейсы: простые карточки (ссылки) ────────────────

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

  const cashRevenue = (trip.trip_orders ?? [])
    .filter((o: any) => o.payment_method === 'cash' && o.lifecycle_status !== 'cancelled')
    .reduce((s: number, o: any) => s + parseFloat(o.amount || '0'), 0);
  const cashExpenses = (trip.trip_expenses ?? [])
    .filter((e: any) => e.payment_method === 'cash')
    .reduce((s: number, e: any) => s + parseFloat(e.amount || '0'), 0);
  const cashToSurrender = Math.max(0, cashRevenue - cashExpenses);
  const hasCarryover =
    (trip.driver_note ?? '').includes('[ПЕРЕНОС НАЛИЧНЫХ') ||
    (trip.driver_note ?? '').includes('[CARRYOVER]');
  const isRepair = Boolean(
    (trip.driver_note ?? '').includes('[РЕЙС_НА_РЕМОНТ]') ||
    (trip.admin_note ?? '').includes('[РЕЙС_НА_РЕМОНТ]') ||
    (trip.trip_orders ?? []).some((o: any) =>
      (o.description ?? '').toLowerCase().includes('ремонт'),
    ),
  );

  return (
    <Link href={`/admin/trips/${trip.id}`}>
      <div className="bg-white rounded-2xl p-4 border-2 border-zinc-100 shadow-sm active:scale-[0.98] transition-all relative overflow-hidden">
        <div
          className={cn(
            'absolute left-0 top-0 bottom-0 w-1',
            isRepair ? 'bg-amber-400' : 'bg-zinc-300',
          )}
        />
        <div className="pl-2">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="font-black text-zinc-900 text-sm">
                №{trip.trip_number} ·{' '}
                {trip.asset?.reg_number === 'БЕЗ АВТО'
                  ? '👷 ПРР (без авто)'
                  : (trip.asset?.short_name ?? '—')}
              </span>
              <p className="text-[10px] text-zinc-400 font-bold uppercase mt-0.5">
                {trip.driver?.name ?? '—'} · {formatDate(trip.started_at)}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {isRepair && (
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                  🔧 Ремонт
                </span>
              )}
              <LifecycleBadge status={trip.lifecycle_status} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {isRepair ? (
              <span className="text-amber-700 font-bold flex items-center gap-1">
                <span>🔧 По заезду в геозону встанет на РЕВЬЮ-ГАРАЖ</span>
              </span>
            ) : (
              <>
                <span className="text-zinc-900 font-bold">
                  Выручка: <Money amount={revenue.toString()} className="font-black" />
                </span>
                <span className="text-green-600 font-bold">
                  ЗП: <Money amount={driverPay.toString()} />
                </span>
              </>
            )}
            {expenses > 0 && (
              <span className="text-red-500 font-bold">
                Расх: <Money amount={expenses.toString()} />
              </span>
            )}
            {cashToSurrender > 0 && (
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-bold text-[11px]">
                💵 Нал: <Money amount={cashToSurrender.toString()} className="font-black" />
              </span>
            )}
            {hasCarryover && (
              <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded-md font-bold text-[10px]">
                ⚠️ Перенос
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

// ── Модалка редактирования заказ-наряда (Гараж) ──────────────

function ServiceOrderEditModal({
  order,
  onClose,
  onSaved,
}: {
  order: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isOwn = order.machine_type === 'own';
  const hourlyRate = Number(order.hourly_rate || (isOwn ? 1600 : 2000));
  const salaryPct = Number(order.salary_pct || 50);

  const [odometer, setOdometer] = useState<string>(
    String(order.odometer_end || order.odometer_start || ''),
  );
  const [clientModel, setClientModel] = useState<string>(
    order.client_vehicle_model || order.client_vehicle_brand || '',
  );
  const [clientReg, setClientReg] = useState<string>(order.client_vehicle_reg || '');
  const [works, setWorks] = useState<Array<{ name: string; minutes: string; notes?: string }>>(
    () => {
      const active = (order.works ?? []).filter((w: any) => w.status !== 'cancelled');
      if (active.length === 0) return [{ name: order.problem_description || '', minutes: '60' }];
      return active.map((w: any) => ({
        name: w.custom_work_name || w.work_catalog?.name || w.work_description || '',
        minutes: String(w.actual_minutes || w.norm_minutes || 30),
        notes: w.notes || undefined,
      }));
    },
  );
  const [parts, setParts] = useState<Array<{ name: string; quantity: string; unit: string }>>(() =>
    (order.parts ?? []).map((p: any) => ({
      name: p.custom_part_name || p.part?.name || '',
      quantity: String(p.quantity || 1),
      unit: p.unit || p.part?.unit || 'шт',
    })),
  );
  const [manualPay, setManualPay] = useState<string>(order.mechanic_pay || '');
  const [adminNote, setAdminNote] = useState<string>(order.admin_note || '');
  const [saving, setSaving] = useState(false);

  const totalMinutes = works.reduce((s, w) => s + (parseInt(w.minutes, 10) || 0), 0);
  const autoPay = works
    .reduce((s, w) => {
      const mins = parseInt(w.minutes, 10) || 0;
      const customPctMatch = w.notes
        ? String(w.notes).match(/\[salary_pct:(\d+(?:\.\d+)?)\]/)
        : null;
      const wPct = customPctMatch && customPctMatch[1] ? parseFloat(customPctMatch[1]) : salaryPct;
      return s + (mins / 60) * hourlyRate * (wPct / 100);
    }, 0)
    .toFixed(2);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/service-orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit_order',
          odometer_start: odometer ? Number(odometer) : null,
          odometer_end: odometer ? Number(odometer) : null,
          client_vehicle_model: !isOwn ? clientModel : undefined,
          client_vehicle_reg: !isOwn ? clientReg : undefined,
          works: works.map((w) => ({
            name: w.name,
            minutes: parseInt(w.minutes, 10) || 0,
            notes: w.notes,
          })),
          parts: parts.map((p) => ({
            name: p.name,
            quantity: parseFloat(p.quantity) || 1,
            unit: p.unit || 'шт',
          })),
          mechanic_pay: manualPay ? parseFloat(manualPay) : parseFloat(autoPay),
          admin_note: adminNote,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка сохранения');
      onSaved();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <h3 className="font-black text-zinc-900 text-base">
              Редактировать наряд №{order.order_number}
            </h3>
            <p className="text-xs text-zinc-400 font-bold">
              {isOwn ? '🏢 Свой автопарк (1 600 ₽/ч)' : '🚗 Клиентский авто (2 000 ₽/ч)'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-500 font-bold flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {!isOwn && (
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-400 block mb-1">
                Модель авто
              </label>
              <input
                type="text"
                value={clientModel}
                onChange={(e) => setClientModel(e.target.value)}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-400 block mb-1">
                Госномер
              </label>
              <input
                type="text"
                value={clientReg}
                onChange={(e) => setClientReg(e.target.value.toUpperCase())}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold uppercase"
              />
            </div>
          </div>
        )}

        <div>
          <label className="text-[10px] font-black uppercase text-zinc-400 block mb-1">
            Пробег (одометр, км)
          </label>
          <input
            type="number"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
            placeholder="Пробег в км"
            className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold"
          />
        </div>

        {/* Работы */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-zinc-400">
              Перечень работ ({works.length})
            </span>
            <button
              type="button"
              onClick={() => setWorks((prev) => [...prev, { name: '', minutes: '30' }])}
              className="text-xs font-black text-emerald-600"
            >
              + Добавить работу
            </button>
          </div>
          {works.map((w, idx) => (
            <div key={idx} className="bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={w.name}
                  onChange={(e) =>
                    setWorks((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item)),
                    )
                  }
                  placeholder="Наименование работы"
                  className="flex-1 bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                />
                {works.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setWorks((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-rose-500 text-xs font-black px-1.5"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-500 font-bold">Время (мин):</span>
                <input
                  type="number"
                  value={w.minutes}
                  onChange={(e) =>
                    setWorks((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, minutes: e.target.value } : item,
                      ),
                    )
                  }
                  className="w-24 bg-white border border-zinc-200 rounded-lg px-2.5 py-1 text-xs font-black"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Запчасти */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-zinc-400">
              Запчасти автосервиса ({parts.length})
            </span>
            <button
              type="button"
              onClick={() => setParts((prev) => [...prev, { name: '', quantity: '1', unit: 'шт' }])}
              className="text-xs font-black text-emerald-600"
            >
              + Добавить запчасть
            </button>
          </div>
          {parts.map((p, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={p.name}
                onChange={(e) =>
                  setParts((prev) =>
                    prev.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item)),
                  )
                }
                placeholder="Название запчасти"
                className="flex-1 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
              />
              <input
                type="number"
                value={p.quantity}
                onChange={(e) =>
                  setParts((prev) =>
                    prev.map((item, i) =>
                      i === idx ? { ...item, quantity: e.target.value } : item,
                    ),
                  )
                }
                className="w-16 border border-zinc-200 rounded-lg px-2 py-1.5 text-xs font-bold text-center"
              />
              <button
                type="button"
                onClick={() => setParts((prev) => prev.filter((_, i) => i !== idx))}
                className="text-rose-500 text-xs font-black px-1.5"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* ЗП Механика */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-emerald-900">
              ЗП Механика (авторасчёт: {autoPay} ₽)
            </span>
            <button
              type="button"
              onClick={() => setManualPay(autoPay)}
              className="text-[10px] font-black text-emerald-700 underline"
            >
              По времени ({totalMinutes} мин)
            </button>
          </div>
          <input
            type="number"
            step="0.01"
            value={manualPay}
            onChange={(e) => setManualPay(e.target.value)}
            placeholder={autoPay}
            className="w-full bg-white border border-emerald-300 rounded-lg px-3 py-2 text-sm font-black text-emerald-900"
          />
        </div>

        <div>
          <label className="text-[10px] font-black uppercase text-zinc-400 block mb-1">
            Комментарий руководителя
          </label>
          <input
            type="text"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder="Заметка к наряду..."
            className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-xs font-medium"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-zinc-200 font-bold text-xs text-zinc-600"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-wider disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Карточка заказ-наряда механика на ревью (Гараж) ──────────

function ServiceOrderReviewCard({
  order,
  onEdit,
  onApprove,
  onReturn,
  onDelete,
  approving,
}: {
  order: any;
  onEdit: (o: any) => void;
  onApprove: (id: string) => void;
  onReturn: (id: string) => void;
  onDelete: (id: string) => void;
  approving: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const isOwn = order.machine_type === 'own';
  const hourlyRate = Number(order.hourly_rate || (isOwn ? 1600 : 2000));
  const salaryPct = Number(order.salary_pct || 50);
  const activeWorks = (order.works ?? []).filter((w: any) => w.status !== 'cancelled');
  const parts = order.parts ?? [];
  const totalMinutes =
    Number(order.total_minutes) ||
    activeWorks.reduce(
      (s: number, w: any) =>
        s + Number(w.actual_minutes || w.norm_minutes || 0) * Math.max(1, Number(w.quantity || 1)),
      0,
    );
  const mechanicPay = parseFloat(order.mechanic_pay || order.estimated_pay || '0');
  const worksSum = parseFloat(order.works_total || '0') || (totalMinutes / 60) * hourlyRate;
  const odo = order.odometer_end || order.odometer_start;
  const canReview = order.lifecycle_status === 'draft' || order.lifecycle_status === 'returned';

  const vehicleTitle = isOwn
    ? `${order.asset?.short_name ?? 'Свой ТС'} · ${order.asset?.reg_number ?? ''}`
    : `${order.client_vehicle_model || order.client_vehicle_brand || 'Клиентский авто'} · ${order.client_vehicle_reg || 'без номера'}`;

  const cleanMechanicNote = (order.mechanic_note || '')
    .replace('[Запчасти предоставил автосервис]', '')
    .trim();

  return (
    <div className="bg-white rounded-2xl border-2 border-zinc-100 shadow-sm overflow-hidden">
      {/* Шапка */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full p-4 text-left flex items-start justify-between gap-2 active:bg-zinc-50 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="font-black text-zinc-900 text-sm">Наряд №{order.order_number}</span>
            <span
              className={cn(
                'text-[10px] font-black px-2 py-0.5 rounded-full uppercase',
                isOwn
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-sky-50 text-sky-700 border border-sky-200',
              )}
            >
              {isOwn ? '🏢 Свой авто · 1 600 ₽/ч' : '🚗 Клиентский · 2 000 ₽/ч'}
            </span>
            <LifecycleBadge status={order.lifecycle_status} />
          </div>
          <p className="text-xs font-extrabold text-zinc-800 truncate">{vehicleTitle}</p>
          <p className="text-[11px] text-zinc-500 font-bold mt-0.5">
            👨‍🔧 {order.mechanic?.name ?? 'Механик не указан'} · 📅 {formatDate(order.created_at)}
            {odo ? ` · 🛣 ${Number(odo).toLocaleString('ru-RU')} км` : ''}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] font-bold text-zinc-400 uppercase">ЗП Механика</p>
          <p className="font-black text-emerald-600 text-base">
            <Money amount={mechanicPay.toFixed(2)} />
          </p>
          <p className="text-[10px] text-zinc-400 font-bold">{totalMinutes} мин</p>
        </div>
      </button>

      {expanded && (
        <div>
          {/* Перечень работ */}
          <div className="px-4 pb-3 border-t border-zinc-100 pt-3 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
              4. Перечень работ ({activeWorks.length})
            </p>
            {activeWorks.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">
                {order.problem_description || 'Работы не указаны'}
              </p>
            ) : (
              <div className="space-y-1.5">
                {activeWorks.map((w: any, i: number) => {
                  const mins =
                    Number(w.actual_minutes || w.norm_minutes || 0) *
                    Math.max(1, Number(w.quantity || 1));
                  const wPrice =
                    parseFloat(w.price_client || '0') > 0
                      ? parseFloat(w.price_client)
                      : (mins / 60) * hourlyRate;
                  const customPctMatch = w.notes
                    ? String(w.notes).match(/\[salary_pct:(\d+(?:\.\d+)?)\]/)
                    : null;
                  const wPct =
                    customPctMatch && customPctMatch[1] ? parseFloat(customPctMatch[1]) : salaryPct;
                  const wPay = (wPrice * wPct) / 100;
                  return (
                    <div
                      key={w.id || i}
                      className="bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-zinc-900">
                          {i + 1}.{' '}
                          {w.custom_work_name ||
                            w.work_catalog?.name ||
                            w.work_description ||
                            'Работа'}
                        </p>
                        <p className="text-[11px] text-emerald-700 font-extrabold mt-0.5">
                          ⏱ Время: {mins} мин · ЗП: {Math.round(wPay).toLocaleString('ru-RU')} ₽
                          {customPctMatch && (
                            <span className="text-[10px] text-emerald-600 font-bold ml-1.5 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              {wPct}%
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="text-xs font-black text-zinc-700 shrink-0">
                        {Math.round(wPrice).toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Запчасти автосервиса */}
          {(order.parts_provided_by_service || parts.length > 0) && (
            <div className="px-4 pb-3 pt-2 border-t border-zinc-100 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-600 font-black text-xs">☑</span>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                  Запчасти предоставил автосервис ({parts.length})
                </span>
              </div>
              {parts.length > 0 && (
                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-2.5 space-y-1">
                  {parts.map((p: any, idx: number) => (
                    <div
                      key={p.id || idx}
                      className="flex items-center justify-between text-xs font-bold text-zinc-800"
                    >
                      <span>• {p.custom_part_name || p.part?.name || 'Запчасть'}</span>
                      <span className="text-emerald-700 font-black">
                        {p.quantity} {p.unit || p.part?.unit || 'шт'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Заметки */}
          {(cleanMechanicNote || order.admin_note) && (
            <div className="px-4 py-2 border-t border-zinc-100 space-y-1 text-xs">
              {cleanMechanicNote && (
                <p className="text-amber-700 font-medium">💬 Механик: {cleanMechanicNote}</p>
              )}
              {order.admin_note && (
                <p className="text-zinc-600 font-medium">📌 Админ: {order.admin_note}</p>
              )}
            </div>
          )}

          {/* Сводка */}
          <div className="grid grid-cols-3 border-t border-zinc-100 bg-zinc-50">
            <div className="text-center px-2 py-2.5 border-r border-zinc-100">
              <p className="text-[9px] font-bold text-zinc-400 uppercase">Время работ</p>
              <p className="font-black text-zinc-800 text-xs">
                {totalMinutes} мин ({(totalMinutes / 60).toFixed(1)} ч)
              </p>
            </div>
            <div className="text-center px-2 py-2.5 border-r border-zinc-100">
              <p className="text-[9px] font-bold text-zinc-400 uppercase">Сумма работ</p>
              <p className="font-bold text-zinc-800 text-xs">
                <Money amount={worksSum.toFixed(2)} />
              </p>
            </div>
            <div className="text-center px-2 py-2.5">
              <p className="text-[9px] font-bold text-zinc-400 uppercase">ЗП ({salaryPct}%)</p>
              <p className="font-black text-emerald-600 text-xs">
                <Money amount={mechanicPay.toFixed(2)} />
              </p>
            </div>
          </div>

          {/* Действия */}
          <div className="px-4 pb-4 pt-3 border-t border-zinc-100 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(order)}
              className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 border border-zinc-200 px-3.5 py-2.5 rounded-xl active:bg-zinc-100 shrink-0"
            >
              ✏️ Изменить
            </button>
            <button
              type="button"
              onClick={() => onDelete(order.id)}
              disabled={approving}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-500 active:bg-rose-100 disabled:opacity-50 shrink-0"
              title="Удалить заказ-наряд"
            >
              🗑️
            </button>
            {canReview && (
              <>
                <button
                  type="button"
                  onClick={() => onReturn(order.id)}
                  disabled={approving}
                  className="flex-1 text-xs font-bold text-red-600 border border-red-200 bg-red-50 py-2.5 rounded-xl active:bg-red-100 text-center disabled:opacity-50"
                >
                  Вернуть
                </button>
                <button
                  type="button"
                  onClick={() => onApprove(order.id)}
                  disabled={approving}
                  className="flex-1 text-xs font-black text-white bg-emerald-600 py-2.5 rounded-xl active:bg-emerald-700 text-center disabled:opacity-50 shadow-sm"
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

// ── Основной контент ─────────────────────────────────────────

function TripsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const filter = (searchParams.get('filter') ?? 'review') as 'review' | 'active' | 'history';
  const sectionParam = searchParams.get('section') === 'garage' ? 'garage' : 'auto';
  const [section, setSection] = useState<'auto' | 'garage'>(sectionParam);
  const queryClient = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month');
  const [tripSearch, setTripSearch] = useState('');
  const searchTripNumber = tripSearch.trim().replace(/[^0-9]/g, '');
  const [editTrip, setEditTrip] = useState<any>(null);
  const [editOrder, setEditOrder] = useState<any>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [showPrrModal, setShowPrrModal] = useState(false);

  // Запрос для поиска по номеру рейса (История)
  const { data: searchTrips = [], isLoading: searchTripsLoading } = useQuery<any[]>({
    queryKey: ['admin-trips-search', searchTripNumber],
    queryFn: () => fetch(`/api/admin/trips?trip_number=${searchTripNumber}`).then((r) => r.json()),
    enabled: filter === 'history' && searchTripNumber.length > 0,
    staleTime: 30000,
  });

  // Запрос для review/active (Авто)
  const { data: simpleTrips = [], isLoading: simpleLoading } = useQuery<any[]>({
    queryKey: ['admin-trips', filter],
    queryFn: () => fetch(`/api/admin/trips?filter=${filter}`).then((r) => r.json()),
    enabled: filter !== 'history',
    staleTime: 15000,
    refetchInterval: 30000,
  });

  // Запрос для history (Авто - все рейсы за период для статистики)
  const { data: historyTrips = [], isLoading: historyLoading } = useQuery<any[]>({
    queryKey: ['admin-trips-history', selectedDate, period],
    queryFn: () => {
      let url = `/api/admin/trips?filter=history`;
      if (period === 'month') {
        url += `&month=${selectedDate.slice(0, 7)}`;
      } else if (period === 'week') {
        const { weekStart, weekEnd } = getWeekDates(selectedDate);
        url += `&weekStart=${weekStart}&weekEnd=${weekEnd}`;
      } else {
        url += `&date=${selectedDate}`;
      }
      return fetch(url).then((r) => r.json());
    },
    enabled: filter === 'history',
    staleTime: 30000,
  });

  // Запрос для review/active (Гараж)
  const { data: simpleOrders = [], isLoading: ordersSimpleLoading } = useQuery<any[]>({
    queryKey: ['admin-service-orders', filter],
    queryFn: () => fetch(`/api/admin/service-orders?filter=${filter}`).then((r) => r.json()),
    enabled: filter !== 'history',
    staleTime: 15000,
    refetchInterval: 30000,
  });

  // Запрос для history (Гараж - все наряды за период для статистики)
  const { data: historyOrders = [], isLoading: ordersHistoryLoading } = useQuery<any[]>({
    queryKey: ['admin-service-orders-history', selectedDate, period],
    queryFn: () => {
      let url = `/api/admin/service-orders?filter=history`;
      if (period === 'month') {
        url += `&month=${selectedDate.slice(0, 7)}`;
      } else if (period === 'week') {
        const { weekStart, weekEnd } = getWeekDates(selectedDate);
        url += `&weekStart=${weekStart}&weekEnd=${weekEnd}`;
      } else {
        url += `&date=${selectedDate}`;
      }
      return fetch(url).then((r) => r.json());
    },
    enabled: filter === 'history',
    staleTime: 30000,
  });

  // Группировка рейсов и заказ-нарядов по машинам (для режима История)
  const vehicleGroups = useMemo<VehicleGroup[]>(() => {
    if (filter !== 'history') return [];

    const map = new Map<string, VehicleGroup>();
    const safeTrips = Array.isArray(historyTrips) ? historyTrips : [];
    const safeOrders = Array.isArray(historyOrders) ? historyOrders : [];

    for (const t of safeTrips) {
      const isPrr =
        t.asset?.reg_number === 'БЕЗ АВТО' || t.asset?.short_name === 'БЕЗ АВТО' || !t.asset;
      const assetKey = isPrr
        ? '👷 ПРР (без авто)'
        : `${t.asset.short_name} (${t.asset.reg_number})`;

      if (!map.has(assetKey)) {
        map.set(assetKey, {
          assetKey,
          assetName: isPrr ? '👷 ПРР' : t.asset.short_name || 'Машина',
          regNumber: isPrr ? 'без авто' : t.asset.reg_number || '',
          isPrr,
          trips: [],
          serviceOrders: [],
          tripsRevenue: 0,
          tripsPayroll: 0,
          driverPayroll: 0,
          loaderPayroll: 0,
          loaderProfit: 0,
          tripsFuel: 0,
          tripsExpenses: 0,
          tripsProfit: 0,
          maintenanceParts: 0,
          maintenanceSalary: 0,
          maintenanceTotal: 0,
          netProfit: 0,
        });
      }
      const g = map.get(assetKey)!;
      g.trips.push(t);
      const ct = calcTrip(t);
      g.tripsRevenue += ct.revenue;
      g.tripsPayroll += ct.driverPay + ct.loaderPay;
      g.driverPayroll += ct.driverPay;
      g.loaderPayroll += ct.loaderPay;
      g.loaderProfit += calcLoaderProfit(t);
      g.tripsFuel += ct.fuelExpense;
      g.tripsExpenses += ct.totalExpenses;
      g.tripsProfit += ct.profit;
    }

    for (const so of safeOrders) {
      if (so.machine_type !== 'own' || !so.asset) continue;
      const assetKey = `${so.asset.short_name ?? 'Свой ТС'} (${so.asset.reg_number ?? ''})`;
      if (!map.has(assetKey)) {
        map.set(assetKey, {
          assetKey,
          assetName: so.asset.short_name ?? 'Свой ТС',
          regNumber: so.asset.reg_number ?? '',
          isPrr: false,
          trips: [],
          serviceOrders: [],
          tripsRevenue: 0,
          tripsPayroll: 0,
          driverPayroll: 0,
          loaderPayroll: 0,
          loaderProfit: 0,
          tripsFuel: 0,
          tripsExpenses: 0,
          tripsProfit: 0,
          maintenanceParts: 0,
          maintenanceSalary: 0,
          maintenanceTotal: 0,
          netProfit: 0,
        });
      }
      const g = map.get(assetKey)!;
      g.serviceOrders.push(so);
      const cso = calcServiceOrder(so);
      g.maintenanceParts += cso.partsCost;
      g.maintenanceSalary += cso.salaryCost;
      g.maintenanceTotal += cso.totalCost;
    }

    const groups = Array.from(map.values()).map((g) => {
      g.netProfit = g.tripsProfit - g.maintenanceTotal;
      return g;
    });

    return groups.sort((a, b) => {
      if (a.isPrr) return 1;
      if (b.isPrr) return -1;
      return a.assetKey.localeCompare(b.assetKey);
    });
  }, [filter, historyTrips, historyOrders]);

  const totalFleetRevenue = useMemo(
    () => vehicleGroups.reduce((s, g) => s + g.tripsRevenue, 0),
    [vehicleGroups],
  );
  const totalFleetPayroll = useMemo(
    () => vehicleGroups.reduce((s, g) => s + g.tripsPayroll, 0),
    [vehicleGroups],
  );
  const totalFleetFuel = useMemo(
    () => vehicleGroups.reduce((s, g) => s + g.tripsFuel, 0),
    [vehicleGroups],
  );
  const totalFleetMaintenance = useMemo(
    () => vehicleGroups.reduce((s, g) => s + g.maintenanceTotal, 0),
    [vehicleGroups],
  );
  const totalFleetNetProfit = useMemo(
    () => vehicleGroups.reduce((s, g) => s + g.netProfit, 0),
    [vehicleGroups],
  );
  const totalFleetTripsCount = useMemo(
    () => vehicleGroups.reduce((s, g) => s + g.trips.length, 0),
    [vehicleGroups],
  );
  const totalFleetOrdersCount = useMemo(
    () => vehicleGroups.reduce((s, g) => s + g.serviceOrders.length, 0),
    [vehicleGroups],
  );

  const [selectedGroup, setSelectedGroup] = useState<VehicleGroup | null>(null);
  const activeSelectedGroup = selectedGroup
    ? vehicleGroups.find((g) => g.assetKey === selectedGroup.assetKey) || selectedGroup
    : null;

  const trips =
    filter === 'history' ? (searchTripNumber.length > 0 ? searchTrips : historyTrips) : simpleTrips;
  const serviceOrders = filter === 'history' ? historyOrders : simpleOrders;
  const isLoading =
    section === 'auto'
      ? filter === 'history'
        ? searchTripNumber.length > 0
          ? searchTripsLoading
          : historyLoading
        : simpleLoading
      : filter === 'history'
        ? ordersHistoryLoading
        : ordersSimpleLoading;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-summary'] });
    if (filter === 'history') {
      queryClient.invalidateQueries({ queryKey: ['admin-trips-history'] });
      queryClient.invalidateQueries({ queryKey: ['admin-service-orders-history'] });
    } else {
      queryClient.invalidateQueries({ queryKey: ['admin-trips', filter] });
      queryClient.invalidateQueries({ queryKey: ['admin-service-orders', filter] });
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

  async function handleDelete(tripId: string) {
    if (
      !confirm(
        'ВНИМАНИЕ: Это полностью удалит рейс и ВСЕ связанные с ним доходы, расходы и начисления ЗП! Вы уверены?',
      )
    )
      return;
    setApprovingId(tripId);
    try {
      const res = await fetch(`/api/admin/trips/${tripId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка удаления');
      refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setApprovingId(null);
    }
  }

  // Обработчики для Гаража (Механики)
  async function handleApproveOrder(orderId: string) {
    setApprovingId(orderId);
    try {
      const res = await fetch(`/api/admin/service-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка утверждения');
      refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setApprovingId(null);
    }
  }

  async function handleReturnOrder(orderId: string) {
    const note = prompt('Причина возврата механика на доработку (необязательно):');
    if (note === null) return;
    setApprovingId(orderId);
    try {
      const res = await fetch(`/api/admin/service-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'return', admin_note: note || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка возврата');
      refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setApprovingId(null);
    }
  }

  async function handleDeleteOrder(orderId: string) {
    if (!confirm('Удалить заказ-наряд и все связанные с ним начисления?')) return;
    setApprovingId(orderId);
    try {
      const res = await fetch(`/api/admin/service-orders/${orderId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка удаления');
      refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setApprovingId(null);
    }
  }

  const FILTERS = [
    { key: 'review', label: '📋 На ревью' },
    { key: 'active', label: section === 'auto' ? '🚛 Активные' : '🔧 В работе' },
    { key: 'history', label: '📅 История' },
  ];

  const emptyLabel =
    section === 'auto'
      ? filter === 'history' && searchTripNumber.length > 0
        ? `Рейс №${searchTripNumber} не найден`
        : filter === 'review'
          ? 'Нет рейсов на ревью'
          : filter === 'active'
            ? 'Нет активных рейсов'
            : period === 'month'
              ? 'Нет рейсов за этот месяц'
              : period === 'week'
                ? 'Нет рейсов за эту неделю'
                : 'Нет рейсов за этот день'
      : filter === 'review'
        ? 'Нет заказ-нарядов на ревью'
        : filter === 'active'
          ? 'Нет нарядов в работе'
          : period === 'month'
            ? 'Нет заказ-нарядов за этот месяц'
            : period === 'week'
              ? 'Нет заказ-нарядов за эту неделю'
              : 'Нет заказ-нарядов за этот день';

  const emptyIcon = filter === 'review' ? '✅' : section === 'auto' ? '🚛' : '🔧';

  const autoCount = Array.isArray(simpleTrips) ? simpleTrips.length : 0;
  const garageCount = Array.isArray(simpleOrders) ? simpleOrders.length : 0;

  return (
    <div>
      {/* Шапка */}
      <header className="bg-white border-b border-zinc-200 px-4 h-16 flex items-center justify-between sticky top-0 z-40">
        <h1 className="font-black text-zinc-900 text-lg uppercase tracking-tight">
          Ревью · {section === 'auto' ? 'Авто' : 'Гараж'}
        </h1>
        {section === 'auto' && (
          <button
            type="button"
            onClick={() => setShowPrrModal(true)}
            className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-black px-3.5 py-2 rounded-xl uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all"
          >
            <span className="text-sm">👷</span>
            <span>+ ПРР без авто</span>
          </button>
        )}
      </header>

      {/* 2 главные кнопки переключения: АВТО / ГАРАЖ */}
      <div className="bg-white px-4 pt-3 pb-2 border-b border-zinc-100">
        <div className="grid grid-cols-2 gap-2.5 bg-zinc-100 p-1.5 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setSection('auto');
              router.replace(`/admin/trips?filter=${filter}&section=auto`);
            }}
            className={cn(
              'py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all',
              section === 'auto'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800',
            )}
          >
            <span className="text-base">🚛</span>
            <span>Авто</span>
            {filter !== 'history' && autoCount > 0 && (
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-black',
                  section === 'auto' ? 'bg-orange-500 text-white' : 'bg-zinc-200 text-zinc-700',
                )}
              >
                {autoCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setSection('garage');
              router.replace(`/admin/trips?filter=${filter}&section=garage`);
            }}
            className={cn(
              'py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all',
              section === 'garage'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800',
            )}
          >
            <span className="text-base">🔧</span>
            <span>Гараж</span>
            {filter !== 'history' && garageCount > 0 && (
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-black',
                  section === 'garage'
                    ? 'bg-white text-emerald-700'
                    : 'bg-emerald-100 text-emerald-800',
                )}
              >
                {garageCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Фильтры */}
      <div className="bg-white border-b border-zinc-100 px-4 py-2 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => router.replace(`/admin/trips?filter=${f.key}&section=${section}`)}
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
      {filter === 'history' && (
        <DateNav
          date={selectedDate}
          period={period}
          onChange={setSelectedDate}
          setPeriod={setPeriod}
          tripSearch={tripSearch}
          onTripSearchChange={(val) => {
            setTripSearch(val);
            if (val.trim().length > 0 && section !== 'auto') {
              setSection('auto');
            }
          }}
        />
      )}

      {/* Информационный бейдж активного поиска по номеру рейса */}
      {filter === 'history' && searchTripNumber.length > 0 && (
        <div className="mx-4 mt-2 px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-xs flex items-center justify-between text-sky-800">
          <span>
            🔍 Рейс №{searchTripNumber} (найдено: {searchTrips.length})
          </span>
          <button
            type="button"
            onClick={() => setTripSearch('')}
            className="text-[10px] font-bold text-sky-600 hover:underline cursor-pointer"
          >
            ✕ Сбросить
          </button>
        </div>
      )}

      {/* Контент: АВТО vs ГАРАЖ vs ИСТОРИЯ СТАТИСТИКА ПО МАШИНАМ */}
      {isLoading ? (
        <Skeleton />
      ) : filter === 'history' && searchTripNumber.length > 0 ? (
        /* Если админ ищет конкретный рейс по номеру в истории */
        searchTrips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
            <span className="text-5xl mb-4">🔍</span>
            <p className="font-bold uppercase tracking-widest text-sm">
              Рейс №{searchTripNumber} не найден
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {searchTrips.map((trip: any) => (
              <HistoryTripCard
                key={trip.id}
                trip={trip}
                onEdit={(t) => setEditTrip(t)}
                onApprove={handleApprove}
                onReturn={handleReturn}
                onDelete={handleDelete}
                approving={approvingId === trip.id}
              />
            ))}
          </div>
        )
      ) : filter === 'history' ? (
        /* Режим История: Светлый Финтех со статистикой по машинам */
        vehicleGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
            <span className="text-5xl mb-4">📅</span>
            <p className="font-bold uppercase tracking-widest text-sm">
              Нет данных за выбранный период
            </p>
          </div>
        ) : (
          <>
            <FleetHistorySummary
              totalRevenue={totalFleetRevenue}
              totalPayroll={totalFleetPayroll}
              totalFuel={totalFleetFuel}
              totalMaintenance={totalFleetMaintenance}
              totalNetProfit={totalFleetNetProfit}
              tripsCount={totalFleetTripsCount}
              ordersCount={totalFleetOrdersCount}
            />

            <div className="px-3 pb-6 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1 flex items-center justify-between">
                <span>Машины автопарка ({vehicleGroups.length})</span>
                <span className="text-[9px] text-sky-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  Тап для деталей
                </span>
              </div>

              {vehicleGroups.map((group) => (
                <VehicleGroupCard
                  key={group.assetKey}
                  group={group}
                  onClick={() => setSelectedGroup(group)}
                />
              ))}
            </div>
          </>
        )
      ) : section === 'auto' ? (
        trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
            <span className="text-5xl mb-4">{emptyIcon}</span>
            <p className="font-bold uppercase tracking-widest text-sm">{emptyLabel}</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {trips.map((trip: any) =>
              filter === 'review' ? (
                <HistoryTripCard
                  key={trip.id}
                  trip={trip}
                  onEdit={(t) => setEditTrip(t)}
                  onApprove={handleApprove}
                  onReturn={handleReturn}
                  onDelete={handleDelete}
                  approving={approvingId === trip.id}
                />
              ) : (
                <SimpleTripCard key={trip.id} trip={trip} />
              ),
            )}
          </div>
        )
      ) : serviceOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
          <span className="text-5xl mb-4">{emptyIcon}</span>
          <p className="font-bold uppercase tracking-widest text-sm">{emptyLabel}</p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {serviceOrders.map((order: any) => (
            <ServiceOrderReviewCard
              key={order.id}
              order={order}
              onEdit={(o) => setEditOrder(o)}
              onApprove={handleApproveOrder}
              onReturn={handleReturnOrder}
              onDelete={handleDeleteOrder}
              approving={approvingId === order.id}
            />
          ))}
        </div>
      )}

      {/* Bottom Sheet детализации по машине / ПРР */}
      {activeSelectedGroup && (
        <VehicleDetailSheet
          group={activeSelectedGroup}
          onClose={() => setSelectedGroup(null)}
          onEditTrip={(trip) => setEditTrip(trip)}
        />
      )}

      {/* Модал редактирования рейса */}
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

      {/* Модал редактирования заказ-наряда */}
      {editOrder && (
        <ServiceOrderEditModal
          order={editOrder}
          onClose={() => setEditOrder(null)}
          onSaved={() => {
            setEditOrder(null);
            refresh();
          }}
        />
      )}

      {/* Модалка создания ПРР (без авто) */}
      <CreatePrrModal
        isOpen={showPrrModal}
        onClose={() => setShowPrrModal(false)}
        role="admin"
        onSuccess={refresh}
      />
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
