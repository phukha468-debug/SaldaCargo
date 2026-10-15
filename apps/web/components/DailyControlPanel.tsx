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

function cleanExpenseDescription(rawText: string | null | undefined): string {
  if (!rawText) return 'Расход';
  let t = rawText.trim();
  t = t.replace(/[,.]?\s*НДС\s*(не\s*облагается|исчислен|включен)?/gi, '');
  t = t.replace(/[,.]?\s*В\s*том\s*числе\s*НДС[^\n.,]*/gi, '');
  t = t.replace(/[,.]?\s*без\s*налога\s*\(?НДС\)?/gi, '');
  if (/перевод\s+собственных\s+средств/i.test(t)) {
    return 'Перевод собственных средств';
  }
  if (/комиссия\s+банка|плата\s+за\s+обслуживание|за\s+входящий\s+перевод/i.test(t)) {
    return 'Комиссия банка';
  }
  t = t.replace(/\s*р\/с\s*\d+/gi, '');
  t = t.replace(/\s*счет\s*№?\s*\d+/gi, '');
  t = t.replace(/\s*ИНН\s*\d+/gi, '');
  t = t.replace(/\s*БИК\s*\d+/gi, '');
  t = t.replace(/\s{2,}/g, ' ').trim();
  return t || 'Расход';
}

function resolveExpenseCategory(title: string, rawCatName?: string | null): string {
  if (
    rawCatName &&
    rawCatName !== 'Прочие расходы' &&
    rawCatName !== 'Списание с Р/С (API)' &&
    rawCatName !== 'Расход'
  ) {
    return rawCatName;
  }
  const s = (title || '').toLowerCase();
  if (/гсм|топлив|бензин|газ|азс|лукойл|газпром/i.test(s)) return 'ГСМ / Топливо';
  if (/комисси|плата\s*за|тариф|обслуживан/i.test(s)) return 'Комиссия банка';
  if (/перевод\s*собственн|между\s*счетами/i.test(s)) return 'Перевод между кошельками';
  if (/зарплат|фот|аванс|оплат.*труд|подотчет/i.test(s)) return 'ФОТ / Зарплата';
  if (/кредит|лизинг|процент|заем/i.test(s)) return 'Кредит / Лизинг';
  if (/запчаст|ремонт|сервис|сто|шино|масло|фильтр/i.test(s)) return 'Запчасти / ТО';
  if (/налог|енс|фнс|страхов.*взнос/i.test(s)) return 'Налоги';
  if (/аренда|офис|связь|интернет/i.test(s)) return 'Аренда и связь';
  return 'Прочий расход';
}

const BANK_ID = '10000000-0000-0000-0000-000000000001';
const CASH_ID = '10000000-0000-0000-0000-000000000002';
const FUEL_CARD_ID = '10000000-0000-0000-0000-000000000004';

type WalletFilter = 'all' | 'bank' | 'cash' | 'fuel_card';

interface CategoryItem {
  id: string;
  name: string;
  code: string;
}

interface RawTx {
  id: string;
  amount: string;
  direction: 'income' | 'expense' | 'transfer' | string;
  description: string | null;
  created_at: string;
  transaction_date?: string | null;
  from_wallet_id: string | null;
  to_wallet_id: string | null;
  category_id?: string | null;
  counterparty_id?: string | null;
  related_user_id?: string | null;
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
  calendar_overrides?: Array<{
    id: string;
    period: string;
    obligation_id: string;
    paid_amount: number | null;
    paid_at: string | null;
    custom_title?: string | null;
    custom_notes?: string | null;
  }>;
}

