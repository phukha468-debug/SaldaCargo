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
  odometer_end: z.coerce.number().positive('Введите одометр'),
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
          amount: string;
        }>;
      }>;
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema as any) as any,
  });

  const odometerEndRaw = watch('odometer_end');
  const odometerEnd = odometerEndRaw ? Number(odometerEndRaw) : 0;
  const mileage = odometerEnd && trip?.odometer_start ? odometerEnd - trip.odometer_start : 0;

  const activeOrders = (trip?.trip_orders ?? []).filter((o) => o.lifecycle_status !== 'cancelled');
  const revenue = activeOrders.reduce((s, o) => s + parseFloat(o.amount), 0);
  const driverPay = activeOrders.reduce((s, o) => s + parseFloat(o.driver_pay), 0);
  const expenses = (trip?.trip_expenses ?? []).reduce((s, e) => s + parseFloat(e.amount), 0);
  const debtOrders = activeOrders.filter((o) => o.settlement_status === 'pending');

  async function onSubmit(data: FormData) {
    if (mileage < 0) {
      setError('Конечный одометр не может быть меньше начального');
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
          Завершить рейс
        </h1>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-6 pb-8">
        {/* Сводка */}
        <div className="bg-white rounded-lg border-2 border-zinc-200 p-4 shadow-sm space-y-3">
          <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b-2 border-zinc-50 pb-2">
            Итоги рейса
          </h2>
          <SummaryRow label="Заказов" value={String(activeOrders.length)} />
          <SummaryRow label="Выручка" value={<Money amount={revenue.toString()} />} />
          <SummaryRow label="ЗП водителя" value={<Money amount={driverPay.toString()} />} />
          <SummaryRow label="Расходы" value={<Money amount={expenses.toString()} />} />
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
          {mileage > 0 && <SummaryRow label="Пробег" value={`${mileage} км`} />}
        </div>

        {/* Конечный одометр */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
            Конечный одометр (км)
          </label>
          {trip && (
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide mt-1 pl-1 mb-2">
              Начальный: {trip.odometer_start.toLocaleString('ru-RU')} км
            </p>
          )}
          <input
            type="number"
            inputMode="numeric"
            {...register('odometer_end')}
            placeholder="340 160"
            className="w-full rounded-lg border-2 border-zinc-200 px-4 h-16 text-3xl font-black text-zinc-900 focus:border-orange-500 focus:outline-none transition-colors"
            onFocus={(e) =>
              setTimeout(
                () => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }),
                300,
              )
            }
          />
          {errors.odometer_end && (
            <p className="text-red-500 text-xs font-bold mt-1 pl-1">
              {errors.odometer_end.message}
            </p>
          )}
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
