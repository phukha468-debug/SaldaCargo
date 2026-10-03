/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { Button } from '@saldacargo/ui';

const FUEL_CAT_ID = '62cebf3f-9982-4cc6-904b-48c6169cf5e4';

const schema = z.object({
  amount: z.coerce.number().positive('Введите сумму заправки'),
  payment_method: z.enum(['fuel_card', 'cash']),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const PAYMENT_METHODS = [
  { value: 'fuel_card', label: 'Топливная ТК', icon: '⛽' },
  { value: 'cash', label: 'Наличные', icon: '💵' },
] as const;

export default function AddFuelExpensePage() {
  const params = useParams();
  const tripId = params.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey] = useState(() => uuid());

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema as any) as any,
    defaultValues: {
      payment_method: 'fuel_card',
    },
  });

  const selectedPaymentMethod = watch('payment_method');

  async function onSubmit(data: FormData) {
    if (submitting) return;
    setSubmitting(true);

    const payload = JSON.stringify({
      category_id: FUEL_CAT_ID,
      amount: String(data.amount),
      payment_method: data.payment_method,
      description: data.description?.trim() || null,
      idempotency_key: idempotencyKey,
    });

    // Navigate immediately — server request runs in background
    router.push(`/trip/${tripId}`);

    fetch(`/api/trips/${tripId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['driver-summary'] });
    });
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
        <h1 className="font-black text-zinc-900 text-lg uppercase tracking-tight flex items-center gap-2">
          <span>⛽</span> Ввод ГСМ
        </h1>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-6 pb-28 max-w-lg mx-auto">
        {/* Сумма */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
            Сумма заправки, ₽
          </label>
          <input
            type="number"
            inputMode="numeric"
            autoFocus
            {...register('amount')}
            placeholder="1 500"
            className="w-full rounded-xl border-2 border-zinc-200 px-4 h-16 text-3xl font-black text-zinc-900 focus:border-amber-500 focus:outline-none transition-colors"
          />
          {errors.amount && (
            <p className="text-red-500 text-xs font-bold mt-1 pl-1">{errors.amount.message}</p>
          )}
        </div>

        {/* Способ оплаты */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
            Способ оплаты топлива
          </label>
          <div className="grid grid-cols-2 gap-3">
            {PAYMENT_METHODS.map((m) => (
              <label key={m.value} className="relative">
                <input
                  type="radio"
                  value={m.value}
                  {...register('payment_method')}
                  className="sr-only peer"
                />
                <div className="flex flex-col items-center justify-center gap-1.5 border-2 border-zinc-200 rounded-xl h-24 cursor-pointer peer-checked:border-amber-600 peer-checked:bg-amber-50 peer-checked:text-amber-900 transition-all active:scale-95">
                  <span className="text-3xl">{m.icon}</span>
                  <span className="text-xs font-black text-center leading-tight uppercase tracking-tight">
                    {m.label}
                  </span>
                </div>
              </label>
            ))}
          </div>
          {selectedPaymentMethod === 'fuel_card' && (
            <p className="text-[11px] text-amber-800 font-medium bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-2">
              ⛽ Топливная карта ТК — заправка списывается с баланса карты компании.
            </p>
          )}
          {selectedPaymentMethod === 'cash' && (
            <p className="text-[11px] text-emerald-800 font-medium bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 mt-2">
              💵 Наличные — оплачено водителем из выручки рейса. Уменьшает сумму к сдаче в кассу.
            </p>
          )}
        </div>

        {/* Описание */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
            Примечание (литры, АЗС — опционально)
          </label>
          <input
            type="text"
            {...register('description')}
            placeholder="Например: 35 л, Газпромнефть"
            className="w-full rounded-xl border-2 border-zinc-200 px-4 h-14 text-sm font-bold text-zinc-900 focus:border-amber-500 focus:outline-none transition-colors"
          />
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t-2 border-zinc-200 z-50">
          <div className="max-w-lg mx-auto">
            <Button
              type="submit"
              size="hero"
              disabled={submitting}
              className="w-full font-black uppercase tracking-widest bg-amber-600 hover:bg-amber-500 text-white"
            >
              {submitting ? 'Сохраняем...' : '✅ Сохранить ГСМ'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
