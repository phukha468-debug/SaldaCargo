/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Money } from '@saldacargo/ui';

export default function FinancePage() {
  return <FinanceContent />;
}

function FinanceContent() {
  const [tab, setTab] = useState<'salary' | 'accountable'>('salary');

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

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="p-4 border-b border-zinc-200 bg-white sticky top-0 z-10">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('salary')}
            className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all ${
              tab === 'salary'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'bg-zinc-100 text-zinc-600 active:bg-zinc-200'
            }`}
          >
            💰 Зарплата
          </button>
          <button
            onClick={() => setTab('accountable')}
            className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all ${
              tab === 'accountable'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-zinc-100 text-zinc-600 active:bg-zinc-200'
            }`}
          >
            💵 Подотчёт ({data?.accountable?.balance ?? '0'} ₽)
          </button>
        </div>
      </div>

      <main className="p-3 space-y-3">
        {tab === 'salary' ? (
          <SalaryTab salary={data?.salary} />
        ) : (
          <AccountableTab accountable={data?.accountable} />
        )}
      </main>
    </div>
  );
}

function AccountableTab({ accountable }: { accountable: any }) {
  const balance = accountable?.balance ?? '0';
  const carryover = accountable?.activeCarryover;
  const transactions = accountable?.transactions ?? [];

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl px-4 py-3 border border-zinc-200 shadow-2xs flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">
            Наличные к сдаче в кассу
          </p>
          {carryover && (
            <p className="text-[10px] font-bold text-red-600 mt-0.5">
              ⚠️ Перенос: {carryover.amount} ₽ (сдать поверх смены)
            </p>
          )}
        </div>
        <Money amount={balance} className="text-2xl font-black text-zinc-900" />
      </div>

      <div className="space-y-2">
        <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-200 pb-1.5">
          История приёма наличных
        </h2>
        {transactions.length === 0 ? (
          <p className="text-center py-8 text-zinc-400 font-bold uppercase text-xs">
            Заказов с наличными нет
          </p>
        ) : (
          <div className="space-y-1.5">
            {transactions.map((tx: any) => (
              <div
                key={tx.id}
                className="bg-white rounded-xl px-3 py-2 border border-zinc-200 flex justify-between items-center shadow-2xs"
              >
                <div>
                  <p className="font-bold text-xs text-zinc-900">{tx.description || 'Рейс'}</p>
                  <p className="text-[10px] text-zinc-400 font-medium">
                    {tx.created_at ? new Date(tx.created_at).toLocaleString('ru-RU') : ''}
                  </p>
                </div>
                <Money amount={tx.amount} className="font-black text-sm text-zinc-900" />
              </div>
            ))}
          </div>
        )}
      </div>
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

  const unpaidAccruals = accruals.filter((a: any) => a.settlement_status !== 'completed');
  const paidAccruals = accruals.filter((a: any) => a.settlement_status === 'completed');

  const renderAccrual = (accrual: any) => {
    const isPaid = accrual.settlement_status === 'completed';
    const dateStr = accrual.date
      ? new Date(accrual.date).toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'short',
        })
      : '—';
    return (
      <div
        key={accrual.id}
        className="bg-white rounded-xl px-3 py-2 border border-zinc-200 flex justify-between items-center shadow-2xs relative overflow-hidden"
      >
        <div
          className={`absolute left-0 top-0 bottom-0 w-1 ${isPaid ? 'bg-green-500' : 'bg-zinc-400'}`}
        />
        <div className="pl-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-zinc-900 text-xs">
              {accrual.trip_number ? `Рейс №${accrual.trip_number}` : accrual.label || 'Начисление'}
            </span>
            {accrual.asset_name && (
              <span className="text-[11px] text-zinc-500 font-medium truncate">
                · {accrual.asset_name}
              </span>
            )}
            <span className="text-[10px] text-zinc-400 font-medium">· {dateStr}</span>
          </div>
          {accrual.label && accrual.trip_number && (
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider truncate">
              {accrual.label}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <Money amount={accrual.amount} className="font-black text-xs text-zinc-900" />
          <span
            className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
              isPaid ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-600'
            }`}
          >
            {isPaid ? '✓ Выплачено' : 'К выплате'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
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

      {/* Итог: накоплено (в 2 раза меньше по высоте) */}
      <div className="bg-white rounded-xl border border-zinc-200 px-4 py-3 shadow-2xs flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">
            Накоплено к выплате
          </p>
          {pending.length > 0 && (
            <p className="text-[10px] font-bold text-amber-600 mt-0.5">
              + ещё{' '}
              <Money
                amount={pending
                  .reduce((s: number, x: any) => s + parseFloat(x.amount), 0)
                  .toFixed(2)}
              />{' '}
              ожидает подтверждения
            </p>
          )}
        </div>
        <Money amount={accumulatedTotal} className="text-2xl font-black text-green-600" />
      </div>

      {/* История начислений */}
      <div className="space-y-3">
        {unpaidAccruals.length > 0 && (
          <div className="space-y-1.5">
            <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-200 pb-1.5">
              Ожидает выплаты
            </h2>
            {unpaidAccruals.map(renderAccrual)}
          </div>
        )}

        {paidAccruals.length > 0 && (
          <div className="space-y-1.5">
            <h2 className="text-[10px] font-black text-green-600 uppercase tracking-widest border-b border-green-200 pb-1.5">
              Уже выплачено
            </h2>
            {paidAccruals.map(renderAccrual)}
          </div>
        )}

        {accruals.length === 0 && (
          <div className="space-y-2">
            <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-200 pb-1.5">
              История начислений
            </h2>
            <p className="text-center py-8 text-zinc-400 font-bold uppercase text-xs">
              За последние 10 дней начислений нет
            </p>
          </div>
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
