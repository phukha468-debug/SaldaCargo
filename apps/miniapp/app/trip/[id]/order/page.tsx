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

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  amount: z.coerce.number().positive('Введите сумму'),
  driver_pay: z.coerce.number().min(0),
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
    sublabel: 'Нал / Карта при водителе',
    icon: '💵',
    wallet: '→ Касса',
    color: 'peer-checked:border-green-600 peer-checked:bg-green-50',
  },
  {
    value: 'qr' as const,
    label: 'QR / Безнал',
    sublabel: 'Оплата при водителе',
    icon: '📱',
    wallet: '→ Р/С',
    color: 'peer-checked:border-blue-600 peer-checked:bg-blue-50',
  },
  {
    value: 'debt_cash' as const,
    label: 'Долг',
    sublabel: 'Заплатит потом',
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

  // Client selection state
  const [clientType, setClientType] = useState<'individual' | 'legal' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');

  // Loaders
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
  const suggestedPay = amount ? Math.round((amount * SUGGEST_PERCENT) / 100) : 0;

  // Filter counterparties by selected type
  const filteredCounterparties =
    searchTerm.length > 0
      ? counterparties.filter(
          (c) =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            (clientType === null || c.is_legal_entity === (clientType === 'legal')),
        )
      : [];

  const availableLoaders = allLoaders.filter((l) => !loaders.find((s) => s.id === l.id));
  const isDebt = selectedPaymentMethod === 'debt_cash';
  const paymentMethods = clientType === 'legal' ? METHODS_LEGAL : METHODS_INDIVIDUAL;

  // When client type switches, reset payment method to appropriate default
  function selectClientType(type: 'individual' | 'legal') {
    setClientType(type);
    setValue('payment_method', type === 'legal' ? 'debt_cash' : 'cash');
    setValue('counterparty_id', undefined);
    setSearchTerm('');
    setError('');
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
      const json = await res.json();
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['driver', 'counterparties'] });
        setValue('counterparty_id', json.id);
        setShowNewClient(false);
        setNewClientName('');
        setSearchTerm('');
      } else if (res.status === 409 && json.existing?.length > 0) {
        setShowNewClient(false);
        setSearchTerm(newClientName);
        setError(`Клиент «${json.existing[0].name}» уже есть — выберите из списка`);
      } else {
        setError(json.error || 'Ошибка при добавлении клиента');
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
    setSubmitting(true);
    setError('');

    const [loader1, loader2] = loaders;

    const payload = JSON.stringify({
      ...data,
      amount: String(data.amount),
      driver_pay: String(data.driver_pay),
      loader_id: loader1?.id ?? null,
      loader_pay: loader1 ? String(parseFloat(loader1.pay || '0')) : '0',
      loader2_id: loader2?.id ?? null,
      loader2_pay: loader2 ? String(parseFloat(loader2.pay || '0')) : '0',
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
        {/* ── Тип клиента ── */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
            Тип клиента
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => selectClientType('individual')}
              className={`rounded-2xl p-4 flex flex-col items-center gap-1.5 border-2 transition-all active:scale-[0.97] ${
                clientType === 'individual'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-zinc-200 bg-white'
              }`}
            >
              <span className="text-2xl">👤</span>
              <span
                className={`text-[11px] font-black uppercase tracking-widest ${clientType === 'individual' ? 'text-orange-700' : 'text-zinc-600'}`}
              >
                Физлицо
              </span>
              <span className="text-[9px] text-zinc-400 font-bold text-center leading-tight">
                Нал · QR · Долг
              </span>
            </button>
            <button
              type="button"
              onClick={() => selectClientType('legal')}
              className={`rounded-2xl p-4 flex flex-col items-center gap-1.5 border-2 transition-all active:scale-[0.97] ${
                clientType === 'legal' ? 'border-blue-500 bg-blue-50' : 'border-zinc-200 bg-white'
              }`}
            >
              <span className="text-2xl">🏢</span>
              <span
                className={`text-[11px] font-black uppercase tracking-widest ${clientType === 'legal' ? 'text-blue-700' : 'text-zinc-600'}`}
              >
                Юрлицо
              </span>
              <span className="text-[9px] text-zinc-400 font-bold text-center leading-tight">
                Оплата по счёту
              </span>
            </button>
          </div>
        </div>

        {/* ── Клиент (показывается после выбора типа) ── */}
        {clientType && (
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
                </div>
                <button
                  type="button"
                  onClick={() => setValue('counterparty_id', undefined)}
                  className={`font-black text-lg ${clientType === 'legal' ? 'text-blue-400' : 'text-orange-400'}`}
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
                    placeholder={clientType === 'legal' ? 'Название организации' : 'Имя клиента'}
                    className="flex-1 rounded-xl border-2 border-orange-500 px-4 h-14 font-bold text-zinc-900 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleAddClient}
                    className="bg-orange-600 text-white rounded-xl px-4 font-bold"
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewClient(false)}
                    className="bg-zinc-200 text-zinc-600 rounded-xl px-4 font-bold"
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
                  placeholder={clientType === 'legal' ? 'Поиск организации...' : 'Поиск клиента...'}
                  className="w-full rounded-xl border-2 border-zinc-200 px-4 h-14 text-zinc-900 font-bold focus:border-orange-500 focus:outline-none transition-colors"
                />
                {searchTerm.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border-2 border-zinc-200 rounded-xl mt-1 shadow-xl z-10 max-h-60 overflow-y-auto">
                    {filteredCounterparties.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setValue('counterparty_id', c.id);
                          setSearchTerm('');
                          setError('');
                        }}
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
                        + Создать нового {clientType === 'legal' ? 'юрлицо' : 'клиента'} &quot;
                        {searchTerm}&quot;
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Сумма ── */}
        {clientType && (
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
              Сумма заказа, ₽
            </label>
            <input
              type="number"
              inputMode="numeric"
              {...register('amount')}
              placeholder="2 700"
              className="w-full rounded-xl border-2 border-zinc-200 px-4 h-16 text-3xl font-black text-zinc-900 focus:border-orange-500 focus:outline-none transition-colors"
            />
            {errors.amount && (
              <p className="text-red-500 text-xs font-bold mt-1 pl-1">{errors.amount.message}</p>
            )}
          </div>
        )}

        {/* ── Способ оплаты ── */}
        {clientType && (
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
          </div>
        )}

        {/* ── Комментарий к долгу ── */}
        {clientType && isDebt && (
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-orange-600 uppercase tracking-widest pl-1">
              ⏳ Что обещал клиент? (важно!)
            </label>
            <input
              type="text"
              {...register('description')}
              placeholder={
                clientType === 'legal'
                  ? 'Счёт выставлен, оплатит до 10 числа...'
                  : 'Обещал заплатить в пятницу, наличными...'
              }
              autoFocus
              className="w-full rounded-xl border-2 border-orange-400 bg-orange-50 px-4 h-14 text-sm font-bold text-zinc-900 focus:border-orange-600 focus:outline-none transition-colors placeholder:text-orange-300"
            />
          </div>
        )}

        {/* ── ЗП водителя ── */}
        {clientType && (
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
              ЗП водителя, ₽
              <span className="ml-2 text-zinc-400 normal-case font-medium">
                ~{suggestedPay} ₽ ({SUGGEST_PERCENT}%)
              </span>
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

        {/* ── Грузчики ── */}
        {clientType && (
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
              Грузчики
            </label>

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
                    className="text-blue-400 font-black text-lg leading-none"
                  >
                    ✕
                  </button>
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  value={loader.pay}
                  onChange={(e) => setLoaderPay(loader.id, e.target.value)}
                  placeholder="ЗП грузчика, ₽"
                  className="w-full rounded-lg border-2 border-blue-200 px-4 h-12 text-xl font-black text-zinc-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            ))}

            {loaders.length < 2 && (
              <button
                type="button"
                onClick={() => setShowLoaderPicker(true)}
                className="w-full text-left px-4 h-12 border-2 border-dashed border-blue-300 rounded-xl text-blue-500 font-bold"
              >
                + Добавить грузчика
              </button>
            )}
          </div>
        )}

        {/* ── Описание (не долг) ── */}
        {clientType && !isDebt && (
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
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
            disabled={submitting || !clientType}
            className="font-black uppercase tracking-widest"
          >
            {!clientType
              ? 'Выберите тип клиента'
              : submitting
                ? 'Сохраняем...'
                : '✅ Добавить заказ'}
          </Button>
        </div>
      </form>

      {/* Loader picker */}
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
                    className="w-full text-left px-4 py-3 font-bold text-zinc-900 hover:bg-blue-50 border-2 border-zinc-100 rounded-xl"
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
