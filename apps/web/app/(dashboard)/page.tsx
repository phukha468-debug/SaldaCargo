'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { Money } from '@saldacargo/ui';
import { cn } from '@saldacargo/ui';

type WalletKey = 'bank' | 'cash';
type Period = 'day' | 'week' | 'month';

type WalletHistoryItem = {
  id: string;
  date: string;
  description: string;
  amount: string;
  direction: 'in' | 'out';
  source: 'trip_order' | 'transaction' | 'cash_collection';
  category: string | null;
  counterparty: string | null;
  trip_number: number | null;
};

type Wallets = {
  bank: { name: string; balance: string };
  cash: { name: string; balance: string };
  card?: { name: string; balance: string };
  fuel_card?: { name: string; balance: string };
};

type Summary = {
  today: { revenue: string; tripsCount: number };
  alerts: { tripsForReview: number };
};

type AnalyticsResponse = {
  period: Period;
  periodLabel: string;
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netSaldo: number;
    marginPct: number;
  };
  reviewStats: {
    tripsCount: number;
    revenue: number;
    payroll: number;
    fuel: number;
    otherExpenses: number;
    profit: number;
    vehicles: Array<{
      id: string;
      name: string;
      reg_number: string;
      trip_numbers: number[];
      revenue: number;
      costs: number;
      profit: number;
    }>;
  };
  incomeBreakdown: Array<{
    id: string;
    label: string;
    amount: number;
    pct: number;
    count: number;
    color: string;
  }>;
  expenseBreakdown: Array<{
    id: string;
    label: string;
    amount: number;
    pct: number;
    color: string;
  }>;
};

