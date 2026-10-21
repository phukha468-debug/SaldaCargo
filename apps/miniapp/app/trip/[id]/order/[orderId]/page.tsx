/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, cn } from '@saldacargo/ui';
import {
  isNoCashCounterparty,
  isTerritoryCounterparty,
  formatTerritoryDescription,
  parseTerritoryDescription,
  isGeostroyCounterparty,
  formatGeostroyDescription,
  parseGeostroyDescription,
  maskDateInput,
  isValidDateString,
  getTodayDateString,
  getYesterdayDateString,
} from '@saldacargo/shared';
import {
  calculateOrderPayroll,
  ORDER_DIRECTIONS,
  type OrderDirectionItem,
} from '@saldacargo/domain-payroll';

const schema = z.object({
  amount: z.coerce.number().positive('Введите сумму'),
  driver_pay: z.coerce.number().min(0).optional(),
  payment_method: z.enum(['cash', 'qr', 'debt_cash', 'card_driver']),
  description: z.string().optional(),
  counterparty_id: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Loader {
  id: string;
  name: string;
}

interface SelectedLoader {
  id: string;
  name: string;
  pay: string;
}

const PAYMENT_METHODS = [
  { value: 'qr', label: 'QR-код', icon: '⚡' },
  { value: 'cash', label: 'Наличный', icon: '💵' },
  { value: 'debt_cash', label: 'Долг', icon: '⏳' },
] as const;

const SUGGEST_PERCENT = 30;

interface TripOrder {
  id: string;
  counterparty_id: string | null;
  counterparty: {
    name: string;
    is_legal_entity?: boolean;
    is_delivery_zone_client?: boolean;
    min_delivery_base?: number;
  } | null;
  description: string | null;
  direction?: string;
  is_driver_loader?: boolean;
  driver_car_pay?: string;
  driver_loader_pay?: string;
  loaders_data?: Array<{ id: string; name: string; pay: string }>;
  amount: string;
  driver_pay: string;
  loader_id: string | null;
  loader_pay: string;
  loader2_id: string | null;
  loader2_pay: string;
  payment_method: string;
  lifecycle_status: string;
  loader: { id: string; name: string } | null;
  loader2: { id: string; name: string } | null;
}

interface Trip {
  id: string;
  lifecycle_status: string;
  trip_orders: TripOrder[];
  trip_type?: string;
  asset?: { short_name: string; reg_number: string };
}

export default function EditOrderPage() {
  const params = useParams();
  const tripId = params.id as string;
  const orderId = params.orderId as string;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Направление заказа
  const [direction, setDirection] = useState<string>('local');
  const [showDirectionPicker, setShowDirectionPicker] = useState(false);

  // Водитель-грузчик
  const [isDriverLoader, setIsDriverLoader] = useState(false);
  const [loadingAmount, setLoadingAmount] = useState<string>('');

  // Loaders
  const [loaders, setLoaders] = useState<SelectedLoader[]>([]);
  const [showLoaderPicker, setShowLoaderPicker] = useState(false);

  const { data: trip, isLoading } = useQuery<Trip>({
    queryKey: ['trip', tripId],
    queryFn: () => fetch(`/api/trips/${tripId}`).then((r) => r.json()),
    staleTime: 60000,
  });

  const tripIsPrr =
    trip?.asset?.reg_number === 'БЕЗ АВТО' ||
    Boolean(trip?.asset?.short_name?.includes('Без авто')) ||
    Boolean(trip?.asset?.short_name?.includes('ПРР')) ||
    trip?.trip_type === 'loaders_only';

  const isLoadersOnly = direction === 'loaders_only' || tripIsPrr;

  const { data: counterparties = [] } = useQuery<
    Array<{
      id: string;
      name: string;
      is_legal_entity?: boolean;
      is_top?: boolean;
      is_delivery_zone_client?: boolean;
      min_delivery_base?: number;
    }>
  >({
    queryKey: ['driver', 'counterparties'],
    queryFn: () => fetch('/api/driver/counterparties').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const genericClient = counterparties.find(
    (c: any) => c.id === 'ba412028-ed45-4cf8-b365-ad76a93afd71' || c.name === 'Частный клиент',
  );

  const { data: allLoaders = [] } = useQuery<Loader[]>({
    queryKey: ['driver', 'loaders'],
    queryFn: () => fetch('/api/driver/loaders').then((r) => r.json()),
    staleTime: 10 * 60 * 1000,
  });

  const order = trip?.trip_orders.find((o) => o.id === orderId);

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

  useEffect(() => {
    if (order && !initialized) {
      setValue('amount', parseFloat(order.amount));
      setValue('driver_pay', parseFloat(order.driver_pay));
      const pm = order.payment_method === 'card_driver' ? 'qr' : order.payment_method;
      let finalPm = (pm || 'cash') as any;
      if (finalPm === 'cash' && isNoCashCounterparty(order.counterparty)) {
        finalPm = 'debt_cash';
      }
      setValue('payment_method', finalPm);
      setValue('description', order.description ?? '');
      if (order.description) {
        const parsed = parseTerritoryDescription(order.description);
        setTerritoryAddress(parsed.address);
        setTerritoryWork(parsed.work);

        const parsedGeo = parseGeostroyDescription(order.description);
        setGeostroyRoute(parsedGeo.route);
        setGeostroyDate(parsedGeo.startDate);
      }
      if (order.counterparty_id) setValue('counterparty_id', order.counterparty_id);

      if (order.direction) setDirection(order.direction);
      if (order.is_driver_loader !== undefined) setIsDriverLoader(Boolean(order.is_driver_loader));

      const initial: SelectedLoader[] = [];
      if (Array.isArray(order.loaders_data) && order.loaders_data.length > 0) {
        for (const item of order.loaders_data) {
          if (item.id) {
            initial.push({
              id: item.id,
              name: item.name || 'Грузчик',
              pay: String(item.pay ?? '0'),
            });
          }
        }
      } else {
        if (order.loader_id && order.loader) {
          initial.push({
            id: order.loader_id,
            name: order.loader.name,
            pay: order.loader_pay ?? '0',
          });
        }
        if (order.loader2_id && order.loader2) {
          initial.push({
            id: order.loader2_id,
            name: order.loader2.name,
            pay: order.loader2_pay ?? '0',
          });
        }
      }
      setLoaders(initial);
      setInitialized(true);
    }
  }, [order, initialized, setValue]);

  const [territoryAddress, setTerritoryAddress] = useState('');
  const [territoryWork, setTerritoryWork] = useState('');

  const [geostroyRoute, setGeostroyRoute] = useState('');
  const [geostroyDate, setGeostroyDate] = useState('');

  const selectedCounterpartyId = watch('counterparty_id');
  const selectedPaymentMethod = watch('payment_method');
  const selectedCounterparty =
    counterparties.find((c: any) => c.id === selectedCounterpartyId) ??
    (order?.counterparty && selectedCounterpartyId === order.counterparty_id
      ? {
          id: order.counterparty_id!,
          name: order.counterparty!.name,
          is_legal_entity: order.counterparty?.is_legal_entity ?? false,
          is_delivery_zone_client: order.counterparty?.is_delivery_zone_client,
          min_delivery_base: order.counterparty?.min_delivery_base,
        }
      : null);

  const isTerritory = isTerritoryCounterparty(selectedCounterparty);
  const isGeostroy = isGeostroyCounterparty(selectedCounterparty);

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
    isDriverLoader,
    loadersCount: loaders.length,
    minMachineBase,
    loadingAmount: isLoadersOnly ? undefined : parsedLoadingAmount,
  });

  const isCity = payroll.isAutomatic;
  const suggestedPay = amount ? Math.round((amount * SUGGEST_PERCENT) / 100) : 0;

  const filteredCounterparties =
    searchTerm.length > 0
      ? counterparties.filter((c: any) => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
      : [];

  const topCounterparties = counterparties.filter((c: any) => c.is_top);

  const availableLoaders = allLoaders.filter((l) => !loaders.find((s) => s.id === l.id));
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

  function selectCounterparty(c: any) {
    setValue('counterparty_id', c.id);
    setSearchTerm('');
    setError('');
    if (isNoCashCounterparty(c)) {
      setValue('payment_method', 'debt_cash');
    }
  }

  async function onSubmit(data: FormData) {
    if (submitting) return;
    if (!data.counterparty_id) {
      setError('Укажите клиента перед сохранением');
      return;
    }
    if (isLoadersOnly && !isDriverLoader && loaders.length === 0) {
      setError('Укажите, кто выполнял разгрузку/погрузку: вы (водитель) или сторонние грузчики');
      return;
    }
    if (data.payment_method === 'cash' && isNoCashCounterparty(selectedCounterparty)) {
      setError(
        `Для клиента «${selectedCounterparty?.name}» оплата наличными запрещена. Заказ оформляется только в долг (дебиторка) или по QR-коду.`,
      );
      return;
    }

    const isTerritory = isTerritoryCounterparty(selectedCounterparty);
    const isGeostroy = isGeostroyCounterparty(selectedCounterparty);
    let description = '';
    if (isTerritory) {
      if (!territoryAddress.trim()) {
        setError('Для контрагента «Территория» обязательно укажите адрес (улица + дом)!');
        return;
      }
      if (!territoryWork.trim()) {
        setError('Для контрагента «Территория» обязательно укажите описание работы!');
        return;
      }
      description = formatTerritoryDescription(territoryAddress, territoryWork);
    } else if (isGeostroy) {
      if (!geostroyRoute.trim()) {
        setError('Для контрагента «ООО Геостройиндустрия» обязательно укажите маршрут!');
        return;
      }
      if (!isValidDateString(geostroyDate)) {
        setError(
          'Для контрагента «ООО Геостройиндустрия» укажите дату начала маршрута по маске ДД.ММ.ГГГГ (например: 18.10.2026)!',
        );
        return;
      }
      description = formatGeostroyDescription(geostroyRoute, geostroyDate);
    } else {
      const isDebt = data.payment_method === 'debt_cash';
      description = data.description?.trim() || '';
      if (isDebt && !description) {
        description = `Долг: ${selectedCounterparty?.name || 'Клиент'}`;
      }
    }

    setSubmitting(true);
    setError('');

    const finalDirection = isLoadersOnly ? 'loaders_only' : direction;
    const finalIsDriverLoader = isDriverLoader;
    const driverPayValue = isLoadersOnly
      ? String(payroll.driverTotalPay)
      : isCity
        ? String(payroll.driverTotalPay)
        : String(data.driver_pay ?? 0);

    const loadersData = loaders.map((l) => ({
      id: l.id,
      name: l.name,
      pay:
        isLoadersOnly || isCity ? String(payroll.loaderPayEach) : String(parseFloat(l.pay || '0')),
    }));

    const res = await fetch(`/api/trips/${tripId}/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'edit',
        direction: finalDirection,
        is_driver_loader: finalIsDriverLoader,
        driver_car_pay: isLoadersOnly ? '0' : String(payroll.driverCarPay),
        driver_loader_pay: String(payroll.driverLoaderPay),
        counterparty_id: data.counterparty_id ?? null,
        description: description || null,
        amount: String(data.amount),
        driver_pay: driverPayValue,
        loaders_data: loadersData,
        loader_id: loadersData[0]?.id ?? null,
        loader_pay: loadersData[0]?.pay ?? '0',
        loader2_id: loadersData[1]?.id ?? null,
        loader2_pay: loadersData[1]?.pay ?? '0',
        payment_method: data.payment_method === 'card_driver' ? 'qr' : data.payment_method,
      }),
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="animate-spin text-3xl">⚙️</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-4xl mb-4">🔍</p>
          <p className="text-zinc-600 font-bold uppercase tracking-tight">Заказ не найден</p>
          <button
            onClick={() => router.push(`/trip/${tripId}`)}
            className="mt-4 text-orange-600 font-black uppercase tracking-widest text-sm"
          >
            Назад к рейсу
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b-2 border-zinc-200 px-4 h-16 flex items-center gap-3 sticky top-0 z-50">
        <button
          type="button"
          onClick={() => {
            const currentPath = window.location.pathname;
            const fallbackUrl = `/trip/${tripId}`;
            if (typeof window !== 'undefined' && window.history.length > 1) {
              router.back();
            } else {
              router.push(fallbackUrl);
            }
            setTimeout(() => {
              if (window.location.pathname === currentPath) {
                router.push(fallbackUrl);
              }
            }, 250);
          }}
          className="text-zinc-500 text-2xl active:scale-95 transition-transform cursor-pointer p-1 -ml-1"
          title="Назад"
        >
          ←
        </button>
        <h1 className="font-black text-zinc-900 text-lg uppercase tracking-tight">
          Редактировать заказ
        </h1>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-6 pb-28">
        {/* ── Формат заказа: С машиной / Без машины ── */}
        {!tripIsPrr && (
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
              Формат заказа
            </label>
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-zinc-100 rounded-2xl border border-zinc-200">
              <button
                type="button"
                onClick={() => {
                  if (isLoadersOnly) {
                    setDirection('local');
                  }
                }}
                className={cn(
                  'py-3 px-3 rounded-xl font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 transition-all',
                  !isLoadersOnly
                    ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-900',
                )}
              >
                <span className="text-base">🚚</span>
                <span>С машиной</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDirection('loaders_only');
                  setIsDriverLoader(true);
                }}
                className={cn(
                  'py-3 px-3 rounded-xl font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 transition-all',
                  isLoadersOnly
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900',
                )}
              >
                <span className="text-base">👷</span>
                <span>Без машины (ПРР)</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Направление заказа (если с машиной) или плашка «Без машины» ── */}
        {!isLoadersOnly ? (
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
                  {currentDirectionObj.label}
                </span>
              </div>
              <span className="text-xs font-black uppercase text-orange-600 bg-orange-100 px-2.5 py-1 rounded-lg shrink-0">
                Изменить
              </span>
            </button>
          </div>
        ) : (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">👷</span>
              <div>
                <div className="font-black text-amber-950 text-sm">Заказ без машины (ПРР)</div>
                <div className="text-xs font-bold text-amber-700">
                  Разгрузка, погрузка другой машины, работы без авто
                </div>
              </div>
            </div>
            {!tripIsPrr && (
              <button
                type="button"
                onClick={() => setDirection('local')}
                className="text-[10px] font-black uppercase text-amber-800 bg-amber-100 hover:bg-amber-200 px-2.5 py-1.5 rounded-lg border border-amber-300 transition-colors shrink-0"
              >
                С машиной
              </button>
            )}
          </div>
        )}

        {/* ── Клиент ── */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
            Клиент
          </label>

          {selectedCounterparty ? (
            <div className="flex items-center justify-between border-2 border-orange-200 bg-orange-50 rounded-xl px-4 h-14">
              <div>
                <span className="font-black text-orange-900 text-sm">
                  {selectedCounterparty.name}
                </span>
                {selectedCounterparty.is_legal_entity && (
                  <span className="ml-2 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">
                    ЮЛ
                  </span>
                )}
                {selectedCounterparty.is_delivery_zone_client && (
                  <span className="ml-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    Зоны (от 800 ₽)
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
                onClick={() => setValue('counterparty_id', undefined)}
                className="font-black text-orange-400 text-lg hover:text-orange-600"
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

              {topCounterparties.filter((c: any) => c.id !== genericClient?.id).length > 0 &&
                searchTerm === '' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-1">
                      Постоянные клиенты
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {topCounterparties
                        .filter((c: any) => c.id !== genericClient?.id)
                        .map((c: any) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => selectCounterparty(c)}
                            className="px-3 py-1.5 rounded-lg border-2 border-zinc-200 bg-white text-xs font-bold text-zinc-700 active:scale-95 flex items-center gap-1.5 shadow-sm hover:border-zinc-300"
                          >
                            <span className="text-sm">{c.is_legal_entity ? '🏢' : '👤'}</span>
                            {c.name}
                            {isNoCashCounterparty(c) && (
                              <span className="text-[9px] font-black uppercase px-1 py-0.5 rounded-full bg-rose-100 text-rose-700">
                                Без нал
                              </span>
                            )}
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
                    {filteredCounterparties.map((c: any) => (
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
                        <span className="flex items-center gap-1">
                          {isNoCashCounterparty(c) && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                              Без нал
                            </span>
                          )}
                          {c.is_legal_entity && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">
                              ЮЛ
                            </span>
                          )}
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
                <div className="font-black text-zinc-900 text-sm">
                  {isLoadersOnly
                    ? '🚚 Я (водитель) работал на разгрузке/погрузке'
                    : '🚚 Я работал грузчиком'}
                </div>
                <div className="text-xs font-bold text-zinc-500">
                  {isLoadersOnly
                    ? 'Водитель получает 70% чека (или делит поровну с доп. грузчиками)'
                    : 'Водитель получает оплату за авто + за работу грузчика'}
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

          {isLoadersOnly && !isDriverLoader && loaders.length === 0 && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-3 text-rose-700 text-xs font-black uppercase tracking-wide flex items-center gap-2">
              <span className="text-base leading-none">⚠️</span>
              <span>Укажите исполнителей: включите «Я работал» или добавьте грузчика</span>
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
                ⚡ Расчёт (без авто · ПРР)
              </span>
              <span className="text-xs font-bold text-zinc-400">70% рабочим / 30% компании</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {isDriverLoader && (
                <div className="bg-zinc-800/80 p-2.5 rounded-xl">
                  <div className="text-zinc-400 font-bold">🚚 Водителю (ЗП)</div>
                  <div className="text-base font-black text-amber-400 mt-0.5">
                    {payroll.driverLoaderPay.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="text-[10px] text-zinc-400">за разгрузку/погрузку</div>
                </div>
              )}

              {loaders.length > 0 && (
                <div className="bg-zinc-800/80 p-2.5 rounded-xl">
                  <div className="text-zinc-400 font-bold">
                    👥 Грузчикам ({loaders.length} чел.)
                  </div>
                  <div className="text-base font-black text-blue-400 mt-0.5">
                    {payroll.totalLoadersPay.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    по {payroll.loaderPayEach.toLocaleString('ru-RU')} ₽/чел
                  </div>
                </div>
              )}

              <div className="bg-zinc-800/80 p-2.5 rounded-xl">
                <div className="text-zinc-400 font-bold">🏢 Компании (30%)</div>
                <div className="text-base font-black text-emerald-400 mt-0.5">
                  {payroll.companyShare.toLocaleString('ru-RU')} ₽
                </div>
                <div className="text-[10px] text-zinc-400">доход компании</div>
              </div>
            </div>

            {!isDriverLoader && loaders.length === 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-center">
                <p className="text-xs font-bold text-amber-300">
                  ⚠️ Укажите исполнителей: водитель или грузчики
                </p>
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
            {PAYMENT_METHODS.map((m) => {
              const isNoCash = isNoCashCounterparty(selectedCounterparty);
              const isCashDisabled = m.value === 'cash' && isNoCash;
              const isSelected = selectedPaymentMethod === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  disabled={isCashDisabled}
                  onClick={() => {
                    if (isCashDisabled) return;
                    setValue('payment_method', m.value as any);
                  }}
                  className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${
                    isCashDisabled
                      ? 'border-zinc-200 bg-zinc-100 opacity-35 cursor-not-allowed select-none'
                      : isSelected
                        ? 'border-orange-500 bg-orange-50 active:scale-[0.97]'
                        : 'border-zinc-200 bg-white active:scale-[0.97]'
                  }`}
                >
                  <span className="text-2xl">{isCashDisabled ? '🚫' : m.icon}</span>
                  <span
                    className={`text-[10px] font-black text-center leading-tight uppercase tracking-tight ${
                      isCashDisabled ? 'text-zinc-400 line-through' : 'text-zinc-900'
                    }`}
                  >
                    {m.label}
                  </span>
                  {isCashDisabled && (
                    <span className="text-[8px] font-bold text-zinc-400">Запрещено</span>
                  )}
                </button>
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
        </div>

        {/* ── Описание / Комментарий / Примечание к заказу ── */}
        {isTerritory ? (
          <div className="bg-blue-50/90 border-2 border-blue-400 rounded-2xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 border-b border-blue-200 pb-2">
              <span className="text-xl">🏢</span>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wide text-blue-950">
                  Правило для контрагента «Территория»
                </h3>
                <p className="text-[10px] text-blue-800 font-medium">
                  Обязательно укажите адрес и работу для автоматического выставления счетов
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-blue-950 flex items-center justify-between">
                <span>
                  📍 Адрес (улица + дом) <span className="text-rose-600">*</span>
                </span>
                <span className="text-[9px] font-bold text-blue-700 normal-case">Обязательно</span>
              </label>
              <input
                type="text"
                value={territoryAddress}
                onChange={(e) => {
                  setTerritoryAddress(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Например: ул. Ленина, д. 45 (или Строителей 12)"
                className="w-full rounded-xl border-2 border-blue-300 bg-white px-4 h-12 text-sm font-bold text-zinc-900 focus:border-blue-600 focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-blue-950 flex items-center justify-between">
                <span>
                  🛠️ Описание работы <span className="text-rose-600">*</span>
                </span>
                <span className="text-[9px] font-bold text-blue-700 normal-case">Обязательно</span>
              </label>
              <input
                type="text"
                value={territoryWork}
                onChange={(e) => {
                  setTerritoryWork(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Например: Вывоз мусора / Доставка стройматериалов / ПРР"
                className="w-full rounded-xl border-2 border-blue-300 bg-white px-4 h-12 text-sm font-bold text-zinc-900 focus:border-blue-600 focus:outline-none transition-colors"
              />
            </div>

            {territoryAddress.trim() && territoryWork.trim() && (
              <div className="p-2.5 bg-white/90 rounded-xl border border-blue-200 text-[11px] text-blue-900">
                <span className="font-bold text-blue-950">В счёт пойдёт:</span>{' '}
                <span className="font-semibold text-zinc-900">
                  {territoryAddress.trim()} — {territoryWork.trim()}
                </span>
              </div>
            )}
          </div>
        ) : isGeostroy ? (
          <div className="bg-amber-50/90 border-2 border-amber-400 rounded-2xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 border-b border-amber-200 pb-2">
              <span className="text-xl">🏗️</span>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wide text-amber-950">
                  Правило для контрагента «ООО Геостройиндустрия»
                </h3>
                <p className="text-[10px] text-amber-800 font-medium">
                  Обязательно укажите маршрут и дату начала по маске (ДД.ММ.ГГГГ) для отправки на
                  ревью
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-amber-950 flex items-center justify-between">
                <span>
                  📍 Маршрут <span className="text-rose-600">*</span>
                </span>
                <span className="text-[9px] font-bold text-amber-700 normal-case">Обязательно</span>
              </label>
              <input
                type="text"
                value={geostroyRoute}
                onChange={(e) => {
                  setGeostroyRoute(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Например: Верхняя Салда — Екатеринбург (или Н.Тагил)"
                className="w-full rounded-xl border-2 border-amber-300 bg-white px-4 h-12 text-sm font-bold text-zinc-900 focus:border-amber-600 focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-wider text-amber-950">
                  📅 Дата начала маршрута <span className="text-rose-600">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setGeostroyDate(getTodayDateString());
                      if (error) setError('');
                    }}
                    className="px-2 py-0.5 rounded-md bg-amber-200/80 hover:bg-amber-300 text-amber-950 text-[10px] font-black tracking-tight active:scale-95 transition-all"
                  >
                    Сегодня
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGeostroyDate(getYesterdayDateString());
                      if (error) setError('');
                    }}
                    className="px-2 py-0.5 rounded-md bg-amber-200/80 hover:bg-amber-300 text-amber-950 text-[10px] font-black tracking-tight active:scale-95 transition-all"
                  >
                    Вчера
                  </button>
                </div>
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={geostroyDate}
                onChange={(e) => {
                  const masked = maskDateInput(e.target.value);
                  setGeostroyDate(masked);
                  if (error) setError('');
                }}
                placeholder="ДД.ММ.ГГГГ (например: 18.10.2026)"
                className="w-full rounded-xl border-2 border-amber-300 bg-white px-4 h-12 text-sm font-bold text-zinc-900 focus:border-amber-600 focus:outline-none transition-colors font-mono"
              />
              <p className="text-[10px] text-zinc-500 font-medium pl-1">
                Маска ввода: 8 цифр даты (день, месяц, 4 цифры года)
              </p>
            </div>

            {geostroyRoute.trim() && isValidDateString(geostroyDate) && (
              <div className="p-2.5 bg-white/90 rounded-xl border border-amber-200 text-[11px] text-amber-950">
                <span className="font-bold text-amber-950">В отчёт пойдёт:</span>{' '}
                <span className="font-semibold text-zinc-900 font-mono">
                  {formatGeostroyDescription(geostroyRoute, geostroyDate)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest pl-1 text-zinc-500">
              {selectedPaymentMethod === 'debt_cash'
                ? '⏳ Комментарий к долгу'
                : selectedCounterparty?.name === 'Частный клиент'
                  ? '📝 Примечание к заказу (холодильник, диван, адрес...)'
                  : 'Примечание / Описание (опционально)'}
            </label>
            <input
              type="text"
              {...register('description')}
              placeholder={
                selectedPaymentMethod === 'debt_cash'
                  ? 'Обещал заплатить в пятницу...'
                  : selectedCounterparty?.name === 'Частный клиент'
                    ? 'Детали заказа: холодильник, этаж, адрес...'
                    : 'Переезд, доставка плитки, детали...'
              }
              className={`w-full rounded-xl border-2 px-4 h-14 text-sm font-bold text-zinc-900 focus:outline-none transition-colors ${
                selectedPaymentMethod === 'debt_cash'
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
            {submitting ? 'Сохраняем...' : '💾 Сохранить изменения'}
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
