/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Money } from '@saldacargo/ui';

const schema = z.object({
  odometer_end: z.coerce.number().optional(),
  fuel_amount: z.coerce.number().optional(),
  fuel_payment_method: z.enum(['fuel_card', 'cash']).default('fuel_card'),
  driver_note: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function FinishTripPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data: trip } = useQuery({
    queryKey: ['trip', id],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${id}`);
      return res.json() as Promise<{
        trip_number: number;
        odometer_start: number;
        asset: { short_name: string };
        trip_orders: Array<{
          amount: string;
          driver_pay: string;
          payment_method: string;
          settlement_status: string;
          lifecycle_status: string;
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

  const { register, handleSubmit } = useForm<FormData>({
    resolver: zodResolver(schema as any) as any,
    defaultValues: {
      fuel_payment_method: 'fuel_card',
    },
  });

  const activeOrders = (trip?.trip_orders ?? []).filter((o) => o.lifecycle_status !== 'cancelled');
  const revenue = activeOrders.reduce((s, o) => s + parseFloat(o.amount), 0);
  const cashRevenue = activeOrders
    .filter((o) => o.payment_method === 'cash' || o.payment_method === 'card_driver')
    .reduce((s, o) => s + parseFloat(o.amount), 0);
  const nonCashRevenue = activeOrders
    .filter((o) => o.payment_method === 'qr' || o.payment_method === 'bank_invoice')
    .reduce((s, o) => s + parseFloat(o.amount), 0);

  const driverPay = activeOrders.reduce((s, o) => s + parseFloat(o.driver_pay), 0);
  const expenses = (trip?.trip_expenses ?? []).reduce((s, e) => s + parseFloat(e.amount), 0);

  const existingFuelExpenses = (trip?.trip_expenses ?? []).filter(
    (e) => e.category?.name === 'ГСМ' || e.payment_method === 'fuel_card',
  );
  const existingFuelAmount = existingFuelExpenses.reduce((s, e) => s + parseFloat(e.amount), 0);

  const existingCashExpenses = (trip?.trip_expenses ?? [])
    .filter((e) => e.payment_method === 'cash')
    .reduce((s, e) => s + parseFloat(e.amount), 0);

  const cashToSurrender = Math.max(0, cashRevenue - existingCashExpenses);
  const debtOrders = activeOrders.filter((o) => o.settlement_status === 'pending');

  async function onSubmit(data: FormData) {
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

    router.push('/');
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b-2 border-zinc-200 px-4 h-16 flex items-center gap-3 sticky top-0 z-50">
        <button
          onClick={() => router.back()}
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
        </div>

        {/* Заправка / Топливо за смену */}
        <div className="bg-white rounded-lg border-2 border-zinc-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b-2 border-zinc-50 pb-2">
            <h2 className="text-[11px] font-black text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>⛽</span> Заправка за смену (ГСМ)
            </h2>
            {existingFuelExpenses.length > 0 && (
              <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Внесено: {existingFuelAmount.toLocaleString('ru-RU')} ₽
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
              {existingFuelExpenses.length > 0
                ? 'Добавить ещё заправку, ₽ (если была)'
                : 'Сумма заправки, ₽ (если заправлялись)'}
            </label>
            <input
              type="number"
              inputMode="numeric"
              {...register('fuel_amount')}
              placeholder="0"
              className="w-full rounded-lg border-2 border-zinc-200 px-4 h-14 text-2xl font-black text-zinc-900 focus:border-amber-500 focus:outline-none transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
              Способ оплаты топлива
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="relative">
                <input
                  type="radio"
                  value="fuel_card"
                  {...register('fuel_payment_method')}
                  className="sr-only peer"
                />
                <div className="border-2 border-zinc-200 rounded-lg p-3 text-center cursor-pointer peer-checked:border-amber-600 peer-checked:bg-amber-50 peer-checked:text-amber-800 font-bold text-xs uppercase tracking-wide transition-all active:scale-[0.97] flex items-center justify-center gap-1.5">
                  <span>⛽</span> Топливная карта ТК
                </div>
              </label>
              <label className="relative">
                <input
                  type="radio"
                  value="cash"
                  {...register('fuel_payment_method')}
                  className="sr-only peer"
                />
                <div className="border-2 border-zinc-200 rounded-lg p-3 text-center cursor-pointer peer-checked:border-emerald-600 peer-checked:bg-emerald-50 peer-checked:text-emerald-800 font-bold text-xs uppercase tracking-wide transition-all active:scale-[0.97] flex items-center justify-center gap-1.5">
                  <span>💵</span> Наличные
                </div>
              </label>
            </div>
          </div>
        </div>

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

        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 text-red-700 text-xs font-bold uppercase tracking-wide">
            {error}
          </div>
        )}

        <Button
          type="submit"
          size="hero"
          disabled={submitting}
          className="font-black uppercase tracking-widest w-full"
        >
          {submitting ? 'Отправляем...' : '📤 Отправить на ревью'}
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
