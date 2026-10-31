'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Money } from '@saldacargo/ui';
import {
  formatDate,
  isNoCashCounterparty,
  isTerritoryCounterparty,
  formatTerritoryDescription,
  parseTerritoryDescription,
  isGeostroyCounterparty,
  formatGeostroyDescription,
  parseGeostroyDescription,
  isGeostroyOrderValid,
  maskDateInput,
  isInternalCounterparty,
} from '@saldacargo/shared';
import { cn } from '@saldacargo/ui';

interface Counterparty {
  id: string;
  name: string;
}

interface TripOrder {
  id: string;
  amount: string;
  driver_pay: string;
  loader_pay: string;
  loader2_pay: string;
  loader_id: string | null;
  loader2_id: string | null;
  loader: { id: string; name: string } | null;
  loader2: { id: string; name: string } | null;
  payment_method: string;
  settlement_status: string;
  lifecycle_status: string;
  counterparty_id: string | null;
  counterparty: { name: string } | null;
  description?: string | null;
  direction?: string;
  is_driver_loader?: boolean;
  driver_car_pay?: string | number;
  driver_loader_pay?: string | number;
  loaders_data?: Array<{ id: string; name?: string; pay?: string | number }>;
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

interface ReviewServiceOrder {
  id: string;
  order_number: number;
  machine_type: string;
  status: string;
  lifecycle_status: string;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  problem_description: string | null;
  admin_note?: string | null;
  mechanic_note: string | null;
  mechanic_pay: string | null;
  second_mechanic_pay: string | null;
  odometer_start?: number | null;
  odometer_end?: number | null;
  client_vehicle_brand?: string | null;
  client_vehicle_model?: string | null;
  client_vehicle_reg?: string | null;
  client_name?: string | null;
  asset?: {
    id?: string;
    short_name?: string;
    reg_number?: string;
    odometer_current?: number | null;
  } | null;
  mechanic?: { id: string; name: string; mechanic_salary_pct?: number | string | null } | null;
  second_mechanic?: {
    id: string;
    name: string;
    mechanic_salary_pct?: number | string | null;
  } | null;
  works?: Array<{
    id: string;
    custom_work_name: string | null;
    work_description?: string | null;
    status: string;
    salary_paid: boolean;
    actual_minutes: number | null;
    price_client: string | null;
    norm_minutes: number | null;
    quantity?: number | null;
    mechanic_id: string | null;
    second_mechanic_id: string | null;
    work_catalog?: { name: string } | null;
    notes?: string | null;
  }>;
  parts?: Array<{
    id: string;
    custom_part_name: string | null;
    quantity: number;
    unit_price: string;
    client_price?: string | null;
    unit: string | null;
    part?: { name: string; unit: string | null } | null;
  }>;
}

interface SettlementOrderItem {
  id: string;
  type: 'trip_order' | 'manual';
  amount: number;
}

interface SettlementTransactionItem {
  id: string;
  amount: number;
  direction: 'income' | 'expense';
  description: string;
  created_at: string;
  counterparty_id: string | null;
  counterparty_name: string | null;
  orders: SettlementOrderItem[];
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: '💵 Наличные',
  qr: '⚡ QR-код',
  bank_invoice: '🏛️ Безнал (Р/С)',
  debt_cash: '⏳ Долг',
  card_driver: '⚡ QR-код',
  fuel_card: '⛽ Топливная карта ТК',
};

const PAYMENT_STYLES: Record<string, string> = {
  cash: 'bg-emerald-600 text-white font-black border-emerald-700 shadow-xs',
  qr: 'bg-purple-600 text-white font-black border-purple-700 shadow-xs ring-2 ring-purple-300',
  bank_invoice: 'bg-blue-600 text-white font-bold border-blue-700',
  debt_cash: 'bg-rose-600 text-white font-bold border-rose-700',
  card_driver:
    'bg-purple-600 text-white font-black border-purple-700 shadow-xs ring-2 ring-purple-300',
  fuel_card: 'bg-amber-600 text-white font-black border-amber-700 shadow-xs',
};

const PAYMENT_EDIT_OPTIONS = [
  { value: 'qr', label: 'QR-код' },
  { value: 'cash', label: 'Наличный' },
  { value: 'debt_cash', label: 'Долг' },
];

// ── Helpers ────────────────────────────────────────────────

function calcServiceOrder(o: ReviewServiceOrder) {
  const parts = o.parts ?? [];
  const works = o.works ?? [];

  const desc = o.problem_description || '';
  const note = o.admin_note || '';

  // Reliable detection of external services and contractor name
  const externalMatch =
    desc.match(/\[Сторонний сервис(?::\s*([^\]]+))?\]/i) ||
    note.match(/\[Сторонний сервис(?::\s*([^\]]+))?\]/i) ||
    note.match(/Исполнитель:\s*([^.]+)/i);

  const isExternal =
    Boolean(externalMatch) ||
    desc.includes('[Сторонний сервис') ||
    note.includes('[Сторонний сервис');

  let contractorName: string | null = null;
  if (externalMatch && externalMatch[1]) {
    contractorName = externalMatch[1].trim();
  } else if (note.includes('Исполнитель:')) {
    const m = note.match(/Исполнитель:\s*([^.]+)/i);
    if (m && m[1]) contractorName = m[1].trim();
  }

  // Equipment / tuning detection
  const fullText =
    `${desc} ${note} ${works.map((w) => w.custom_work_name || '').join(' ')} ${parts.map((p) => p.custom_part_name || '').join(' ')}`.toLowerCase();
  const isEquipment =
    fullText.includes('доп. оборудован') ||
    fullText.includes('допоборудован') ||
    fullText.includes('установка доп') ||
    fullText.includes('пневмо') ||
    fullText.includes('вебасто') ||
    fullText.includes('автономк') ||
    fullText.includes('тахограф') ||
    fullText.includes('рация') ||
    fullText.includes('спойлер') ||
    fullText.includes('фаркоп');

  const partsCost = parts.reduce(
    (sum, p) => sum + (Number(p.unit_price) || 0) * (Number(p.quantity) || 1),
    0,
  );

  let salaryCost = 0;
  let worksCost = 0;

  if (isExternal) {
    // 100% of work cost is an external expense paid to the contractor
    worksCost = works
      .filter((w) => w.status !== 'cancelled')
      .reduce((sum, w) => sum + (Number(w.price_client) || 0), 0);
    salaryCost = 0;
  } else {
    const m1Pay = Number(o.mechanic_pay) || 0;
    const m2Pay = Number(o.second_mechanic_pay) || 0;
    salaryCost = m1Pay + m2Pay;
    if (salaryCost <= 0) {
      salaryCost = works
        .filter((w) => w.status !== 'cancelled')
        .reduce((sum, w) => {
          const customPctMatch = w.notes
            ? String(w.notes).match(/\[salary_pct:(\d+(?:\.\d+)?)\]/)
            : null;
          const pct =
            customPctMatch && customPctMatch[1] ? parseFloat(customPctMatch[1]) / 100 : 0.5;
          return sum + (Number(w.price_client) || 0) * pct;
        }, 0);
    }
  }

  const totalCost = isExternal ? partsCost + worksCost : partsCost + salaryCost;
  return { partsCost, salaryCost, worksCost, totalCost, isExternal, contractorName, isEquipment };
}

// Систему заработка компании 30% с услуг грузчиков ввели 1 сентября 2026 года (миграция 20260901000000_order_payroll_v2.sql).
// До 01.09.2026 компания не брала маржу с услуг погрузки, поэтому статистика прибыли с грузчиков ведётся строго с 01.09.2026.
const LOADER_PROFIT_START_DATE = '2026-09-01';

function isLoaderProfitEligible(tripStartedAt?: string | null): boolean {
  if (!tripStartedAt) return true;
  return tripStartedAt.slice(0, 10) >= LOADER_PROFIT_START_DATE;
}

function calcOrderLoaderMetrics(o: TripOrder, tripStartedAt?: string | null) {
  const lp1 = parseFloat(o.loader_pay || '0');
  const lp2 = parseFloat(o.loader2_pay || '0');
  let thirdPartyPay = 0;
  if (Array.isArray(o.loaders_data) && o.loaders_data.length > 0) {
    thirdPartyPay = o.loaders_data.reduce((s, l) => s + (parseFloat(String(l.pay)) || 0), 0);
  } else {
    thirdPartyPay = lp1 + lp2;
  }
  const driverLoaderPay = o.is_driver_loader ? parseFloat(String(o.driver_loader_pay || '0')) : 0;
  const totalPaid = thirdPartyPay + driverLoaderPay;
  if (totalPaid <= 0) {
    return { profit: 0, thirdPartyPay: 0, driverLoaderPay: 0, totalPaid: 0, loadersPool: 0 };
  }

  // До 01.09.2026 система 30% с грузчиков не действовала — маржа компании 0, весь пул шёл рабочим
  // Также для собственных внутренних работ компании (ТК501 / ТК510) маржа не начисляется
  if (!isLoaderProfitEligible(tripStartedAt) || isInternalCounterparty(o.counterparty)) {
    return { profit: 0, thirdPartyPay, driverLoaderPay, totalPaid, loadersPool: 0 };
  }

  const dcp = parseFloat(String(o.driver_car_pay || '0'));
  const amt = parseFloat(o.amount || '0');
  let loadersPool = 0;
  if (dcp > 0 && amt > 0) {
    const mPool = Math.round(dcp / 0.3);
    loadersPool = Math.max(0, amt - mPool);
  }
  if (loadersPool < totalPaid) {
    loadersPool = Math.round(totalPaid / 0.7);
  }
  const profit = Math.max(0, loadersPool - totalPaid);
  return { profit, thirdPartyPay, driverLoaderPay, totalPaid, loadersPool };
}

function calcOrderLoaderProfit(o: TripOrder, tripStartedAt?: string | null): number {
  return calcOrderLoaderMetrics(o, tripStartedAt).profit;
}

