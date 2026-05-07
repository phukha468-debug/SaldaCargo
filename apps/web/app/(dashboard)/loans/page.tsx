'use client';

import { useQuery } from '@tanstack/react-query';
import { Money } from '@saldacargo/ui';

type Loan = {
  id: string;
  lender_name: string;
  loan_type: 'credit' | 'leasing' | 'borrow';
  purpose: string | null;
  original_amount: string;
  remaining_amount: string;
  annual_rate: string | null;
  monthly_payment: string | null;
  started_at: string;
  ends_at: string | null;
  notes: string | null;
};

type LoansResponse = {
  loans: Loan[];
  totalRemaining: string;
  totalMonthly: string;
};

const LOAN_TYPE_LABEL: Record<string, string> = {
  credit: 'Кредит',
  leasing: 'Лизинг',
  borrow: 'Займ',
};

const LOAN_TYPE_COLOR: Record<string, string> = {
  credit: 'bg-blue-100 text-blue-700',
  leasing: 'bg-violet-100 text-violet-700',
  borrow: 'bg-amber-100 text-amber-700',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function progressPercent(remaining: string, original: string): number {
  const r = parseFloat(remaining);
  const o = parseFloat(original);
  if (o <= 0) return 0;
  return Math.round(((o - r) / o) * 100);
}

function monthsLeft(endsAt: string | null): string | null {
  if (!endsAt) return null;
  const now = new Date();
  const end = new Date(endsAt);
  const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  if (months <= 0) return 'Просрочен';
  return `${months} мес.`;
}

export default function LoansPage() {
  const { data, isLoading, isError } = useQuery<LoansResponse>({
    queryKey: ['loans'],
    queryFn: () => fetch('/api/loans').then((r) => r.json()),
    staleTime: 60000,
  });

  const loans = data?.loans ?? [];
  const totalRemaining = data?.totalRemaining ?? '0.00';
  const totalMonthly = data?.totalMonthly ?? '0.00';

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <h1 className="text-2xl font-bold text-slate-900">Кредиты и лизинг</h1>

      {isError && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-700 font-bold">
          Ошибка загрузки данных
        </div>
      )}

      {/* Сводка */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          label="Общий долг"
          value={totalRemaining}
          color="text-rose-600"
          isLoading={isLoading}
        />
        <SummaryCard
          label="Платежей в месяц"
          value={totalMonthly}
          color="text-amber-600"
          isLoading={isLoading}
        />
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
            Кредитных линий
          </p>
          {isLoading ? (
            <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
          ) : (
            <p className="text-2xl font-bold text-slate-900">{loans.length}</p>
          )}
        </div>
      </div>

      {/* Список кредитов */}
      <section className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/80">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-widest">
            Обязательства
          </h2>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : loans.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-4xl mb-3">🏦</p>
            <p className="font-medium text-slate-500">Данные по кредитам ещё не внесены</p>
            <p className="text-sm mt-1">
              Добавьте записи через SQL или обратитесь к администратору
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {loans.map((loan) => {
              const pct = progressPercent(loan.remaining_amount, loan.original_amount);
              const left = monthsLeft(loan.ends_at);

              return (
                <div key={loan.id} className="p-6 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    {/* Левая часть */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${LOAN_TYPE_COLOR[loan.loan_type]}`}
                        >
                          {LOAN_TYPE_LABEL[loan.loan_type]}
                        </span>
                        {left && (
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                              left === 'Просрочен'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {left === 'Просрочен' ? left : `осталось ${left}`}
                          </span>
                        )}
                      </div>

                      <p className="text-base font-bold text-slate-900">{loan.lender_name}</p>
                      {loan.purpose && (
                        <p className="text-sm text-slate-500 mt-0.5">{loan.purpose}</p>
                      )}

                      {/* Прогресс погашения */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>Погашено {pct}%</span>
                          <span>
                            Остаток: <Money amount={loan.remaining_amount} /> из{' '}
                            <Money amount={loan.original_amount} />
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {loan.notes && (
                        <p className="text-xs text-slate-400 mt-2 italic">{loan.notes}</p>
                      )}
                    </div>

                    {/* Правая часть — цифры */}
                    <div className="flex md:flex-col gap-6 md:gap-3 md:text-right shrink-0">
                      {loan.monthly_payment && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                            В месяц
                          </p>
                          <p className="text-lg font-bold text-slate-900">
                            <Money amount={loan.monthly_payment} />
                          </p>
                        </div>
                      )}
                      {loan.annual_rate && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                            Ставка
                          </p>
                          <p className="text-sm font-semibold text-slate-700">
                            {loan.annual_rate}% год.
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                          Период
                        </p>
                        <p className="text-xs text-slate-600">
                          {formatDate(loan.started_at)}
                          {loan.ends_at && <> — {formatDate(loan.ends_at)}</>}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  isLoading,
}: {
  label: string;
  value: string;
  color: string;
  isLoading: boolean;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      {isLoading ? (
        <div className="h-8 w-32 bg-slate-100 rounded animate-pulse" />
      ) : (
        <p className={`text-2xl font-bold ${color}`}>
          <Money amount={value} />
        </p>
      )}
    </div>
  );
}
