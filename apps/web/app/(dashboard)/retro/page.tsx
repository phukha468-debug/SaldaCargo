'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Button, Money } from '@saldacargo/ui';

const orderSchema = z.object({
  amount: z.coerce.number().positive(),
  driver_pay: z.coerce.number().min(0),
  loader_pay: z.coerce.number().min(0),
  payment_method: z.enum(['cash', 'qr', 'debt_cash', 'card_driver']),
  description: z.string().optional(),
});

const schema = z.object({
  driver_id: z.string().min(1, 'Выберите водителя'),
  asset_id: z.string().min(1, 'Выберите машину'),
  loader_id: z.string().optional(),
  trip_type: z.enum(['local', 'intercity', 'moving', 'hourly']),
  odometer_start: z.coerce.number().min(0),
  odometer_end: z.coerce.number().min(0),
  started_at: z.string().min(1),
  ended_at: z.string().min(1),
  driver_note: z.string().optional(),
  orders: z.array(orderSchema).min(1, 'Добавьте хотя бы один заказ'),
});

type FormData = z.infer<typeof schema>;

const PAYMENT_METHODS = [
  { value: 'cash', label: '💵 Нал' },
  { value: 'qr', label: '📱 QR' },
  { value: 'card_driver', label: '💳 На карту' },
  { value: 'debt_cash', label: '⏳ Долг' },
] as const;

export default function RetroPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [drivers, setDrivers] = useState<Array<{ id: string; name: string }>>([]);
  const [assets, setAssets] = useState<
    Array<{ id: string; short_name: string; odometer_current: number }>
  >([]);
  const [loaders, setLoaders] = useState<Array<{ id: string; name: string }>>([]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any),
    defaultValues: {
      trip_type: 'local',
      orders: [{ amount: 0, driver_pay: 0, loader_pay: 0, payment_method: 'cash' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'orders' });

  useEffect(() => {
    fetch('/api/driver/assets')
      .then((r) => r.json())
      .then(setAssets);
    fetch('/api/driver/loaders')
      .then((r) => r.json())
      .then(setLoaders);
    // Загружаем водителей
    fetch('/api/users?role=driver')
      .then((r) => r.json())
      .then(setDrivers);
  }, []);

  const orders = watch('orders');
  const totalRevenue = orders.reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const totalDriverPay = orders.reduce((s, o) => s + (Number(o.driver_pay) || 0), 0);

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    setError('');

    const res = await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        orders: data.orders.map((o) => ({
          ...o,
          amount: String(o.amount),
          driver_pay: String(o.driver_pay),
          loader_pay: String(o.loader_pay),
        })),
      }),
    });

    if (!res.ok) {
      const result = (await res.json()) as { error?: string };
      setError(result.error ?? 'Ошибка');
      setSubmitting(false);
      return;
    }

    router.push('/review');
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Ввод данных</h1>
        <p className="text-slate-500 text-sm mt-1">
          Ретроспективный ввод рейса. После сохранения рейс попадёт в ревью.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Основные данные */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">Данные рейса</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Водитель</label>
              <select
                {...register('driver_id')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Выберите...</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              {errors.driver_id && (
                <p className="text-red-500 text-xs mt-1">{errors.driver_id.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Машина</label>
              <select
                {...register('asset_id')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Выберите...</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.short_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Грузчик</label>
              <select
                {...register('loader_id')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Без грузчика</option>
                {loaders.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Тип рейса</label>
              <select
                {...register('trip_type')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="local">По городу</option>
                <option value="intercity">Межгород</option>
                <option value="moving">Переезд</option>
                <option value="hourly">Почасовой</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Начало</label>
              <input
                type="datetime-local"
                {...register('started_at')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Конец</label>
              <input
                type="datetime-local"
                {...register('ended_at')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Одометр начало
              </label>
              <input
                type="number"
                {...register('odometer_start')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Одометр конец</label>
              <input
                type="number"
                {...register('odometer_end')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Заметка</label>
            <input
              type="text"
              {...register('driver_note')}
              placeholder="Необязательно"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Заказы */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Заказы ({fields.length})</h2>
            <div className="text-sm text-slate-500">
              Итого: <Money amount={totalRevenue.toString()} /> · ЗП:{' '}
              <Money amount={totalDriverPay.toString()} />
            </div>
          </div>

          <div className="space-y-3">
            {fields.map((field, i) => (
              <div key={field.id} className="flex gap-2 items-start p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-400 text-sm mt-2 w-4">{i + 1}</span>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    {...register(`orders.${i}.amount`)}
                    placeholder="Сумма ₽"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm col-span-1"
                  />
                  <input
                    type="number"
                    {...register(`orders.${i}.driver_pay`)}
                    placeholder="ЗП водителя ₽"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <select
                    {...register(`orders.${i}.payment_method`)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    {...register(`orders.${i}.description`)}
                    placeholder="Описание"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-red-400 hover:text-red-600 mt-2 text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              append({ amount: 0, driver_pay: 0, loader_pay: 0, payment_method: 'cash' })
            }
            className="mt-3 text-sm text-orange-600 hover:text-orange-700 font-medium"
          >
            + Добавить заказ
          </button>

          {errors.orders && <p className="text-red-500 text-sm mt-2">{errors.orders.message}</p>}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        <Button type="submit" size="hero" disabled={submitting}>
          {submitting ? 'Сохраняем...' : '💾 Сохранить рейс'}
        </Button>
      </form>
    </div>
  );
}
