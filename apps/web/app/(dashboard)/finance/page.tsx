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

export default function FinancePage() {
  const [directionFilter, setDirectionFilter] = useState<'all' | 'income' | 'expense'>('all');

  const { data, isLoading } = useQuery<{ pnl: PnlMonth[]; transactions: Transaction[] }>({
    queryKey: ['finance', directionFilter],
    queryFn: () => {
      const params = directionFilter !== 'all' ? `?direction=${directionFilter}` : '';
      return fetch(`/api/finance${params}`).then((r) => r.json());
    },
    staleTime: 30000,
  });

  const { data: balances = [] } = useQuery<DriverBalance[]>({
    queryKey: ['cash-balances'],
    queryFn: () => fetch('/api/admin/cash-collections').then((r) => r.json()),
    staleTime: 30000,
  });

  const pnl = data?.pnl ?? [];
  const transactions = data?.transactions ?? [];

  const maxRevenue = Math.max(...pnl.map((m) => parseFloat(m.revenue)), 1);

  const driversWithCash = balances.filter((d) => parseFloat(d.balance) > 0);

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto animate-in fade-in duration-500">
      <h1 className="text-2xl font-bold text-slate-900">Финансы</h1>

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
          <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-widest">
              Журнал операций
            </h2>
            <div className="flex bg-slate-100 p-0.5 rounded-md">
              {(['all', 'income', 'expense'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setDirectionFilter(f)}
                  className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wide transition-all ${
                    directionFilter === f
                      ? f === 'income'
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : f === 'expense'
                          ? 'bg-rose-500 text-white shadow-sm'
                          : 'bg-white text-slate-700 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  {f === 'all' ? 'Все' : f === 'income' ? 'Доходы' : 'Расходы'}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
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