function calcTrip(trip: TripForReview) {
  const activeOrders = trip.trip_orders.filter((o) => o.lifecycle_status !== 'cancelled');
  const expenses = trip.trip_expenses ?? [];
  const revenue = activeOrders.reduce(
    (s, o) => s + (isInternalCounterparty(o.counterparty) ? 0 : parseFloat(o.amount || '0')),
    0,
  );
  const driverPay = activeOrders.reduce((s, o) => s + parseFloat(o.driver_pay), 0);
  const loaderPay = activeOrders.reduce(
    (s, o) => s + parseFloat(o.loader_pay) + parseFloat(o.loader2_pay ?? '0'),
    0,
  );
  const totalPayroll = driverPay + loaderPay;

  let loaderProfit = 0;
  let driverLoaderPay = 0;
  let thirdPartyLoaderPay = 0;
  let loadingBilled = 0;

  for (const o of activeOrders) {
    const m = calcOrderLoaderMetrics(o, trip.started_at);
    loaderProfit += m.profit;
    driverLoaderPay += m.driverLoaderPay;
    thirdPartyLoaderPay += m.thirdPartyPay;
    loadingBilled += m.loadersPool;
  }

  const driverCarPay = Math.max(0, driverPay - driverLoaderPay);
  const totalLoadingPayroll = thirdPartyLoaderPay + driverLoaderPay;

  const collectedRevenue = activeOrders
    .filter((o) => o.settlement_status === 'completed' && !isInternalCounterparty(o.counterparty))
    .reduce((s, o) => s + (parseFloat(o.amount) || 0), 0);
  const pendingDebt = activeOrders
    .filter((o) => o.settlement_status === 'pending' && !isInternalCounterparty(o.counterparty))
    .reduce((s, o) => s + (parseFloat(o.amount) || 0), 0);

  const fuelExpense = expenses
    .filter((e) => e.category?.name === 'ГСМ')
    .reduce((s, e) => s + parseFloat(e.amount), 0);
  const totalExpenses = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
  const mileage = trip.odometer_end ? trip.odometer_end - trip.odometer_start : 0;
  const profit = revenue - driverPay - loaderPay - totalExpenses;
  return {
    activeOrders,
    expenses,
    revenue,
    collectedRevenue,
    pendingDebt,
    driverPay,
    driverCarPay,
    driverLoaderPay,
    thirdPartyLoaderPay,
    totalLoadingPayroll,
    loadingBilled,
    loaderPay,
    totalPayroll,
    loaderProfit,
    fuelExpense,
    totalExpenses,
    mileage,
    profit,
  };
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

// ── Date Navigation ─────────────────────────────────────────

function DateNav({
  date,
  period = 'day',
  onChange,
  setPeriod,
}: {
  date: string;
  period?: 'day' | 'week' | 'month';
  onChange: (d: string) => void;
  setPeriod?: (p: 'day' | 'week' | 'month') => void;
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

  const weeks = Array.from({ length: 5 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (4 - i) * 7);
    const { weekStart, weekEnd } = getWeekDates(d.toISOString().slice(0, 10));
    const ws = new Date(weekStart + 'T12:00:00');
    const we = new Date(weekEnd + 'T12:00:00');
    return {
      date: weekStart,
      label: `${ws.getDate()} ${ws.toLocaleDateString('ru-RU', { month: 'short' })} — ${we.getDate()} ${we.toLocaleDateString('ru-RU', { month: 'short' })}`,
    };
  });

  const curMonth = new Date(date).getMonth();
  const curYear = new Date(date).getFullYear();
  const isToday = date === today;

  return (
    <div className="flex flex-wrap items-center justify-between border-b border-sky-100 px-3.5 py-1.5 gap-2 bg-sky-100/40">
      {/* Переключатель периода: День / Неделя / Месяц */}
      {setPeriod && (
        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-sky-200/70">
          <button
            type="button"
            onClick={() => setPeriod('day')}
            className={cn(
              'px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer',
              period === 'day'
                ? 'bg-sky-500 text-white shadow-2xs'
                : 'text-sky-700 hover:bg-sky-50',
            )}
          >
            День
          </button>
          <button
            type="button"
            onClick={() => setPeriod('week')}
            className={cn(
              'px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer',
              period === 'week'
                ? 'bg-sky-500 text-white shadow-2xs'
                : 'text-sky-700 hover:bg-sky-50',
            )}
          >
            Неделя
          </button>
          <button
            type="button"
            onClick={() => setPeriod('month')}
            className={cn(
              'px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer',
              period === 'month'
                ? 'bg-sky-500 text-white shadow-2xs'
                : 'text-sky-700 hover:bg-sky-50',
            )}
          >
            Месяц
          </button>
        </div>
      )}

      {/* Компактный выбор даты по центру */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="px-2.5 py-0.5 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 rounded-lg text-white font-black text-xs cursor-pointer shadow-2xs transition-colors"
          aria-label="Предыдущий период"
        >
          ←
        </button>

        <label className="flex items-center gap-1.5 px-2 cursor-pointer">
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && onChange(e.target.value)}
            className="sr-only"
          />
          <span className="material-symbols-outlined text-sky-600 text-[16px]">calendar_today</span>
          <span className="text-sm font-black text-sky-950 hover:text-sky-700 transition-colors whitespace-nowrap">
            {period === 'day' &&
              new Date(date + 'T12:00:00').toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
              })}
            {period === 'week' &&
              (() => {
                const { weekStart, weekEnd } = getWeekDates(date);
                const ws = new Date(weekStart + 'T12:00:00');
                const we = new Date(weekEnd + 'T12:00:00');
                return `${ws.getDate()} ${ws.toLocaleDateString('ru-RU', { month: 'short' })} — ${we.getDate()} ${we.toLocaleDateString('ru-RU', { month: 'short' })}`;
              })()}
            {period === 'month' &&
              new Date(date + 'T12:00:00').toLocaleDateString('ru-RU', {
                month: 'long',
                year: 'numeric',
              })}
          </span>
          {period === 'day' && (
            <span className="text-xs font-medium text-sky-700/70 whitespace-nowrap hidden sm:inline">
              {new Date(date + 'T12:00:00').toLocaleDateString('ru-RU', {
                weekday: 'short',
                year: 'numeric',
              })}
            </span>
          )}
          {!isToday && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onChange(today);
              }}
              className="text-[10px] font-bold text-sky-700 bg-sky-100 hover:bg-sky-200 border border-sky-300/70 px-1.5 py-0.5 rounded-full whitespace-nowrap cursor-pointer transition-colors"
            >
              → сегодня
            </button>
          )}
        </label>

        <button
          type="button"
          onClick={() => shift(1)}
          disabled={date >= today}
          className="px-2.5 py-0.5 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 rounded-lg text-white font-black text-xs cursor-pointer shadow-2xs transition-colors disabled:bg-sky-100 disabled:text-sky-300 disabled:cursor-not-allowed disabled:shadow-none"
          aria-label="Следующий период"
        >
          →
        </button>
      </div>

      {/* Быстрые месяцы / недели справа */}
      {period !== 'week' ? (
        <div className="flex items-center gap-1 overflow-x-auto">
          {months.map((m) => {
            const active = m.month === curMonth && m.year === curYear;
            return (
              <button
                type="button"
                key={`${m.year}-${m.month}`}
                onClick={() => goMonth(m.year, m.month)}
                className={cn(
                  'px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all whitespace-nowrap cursor-pointer',
                  active ? 'bg-sky-500 text-white shadow-2xs' : 'text-sky-700 hover:bg-white',
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-1 overflow-x-auto">
          {weeks.map((w) => {
            const active = getWeekDates(date).weekStart === w.date;
            return (
              <button
                type="button"
                key={w.date}
                onClick={() => onChange(w.date)}
                className={cn(
                  'px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide transition-all whitespace-nowrap cursor-pointer',
                  active ? 'bg-sky-500 text-white shadow-2xs' : 'text-sky-700 hover:bg-white',
                )}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Edit Modal ──────────────────────────────────────────────

type EditableOrder = {
  id: string;
  isNew?: boolean;
  amount: string;
  driver_pay: string;
  loader_pay: string;
  loader2_pay: string;
  loader_id?: string | null;
  loader2_id?: string | null;
  loader?: { id: string; name: string } | null;
  loader2?: { id: string; name: string } | null;
  payment_method: string;
  settlement_status?: string;
  lifecycle_status?: string;
  counterparty_id?: string | null;
  counterparty?: { name: string } | null;
  description?: string | null;
  _selectedId: string | null;
  _inputValue: string;
  _deleted?: boolean;
};

type EditableExpense = {
  id: string;
  isNew?: boolean;
  amount: string;
  payment_method: string;
  description: string;
  _deleted?: boolean;
};

function CounterpartySelect({
  value,
  inputValue,
  counterparties,
  onChange,
}: {
  value: string | null;
  inputValue: string;
  counterparties: Counterparty[];
  onChange: (id: string | null, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prevInputValue, setPrevInputValue] = useState(inputValue);
  const [query, setQuery] = useState(inputValue);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (inputValue !== prevInputValue) {
    setPrevInputValue(inputValue);
    setQuery(inputValue);
  }

  const filtered = query.trim()
    ? counterparties.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : counterparties;

  const exactMatch = counterparties.find(
    (c) => c.name.toLowerCase().trim() === query.toLowerCase().trim(),
  );

  const handleSelect = (cp: Counterparty) => {
    setQuery(cp.name);
    setOpen(false);
    onChange(cp.id, cp.name);
  };

  const handleClear = () => {
    setQuery('');
    setOpen(false);
    onChange(null, '');
  };

  const handleBlur = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  };

  const handleFocus = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <input
          type="text"
          className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
          value={query}
          placeholder="Поиск клиента или ввод нового..."
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value.trim()) {
              onChange(null, '');
            } else {
              const matched = counterparties.find(
                (c) => c.name.toLowerCase() === e.target.value.toLowerCase().trim(),
              );
              onChange(matched ? matched.id : null, e.target.value);
            }
          }}
        />
        <svg
          className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-3.35z"
          />
        </svg>
        {query && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
            className="absolute right-2.5 w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 text-xs font-bold transition-colors cursor-pointer"
          >
            ×
          </button>
        )}
      </div>

      {open && (filtered.length > 0 || (query.trim() && !exactMatch)) && (
        <ul className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto py-1 divide-y divide-slate-50 animate-in fade-in zoom-in-95 duration-100">
          {filtered.slice(0, 25).map((cp) => (
            <li key={cp.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(cp)}
                className={cn(
                  'w-full text-left px-3.5 py-2 text-sm flex items-center justify-between hover:bg-indigo-50/60 transition-colors cursor-pointer',
                  cp.id === value ? 'bg-indigo-50 font-bold text-indigo-900' : 'text-slate-700',
                )}
              >
                <span>{cp.name}</span>
                {cp.id === value && (
                  <span className="text-xs text-indigo-600 font-semibold">✓ Выбран</span>
                )}
              </button>
            </li>
          ))}
          {query.trim() && !exactMatch && (
            <li>
              <div className="px-3.5 py-2 text-xs text-indigo-600 bg-indigo-50/40 flex items-center gap-1.5 font-medium">
                <span>➕ Будет создан новый клиент:</span>
                <span className="font-bold text-indigo-900">«{query.trim()}»</span>
              </div>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

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
  const [orders, setOrders] = useState<EditableOrder[]>(() =>
    activeOrders.map((o) => ({
      ...o,
      description: o.description ?? '',
      _selectedId: o.counterparty_id,
      _inputValue: o.counterparty?.name ?? '',
      _deleted: false,
    })),
  );
  const [expenses, setExpenses] = useState<EditableExpense[]>(() =>
    (trip.trip_expenses ?? []).map((e) => ({
      id: e.id,
      amount: e.amount || '0',
      payment_method: e.payment_method || 'fuel_card',
      description: e.description ?? '',
      _deleted: false,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: counterparties = [] } = useQuery<Counterparty[]>({
    queryKey: ['counterparties-list'],
    queryFn: () =>
      fetch('/api/counterparties?active=1')
        .then((r) => r.json())
        .then((d) =>
          Array.isArray(d) ? d.map((c: Counterparty) => ({ id: c.id, name: c.name })) : [],
        ),
    staleTime: 60000,
  });

  const update = (id: string, field: keyof EditableOrder, value: string) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, [field]: value } : o)));
  };

  const updateCounterparty = (orderId: string, cpId: string | null, cpName: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const cp = counterparties.find((c) => c.id === cpId) || cpName;
        const isNoCash = isNoCashCounterparty(cp);
        const newPaymentMethod =
          isNoCash && o.payment_method === 'cash' ? 'debt_cash' : o.payment_method;
        return {
          ...o,
          _selectedId: cpId,
          _inputValue: cpName,
          payment_method: newPaymentMethod,
        };
      }),
    );
  };

  const updateExpense = (id: string, field: keyof EditableExpense, value: string) => {
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const addExpense = () => {
    const newExp: EditableExpense = {
      id: `new-exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      isNew: true,
      amount: '',
      payment_method: 'fuel_card',
      description: '',
      _deleted: false,
    };
    setExpenses((prev) => [...prev, newExp]);
  };

  const removeExpense = (id: string) => {
    setExpenses((prev) => {
      const target = prev.find((e) => e.id === id);
      if (!target) return prev;
      if (target.isNew) {
        return prev.filter((e) => e.id !== id);
      }
      return prev.map((e) => (e.id === id ? { ...e, _deleted: true } : e));
    });
  };

  const restoreExpense = (id: string) => {
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, _deleted: false } : e)));
  };

  const addOrder = () => {
    const defaultLoaderId =
      trip.loader?.id ?? activeOrders.find((o) => o.loader_id)?.loader_id ?? null;
    const defaultLoader = trip.loader ?? activeOrders.find((o) => o.loader)?.loader ?? null;
    const defaultLoader2Id = activeOrders.find((o) => o.loader2_id)?.loader2_id ?? null;
    const defaultLoader2 = activeOrders.find((o) => o.loader2)?.loader2 ?? null;

    const newOrder: EditableOrder = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      isNew: true,
      amount: '',
      driver_pay: '',
      loader_pay: defaultLoaderId ? '0' : '0',
      loader2_pay: defaultLoader2Id ? '0' : '0',
      loader_id: defaultLoaderId,
      loader2_id: defaultLoader2Id,
      loader: defaultLoader,
      loader2: defaultLoader2,
      payment_method: 'debt_cash',
      settlement_status: 'pending',
      lifecycle_status: trip.lifecycle_status === 'approved' ? 'approved' : 'draft',
      counterparty_id: null,
      counterparty: null,
      description: '',
      _selectedId: null,
      _inputValue: '',
      _deleted: false,
    };
    setOrders((prev) => [...prev, newOrder]);
  };

  const removeOrder = (orderId: string) => {
    setOrders((prev) => {
      const target = prev.find((o) => o.id === orderId);
      if (!target) return prev;
      if (target.isNew) {
        return prev.filter((o) => o.id !== orderId);
      }
      return prev.map((o) => (o.id === orderId ? { ...o, _deleted: true } : o));
    });
  };

  const restoreOrder = (orderId: string) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, _deleted: false } : o)));
  };

  const save = async () => {
    const nonDeleted = orders.filter((o) => !o._deleted);
    if (nonDeleted.length === 0) {
      setError('В рейсе должен оставаться хотя бы один заказ');
      return;
    }

    for (let i = 0; i < nonDeleted.length; i++) {
      const o = nonDeleted[i];
      if (!o) continue;
      const amt = parseFloat(o.amount);
      if (isNaN(amt) || amt <= 0) {
        setError(`Укажите корректную сумму для заявки ${i + 1}`);
        return;
      }
      const cp = counterparties.find((c) => c.id === o._selectedId) || o._inputValue;
      if (isNoCashCounterparty(cp) && o.payment_method === 'cash') {
        const cpTitle = typeof cp === 'object' && cp?.name ? cp.name : o._inputValue || 'Клиент';
        setError(
          `Для контрагента «${cpTitle}» (заявка ${i + 1}) оплата наличными запрещена. Выберите «Долг» или «Безнал по счёту».`,
        );
        return;
      }
      if (isTerritoryCounterparty(cp)) {
        const parsed = parseTerritoryDescription(o.description);
        if (!parsed.address.trim() || !parsed.work.trim()) {
          setError(
            `Для контрагента «Территория» (заявка ${i + 1}) обязательно укажите Адрес (улица + дом) и Описание работы для счёта!`,
          );
          return;
        }
      }
      if (isGeostroyCounterparty(cp)) {
        if (!isGeostroyOrderValid(o.description)) {
          setError(
            `Для контрагента «ООО Геостройиндустрия» (заявка ${i + 1}) обязательно укажите Маршрут и корректную Дату начала маршрута по маске (ДД.ММ.ГГГГ)!`,
          );
          return;
        }
      }
    }

    const nonDeletedExpenses = expenses.filter((e) => !e._deleted);
    for (let i = 0; i < nonDeletedExpenses.length; i++) {
      const e = nonDeletedExpenses[i];
      if (!e) continue;
      const amt = parseFloat(e.amount);
      if (isNaN(amt) || amt < 0) {
        setError(`Укажите корректную сумму для расхода ${i + 1}`);
        return;
      }
    }

    setSaving(true);
    setError('');

    const payload = nonDeleted.map((o) => ({
      id: o.id,
      isNew: o.isNew,
      amount: o.amount,
      driver_pay: o.driver_pay || '0',
      loader_pay: o.loader_pay || '0',
      loader2_pay: o.loader2_pay ?? '0',
      loader_id: o.loader_id ?? null,
      loader2_id: o.loader2_id ?? null,
      payment_method: o.payment_method,
      counterparty_id: o._selectedId,
      description: o.description?.trim() || null,
      ...(o._selectedId === null && o._inputValue.trim()
        ? { counterparty_name: o._inputValue.trim() }
        : {}),
    }));

    const deletedIds = orders.filter((o) => o._deleted && !o.isNew).map((o) => o.id);

    const expensesPayload = nonDeletedExpenses.map((e) => ({
      id: e.id,
      isNew: e.isNew,
      amount: e.amount || '0',
      payment_method: e.payment_method,
      description: e.description,
    }));

    const deletedExpenseIds = expenses.filter((e) => e._deleted && !e.isNew).map((e) => e.id);

    try {
      const res = await fetch(`/api/trips/${trip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orders: payload,
          deleted_order_ids: deletedIds.length > 0 ? deletedIds : undefined,
          expenses: expensesPayload,
          deleted_expense_ids: deletedExpenseIds.length > 0 ? deletedExpenseIds : undefined,
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
      setError('Не удалось сохранить изменения. Проверьте соединение.');
    }
  };

  const visibleOrders = orders.filter((o) => !o._deleted);
  const totalRevenue = visibleOrders.reduce((s, o) => s + (parseFloat(o.amount) || 0), 0);
  const totalDriverPay = visibleOrders.reduce((s, o) => s + (parseFloat(o.driver_pay) || 0), 0);
  const totalLoaderPay = visibleOrders.reduce(
    (s, o) => s + (parseFloat(o.loader_pay) || 0) + (parseFloat(o.loader2_pay ?? '0') || 0),
    0,
  );
  const visibleExpenses = expenses.filter((e) => !e._deleted);
  const totalExpenses = visibleExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const estimatedProfit = totalRevenue - totalDriverPay - totalLoaderPay - totalExpenses;

  const inputCls =
    'w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl my-auto sm:my-8 overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/10 text-white border border-white/15">
                Смена #{trip.trip_number}
              </span>
              {trip.lifecycle_status === 'approved' ? (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Утверждён
                </span>
              ) : (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  На проверке
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-black mt-1 text-white flex items-center gap-2">
              Редактирование рейса
            </h2>
            <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-1.5 font-medium">
              <span>
                {trip.asset?.reg_number === 'БЕЗ АВТО'
                  ? '👷 Погрузо-разгрузочные работы (без авто)'
                  : `🚚 ${trip.asset.short_name} (${trip.asset.reg_number})`}
              </span>
              <span>·</span>
              <span>👤 {trip.driver.name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white text-xl font-bold transition-colors cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Live KPI Summary Ribbon */}
        <div className="bg-slate-50 border-b border-slate-200/80 px-6 py-3.5 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Заявок в рейсе
            </span>
            <span className="text-base font-black text-slate-900">
              {visibleOrders.length} {visibleOrders.length === 1 ? 'заказ' : 'заказа'}
            </span>
          </div>
          <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Выручка
            </span>
            <span className="text-base font-black text-emerald-600">
              <Money amount={totalRevenue.toFixed(2)} />
            </span>
          </div>
          <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              ЗП водителя
            </span>
            <span className="text-base font-black text-indigo-600">
              <Money amount={totalDriverPay.toFixed(2)} />
            </span>
          </div>
          <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              ГСМ / Расходы
            </span>
            <span className="text-base font-black text-amber-600">
              {totalExpenses > 0 ? (
                <>
                  -<Money amount={totalExpenses.toFixed(2)} />
                </>
              ) : (
                '0 ₽'
              )}
            </span>
          </div>
          <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-2xs col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Прибыль рейса
            </span>
            <span
              className={cn(
                'text-base font-black',
                estimatedProfit >= 0 ? 'text-emerald-700' : 'text-rose-600',
              )}
            >
              <Money amount={estimatedProfit.toFixed(2)} />
            </span>
          </div>
        </div>

        {/* Orders Scroll Container */}
        <div className="p-6 space-y-5 max-h-[58vh] overflow-y-auto">
          {orders.map((order, idx) => {
            if (order._deleted) {
              return (
                <div
                  key={order.id}
                  className="border border-dashed border-rose-300 bg-rose-50/50 rounded-2xl p-4 flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2.5 text-rose-800 font-medium">
                    <span className="w-6 h-6 rounded-full bg-rose-200 text-rose-700 flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span>
                      Заявка #{idx + 1} (
                      {order._inputValue || order.counterparty?.name || 'Без клиента'} —{' '}
                      {order.amount || '0'} ₽) помечена на удаление
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => restoreOrder(order.id)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 hover:border-indigo-300 px-3 py-1.5 rounded-lg transition-colors shadow-2xs cursor-pointer"
                  >
                    Вернуть заявку
                  </button>
                </div>
              );
            }

            const amtNum = parseFloat(order.amount) || 0;
            const suggestedPay = Math.round(amtNum * 0.3);

            return (
              <div
                key={order.id}
                className="border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4 bg-slate-50/50 shadow-2xs hover:border-slate-300 transition-all relative group"
              >
                {/* Order Header */}
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-black">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Заявка {idx + 1}
                    </span>
                    {order.isNew && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Новая
                      </span>
                    )}
                  </div>
                  {visibleOrders.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeOrder(order.id)}
                      className="text-xs font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      title="Удалить эту заявку"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      <span>Удалить заявку</span>
                    </button>
                  )}
                </div>

                {/* Counterparty Input */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                    Клиент / Контрагент
                  </label>
                  <CounterpartySelect
                    value={order._selectedId}
                    inputValue={order._inputValue}
                    counterparties={counterparties}
                    onChange={(id, name) => updateCounterparty(order.id, id, name)}
                  />

                  {/* Обязательное правило для контрагента «Территория» (Адрес + Работа) */}
                  {(() => {
                    const currentCp =
                      counterparties.find((c) => c.id === order._selectedId) || order._inputValue;
                    if (isTerritoryCounterparty(currentCp)) {
                      const parsed = parseTerritoryDescription(order.description);
                      return (
                        <div className="p-3 bg-blue-50/90 border-2 border-blue-300 rounded-xl space-y-2 mt-2 shadow-2xs">
                          <div className="flex items-center gap-1.5 text-xs font-black text-blue-950 uppercase tracking-wide">
                            <span>🏢</span>
                            <span>
                              Правило для контрагента «Территория» (для выставления счетов):
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="text-[10px] font-black text-blue-950 uppercase block mb-1">
                                📍 Адрес (улица + дом){' '}
                                <span className="text-rose-600 font-black">*</span>
                              </label>
                              <input
                                type="text"
                                placeholder="Например: ул. Ленина, д. 45"
                                className={inputCls}
                                value={parsed.address}
                                onChange={(e) => {
                                  const currentWork = parseTerritoryDescription(
                                    order.description,
                                  ).work;
                                  update(
                                    order.id,
                                    'description',
                                    formatTerritoryDescription(e.target.value, currentWork),
                                  );
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-black text-blue-950 uppercase block mb-1">
                                🛠️ Описание работы{' '}
                                <span className="text-rose-600 font-black">*</span>
                              </label>
                              <input
                                type="text"
                                placeholder="Например: Вывоз мусора / ПРР"
                                className={inputCls}
                                value={parsed.work}
                                onChange={(e) => {
                                  const currentAddr = parseTerritoryDescription(
                                    order.description,
                                  ).address;
                                  update(
                                    order.id,
                                    'description',
                                    formatTerritoryDescription(currentAddr, e.target.value),
                                  );
                                }}
                              />
                            </div>
                          </div>
                          {order.description && (
                            <div className="text-[11px] text-blue-900 bg-white/90 p-2 rounded-lg border border-blue-200">
                              <span className="font-bold text-blue-950">В счёт пойдёт:</span>{' '}
                              <span className="font-semibold text-slate-800">
                                {order.description}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    }
                    if (isGeostroyCounterparty(currentCp)) {
                      const parsed = parseGeostroyDescription(order.description);
                      return (
                        <div className="p-3 bg-amber-50/90 border-2 border-amber-300 rounded-xl space-y-2 mt-2 shadow-2xs">
                          <div className="flex items-center gap-1.5 text-xs font-black text-amber-950 uppercase tracking-wide">
                            <span>🏗️</span>
                            <span>Правило для контрагента «ООО Геостройиндустрия»:</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="text-[10px] font-black text-amber-950 uppercase block mb-1">
                                📍 Маршрут <span className="text-rose-600 font-black">*</span>
                              </label>
                              <input
                                type="text"
                                placeholder="Например: Верхняя Салда — Екатеринбург"
                                className={inputCls}
                                value={parsed.route}
                                onChange={(e) => {
                                  const currentStartDate = parseGeostroyDescription(
                                    order.description,
                                  ).startDate;
                                  update(
                                    order.id,
                                    'description',
                                    formatGeostroyDescription(e.target.value, currentStartDate),
                                  );
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-black text-amber-950 uppercase block mb-1">
                                📅 Дата начала (ДД.ММ.ГГГГ){' '}
                                <span className="text-rose-600 font-black">*</span>
                              </label>
                              <input
                                type="text"
                                maxLength={10}
                                placeholder="ДД.ММ.ГГГГ"
                                className={`${inputCls} font-mono`}
                                value={parsed.startDate}
                                onChange={(e) => {
                                  const masked = maskDateInput(e.target.value);
                                  const currentRoute = parseGeostroyDescription(
                                    order.description,
                                  ).route;
                                  update(
                                    order.id,
                                    'description',
                                    formatGeostroyDescription(currentRoute, masked),
                                  );
                                }}
                              />
                            </div>
                          </div>
                          {order.description && (
                            <div className="text-[11px] text-amber-950 bg-white/90 p-2 rounded-lg border border-amber-200">
                              <span className="font-bold text-amber-950">В отчёт пойдёт:</span>{' '}
                              <span className="font-semibold text-slate-800">
                                {order.description}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div className="mt-2.5">
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-wide block mb-1">
                          💬 Комментарий / примечание водителя к заказу
                        </label>
                        <input
                          type="text"
                          placeholder="Детали: адрес, холодильник, этаж, клиент обещал перевести..."
                          className={inputCls}
                          value={order.description || ''}
                          onChange={(e) => update(order.id, 'description', e.target.value)}
                        />
                      </div>
                    );
                  })()}
                </div>

                {/* Financial Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Amount */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                      Сумма заказа, ₽
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="0"
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

                  {/* Driver Pay */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        ЗП водителя, ₽
                      </label>
                      {amtNum > 0 && (
                        <button
                          type="button"
                          onClick={() => update(order.id, 'driver_pay', suggestedPay.toString())}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                          title="Установить стандартные 30%"
                        >
                          30%: {suggestedPay.toLocaleString('ru-RU')} ₽
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="0"
                      className={inputCls}
                      value={order.driver_pay}
                      onChange={(e) => update(order.id, 'driver_pay', e.target.value)}
                    />
                  </div>

                  {/* Loader 1 */}
                  {(order.loader_id || parseFloat(order.loader_pay) > 0 || trip.loader) && (
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                        ЗП{' '}
                        {order.loader
                          ? order.loader.name.split(' ')[0]
                          : trip.loader
                            ? trip.loader.name.split(' ')[0]
                            : 'грузчика'}
                        , ₽
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder="0"
                        className={inputCls}
                        value={order.loader_pay}
                        onChange={(e) => update(order.id, 'loader_pay', e.target.value)}
                      />
                    </div>
                  )}

                  {/* Loader 2 */}
                  {(order.loader2_id || parseFloat(order.loader2_pay ?? '0') > 0) && (
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                        ЗП {order.loader2 ? order.loader2.name.split(' ')[0] : 'грузчика 2'}, ₽
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder="0"
                        className={inputCls}
                        value={order.loader2_pay ?? '0'}
                        onChange={(e) => update(order.id, 'loader2_pay', e.target.value)}
                      />
                    </div>
                  )}

                  {/* Payment Method */}
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                      Способ оплаты
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {PAYMENT_EDIT_OPTIONS.map(({ value, label }) => {
                        const currentCp =
                          counterparties.find((c) => c.id === order._selectedId) ||
                          order._inputValue;
                        const isNoCash = isNoCashCounterparty(currentCp);
                        const isCashDisabled = value === 'cash' && isNoCash;
                        const isSelected = order.payment_method === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            disabled={isCashDisabled}
                            onClick={() => {
                              if (isCashDisabled) return;
                              update(order.id, 'payment_method', value);
                            }}
                            className={cn(
                              'px-3 py-2.5 rounded-xl text-xs font-bold border transition-all text-center flex items-center justify-center gap-1.5',
                              isCashDisabled
                                ? 'opacity-35 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200 line-through select-none'
                                : isSelected
                                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs cursor-pointer'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer',
                            )}
                          >
                            <span
                              className={cn(
                                'w-2 h-2 rounded-full',
                                value === 'cash' &&
                                  (isCashDisabled ? 'bg-slate-300' : 'bg-amber-400'),
                                value === 'qr' && 'bg-purple-400',
                                value === 'card_driver' && 'bg-blue-400',
                                value === 'debt_cash' && 'bg-rose-400',
                                value === 'bank_invoice' && 'bg-slate-400',
                              )}
                            />
                            <span>
                              {label}
                              {isCashDisabled ? ' (Запрещено)' : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {(() => {
                      const currentCp =
                        counterparties.find((c) => c.id === order._selectedId) || order._inputValue;
                      if (isNoCashCounterparty(currentCp)) {
                        const cpName =
                          typeof currentCp === 'object' && currentCp?.name
                            ? currentCp.name
                            : order._inputValue;
                        return (
                          <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2">
                            <span className="text-base leading-none">🚫</span>
                            <span>
                              Для контрагента «{cpName}» оплата наличными запрещена (только
                              безналичный расчёт по счёту или дебиторка).
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add Order Button */}
          <button
            type="button"
            onClick={addOrder}
            className="w-full border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50/90 text-indigo-700 font-bold py-4 px-4 rounded-2xl flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] cursor-pointer shadow-2xs group"
          >
            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold group-hover:scale-110 transition-transform">
              +
            </div>
            <span className="text-sm">Добавить ещё одну заявку в этот рейс</span>
          </button>

          {/* ── EXPENSES / FUEL SECTION ── */}
          <div className="border-t border-slate-200/80 pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">⛽</span>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  ГСМ и Расходы рейса
                </h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  {visibleExpenses.length}
                </span>
              </div>
              <button
                type="button"
                onClick={addExpense}
                className="text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <span>+</span>
                <span>Добавить заправку (ГСМ)</span>
              </button>
            </div>

            {expenses.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 font-medium">
                Расходов и заправок в этом рейсе нет
              </div>
            ) : (
              <div className="space-y-3">
                {expenses.map((exp, expIdx) => {
                  if (exp._deleted) {
                    return (
                      <div
                        key={exp.id}
                        className="border border-dashed border-rose-300 bg-rose-50/50 rounded-2xl p-3.5 flex items-center justify-between text-xs"
                      >
                        <span className="text-rose-800 font-medium">
                          Расход {exp.amount || '0'} ₽ (
                          {exp.payment_method === 'fuel_card' ? 'Топливная карта' : 'Наличные'})
                          помечен на удаление
                        </span>
                        <button
                          type="button"
                          onClick={() => restoreExpense(exp.id)}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 px-2.5 py-1 rounded-lg"
                        >
                          Вернуть
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={exp.id}
                      className="border border-slate-200/90 rounded-2xl p-4 bg-white shadow-2xs space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <span>⛽</span> Заправка #{expIdx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeExpense(exp.id)}
                          className="text-xs text-slate-400 hover:text-rose-600 px-2 py-0.5 rounded cursor-pointer"
                          title="Удалить расход"
                        >
                          🗑️ Удалить
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Сумма, ₽
                          </label>
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="0"
                            className={inputCls}
                            value={exp.amount}
                            onChange={(e) => updateExpense(exp.id, 'amount', e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Способ оплаты
                          </label>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateExpense(exp.id, 'payment_method', 'fuel_card')}
                              className={cn(
                                'px-2 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1',
                                exp.payment_method === 'fuel_card'
                                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100',
                              )}
                            >
                              <span>⛽</span>
                              <span>Топл.карта</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => updateExpense(exp.id, 'payment_method', 'cash')}
                              className={cn(
                                'px-2 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1',
                                exp.payment_method === 'cash'
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100',
                              )}
                            >
                              <span>💵</span>
                              <span>Наличные</span>
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Примечание / АЗС
                          </label>
                          <input
                            type="text"
                            placeholder="АЗС, литры..."
                            className={inputCls}
                            value={exp.description}
                            onChange={(e) => updateExpense(exp.id, 'description', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mb-4 px-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5">
            <span className="text-rose-600 text-lg">⚠️</span>
            <p className="text-sm text-rose-800 font-medium">{error}</p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200/80 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold py-3.5 px-6 rounded-xl shadow-md disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Сохранение изменений...</span>
              </>
            ) : (
              <span>Сохранить изменения</span>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-6 py-3.5 text-sm text-slate-600 font-semibold border border-slate-200 bg-white rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
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
  mode: 'review' | 'history' | 'active';
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

  const cashRevenue = activeOrders
    .filter((o) => o.payment_method === 'cash')
    .reduce((s, o) => s + parseFloat(o.amount), 0);
  const cashExpenses = expenses
    .filter((e) => e.payment_method === 'cash')
    .reduce((s, e) => s + parseFloat(e.amount), 0);
  const cashToSurrender = Math.max(0, cashRevenue - cashExpenses);
  const hasCarryover =
    (trip.driver_note ?? '').includes('[ПЕРЕНОС НАЛИЧНЫХ') ||
    (trip.driver_note ?? '').includes('[CARRYOVER]');

  const loaderNames = [
    ...new Set(
      activeOrders.flatMap((o) => [
        o.loader && parseFloat(o.loader_pay) > 0 ? o.loader.name.split(' ')[0] : null,
        o.loader2 && parseFloat(o.loader2_pay ?? '0') > 0 ? o.loader2.name.split(' ')[0] : null,
      ]),
    ),
  ].filter(Boolean) as string[];
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

  const [prevExpanded, setPrevExpanded] = useState(expanded);
  if (!expanded && prevExpanded) {
    setPrevExpanded(expanded);
    setDeleteConfirm(false);
    if (deleteTimer.current) clearTimeout(deleteTimer.current);
  } else if (expanded !== prevExpanded) {
    setPrevExpanded(expanded);
  }

  return (
    <div
      className={cn(
        'bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-shadow duration-200 hover:shadow-md border-l-4',
        accentColor,
      )}
    >
      {/* Collapsed header — single compact row */}
      <div
        className="px-4 py-2.5 cursor-pointer hover:bg-slate-50/60 transition-colors select-none"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {/* Left: identity — flex-1 so it takes remaining space after fixed metrics */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="font-black text-slate-900 text-sm whitespace-nowrap">
              {trip.asset?.reg_number === 'БЕЗ АВТО' ? '👷 ПРР' : `🚚 ${trip.asset.short_name}`}
            </span>
            <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap">
              {trip.asset?.reg_number === 'БЕЗ АВТО' ? '(без авто)' : trip.asset.reg_number}
            </span>
            <span className="text-slate-300 text-xs">·</span>
            <span className="text-sm text-slate-700 font-semibold truncate max-w-[90px]">
              {trip.driver.name.split(' ')[0]}
            </span>
            {trip.loader && (
              <>
                <span className="text-slate-300 text-xs">+</span>
                <span className="text-sm text-blue-600 font-semibold truncate max-w-[80px]">
                  {trip.loader.name.split(' ')[0]}
                </span>
              </>
            )}
            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded text-[9px] font-bold shrink-0">
              #{trip.trip_number}
            </span>
            {/* Яркие бейджи способов оплаты в рейсе */}
            <div className="flex items-center gap-1 shrink-0">
              {activeOrders.some((o) => o.payment_method === 'qr') && (
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-600 text-white shadow-xs flex items-center gap-0.5">
                  ⚡ QR
                </span>
              )}
              {activeOrders.some((o) => o.payment_method === 'cash') && (
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-xs flex items-center gap-0.5">
                  💵 Нал: {cashToSurrender.toLocaleString('ru-RU')} ₽
                </span>
              )}
              {hasCarryover && (
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-xs flex items-center gap-0.5">
                  ⚠️ Перенос
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 font-medium shrink-0 hidden sm:block">
              {formatDate(trip.started_at)}
            </span>
          </div>

          {/* Center: metrics — shrink-0 with pixel-fixed widths → true vertical alignment */}
          <div className="shrink-0 flex items-center">
            <div className="w-[100px] text-center">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">
                Выручка
              </span>
              <span className="text-sm font-bold text-slate-700">
                <Money amount={revenue.toFixed(2)} />
              </span>
            </div>
            <span className="w-5 text-center text-slate-200 text-sm">−</span>
            <div className="w-[100px] text-center">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">
                Расходы
              </span>
              <span className="text-sm font-bold text-rose-500">
                <Money amount={totalCosts.toFixed(2)} />
              </span>
            </div>
            <span className="w-5 text-center text-slate-200 text-sm">=</span>
            <div className="w-[100px] text-center">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">
                Прибыль
              </span>
              <span
                className={cn(
                  'text-base font-black',
                  profit > 0 ? 'text-emerald-600' : profit < 0 ? 'text-rose-600' : 'text-slate-500',
                )}
              >
                {profit < 0 ? '−' : ''}
                <Money amount={Math.abs(profit).toFixed(2)} />
              </span>
            </div>
          </div>

          {/* Right: edit + chevron */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-300 hover:text-slate-600"
              title="Редактировать заказы"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
            </button>
            <span
              className={cn(
                'material-symbols-outlined text-slate-300 text-[20px] transition-transform duration-300',
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
                        <div className="font-bold text-slate-900">
                          {order.counterparty?.name ?? '—'}
                        </div>
                        {order.description && (
                          <div className="mt-1 text-xs font-semibold text-amber-950 bg-amber-50 border border-amber-300 rounded-lg p-2 max-w-sm shadow-2xs">
                            <div className="flex items-center gap-1 text-[10px] font-black text-amber-900 uppercase tracking-tight mb-0.5">
                              <span>💬</span>
                              <span>Замечание / комментарий водителя:</span>
                            </div>
                            <div className="text-slate-800 font-medium whitespace-pre-wrap text-xs">
                              {order.description}
                            </div>
                          </div>
                        )}
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
                        {parseFloat(order.loader_pay) > 0 ||
                        parseFloat(order.loader2_pay ?? '0') > 0 ||
                        (order.is_driver_loader &&
                          parseFloat(String(order.driver_loader_pay || '0')) > 0) ? (
                          <div className="space-y-0.5">
                            {order.loader && parseFloat(order.loader_pay) > 0 && (
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {order.loader.name.split(' ')[0]}
                                </span>
                                <Money amount={order.loader_pay} />
                              </div>
                            )}
                            {order.loader2 && parseFloat(order.loader2_pay ?? '0') > 0 && (
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {order.loader2.name.split(' ')[0]}
                                </span>
                                <Money amount={order.loader2_pay} />
                              </div>
                            )}
                            {order.is_driver_loader &&
                              parseFloat(String(order.driver_loader_pay || '0')) > 0 && (
                                <div className="flex items-center justify-end gap-1.5 text-amber-600">
                                  <span className="text-[10px] opacity-75 font-medium">
                                    вод.-груз.
                                  </span>
                                  <Money amount={String(order.driver_loader_pay)} />
                                </div>
                              )}
                            {calcOrderLoaderProfit(order, trip.started_at) > 0 && (
                              <div
                                className="text-[9px] font-bold text-emerald-600 text-right leading-none"
                                title="Прибыль компании с услуг погрузки (маржа 30%)"
                              >
                                +
                                {Math.round(
                                  calcOrderLoaderProfit(order, trip.started_at),
                                ).toLocaleString('ru-RU')}{' '}
                                ₽ маржа
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
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
          <div className="px-5 py-4 grid grid-cols-7 gap-3 border-t border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            {[
              {
                label: 'Выручка',
                value: <Money amount={revenue.toFixed(2)} />,
                cls: 'text-slate-800 text-base font-black',
              },
              {
                label: 'Сдать нал',
                value: cashToSurrender > 0 ? <Money amount={cashToSurrender.toFixed(2)} /> : '—',
                cls:
                  cashToSurrender > 0
                    ? 'text-emerald-700 text-base font-black'
                    : 'text-slate-300 text-base font-bold',
              },
              {
                label: `ЗП ${trip.driver.name.split(' ')[0]}`,
                value: (
                  <>
                    −<Money amount={driverPay.toFixed(2)} />
                  </>
                ),
                cls: 'text-emerald-700 text-base font-bold',
              },
              {
                label: loaderNames.length > 0 ? `ЗП ${loaderNames.join(', ')}` : 'ЗП груз.',
                value:
                  loaderPay > 0 ? (
                    <>
                      −<Money amount={loaderPay.toFixed(2)} />
                    </>
                  ) : (
                    '—'
                  ),
                cls:
                  loaderPay > 0
                    ? 'text-blue-600 text-base font-bold'
                    : 'text-slate-300 text-base font-bold',
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

          {/* Плашка сдачи наличных и статуса переноса */}
          {(cashToSurrender > 0 || hasCarryover) && (
            <div className="px-5 py-2.5 bg-emerald-50/80 border-t border-emerald-200 flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                <span>💵</span>
                <span>
                  Итого наличных к сдаче за рейс:{' '}
                  <strong>{cashToSurrender.toLocaleString('ru-RU')} ₽</strong> (Выручка налом:{' '}
                  {cashRevenue.toLocaleString('ru-RU')} ₽ − Расходы налом:{' '}
                  {cashExpenses.toLocaleString('ru-RU')} ₽)
                </span>
              </span>
              {hasCarryover && (
                <span className="font-black text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider">
                  ⚠️ Водитель зафиксировал перенос на следующий рейс
                </span>
              )}
            </div>
          )}

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

// ── Maintenance Detail Modal ─────────────────────────────────

function MaintenanceDetailModal({
  group,
  onClose,
}: {
  group: {
    assetName: string;
    regNumber: string;
    assetKey: string;
    maintenanceParts: number;
    maintenanceSalary: number;
    maintenanceTotal: number;
    serviceOrders: ReviewServiceOrder[];
  };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-600 text-2xl">car_repair</span>
              <h3 className="text-lg font-black text-slate-900">
                Заказ-наряды на ремонт: {group.assetKey}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap font-medium">
              <span>
                Всего расходов за период:{' '}
                <span className="font-black text-rose-600 text-sm">
                  −{group.maintenanceTotal.toLocaleString('ru-RU')} ₽
                </span>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                Запчасти и материалы:{' '}
                <strong className="text-slate-700">
                  {group.maintenanceParts.toLocaleString('ru-RU')} ₽
                </strong>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                Работы (свои + сторонние):{' '}
                <strong className="text-slate-700">
                  {(group.maintenanceTotal - group.maintenanceParts).toLocaleString('ru-RU')} ₽
                </strong>
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/garage"
              target="_blank"
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              Раздел Гараж
            </Link>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {group.serviceOrders.map((so) => {
            const cso = calcServiceOrder(so);
            const cleanDesc = (so.problem_description || so.admin_note || '')
              .replace(/\[Сторонний сервис[^\]]*\]\s*/gi, '')
              .trim();
            return (
              <div
                key={so.id}
                className={cn(
                  'bg-white rounded-2xl border p-5 shadow-xs space-y-4 transition-colors',
                  cso.isExternal
                    ? 'border-purple-200 hover:border-purple-400'
                    : 'border-slate-200 hover:border-rose-300',
                )}
              >
                {/* Order Header */}
                <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        'font-mono font-black text-white px-2.5 py-1 rounded-lg text-sm tracking-wide shadow-xs',
                        cso.isExternal ? 'bg-purple-600' : 'bg-rose-600',
                      )}
                    >
                      НЗ-{so.order_number}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-800">
                          {new Date(so.created_at).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                        {cso.isExternal && (
                          <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded flex items-center gap-1">
                            <span>🏢</span>
                            <span>
                              {cso.contractorName
                                ? `Сторонний сервис: ${cso.contractorName}`
                                : 'Сторонний сервис'}
                            </span>
                          </span>
                        )}
                        {cso.isEquipment && (
                          <span className="bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded flex items-center gap-1">
                            <span>⚙️</span>
                            <span>Доп. оборудование</span>
                          </span>
                        )}
                      </div>
                      {cleanDesc && (
                        <p className="text-xs text-slate-700 font-medium mt-1">{cleanDesc}</p>
                      )}
                      {!cso.isExternal && so.mechanic?.name && (
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          Слесарь:{' '}
                          <span className="text-slate-700 font-semibold">{so.mechanic.name}</span>
                          {so.second_mechanic?.name && (
                            <span className="ml-1 text-slate-500">
                              + 2-й слесарь: {so.second_mechanic.name}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Расход по наряду
                    </span>
                    <span className="font-black text-rose-600 text-base">
                      −{cso.totalCost.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                </div>

                {/* Works list */}
                {so.works && so.works.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-amber-500">
                          build
                        </span>
                        {cso.isExternal
                          ? 'Работы стороннего сервиса'
                          : 'Выполненные работы (ЗП слесаря)'}
                      </span>
                      <span className="text-xs font-bold text-amber-700">
                        Итого работы:{' '}
                        {cso.isExternal
                          ? cso.worksCost.toLocaleString('ru-RU')
                          : cso.salaryCost.toLocaleString('ru-RU')}{' '}
                        ₽
                      </span>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 divide-y divide-slate-100 text-xs">
                      {so.works.map((w) => {
                        const customPctMatch = w.notes
                          ? String(w.notes).match(/\[salary_pct:(\d+(?:\.\d+)?)\]/)
                          : null;
                        const pct =
                          customPctMatch && customPctMatch[1]
                            ? parseFloat(customPctMatch[1]) / 100
                            : 0.5;
                        const wage = cso.isExternal
                          ? Number(w.price_client) || 0
                          : w.status !== 'cancelled'
                            ? (Number(w.price_client) || 0) * pct
                            : 0;
                        return (
                          <div
                            key={w.id}
                            className="py-1.5 first:pt-0 last:pb-0 flex justify-between items-center text-slate-700"
                          >
                            <span className="font-medium">
                              🔧 {w.work_catalog?.name ?? w.custom_work_name ?? 'Работа'}
                            </span>
                            <div className="text-right font-bold text-amber-700">
                              {wage.toLocaleString('ru-RU')} ₽
                              {!cso.isExternal && w.price_client && (
                                <span className="text-[10px] text-slate-400 font-normal ml-1">
                                  (тариф {Number(w.price_client || 0).toLocaleString('ru-RU')} ₽)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Parts list */}
                {so.parts && so.parts.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-rose-500">
                          inventory_2
                        </span>
                        Установленные запчасти
                      </span>
                      <span className="text-xs font-bold text-rose-700">
                        Итого запчасти: {cso.partsCost.toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                    <div className="bg-rose-50/40 rounded-xl p-3 border border-rose-100 divide-y divide-rose-100/60 text-xs">
                      {so.parts.map((p) => {
                        const cost = (Number(p.unit_price) || 0) * (Number(p.quantity) || 1);
                        return (
                          <div
                            key={p.id}
                            className="py-1.5 first:pt-0 last:pb-0 flex justify-between items-center text-slate-700"
                          >
                            <span className="font-medium">
                              📦 {p.part?.name ?? p.custom_part_name ?? 'Деталь'}{' '}
                              <span className="text-slate-400">
                                ({p.quantity} {p.unit ?? 'шт'} ×{' '}
                                {Number(p.unit_price || 0).toLocaleString('ru-RU')} ₽)
                              </span>
                            </span>
                            <span className="font-bold text-rose-700">
                              {cost.toLocaleString('ru-RU')} ₽
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Всего {group.serviceOrders.length} заказ-наряд
            {group.serviceOrders.length === 1 ? '' : group.serviceOrders.length < 5 ? 'а' : 'ов'}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Garage Review Components ─────────────────────────────────

function GarageOrderEditModal({
  order,
  onClose,
  onSaved,
}: {
  order: ReviewServiceOrder;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isOwn = order.machine_type === 'own';
  const hourlyRate = isOwn ? 1600 : 2000;
  const salaryPct = Number(order.mechanic?.mechanic_salary_pct || 50);

  const defaultStartDate = order.started_at
    ? order.started_at.slice(0, 10)
    : order.created_at
      ? order.created_at.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  const defaultEndDate = order.completed_at ? order.completed_at.slice(0, 10) : defaultStartDate;

  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(defaultEndDate);

  const [odometer, setOdometer] = useState<string>(
    String(order.odometer_end || order.odometer_start || ''),
  );
  const [clientModel, setClientModel] = useState<string>(
    order.client_vehicle_model || order.client_vehicle_brand || '',
  );
  const [clientReg, setClientReg] = useState<string>(order.client_vehicle_reg || '');
  const [works, setWorks] = useState<Array<{ name: string; minutes: string; notes?: string }>>(
    () => {
      const active = (order.works ?? []).filter((w) => w.status !== 'cancelled');
      if (active.length === 0) return [{ name: order.problem_description || '', minutes: '60' }];
      return active.map((w) => ({
        name: w.custom_work_name || w.work_catalog?.name || w.work_description || '',
        minutes: String(w.actual_minutes || w.norm_minutes || 30),
        notes: w.notes || undefined,
      }));
    },
  );
  const [parts, setParts] = useState<
    Array<{
      name: string;
      quantity: string;
      unit: string;
      unit_price: string;
      client_price: string;
    }>
  >(() =>
    (order.parts ?? []).map((p) => {
      const uPrice = parseFloat(p.unit_price || '0') || 0;
      const cPrice =
        p.client_price !== undefined &&
        p.client_price !== null &&
        String(p.client_price).trim() !== ''
          ? parseFloat(String(p.client_price)) || 0
          : uPrice;
      return {
        name: p.custom_part_name || p.part?.name || '',
        quantity: String(p.quantity || 1),
        unit: p.unit || p.part?.unit || 'шт',
        unit_price: uPrice > 0 ? String(uPrice) : '',
        client_price: cPrice > 0 ? String(cPrice) : '',
      };
    }),
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

  const totalPartsCost = parts.reduce((s, p) => {
    const qty = parseFloat(p.quantity) || 1;
    const cost = parseFloat(p.unit_price) || 0;
    return s + cost * qty;
  }, 0);

  const totalPartsClient = parts.reduce((s, p) => {
    const qty = parseFloat(p.quantity) || 1;
    const price = parseFloat(p.client_price) || parseFloat(p.unit_price) || 0;
    return s + price * qty;
  }, 0);

  const totalPartsMargin = Math.max(0, totalPartsClient - totalPartsCost);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/garage/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit_order',
          started_at: startDate,
          completed_at: endDate,
          odometer_start: odometer ? Number(odometer) : null,
          odometer_end: odometer ? Number(odometer) : null,
          client_vehicle_model: !isOwn ? clientModel : undefined,
          client_vehicle_reg: !isOwn ? clientReg : undefined,
          works: works.map((w) => ({
            name: w.name,
            minutes: parseInt(w.minutes, 10) || 0,
            notes: w.notes,
          })),
          parts: parts.map((p) => {
            const uPrice = parseFloat(p.unit_price) || 0;
            const cPrice =
              p.client_price !== '' && !isNaN(parseFloat(p.client_price))
                ? parseFloat(p.client_price)
                : uPrice;
            return {
              name: p.name,
              quantity: parseFloat(p.quantity) || 1,
              unit: p.unit || 'шт',
              unit_price: uPrice,
              client_price: cPrice,
            };
          }),
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-black text-slate-900 text-lg">
              Редактировать заказ-наряд №{order.order_number}
            </h3>
            <p className="text-xs text-slate-500 font-bold">
              {isOwn ? '🏢 Свой автопарк (1 600 ₽/ч)' : '🚗 Клиентский авто (2 000 ₽/ч)'} · Механик:{' '}
              {order.mechanic?.name ?? '—'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>

        {!isOwn && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase text-slate-400 block mb-1">
                Модель авто
              </label>
              <input
                type="text"
                value={clientModel}
                onChange={(e) => setClientModel(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-slate-400 block mb-1">
                Госномер
              </label>
              <input
                type="text"
                value={clientReg}
                onChange={(e) => setClientReg(e.target.value.toUpperCase())}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold uppercase"
              />
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-bold uppercase text-slate-400 block mb-1">
            Пробег (одометр, км)
          </label>
          <input
            type="number"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
            placeholder="Пробег в км"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div>
            <label className="text-xs font-bold uppercase text-slate-500 block mb-1">
              Дата начала
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (endDate < e.target.value) setEndDate(e.target.value);
              }}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-800"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-slate-500 block mb-1">
              Дата окончания
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-800"
            />
          </div>
        </div>

        {/* Работы */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">
              Перечень работ ({works.length})
            </span>
            <button
              type="button"
              onClick={() => setWorks((prev) => [...prev, { name: '', minutes: '30' }])}
              className="text-xs font-black text-emerald-600 hover:text-emerald-700 cursor-pointer"
            >
              + Добавить работу
            </button>
          </div>
          {works.map((w, idx) => (
            <div
              key={idx}
              className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-2.5"
            >
              <span className="text-xs font-black text-slate-400">{idx + 1}.</span>
              <input
                type="text"
                value={w.name}
                onChange={(e) =>
                  setWorks((prev) =>
                    prev.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item)),
                  )
                }
                placeholder="Наименование работы"
                className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold"
              />
              <div className="flex items-center gap-1.5">
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
                  className="w-20 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-black text-center"
                />
                <span className="text-xs text-slate-500 font-bold">мин</span>
              </div>
              {works.length > 1 && (
                <button
                  type="button"
                  onClick={() => setWorks((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-rose-500 hover:text-rose-700 text-sm font-black px-1.5 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Запчасти с двумя графами (закупка + продажа клиенту с кнопкой +30%) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">
              Запчасти автосервиса ({parts.length})
            </span>
            <button
              type="button"
              onClick={() =>
                setParts((prev) => [
                  ...prev,
                  { name: '', quantity: '1', unit: 'шт', unit_price: '', client_price: '' },
                ])
              }
              className="text-xs font-black text-emerald-600 hover:text-emerald-700 cursor-pointer"
            >
              + Добавить запчасть
            </button>
          </div>

          {parts.map((p, idx) => {
            const uPrice = parseFloat(p.unit_price) || 0;
            const cPrice = parseFloat(p.client_price) || 0;
            const qty = parseFloat(p.quantity) || 1;
            const margin = Math.max(0, (cPrice - uPrice) * qty);

            return (
              <div
                key={idx}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-400">{idx + 1}.</span>
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) =>
                      setParts((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, name: e.target.value } : item,
                        ),
                      )
                    }
                    placeholder="Название запчасти (колодки, фильтр...)"
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      value={p.quantity}
                      onChange={(e) =>
                        setParts((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, quantity: e.target.value } : item,
                          ),
                        )
                      }
                      className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold text-center"
                    />
                    <input
                      type="text"
                      value={p.unit}
                      onChange={(e) =>
                        setParts((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, unit: e.target.value } : item,
                          ),
                        )
                      }
                      className="w-12 bg-white border border-slate-200 rounded-lg px-1.5 py-1.5 text-xs font-bold text-center"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setParts((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-rose-500 hover:text-rose-700 text-sm font-black px-1.5 cursor-pointer"
                    title="Удалить позицию"
                  >
                    ✕
                  </button>
                </div>

                {/* 2 графы: Закупка и Продажа клиенту */}
                <div className="flex items-center gap-2 flex-wrap text-xs pt-1 border-t border-slate-200/70">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-500 whitespace-nowrap">Купили за:</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={p.unit_price}
                      onChange={(e) => {
                        const val = e.target.value;
                        setParts((prev) =>
                          prev.map((item, i) => {
                            if (i !== idx) return item;
                            const num = parseFloat(val) || 0;
                            // Если клиентская цена была пустая или равна старой накрутке, обновим с +30%
                            return {
                              ...item,
                              unit_price: val,
                              client_price:
                                item.client_price || (num > 0 ? String(Math.round(num * 1.3)) : ''),
                            };
                          }),
                        );
                      }}
                      className="w-24 bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold text-right"
                    />
                    <span className="text-slate-400">₽</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const cost = parseFloat(p.unit_price) || 0;
                      if (cost > 0) {
                        const standardPrice = Math.round(cost * 1.3);
                        setParts((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, client_price: String(standardPrice) } : item,
                          ),
                        );
                      }
                    }}
                    title="Стандартная накрутка СТО +30%"
                    className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg font-black text-[11px] cursor-pointer transition-colors shadow-2xs"
                  >
                    +30%
                  </button>

                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-700 whitespace-nowrap">Клиенту:</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={p.client_price}
                      onChange={(e) =>
                        setParts((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, client_price: e.target.value } : item,
                          ),
                        )
                      }
                      className="w-24 bg-white border border-emerald-300 rounded-lg px-2 py-1 text-sm font-bold text-right text-emerald-900"
                    />
                    <span className="text-slate-400">₽</span>
                  </div>

                  {cPrice > uPrice && uPrice > 0 && (
                    <div className="ml-auto text-[11px] font-black text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                      Заработок СТО: +{Math.round(margin).toLocaleString('ru-RU')} ₽ (
                      {Math.round(((cPrice - uPrice) / uPrice) * 100)}%)
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {parts.length > 0 && (
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 bg-emerald-50/50 border border-emerald-200/80 rounded-xl px-3.5 py-2">
              <span>
                Закупка:{' '}
                <span className="text-slate-900 font-black">
                  {Math.round(totalPartsCost).toLocaleString('ru-RU')} ₽
                </span>
              </span>
              <span>
                Клиенту:{' '}
                <span className="text-slate-900 font-black">
                  {Math.round(totalPartsClient).toLocaleString('ru-RU')} ₽
                </span>
              </span>
              <span className="text-emerald-700 font-black">
                Заработок на з/ч: +{Math.round(totalPartsMargin).toLocaleString('ru-RU')} ₽
              </span>
            </div>
          )}
        </div>

        {/* ЗП Механика */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-emerald-900">
              ЗП Механика (авторасчёт за {totalMinutes} мин: {autoPay} ₽)
            </span>
            <button
              type="button"
              onClick={() => setManualPay(autoPay)}
              className="text-xs font-black text-emerald-700 underline cursor-pointer"
            >
              Сбросить на авторасчёт
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
          <label className="text-xs font-bold uppercase text-slate-400 block mb-1">
            Комментарий руководителя
          </label>
          <input
            type="text"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder="Заметка к заказ-наряду..."
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium"
          />
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 font-bold text-sm text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-wider disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatOrderDateRange(
  startedAt?: string | null,
  completedAt?: string | null,
  createdAt?: string,
) {
  const parse = (s?: string | null) => (s ? new Date(s.slice(0, 10) + 'T12:00:00') : null);
  const s = parse(startedAt);
  const c = parse(completedAt);
  const cr = parse(createdAt);
  const d1 = s || cr;
  const d2 = c || d1;
  if (!d1) return '—';
  const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  if (!d2 || d1.getTime() === d2.getTime()) return fmt(d1);
  return `${fmt(d1)} — ${fmt(d2)}`;
}

export function calcGarageOrder(order: ReviewServiceOrder) {
  const isOwn = order.machine_type === 'own';
  const hourlyRate = isOwn ? 1600 : 2000;
  const salaryPct = Number(order.mechanic?.mechanic_salary_pct || 50);
  const activeWorks = (order.works ?? []).filter((w) => w.status !== 'cancelled');
  const parts = order.parts ?? [];

  const totalMinutes = activeWorks.reduce(
    (s, w) =>
      s + Number(w.actual_minutes || w.norm_minutes || 0) * Math.max(1, Number(w.quantity || 1)),
    0,
  );

  const worksSum = activeWorks.reduce((s, w) => {
    const mins =
      Number(w.actual_minutes || w.norm_minutes || 0) * Math.max(1, Number(w.quantity || 1));
    const explicit = parseFloat(w.price_client || '0');
    return s + (explicit > 0 ? explicit : (mins / 60) * hourlyRate);
  }, 0);

  const estimatedPay = activeWorks.reduce((s, w) => {
    const mins =
      Number(w.actual_minutes || w.norm_minutes || 0) * Math.max(1, Number(w.quantity || 1));
    const explicit = parseFloat(w.price_client || '0');
    const wPrice = explicit > 0 ? explicit : (mins / 60) * hourlyRate;
    const customPctMatch = w.notes ? String(w.notes).match(/\[salary_pct:(\d+(?:\.\d+)?)\]/) : null;
    const wPct = customPctMatch && customPctMatch[1] ? parseFloat(customPctMatch[1]) : salaryPct;
    return s + (wPrice * wPct) / 100;
  }, 0);
  const mechanicPay =
    parseFloat(order.mechanic_pay || '0') > 0 ? parseFloat(order.mechanic_pay!) : estimatedPay;

  let partsUnitSum = 0;
  let partsClientSum = 0;

  for (const p of parts) {
    const qty = p.quantity || 1;
    const uPrice = parseFloat(p.unit_price || '0') || 0;
    const cPrice =
      p.client_price !== undefined &&
      p.client_price !== null &&
      String(p.client_price).trim() !== ''
        ? parseFloat(String(p.client_price)) || 0
        : uPrice;
    partsUnitSum += uPrice * qty;
    partsClientSum += cPrice * qty;
  }

  const partsMargin = isOwn ? 0 : Math.max(0, partsClientSum - partsUnitSum);
  const totalRevenue = worksSum + partsClientSum;
  // Для своего парка реальной чистой прибыли нет — это внутренние расходы компании-перевозчика.
  // Чистая прибыль считается ТОЛЬКО с клиентских авто.
  // А цифра, которую гараж берёт с компании-перевозчика (счёт перевозчику): totalRevenue (работы + запчасти)
  const billedToCarrier = isOwn ? totalRevenue : 0;
  const netProfit = isOwn ? 0 : totalRevenue - mechanicPay - partsUnitSum;

  return {
    isOwn,
    hourlyRate,
    salaryPct,
    activeWorks,
    parts,
    totalMinutes,
    worksSum,
    mechanicPay,
    partsUnitSum,
    partsClientSum,
    partsMargin,
    totalRevenue,
    billedToCarrier,
    netProfit,
  };
}

function GarageOrderRow({
  order,
  expanded,
  onToggle,
  onEdit,
  onApprove,
  onReturn,
  onDelete,
  approving,
  deleting,
}: {
  order: ReviewServiceOrder;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onApprove: () => void;
  onReturn: () => void;
  onDelete: () => void;
  approving: boolean;
  deleting: boolean;
}) {
  const {
    isOwn,
    hourlyRate,
    salaryPct,
    activeWorks,
    parts,
    totalMinutes,
    worksSum,
    mechanicPay,
    partsUnitSum,
    partsClientSum,
    partsMargin,
    totalRevenue,
    billedToCarrier,
    netProfit,
  } = calcGarageOrder(order);

  const odo = order.odometer_end || order.odometer_start;
  const canReview = order.lifecycle_status === 'draft' || order.lifecycle_status === 'returned';

  const vehicleTitle = isOwn
    ? `${order.asset?.short_name ?? 'Свой ТС'} (${order.asset?.reg_number ?? '—'})`
    : `${order.client_vehicle_model || order.client_vehicle_brand || 'Клиентский авто'} · ${order.client_vehicle_reg || 'без номера'}`;

  const cleanMechanicNote = (order.mechanic_note || '')
    .replace('[Запчасти предоставил автосервис]', '')
    .trim();

  const accentColor = isOwn
    ? 'border-l-sky-500'
    : netProfit > 0
      ? 'border-l-emerald-500'
      : netProfit < 0
        ? 'border-l-rose-500'
        : 'border-l-slate-300';

  return (
    <div
      className={cn(
        'bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all duration-200 hover:shadow-md border-l-4',
        accentColor,
      )}
    >
      {/* ── Свернутая строка (компактный вид в одну строчку как TripRow) ── */}
      <div
        className="px-4 py-2.5 cursor-pointer hover:bg-slate-50/70 transition-colors select-none"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {/* Слева: Номер, тип, авто, механик, статус */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="font-mono text-xs font-black text-sky-900 shrink-0 bg-sky-50 border border-sky-200/70 px-2 py-0.5 rounded">
              НЗ-{order.order_number}
            </span>
            <span
              className={cn(
                'text-[10px] font-black px-1.5 py-0.5 rounded shrink-0',
                isOwn
                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200',
              )}
            >
              {isOwn ? '🏢 Свой' : '🚗 Клиент'}
            </span>
            <span
              className="font-bold text-slate-900 text-sm truncate max-w-[190px]"
              title={vehicleTitle}
            >
              {vehicleTitle}
            </span>
            <span className="text-slate-300 text-xs">·</span>
            <span className="text-xs text-slate-600 font-semibold truncate max-w-[120px]">
              👨‍🔧 {order.mechanic?.name?.split(' ')[0] ?? '—'}
            </span>
            <span
              className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0',
                order.lifecycle_status === 'approved'
                  ? 'bg-emerald-100 text-emerald-800'
                  : order.lifecycle_status === 'returned'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800',
              )}
            >
              {order.lifecycle_status === 'approved'
                ? '✓ Закрыт'
                : order.lifecycle_status === 'returned'
                  ? '↩ Доработка'
                  : '⏳ Ревью'}
            </span>
            <span className="text-[10px] text-slate-400 font-medium shrink-0 hidden md:block">
              {formatOrderDateRange(order.started_at, order.completed_at, order.created_at)}
            </span>
          </div>

          {/* По центру: финансовые метрики (фиксированная ширина для ровного выравнивания колонок) */}
          <div className="shrink-0 flex items-center">
            <div className="w-[90px] text-center">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">
                {isOwn ? 'Работы' : 'Выручка'}
              </span>
              <span className="text-sm font-bold text-slate-700">
                <Money amount={(isOwn ? worksSum : totalRevenue).toFixed(2)} />
              </span>
            </div>
            <span className="w-4 text-center text-slate-200 text-sm">−</span>
            <div className="w-[95px] text-center">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">
                ЗП Механика
              </span>
              <span className="text-sm font-bold text-amber-600">
                <Money amount={mechanicPay.toFixed(2)} />
              </span>
            </div>
            <span className="w-4 text-center text-slate-200 text-sm">+</span>
            <div className="w-[90px] text-center">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">
                {isOwn ? 'Запчасти' : 'Маржа з/ч'}
              </span>
              <span
                className={cn('text-sm font-bold', isOwn ? 'text-slate-700' : 'text-emerald-600')}
              >
                {isOwn ? (
                  <Money amount={partsUnitSum.toFixed(2)} />
                ) : (
                  <Money amount={partsMargin.toFixed(2)} />
                )}
              </span>
            </div>
            <span className="w-4 text-center text-slate-200 text-sm">=</span>
            <div className="w-[105px] text-center">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">
                {isOwn ? 'Счёт перевозчику' : 'Прибыль СТО'}
              </span>
              {isOwn ? (
                <span
                  className="text-sm font-black text-sky-900 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md inline-block"
                  title={`Сумма, которую Гараж берёт с компании-перевозчика (работы + запчасти): ${Math.round(billedToCarrier).toLocaleString('ru-RU')} ₽\nРеальной чистой прибыли нет — это внутреннее обслуживание автопарка`}
                >
                  <Money amount={billedToCarrier.toFixed(2)} />
                </span>
              ) : (
                <span
                  className={cn(
                    'text-base font-black',
                    netProfit > 0
                      ? 'text-emerald-600'
                      : netProfit < 0
                        ? 'text-rose-600'
                        : 'text-slate-500',
                  )}
                  title={`Реальная чистая прибыль гаража с клиента: ${Math.round(netProfit).toLocaleString('ru-RU')} ₽`}
                >
                  {netProfit < 0 ? '−' : ''}
                  <Money amount={Math.abs(netProfit).toFixed(2)} />
                </span>
              )}
            </div>
          </div>

          {/* Справа: кнопка редактирования и шеврон раскрытия */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-700 cursor-pointer"
              title="Редактировать наряд"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
            </button>
            <span
              className={cn(
                'material-symbols-outlined text-slate-300 text-[20px] transition-transform duration-300',
                expanded ? 'rotate-180' : '',
              )}
            >
              expand_more
            </span>
          </div>
        </div>
      </div>

      {/* ── Развернутый контент (детали наряда) ── */}
      {expanded && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200 border-t border-slate-100 p-4 sm:p-5 space-y-4 bg-slate-50/40">
          {/* Верхняя плашка с датами, одометром и тарифом */}
          <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-3 rounded-xl border border-slate-200/80 text-xs text-slate-700">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <span className="text-slate-400 font-bold block uppercase text-[10px]">
                  Период выполнения
                </span>
                <span className="font-bold text-slate-800">
                  📅 {formatOrderDateRange(order.started_at, order.completed_at, order.created_at)}
                </span>
              </div>
              {odo && (
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">
                    Пробег / Одометр
                  </span>
                  <span className="font-bold text-slate-800">
                    🛣 {Number(odo).toLocaleString('ru-RU')} км
                  </span>
                </div>
              )}
              <div>
                <span className="text-slate-400 font-bold block uppercase text-[10px]">
                  Тариф нормо-часа
                </span>
                <span className="font-bold text-slate-800">
                  {hourlyRate.toLocaleString('ru-RU')} ₽/ч ({isOwn ? 'Свой парк' : 'Клиент'})
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block uppercase text-[10px]">
                  Ставка механика
                </span>
                <span className="font-bold text-emerald-700">{salaryPct}% от работ</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Время работ
                </span>
                <span className="font-black text-slate-800 text-sm">
                  {totalMinutes} мин ({(totalMinutes / 60).toFixed(1)} ч)
                </span>
              </div>
              <div className="text-right bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                <span className="text-[10px] font-black uppercase text-emerald-800 block">
                  ЗП Механика
                </span>
                <span className="font-black text-emerald-700 text-sm">
                  <Money amount={mechanicPay.toFixed(2)} />
                </span>
              </div>
            </div>
          </div>

          {/* 1. Перечень выполненных работ */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-500">
              <span>Перечень выполненных работ ({activeWorks.length})</span>
              <span>
                Итого по работам:{' '}
                <span className="text-slate-900 font-black">
                  <Money amount={worksSum.toFixed(2)} />
                </span>
              </span>
            </div>
            {activeWorks.length === 0 ? (
              <p className="text-sm text-slate-500 italic bg-white p-3 rounded-xl border border-slate-200">
                {order.problem_description || 'Работы не указаны'}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {activeWorks.map((w, idx) => {
                  const mins =
                    Number(w.actual_minutes || w.norm_minutes || 0) *
                    Math.max(1, Number(w.quantity || 1));
                  const wPrice =
                    parseFloat(w.price_client || '0') > 0
                      ? parseFloat(w.price_client!)
                      : (mins / 60) * hourlyRate;
                  const customPctMatch = w.notes
                    ? String(w.notes).match(/\[salary_pct:(\d+(?:\.\d+)?)\]/)
                    : null;
                  const wPct =
                    customPctMatch && customPctMatch[1] ? parseFloat(customPctMatch[1]) : salaryPct;
                  const wPay = (wPrice * wPct) / 100;
                  return (
                    <div
                      key={w.id || idx}
                      className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {idx + 1}.{' '}
                          {w.custom_work_name ||
                            w.work_catalog?.name ||
                            w.work_description ||
                            'Работа'}
                        </p>
                        <p className="text-xs font-extrabold text-emerald-700 mt-0.5">
                          ⏱ {mins} мин · ЗП: {Math.round(wPay).toLocaleString('ru-RU')} ₽
                          {customPctMatch && (
                            <span className="text-[10px] text-emerald-600 font-bold ml-1.5 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                              {wPct}%
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="text-xs font-black text-slate-800 whitespace-nowrap bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                        {Math.round(wPrice).toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Запчасти автосервиса (с двумя графами: закупка и клиенту +30%) */}
          {parts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="text-emerald-600">☑</span>
                  <span>Запчасти сервиса ({parts.length})</span>
                </span>
                <span
                  className={isOwn ? 'text-slate-600 font-bold' : 'text-emerald-700 font-black'}
                >
                  {isOwn
                    ? `Запчасти автопарка: ${Math.round(partsUnitSum).toLocaleString('ru-RU')} ₽`
                    : `Заработок на запчастях: +${Math.round(partsMargin).toLocaleString('ru-RU')} ₽`}
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-3.5 py-2">Запчасть</th>
                      <th className="px-3 py-2 text-center">Кол-во</th>
                      <th className="px-3 py-2 text-right">Закупка</th>
                      <th className="px-3 py-2 text-right">Клиенту (+30%)</th>
                      <th className="px-3.5 py-2 text-right">
                        {isOwn ? 'Себестоимость' : 'Заработок СТО'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parts.map((p, idx) => {
                      const qty = p.quantity || 1;
                      const uPrice = parseFloat(p.unit_price || '0') || 0;
                      const cPrice =
                        p.client_price !== undefined &&
                        p.client_price !== null &&
                        String(p.client_price).trim() !== ''
                          ? parseFloat(String(p.client_price)) || 0
                          : uPrice;
                      const margin = Math.max(0, (cPrice - uPrice) * qty);
                      const markupPct =
                        uPrice > 0 ? Math.round(((cPrice - uPrice) / uPrice) * 100) : 0;

                      return (
                        <tr key={p.id || idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-3.5 py-2.5 font-bold text-slate-900">
                            {idx + 1}. {p.custom_part_name || p.part?.name || 'Запчасть'}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-slate-600">
                            {qty} {p.unit || p.part?.unit || 'шт'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium text-slate-500">
                            {uPrice > 0 ? `${(uPrice * qty).toLocaleString('ru-RU')} ₽` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-slate-800">
                            <span>{(cPrice * qty).toLocaleString('ru-RU')} ₽</span>
                            {markupPct > 0 && !isOwn && (
                              <span className="ml-1.5 text-[9px] font-black bg-amber-100 text-amber-800 px-1 py-0.5 rounded">
                                +{markupPct}%
                              </span>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-black text-emerald-700">
                            {isOwn
                              ? '—'
                              : margin > 0
                                ? `+${Math.round(margin).toLocaleString('ru-RU')} ₽`
                                : '0 ₽'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50/70 border-t border-slate-200 font-bold text-slate-700">
                    <tr>
                      <td colSpan={2} className="px-3.5 py-2 text-[11px] font-black uppercase">
                        Итого запчасти
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {Math.round(partsUnitSum).toLocaleString('ru-RU')} ₽
                      </td>
                      <td className="px-3 py-2 text-right font-black text-slate-900">
                        {Math.round(partsClientSum).toLocaleString('ru-RU')} ₽
                      </td>
                      <td className="px-3.5 py-2 text-right font-black text-emerald-700">
                        {isOwn ? '—' : `+${Math.round(partsMargin).toLocaleString('ru-RU')} ₽`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Заметки */}
          {(cleanMechanicNote || order.admin_note) && (
            <div className="flex flex-wrap gap-2.5 text-xs">
              {cleanMechanicNote && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 rounded-xl font-medium">
                  💬 Комментарий механика: <span className="font-bold">{cleanMechanicNote}</span>
                </div>
              )}
              {order.admin_note && (
                <div className="bg-slate-100 border border-slate-200 text-slate-800 px-3 py-2 rounded-xl font-medium">
                  📌 Заметка руководителя: <span className="font-bold">{order.admin_note}</span>
                </div>
              )}
            </div>
          )}

          {/* Кнопки действий */}
          <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onEdit}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              >
                <span>✏️ Редактировать</span>
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={approving || deleting}
                className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-600 cursor-pointer disabled:opacity-50 transition-colors"
              >
                {deleting ? '...' : '🗑️ Удалить'}
              </button>
            </div>

            {canReview && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onReturn}
                  disabled={approving}
                  className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-700 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  ↩ На доработку
                </button>
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={approving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider shadow-sm cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {approving ? 'Утверждаем...' : '✓ Утвердить наряд (начислить ЗП)'}
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
  const [selectedMaintenanceGroup, setSelectedMaintenanceGroup] = useState<{
    assetName: string;
    regNumber: string;
    assetKey: string;
    maintenanceParts: number;
    maintenanceSalary: number;
    maintenanceTotal: number;
    serviceOrders: ReviewServiceOrder[];
  } | null>(null);

  const searchParams = useSearchParams();
  const modeFromUrl = searchParams.get('mode') as 'review' | 'active' | 'history' | null;
  const tripFromUrl =
    searchParams.get('trip') ||
    searchParams.get('trip_id') ||
    searchParams.get('trip_number') ||
    searchParams.get('id');

  const VALID_MODES: Array<'review' | 'active' | 'history'> = ['review', 'active', 'history'];
  const [mode, setMode] = useState<'review' | 'active' | 'history'>(
    modeFromUrl && VALID_MODES.includes(modeFromUrl)
      ? modeFromUrl
      : tripFromUrl
        ? 'history'
        : 'review',
  );
  const [reviewSection, setReviewSection] = useState<'auto' | 'garage'>(
    searchParams.get('section') === 'garage' ? 'garage' : 'auto',
  );
  const [garageMachineFilter, setGarageMachineFilter] = useState<'all' | 'client' | 'own'>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedGarageOrderIds, setExpandedGarageOrderIds] = useState<Set<string>>(new Set());

  const toggleGroup = (assetKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(assetKey)) next.delete(assetKey);
      else next.add(assetKey);
      return next;
    });
  };

  const toggleGarageOrder = (orderId: string) => {
    setExpandedGarageOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const [editTrip, setEditTrip] = useState<TripForReview | null>(null);
  const [editServiceOrder, setEditServiceOrder] = useState<ReviewServiceOrder | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statsPeriod, setStatsPeriod] = useState<'day' | 'week' | 'month'>('month');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tripFromUrl) return;
    let isMounted = true;
    fetch(`/api/trips/${tripFromUrl}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: TripForReview | null) => {
        if (!isMounted || !data) return;
        setEditTrip(data);
        if (data.started_at) {
          setSelectedDate(data.started_at.slice(0, 10));
        }
        if (data.lifecycle_status === 'draft') {
          setMode('review');
        } else {
          setMode('history');
        }
        setExpandedIds((prev) => new Set([...prev, data.id]));
      })
      .catch((e) => console.error('Error fetching trip from URL:', e));

    return () => {
      isMounted = false;
    };
  }, [tripFromUrl]);

  const { data: trips = [], isLoading } = useQuery<TripForReview[]>({
    queryKey: ['trips-review', selectedDate, mode],
    staleTime: 60000,
    queryFn: async () => {
      if (mode === 'active') {
        const res = await fetch('/api/trips?status=in_progress&lifecycle=draft');
        if (!res.ok) throw new Error('Ошибка загрузки');
        return res.json();
      }
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

  const monthKey = selectedDate.slice(0, 7); // YYYY-MM
  const { data: monthTrips = [] } = useQuery<TripForReview[]>({
    queryKey: ['trips-month', monthKey],
    enabled: mode === 'history' && statsPeriod === 'month',
    staleTime: 120000,
    queryFn: async () => {
      const res = await fetch(`/api/trips?lifecycle=approved&month=${monthKey}`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
  });

  const { weekStart, weekEnd } = getWeekDates(selectedDate);
  const { data: weekTrips = [] } = useQuery<TripForReview[]>({
    queryKey: ['trips-week', weekStart, weekEnd],
    enabled: mode === 'history' && statsPeriod === 'week',
    staleTime: 120000,
    queryFn: async () => {
      const res = await fetch(
        `/api/trips?lifecycle=approved&weekStart=${weekStart}&weekEnd=${weekEnd}`,
      );
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
  });

  // ── Maintenance / Service Orders Query (History only) ───────
  const { data: dayServiceOrders = [] } = useQuery<ReviewServiceOrder[]>({
    queryKey: ['service-orders-day', selectedDate],
    enabled: mode === 'history' && statsPeriod === 'day',
    staleTime: 60000,
    queryFn: async () => {
      const res = await fetch(
        `/api/garage/orders?filter=history&machine_type=own&date=${selectedDate}`,
      );
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: monthServiceOrders = [] } = useQuery<ReviewServiceOrder[]>({
    queryKey: ['service-orders-month', monthKey],
    enabled: mode === 'history' && statsPeriod === 'month',
    staleTime: 120000,
    queryFn: async () => {
      const res = await fetch(
        `/api/garage/orders?filter=history&machine_type=own&month=${monthKey}`,
      );
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: weekServiceOrders = [] } = useQuery<ReviewServiceOrder[]>({
    queryKey: ['service-orders-week', weekStart, weekEnd],
    enabled: mode === 'history' && statsPeriod === 'week',
    staleTime: 120000,
    queryFn: async () => {
      const res = await fetch(
        `/api/garage/orders?filter=history&machine_type=own&weekStart=${weekStart}&weekEnd=${weekEnd}`,
      );
      if (!res.ok) return [];
      return res.json();
    },
  });

  // ── Receivables Settlements Query (погашения долгов контрагентов в периоде) ──
  const { data: periodSettlementsData } = useQuery<{
    settlements: SettlementTransactionItem[];
    totalAmount: number;
  }>({
    queryKey: [
      'receivable-settlements',
      statsPeriod,
      statsPeriod === 'day'
        ? selectedDate
        : statsPeriod === 'week'
          ? `${weekStart}_${weekEnd}`
          : monthKey,
    ],
    enabled: mode === 'history',
    staleTime: 60000,
    queryFn: async () => {
      let url = '/api/receivables/settlements';
      if (statsPeriod === 'day') url += `?date=${selectedDate}`;
      else if (statsPeriod === 'week') url += `?weekStart=${weekStart}&weekEnd=${weekEnd}`;
      else url += `?month=${monthKey}`;
      const res = await fetch(url);
      if (!res.ok) return { settlements: [], totalAmount: 0 };
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

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['trips-review'] });
    queryClient.invalidateQueries({ queryKey: ['service-orders-month'] });
    queryClient.invalidateQueries({ queryKey: ['receivable-settlements'] });
    queryClient.invalidateQueries({ queryKey: ['garage-review-orders'] });
  };

  // ── Заказ-наряды Гаража (Механики) для вкладки «Гараж» ─────────
  const { data: garageOrders = [], isLoading: isGarageLoading } = useQuery<ReviewServiceOrder[]>({
    queryKey: [
      'garage-review-orders',
      mode,
      statsPeriod,
      statsPeriod === 'day'
        ? selectedDate
        : statsPeriod === 'week'
          ? `${weekStart}_${weekEnd}`
          : monthKey,
    ],
    staleTime: 30000,
    queryFn: async () => {
      if (mode === 'review') {
        const res = await fetch('/api/garage/orders?filter=review');
        if (!res.ok) return [];
        return res.json();
      }
      if (mode === 'active') {
        const res = await fetch('/api/garage/orders?filter=active');
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data)
          ? data.filter((o: ReviewServiceOrder) => o.status !== 'completed')
          : [];
      }
      let url = '/api/garage/orders?filter=history';
      if (statsPeriod === 'day') url += `&date=${selectedDate}`;
      else if (statsPeriod === 'week') url += `&weekStart=${weekStart}&weekEnd=${weekEnd}`;
      else url += `&month=${monthKey}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const filteredGarageOrders = useMemo(() => {
    if (garageMachineFilter === 'all') return garageOrders;
    return garageOrders.filter((o) => o.machine_type === garageMachineFilter);
  }, [garageOrders, garageMachineFilter]);

  const garageSummary = useMemo(() => {
    let clientRevenue = 0;
    let clientMechanicPay = 0;
    let clientPartsCost = 0;
    let clientPartsClient = 0;
    let clientPartsMargin = 0;
    let clientNetProfit = 0;

    let ownBilledToCarrier = 0;
    let ownWorks = 0;
    let ownMechanicPay = 0;
    let ownPartsCost = 0;
    let ownPartsClient = 0;

    let totalWorks = 0;
    let totalRevenue = 0;
    let totalMechanicPay = 0;
    let totalPartsClient = 0;
    let totalPartsCost = 0;
    let totalPartsMargin = 0;
    let totalMinutes = 0;

    for (const o of filteredGarageOrders) {
      const m = calcGarageOrder(o);
      totalWorks += m.worksSum;
      totalRevenue += m.totalRevenue;
      totalMechanicPay += m.mechanicPay;
      totalPartsClient += m.partsClientSum;
      totalPartsCost += m.partsUnitSum;
      totalPartsMargin += m.partsMargin;
      totalMinutes += m.totalMinutes;

      if (m.isOwn) {
        ownBilledToCarrier += m.billedToCarrier;
        ownWorks += m.worksSum;
        ownMechanicPay += m.mechanicPay;
        ownPartsCost += m.partsUnitSum;
        ownPartsClient += m.partsClientSum;
      } else {
        clientRevenue += m.totalRevenue;
        clientMechanicPay += m.mechanicPay;
        clientPartsCost += m.partsUnitSum;
        clientPartsClient += m.partsClientSum;
        clientPartsMargin += m.partsMargin;
        clientNetProfit += m.netProfit;
      }
    }

    const ownTotalSpent = ownMechanicPay + ownPartsCost;
    const allCount = garageOrders.length;
    const clientCount = garageOrders.filter((o) => o.machine_type === 'client').length;
    const ownCount = garageOrders.filter((o) => o.machine_type === 'own').length;

    return {
      totalOrders: filteredGarageOrders.length,
      allCount,
      clientCount,
      ownCount,
      totalWorks,
      totalRevenue,
      totalMechanicPay,
      totalPartsClient,
      totalPartsCost,
      totalPartsMargin,
      totalMinutes,
      // Чистая прибыль считается ТОЛЬКО с клиентских автомобилей!
      clientRevenue,
      clientMechanicPay,
      clientPartsCost,
      clientPartsClient,
      clientPartsMargin,
      clientNetProfit,
      // Цифра, которую компания Гараж берёт с компании-перевозчика (счёт перевозчику)
      ownBilledToCarrier,
      ownWorks,
      ownMechanicPay,
      ownPartsCost,
      ownPartsClient,
      ownTotalSpent,
    };
  }, [filteredGarageOrders, garageOrders]);

  async function handleApproveServiceOrder(orderId: string) {
    setApprovingId(orderId);
    try {
      const res = await fetch(`/api/garage/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', lifecycle_status: 'approved' }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || 'Ошибка утверждения');
      }
      refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setApprovingId(null);
    }
  }

  async function handleReturnServiceOrder(orderId: string) {
    const note = prompt('Причина возврата наряда механику на доработку (необязательно):');
    if (note === null) return;
    setApprovingId(orderId);
    try {
      const res = await fetch(`/api/garage/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'return',
          lifecycle_status: 'returned',
          admin_note: note || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || 'Ошибка возврата');
      }
      refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setApprovingId(null);
    }
  }

  async function handleDeleteServiceOrder(orderId: string) {
    if (!confirm('Удалить заказ-наряд и все связанные с ним начисления?')) return;
    setDeletingId(orderId);
    try {
      const res = await fetch(`/api/garage/orders/${orderId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || 'Ошибка удаления');
      }
      refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

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

  const listTrips =
    mode === 'history'
      ? statsPeriod === 'day'
        ? trips
        : statsPeriod === 'week'
          ? weekTrips
          : monthTrips
      : trips;

  const listServiceOrders =
    mode === 'history'
      ? statsPeriod === 'day'
        ? dayServiceOrders
        : statsPeriod === 'week'
          ? weekServiceOrders
          : monthServiceOrders
      : [];

  // ── Combined Vehicle Groups ────────────────────────────────
  const combinedAssetGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        assetKey: string;
        assetName: string;
        regNumber: string;
        trips: TripForReview[];
        serviceOrders: ReviewServiceOrder[];
        tripsRevenue: number;
        tripsPayroll: number;
        driverPayroll: number;
        driverCarPayroll: number;
        driverLoaderPayroll: number;
        loaderPayroll: number;
        totalLoadingPayroll: number;
        loadingBilled: number;
        loaderProfit: number;
        tripsFuel: number;
        tripsExpenses: number;
        tripsProfit: number;
        maintenanceParts: number;
        maintenanceSalary: number;
        maintenanceTotal: number;
        netProfit: number;
        collectedRevenue: number;
        pendingDebt: number;
      }
    >();

    // 1. Process Trips
    for (const t of listTrips) {
      const isPrr = t.asset?.reg_number === 'БЕЗ АВТО';
      const assetKey = isPrr
        ? '👷 ПРР (без авто)'
        : t.asset
          ? `${t.asset.short_name} (${t.asset.reg_number})`
          : 'Без машины';
      if (!map.has(assetKey)) {
        map.set(assetKey, {
          assetKey,
          assetName: isPrr ? '👷 ПРР' : (t.asset?.short_name ?? 'Без машины'),
          regNumber: isPrr ? 'без авто' : (t.asset?.reg_number ?? ''),
          trips: [],
          serviceOrders: [],
          tripsRevenue: 0,
          tripsPayroll: 0,
          driverPayroll: 0,
          driverCarPayroll: 0,
          driverLoaderPayroll: 0,
          loaderPayroll: 0,
          totalLoadingPayroll: 0,
          loadingBilled: 0,
          loaderProfit: 0,
          tripsFuel: 0,
          tripsExpenses: 0,
          tripsProfit: 0,
          maintenanceParts: 0,
          maintenanceSalary: 0,
          maintenanceTotal: 0,
          netProfit: 0,
          collectedRevenue: 0,
          pendingDebt: 0,
        });
      }
      const g = map.get(assetKey)!;
      g.trips.push(t);
      const ct = calcTrip(t);
      g.tripsRevenue += ct.revenue;
      g.tripsPayroll += ct.totalPayroll;
      g.driverPayroll += ct.driverPay;
      g.driverCarPayroll += ct.driverCarPay;
      g.driverLoaderPayroll += ct.driverLoaderPay;
      g.loaderPayroll += ct.loaderPay;
      g.totalLoadingPayroll += ct.totalLoadingPayroll;
      g.loadingBilled += ct.loadingBilled;
      g.loaderProfit += ct.loaderProfit;
      g.tripsFuel += ct.fuelExpense;
      g.tripsExpenses += ct.totalExpenses;
      g.tripsProfit += ct.profit;
      g.collectedRevenue += ct.collectedRevenue;
      g.pendingDebt += ct.pendingDebt;
    }

    // 2. Process Service Orders (History only)
    if (mode === 'history') {
      for (const so of listServiceOrders) {
        if (so.machine_type !== 'own' || !so.asset) continue;
        const assetKey = `${so.asset.short_name ?? 'Свой ТС'} (${so.asset.reg_number ?? ''})`;
        if (!map.has(assetKey)) {
          map.set(assetKey, {
            assetKey,
            assetName: so.asset.short_name ?? 'Свой ТС',
            regNumber: so.asset.reg_number ?? '',
            trips: [],
            serviceOrders: [],
            tripsRevenue: 0,
            tripsPayroll: 0,
            driverPayroll: 0,
            driverCarPayroll: 0,
            driverLoaderPayroll: 0,
            loaderPayroll: 0,
            totalLoadingPayroll: 0,
            loadingBilled: 0,
            loaderProfit: 0,
            tripsFuel: 0,
            tripsExpenses: 0,
            tripsProfit: 0,
            maintenanceParts: 0,
            maintenanceSalary: 0,
            maintenanceTotal: 0,
            netProfit: 0,
            collectedRevenue: 0,
            pendingDebt: 0,
          });
        }
        const g = map.get(assetKey)!;
        g.serviceOrders.push(so);
        const cso = calcServiceOrder(so);
        g.maintenanceParts += cso.partsCost;
        g.maintenanceSalary += cso.salaryCost;
        g.maintenanceTotal += cso.totalCost;
      }
    }

    // 3. Compute netProfit for each vehicle
    const groups = Array.from(map.values()).map((g) => {
      g.netProfit = g.tripsProfit - g.maintenanceTotal;
      return g;
    });

    return groups.sort((a, b) => a.assetKey.localeCompare(b.assetKey));
  }, [listTrips, listServiceOrders, mode]);

  // Aggregate Fleet Totals
  const totalFleetRevenue = useMemo(
    () => combinedAssetGroups.reduce((s, g) => s + g.tripsRevenue, 0),
    [combinedAssetGroups],
  );
  const totalFleetCollectedRevenue = useMemo(
    () => combinedAssetGroups.reduce((s, g) => s + (g.collectedRevenue ?? 0), 0),
    [combinedAssetGroups],
  );
  const totalFleetPendingDebt = useMemo(
    () => combinedAssetGroups.reduce((s, g) => s + (g.pendingDebt ?? 0), 0),
    [combinedAssetGroups],
  );
  const totalFleetPayroll = useMemo(
    () => combinedAssetGroups.reduce((s, g) => s + g.tripsPayroll, 0),
    [combinedAssetGroups],
  );
  const totalFleetFuel = useMemo(
    () => combinedAssetGroups.reduce((s, g) => s + g.tripsFuel, 0),
    [combinedAssetGroups],
  );
  const totalFleetTripCosts = useMemo(
    () => combinedAssetGroups.reduce((s, g) => s + g.tripsPayroll + g.tripsExpenses, 0),
    [combinedAssetGroups],
  );
  const totalFleetMaintenance = useMemo(
    () => combinedAssetGroups.reduce((s, g) => s + g.maintenanceTotal, 0),
    [combinedAssetGroups],
  );
  const totalFleetNetProfit = useMemo(
    () => totalFleetRevenue - totalFleetTripCosts - totalFleetMaintenance,
    [totalFleetRevenue, totalFleetTripCosts, totalFleetMaintenance],
  );

  // ID всех заказов из рейсов текущего периода (чтобы не задваивать уже учтённые в рейсах оплаты)
  const periodTripOrderIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of listTrips) {
      for (const o of t.trip_orders ?? []) {
        ids.add(o.id);
      }
    }
    return ids;
  }, [listTrips]);

  // Поступления по долгам контрагентов (погашение дебиторки прошлых периодов / ручных долгов)
  const { totalFleetExternalDebtCollected, externalSettlements } = useMemo(() => {
    const settlements = periodSettlementsData?.settlements ?? [];
    let externalSum = 0;
    const items: Array<{
      id: string;
      description: string;
      amount: number;
      counterpartyName: string | null;
      created_at: string;
    }> = [];

    for (const s of settlements) {
      const orders = s.orders ?? [];
      if (orders.length > 0) {
        let extAmt = 0;
        for (const ord of orders) {
          if (ord.type === 'manual' || !periodTripOrderIds.has(ord.id)) {
            extAmt += ord.amount;
          }
        }
        if (extAmt !== 0) {
          externalSum += extAmt;
          items.push({
            id: s.id,
            description: s.description,
            amount: extAmt,
            counterpartyName: s.counterparty_name,
            created_at: s.created_at,
          });
        }
      } else {
        externalSum += s.amount;
        items.push({
          id: s.id,
          description: s.description,
          amount: s.amount,
          counterpartyName: s.counterparty_name,
          created_at: s.created_at,
        });
      }
    }

    return { totalFleetExternalDebtCollected: externalSum, externalSettlements: items };
  }, [periodSettlementsData, periodTripOrderIds]);

  // Фактическая прибыль: фактически поступившая оплата по рейсам периода (за вычетом неоплаченной дебиторки) минус прямые затраты рейсов и ТО
  const totalFleetActualProfit = useMemo(
    () => totalFleetNetProfit - totalFleetPendingDebt,
    [totalFleetNetProfit, totalFleetPendingDebt],
  );
  const totalFleetLoaderProfit = useMemo(
    () => combinedAssetGroups.reduce((s, g) => s + g.loaderProfit, 0),
    [combinedAssetGroups],
  );
  const totalFleetLoadingBilled = useMemo(
    () => combinedAssetGroups.reduce((s, g) => s + g.loadingBilled, 0),
    [combinedAssetGroups],
  );
  const totalFleetLoadingPayroll = useMemo(
    () => combinedAssetGroups.reduce((s, g) => s + g.totalLoadingPayroll, 0),
    [combinedAssetGroups],
  );

  return (
    <div className="space-y-3 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* 1. Компактная светлая верхняя строка: Заголовок + Кнопки Авто/Гараж (Голубая и Изумрудная) + Режимы */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-sky-200/80 rounded-2xl px-3.5 py-1.5 shadow-2xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-4 rounded-full bg-gradient-to-b from-sky-500 to-emerald-500" />
            <h1 className="text-base font-black text-sky-950 tracking-tight">
              Ревью · {reviewSection === 'auto' ? 'Авто (Водители)' : 'Гараж (Механики)'}
            </h1>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* Уменьшенные в 2 раза кнопки: Голубая для Авто, Изумрудная для Гаража */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setReviewSection('auto')}
              className={cn(
                'py-1.5 px-3.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer',
                reviewSection === 'auto'
                  ? 'bg-sky-600 text-white shadow-xs shadow-sky-200'
                  : 'bg-sky-50/70 text-sky-800 hover:bg-sky-100 border border-sky-200/60',
              )}
            >
              <span>🚛</span>
              <span>Авто (Водители)</span>
              {mode !== 'history' && trips.length > 0 && (
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none',
                    reviewSection === 'auto'
                      ? 'bg-white text-sky-700'
                      : 'bg-sky-200/80 text-sky-900',
                  )}
                >
                  {trips.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setReviewSection('garage')}
              className={cn(
                'py-1.5 px-3.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer',
                reviewSection === 'garage'
                  ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-200'
                  : 'bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60',
              )}
            >
              <span>🔧</span>
              <span>Гараж (Механики)</span>
              {mode !== 'history' && garageOrders.length > 0 && (
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none',
                    reviewSection === 'garage'
                      ? 'bg-white text-emerald-700'
                      : 'bg-emerald-200/80 text-emerald-900',
                  )}
                >
                  {garageOrders.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Вкладки На ревью / Активные (В работе) / История в голубых тонах */}
        <div className="flex items-center gap-1 bg-sky-50/80 p-1 rounded-xl border border-sky-100">
          <button
            type="button"
            onClick={() => setMode('review')}
            className={cn(
              'px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide transition-all cursor-pointer',
              mode === 'review'
                ? 'bg-amber-500 text-white shadow-2xs shadow-amber-200'
                : 'text-sky-700 hover:bg-white/70',
            )}
          >
            На ревью
            {mode === 'review'
              ? reviewSection === 'auto' && trips.length > 0
                ? ` (${trips.length})`
                : reviewSection === 'garage' && garageOrders.length > 0
                  ? ` (${garageOrders.length})`
                  : ''
              : ''}
          </button>
          <button
            type="button"
            onClick={() => setMode('active')}
            className={cn(
              'px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide transition-all cursor-pointer',
              mode === 'active'
                ? 'bg-sky-500 text-white shadow-2xs shadow-sky-200'
                : 'text-sky-700 hover:bg-white/70',
            )}
          >
            {reviewSection === 'auto' ? 'Активные' : 'В работе'}
            {mode === 'active'
              ? reviewSection === 'auto' && trips.length > 0
                ? ` (${trips.length})`
                : reviewSection === 'garage' && garageOrders.length > 0
                  ? ` (${garageOrders.length})`
                  : ''
              : ''}
          </button>
          <button
            type="button"
            onClick={() => setMode('history')}
            className={cn(
              'px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide transition-all cursor-pointer',
              mode === 'history'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'text-sky-700 hover:bg-white/70',
            )}
          >
            История
          </button>
        </div>
      </div>

      {/* 2. Единый светло-голубой/мятный блок: Календарь + Фильтр парка + ИТОГОВАЯ СТАТИСТИКА СВЕРХУ */}
      <div className="bg-gradient-to-r from-sky-50/90 via-white to-emerald-50/70 border border-sky-200 rounded-2xl shadow-2xs overflow-hidden">
        {mode === 'history' && (
          <DateNav
            date={selectedDate}
            period={statsPeriod}
            onChange={setSelectedDate}
            setPeriod={setStatsPeriod}
          />
        )}

        {reviewSection === 'garage' ? (
          <>
            {/* Подшапка фильтра Свои / Клиентские */}
            <div className="px-4 py-1.5 bg-white/80 border-b border-sky-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-sky-800 uppercase tracking-wider mr-1">
                  Разрез машин:
                </span>
                <button
                  type="button"
                  onClick={() => setGarageMachineFilter('all')}
                  className={cn(
                    'px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                    garageMachineFilter === 'all'
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200/70',
                  )}
                >
                  Все машины ({garageSummary.allCount})
                </button>
                <button
                  type="button"
                  onClick={() => setGarageMachineFilter('client')}
                  className={cn(
                    'px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                    garageMachineFilter === 'client'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/70',
                  )}
                >
                  🚗 Клиентские — Доход ({garageSummary.clientCount})
                </button>
                <button
                  type="button"
                  onClick={() => setGarageMachineFilter('own')}
                  className={cn(
                    'px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                    garageMachineFilter === 'own'
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200/70',
                  )}
                >
                  🏢 Свои машины — Затраты ({garageSummary.ownCount})
                </button>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-slate-500 font-medium">
                  Выработка слесарей:{' '}
                  <b className="text-sky-950">{(garageSummary.totalMinutes / 60).toFixed(1)} ч</b> ·
                  Закупка запчастей:{' '}
                  <b className="text-sky-950">
                    {Math.round(garageSummary.totalPartsCost).toLocaleString('ru-RU')} ₽
                  </b>
                </span>
                {filteredGarageOrders.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = filteredGarageOrders.map((o) => o.id);
                      if (allIds.every((id) => expandedGarageOrderIds.has(id))) {
                        setExpandedGarageOrderIds(new Set());
                      } else {
                        setExpandedGarageOrderIds(new Set(allIds));
                      }
                    }}
                    className="text-xs font-bold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200/70 px-2 py-0.5 rounded-lg transition-colors flex items-center gap-0.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {filteredGarageOrders.every((o) => expandedGarageOrderIds.has(o.id))
                        ? 'unfold_less'
                        : 'unfold_more'}
                    </span>
                    {filteredGarageOrders.every((o) => expandedGarageOrderIds.has(o.id))
                      ? 'Свернуть все'
                      : 'Развернуть все'}
                  </button>
                )}
              </div>
            </div>

            {/* Полоса цифр Гаража на светлом фоне */}
            <div className="px-4 py-2.5 flex items-center justify-center flex-wrap gap-3 sm:gap-5">
              <div className="text-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                  {garageMachineFilter === 'own'
                    ? 'Работы (свой парк)'
                    : garageMachineFilter === 'client'
                      ? 'Выручка (клиенты)'
                      : 'Выручка (клиенты)'}
                </span>
                <span className="text-sm sm:text-base font-black text-sky-950">
                  <Money
                    amount={(garageMachineFilter === 'own'
                      ? garageSummary.ownWorks
                      : garageSummary.clientRevenue
                    ).toFixed(2)}
                  />
                </span>
              </div>
              <span className="text-sky-200">−</span>
              <div className="text-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                  ЗП Механиков
                </span>
                <span className="text-sm sm:text-base font-black text-amber-600">
                  −
                  <Money
                    amount={(garageMachineFilter === 'own'
                      ? garageSummary.ownMechanicPay
                      : garageMachineFilter === 'client'
                        ? garageSummary.clientMechanicPay
                        : garageSummary.clientMechanicPay
                    ).toFixed(2)}
                  />
                </span>
              </div>
              <span className="text-sky-200">|</span>
              <div className="text-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                  {garageMachineFilter === 'own' ? 'Запчасти парка' : 'Запчасти (закуп)'}
                </span>
                <span className="text-sm sm:text-base font-black text-sky-700">
                  <Money
                    amount={(garageMachineFilter === 'own'
                      ? garageSummary.ownPartsCost
                      : garageSummary.clientPartsCost
                    ).toFixed(2)}
                  />
                </span>
              </div>
              {garageMachineFilter !== 'own' && (
                <>
                  <span className="text-sky-200">+</span>
                  <div className="text-center bg-emerald-50 border border-emerald-200 rounded-xl px-2.5 py-1">
                    <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest block">
                      Наценка з/ч (+30%)
                    </span>
                    <span className="text-sm sm:text-base font-black text-emerald-700">
                      +<Money amount={garageSummary.clientPartsMargin.toFixed(2)} />
                    </span>
                  </div>
                </>
              )}
              <span className="text-sky-200">=</span>

              {/* 1. ЧИСТАЯ ПРИБЫЛЬ СТО — ТОЛЬКО С КЛИЕНТСКИХ АВТОМОБИЛЕЙ */}
              {garageMachineFilter !== 'own' && (
                <div
                  className={cn(
                    'text-center border rounded-xl px-3.5 py-1 shadow-2xs cursor-help',
                    garageSummary.clientNetProfit >= 0
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-rose-600 border-rose-600 text-white',
                  )}
                  title={`Реальная чистая прибыль гаража со сторонних клиентов:\nВыручка с клиентов: ${Math.round(garageSummary.clientRevenue).toLocaleString('ru-RU')} ₽\n− ЗП механиков (клиенты): ${Math.round(garageSummary.clientMechanicPay).toLocaleString('ru-RU')} ₽\n− Закуп запчастей (клиенты): ${Math.round(garageSummary.clientPartsCost).toLocaleString('ru-RU')} ₽\n───────────────────────\nЧистая прибыль СТО: ${Math.round(garageSummary.clientNetProfit).toLocaleString('ru-RU')} ₽`}
                >
                  <span
                    className={cn(
                      'text-[9px] font-bold uppercase tracking-widest block',
                      garageSummary.clientNetProfit >= 0 ? 'text-emerald-100' : 'text-rose-100',
                    )}
                  >
                    Чистая прибыль (клиенты)
                  </span>
                  <span className="text-base sm:text-lg font-black">
                    {garageSummary.clientNetProfit < 0 ? '−' : ''}
                    <Money amount={Math.abs(garageSummary.clientNetProfit).toFixed(2)} />
                  </span>
                </div>
              )}

              {/* 2. ЦИФРА, КОТОРУЮ ГАРАЖ БЕРЁТ С ПЕРЕВОЗЧИКА — РЯДОМ! */}
              {garageMachineFilter !== 'client' && (
                <div
                  className="text-center border border-sky-300 bg-sky-50 rounded-xl px-3.5 py-1 shadow-2xs cursor-help"
                  title={`Сумма, которую Гараж берёт с компании-перевозчика за обслуживание автопарка:\n• Работы: ${Math.round(garageSummary.ownWorks).toLocaleString('ru-RU')} ₽\n• Запчасти: ${Math.round(garageSummary.ownPartsCost).toLocaleString('ru-RU')} ₽\n───────────────────────\nВсего счёт перевозчику: ${Math.round(garageSummary.ownBilledToCarrier).toLocaleString('ru-RU')} ₽\n(Прямые затраты гаража: ЗП слесарей ${Math.round(garageSummary.ownMechanicPay).toLocaleString('ru-RU')} ₽ + закуп з/ч ${Math.round(garageSummary.ownPartsCost).toLocaleString('ru-RU')} ₽ = ${Math.round(garageSummary.ownTotalSpent).toLocaleString('ru-RU')} ₽)\nРеальной чистой прибыли нет — это внутреннее обслуживание автопарка`}
                >
                  <span className="text-[9px] font-bold uppercase tracking-widest block text-sky-800">
                    Счёт перевозчику (свой парк)
                  </span>
                  <span className="text-base sm:text-lg font-black text-sky-950">
                    <Money amount={garageSummary.ownBilledToCarrier.toFixed(2)} />
                  </span>
                </div>
              )}

              {garageMachineFilter === 'own' && (
                <div
                  className="text-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 cursor-help"
                  title={`Прямые расходы гаража: ЗП слесарей (${Math.round(garageSummary.ownMechanicPay).toLocaleString('ru-RU')} ₽) + закупка запчастей (${Math.round(garageSummary.ownPartsCost).toLocaleString('ru-RU')} ₽). Реальной чистой прибыли нет, так как это внутреннее обслуживание автопарка.`}
                >
                  <span className="text-[9px] font-bold uppercase tracking-widest block text-slate-400">
                    Прямые затраты парка
                  </span>
                  <span className="text-sm sm:text-base font-bold text-slate-700">
                    −<Money amount={garageSummary.ownTotalSpent.toFixed(2)} />
                  </span>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Итоговая статистика АВТО (СВЕРХУ на светло-голубом/мятном фоне) */}
            <div className="px-4 py-1.5 bg-white/80 border-b border-sky-100 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sky-800 font-bold uppercase tracking-wider">
                  {mode === 'history'
                    ? `Итоговая статистика · ${listTrips.length} рейс${listTrips.length === 1 ? '' : listTrips.length < 5 && listTrips.length > 0 ? 'а' : 'ов'}${listServiceOrders.length > 0 ? ` · ${listServiceOrders.length} ТО` : ''}`
                    : mode === 'active'
                      ? `Активные · ${trips.length} рейс${trips.length === 1 ? '' : trips.length < 5 && trips.length > 0 ? 'а' : 'ов'}`
                      : `На ревью · ${trips.length} рейс${trips.length === 1 ? '' : trips.length < 5 && trips.length > 0 ? 'а' : 'ов'}`}
                </span>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {totalFleetLoaderProfit > 0 && (
                  <span className="text-slate-500 flex items-center gap-1">
                    <span>в т.ч. ПРР (грузчики):</span>
                    <b className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      +<Money amount={totalFleetLoaderProfit.toFixed(2)} />
                    </b>
                  </span>
                )}
                {totalFleetPendingDebt > 0 && (
                  <span
                    className="text-slate-500 flex items-center gap-1 cursor-help"
                    title={`Неоплаченная дебиторка за период: клиенты ещё должны ${Math.round(totalFleetPendingDebt).toLocaleString('ru-RU')} ₽`}
                  >
                    <span>в долгах клиентов:</span>
                    <b className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      <Money amount={totalFleetPendingDebt.toFixed(2)} />
                    </b>
                  </span>
                )}
                {totalFleetExternalDebtCollected > 0 && (
                  <span
                    className="text-slate-500 flex items-center gap-1 cursor-help"
                    title={`Погашение задолженностей прошлых периодов, поступившее в выбранном периоде (+${Math.round(totalFleetExternalDebtCollected).toLocaleString('ru-RU')} ₽):\n${externalSettlements
                      .slice(0, 5)
                      .map(
                        (s) =>
                          `• ${s.counterpartyName || 'Контрагент'}: +${Math.round(s.amount).toLocaleString('ru-RU')} ₽ (${new Date(s.created_at).toLocaleDateString('ru-RU')})`,
                      )
                      .join(
                        '\n',
                      )}${externalSettlements.length > 5 ? `\n...и ещё ${externalSettlements.length - 5} платежей` : ''}`}
                  >
                    <span>погашено долгов:</span>
                    <b className="text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                      +<Money amount={totalFleetExternalDebtCollected.toFixed(2)} />
                    </b>
                  </span>
                )}
                {combinedAssetGroups.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = listTrips.map((t) => t.id);
                      const allGroups = combinedAssetGroups.map((g) => g.assetKey);
                      const isAllExpanded =
                        expandedIds.size === allIds.length &&
                        expandedGroups.size === allGroups.length;

                      if (isAllExpanded) {
                        setExpandedIds(new Set());
                        setExpandedGroups(new Set());
                      } else {
                        setExpandedIds(new Set(allIds));
                        setExpandedGroups(new Set(allGroups));
                      }
                    }}
                    className="text-xs font-bold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200/70 px-2 py-0.5 rounded-lg transition-colors flex items-center gap-0.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {expandedIds.size === listTrips.length &&
                      expandedGroups.size === combinedAssetGroups.length
                        ? 'unfold_less'
                        : 'unfold_more'}
                    </span>
                    {expandedIds.size === listTrips.length &&
                    expandedGroups.size === combinedAssetGroups.length
                      ? 'Свернуть все'
                      : 'Развернуть все'}
                  </button>
                )}
              </div>
            </div>

            <div className="px-4 py-2.5 flex items-center justify-center flex-wrap gap-3 sm:gap-5">
              <div className="text-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                  Выручка
                </span>
                <span className="text-sm sm:text-base font-black text-sky-950">
                  <Money amount={totalFleetRevenue.toFixed(2)} />
                </span>
              </div>

              <span className="text-sky-200">|</span>

              <div className="text-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                  Зарплаты
                </span>
                <span className="text-sm sm:text-base font-black text-amber-600">
                  −<Money amount={totalFleetPayroll.toFixed(2)} />
                </span>
              </div>

              <span className="text-sky-200">|</span>

              <div className="text-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                  Топливо
                </span>
                <span className="text-sm sm:text-base font-black text-sky-600">
                  −<Money amount={totalFleetFuel.toFixed(2)} />
                </span>
              </div>

              {mode === 'history' && (
                <>
                  <span className="text-sky-200">|</span>

                  <div className="text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                      Ремонты ТО
                    </span>
                    <span className="text-sm sm:text-base font-black text-rose-600">
                      −<Money amount={totalFleetMaintenance.toFixed(2)} />
                    </span>
                  </div>
                </>
              )}

              <span className="text-sky-200">=</span>

              <div
                className="text-center cursor-help"
                title={`Чистый итог (начисленный доход рейсов):\nВыручка: ${Math.round(totalFleetRevenue).toLocaleString('ru-RU')} ₽\n− Зарплаты: ${Math.round(totalFleetPayroll).toLocaleString('ru-RU')} ₽\n− Топливо: ${Math.round(totalFleetFuel).toLocaleString('ru-RU')} ₽\n− Ремонты ТО: ${Math.round(totalFleetMaintenance).toLocaleString('ru-RU')} ₽\n= Чистый итог: ${Math.round(totalFleetNetProfit).toLocaleString('ru-RU')} ₽`}
              >
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                  Чистый итог
                </span>
                <span
                  className={cn(
                    'text-base sm:text-lg font-black',
                    totalFleetNetProfit >= 0 ? 'text-emerald-600' : 'text-rose-600',
                  )}
                >
                  {totalFleetNetProfit < 0 ? '−' : ''}
                  <Money amount={Math.abs(totalFleetNetProfit).toFixed(2)} />
                </span>
              </div>

              <span className="text-sky-200">|</span>

              <div
                className={cn(
                  'text-center rounded-xl py-1 px-3.5 shadow-2xs cursor-help',
                  totalFleetActualProfit >= 0
                    ? 'bg-emerald-600 text-white'
                    : 'bg-rose-600 text-white',
                )}
                title={`Фактическая прибыль:\n• Поступило по рейсам периода: ${Math.round(totalFleetCollectedRevenue).toLocaleString('ru-RU')} ₽\n• Не оплачено клиентами по рейсам (в долгах): ${Math.round(totalFleetPendingDebt).toLocaleString('ru-RU')} ₽\n• Все расходы (ЗП + Топливо + ТО): ${Math.round(totalFleetTripCosts + totalFleetMaintenance).toLocaleString('ru-RU')} ₽\n───────────────────────\nФактическая прибыль: ${Math.round(totalFleetActualProfit).toLocaleString('ru-RU')} ₽`}
              >
                <span
                  className={cn(
                    'text-[9px] font-bold uppercase tracking-widest block',
                    totalFleetActualProfit >= 0 ? 'text-emerald-100' : 'text-rose-100',
                  )}
                >
                  Факт. прибыль
                </span>
                <span className="text-base sm:text-lg font-black">
                  {totalFleetActualProfit < 0 ? '−' : ''}
                  <Money amount={Math.abs(totalFleetActualProfit).toFixed(2)} />
                </span>
              </div>

              {totalFleetLoaderProfit > 0 && (
                <>
                  <span className="text-sky-200">|</span>

                  <div
                    className="text-center bg-emerald-50 border border-emerald-200 rounded-xl py-1 px-3 cursor-help"
                    title={`Сумма уже включена в Чистый итог:\nВсего за ПРР клиенты заплатили ${Math.round(totalFleetLoadingBilled).toLocaleString('ru-RU')} ₽, выплачено рабочим ${Math.round(totalFleetLoadingPayroll).toLocaleString('ru-RU')} ₽, чистая прибыль компании 30% = +${Math.round(totalFleetLoaderProfit).toLocaleString('ru-RU')} ₽`}
                  >
                    <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest block">
                      в т.ч. с ПРР
                    </span>
                    <span className="text-sm sm:text-base font-black text-emerald-700">
                      +<Money amount={totalFleetLoaderProfit.toFixed(2)} />
                    </span>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── GARAGE SECTION (Механики) ── */}
      {reviewSection === 'garage' && (
        <div className="space-y-3">
          {isGarageLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-slate-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filteredGarageOrders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-14 text-center shadow-sm">
              <span className="material-symbols-outlined text-slate-200 text-[72px] mb-4 block">
                {mode === 'review' ? 'check_circle' : 'build_circle'}
              </span>
              <p className="text-slate-500 font-semibold text-lg">
                {garageOrders.length > 0
                  ? garageMachineFilter === 'client'
                    ? 'Нет клиентских заказ-нарядов за выбранный период'
                    : 'Нет заказ-нарядов по своим машинам за выбранный период'
                  : mode === 'review'
                    ? 'Нет заказ-нарядов на ревью — все работы механиков проверены!'
                    : mode === 'active'
                      ? 'Нет открытых заказ-нарядов в работе'
                      : 'Нет заказ-нарядов за выбранный период'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredGarageOrders.map((order) => (
                <GarageOrderRow
                  key={order.id}
                  order={order}
                  expanded={expandedGarageOrderIds.has(order.id)}
                  onToggle={() => toggleGarageOrder(order.id)}
                  onEdit={() => setEditServiceOrder(order)}
                  onApprove={() => handleApproveServiceOrder(order.id)}
                  onReturn={() => handleReturnServiceOrder(order.id)}
                  onDelete={() => handleDeleteServiceOrder(order.id)}
                  approving={approvingId === order.id}
                  deleting={deletingId === order.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading skeletons */}
      {reviewSection === 'auto' && isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Vehicle Cards List ── */}
      {reviewSection === 'auto' && !isLoading && (
        <div className="space-y-4">
          {combinedAssetGroups.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-14 text-center shadow-sm">
              <span className="material-symbols-outlined text-slate-200 text-[72px] mb-4 block">
                {mode === 'review'
                  ? 'check_circle'
                  : mode === 'active'
                    ? 'local_shipping'
                    : 'search'}
              </span>
              <p className="text-slate-500 font-semibold text-lg">
                {mode === 'review'
                  ? 'Всё проверено'
                  : mode === 'active'
                    ? 'Нет активных рейсов'
                    : 'Нет данных за этот период'}
              </p>
            </div>
          ) : (
            <>
              {combinedAssetGroups.map((group) => {
                const isExpanded = expandedGroups.has(group.assetKey);

                return (
                  <div
                    key={group.assetKey}
                    className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200"
                  >
                    {/* Group Header */}
                    <div
                      onClick={() => toggleGroup(group.assetKey)}
                      className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-sky-100 p-2 rounded-xl text-sky-600">
                          <span className="material-symbols-outlined block">local_shipping</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 text-base">{group.assetKey}</h3>
                          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 flex-wrap mt-0.5">
                            {group.trips.length > 0 ? (
                              <>
                                <span>
                                  {group.trips.length} рейс
                                  {group.trips.length === 1
                                    ? ''
                                    : group.trips.length < 5
                                      ? 'а'
                                      : 'ов'}
                                  :
                                </span>
                                <div className="inline-flex flex-wrap gap-1 items-center">
                                  {group.trips.map((t) => (
                                    <span
                                      key={t.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!expandedGroups.has(group.assetKey)) {
                                          toggleGroup(group.assetKey);
                                        }
                                        if (!expandedIds.has(t.id)) {
                                          toggleExpand(t.id);
                                        }
                                      }}
                                      className="inline-flex items-center bg-sky-50 hover:bg-sky-500 hover:text-white border border-sky-200 text-sky-700 font-bold px-1.5 py-0.5 rounded text-[11px] cursor-pointer transition-colors shadow-2xs"
                                      title={`Нажмите, чтобы открыть рейс #${t.trip_number}`}
                                    >
                                      #{t.trip_number}
                                    </span>
                                  ))}
                                </div>
                              </>
                            ) : (
                              <span className="text-slate-400 italic">0 рейсов</span>
                            )}
                            {mode === 'history' && group.serviceOrders.length > 0 && (
                              <>
                                <span className="text-slate-300">·</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedMaintenanceGroup(group);
                                  }}
                                  className="text-rose-600 hover:text-rose-800 font-bold underline decoration-rose-300 underline-offset-2 cursor-pointer transition-colors"
                                  title="Нажмите для просмотра заказ-нарядов"
                                >
                                  {group.serviceOrders.length} наряд
                                  {group.serviceOrders.length === 1 ? '' : 'а'} ТО (−
                                  {group.maintenanceTotal.toLocaleString('ru-RU')} ₽)
                                </button>
                              </>
                            )}
                          </div>
                          {/* Service order badges directly in header */}
                          {mode === 'history' && group.serviceOrders.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                              {group.serviceOrders.map((so) => {
                                const cso = calcServiceOrder(so);
                                return (
                                  <span
                                    key={so.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedMaintenanceGroup(group);
                                    }}
                                    className={cn(
                                      'inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[11px] cursor-pointer transition-all shadow-2xs',
                                      cso.isExternal
                                        ? 'bg-purple-50 hover:bg-purple-600 hover:text-white border border-purple-200 text-purple-800'
                                        : cso.isEquipment
                                          ? 'bg-amber-50 hover:bg-amber-600 hover:text-white border border-amber-300 text-amber-800'
                                          : 'bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-200 text-rose-700',
                                    )}
                                    title={`Заказ-наряд #${so.order_number}: ${so.problem_description || ''}. Нажмите для просмотра`}
                                  >
                                    <span>
                                      {cso.isExternal ? '🏢' : cso.isEquipment ? '⚙️' : '🔧'}
                                    </span>
                                    <span>#{so.order_number}</span>
                                    {cso.contractorName && (
                                      <span className="opacity-85 max-w-[120px] truncate">
                                        {cso.contractorName.replace(/^ООО\s*["']?|["']$/g, '')}
                                      </span>
                                    )}
                                    <span className="font-mono text-[10px] opacity-90">
                                      (−{cso.totalCost.toLocaleString('ru-RU')} ₽)
                                    </span>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Header Metrics */}
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="text-right hidden sm:block">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Выручка
                          </span>
                          <span className="text-sm font-black text-slate-800">
                            <Money amount={group.tripsRevenue.toFixed(2)} />
                          </span>
                        </div>
                        <div
                          className="text-right hidden sm:block relative cursor-help"
                          title={`ФОТ рейсов: Водители ${Math.round(group.driverPayroll).toLocaleString('ru-RU')} ₽ + Грузчики ${Math.round(group.loaderPayroll).toLocaleString('ru-RU')} ₽${group.loaderProfit > 0 ? `\nПрибыль компании с грузчиков: +${Math.round(group.loaderProfit).toLocaleString('ru-RU')} ₽ (маржа 30%)` : ''}`}
                        >
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            ЗП (ФОТ)
                          </span>
                          <span className="text-sm font-black text-amber-500">
                            <Money amount={group.tripsPayroll.toFixed(2)} />
                          </span>
                          {group.loaderProfit > 0 && (
                            <span className="text-[9px] font-bold text-emerald-600 block leading-tight">
                              +{Math.round(group.loaderProfit).toLocaleString('ru-RU')} ₽ с грузч.
                            </span>
                          )}
                        </div>
                        <div className="text-right hidden sm:block">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            ГСМ
                          </span>
                          <span className="text-sm font-black text-rose-500">
                            <Money amount={group.tripsFuel.toFixed(2)} />
                          </span>
                        </div>
                        {mode === 'history' && (
                          <div
                            onClick={(e) => {
                              if (group.serviceOrders.length > 0) {
                                e.stopPropagation();
                                setSelectedMaintenanceGroup(group);
                              }
                            }}
                            className={cn(
                              'text-right hidden sm:block px-2 py-0.5 rounded-lg transition-colors',
                              group.serviceOrders.length > 0
                                ? 'bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer shadow-2xs'
                                : '',
                            )}
                            title={
                              group.serviceOrders.length > 0
                                ? `Нажмите, чтобы открыть ${group.serviceOrders.length} заказ-наряда ТО`
                                : 'Ремонтов не было'
                            }
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                              Ремонт ТО
                            </span>
                            <span
                              className={cn(
                                'text-sm font-black',
                                group.maintenanceTotal > 0 ? 'text-rose-600' : 'text-slate-400',
                              )}
                            >
                              {group.maintenanceTotal > 0 ? (
                                <>
                                  −<Money amount={group.maintenanceTotal.toFixed(2)} />
                                </>
                              ) : (
                                '0 ₽'
                              )}
                            </span>
                          </div>
                        )}
                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Прибыль
                          </span>
                          <span
                            className={cn(
                              'text-sm font-black',
                              group.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600',
                            )}
                          >
                            {group.netProfit < 0 ? '−' : ''}
                            <Money amount={Math.abs(group.netProfit).toFixed(2)} />
                          </span>
                        </div>
                        <span
                          className={cn(
                            'material-symbols-outlined text-slate-400 transition-transform duration-300',
                            isExpanded ? 'rotate-180' : '',
                          )}
                        >
                          expand_more
                        </span>
                      </div>
                    </div>

                    {/* Group Content (Trips & Service Orders) */}
                    {isExpanded && (
                      <div className="p-4 bg-slate-50/50 border-t border-slate-100 space-y-4">
                        {/* Payroll & Loaders Profit Summary Banner */}
                        <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs space-y-2.5 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-3 sm:gap-5">
                              {/* 1. Водители */}
                              <div>
                                <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">
                                  ЗП водителя (за руль)
                                </span>
                                <span className="font-extrabold text-slate-800 text-sm">
                                  <Money amount={group.driverCarPayroll.toFixed(2)} />
                                </span>
                                {group.driverLoaderPayroll > 0 && (
                                  <span
                                    className="block text-[10px] text-amber-600 font-semibold"
                                    title="Доплата водителю за то, что грузил сам"
                                  >
                                    +{Math.round(group.driverLoaderPayroll).toLocaleString('ru-RU')}{' '}
                                    ₽ за погрузку
                                  </span>
                                )}
                              </div>

                              <div className="h-8 w-px bg-slate-200 hidden sm:block" />

                              {/* 2. Бригада грузчиков */}
                              <div>
                                <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">
                                  Выплаты бригаде грузчиков
                                </span>
                                <span className="font-extrabold text-slate-700 text-sm">
                                  <Money amount={group.loaderPayroll.toFixed(2)} />
                                </span>
                                <span className="block text-[10px] text-slate-400">
                                  Всего за ПРР:{' '}
                                  {Math.round(group.totalLoadingPayroll).toLocaleString('ru-RU')} ₽
                                </span>
                              </div>

                              {group.loaderProfit > 0 && (
                                <>
                                  <div className="h-8 w-px bg-slate-200 hidden sm:block" />

                                  {/* 3. Оплачено клиентами за ПРР */}
                                  <div>
                                    <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">
                                      Оплачено клиентами за ПРР
                                    </span>
                                    <span className="font-extrabold text-slate-900 text-sm">
                                      <Money amount={group.loadingBilled.toFixed(2)} />
                                    </span>
                                    <span className="block text-[10px] text-slate-400">
                                      в чеках заказов
                                    </span>
                                  </div>

                                  <div className="h-8 w-px bg-slate-200 hidden sm:block" />

                                  {/* 4. Чистая прибыль с ПРР */}
                                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-emerald-600 text-[20px]">
                                      payments
                                    </span>
                                    <div>
                                      <span className="text-emerald-800 block text-[9px] uppercase font-black tracking-wider">
                                        Прибыль компании с ПРР
                                      </span>
                                      <span className="font-black text-emerald-600 text-sm sm:text-base">
                                        +{Math.round(group.loaderProfit).toLocaleString('ru-RU')} ₽
                                      </span>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>

                            {group.loaderProfit > 0 ? (
                              <div className="text-[10px] text-slate-400 font-medium">
                                ПРР: 70% оплата рабочим · 30% прибыль компании
                              </div>
                            ) : group.totalLoadingPayroll > 0 ? (
                              <div className="text-[10px] text-slate-400 font-medium italic">
                                * До 01.09.2026 маржа с ПРР не взималась (100% выплата рабочим)
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {/* 1. Trips Section */}
                        {group.trips.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs font-black text-slate-700 uppercase tracking-wider px-1">
                              <span className="material-symbols-outlined text-sky-600 text-[18px]">
                                local_shipping
                              </span>
                              Рейсы автомобиля ({group.trips.length})
                            </div>
                            <div className="space-y-3">
                              {group.trips.map((trip) => (
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
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 2. Service Orders Section (History Mode) */}
                        {mode === 'history' && group.serviceOrders.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-slate-200/60">
                            <div className="flex items-center justify-between px-1 flex-wrap gap-2">
                              <div className="flex items-center gap-2 text-xs font-black text-slate-700 uppercase tracking-wider">
                                <span className="material-symbols-outlined text-rose-600 text-[18px]">
                                  build_circle
                                </span>
                                Заказ-наряды ТО и ремонты ({group.serviceOrders.length})
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedMaintenanceGroup(group)}
                                className="text-xs font-black text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <span>
                                  Итого ТО: −{group.maintenanceTotal.toLocaleString('ru-RU')} ₽
                                </span>
                                <span className="material-symbols-outlined text-[14px]">
                                  open_in_new
                                </span>
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {group.serviceOrders.map((so) => {
                                const cso = calcServiceOrder(so);
                                const cleanDesc = (so.problem_description || so.admin_note || '')
                                  .replace(/\[Сторонний сервис[^\]]*\]\s*/gi, '')
                                  .trim();
                                return (
                                  <div
                                    key={so.id}
                                    onClick={() => setSelectedMaintenanceGroup(group)}
                                    className={cn(
                                      'p-3.5 rounded-xl border bg-white shadow-2xs hover:shadow-sm cursor-pointer transition-all flex flex-col justify-between gap-2.5',
                                      cso.isExternal
                                        ? 'border-purple-200 hover:border-purple-400'
                                        : 'border-slate-200 hover:border-rose-300',
                                    )}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span
                                          className={cn(
                                            'text-[11px] font-mono font-black px-2 py-0.5 rounded-md text-white',
                                            cso.isExternal ? 'bg-purple-600' : 'bg-rose-600',
                                          )}
                                        >
                                          НЗ-{so.order_number}
                                        </span>
                                        <span className="text-xs font-bold text-slate-800">
                                          {new Date(so.created_at).toLocaleDateString('ru-RU', {
                                            day: 'numeric',
                                            month: 'short',
                                          })}
                                        </span>
                                        {cso.isExternal && (
                                          <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-1">
                                            <span>🏢</span>
                                            <span>{cso.contractorName || 'Сторонний сервис'}</span>
                                          </span>
                                        )}
                                        {cso.isEquipment && (
                                          <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-1">
                                            <span>⚙️</span>
                                            <span>Доп. оборуд.</span>
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-xs font-black text-rose-600 whitespace-nowrap">
                                        −{cso.totalCost.toLocaleString('ru-RU')} ₽
                                      </span>
                                    </div>
                                    {cleanDesc && (
                                      <p className="text-xs text-slate-700 font-medium line-clamp-2">
                                        {cleanDesc}
                                      </p>
                                    )}
                                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
                                      <span>
                                        {cso.isExternal
                                          ? `Подрядчик: ${cso.worksCost > 0 ? `${cso.worksCost.toLocaleString('ru-RU')} ₽` : 'запчасти'}`
                                          : so.mechanic?.name
                                            ? `Слесарь: ${so.mechanic.name}`
                                            : 'Свой гараж'}
                                      </span>
                                      <span className="text-slate-400 flex items-center gap-0.5 font-medium hover:text-slate-700">
                                        Детали{' '}
                                        <span className="material-symbols-outlined text-[14px]">
                                          arrow_forward
                                        </span>
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 3. Empty state */}
                        {group.trips.length === 0 && group.serviceOrders.length === 0 && (
                          <div className="text-center py-6 text-slate-400 text-xs font-medium">
                            Нет записей за выбранный период
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Maintenance Breakdown Modal */}
      {selectedMaintenanceGroup && (
        <MaintenanceDetailModal
          group={selectedMaintenanceGroup}
          onClose={() => setSelectedMaintenanceGroup(null)}
        />
      )}

      {/* Edit modal (Auto) */}
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

      {/* Edit modal (Garage) */}
      {editServiceOrder && (
        <GarageOrderEditModal
          order={editServiceOrder}
          onClose={() => setEditServiceOrder(null)}
          onSaved={() => {
            setEditServiceOrder(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
