'use client';

import { cn } from '@saldacargo/ui';
import { getWeekDates } from './utils';

export function DateNav({
  date,
  period = 'day',
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
    <div className="flex flex-wrap items-center justify-between border border-slate-300 px-3.5 py-2 gap-2.5 bg-white rounded-xl shadow-xs">
      {/* Переключатель периода: День / Неделя / Месяц */}
      {setPeriod && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black uppercase text-slate-400 mr-0.5 hidden sm:inline">
            Период:
          </span>
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setPeriod('day')}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer',
                period === 'day'
                  ? 'bg-sky-600 text-white shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              День
            </button>
            <button
              type="button"
              onClick={() => setPeriod('week')}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer',
                period === 'week'
                  ? 'bg-sky-600 text-white shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              Неделя
            </button>
            <button
              type="button"
              onClick={() => setPeriod('month')}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer',
                period === 'month'
                  ? 'bg-sky-600 text-white shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              Месяц
            </button>
          </div>
        </div>
      )}

      {/* Компактный выбор даты по центру */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="w-7 h-7 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-lg text-slate-700 font-bold text-xs cursor-pointer shadow-2xs transition-colors flex items-center justify-center"
          aria-label="Предыдущий период"
        >
          ◀
        </button>

        <label className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:border-slate-300 transition-colors">
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && onChange(e.target.value)}
            className="sr-only"
          />
          <span className="material-symbols-outlined text-sky-600 text-[16px]">calendar_today</span>
          <span className="text-xs sm:text-sm font-black text-slate-900 uppercase hover:text-sky-700 transition-colors whitespace-nowrap">
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
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap hidden sm:inline capitalize">
              (
              {new Date(date + 'T12:00:00').toLocaleDateString('ru-RU', {
                weekday: 'short',
              })}
              )
            </span>
          )}
          {!isToday && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onChange(today);
              }}
              className="text-[10px] font-bold text-sky-700 hover:underline ml-1"
            >
              сегодня
            </button>
          )}
        </label>

        <button
          type="button"
          onClick={() => shift(1)}
          disabled={date >= today}
          className="w-7 h-7 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-lg text-slate-700 font-bold text-xs cursor-pointer shadow-2xs transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Следующий период"
        >
          ▶
        </button>
      </div>

      {/* Поиск по номеру рейса: вводишь номер рейса и он выходит сразу */}
      {onTripSearchChange && (
        <div className="relative flex items-center min-w-[140px] sm:min-w-[170px] max-w-[210px] w-full sm:w-auto">
          <span className="material-symbols-outlined absolute left-2 text-slate-400 text-[16px] pointer-events-none select-none">
            search
          </span>
          <input
            type="text"
            value={tripSearch}
            onChange={(e) => onTripSearchChange(e.target.value)}
            placeholder="Поиск по № рейса..."
            className="w-full pl-7 pr-6 py-1 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-sky-500 rounded-lg text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none transition-all shadow-2xs"
          />
          {tripSearch && (
            <button
              type="button"
              onClick={() => onTripSearchChange('')}
              className="absolute right-1.5 text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer p-0.5"
              title="Очистить поиск"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Быстрые месяцы / недели справа */}
      {period !== 'week' ? (
        <div className="flex items-center gap-1 overflow-x-auto text-[11px] font-bold">
          {months.map((m) => {
            const active = m.month === curMonth && m.year === curYear;
            return (
              <button
                type="button"
                key={`${m.year}-${m.month}`}
                onClick={() => goMonth(m.year, m.month)}
                className={cn(
                  'px-2 py-1 rounded-md transition-all whitespace-nowrap cursor-pointer',
                  active
                    ? 'bg-sky-100 text-sky-900 border border-sky-300 font-black'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100',
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
