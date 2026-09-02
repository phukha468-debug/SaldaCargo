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
import {
  calculateOrderPayroll,
  ORDER_DIRECTIONS,
  type OrderDirectionItem,
} from '@saldacargo/domain-payroll';

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  amount: z.coerce.number().positive('Введите сумму'),
  driver_pay: z.coerce.number().min(0).optional(),
  payment_method: z.enum(['cash', 'debt_cash']),
  description: z.string().optional(),
  counterparty_id: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Counterparty {
  id: string;
  name: string;
  is_legal_entity: boolean;
  is_top?: boolean;
  is_delivery_zone_client?: boolean;
  min_delivery_base?: number;
}

interface Loader {
  id: string;
  name: string;
}

interface SelectedLoader {
  id: string;
  name: string;
  pay: string;
}

// ─── Payment methods per client type ─────────────────────────────────────────

const METHODS_INDIVIDUAL = [
  {
    value: 'cash' as const,
    label: 'Наличные',
    sublabel: 'Сдаст в конце смены',
    icon: '💵',
    wallet: '→ Касса',
    color: 'peer-checked:border-green-600 peer-checked:bg-green-50',
  },
  {
    value: 'debt_cash' as const,
    label: 'Долг',
    sublabel: 'Заплатит позднее',
    icon: '⏳',
    wallet: '→ Дебиторка → Касса',
    color: 'peer-checked:border-orange-500 peer-checked:bg-orange-50',
  },
];

const METHODS_LEGAL = [
  {
    value: 'debt_cash' as const,
    label: 'Счёт / Долг',
    sublabel: 'Оплата по выставленному счёту',
    icon: '🧾',
    wallet: '→ Дебиторка → Р/С',
    color: 'peer-checked:border-orange-500 peer-checked:bg-orange-50',
  },
];

const SUGGEST_PERCENT = 30;

// ─── Component ────────────────────────────────────────────────────────────────