export function DailyControlPanel() {
  const queryClient = useQueryClient();
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [activeWallet, setActiveWallet] = useState<WalletFilter>('all');

  // Accordion state for grouped rows (key -> boolean)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Query Payment Calendar obligations for auto-linking
  const selectedPeriod = selectedDate.slice(0, 7);
  const { data: calendarData } = useQuery<{
    items?: Array<{ id: string; title: string; amount: number; due_day: number; status: string }>;
  }>({
    queryKey: ['payment-calendar-items', selectedPeriod],
    queryFn: () => fetch(`/api/payment-calendar?period=${selectedPeriod}`).then((r) => r.json()),
    staleTime: 60 * 1000,
  });

  // Edit transaction modal state
  const [editingTx, setEditingTx] = useState<{
    id: string;
    description: string;
    amount: number;
    categoryId?: string | null;
    categoryName?: string;
    direction: 'income' | 'expense' | 'transfer';
    toWalletId?: string | null;
    fromWalletId?: string | null;
    obligationId?: string | null;
    transactionDate?: string;
    relatedUserId?: string | null;
  } | null>(null);

  // Director Audit Modal state
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditForm, setAuditForm] = useState({
    audited_by: 'Директор',
    actualCash: '',
    actualFuel: '',
    notes: '',
  });

  // Fetch daily balance data
  const { data, isFetching, refetch } = useQuery<DailyBalanceData>({
    queryKey: ['daily-balance', selectedDate],
    queryFn: () => fetch(`/api/finance/daily-balance?date=${selectedDate}`).then((r) => r.json()),
    staleTime: 30 * 1000,
    refetchInterval: selectedDate === todayStr ? 60 * 1000 : false,
  });

  // Fetch active users / staff for linking advances and debt without duplicating
  const { data: usersData } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['users-list'],
    queryFn: () => fetch('/api/users').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  // Mutations
  const categorizeMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      description: string;
      category_id?: string | null;
      amount?: number;
      direction?: string;
      to_wallet_id?: string | null;
      from_wallet_id?: string | null;
      transaction_date?: string;
      obligation_id?: string | null;
      related_user_id?: string | null;
    }) => {
      const res = await fetch('/api/finance/categorize-op', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
      queryClient.invalidateQueries({ queryKey: ['payment-calendar-items'] });
      queryClient.invalidateQueries({ queryKey: ['payment-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['staff-payroll'] });
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

  // Manual Operation Modal state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualType, setManualType] = useState<'expense' | 'income'>('expense');
  const [manualAmount, setManualAmount] = useState('');
  const [manualWallet, setManualWallet] = useState<'safe' | 'bank' | 'fuel'>('safe');
  const [manualCategoryId, setManualCategoryId] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualObligationId, setManualObligationId] = useState('');
  const [manualTripOrderId, setManualTripOrderId] = useState('');

  function openManualModal(type: 'expense' | 'income') {
    setManualType(type);
    setManualAmount('');
    setManualDescription('');
    setManualCategoryId('');
    setManualWallet(type === 'expense' ? 'safe' : 'bank');
    setManualObligationId('');
    setManualTripOrderId('');
    setIsManualModalOpen(true);
  }

  const createManualMutation = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(manualAmount);
      if (isNaN(amt) || amt <= 0) throw new Error('Укажите корректную сумму');
      if (!manualDescription.trim()) throw new Error('Укажите описание операции');

      let fromW: string | null = null;
      let toW: string | null = null;

      if (manualType === 'expense') {
        fromW =
          manualWallet === 'safe' ? CASH_ID : manualWallet === 'fuel' ? FUEL_CARD_ID : BANK_ID;
      } else {
        toW = manualWallet === 'safe' ? CASH_ID : BANK_ID;
      }

      const payload = {
        id: crypto.randomUUID(),
        direction: manualType,
        amount: amt,
        description: manualDescription.trim(),
        category_id: manualCategoryId || null,
        from_wallet_id: fromW,
        to_wallet_id: toW,
        transaction_date: `${selectedDate}T12:00:00.000Z`,
        obligation_id: manualObligationId || null,
        trip_order_id: manualTripOrderId || null,
      };

      const res = await fetch('/api/finance/categorize-op', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка при сохранении операции');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-balance', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['finance-month'] });
      queryClient.invalidateQueries({ queryKey: ['payment-calendar-items'] });
      queryClient.invalidateQueries({ queryKey: ['payment-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      setIsManualModalOpen(false);
    },
  });

  // Link Bank Op (Trip / STO / Dispatcher) Mutation
  const [linkingBankOp, setLinkingBankOp] = useState<TBankOp | null>(null);
  const [selectedOrderIdToLink, setSelectedOrderIdToLink] = useState<string>('');
  const [linkMode, setLinkMode] = useState<'trip' | 'sto' | 'dispatcher'>('trip');
  const [stoOrderNumber, setStoOrderNumber] = useState('');
  const [stoClientName, setStoClientName] = useState('');
  const [dispatcherDetails, setDispatcherDetails] = useState('');
  const [dispatcherClientName, setDispatcherClientName] = useState('');

  // Trip link modal search and filters
  const [linkOrderSearch, setLinkOrderSearch] = useState('');
  const [linkOrderPeriod, setLinkOrderPeriod] = useState<
    'smart' | 'today' | 'yesterday' | '7days' | 'custom'
  >('smart');
  const [linkOrderCustomDate, setLinkOrderCustomDate] = useState('');

  // Query linkable trip orders across dates and with smart scoring
  const { data: linkableOrdersData, isLoading: isLoadingLinkableOrders } = useQuery<{
    extractedDate?: string | null;
    orders: Array<{
      id: string;
      trip_id: string;
      amount: string | number;
      payment_method: string;
      settlement_status: string;
      lifecycle_status: string;
      description?: string | null;
      created_at: string;
      trip_date?: string;
      order_amount?: number;
      is_match_amount?: boolean;
      is_match_date?: boolean;
      is_match_client?: boolean;
      is_already_linked?: boolean;
      score?: number;
      counterparty?: { id: string; name: string; inn?: string; contact_person?: string } | null;
      trip?: {
        id: string;
        trip_number: number;
        started_at: string;
        created_at: string;
        driver?: { id: string; name: string } | null;
      } | null;
    }>;
  }>({
    queryKey: [
      'linkable-orders',
      linkingBankOp?.operationId,
      linkOrderSearch,
      linkOrderPeriod,
      linkOrderCustomDate,
    ],
    queryFn: async () => {
      if (!linkingBankOp) return { orders: [] };
      const amt = linkingBankOp.operationAmount || linkingBankOp.rubleAmount || 0;
      const desc = linkingBankOp.description || linkingBankOp.payPurpose || '';
      const opDate = linkingBankOp.operationDate || '';

      const params = new URLSearchParams();
      params.set('targetAmount', String(amt));
      params.set('targetDesc', desc);
      params.set('operationDate', opDate);
      if (linkOrderSearch) params.set('search', linkOrderSearch);

      if (linkOrderPeriod === 'custom' && linkOrderCustomDate) {
        params.set('date', linkOrderCustomDate);
      } else if (linkOrderPeriod === 'today') {
        params.set('date', todayStr);
      } else if (linkOrderPeriod === 'yesterday') {
        params.set('date', yesterdayStr);
      } else if (linkOrderPeriod === '7days') {
        params.set('days', '7');
      } else {
        // 'smart' (default): checks last 14 days and scores matches
        params.set('days', '14');
      }

      const res = await fetch(`/api/finance/linkable-orders?${params.toString()}`);
      if (!res.ok) throw new Error('Ошибка загрузки рейсов');
      return res.json();
    },
    enabled: !!linkingBankOp && linkMode === 'trip',
  });

  // Auto-select the best matching order when linkableOrdersData loads
  React.useEffect(() => {
    if (!linkingBankOp || linkMode !== 'trip') return;
    const orders = linkableOrdersData?.orders ?? [];
    if (orders.length > 0 && !selectedOrderIdToLink) {
      const best =
        orders.find((o) => !o.is_already_linked && (o.is_match_amount || o.is_match_date)) ||
        orders[0];
      if (best) {
        setSelectedOrderIdToLink(best.id);
      }
    }
  }, [linkableOrdersData, linkingBankOp, linkMode, selectedOrderIdToLink]);

  const linkBankOpMutation = useMutation({
    mutationFn: async ({
      operationId,
      tripOrderId,
      amount,
      action,
      operationDate,
      date,
      linkType = 'trip',
      serviceOrderId,
      dispatcherDetails: dispDetails,
      clientName,
    }: {
      operationId: string;
      tripOrderId?: string;
      amount?: number;
      action?: 'link' | 'unlink';
      operationDate?: string;
      date?: string;
      linkType?: 'trip' | 'service_order' | 'dispatcher';
      serviceOrderId?: string;
      dispatcherDetails?: string;
      clientName?: string;
    }) => {
      const res = await fetch('/api/finance/link-bank-op', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationId,
          tripOrderId,
          amount,
          action,
          operationDate,
          date,
          linkType,
          serviceOrderId,
          dispatcherDetails: dispDetails,
          clientName,
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
      queryClient.invalidateQueries({ queryKey: ['linkable-orders'] });
      setLinkingBankOp(null);
      setSelectedOrderIdToLink('');
      setLinkOrderSearch('');
      setLinkOrderPeriod('smart');
      setLinkOrderCustomDate('');
      setStoOrderNumber('');
      setStoClientName('');
      setDispatcherDetails('');
      setDispatcherClientName('');
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
    linkTypeLabel?: string;
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
          (t) =>
            t.idempotency_key === op.operationId ||
            (op.operationId && t.idempotency_key?.includes(op.operationId)),
        );

        let title = op.description || op.payPurpose || 'Входящий перевод на Р/С';
        let author = payerName;
        let isLinked = false;
        let linkTypeLabel = '';
        let linkedTripNumber: string | number | undefined;
        let linkedDriverName: string | undefined;

        if (linkedTx) {
          isLinked = true;
          const desc = linkedTx.description || '';
          if (desc.includes('Заказ-наряд')) {
            linkTypeLabel = desc.replace(/^Оплата\s*/, '').trim();
          } else if (desc.includes('Диспетчерский')) {
            linkTypeLabel = desc.replace(/^Оплата\s*/, '').trim();
          } else {
            const linkedOrder = (data?.trip_orders ?? []).find(
              (o) => o.id === linkedTx.trip_order_id,
            );
            const matchNum = linkedTx.description?.match(/Рейс №(\d+)/);
            linkedTripNumber =
              linkedOrder?.trip?.trip_number || (matchNum ? matchNum[1] : undefined);
            const matchDriver = linkedTx.description?.match(/\((.+?)\)/);
            linkedDriverName =
              linkedTx.related_user?.name ||
              linkedOrder?.trip?.driver?.name ||
              (matchDriver ? matchDriver[1] : undefined);
            linkTypeLabel = linkedTripNumber
              ? `Рейс №${linkedTripNumber}${linkedDriverName ? ` (${linkedDriverName})` : ''}`
              : 'Рейс автопарка';
          }
          author = linkedDriverName ? `вод. ${linkedDriverName}` : payerName;
          title = linkedTx.description || title;
        }

        // Подбор подходящего сегодняшнего заказа с совпадающей суммой
        const opAmt = op.operationAmount || op.rubleAmount || 0;
        const matchingOrder = !isLinked
          ? (data?.trip_orders ?? []).find(
              (o) =>
                parseFloat(o.amount) === opAmt &&
                !(data?.transactions ?? []).some((t) => t.trip_order_id === o.id),
            )
          : undefined;

        incomeItems.push({
          id: `tbank-${op.operationId}`,
          title,
          category: isSbpOrQr ? 'Эквайринг / СБП' : 'Поступление на Р/С',
          wallet: 'bank',
          walletName: 'Р/С Банк (API)',
          author,
          amount: opAmt,
          bankOp: op,
          isLinked,
          linkTypeLabel,
          linkedTripNumber,
          linkedDriverName,
          canLinkToTrip: true, // Доступно для всех приходов на Р/С!
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
    categoryId?: string | null;
    wallet: 'bank' | 'cash' | 'fuel_card';
    walletName: string;
    author: string;
    amount: number;
    time?: string;
    rawTx?: RawTx;
    bankOp?: TBankOp;
    linkedObligationId?: string | null;
    linkedObligationTitle?: string | null;
    isGroup?: boolean;
    subItems?: Array<{
      id: string;
      title: string;
      author: string;
      amount: number;
      time: string;
      category?: string;
      categoryId?: string | null;
      wallet?: 'bank' | 'cash' | 'fuel_card';
      walletName?: string;
      rawTx?: RawTx;
      bankOp?: TBankOp;
      linkedObligationId?: string | null;
      linkedObligationTitle?: string | null;
    }>;
  }

  // 1. Все расходы и перемещения из transactions
  const rawExpenseTxs = (data?.transactions ?? []).filter(
    (t) =>
      (t.direction === 'expense' || (t.direction === 'transfer' && t.from_wallet_id)) &&
      txMatchesWallet(t),
  );

  const bankCommissions: RawTx[] = [];
  const payrollTxs: RawTx[] = [];
  const fuelTxs: RawTx[] = [];
  const individualExpenses: ExpenseItem[] = [];

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
      tx.from_wallet_id === FUEL_CARD_ID &&
      (desc.includes('гсм') || cat.includes('гсм') || desc.includes('заправ'))
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

      const txTime = new Date(tx.transaction_date || tx.created_at).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const txAmt = parseFloat(tx.amount) || 0;
      const calendarOverrides = data?.calendar_overrides ?? [];
      const matchedOv = calendarOverrides.find(
        (ov) =>
          (ov.custom_notes && ov.custom_notes.includes(tx.id)) ||
          (ov.paid_amount &&
            Math.abs(Number(ov.paid_amount) - txAmt) < 1 &&
            (tx.category_id === '00000000-0000-0000-0000-000000000020' ||
              (tx.description || '').toLowerCase().includes('кредит'))),
      );

      let oblTitle: string | null = null;
      let oblId: string | null = null;
      if (matchedOv) {
        oblId = matchedOv.obligation_id;
        const calItem = calendarData?.items?.find((i) => i.id === matchedOv.obligation_id);
        oblTitle = calItem?.title || matchedOv.custom_title || 'План платежей';
      }

      individualExpenses.push({
        id: tx.id,
        title: tx.description || 'Расход',
        category: tx.category?.name || 'Прочие расходы',
        categoryId: tx.category_id,
        wallet: w,
        walletName: wName,
        author: tx.related_user?.name || tx.counterparty?.name || 'Администратор',
        amount: txAmt,
        time: txTime,
        rawTx: tx,
        linkedObligationId: oblId,
        linkedObligationTitle: oblTitle,
      });
    }
  });

  // 2. Банковские списания напрямую из API Т-Банка (если ещё не заведены в transactions)
  if (data?.bank_operations && data.bank_operations.length > 0) {
    const debitBankOps = data.bank_operations.filter(
      (op) =>
        op.typeOfOperation === 'Debit' &&
        (activeWallet === 'all' || activeWallet === 'bank') &&
        !(data?.transactions ?? []).some((t) => t.idempotency_key === op.operationId),
    );

    debitBankOps.forEach((op) => {
      const desc = (op.description || op.payPurpose || '').toLowerCase();
      const opAmt = op.operationAmount || op.rubleAmount || 0;
      const dateVal = op.operationDate || op.operationTime;
      const opTime = dateVal
        ? new Date(dateVal).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '—';

      if (
        desc.includes('комисси') ||
        desc.includes('плата за') ||
        desc.includes('тариф') ||
        op.category === 'commission'
      ) {
        individualExpenses.push({
          id: `tbank-deb-${op.operationId}`,
          title: op.description || op.payPurpose || 'Комиссия банка',
          category: 'Банковские услуги (API)',
          categoryId: null,
          wallet: 'bank',
          walletName: 'Р/С Банк',
          author: 'Т-Банк (Авто)',
          amount: opAmt,
          time: opTime,
          bankOp: op,
        });
      } else {
        const receiverName = op.receiver?.name || op.counterParty?.name || 'Контрагент';
        individualExpenses.push({
          id: `tbank-deb-${op.operationId}`,
          title: op.description || op.payPurpose || `Списание с Р/С · ${receiverName}`,
          category: 'Списание с Р/С (API)',
          categoryId: null,
          wallet: 'bank',
          walletName: 'Р/С Банк',
          author: receiverName,
          amount: opAmt,
          time: opTime,
          bankOp: op,
        });
      }
    });
  }

  // 3. УНИВЕРСАЛЬНАЯ ГРУППИРОВКА ОДНОТИПНЫХ ТРАНЗАКЦИЙ:
  const expenseItems: ExpenseItem[] = [];

  // А) Сгруппированные банковские комиссии
  if (bankCommissions.length > 0) {
    if (bankCommissions.length === 1 && bankCommissions[0]) {
      const tx = bankCommissions[0];
      expenseItems.push({
        id: tx.id,
        title: tx.description || 'Комиссия банка',
        category: 'Банковские услуги',
        categoryId: tx.category_id,
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
          time: new Date(t.transaction_date || t.created_at).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          category: 'Банковские услуги',
          categoryId: t.category_id,
          wallet: 'bank',
          walletName: 'Р/С Банк',
          rawTx: t,
        })),
      });
    }
  }

  // Б) Сгруппированные зарплаты
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
        categoryId: tx.category_id,
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
          time: new Date(t.transaction_date || t.created_at).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          category: 'ФОТ / Зарплата',
          categoryId: t.category_id,
          wallet: t.from_wallet_id === CASH_ID ? 'cash' : 'bank',
          walletName: t.from_wallet_id === CASH_ID ? 'Сейф (нал)' : 'Р/С Банк',
          rawTx: t,
        })),
      });
    }
  }

  // В) Сгруппированные заправки автопарка
  if (fuelTxs.length > 0) {
    if (fuelTxs.length === 1 && fuelTxs[0]) {
      const tx = fuelTxs[0];
      expenseItems.push({
        id: tx.id,
        title: tx.description || 'Заправка ГСМ',
        category: 'ГСМ',
        categoryId: tx.category_id,
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
          time: new Date(t.transaction_date || t.created_at).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          category: 'ГСМ',
          categoryId: t.category_id,
          wallet: 'fuel_card',
          walletName: 'Топливная карта',
          rawTx: t,
        })),
      });
    }
  }

  // Г) Однотипные расходы, сгруппированные по статье расходов или назначению
  const groupedByCategoryOrTitle = new Map<string, ExpenseItem[]>();
  for (const it of individualExpenses) {
    const cleanedTitle = cleanExpenseDescription(it.title);
    const assignedCategory = resolveExpenseCategory(cleanedTitle, it.category);

    // Обновляем поля расхода
    it.title = cleanedTitle;
    it.category = assignedCategory;

    // Ключ группировки: если категория "Комиссия банка", "ГСМ", "Перевод между кошельками" или повторяющийся получатель
    const groupKey = assignedCategory.toLowerCase();
    const list = groupedByCategoryOrTitle.get(groupKey) || [];
    list.push(it);
    groupedByCategoryOrTitle.set(groupKey, list);
  }

  for (const [catKey, list] of groupedByCategoryOrTitle.entries()) {
    if (list.length === 1 && list[0]) {
      expenseItems.push(list[0]);
    } else if (list.length > 1 && list[0]) {
      const first = list[0];
      const sumAmt = list.reduce((s, it) => s + it.amount, 0);
      const groupTitle = `${first.category} (${list.length} операций)`;
      const groupId = `group-cat-${catKey.slice(0, 30)}-${list.length}`;
      expenseItems.push({
        id: groupId,
        title: groupTitle,
        category: first.category,
        categoryId: first.categoryId,
        wallet: first.wallet,
        walletName: list.every((it) => it.wallet === first.wallet)
          ? first.walletName
          : 'Разные счета',
        author: first.author,
        amount: sumAmt,
        isGroup: true,
        subItems: list.map((it) => ({
          id: it.id,
          title: it.title,
          author: it.author,
          amount: it.amount,
          time: it.time || '—',
          category: it.category,
          categoryId: it.categoryId,
          wallet: it.wallet,
          walletName: it.walletName,
          rawTx: it.rawTx,
          bankOp: it.bankOp,
          linkedObligationId: it.linkedObligationId,
          linkedObligationTitle: it.linkedObligationTitle,
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
            {/* Quick manual operation buttons in top bar */}
            <button
              onClick={() => openManualModal('expense')}
              className="inline-flex items-center gap-1 text-[10px] font-black bg-rose-600 hover:bg-rose-500 text-white px-2.5 py-0.5 rounded-md transition shadow-2xs cursor-pointer"
              title="Внести расход / списание вручную"
            >
              <span>−</span>
              <span>Списание</span>
            </button>
            <button
              onClick={() => openManualModal('income')}
              className="inline-flex items-center gap-1 text-[10px] font-black bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-0.5 rounded-md transition shadow-2xs cursor-pointer"
              title="Внести доход / пополнение вручную"
            >
              <span>+</span>
              <span>Пополнение</span>
            </button>
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
                    actualFuel: String(fuelWallet?.evening ?? ''),
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
        <div className="space-y-3">
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-white rounded-2xl border-2 border-rose-200 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-rose-500 flex items-center justify-center text-white text-[9px] font-black">
                −
              </span>
              <span className="text-xs font-black uppercase tracking-tight text-slate-900">
                РАСХОДЫ ЗА СЕГОДНЯ
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-mono">
                {expenseItems.length}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs font-black font-mono text-rose-600">
                -{rub(totalDayExpenses)}
              </div>
              <button
                onClick={() => openManualModal('expense')}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-black shadow-xs flex items-center gap-1 cursor-pointer transition"
              >
                <span>+</span> <span>Списание</span>
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {expenseItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                Нет расходов за выбранный день
              </div>
            ) : (
              expenseItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border-2 border-slate-300 hover:border-slate-400 shadow-sm flex flex-col overflow-hidden group transition"
                >
                  <div className="flex items-stretch flex-1">
                    {/* Accent strip 6px */}
                    <div
                      className={`w-1.5 flex-shrink-0 group-hover:w-2 transition-all ${
                        item.wallet === 'fuel_card'
                          ? 'bg-amber-500'
                          : item.wallet === 'cash'
                            ? 'bg-emerald-500'
                            : 'bg-rose-500'
                      }`}
                    />

                    {/* Card Content (3 zones) */}
                    <div className="p-3 flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
                      {/* Zone 1: Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-xs font-black text-slate-900 line-clamp-2 leading-tight break-words max-w-[420px]"
                            title={item.title}
                          >
                            {item.title}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
                            {item.category}
                          </span>
                          {item.isGroup && (
                            <button
                              onClick={() => toggleGroup(item.id)}
                              className="text-[9px] font-extrabold bg-rose-100 text-rose-800 px-2 py-0.5 rounded hover:bg-rose-200 transition cursor-pointer flex items-center gap-1"
                            >
                              <span>{expandedGroups[item.id] ? '▲ Свернуть' : '▼ Раскрыть'}</span>
                              <span className="bg-rose-200/80 px-1 rounded-sm text-[8px]">
                                {item.subItems?.length}
                              </span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1 flex-wrap">
                          <span
                            className={`px-1.5 py-0.2 rounded font-bold border text-[10px] ${
                              item.wallet === 'bank'
                                ? 'bg-sky-50 text-sky-800 border-sky-200'
                                : item.wallet === 'cash'
                                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                  : 'bg-amber-50 text-amber-900 border-amber-200'
                            }`}
                          >
                            {item.wallet === 'bank' ? '🏦' : item.wallet === 'cash' ? '🔒' : '⛽'}{' '}
                            {item.walletName}
                          </span>
                          {item.time && (
                            <>
                              <span>·</span>
                              <span className="font-mono text-slate-400">{item.time}</span>
                            </>
                          )}
                          <span>·</span>
                          <span className="text-slate-500">{item.author}</span>
                        </div>
                      </div>

                      {/* Zone 2: Plan Link */}
                      <div className="flex-shrink-0 self-start sm:self-center">
                        {item.linkedObligationTitle ? (
                          <div className="inline-flex items-center gap-1.5 bg-blue-50/90 text-blue-950 border-2 border-blue-200 text-[11px] font-black px-2.5 py-1 rounded-xl shadow-2xs">
                            <span>📅</span>
                            <span>{item.linkedObligationTitle}</span>
                            <span className="text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded text-[10px]">
                              ✓ Закрыт
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">
                            Без привязки
                          </span>
                        )}
                      </div>

                      {/* Zone 3: Amount + Edit Button */}
                      <div className="text-right flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="text-sm font-black font-mono text-rose-600">
                          -{rub(item.amount)}
                        </div>
                        {!item.isGroup && (
                          <button
                            onClick={() => {
                              const raw = item.rawTx;
                              const op = item.bankOp;
                              setEditingTx({
                                id: raw ? raw.id : op ? op.operationId : item.id,
                                description: raw
                                  ? raw.description || ''
                                  : op
                                    ? op.description || op.payPurpose || ''
                                    : item.title,
                                amount: item.amount,
                                categoryId: raw?.category_id || item.categoryId || null,
                                categoryName: raw?.category?.name || item.category,
                                direction:
                                  (raw?.direction === 'income' || raw?.direction === 'transfer'
                                    ? raw.direction
                                    : 'expense') ||
                                  (item.wallet === 'fuel_card' ? 'transfer' : 'expense'),
                                fromWalletId:
                                  raw?.from_wallet_id ||
                                  (item.wallet === 'cash'
                                    ? CASH_ID
                                    : item.wallet === 'fuel_card'
                                      ? FUEL_CARD_ID
                                      : BANK_ID),
                                toWalletId:
                                  raw?.to_wallet_id ||
                                  (item.wallet === 'fuel_card' ? FUEL_CARD_ID : null),
                                transactionDate:
                                  raw?.transaction_date ||
                                  raw?.created_at ||
                                  (op ? op.operationDate || op.operationTime : selectedDate),
                                obligationId: item.linkedObligationId || null,
                                relatedUserId:
                                  raw?.related_user_id || raw?.related_user?.id || null,
                              });
                            }}
                            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 flex items-center justify-center text-xs font-black cursor-pointer shadow-2xs transition"
                            title="Редактировать / изменить статью"
                          >
                            ✏️
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Group details */}
                  {item.isGroup && expandedGroups[item.id] && item.subItems && (
                    <div className="w-full bg-slate-50/90 border-t-2 border-slate-200 p-2.5 space-y-1.5 pl-6">
                      <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                        ДЕТАЛИЗАЦИЯ СГРУППИРОВАННЫХ ОПЕРАЦИЙ:
                      </div>
                      {item.subItems.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between text-xs py-1.5 border-b border-slate-200/60 last:border-0 hover:bg-slate-100/60 px-2 rounded-lg"
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-mono text-slate-400">{sub.time}</span>
                            <span className="font-semibold text-slate-800">{sub.title}</span>
                            <span className="text-[10px] text-slate-400">({sub.author})</span>
                            {sub.category && (
                              <span className="text-[9px] bg-slate-200/70 text-slate-700 px-1 rounded font-medium">
                                {sub.category}
                              </span>
                            )}
                            {sub.linkedObligationTitle && (
                              <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-900 border border-blue-300 font-extrabold text-[9px] px-1.5 py-0.2 rounded shadow-xs">
                                <span>📅</span>
                                <span>{sub.linkedObligationTitle}</span>
                                <span className="text-emerald-700 font-black">✓</span>
                              </span>
                            )}
                            <button
                              onClick={() => {
                                const raw = sub.rawTx;
                                const op = sub.bankOp;
                                setEditingTx({
                                  id: raw ? raw.id : op ? op.operationId : sub.id,
                                  description: raw
                                    ? raw.description || ''
                                    : op
                                      ? op.description || op.payPurpose || ''
                                      : sub.title,
                                  amount: sub.amount,
                                  categoryId: raw?.category_id || sub.categoryId || null,
                                  categoryName: raw?.category?.name || sub.category,
                                  direction:
                                    (raw?.direction === 'income' || raw?.direction === 'transfer'
                                      ? raw.direction
                                      : 'expense') ||
                                    (sub.wallet === 'fuel_card' ? 'transfer' : 'expense'),
                                  fromWalletId:
                                    raw?.from_wallet_id ||
                                    (sub.wallet === 'cash'
                                      ? CASH_ID
                                      : sub.wallet === 'fuel_card'
                                        ? FUEL_CARD_ID
                                        : BANK_ID),
                                  toWalletId:
                                    raw?.to_wallet_id ||
                                    (sub.wallet === 'fuel_card' ? FUEL_CARD_ID : null),
                                  transactionDate:
                                    raw?.transaction_date ||
                                    raw?.created_at ||
                                    (op ? op.operationDate || op.operationTime : selectedDate),
                                  obligationId: sub.linkedObligationId || null,
                                  relatedUserId:
                                    raw?.related_user_id || raw?.related_user?.id || null,
                                });
                              }}
                              className="text-[9px] text-sky-600 hover:text-sky-800 cursor-pointer ml-1 font-bold underline"
                              title="Классифицировать / изменить"
                            >
                              ✎ изменить статью / имя
                            </button>
                          </div>
                          <div className="font-mono font-bold text-rose-600 ml-2 flex-shrink-0">
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
        <div className="space-y-3">
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-white rounded-2xl border-2 border-emerald-200 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[9px] font-black">
                +
              </span>
              <span className="text-xs font-black uppercase tracking-tight text-slate-900">
                ДОХОДЫ ЗА СЕГОДНЯ
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono">
                {incomeItems.length}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs font-black font-mono text-emerald-600">
                +{rub(totalDayIncomes)}
              </div>
              <button
                onClick={() => openManualModal('income')}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black shadow-xs flex items-center gap-1 cursor-pointer transition"
              >
                <span>+</span> <span>Пополнение</span>
              </button>
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
              <div className="p-3 bg-white text-slate-850 rounded-2xl border-2 border-slate-200 text-xs flex flex-col gap-2 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">📱</span>
                    <span className="font-black text-slate-900 uppercase tracking-wide text-[10px]">
                      Сверка QR-кодов от водителей
                    </span>
                    <span className="text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md font-bold">
                      Всего: {qrOrders.length} ({rub(totalQrAmt)})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono">
                    <span className="text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">
                      ✓ В банке: {qrCompleted.length}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md font-black ${
                        qrPending.length > 0
                          ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      {qrPending.length > 0
                        ? `⚠️ НЕ ДОШЛО: ${qrPending.length} (${rub(pendingAmt)})`
                        : 'Все оплачены ✓'}
                    </span>
                  </div>
                </div>

                {qrPending.length > 0 && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-[11px] space-y-1.5">
                    <div className="text-[10px] font-black uppercase tracking-wider text-rose-900 flex items-center justify-between">
                      <span>Заказы с QR, по которым оплата ещё НЕ поступила:</span>
                      <span className="text-rose-700 font-bold">Требуется проверка водителей</span>
                    </div>
                    {qrPending.map((o) => (
                      <div
                        key={o.id}
                        className="flex items-center justify-between text-slate-700 py-0.5 border-b border-rose-100 last:border-0"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          <span className="font-bold text-slate-900">
                            {o.trip?.trip_number ? `Рейс №${o.trip.trip_number}` : 'Рейс'}
                          </span>
                          <span className="text-slate-600 font-medium">
                            ({o.trip?.driver?.name || 'Водитель'})
                          </span>
                          {o.counterparty?.name && (
                            <span className="text-[10px] text-slate-500">
                              · {o.counterparty.name}
                            </span>
                          )}
                        </div>
                        <span className="font-mono font-black text-rose-700">
                          {rub(parseFloat(o.amount || '0'))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="space-y-2.5">
            {incomeItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                Нет поступлений за выбранный день
              </div>
            ) : (
              incomeItems.map((item) => (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl border-2 shadow-sm flex flex-col overflow-hidden group transition ${
                    !item.isLinked && item.canLinkToTrip
                      ? 'border-amber-400 hover:border-amber-500 bg-amber-50/20'
                      : 'border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-stretch flex-1">
                    {/* Accent strip 6px */}
                    <div
                      className={`w-1.5 flex-shrink-0 group-hover:w-2 transition-all ${
                        item.wallet === 'cash'
                          ? 'bg-emerald-500'
                          : item.category.toLowerCase().includes('безнал')
                            ? 'bg-sky-500'
                            : !item.isLinked && item.canLinkToTrip
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                      }`}
                    />

                    {/* Card Content (3 zones) */}
                    <div className="p-3 flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
                      {/* Zone 1: Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-slate-900 truncate">
                            {item.title}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                            {item.category}
                          </span>
                          {item.isGroup && (
                            <button
                              onClick={() => toggleGroup(item.id)}
                              className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded hover:bg-emerald-200 transition cursor-pointer flex items-center gap-1"
                            >
                              <span>{expandedGroups[item.id] ? '▲ Свернуть' : '▼ Раскрыть'}</span>
                              <span className="bg-emerald-200/80 px-1 rounded-sm text-[8px]">
                                {item.subItems?.length}
                              </span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1 flex-wrap">
                          <span
                            className={`px-1.5 py-0.2 rounded font-bold border text-[10px] ${
                              item.wallet === 'bank'
                                ? 'bg-sky-50 text-sky-800 border-sky-200'
                                : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                            }`}
                          >
                            {item.wallet === 'bank' ? '🏦' : '🔒'} {item.walletName}
                          </span>
                          <span>·</span>
                          <span className="text-slate-500">{item.author}</span>
                        </div>
                      </div>

                      {/* Zone 2: Link / Match status */}
                      <div className="flex-shrink-0 self-start sm:self-center">
                        {item.bankOp && item.canLinkToTrip ? (
                          item.isLinked ? (
                            <div className="flex items-center gap-1.5">
                              <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-950 border-2 border-emerald-200 text-[11px] font-black px-2.5 py-1 rounded-xl shadow-2xs">
                                <span>
                                  {item.linkTypeLabel?.includes('Заказ-наряд')
                                    ? '🔧'
                                    : item.linkTypeLabel?.includes('Диспетчер')
                                      ? '🤝'
                                      : '🚚'}
                                </span>
                                <span>
                                  {item.linkTypeLabel ||
                                    (item.linkedTripNumber
                                      ? `Рейс №${item.linkedTripNumber}`
                                      : 'Связано')}
                                </span>
                                <span className="text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded text-[10px]">
                                  ✓
                                </span>
                              </div>
                              <button
                                onClick={() =>
                                  linkBankOpMutation.mutate({
                                    operationId: item.bankOp!.operationId,
                                    action: 'unlink',
                                  })
                                }
                                disabled={linkBankOpMutation.isPending}
                                className="text-[10px] text-slate-400 hover:text-rose-600 font-bold cursor-pointer"
                                title="Отвязать операцию"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {item.suggestedOrder && (
                                <button
                                  onClick={() =>
                                    linkBankOpMutation.mutate({
                                      operationId: item.bankOp!.operationId,
                                      tripOrderId: item.suggestedOrder!.id,
                                      amount: item.amount,
                                      operationDate: item.bankOp?.operationDate,
                                      date: selectedDate,
                                      action: 'link',
                                    })
                                  }
                                  disabled={linkBankOpMutation.isPending}
                                  className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-xs border-2 border-amber-500/40 flex items-center gap-1 cursor-pointer transition"
                                  title="Быстро связать с совпадающим заказом рейса"
                                >
                                  <span>⚡</span>
                                  <span>
                                    Рейс №{item.suggestedOrder.trip?.trip_number} (
                                    {item.suggestedOrder.trip?.driver?.name})
                                  </span>
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setLinkingBankOp(item.bankOp!);
                                  setLinkMode('trip');
                                  setLinkOrderSearch('');
                                  setLinkOrderPeriod('smart');
                                  setLinkOrderCustomDate('');
                                  if (item.suggestedOrder) {
                                    setSelectedOrderIdToLink(item.suggestedOrder.id);
                                  } else {
                                    setSelectedOrderIdToLink('');
                                  }
                                }}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] rounded-xl border border-slate-300 cursor-pointer transition"
                              >
                                🔗 Связать (Рейс / Гараж / Диспетчер)
                              </button>
                            </div>
                          )
                        ) : (
                          <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-900 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                            <span>✓ Зачислено</span>
                          </div>
                        )}
                      </div>

                      {/* Zone 3: Amount + Action button */}
                      <div className="text-right flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="text-sm font-black font-mono text-emerald-600">
                          +{rub(item.amount)}
                        </div>
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
                            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 flex items-center justify-center text-xs font-black cursor-pointer shadow-2xs transition"
                            title="Редактировать название / категорию"
                          >
                            ✏️
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Group details */}
                  {item.isGroup && expandedGroups[item.id] && item.subItems && (
                    <div className="w-full bg-slate-50/90 border-t-2 border-slate-200 p-2.5 space-y-1.5 pl-6">
                      <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                        ДЕТАЛИЗАЦИЯ ПОСТУПЛЕНИЙ:
                      </div>
                      {item.subItems.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60 last:border-0 hover:bg-slate-100/60 px-2 rounded-lg"
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
                                className="text-[9px] text-slate-400 hover:text-sky-600 cursor-pointer ml-1 font-bold underline"
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
      <div className="bg-white text-slate-900 rounded-2xl p-4 border-2 border-slate-200 shadow-card">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-base">🎯</span>
            <span className="text-xs font-black uppercase tracking-wider text-slate-800">
              ИТОГОВЫЙ СУТОЧНЫЙ БАЛАНС ПО КОШЕЛЬКАМ (ИТОГО ЗА ДЕНЬ)
            </span>
          </div>
          <div className="text-sm font-mono font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
            ВСЕГО: {rub(eveningTotal)}
          </div>
        </div>

        <div className="mt-3.5 grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Bank */}
          <div className="bg-sky-50/60 rounded-xl p-3 border-2 border-sky-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-950">🏦 Р/С Банк (АПИ):</span>
              <span className="text-sm font-black font-mono text-sky-700">
                {rub(bankWallet?.evening ?? 0)}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 flex justify-between font-mono">
              <span>С утра: {rub(bankWallet?.morning ?? 0)}</span>
              <span
                className={
                  (bankWallet?.evening ?? 0) - (bankWallet?.morning ?? 0) >= 0
                    ? 'text-emerald-600 font-bold'
                    : 'text-rose-600 font-bold'
                }
              >
                {(bankWallet?.evening ?? 0) - (bankWallet?.morning ?? 0) >= 0 ? '+' : ''}
                {rub((bankWallet?.evening ?? 0) - (bankWallet?.morning ?? 0))}
              </span>
            </div>
          </div>

          {/* Cash Safe */}
          <div className="bg-emerald-50/60 rounded-xl p-3 border-2 border-emerald-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950">🔒 Сейф (Факт директор):</span>
              <span className="text-sm font-black font-mono text-emerald-700">
                {rub(cashWallet?.evening ?? 0)}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 flex justify-between font-mono">
              <span>С утра: {rub(cashWallet?.morning ?? 0)}</span>
              <span
                className={
                  (cashWallet?.evening ?? 0) - (cashWallet?.morning ?? 0) >= 0
                    ? 'text-emerald-600 font-bold'
                    : 'text-rose-600 font-bold'
                }
              >
                {(cashWallet?.evening ?? 0) - (cashWallet?.morning ?? 0) >= 0 ? '+' : ''}
                {rub((cashWallet?.evening ?? 0) - (cashWallet?.morning ?? 0))}
              </span>
            </div>
          </div>

          {/* Fuel Card */}
          <div className="bg-amber-50/60 rounded-xl p-3 border-2 border-amber-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-950">⛽ Топливная карта:</span>
              <span className="text-sm font-black font-mono text-amber-700">
                {rub(fuelWallet?.evening ?? 0)}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 flex justify-between font-mono">
              <span>С утра: {rub(fuelWallet?.morning ?? 0)}</span>
              <span
                className={
                  (fuelWallet?.evening ?? 0) - (fuelWallet?.morning ?? 0) >= 0
                    ? 'text-emerald-600 font-bold'
                    : 'text-rose-600 font-bold'
                }
              >
                {(fuelWallet?.evening ?? 0) - (fuelWallet?.morning ?? 0) >= 0 ? '+' : ''}
                {rub((fuelWallet?.evening ?? 0) - (fuelWallet?.morning ?? 0))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 8. MODAL: EDIT & CATEGORIZE EXPENSE / AUTO-LINK CALENDAR ── */}
      {editingTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-base">✎</span>
                <span className="text-sm font-black uppercase text-slate-800">
                  Классификация и редактирование расхода
                </span>
              </div>
              <button
                onClick={() => setEditingTx(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div className="bg-rose-50/60 border border-rose-200/80 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase text-rose-800 tracking-wider">
                    Сумма списания
                  </div>
                  <div className="text-lg font-black font-mono text-rose-600 mt-0.5">
                    -{rub(editingTx.amount)}
                  </div>
                </div>
                <div className="text-right text-[10px] text-slate-500">
                  <div>Дата операции:</div>
                  <div className="font-mono font-bold text-slate-700">
                    {editingTx.transactionDate
                      ? new Date(editingTx.transactionDate).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : selectedDate}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-700 tracking-wider">
                  Название / точное назначение (куда ушли деньги) *
                </label>
                <input
                  type="text"
                  value={editingTx.description}
                  onChange={(e) => setEditingTx({ ...editingTx, description: e.target.value })}
                  placeholder="Например: Пополнение топливной карты, Запчасти на Газель, Кредит Тинькофф"
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-700 tracking-wider">
                  Статья расходов (Группа расходов) *
                </label>
                <select
                  value={editingTx.categoryId || ''}
                  onChange={(e) => {
                    const newCatId = e.target.value || null;
                    const catObj = (data?.categories ?? []).find((c) => c.id === newCatId);
                    let toW = editingTx.toWalletId;
                    if (catObj?.code === 'FUEL' || catObj?.code === 'WALLET_TRANSFER') {
                      toW = FUEL_CARD_ID;
                    }
                    setEditingTx({
                      ...editingTx,
                      categoryId: newCatId,
                      categoryName: catObj?.name,
                      toWalletId: toW,
                    });
                  }}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white font-medium"
                >
                  <option value="">(Выберите статью расходов)</option>
                  {(data?.categories ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination wallet (for Fuel Card / Inter-wallet transfer) */}
              {(editingTx.categoryId === '62cebf3f-9982-4cc6-904b-48c6169cf5e4' ||
                editingTx.categoryId === 'b9946a5e-4a33-4ed9-a272-5dee12d4ca93' ||
                (editingTx.description || '').toLowerCase().includes('топливн') ||
                (editingTx.description || '').toLowerCase().includes('пополнение тк') ||
                (editingTx.description || '').toLowerCase().includes('гсм')) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-amber-900 tracking-wider">
                    ⛽ Зачислить на кошелек / карту:
                  </label>
                  <select
                    value={editingTx.toWalletId || ''}
                    onChange={(e) =>
                      setEditingTx({ ...editingTx, toWalletId: e.target.value || null })
                    }
                    className="w-full px-3 py-2 text-xs border border-amber-300 rounded-lg bg-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value={FUEL_CARD_ID}>⛽ Топливная карта (ГСМ)</option>
                    <option value={CASH_ID}>🔒 Сейф (Наличные)</option>
                    <option value="">(Не переводить, оставить прямым списанием)</option>
                  </select>
                  <div className="text-[10px] text-amber-800">
                    💡 При выборе Топливной карты баланс ГСМ автоматически пополнится на эту сумму
                    (+{rub(editingTx.amount)}).
                  </div>
                </div>
              )}

              {/* Link with Payment Calendar */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                  <span>📅</span> Связать с Календарём платежей (отметить как оплаченный):
                </label>
                <select
                  value={editingTx.obligationId || ''}
                  onChange={(e) =>
                    setEditingTx({ ...editingTx, obligationId: e.target.value || null })
                  }
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white font-medium"
                >
                  <option value="">(Автоматический подбор по названию/сумме)</option>
                  <option value="none">❌ Не связывать / отвязать от плана платежей</option>
                  {(calendarData?.items ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title} — {rub(o.amount)} (до {o.due_day}-го числа)
                      {o.status === 'paid' ? ' [✓ Оплачен]' : ''}
                    </option>
                  ))}
                </select>
                <div className="text-[10px] text-slate-500 mt-1">
                  Платёж автоматически отметится как оплаченный в Платёжном календаре за этот месяц.
                </div>
              </div>

              {/* Link with Staff (Driver / Employee advance or salary) */}
              {(editingTx.categoryId === 'a0000000-0000-0000-0000-000000000001' ||
                (editingTx.categoryName || '').toLowerCase().includes('аванс') ||
                (editingTx.categoryName || '').toLowerCase().includes('фот') ||
                (editingTx.categoryName || '').toLowerCase().includes('зарплат') ||
                (editingTx.description || '').toLowerCase().includes('суточн') ||
                editingTx.relatedUserId) && (
                <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-violet-900 tracking-wider flex items-center justify-between">
                    <span>👤 Сотрудник / Водитель (учёт аванса/долга):</span>
                    {editingTx.relatedUserId && (
                      <span className="text-emerald-700 font-bold">✓ Привязан к сотруднику</span>
                    )}
                  </label>
                  <select
                    value={editingTx.relatedUserId || ''}
                    onChange={(e) =>
                      setEditingTx({ ...editingTx, relatedUserId: e.target.value || null })
                    }
                    className="w-full px-3 py-2 text-xs border border-violet-300 rounded-lg bg-white font-medium focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="">(Не привязывать к долгам сотрудника)</option>
                    {(usersData ?? []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <div className="text-[10px] text-violet-800">
                    💡 При выборе сотрудника расход ({rub(editingTx.amount)}) автоматически
                    запишется в его карточку как выданный аванс без создания дублирующих записей.
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setEditingTx(null)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Отмена
              </button>
              <button
                disabled={categorizeMutation.isPending || !editingTx.description?.trim()}
                onClick={() =>
                  categorizeMutation.mutate({
                    id: editingTx.id,
                    description: editingTx.description,
                    category_id: editingTx.categoryId,
                    amount: editingTx.amount,
                    to_wallet_id: editingTx.toWalletId,
                    from_wallet_id: editingTx.fromWalletId,
                    direction: editingTx.direction,
                    obligation_id: editingTx.obligationId,
                    transaction_date: editingTx.transactionDate,
                    related_user_id: editingTx.relatedUserId,
                  })
                }
                className="px-4 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                {categorizeMutation.isPending ? 'Сохранение...' : '✓ Сохранить и распределить'}
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

              {/* Fuel Card balance input */}
              <div>
                <label className="text-[9px] font-black uppercase text-slate-500 flex items-center justify-between">
                  <span>Фактически на Топливной карте (рубли)</span>
                  <span className="text-[9px] text-slate-400 font-mono">
                    по учёту: {rub(fuelWallet?.evening ?? 0)}
                  </span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={auditForm.actualFuel}
                  onChange={(e) => setAuditForm({ ...auditForm, actualFuel: e.target.value })}
                  placeholder="Например: 926.13"
                  className="w-full mt-1 px-3 py-2 text-sm font-bold font-mono border-2 border-amber-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>

              {/* Balances to record */}
              <div className="text-[10px] text-slate-500 space-y-1 pt-1">
                <div className="flex justify-between">
                  <span>Фиксация Р/С Банк:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {rub(bankWallet?.evening ?? 0)}
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
                    fuel_card_balance:
                      auditForm.actualFuel !== ''
                        ? parseFloat(auditForm.actualFuel)
                        : (fuelWallet?.evening ?? 0),
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
                  <span>🔗</span> Привязка поступления денежных средств
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Свяжите приход с рейсом автопарка, заказ-нарядом СТО или диспетчерским договором
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

              {/* Mode Switcher Tabs */}
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setLinkMode('trip')}
                  className={`py-1.5 text-[11px] font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                    linkMode === 'trip'
                      ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>🚚</span>
                  <span>Рейс парка</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLinkMode('sto')}
                  className={`py-1.5 text-[11px] font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                    linkMode === 'sto'
                      ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>🔧</span>
                  <span>Гараж / СТО</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLinkMode('dispatcher')}
                  className={`py-1.5 text-[11px] font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                    linkMode === 'dispatcher'
                      ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>🤝</span>
                  <span>Диспетчер (АТИ)</span>
                </button>
              </div>

              {/* Tab 1: Trip Selection */}
              {linkMode === 'trip' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-black uppercase text-slate-700">
                      Выберите рейс автопарка для привязки:
                    </label>
                    {linkableOrdersData?.extractedDate && (
                      <span className="text-[10px] font-bold text-sky-700 bg-sky-100/80 px-2 py-0.5 rounded-full border border-sky-200">
                        🎯 Дата из платежа:{' '}
                        {linkableOrdersData.extractedDate.split('-').reverse().join('.')}
                      </span>
                    )}
                  </div>

                  {/* Filter chips: Smart / Yesterday / Today / 7 days / Date picker */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setLinkOrderPeriod('smart');
                        setLinkOrderCustomDate('');
                      }}
                      className={`px-2 py-1 text-[10px] font-black rounded-lg transition cursor-pointer flex items-center gap-1 ${
                        linkOrderPeriod === 'smart'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>⚡</span>
                      <span>Умный подбор</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLinkOrderPeriod('yesterday');
                        setLinkOrderCustomDate('');
                      }}
                      className={`px-2 py-1 text-[10px] font-black rounded-lg transition cursor-pointer flex items-center gap-1 ${
                        linkOrderPeriod === 'yesterday'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>📅</span>
                      <span>Вчера ({yesterdayStr.split('-').reverse().slice(0, 2).join('.')})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLinkOrderPeriod('today');
                        setLinkOrderCustomDate('');
                      }}
                      className={`px-2 py-1 text-[10px] font-black rounded-lg transition cursor-pointer flex items-center gap-1 ${
                        linkOrderPeriod === 'today'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>📅</span>
                      <span>Сегодня ({todayStr.split('-').reverse().slice(0, 2).join('.')})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLinkOrderPeriod('7days');
                        setLinkOrderCustomDate('');
                      }}
                      className={`px-2 py-1 text-[10px] font-black rounded-lg transition cursor-pointer flex items-center gap-1 ${
                        linkOrderPeriod === '7days'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>🗓️</span>
                      <span>За 7 дней</span>
                    </button>
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        value={linkOrderCustomDate}
                        onChange={(e) => {
                          setLinkOrderCustomDate(e.target.value);
                          if (e.target.value) setLinkOrderPeriod('custom');
                        }}
                        className="px-2 py-0.5 text-[10px] font-bold border border-slate-300 rounded-lg bg-white text-slate-800"
                        title="Выбрать другую дату рейса"
                      />
                    </div>
                  </div>

                  {/* Search input */}
                  <div className="relative">
                    <input
                      type="text"
                      value={linkOrderSearch}
                      onChange={(e) => setLinkOrderSearch(e.target.value)}
                      placeholder="🔍 Поиск по номеру рейса (напр. 827), клиенту (Оля), сумме (2500)..."
                      className="w-full pl-3 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    {linkOrderSearch && (
                      <button
                        type="button"
                        onClick={() => setLinkOrderSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Orders List */}
                  {(() => {
                    const orders = linkableOrdersData?.orders ?? [];
                    const opAmt = linkingBankOp.operationAmount || linkingBankOp.rubleAmount || 0;

                    if (isLoadingLinkableOrders) {
                      return (
                        <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 text-xs">
                          <span className="inline-block animate-spin mr-2">⏳</span>
                          Загрузка рейсов автопарка...
                        </div>
                      );
                    }

                    if (orders.length === 0) {
                      return (
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
                          <div className="text-slate-500 text-xs">
                            Рейсы не найдены по выбранным критериям.
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setLinkOrderPeriod('7days');
                              setLinkOrderSearch('');
                              setLinkOrderCustomDate('');
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold bg-white border border-slate-300 rounded-lg text-sky-700 hover:bg-slate-50 cursor-pointer"
                          >
                            Показать рейсы за последние 7 дней
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {orders.map((order) => {
                          const isMatchAmt =
                            order.is_match_amount ?? parseFloat(String(order.amount)) === opAmt;
                          const isSelected = selectedOrderIdToLink === order.id;
                          const isTopRecommendation = order.score && order.score >= 100;

                          return (
                            <div
                              key={order.id}
                              onClick={() => setSelectedOrderIdToLink(order.id)}
                              className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? 'bg-sky-50 border-2 border-sky-500 ring-2 ring-sky-200'
                                  : isTopRecommendation
                                    ? 'bg-amber-50/80 border-2 border-amber-400 hover:border-amber-500 shadow-2xs'
                                    : isMatchAmt
                                      ? 'bg-amber-50/50 border-amber-300 hover:border-amber-400'
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
                                  <div className="font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
                                    <span>
                                      {order.trip?.trip_number
                                        ? `Рейс №${order.trip.trip_number}`
                                        : 'Рейс'}
                                    </span>
                                    <span className="text-slate-500 font-normal">
                                      · {order.trip?.driver?.name || 'Водитель'}
                                    </span>
                                    {order.trip_date && (
                                      <span className="text-[10px] font-mono font-medium text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                        📅{' '}
                                        {order.trip_date.split('-').reverse().slice(0, 2).join('.')}
                                      </span>
                                    )}
                                    {order.is_match_date && (
                                      <span className="text-[9px] font-black bg-sky-200 text-sky-900 px-1.5 py-0.2 rounded">
                                        🎯 Дата совпадает
                                      </span>
                                    )}
                                    {isMatchAmt && (
                                      <span className="text-[9px] font-black bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded shadow-2xs">
                                        ⭐ Совпадает сумма
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span>
                                      Тип:{' '}
                                      {order.payment_method === 'qr'
                                        ? '📱 QR-код'
                                        : order.payment_method === 'cash'
                                          ? '💵 Наличные'
                                          : order.payment_method === 'bank_invoice'
                                            ? '💳 Безнал'
                                            : order.payment_method}
                                    </span>
                                    {order.counterparty?.name && (
                                      <span className="font-semibold text-slate-700">
                                        Клиент: {order.counterparty.name}
                                      </span>
                                    )}
                                    {order.description && (
                                      <span className="text-slate-400 italic">
                                        ({order.description})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right flex-shrink-0 ml-2">
                                <div className="font-mono font-black text-slate-900 text-xs">
                                  {rub(parseFloat(String(order.amount)))}
                                </div>
                                <div className="text-[9px] text-slate-400">
                                  {order.is_already_linked ? (
                                    <span className="text-emerald-700 font-bold">
                                      ✓ Привязан к Р/С
                                    </span>
                                  ) : order.settlement_status === 'completed' ? (
                                    '✓ Отмечен'
                                  ) : (
                                    '⏳ Ожидает'
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Tab 2: STO / Garage Work Order */}
              {linkMode === 'sto' && (
                <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">
                      Номер заказ-наряда / чека автосервиса:
                    </label>
                    <input
                      type="text"
                      value={stoOrderNumber}
                      onChange={(e) => setStoOrderNumber(e.target.value)}
                      placeholder="Например: ЗН-104 или 482"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">
                      Клиент / Автомобиль (необязательно):
                    </label>
                    <input
                      type="text"
                      value={stoClientName}
                      onChange={(e) => setStoClientName(e.target.value)}
                      placeholder="Например: Газель В672ТТ / ООО Вектор"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div className="text-[10px] text-slate-500">
                    💡 Привяжет данный платёж к услугам гаража/СТО и зафиксирует выручку
                    автосервиса.
                  </div>
                </div>
              )}

              {/* Tab 3: Dispatcher Trip */}
              {linkMode === 'dispatcher' && (
                <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">
                      Номер заявки / маршрут чужого авто:
                    </label>
                    <input
                      type="text"
                      value={dispatcherDetails}
                      onChange={(e) => setDispatcherDetails(e.target.value)}
                      placeholder="Например: АТИ №1405 Салда — Москва"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">
                      Заказчик перевозки / экспедирование:
                    </label>
                    <input
                      type="text"
                      value={dispatcherClientName}
                      onChange={(e) => setDispatcherClientName(e.target.value)}
                      placeholder="Например: ООО Логистик Групп"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div className="text-[10px] text-slate-500">
                    💡 Привяжет платёж к экспедиторскому рейсу на привлечённом транспорте
                    (диспетчерская комиссия).
                  </div>
                </div>
              )}

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
                  disabled={
                    linkBankOpMutation.isPending ||
                    (linkMode === 'trip' && !selectedOrderIdToLink) ||
                    (linkMode === 'sto' && !stoOrderNumber.trim()) ||
                    (linkMode === 'dispatcher' && !dispatcherDetails.trim())
                  }
                  onClick={() =>
                    linkBankOpMutation.mutate({
                      operationId: linkingBankOp.operationId,
                      linkType: linkMode,
                      tripOrderId: linkMode === 'trip' ? selectedOrderIdToLink : undefined,
                      stoOrderNumber: linkMode === 'sto' ? stoOrderNumber.trim() : undefined,
                      stoClientName: linkMode === 'sto' ? stoClientName.trim() : undefined,
                      dispatcherDetails:
                        linkMode === 'dispatcher' ? dispatcherDetails.trim() : undefined,
                      dispatcherClientName:
                        linkMode === 'dispatcher' ? dispatcherClientName.trim() : undefined,
                      amount: linkingBankOp.operationAmount || linkingBankOp.rubleAmount || 0,
                      operationDate: linkingBankOp.operationDate,
                      date: selectedDate,
                      action: 'link',
                    })
                  }
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {linkBankOpMutation.isPending
                    ? 'Связывание...'
                    : linkMode === 'sto'
                      ? '✓ Связать с заказ-нарядом СТО'
                      : linkMode === 'dispatcher'
                        ? '✓ Связать с рейсом диспетчера'
                        : (() => {
                            const selOrder = (linkableOrdersData?.orders ?? []).find(
                              (o) => o.id === selectedOrderIdToLink,
                            );
                            return selOrder?.trip?.trip_number
                              ? `✓ Связать с рейсом №${selOrder.trip.trip_number}`
                              : '✓ Связать с рейсом автопарка';
                          })()}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: MANUAL EXPENSE / INCOME OPERATION ── */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-2xl max-w-lg w-full overflow-hidden">
            {/* Header */}
            <div
              className={`px-5 py-4 text-white flex items-center justify-between transition-colors ${
                manualType === 'expense'
                  ? 'bg-gradient-to-r from-rose-500 to-rose-600'
                  : 'bg-gradient-to-r from-emerald-500 to-emerald-600'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{manualType === 'expense' ? '💸' : '💰'}</span>
                <div>
                  <h3 className="text-sm font-black tracking-tight">
                    {manualType === 'expense'
                      ? 'Внести списание вручную'
                      : 'Внести пополнение вручную'}
                  </h3>
                  <p className="text-[11px] text-white/80">
                    {manualType === 'expense'
                      ? 'Расход по кассе сейфа, банку или топливной карте'
                      : 'Поступление выручки нал/безнал или возврат'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-sm font-black cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createManualMutation.mutate();
              }}
              className="p-5 space-y-4 text-xs"
            >
              {/* Type Switcher */}
              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                  Тип операции
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border-2 border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setManualType('expense');
                      if (manualWallet === 'safe') setManualWallet('safe');
                    }}
                    className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      manualType === 'expense'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    − Списание (Расход)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setManualType('income');
                      if (manualWallet === 'fuel') setManualWallet('safe');
                    }}
                    className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      manualType === 'income'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    + Пополнение (Доход)
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                  Сумма операции (₽) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-4 pr-12 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-2xl text-base font-black font-mono text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono font-black text-slate-400">
                    ₽
                  </span>
                </div>
              </div>

              {/* Wallet */}
              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                  Кошелёк / Счёт *
                </label>
                <select
                  value={manualWallet}
                  onChange={(e) => setManualWallet(e.target.value as 'safe' | 'bank' | 'fuel')}
                  className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white cursor-pointer"
                >
                  <option value="safe">🔒 Сейф кассы (Наличные)</option>
                  <option value="bank">🏦 Р/С Т-Банк (Безналичные)</option>
                  {manualType === 'expense' && (
                    <option value="fuel">⛽ Топливная карта Газпромнефть</option>
                  )}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                  Статья / Категория
                </label>
                <select
                  value={manualCategoryId}
                  onChange={(e) => setManualCategoryId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white cursor-pointer"
                >
                  <option value="">(Выберите категорию)</option>
                  {(data?.categories ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                  Описание / Контрагент / Примечание *
                </label>
                <input
                  type="text"
                  required
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  placeholder="Например: Заправка Газель А777АА или Сдача наличных водителем"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white"
                />
              </div>

              {/* Optional Link */}
              {manualType === 'expense' ? (
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <span>📅</span> Связать с Планом платежей (отметить оплаченным)
                  </label>
                  <select
                    value={manualObligationId}
                    onChange={(e) => setManualObligationId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white cursor-pointer"
                  >
                    <option value="">Без привязки к плану</option>
                    {(calendarData?.items ?? []).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.title} — {rub(o.amount)} (до {o.due_day}-го числа)
                        {o.status === 'paid' ? ' [✓ Оплачен]' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <span>🚚</span> Привязать к заказу рейса за сегодня
                  </label>
                  <select
                    value={manualTripOrderId}
                    onChange={(e) => setManualTripOrderId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white cursor-pointer"
                  >
                    <option value="">Без привязки к рейсу</option>
                    {(data?.trip_orders ?? []).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.trip?.trip_number ? `Рейс №${o.trip.trip_number}` : 'Рейс'} (
                        {o.trip?.driver?.name || 'Водитель'}) — {rub(o.amount)}
                        {o.counterparty?.name ? ` · ${o.counterparty.name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Error message */}
              {createManualMutation.isError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-700 text-xs font-bold">
                  {(createManualMutation.error as Error)?.message || 'Ошибка сохранения'}
                </div>
              )}

              {/* Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black cursor-pointer transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={
                    createManualMutation.isPending || !manualAmount || !manualDescription.trim()
                  }
                  className={`px-5 py-2.5 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer transition disabled:opacity-50 ${
                    manualType === 'expense'
                      ? 'bg-rose-600 hover:bg-rose-500'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  {createManualMutation.isPending
                    ? 'Сохранение...'
                    : manualType === 'expense'
                      ? 'Сохранить списание'
                      : 'Сохранить пополнение'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
