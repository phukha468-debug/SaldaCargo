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
  trip_order_id?: string | null;
  trip_id?: string | null;
  idempotency_key?: string | null;
  category: { id: string; name: string; code: string } | null;
  counterparty: { id: string; name: string } | null;
  related_user: { id: string; name: string } | null;
}

interface TripOrderTx {
  id: string;
  trip_id?: string;
  amount: string;
  created_at: string;
  payment_method: string;
  description: string | null;
  settlement_status?: string;
  lifecycle_status?: string;
  counterparty: { id: string; name: string } | null;
  trip: {
    id?: string;
    trip_number: number;
    driver_id?: string;
    driver: { id?: string; name: string } | null;
  } | null;
}

interface CashCollectionTx {
  id: string;
  amount: string;
  created_at: string;
  note: string | null;
  driver: { name: string } | null;
}

interface TBankOp {
  operationId: string;
  operationDate: string;
  operationTime?: string;
  typeOfOperation: 'Credit' | 'Debit' | string;
  operationAmount: number;
  rubleAmount?: number;
  description: string;
  payPurpose?: string;
  category?: string;
  documentNumber?: string;
  payer?: { name?: string; inn?: string; acct?: string };
  receiver?: { name?: string; inn?: string; acct?: string };
  counterParty?: { name?: string; inn?: string; account?: string };
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
  bank_operations?: TBankOp[];
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
  const { data, isFetching, refetch } = useQuery<DailyBalanceData>({
    queryKey: ['daily-balance', selectedDate],
    queryFn: () => fetch(`/api/finance/daily-balance?date=${selectedDate}`).then((r) => r.json()),
    staleTime: 30 * 1000,
    refetchInterval: selectedDate === todayStr ? 60 * 1000 : false,
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

  // Link Bank Op to Trip Order Mutation
  const [linkingBankOp, setLinkingBankOp] = useState<TBankOp | null>(null);
  const [selectedOrderIdToLink, setSelectedOrderIdToLink] = useState<string>('');

  const linkBankOpMutation = useMutation({
    mutationFn: async ({
      operationId,
      tripOrderId,
      amount,
      action,
    }: {
      operationId: string;
      tripOrderId?: string;
      amount?: number;
      action?: 'link' | 'unlink';
    }) => {
      const res = await fetch('/api/finance/link-bank-op', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationId,
          tripOrderId,
          amount,
          action,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка привязки операции');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-balance', selectedDate] });
      setLinkingBankOp(null);
      setSelectedOrderIdToLink('');
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
    bankOp?: TBankOp;
    isLinked?: boolean;
    linkedTripNumber?: string | number;
    linkedDriverName?: string;
    canLinkToTrip?: boolean;
    suggestedOrder?: TripOrderTx;
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

  // 1. Поступления на Р/С БАНК:
  // Если пришли прямые операции по API Т-Банка, отображаем их в Р/С (Credit)
  const bankOps = data?.bank_operations ?? [];
  const creditBankOps = bankOps.filter((op) => op.typeOfOperation === 'Credit');

  if (activeWallet === 'all' || activeWallet === 'bank') {
    if (creditBankOps.length > 0) {
      creditBankOps.forEach((op) => {
        const payerName = op.payer?.name || op.counterParty?.name || 'Поступление на Р/С';
        const descLower = (op.description || op.payPurpose || '').toLowerCase();
        const isSbpOrQr =
          descLower.includes('сбп') ||
          descLower.includes('терминал') ||
          descLower.includes('qr') ||
          op.category === 'acquiring';

        // Ищем существующую связь с рейсом в transactions
        const linkedTx = (data?.transactions ?? []).find(
          (t) => t.idempotency_key === op.operationId,
        );

        let title = op.description || op.payPurpose || 'Входящий перевод на Р/С';
        let author = payerName;
        let isLinked = false;
        let linkedTripNumber: string | number | undefined;
        let linkedDriverName: string | undefined;

        if (linkedTx) {
          isLinked = true;
          linkedDriverName = linkedTx.related_user?.name;
          const matchNum = linkedTx.description?.match(/Рейс №(\d+)/);
          linkedTripNumber = matchNum ? matchNum[1] : undefined;
          author = linkedDriverName ? `вод. ${linkedDriverName}` : payerName;
          title = linkedTx.description || title;
        }

        // Подбор подходящего сегодняшнего заказа с совпадающей суммой
        const opAmt = op.operationAmount || op.rubleAmount || 0;
        const matchingOrder =
          !isLinked && isSbpOrQr
            ? (data?.trip_orders ?? []).find(
                (o) =>
                  parseFloat(o.amount) === opAmt &&
                  o.payment_method === 'qr' &&
                  !(data?.transactions ?? []).some((t) => t.trip_order_id === o.id),
              )
            : undefined;

        incomeItems.push({
          id: `tbank-${op.operationId}`,
          title,
          category: isSbpOrQr ? 'Эквайринг / СБП' : 'Поступления на Р/С',
          wallet: 'bank',
          walletName: 'Р/С Банк (API)',
          author,
          amount: opAmt,
          bankOp: op,
          isLinked,
          linkedTripNumber,
          linkedDriverName,
          canLinkToTrip: isSbpOrQr,
          suggestedOrder: matchingOrder,
        });
      });
    } else {
      // Резервный источник по заказам, если API выписки пуст
      (data?.trip_orders ?? []).forEach((order) => {
        const client = order.counterparty?.name || order.description || 'Оплата счёта / QR';
        const driver = order.trip?.driver?.name ? `вод. ${order.trip.driver.name}` : 'Рейс';
        incomeItems.push({
          id: `trip-${order.id}`,
          title: `Оплата рейса · ${client}`,
          category: 'Оплата по счёту / QR',
          wallet: 'bank',
          walletName: 'Р/С Банк',
          author: driver,
          amount: parseFloat(order.amount) || 0,
        });
      });
    }
  }

  // 2. Поступления в СЕЙФ (НАЛИЧНЫЕ):
  // Только факт сдачи наличных: инкассация водителей за смену либо погашение долга клиентом наличными
  if (activeWallet === 'all' || activeWallet === 'cash') {
    (data?.cash_collections ?? []).forEach((col) => {
      incomeItems.push({
        id: `cash-${col.id}`,
        title: `Инкассация с рейса${col.note ? ` (${col.note})` : ''}`,
        category: 'Наличные со смены',
        wallet: 'cash',
        walletName: 'Сейф (нал)',
        author: col.driver?.name || 'Водитель',
        amount: parseFloat(col.amount) || 0,
      });
    });
  }

  // 3. Ручные транзакции поступлений (погашение дебиторки наличными в сейф)
  const rawIncomeTxs = (data?.transactions ?? []).filter(
    (t) => t.direction === 'income' && txMatchesWallet(t),
  );

  // Group acquiring reimbursements if multiple (только если не подтянуты из API банка)
  const acquiringTxs: RawTx[] = [];
  rawIncomeTxs.forEach((tx) => {
    const desc = (tx.description || '').toLowerCase();
    const cat = (tx.category?.name || '').toLowerCase();

    // Исключаем технические фиктивные корректировки остатка
    if (desc.includes('корректировка остатка') || desc.includes('корректировка баланса')) {
      return;
    }

    if (creditBankOps.length > 0 && tx.to_wallet_id === BANK_ID) {
      // Если есть банковская выписка, не дублируем банковские поступления
      return;
    }

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
        title: tx.description || 'Погашение задолженности (нал)',
        category: tx.category?.name || 'Поступление в сейф',
        wallet: w,
        walletName: wName,
        author: tx.counterparty?.name || tx.related_user?.name || 'Администратор',
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

    // Исключаем технические фиктивные корректировки остатка
    if (desc.includes('корректировка остатка') || desc.includes('корректировка баланса')) {
      return;
    }

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

  // Live Bank Debit operations (Commissions, Outgoing payments) from T-Bank API
  if (data?.bank_operations && data.bank_operations.length > 0) {
    const debitBankOps = data.bank_operations.filter(
      (op) => op.typeOfOperation === 'Debit' && (activeWallet === 'all' || activeWallet === 'bank'),
    );

    const apiBankCommissions: TBankOp[] = [];
    const apiBankOtherDebits: TBankOp[] = [];

    debitBankOps.forEach((op) => {
      const desc = (op.description || op.payPurpose || '').toLowerCase();
      if (
        desc.includes('комисси') ||
        desc.includes('плата за') ||
        desc.includes('тариф') ||
        op.category === 'commission'
      ) {
        apiBankCommissions.push(op);
      } else {
        apiBankOtherDebits.push(op);
      }
    });

    if (apiBankCommissions.length > 0) {
      if (apiBankCommissions.length === 1 && apiBankCommissions[0]) {
        const op = apiBankCommissions[0];
        expenseItems.push({
          id: `tbank-deb-${op.operationId}`,
          title: op.description || op.payPurpose || 'Комиссия банка',
          category: 'Банковские услуги (API)',
          wallet: 'bank',
          walletName: 'Р/С Банк',
          author: 'Т-Банк (Авто)',
          amount: op.operationAmount || op.rubleAmount || 0,
        });
      } else {
        const totalComm = apiBankCommissions.reduce(
          (s, op) => s + (op.operationAmount || op.rubleAmount || 0),
          0,
        );
        expenseItems.push({
          id: 'group-api-bank-commission',
          title: `Комиссии банка за операции (${apiBankCommissions.length} списаний)`,
          category: 'Банковские услуги (API)',
          wallet: 'bank',
          walletName: 'Р/С Банк',
          author: 'Т-Банк (Авто)',
          amount: totalComm,
          isGroup: true,
          subItems: apiBankCommissions.map((op) => {
            const dateVal = op.operationDate || op.operationTime;
            return {
              id: `tbank-deb-${op.operationId}`,
              title: op.description || op.payPurpose || 'Комиссия за операцию',
              author: 'Т-Банк',
              amount: op.operationAmount || op.rubleAmount || 0,
              time: dateVal
                ? new Date(dateVal).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—',
            };
          }),
        });
      }
    }

    apiBankOtherDebits.forEach((op) => {
      const receiverName = op.receiver?.name || op.counterParty?.name || 'Контрагент';
      expenseItems.push({
        id: `tbank-deb-${op.operationId}`,
        title: op.description || op.payPurpose || `Списание с Р/С · ${receiverName}`,
        category: 'Списание с Р/С (API)',
        wallet: 'bank',
        walletName: 'Р/С Банк',
        author: receiverName,
        amount: op.operationAmount || op.rubleAmount || 0,
      });
    });
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
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1 text-[10px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded transition cursor-pointer border border-slate-700/80 disabled:opacity-50"
              title="Запросить свежую выписку из Т-Банка прямо сейчас"
            >
              <span className={`text-[9px] ${isFetching ? 'animate-spin inline-block' : ''}`}>
                🔄
              </span>
              <span>{isFetching ? 'Синхронизация...' : 'Обновить'}</span>
            </button>
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

      {/* ── 4. TOP SUMMARY CARDS (Proportionally 2x smaller) ── */}
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

          {/* QR / SBP RECONCILIATION SUMMARY BANNER */}
          {(() => {
            const qrOrders = (data?.trip_orders ?? []).filter((o) => o.payment_method === 'qr');
            if (qrOrders.length === 0) return null;

            const qrCompleted = qrOrders.filter(
              (o) =>
                (data?.transactions ?? []).some((t) => t.trip_order_id === o.id) ||
                o.settlement_status === 'completed',
            );
            const qrPending = qrOrders.filter((o) => !qrCompleted.some((c) => c.id === o.id));
            const totalQrAmt = qrOrders.reduce((s, o) => s + parseFloat(o.amount || '0'), 0);
            const pendingAmt = qrPending.reduce((s, o) => s + parseFloat(o.amount || '0'), 0);

            return (
              <div className="p-2.5 bg-slate-900 text-slate-200 border-b border-slate-800 text-xs flex flex-col gap-1.5">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">📱</span>
                    <span className="font-black text-slate-100 uppercase tracking-wide text-[10px]">
                      Сверка QR-кодов от водителей
                    </span>
                    <span className="text-[9px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded">
                      Всего: {qrOrders.length} ({rub(totalQrAmt)})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono">
                    <span className="text-emerald-400 font-bold">
                      ✓ В банке: {qrCompleted.length}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded font-black ${
                        qrPending.length > 0
                          ? 'bg-rose-500 text-white animate-pulse'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      {qrPending.length > 0
                        ? `⚠️ НЕ ДОШЛО: ${qrPending.length} (${rub(pendingAmt)})`
                        : 'Все оплачены ✓'}
                    </span>
                  </div>
                </div>

                {qrPending.length > 0 && (
                  <div className="bg-rose-950/70 border border-rose-800/80 rounded-lg p-2 text-[10px] space-y-1">
                    <div className="text-[9px] font-black uppercase tracking-wider text-rose-300 flex items-center justify-between">
                      <span>Заказы с QR, по которым оплата ещё НЕ поступила:</span>
                      <span className="text-rose-400">Требуется проверка водителей</span>
                    </div>
                    {qrPending.map((o) => (
                      <div
                        key={o.id}
                        className="flex items-center justify-between text-rose-200 py-0.5 border-b border-rose-900/40 last:border-0"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                          <span className="font-bold">
                            {o.trip?.trip_number ? `Рейс №${o.trip.trip_number}` : 'Рейс'}
                          </span>
                          <span className="text-rose-300 font-medium">
                            ({o.trip?.driver?.name || 'Водитель'})
                          </span>
                          {o.counterparty?.name && (
                            <span className="text-[9px] text-rose-400">
                              · {o.counterparty.name}
                            </span>
                          )}
                        </div>
                        <span className="font-mono font-black text-rose-200">
                          {rub(parseFloat(o.amount || '0'))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

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

                        {/* Связка с рейсом для банковских операций СБП */}
                        {item.bankOp &&
                          item.canLinkToTrip &&
                          (item.isLinked ? (
                            <div className="flex items-center gap-1">
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded border border-emerald-300">
                                <span>
                                  ✓{' '}
                                  {item.linkedTripNumber
                                    ? `Рейс №${item.linkedTripNumber}`
                                    : 'Рейс'}
                                </span>
                                {item.linkedDriverName && <span>({item.linkedDriverName})</span>}
                              </span>
                              <button
                                onClick={() =>
                                  linkBankOpMutation.mutate({
                                    operationId: item.bankOp!.operationId,
                                    action: 'unlink',
                                  })
                                }
                                disabled={linkBankOpMutation.isPending}
                                className="text-[9px] text-slate-400 hover:text-rose-600 underline cursor-pointer"
                                title="Отвязать операцию от рейса"
                              >
                                отвязать ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                onClick={() => {
                                  setLinkingBankOp(item.bankOp!);
                                  if (item.suggestedOrder) {
                                    setSelectedOrderIdToLink(item.suggestedOrder.id);
                                  } else {
                                    setSelectedOrderIdToLink('');
                                  }
                                }}
                                className="inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded shadow-xs transition cursor-pointer animate-pulse"
                                title="Связать платёж с водителем и рейсом"
                              >
                                <span>🔗</span>
                                <span>Привязать к рейсу</span>
                              </button>

                              {item.suggestedOrder && (
                                <button
                                  onClick={() =>
                                    linkBankOpMutation.mutate({
                                      operationId: item.bankOp!.operationId,
                                      tripOrderId: item.suggestedOrder!.id,
                                      amount: item.amount,
                                      action: 'link',
                                    })
                                  }
                                  disabled={linkBankOpMutation.isPending}
                                  className="text-[9px] text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-1.5 py-0.5 rounded font-black cursor-pointer transition"
                                  title="Быстро связать с совпадающим заказом"
                                >
                                  ⚡ Совпадает: Рейс №{item.suggestedOrder.trip?.trip_number} (
                                  {item.suggestedOrder.trip?.driver?.name})
                                </button>
                              )}
                            </div>
                          ))}
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

      {/* ── MODAL: LINK BANK OPERATION TO TRIP ORDER ── */}
      {linkingBankOp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-1.5">
                  <span>🔗</span> Привязка оплаты СБП / QR к рейсу
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Выберите рейс и водителя, который выполнил этот заказ
                </p>
              </div>
              <button
                onClick={() => setLinkingBankOp(null)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Op Details Card */}
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3">
                <div className="text-[10px] uppercase font-black text-sky-800">
                  Банковское поступление (Т-Банк API):
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="font-bold text-slate-800 text-sm">
                    {rub(linkingBankOp.operationAmount || linkingBankOp.rubleAmount || 0)}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {linkingBankOp.operationDate
                      ? new Date(linkingBankOp.operationDate).toLocaleTimeString('ru-RU', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                  </div>
                </div>
                <div className="text-[11px] text-slate-600 mt-1">
                  {linkingBankOp.description || linkingBankOp.payPurpose}
                </div>
              </div>

              {/* Trip Selection */}
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-700 mb-1.5">
                  Выберите заказ рейса водителя за сегодня:
                </label>

                {(() => {
                  const todayOrders = data?.trip_orders ?? [];
                  const opAmt = linkingBankOp.operationAmount || linkingBankOp.rubleAmount || 0;

                  if (todayOrders.length === 0) {
                    return (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center text-slate-500">
                        Сегодня ещё не создано заказов рейсов.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {todayOrders.map((order) => {
                        const isMatchAmt = parseFloat(order.amount) === opAmt;
                        const isSelected = selectedOrderIdToLink === order.id;

                        return (
                          <div
                            key={order.id}
                            onClick={() => setSelectedOrderIdToLink(order.id)}
                            className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'bg-sky-50 border-2 border-sky-500 ring-2 ring-sky-200'
                                : isMatchAmt
                                  ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                checked={isSelected}
                                onChange={() => setSelectedOrderIdToLink(order.id)}
                                className="cursor-pointer"
                              />
                              <div>
                                <div className="font-black text-slate-900 flex items-center gap-1.5">
                                  <span>
                                    {order.trip?.trip_number
                                      ? `Рейс №${order.trip.trip_number}`
                                      : 'Рейс'}
                                  </span>
                                  <span className="text-slate-500 font-normal">
                                    · {order.trip?.driver?.name || 'Водитель'}
                                  </span>
                                  {isMatchAmt && (
                                    <span className="text-[9px] font-black bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded shadow-2xs">
                                      ⭐ Совпадает сумма
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                  <span>
                                    Тип:{' '}
                                    {order.payment_method === 'qr'
                                      ? '📱 QR-код'
                                      : order.payment_method === 'cash'
                                        ? '💵 Наличные'
                                        : order.payment_method}
                                  </span>
                                  {order.counterparty?.name && (
                                    <span>Клиент: {order.counterparty.name}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="font-mono font-black text-slate-900 text-xs">
                                {rub(parseFloat(order.amount))}
                              </div>
                              <div className="text-[9px] text-slate-400">
                                {order.settlement_status === 'completed'
                                  ? '✓ Оплачен'
                                  : '⏳ Ожидает'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setLinkingBankOp(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  disabled={!selectedOrderIdToLink || linkBankOpMutation.isPending}
                  onClick={() =>
                    linkBankOpMutation.mutate({
                      operationId: linkingBankOp.operationId,
                      tripOrderId: selectedOrderIdToLink,
                      amount: linkingBankOp.operationAmount || linkingBankOp.rubleAmount || 0,
                      action: 'link',
                    })
                  }
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {linkBankOpMutation.isPending ? 'Связывание...' : '✓ Связать платёж с рейсом'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
