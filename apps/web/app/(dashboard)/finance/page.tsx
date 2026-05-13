'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Money } from '@saldacargo/ui';
import { formatDate } from '@saldacargo/shared';

type PnlMonth = {
  label: string;
  revenue: string;
  expenses: string;
  profit: string;
};

type Transaction = {
  id: string;
  amount: string;
  direction: 'income' | 'expense';
  description: string | null;
  created_at: string;
  lifecycle_status: string;
  category: { name: string; code: string } | null;
};

type DriverBalance = {
  driver_id: string;
  driver_name: string;
  balance: string;
};

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function formatNavDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
}

function formatNavMonth(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

export default function FinancePage() {
  const [directionFilter, setDirectionFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const isToday = selectedDate === todayStr();

  const goMonth = (n: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setMonth(d.getMonth() + n);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // P&L — без зависимости от даты
  const { data: pnlData, isLoading: pnlLoading } = useQuery<{
    pnl: PnlMonth[];
    transactions: Transaction[];
  }>({
    queryKey: ['finance-pnl'],
    queryFn: () => fetch('/api/finance').then((r) => r.json()),
    staleTime: 60000,
  });

  // Журнал — зависит от выбранной даты
  const { data: journalData, isLoading: journalLoading } = useQuery<{
    pnl: PnlMonth[];
    transactions: Transaction[];
  }>({
    queryKey: ['finance-journal', selectedDate, directionFilter],
    queryFn: () => {
      const params = new URLSearchParams({ date: selectedDate });
      if (directionFilter !== 'all') params.set('direction', directionFilter);
      return fetch(`/api/finance?${params}`).then((r) => r.json());
    },
    staleTime: 15000,
  });

  const { data: balances = [] } = useQuery<DriverBalance[]>({
    queryKey: ['cash-balances'],
    queryFn: () => fetch('/api/admin/cash-collections').then((r) => r.json()),
    staleTime: 30000,
  });

  const pnl = pnlData?.pnl ?? [];
  const transactions = journalData?.transactions ?? [];
  const isLoading = pnlLoading;
  const journalLoading2 = journalLoading;

  const maxRevenue = Math.max(...pnl.map((m) => parseFloat(m.revenue)), 1);

  const driversWithCash = balances.filter((d) => parseFloat(d.balance) > 0);

  // Итого за день
  const dayIncome = transactions
    .filter((t) => t.direction === 'income')
    .reduce((s, t) => s + parseFloat(t.amount), 0);
  const dayExpense = transactions
    .filter((t) => t.direction === 'expense')
    .reduce((s, t) => s + parseFloat(t.amount), 0);

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto animate-in fade-in duration-500">
      <h1 className="text-2xl font-bold text-slate-900">Финансы</h1>

      {/* Навигация по разделам */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <a
          href="/receivables"
          className="group flex items-center gap-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-amber-300 hover:shadow-md transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-2xl shrink-0 group-hover:bg-amber-100 transition-colors">
            📋
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">Дебиторка</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Долги контрагентов, просрочка, отметить оплаченным
            </p>
          </div>
          <svg
            className="ml-auto w-4 h-4 text-slate-300 group-hover:text-amber-400 transition-colors shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </a>
        <a
          href="/loans"
          className="group flex items-center gap-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl shrink-0 group-hover:bg-blue-100 transition-colors">
            🏦
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">Кредиты и лизинг</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Обязательства компании, остатки, платёжный календарь
            </p>
          </div>
          <svg
            className="ml-auto w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </a>
        <a
          href="/payables"
          className="group flex items-center gap-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-rose-300 hover:shadow-md transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-2xl shrink-0 group-hover:bg-rose-100 transition-colors">
            🧾
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">Долги поставщикам</p>
            <p className="text-xs text-slate-500 mt-0.5">Кредиторка: Опти24, Новиков, Ромашин</p>
          </div>
          <svg
            className="ml-auto w-4 h-4 text-slate-300 group-hover:text-rose-400 transition-colors shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      {/* P&L по месяцам */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/80">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-widest">
            P&L — последние 6 месяцев
          </h2>
        </div>

        {isLoading ? (
          <div className="p-6 animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-slate-100 rounded" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest w-32">
                    Показатель
                  </th>
                  {pnl.map((m) => (
                    <th
                      key={m.label}
                      className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right"
                    >
                      {m.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <tr className="hover:bg-slate-50/50">
                  <td className="px-6 py-3 text-xs font-semibold text-slate-600 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    Выручка
                  </td>
                  {pnl.map((m) => (
                    <td key={m.label} className="px-4 py-3 text-right">
                      <div className="text-xs font-bold text-emerald-600">
                        <Money amount={m.revenue} />
                      </div>
                      <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 rounded-full"
                          style={{
                            width: `${(parseFloat(m.revenue) / maxRevenue) * 100}%`,
                          }}
                        />
                      </div>
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="px-6 py-3 text-xs font-semibold text-slate-600 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                    Расходы
                  </td>
                  {pnl.map((m) => (
                    <td
                      key={m.label}
                      className="px-4 py-3 text-right text-xs font-bold text-rose-500"
                    >
                      <Money amount={m.expenses} />
                    </td>
                  ))}
                </tr>
                <tr className="bg-slate-50/50">
                  <td className="px-6 py-3 text-xs font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                    Прибыль
                  </td>
                  {pnl.map((m) => {
                    const profit = parseFloat(m.profit);
                    return (
                      <td
                        key={m.label}
                        className={`px-4 py-3 text-right text-xs font-black ${profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}
                      >
                        {profit >= 0 ? '+' : ''}
                        <Money amount={m.profit} />
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Журнал операций */}
        <section className="lg:col-span-2 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          {/* Навигация по месяцу */}
          <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <button
              onClick={() => goMonth(-1)}
              className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors"
            >
              ‹
            </button>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">
              {formatNavMonth(selectedDate)}
            </span>
            <button
              onClick={() => goMonth(1)}
              disabled={isToday}
              className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors disabled:opacity-30"
            >
              ›
            </button>
          </div>

          {/* Навигация по дню + фильтры */}
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-3">
            <button
              onClick={() => setSelectedDate((d) => addDays(d, -1))}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors text-lg leading-none"
            >
              ←
            </button>
            <div className="flex-1 text-center">
              <p className="text-sm font-bold text-slate-900">{formatNavDate(selectedDate)}</p>
              {!journalLoading2 && (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {dayIncome > 0 && (
                    <span className="text-emerald-600 font-bold">
                      +{dayIncome.toLocaleString('ru-RU')} ₽
                    </span>
                  )}
                  {dayIncome > 0 && dayExpense > 0 && (
                    <span className="mx-1 text-slate-300">|</span>
                  )}
                  {dayExpense > 0 && (
                    <span className="text-rose-500 font-bold">
                      −{dayExpense.toLocaleString('ru-RU')} ₽
                    </span>
                  )}
                  {dayIncome === 0 && dayExpense === 0 && 'Нет операций'}
                </p>
              )}
            </div>
            <button
              onClick={() => setSelectedDate((d) => addDays(d, 1))}
              disabled={isToday}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors disabled:opacity-30 text-lg leading-none"
            >
              →
            </button>
            {!isToday && (
              <button
                onClick={() => setSelectedDate(todayStr())}
                className="text-[10px] font-bold text-slate-500 hover:text-slate-800 px-2 py-1 border border-slate-200 rounded-lg transition-colors"
              >
                Сегодня
              </button>
            )}
            <div className="flex bg-slate-100 p-0.5 rounded-md ml-auto">
              {(['all', 'income', 'expense'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setDirectionFilter(f)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide transition-all ${
                    directionFilter === f
                      ? f === 'income'
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : f === 'expense'
                          ? 'bg-rose-500 text-white shadow-sm'
                          : 'bg-white text-slate-700 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  {f === 'all' ? 'Все' : f === 'income' ? '↑' : '↓'}
                </button>
              ))}
            </div>
          </div>

          {journalLoading2 ? (
            <div className="p-4 space-y-2 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-slate-100 rounded" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-center py-12 text-slate-400 text-sm">Операций нет</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Дата
                    </th>
                    <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Категория
                    </th>
                    <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Описание
                    </th>
                    <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">
                      Сумма
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 text-[10px] text-slate-500 whitespace-nowrap">
                        {formatDate(tx.created_at)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            tx.direction === 'income'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {tx.category?.name ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600 max-w-[200px] truncate">
                        {tx.description ?? '—'}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right text-xs font-bold ${
                          tx.direction === 'income' ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {tx.direction === 'income' ? '+' : '−'}
                        <Money amount={tx.amount} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Подотчёт водителей */}
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/80">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-widest">
              Подотчёт водителей
            </h2>
          </div>
          {driversWithCash.length === 0 ? (
            <div className="p-6 text-center">
              <span className="material-symbols-outlined text-slate-200 text-5xl">
                account_balance_wallet
              </span>
              <p className="text-slate-400 text-xs mt-2">Нет наличных в подотчёте</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {driversWithCash.map((d) => (
                <div key={d.driver_id} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{d.driver_name}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">Наличные</p>
                  </div>
                  <span className="text-sm font-black text-orange-600">
                    <Money amount={d.balance} />
                  </span>
                </div>
              ))}
              <div className="px-6 py-3 flex items-center justify-between bg-slate-50/50">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Итого
                </span>
                <span className="text-sm font-black text-slate-800">
                  <Money
                    amount={driversWithCash
                      .reduce((s, d) => s + parseFloat(d.balance), 0)
                      .toFixed(2)}
                  />
                </span>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
