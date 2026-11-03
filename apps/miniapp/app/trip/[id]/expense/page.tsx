/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { Button } from '@saldacargo/ui';
import { calculateCubeFuel, getVehicleFuelRate } from '@saldacargo/shared';

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
  { value: 'fuel_card', label: 'ТК(карта)', icon: '⛽' },
  { value: 'cash', label: 'Наличные', icon: '💵' },
] as const;

export default function AddFuelExpensePage() {
  const params = useParams();
  const tripId = params.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey] = useState(() => uuid());

  // Режим ввода пробега: по текущему одометру или по километрам за рейс
  const [inputMode, setInputMode] = useState<'odometer' | 'mileage'>('odometer');
  const [mileageInput, setMileageInput] = useState<string>('');
  const [odometerInput, setOdometerInput] = useState<string>('');

  const { data: trip } = useQuery<any>({
    queryKey: ['trip', tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) throw new Error('Ошибка загрузки рейса');
      return res.json();
    },
  });

  const startOdo = Number(trip?.odometer_start ?? 0);
  const assetTypeCode = trip?.asset?.type_code || trip?.asset?.asset_type?.code;
  const fuelRate = getVehicleFuelRate(assetTypeCode, trip?.asset);

  // Предзаполнение при загрузке данных рейса
  useEffect(() => {
    if (!trip) return;
    const existingEnd = Number(trip.odometer_end ?? 0);
    const assetCur = Number(trip.asset?.odometer_current ?? 0);

    if (existingEnd > startOdo) {
      setOdometerInput(String(existingEnd));
      setMileageInput(String(existingEnd - startOdo));
    } else if (assetCur > startOdo) {
      setOdometerInput(String(assetCur));
      setMileageInput(String(assetCur - startOdo));
    }
  }, [trip, startOdo]);

  // Обработчики взаимного пересчета одометра и пробега
  const handleOdometerChange = (val: string) => {
    setOdometerInput(val);
    const end = Number(val);
    if (!isNaN(end) && end > startOdo && startOdo > 0) {
      setMileageInput(String(end - startOdo));
    } else {
      setMileageInput('');
    }
  };

  const handleMileageChange = (val: string) => {
    setMileageInput(val);
    const m = Number(val);
    if (!isNaN(m) && m > 0 && startOdo > 0) {
      setOdometerInput(String(startOdo + m));
    } else {
      setOdometerInput('');
    }
  };

  const deltaKm = Math.max(
    0,
    Number(mileageInput) ||
      (Number(odometerInput) > startOdo ? Number(odometerInput) - startOdo : 0),
  );
  const calculatedEndOdo =
    Number(odometerInput) > startOdo
      ? Number(odometerInput)
      : startOdo > 0 && deltaKm > 0
        ? startOdo + deltaKm
        : null;

  const cubeCalc = calculateCubeFuel(deltaKm, assetTypeCode, trip?.asset);

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

  async function onSubmit(data: FormData) {
    if (submitting) return;

    if (data.payment_method === 'cube') {
      if (deltaKm <= 0) {
        alert('Перед списанием из Кубика необходимо указать текущий одометр или пробег рейса!');
        return;
      }
      if (cubeCalc.amount <= 0) {
        alert('Рассчитанная сумма расхода из Кубика равна 0');
        return;
      }
    } else {
      const amt = Number(data.amount);
      if (!amt || amt <= 0) {
        alert('Укажите корректную сумму заправки');
        return;
      }
    }

    setSubmitting(true);

    const finalAmount = data.payment_method === 'cube' ? cubeCalc.amount : Number(data.amount);
    const desc =
      data.payment_method === 'cube'
        ? `Кубик: ${cubeCalc.liters} л (${cubeCalc.km} км, норма ${fuelRate} л/100км)`
        : data.description?.trim() || null;

    const payload = JSON.stringify({
      category_id: FUEL_CAT_ID,
      amount: String(finalAmount),
      payment_method: data.payment_method,
      description: desc,
      idempotency_key: idempotencyKey,
      odometer_end: calculatedEndOdo,
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
      <header className="bg-white border-b-2 border-zinc-200 px-4 h-16 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
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
        </div>
        {trip?.asset?.short_name && (
          <span className="text-[11px] font-black px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-700 border border-zinc-300">
            {trip.asset.short_name}
          </span>
        )}
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4 pb-28 max-w-lg mx-auto">
        {/* ── БЛОК 1. ОБЯЗАТЕЛЬНЫЙ ЗАПРОС ПРОБЕГА ПО РЕЙСУ (ПЕРЕД ГСМ) ── */}
        <div className="bg-white border-2 border-amber-300 rounded-xl p-3.5 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>📍</span> 1. Пробег рейса (для точного расхода ДТ)
            </span>
            <div className="flex rounded-lg bg-zinc-100 p-0.5 border border-zinc-200 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setInputMode('odometer')}
                className={`px-2 py-0.5 rounded-md transition-all ${inputMode === 'odometer' ? 'bg-white text-zinc-900 shadow-2xs font-black' : 'text-zinc-500'}`}
              >
                Одометр
              </button>
              <button
                type="button"
                onClick={() => setInputMode('mileage')}
                className={`px-2 py-0.5 rounded-md transition-all ${inputMode === 'mileage' ? 'bg-white text-zinc-900 shadow-2xs font-black' : 'text-zinc-500'}`}
              >
                Пробег, км
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-2 flex flex-col justify-center">
              <span className="text-[9px] font-bold text-zinc-400 uppercase">Старт рейса</span>
              <span className="text-xs font-black text-zinc-800">
                {startOdo > 0 ? `${startOdo.toLocaleString('ru-RU')} км` : 'Не зафиксирован'}
              </span>
            </div>

            <div>
              {inputMode === 'odometer' ? (
                <div>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={odometerInput}
                    onChange={(e) => handleOdometerChange(e.target.value)}
                    placeholder={startOdo > 0 ? String(startOdo + 150) : 'Одометр'}
                    className="w-full h-11 px-3 text-sm font-black rounded-lg border-2 border-amber-400 focus:border-amber-600 focus:outline-none bg-amber-50/30"
                  />
                  <span className="text-[9px] text-zinc-400 block mt-0.5 pl-1">
                    Текущий одометр
                  </span>
                </div>
              ) : (
                <div>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={mileageInput}
                    onChange={(e) => handleMileageChange(e.target.value)}
                    placeholder="Например: 240"
                    className="w-full h-11 px-3 text-sm font-black rounded-lg border-2 border-amber-400 focus:border-amber-600 focus:outline-none bg-amber-50/30"
                  />
                  <span className="text-[9px] text-zinc-400 block mt-0.5 pl-1">
                    Пробег рейса, км
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Плотная 1-строчная сводка пробега и нормы */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-amber-100 text-amber-950">
            <span className="font-bold flex items-center gap-1">
              <span>📏 Пробег:</span>
              <b className={deltaKm > 0 ? 'text-emerald-700' : 'text-zinc-400'}>
                {deltaKm > 0 ? `+${deltaKm} км` : '— не указан'}
              </b>
            </span>
            <span className="text-[11px] text-zinc-500 font-medium">
              Норма: <b>{fuelRate} л/100км</b>
            </span>
          </div>
        </div>

        {/* ── БЛОК 2. ВЫБОР СПОСОБА ОПЛАТЫ (3 КНОПКИ В РЯД) ── */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
            2. Способ заправки
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

        {/* ── БЛОК 3. РАСЧЕТ ИЛИ ВВОД СУММЫ ── */}
        {selectedPaymentMethod === 'cube' ? (
          /* КУБИК: если пробег указан — чистый расчет, если нет — предупреждение */
          deltaKm <= 0 ? (
            <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl text-xs font-bold text-rose-900 flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <div>
                <div className="font-black">Сначала укажите пробег рейса выше!</div>
                <div className="text-[11px] text-rose-700 font-normal">
                  Расход из Кубика рассчитывается строго по фактическому километражу рейса.
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-orange-50 border-2 border-orange-400 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-700">Заправка из Кубика (База)</div>
                  <div className="text-[11px] text-zinc-600 font-medium">
                    {cubeCalc.liters} л ДТ по {cubeCalc.pricePerLiter} ₽/л
                  </div>
                </div>
                <div className="text-2xl font-black text-orange-600">
                  {cubeCalc.amount.toLocaleString('ru-RU')} ₽
                </div>
              </div>
              <div className="text-[10px] text-zinc-500 border-t border-orange-200 pt-1.5 flex justify-between font-medium">
                <span>Пробег: {cubeCalc.km} км</span>
                <span>Списание с кошелька Кубик</span>
              </div>
            </div>
          )
        ) : (
          /* ТК или Наличные: ввод суммы и примечания */
          <div className="space-y-3 bg-white p-3.5 rounded-xl border-2 border-zinc-200">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Сумма заправки, ₽
              </label>
              <input
                type="number"
                inputMode="numeric"
                autoFocus
                {...register('amount')}
                placeholder="1 500"
                className="w-full rounded-xl border-2 border-zinc-200 px-3 h-14 text-2xl font-black text-zinc-900 focus:border-amber-500 focus:outline-none transition-colors"
              />
              {errors.amount && (
                <p className="text-red-500 text-xs font-bold mt-1 pl-1">{errors.amount.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Примечание (АЗС / литры)
              </label>
              <input
                type="text"
                {...register('description')}
                placeholder="Например: 35 л, Газпромнефть"
                className="w-full rounded-xl border-2 border-zinc-200 px-3 h-12 text-xs font-bold text-zinc-900 focus:border-amber-500 focus:outline-none transition-colors"
              />
            </div>

            {deltaKm > 0 && (
              <div className="text-[11px] bg-zinc-50 p-2 rounded-lg text-zinc-600 flex justify-between font-medium border border-zinc-200">
                <span>Расход по норме ({deltaKm} км):</span>
                <b className="text-zinc-800">
                  {cubeCalc.liters} л (~{cubeCalc.amount} ₽)
                </b>
              </div>
            )}
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t-2 border-zinc-200 z-50">
          <div className="max-w-lg mx-auto">
            <Button
              type="submit"
              size="hero"
              disabled={submitting || (selectedPaymentMethod === 'cube' && deltaKm <= 0)}
              className="w-full font-black uppercase tracking-widest bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50"
            >
              {submitting ? 'Сохраняем...' : '✅ Сохранить ГСМ'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
