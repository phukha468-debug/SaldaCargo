'use client';

import { useMemo } from 'react';
import type { DailyBalanceData, PeriodMode, WalletFilter } from './types';
import { formatPeriodHeader, getWeekDates, rub } from './utils';

export function DailyControlHeader({
  data,
  selectedDate,
  todayStr,
  period,
  activeWallet,
  isFetching,
  morningTotal,
  eveningTotal,
  deltaTotal,
  totalDayExpenses,
  totalDayIncomes,
  expensesCount,
  incomesCount,
  onChangePeriod,
  onChangeDate,
  onShiftPeriod,
  onChangeWallet,
  onOpenManualModal,
  onOpenAuditModal,
  onRefetch,
}: {
  data: DailyBalanceData | undefined;
  selectedDate: string;
  todayStr: string;
  period: PeriodMode;
  activeWallet: WalletFilter;
  isFetching: boolean;
  morningTotal: number;
  eveningTotal: number;
  deltaTotal: number;
  totalDayExpenses: number;
  totalDayIncomes: number;
  expensesCount: number;
  incomesCount: number;
  onChangePeriod: (p: PeriodMode) => void;
  onChangeDate: (date: string) => void;
  onShiftPeriod: (delta: number) => void;
  onChangeWallet: (w: WalletFilter) => void;
  onOpenManualModal: (type: 'expense' | 'income') => void;
  onOpenAuditModal: () => void;
  onRefetch: () => void;
}) {
  const bankWallet = data?.wallets?.bank;
  const cashWallet = data?.wallets?.cash;
  const fuelWallet = data?.wallets?.fuel_card;

  const monthStrip = useMemo(() => {
    const now = new Date();
    const sel = new Date(selectedDate + 'T12:00:00Z');
    const monthsDiff =
      (now.getFullYear() - sel.getFullYear()) * 12 + (now.getMonth() - sel.getMonth());
    let startOffset = 4;
    let baseDate = now;
    if (monthsDiff >= 5 || monthsDiff < 0) {
      baseDate = sel;
      startOffset = 2;
    }

    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(baseDate);
      d.setDate(1);
      d.setMonth(d.getMonth() - (startOffset - i));
      const ym = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString('ru-RU', { month: 'short' }).toUpperCase();
      return { ym, label, isCurrent: selectedDate.startsWith(ym) };
    });
  }, [selectedDate]);

  const weekStrip = useMemo(() => {
    const list = [];
    const base = new Date(selectedDate + 'T12:00:00');
    for (let i = -2; i <= 2; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i * 7);
      const { weekStart, weekEnd } = getWeekDates(d.toISOString().slice(0, 10));
      const ws = new Date(weekStart + 'T12:00:00');
      const we = new Date(weekEnd + 'T12:00:00');
      list.push({
        date: weekStart,
        label: `${ws.getDate()} ${ws.toLocaleDateString('ru-RU', { month: 'short' })} — ${we.getDate()} ${we.toLocaleDateString('ru-RU', { month: 'short' })}`,
        isCurrent: getWeekDates(selectedDate).weekStart === weekStart,
      });
    }
    return list;
  }, [selectedDate]);

  return (
    <>
      <div className="bg-white border-2 border-slate-300 rounded-2xl shadow-subtle overflow-hidden flex flex-col text-slate-800">
        <div className="flex flex-wrap border-b border-slate-300 bg-slate-100/80 px-3 py-2 items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-800">
              СУТОЧНЫЙ БАЛАНС И КОНТРОЛЬ КАССЫ
            </span>
          </div>

          <div className="flex bg-slate-200/80 p-0.5 rounded-xl border border-slate-300 max-w-xs w-full sm:w-auto">
            {(['day', 'week', 'month'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onChangePeriod(mode)}
                className={`flex-1 sm:px-4 py-1 rounded-lg text-xs uppercase tracking-wider transition cursor-pointer ${
                  period === mode
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-300/80 font-black'
                    : 'text-slate-600 hover:text-slate-900 font-bold'
                }`}
              >
                {mode === 'day' ? 'День' : mode === 'week' ? 'Неделя' : 'Месяц'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onOpenManualModal('expense')}
              className="inline-flex items-center gap-1 text-[11px] font-black bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 px-2.5 py-1 rounded-lg transition shadow-2xs cursor-pointer"
              title="Внести расход / списание вручную"
            >
              <span>−</span>
              <span>Списание</span>
            </button>
            <button
              onClick={() => onOpenManualModal('income')}
              className="inline-flex items-center gap-1 text-[11px] font-black bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-lg transition shadow-2xs cursor-pointer"
              title="Внести доход / пополнение вручную"
            >
              <span>+</span>
              <span>Пополнение</span>
            </button>

            {data?.audit?.status === 'confirmed' ? (
              <button
                onClick={onOpenAuditModal}
                className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg transition cursor-pointer"
                title="Нажмите для коррекции сейфа"
              >
                <span>✓ СЕЙФ: {rub(data.audit.safe_cash_actual)}</span>
                <span className="text-[10px] opacity-70">✏️</span>
              </button>
            ) : data?.audit?.status === 'discrepancy' ? (
              <button
                onClick={onOpenAuditModal}
                className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg transition cursor-pointer"
                title="Нажмите для устранения расхождения и коррекции сейфа"
              >
                <span>⚠️ РАСХОЖДЕНИЕ ({rub(data.audit.safe_discrepancy)})</span>
                <span className="text-[10px] underline font-black">Исправить ✏️</span>
              </button>
            ) : (
              <button
                onClick={onOpenAuditModal}
                className="text-[11px] font-black bg-amber-100 hover:bg-amber-200 text-amber-950 px-2.5 py-1 rounded-lg transition border border-amber-400 shadow-2xs cursor-pointer flex items-center gap-1"
              >
                <span>🔒 ПРОВЕРИТЬ СЕЙФ (19:30)</span>
              </button>
            )}

            <button
              onClick={onRefetch}
              disabled={isFetching}
              className="inline-flex items-center gap-1 text-[11px] text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 px-2.5 py-1 rounded-lg transition cursor-pointer border border-slate-300 disabled:opacity-50 shadow-2xs"
              title="Запросить свежую выписку из Т-Банка прямо сейчас"
            >
              <span className={`text-[10px] ${isFetching ? 'animate-spin inline-block' : ''}`}>
                🔄
              </span>
              <span>{isFetching ? 'Синхронизация...' : 'Обновить'}</span>
            </button>
            <span className="text-[10px] text-slate-600 font-mono bg-white px-2 py-0.5 rounded border border-slate-300">
              API: {bankWallet?.api_synced ? '🟢 Live' : '⚪ DB'}
            </span>
          </div>
        </div>

        <div className="flex items-stretch h-14 bg-white border-b border-slate-300">
          <button
            onClick={() => onShiftPeriod(-1)}
            className="w-28 sm:w-40 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 transition-colors text-white shrink-0 group border-r border-sky-600 flex items-center justify-center gap-1 cursor-pointer"
            title="Предыдущий период"
            aria-label="Предыдущий период"
          >
            <span className="text-3xl font-black group-hover:-translate-x-1.5 transition-transform select-none">
              ←
            </span>
            <span className="text-xs font-black uppercase tracking-tight hidden sm:inline">
              Назад
            </span>
          </button>

          <div
            className="flex-1 flex items-center justify-center gap-3 px-3 cursor-pointer hover:bg-slate-50 transition"
            onClick={() => onChangeDate(todayStr)}
            title="Нажмите, чтобы вернуться к сегодняшнему дню"
          >
            <span className="text-sky-600 text-xl font-bold">📅</span>
            <div className="flex items-center gap-2.5 flex-wrap justify-center">
              <span className="text-sm sm:text-base md:text-lg font-black tracking-tight text-slate-900 uppercase font-display">
                {formatPeriodHeader(selectedDate, period)}
              </span>
              {selectedDate === todayStr && period === 'day' && (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-300 font-mono">
                  СЕГОДНЯ
                </span>
              )}
              {selectedDate !== todayStr && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeDate(todayStr);
                  }}
                  className="text-[10px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 px-2 py-0.5 rounded-full border border-sky-200 transition cursor-pointer"
                >
                  → вернуться к сегодня
                </button>
              )}
            </div>
          </div>

          <button
            onClick={() => onShiftPeriod(1)}
            className="w-28 sm:w-40 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 transition-colors text-white shrink-0 group border-l border-sky-600 flex items-center justify-center gap-1 cursor-pointer"
            title="Следующий период"
            aria-label="Следующий период"
          >
            <span className="text-xs font-black uppercase tracking-tight hidden sm:inline">
              Вперёд
            </span>
            <span className="text-3xl font-black group-hover:translate-x-1.5 transition-transform select-none">
              →
            </span>
          </button>
        </div>

        {period !== 'week' ? (
          <div className="grid grid-cols-5 text-center text-xs font-bold divide-x divide-slate-300 bg-slate-100/70">
            {monthStrip.map((m) => (
              <button
                key={m.ym}
                onClick={() => {
                  const target = m.ym === todayStr.slice(0, 7) ? todayStr : `${m.ym}-01`;
                  onChangeDate(target);
                  onChangePeriod('month');
                }}
                className={`py-2 text-[11px] font-bold tracking-wider transition cursor-pointer ${
                  m.isCurrent
                    ? 'bg-white text-sky-800 font-black border-b-2 border-sky-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex overflow-x-auto text-xs font-bold divide-x divide-slate-300 bg-slate-100/70 scrollbar-none">
            {weekStrip.map((w) => (
              <button
                key={w.date}
                onClick={() => {
                  onChangeDate(w.date);
                  onChangePeriod('week');
                }}
                className={`flex-1 py-2 px-3 min-w-[130px] text-[11px] font-bold tracking-wide transition whitespace-nowrap text-center cursor-pointer ${
                  w.isCurrent
                    ? 'bg-white text-sky-800 font-black border-b-2 border-sky-600 shadow-2xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 bg-white p-2 rounded-xl border border-slate-300 shadow-2xs overflow-x-auto text-xs">
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider pl-1.5 pr-1">
          Кошелёк:
        </span>

        <button
          onClick={() => onChangeWallet('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
            activeWallet === 'all'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
          }`}
        >
          🌐 Все 3 кошелька
        </button>

        <button
          onClick={() => onChangeWallet('bank')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer border ${
            activeWallet === 'bank'
              ? 'bg-sky-500 text-white border-sky-600 shadow-2xs'
              : 'bg-white text-slate-700 hover:bg-sky-50 hover:text-sky-900 border-slate-300'
          }`}
        >
          <span>🏦</span>
          <span>Р/С БАНК</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
              activeWallet === 'bank'
                ? 'bg-sky-700 text-white'
                : 'bg-sky-50 text-sky-800 border border-sky-100'
            }`}
          >
            {rub(bankWallet?.evening ?? 0)}
          </span>
        </button>

        <button
          onClick={() => onChangeWallet('cash')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer border ${
            activeWallet === 'cash'
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
              : 'bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 border-slate-300'
          }`}
        >
          <span>🔒</span>
          <span>СЕЙФ (НАЛ)</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
              activeWallet === 'cash'
                ? 'bg-emerald-800 text-white'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
            }`}
          >
            {rub(cashWallet?.evening ?? 0)}
          </span>
        </button>

        <button
          onClick={() => onChangeWallet('fuel_card')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer border ${
            activeWallet === 'fuel_card'
              ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
              : 'bg-white text-slate-700 hover:bg-amber-50 hover:text-amber-900 border-slate-300'
          }`}
        >
          <span>⛽</span>
          <span>ТОПЛИВНАЯ КАРТА</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
              activeWallet === 'fuel_card'
                ? 'bg-amber-700 text-white'
                : 'bg-amber-50 text-amber-800 border border-amber-100'
            }`}
          >
            {rub(Math.max(0, fuelWallet?.evening ?? 0))}
          </span>
        </button>
      </div>

      {activeWallet !== 'all' && (
        <div
          className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
            activeWallet === 'bank'
              ? 'bg-sky-50 border-sky-300 text-sky-900'
              : activeWallet === 'cash'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">
              {activeWallet === 'bank' ? '🏦' : activeWallet === 'cash' ? '🔒' : '⛽'}
            </span>
            <span>
              АКТИВНЫЙ ФИЛЬТР:{' '}
              <strong className="uppercase">
                {activeWallet === 'bank'
                  ? 'Расчётный счёт банка'
                  : activeWallet === 'cash'
                    ? 'Сейф (Наличные)'
                    : 'Топливная карта (ГСМ)'}
              </strong>{' '}
              — таблица ниже показывает движение только по этой статье.
            </span>
          </div>
          <button
            onClick={() => onChangeWallet('all')}
            className="text-[10px] underline hover:no-underline font-extrabold cursor-pointer"
          >
            Сбросить (Показать все) ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-white rounded-xl p-3 border-2 border-slate-300 shadow-2xs relative overflow-hidden">
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
            {activeWallet === 'all'
              ? `ОСТАТОК НА НАЧАЛО ${period === 'day' ? '(00:00)' : period === 'week' ? 'НЕДЕЛИ' : 'МЕСЯЦА'}`
              : `НАЧАЛЬНЫЙ ОСТАТОК ${period === 'day' ? '(00:00)' : period === 'week' ? 'НЕДЕЛИ' : 'МЕСЯЦА'}`}
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-slate-900 mt-0.5 leading-tight">
            {rub(morningTotal)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {activeWallet === 'all' ? 'Банк + Сейф + Топливо' : 'По выбранной статье'}
          </div>
        </div>

        <div className="bg-rose-50/50 rounded-xl p-3 border-2 border-rose-300 shadow-2xs relative overflow-hidden">
          <div className="text-[9px] font-black uppercase tracking-wider text-rose-700">
            РАСХОДЫ ЗА {period === 'day' ? 'ДЕНЬ' : period === 'week' ? 'НЕДЕЛЮ' : 'МЕСЯЦ'}
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-rose-600 mt-0.5 leading-tight">
            -{rub(totalDayExpenses)}
          </div>
          <div className="text-[10px] text-rose-700/80 mt-0.5">
            {expensesCount} позиций расходов
          </div>
        </div>

        <div className="bg-emerald-50/50 rounded-xl p-3 border-2 border-emerald-300 shadow-2xs relative overflow-hidden">
          <div className="text-[9px] font-black uppercase tracking-wider text-emerald-800">
            ДОХОДЫ ЗА {period === 'day' ? 'ДЕНЬ' : period === 'week' ? 'НЕДЕЛЮ' : 'МЕСЯЦ'}
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-emerald-700 mt-0.5 leading-tight">
            +{rub(totalDayIncomes)}
          </div>
          <div className="text-[10px] text-emerald-700/80 mt-0.5">{incomesCount} поступлений</div>
        </div>

        <div className="bg-sky-50/50 rounded-xl p-3 border-2 border-sky-300 shadow-2xs relative overflow-hidden">
          <div className="text-[9px] font-black uppercase tracking-wider text-sky-800">
            {activeWallet === 'all'
              ? `ИТОГО В КОНЦЕ ${period === 'day' ? 'ДНЯ' : period === 'week' ? 'НЕДЕЛИ' : 'МЕСЯЦА'}`
              : `КОНЕЧНЫЙ ИТОГ ${period === 'day' ? 'ДНЯ' : period === 'week' ? 'НЕДЕЛИ' : 'МЕСЯЦА'}`}
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-slate-900 mt-0.5 leading-tight">
            {rub(eveningTotal)}
          </div>
          <div className="text-[10px] text-sky-700 font-bold font-mono mt-0.5">
            Дельта: {deltaTotal >= 0 ? `+${rub(deltaTotal)}` : rub(deltaTotal)}
          </div>
        </div>
      </div>
    </>
  );
}
