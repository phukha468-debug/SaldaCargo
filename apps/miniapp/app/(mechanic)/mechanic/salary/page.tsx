'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

interface PendingItem {
  id: string;
  amount: string;
  context: string;
}

interface SalaryData {
  accruals: Accrual[];
  pending_confirmation: PendingItem[];
  pending_confirmation_count: number;
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
  const [rejecting, setRejecting] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const confirmMutation = useMutation({
    mutationFn: async (body: { action: 'confirm' | 'reject'; ids?: string[]; id?: string }) => {
      const res = await fetch('/api/employee/payroll', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Ошибка');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mechanic-salary'] });
      queryClient.invalidateQueries({ queryKey: ['mechanic-salary-preview'] });
      setRejecting(null);
    },
  });

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
          {/* Подтверждение ЗП */}
          {(data?.pending_confirmation ?? []).length > 0 && (
            <div className="mx-4 mt-4 bg-amber-50 border-2 border-amber-300 rounded-2xl overflow-hidden">
              <div className="bg-amber-400 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-amber-900 uppercase tracking-widest">
                    ⏳ Ожидает подтверждения
                  </p>
                  <p className="text-[10px] text-amber-800 font-bold mt-0.5">
                    {data!.pending_confirmation.length} начислений
                  </p>
                </div>
                {data!.pending_confirmation.length > 1 && (
                  <button
                    onClick={() => confirmMutation.mutate({ action: 'confirm' })}
                    disabled={confirmMutation.isPending}
                    className="bg-amber-900 text-white text-[10px] font-black px-3 py-2 rounded-xl uppercase tracking-wide active:scale-95 transition-all disabled:opacity-50"
                  >
                    Подтвердить всё
                  </button>
                )}
              </div>
              <div className="divide-y divide-amber-200">
                {data!.pending_confirmation.map((item) => (
                  <div key={item.id} className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1">
                        <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest">
                          ЗП механика
                        </p>
                        <p className="text-xs text-amber-900 font-bold mt-0.5">{item.context}</p>
                      </div>
                      <p className="text-xl font-black text-amber-900 shrink-0">
                        +{formatMoney(item.amount)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          confirmMutation.mutate({ action: 'confirm', ids: [item.id] })
                        }
                        disabled={confirmMutation.isPending}
                        className="flex-1 bg-green-600 text-white font-black text-xs py-2.5 rounded-xl uppercase tracking-wide active:scale-95 transition-all disabled:opacity-50"
                      >
                        ✓ Подтвердить
                      </button>
                      <button
                        onClick={() => setRejecting(item.id)}
                        disabled={confirmMutation.isPending}
                        className="px-4 border-2 border-amber-400 text-amber-800 font-black text-xs py-2.5 rounded-xl uppercase tracking-wide active:scale-95 transition-all disabled:opacity-50"
                      >
                        ✗ Не согласен
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Диалог отклонения */}
          {rejecting && (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center"
              style={{ background: 'rgba(0,0,0,0.5)' }}
              onClick={(e) => e.target === e.currentTarget && setRejecting(null)}
            >
              <div className="bg-white rounded-t-3xl w-full p-6 space-y-4">
                <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" />
                <p className="font-black text-slate-900 text-base">Не согласны с суммой?</p>
                <p className="text-sm text-slate-600">
                  Начисление будет отклонено. Администратор увидит уведомление и скорректирует
                  сумму.
                </p>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  Наряд остаётся утверждённым — только ЗП вернётся на пересмотр.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setRejecting(null)}
                    className="flex-1 border-2 border-slate-200 text-slate-600 font-black py-3 rounded-xl text-sm uppercase active:scale-95 transition-all"
                  >
                    Вернуться
                  </button>
                  <button
                    onClick={() => confirmMutation.mutate({ action: 'reject', id: rejecting })}
                    disabled={confirmMutation.isPending}
                    className="flex-1 bg-red-500 text-white font-black py-3 rounded-xl text-sm uppercase active:scale-95 transition-all disabled:opacity-50"
                  >
                    {confirmMutation.isPending ? '...' : 'Отклонить'}
                  </button>
                </div>
              </div>
            </div>
          )}

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
