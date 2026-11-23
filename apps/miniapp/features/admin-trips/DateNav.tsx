'use client';

import { getWeekDates } from '@saldacargo/shared';
import { cn } from '@saldacargo/ui';

export function DateNav({
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
