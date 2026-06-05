/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Money, LifecycleBadge } from '@saldacargo/ui';
import { formatDate } from '@saldacargo/shared';

export default function AdminTripDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const queryClient = useQueryClient();
  const [returnNote, setReturnNote] = useState('');
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [showReissueForm, setShowReissueForm] = useState(false);
  const [actionError, setActionError] = useState('');

  const { data: trip, isLoading } = useQuery<any>({
    queryKey: ['admin-trip', id],
    queryFn: () => fetch(`/api/admin/trips/${id}`).then((r) => r.json()),
    staleTime: 0,
  });

  const action = useMutation({
    mutationFn: async (body: any) => {
      const r = await fetch(`/api/admin/trips/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Ошибка сервера');
      return data;
    },
    onSuccess: (_, variables) => {
      setActionError('');
      queryClient.invalidateQueries({ queryKey: ['admin-trip', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['admin-summary'] });
      if (variables.action === 'approve' || variables.action === 'return') {
        router.push('/admin/trips?filter=review');
      } else {
        setShowReissueForm(false);
      }
    },
    onError: (e: Error) => setActionError(e.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!trip || trip.error) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <p className="text-red-500 font-bold">{trip?.error ?? 'Рейс не найден'}</p>
      </div>
    );
  }

  const activeOrders = (trip.trip_orders ?? []).filter(
    (o: any) => o.lifecycle_status !== 'cancelled',
  );
  const revenue = activeOrders.reduce((s: number, o: any) => s + parseFloat(o.amount), 0);
  const driverPay = activeOrders.reduce((s: number, o: any) => s + parseFloat(o.driver_pay), 0);
  const loaderPay = activeOrders.reduce(
    (s: number, o: any) => s + parseFloat(o.loader_pay ?? '0'),
    0,
  );
  const expenses = (trip.trip_expenses ?? []).reduce(
    (s: number, e: any) => s + parseFloat(e.amount),
    0,
  );
  const mileage =
    trip.odometer_end && trip.odometer_start ? trip.odometer_end - trip.odometer_start : null;

  const isPendingReview = trip.status === 'completed' && trip.lifecycle_status === 'draft';
  const isApproved = trip.lifecycle_status === 'approved';

  // Анализ статуса ЗП
  const payrollTxns: any[] = trip.payroll_txns ?? [];
  const hasDisputed = payrollTxns.some(
    (t: any) =>
      t.lifecycle_status === 'cancelled' &&
      (t.cancelled_reason ?? '').includes('Отклонено сотрудником'),
  );
  const hasActivePayroll = payrollTxns.some(
    (t: any) =>
      t.lifecycle_status === 'approved' &&
      t.settlement_status === 'pending' &&
      t.employee_confirmed === false,
  );
  const hasConfirmedPayroll = payrollTxns.some(
    (t: any) =>
      t.lifecycle_status === 'approved' &&
      (t.employee_confirmed === null || t.employee_confirmed === true),
  );
  const salaryDisputed = hasDisputed && !hasActivePayroll && !hasConfirmedPayroll;

  // Уникальные грузчики из trip_orders для формы переназначения
  const loaderMap = new Map<string, { id: string; name: string; pay: number }>();
  for (const o of activeOrders) {
    if (o.loader_id) {
      const prev = loaderMap.get(o.loader_id) ?? {
        id: o.loader_id,
        name: o.loader?.name ?? 'Грузчик',
        pay: 0,
      };
      loaderMap.set(o.loader_id, { ...prev, pay: prev.pay + parseFloat(o.loader_pay ?? '0') });
    }
    if (o.loader2_id) {
      const prev = loaderMap.get(o.loader2_id) ?? {
        id: o.loader2_id,
        name: o.loader2?.name ?? 'Грузчик',
        pay: 0,
      };
      loaderMap.set(o.loader2_id, {
        ...prev,
        pay: prev.pay + parseFloat(o.loader2_pay ?? '0'),
      });
    }
  }
  const loaders = [...loaderMap.values()];

  const PAYMENT_LABELS: Record<string, string> = {
    cash: '💵 Нал',
    qr: '📱 QR',
    bank_invoice: '🏦 Безнал',
    debt_cash: '⏳ Долг',
    card_driver: '💳 Карта',
    fuel_card: '⛽ Топл.карта',
  };

  return (
    <div className="min-h-screen bg-zinc-50 pb-40">
      <header className="bg-white border-b-2 border-zinc-200 px-4 h-16 flex items-center gap-3 sticky top-0 z-40">
        <button onClick={() => router.back()} className="text-zinc-500 text-2xl">
          ←
        </button>
        <span className="font-black text-zinc-900 text-lg uppercase">Рейс №{trip.trip_number}</span>
        <div className="ml-auto">
          <LifecycleBadge status={trip.lifecycle_status} />
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Общая информация */}
        <section className="bg-white rounded-2xl border-2 border-zinc-100 p-4 shadow-sm space-y-2">
          <p className="font-black text-zinc-900">
            {trip.asset?.short_name}{' '}
            <span className="text-zinc-400 font-bold">{trip.asset?.reg_number}</span>
          </p>
          <p className="text-sm font-bold text-zinc-500">
            {trip.driver?.name}
            {trip.loader && <span className="text-blue-500"> + {trip.loader.name}</span>} ·{' '}
            {formatDate(trip.started_at)}
            {trip.ended_at && ` → ${formatDate(trip.ended_at)}`}
          </p>
          {mileage && <p className="text-sm font-bold text-zinc-500">Пробег: {mileage} км</p>}
          {trip.driver_note && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                Заметка водителя
              </p>
              <p className="text-sm text-amber-900 mt-1">{trip.driver_note}</p>
            </div>
          )}
        </section>

        {/* Итоги */}
        <section className={`grid gap-3 ${loaderPay > 0 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          <div className="bg-white rounded-2xl border-2 border-zinc-100 p-3 text-center shadow-sm">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Выручка</p>
            <Money amount={revenue.toString()} className="text-base font-black text-orange-600" />
          </div>
          <div className="bg-white rounded-2xl border-2 border-zinc-100 p-3 text-center shadow-sm">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
              ЗП {trip.driver?.name?.split(' ')[0]}
            </p>
            <Money amount={driverPay.toString()} className="text-base font-black text-green-600" />
          </div>
          {loaderPay > 0 && (
            <div className="bg-white rounded-2xl border-2 border-zinc-100 p-3 text-center shadow-sm">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                ЗП {trip.loader?.name?.split(' ')[0] ?? 'Грузчик'}
              </p>
              <Money amount={loaderPay.toString()} className="text-base font-black text-blue-500" />
            </div>
          )}
          <div className="bg-white rounded-2xl border-2 border-zinc-100 p-3 text-center shadow-sm">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Расходы</p>
            <Money amount={expenses.toString()} className="text-base font-black text-red-500" />
          </div>
        </section>

        {/* Статус ЗП (для утверждённых рейсов) */}
        {isApproved && (
          <section className="space-y-2">
            {salaryDisputed ? (
              <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-red-700 text-sm">⚠️ ЗП оспорена сотрудником</p>
                    <p className="text-xs text-red-600 mt-1">
                      Сотрудник не согласен с назначенной суммой. Скорректируйте ЗП.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowReissueForm(true)}
                    className="bg-red-600 text-white font-black text-[10px] px-3 py-2 rounded-xl uppercase tracking-wide active:scale-95 transition-all shrink-0"
                  >
                    Переназначить
                  </button>
                </div>
              </div>
            ) : hasActivePayroll ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
                <p className="text-xs font-bold text-amber-700">
                  ⏳ ЗП ожидает подтверждения сотрудника
                </p>
                <button
                  onClick={() => setShowReissueForm(true)}
                  className="text-[10px] font-black text-amber-700 underline"
                >
                  Изменить
                </button>
              </div>
            ) : hasConfirmedPayroll ? (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
                <p className="text-xs font-bold text-green-700">✓ ЗП подтверждена сотрудником</p>
              </div>
            ) : driverPay === 0 ? null : (
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
                <p className="text-xs font-bold text-zinc-500">ЗП не назначена</p>
                <button
                  onClick={() => setShowReissueForm(true)}
                  className="text-[10px] font-black text-zinc-600 underline"
                >
                  Назначить
                </button>
              </div>
            )}
          </section>
        )}

        {/* Форма переназначения ЗП */}
        {showReissueForm && (
          <ReissueSalaryForm
            driverName={(trip.driver as any)?.name ?? 'Водитель'}
            defaultDriverPay={driverPay}
            loaders={loaders}
            isPending={action.isPending}
            error={actionError}
            onSubmit={(driverPayStr, loaderPays) => {
              setActionError('');
              action.mutate({
                action: 'reissue_salary',
                driver_pay: driverPayStr,
                loader_pays: loaderPays,
              });
            }}
            onCancel={() => {
              setShowReissueForm(false);
              setActionError('');
            }}
          />
        )}

        {/* Заказы */}
        <section className="space-y-2">
          <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
            Заказы ({activeOrders.length})
          </h2>
          {activeOrders.length === 0 && (
            <p className="text-center text-zinc-400 font-bold text-xs py-4">Заказов нет</p>
          )}
          {activeOrders.map((order: any) => (
            <div
              key={order.id}
              className="bg-white rounded-xl border border-zinc-100 p-3 flex justify-between items-center shadow-sm"
            >
              <div>
                <p className="font-bold text-zinc-900 text-sm">
                  {order.counterparty?.name ?? order.description ?? 'Без названия'}
                </p>
                <p className="text-[10px] text-zinc-400 font-bold uppercase mt-0.5">
                  {PAYMENT_LABELS[order.payment_method] ?? order.payment_method} · Вод:{' '}
                  <Money amount={order.driver_pay} />
                  {parseFloat(order.loader_pay ?? '0') > 0 && (
                    <>
                      {' '}
                      · Груз: <Money amount={order.loader_pay} />
                    </>
                  )}
                </p>
              </div>
              <Money amount={order.amount} className="font-black text-zinc-900" />
            </div>
          ))}
        </section>

        {/* Расходы */}
        {(trip.trip_expenses ?? []).length > 0 && (
          <section className="space-y-2">
            <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
              Расходы ({trip.trip_expenses.length})
            </h2>
            {trip.trip_expenses.map((exp: any) => (
              <div
                key={exp.id}
                className="bg-white rounded-xl border border-zinc-100 p-3 flex justify-between items-center shadow-sm"
              >
                <div>
                  <p className="font-bold text-zinc-900 text-sm">{exp.category?.name}</p>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase mt-0.5">
                    {PAYMENT_LABELS[exp.payment_method] ?? exp.payment_method}
                    {exp.description ? ` · ${exp.description}` : ''}
                  </p>
                </div>
                <Money amount={exp.amount} className="font-black text-red-500" />
              </div>
            ))}
          </section>
        )}
      </main>

      {/* Кнопки действий (только для рейсов на ревью) */}
      {isPendingReview && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-zinc-200 p-4 space-y-3 z-50">
          {actionError && (
            <p className="text-red-600 text-xs font-black uppercase text-center bg-red-50 rounded-lg py-2 px-3">
              ❌ {actionError}
            </p>
          )}
          {showReturnForm ? (
            <div className="space-y-3">
              <textarea
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
                placeholder="Причина возврата (необязательно)"
                rows={2}
                className="w-full rounded-lg border-2 border-zinc-200 px-3 py-2 text-sm font-bold focus:border-orange-500 focus:outline-none resize-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setShowReturnForm(false);
                    setActionError('');
                  }}
                  className="h-12 rounded-lg border-2 border-zinc-200 font-black text-xs uppercase text-zinc-600 active:scale-95 transition-all"
                >
                  Отмена
                </button>
                <button
                  onClick={() => action.mutate({ action: 'return', note: returnNote })}
                  disabled={action.isPending}
                  className="h-12 rounded-lg bg-amber-500 text-white font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
                >
                  {action.isPending ? '...' : '↩ Вернуть'}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setShowReturnForm(true);
                  setActionError('');
                }}
                disabled={action.isPending}
                className="h-14 rounded-2xl border-2 border-amber-300 bg-amber-50 text-amber-700 font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
              >
                ↩ Вернуть
              </button>
              <button
                onClick={() => action.mutate({ action: 'approve' })}
                disabled={action.isPending}
                className="h-14 rounded-2xl bg-green-600 text-white font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-md disabled:opacity-50"
              >
                {action.isPending ? '⏳ Сохраняем...' : '✓ Одобрить'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReissueSalaryForm({
  driverName,
  defaultDriverPay,
  loaders,
  isPending,
  error,
  onSubmit,
  onCancel,
}: {
  driverName: string;
  defaultDriverPay: number;
  loaders: Array<{ id: string; name: string; pay: number }>;
  isPending: boolean;
  error: string;
  onSubmit: (
    driverPay: string,
    loaderPays: Array<{ user_id: string; name: string; amount: string }>,
  ) => void;
  onCancel: () => void;
}) {
  const [driverPayInput, setDriverPayInput] = useState(String(defaultDriverPay));
  const [loaderPayInputs, setLoaderPayInputs] = useState<Record<string, string>>(
    Object.fromEntries(loaders.map((l) => [l.id, String(l.pay)])),
  );

  const inputCls =
    'w-full border-2 border-zinc-200 rounded-xl px-3 py-3 text-base font-bold focus:outline-none focus:border-orange-400 transition-all';

  const handleSubmit = () => {
    const loaderPays = loaders
      .map((l) => ({ user_id: l.id, name: l.name, amount: loaderPayInputs[l.id] ?? '0' }))
      .filter((l) => parseFloat(l.amount) > 0);
    onSubmit(driverPayInput, loaderPays);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-white rounded-t-3xl w-full p-6 space-y-4 max-w-lg">
        <div className="w-10 h-1 bg-zinc-200 rounded-full mx-auto" />
        <p className="font-black text-zinc-900 text-base">Переназначить ЗП</p>
        <p className="text-xs text-zinc-500">
          Новое начисление будет создано с запросом подтверждения сотруднику.
        </p>

        <div>
          <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5">
            ЗП {driverName}
          </label>
          <input
            type="number"
            value={driverPayInput}
            onChange={(e) => setDriverPayInput(e.target.value)}
            className={inputCls}
            placeholder="0"
          />
        </div>

        {loaders.map((loader) => (
          <div key={loader.id}>
            <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5">
              ЗП грузчик {loader.name}
            </label>
            <input
              type="number"
              value={loaderPayInputs[loader.id] ?? ''}
              onChange={(e) =>
                setLoaderPayInputs((prev) => ({ ...prev, [loader.id]: e.target.value }))
              }
              className={inputCls}
              placeholder="0"
            />
          </div>
        ))}

        {error && (
          <p className="text-sm text-red-600 font-bold bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border-2 border-zinc-200 text-zinc-600 font-black py-3 rounded-xl text-sm uppercase active:scale-95 transition-all"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="flex-1 bg-orange-600 text-white font-black py-3 rounded-xl text-sm uppercase active:scale-95 transition-all disabled:opacity-50"
          >
            {isPending ? '...' : 'Переназначить'}
          </button>
        </div>
      </div>
    </div>
  );
}
