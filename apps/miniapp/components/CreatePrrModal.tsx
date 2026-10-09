/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn, Money } from '@saldacargo/ui';
import { isNoCashCounterparty } from '@saldacargo/shared';
import { calculateOrderPayroll } from '@saldacargo/domain-payroll';

interface Loader {
  id: string;
  name: string;
}

interface Counterparty {
  id: string;
  name: string;
  is_legal_entity: boolean;
  is_top?: boolean;
}

interface CreatePrrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (data: any) => void;
  defaultCreatorId?: string;
  role?: 'driver' | 'mechanic' | 'admin';
}

const PAYMENT_METHODS = [
  {
    value: 'cash' as const,
    label: 'Наличные',
    icon: '💵',
    desc: 'В сейф кассы',
    activeClass: 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-300',
  },
  {
    value: 'qr' as const,
    label: 'QR-код',
    icon: '⚡',
    desc: 'На р/с Т-Банк',
    activeClass: 'border-purple-500 bg-purple-50 text-purple-900 ring-2 ring-purple-300',
  },
  {
    value: 'debt_cash' as const,
    label: 'В долг',
    icon: '⏳',
    desc: 'Дебиторка',
    activeClass: 'border-rose-500 bg-rose-50 text-rose-900 ring-2 ring-rose-300',
  },
];

