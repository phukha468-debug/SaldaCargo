'use client';

import { cn } from '@saldacargo/ui';
import { getArchiveWeekDates, todayStr } from '../utils';

export function DatePeriodNav({
  period,
  setPeriod,
  date,
  setDate,
}: {
  period: 'all' | 'day' | 'week' | 'month';
  setPeriod: (p: 'all' | 'day' | 'week' | 'month') => void;
  date: string;
  setDate: (d: string) => void;
}) {
  const today = todayStr();

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
    setDate(s <= today ? s : today);
  };

  const getWeekRangeLabel = (dateStr: string) => {
    const { weekStart, weekEnd } = getArchiveWeekDates(dateStr);
    const ws = new Date(weekStart + 'T12:00:00');
    const we = new Date(weekEnd + 'T12:00:00');
    return `${ws.getDate()} ${ws.toLocaleDateString('ru-RU', { month: 'short' })} — ${we.getDate()} ${we.toLocaleDateString('ru-RU', { month: 'short' })}`;
  };

  const getMonthLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  };

  const getDayLabel = (dateStr: string) => {
    if (dateStr === today) return 'Сегодня';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  };

  return (
    <div className="flex flex-wrap items-center justify-between bg-white border border-slate-200/80 rounded-2xl p-2.5 gap-2 shadow-2xs">
      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
        <button
          type="button"
          onClick={() => setPeriod('all')}
          className={cn(
            'px-3 py-1 rounded-lg transition-all cursor-pointer',
            period === 'all'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-500 hover:text-slate-900',
          )}
        >
          Все время
        </button>
        <button
          type="button"
          onClick={() => setPeriod('day')}
          className={cn(
            'px-3 py-1 rounded-lg transition-all cursor-pointer',
            period === 'day'
              ? 'bg-white text-sky-700 shadow-2xs'
              : 'text-slate-500 hover:text-slate-900',
          )}
        >
          День
        </button>
        <button
          type="button"
          onClick={() => setPeriod('week')}
          className={cn(
            'px-3 py-1 rounded-lg transition-all cursor-pointer',
            period === 'week'
              ? 'bg-white text-sky-700 shadow-2xs'
              : 'text-slate-500 hover:text-slate-900',
          )}
        >
          Неделя
        </button>
        <button
          type="button"
          onClick={() => setPeriod('month')}
          className={cn(
            'px-3 py-1 rounded-lg transition-all cursor-pointer',
            period === 'month'
              ? 'bg-white text-sky-700 shadow-2xs'
              : 'text-slate-500 hover:text-slate-900',
          )}
        >
          Месяц
        </button>
      </div>

      {period !== 'all' && (
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors cursor-pointer"
            title="Предыдущий период"
          >
            ←
          </button>

          <span className="font-bold text-slate-800 min-w-[130px] text-center capitalize">
            {period === 'day' && getDayLabel(date)}
            {period === 'week' && getWeekRangeLabel(date)}
            {period === 'month' && getMonthLabel(date)}
          </span>

          <button
            type="button"
            onClick={() => shift(1)}
            disabled={date >= today}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title="Следующий период"
          >
            →
          </button>

          {date !== today && (
            <button
              type="button"
              onClick={() => setDate(today)}
              className="text-[11px] font-bold text-sky-600 hover:text-sky-800 bg-sky-50 px-2 py-1 rounded-lg border border-sky-200 transition-colors cursor-pointer ml-1"
            >
              Сегодня
            </button>
          )}
        </div>
      )}
    </div>
  );
}
