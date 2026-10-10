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
import { isNoCashCounterparty } from '@saldacargo/shared';
import {
  calculateOrderPayroll,
  ORDER_DIRECTIONS,
  type OrderDirectionItem,
} from '@saldacargo/domain-payroll';

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  amount: z.coerce.number().positive('Введите сумму'),
  driver_pay: z.coerce.number().min(0).optional(),
  payment_method: z.enum(['cash', 'qr', 'debt_cash']),
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

// ─── Payment methods (1. QR-код, 2. Наличный, 3. Долг) ────────────────────────

const PAYMENT_METHODS = [
  {
    value: 'qr' as const,
    label: 'QR-код',
    sublabel: 'Т-Банк / СБП',
    icon: '⚡',
    wallet: '→ Расчётный счёт',
    color:
      'peer-checked:border-purple-600 peer-checked:bg-purple-50 peer-checked:ring-2 peer-checked:ring-purple-300',
  },
  {
    value: 'cash' as const,
    label: 'Наличный',
    sublabel: 'Сдаст в кассу',
    icon: '💵',
    wallet: '→ Сейф ТК',
    color:
      'peer-checked:border-emerald-600 peer-checked:bg-emerald-50 peer-checked:ring-2 peer-checked:ring-emerald-300',
  },
  {
    value: 'debt_cash' as const,
    label: 'Долг',
    sublabel: 'Не отдали (дебиторка)',
    icon: '⏳',
    wallet: '→ Дебиторка',
    color:
      'peer-checked:border-rose-600 peer-checked:bg-rose-50 peer-checked:ring-2 peer-checked:ring-rose-300',
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

  // Trip data to detect PRR trip
  const { data: trip } = useQuery<{
    id: string;
    trip_type?: string;
    asset?: { short_name: string; reg_number: string };
  }>({
    queryKey: ['trip', tripId],
    queryFn: () => fetch(`/api/trips/${tripId}`).then((r) => r.json()),
    staleTime: 60000,
  });

  const tripIsPrr =
    trip?.asset?.reg_number === 'БЕЗ АВТО' ||
    Boolean(trip?.asset?.short_name?.includes('Без авто')) ||
    Boolean(trip?.asset?.short_name?.includes('ПРР')) ||
    trip?.trip_type === 'loaders_only';

  // Направление заказа
  const [direction, setDirection] = useState<string>('local');
  const [showDirectionPicker, setShowDirectionPicker] = useState(false);

  useEffect(() => {
    if (tripIsPrr) {
      setDirection('loaders_only');
    }
  }, [tripIsPrr]);

  const isLoadersOnly = direction === 'loaders_only' || tripIsPrr;

  // Водитель-грузчик
  const [isDriverLoader, setIsDriverLoader] = useState(false);
  const [loadingAmount, setLoadingAmount] = useState<string>('');

  // Client selection state
  const [clientType, setClientType] = useState<'individual' | 'legal' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Loaders (динамический неограниченный список)
  const [loaders, setLoaders] = useState<SelectedLoader[]>([]);
  const [showLoaderPicker, setShowLoaderPicker] = useState(false);

  const { data: counterparties = [] } = useQuery<Counterparty[]>({
    queryKey: ['driver', 'counterparties'],
    queryFn: () => fetch('/api/driver/counterparties').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const genericClient = counterparties.find(
    (c) => c.id === 'ba412028-ed45-4cf8-b365-ad76a93afd71' || c.name === 'Частный клиент',
  );

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

  const parsedLoadingAmount = loadingAmount !== '' ? Number(loadingAmount) : undefined;

  const payroll = calculateOrderPayroll({
    direction: isLoadersOnly ? 'loaders_only' : direction,
    amount,
    isDriverLoader: isLoadersOnly ? false : isDriverLoader,
    loadersCount: loaders.length,
    minMachineBase,
    loadingAmount: isLoadersOnly ? undefined : parsedLoadingAmount,
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
  const paymentMethods = PAYMENT_METHODS;

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

    if (isNoCashCounterparty(c)) {
      setValue('payment_method', 'debt_cash');
    } else {
      const current = watch('payment_method');
      if (!current) {
        setValue('payment_method', c.is_legal_entity ? 'debt_cash' : 'cash');
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

  async function onSubmit(data: FormData) {
    if (submitting) return;
    if (!data.counterparty_id) {
      setError('Укажите клиента перед добавлением заказа');
      return;
    }
    if (isLoadersOnly && loaders.length === 0) {
      setError('Добавьте хоть 1 грузчика');
      return;
    }
    if (data.payment_method === 'cash' && isNoCashCounterparty(selectedCounterparty)) {
      setError(
        `Для клиента «${selectedCounterparty?.name}» оплата наличными запрещена. Заказ оформляется только в долг (дебиторка) или по QR-коду.`,
      );
      return;
    }
    const isDebt = data.payment_method === 'debt_cash';
    let description = data.description?.trim() || '';
    if (isDebt && !description) {
      description = `Долг: ${selectedCounterparty?.name || 'Клиент'}`;
    }

    setSubmitting(true);
    setError('');

    // Подготовка данных грузчиков и водителя
    const finalDirection = isLoadersOnly ? 'loaders_only' : direction;
    const finalIsDriverLoader = isLoadersOnly ? false : isDriverLoader;
    const driverPayValue = isLoadersOnly
      ? '0'
      : isCity
        ? String(payroll.driverTotalPay)
        : String(data.driver_pay ?? 0);

    const loadersData = loaders.map((l) => ({
      id: l.id,
      name: l.name,
      pay:
        isLoadersOnly || isCity ? String(payroll.loaderPayEach) : String(parseFloat(l.pay || '0')),
    }));

    const payload = JSON.stringify({
      ...data,
      description: description || null,
      direction: finalDirection,
      is_driver_loader: finalIsDriverLoader,
      driver_car_pay: isLoadersOnly ? '0' : String(payroll.driverCarPay),
      driver_loader_pay: isLoadersOnly ? '0' : String(payroll.driverLoaderPay),
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
            className="w-full text-left px-4 h-14 rounded-xl border-2 border-orange-200 bg-orange-50/50 hover:bg-orange-50 flex items-center justify-between transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xl shrink-0">{currentDirectionObj.icon}</span>
              <span className="font-black text-zinc-900 text-sm truncate">
                {isLoadersOnly ? 'Погрузо-разгрузочные работы' : currentDirectionObj.label}
              </span>
            </div>
            <span className="text-xs font-black uppercase text-orange-600 bg-orange-100 px-2.5 py-1 rounded-lg shrink-0">
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
                {isNoCashCounterparty(selectedCounterparty) && (
                  <span className="ml-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                    🚫 Без наличных (только дебиторка)
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
          ) : (
            <div className="space-y-3">
              {genericClient && (
                <button
                  type="button"
                  onClick={() => selectCounterparty(genericClient)}
                  className="w-full px-3.5 h-10 rounded-xl border-2 border-orange-500 bg-orange-50 hover:bg-orange-100 flex items-center justify-between text-left transition-all active:scale-[0.99] shadow-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">👤</span>
                    <span className="font-black text-sm text-orange-950 truncate">
                      {genericClient.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-black uppercase text-white bg-orange-600 px-2.5 py-1 rounded-md shadow-xs shrink-0">
                    Выбрать
                  </span>
                </button>
              )}

              {topCounterparties.filter((c) => c.id !== genericClient?.id).length > 0 &&
                searchTerm === '' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-1">
                      Постоянные клиенты
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {topCounterparties
                        .filter((c) => c.id !== genericClient?.id)
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => selectCounterparty(c)}
                            className="px-3 py-1.5 rounded-lg border-2 border-zinc-200 bg-white text-xs font-bold text-zinc-700 active:scale-95 flex items-center gap-1.5 shadow-sm hover:border-zinc-300"
                          >
                            <span className="text-sm">{c.is_legal_entity ? '🏢' : '👤'}</span>
                            {c.name}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Поиск по базе постоянных клиентов..."
                  className="w-full rounded-xl border-2 border-zinc-200 px-4 h-14 text-zinc-900 font-bold focus:border-orange-500 focus:outline-none transition-colors"
                />
                {searchTerm.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border-2 border-zinc-200 rounded-xl mt-1 shadow-xl z-10 max-h-60 overflow-y-auto">
                    {filteredCounterparties.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectCounterparty(c)}
                        className="w-full text-left px-4 py-3 font-bold text-zinc-900 hover:bg-orange-50 border-b border-zinc-100 last:border-0 flex items-center justify-between gap-2"
                      >
                        <span className="flex items-center gap-2">
                          <span>{c.is_legal_entity ? '🏢' : '👤'}</span>
                          <span>{c.name}</span>
                        </span>
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
                      <div className="p-4 text-center space-y-2">
                        <p className="text-xs font-bold text-zinc-600">
                          Клиент «{searchTerm}» не найден в базе
                        </p>
                        {genericClient && (
                          <button
                            type="button"
                            onClick={() => selectCounterparty(genericClient)}
                            className="w-full py-2.5 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wide shadow-sm"
                          >
                            Выбрать «Частный клиент»
                          </button>
                        )}
                        <p className="text-[10px] text-zinc-400">
                          Новых постоянных клиентов и юрлиц регистрирует администратор
                        </p>
                      </div>
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
        {!isLoadersOnly && (
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
        )}

        {/* ── Грузчики ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between pl-1">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              {isLoadersOnly ? 'Грузчики' : 'Сторонние грузчики'} ({loaders.length})
            </label>
            {(isLoadersOnly || isCity) && loaders.length > 0 && (
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

              {isLoadersOnly || isCity ? (
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

          {isLoadersOnly && loaders.length === 0 && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-3 text-rose-700 text-xs font-black uppercase tracking-wide flex items-center gap-2">
              <span className="text-base leading-none">⚠️</span>
              <span>Добавьте хоть 1 грузчика</span>
            </div>
          )}
        </div>

        {/* ── Сумма за погрузку (только для рейсов с автомобилем) ── */}
        {!isLoadersOnly && (
          <div className="bg-amber-50/80 border-2 border-amber-200 rounded-2xl p-4 space-y-3">
            <label className="block text-xs font-black text-amber-900 uppercase tracking-wide">
              Введите сумму за погрузку
            </label>

            <input
              type="number"
              inputMode="numeric"
              value={loadingAmount}
              onChange={(e) => {
                const val = e.target.value;
                setLoadingAmount(val);
                if (val !== '' && Number(val) > 0 && loaders.length === 0 && !isDriverLoader) {
                  setIsDriverLoader(true);
                }
              }}
              placeholder="0 ₽"
              className="w-full rounded-xl border-2 border-amber-300 bg-white px-4 h-12 text-xl font-black text-zinc-900 focus:border-amber-500 focus:outline-none transition-colors"
            />

            <div className="flex items-center justify-between text-xs font-bold pt-2 border-t border-amber-200/60 text-amber-900">
              <span>🚗 На машину остаётся:</span>
              <span className="font-mono text-sm font-black text-amber-950">
                {payroll.machinePool.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          </div>
        )}

        {/* ── Расчёт ПРР или ЗП водителя ── */}
        {isLoadersOnly ? (
          <div className="bg-zinc-900 text-white rounded-2xl p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-orange-400">
                ⚡ Расчёт ПРР
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-zinc-800/80 p-2.5 rounded-xl">
                <div className="text-zinc-400 font-bold">👥 Грузчикам</div>
                <div className="text-base font-black text-blue-400 mt-0.5">
                  {payroll.totalLoadersPay.toLocaleString('ru-RU')} ₽
                </div>
                <div className="text-[10px] text-zinc-400">
                  {loaders.length > 0
                    ? `по ${payroll.loaderPayEach.toLocaleString('ru-RU')} ₽ на ${loaders.length} чел.`
                    : 'грузчики не выбраны'}
                </div>
              </div>

              <div className="bg-zinc-800/80 p-2.5 rounded-xl">
                <div className="text-zinc-400 font-bold">🏢 Компании</div>
                <div className="text-base font-black text-emerald-400 mt-0.5">
                  {payroll.companyShare.toLocaleString('ru-RU')} ₽
                </div>
                <div className="text-[10px] text-zinc-400">доход компании</div>
              </div>
            </div>

            {loaders.length === 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-center">
                <p className="text-xs font-bold text-amber-300">⚠️ Добавьте хоть 1 грузчика</p>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80">
                <span className="text-xs font-bold text-zinc-400">
                  Каждому грузчику ({loaders.length} чел.):
                </span>
                <span className="text-lg font-black text-white">
                  {payroll.loaderPayEach.toLocaleString('ru-RU')} ₽
                </span>
              </div>
            )}
          </div>
        ) : isCity ? (
          <div className="bg-zinc-900 text-white rounded-2xl p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-orange-400">
                ⚡ Расчёт ЗП («{currentDirectionObj.label}»)
              </span>
              <span className="text-xs font-bold text-zinc-400">Автоматически</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-zinc-800/80 p-2.5 rounded-xl">
                <div className="text-zinc-400 font-bold">🚗 За машину (30%)</div>
                <div className="text-base font-black text-white mt-0.5">
                  {payroll.driverCarPay} ₽
                </div>
                <div className="text-[10px] text-zinc-400">
                  из {payroll.machinePool.toLocaleString('ru-RU')} ₽
                </div>
              </div>

              <div className="bg-zinc-800/80 p-2.5 rounded-xl">
                <div className="text-zinc-400 font-bold">📦 За погрузку (70%)</div>
                <div className="text-base font-black text-white mt-0.5">
                  {payroll.driverLoaderPay} ₽
                </div>
                <div className="text-[10px] text-zinc-400">
                  {isDriverLoader
                    ? `из ${payroll.loadersPool.toLocaleString('ru-RU')} ₽`
                    : 'не отмечен'}
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
          <div className="grid grid-cols-3 gap-2">
            {paymentMethods.map((m) => {
              const isNoCash = isNoCashCounterparty(selectedCounterparty);
              const isCashDisabled = m.value === 'cash' && isNoCash;
              return (
                <label
                  key={m.value}
                  className={
                    isCashDisabled ? 'cursor-not-allowed opacity-35 select-none' : 'cursor-pointer'
                  }
                >
                  <input
                    type="radio"
                    value={m.value}
                    disabled={isCashDisabled}
                    {...register('payment_method')}
                    className="sr-only peer"
                  />
                  <div
                    className={`flex flex-col items-center justify-center gap-1 border-2 rounded-2xl p-2.5 h-24 transition-all ${
                      isCashDisabled
                        ? 'border-zinc-200 bg-zinc-100 cursor-not-allowed'
                        : `border-zinc-200 active:scale-[0.97] ${m.color}`
                    }`}
                  >
                    <span className="text-2xl">{isCashDisabled ? '🚫' : m.icon}</span>
                    <span
                      className={`text-[11px] font-black text-center leading-tight uppercase tracking-tight ${
                        isCashDisabled ? 'text-zinc-400 line-through' : 'text-zinc-900'
                      }`}
                    >
                      {m.label}
                    </span>
                    <span className="text-[8px] font-bold text-zinc-400 text-center leading-tight">
                      {isCashDisabled ? 'Запрещено' : m.wallet}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Баннер запрета наличных для корпоративных клиентов */}
          {isNoCashCounterparty(selectedCounterparty) && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-amber-900 text-[11px] font-extrabold flex items-start gap-2 mt-2">
              <span className="text-base leading-none">🚫</span>
              <span>
                Клиент «{selectedCounterparty?.name}» обслуживается строго по безналичному расчёту!
                Оплата наличными отключена — заказ оформляется в долг (дебиторка) под выставление
                счёта или по QR.
              </span>
            </div>
          )}

          {/* Подсказка для QR */}
          {selectedPaymentMethod === 'qr' && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-purple-900 text-[10px] font-extrabold uppercase tracking-wide flex items-start gap-2 mt-2">
              <span className="text-sm leading-none">⚡</span>
              <span>
                Клиент перевёл по QR-коду / СБП на счёт Т-Банка. Наличные сдавать не нужно.
              </span>
            </div>
          )}

          {/* Подсказка для налички */}
          {selectedPaymentMethod === 'cash' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wide flex items-start gap-2 mt-2">
              <span className="text-sm leading-none">💵</span>
              <span>
                Деньги физически у вас в виде наличных. Сдаются в сейф/кассу ТК в конце смены.
              </span>
            </div>
          )}

          {/* Подсказка для долга */}
          {selectedPaymentMethod === 'debt_cash' && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-900 text-[10px] font-extrabold uppercase tracking-wide flex items-start gap-2 mt-2">
              <span className="text-sm leading-none">⏳</span>
              <span>
                Деньги не отдали! Заказ зафиксирован как долг и автоматически попадает в Дебиторку.
              </span>
            </div>
          )}
        </div>

        {/* ── Описание / Комментарий / Примечание к заказу ── */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold uppercase tracking-widest pl-1 text-zinc-500">
            {isDebt
              ? '⏳ Комментарий к долгу (опционально)'
              : selectedCounterparty?.name === 'Частный клиент'
                ? '📝 Примечание к заказу (холодильник, диван, адрес...)'
                : 'Примечание / Описание (опционально)'}
          </label>
          <input
            type="text"
            {...register('description')}
            placeholder={
              isDebt
                ? 'Обещал заплатить в пятницу...'
                : selectedCounterparty?.name === 'Частный клиент'
                  ? 'Детали заказа: холодильник, этаж, адрес...'
                  : 'Переезд, доставка плитки, детали...'
            }
            className={`w-full rounded-xl border-2 px-4 h-14 text-sm font-bold text-zinc-900 focus:outline-none transition-colors ${
              isDebt
                ? 'border-rose-400 bg-rose-50/50 focus:border-rose-600'
                : selectedCounterparty?.name === 'Частный клиент'
                  ? 'border-orange-300 bg-orange-50/20 focus:border-orange-500'
                  : 'border-zinc-200 focus:border-orange-500'
            }`}
          />
          {selectedCounterparty?.name === 'Частный клиент' && (
            <p className="text-[10px] font-medium text-zinc-400 pl-1">
              Укажите детали груза, чтобы легко отличать заказы частных клиентов
            </p>
          )}
        </div>

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
                          {dir.baseMachinePrice ? (
                            <span className="text-xs font-black text-zinc-700 bg-zinc-100 px-2.5 py-1 rounded-lg">
                              {dir.baseMachinePrice} ₽
                            </span>
                          ) : (
                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                              ⚡ Авто
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

              {/* Нижний Тагил */}
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-blue-600 px-1">
                  🏭 Нижний Тагил (авторасчёт)
                </div>
                {ORDER_DIRECTIONS.filter((d) => d.id.startsWith('tagil_')).map(
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
                          <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                            ⚡ Авто (30%)
                          </span>
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
                {ORDER_DIRECTIONS.filter(
                  (d) => d.category === 'intercity' && !d.id.startsWith('tagil_'),
                ).map((dir: OrderDirectionItem) => {
                  const isSelected = direction === dir.id;
                  const isEkb = dir.id === 'ekb';
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
                        {isEkb ? (
                          <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                            ✍️ Ручной ввод
                          </span>
                        ) : (
                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            ⚡ Авто (30%)
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-xs font-black text-orange-600 bg-orange-100 px-2.5 py-1 rounded-full uppercase">
                            Выбрано
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
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
