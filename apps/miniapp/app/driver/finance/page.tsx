/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Money } from '@saldacargo/ui';

export default function FinancePage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <FinanceContent />
    </Suspense>
  );
}

function FinanceContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'pay' ? 'pay' : 'accountable';
  const [activeTab, setActiveTab] = useState<'accountable' | 'pay'>(initialTab);

  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ['driver-finance'],
    queryFn: async () => {
      const res = await fetch('/api/driver/finance');
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
    staleTime: 30000,
  });

  if (isLoading) return <Skeleton />;

  if (isError)
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-3xl mb-3">⚠️</p>
          <p className="font-bold text-zinc-600 text-sm">Не удалось загрузить данные</p>
          <p className="text-xs text-zinc-400 mt-1">Попробуйте обновить страницу</p>
        </div>
      </div>
    );

  const pendingCount = data?.salary?.pending_confirmation?.length ?? 0;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="bg-white border-b-2 border-zinc-200 p-2 flex sticky top-0 z-50">
        <button
          onClick={() => setActiveTab('accountable')}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
            activeTab === 'accountable'
              ? 'bg-zinc-900 text-white shadow-md'
              : 'text-zinc-400 active:bg-zinc-100'
          }`}
        >
          💳 Подотчёт
        </button>
        <button
          onClick={() => setActiveTab('pay')}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-lg transition-all relative ${
            activeTab === 'pay'
              ? 'bg-zinc-900 text-white shadow-md'
              : 'text-zinc-400 active:bg-zinc-100'
          }`}
        >
          💰 Зарплата
          {pendingCount > 0 && activeTab !== 'pay' && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      <main className="p-4 space-y-6">
        {activeTab === 'accountable' ? (
          <AccountableTab data={data?.accountable} />
        ) : (
          <SalaryTab salary={data?.salary} />
        )}
      </main>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      <div className="h-10 bg-zinc-200 rounded mb-6" />
      <div className="h-32 bg-zinc-200 rounded-lg" />
      <div className="space-y-3 pt-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-zinc-200 rounded-lg h-16" />
        ))}
      </div>
    </div>
  );
}

