/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { NetworkIndicator } from '@saldacargo/ui';

interface ShiftData {
  online: boolean;
  address: string;
  car: boolean;
  updatedAt: number;
}

export default function LoaderHomePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [activeFinanceTab, setActiveFinanceTab] = useState<'accruals' | 'payouts'>('accruals');
  const [selectedAccrual, setSelectedAccrual] = useState<any | null>(null);

  // 1. Текущий пользователь
  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch('/api/driver/me');
      if (!res.ok) {
        throw new Error('Unauthorized');
      }
      return res.json();
    },
    retry: false,
  });

  // 2. Статус смены грузчика (онлайн/офлайн, адрес, авто)
  const { data: shiftData, isLoading: shiftLoading } = useQuery<{ ok: boolean; shift: ShiftData }>({
    queryKey: ['loader-shift', me?.id],
    queryFn: async () => {
      const res = await fetch(`/api/loader/shift?user_id=${me.id}`);
      if (!res.ok) throw new Error('Failed to load shift');
      return res.json();
    },
    enabled: !!me?.id,
  });

  // 3. Зарплата и подтверждения начислений
  const { data: payrollData, isLoading: payrollLoading } = useQuery({
    queryKey: ['employee-payroll', me?.id],
    queryFn: async () => {
      const res = await fetch('/api/employee/payroll');
      if (!res.ok) throw new Error('Failed to load payroll');
      return res.json();
    },
    enabled: !!me?.id,
  });

  // Мутация обновления смены
  const shiftMutation = useMutation({
    mutationFn: async (updated: Partial<ShiftData>) => {
      const current = shiftData?.shift || { online: false, address: '', car: false, updatedAt: 0 };
      const body = {
        user_id: me?.id,
        is_online: updated.online !== undefined ? updated.online : current.online,
        address: updated.address !== undefined ? updated.address : current.address,
        has_transport: updated.car !== undefined ? updated.car : current.car,
      };
      const res = await fetch('/api/loader/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Ошибка сохранения статуса');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loader-shift'] });
    },
  });

  // Мутация подтверждения начисления ЗП
  const confirmPayrollMutation = useMutation({
    mutationFn: async (id: string) => {
      setConfirmingId(id);
      const res = await fetch('/api/employee/payroll', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', ids: [id] }),
      });
      if (!res.ok) throw new Error('Ошибка подтверждения');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-payroll'] });
      setConfirmingId(null);
    },
    onError: () => {
      setConfirmingId(null);
    },
  });

  const handleLogout = () => {
    try {
      document.cookie = 'salda_user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      if (typeof window !== 'undefined') {
        localStorage.removeItem('salda_user_id');
        localStorage.removeItem('selected_role');
      }
      fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
      fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    } catch (e) {
      console.error(e);
    }
    router.replace('/?step=role');
  };

  if (meLoading || shiftLoading || payrollLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-500">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Загрузка профиля грузчика...
        </p>
      </div>
    );
  }

  const shift = shiftData?.shift || { online: false, address: '', car: false, updatedAt: 0 };
  const isOnline = shift.online;
  const currentAddress = shift.address || 'Верхняя Салда';
  const hasTransport = shift.car;

  const accumulatedTotal = parseFloat(payrollData?.accumulated_total || '0');
  const pendingItems = payrollData?.pending_confirmation || [];
  const totalPaid = parseFloat(payrollData?.total_paid || '0');

  const accruals = payrollData?.accruals || [];
  const payouts = payrollData?.payouts || [];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col pb-12">
      {/* ── Верхняя плашка приложения ─────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 h-16 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-amber-500 shadow-xs text-xl">
            👷
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 leading-tight">
              {me?.name || 'Грузчик'}
            </h1>
            <p className="text-[11px] font-bold text-amber-600 leading-none mt-0.5">
              Грузчик • ПРР Биржа
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NetworkIndicator />
          <button
            onClick={handleLogout}
            title="Выйти из аккаунта"
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors active:scale-95"
          >
            <span className="text-xl">🚪</span>
          </button>
        </div>
      </header>

      {/* ── Основное содержимое ───────────────────────────────── */}
      <main className="flex-1 max-w-lg w-full mx-auto p-4 space-y-4">
        {/* 1. Блок готовности к работе (Статус для диспетчера) */}
        <div
          className={`rounded-2xl border-2 p-4 transition-all duration-200 shadow-sm ${
            isOnline
              ? 'bg-emerald-50/80 border-emerald-500 shadow-emerald-500/10'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                Ваш статус для диспетчера
              </span>
              <div className="flex items-center gap-2">
                <span className="text-lg">{isOnline ? '🟢' : '⚪'}</span>
                <span
                  className={`text-base font-black uppercase tracking-tight ${
                    isOnline ? 'text-emerald-700' : 'text-slate-700'
                  }`}
                >
                  {isOnline ? 'Готов работать (На линии)' : 'Не на линии'}
                </span>
              </div>
            </div>

            <button
              onClick={() => shiftMutation.mutate({ online: !isOnline })}
              disabled={shiftMutation.isPending}
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isOnline ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isOnline ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Дополнительные параметры при статусе "На линии" */}
          {isOnline && (
            <div className="mt-4 pt-4 border-t border-emerald-200/80 space-y-3">
              {/* Адрес нахождения */}
              <div className="bg-white/90 rounded-xl p-3 border border-emerald-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    <span>📍</span>
                    <span>Где вы сейчас находитесь:</span>
                  </div>
                  <button
                    onClick={() => {
                      if (isEditingAddress && addressInput.trim()) {
                        shiftMutation.mutate({ address: addressInput.trim() });
                      } else {
                        setAddressInput(currentAddress);
                      }
                      setIsEditingAddress(!isEditingAddress);
                    }}
                    className="text-xs font-black text-amber-600 hover:text-amber-700 active:scale-95 transition"
                  >
                    {isEditingAddress ? '✓ Сохранить' : 'Сменить'}
                  </button>
                </div>

                {isEditingAddress ? (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={addressInput}
                      onChange={(e) => setAddressInput(e.target.value)}
                      placeholder="Улица, дом или район"
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500"
                    />
                  </div>
                ) : (
                  <div className="mt-1 text-sm font-black text-slate-900">{currentAddress}</div>
                )}
              </div>

              {/* Наличие автомобиля */}
              <label
                className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
                  hasTransport
                    ? 'bg-amber-50/80 border-amber-300'
                    : 'bg-white/90 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{hasTransport ? '🚗' : '🚶'}</span>
                  <div>
                    <span className="text-xs font-black text-slate-900 block leading-tight">
                      {hasTransport ? 'На своём авто (доеду сам)' : 'Пеший (нужно забрать)'}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">
                      {hasTransport
                        ? 'Мобилен, сам приеду на точку'
                        : 'Водитель подхватит на Газели'}
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={hasTransport}
                  onChange={(e) => shiftMutation.mutate({ car: e.target.checked })}
                  className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                />
              </label>
            </div>
          )}
        </div>

        {/* 2. Блок "Радар диспетчера и водителей" */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-2xl shrink-0">
            📡
          </div>
          <div>
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wide">
              {isOnline ? 'Вы видны на радаре диспетчера и водителей' : 'Вы сейчас в офлайне'}
            </h3>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5 leading-snug">
              {isOnline
                ? `Диспетчер в сводке и водители при создании заявок видят вас вверху списка с адресом «${currentAddress}» ${hasTransport ? '(на авто)' : '(пеший)'}.`
                : 'Включите статус «На линии», чтобы подниматься в топ списка заявок у водителей и диспетчера.'}
            </p>
          </div>
        </div>

        {/* 3. Финансовая карточка (Баланс и накопленная ЗП) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Заработано к выплате
              </span>
              <div className="text-3xl font-black text-emerald-600 mt-1 font-mono tracking-tight">
                {accumulatedTotal.toLocaleString('ru-RU')} ₽
              </div>
            </div>
            {totalPaid > 0 && (
              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Всего выплачено
                </span>
                <div className="text-sm font-bold text-slate-700 mt-1 font-mono">
                  {totalPaid.toLocaleString('ru-RU')} ₽
                </div>
              </div>
            )}
          </div>

          {/* Блок с ожидающими подтверждения */}
          {pendingItems.length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-wide text-amber-800 flex items-center gap-1.5">
                  <span>⏳</span>
                  <span>Ожидают подтверждения ({pendingItems.length})</span>
                </span>
                <span className="text-xs font-mono font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  +
                  {pendingItems
                    .reduce((s: number, i: any) => s + parseFloat(i.amount || '0'), 0)
                    .toLocaleString('ru-RU')}{' '}
                  ₽
                </span>
              </div>

              <div className="space-y-2">
                {pendingItems.map((item: any) => (
                  <div
                    key={item.id}
                    className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs font-black text-slate-900">{item.context}</div>
                      <div className="text-[10px] font-bold text-amber-800 mt-0.5">
                        {item.label} · +{parseFloat(item.amount).toLocaleString('ru-RU')} ₽
                      </div>
                    </div>
                    <button
                      onClick={() => confirmPayrollMutation.mutate(item.id)}
                      disabled={confirmingId === item.id}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black uppercase tracking-wider shadow-xs active:scale-95 transition disabled:opacity-50 shrink-0"
                    >
                      {confirmingId === item.id ? '...' : '✓ Подтвердить'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 4. Вкладки истории: Начисления / Выплаты (Dense 1-Line Layout) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="flex border-b border-slate-200 bg-slate-50/50 p-1.5 gap-1.5">
            <button
              onClick={() => setActiveFinanceTab('accruals')}
              className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${
                activeFinanceTab === 'accruals'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              📦 Начисления ({accruals.length})
            </button>
            <button
              onClick={() => setActiveFinanceTab('payouts')}
              className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${
                activeFinanceTab === 'payouts'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              💳 Выплаты ({payouts.length})
            </button>
          </div>

          <div className="p-3">
            {activeFinanceTab === 'accruals' ? (
              accruals.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs font-bold uppercase">
                  Нет начислений
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {accruals.map((acc: any) => {
                    const isPaid = acc.settlement_status === 'completed';
                    const dateFormatted = acc.date
                      ? new Date(acc.date).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                        })
                      : '—';
                    return (
                      <div
                        key={acc.id}
                        onClick={() => setSelectedAccrual(acc)}
                        className="py-2.5 px-2 flex items-center justify-between gap-2 hover:bg-slate-50 rounded-xl transition cursor-pointer active:scale-[0.99]"
                      >
                        {/* 1 Строка: Номер рейса + водитель + дата */}
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-base shrink-0">📦</span>
                          <div className="truncate">
                            <span className="text-xs font-black text-slate-900">
                              {acc.trip_number ? `Рейс №${acc.trip_number}` : 'ПРР заказ'}
                            </span>
                            {acc.driver_name && (
                              <span className="text-[11px] font-bold text-slate-500 ml-1.5">
                                · Вод. {acc.driver_name}
                              </span>
                            )}
                            <span className="text-[10px] font-medium text-slate-400 ml-1.5">
                              · {dateFormatted}
                            </span>
                          </div>
                        </div>

                        {/* Справа: Сумма и статус (строго в 1 строку) */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                              isPaid
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {isPaid ? 'Выплачено' : 'К выплате'}
                          </span>
                          <span className="text-xs font-mono font-black text-emerald-700">
                            +{parseFloat(acc.amount || '0').toLocaleString('ru-RU')} ₽
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : payouts.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs font-bold uppercase">
                Выплат пока не производилось
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {payouts.map((pay: any) => {
                  const dateFormatted = pay.date
                    ? new Date(pay.date).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—';
                  return (
                    <div
                      key={pay.id}
                      className="py-2.5 px-2 flex items-center justify-between gap-2 hover:bg-slate-50 rounded-xl"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-base shrink-0">💳</span>
                        <div className="truncate">
                          <span className="text-xs font-black text-slate-900">
                            {pay.wallet_name || 'Касса'}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500 ml-1.5">
                            · {pay.description}
                          </span>
                          <span className="text-[10px] font-medium text-slate-400 ml-1.5">
                            · {dateFormatted}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                          ✓ Выдано
                        </span>
                        <span className="text-xs font-mono font-black text-slate-900">
                          {parseFloat(pay.amount || '0').toLocaleString('ru-RU')} ₽
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Модальное окно детализации начисления */}
        {selectedAccrual && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-slate-200 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📦</span>
                  <h3 className="text-sm font-black text-slate-900">
                    {selectedAccrual.trip_number
                      ? `Рейс №${selectedAccrual.trip_number}`
                      : 'Начисление ПРР'}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedAccrual(null)}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold active:scale-95 transition"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-400 font-bold">Сумма:</span>
                  <span className="font-mono font-black text-emerald-600 text-sm">
                    +{parseFloat(selectedAccrual.amount || '0').toLocaleString('ru-RU')} ₽
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-400 font-bold">Статус:</span>
                  <span
                    className={`font-black uppercase text-[10px] px-2 py-0.5 rounded-md ${
                      selectedAccrual.settlement_status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {selectedAccrual.settlement_status === 'completed'
                      ? '✓ Выплачено'
                      : '⏳ К выплате'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-400 font-bold">Дата работы:</span>
                  <span className="font-bold text-slate-800">
                    {selectedAccrual.date
                      ? new Date(selectedAccrual.date).toLocaleString('ru-RU', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </span>
                </div>
                {selectedAccrual.driver_name && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-400 font-bold">Водитель:</span>
                    <span className="font-black text-slate-900">{selectedAccrual.driver_name}</span>
                  </div>
                )}
                {selectedAccrual.asset_name && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-400 font-bold">Автомобиль / Объект:</span>
                    <span className="font-bold text-slate-800">{selectedAccrual.asset_name}</span>
                  </div>
                )}
                {selectedAccrual.description && (
                  <div className="py-1">
                    <span className="text-slate-400 font-bold block mb-1">Описание:</span>
                    <div className="bg-slate-50 p-2.5 rounded-lg text-slate-700 font-medium">
                      {selectedAccrual.description}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setSelectedAccrual(null)}
                className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition"
              >
                Закрыть
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
