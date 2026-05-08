'use client';

import { useQuery } from '@tanstack/react-query';
import { Money } from '@saldacargo/ui';
import { formatDate } from '@saldacargo/shared';

type Summary = {
  month: { revenue: string; expenses: string; profit: string; fuel: string; payroll: string };
  today: { revenue: string; tripsCount: number };
  alerts: { tripsForReview: number };
  recentTransactions: Array<{
    id: string;
    amount: string;
    direction: 'income' | 'expense';
    description: string;
    created_at: string;
    lifecycle_status: string;
    category: { name: string } | null;
  }>;
};

export default function DashboardHome() {
  const { data, isLoading, isError } = useQuery<Summary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => fetch('/api/dashboard/summary').then((r) => r.json()),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const month = data?.month;
  const today = data?.today;
  const alerts = data?.alerts;
  const transactions = data?.recentTransactions ?? [];

  return (
    <div className="space-y-4 animate-in fade-in duration-500 p-4 min-h-full bg-slate-50/50">
      {isError && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-700 font-bold">
          Ошибка загрузки данных
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="ВЫРУЧКА (месяц)"
          value={month?.revenue ?? null}
          color="text-emerald-600"
          icon="trending_up"
          isLoading={isLoading}
        />
        <KPICard
          title="РАСХОДЫ (месяц)"
          value={month?.expenses ?? null}
          color="text-rose-600"
          icon="trending_down"
          isLoading={isLoading}
        />
        <KPICard
          title="ПРИБЫЛЬ (месяц)"
          value={month?.profit ?? null}
          color={
            month?.profit
              ? parseFloat(month.profit) >= 0
                ? 'text-emerald-600'
                : 'text-rose-600'
              : 'text-slate-900'
          }
          icon="account_balance"
          isLoading={isLoading}
        />
        <KPICard
          title="ВЫРУЧКА СЕГОДНЯ"
          value={today?.revenue ?? null}
          color="text-sky-600"
          icon="today"
          sub={today ? `${today.tripsCount} рейсов` : undefined}
          isLoading={isLoading}
        />
      </div>

      {/* Расшифровка расходов */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/80">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Основные статьи расходов (месяц)
          </span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-slate-100">
          <div className="px-6 py-4 flex items-center gap-4">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined !text-[20px] text-amber-500">
                local_gas_station
              </span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                ГСМ
              </p>
              {isLoading ? (
                <div className="h-6 w-24 bg-slate-100 rounded animate-pulse" />
              ) : (
                <p className="text-lg font-black text-amber-600">
                  <Money amount={month?.fuel ?? '0'} />
                </p>
              )}
            </div>
          </div>
          <div className="px-6 py-4 flex items-center gap-4">
            <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined !text-[20px] text-violet-500">
                payments
              </span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                Зарплаты
              </p>
              {isLoading ? (
                <div className="h-6 w-24 bg-slate-100 rounded animate-pulse" />
              ) : (
                <p className="text-lg font-black text-violet-600">
                  <Money amount={month?.payroll ?? '0'} />
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading ? (
          <>
            <div className="h-16 bg-slate-200 rounded-lg animate-pulse" />
            <div className="h-16 bg-slate-200 rounded-lg animate-pulse" />
            <div className="h-16 bg-slate-200 rounded-lg animate-pulse" />
          </>
        ) : (
          <>
            <Alert
              type={(alerts?.tripsForReview ?? 0) > 0 ? 'warning' : 'info'}
              title={
                (alerts?.tripsForReview ?? 0) > 0
                  ? `${alerts!.tripsForReview} рейс${pluralTrips(alerts!.tripsForReview)} ждут ревью`
                  : 'Нет рейсов на ревью'
              }
              description="Требуется подтверждение"
              icon="pending_actions"
            />
            <Alert
              type="info"
              title="Дебиторка"
              description="Данные появятся в следующем модуле"
              icon="request_quote"
            />
            <Alert
              type="info"
              title="Кредиты"
              description="Данные появятся в следующем модуле"
              icon="account_balance"
            />
          </>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-md">
        <div className="px-4 py-2 border-b border-slate-200 flex justify-between items-center bg-white">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
            Последние операции
          </h3>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-4 space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-slate-100 rounded" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-sm">Операций нет</p>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    Дата
                  </th>
                  <th className="px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    Категория
                  </th>
                  <th className="px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    Описание
                  </th>
                  <th className="px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-slate-500 text-right">
                    Сумма
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2 text-[10px] font-medium text-slate-500 whitespace-nowrap">
                      {formatDate(tx.created_at)}
                    </td>
                    <td className="px-4 py-2">
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold uppercase tracking-wider">
                        {tx.category?.name ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-700">{tx.description ?? '—'}</td>
                    <td
                      className={`px-4 py-2 text-right text-xs font-bold ${tx.direction === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}
                    >
                      {tx.direction === 'income' ? '+' : '−'}
                      <Money amount={tx.amount} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function pluralTrips(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return '';
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'а';
  return 'ов';
}

function KPICard({
  title,
  value,
  color,
  icon,
  sub,
  isLoading,
}: {
  title: string;
  value: string | null;
  color: string;
  icon: string;
  sub?: string;
  isLoading: boolean;
}) {
  return (
    <div className="bg-white border border-slate-200/60 p-4 rounded-lg shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200">
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </span>
        <span className="material-symbols-outlined !text-[18px] text-slate-300">{icon}</span>
      </div>
      {isLoading ? (
        <div className="h-7 bg-slate-100 rounded animate-pulse w-3/4" />
      ) : (
        <div className={`text-xl font-bold ${color}`}>
          <Money amount={value ?? '0'} />
        </div>
      )}
      {sub && !isLoading && <p className="text-[10px] text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function Alert({
  type,
  title,
  description,
  icon,
}: {
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  icon: string;
}) {
  const styles = {
    critical: 'bg-rose-50/80 border-rose-100 text-rose-900',
    warning: 'bg-amber-50/80 border-amber-100 text-amber-900',
    info: 'bg-sky-50/80 border-sky-100 text-sky-900',
  };
  const iconStyles = {
    critical: 'bg-rose-200 text-rose-700',
    warning: 'bg-amber-200 text-amber-700',
    info: 'bg-sky-200 text-sky-700',
  };
  return (
    <div className={`border p-3 rounded-lg flex gap-3 items-center shadow-sm ${styles[type]}`}>
      <div
        className={`w-8 h-8 flex items-center justify-center rounded-lg shrink-0 ${iconStyles[type]}`}
      >
        <span className="material-symbols-outlined !text-[20px]">{icon}</span>
      </div>
      <div>
        <h4 className="font-bold text-xs leading-tight">{title}</h4>
        <p className="text-[10px] mt-0.5 opacity-70">{description}</p>
      </div>
    </div>
  );
}