export default function AddOrderPage() {
  const params = useParams();
  const tripId = params.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [idempotencyKey] = useState(() => uuid());

  // Направление заказа
  const [direction, setDirection] = useState<string>('local');
  const [showDirectionPicker, setShowDirectionPicker] = useState(false);

  // Водитель-грузчик
  const [isDriverLoader, setIsDriverLoader] = useState(false);

  // Client selection state
  const [clientType, setClientType] = useState<'individual' | 'legal' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');

  // Loaders (динамический неограниченный список)
  const [loaders, setLoaders] = useState<SelectedLoader[]>([]);
  const [showLoaderPicker, setShowLoaderPicker] = useState(false);

  const { data: counterparties = [] } = useQuery<Counterparty[]>({
    queryKey: ['driver', 'counterparties'],
    queryFn: () => fetch('/api/driver/counterparties').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allLoaders = [] } = useQuery<Loader[]>({
    queryKey: ['driver', 'loaders'],
    queryFn: () => fetch('/api/driver/loaders').then((r) => r.json()),
    staleTime: 10 * 60 * 1000,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema as any) as any,
    defaultValues: { payment_method: 'cash', driver_pay: undefined },
  });

  const selectedCounterpartyId = watch('counterparty_id');
  const selectedPaymentMethod = watch('payment_method');
  const selectedCounterparty = counterparties.find((c) => c.id === selectedCounterpartyId);

  const amountRaw = watch('amount');
  const amount = amountRaw ? Number(amountRaw) : 0;

  // Автоматический расчёт ЗП
  const minMachineBase =
    selectedCounterparty?.min_delivery_base ??
    (selectedCounterparty?.is_delivery_zone_client ? 800 : 1000);

  const payroll = calculateOrderPayroll({
    direction,
    amount,
    isDriverLoader,
    loadersCount: loaders.length,
    minMachineBase,
  });

  const isCity = payroll.isAutomatic;
  const suggestedPay = amount ? Math.round((amount * SUGGEST_PERCENT) / 100) : 0;

  // Filter counterparties by search term (ignore type)
  const filteredCounterparties =
    searchTerm.length > 0
      ? counterparties.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
      : [];

  const topCounterparties = counterparties.filter((c) => c.is_top);

  const availableLoaders = allLoaders.filter((l) => !loaders.find((s) => s.id === l.id));
  const isDebt = selectedPaymentMethod === 'debt_cash';
  const paymentMethods = clientType === 'legal' ? METHODS_LEGAL : METHODS_INDIVIDUAL;

  const DEFAULT_DIRECTION: OrderDirectionItem = {
    id: 'local',
    label: 'По городу',
    desc: 'Верхняя Салда (базовый тариф)',
    icon: '🏙️',
    category: 'local',
    baseMachinePrice: 1000,
  };

  const currentDirectionObj =
    ORDER_DIRECTIONS.find((d: OrderDirectionItem) => d.id === direction) ?? DEFAULT_DIRECTION;

  function selectCounterparty(c: Counterparty) {
    setValue('counterparty_id', c.id);
    setSearchTerm('');
    setError('');

    const newType = c.is_legal_entity ? 'legal' : 'individual';
    setClientType(newType);

    if (c.is_legal_entity) {
      setValue('payment_method', 'debt_cash');
    } else {
      const current = watch('payment_method');
      if (!current || current === 'debt_cash') {
        setValue('payment_method', 'cash');
      }
    }
  }

  function addLoader(loader: Loader) {
    setLoaders((prev) => [...prev, { id: loader.id, name: loader.name, pay: '' }]);
    setShowLoaderPicker(false);
  }

  function removeLoader(id: string) {
    setLoaders((prev) => prev.filter((l) => l.id !== id));
  }

  function setLoaderPay(id: string, pay: string) {
    setLoaders((prev) => prev.map((l) => (l.id === id ? { ...l, pay } : l)));
  }

  async function handleAddClient() {
    if (!newClientName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/driver/counterparties/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClientName,
          type: 'client',
          is_legal_entity: clientType === 'legal',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['driver', 'counterparties'] });
        selectCounterparty(data);
        setShowNewClient(false);
        setNewClientName('');
      } else if (res.status === 409 && data.existing?.length > 0) {
        setShowNewClient(false);
        setSearchTerm(newClientName);
        setError(`Клиент «${data.existing[0].name}» уже есть — выберите из списка`);
      } else {
        setError(data.error || 'Ошибка при добавлении клиента');
      }
    } catch {
      setError('Ошибка сети');
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit(data: FormData) {
    if (submitting) return;
    if (!data.counterparty_id) {
      setError('Укажите клиента перед добавлением заказа');
      return;
    }
    const isDebt = data.payment_method === 'debt_cash';
    const isLegal = clientType === 'legal' || selectedCounterparty?.is_legal_entity;

    if (isDebt && !isLegal && !data.description?.trim()) {
      setError('Обязательно укажите комментарий к долгу (имя и что обещал клиент)');
      return;
    }

    setSubmitting(true);
    setError('');

    // Подготовка данных грузчиков и водителя
    const driverPayValue = isCity ? String(payroll.driverTotalPay) : String(data.driver_pay ?? 0);
    const loadersData = loaders.map((l) => ({
      id: l.id,
      name: l.name,
      pay: isCity ? String(payroll.loaderPayEach) : String(parseFloat(l.pay || '0')),
    }));

    const payload = JSON.stringify({
      ...data,
      direction,
      is_driver_loader: isDriverLoader,
      driver_car_pay: String(payroll.driverCarPay),
      driver_loader_pay: String(payroll.driverLoaderPay),
      driver_pay: driverPayValue,
      loaders_data: loadersData,
      loader_id: loadersData[0]?.id ?? null,
      loader_pay: loadersData[0]?.pay ?? '0',
      loader2_id: loadersData[1]?.id ?? null,
      loader2_pay: loadersData[1]?.pay ?? '0',
      idempotency_key: idempotencyKey,
    });

    router.push(`/trip/${tripId}`);

    fetch(`/api/trips/${tripId}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
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
        <h1 className="font-black text-zinc-900 text-lg uppercase tracking-tight">
          Добавить заказ
        </h1>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-6 pb-28">
        {/* ── Направление заказа ── */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
            Направление заказа
          </label>
          <button
            type="button"
            onClick={() => setShowDirectionPicker(true)}
            className="w-full text-left p-3.5 rounded-2xl border-2 border-orange-200 bg-orange-50/50 hover:bg-orange-50 flex items-center justify-between transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{currentDirectionObj.icon}</span>
              <div>
                <div className="font-black text-zinc-900 text-sm">{currentDirectionObj.label}</div>
                <div className="text-xs font-bold text-zinc-500">{currentDirectionObj.desc}</div>
              </div>
            </div>
            <span className="text-xs font-black uppercase text-orange-600 bg-orange-100 px-2.5 py-1 rounded-lg">
              Изменить
            </span>
          </button>
        </div>

        {/* ── Клиент ── */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
            Клиент
          </label>

          {selectedCounterparty ? (
            <div
              className={`flex items-center justify-between border-2 rounded-xl px-4 h-14 ${
                clientType === 'legal'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-orange-50 border-orange-200'
              }`}
            >
              <div>
                <span
                  className={`font-black text-sm ${clientType === 'legal' ? 'text-blue-900' : 'text-orange-900'}`}
                >
                  {selectedCounterparty.name}
                </span>
                <span
                  className={`ml-2 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                    clientType === 'legal'
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-orange-100 text-orange-600'
                  }`}
                >
                  {clientType === 'legal' ? 'ЮЛ' : 'ФЛ'}
                </span>
                {selectedCounterparty.is_delivery_zone_client && (
                  <span className="ml-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    Зоны доставки (от 800 ₽)
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setValue('counterparty_id', undefined);
                  setClientType(null);
                }}
                className={`font-black text-lg ${clientType === 'legal' ? 'text-blue-400' : 'text-orange-400'}`}
              >
                ✕
              </button>
            </div>
          ) : showNewClient ? (
            <div className="space-y-3 p-3 border-2 border-orange-200 bg-orange-50 rounded-xl">
              <label className="block text-[10px] font-bold text-orange-600 uppercase tracking-widest">
                Новый клиент
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setClientType('individual')}
                  className={`rounded-lg p-2 font-bold text-xs uppercase tracking-wider border-2 ${
                    clientType === 'individual'
                      ? 'border-orange-500 bg-white text-orange-600'
                      : 'border-orange-200 text-orange-400'
                  }`}
                >
                  👤 Физлицо
                </button>
                <button
                  type="button"
                  onClick={() => setClientType('legal')}
                  className={`rounded-lg p-2 font-bold text-xs uppercase tracking-wider border-2 ${
                    clientType === 'legal'
                      ? 'border-blue-500 bg-white text-blue-600'
                      : 'border-orange-200 text-orange-400'
                  }`}
                >
                  🏢 Юрлицо
                </button>
              </div>

              {clientType && (
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder={clientType === 'legal' ? 'Название организации' : 'Имя клиента'}
                    className="flex-1 rounded-xl border-2 border-orange-400 px-4 h-12 font-bold text-zinc-900 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleAddClient}
                    className="bg-orange-600 text-white rounded-xl px-4 font-bold"
                  >
                    OK
                  </button>
                </div>
              )}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewClient(false);
                    setClientType(null);
                  }}
                  className="text-zinc-500 font-bold text-xs"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {topCounterparties.length > 0 && searchTerm === '' && (
                <div className="flex flex-wrap gap-2">
                  {topCounterparties.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCounterparty(c)}
                      className="px-3 py-1.5 rounded-lg border-2 border-zinc-200 bg-white text-xs font-bold text-zinc-700 active:scale-95 flex items-center gap-1.5 shadow-sm"
                    >
                      <span className="text-sm">{c.is_legal_entity ? '🏢' : '👤'}</span>
                      {c.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Поиск клиента..."
                  className="w-full rounded-xl border-2 border-zinc-200 px-4 h-14 text-zinc-900 font-bold focus:border-orange-500 focus:outline-none transition-colors"
                />
                {searchTerm.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border-2 border-zinc-200 rounded-xl mt-1 shadow-xl z-10 max-h-60 overflow-y-auto">
                    {filteredCounterparties.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectCounterparty(c)}
                        className="w-full text-left px-4 py-3 font-bold text-zinc-900 hover:bg-orange-50 border-b border-zinc-100 last:border-0 flex items-center gap-2"
                      >
                        <span>{c.name}</span>
                        <span
                          className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                            c.is_legal_entity
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-orange-100 text-orange-500'
                          }`}
                        >
                          {c.is_legal_entity ? 'ЮЛ' : 'ФЛ'}
                        </span>
                      </button>
                    ))}
                    {filteredCounterparties.length === 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewClientName(searchTerm);
                          setShowNewClient(true);
                        }}
                        className="w-full text-left px-4 py-3 font-bold text-orange-600 hover:bg-orange-50"
                      >
                        + Создать нового клиента &quot;{searchTerm}&quot;
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Сумма заказа ── */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
            Сумма заказа, ₽
          </label>
          <input
            type="number"
            inputMode="numeric"
            {...register('amount')}
            placeholder="2 000"
            className="w-full rounded-xl border-2 border-zinc-200 px-4 h-16 text-3xl font-black text-zinc-900 focus:border-orange-500 focus:outline-none transition-colors"
          />
          {errors.amount && (
            <p className="text-red-500 text-xs font-bold mt-1 pl-1">{errors.amount.message}</p>
          )}
        </div>

        {/* ── Роль водителя (Водитель-грузчик) ── */}
        <div className="bg-orange-50/70 border-2 border-orange-200 rounded-2xl p-4 space-y-2">
          <label className="flex items-center justify-between cursor-pointer select-none">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isDriverLoader}
                onChange={(e) => setIsDriverLoader(e.target.checked)}
                className="w-6 h-6 rounded-lg text-orange-600 accent-orange-600 cursor-pointer"
              />
              <div>
                <div className="font-black text-zinc-900 text-sm">🚚 Я работал грузчиком</div>
                <div className="text-xs font-bold text-zinc-500">
                  Водитель получает оплату за авто + за работу грузчика
                </div>
              </div>
            </div>
            <span
              className={`text-xs font-black px-2.5 py-1 rounded-full uppercase ${
                isDriverLoader ? 'bg-orange-500 text-white' : 'bg-zinc-200 text-zinc-600'
              }`}
            >
              {isDriverLoader ? 'Да' : 'Нет'}
            </span>
          </label>
        </div>

        {/* ── Грузчики ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between pl-1">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              Сторонние грузчики ({loaders.length})
            </label>
            {isCity && loaders.length > 0 && (
              <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                ЗП грузчика: {payroll.loaderPayEach} ₽/чел
              </span>
            )}
          </div>

          {loaders.map((loader, idx) => (
            <div
              key={loader.id}
              className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-900 text-sm">
                  {idx + 1}. {loader.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeLoader(loader.id)}
                  className="text-blue-400 font-black text-lg leading-none hover:text-red-500"
                >
                  ✕
                </button>
              </div>

              {isCity ? (
                <div className="bg-white/80 border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-500">ЗП грузчика:</span>
                  <span className="text-base font-black text-zinc-900">
                    {payroll.loaderPayEach} ₽
                  </span>
                </div>
              ) : (
                <input
                  type="number"
                  inputMode="numeric"
                  value={loader.pay}
                  onChange={(e) => setLoaderPay(loader.id, e.target.value)}
                  placeholder="ЗП грузчика, ₽"
                  className="w-full rounded-lg border-2 border-blue-200 px-4 h-12 text-xl font-black text-zinc-900 focus:border-blue-500 focus:outline-none"
                />
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => setShowLoaderPicker(true)}
            className="w-full text-left px-4 h-12 border-2 border-dashed border-blue-300 rounded-xl text-blue-500 font-bold hover:bg-blue-50/50 transition-colors flex items-center gap-2"
          >
            <span className="text-lg">+</span>
            <span>Добавить грузчика из списка</span>
          </button>
        </div>

        {/* ── ЗП водителя ── */}
        {isCity ? (
          <div className="bg-zinc-900 text-white rounded-2xl p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-orange-400">
                ⚡ Расчёт ЗП («{currentDirectionObj.label}»)
              </span>
              <span className="text-xs font-bold text-zinc-400">Автоматически</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-zinc-800/80 p-2.5 rounded-xl">
                <div className="text-zinc-400 font-bold">🚗 За машину</div>
                <div className="text-base font-black text-white mt-0.5">
                  {payroll.driverCarPay} ₽
                </div>
              </div>

              <div className="bg-zinc-800/80 p-2.5 rounded-xl">
                <div className="text-zinc-400 font-bold">📦 За погрузку</div>
                <div className="text-base font-black text-white mt-0.5">
                  {payroll.driverLoaderPay} ₽
                </div>
                <div className="text-[10px] text-zinc-500">
                  {isDriverLoader ? 'водитель как грузчик' : 'не отмечен'}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <div className="text-[11px] font-bold text-zinc-400 uppercase">
                  Итого водителю за заказ
                </div>
                <div className="text-2xl font-black text-orange-400">
                  {payroll.driverTotalPay} ₽
                </div>
              </div>
              {loaders.length > 0 && (
                <div className="text-right">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase">
                    ЗП грузчикам ({loaders.length})
                  </div>
                  <div className="text-base font-black text-blue-300">
                    {payroll.totalLoadersPay} ₽
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
              ЗП водителя, ₽ ({currentDirectionObj.label})
              <span className="ml-2 text-zinc-400 normal-case font-medium">~{suggestedPay} ₽</span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              {...register('driver_pay')}
              placeholder={String(suggestedPay)}
              className="w-full rounded-xl border-2 border-zinc-200 px-4 h-14 text-xl font-black text-zinc-900 focus:border-orange-500 focus:outline-none transition-colors"
            />
          </div>
        )}

        {/* ── Способ оплаты ── */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
            Способ оплаты
          </label>
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${paymentMethods.length}, 1fr)` }}
          >
            {paymentMethods.map((m) => (
              <label key={m.value} className="cursor-pointer">
                <input
                  type="radio"
                  value={m.value}
                  {...register('payment_method')}
                  className="sr-only peer"
                />
                <div
                  className={`flex flex-col items-center justify-center gap-1 border-2 border-zinc-200 rounded-2xl p-3 h-24 transition-all active:scale-[0.97] ${m.color}`}
                >
                  <span className="text-2xl">{m.icon}</span>
                  <span className="text-[10px] font-black text-center leading-tight uppercase tracking-tight">
                    {m.label}
                  </span>
                  <span className="text-[8px] font-bold text-zinc-400 text-center leading-tight">
                    {m.wallet}
                  </span>
                </div>
              </label>
            ))}
          </div>

          {/* Подсказка для юрлиц */}
          {clientType === 'legal' && (
            <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wide px-1">
              🏢 Юрлицо оплачивает по счёту → деньги придут на Р/С
            </p>
          )}

          {/* Подсказка для налички */}
          {selectedPaymentMethod === 'cash' &&
            clientType !== 'legal' &&
            !selectedCounterparty?.is_legal_entity && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wide flex items-start gap-2 mt-2">
                <span className="text-sm leading-none">💡</span>
                <span>
                  Деньги физически у вас или вы лично своими глазами видели перевод. Описание можно
                  не заполнять.
                </span>
              </div>
            )}
        </div>

        {/* ── Комментарий к долгу (только для физлиц в долг) ── */}
        {isDebt && clientType !== 'legal' && !selectedCounterparty?.is_legal_entity && (
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-orange-600 uppercase tracking-widest pl-1">
              ⏳ Что обещал клиент? (важно!)
            </label>
            <input
              type="text"
              {...register('description')}
              placeholder="Обещал заплатить в пятницу, наличными..."
              autoFocus
              className="w-full rounded-xl border-2 border-orange-400 bg-orange-50 px-4 h-14 text-sm font-bold text-zinc-900 focus:border-orange-600 focus:outline-none transition-colors placeholder:text-orange-300"
            />
          </div>
        )}

        {/* ── Описание (только для физлиц при оплате не в долг) ── */}
        {!isDebt && clientType !== 'legal' && !selectedCounterparty?.is_legal_entity && (
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest pl-1 text-zinc-500">
              Описание (опционально)
            </label>
            <input
              type="text"
              {...register('description')}
              placeholder="Переезд, доставка плитки..."
              className="w-full rounded-xl border-2 border-zinc-200 px-4 h-14 text-sm font-bold text-zinc-900 focus:border-orange-500 focus:outline-none transition-colors"
            />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-red-700 text-xs font-bold uppercase tracking-wide">
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
            {submitting ? 'Сохраняем...' : '✅ Добавить заказ'}
          </Button>
        </div>
      </form>

      {/* Выбор направления (Модалка) */}
      {showDirectionPicker && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{
            background: 'rgba(0,0,0,0.5)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)',
          }}
          onClick={(e) => e.target === e.currentTarget && setShowDirectionPicker(false)}
        >
          <div className="bg-white rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-zinc-200 rounded-full" />
            </div>
            <div className="px-4 pt-1 pb-3 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h2 className="font-black text-zinc-900 text-base">Направление заказа</h2>
                <p className="text-xs text-zinc-400">Выберите тип или город рейса</p>
              </div>
              <button
                onClick={() => setShowDirectionPicker(false)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 text-xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="px-4 py-3 space-y-4">
              {/* Местные направления */}
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-orange-600 px-1">
                  📍 Местные направления (авторасчёт)
                </div>
                {ORDER_DIRECTIONS.filter((d) => d.category === 'local').map(
                  (dir: OrderDirectionItem) => {
                    const isSelected = direction === dir.id;
                    return (
                      <button
                        key={dir.id}
                        type="button"
                        onClick={() => {
                          setDirection(dir.id);
                          setShowDirectionPicker(false);
                        }}
                        className={`w-full text-left p-3 rounded-2xl border-2 transition-all flex items-center justify-between ${
                          isSelected
                            ? 'border-orange-500 bg-orange-50 shadow-sm'
                            : 'border-zinc-100 hover:border-orange-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{dir.icon}</span>
                          <div>
                            <div className="font-black text-zinc-900 text-sm">{dir.label}</div>
                            <div className="text-xs font-bold text-zinc-400">{dir.desc}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {dir.baseMachinePrice && (
                            <span className="text-xs font-black text-zinc-700 bg-zinc-100 px-2.5 py-1 rounded-lg">
                              {dir.baseMachinePrice} ₽
                            </span>
                          )}
                          {isSelected && (
                            <span className="text-xs font-black text-orange-600 bg-orange-100 px-2 py-1 rounded-lg uppercase">
                              ✓
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  },
                )}
              </div>

              {/* Межгород */}
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-zinc-400 px-1">
                  🚚 Межгород
                </div>
                {ORDER_DIRECTIONS.filter((d) => d.category === 'intercity').map(
                  (dir: OrderDirectionItem) => {
                    const isSelected = direction === dir.id;
                    return (
                      <button
                        key={dir.id}
                        type="button"
                        onClick={() => {
                          setDirection(dir.id);
                          setShowDirectionPicker(false);
                        }}
                        className={`w-full text-left p-3 rounded-2xl border-2 transition-all flex items-center justify-between ${
                          isSelected
                            ? 'border-orange-500 bg-orange-50 shadow-sm'
                            : 'border-zinc-100 hover:border-orange-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{dir.icon}</span>
                          <div>
                            <div className="font-black text-zinc-900 text-sm">{dir.label}</div>
                            <div className="text-xs font-bold text-zinc-400">{dir.desc}</div>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="text-xs font-black text-orange-600 bg-orange-100 px-2.5 py-1 rounded-full uppercase">
                            Выбрано
                          </span>
                        )}
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Выбор грузчика (Модалка) */}
      {showLoaderPicker && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{
            background: 'rgba(0,0,0,0.5)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)',
          }}
          onClick={(e) => e.target === e.currentTarget && setShowLoaderPicker(false)}
        >
          <div className="bg-white rounded-t-3xl shadow-2xl max-h-[70vh] overflow-y-auto">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-zinc-200 rounded-full" />
            </div>
            <div className="px-4 pt-1 pb-3 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="font-black text-zinc-900 text-base">Выбрать грузчика</h2>
              <button
                onClick={() => setShowLoaderPicker(false)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 text-xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="px-4 py-3 space-y-2">
              {availableLoaders.length === 0 ? (
                <p className="text-zinc-400 font-bold text-sm text-center py-4">
                  Все грузчики добавлены
                </p>
              ) : (
                availableLoaders.map((loader) => (
                  <button
                    key={loader.id}
                    type="button"
                    onClick={() => addLoader(loader)}
                    className="w-full text-left px-4 py-3.5 font-bold text-zinc-900 hover:bg-blue-50 border-2 border-zinc-100 rounded-xl flex items-center justify-between"
                  >
                    <span>{loader.name}</span>
                    <span className="text-blue-500 text-xs font-black uppercase bg-blue-50 px-2 py-1 rounded-lg">
                      + Добавить
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
