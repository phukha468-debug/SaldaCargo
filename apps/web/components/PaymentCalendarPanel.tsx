'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Money } from '@saldacargo/ui';

export type CalendarItem = {
  id: string;
  title: string;
  category:
    | 'rent'
    | 'fuel'
    | 'comms'
    | 'salary'
    | 'court_order'
    | 'leasing_loan'
    | 'tax'
    | 'insurance'
    | 'other';
  amount: number;
  due_day: number;
  due_date: string;
  frequency: string;
  payment_type?: 'fixed' | 'variable';
  target_period?: string;
  preferred_wallet_id?: string;
  recipient?: string;
  notes?: string;
  is_active: boolean;
  is_loan?: boolean;
  is_salary_rule?: boolean;
  is_fuel_rule?: boolean;
  status: 'paid' | 'due_today' | 'planned' | 'overdue';
  days_left: number;
  planned_amount?: number;
  paid_amount?: number;
  paid_at?: string;
  paid_wallet?: string;
};

export type CalendarData = {
  period: string;
  balances: {
    total: number;
    bank: number;
    cash: number;
    fuel?: number;
  };
  summary: {
    totalMonthObligations: number;
    paidThisMonth: number;
    remainingThisMonth: number;
    fixedTotalMonth: number;
    variableTotalMonth: number;
    fixedRemainingMonth: number;
    variableRemainingMonth: number;
    dueNext7Days: number;
    cashReserve7Days: number;
    cashReserveMonth: number;
    hasGap7Days: boolean;
    gapAmount7Days: number;
    hasGapMonth: boolean;
    gapAmountMonth: number;
  };
  items: CalendarItem[];
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  rent: {
    label: 'Аренда',
    icon: '🏢',
    bg: 'bg-indigo-50 border-indigo-200',
    text: 'text-indigo-800',
  },
  fuel: {
    label: 'ГСМ / Топливо',
    icon: '⛽',
    bg: 'bg-purple-50 border-purple-200',
    text: 'text-purple-800',
  },
  comms: {
    label: 'Связь и ГЛОНАСС',
    icon: '📱',
    bg: 'bg-sky-50 border-sky-200',
    text: 'text-sky-800',
  },
  salary: {
    label: 'Зарплаты и авансы',
    icon: '👥',
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-800',
  },
  court_order: {
    label: 'Алименты / ФССП',
    icon: '⚖️',
    bg: 'bg-rose-50 border-rose-200',
    text: 'text-rose-800',
  },
  leasing_loan: {
    label: 'Лизинг / Кредит',
    icon: '🏦',
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-800',
  },
  tax: {
    label: 'Налоги и ЕНС',
    icon: '📑',
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-800',
  },
  insurance: {
    label: 'Страховка',
    icon: '🛡️',
    bg: 'bg-teal-50 border-teal-200',
    text: 'text-teal-800',
  },
  other: {
    label: 'Прочее',
    icon: '📦',
    bg: 'bg-slate-50 border-slate-200',
    text: 'text-slate-800',
  },
};

const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

function getTodayPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(periodStr: string, delta: number) {
  const parts = periodStr.split('-');
  const y = Number(parts[0] ?? 2026);
  const m = Number(parts[1] ?? 1);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatPeriodTitle(periodStr: string) {
  const parts = periodStr.split('-');
  const y = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  if (!y || !m || m < 1 || m > 12) return periodStr;
  const monthName = MONTH_NAMES[m - 1] ?? '';
  return `${monthName} ${y}`;
}

export function PaymentCalendarPanel() {
  const qc = useQueryClient();
  const currentPeriod = getTodayPeriod();

  // Period state for looking ahead
  const [selectedPeriod, setSelectedPeriod] = useState<string>(currentPeriod);

  // View mode: 'table' (список/таблица) or 'calendar' (31 день в виде календаря)
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'fixed' | 'variable'>('all');

  // Modals state
  const [payModalItem, setPayModalItem] = useState<CalendarItem | null>(null);
  const [payWallet, setPayWallet] = useState<
    '10000000-0000-0000-0000-000000000001' | '10000000-0000-0000-0000-000000000002'
  >('10000000-0000-0000-0000-000000000001');
  const [payAmount, setPayAmount] = useState('');
  const [createTx, setCreateTx] = useState(true);

  // Add obligation modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<CalendarItem['category']>('rent');
  const [newAmount, setNewAmount] = useState('');
  const [newDueDay, setNewDueDay] = useState('10');
  const [newPaymentType, setNewPaymentType] = useState<'fixed' | 'variable'>('fixed');
  const [newRecipient, setNewRecipient] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Edit obligation modal
  const [editModalItem, setEditModalItem] = useState<CalendarItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<CalendarItem['category']>('rent');
  const [editAmount, setEditAmount] = useState('');
  const [editDueDay, setEditDueDay] = useState('10');
  const [editPaymentType, setEditPaymentType] = useState<'fixed' | 'variable'>('fixed');
  const [editWallet, setEditWallet] = useState<
    '10000000-0000-0000-0000-000000000001' | '10000000-0000-0000-0000-000000000002'
  >('10000000-0000-0000-0000-000000000001');
  const [editRecipient, setEditRecipient] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const { data, isLoading } = useQuery<CalendarData>({
    queryKey: ['payment-calendar', selectedPeriod],
    queryFn: () => fetch(`/api/payment-calendar?period=${selectedPeriod}`).then((r) => r.json()),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const markPaidMutation = useMutation({
    mutationFn: async () => {
      if (!payModalItem || !data) return;
      const res = await fetch('/api/payment-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_paid',
          obligation_id: payModalItem.id,
          period: data.period,
          amount: parseFloat(payAmount || String(payModalItem.amount)),
          wallet_id: payWallet,
          title: payModalItem.title,
          create_tx: createTx,
        }),
      });
      if (!res.ok) throw new Error('Ошибка сохранения платежа');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-calendar'] });
      qc.invalidateQueries({ queryKey: ['wallets'] });
      qc.invalidateQueries({ queryKey: ['finance-month'] });
      setPayModalItem(null);
    },
    onError: (e: Error) => alert(e.message),
  });

  const addObligationMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/payment-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_obligation',
          title: newTitle,
          category: newCategory,
          amount: parseFloat(newAmount),
          due_day: parseInt(newDueDay),
          payment_type: newPaymentType,
          target_period: selectedPeriod,
          period: selectedPeriod,
          recipient: newRecipient,
          notes: newNotes,
        }),
      });
      if (!res.ok) throw new Error('Ошибка добавления обязательства');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-calendar'] });
      setShowAddModal(false);
      setNewTitle('');
      setNewAmount('');
      setNewPaymentType('fixed');
      setNewRecipient('');
      setNewNotes('');
    },
    onError: (e: Error) => alert(e.message),
  });

  const deleteObligationMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(
        `/api/payment-calendar?id=${encodeURIComponent(id)}&period=${encodeURIComponent(selectedPeriod)}`,
        {
          method: 'DELETE',
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Ошибка удаления обязательства');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-calendar'] });
    },
    onError: (e: Error) => alert(e.message),
  });

  const handleOpenEdit = (item: CalendarItem) => {
    setEditModalItem(item);
    setEditTitle(item.title);
    setEditCategory(item.category);
    setEditAmount(String(item.amount));
    setEditDueDay(String(item.due_day));
    setEditPaymentType(item.payment_type || 'fixed');
    setEditWallet(
      item.preferred_wallet_id === '10000000-0000-0000-0000-000000000002'
        ? '10000000-0000-0000-0000-000000000002'
        : '10000000-0000-0000-0000-000000000001',
    );
    setEditRecipient(item.recipient || '');
    setEditNotes(item.notes || '');
  };

  const updateObligationMutation = useMutation({
    mutationFn: async () => {
      if (!editModalItem || !data) return;
      const res = await fetch('/api/payment-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_obligation',
          id: editModalItem.id,
          title: editTitle,
          category: editCategory,
          amount: parseFloat(editAmount),
          due_day: parseInt(editDueDay),
          payment_type: editPaymentType,
          target_period: selectedPeriod,
          preferred_wallet_id: editWallet,
          recipient: editRecipient,
          notes: editNotes,
          period: data.period,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Ошибка обновления обязательства');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-calendar'] });
      setEditModalItem(null);
    },
    onError: (e: Error) => alert(e.message),
  });

  if (isLoading || !data) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-slate-800 mb-3"></div>
        <div>Загрузка платёжного календаря...</div>
      </div>
    );
  }

  const { balances, summary, items } = data;

  const filteredItems = items.filter((item) => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    const itemType = item.payment_type || 'fixed';
    if (typeFilter !== 'all' && itemType !== typeFilter) return false;
    return true;
  });

  const isFutureMonth = selectedPeriod > currentPeriod;

  const [calYearStr, calMonthStr] = selectedPeriod.split('-');
  const calYear = parseInt(calYearStr || '2026', 10);
  const calMonth = parseInt(calMonthStr || '10', 10);
  const daysInSelectedMonth = new Date(calYear, calMonth, 0).getDate();
  const firstDayWeekday = (new Date(calYear, calMonth - 1, 1).getDay() + 6) % 7;
  const now = new Date();
  const isSelectedCurrentMonth = calYear === now.getFullYear() && calMonth === now.getMonth() + 1;
  const todayDayNumber = isSelectedCurrentMonth ? now.getDate() : -1;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ── Панель Навигации по Месяцам (Смотреть наперёд) ── */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setSelectedPeriod((p) => shiftMonth(p, -1))}
              className="px-2.5 py-1.5 text-slate-700 hover:text-slate-900 hover:bg-white rounded-lg transition font-bold text-xs"
              title="Предыдущий месяц"
            >
              ← Пред.
            </button>
            <div className="px-3 py-1 font-black text-slate-900 text-sm tracking-tight flex items-center gap-1.5 min-w-[150px] justify-center">
              <span>📅</span>
              <span>{formatPeriodTitle(selectedPeriod)}</span>
            </div>
            <button
              onClick={() => setSelectedPeriod((p) => shiftMonth(p, 1))}
              className="px-2.5 py-1.5 text-slate-700 hover:text-slate-900 hover:bg-white rounded-lg transition font-bold text-xs"
              title="Следующий месяц"
            >
              След. →
            </button>
          </div>

          {selectedPeriod !== currentPeriod ? (
            <button
              onClick={() => setSelectedPeriod(currentPeriod)}
              className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs rounded-xl border border-blue-200 transition"
            >
              К текущему месяцу
            </button>
          ) : (
            <span className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[11px] font-bold">
              ● Текущий месяц
            </span>
          )}

          {isFutureMonth && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-[11px] font-bold animate-in fade-in">
              🔮 Прогноз на будущее (постоянные обязательства)
            </span>
          )}
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>+ Добавить платёж
        </button>
      </div>

      {/* ── Верхний Блок Метрик: Баланс, Постоянные vs Переменные, Разрыв ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* 1. Баланс на счетах компании: Сколько есть vs Сколько нужно */}
        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <span>Баланс счетов ТК</span>
                <span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
                  title="Синхронизировано"
                ></span>
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                В наличии
              </span>
            </div>

            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <div>
                <div className="text-[10px] text-slate-400 font-medium">Есть сейчас:</div>
                <div className="text-xl font-black font-mono text-emerald-400 leading-tight">
                  <Money amount={balances.total.toFixed(2)} />
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400 font-medium">Нужно на месяц:</div>
                <div className="text-sm font-black font-mono text-amber-300 leading-tight">
                  <Money amount={summary.remainingThisMonth.toFixed(2)} />
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">
                  на 7 дн:{' '}
                  <span className="text-rose-300 font-bold font-mono">
                    {summary.dueNext7Days.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 mt-2 space-y-1">
            <div className="flex justify-between items-center text-[10px] flex-wrap gap-1">
              <span>
                Банк:{' '}
                <strong className="text-white font-mono">
                  <Money amount={balances.bank.toFixed(2)} />
                </strong>
              </span>
              <span>
                Касса:{' '}
                <strong className="text-white font-mono">
                  <Money amount={balances.cash.toFixed(2)} />
                </strong>
              </span>
              {typeof balances.fuel === 'number' && balances.fuel > 0 && (
                <span>
                  ТК:{' '}
                  <strong className="text-purple-300 font-mono">
                    <Money amount={balances.fuel.toFixed(2)} />
                  </strong>
                </span>
              )}
            </div>

            <div className="pt-1 flex items-center justify-between text-[9px] border-t border-slate-800/60">
              {summary.hasGap7Days ? (
                <span className="text-rose-400 font-bold flex items-center gap-1">
                  <span>⚠️</span> Не хватает на 7 дн: −
                  <Money amount={summary.gapAmount7Days.toFixed(2)} />
                </span>
              ) : summary.hasGapMonth ? (
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  <span>🛡️</span> На 7 дн. хватает, на месяц: −
                  <Money amount={summary.gapAmountMonth.toFixed(2)} />
                </span>
              ) : (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span>✓</span> Денег хватает на все платежи
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 2. Постоянные обязательства (Фикс) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                🔒 Постоянные (фикс)
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                Ежемесячно
              </span>
            </div>
            <div className="text-xl font-black text-slate-900 font-mono mt-1">
              <Money amount={(summary.fixedTotalMonth ?? 0).toFixed(2)} />
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex justify-between border-t border-slate-100 pt-2">
            <span>
              К оплате:{' '}
              <strong className="text-slate-800 font-mono">
                <Money amount={(summary.fixedRemainingMonth ?? 0).toFixed(2)} />
              </strong>
            </span>
          </div>
        </div>

        {/* 3. Переменные расходы */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                ⚡ Переменные платежи
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">
                Разовые
              </span>
            </div>
            <div className="text-xl font-black text-purple-700 font-mono mt-1">
              <Money amount={(summary.variableTotalMonth ?? 0).toFixed(2)} />
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex justify-between border-t border-slate-100 pt-2">
            <span>
              К оплате:{' '}
              <strong className="text-slate-800 font-mono">
                <Money amount={(summary.variableRemainingMonth ?? 0).toFixed(2)} />
              </strong>
            </span>
          </div>
        </div>

        {/* 4. Срочно (ближайшие 7 дней) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Срочно (7 дней)
            </div>
            <div className="text-xl font-black text-rose-600 font-mono mt-1">
              <Money amount={summary.dueNext7Days.toFixed(2)} />
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 border-t border-slate-100 pt-2">
            Всего на месяц:{' '}
            <strong className="text-slate-700 font-mono">
              <Money amount={summary.totalMonthObligations.toFixed(2)} />
            </strong>
          </div>
        </div>

        {/* 5. Прогноз Кассового Разрыва (Запас прочности) */}
        <div
          className={`p-4 rounded-2xl border shadow-2xs flex flex-col justify-between ${summary.hasGap7Days ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}
        >
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
              <span>{summary.hasGap7Days ? '⚠️ Разрыв (7 дн)' : '🛡️ Запас (7 дн)'}</span>
            </div>
            <div className="text-xl font-black font-mono mt-1">
              {summary.hasGap7Days ? (
                <span className="text-rose-700">
                  − <Money amount={summary.gapAmount7Days.toFixed(2)} />
                </span>
              ) : (
                <span className="text-emerald-700">
                  + <Money amount={summary.cashReserve7Days.toFixed(2)} />
                </span>
              )}
            </div>
          </div>
          <div className="text-[10px] mt-2 border-t border-current/10 pt-2 font-medium">
            {summary.hasGap7Days ? (
              <span className="text-rose-700 font-semibold">Срочно ускорить дебиторку!</span>
            ) : (
              <span className="text-emerald-700">Денег хватает на неделю</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Панель Управления и Фильтров Календаря ── */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Переключатель вида: Список (Таблица) / Календарь (31 день) */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              viewMode === 'table'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>📋</span> Таблица
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              viewMode === 'calendar'
                ? 'bg-blue-600 text-white shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>📅</span> Календарь на 31 день
          </button>
        </div>

        {/* Фильтр: Тип платежа (Все / Постоянные / Переменные) */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1 rounded-lg transition ${typeFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Все типы ({items.length})
          </button>
          <button
            onClick={() => setTypeFilter('fixed')}
            className={`px-3 py-1 rounded-lg transition flex items-center gap-1 ${typeFilter === 'fixed' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <span>🔒</span> Постоянные
          </button>
          <button
            onClick={() => setTypeFilter('variable')}
            className={`px-3 py-1 rounded-lg transition flex items-center gap-1 ${typeFilter === 'variable' ? 'bg-white text-purple-900 shadow-2xs' : 'text-slate-600 hover:text-purple-700'}`}
          >
            <span>⚡</span> Переменные
          </button>
        </div>

        {/* Фильтры категорий */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-2.5 py-1 rounded-xl transition ${categoryFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Все категории
          </button>
          <button
            onClick={() => setCategoryFilter('salary')}
            className={`px-2.5 py-1 rounded-xl transition ${categoryFilter === 'salary' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            👥 Зарплаты
          </button>
          <button
            onClick={() => setCategoryFilter('leasing_loan')}
            className={`px-2.5 py-1 rounded-xl transition ${categoryFilter === 'leasing_loan' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            🏦 Лизинг/Кредит
          </button>
          <button
            onClick={() => setCategoryFilter('rent')}
            className={`px-2.5 py-1 rounded-xl transition ${categoryFilter === 'rent' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            🏢 Аренда
          </button>
          <button
            onClick={() => setCategoryFilter('fuel')}
            className={`px-2.5 py-1 rounded-xl transition ${categoryFilter === 'fuel' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            ⛽ ГСМ
          </button>
          <button
            onClick={() => setCategoryFilter('court_order')}
            className={`px-2.5 py-1 rounded-xl transition ${categoryFilter === 'court_order' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            ⚖️ Алименты/ФССП
          </button>
          <button
            onClick={() => setCategoryFilter('tax')}
            className={`px-2.5 py-1 rounded-xl transition ${categoryFilter === 'tax' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            📑 Налоги
          </button>
        </div>
      </div>

      {/* ── Режим Отображения: Сетка 31 день Календаря ИЛИ Таблица ── */}
      {viewMode === 'calendar' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <span>📅</span>
                <span>{formatPeriodTitle(selectedPeriod)}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {daysInSelectedMonth} {daysInSelectedMonth === 31 ? 'день' : 'дней'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Нажмите на любой день, чтобы посмотреть расшифровку сумм и оплатить платежи
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Оплачено
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span> Просрочка
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Сегодня
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-[11px]">
                <span>⛽ 👥</span> Пятницы
              </span>
            </div>
          </div>

          {/* Шапка дней недели */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center text-xs font-black text-slate-400 uppercase tracking-wider py-1">
            <div>Пн</div>
            <div>Вт</div>
            <div>Ср</div>
            <div>Чт</div>
            <div className="text-blue-600 font-black">Пт ★</div>
            <div>Сб</div>
            <div>Вс</div>
          </div>

          {/* Сетка дней месяца */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {/* Пустые ячейки смещения до первого числа */}
            {Array.from({ length: firstDayWeekday }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-[85px] sm:min-h-[105px] p-2 rounded-xl bg-slate-50/40 border border-dashed border-slate-100 hidden sm:block opacity-40"
              />
            ))}

            {/* Ячейки дней 1..daysInSelectedMonth */}
            {Array.from({ length: daysInSelectedMonth }).map((_, idx) => {
              const day = idx + 1;
              const dayItems = filteredItems.filter((i) => i.due_day === day);
              const dayTotal = dayItems.reduce((acc, it) => acc + it.amount, 0);
              const isToday = day === todayDayNumber;
              const isFriday = (firstDayWeekday + idx) % 7 === 4;
              const hasOverdue = dayItems.some((i) => i.status === 'overdue');
              const hasDueToday = dayItems.some((i) => i.status === 'due_today');
              const allPaid = dayItems.length > 0 && dayItems.every((i) => i.status === 'paid');
              const isSelected = selectedCalendarDay === day;

              let tileBg = 'bg-white border-slate-200 hover:border-blue-400';
              if (isSelected) {
                tileBg = 'bg-blue-50/50 border-blue-500 shadow-sm ring-2 ring-blue-500/20';
              } else if (isToday) {
                tileBg = 'bg-blue-50/40 border-blue-400 ring-2 ring-blue-400/30';
              } else if (allPaid) {
                tileBg = 'bg-emerald-50/30 border-emerald-200 hover:border-emerald-400';
              } else if (hasOverdue) {
                tileBg = 'bg-rose-50/40 border-rose-300 hover:border-rose-400';
              } else if (hasDueToday) {
                tileBg = 'bg-blue-50/40 border-blue-300 hover:border-blue-400';
              } else if (dayItems.length === 0) {
                tileBg =
                  'bg-slate-50/40 border-slate-100 text-slate-400 hover:bg-slate-50 hover:border-slate-200';
              }

              return (
                <div
                  key={day}
                  onClick={() => setSelectedCalendarDay(day)}
                  className={`min-h-[85px] sm:min-h-[105px] p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group ${tileBg}`}
                >
                  {/* Верхняя строка ячейки: номер дня и бейджи */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs ${
                        isToday
                          ? 'bg-blue-600 text-white shadow-xs'
                          : isFriday
                            ? 'bg-purple-100 text-purple-900'
                            : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {day}
                    </span>
                    {isToday && (
                      <span className="text-[9px] font-extrabold text-blue-700 uppercase tracking-tighter">
                        Сегодня
                      </span>
                    )}
                    {!isToday && isFriday && (
                      <span className="text-[9px] font-bold text-purple-600">Пт</span>
                    )}
                  </div>

                  {/* Середина: сумма и количество платежей */}
                  <div className="my-1">
                    {dayItems.length > 0 ? (
                      <>
                        <div className="font-mono font-black text-slate-900 text-xs sm:text-sm leading-tight truncate">
                          {dayTotal > 0 ? (
                            <Money amount={dayTotal.toFixed(2)} />
                          ) : (
                            <span className="text-emerald-700 text-xs font-bold">0 ₽</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5 truncate flex items-center gap-1">
                          <span>
                            {dayItems.length}{' '}
                            {dayItems.length === 1
                              ? 'платёж'
                              : dayItems.length < 5
                                ? 'платежа'
                                : 'платежей'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-[10px] text-slate-300 select-none">—</div>
                    )}
                  </div>

                  {/* Нижняя строка: статус или мини-иконки категорий */}
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-100/60">
                    {dayItems.length > 0 ? (
                      allPaid ? (
                        <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-100/80 px-1 py-0.2 rounded">
                          ✓ Оплачен
                        </span>
                      ) : hasOverdue ? (
                        <span className="text-[9px] font-extrabold text-rose-700 bg-rose-100 px-1 py-0.2 rounded">
                          Просрочка
                        </span>
                      ) : hasDueToday ? (
                        <span className="text-[9px] font-extrabold text-blue-700 bg-blue-100 px-1 py-0.2 rounded">
                          Сегодня
                        </span>
                      ) : (
                        <span className="text-[9px] font-semibold text-slate-600 bg-slate-100 px-1 py-0.2 rounded">
                          План
                        </span>
                      )
                    ) : (
                      <span className="text-[9px] text-slate-300">+</span>
                    )}
                    <span className="text-[9px] text-blue-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      Инфо →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── Таблица Обязательных Платежей Календаря ── */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3.5 w-16 text-center">День</th>
                  <th className="py-3 px-3">Статья расходов / Получатель</th>
                  <th className="py-3 px-3">Тип</th>
                  <th className="py-3 px-3">Категория</th>
                  <th className="py-3 px-3 text-right">Сумма к оплате</th>
                  <th className="py-3 px-3">Срок / Осталось</th>
                  <th className="py-3 px-3">Счёт списания</th>
                  <th className="py-3 px-3 text-center">Статус</th>
                  <th className="py-3 px-3 text-center w-44">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      В выбранном периоде ({formatPeriodTitle(selectedPeriod)}) платежи не найдены.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const cat = CATEGORY_CONFIG[item.category] ||
                      CATEGORY_CONFIG.other || {
                        label: 'Прочее',
                        icon: '📦',
                        bg: 'bg-slate-50 border-slate-200',
                        text: 'text-slate-800',
                      };

                    const isPaid = item.status === 'paid';
                    const isDueToday = item.status === 'due_today';
                    const isOverdue = item.status === 'overdue';
                    const isVariable = item.payment_type === 'variable';

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-50/80 transition-colors ${isPaid ? 'bg-slate-50/40 opacity-75' : isDueToday ? 'bg-blue-50/40' : isOverdue ? 'bg-rose-50/40' : ''}`}
                      >
                        {/* День месяца */}
                        <td className="py-3 px-3.5 text-center">
                          <div
                            className={`w-8 h-8 mx-auto rounded-xl flex items-center justify-center font-black text-xs ${isPaid ? 'bg-emerald-100 text-emerald-800' : isDueToday ? 'bg-blue-600 text-white animate-pulse' : isOverdue ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                          >
                            {item.due_day}
                          </div>
                        </td>

                        {/* Название и получатель */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                            <span>{item.title}</span>
                            {item.is_loan && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-blue-100 text-blue-700">
                                Кредит/Лизинг
                              </span>
                            )}
                            {item.is_fuel_rule && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.2 rounded border bg-purple-50 text-purple-700 border-purple-200">
                                ⛽ Еженедельное пополнение ТК
                              </span>
                            )}
                            {item.is_salary_rule && (
                              <span
                                className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${
                                  item.amount > 0
                                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                {item.amount > 0
                                  ? '⚡ Ближайшая выплата ЗП'
                                  : '📅 Плановая пятница'}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {item.recipient && <span>Кому: {item.recipient} · </span>}
                            {item.notes}
                            {item.is_salary_rule && (
                              <a
                                href="/staff"
                                className="ml-2 text-blue-600 hover:text-blue-700 underline font-semibold"
                              >
                                Ведомость ЗП →
                              </a>
                            )}
                          </div>
                        </td>

                        {/* Тип платежа */}
                        <td className="py-3 px-3">
                          {isVariable ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
                              <span>⚡</span> Переменный
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              <span>🔒</span> Постоянный
                            </span>
                          )}
                        </td>

                        {/* Категория */}
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${cat.bg} ${cat.text}`}
                          >
                            <span>{cat.icon}</span> {cat.label}
                          </span>
                        </td>

                        {/* Сумма */}
                        <td className="py-3 px-3 text-right">
                          <div className="font-mono font-black text-slate-900 text-sm">
                            <Money amount={item.amount.toFixed(2)} />
                          </div>
                          {item.planned_amount && item.planned_amount !== item.amount ? (
                            <div className="text-[10px] text-slate-400 font-medium">
                              план: {item.planned_amount.toLocaleString('ru-RU')} ₽
                              {item.amount < item.planned_amount ? (
                                <span className="text-amber-600 font-bold ml-1">
                                  (-{(item.planned_amount - item.amount).toLocaleString('ru-RU')} ₽)
                                </span>
                              ) : (
                                <span className="text-blue-600 font-bold ml-1">
                                  (+{(item.amount - item.planned_amount).toLocaleString('ru-RU')} ₽)
                                </span>
                              )}
                            </div>
                          ) : null}
                        </td>

                        {/* Срок */}
                        <td className="py-3 px-3">
                          {isPaid ? (
                            <span className="text-[11px] text-emerald-600 font-medium">
                              Выплачено
                            </span>
                          ) : isDueToday ? (
                            <span className="text-[11px] text-blue-700 font-extrabold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping"></span>
                              Сегодня!
                            </span>
                          ) : isOverdue ? (
                            <span className="text-[11px] text-rose-600 font-bold">
                              Просрочен на {Math.abs(item.days_left)} дн.
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500">
                              через {item.days_left} дн. ({item.due_date.slice(8, 10)}.
                              {item.due_date.slice(5, 7)})
                            </span>
                          )}
                        </td>

                        {/* Счёт */}
                        <td className="py-3 px-3 text-[11px] text-slate-500">
                          {item.preferred_wallet_id === '10000000-0000-0000-0000-000000000002'
                            ? '💵 Касса (нал)'
                            : '🏦 Р/Счёт (Т-Банк)'}
                        </td>

                        {/* Статус */}
                        <td className="py-3 px-3 text-center">
                          {isPaid ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              ✓ Оплачен
                            </span>
                          ) : isDueToday ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                              К оплате
                            </span>
                          ) : isOverdue ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              Просрочка
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                              Запланирован
                            </span>
                          )}
                        </td>

                        {/* Действие */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {isPaid ? (
                              <span className="text-[11px] text-slate-400 font-mono">
                                {item.paid_at
                                  ? new Date(item.paid_at).toLocaleDateString('ru-RU', {
                                      day: 'numeric',
                                      month: 'short',
                                    })
                                  : 'Оплачен'}
                              </span>
                            ) : item.is_salary_rule && item.amount === 0 ? (
                              <span className="text-[11px] text-slate-400 font-medium italic">
                                Копится
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  setPayModalItem(item);
                                  setPayAmount(String(item.amount));
                                  setPayWallet(
                                    item.preferred_wallet_id ===
                                      '10000000-0000-0000-0000-000000000002'
                                      ? '10000000-0000-0000-0000-000000000002'
                                      : '10000000-0000-0000-0000-000000000001',
                                  );
                                }}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1"
                              >
                                <span>✓</span> Оплатить
                              </button>
                            )}

                            {/* Редактировать */}
                            <button
                              onClick={() => handleOpenEdit(item)}
                              title="Редактировать событие"
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            >
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                />
                              </svg>
                            </button>

                            <button
                              onClick={() => {
                                if (
                                  window.confirm(`Удалить «${item.title}» из платёжного календаря?`)
                                ) {
                                  deleteObligationMutation.mutate(item.id);
                                }
                              }}
                              disabled={deleteObligationMutation.isPending}
                              title="Удалить из календаря"
                              className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            >
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Модалка Расшифровки Платежей Выбранного Дня Календаря ── */}
      {selectedCalendarDay !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            {/* Шапка модалки */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <span>📅</span>
                  <span>
                    {selectedCalendarDay} {MONTH_NAMES[calMonth - 1]} {calYear}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-800">
                    {
                      [
                        'Воскресенье',
                        'Понедельник',
                        'Вторник',
                        'Среда',
                        'Четверг',
                        'Пятница',
                        'Суббота',
                      ][new Date(calYear, calMonth - 1, selectedCalendarDay).getDay()]
                    }
                  </span>
                </h3>
                <div className="text-xs text-slate-400 mt-0.5">
                  Расшифровка всех обязательств и платежей за этот день
                </div>
              </div>
              <button
                onClick={() => setSelectedCalendarDay(null)}
                className="text-slate-400 hover:text-slate-600 text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Финансовая сводка за день */}
            {(() => {
              const dayItems = items.filter((it) => it.due_day === selectedCalendarDay);
              const dayTotal = dayItems.reduce((acc, it) => acc + it.amount, 0);
              const dayPaid = dayItems
                .filter((it) => it.status === 'paid')
                .reduce((acc, it) => acc + it.amount, 0);
              const dayRemaining = dayTotal - dayPaid;

              return (
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase">
                      Всего за день
                    </div>
                    <div className="text-sm font-black font-mono text-slate-900 mt-0.5">
                      <Money amount={dayTotal.toFixed(2)} />
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-emerald-600 font-bold uppercase">Оплачено</div>
                    <div className="text-sm font-black font-mono text-emerald-700 mt-0.5">
                      <Money amount={dayPaid.toFixed(2)} />
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase">К оплате</div>
                    <div className="text-sm font-black font-mono text-slate-800 mt-0.5">
                      <Money amount={dayRemaining.toFixed(2)} />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Список платежей дня */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
              {(() => {
                const dayItems = items.filter((it) => it.due_day === selectedCalendarDay);
                if (dayItems.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-400 space-y-3">
                      <div>На этот день платежей не запланировано.</div>
                      <button
                        onClick={() => {
                          const d = String(selectedCalendarDay);
                          setSelectedCalendarDay(null);
                          setNewDueDay(d);
                          setShowAddModal(true);
                        }}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition inline-flex items-center gap-1.5 shadow-xs"
                      >
                        + Запланировать платёж на этот день
                      </button>
                    </div>
                  );
                }

                return dayItems.map((item) => {
                  const cat = CATEGORY_CONFIG[item.category] ||
                    CATEGORY_CONFIG.other || {
                      label: 'Прочее',
                      icon: '📦',
                      bg: 'bg-slate-50 border-slate-200',
                      text: 'text-slate-800',
                    };

                  const isPaid = item.status === 'paid';
                  const isDueToday = item.status === 'due_today';
                  const isOverdue = item.status === 'overdue';

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isPaid
                          ? 'bg-slate-50/50 border-slate-200 opacity-80'
                          : isDueToday
                            ? 'bg-blue-50/30 border-blue-200'
                            : isOverdue
                              ? 'bg-rose-50/30 border-rose-200'
                              : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.2 rounded text-[10px] font-bold border ${cat.bg} ${cat.text}`}
                            >
                              <span>{cat.icon}</span> {cat.label}
                            </span>
                            <span className="font-bold text-slate-900 text-xs">{item.title}</span>
                            {item.is_fuel_rule && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800">
                                ⛽ ТК
                              </span>
                            )}
                            {item.is_salary_rule && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                                👥 ЗП
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-500">
                            {item.recipient && <span>Кому: {item.recipient} · </span>}
                            <span>{item.notes || 'Без примечаний'}</span>
                            {item.is_salary_rule && (
                              <a
                                href="/staff"
                                className="ml-2 text-blue-600 hover:text-blue-700 underline font-semibold"
                              >
                                Ведомость ЗП →
                              </a>
                            )}
                          </div>

                          <div className="text-[10px] text-slate-400">
                            Счёт:{' '}
                            <strong className="text-slate-600 font-medium">
                              {item.preferred_wallet_id === '10000000-0000-0000-0000-000000000002'
                                ? '💵 Касса (нал)'
                                : '🏦 Р/Счёт (Т-Банк)'}
                            </strong>
                          </div>
                        </div>

                        {/* Сумма и статус */}
                        <div className="text-right flex flex-col items-end gap-1">
                          <div className="font-mono font-black text-slate-900 text-sm">
                            <Money amount={item.amount.toFixed(2)} />
                          </div>
                          {item.planned_amount && item.planned_amount !== item.amount && (
                            <div className="text-[10px] text-slate-400 font-medium">
                              план: {item.planned_amount.toLocaleString('ru-RU')} ₽
                              {item.amount < item.planned_amount ? (
                                <span className="text-amber-600 font-bold ml-1">
                                  (-{(item.planned_amount - item.amount).toLocaleString('ru-RU')} ₽)
                                </span>
                              ) : (
                                <span className="text-blue-600 font-bold ml-1">
                                  (+{(item.amount - item.planned_amount).toLocaleString('ru-RU')} ₽)
                                </span>
                              )}
                            </div>
                          )}

                          {isPaid ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              ✓ Оплачен
                            </span>
                          ) : isDueToday ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                              К оплате
                            </span>
                          ) : isOverdue ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              Просрочка
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                              Запланирован
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Кнопки действий */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-[10px] text-slate-400">
                          {isPaid && item.paid_at && (
                            <span>
                              Оплачено:{' '}
                              {new Date(item.paid_at).toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {!isPaid && !(item.is_salary_rule && item.amount === 0) && (
                            <button
                              onClick={() => {
                                setSelectedCalendarDay(null);
                                setPayModalItem(item);
                                setPayAmount(String(item.amount));
                                setPayWallet(
                                  item.preferred_wallet_id ===
                                    '10000000-0000-0000-0000-000000000002'
                                    ? '10000000-0000-0000-0000-000000000002'
                                    : '10000000-0000-0000-0000-000000000001',
                                );
                              }}
                              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-xl shadow-xs transition flex items-center gap-1"
                            >
                              <span>✓</span> Оплатить
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSelectedCalendarDay(null);
                              handleOpenEdit(item);
                            }}
                            title="Редактировать событие"
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                              />
                            </svg>
                          </button>

                          <button
                            onClick={() => {
                              if (
                                window.confirm(`Удалить «${item.title}» из платёжного календаря?`)
                              ) {
                                deleteObligationMutation.mutate(item.id);
                              }
                            }}
                            title="Удалить из календаря"
                            className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Подвал модалки */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  const d = String(selectedCalendarDay);
                  setSelectedCalendarDay(null);
                  setNewDueDay(d);
                  setShowAddModal(true);
                }}
                className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-xl transition flex items-center gap-1"
              >
                + Запланировать ещё платёж
              </button>
              <button
                onClick={() => setSelectedCalendarDay(null)}
                className="px-4 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Модалка Отметки об Оплате Обязательства ── */}
      {payModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Выплата по календарю</h3>
              <button
                onClick={() => setPayModalItem(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 mb-1">Статья обязательства</label>
                <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
                  <span>{payModalItem.title}</span>
                  {payModalItem.is_fuel_rule && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                      ⛽ Топливная карта
                    </span>
                  )}
                  {payModalItem.is_salary_rule && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      👥 Зарплата
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                  <span>
                    Плановая сумма:{' '}
                    <strong className="text-slate-800 font-mono">
                      {(payModalItem.planned_amount || payModalItem.amount).toLocaleString('ru-RU')}{' '}
                      ₽
                    </strong>
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-600 font-semibold">
                    Фактическая сумма оплаты (₽) *
                  </label>
                  {parseFloat(payAmount || '0') !==
                    (payModalItem.planned_amount || payModalItem.amount) && (
                    <button
                      type="button"
                      onClick={() =>
                        setPayAmount(String(payModalItem.planned_amount || payModalItem.amount))
                      }
                      className="text-[11px] text-blue-600 hover:text-blue-700 underline font-semibold"
                    >
                      Вернуть плановую (
                      {(payModalItem.planned_amount || payModalItem.amount).toLocaleString('ru-RU')}{' '}
                      ₽)
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Введите сумму..."
                  className="w-full text-base font-bold font-mono px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
                {parseFloat(payAmount || '0') > 0 &&
                  parseFloat(payAmount || '0') !==
                    (payModalItem.planned_amount || payModalItem.amount) && (
                    <div className="mt-1.5 p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold">⚡</span>
                      <span>
                        Сумма отличается от плана:{' '}
                        <strong>{parseFloat(payAmount || '0').toLocaleString('ru-RU')} ₽</strong>{' '}
                        вместо{' '}
                        {(payModalItem.planned_amount || payModalItem.amount).toLocaleString(
                          'ru-RU',
                        )}{' '}
                        ₽. Платёж закроется на указанную сумму и отметится как выполненный.
                      </span>
                    </div>
                  )}
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Счёт списания *</label>
                <select
                  value={payWallet}
                  onChange={(e) =>
                    setPayWallet(
                      e.target.value as
                        | '10000000-0000-0000-0000-000000000001'
                        | '10000000-0000-0000-0000-000000000002',
                    )
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                >
                  <option value="10000000-0000-0000-0000-000000000001">
                    Расчётный счёт (Т-Банк)
                  </option>
                  <option value="10000000-0000-0000-0000-000000000002">Касса (наличные)</option>
                </select>
              </div>

              <label className="flex items-center gap-2 pt-1 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createTx}
                  onChange={(e) => setCreateTx(e.target.checked)}
                  className="accent-slate-900 rounded"
                />
                <span>Списать с баланса счёта (создать расходную транзакцию)</span>
              </label>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setPayModalItem(null)}
                className="flex-1 py-2 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                onClick={() => markPaidMutation.mutate()}
                disabled={markPaidMutation.isPending || !payAmount}
                className="flex-1 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl disabled:opacity-50 transition"
              >
                {markPaidMutation.isPending ? 'Проведение...' : 'Подтвердить оплату'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Модалка Добавления Нового Обязательного Платежа ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Новый платёж в календарь</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Тип платежа */}
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Тип обязательства *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewPaymentType('fixed')}
                    className={`p-2.5 text-left rounded-xl border transition ${newPaymentType === 'fixed' ? 'border-slate-900 bg-slate-900 text-white shadow-xs' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    <div className="font-bold flex items-center gap-1">
                      <span>🔒</span> Постоянный (фикс)
                    </div>
                    <div
                      className={`text-[10px] mt-0.5 ${newPaymentType === 'fixed' ? 'text-slate-300' : 'text-slate-400'}`}
                    >
                      Каждый месяц в этот день (аренда, связь, кредиты...)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewPaymentType('variable')}
                    className={`p-2.5 text-left rounded-xl border transition ${newPaymentType === 'variable' ? 'border-purple-600 bg-purple-600 text-white shadow-xs' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    <div className="font-bold flex items-center gap-1">
                      <span>⚡</span> Переменный (разовый)
                    </div>
                    <div
                      className={`text-[10px] mt-0.5 ${newPaymentType === 'variable' ? 'text-purple-100' : 'text-slate-400'}`}
                    >
                      Только на {formatPeriodTitle(selectedPeriod)}
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Название статьи *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Аренда офиса, Интернет, Оплата стоянки..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Категория</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as CalendarItem['category'])}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  >
                    <option value="rent">🏢 Аренда</option>
                    <option value="fuel">⛽ ГСМ / Топливо</option>
                    <option value="comms">📱 Связь / ГЛОНАСС</option>
                    <option value="salary">👥 Зарплаты</option>
                    <option value="court_order">⚖️ Алименты / ФССП</option>
                    <option value="leasing_loan">🏦 Лизинг / Кредит</option>
                    <option value="tax">📑 Налоги</option>
                    <option value="insurance">🛡️ Страховка</option>
                    <option value="other">📦 Прочее</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    День месяца (1-31) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={newDueDay}
                    onChange={(e) => setNewDueDay(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Плановая сумма (₽) *
                </label>
                <input
                  type="number"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-base font-bold font-mono px-3 py-2 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Получатель платежа
                </label>
                <input
                  type="text"
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  placeholder="Кому платим (ООО / ФИО)..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Примечание / Назначение
                </label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Договор, особенности списания..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                onClick={() => addObligationMutation.mutate()}
                disabled={addObligationMutation.isPending || !newTitle || !newAmount}
                className="flex-1 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 transition"
              >
                {addObligationMutation.isPending ? 'Сохранение...' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Модалка Редактирования Обязательства / События ── */}
      {editModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-base">✏️</span>
                <h3 className="font-bold text-base text-slate-900">Редактировать событие</h3>
              </div>
              <button
                onClick={() => setEditModalItem(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Тип платежа */}
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Тип обязательства *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditPaymentType('fixed')}
                    className={`p-2.5 text-left rounded-xl border transition ${editPaymentType === 'fixed' ? 'border-slate-900 bg-slate-900 text-white shadow-xs' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    <div className="font-bold flex items-center gap-1">
                      <span>🔒</span> Постоянный
                    </div>
                    <div
                      className={`text-[10px] mt-0.5 ${editPaymentType === 'fixed' ? 'text-slate-300' : 'text-slate-400'}`}
                    >
                      Каждый месяц в этот день
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditPaymentType('variable')}
                    className={`p-2.5 text-left rounded-xl border transition ${editPaymentType === 'variable' ? 'border-purple-600 bg-purple-600 text-white shadow-xs' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    <div className="font-bold flex items-center gap-1">
                      <span>⚡</span> Переменный
                    </div>
                    <div
                      className={`text-[10px] mt-0.5 ${editPaymentType === 'variable' ? 'text-purple-100' : 'text-slate-400'}`}
                    >
                      Только на текущий месяц
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Название статьи *</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Аренда, ГСМ, Зарплата..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Категория</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as CalendarItem['category'])}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  >
                    <option value="rent">🏢 Аренда</option>
                    <option value="fuel">⛽ ГСМ / Топливо</option>
                    <option value="comms">📱 Связь / ГЛОНАСС</option>
                    <option value="salary">👥 Зарплаты</option>
                    <option value="court_order">⚖️ Алименты / ФССП</option>
                    <option value="leasing_loan">🏦 Лизинг / Кредит</option>
                    <option value="tax">📑 Налоги</option>
                    <option value="insurance">🛡️ Страховка</option>
                    <option value="other">📦 Прочее</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    День месяца (1-31) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={editDueDay}
                    onChange={(e) => setEditDueDay(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Сумма к оплате (₽) *
                </label>
                <input
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-base font-bold font-mono px-3 py-2 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Счёт списания</label>
                <select
                  value={editWallet}
                  onChange={(e) =>
                    setEditWallet(
                      e.target.value as
                        | '10000000-0000-0000-0000-000000000001'
                        | '10000000-0000-0000-0000-000000000002',
                    )
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                >
                  <option value="10000000-0000-0000-0000-000000000001">
                    Расчётный счёт (Т-Банк)
                  </option>
                  <option value="10000000-0000-0000-0000-000000000002">Касса (наличные)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Получатель платежа
                </label>
                <input
                  type="text"
                  value={editRecipient}
                  onChange={(e) => setEditRecipient(e.target.value)}
                  placeholder="Кому платим (ООО / ФИО)..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Примечание / Назначение
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Договор, особенности списания..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setEditModalItem(null)}
                className="flex-1 py-2 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                onClick={() => updateObligationMutation.mutate()}
                disabled={updateObligationMutation.isPending || !editTitle.trim() || !editAmount}
                className="flex-1 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 transition"
              >
                {updateObligationMutation.isPending ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
