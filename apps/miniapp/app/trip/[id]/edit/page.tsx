/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@saldacargo/ui';

const schema = z.object({
  trip_type: z.enum(['local', 'intercity', 'moving', 'hourly']),
});

type FormData = z.infer<typeof schema>;

const TRIP_TYPES = [
  { value: 'local', label: 'По городу' },
  { value: 'intercity', label: 'Межгород' },
  { value: 'moving', label: 'Переезд' },
  { value: 'hourly', label: 'Почасовой' },
] as const;

interface Trip {
  id: string;
  trip_number: number;
  trip_type: string;
  lifecycle_status: string;
  asset: { short_name: string };
}

export default function EditTripPage() {
  const params = useParams();
  const tripId = params.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);

  const { data: trip, isLoading } = useQuery<Trip>({
    queryKey: ['trip', tripId],
    queryFn: () => fetch(`/api/trips/${tripId}`).then((r) => r.json()),
    staleTime: 60000,
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema as any) as any,
    defaultValues: { trip_type: 'local' },
  });

  useEffect(() => {
    if (trip && !initialized) {
      setValue('trip_type', trip.trip_type as any);
      setInitialized(true);
    }
  }, [trip, initialized, setValue]);

  async function onSubmit(data: FormData) {
    if (submitting) return;
    setSubmitting(true);
    setError('');

    const res = await fetch(`/api/trips/${tripId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const json = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(json.error ?? 'Ошибка сохранения');
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
    router.push(`/trip/${tripId}`);
  }

  if (isLoading || !initialized) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="animate-spin text-3xl">⚙️</div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-4xl mb-4">🔍</p>
          <p className="text-zinc-600 font-bold uppercase tracking-tight">Рейс не найден</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 text-orange-600 font-black uppercase tracking-widest text-sm"
          >
            На главную
          </button>
        </div>
      </div>
    );
  }

  if (trip.lifecycle_status === 'approved') {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-4xl mb-4">🔒</p>
          <p className="text-zinc-600 font-bold uppercase tracking-tight">
            Рейс одобрен — редактирование запрещено
          </p>
          <button
            onClick={() => router.push(`/trip/${tripId}`)}
            className="mt-4 text-orange-600 font-black uppercase tracking-widest text-sm"
          >
            Назад
          </button>
        </div>
      </div>
    );
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
        <div>
          <h1 className="font-black text-zinc-900 text-lg uppercase tracking-tight leading-tight">
            Изменить рейс №{trip.trip_number}
          </h1>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
            {trip.asset.short_name}
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-6 pb-28">
        {/* Тип рейса */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
            Тип рейса
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TRIP_TYPES.map((t) => (
              <label key={t.value} className="relative">
                <input
                  type="radio"
                  value={t.value}
                  {...register('trip_type')}
                  className="sr-only peer"
                />
                <div className="border-2 border-zinc-200 rounded-lg p-3 text-center cursor-pointer peer-checked:border-orange-600 peer-checked:bg-orange-50 peer-checked:text-orange-700 font-bold text-xs uppercase tracking-wide transition-all active:scale-[0.97]">
                  {t.label}
                </div>
              </label>
            ))}
          </div>
          {errors.trip_type && (
            <p className="text-red-500 text-xs font-bold pl-1">{errors.trip_type.message}</p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 text-red-700 text-xs font-bold uppercase tracking-wide">
            {error}
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t-2 border-zinc-200 z-50">
          <Button
            type="submit"
            size="hero"
            disabled={submitting}
            className="font-black uppercase tracking-widest"
          >
            {submitting ? 'Сохраняем...' : '✅ Сохранить'}
          </Button>
        </div>
      </form>
    </div>
  );
}
