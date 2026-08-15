'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@saldacargo/ui';
import { cn } from '@saldacargo/ui';

const orderSchema = z.object({
  amount: z.coerce.number().min(0, 'Сумма обязательна'),
  driver_pay: z.coerce.number().min(0),
  loader_pay: z.coerce.number().min(0),
  loader2_pay: z.coerce.number().min(0).optional(),
  payment_method: z.enum(['cash', 'qr', 'debt_cash', 'card_driver', 'bank_invoice']),
  counterparty_id: z.string().optional(),
  description: z.string().optional(),
});

const expenseSchema = z.object({
  amount: z.coerce.number().min(0),
  payment_method: z.enum(['fuel_card', 'cash', 'card_driver']),
  description: z.string().optional(),
});

const schema = z.object({
  driver_id: z.string().min(1, 'Выберите водителя'),
  asset_id: z.string().min(1, 'Выберите машину'),
  loader_id: z.string().optional(),
  trip_type: z.enum(['local', 'intercity', 'moving', 'hourly']),
  odometer_start: z.coerce.number().min(0),
  odometer_end: z.coerce.number().min(0),
  started_at: z.string().min(1, 'Укажите дату и время начала'),
  ended_at: z.string().min(1, 'Укажите дату и время окончания'),
  driver_note: z.string().optional(),
  orders: z.array(orderSchema).min(1, 'Добавьте хотя бы один заказ'),
  expenses: z.array(expenseSchema).optional(),
});

type FormData = z.infer<typeof schema>;

const PAYMENT_METHODS = [
  {
    value: 'cash',
    label: '💵 Наличные',
    color: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  },
  {
    value: 'debt_cash',
    label: '⏳ Долг клиента (нал)',
    color: 'bg-amber-50 text-amber-800 border-amber-300',
  },
  {
    value: 'qr',
    label: '📱 QR-код / Эквайринг',
    color: 'bg-purple-50 text-purple-800 border-purple-300',
  },
  {
    value: 'card_driver',
    label: '💳 На карту водителя',
    color: 'bg-blue-50 text-blue-800 border-blue-300',
  },
  {
    value: 'bank_invoice',
    label: '📄 Безнал (Юрлица)',
    color: 'bg-slate-100 text-slate-800 border-slate-300',
  },
] as const;

