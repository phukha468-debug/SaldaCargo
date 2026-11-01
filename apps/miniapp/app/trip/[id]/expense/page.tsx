/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { Button } from '@saldacargo/ui';
import { calculateCubeFuel } from '@saldacargo/shared';

const FUEL_CAT_ID = '62cebf3f-9982-4cc6-904b-48c6169cf5e4';

const schema = z.object({
  amount: z.coerce.number().optional(),
  payment_method: z.enum(['cube', 'fuel_card', 'cash']),
  liters: z.coerce.number().optional(),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const PAYMENT_METHODS = [
  { value: 'cube', label: 'Кубик(база)', icon: '🛢️' },
  { value: 'fuel_card', label: 'ТК(топливная карта)', icon: '⛽' },
  { value: 'cash', label: 'Наличные', icon: '💵' },
] as const;

export default function AddFuelExpensePage() {
  const params = useParams();
  const tripId = params.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey] = useState(() => uuid());

  const { data: trip } = useQuery<any>({
    queryKey: ['trip', tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) throw new Error('Ошибка загрузки рейса');
      return res.json();
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema as any) as any,
    defaultValues: {
      payment_method: 'cube',
    },
  });

  const selectedPaymentMethod = watch('payment_method');

  // Автоматический расчет кубика по одометру
  const startOdo = Number(trip?.odometer_start ?? 0);
  const endOdo = Number(
    trip?.odometer_end && trip.odometer_end > startOdo
      ? trip.odometer_end
      : trip?.asset?.odometer_current && trip.asset.odometer_current > startOdo
        ? trip.asset.odometer_current
        : startOdo + 100,
  );
  const deltaKm = Math.max(100, endOdo - startOdo);
  const cubeCalc = calculateCubeFuel(deltaKm, trip?.asset?.type_code, trip?.asset);

  async function onSubmit(data: FormData) {
    if (submitting) return;

    const finalAmount = data.payment_method === 'cube' ? cubeCalc.amount : Number(data.amount);

    if (!finalAmount || finalAmount <= 0) {
      alert('Укажите корректную сумму');
      return;
    }

    setSubmitting(true);

    const desc =
      data.payment_method === 'cube'
        ? `Кубик: ${cubeCalc.liters} л`
        : data.description?.trim() || null;

    const payload = JSON.stringify({
      category_id: FUEL_CAT_ID,
      amount: String(finalAmount),
      payment_method: data.payment_method,
      description: desc,
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
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined' && window.history.length > 1) {
              router.back();
            } else {
              router.push(`/trip/${tripId}`);
            }
          }}
          className="text-zinc-500 text-2xl active:scale-95 transition-transform"
        >
          ←
        </button>
        <h1 className="font-black text-zinc-900 text-lg uppercase tracking-tight flex items-center gap-2">
          <span>⛽</span> Ввод ГСМ
        </h1>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-5 pb-28 max-w-lg mx-auto">
        {/* Способ оплаты топлива: строго 3 кнопки */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
            Способ оплаты
          </label>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <label key={m.value} className="relative">
                <input
                  type="radio"
                  value={m.value}
                  {...register('payment_method')}
                  className="sr-only peer"
                />
                <div className="flex flex-col items-center justify-center gap-1 border-2 border-zinc-200 rounded-xl h-20 cursor-pointer peer-checked:border-orange-500 peer-checked:bg-orange-50 peer-checked:text-orange-950 transition-all active:scale-95 px-1">
                  <span className="text-2xl">{m.icon}</span>
                  <span className="text-[11px] font-black text-center leading-tight uppercase tracking-tight line-clamp-1">
                    {m.label}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {selectedPaymentMethod === 'cube' ? (
          /* КУБИК: никаких полей ввода, никаких пояснений. Только результат авторасчёта */
          <div className="flex items-center justify-between p-4 bg-orange-50 border-2 border-orange-200 rounded-xl">
            <div>
              <div className="text-sm font-bold text-zinc-800">Пробег: {cubeCalc.km} км</div>
              <div className="text-xs text-zinc-600">
                {cubeCalc.liters} л по {cubeCalc.pricePerLiter} ₽/л
              </div>
            </div>
            <div className="text-2xl font-black text-orange-600">{cubeCalc.amount} ₽</div>
          </div>
        ) : (
          /* ТК или Наличные: ввод суммы и примечания */
          <>
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

            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
                Примечание (АЗС / литры)
              </label>
              <input
                type="text"
                {...register('description')}
                placeholder="Например: 35 л, Газпромнефть"
                className="w-full rounded-xl border-2 border-zinc-200 px-4 h-14 text-sm font-bold text-zinc-900 focus:border-amber-500 focus:outline-none transition-colors"
              />
            </div>
          </>
        )}

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
