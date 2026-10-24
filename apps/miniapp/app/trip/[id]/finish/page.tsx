/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Money } from '@saldacargo/ui';

import {
  isGeostroyCounterparty,
  isGeostroyOrderValid,
  checkOdometerRequirement,
} from '@saldacargo/shared';

const schema = z.object({
  odometer_end: z.coerce.number().optional(),
  driver_note: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function FinishTripPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data: trip } = useQuery({
    queryKey: ['trip', id],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${id}`);
      return res.json() as Promise<{
        trip_number: number;
        trip_type?: string;
        odometer_start: number;
        asset: {
          short_name: string;
          reg_number?: string;
          asset_type_code?: string;
          asset_type?: { code?: string };
          odometer_current?: number;
        } | null;
        trip_orders: Array<{
          id: string;
          amount: string;
          driver_pay: string;
          payment_method: string;
          settlement_status: string;
          lifecycle_status: string;
          description?: string | null;
          counterparty?: { name: string } | null;
        }>;
        trip_expenses: Array<{
          id: string;
          amount: string;
          payment_method: string;
          description?: string;
          category?: { name: string };
        }>;
      }>;
    },
  });

  const { register, handleSubmit, watch } = useForm<FormData>({
    resolver: zodResolver(schema as any) as any,
  });

  const odoEndVal = watch('odometer_end');
  const odoEndNum = odoEndVal != null && !isNaN(Number(odoEndVal)) ? Number(odoEndVal) : null;
  const startOdo = trip?.odometer_start ?? trip?.asset?.odometer_current ?? 0;
  const tripMileage =
    odoEndNum && startOdo > 0 && odoEndNum >= startOdo ? odoEndNum - startOdo : null;
  const odoReq = checkOdometerRequirement(trip?.asset);

  const activeOrders = (trip?.trip_orders ?? []).filter((o) => o.lifecycle_status !== 'cancelled');
  const revenue = activeOrders.reduce((s, o) => s + parseFloat(o.amount), 0);
  const cashRevenue = activeOrders
    .filter((o) => o.payment_method === 'cash')
    .reduce((s, o) => s + parseFloat(o.amount), 0);
  const nonCashRevenue = activeOrders
    .filter(
      (o) =>
        o.payment_method === 'qr' ||
        o.payment_method === 'bank_invoice' ||
        o.payment_method === 'card_driver',
    )
    .reduce((s, o) => s + parseFloat(o.amount), 0);

  const driverPay = activeOrders.reduce((s, o) => s + parseFloat(o.driver_pay), 0);
  const expenses = (trip?.trip_expenses ?? []).reduce((s, e) => s + parseFloat(e.amount), 0);

  const existingCashExpenses = (trip?.trip_expenses ?? [])
    .filter((e) => e.payment_method === 'cash')
    .reduce((s, e) => s + parseFloat(e.amount), 0);

  const cashToSurrender = Math.max(0, cashRevenue - existingCashExpenses);
  const debtOrders = activeOrders.filter((o) => o.settlement_status === 'pending');

  const invalidGeostroyOrders = activeOrders.filter(
    (o) => isGeostroyCounterparty(o.counterparty?.name) && !isGeostroyOrderValid(o.description),
  );
  const hasGeostroyValidationError = invalidGeostroyOrders.length > 0;

  async function onSubmit(data: FormData) {
    if (hasGeostroyValidationError) {
      setError(
        'Нельзя отправить рейс на ревью: для контрагента «ООО Геостройиндустрия» обязательно укажите маршрут и дату начала маршрута по маске (ДД.ММ.ГГГГ).',
      );
      return;
    }

    const odoNum =
      data.odometer_end != null && !isNaN(Number(data.odometer_end))
        ? Number(data.odometer_end)
        : null;
    const minOdo = trip?.odometer_start || trip?.asset?.odometer_current || 0;

    if (odoReq.required && (!odoNum || odoNum <= 0)) {
      setError(`${odoReq.message} Укажите показания одометра для завершения смены.`);
      return;
    }

    if (odoNum != null && odoNum > 0 && minOdo > 0 && odoNum < minOdo) {
      setError(
        `Конечный одометр (${odoNum.toLocaleString('ru-RU')} км) не может быть меньше начального (${minOdo.toLocaleString('ru-RU')} км).`,
      );
      return;
    }

    setSubmitting(true);
    setError('');

    const res = await fetch(`/api/trips/${id}/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const result = (await res.json()) as { error?: string };
      setError(result.error ?? 'Ошибка');
      setSubmitting(false);
      return;
    }

    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['driver-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['driver-trips'] }),
        queryClient.invalidateQueries({ queryKey: ['trip', id] }),
      ]);
    } catch {
      // ignore
    }

    router.replace('/driver');
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b-2 border-zinc-200 px-4 h-16 flex items-center gap-3 sticky top-0 z-50">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined' && window.history.length > 1) {
              router.back();
            } else {
              router.push(`/trip/${id}`);
            }
          }}
          className="text-zinc-500 text-2xl active:scale-95 transition-transform"
        >
          ←
        </button>
        <h1 className="font-black text-zinc-900 text-lg uppercase tracking-tight">
          Отчёт за смену (Рейс №{trip?.trip_number ?? ''})
        </h1>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-6 pb-8">
        {/* Сводка */}
        <div className="bg-white rounded-lg border-2 border-zinc-200 p-4 shadow-sm space-y-3">
          <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b-2 border-zinc-50 pb-2">
            Итоги рейса
          </h2>
          <SummaryRow label="Заказов" value={String(activeOrders.length)} />
          <SummaryRow label="Выручка всего" value={<Money amount={revenue.toString()} />} />
          <SummaryRow
            label="💵 Наличные клиенты"
            value={<Money amount={cashRevenue.toString()} />}
          />
          {nonCashRevenue > 0 && (
            <SummaryRow
              label="⚡ QR / Безнал"
              value={<Money amount={nonCashRevenue.toString()} />}
            />
          )}
          <SummaryRow label="ЗП водителя" value={<Money amount={driverPay.toString()} />} />
          {expenses > 0 && (
            <SummaryRow label="Расходы рейса" value={<Money amount={expenses.toString()} />} />
          )}
          <div className="pt-2 border-t-2 border-zinc-100 flex items-center justify-between">
            <span className="text-xs font-black text-emerald-800 uppercase tracking-tight">
              💵 Сдать в кассу (нал)
            </span>
            <span className="text-base font-black text-emerald-600">
              <Money amount={cashToSurrender.toString()} />
            </span>
          </div>
          {debtOrders.length > 0 && (
            <SummaryRow
              label="⏳ Долги"
              value={
                <span className="text-amber-600">
                  <Money
                    amount={debtOrders.reduce((s, o) => s + parseFloat(o.amount), 0).toString()}
                  />{' '}
                  ({debtOrders.length} кл.)
                </span>
              }
            />
          )}
          {tripMileage != null && (
            <SummaryRow
              label="🛣️ Пробег за смену"
              value={<span className="text-emerald-600 font-black">+{tripMileage} км</span>}
            />
          )}
        </div>

        {/* Одометр */}
        {trip?.trip_type !== 'loaders_only' && trip?.asset?.reg_number !== 'БЕЗ АВТО' && (
          <div className="bg-white rounded-lg border-2 border-zinc-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-black text-zinc-900 uppercase tracking-wider">
                Одометр на конец смены, км{' '}
                {odoReq.required && <span className="text-red-500">*</span>}
              </label>
              {odoReq.required ? (
                <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                  Обязательно
                </span>
              ) : (
                <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded">
                  Необязательно
                </span>
              )}
            </div>

            <div className="text-xs text-zinc-500 font-medium">
              {startOdo > 0 && (
                <span>
                  Начальный одометр: <strong>{startOdo.toLocaleString('ru-RU')} км</strong>.{' '}
                </span>
              )}
              {odoReq.message}
            </div>

            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                {...register('odometer_end')}
                placeholder={startOdo > 0 ? String(startOdo) : '0'}
                className="w-full rounded-lg border-2 border-zinc-200 px-4 h-14 text-2xl font-black text-zinc-900 focus:border-orange-500 focus:outline-none transition-colors"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                км
              </span>
            </div>

            {tripMileage != null && tripMileage >= 0 && (
              <div className="text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center">
                Пробег за смену: +{tripMileage.toLocaleString('ru-RU')} км
              </div>
            )}
          </div>
        )}

        {/* Заметка */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
            Заметка для админа (опционально)
          </label>
          <textarea
            {...register('driver_note')}
            rows={3}
            placeholder="Всё хорошо / Стучит подвеска / Клиент просил перезвонить"
            className="w-full rounded-lg border-2 border-zinc-200 px-4 py-3 text-sm font-bold text-zinc-900 focus:border-orange-500 focus:outline-none transition-colors resize-none"
          />
        </div>

        {hasGeostroyValidationError && (
          <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 space-y-2.5 shadow-xs">
            <div className="flex items-center gap-2 text-rose-900 font-black text-xs uppercase tracking-wide">
              <span className="text-lg">🛑</span>
              <span>Нельзя отправить рейс на ревью</span>
            </div>
            <p className="text-xs text-rose-800 font-medium leading-relaxed">
              В рейсе есть заказ для <strong>«ООО Геостройиндустрия»</strong>, в котором не
              заполнены <strong>Маршрут</strong> или <strong>Дата начала маршрута</strong> по маске
              (ДД.ММ.ГГГГ).
            </p>
            <div className="pt-1 space-y-2">
              {invalidGeostroyOrders.map((o, idx) => (
                <button
                  key={o.id || idx}
                  type="button"
                  onClick={() => router.push(`/trip/${id}/order/${o.id}`)}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
                >
                  <span>✏️</span> Заполнить маршрут и дату в заказе
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 text-red-700 text-xs font-bold uppercase tracking-wide">
            {error}
          </div>
        )}

        <Button
          type="submit"
          size="hero"
          disabled={submitting || hasGeostroyValidationError}
          className="font-black uppercase tracking-widest w-full disabled:opacity-50"
        >
          {submitting
            ? 'Отправляем...'
            : hasGeostroyValidationError
              ? '🛑 Заполните данные Геостройиндустрия'
              : '📤 Отправить на ревью'}
        </Button>
      </form>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-zinc-50 last:border-0">
      <span className="text-xs font-bold text-zinc-400 uppercase tracking-tight">{label}</span>
      <span className="text-sm font-black text-zinc-900">{value}</span>
    </div>
  );
}
