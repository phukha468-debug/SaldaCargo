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

const schema = z.object({
  amount: z.coerce.number().positive('Введите сумму'),
  driver_pay: z.coerce.number().min(0),
  loader_pay: z.coerce.number().min(0),
  loader2_pay: z.coerce.number().min(0),
  payment_method: z.enum(['cash', 'qr', 'bank_invoice', 'debt_cash', 'card_driver']),
  description: z.string().optional(),
  counterparty_id: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Наличные', icon: '💵' },
  { value: 'qr', label: 'QR на р/с', icon: '📱' },
  { value: 'bank_invoice', label: 'Безнал', icon: '🏦' },
  { value: 'debt_cash', label: 'Долг', icon: '⏳' },
  { value: 'card_driver', label: 'На карту', icon: '💳' },
] as const;

// Подсказка ЗП: ~30% от суммы
const SUGGEST_PERCENT = 30;

export default function AddOrderPage() {
  const params = useParams();
  const tripId = params.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [idempotencyKey] = useState(() => uuid());
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');

  const { data: trip } = useQuery<{ loaders_count: number }>({
    queryKey: ['trip', tripId],
    queryFn: () => fetch(`/api/trips/${tripId}`).then((r) => r.json()),
    staleTime: 60000,
  });

  const { data: counterparties = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['driver', 'counterparties'],
    queryFn: () => fetch('/api/driver/counterparties').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema as any) as any,
    defaultValues: {
      payment_method: 'cash',
      driver_pay: 0,
      loader_pay: 0,
      loader2_pay: 0,
    },
  });

  const selectedCounterpartyId = watch('counterparty_id');
  const selectedCounterparty = counterparties.find((c) => c.id === selectedCounterpartyId);

  const amountRaw = watch('amount');
  const amount = amountRaw ? Number(amountRaw) : 0;
  const suggestedPay = amount ? Math.round((amount * SUGGEST_PERCENT) / 100) : 0;

  const filteredCounterparties =
    searchTerm.length > 0
      ? counterparties.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
      : [];

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
    setSubmitting(true);
    setError('');

    const payload = JSON.stringify({
      ...data,
      amount: String(data.amount),
      driver_pay: String(data.driver_pay),
      loader_pay: String(data.loader_pay),
      loader2_pay: String(data.loader2_pay),
      idempotency_key: idempotencyKey,
    });

    // Navigate immediately — server request runs in background
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
              />
              {searchTerm.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border-2 border-zinc-200 rounded-lg mt-1 shadow-xl z-10 max-h-60 overflow-y-auto">
                  {filteredCounterparties.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setValue('counterparty_id', c.id);
                        setSearchTerm('');
                      }}
                      className="w-full text-left px-4 py-3 font-bold text-zinc-900 hover:bg-orange-50 border-b border-zinc-100 last:border-0"
                    >
                      {c.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setNewClientName(searchTerm);
                      setShowNewClient(true);
                    }}
                    className="w-full text-left px-4 py-3 font-bold text-orange-600 hover:bg-orange-50"
                  >
                    + Новый клиент &quot;{searchTerm}&quot;
                  </button>
                </div>
              )}
              {searchTerm.length === 0 && (
                <button
                  type="button"
                  onClick={() => setShowNewClient(true)}
                  className="w-full text-left px-4 h-14 border-2 border-dashed border-zinc-300 rounded-lg text-zinc-400 font-bold mt-2"
                >
                  + Новый клиент
                </button>
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

        {/* ЗП грузчика 1 */}
        {(trip?.loaders_count ?? 0) >= 1 && (
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
              ЗП Грузчик 1, ₽
            </label>
            <input
              type="number"
              inputMode="numeric"
              {...register('loader_pay')}
              placeholder="0"
              className="w-full rounded-lg border-2 border-zinc-200 px-4 h-14 text-xl font-black text-zinc-900 focus:border-orange-500 focus:outline-none transition-colors"
            />
          </div>
        )}

        {/* ЗП грузчика 2 */}
        {(trip?.loaders_count ?? 0) >= 2 && (
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
              ЗП Грузчик 2, ₽
            </label>
            <input
              type="number"
              inputMode="numeric"
              {...register('loader2_pay')}
              placeholder="0"
              className="w-full rounded-lg border-2 border-zinc-200 px-4 h-14 text-xl font-black text-zinc-900 focus:border-orange-500 focus:outline-none transition-colors"
            />
          </div>
        )}

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
            {submitting ? 'Сохраняем...' : '✅ Добавить заказ'}
          </Button>
        </div>
      </form>
    </div>
  );
}
