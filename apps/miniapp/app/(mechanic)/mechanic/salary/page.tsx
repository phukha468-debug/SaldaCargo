'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { Money, cn } from '@saldacargo/ui';
import { formatDate } from '@saldacargo/shared';

interface Accrual {
  id: string;
  amount: string;
  settlement_status: 'pending' | 'completed';
  lifecycle_status: string;
  description: string;
  created_at: string;
  transaction_date?: string;
  service_order?: {
    id: string;
    order_number: number;
    machine_type?: 'own' | 'client';
    client_vehicle_brand?: string;
    client_vehicle_model?: string;
    client_vehicle_reg?: string;
    asset?: { short_name: string; reg_number: string };
    service_order_works?: Array<{
      norm_minutes: number;
      actual_minutes: number;
      status: string;
      custom_work_name?: string;
      work_catalog?: { name: string };
    }>;
  };
}

interface PayoutItem {
  id: string;
  amount: string;
  description: string;
  wallet_label: string;
  is_advance: boolean;
  date: string;
}

interface PendingItem {
  id: string;
  amount: string;
  context: string;
}

interface SalaryData {
  accruals: Accrual[];
  payouts: PayoutItem[];
  pending_confirmation: PendingItem[];
  pending_confirmation_count: number;
  rates?: {
    hourly_rate_client: number;
    hourly_rate_own: number;
    mechanic_salary_pct: number;
  };
  summary: {
    total_accrued: string;
    total_paid: string;
    to_pay: string;
    draft_pay?: string;
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
  const [activeTab, setActiveTab] = useState<'accruals' | 'payouts'>('accruals');
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
  const payouts = data?.payouts ?? [];
  const accruals = data?.accruals ?? [];
  const draftPay = parseFloat(data?.summary?.draft_pay ?? '0');

  return (
    <div className="min-h-full bg-[#F2F4F7] pb-8 max-w-lg mx-auto">
      {/* Переключатель месяца в стиле Сбербанк */}
      <div className="bg-white border-b border-slate-200/80 px-4 py-3.5 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#F2F4F7] text-slate-700 active:scale-90 transition-transform font-black"
          >
            ‹
          </button>
          <div className="text-center">
            <p className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              {MONTHS[month - 1]} {year}
            </p>
            {isCurrentMonth && (
              <p className="text-[10px] font-bold text-[#21A038] uppercase">
                Текущий расчётный период
              </p>
            )}
          </div>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#F2F4F7] text-slate-700 active:scale-90 transition-transform font-black disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* 1. Главная банковская сводка */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">К выплате на руки сейчас</p>
                <p className="text-3xl font-black text-[#21A038] tracking-tight mt-0.5">
                  <Money amount={data?.summary.to_pay ?? '0'} />
                </p>
                {draftPay > 0 && (
                  <p className="text-xs font-extrabold text-[#0E7C5B] bg-[#E8F7EC] inline-block px-2.5 py-0.5 rounded-lg mt-1.5">
                    ⏳ +<Money amount={String(draftPay)} /> на проверке в гараже
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className="text-[11px] font-extrabold text-slate-500 bg-[#F2F4F7] px-2.5 py-1 rounded-lg">
                  Доля ЗП: {data?.rates?.mechanic_salary_pct ?? 50}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-100">
              <div className="bg-[#F2F4F7] rounded-2xl p-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase">
                  Начислено ({MONTHS[month - 1]})
                </p>
                <p className="text-base font-extrabold text-slate-900 mt-0.5">
                  <Money amount={data?.summary.total_accrued ?? '0'} />
                </p>
              </div>
              <div className="bg-[#F2F4F7] rounded-2xl p-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase">
                  Оплачено ({MONTHS[month - 1]})
                </p>
                <p className="text-base font-extrabold text-[#21A038] mt-0.5">
                  <Money amount={data?.summary.total_paid ?? '0'} />
                </p>
              </div>
            </div>
          </div>

          {/* 2. Ожидает подтверждения механика */}
          {(data?.pending_confirmation ?? []).length > 0 && (
            <div className="bg-white border-2 border-amber-300 rounded-3xl overflow-hidden shadow-2xs">
              <div className="bg-amber-50 px-4 py-3 border-b border-amber-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold text-amber-900">
                    ⏳ Ожидает вашего подтверждения
                  </p>
                  <p className="text-[11px] text-amber-700 font-semibold">
                    {data!.pending_confirmation.length} начислений
                  </p>
                </div>
                {data!.pending_confirmation.length > 1 && (
                  <button
                    onClick={() => confirmMutation.mutate({ action: 'confirm' })}
                    disabled={confirmMutation.isPending}
                    className="bg-[#21A038] text-white text-xs font-extrabold px-3 py-1.5 rounded-xl active:scale-95 transition-all disabled:opacity-50"
                  >
                    Подтвердить всё
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-100">
                {data!.pending_confirmation.map((item) => (
                  <div key={item.id} className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                          Зарплата за закрытый наряд
                        </p>
                        <p className="text-xs text-slate-900 font-extrabold mt-0.5">
                          {item.context}
                        </p>
                      </div>
                      <p className="text-lg font-black text-[#21A038] shrink-0">
                        +<Money amount={item.amount} />
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          confirmMutation.mutate({ action: 'confirm', ids: [item.id] })
                        }
                        disabled={confirmMutation.isPending}
                        className="flex-1 bg-[#21A038] text-white font-extrabold text-xs py-2.5 rounded-xl active:scale-95 transition-all disabled:opacity-50"
                      >
                        ✓ Подтвердить
                      </button>
                      <button
                        onClick={() => setRejecting(item.id)}
                        disabled={confirmMutation.isPending}
                        className="px-4 border border-slate-200 bg-[#F2F4F7] text-slate-700 font-extrabold text-xs py-2.5 rounded-xl active:scale-95 transition-all disabled:opacity-50"
                      >
                        Не согласен
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Переключатель вкладок: Начисления за наряды / История выплат */}
          <div className="grid grid-cols-2 bg-white border border-slate-200/80 p-1 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('accruals')}
              className={cn(
                'py-2.5 text-xs font-extrabold rounded-xl transition-all',
                activeTab === 'accruals' ? 'bg-[#21A038] text-white shadow-2xs' : 'text-slate-500',
              )}
            >
              За закрытые наряды ({accruals.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('payouts')}
              className={cn(
                'py-2.5 text-xs font-extrabold rounded-xl transition-all',
                activeTab === 'payouts' ? 'bg-[#21A038] text-white shadow-2xs' : 'text-slate-500',
              )}
            >
              История выплат ({payouts.length})
            </button>
          </div>

          {/* 4. Содержимое вкладки */}
          {activeTab === 'accruals' ? (
            accruals.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center space-y-2">
                <p className="text-3xl">📋</p>
                <p className="text-sm font-extrabold text-slate-800">
                  Начислений за {(MONTHS[month - 1] ?? '').toLowerCase()} нет
                </p>
                <p className="text-xs text-slate-400">
                  Утверждённые наряды и начисленная по ним зарплата отображаются здесь
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {accruals.map((accrual) => (
                  <AccrualCard key={accrual.id} accrual={accrual} />
                ))}
              </div>
            )
          ) : payouts.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center space-y-2">
              <p className="text-3xl">💳</p>
              <p className="text-sm font-extrabold text-slate-800">Выплат пока не было</p>
              <p className="text-xs text-slate-400">
                Все выплаты наличными из кассы, переводы на карту и авансы отображаются здесь
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {payouts.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md',
                          p.is_advance
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-[#E8F7EC] text-[#0E7C5B]',
                        )}
                      >
                        {p.wallet_label}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">
                        {formatDate(p.date)}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 mt-1 leading-snug">
                      {p.description}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-black text-[#21A038]">
                      +<Money amount={p.amount} />
                    </p>
                    <span className="text-[10px] font-bold text-slate-400">Выплачено</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Диалог отклонения */}
      {rejecting && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50"
          onClick={(e) => e.target === e.currentTarget && setRejecting(null)}
        >
          <div className="bg-white rounded-t-3xl w-full p-6 space-y-4 max-w-lg">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" />
            <p className="font-extrabold text-slate-900 text-base">Не согласны с суммой?</p>
            <p className="text-sm text-slate-600">
              Начисление будет возвращено администратору для проверки и корректировки суммы.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRejecting(null)}
                className="flex-1 border border-slate-200 text-slate-700 font-extrabold py-3 rounded-xl text-xs uppercase active:scale-95 transition-all"
              >
                Вернуться
              </button>
              <button
                onClick={() => confirmMutation.mutate({ action: 'reject', id: rejecting })}
                disabled={confirmMutation.isPending}
                className="flex-1 bg-red-500 text-white font-extrabold py-3 rounded-xl text-xs uppercase active:scale-95 transition-all disabled:opacity-50"
              >
                {confirmMutation.isPending ? '...' : 'Отклонить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AccrualCard({ accrual }: { accrual: Accrual }) {
  const isPaid = accrual.settlement_status === 'completed';
  const so = accrual.service_order;
  const orderNum = so?.order_number;
  const vehicleName =
    so?.machine_type === 'own'
      ? so.asset?.short_name
      : [so?.client_vehicle_brand || so?.client_vehicle_model, so?.client_vehicle_reg]
          .filter(Boolean)
          .join(' · ');

  const content = (
    <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs active:scale-[0.99] transition-transform">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {orderNum && (
              <span className="text-xs font-extrabold text-slate-900">Наряд #{orderNum}</span>
            )}
            {vehicleName && (
              <span className="text-xs font-bold text-slate-500">· {vehicleName}</span>
            )}
          </div>
          <p className="text-xs text-slate-600 font-medium mt-1 line-clamp-2">
            {accrual.description}
          </p>
          <p className="text-[11px] text-slate-400 font-semibold mt-1">
            {formatDate(accrual.transaction_date || accrual.created_at)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-black text-[#21A038]">
            +<Money amount={accrual.amount} />
          </p>
          <span
            className={cn(
              'text-[10px] font-extrabold px-2 py-0.5 rounded-full inline-block mt-1',
              isPaid ? 'bg-[#E8F7EC] text-[#0E7C5B]' : 'bg-amber-50 text-amber-700',
            )}
          >
            {isPaid ? '✓ Выплачено' : 'К выплате'}
          </span>
        </div>
      </div>
    </div>
  );

  if (so?.id) {
    return <Link href={`/mechanic/orders/${so.id}`}>{content}</Link>;
  }
  return content;
}
