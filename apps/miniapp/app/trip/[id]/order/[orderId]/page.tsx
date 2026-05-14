/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@saldacargo/ui';

const schema = z.object({
  amount: z.coerce.number().positive('Введите сумму'),
  driver_pay: z.coerce.number().min(0),
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
  { value: 'cash', label: 'Наличные', icon: '💵' },
  { value: 'qr', label: 'QR на р/с', icon: '📱' },
  { value: 'card_driver', label: 'На карту', icon: '💳' },
  { value: 'debt_cash', label: 'Долг', icon: '⏳' },
] as const;

const SUGGEST_PERCENT = 30;

interface TripOrder {
  id: string;
  counterparty_id: string | null;
  counterparty: { name: string } | null;
  description: string | null;
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
  const [searchFocused, setSearchFocused] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [loaders, setLoaders] = useState<SelectedLoader[]>([]);
  const [showLoaderPicker, setShowLoaderPicker] = useState(false);
  const searchBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: trip, isLoading } = useQuery<Trip>({
    queryKey: ['trip', tripId],
    queryFn: () => fetch(`/api/trips/${tripId}`).then((r) => r.json()),
    staleTime: 60000,
  });

  const { data: counterparties = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['driver', 'counterparties'],
    queryFn: () => fetch('/api/driver/counterparties').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

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
    defaultValues: { payment_method: 'cash', driver_pay: 0 },
  });

  useEffect(() => {
    if (order && !initialized) {
      setValue('amount', parseFloat(order.amount));
      setValue('driver_pay', parseFloat(order.driver_pay));
      setValue('payment_method', order.payment_method as any);
      setValue('description', order.description ?? '');
      if (order.counterparty_id) setValue('counterparty_id', order.counterparty_id);

      const initial: SelectedLoader[] = [];
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
      setLoaders(initial);
      setInitialized(true);
    }
  }, [order, initialized, setValue]);

  const selectedCounterpartyId = watch('counterparty_id');
  const selectedCounterparty =
    counterparties.find((c) => c.id === selectedCounterpartyId) ??
    (order?.counterparty && selectedCounterpartyId === order.counterparty_id
      ? { id: order.counterparty_id!, name: order.counterparty!.name }
      : null);

  const amountRaw = watch('amount');
  const amount = amountRaw ? Number(amountRaw) : 0;
  const suggestedPay = amount ? Math.round((amount * SUGGEST_PERCENT) / 100) : 0;

  const filteredCounterparties =
    searchTerm.length > 0
      ? counterparties.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
      : counterparties;

  const availableLoaders = allLoaders.filter((l) => !loaders.find((s) => s.id === l.id));

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
        body: JSON.stringify({ name: newClientName, type: 'client' }),
      });
      if (res.ok) {
        const newClient = await res.json();
        queryClient.invalidateQueries({ queryKey: ['driver', 'counterparties'] });
        setValue('counterparty_id', newClient.id);
        setShowNewClient(false);
        setNewClientName('');
        setSearchTerm('');
      } else {
        const err = await res.json();
        setError(err.error || 'Ошибка при добавлении клиента');
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
      setError('Укажите клиента перед сохранением');
      return;
    }
    setSubmitting(true);
    setError('');

    const [loader1, loader2] = loaders;

    const res = await fetch(`/api/trips/${tripId}/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'edit',
        counterparty_id: data.counterparty_id ?? null,
        description: data.description ?? null,
        amount: String(data.amount),
        driver_pay: String(data.driver_pay),
        loader_id: loader1?.id ?? null,
        loader_pay: loader1 ? String(parseFloat(loader1.pay || '0')) : '0',
        loader2_id: loader2?.id ?? null,
        loader2_pay: loader2 ? String(parseFloat(loader2.pay || '0')) : '0',
        payment_method: data.payment_method,
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

  if (isLoading || !initialized) {
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

  if (trip?.lifecycle_status === 'approved') {
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
        <h1 className="font-black text-zinc-900 text-lg uppercase tracking-tight">
          Изменить заказ
        </h1>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-6 pb-28">
        {/* Клиент */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
            Клиент
          </label>

          {selectedCounterparty ? (
            <div className="flex items-center justify-between bg-orange-50 border-2 border-orange-200 rounded-lg px-4 h-14">
              <span className="font-bold text-orange-900">{selectedCounterparty.name}</span>
              <button
                type="button"
                onClick={() => setValue('counterparty_id', undefined)}
                className="text-orange-500 font-black"
              >
                ✕
              </button>
            </div>
          ) : showNewClient ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Название нового клиента"
                  className="flex-1 rounded-lg border-2 border-orange-500 px-4 h-14 font-bold text-zinc-900 focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddClient}
                  className="bg-orange-600 text-white rounded-lg px-4 font-bold"
                >
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewClient(false)}
                  className="bg-zinc-200 text-zinc-600 rounded-lg px-4 font-bold"
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Поиск клиента..."
                className="w-full rounded-lg border-2 border-zinc-200 px-4 h-14 text-zinc-900 font-bold focus:border-orange-500 focus:outline-none transition-colors"
                onFocus={() => {
                  if (searchBlurTimer.current) clearTimeout(searchBlurTimer.current);
                  setSearchFocused(true);
                }}
                onBlur={() => {
                  searchBlurTimer.current = setTimeout(() => setSearchFocused(false), 150);
                }}
              />
              {searchFocused && (
                <div className="absolute top-full left-0 right-0 bg-white border-2 border-zinc-200 rounded-lg mt-1 shadow-xl z-10 max-h-60 overflow-y-auto">
                  {filteredCounterparties.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setValue('counterparty_id', c.id);
                        setSearchTerm('');
                        setSearchFocused(false);
                      }}
                      className="w-full text-left px-4 py-3 font-bold text-zinc-900 hover:bg-orange-50 border-b border-zinc-100 last:border-0"
                    >
                      {c.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setNewClientName(searchTerm);
                      setShowNewClient(true);
                      setSearchFocused(false);
                    }}
                    className="w-full text-left px-4 py-3 font-bold text-orange-600 hover:bg-orange-50"
                  >
                    + Новый клиент{searchTerm ? ` "${searchTerm}"` : ''}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Сумма */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
            Сумма заказа, ₽
          </label>
          <input
            type="number"
            inputMode="numeric"
            {...register('amount')}
            placeholder="2 700"
            className="w-full rounded-lg border-2 border-zinc-200 px-4 h-16 text-3xl font-black text-zinc-900 focus:border-orange-500 focus:outline-none transition-colors"
          />
          {errors.amount && (
            <p className="text-red-500 text-xs font-bold mt-1 pl-1">{errors.amount.message}</p>
          )}
        </div>

        {/* Способ оплаты */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
            Способ оплаты
          </label>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {PAYMENT_METHODS.map((m) => (
              <label key={m.value} className="flex-shrink-0">
                <input
                  type="radio"
                  value={m.value}
                  {...register('payment_method')}
                  className="sr-only peer"
                />
                <div className="flex flex-col items-center justify-center gap-1 border-2 border-zinc-200 rounded-lg px-3 h-20 min-w-[84px] cursor-pointer peer-checked:border-orange-600 peer-checked:bg-orange-50 transition-all active:scale-95">
                  <span className="text-2xl">{m.icon}</span>
                  <span className="text-[9px] font-black text-center leading-tight uppercase tracking-tighter">
                    {m.label}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* ЗП водителя */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
            ЗП водителя, ₽
            <span className="ml-2 text-zinc-400 normal-case font-medium">
              Подсказка: ~{suggestedPay} ₽ ({SUGGEST_PERCENT}%)
            </span>
          </label>
          <input
            type="number"
            inputMode="numeric"
            {...register('driver_pay')}
            placeholder={String(suggestedPay)}
            className="w-full rounded-lg border-2 border-zinc-200 px-4 h-14 text-xl font-black text-zinc-900 focus:border-orange-500 focus:outline-none transition-colors"
          />
        </div>

        {/* Грузчики */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
            Грузчики
          </label>

          {loaders.map((loader, idx) => (
            <div
              key={loader.id}
              className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-900 text-sm">
                  {idx + 1}. {loader.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeLoader(loader.id)}
                  className="text-blue-400 font-black text-lg leading-none"
                >
                  ✕
                </button>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">
                  ЗП грузчика, ₽
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={loader.pay}
                  onChange={(e) => setLoaderPay(loader.id, e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border-2 border-blue-200 px-4 h-12 text-xl font-black text-zinc-900 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
            </div>
          ))}

          {loaders.length < 2 && (
            <button
              type="button"
              onClick={() => setShowLoaderPicker(true)}
              className="w-full text-left px-4 h-12 border-2 border-dashed border-blue-300 rounded-lg text-blue-500 font-bold"
            >
              + Добавить грузчика
            </button>
          )}
        </div>

        {/* Описание */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
            Описание (опционально)
          </label>
          <input
            type="text"
            {...register('description')}
            placeholder="Переезд, доставка плитки..."
            className="w-full rounded-lg border-2 border-zinc-200 px-4 h-14 text-sm font-bold text-zinc-900 focus:border-orange-500 focus:outline-none transition-colors"
          />
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
            {submitting ? 'Сохраняем...' : '✅ Сохранить изменения'}
          </Button>
        </div>
      </form>

      {/* Loader picker bottom sheet */}
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
                  Все грузчики уже добавлены
                </p>
              ) : (
                availableLoaders.map((loader) => (
                  <button
                    key={loader.id}
                    type="button"
                    onClick={() => addLoader(loader)}
                    className="w-full text-left px-4 py-3 font-bold text-zinc-900 hover:bg-blue-50 border-2 border-zinc-100 rounded-lg"
                  >
                    {loader.name}
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