export function CreatePrrModal({
  isOpen,
  onClose,
  onSuccess,
  defaultCreatorId,
  role = 'driver',
}: CreatePrrModalProps) {
  const queryClient = useQueryClient();

  // Состояние формы
  const [amountStr, setAmountStr] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qr' | 'debt_cash'>('cash');
  const [selectedCounterpartyId, setSelectedCounterpartyId] = useState<string>('');
  const [clientSearch, setClientSearch] = useState('');
  const [showClientList, setShowClientList] = useState(false);
  const [selectedLoaders, setSelectedLoaders] = useState<
    Array<{ id: string; name: string; customPay?: string }>
  >([]);
  const [description, setDescription] = useState('');
  const [autoApprove, setAutoApprove] = useState(role === 'admin');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Загружаем клиентов
  const { data: counterparties = [] } = useQuery<Counterparty[]>({
    queryKey: ['driver', 'counterparties'],
    queryFn: () => fetch('/api/driver/counterparties').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
    enabled: isOpen,
  });

  // Загружаем грузчиков
  const { data: allLoaders = [] } = useQuery<Loader[]>({
    queryKey: ['driver', 'loaders'],
    queryFn: () => fetch('/api/driver/loaders').then((r) => r.json()),
    staleTime: 10 * 60 * 1000,
    enabled: isOpen,
  });

  // По умолчанию выбираем "Частный клиент"
  useEffect(() => {
    if (!selectedCounterpartyId && counterparties.length > 0) {
      const generic =
        counterparties.find(
          (c) =>
            c.name.toLowerCase().includes('частный') ||
            c.id === 'ba412028-ed45-4cf8-b365-ad76a93afd71',
        ) || counterparties[0];
      if (generic) {
        setSelectedCounterpartyId(generic.id);
      }
    }
  }, [counterparties, selectedCounterpartyId]);

  // Блокировка скролла фона при открытии модалки
  useEffect(() => {
    if (isOpen) {
      const y = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${y}px`;
      document.body.style.width = '100%';
      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, y);
      };
    }
  }, [isOpen]);

  const selectedCounterparty = counterparties.find((c) => c.id === selectedCounterpartyId);

  // Проверка запрета наличных
  const isNoCash = isNoCashCounterparty(selectedCounterparty?.name);
  useEffect(() => {
    if (isNoCash && paymentMethod === 'cash') {
      setPaymentMethod('debt_cash');
    }
  }, [isNoCash, paymentMethod]);

  // Фильтрация клиентов по поиску
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return counterparties.slice(0, 8);
    const q = clientSearch.toLowerCase().trim();
    return counterparties.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 15);
  }, [counterparties, clientSearch]);

  const amount = parseFloat(amountStr) || 0;

  // Автоматический расчет по формуле:
  // Сумма делится на N грузчиков, 70% каждому грузчику, 30% компании
  const payroll = useMemo(() => {
    if (amount <= 0 || selectedLoaders.length === 0) {
      return {
        loaderPayEach: 0,
        totalLoadersPay: 0,
        companyShare: 0,
        nominalPerLoader: 0,
      };
    }

    const calc = calculateOrderPayroll({
      direction: 'loaders_only',
      amount,
      isDriverLoader: false,
      loadersCount: selectedLoaders.length,
    });

    const nominalPerLoader = Math.round(amount / selectedLoaders.length);

    // Учитываем кастомные правки ЗП грузчиков, если они были введены вручную
    const totalCustomPay = selectedLoaders.reduce((sum, l) => {
      const custom =
        l.customPay !== undefined && l.customPay !== '' ? parseFloat(l.customPay) : null;
      return sum + (custom !== null && !isNaN(custom) ? custom : calc.loaderPayEach);
    }, 0);

    return {
      loaderPayEach: calc.loaderPayEach,
      totalLoadersPay: totalCustomPay,
      companyShare: Math.max(0, amount - totalCustomPay),
      nominalPerLoader,
    };
  }, [amount, selectedLoaders]);

  const toggleLoader = (loader: Loader) => {
    setError('');
    setSelectedLoaders((prev) => {
      const exists = prev.find((l) => l.id === loader.id);
      if (exists) {
        return prev.filter((l) => l.id !== loader.id);
      } else {
        return [...prev, { id: loader.id, name: loader.name }];
      }
    });
  };

  const handleCustomPayChange = (loaderId: string, value: string) => {
    setSelectedLoaders((prev) =>
      prev.map((l) => (l.id === loaderId ? { ...l, customPay: value } : l)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (amount <= 0) {
      setError('Укажите корректную сумму заказа');
      return;
    }
    if (selectedLoaders.length === 0) {
      setError('Выберите хотя бы одного грузчика');
      return;
    }
    if (!selectedCounterpartyId) {
      setError('Выберите клиента');
      return;
    }

    setSubmitting(true);

    try {
      const loadersPayload = selectedLoaders.map((l) => ({
        id: l.id,
        name: l.name,
        pay:
          l.customPay !== undefined && l.customPay !== ''
            ? parseFloat(l.customPay)
            : payroll.loaderPayEach,
      }));

      const res = await fetch('/api/trips/prr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counterparty_id: selectedCounterpartyId,
          amount,
          payment_method: paymentMethod,
          loaders: loadersPayload,
          description: description || 'Погрузо-разгрузочные работы (без авто)',
          user_id: defaultCreatorId,
          auto_approve: autoApprove,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка при создании заявки');
      }

      setSuccessMsg(`Заявка ПРР №${data.trip?.trip_number || ''} успешно создана!`);

      // Инвалидируем кэш
      queryClient.invalidateQueries({ queryKey: ['driver-summary'] });
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['admin-summary'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['mechanic-summary'] });

      setTimeout(() => {
        onSuccess?.(data);
        onClose();
        // Сброс формы
        setAmountStr('');
        setDescription('');
        setSelectedLoaders([]);
        setSuccessMsg('');
        setSubmitting(false);
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Ошибка сети');
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-zinc-200 max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
        {/* Шапка */}
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 border border-orange-200 flex items-center justify-center text-xl shrink-0">
              👷
            </div>
            <div>
              <h2 className="text-base font-black text-zinc-900 leading-tight">
                Погрузо-разгрузочные работы
              </h2>
              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">
                Без автомобиля · 70% грузчикам, 30% компании
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-200 text-zinc-600 font-bold flex items-center justify-center hover:bg-zinc-300 active:scale-95 transition-transform"
          >
            ✕
          </button>
        </div>

        {/* Содержимое с прокруткой */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl p-3 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black rounded-xl p-3 flex items-center gap-2">
              <span>✅</span>
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. Клиент */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
                Клиент
              </label>
              {selectedCounterparty && (
                <span className="text-[11px] font-bold text-orange-600 truncate max-w-[200px]">
                  {selectedCounterparty.name}
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setShowClientList(true);
                }}
                onFocus={() => setShowClientList(true)}
                placeholder={selectedCounterparty?.name || 'Поиск клиента...'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
              />
              {clientSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setClientSearch('');
                    setShowClientList(false);
                  }}
                  className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Выпадающий список клиентов */}
            {showClientList && (
              <div className="mt-1.5 border border-zinc-200 rounded-xl bg-white shadow-lg max-h-48 overflow-y-auto p-1 divide-y divide-zinc-50">
                {filteredClients.length === 0 ? (
                  <div className="p-3 text-xs text-zinc-400 text-center font-bold">
                    Клиент не найден
                  </div>
                ) : (
                  filteredClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCounterpartyId(c.id);
                        setClientSearch('');
                        setShowClientList(false);
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-between',
                        selectedCounterpartyId === c.id
                          ? 'bg-orange-50 text-orange-800'
                          : 'hover:bg-zinc-100 text-zinc-800',
                      )}
                    >
                      <span>{c.name}</span>
                      {c.is_legal_entity && (
                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700">
                          Юрлицо
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 2. Общая сумма заказа */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 mb-1.5">
              Общая сумма заказа (₽)
            </label>
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="50"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="Например: 3000"
                className="w-full px-4 py-3 rounded-xl border-2 border-zinc-300 text-lg font-black text-zinc-900 focus:outline-none focus:border-orange-500 bg-white"
              />
              <span className="absolute right-4 top-3 text-lg font-black text-zinc-400">₽</span>
            </div>

            {/* Быстрые кнопки сумм */}
            <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
              {[1000, 1500, 2000, 3000, 5000, 7000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmountStr(String(val))}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-bold border transition-all shrink-0',
                    amountStr === String(val)
                      ? 'bg-orange-600 text-white border-orange-600'
                      : 'bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200',
                  )}
                >
                  {val.toLocaleString('ru-RU')} ₽
                </button>
              ))}
            </div>
          </div>

          {/* 3. Способ оплаты */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 mb-1.5">
              Способ оплаты
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((pm) => {
                const disabled = pm.value === 'cash' && isNoCash;
                const isSelected = paymentMethod === pm.value;
                return (
                  <button
                    key={pm.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => setPaymentMethod(pm.value)}
                    className={cn(
                      'p-2.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between',
                      disabled && 'opacity-40 cursor-not-allowed bg-zinc-100',
                      isSelected
                        ? pm.activeClass
                        : 'border-zinc-200 bg-white hover:border-zinc-300 text-zinc-700',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base">{pm.icon}</span>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-current"></span>}
                    </div>
                    <div className="mt-2">
                      <div className="text-xs font-black">{pm.label}</div>
                      <div className="text-[10px] font-medium opacity-70 truncate">{pm.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {isNoCash && (
              <p className="text-[11px] font-bold text-rose-600 mt-1.5">
                ⚠️ Для корпоративных клиентов (ВСМПО и др.) оплата только по безналу/в долг!
              </p>
            )}
          </div>

          {/* 4. Выбор грузчиков */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
                Назначить грузчиков ({selectedLoaders.length})
              </label>
              <span className="text-[11px] font-bold text-zinc-400">
                {selectedLoaders.length === 0
                  ? 'Никто не выбран'
                  : `${selectedLoaders.length} чел.`}
              </span>
            </div>

            {/* Список всех грузчиков (чипы / чекбоксы) */}
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1 border border-zinc-200 rounded-xl bg-zinc-50/50">
              {allLoaders.length === 0 ? (
                <div className="col-span-2 p-3 text-xs text-zinc-400 text-center font-bold">
                  Загрузка списка грузчиков...
                </div>
              ) : (
                allLoaders.map((loader) => {
                  const isChecked = selectedLoaders.some((l) => l.id === loader.id);
                  return (
                    <button
                      key={loader.id}
                      type="button"
                      onClick={() => toggleLoader(loader)}
                      className={cn(
                        'px-2.5 py-2 rounded-xl text-xs font-bold border text-left flex items-center justify-between gap-1 transition-all',
                        isChecked
                          ? 'bg-orange-500 text-white border-orange-600 shadow-xs'
                          : 'bg-white text-zinc-800 border-zinc-200 hover:border-zinc-300',
                      )}
                    >
                      <span className="truncate">{loader.name}</span>
                      <span className="text-xs shrink-0">{isChecked ? '✓' : '+'}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* 5. Карточка автоматического расчёта (Калькулятор 70/30) */}
          {amount > 0 && selectedLoaders.length > 0 && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-orange-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-orange-200/60 pb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-orange-950">
                  📊 Расчёт распределения (70% / 30%)
                </span>
                <span className="text-xs font-bold text-orange-800">
                  {amount.toLocaleString('ru-RU')} ₽ всего
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white/80 rounded-xl p-2.5 border border-orange-100">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">
                    Грузчикам всего (70%)
                  </span>
                  <span className="text-sm font-black text-emerald-700">
                    <Money amount={payroll.totalLoadersPay.toString()} />
                  </span>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">
                    по ~{payroll.loaderPayEach.toLocaleString('ru-RU')} ₽ / чел.
                  </span>
                </div>

                <div className="bg-white/80 rounded-xl p-2.5 border border-orange-100">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">
                    Доход компании (30%)
                  </span>
                  <span className="text-sm font-black text-zinc-900">
                    <Money amount={payroll.companyShare.toString()} />
                  </span>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">комиссия TK501</span>
                </div>
              </div>

              {/* Детализация по каждому назначенному грузчику */}
              <div className="pt-2 border-t border-orange-200/60 space-y-2">
                <span className="text-[10px] font-bold text-orange-900 uppercase tracking-wide block">
                  Выплаты грузчикам (можно скорректировать):
                </span>
                {selectedLoaders.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between gap-2 bg-white/90 rounded-lg px-2.5 py-1.5 border border-orange-100"
                  >
                    <span className="text-xs font-bold text-zinc-800 truncate">{l.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={l.customPay !== undefined ? l.customPay : payroll.loaderPayEach}
                        onChange={(e) => handleCustomPayChange(l.id, e.target.value)}
                        className="w-20 px-2 py-0.5 text-right font-black text-xs border rounded border-zinc-200 focus:outline-none focus:border-orange-500"
                      />
                      <span className="text-xs font-bold text-zinc-500">₽</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. Описание / адрес */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 mb-1.5">
              Адрес / Заметка к заказу (опционально)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Например: ул. Ленина 45, 4 этаж, погрузка дивана"
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
            />
          </div>

          {/* Опция авто-утверждения для админа */}
          {role === 'admin' && (
            <label className="flex items-center gap-2 cursor-pointer bg-zinc-50 p-3 rounded-xl border border-zinc-200">
              <input
                type="checkbox"
                checked={autoApprove}
                onChange={(e) => setAutoApprove(e.target.checked)}
                className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
              />
              <span className="text-xs font-bold text-zinc-800">
                Сразу утвердить и провести по кассе / ЗП (без ожидания ревью)
              </span>
            </label>
          )}

          {/* Кнопка отправки */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting || amount <= 0 || selectedLoaders.length === 0}
              className={cn(
                'w-full py-4 rounded-xl text-white font-black text-sm uppercase tracking-wider shadow-lg transition-all active:scale-[0.98]',
                submitting || amount <= 0 || selectedLoaders.length === 0
                  ? 'bg-zinc-300 cursor-not-allowed text-zinc-500'
                  : 'bg-orange-600 hover:bg-orange-700 shadow-orange-200',
              )}
            >
              {submitting ? 'Создаём заявку...' : '🚀 Создать заказ ПРР'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
