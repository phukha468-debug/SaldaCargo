/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { Button } from '@saldacargo/ui';

const schema = z.object({
  category_id: z.string().min(1, 'Выберите категорию'),
  amount: z.coerce.number().positive('Введите сумму'),
  payment_method: z.enum(['cash', 'card_driver', 'fuel_card']),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Наличные', icon: '💵' },
  { value: 'card_driver', label: 'Карта', icon: '💳' },
  { value: 'fuel_card', label: 'Топливная', icon: '⛽' },
] as const;

export default function AddExpensePage() {
  const params = useParams();
  const tripId = params.id as string;
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [idempotencyKey] = useState(() => uuid());

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema as any) as any,
    defaultValues: {
      payment_method: 'cash',
    },
  });

  const selectedPaymentMethod = watch('payment_method');

  useEffect(() => {
    fetch('/api/driver/categories')
      .then((r) => r.json())
      .then(setCategories)
      .catch(console.error);
  }, []);

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    setError('');

    const res = await fetch(`/api/trips/${tripId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        amount: String(data.amount),
        idempotency_key: idempotencyKey,
      }),
    });

    if (!res.ok) {
      const result = (await res.json()) as { error?: string };
      setError(result.error ?? 'Ошибка');
      setSubmitting(false);
      return;
    }

    router.push(`/trip/${tripId}`);
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b-2 border-zinc-200 px-4 h-16 flex items-center gap-3 sticky top-0 z-50">
        <button onClick={() => router.back()} className="text-zinc-500 text-2xl active:scale-95 transition-transform">
          ←
        </button>
        <h1 className="font-black text-zinc-900 text-lg uppercase tracking-tight">Добавить расход</h1>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-6 pb-28">
        {/* Категория */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Категория</label>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((c) => (
              <label key={c.id} className="relative">
                <input
                  type="radio"
                  value={c.id}
                  {...register('category_id')}
                  className="sr-only peer"
                />
                <div className="border-2 border-zinc-200 rounded-lg p-3 text-center cursor-pointer peer-checked:border-orange-600 peer-checked:bg-orange-50 peer-checked:text-orange-700 font-bold text-xs uppercase tracking-wide transition-all active:scale-[0.97]">
                  {c.name}
                </div>
              </label>
            ))}
          </div>
          {errors.category_id && (
            <p className="text-red-500 text-xs font-bold mt-1 pl-1">{errors.category_id.message}</p>
          )}
        </div>

        {/* Сумма */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Сумма расхода, ₽</label>
          <input
            type="number"
            inputMode="numeric"
            {...register('amount')}
            placeholder="1 500"
            className="w-full rounded-lg border-2 border-zinc-200 px-4 h-16 text-3xl font-black text-zinc-900 focus:border-orange-500 focus:outline-none transition-colors"
          />
          {errors.amount && <p className="text-red-500 text-xs font-bold mt-1 pl-1">{errors.amount.message}</p>}
        </div>

        {/* Способ оплаты */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Способ оплаты</label>
          <div className="flex gap-2">
            {PAYMENT_METHODS.map((m) => (
              <label key={m.value} className="flex-1">
                <input
                  type="radio"
                  value={m.value}
                  {...register('payment_method')}
                  className="sr-only peer"
                />
                <div className="flex flex-col items-center justify-center gap-1 border-2 border-zinc-200 rounded-lg h-20 cursor-pointer peer-checked:border-orange-600 peer-checked:bg-orange-50 transition-all active:scale-95">
                  <span className="text-2xl">{m.icon}</span>
                  <span className="text-[9px] font-black text-center leading-tight uppercase tracking-tighter">{m.label}</span>
                </div>
              </label>
            ))}
          </div>
          {selectedPaymentMethod === 'fuel_card' && (
            <p className="text-[10px] text-orange-600 font-bold uppercase tracking-wide mt-2 bg-orange-50 p-2 rounded border border-orange-100">
              Заправки по картам Опти24 обычно загружаются автоматически, используйте это только для ручного ввода чека.
            </p>
          )}
        </div>

        {/* Описание */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Описание (опционально)</label>
          <input
            type="text"
            {...register('description')}
            placeholder="Например: Мойка кузова"
            className="w-full rounded-lg border-2 border-zinc-200 px-4 h-14 text-sm font-bold text-zinc-900 focus:border-orange-500 focus:outline-none transition-colors"
          />
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 text-red-700 text-xs font-bold uppercase tracking-wide">
            {error}
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t-2 border-zinc-200 z-50">
          <Button type="submit" size="hero" disabled={submitting} className="font-black uppercase tracking-widest">
            {submitting ? 'Сохраняем...' : '✅ Добавить расход'}
          </Button>
        </div>
      </form>
    </div>
  );
}