function AccountableTab({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border-2 border-zinc-200 p-6 text-center shadow-sm">
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">
          На руках сейчас (нал + карта)
        </p>
        <Money amount={data?.balance ?? '0'} className="text-4xl font-black text-zinc-900" />
        <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mt-3">
          Сумма всех наличных заказов · нужно сдать в конце смены
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b-2 border-zinc-100 pb-2">
          Наличные заказы
        </h2>
        {(data?.transactions ?? []).length === 0 ? (
          <p className="text-center py-10 text-zinc-400 font-bold uppercase text-xs">
            Наличных заказов нет
          </p>
        ) : (
          data?.transactions?.map((tx: any) => (
            <div
              key={tx.id}
              className="bg-white rounded-lg p-4 border border-zinc-200 flex justify-between items-center shadow-sm"
            >
              <div>
                <p className="font-bold text-zinc-900 text-sm">{tx.description}</p>
                <p className="text-[10px] text-zinc-400 font-bold uppercase mt-1">
                  {tx.payment_method === 'cash' ? '💵 Наличные' : '💳 Карта водителя'} ·{' '}
                  {new Date(tx.created_at).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
              </div>
              <Money amount={tx.amount} className="font-black text-sm text-zinc-900" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SalaryTab({ salary }: { salary: any }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [confirmAllPending, setConfirmAllPending] = useState(false);

  const pending: any[] = salary?.pending_confirmation ?? [];
  const accruals: any[] = salary?.accruals ?? [];
  const accumulatedTotal: string = salary?.accumulated_total ?? '0';

  const mutate = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch('/api/employee/payroll', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Ошибка');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-finance'] });
      queryClient.invalidateQueries({ queryKey: ['driver-summary'] });
      setConfirming(null);
      setRejecting(null);
      setConfirmAllPending(false);
    },
  });

  return (
    <div className="space-y-6">
      {/* Секция подтверждения ЗП */}
      {pending.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-amber-400 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-amber-900 uppercase tracking-widest">
                ⏳ Ожидает вашего подтверждения
              </p>
              <p className="text-[10px] text-amber-800 font-bold mt-0.5">
                {pending.length} начисл.
              </p>
            </div>
            {pending.length > 1 && (
              <button
                onClick={() => setConfirmAllPending(true)}
                disabled={mutate.isPending}
                className="bg-amber-900 text-white text-[10px] font-black px-3 py-2 rounded-xl uppercase tracking-wide active:scale-95 transition-all disabled:opacity-50"
              >
                Подтвердить всё
              </button>
            )}
          </div>

          <div className="divide-y divide-amber-200">
            {pending.map((item: any) => (
              <div key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1">
                    <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-0.5">
                      {item.label}
                    </p>
                    <p className="text-xs text-amber-900 font-bold">{item.context}</p>
                  </div>
                  <p className="text-xl font-black text-amber-900 shrink-0">
                    +<Money amount={item.amount} />
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => mutate.mutate({ action: 'confirm', ids: [item.id] })}
                    disabled={mutate.isPending && confirming === item.id}
                    className="flex-1 bg-green-600 text-white font-black text-xs py-2.5 rounded-xl uppercase tracking-wide active:scale-95 transition-all disabled:opacity-50"
                    onMouseDown={() => setConfirming(item.id)}
                  >
                    ✓ Подтвердить
                  </button>
                  <button
                    onClick={() => setRejecting(item.id)}
                    disabled={mutate.isPending}
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

      {/* Диалог подтвердить всё */}
      {confirmAllPending && (
        <ConfirmAllDialog
          items={pending}
          accumulatedAfter={(
            parseFloat(accumulatedTotal) +
            pending.reduce((s: number, x: any) => s + parseFloat(x.amount), 0)
          ).toFixed(2)}
          onConfirm={() => mutate.mutate({ action: 'confirm' })}
          onCancel={() => setConfirmAllPending(false)}
          isPending={mutate.isPending}
        />
      )}

      {/* Диалог "не согласен" */}
      {rejecting && (
        <RejectDialog
          item={pending.find((x: any) => x.id === rejecting)!}
          onConfirmReject={() => mutate.mutate({ action: 'reject', id: rejecting })}
          onCancel={() => setRejecting(null)}
          isPending={mutate.isPending}
        />
      )}

      {/* Итог: накоплено */}
      <div className="bg-white rounded-lg border-2 border-zinc-200 p-6 shadow-sm flex flex-col items-center">
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">
          Накоплено к выплате
        </p>
        <Money amount={accumulatedTotal} className="text-4xl font-black text-green-600" />
        {pending.length > 0 && (
          <p className="text-xs font-bold text-amber-600 mt-2">
            + ещё{' '}
            <Money
              amount={pending.reduce((s: number, x: any) => s + parseFloat(x.amount), 0).toFixed(2)}
            />{' '}
            ожидает подтверждения
          </p>
        )}
      </div>

      {/* История начислений за месяц */}
      <div className="space-y-3">
        <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b-2 border-zinc-100 pb-2">
          Начислено в этом месяце
        </h2>
        {accruals.length === 0 ? (
          <p className="text-center py-10 text-zinc-400 font-bold uppercase text-xs">
            Начислений нет
          </p>
        ) : (
          accruals.map((accrual: any) => {
            const isPaid = accrual.settlement_status === 'completed';
            const dateStr = accrual.date
              ? new Date(accrual.date).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                })
              : '—';
            return (
              <div
                key={accrual.id}
                className="bg-white rounded-lg p-4 border border-zinc-200 flex justify-between items-center shadow-sm relative overflow-hidden"
              >
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 ${isPaid ? 'bg-green-500' : 'bg-zinc-400'}`}
                />
                <div className="pl-2">
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                    {accrual.label}
                  </p>
                  <p className="font-bold text-zinc-900 text-sm mt-0.5">
                    {accrual.trip_number ? `Рейс №${accrual.trip_number}` : '—'}
                    {accrual.asset_name ? ` · ${accrual.asset_name}` : ''}
                  </p>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase mt-0.5">{dateStr}</p>
                </div>
                <div className="text-right">
                  <Money amount={accrual.amount} className="font-black text-sm text-zinc-900" />
                  <p
                    className={`text-[9px] font-black uppercase mt-1 ${isPaid ? 'text-green-600' : 'text-zinc-400'}`}
                  >
                    {isPaid ? '✓ Выплачено' : 'К выплате'}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ConfirmAllDialog({
  items,
  accumulatedAfter,
  onConfirm,
  onCancel,
  isPending,
}: {
  items: any[];
  accumulatedAfter: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const total = items.reduce((s: number, x: any) => s + parseFloat(x.amount), 0).toFixed(2);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-white rounded-t-3xl w-full p-6 space-y-4 max-w-lg">
        <div className="w-10 h-1 bg-zinc-200 rounded-full mx-auto" />
        <p className="font-black text-zinc-900 text-base">Подтвердить все начисления?</p>
        <p className="text-sm text-zinc-600">
          Вы подтверждаете {items.length} начислений на сумму{' '}
          <strong>
            <Money amount={total} />
          </strong>
          . Итого накоплено:{' '}
          <strong>
            <Money amount={accumulatedAfter} />
          </strong>
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border-2 border-zinc-200 text-zinc-600 font-black py-3 rounded-xl text-sm uppercase active:scale-95 transition-all"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 bg-green-600 text-white font-black py-3 rounded-xl text-sm uppercase active:scale-95 transition-all disabled:opacity-50"
          >
            {isPending ? '...' : '✓ Подтвердить всё'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectDialog({
  item,
  onConfirmReject,
  onCancel,
  isPending,
}: {
  item: any;
  onConfirmReject: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-white rounded-t-3xl w-full p-6 space-y-4 max-w-lg">
        <div className="w-10 h-1 bg-zinc-200 rounded-full mx-auto" />
        <p className="font-black text-zinc-900 text-base">Не согласны с суммой?</p>
        <p className="text-sm text-zinc-600">
          Начисление <strong>{item?.label}</strong> на{' '}
          <strong>
            <Money amount={item?.amount ?? '0'} />
          </strong>{' '}
          будет отклонено. Администратор увидит уведомление и сможет скорректировать сумму.
        </p>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Рейс и выручка остаются утверждёнными — только ЗП вернётся на пересмотр.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border-2 border-zinc-200 text-zinc-600 font-black py-3 rounded-xl text-sm uppercase active:scale-95 transition-all"
          >
            Вернуться
          </button>
          <button
            onClick={onConfirmReject}
            disabled={isPending}
            className="flex-1 bg-red-500 text-white font-black py-3 rounded-xl text-sm uppercase active:scale-95 transition-all disabled:opacity-50"
          >
            {isPending ? '...' : 'Отклонить'}
          </button>
        </div>
      </div>
    </div>
  );
}