export default function DashboardHome() {
  const [saldoPeriod, setSaldoPeriod] = useState<Period>('month');
  const [incPeriod, setIncPeriod] = useState<Period>('month');
  const [expPeriod, setExpPeriod] = useState<Period>('month');
  const [revPeriod, setRevPeriod] = useState<Period>('month');

  const [incomeExpanded, setIncomeExpanded] = useState(true);
  const [expenseExpanded, setExpenseExpanded] = useState(true);

  const [drawerWallet, setDrawerWallet] = useState<WalletKey | null>(null);

  // 1. Wallets
  const { data: wallets } = useQuery<Wallets>({
    queryKey: ['wallets'],
    queryFn: () => fetch('/api/wallets').then((r) => r.json()),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // 2. Summary (Alerts)
  const { data: summary } = useQuery<Summary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => fetch('/api/dashboard/summary').then((r) => r.json()),
    staleTime: 30000,
  });

  // 3. Analytics for Saldo Period
  const { data: saldoAnalytics } = useQuery<AnalyticsResponse>({
    queryKey: ['dashboard-analytics', saldoPeriod],
    queryFn: () => fetch(`/api/dashboard/analytics?period=${saldoPeriod}`).then((r) => r.json()),
    staleTime: 5000,
    refetchInterval: 30000,
  });

  // 4. Analytics for Income Period
  const { data: incAnalytics } = useQuery<AnalyticsResponse>({
    queryKey: ['dashboard-analytics', incPeriod],
    queryFn: () => fetch(`/api/dashboard/analytics?period=${incPeriod}`).then((r) => r.json()),
    staleTime: 5000,
    refetchInterval: 30000,
  });

  // 5. Analytics for Expense Period
  const { data: expAnalytics } = useQuery<AnalyticsResponse>({
    queryKey: ['dashboard-analytics', expPeriod],
    queryFn: () => fetch(`/api/dashboard/analytics?period=${expPeriod}`).then((r) => r.json()),
    staleTime: 5000,
    refetchInterval: 30000,
  });

  // 6. Analytics for Review Stats Period
  const { data: revAnalytics } = useQuery<AnalyticsResponse>({
    queryKey: ['dashboard-analytics', revPeriod],
    queryFn: () => fetch(`/api/dashboard/analytics?period=${revPeriod}`).then((r) => r.json()),
    staleTime: 5000,
    refetchInterval: 30000,
  });

  // Liquid Balances
  const bankNum = parseFloat(wallets?.bank?.balance ?? '0');
  const cashNum = parseFloat(wallets?.cash?.balance ?? '0');
  const cardNum = parseFloat(wallets?.card?.balance ?? '0');
  const fuelNum = parseFloat(wallets?.fuel_card?.balance ?? '0');
  const totalLiquid = bankNum + cashNum + cardNum + fuelNum;

  const tripsForReview = summary?.alerts?.tripsForReview ?? 0;

  // Saldo figures
  const netSaldo = saldoAnalytics?.summary?.netSaldo ?? 0;
  const saldoIncome = saldoAnalytics?.summary?.totalIncome ?? 0;
  const saldoExpense = saldoAnalytics?.summary?.totalExpenses ?? 0;
  const marginPct = saldoAnalytics?.summary?.marginPct ?? 0;

  // Income figures
  const totalInc = incAnalytics?.summary?.totalIncome ?? 0;
  const incomeItems = incAnalytics?.incomeBreakdown ?? [];

  // Expense figures
  const totalExp = expAnalytics?.summary?.totalExpenses ?? 0;
  const expenseItems = expAnalytics?.expenseBreakdown ?? [];

  // Review Stats
  const reviewStats = revAnalytics?.reviewStats;

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1: БАЛАНСОВОЕ ЗНАЧЕНИЕ И СУММАРНОЕ САЛЬДО (3 HERO CARDS)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1.1 Liquid Balance Card */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">
              <span>Ликвидный Баланс</span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold">
                Активен
              </span>
            </div>
            <div className="text-3xl font-black text-white tracking-tight">
              {totalLiquid.toLocaleString('ru-RU')} ₽
            </div>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Общий остаток денежных средств компании
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-700/60 grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => setDrawerWallet('bank')}
              className="bg-slate-800/80 hover:bg-slate-700/80 p-2.5 rounded-xl border border-slate-700/50 text-left transition-colors cursor-pointer"
            >
              <span className="text-[10px] text-slate-400 uppercase font-bold block">
                Расчётный счёт
              </span>
              <span className="text-sm font-extrabold text-sky-400">
                {bankNum.toLocaleString('ru-RU')} ₽
              </span>
            </button>
            <button
              onClick={() => setDrawerWallet('cash')}
              className="bg-slate-800/80 hover:bg-slate-700/80 p-2.5 rounded-xl border border-slate-700/50 text-left transition-colors cursor-pointer"
            >
              <span className="text-[10px] text-slate-400 uppercase font-bold block">
                Касса (наличные)
              </span>
              <span className="text-sm font-extrabold text-emerald-400">
                {cashNum.toLocaleString('ru-RU')} ₽
              </span>
            </button>
          </div>
        </div>

        {/* 1.2 Net Cashflow / Сальдо Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Чистое Сальдо Периода
              </span>
              <div className="inline-flex bg-slate-100 p-1 rounded-lg gap-1 text-[11px] font-bold">
                <button
                  onClick={() => setSaldoPeriod('day')}
                  className={cn(
                    'px-2 py-0.5 rounded-md transition-all cursor-pointer',
                    saldoPeriod === 'day'
                      ? 'bg-white shadow-xs text-slate-900 font-extrabold'
                      : 'text-slate-500 hover:text-slate-900',
                  )}
                >
                  День
                </button>
                <button
                  onClick={() => setSaldoPeriod('week')}
                  className={cn(
                    'px-2 py-0.5 rounded-md transition-all cursor-pointer',
                    saldoPeriod === 'week'
                      ? 'bg-white shadow-xs text-slate-900 font-extrabold'
                      : 'text-slate-500 hover:text-slate-900',
                  )}
                >
                  Неделя
                </button>
                <button
                  onClick={() => setSaldoPeriod('month')}
                  className={cn(
                    'px-2 py-0.5 rounded-md transition-all cursor-pointer',
                    saldoPeriod === 'month'
                      ? 'bg-white shadow-xs text-slate-900 font-extrabold'
                      : 'text-slate-500 hover:text-slate-900',
                  )}
                >
                  Месяц
                </button>
              </div>
            </div>

            <div
              className={cn(
                'text-3xl font-black tracking-tight',
                netSaldo >= 0 ? 'text-emerald-600' : 'text-rose-600',
              )}
            >
              {netSaldo >= 0 ? '+' : ''}
              {Math.round(netSaldo).toLocaleString('ru-RU')} ₽
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Доходы ({Math.round(saldoIncome).toLocaleString('ru-RU')} ₽) − Расходы (
              {Math.round(saldoExpense).toLocaleString('ru-RU')} ₽)
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Операционная рентабельность:</span>
            <span
              className={cn(
                'font-extrabold px-2 py-0.5 rounded-md',
                marginPct >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50',
              )}
            >
              {marginPct}%
            </span>
          </div>
        </div>

        {/* 1.3 Quick Action / Status Alert */}
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider mb-1">
              <span className="material-symbols-outlined text-[18px] text-amber-600">
                notifications_active
              </span>
              <span>Требует внимания</span>
            </div>
            <div className="text-lg font-extrabold text-slate-900 leading-snug">
              {tripsForReview > 0
                ? `${tripsForReview} рейса ожидают вашего ревью`
                : 'Все рейсы проверены'}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              {tripsForReview > 0
                ? 'Проверьте путевые листы и подтвердите начисления водителей.'
                : 'Нет нерассмотренных рейсов на текущий момент.'}
            </p>
          </div>

          <div className="mt-4">
            <Link
              href="/review"
              className="inline-flex items-center justify-center gap-2 w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs"
            >
              <span>Перейти в раздел Ревью</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2: ИНТЕГРИРОВАННЫЕ ДОХОДЫ И РАСХОДЫ С РАСШИФРОВКОЙ
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 2.1 ДОХОДЫ (INCOME) CARD */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined">trending_up</span>
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Общие Доходы</h2>
                  <p className="text-xs text-slate-400 font-medium">
                    Поступления от рейсов и услуг СТО
                  </p>
                </div>
              </div>

              {/* Period Switcher */}
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setIncPeriod('day')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg transition-all cursor-pointer',
                    incPeriod === 'day'
                      ? 'bg-white shadow-xs text-emerald-700 font-black'
                      : 'text-slate-500 hover:text-slate-900',
                  )}
                >
                  День
                </button>
                <button
                  onClick={() => setIncPeriod('week')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg transition-all cursor-pointer',
                    incPeriod === 'week'
                      ? 'bg-white shadow-xs text-emerald-700 font-black'
                      : 'text-slate-500 hover:text-slate-900',
                  )}
                >
                  Неделя
                </button>
                <button
                  onClick={() => setIncPeriod('month')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg transition-all cursor-pointer',
                    incPeriod === 'month'
                      ? 'bg-white shadow-xs text-emerald-700 font-black'
                      : 'text-slate-500 hover:text-slate-900',
                  )}
                >
                  Месяц
                </button>
              </div>
            </div>

            {/* Amount Display */}
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Сумма за период
                </div>
                <div className="text-3xl font-black text-emerald-600 tracking-tight">
                  {Math.round(totalInc).toLocaleString('ru-RU')} ₽
                </div>
              </div>
              <button
                onClick={() => setIncomeExpanded(!incomeExpanded)}
                className="flex items-center gap-1 text-xs font-extrabold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-all border border-emerald-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">list_alt</span>
                <span>Расшифровка доходов</span>
                <span
                  className={cn(
                    'material-symbols-outlined text-[16px] transition-transform',
                    incomeExpanded && 'rotate-180',
                  )}
                >
                  expand_more
                </span>
              </button>
            </div>

            {/* Interactive Popover Breakdown */}
            {incomeExpanded && (
              <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3 animate-in fade-in duration-150">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-2 flex justify-between">
                  <span>Источник поступления</span>
                  <span>Сумма / Доля</span>
                </div>

                <div className="space-y-2.5 text-xs">
                  {incomeItems.length === 0 && (
                    <div className="text-slate-400 text-center py-2">
                      Нет поступлений за выбранный период
                    </div>
                  )}

                  {incomeItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-2.5 h-2.5 rounded-full', item.color)} />
                        <span className="font-semibold text-slate-700">{item.label}</span>
                      </div>
                      <span className="font-bold text-slate-900">
                        {Math.round(item.amount).toLocaleString('ru-RU')} ₽ ({item.pct}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2.2 РАСХОДЫ (EXPENSES) CARD */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-rose-100 text-rose-700 rounded-xl flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined">trending_down</span>
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Общие Расходы</h2>
                  <p className="text-xs text-slate-400 font-medium">
                    Затраты на ГСМ, ЗП, запчасти и налоги
                  </p>
                </div>
              </div>

              {/* Period Switcher */}
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setExpPeriod('day')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg transition-all cursor-pointer',
                    expPeriod === 'day'
                      ? 'bg-white shadow-xs text-rose-700 font-black'
                      : 'text-slate-500 hover:text-slate-900',
                  )}
                >
                  День
                </button>
                <button
                  onClick={() => setExpPeriod('week')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg transition-all cursor-pointer',
                    expPeriod === 'week'
                      ? 'bg-white shadow-xs text-rose-700 font-black'
                      : 'text-slate-500 hover:text-slate-900',
                  )}
                >
                  Неделя
                </button>
                <button
                  onClick={() => setExpPeriod('month')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg transition-all cursor-pointer',
                    expPeriod === 'month'
                      ? 'bg-white shadow-xs text-rose-700 font-black'
                      : 'text-slate-500 hover:text-slate-900',
                  )}
                >
                  Месяц
                </button>
              </div>
            </div>

            {/* Amount Display */}
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Сумма за период
                </div>
                <div className="text-3xl font-black text-rose-600 tracking-tight">
                  {Math.round(totalExp).toLocaleString('ru-RU')} ₽
                </div>
              </div>
              <button
                onClick={() => setExpenseExpanded(!expenseExpanded)}
                className="flex items-center gap-1 text-xs font-extrabold text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl transition-all border border-rose-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">pie_chart</span>
                <span>Расшифровка расходов</span>
                <span
                  className={cn(
                    'material-symbols-outlined text-[16px] transition-transform',
                    expenseExpanded && 'rotate-180',
                  )}
                >
                  expand_more
                </span>
              </button>
            </div>

            {/* Interactive Popover Breakdown */}
            {expenseExpanded && (
              <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3 animate-in fade-in duration-150">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-2 flex justify-between">
                  <span>Категория затрат</span>
                  <span>Сумма / Доля</span>
                </div>

                <div className="space-y-2.5 text-xs">
                  {expenseItems.length === 0 && (
                    <div className="text-slate-400 text-center py-2">
                      Нет расходов за выбранный период
                    </div>
                  )}

                  {expenseItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-2.5 h-2.5 rounded-full', item.color)} />
                        <span className="font-semibold text-slate-700">{item.label}</span>
                      </div>
                      <span className="font-bold text-slate-900">
                        {Math.round(item.amount).toLocaleString('ru-RU')} ₽ ({item.pct}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3: ИНФОРМАЦИЯ ИЗ РАЗДЕЛА "РЕВЬЮ" (СТАТИСТИКА РЕЙСОВ И АВТО)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sky-600 text-[24px]">analytics</span>
              <h2 className="text-lg font-black text-slate-900">
                Сводная Аналитика из Раздела «Ревью»
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Полная статистика рейсов, маржинальности, зарплат и расхода топлива
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-semibold">Фильтр периода:</span>
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setRevPeriod('day')}
                className={cn(
                  'px-3 py-1 rounded-lg transition-all cursor-pointer',
                  revPeriod === 'day'
                    ? 'bg-white shadow-xs text-sky-700 font-black'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                День
              </button>
              <button
                onClick={() => setRevPeriod('week')}
                className={cn(
                  'px-3 py-1 rounded-lg transition-all cursor-pointer',
                  revPeriod === 'week'
                    ? 'bg-white shadow-xs text-sky-700 font-black'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                Неделя
              </button>
              <button
                onClick={() => setRevPeriod('month')}
                className={cn(
                  'px-3 py-1 rounded-lg transition-all cursor-pointer',
                  revPeriod === 'month'
                    ? 'bg-white shadow-xs text-sky-700 font-black'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                Месяц
              </button>
            </div>
          </div>
        </div>

        {/* 5 KPI Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Выполнено рейсов
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {reviewStats?.tripsCount ?? 0} рейсов
            </div>
            <span className="text-[11px] text-sky-600 font-bold">100% зафиксировано</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Выручка с рейсов
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {Math.round(reviewStats?.revenue ?? 0).toLocaleString('ru-RU')} ₽
            </div>
            <span className="text-[11px] text-emerald-600 font-bold">
              Ср. чек:{' '}
              {reviewStats?.tripsCount
                ? Math.round((reviewStats.revenue / reviewStats.tripsCount) * 10) / 10000 + 'k ₽'
                : '0 ₽'}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              ЗП (Водители + Грузчики)
            </span>
            <div className="text-2xl font-black text-amber-600 mt-1">
              {Math.round(reviewStats?.payroll ?? 0).toLocaleString('ru-RU')} ₽
            </div>
            <span className="text-[11px] text-amber-700 font-bold">
              {reviewStats?.revenue
                ? Math.round((reviewStats.payroll / reviewStats.revenue) * 100)
                : 0}
              % от выручки
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Топливо / ГСМ
            </span>
            <div className="text-2xl font-black text-rose-600 mt-1">
              {Math.round(reviewStats?.fuel ?? 0).toLocaleString('ru-RU')} ₽
            </div>
            <span className="text-[11px] text-rose-700 font-bold">Фактический расход</span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 block">
              Чистая прибыль рейсов
            </span>
            <div className="text-2xl font-black text-emerald-700 mt-1">
              {Math.round(reviewStats?.profit ?? 0).toLocaleString('ru-RU')} ₽
            </div>
            <span className="text-[11px] text-emerald-800 font-bold">
              Рентабельность:{' '}
              {reviewStats?.revenue
                ? Math.round((reviewStats.profit / reviewStats.revenue) * 100)
                : 0}
              %
            </span>
          </div>
        </div>

        {/* Vehicle Activity with Trip Numbers */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Активность автопарка и номера рейсов за период
            </h3>
            <span className="text-xs text-slate-400">
              Нажмите на номер рейса для перехода в Ревью
            </span>
          </div>

          <div className="space-y-2.5">
            {(!reviewStats?.vehicles || reviewStats.vehicles.length === 0) && (
              <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                Нет рейсов за выбранный период
              </div>
            )}

            {reviewStats?.vehicles?.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-sky-100 text-sky-700 rounded-lg flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[20px]">local_shipping</span>
                  </div>
                  <div>
                    <div className="font-extrabold text-sm text-slate-900">
                      {v.name} {v.reg_number ? `(${v.reg_number})` : ''}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-slate-700">
                        {v.trip_numbers.length} рейсов:
                      </span>
                      <div className="inline-flex gap-1 flex-wrap">
                        {v.trip_numbers.map((tn) => (
                          <Link
                            key={tn}
                            href="/review"
                            className="bg-sky-100 hover:bg-sky-500 hover:text-white border border-sky-200 text-sky-800 font-bold px-2 py-0.5 rounded text-[11px] transition-colors"
                          >
                            #{tn}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-xs text-right">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Выручка
                    </span>
                    <span className="font-black text-slate-900 text-sm">
                      {Math.round(v.revenue).toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      ЗП + ГСМ
                    </span>
                    <span className="font-extrabold text-slate-600 text-sm">
                      {Math.round(v.costs).toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Прибыль
                    </span>
                    <span className="font-black text-emerald-600 text-sm">
                      {Math.round(v.profit).toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Wallet Management Modal Drawer ──────────────────────────────── */}
      {drawerWallet && (
        <WalletDrawer
          wallet={drawerWallet}
          onClose={() => setDrawerWallet(null)}
          wallets={wallets}
        />
      )}
    </div>
  );
}

/* ── Wallet Management Modal ─────────────────────────────────────────────── */
const WALLET_LABELS: Record<WalletKey, { name: string; sub: string; color: string }> = {
  bank: { name: 'Банк', sub: 'Расчётный счёт', color: '#3b82f6' },
  cash: { name: 'Касса', sub: 'Наличные', color: '#10b981' },
};
const OTHER_WALLETS: Record<WalletKey, { key: WalletKey; label: string }[]> = {
  bank: [{ key: 'cash', label: 'Касса' }],
  cash: [{ key: 'bank', label: 'Банк' }],
};

function getPeriodRange(
  period: Period,
  offset: number,
): { from: string; to: string; label: string } {
  const now = new Date();
  if (period === 'day') {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    const iso = d.toISOString().slice(0, 10);
    return {
      from: iso,
      to: iso,
      label: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' }),
    };
  }
  if (period === 'week') {
    const mon = new Date(now);
    const dow = mon.getDay();
    mon.setDate(mon.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7);
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    return {
      from: mon.toISOString().slice(0, 10),
      to: sun.toISOString().slice(0, 10),
      label: `${mon.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — ${sun.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`,
    };
  }
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    from: d.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
    label: d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
  };
}

const EDIT_PASSWORD = '9111';

function WalletDrawer({
  wallet,
  onClose,
  wallets,
}: {
  wallet: WalletKey;
  onClose: () => void;
  wallets: { bank: { balance: string }; cash: { balance: string } } | undefined;
}) {
  const [period, setPeriod] = useState<Period>('day');
  const [offset, setOffset] = useState(0);
  const [transferItem, setTransferItem] = useState<WalletHistoryItem | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [editMode, setEditMode] = useState<'idle' | 'password' | 'amount'>('idle');
  const [pwdInput, setPwdInput] = useState('');
  const [pwdError, setPwdError] = useState(false);
  const [newBalance, setNewBalance] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const qc = useQueryClient();

  const meta = WALLET_LABELS[wallet];
  const balance = wallets?.[wallet]?.balance ?? '0';
  const range = getPeriodRange(period, offset);

  const changePeriod = (p: Period) => {
    setPeriod(p);
    setOffset(0);
  };

  const { data, isLoading } = useQuery<{ items: WalletHistoryItem[] }>({
    queryKey: ['wallet-history', wallet, range.from, range.to],
    queryFn: () =>
      fetch(`/api/wallets/history?wallet=${wallet}&from=${range.from}&to=${range.to}`).then((r) =>
        r.json(),
      ),
    staleTime: 30000,
  });

  const items = data?.items ?? [];

  const inTotal = items
    .filter((i) => i.direction === 'in' && i.description !== 'Корректировка остатка')
    .reduce((s, i) => s + parseFloat(i.amount), 0);
  const outTotal = items
    .filter((i) => i.direction === 'out' && i.description !== 'Корректировка остатка')
    .reduce((s, i) => s + parseFloat(i.amount), 0);

  const doTransfer = async (targetWallet: WalletKey) => {
    if (!transferItem) return;
    setTransferring(true);
    await fetch('/api/wallets/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: transferItem.id,
        source: transferItem.source,
        direction: transferItem.direction,
        target_wallet: targetWallet,
      }),
    });
    setTransferring(false);
    setTransferItem(null);
    qc.invalidateQueries({ queryKey: ['wallet-history'] });
    qc.invalidateQueries({ queryKey: ['wallets'] });
  };

  const submitPassword = () => {
    if (pwdInput === EDIT_PASSWORD) {
      setPwdError(false);
      setPwdInput('');
      setNewBalance(parseFloat(balance).toFixed(0));
      setEditMode('amount');
    } else {
      setPwdError(true);
    }
  };

  const submitBalance = async () => {
    const val = parseFloat(newBalance.replace(',', '.'));
    if (isNaN(val) || val < 0) {
      setSaveError('Введите корректную сумму');
      return;
    }
    setSaving(true);
    setSaveError(null);
    const res = await fetch('/api/wallets/set-balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, target_amount: val.toFixed(2) }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setSaveError(json.error ?? 'Ошибка');
      return;
    }
    setEditMode('idle');
    setNewBalance('');
    qc.invalidateQueries({ queryKey: ['wallets'] });
    qc.invalidateQueries({ queryKey: ['wallet-history'] });
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 text-white flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${meta.color}cc 0%, ${meta.color} 100%)` }}
        >
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-75">
              {meta.sub}
            </div>
            <div className="text-[20px] font-black leading-tight">{meta.name}</div>
            {editMode === 'idle' && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[15px] font-bold opacity-90">
                  <Money amount={balance} />
                </span>
                <button
                  onClick={() => {
                    setEditMode('password');
                    setPwdInput('');
                    setPwdError(false);
                  }}
                  className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/20 hover:bg-white/35 transition-colors cursor-pointer"
                >
                  Изменить остаток
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/35 flex items-center justify-center transition-colors text-white cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Edit balance inline form */}
        {editMode === 'password' && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
            <span className="text-xs font-medium text-amber-800">Пароль:</span>
            <input
              type="password"
              value={pwdInput}
              onChange={(e) => setPwdInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitPassword()}
              autoFocus
              className="px-2 py-1 text-xs border rounded bg-white w-28 focus:outline-none focus:ring-1 focus:ring-amber-500"
              placeholder="••••"
            />
            <button
              onClick={submitPassword}
              className="px-2.5 py-1 text-xs font-bold bg-amber-600 text-white rounded hover:bg-amber-700 cursor-pointer"
            >
              OK
            </button>
            <button
              onClick={() => setEditMode('idle')}
              className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Отмена
            </button>
            {pwdError && (
              <span className="text-xs text-rose-600 font-bold ml-2">Неверный пароль</span>
            )}
          </div>
        )}

        {editMode === 'amount' && (
          <div className="px-6 py-3 bg-blue-50 border-b border-blue-200 flex items-center gap-2">
            <span className="text-xs font-medium text-blue-800">Новый остаток (₽):</span>
            <input
              type="number"
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitBalance()}
              autoFocus
              className="px-2 py-1 text-xs border rounded bg-white w-36 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={submitBalance}
              disabled={saving}
              className="px-2.5 py-1 text-xs font-bold bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {saving ? '...' : 'Сохранить'}
            </button>
            <button
              onClick={() => setEditMode('idle')}
              className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Отмена
            </button>
            {saveError && <span className="text-xs text-rose-600 font-bold ml-2">{saveError}</span>}
          </div>
        )}

        {/* History Period Tabs */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
            {(['day', 'week', 'month'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => changePeriod(p)}
                className={cn(
                  'px-3 py-1 rounded-lg font-bold transition-all cursor-pointer',
                  period === p
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800',
                )}
              >
                {p === 'day' ? 'День' : p === 'week' ? 'Неделя' : 'Месяц'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <button
              onClick={() => setOffset((o) => o - 1)}
              className="p-1 rounded hover:bg-slate-200 cursor-pointer"
            >
              ◀
            </button>
            <span>{range.label}</span>
            <button
              onClick={() => setOffset((o) => o + 1)}
              className="p-1 rounded hover:bg-slate-200 cursor-pointer"
            >
              ▶
            </button>
          </div>
        </div>

        {/* History List */}
        <div className="overflow-y-auto flex-1 p-6 space-y-2">
          {isLoading && <div className="text-center text-xs text-slate-400 py-8">Загрузка...</div>}
          {!isLoading && items.length === 0 && (
            <div className="text-center text-xs text-slate-400 py-8">Нет операций за период</div>
          )}

          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors text-xs"
            >
              <div className="flex-1 min-w-0 pr-3">
                <div className="font-semibold text-slate-800 truncate">{item.description}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {item.date} {item.counterparty ? `· ${item.counterparty}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'font-bold text-sm',
                    item.direction === 'in' ? 'text-emerald-600' : 'text-rose-600',
                  )}
                >
                  {item.direction === 'in' ? '+' : '-'}
                  {parseFloat(item.amount).toLocaleString('ru-RU')} ₽
                </span>

                {OTHER_WALLETS[wallet]?.map((ow) => (
                  <button
                    key={ow.key}
                    onClick={() => {
                      setTransferItem(item);
                      doTransfer(ow.key);
                    }}
                    disabled={transferring}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors cursor-pointer"
                    title={`Перевести в ${ow.label}`}
                  >
                    В {ow.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* History Summary Footer */}
        <div className="border-t border-slate-100 px-6 py-3 bg-slate-50 flex items-center justify-between text-xs font-bold">
          <span className="text-emerald-600">Приход: +{inTotal.toLocaleString('ru-RU')} ₽</span>
          <span className="text-rose-600">Расход: -{outTotal.toLocaleString('ru-RU')} ₽</span>
        </div>
      </div>
    </div>
  );
}
