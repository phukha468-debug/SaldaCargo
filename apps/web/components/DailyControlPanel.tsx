'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// --- Helper Functions ---
function rub(val: number | string | null | undefined): string {
  const num = typeof val === 'number' ? val : parseFloat(String(val ?? '0')) || 0;
  return num.toLocaleString('ru-RU') + ' ₽';
}

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.toLocaleDateString('ru-RU', { weekday: 'short' });
  const dayMonth = d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `${dow.toUpperCase()}, ${dayMonth}`;
}

type WalletFilter = 'all' | 'bank' | 'cash' | 'fuel_card';

interface CategoryItem {
  id: string;
  name: string;
  code: string;
}

interface RawTx {
  id: string;
  amount: string;
  direction: 'income' | 'expense';
  description: string | null;
  created_at: string;
  from_wallet_id: string | null;
  to_wallet_id: string | null;
  category_id?: string | null;
  counterparty_id?: string | null;
  category: { id: string; name: string; code: string } | null;
  counterparty: { id: string; name: string } | null;
  related_user: { id: string; name: string } | null;
}

interface TripOrderTx {
  id: string;
  amount: string;
  created_at: string;
  payment_method: string;
  description: string | null;
  counterparty: { id: string; name: string } | null;
  trip: {
    trip_number: number;
    driver: { name: string } | null;
  } | null;
}

interface CashCollectionTx {
  id: string;
  amount: string;
  created_at: string;
  note: string | null;
  driver: { name: string } | null;
}

interface DailyBalanceData {
  date: string;
  is_today: boolean;
  wallets: {
    bank: {
      id: string;
      name: string;
      account_number: string;
      api_synced: boolean;
      morning: number;
      inflow: number;
      outflow: number;
      evening: number;
    };
    cash: {
      id: string;
      name: string;
      morning: number;
      inflow: number;
      outflow: number;
      evening: number;
    };
    fuel_card: {
      id: string;
      name: string;
      morning: number;
      inflow: number;
      outflow: number;
      evening: number;
    };
  };
  audit: {
    id: string;
    date: string;
    audited_at: string;
    audited_by: string;
    safe_cash_actual: number;
    safe_cash_expected: number;
    safe_discrepancy: number;
    bank_balance: number;
    fuel_card_balance: number;
    status: 'confirmed' | 'discrepancy' | 'pending';
    notes: string;
  } | null;
  transactions: RawTx[];
  trip_orders: TripOrderTx[];
  cash_collections: CashCollectionTx[];
  categories: CategoryItem[];
}

