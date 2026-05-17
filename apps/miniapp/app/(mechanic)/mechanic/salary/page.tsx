'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { cn } from '@saldacargo/ui';

interface Accrual {
  id: string;
  amount: string;
  settlement_status: 'pending' | 'completed';
  lifecycle_status: string;
  description: string;
  created_at: string;
  service_order?: {
    id: string;
    order_number: number;
    asset?: { short_name: string; reg_number: string };
  };
}

interface SalaryData {
  accruals: Accrual[];
  summary: {
    total_accrued: string;
    total_paid: string;
    to_pay: string;
  };
}

const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

export default function MechanicSalaryPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading } = useQuery<SalaryData>({
    queryKey: ['mechanic-salary', year, month],
    queryFn: async () => {
      const res = await fetch(`/api/mechanic/salary?year=${year}&month=${month}`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
  });

  const prevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
    if (isCurrentMonth) return;
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else setMonth((m) => m + 1);
  };

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="min-h-full bg-slate-50 pb-8">
      {/* Заголовок + переключатель месяца */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 active:scale-90 transition-transform font-black"
          >
            ‹
          </button>
          <div className="text-center">
            <p className="text-sm font-black text-slate-900 uppercase tracking-widest">
              {MONTHS[month - 1]} {year}
            </p>
            {isCurrentMonth && (
              <p className="text-[10px] font-bold text-orange-600 uppercase">Текущий месяц</p>
            )}
          </div>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 active:scale-90 transition-transform font-black disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Сводка */}
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl p-3 border border-slate-200 text-center">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Начислено
                </p>
                <p className="text-lg font-black text-slate-900 mt-1">
                  {formatMoney(data?.summary.total_accrued ?? '0')}
                </p>
              </div>
              <div className="bg-white rounded-2xl p-3 border border-slate-200 text-center">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Выплачено
                </p>
                <p className="text-lg font-black text-green-600 mt-1">
                  {formatMoney(data?.summary.total_paid ?? '0')}
                </p>
              </div>
              <div
                className={cn(
                  'rounded-2xl p-3 border text-center',
                  parseFloat(data?.summary.to_pay ?? '0') > 0
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-white border-slate-200',
                )}
              >
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  К выплате
                </p>
                <p
                  className={cn(
                    'text-lg font-black mt-1',
                    parseFloat(data?.summary.to_pay ?? '0') > 0
                      ? 'text-orange-600'
                      : 'text-slate-400',
                  )}
                >
                  {formatMoney(data?.summary.to_pay ?? '0')}
                </p>
              </div>
            </div>

            {/* Список начислений */}
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
              Начисления ({(data?.accruals ?? []).length})
            </h2>

            {(data?.accruals ?? []).length === 0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-2">💰</p>
                <p className="font-bold text-slate-400">Начислений нет</p>
                <p className="text-xs text-slate-400 mt-1">
                  За {(MONTHS[month - 1] ?? '').toLowerCase()} {year} нарядов не закрывалось
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {(data?.accruals ?? []).map((accrual) => (
                  <AccrualCard key={accrual.id} accrual={accrual} />
                ))}
              </div>
            )}
          </div>

          {/* Справка по выплатам */}
          <div className="px-4">
            <div className="bg-slate-100 rounded-xl p-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Справка
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                ЗП начисляется автоматически при утверждении наряда администратором. Выплата — 2
                раза в месяц. По вопросам выплат обратитесь к администратору.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AccrualCard({ accrual }: { accrual: Accrual }) {
  const isPaid = accrual.settlement_status === 'completed';
  const orderNum = accrual.service_order?.order_number;
  const assetName = accrual.service_order?.asset?.short_name;

  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            {orderNum && (
              <span className="text-xs font-black text-slate-500">Наряд #{orderNum}</span>
            )}
            {assetName && <span className="text-xs font-bold text-slate-400">· {assetName}</span>}
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase">
            {new Date(accrual.created_at).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-black text-slate-900">{formatMoney(accrual.amount)}</p>
          <span
            className={cn(
              'text-[9px] font-black uppercase px-2 py-0.5 rounded-full',
              isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
            )}
          >
            {isPaid ? '✓ Выплачено' : 'К выплате'}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatMoney(amount: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(num);
}