export default function RetroPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Default dates: Today 08:00 to 18:00
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const defaultStart = `${todayStr}T08:00`;
  const defaultEnd = `${todayStr}T18:00`;

  // 1. Fetch Assets
  const { data: assets = [] } = useQuery<
    Array<{
      id: string;
      short_name: string;
      reg_number: string;
      odometer_current: number;
      assigned_driver_id?: string;
    }>
  >({
    queryKey: ['assets'],
    queryFn: () => fetch('/api/assets').then((r) => r.json()),
    staleTime: 60000,
  });

  // 2. Fetch Drivers
  const { data: drivers = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['drivers'],
    queryFn: () => fetch('/api/users?role=driver').then((r) => r.json()),
    staleTime: 60000,
  });

  // 3. Fetch Loaders
  const { data: loaders = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['loaders'],
    queryFn: () => fetch('/api/users?role=loader').then((r) => r.json()),
    staleTime: 60000,
  });

  // 4. Fetch Counterparties
  const { data: counterparties = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['counterparties-active'],
    queryFn: () => fetch('/api/counterparties?active=1').then((r) => r.json()),
    staleTime: 60000,
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any),
    defaultValues: {
      trip_type: 'local',
      started_at: defaultStart,
      ended_at: defaultEnd,
      odometer_start: 0,
      odometer_end: 0,
      orders: [
        {
          amount: 0,
          driver_pay: 0,
          loader_pay: 0,
          payment_method: 'cash',
          description: 'Перевозка груза',
        },
      ],
      expenses: [],
    },
  });

  const {
    fields: orderFields,
    append: appendOrder,
    remove: removeOrder,
  } = useFieldArray({
    control,
    name: 'orders',
  });

  const {
    fields: expenseFields,
    append: appendExpense,
    remove: removeExpense,
  } = useFieldArray({
    control,
    name: 'expenses',
  });

  const selectedAssetId = watch('asset_id');
  const odoStart = Number(watch('odometer_start')) || 0;
  const odoEnd = Number(watch('odometer_end')) || 0;
  const distance = Math.max(0, odoEnd - odoStart);

  // When asset is selected, prefill odometer_start if it's currently 0
  const onAssetChange = (assetId: string) => {
    setValue('asset_id', assetId);
    const selected = assets.find((a) => a.id === assetId);
    if (selected) {
      if (odoStart === 0 && selected.odometer_current > 0) {
        setValue('odometer_start', selected.odometer_current);
        setValue('odometer_end', selected.odometer_current + 100);
      }
      if (selected.assigned_driver_id && !watch('driver_id')) {
        setValue('driver_id', selected.assigned_driver_id);
      }
    }
  };

  const orders = watch('orders') || [];
  const expenses = watch('expenses') || [];

  const totalRevenue = orders.reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const totalDriverPay = orders.reduce((s, o) => s + (Number(o.driver_pay) || 0), 0);
  const totalLoaderPay = orders.reduce((s, o) => s + (Number(o.loader_pay) || 0), 0);
  const totalFuelExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalPayroll = totalDriverPay + totalLoaderPay;
  const estimatedProfit = totalRevenue - (totalPayroll + totalFuelExpenses);

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          loader_id: data.loader_id || null,
          orders: data.orders.map((o) => ({
            ...o,
            counterparty_id: o.counterparty_id || null,
            amount: String(o.amount),
            driver_pay: String(o.driver_pay),
            loader_pay: String(o.loader_pay || 0),
            loader2_pay: String(o.loader2_pay || 0),
          })),
          expenses: (data.expenses || []).map((e) => ({
            ...e,
            amount: String(e.amount),
          })),
        }),
      });

      if (!res.ok) {
        const result = (await res.json()) as { error?: string };
        setError(result.error ?? 'Ошибка сохранения рейса');
        setSubmitting(false);
        return;
      }

      router.push('/review');
      router.refresh();
    } catch {
      setError('Ошибка сети или сервера');
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ── Top Header Banner ────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sky-400 text-[26px]">history_edu</span>
            <h1 className="text-xl font-black tracking-tight text-white">Ретро-ввод рейса</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Ручное внесение завершённых смен и путевых листов. После сохранения рейс моментально
            попадает в раздел «Ревью».
          </p>
        </div>

        {/* Live Summary Counter */}
        <div className="bg-slate-800/90 border border-slate-700/60 rounded-xl px-4 py-2.5 text-right">
          <div className="text-[10px] uppercase font-extrabold text-slate-400">
            Итого прибыль рейса
          </div>
          <div
            className={cn(
              'text-lg font-black leading-none mt-0.5',
              estimatedProfit >= 0 ? 'text-emerald-400' : 'text-rose-400',
            )}
          >
            {estimatedProfit >= 0 ? '+' : ''}
            {Math.round(estimatedProfit).toLocaleString('ru-RU')} ₽
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Выручка: {totalRevenue.toLocaleString('ru-RU')} ₽ · ЗП:{' '}
            {totalPayroll.toLocaleString('ru-RU')} ₽
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* ═══════════════════════════════════════════════════════════════
            BLOCK 1: АВТОМОБИЛЬ И ЭКИПАЖ
        ═══════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <span className="material-symbols-outlined text-slate-700">local_shipping</span>
            <h2 className="text-base font-extrabold text-slate-900">1. Автомобиль и Экипаж</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Asset Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Машина автопарка <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedAssetId || ''}
                onChange={(e) => onAssetChange(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              >
                <option value="">Выберите автомобиль...</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.short_name} {a.reg_number ? `(${a.reg_number})` : ''} ·{' '}
                    {a.odometer_current?.toLocaleString('ru-RU')} км
                  </option>
                ))}
              </select>
              {errors.asset_id && (
                <p className="text-rose-600 text-xs font-bold mt-1">{errors.asset_id.message}</p>
              )}
            </div>

            {/* Driver Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Водитель <span className="text-rose-500">*</span>
              </label>
              <select
                {...register('driver_id')}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              >
                <option value="">Выберите водителя...</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              {errors.driver_id && (
                <p className="text-rose-600 text-xs font-bold mt-1">{errors.driver_id.message}</p>
              )}
            </div>

            {/* Loader Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Грузчик (если был)
              </label>
              <select
                {...register('loader_id')}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              >
                <option value="">Без грузчика</option>
                {loaders.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Тип рейса
              </label>
              <select
                {...register('trip_type')}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              >
                <option value="local">По городу</option>
                <option value="intercity">Межгород</option>
                <option value="moving">Переезд</option>
                <option value="hourly">Почасовой</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Дата и время начала
              </label>
              <input
                type="datetime-local"
                {...register('started_at')}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Дата и время окончания
              </label>
              <input
                type="datetime-local"
                {...register('ended_at')}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            {/* Mileage calculation */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-slate-400 block">
                  Дистанция
                </span>
                <span className="text-base font-black text-slate-900">
                  {distance.toLocaleString('ru-RU')} км
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Старт / Финиш</span>
                <span className="text-xs font-bold text-slate-700">
                  {odoStart} → {odoEnd}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Одометр старт (км)
              </label>
              <input
                type="number"
                {...register('odometer_start')}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Одометр финиш (км)
              </label>
              <input
                type="number"
                {...register('odometer_end')}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Примечание / Маршрут
              </label>
              <input
                type="text"
                {...register('driver_note')}
                placeholder="Например: Салда - Тагил - Екб, доставка оборудования"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            BLOCK 2: ЗАКАЗЫ И ОПЛАТЫ
        ═══════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600">receipt_long</span>
              <h2 className="text-base font-extrabold text-slate-900">
                2. Заказы и Оплаты ({orderFields.length})
              </h2>
            </div>
            <div className="text-xs font-bold text-slate-500">
              Выручка:{' '}
              <span className="text-emerald-600 font-extrabold">
                {totalRevenue.toLocaleString('ru-RU')} ₽
              </span>{' '}
              · ЗП водителя:{' '}
              <span className="text-amber-600 font-extrabold">
                {totalDriverPay.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {orderFields.map((field, i) => (
              <div
                key={field.id}
                className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-700 bg-slate-200 px-2 py-0.5 rounded-md">
                    Заказ #{i + 1}
                  </span>
                  {orderFields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeOrder(i)}
                      className="text-xs font-bold text-rose-600 hover:text-rose-800 transition-colors cursor-pointer"
                    >
                      Удалить заказ ✕
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {/* Amount */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Сумма заказа (₽) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      {...register(`orders.${i}.amount`)}
                      placeholder="0 ₽"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-900 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Способ оплаты <span className="text-rose-500">*</span>
                    </label>
                    <select
                      {...register(`orders.${i}.payment_method`)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Driver Pay */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      ЗП Водителя (₽)
                    </label>
                    <input
                      type="number"
                      {...register(`orders.${i}.driver_pay`)}
                      placeholder="0 ₽"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-amber-600 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* Loader Pay */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      ЗП Грузчика (₽)
                    </label>
                    <input
                      type="number"
                      {...register(`orders.${i}.loader_pay`)}
                      placeholder="0 ₽"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-amber-600 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {/* Counterparty */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Клиент / Контрагент
                    </label>
                    <select
                      {...register(`orders.${i}.counterparty_id`)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-800 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    >
                      <option value="">Частное лицо (разовый заказ)</option>
                      {counterparties.map((cp) => (
                        <option key={cp.id} value={cp.id}>
                          {cp.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Описание груза
                    </label>
                    <input
                      type="text"
                      {...register(`orders.${i}.description`)}
                      placeholder="Например: Доставка мебели / Металлопрокат"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-800 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              appendOrder({
                amount: 0,
                driver_pay: 0,
                loader_pay: 0,
                payment_method: 'cash',
                description: '',
              })
            }
            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-sky-600 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 px-4 py-2 rounded-xl transition-all border border-sky-200 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            <span>+ Добавить еще один заказ</span>
          </button>

          {errors.orders && (
            <p className="text-rose-600 text-xs font-bold mt-2">{errors.orders.message}</p>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            BLOCK 3: ПУТЕВЫЕ РАСХОДЫ И ТОПЛИВО (ГСМ)
        ═══════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-600">local_gas_station</span>
              <h2 className="text-base font-extrabold text-slate-900">
                3. Расходы на ГСМ и Топливо
              </h2>
            </div>
            <div className="text-xs font-bold text-rose-600">
              Сумма топлива: {totalFuelExpenses.toLocaleString('ru-RU')} ₽
            </div>
          </div>

          {expenseFields.length === 0 && (
            <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              В этом рейсе не было заправок или расходов на ГСМ.
            </div>
          )}

          <div className="space-y-2.5">
            {expenseFields.map((field, i) => (
              <div
                key={field.id}
                className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              >
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Сумма (₽)
                  </label>
                  <input
                    type="number"
                    {...register(`expenses.${i}.amount`)}
                    placeholder="0 ₽"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-rose-600 bg-white"
                  />
                </div>

                <div className="flex-1 min-w-[180px]">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Способ оплаты
                  </label>
                  <select
                    {...register(`expenses.${i}.payment_method`)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white"
                  >
                    <option value="fuel_card">Топливная карта (ГСМ)</option>
                    <option value="cash">Наличные из кассы рейса</option>
                    <option value="card_driver">Карта компании / водителя</option>
                  </select>
                </div>

                <div className="flex-1 min-w-[180px]">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Описание / АЗС
                  </label>
                  <input
                    type="text"
                    {...register(`expenses.${i}.description`)}
                    placeholder="АЗС Газпромнефть / Лукойл"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => removeExpense(i)}
                  className="text-rose-600 hover:text-rose-800 font-bold p-1.5 rounded mt-4 cursor-pointer"
                  title="Удалить расход"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              appendExpense({ amount: 0, payment_method: 'fuel_card', description: 'Заправка ДТ' })
            }
            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-4 py-2 rounded-xl transition-all border border-rose-200 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">local_gas_station</span>
            <span>+ Добавить заправку ГСМ</span>
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700 text-sm font-bold flex items-center gap-2">
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* ── Submit Button Bar ────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            type="button"
            onClick={() => router.push('/review')}
            className="px-5 py-3 rounded-xl border border-slate-300 text-slate-600 hover:text-slate-900 font-bold text-sm transition-colors cursor-pointer"
          >
            Отмена
          </button>

          <Button type="submit" size="hero" disabled={submitting} className="min-w-[240px]">
            {submitting ? 'Сохраняем рейс...' : '💾 Сохранить и отправить в Ревью'}
          </Button>
        </div>
      </form>
    </div>
  );
}
