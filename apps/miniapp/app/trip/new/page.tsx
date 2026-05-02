/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { Button } from '@saldacargo/ui';
import { useQuery, useMutation } from '@tanstack/react-query';

const schema = z.object({
  asset_id: z.string().min(1, 'Выберите машину'),
  trip_type: z.enum(['local', 'intercity', 'moving', 'hourly']),
  loader_id: z.string().optional(),
  odometer_start: z.coerce.number().min(0, 'Введите одометр'),
});

type FormData = z.infer<typeof schema>;

const TRIP_TYPES = [
  { value: 'local', label: 'По городу' },
  { value: 'intercity', label: 'Межгород' },
  { value: 'moving', label: 'Переезд' },
  { value: 'hourly', label: 'Почасовой' },
] as const;

export default function NewTripPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  // ─── Загрузка данных через TanStack Query ───────────────────────────────

  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ['driver', 'assets'],
    queryFn: () => fetch('/api/driver/assets').then((r) => r.ok ? r.json() : []),
  });

  const { data: loaders = [], isLoading: loadersLoading } = useQuery({
    queryKey: ['driver', 'loaders'],
    queryFn: () => fetch('/api/driver/loaders').then((r) => r.ok ? r.json() : []),
  });

  const { data: me } = useQuery({
    queryKey: ['driver', 'me'],
    queryFn: () => fetch('/api/driver/me').then((r) => r.ok ? r.json() : null),
  });

  // ─── Форма ─────────────────────────────────────────────────────────────

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema as any) as any,
    defaultValues: {
      trip_type: 'local',
    },
  });

  const selectedAssetId = watch('asset_id');
  const selectedAsset = assets.find((a: any) => a.id === selectedAssetId);

  // Автоматически выбираем закрепленную машину
  useEffect(() => {
    if (me?.current_asset_id && assets.length > 0 && !selectedAssetId) {
      setValue('asset_id', me.current_asset_id);
    }
  }, [me, assets, setValue, selectedAssetId]);

  // Подставляем текущий одометр при выборе машины
  useEffect(() => {
    if (selectedAsset) {
      setValue('odometer_start', selectedAsset.odometer_current);
    }
  }, [selectedAsset, setValue]);

  // ─── Создание рейса ────────────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          idempotency_key: uuid(),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Ошибка при создании рейса');
      return result;
    },
    onSuccess: (data) => {
      router.push(`/trip/${data.id}`);
    },
    onError: (err: any) => {
      setError(err.message);
    },
  });

  const onSubmit = (data: FormData) => mutation.mutate(data);

  const isLoading = assetsLoading || loadersLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-zinc-400 font-bold uppercase tracking-widest animate-pulse">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b-2 border-zinc-200 px-4 h-16 flex items-center gap-3 sticky top-0 z-50">
        <button onClick={() => router.back()} className="text-zinc-500 text-2xl active:scale-95 transition-transform">
          ←
        </button>
        <h1 className="font-black text-zinc-900 text-lg uppercase tracking-tight">Новый рейс</h1>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-6 pb-28">
        {/* Машина */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Машина</label>
          <div className="relative">
            <select
              {...register('asset_id')}
              className="w-full rounded-lg border-2 border-zinc-200 px-4 h-14 text-zinc-900 bg-white font-bold focus:border-orange-500 focus:outline-none transition-colors appearance-none"
            >
              <option value="">Выберите машину</option>
              {assets.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.short_name} ({a.reg_number})
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">▼</div>
          </div>
          {assets.length === 0 && !assetsLoading && (
            <p className="text-orange-600 text-[10px] font-bold mt-1 pl-1">⚠ Список машин пуст. Проверьте БД.</p>
          )}
          {errors.asset_id && (
            <p className="text-red-500 text-xs font-bold mt-1 pl-1">{errors.asset_id.message}</p>
          )}
        </div>

        {/* Тип рейса */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Тип рейса</label>
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
        </div>

        {/* Грузчик */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Грузчик</label>
          <div className="relative">
            <select
              {...register('loader_id')}
              className="w-full rounded-lg border-2 border-zinc-200 px-4 h-14 text-zinc-900 bg-white font-bold focus:border-orange-500 focus:outline-none transition-colors appearance-none"
            >
              <option value="">Без грузчика</option>
              {loaders.map((l: any) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">▼</div>
          </div>
        </div>

        {/* Одометр */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Одометр (км)</label>
          <input
            type="number"
            inputMode="numeric"
            {...register('odometer_start')}
            placeholder="340 100"
            className="w-full rounded-lg border-2 border-zinc-200 px-4 h-14 text-zinc-900 text-2xl font-black focus:border-orange-500 focus:outline-none transition-colors"
          />
          {selectedAsset && (
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide mt-1 pl-1">
              Последнее значение: {selectedAsset.odometer_current.toLocaleString('ru-RU')} км
            </p>
          )}
          {errors.odometer_start && (
            <p className="text-red-500 text-xs font-bold mt-1 pl-1">{errors.odometer_start.message}</p>
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
            disabled={mutation.isPending} 
            className="font-black uppercase tracking-widest"
          >
            {mutation.isPending ? 'Создаём рейс...' : '▶ Поехали'}
          </Button>
        </div>
      </form>
    </div>
  );
}
