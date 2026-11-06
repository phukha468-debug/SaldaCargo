/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { NetworkIndicator } from '@saldacargo/ui';
import { CreatePrrModal } from '@/components/CreatePrrModal';

interface ShiftData {
  online: boolean;
  address: string;
  car: boolean;
  updatedAt: number;
}

type PeriodType = 'day' | 'week' | 'month' | 'all';

export default function LoaderHomePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [activeFinanceTab, setActiveFinanceTab] = useState<'accruals' | 'payouts'>('accruals');
  const [selectedAccrual, setSelectedAccrual] = useState<any | null>(null);
  const [showPrrModal, setShowPrrModal] = useState(false);

  // Фильтр периодов для выплат и начислений
  const [periodType, setPeriodType] = useState<PeriodType>('day');
  const [periodOffset, setPeriodOffset] = useState<number>(0); // 0 = текущий, -1 = прошлый, и т.д.

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

  const shift = shiftData?.shift || { online: false, address: '', car: false, updatedAt: 0 };
  const isOnline = shift.online;
  const currentAddress = shift.address || 'Верхняя Салда';
  const hasTransport = shift.car;

  const accumulatedTotal = parseFloat(payrollData?.accumulated_total || '0');
  const pendingItems = payrollData?.pending_confirmation || [];
  const totalPaid = parseFloat(payrollData?.total_paid || '0');

  const accruals = useMemo(() => payrollData?.accruals || [], [payrollData]);
  const payouts = useMemo(() => payrollData?.payouts || [], [payrollData]);

  // Вычисление диапазона выбранного периода
  const periodInfo = useMemo(() => {
    const now = new Date();

    if (periodType === 'all') {
      return {
        title: 'За всё время',
        shortTitle: 'Всё время',
        start: null,
        end: null,
        canGoNext: false,
        isCurrent: true,
      };
    }

    if (periodType === 'day') {
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + periodOffset);
      const start = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0, 0);
      const end = new Date(
        target.getFullYear(),
        target.getMonth(),
        target.getDate(),
        23,
        59,
        59,
        999,
      );

      let title = target.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      let shortTitle = target.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      if (periodOffset === 0) {
        title = `Сегодня, ${shortTitle}`;
        shortTitle = 'Сегодня';
      } else if (periodOffset === -1) {
        title = `Вчера, ${shortTitle}`;
        shortTitle = 'Вчера';
      }

      return {
        title,
        shortTitle,
        start,
        end,
        canGoNext: periodOffset < 0,
        isCurrent: periodOffset === 0,
      };
    }

    if (periodType === 'week') {
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + periodOffset * 7);
      const dayOfWeek = (target.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
      const monday = new Date(
        target.getFullYear(),
        target.getMonth(),
        target.getDate() - dayOfWeek,
        0,
        0,
        0,
        0,
      );
      const sunday = new Date(
        monday.getFullYear(),
        monday.getMonth(),
        monday.getDate() + 6,
        23,
        59,
        59,
        999,
      );

      const monStr = monday.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      const sunStr = sunday.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      let title = `${monStr} – ${sunStr}`;
      let shortTitle = `${monStr} – ${sunStr}`;
      if (periodOffset === 0) {
        title = `Текущая неделя (${monStr} – ${sunStr})`;
        shortTitle = 'Эта неделя';
      } else if (periodOffset === -1) {
        title = `Прошлая неделя (${monStr} – ${sunStr})`;
        shortTitle = 'Прошлая нед.';
      }

      return {
        title,
        shortTitle,
        start: monday,
        end: sunday,
        canGoNext: periodOffset < 0,
        isCurrent: periodOffset === 0,
      };
    }

    // month
    const target = new Date(now.getFullYear(), now.getMonth() + periodOffset, 1);
    const start = new Date(target.getFullYear(), target.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthName = target.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    let title = capitalized;
    let shortTitle = target.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
    if (periodOffset === 0) {
      title = `Этот месяц (${capitalized})`;
      shortTitle = 'Этот месяц';
    } else if (periodOffset === -1) {
      title = `Прошлый месяц (${capitalized})`;
      shortTitle = 'Прошлый мес.';
    }

    return {
      title,
      shortTitle,
      start,
      end,
      canGoNext: periodOffset < 0,
      isCurrent: periodOffset === 0,
    };
  }, [periodType, periodOffset]);

  // Фильтрация элементов по диапазону
  const filterByPeriod = (items: any[]) => {
    if (periodType === 'all' || !periodInfo.start || !periodInfo.end) return items;
    return items.filter((item) => {
      const rawDate = item.date || item.transaction_date || item.created_at;
      if (!rawDate) return false;
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return false;
      return d >= periodInfo.start! && d <= periodInfo.end!;
    });
  };

  const filteredAccruals = useMemo(
    () => filterByPeriod(accruals),
    [accruals, periodInfo, periodType],
  );
  const filteredPayouts = useMemo(() => filterByPeriod(payouts), [payouts, periodInfo, periodType]);

  const periodAccrualsSum = useMemo(() => {
    return filteredAccruals.reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);
  }, [filteredAccruals]);

  const periodPayoutsSum = useMemo(() => {
    return filteredPayouts.reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);
  }, [filteredPayouts]);

  const changePeriodType = (type: PeriodType) => {
    setPeriodType(type);
    setPeriodOffset(0);
  };

  if (meLoading || shiftLoading || payrollLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-500">
        <div className="w-9 h-9 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-2.5" />
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Загрузка профиля грузчика...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col pb-10">
      {/* ── Верхняя плашка приложения ─────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-3.5 h-13 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-amber-500 text-white text-base shadow-2xs">
            👷
          </div>
          <div>
            <h1 className="text-xs font-black text-slate-900 leading-tight">
              {me?.name || 'Грузчик'}
            </h1>
            <p className="text-[10px] font-bold text-amber-600 leading-none mt-0.5">
              Грузчик • ПРР Биржа
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NetworkIndicator />
          <button
            onClick={handleLogout}
            title="Выйти из аккаунта"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors active:scale-95"
          >
            <span className="text-base">🚪</span>
          </button>
        </div>
      </header>

      {/* ── Основное содержимое ───────────────────────────────── */}
      <main className="flex-1 max-w-lg w-full mx-auto p-3 space-y-2.5">
        {/* ── Кнопка «Создать заказ» (Только 1 вариант — ПРР без авто) ──────── */}
        <button
          onClick={() => setShowPrrModal(true)}
          className="w-full flex items-center justify-between bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl py-2.5 px-3.5 shadow-sm active:scale-[0.99] transition-all cursor-pointer border border-amber-600/30"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📦</span>
            <div className="text-left">
              <span className="text-xs font-black uppercase tracking-wide block leading-tight">
                Создать заказ
              </span>
              <span className="text-[10px] font-bold text-amber-100 block leading-tight">
                Только ПРР (без авто) · Для грузчиков
              </span>
            </div>
          </div>
          <span className="text-[11px] font-black bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-lg">
            + Создать
          </span>
        </button>

        {/* ── Плашка 1: Статус для диспетчера (В 2 раза меньше по высоте) ──── */}
        <div
          className={`rounded-xl border p-2.5 transition-all shadow-2xs ${
            isOnline
              ? 'bg-emerald-50/90 border-emerald-400/80 shadow-emerald-500/5'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            {/* Слева: статус + компактные теги */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs">{isOnline ? '🟢' : '⚪'}</span>
                <span
                  className={`text-xs font-black uppercase tracking-tight ${
                    isOnline ? 'text-emerald-800' : 'text-slate-700'
                  }`}
                >
                  {isOnline ? 'На линии' : 'Не на линии'}
                </span>
              </div>

              {isOnline && (
                <div className="flex items-center gap-1 text-[10px] font-bold">
                  {/* Бейдж адреса */}
                  <button
                    type="button"
                    onClick={() => {
                      setAddressInput(currentAddress);
                      setIsEditingAddress(!isEditingAddress);
                    }}
                    className="bg-white/90 border border-emerald-300 text-emerald-900 px-1.5 py-0.5 rounded-md hover:bg-emerald-100 transition truncate max-w-[140px]"
                    title="Нажмите для смены адреса"
                  >
                    📍 {currentAddress}
                  </button>

                  {/* Бейдж авто/пеший */}
                  <button
                    type="button"
                    onClick={() => shiftMutation.mutate({ car: !hasTransport })}
                    className={`px-1.5 py-0.5 rounded-md border transition ${
                      hasTransport
                        ? 'bg-amber-100/90 border-amber-300 text-amber-900'
                        : 'bg-white/90 border-slate-300 text-slate-700'
                    }`}
                    title="Переключить транспорт"
                  >
                    {hasTransport ? '🚗 Авто' : '🚶 Пеший'}
                  </button>
                </div>
              )}
            </div>

            {/* Справа: компактный тумблер */}
            <button
              onClick={() => shiftMutation.mutate({ online: !isOnline })}
              disabled={shiftMutation.isPending}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isOnline ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  isOnline ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Быстрое компактное редактирование адреса (если открыто) */}
          {isOnline && isEditingAddress && (
            <div className="mt-2 pt-2 border-t border-emerald-200/60 flex items-center gap-1.5">
              <input
                type="text"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                placeholder="Адрес (например: Ленина 12)"
                className="flex-1 text-xs font-semibold px-2 py-1 bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (addressInput.trim()) {
                    shiftMutation.mutate({ address: addressInput.trim() });
                  }
                  setIsEditingAddress(false);
                }}
                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black shrink-0"
              >
                ✓ Сохранить
              </button>
              <button
                type="button"
                onClick={() => setIsEditingAddress(false)}
                className="px-2 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold shrink-0"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* ── Плашка 2: Радар диспетчера (В 2 раза меньше по высоте — 1 строка) ── */}
        <div className="bg-white rounded-xl py-2 px-3 border border-slate-200 shadow-2xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
            <span className="text-sm shrink-0">📡</span>
            <div className="text-xs truncate">
              <span className="font-black text-slate-900">Радар: </span>
              <span className="text-slate-600 font-medium">
                {isOnline
                  ? `Видны в топе заказов (адрес: ${currentAddress})`
                  : 'В офлайне (включите «На линии»)'}
              </span>
            </div>
          </div>
          <span
            className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md shrink-0 ${
              isOnline
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-500 border border-slate-200'
            }`}
          >
            {isOnline ? 'Активен' : 'Офлайн'}
          </span>
        </div>

        {/* ── Плашка 3: Баланс (В 2 раза меньше по высоте) ──────────────────── */}
        <div className="bg-white rounded-xl py-2.5 px-3.5 border border-slate-200 shadow-2xs space-y-2">
          {/* 1 Строка: К выплате + Всего выплачено */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                К выплате:
              </span>
              <span className="text-lg font-black text-emerald-600 font-mono tracking-tight">
                {accumulatedTotal.toLocaleString('ru-RU')} ₽
              </span>
            </div>

            {totalPaid > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 font-bold">Выплачено:</span>
                <span className="font-bold text-slate-700 font-mono">
                  {totalPaid.toLocaleString('ru-RU')} ₽
                </span>
              </div>
            )}
          </div>

          {/* Строка с ожидающими подтверждения (если есть) */}
          {pendingItems.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-sm">⏳</span>
                  <span className="font-black text-amber-800 truncate">
                    Ожидают подтверждения ({pendingItems.length}):
                  </span>
                  <span className="font-mono font-black text-amber-700">
                    +
                    {pendingItems
                      .reduce((s: number, i: any) => s + parseFloat(i.amount || '0'), 0)
                      .toLocaleString('ru-RU')}{' '}
                    ₽
                  </span>
                </div>

                <button
                  onClick={() => {
                    // Подтверждаем первое неподтвержденное
                    if (pendingItems[0]?.id) {
                      confirmPayrollMutation.mutate(pendingItems[0].id);
                    }
                  }}
                  disabled={confirmPayrollMutation.isPending}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-2xs active:scale-95 transition disabled:opacity-50 shrink-0"
                >
                  {confirmPayrollMutation.isPending ? '...' : '✓ Подтвердить'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Фильтр периодов для выплат и начислений (День / Неделя / Месяц / Все) ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Селектор типа периода: День / Неделя / Месяц / Все */}
          <div className="p-2 bg-slate-50 border-b border-slate-200/80 flex items-center gap-1">
            {(['day', 'week', 'month', 'all'] as PeriodType[]).map((type) => {
              const labels: Record<PeriodType, string> = {
                day: 'День',
                week: 'Неделя',
                month: 'Месяц',
                all: 'Все',
              };
              const isActive = periodType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => changePeriodType(type)}
                  className={`flex-1 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80'
                  }`}
                >
                  {labels[type]}
                </button>
              );
            })}
          </div>

          {/* Строка навигации по периоду: стрелка назад, название периода, стрелка вперед */}
          {periodType !== 'all' && (
            <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPeriodOffset((prev) => prev - 1)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center active:scale-95 transition"
                title="Предыдущий период"
              >
                ◀
              </button>

              <div className="flex items-center gap-1.5 text-center min-w-0">
                <span className="font-black text-slate-900 truncate">{periodInfo.title}</span>
                {!periodInfo.isCurrent && (
                  <button
                    type="button"
                    onClick={() => setPeriodOffset(0)}
                    className="text-[10px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0"
                  >
                    К текущему
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setPeriodOffset((prev) => prev + 1)}
                disabled={!periodInfo.canGoNext}
                className={`w-7 h-7 rounded-lg font-bold flex items-center justify-center transition ${
                  periodInfo.canGoNext
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95'
                    : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                }`}
                title="Следующий период"
              >
                ▶
              </button>
            </div>
          )}

          {/* Сводка за выбранный период (Dense 1-Line) */}
          <div className="px-3 py-1.5 bg-amber-50/40 border-b border-slate-100 flex items-center justify-between text-[11px] font-black">
            <span className="text-slate-600">
              Начислено за период:{' '}
              <span className="text-emerald-700 font-mono">
                +{periodAccrualsSum.toLocaleString('ru-RU')} ₽
              </span>
            </span>
            <span className="text-slate-600">
              Выдано:{' '}
              <span className="text-slate-900 font-mono">
                {periodPayoutsSum.toLocaleString('ru-RU')} ₽
              </span>
            </span>
          </div>

          {/* Вкладки: Начисления / Выплаты */}
          <div className="flex border-b border-slate-200 bg-slate-50/40 p-1 gap-1">
            <button
              onClick={() => setActiveFinanceTab('accruals')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all cursor-pointer ${
                activeFinanceTab === 'accruals'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              📦 Начисления ({filteredAccruals.length})
            </button>
            <button
              onClick={() => setActiveFinanceTab('payouts')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all cursor-pointer ${
                activeFinanceTab === 'payouts'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              💳 Выплаты ({filteredPayouts.length})
            </button>
          </div>

          {/* Список операций за период (Dense 1-Line Layout) */}
          <div className="p-2">
            {activeFinanceTab === 'accruals' ? (
              filteredAccruals.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs font-bold">
                  Нет начислений за выбранный период
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredAccruals.map((acc: any) => {
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
                        className="py-2 px-1.5 flex items-center justify-between gap-2 hover:bg-slate-50 rounded-lg transition cursor-pointer active:scale-[0.99]"
                      >
                        {/* 1 Строка: Номер рейса + водитель + дата */}
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                          <span className="text-sm shrink-0">📦</span>
                          <span className="text-xs font-black text-slate-900 truncate">
                            {acc.trip_number ? `Рейс №${acc.trip_number}` : 'ПРР заказ'}
                          </span>
                          {acc.driver_name && (
                            <span className="text-[11px] font-bold text-slate-500 truncate">
                              · {acc.driver_name}
                            </span>
                          )}
                          <span className="text-[10px] font-medium text-slate-400 shrink-0">
                            · {dateFormatted}
                          </span>
                        </div>

                        {/* Справа: Статус и сумма (строго в 1 строку) */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
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
            ) : filteredPayouts.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs font-bold">
                Выплат за выбранный период не было
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredPayouts.map((pay: any) => {
                  const dateFormatted = pay.date
                    ? new Date(pay.date).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                      })
                    : '—';
                  return (
                    <div
                      key={pay.id}
                      className="py-2 px-1.5 flex items-center justify-between gap-2 hover:bg-slate-50 rounded-lg"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                        <span className="text-sm shrink-0">💳</span>
                        <span className="text-xs font-black text-slate-900 truncate">
                          {pay.wallet_name || 'Касса'}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500 truncate">
                          · {pay.description}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 shrink-0">
                          · {dateFormatted}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-sm w-full p-4 border border-slate-200 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📦</span>
                  <h3 className="text-xs font-black text-slate-900">
                    {selectedAccrual.trip_number
                      ? `Рейс №${selectedAccrual.trip_number}`
                      : 'Начисление ПРР'}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedAccrual(null)}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold active:scale-95 transition"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                  <span className="text-slate-400 font-bold">Сумма:</span>
                  <span className="font-mono font-black text-emerald-600 text-sm">
                    +{parseFloat(selectedAccrual.amount || '0').toLocaleString('ru-RU')} ₽
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                  <span className="text-slate-400 font-bold">Статус:</span>
                  <span
                    className={`font-black uppercase text-[9px] px-1.5 py-0.5 rounded-md ${
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
                <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
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
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                    <span className="text-slate-400 font-bold">Водитель:</span>
                    <span className="font-black text-slate-900">{selectedAccrual.driver_name}</span>
                  </div>
                )}
                {selectedAccrual.asset_name && (
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                    <span className="text-slate-400 font-bold">Объект:</span>
                    <span className="font-bold text-slate-800">{selectedAccrual.asset_name}</span>
                  </div>
                )}
                {selectedAccrual.description && (
                  <div className="py-0.5">
                    <span className="text-slate-400 font-bold block mb-0.5">Описание:</span>
                    <div className="bg-slate-50 p-2 rounded-lg text-slate-700 font-medium text-[11px]">
                      {selectedAccrual.description}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setSelectedAccrual(null)}
                className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition"
              >
                Закрыть
              </button>
            </div>
          </div>
        )}

        {/* ── Модалка создания заказа (ПРР без авто для грузчика) ────── */}
        {showPrrModal && (
          <CreatePrrModal
            isOpen={showPrrModal}
            onClose={() => setShowPrrModal(false)}
            defaultCreatorId={me?.id}
            creatorName={me?.name}
            role="loader"
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['employee-payroll'] });
            }}
          />
        )}
      </main>
    </div>
  );
}