export function DailyControlPanel() {
  const queryClient = useQueryClient();
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [activeWallet, setActiveWallet] = useState<WalletFilter>('all');

  // Accordion state for grouped rows (key -> boolean)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Edit transaction modal state
  const [editingTx, setEditingTx] = useState<{
    id: string;
    description: string;
    amount: number;
    categoryId?: string | null;
    categoryName?: string;
    direction: 'income' | 'expense';
  } | null>(null);

  // Director Audit Modal state
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditForm, setAuditForm] = useState({
    audited_by: 'Директор',
    actualCash: '',
    notes: '',
  });

  // Fetch daily balance data
  const { data } = useQuery<DailyBalanceData>({
    queryKey: ['daily-balance', selectedDate],
    queryFn: () => fetch(`/api/finance/daily-balance?date=${selectedDate}`).then((r) => r.json()),
    staleTime: 30 * 1000,
  });

  // Mutations
  const updateTxMutation = useMutation({
    mutationFn: async ({
      id,
      description,
      categoryId,
    }: {
      id: string;
      description: string;
      categoryId?: string | null;
    }) => {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          category_id: categoryId,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка при сохранении');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-balance', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['finance-month'] });
      setEditingTx(null);
    },
  });

  const auditMutation = useMutation({
    mutationFn: async (payload: {
      date: string;
      safe_cash_actual: number;
      safe_cash_expected: number;
      bank_balance: number;
      fuel_card_balance: number;
      audited_by: string;
      notes: string;
    }) => {
      const res = await fetch('/api/finance/daily-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка подтверждения');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-balance', selectedDate] });
      setIsAuditModalOpen(false);
    },
  });

  // Navigation shifts
  function shiftDay(days: number) {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    const nextStr = d.toISOString().slice(0, 10);
    setSelectedDate(nextStr);
  }

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const bankWallet = data?.wallets?.bank;
  const cashWallet = data?.wallets?.cash;
  const fuelWallet = data?.wallets?.fuel_card;

  // Active wallet filter helper
  const BANK_ID = '10000000-0000-0000-0000-000000000001';
  const CASH_ID = '10000000-0000-0000-0000-000000000002';
  const FUEL_CARD_ID = '10000000-0000-0000-0000-000000000004';

  function txMatchesWallet(tx: RawTx): boolean {
    if (activeWallet === 'all') return true;
    if (activeWallet === 'bank')
      return tx.from_wallet_id === BANK_ID || tx.to_wallet_id === BANK_ID;
    if (activeWallet === 'cash')
      return tx.from_wallet_id === CASH_ID || tx.to_wallet_id === CASH_ID;
    if (activeWallet === 'fuel_card')
      return tx.from_wallet_id === FUEL_CARD_ID || tx.to_wallet_id === FUEL_CARD_ID;
    return true;
  }

  // --- Aggregate & Group Incomes ---
  interface IncomeItem {
    id: string;
    title: string;
    category: string;
    wallet: 'bank' | 'cash' | 'fuel_card';
    walletName: string;
    author: string;
    amount: number;
    rawTx?: RawTx;
    isGroup?: boolean;
    subItems?: Array<{
      id: string;
      title: string;
      author: string;
      amount: number;
      time: string;
      rawTx?: RawTx;
    }>;
  }

  const incomeItems: IncomeItem[] = [];

  // Add settled trip orders (Bank income)
  if (activeWallet === 'all' || activeWallet === 'bank') {
    (data?.trip_orders ?? []).forEach((order) => {
      const client = order.counterparty?.name || order.description || 'Оплата рейса';
      const driver = order.trip?.driver?.name ? `вод. ${order.trip.driver.name}` : 'Рейс';
      incomeItems.push({
        id: `trip-${order.id}`,
        title: `Выручка с рейса · ${client}`,
        category: 'Выручка логистики',
        wallet: 'bank',
        walletName: 'Р/С Банк',
        author: driver,
        amount: parseFloat(order.amount) || 0,
      });
    });
  }

  // Add cash collections (Safe income)
  if (activeWallet === 'all' || activeWallet === 'cash') {
    (data?.cash_collections ?? []).forEach((col) => {
      incomeItems.push({
        id: `cash-${col.id}`,
        title: `Инкассация наличных${col.note ? ` (${col.note})` : ''}`,
        category: 'Инкассация',
        wallet: 'cash',
        walletName: 'Сейф (нал)',
        author: col.driver?.name || 'Водитель',
        amount: parseFloat(col.amount) || 0,
      });
    });
  }

  // Add explicit income transactions
  const rawIncomeTxs = (data?.transactions ?? []).filter(
    (t) => t.direction === 'income' && txMatchesWallet(t),
  );

  // Group acquiring reimbursements if multiple
  const acquiringTxs: RawTx[] = [];
  rawIncomeTxs.forEach((tx) => {
    const desc = (tx.description || '').toLowerCase();
    const cat = (tx.category?.name || '').toLowerCase();
    if (desc.includes('эквайринг') || cat.includes('эквайринг')) {
      acquiringTxs.push(tx);
    } else {
      let w: 'bank' | 'cash' | 'fuel_card' = 'bank';
      let wName = 'Р/С Банк';
      if (tx.to_wallet_id === CASH_ID) {
        w = 'cash';
        wName = 'Сейф (нал)';
      } else if (tx.to_wallet_id === FUEL_CARD_ID) {
        w = 'fuel_card';
        wName = 'Топливная карта';
      }
      incomeItems.push({
        id: tx.id,
        title: tx.description || 'Входящее поступление',
        category: tx.category?.name || 'Поступления',
        wallet: w,
        walletName: wName,
        author: tx.counterparty?.name || tx.related_user?.name || 'Бухгалтерия',
        amount: parseFloat(tx.amount) || 0,
        rawTx: tx,
      });
    }
  });

  if (acquiringTxs.length > 0) {
    if (acquiringTxs.length === 1 && acquiringTxs[0]) {
      const tx = acquiringTxs[0];
      incomeItems.push({
        id: tx.id,
        title: tx.description || 'Возмещение по эквайрингу',
        category: 'Эквайринг',
        wallet: 'bank',
        walletName: 'Р/С Банк',
        author: 'Т-Банк Эквайринг',
        amount: parseFloat(tx.amount) || 0,
        rawTx: tx,
      });
    } else {
      const totalAcq = acquiringTxs.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      incomeItems.push({
        id: 'group-acquiring',
        title: `Возмещение по эквайрингу (${acquiringTxs.length} реестра)`,
        category: 'Эквайринг',
        wallet: 'bank',
        walletName: 'Р/С Банк',
        author: 'Т-Банк Эквайринг',
        amount: totalAcq,
        isGroup: true,
        subItems: acquiringTxs.map((t) => ({
          id: t.id,
          title: t.description || 'Реестр эквайринга',
          author: t.counterparty?.name || 'Т-Банк',
          amount: parseFloat(t.amount) || 0,
          time: new Date(t.created_at).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          rawTx: t,
        })),
      });
    }
  }

  // --- Aggregate & Group Expenses ---
  interface ExpenseItem {
    id: string;
    title: string;
    category: string;
    wallet: 'bank' | 'cash' | 'fuel_card';
    walletName: string;
    author: string;
    amount: number;
    rawTx?: RawTx;
    isGroup?: boolean;
    subItems?: Array<{
      id: string;
      title: string;
      author: string;
      amount: number;
      time: string;
      rawTx?: RawTx;
    }>;
  }

  const rawExpenseTxs = (data?.transactions ?? []).filter(
    (t) => t.direction === 'expense' && txMatchesWallet(t),
  );

  const bankCommissions: RawTx[] = [];
  const payrollTxs: RawTx[] = [];
  const fuelTxs: RawTx[] = [];
  const normalExpenseItems: ExpenseItem[] = [];

  rawExpenseTxs.forEach((tx) => {
    const desc = (tx.description || '').toLowerCase();
    const cat = (tx.category?.name || '').toLowerCase();

    if (
      desc.includes('комисси') ||
      cat.includes('комисси') ||
      desc.includes('за входящий перевод') ||
      desc.includes('плата за обслуживание')
    ) {
      bankCommissions.push(tx);
    } else if (
      desc.includes('зарплат') ||
      desc.includes('фот') ||
      desc.includes('аванс') ||
      cat.includes('зарплат') ||
      cat.includes('фот')
    ) {
      payrollTxs.push(tx);
    } else if (
      (tx.from_wallet_id === FUEL_CARD_ID || desc.includes('гсм') || cat.includes('гсм')) &&
      tx.from_wallet_id === FUEL_CARD_ID
    ) {
      fuelTxs.push(tx);
    } else {
      let w: 'bank' | 'cash' | 'fuel_card' = 'bank';
      let wName = 'Р/С Банк';
      if (tx.from_wallet_id === CASH_ID) {
        w = 'cash';
        wName = 'Сейф (нал)';
      } else if (tx.from_wallet_id === FUEL_CARD_ID) {
        w = 'fuel_card';
        wName = 'Топливная карта';
      }

      normalExpenseItems.push({
        id: tx.id,
        title: tx.description || 'Расход',
        category: tx.category?.name || 'Прочие расходы',
        wallet: w,
        walletName: wName,
        author: tx.related_user?.name || tx.counterparty?.name || 'Администратор',
        amount: parseFloat(tx.amount) || 0,
        rawTx: tx,
      });
    }
  });

  const expenseItems: ExpenseItem[] = [...normalExpenseItems];

  // Grouped: Bank Commissions
  if (bankCommissions.length > 0) {
    if (bankCommissions.length === 1 && bankCommissions[0]) {
      const tx = bankCommissions[0];
      expenseItems.push({
        id: tx.id,
        title: tx.description || 'Комиссия банка',
        category: 'Банковские услуги',
        wallet: 'bank',
        walletName: 'Р/С Банк',
        author: 'Т-Банк (Авто)',
        amount: parseFloat(tx.amount) || 0,
        rawTx: tx,
      });
    } else {
      const totalComm = bankCommissions.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      expenseItems.push({
        id: 'group-bank-commission',
        title: `Комиссии банка за операции (${bankCommissions.length} списаний)`,
        category: 'Банковские услуги',
        wallet: 'bank',
        walletName: 'Р/С Банк',
        author: 'Т-Банк (Авто)',
        amount: totalComm,
        isGroup: true,
        subItems: bankCommissions.map((t) => ({
          id: t.id,
          title: t.description || 'Комиссия за операцию',
          author: 'Т-Банк',
          amount: parseFloat(t.amount) || 0,
          time: new Date(t.created_at).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          rawTx: t,
        })),
      });
    }
  }

  // Grouped: Payroll (Зарплата)
  if (payrollTxs.length > 0) {
    if (payrollTxs.length === 1 && payrollTxs[0]) {
      const tx = payrollTxs[0];
      let w: 'bank' | 'cash' | 'fuel_card' = 'bank';
      let wName = 'Р/С Банк';
      if (tx.from_wallet_id === CASH_ID) {
        w = 'cash';
        wName = 'Сейф (нал)';
      }
      expenseItems.push({
        id: tx.id,
        title: tx.description || 'Выплата зарплаты',
        category: 'ФОТ / Зарплата',
        wallet: w,
        walletName: wName,
        author: tx.related_user?.name || 'Водитель/Сотрудник',
        amount: parseFloat(tx.amount) || 0,
        rawTx: tx,
      });
    } else {
      const totalPay = payrollTxs.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      expenseItems.push({
        id: 'group-payroll',
        title: `Выплата зарплаты сотрудникам (${payrollTxs.length} выплат)`,
        category: 'ФОТ / Зарплата',
        wallet: 'bank',
        walletName: 'Сводная выплата',
        author: 'Бухгалтерия / Директор',
        amount: totalPay,
        isGroup: true,
        subItems: payrollTxs.map((t) => ({
          id: t.id,
          title: t.description || 'Зарплата / Аванс',
          author: t.related_user?.name || 'Сотрудник',
          amount: parseFloat(t.amount) || 0,
          time: new Date(t.created_at).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          rawTx: t,
        })),
      });
    }
  }

  // Grouped: Fuel Card transactions
  if (fuelTxs.length > 0) {
    if (fuelTxs.length === 1 && fuelTxs[0]) {
      const tx = fuelTxs[0];
      expenseItems.push({
        id: tx.id,
        title: tx.description || 'Заправка ГСМ',
        category: 'ГСМ',
        wallet: 'fuel_card',
        walletName: 'Топливная карта',
        author: tx.related_user?.name || 'Водитель',
        amount: parseFloat(tx.amount) || 0,
        rawTx: tx,
      });
    } else {
      const totalFuel = fuelTxs.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      expenseItems.push({
        id: 'group-fuel',
        title: `Заправки автопарка (${fuelTxs.length} транзакций)`,
        category: 'ГСМ / Топливо',
        wallet: 'fuel_card',
        walletName: 'Топливная карта',
        author: 'Водители парка',
        amount: totalFuel,
        isGroup: true,
        subItems: fuelTxs.map((t) => ({
          id: t.id,
          title: t.description || 'Заправка ТС',
          author: t.related_user?.name || 'Водитель',
          amount: parseFloat(t.amount) || 0,
          time: new Date(t.created_at).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          rawTx: t,
        })),
      });
    }
  }

  // Totals calculations
  const totalDayExpenses = expenseItems.reduce((s, i) => s + i.amount, 0);
  const totalDayIncomes = incomeItems.reduce((s, i) => s + i.amount, 0);

  // Active wallet values for top summary bar
  let morningTotal =
    (bankWallet?.morning ?? 0) + (cashWallet?.morning ?? 0) + (fuelWallet?.morning ?? 0);
  let eveningTotal =
    (bankWallet?.evening ?? 0) + (cashWallet?.evening ?? 0) + (fuelWallet?.evening ?? 0);

  if (activeWallet === 'bank') {
    morningTotal = bankWallet?.morning ?? 0;
    eveningTotal = bankWallet?.evening ?? 0;
  } else if (activeWallet === 'cash') {
    morningTotal = cashWallet?.morning ?? 0;
    eveningTotal = cashWallet?.evening ?? 0;
  } else if (activeWallet === 'fuel_card') {
    morningTotal = fuelWallet?.morning ?? 0;
    eveningTotal = fuelWallet?.evening ?? 0;
  }

  const deltaTotal = eveningTotal - morningTotal;

  // Month navigation strips (like Review page)
  const monthStrip = Array.from({ length: 5 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (4 - i));
    const ym = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString('ru-RU', { month: 'short' }).toUpperCase();
    return { ym, label, isCurrent: selectedDate.startsWith(ym) };
  });

  return (
    <div className="space-y-3 font-sans pb-10">
      {/* ── 1. COMPACT DATE NAVIGATOR (Proportionally 2x smaller) ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col text-slate-200">
        {/* Top Mini Range Bar */}
        <div className="flex border-b border-slate-800/80 bg-slate-950/40 px-2 py-1 items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
              СУТОЧНЫЙ БАЛАНС И КОНТРОЛЬ КАССЫ
            </span>
          </div>
          <div className="flex items-center gap-2">
            {data?.audit?.status === 'confirmed' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-full">
                ✓ СЕЙФ ПОДТВЕРЖДЁН (19:30)
              </span>
            ) : data?.audit?.status === 'discrepancy' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded-full">
                ⚠️ РАСХОЖДЕНИЕ В СЕЙФЕ ({rub(data.audit.safe_discrepancy)})
              </span>
            ) : (
              <button
                onClick={() => {
                  setAuditForm({
                    audited_by: 'Директор',
                    actualCash: String(cashWallet?.evening ?? ''),
                    notes: '',
                  });
                  setIsAuditModalOpen(true);
                }}
                className="text-[10px] font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-md transition shadow-sm cursor-pointer"
              >
                🔒 ПРОВЕРИТЬ СЕЙФ (19:30)
              </button>
            )}
            <span className="text-[10px] text-slate-400 font-mono">
              API Т-Банк: {bankWallet?.api_synced ? '🟢 Live' : '⚪ DB'}
            </span>
          </div>
        </div>

        {/* Middle Date Bar - Compact Height h-8 (32px) */}
        <div className="flex items-center justify-between px-3 h-8 bg-slate-900 border-b border-slate-800/70">
          <button
            onClick={() => shiftDay(-1)}
            className="w-6 h-6 flex items-center justify-center rounded-md text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer text-sm font-bold"
            title="Предыдущий день"
          >
            ‹
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-tight text-white uppercase">
              {formatDayHeader(selectedDate)}
            </span>
            {selectedDate === todayStr && (
              <span className="text-[9px] font-extrabold bg-sky-500 text-white px-1.5 py-0.2 rounded tracking-wider">
                СЕГОДНЯ
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedDate(todayStr)}
              className="text-[10px] font-bold text-slate-400 hover:text-white px-2 py-0.5 rounded hover:bg-slate-800 transition cursor-pointer"
            >
              Сегодня
            </button>
            <button
              onClick={() => shiftDay(1)}
              className="w-6 h-6 flex items-center justify-center rounded-md text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer text-sm font-bold"
              title="Следующий день"
            >
              ›
            </button>
          </div>
        </div>

        {/* Bottom Month Strip - Micro Height */}
        <div className="grid grid-cols-5 bg-slate-950/70 text-center border-t border-slate-800/40">
          {monthStrip.map((m) => (
            <button
              key={m.ym}
              onClick={() => {
                const target = m.ym === todayStr.slice(0, 7) ? todayStr : `${m.ym}-01`;
                setSelectedDate(target);
              }}
              className={`py-1 text-[10px] font-bold tracking-wider transition cursor-pointer ${
                m.isCurrent
                  ? 'bg-slate-800 text-sky-400 border-b-2 border-sky-400 shadow-inner'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 2. BRIGHT WALLET SELECTOR BUTTONS ── */}
      <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider pl-1.5 pr-1">
          Кошелёк:
        </span>

        {/* All Wallets */}
        <button
          onClick={() => setActiveWallet('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
            activeWallet === 'all'
              ? 'bg-slate-900 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          🌐 Все 3 кошелька
        </button>

        {/* Bank */}
        <button
          onClick={() => setActiveWallet('bank')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
            activeWallet === 'bank'
              ? 'bg-sky-500 text-white ring-2 ring-sky-300 shadow-lg scale-105'
              : 'text-sky-700 hover:bg-sky-50 border border-sky-200/60'
          }`}
        >
          <span>🏦</span>
          <span>Р/С БАНК</span>
          <span
            className={`text-[10px] px-1 py-0.2 rounded font-mono ${
              activeWallet === 'bank' ? 'bg-sky-700 text-white' : 'bg-sky-100 text-sky-800'
            }`}
          >
            {rub(bankWallet?.evening ?? 0)}
          </span>
        </button>

        {/* Cash Safe */}
        <button
          onClick={() => setActiveWallet('cash')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
            activeWallet === 'cash'
              ? 'bg-emerald-600 text-white ring-2 ring-emerald-300 shadow-lg scale-105'
              : 'text-emerald-700 hover:bg-emerald-50 border border-emerald-200/60'
          }`}
        >
          <span>🔒</span>
          <span>СЕЙФ (НАЛ)</span>
          <span
            className={`text-[10px] px-1 py-0.2 rounded font-mono ${
              activeWallet === 'cash'
                ? 'bg-emerald-800 text-white'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {rub(cashWallet?.evening ?? 0)}
          </span>
        </button>

        {/* Fuel Card */}
        <button
          onClick={() => setActiveWallet('fuel_card')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
            activeWallet === 'fuel_card'
              ? 'bg-amber-500 text-white ring-2 ring-amber-300 shadow-lg scale-105'
              : 'text-amber-700 hover:bg-amber-50 border border-amber-200/60'
          }`}
        >
          <span>⛽</span>
          <span>ТОПЛИВНАЯ КАРТА</span>
          <span
            className={`text-[10px] px-1 py-0.2 rounded font-mono ${
              activeWallet === 'fuel_card'
                ? 'bg-amber-700 text-white'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {rub(fuelWallet?.evening ?? 0)}
          </span>
        </button>
      </div>

      {/* ── 3. VIBRANT ALERT BANNER WHEN SINGLE WALLET FILTERED ── */}
      {activeWallet !== 'all' && (
        <div
          className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
            activeWallet === 'bank'
              ? 'bg-sky-50 border-sky-300 text-sky-900'
              : activeWallet === 'cash'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">
              {activeWallet === 'bank' ? '🏦' : activeWallet === 'cash' ? '🔒' : '⛽'}
            </span>
            <span>
              АКТИВНЫЙ ФИЛЬТР:{' '}
              <strong className="uppercase">
                {activeWallet === 'bank'
                  ? 'Расчётный счёт банка'
                  : activeWallet === 'cash'
                    ? 'Сейф (Наличные)'
                    : 'Топливная карта (ГСМ)'}
              </strong>{' '}
              — таблица ниже показывает движение только по этой статье.
            </span>
          </div>
          <button
            onClick={() => setActiveWallet('all')}
            className="text-[10px] underline hover:no-underline font-extrabold cursor-pointer"
          >
            Сбросить (Показать все) ✕
          </button>
        </div>
      )}

      {/* ── 4. THREE WALLET CONTROL CARDS (WITH VIBRANT SELECTION HIGHLIGHTING) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {/* BANK CARD */}
        <div
          onClick={() => setActiveWallet(activeWallet === 'bank' ? 'all' : 'bank')}
          className={`p-2.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
            activeWallet === 'bank'
              ? 'bg-sky-50 border-2 border-sky-500 ring-4 ring-sky-200/80 shadow-md scale-[1.01]'
              : activeWallet !== 'all'
                ? 'bg-white border-slate-200 opacity-40 grayscale-40'
                : 'bg-white border-slate-200 hover:border-sky-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-base">🏦</span>
              <div>
                <div className="text-[11px] font-black uppercase text-slate-800 flex items-center gap-1">
                  Р/С Банк
                  {bankWallet?.api_synced && (
                    <span className="text-[9px] bg-sky-100 text-sky-700 font-mono font-bold px-1 rounded">
                      API 100%
                    </span>
                  )}
                </div>
                <div className="text-[9px] text-slate-400 font-mono">
                  {bankWallet?.account_number
                    ? `№ ...${bankWallet.account_number.slice(-4)}`
                    : 'Т-Банк Бизнес'}
                </div>
              </div>
            </div>
            {activeWallet === 'bank' && (
              <span className="text-[9px] font-black uppercase bg-sky-500 text-white px-1.5 py-0.5 rounded shadow-xs">
                ВЫБРАНО 🔥
              </span>
            )}
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-100 text-center font-mono">
            <div>
              <div className="text-[8px] uppercase text-slate-400 font-sans font-bold">
                Утро (00:00)
              </div>
              <div className="text-[11px] font-extrabold text-slate-600">
                {rub(bankWallet?.morning ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-[8px] uppercase text-slate-400 font-sans font-bold">
                Оборот дня
              </div>
              <div className="text-[11px] font-extrabold">
                <span className="text-emerald-600">+{rub(bankWallet?.inflow ?? 0)}</span>
                <span className="text-slate-300 mx-0.5">/</span>
                <span className="text-rose-600">-{rub(bankWallet?.outflow ?? 0)}</span>
              </div>
            </div>
            <div className="bg-sky-50/60 rounded p-0.5">
              <div className="text-[8px] uppercase text-sky-800 font-sans font-black">
                Вечер (Итог)
              </div>
              <div className="text-xs font-black text-sky-700">{rub(bankWallet?.evening ?? 0)}</div>
            </div>
          </div>
        </div>

        {/* CASH SAFE CARD */}
        <div
          onClick={() => setActiveWallet(activeWallet === 'cash' ? 'all' : 'cash')}
          className={`p-2.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
            activeWallet === 'cash'
              ? 'bg-emerald-50 border-2 border-emerald-600 ring-4 ring-emerald-200/80 shadow-md scale-[1.01]'
              : activeWallet !== 'all'
                ? 'bg-white border-slate-200 opacity-40 grayscale-40'
                : 'bg-white border-slate-200 hover:border-emerald-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-base">🔒</span>
              <div>
                <div className="text-[11px] font-black uppercase text-slate-800 flex items-center gap-1">
                  Сейф (Наличные)
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1 rounded">
                    Аудит 19:30
                  </span>
                </div>
                <div className="text-[9px] text-slate-400">Пересчёт купюр директором</div>
              </div>
            </div>
            {activeWallet === 'cash' && (
              <span className="text-[9px] font-black uppercase bg-emerald-600 text-white px-1.5 py-0.5 rounded shadow-xs">
                ВЫБРАНО 🔥
              </span>
            )}
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-100 text-center font-mono">
            <div>
              <div className="text-[8px] uppercase text-slate-400 font-sans font-bold">
                Утро (00:00)
              </div>
              <div className="text-[11px] font-extrabold text-slate-600">
                {rub(cashWallet?.morning ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-[8px] uppercase text-slate-400 font-sans font-bold">
                Оборот дня
              </div>
              <div className="text-[11px] font-extrabold">
                <span className="text-emerald-600">+{rub(cashWallet?.inflow ?? 0)}</span>
                <span className="text-slate-300 mx-0.5">/</span>
                <span className="text-rose-600">-{rub(cashWallet?.outflow ?? 0)}</span>
              </div>
            </div>
            <div className="bg-emerald-50/60 rounded p-0.5">
              <div className="text-[8px] uppercase text-emerald-800 font-sans font-black">
                Вечер (Итог)
              </div>
              <div className="text-xs font-black text-emerald-700">
                {rub(cashWallet?.evening ?? 0)}
              </div>
            </div>
          </div>
        </div>

        {/* FUEL CARD */}
        <div
          onClick={() => setActiveWallet(activeWallet === 'fuel_card' ? 'all' : 'fuel_card')}
          className={`p-2.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
            activeWallet === 'fuel_card'
              ? 'bg-amber-50 border-2 border-amber-500 ring-4 ring-amber-200/80 shadow-md scale-[1.01]'
              : activeWallet !== 'all'
                ? 'bg-white border-slate-200 opacity-40 grayscale-40'
                : 'bg-white border-slate-200 hover:border-amber-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-base">⛽</span>
              <div>
                <div className="text-[11px] font-black uppercase text-slate-800 flex items-center gap-1">
                  Топливная карта
                  <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1 rounded">
                    ГСМ Автопарк
                  </span>
                </div>
                <div className="text-[9px] text-slate-400">Баланс по чекам / кабинету</div>
              </div>
            </div>
            {activeWallet === 'fuel_card' && (
              <span className="text-[9px] font-black uppercase bg-amber-500 text-white px-1.5 py-0.5 rounded shadow-xs">
                ВЫБРАНО 🔥
              </span>
            )}
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-100 text-center font-mono">
            <div>
              <div className="text-[8px] uppercase text-slate-400 font-sans font-bold">
                Утро (00:00)
              </div>
              <div className="text-[11px] font-extrabold text-slate-600">
                {rub(fuelWallet?.morning ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-[8px] uppercase text-slate-400 font-sans font-bold">
                Оборот дня
              </div>
              <div className="text-[11px] font-extrabold">
                <span className="text-emerald-600">+{rub(fuelWallet?.inflow ?? 0)}</span>
                <span className="text-slate-300 mx-0.5">/</span>
                <span className="text-rose-600">-{rub(fuelWallet?.outflow ?? 0)}</span>
              </div>
            </div>
            <div className="bg-amber-50/60 rounded p-0.5">
              <div className="text-[8px] uppercase text-amber-800 font-sans font-black">
                Вечер (Итог)
              </div>
              <div className="text-xs font-black text-amber-700">
                {rub(fuelWallet?.evening ?? 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. TOP SUMMARY CARDS (Proportionally 2x smaller) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {/* Morning Total */}
        <div className="bg-gradient-to-br from-slate-700 to-slate-800 text-white rounded-xl p-2.5 relative overflow-hidden shadow-xs">
          <div className="text-[8px] font-black uppercase tracking-wider text-slate-300">
            {activeWallet === 'all' ? 'ОСТАТОК НА НАЧАЛО (00:00)' : 'УТРЕННИЙ ОСТАТОК'}
          </div>
          <div className="text-base sm:text-lg font-black font-mono mt-0.5 leading-tight">
            {rub(morningTotal)}
          </div>
          <div className="text-[9px] text-slate-400 mt-0.5">
            {activeWallet === 'all' ? 'Банк + Сейф + Топливо' : 'По выбранной статье'}
          </div>
        </div>

        {/* Expenses Total */}
        <div className="bg-gradient-to-br from-rose-500 to-red-600 text-white rounded-xl p-2.5 relative overflow-hidden shadow-xs">
          <div className="text-[8px] font-black uppercase tracking-wider text-rose-100">
            РАСХОДЫ ЗА ДЕНЬ
          </div>
          <div className="text-base sm:text-lg font-black font-mono mt-0.5 leading-tight">
            -{rub(totalDayExpenses)}
          </div>
          <div className="text-[9px] text-rose-100/80 mt-0.5">
            {expenseItems.length} позиций расходов
          </div>
        </div>

        {/* Incomes Total */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl p-2.5 relative overflow-hidden shadow-xs">
          <div className="text-[8px] font-black uppercase tracking-wider text-emerald-100">
            ДОХОДЫ ЗА ДЕНЬ
          </div>
          <div className="text-base sm:text-lg font-black font-mono mt-0.5 leading-tight">
            +{rub(totalDayIncomes)}
          </div>
          <div className="text-[9px] text-emerald-100/80 mt-0.5">
            {incomeItems.length} поступлений
          </div>
        </div>

        {/* Evening Balance */}
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-xl p-2.5 relative overflow-hidden shadow-xs">
          <div className="text-[8px] font-black uppercase tracking-wider text-indigo-100">
            {activeWallet === 'all' ? 'ИТОГО В КОНЦЕ ДНЯ' : 'ВЕЧЕРНИЙ ИТОГ'}
          </div>
          <div className="text-base sm:text-lg font-black font-mono mt-0.5 leading-tight">
            {rub(eveningTotal)}
          </div>
          <div className="text-[9px] text-indigo-100/80 mt-0.5 font-mono">
            Дельта: {deltaTotal >= 0 ? `+${rub(deltaTotal)}` : rub(deltaTotal)}
          </div>
        </div>
      </div>

      {/* ── 6. MAIN TWO-COLUMN TABLE: LEFT = EXPENSES, RIGHT = INCOMES ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        {/* LEFT COLUMN: EXPENSES (РАСХОДЫ) */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-rose-50/70 border-b border-rose-100">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span className="text-xs font-black uppercase tracking-wide text-rose-900">
                РАСХОДЫ ЗА СЕГОДНЯ
              </span>
              <span className="text-[10px] font-mono font-bold bg-white text-rose-700 px-1.5 py-0.2 rounded border border-rose-200">
                {expenseItems.length}
              </span>
            </div>
            <div className="text-xs font-black font-mono text-rose-600">
              -{rub(totalDayExpenses)}
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {expenseItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Нет расходов за выбранный день
              </div>
            ) : (
              expenseItems.map((item) => (
                <div key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <div className="p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black text-slate-800">{item.title}</span>
                        {item.rawTx && (
                          <button
                            onClick={() =>
                              setEditingTx({
                                id: item.rawTx!.id,
                                description: item.rawTx!.description || '',
                                amount: parseFloat(item.rawTx!.amount) || 0,
                                categoryId: item.rawTx!.category_id,
                                categoryName: item.rawTx!.category?.name,
                                direction: 'expense',
                              })
                            }
                            className="text-[9px] text-slate-400 hover:text-sky-600 p-0.5 rounded hover:bg-sky-50 transition cursor-pointer"
                            title="Редактировать название / категорию"
                          >
                            ✎ переименовать
                          </button>
                        )}
                        {item.isGroup && (
                          <button
                            onClick={() => toggleGroup(item.id)}
                            className="text-[9px] font-extrabold bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded hover:bg-rose-200 transition cursor-pointer"
                          >
                            {expandedGroups[item.id] ? '▲ Свернуть' : '▼ Раскрыть список'}
                          </button>
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
                        <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                          📂 {item.category}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded font-semibold ${
                            item.wallet === 'bank'
                              ? 'bg-sky-100 text-sky-800'
                              : item.wallet === 'cash'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.wallet === 'bank' ? '🏦' : item.wallet === 'cash' ? '🔒' : '⛽'}{' '}
                          {item.walletName}
                        </span>
                        <span>👤 {item.author}</span>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-black font-mono text-rose-600">
                        -{rub(item.amount)}
                      </div>
                    </div>
                  </div>

                  {/* Accordion Sub-items */}
                  {item.isGroup && expandedGroups[item.id] && item.subItems && (
                    <div className="bg-slate-50/90 border-t border-slate-200/60 p-2.5 space-y-1.5 pl-6">
                      <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                        ДЕТАЛИЗАЦИЯ СГРУППИРОВАННЫХ ОПЕРАЦИЙ:
                      </div>
                      {item.subItems.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between text-xs py-1 border-b border-slate-200/40 last:border-0"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-slate-400">{sub.time}</span>
                            <span className="font-semibold text-slate-700">{sub.title}</span>
                            <span className="text-[10px] text-slate-400">({sub.author})</span>
                            {sub.rawTx && (
                              <button
                                onClick={() =>
                                  setEditingTx({
                                    id: sub.rawTx!.id,
                                    description: sub.rawTx!.description || '',
                                    amount: parseFloat(sub.rawTx!.amount) || 0,
                                    categoryId: sub.rawTx!.category_id,
                                    categoryName: sub.rawTx!.category?.name,
                                    direction: 'expense',
                                  })
                                }
                                className="text-[8px] text-slate-400 hover:text-sky-600 cursor-pointer ml-1"
                              >
                                ✎
                              </button>
                            )}
                          </div>
                          <div className="font-mono font-bold text-rose-600">
                            -{rub(sub.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: INCOMES (ДОХОДЫ) */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-emerald-50/70 border-b border-emerald-100">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-black uppercase tracking-wide text-emerald-900">
                ДОХОДЫ ЗА СЕГОДНЯ
              </span>
              <span className="text-[10px] font-mono font-bold bg-white text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200">
                {incomeItems.length}
              </span>
            </div>
            <div className="text-xs font-black font-mono text-emerald-600">
              +{rub(totalDayIncomes)}
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {incomeItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Нет поступлений за выбранный день
              </div>
            ) : (
              incomeItems.map((item) => (
                <div key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <div className="p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black text-slate-800">{item.title}</span>
                        {item.rawTx && (
                          <button
                            onClick={() =>
                              setEditingTx({
                                id: item.rawTx!.id,
                                description: item.rawTx!.description || '',
                                amount: parseFloat(item.rawTx!.amount) || 0,
                                categoryId: item.rawTx!.category_id,
                                categoryName: item.rawTx!.category?.name,
                                direction: 'income',
                              })
                            }
                            className="text-[9px] text-slate-400 hover:text-sky-600 p-0.5 rounded hover:bg-sky-50 transition cursor-pointer"
                            title="Редактировать название / категорию"
                          >
                            ✎ переименовать
                          </button>
                        )}
                        {item.isGroup && (
                          <button
                            onClick={() => toggleGroup(item.id)}
                            className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded hover:bg-emerald-200 transition cursor-pointer"
                          >
                            {expandedGroups[item.id] ? '▲ Свернуть' : '▼ Раскрыть список'}
                          </button>
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
                        <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                          📂 {item.category}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded font-semibold ${
                            item.wallet === 'bank'
                              ? 'bg-sky-100 text-sky-800'
                              : item.wallet === 'cash'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.wallet === 'bank' ? '🏦' : item.wallet === 'cash' ? '🔒' : '⛽'}{' '}
                          {item.walletName}
                        </span>
                        <span>👤 {item.author}</span>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-black font-mono text-emerald-600">
                        +{rub(item.amount)}
                      </div>
                    </div>
                  </div>

                  {/* Accordion Sub-items */}
                  {item.isGroup && expandedGroups[item.id] && item.subItems && (
                    <div className="bg-slate-50/90 border-t border-slate-200/60 p-2.5 space-y-1.5 pl-6">
                      <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                        ДЕТАЛИЗАЦИЯ ПОСТУПЛЕНИЙ:
                      </div>
                      {item.subItems.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between text-xs py-1 border-b border-slate-200/40 last:border-0"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-slate-400">{sub.time}</span>
                            <span className="font-semibold text-slate-700">{sub.title}</span>
                            <span className="text-[10px] text-slate-400">({sub.author})</span>
                            {sub.rawTx && (
                              <button
                                onClick={() =>
                                  setEditingTx({
                                    id: sub.rawTx!.id,
                                    description: sub.rawTx!.description || '',
                                    amount: parseFloat(sub.rawTx!.amount) || 0,
                                    categoryId: sub.rawTx!.category_id,
                                    categoryName: sub.rawTx!.category?.name,
                                    direction: 'income',
                                  })
                                }
                                className="text-[8px] text-slate-400 hover:text-sky-600 cursor-pointer ml-1"
                              >
                                ✎
                              </button>
                            )}
                          </div>
                          <div className="font-mono font-bold text-emerald-600">
                            +{rub(sub.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── 7. BOTTOM EXACT WALLET SUMMARY (100% ФИНАНСОВЫЙ КОНТРОЛЬ) ── */}
      <div className="bg-slate-900 text-white rounded-xl p-3.5 border border-slate-800 shadow-md">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-sm">🎯</span>
            <span className="text-xs font-black uppercase tracking-wider text-slate-200">
              ИТОГОВЫЙ СУТОЧНЫЙ БАЛАНС ПО КОШЕЛЬКАМ (ИТОГО ЗА ДЕНЬ)
            </span>
          </div>
          <div className="text-xs font-mono font-black text-sky-400">
            ВСЕГО: {rub(eveningTotal)}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Bank */}
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300">🏦 Р/С Банк (АПИ):</span>
              <span className="text-xs font-black font-mono text-sky-400">
                {rub(bankWallet?.evening ?? 0)}
              </span>
            </div>
            <div className="text-[9px] text-slate-400 mt-1 flex justify-between">
              <span>С утра: {rub(bankWallet?.morning ?? 0)}</span>
              <span>
                {(bankWallet?.evening ?? 0) - (bankWallet?.morning ?? 0) >= 0 ? '+' : ''}
                {rub((bankWallet?.evening ?? 0) - (bankWallet?.morning ?? 0))}
              </span>
            </div>
          </div>

          {/* Cash Safe */}
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300">🔒 Сейф (Факт директор):</span>
              <span className="text-xs font-black font-mono text-emerald-400">
                {rub(cashWallet?.evening ?? 0)}
              </span>
            </div>
            <div className="text-[9px] text-slate-400 mt-1 flex justify-between">
              <span>С утра: {rub(cashWallet?.morning ?? 0)}</span>
              <span>
                {(cashWallet?.evening ?? 0) - (cashWallet?.morning ?? 0) >= 0 ? '+' : ''}
                {rub((cashWallet?.evening ?? 0) - (cashWallet?.morning ?? 0))}
              </span>
            </div>
          </div>

          {/* Fuel Card */}
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300">⛽ Топливная карта:</span>
              <span className="text-xs font-black font-mono text-amber-400">
                {rub(fuelWallet?.evening ?? 0)}
              </span>
            </div>
            <div className="text-[9px] text-slate-400 mt-1 flex justify-between">
              <span>С утра: {rub(fuelWallet?.morning ?? 0)}</span>
              <span>
                {(fuelWallet?.evening ?? 0) - (fuelWallet?.morning ?? 0) >= 0 ? '+' : ''}
                {rub((fuelWallet?.evening ?? 0) - (fuelWallet?.morning ?? 0))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 8. MODAL: EDIT TRANSACTION TITLE & CATEGORY ── */}
      {editingTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-base">✎</span>
                <span className="text-sm font-black uppercase text-slate-800">
                  Редактирование операции
                </span>
              </div>
              <button
                onClick={() => setEditingTx(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  Сумма операции
                </label>
                <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                  {rub(editingTx.amount)}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  Название транзакции (как отображать в таблице)
                </label>
                <input
                  type="text"
                  value={editingTx.description}
                  onChange={(e) => setEditingTx({ ...editingTx, description: e.target.value })}
                  placeholder="Например: Возмещение эквайринга за 12.10"
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  Категория
                </label>
                <select
                  value={editingTx.categoryId || ''}
                  onChange={(e) =>
                    setEditingTx({ ...editingTx, categoryId: e.target.value || null })
                  }
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                >
                  <option value="">(Без категории)</option>
                  {(data?.categories ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setEditingTx(null)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Отмена
              </button>
              <button
                disabled={updateTxMutation.isPending}
                onClick={() =>
                  updateTxMutation.mutate({
                    id: editingTx.id,
                    description: editingTx.description,
                    categoryId: editingTx.categoryId,
                  })
                }
                className="px-4 py-1.5 text-xs font-black bg-sky-500 hover:bg-sky-600 text-white rounded-lg shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                {updateTxMutation.isPending ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 9. MODAL: DIRECTOR AUDIT AT 19:30 (СЕЙФ И БАЛАНСЫ) ── */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔒</span>
                <div>
                  <div className="text-sm font-black uppercase text-slate-900">
                    Вечерний аудит кассы (19:30)
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Дата контроля: {formatDayHeader(selectedDate)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-xs text-amber-900">
                Директор лично проверяет наличные деньги в сейфе. Банк сверяется по API Т-Банка
                автоматически, а топливные карты — по чекам.
              </div>

              {/* Expected vs Actual Safe Cash */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[9px] font-black uppercase text-slate-400">
                    Расчётный сейф (по учету)
                  </div>
                  <div className="text-base font-black font-mono text-slate-800 mt-1">
                    {rub(cashWallet?.evening ?? 0)}
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase text-slate-500">
                    Фактически в сейфе (рубли) *
                  </label>
                  <input
                    type="number"
                    value={auditForm.actualCash}
                    onChange={(e) => setAuditForm({ ...auditForm, actualCash: e.target.value })}
                    placeholder="Например: 145000"
                    className="w-full mt-1 px-3 py-2.5 text-sm font-bold font-mono border-2 border-emerald-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
              </div>

              {/* Discrepancy indicator */}
              {auditForm.actualCash !== '' && (
                <div
                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between font-mono ${
                    Math.abs((parseFloat(auditForm.actualCash) || 0) - (cashWallet?.evening ?? 0)) <
                    0.01
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                      : 'bg-rose-50 border-rose-300 text-rose-800 font-bold'
                  }`}
                >
                  <span>Расхождение сейфа:</span>
                  <span>
                    {rub((parseFloat(auditForm.actualCash) || 0) - (cashWallet?.evening ?? 0))}
                  </span>
                </div>
              )}

              {/* Balances to record */}
              <div className="text-[10px] text-slate-500 space-y-1 pt-1">
                <div className="flex justify-between">
                  <span>Фиксация Р/С Банк:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {rub(bankWallet?.evening ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Фиксация Топливной карты:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {rub(fuelWallet?.evening ?? 0)}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black uppercase text-slate-500">
                  Кто утвердил
                </label>
                <input
                  type="text"
                  value={auditForm.audited_by}
                  onChange={(e) => setAuditForm({ ...auditForm, audited_by: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>

              <div>
                <label className="text-[9px] font-black uppercase text-slate-500">
                  Комментарий (если есть расхождения или замечания)
                </label>
                <textarea
                  rows={2}
                  value={auditForm.notes}
                  onChange={(e) => setAuditForm({ ...auditForm, notes: e.target.value })}
                  placeholder="Всё сходится копейка в копейку"
                  className="w-full mt-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Отмена
              </button>
              <button
                disabled={auditMutation.isPending || auditForm.actualCash === ''}
                onClick={() =>
                  auditMutation.mutate({
                    date: selectedDate,
                    safe_cash_actual: parseFloat(auditForm.actualCash) || 0,
                    safe_cash_expected: cashWallet?.evening ?? 0,
                    bank_balance: bankWallet?.evening ?? 0,
                    fuel_card_balance: fuelWallet?.evening ?? 0,
                    audited_by: auditForm.audited_by,
                    notes: auditForm.notes,
                  })
                }
                className="px-4 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                {auditMutation.isPending ? 'Запись...' : 'Утвердить и отправить директору ✓'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
