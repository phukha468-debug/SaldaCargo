'use client';

import React, { useState, useEffect } from 'react';
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

function getWeekDates(dStr: string) {
  const d = new Date(dStr + 'T12:00:00Z');
  const day = d.getUTCDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setUTCDate(d.getUTCDate() + diffToMon);
  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);
  return {
    weekStart: mon.toISOString().slice(0, 10),
    weekEnd: sun.toISOString().slice(0, 10),
  };
}

function formatPeriodHeader(dateStr: string, periodMode: 'day' | 'week' | 'month'): string {
  if (periodMode === 'day') {
    return formatDayHeader(dateStr);
  }
  if (periodMode === 'week') {
    const { weekStart, weekEnd } = getWeekDates(dateStr);
    const ws = new Date(weekStart + 'T12:00:00');
    const we = new Date(weekEnd + 'T12:00:00');
    return `${ws.getDate()} ${ws.toLocaleDateString('ru-RU', { month: 'short' })} — ${we.getDate()} ${we.toLocaleDateString('ru-RU', { month: 'short' })} ${we.getFullYear()} г.`;
  }
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).toUpperCase();
}

interface WarehousePartItem {
  id?: string;
  movement_id?: string;
  part_id?: string;
  name: string;
  brand: string;
  clientCarModel?: string | null;
  client_car_model?: string | null;
  article?: string | null;
  quantity: number;
  unit_price?: number;
}

/** Получить локальную дату операции (YYYY-MM-DD) в часовом поясе Верхней Салды (UTC+5) */
function getOpLocalDate(
  dateOrOp:
    | string
    | {
        trxnPostDate?: string;
        authorizationDate?: string;
        operationDate?: string;
        operationTime?: string;
      }
    | null
    | undefined,
  tzHours = 5,
): string {
  if (!dateOrOp) return '';
  const raw =
    typeof dateOrOp === 'string'
      ? dateOrOp
      : dateOrOp.trxnPostDate ||
        dateOrOp.authorizationDate ||
        dateOrOp.operationDate ||
        dateOrOp.operationTime;
  if (!raw) return '';
  const d = new Date(new Date(raw).getTime() + tzHours * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

/** Фильтрация статей: убирает доходы из расходов и схлопывает подстатьи ЗП в одну «Зарплата (ФОТ)» */
function getFilteredCategories(
  categories: CategoryItem[] = [],
  direction: 'income' | 'expense' | 'transfer' = 'expense',
  currentCatId?: string | null,
): Array<{ id: string; name: string }> {
  if (direction === 'income') {
    return categories
      .filter((c) => c.direction === 'income')
      .map((c) => ({ id: c.id, name: c.name }));
  }

  const list: Array<{ id: string; name: string }> = [];
  const payrollCategories = categories.filter(
    (c) =>
      c.code === 'PAYROLL_DRIVER' ||
      c.code === 'PAYROLL_LOADER' ||
      c.code === 'PAYROLL_MECHANIC' ||
      c.code === 'PAYROLL' ||
      c.name.toLowerCase().startsWith('зп '),
  );

  const matchedPayroll = payrollCategories.find((c) => c.id === currentCatId);
  const payrollId =
    matchedPayroll?.id || payrollCategories[0]?.id || 'd79213ee-3bc6-4433-b58a-ca7ea1040d00';

  let addedPayroll = false;
  for (const c of categories) {
    if (c.direction === 'income') continue;

    const isPayroll =
      c.code === 'PAYROLL_DRIVER' ||
      c.code === 'PAYROLL_LOADER' ||
      c.code === 'PAYROLL_MECHANIC' ||
      c.code === 'PAYROLL' ||
      c.name.toLowerCase().startsWith('зп ');

    if (isPayroll) {
      if (!addedPayroll) {
        list.push({ id: payrollId, name: 'Зарплата (ФОТ)' });
        addedPayroll = true;
      }
      continue;
    }

    list.push({ id: c.id, name: c.name });
  }

  return list;
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
  direction?: 'income' | 'expense' | 'transfer' | string;
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
  warehouse_part?: WarehousePartItem | null;
  warehouse_parts?: WarehousePartItem[];
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
  trxnPostDate?: string;
  authorizationDate?: string;
  drawDate?: string;
  chargeDate?: string;
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
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
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
    warehousePart?: WarehousePartItem | null;
    warehouseParts?: WarehousePartItem[];
  } | null>(null);

  // Warehouse link state in modal (supports multi-item entries & multiple car brands)
  interface ModalWarehouseEntry {
    id: string;
    brand: string;
    clientCarModel: string;
    name: string;
    article: string;
    quantity: number;
    unitPrice: number | '';
  }

  const [whEnabled, setWhEnabled] = useState(false);
  const [whItems, setWhItems] = useState<ModalWarehouseEntry[]>([]);

  // Lock background body scroll when edit modal is active
  useEffect(() => {
    if (editingTx) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [Boolean(editingTx)]);

  // Fetch warehouse parts for quick autocomplete / suggestions
  const { data: warehousePartsData } = useQuery<{
    parts: Array<{
      id: string;
      name: string;
      category: string;
      article?: string;
      purchase_price?: number;
    }>;
  }>({
    queryKey: ['garage-parts-all'],
    queryFn: () => fetch('/api/garage/parts?brand=all').then((r) => r.json()),
    staleTime: 60 * 1000,
  });

  // Автоопределение марки авто по названию/описанию
  function detectBrandFromText(text: string): string {
    const s = (text || '').toLowerCase();
    if (s.includes('валдай')) return 'valday';
    if (s.includes('газел') || s.includes('next') || s.includes('бизнес')) return 'gazelle';
    if (s.includes('нива') || s.includes('niva') || s.includes('клиент')) return 'client';
    if (
      s.includes('масло') ||
      s.includes('фильтр') ||
      s.includes('гсм') ||
      s.includes('тосол') ||
      s.includes('антифриз') ||
      s.includes('жидкост') ||
      s.includes('смазк')
    )
      return 'consumables';
    if (
      s.includes('fuso') ||
      s.includes('фусо') ||
      s.includes('canter') ||
      s.includes('кантер') ||
      s.includes('мицубиси') ||
      s.includes('митсубиши')
    )
      return 'canter';
    return 'canter';
  }

  // При открытии модалки редактирования операции синхронизируем состояние склада
  useEffect(() => {
    if (!editingTx) return;
    const desc = editingTx.description || '';
    const catName = editingTx.categoryName || '';
    const isParts =
      catName.toLowerCase().includes('запчаст') ||
      catName.toLowerCase().includes('детал') ||
      desc.toLowerCase().includes('запчаст') ||
      desc.toLowerCase().includes('детал') ||
      desc.toLowerCase().includes('fuso') ||
      desc.toLowerCase().includes('кантер') ||
      desc.toLowerCase().includes('валдай') ||
      desc.toLowerCase().includes('газел') ||
      desc.toLowerCase().includes('нива') ||
      Boolean(editingTx.warehousePart) ||
      Boolean(editingTx.warehouseParts && editingTx.warehouseParts.length > 0);

    const autoBrand = detectBrandFromText(desc);

    if (editingTx.warehouseParts && editingTx.warehouseParts.length > 0) {
      setWhEnabled(true);
      setWhItems(
        editingTx.warehouseParts.map((p, idx) => ({
          id: p.id || p.movement_id || `wh-${idx}-${Date.now()}`,
          brand: p.brand || autoBrand,
          clientCarModel:
            p.clientCarModel || p.client_car_model || (p.brand === 'client' ? 'Нива' : ''),
          name: p.name || desc,
          article: p.article || '',
          quantity: Math.max(1, p.quantity || 1),
          unitPrice: p.unit_price ?? '',
        })),
      );
    } else if (editingTx.warehousePart) {
      setWhEnabled(true);
      setWhItems([
        {
          id: `wh-${Date.now()}`,
          brand: editingTx.warehousePart.brand || autoBrand,
          clientCarModel:
            editingTx.warehousePart.clientCarModel ||
            editingTx.warehousePart.client_car_model ||
            (editingTx.warehousePart.brand === 'client' ? 'Нива' : ''),
          name: editingTx.warehousePart.name || desc,
          article: editingTx.warehousePart.article || '',
          quantity: Math.max(1, editingTx.warehousePart.quantity || 1),
          unitPrice: editingTx.warehousePart.unit_price ?? editingTx.amount,
        },
      ]);
    } else {
      setWhEnabled(isParts && editingTx.direction !== 'income');
      setWhItems([
        {
          id: `wh-${Date.now()}`,
          brand: autoBrand,
          clientCarModel: autoBrand === 'client' ? 'Нива' : '',
          name: desc,
          article: '',
          quantity: 1,
          unitPrice: editingTx.amount,
        },
      ]);
    }
  }, [editingTx?.id]);

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
    queryKey: ['daily-balance', selectedDate, period],
    queryFn: () =>
      fetch(`/api/finance/daily-balance?date=${selectedDate}&period=${period}`).then((r) =>
        r.json(),
      ),
    staleTime: 30 * 1000,
    refetchInterval: selectedDate === todayStr && period === 'day' ? 60 * 1000 : false,
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
      categoryName?: string;
      amount?: number;
      direction?: string;
      to_wallet_id?: string | null;
      from_wallet_id?: string | null;
      transaction_date?: string;
      obligation_id?: string | null;
      related_user_id?: string | null;
      warehouse_enabled?: boolean;
      warehouse_parts?: Array<{
        brand: string;
        client_car_model?: string | null;
        name: string;
        article?: string | null;
        quantity: number;
        unit_price: number;
      }>;
      warehouse_part?: {
        enabled: boolean;
        brand?: string;
        client_car_model?: string | null;
        name?: string;
        article?: string | null;
        quantity?: number;
        unit_price?: number;
        part_id?: string | null;
      } | null;
    }) => {
      const res = await fetch('/api/finance/categorize-op', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: payload.id,
          description: payload.description,
          category_id: payload.category_id,
          amount: payload.amount,
          direction: payload.direction,
          to_wallet_id: payload.to_wallet_id,
          from_wallet_id: payload.from_wallet_id,
          transaction_date: payload.transaction_date,
          obligation_id: payload.obligation_id,
          related_user_id: payload.related_user_id,
          warehouse_enabled: payload.warehouse_enabled,
          warehouse_parts: payload.warehouse_parts,
          warehouse_part: payload.warehouse_part,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка при сохранении');
      }
      return res.json();
    },
    onMutate: async (newOp) => {
      // 1. Мгновенно закрываем модалку для пользователя (0 ms отклик)
      setEditingTx(null);

      // 2. Отменяем фоновые запросы по daily-balance, чтобы они не перезаписали оптимистичный результат
      await queryClient.cancelQueries({ queryKey: ['daily-balance', selectedDate, period] });

      // 3. Сохраняем предыдущее состояние кэша для отката при ошибке
      const previousData = queryClient.getQueryData<DailyBalanceData>([
        'daily-balance',
        selectedDate,
        period,
      ]);

      // 4. Оптимистично обновляем локальный кэш
      if (previousData) {
        const cleanId = String(newOp.id)
          .replace(/^tbank-deb-/, '')
          .replace(/^tbank-/, '');

        const updatedTxList = [...(previousData.transactions || [])];
        const txIdx = updatedTxList.findIndex(
          (t) => t.id === cleanId || t.idempotency_key === cleanId,
        );

        // Убираем операцию из буфера неклассифицированных банковских операций
        const updatedBankOps = (previousData.bank_operations || []).filter(
          (op) => op.operationId !== cleanId,
        );

        const categoryObj = newOp.category_id
          ? previousData.categories?.find((c) => c.id === newOp.category_id) || {
              id: newOp.category_id,
              name: newOp.categoryName || 'Обновлено',
              code: 'UPDATED',
            }
          : null;

        const warehousePartsList: WarehousePartItem[] =
          newOp.warehouse_parts && newOp.warehouse_parts.length > 0
            ? newOp.warehouse_parts.map((p) => ({
                name: p.name,
                brand: p.brand,
                clientCarModel: p.client_car_model,
                quantity: p.quantity,
                unit_price: p.unit_price,
                article: p.article || null,
              }))
            : newOp.warehouse_part?.enabled
              ? [
                  {
                    name: newOp.warehouse_part.name || newOp.description,
                    brand: newOp.warehouse_part.brand || 'canter',
                    clientCarModel: newOp.warehouse_part.client_car_model,
                    quantity: newOp.warehouse_part.quantity || 1,
                    unit_price: newOp.warehouse_part.unit_price || newOp.amount,
                    article: newOp.warehouse_part.article || null,
                  },
                ]
              : [];

        const warehousePartObj = warehousePartsList.length > 0 ? warehousePartsList[0]! : null;

        if (txIdx >= 0 && updatedTxList[txIdx]) {
          const target = updatedTxList[txIdx]!;
          updatedTxList[txIdx] = {
            ...target,
            description: newOp.description,
            category_id: newOp.category_id,
            category: categoryObj,
            warehouse_part:
              newOp.warehouse_enabled === false
                ? null
                : warehousePartObj !== null
                  ? warehousePartObj
                  : target.warehouse_part,
            warehouse_parts:
              newOp.warehouse_enabled === false
                ? []
                : warehousePartsList.length > 0
                  ? warehousePartsList
                  : target.warehouse_parts,
            to_wallet_id:
              newOp.to_wallet_id !== undefined ? newOp.to_wallet_id : target.to_wallet_id,
            from_wallet_id:
              newOp.from_wallet_id !== undefined ? newOp.from_wallet_id : target.from_wallet_id,
            related_user_id:
              newOp.related_user_id !== undefined ? newOp.related_user_id : target.related_user_id,
          };
        } else {
          // Если это была банковская операция без записи в transactions, создаем оптимистичную запись
          updatedTxList.unshift({
            id: cleanId,
            amount: String(newOp.amount || 0),
            direction: newOp.direction || 'expense',
            description: newOp.description,
            created_at: newOp.transaction_date || new Date().toISOString(),
            transaction_date: newOp.transaction_date || new Date().toISOString(),
            from_wallet_id: newOp.from_wallet_id || BANK_ID,
            to_wallet_id: newOp.to_wallet_id || null,
            category_id: newOp.category_id,
            idempotency_key: cleanId,
            category: categoryObj,
            warehouse_part: warehousePartObj,
            warehouse_parts: warehousePartsList,
            counterparty: null,
            related_user: null,
          });
        }

        queryClient.setQueryData<DailyBalanceData>(['daily-balance', selectedDate, period], {
          ...previousData,
          transactions: updatedTxList,
          bank_operations: updatedBankOps,
        });
      }

      return { previousData };
    },
    onSuccess: (res) => {
      // При успешном ответе обновляем сохраненную запись точными данными с сервера
      if (res?.transaction) {
        queryClient.setQueryData<DailyBalanceData>(
          ['daily-balance', selectedDate, period],
          (old) => {
            if (!old) return old;
            const txs = [...(old.transactions || [])];
            const idx = txs.findIndex(
              (t) =>
                t.id === res.transaction.id ||
                t.idempotency_key === res.transaction.idempotency_key,
            );
            if (idx >= 0) {
              const resParts: WarehousePartItem[] = Array.isArray(res.warehouse_movements)
                ? res.warehouse_movements.map(
                    (m: {
                      id: string;
                      part_id: string;
                      quantity?: number;
                      unit_price?: number;
                      part?: { name?: string; category?: string; article?: string | null };
                    }) => ({
                      movement_id: m.id,
                      part_id: m.part_id,
                      name: m.part?.name || 'Запчасть',
                      brand: m.part?.category || 'canter',
                      article: m.part?.article || null,
                      quantity: Number(m.quantity) || 1,
                      unit_price: Number(m.unit_price) || 0,
                    }),
                  )
                : res.warehouse_movement
                  ? [
                      {
                        movement_id: res.warehouse_movement.id,
                        part_id: res.warehouse_movement.part_id,
                        name: res.warehouse_movement.part?.name || 'Запчасть',
                        brand: res.warehouse_movement.part?.category || 'canter',
                        article: res.warehouse_movement.part?.article || null,
                        quantity: Number(res.warehouse_movement.quantity) || 1,
                        unit_price: Number(res.warehouse_movement.unit_price) || 0,
                      },
                    ]
                  : [];

              txs[idx] = {
                ...txs[idx],
                ...res.transaction,
                warehouse_parts: resParts.length > 0 ? resParts : txs[idx]?.warehouse_parts,
                warehouse_part:
                  resParts.length > 0
                    ? resParts[0]
                    : res.warehouse_movement
                      ? {
                          name: res.warehouse_movement.part?.name || txs[idx]?.warehouse_part?.name,
                          brand:
                            res.warehouse_movement.part?.category ||
                            txs[idx]?.warehouse_part?.brand,
                          quantity: res.warehouse_movement.quantity || 1,
                          unit_price: res.warehouse_movement.unit_price,
                        }
                      : txs[idx]?.warehouse_part,
              };
            }
            return { ...old, transactions: txs };
          },
        );
      }
    },
    onError: (err, _newOp, context) => {
      // При ошибке откатываем кэш и сообщаем пользователю
      if (context?.previousData) {
        queryClient.setQueryData(['daily-balance', selectedDate, period], context.previousData);
      }
      alert('Ошибка при сохранении: ' + (err.message || 'Сбой сети'));
    },
    onSettled: () => {
      // Фоновое обновление только связанных списков склада без блокировки экрана
      queryClient.invalidateQueries({ queryKey: ['garage-parts'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['garage-parts-all'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['garage-inventory'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['finance-month'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['payment-calendar-items'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['payment-calendar'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['wallets'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['staff-payroll'], refetchType: 'none' });
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
  const [selectedOrderIdsToLink, setSelectedOrderIdsToLink] = useState<string[]>([]);
  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIdsToLink((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId],
    );
  };
  const [linkMode, setLinkMode] = useState<'trip' | 'sto' | 'dispatcher'>('trip');
  const [stoOrderNumber, setStoOrderNumber] = useState('');
  const [stoClientName, setStoClientName] = useState('');
  const [dispatcherDetails, setDispatcherDetails] = useState('');
  const [dispatcherClientName, setDispatcherClientName] = useState('');

  // Trip link modal search and filters
  const [linkOrderSearch, setLinkOrderSearch] = useState('');
  const [linkOrderPeriod, setLinkOrderPeriod] = useState<
    'smart' | 'today' | 'yesterday' | '7days' | '30days' | 'custom'
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
      } else if (linkOrderPeriod === '30days') {
        params.set('days', '30');
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

  // Ref to track which bank operation was already auto-selected to prevent overwriting user selection
  const autoSelectedOpIdRef = React.useRef<string | null>(null);

  // Auto-select the best matching order(s) when linkableOrdersData loads
  React.useEffect(() => {
    if (!linkingBankOp || linkMode !== 'trip') return;
    if (autoSelectedOpIdRef.current === linkingBankOp.operationId) return;

    const orders = linkableOrdersData?.orders ?? [];
    if (orders.length > 0) {
      autoSelectedOpIdRef.current = linkingBankOp.operationId;
      const opAmt = linkingBankOp.operationAmount || linkingBankOp.rubleAmount || 0;

      // 1. Сначала ищем одиночный рейс с точным совпадением суммы
      const exactSingle = orders.find(
        (o) => !o.is_already_linked && Math.abs(parseFloat(String(o.amount || '0')) - opAmt) < 0.01,
      );
      if (exactSingle) {
        setSelectedOrderIdsToLink([exactSingle.id]);
        return;
      }

      // 2. Ищем комбинацию из двух рейсов, сумма которых равна платежу (напр. долг за 2 рейса: 1000 + 1000 = 2000)
      const available = orders.filter((o) => !o.is_already_linked);
      let foundPair: string[] | null = null;
      for (let i = 0; i < available.length; i++) {
        const ordI = available[i];
        if (!ordI) continue;
        for (let j = i + 1; j < available.length; j++) {
          const ordJ = available[j];
          if (!ordJ) continue;
          const sumAmt =
            parseFloat(String(ordI.amount || '0')) + parseFloat(String(ordJ.amount || '0'));
          if (Math.abs(sumAmt - opAmt) < 0.01) {
            // Если одинаковый контрагент — высший приоритет
            if (ordI.counterparty?.name && ordI.counterparty?.name === ordJ.counterparty?.name) {
              foundPair = [ordI.id, ordJ.id];
              break;
            }
            if (!foundPair) {
              foundPair = [ordI.id, ordJ.id];
            }
          }
        }
        if (foundPair) break;
      }

      if (foundPair) {
        setSelectedOrderIdsToLink(foundPair);
        return;
      }

      // 3. Fallback: рейс по дате или первый в списке
      const best =
        orders.find((o) => !o.is_already_linked && (o.is_match_amount || o.is_match_date)) ||
        orders[0];
      if (best) {
        setSelectedOrderIdsToLink([best.id]);
      }
    }
  }, [linkableOrdersData, linkingBankOp, linkMode]);

  const linkBankOpMutation = useMutation({
    mutationFn: async ({
      operationId,
      tripOrderId,
      tripOrderIds,
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
      tripOrderIds?: string[];
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
          tripOrderIds,
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
      setSelectedOrderIdsToLink([]);
      setLinkOrderSearch('');
      setLinkOrderPeriod('smart');
      setLinkOrderCustomDate('');
      setStoOrderNumber('');
      setStoClientName('');
      setDispatcherDetails('');
      setDispatcherClientName('');
    },
    onError: (err: Error) => {
      console.error('linkBankOp error:', err);
      alert('Ошибка при связывании операции: ' + (err?.message || 'Не удалось связать с рейсом'));
    },
  });

  // Navigation shifts
  function shiftDay(days: number) {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    const nextStr = d.toISOString().slice(0, 10);
    setSelectedDate(nextStr);
  }

  function shiftPeriod(delta: number) {
    if (period === 'day') {
      shiftDay(delta);
    } else if (period === 'week') {
      shiftDay(delta * 7);
    } else if (period === 'month') {
      const d = new Date(selectedDate + 'T12:00:00');
      d.setDate(1);
      d.setMonth(d.getMonth() + delta);
      setSelectedDate(d.toISOString().slice(0, 10));
    }
  }

  function formatTxTime(dStr: string | Date | null | undefined): string {
    if (!dStr) return '—';
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return '—';
    if (period === 'day') {
      return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '')} ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
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
    time?: string;
    dateSort?: number;
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
  const creditBankOps = bankOps.filter((op) => {
    if (op.typeOfOperation !== 'Credit') return false;
    if (period === 'day') {
      const opDay = getOpLocalDate(op);
      return !opDay || opDay === selectedDate;
    }
    return true;
  });

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

        // Ищем существующую связь с рейсами в transactions
        const linkedTxs = (data?.transactions ?? []).filter(
          (t) =>
            t.idempotency_key === op.operationId ||
            (op.operationId && t.description?.includes(op.operationId)) ||
            (op.operationId && t.idempotency_key?.startsWith(`${op.operationId}_`)),
        );

        let title = op.description || op.payPurpose || 'Входящий перевод на Р/С';
        let author = payerName;
        let isLinked = false;
        let linkTypeLabel = '';
        let linkedTripNumber: string | number | undefined;
        let linkedDriverName: string | undefined;

        if (linkedTxs.length > 0) {
          isLinked = true;
          if (linkedTxs.length === 1 && linkedTxs[0]) {
            const linkedTx = linkedTxs[0];
            const cleanDesc = (linkedTx.description || '')
              .replace(/\s*\[bank_op:[^\]]+\]/g, '')
              .trim();
            if (cleanDesc.includes('Заказ-наряд')) {
              linkTypeLabel = cleanDesc.replace(/^Оплата\s*/, '').trim();
            } else if (cleanDesc.includes('Диспетчерский')) {
              linkTypeLabel = cleanDesc.replace(/^Оплата\s*/, '').trim();
            } else {
              const linkedOrder = (data?.trip_orders ?? []).find(
                (o) => o.id === linkedTx.trip_order_id,
              );
              const matchNum = cleanDesc.match(/Рейс №(\d+)/);
              linkedTripNumber =
                linkedOrder?.trip?.trip_number || (matchNum ? matchNum[1] : undefined);
              const matchDriver = cleanDesc.match(/\((.+?)\)/);
              linkedDriverName =
                linkedTx.related_user?.name ||
                linkedOrder?.trip?.driver?.name ||
                (matchDriver && matchDriver[1] ? matchDriver[1] : undefined);
              linkTypeLabel = linkedTripNumber
                ? `Рейс №${linkedTripNumber}${linkedDriverName ? ` (${linkedDriverName})` : ''}`
                : 'Рейс автопарка';
            }
            author = linkedDriverName ? `вод. ${linkedDriverName}` : payerName;
            title = cleanDesc || title;
          } else {
            // Связано несколько рейсов автопарка
            const tripNumbers: string[] = [];
            const driverNames: string[] = [];
            for (const tx of linkedTxs) {
              const matchNum = tx.description?.match(/Рейс №(\d+)/);
              if (matchNum && matchNum[1] && !tripNumbers.includes(`№${matchNum[1]}`)) {
                tripNumbers.push(`№${matchNum[1]}`);
              }
              const matchDriver = tx.description?.match(/\((.+?)\)/);
              if (matchDriver && matchDriver[1] && !driverNames.includes(matchDriver[1])) {
                driverNames.push(matchDriver[1]);
              }
            }
            linkTypeLabel =
              tripNumbers.length > 0
                ? `Рейсы: ${tripNumbers.join(', ')}`
                : `${linkedTxs.length} рейса`;
            if (driverNames.length > 0) {
              author = `вод. ${driverNames.join(', ')}`;
            }
            title = `Оплата долга за ${linkedTxs.length} рейса (${tripNumbers.join(', ')})`;
          }
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

        const opDateVal =
          op.trxnPostDate || op.authorizationDate || op.operationDate || op.operationTime;
        incomeItems.push({
          id: `tbank-${op.operationId}`,
          title,
          category: isSbpOrQr ? 'Эквайринг / СБП' : 'Поступление на Р/С',
          wallet: 'bank',
          walletName: 'Р/С Банк (API)',
          author,
          amount: opAmt,
          time: formatTxTime(opDateVal),
          dateSort: opDateVal ? new Date(opDateVal).getTime() : 0,
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
          time: formatTxTime(order.created_at),
          dateSort: new Date(order.created_at).getTime(),
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
        time: formatTxTime(col.created_at),
        dateSort: new Date(col.created_at).getTime(),
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
      const txDate = tx.transaction_date || tx.created_at;
      incomeItems.push({
        id: tx.id,
        title: tx.description || 'Погашение задолженности (нал)',
        category: tx.category?.name || 'Поступление в сейф',
        wallet: w,
        walletName: wName,
        author: tx.counterparty?.name || tx.related_user?.name || 'Администратор',
        amount: parseFloat(tx.amount) || 0,
        time: formatTxTime(txDate),
        dateSort: new Date(txDate).getTime(),
        rawTx: tx,
      });
    }
  });

  if (acquiringTxs.length > 0) {
    if (acquiringTxs.length === 1 && acquiringTxs[0]) {
      const tx = acquiringTxs[0];
      const txDate = tx.transaction_date || tx.created_at;
      incomeItems.push({
        id: tx.id,
        title: tx.description || 'Возмещение по эквайрингу',
        category: 'Эквайринг',
        wallet: 'bank',
        walletName: 'Р/С Банк',
        author: 'Т-Банк Эквайринг',
        amount: parseFloat(tx.amount) || 0,
        time: formatTxTime(txDate),
        dateSort: new Date(txDate).getTime(),
        rawTx: tx,
      });
    } else {
      const sortedAcq = [...acquiringTxs].sort(
        (a, b) =>
          new Date(b.transaction_date || b.created_at).getTime() -
          new Date(a.transaction_date || a.created_at).getTime(),
      );
      const totalAcq = sortedAcq.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      const latestAcq = sortedAcq[0];
      const latestAcqDate = latestAcq ? latestAcq.transaction_date || latestAcq.created_at : null;
      incomeItems.push({
        id: 'group-acquiring',
        title: `Возмещение по эквайрингу (${acquiringTxs.length} реестра)`,
        category: 'Эквайринг',
        wallet: 'bank',
        walletName: 'Р/С Банк',
        author: 'Т-Банк Эквайринг',
        amount: totalAcq,
        time: formatTxTime(latestAcqDate),
        dateSort: latestAcqDate ? new Date(latestAcqDate).getTime() : 0,
        isGroup: true,
        subItems: sortedAcq.map((t) => ({
          id: t.id,
          title: t.description || 'Реестр эквайринга',
          author: t.counterparty?.name || 'Т-Банк',
          amount: parseFloat(t.amount) || 0,
          time: formatTxTime(t.transaction_date || t.created_at),
          rawTx: t,
        })),
      });
    }
  }

  // Сортировка поступлений: новые сверху
  incomeItems.sort((a, b) => (b.dateSort ?? 0) - (a.dateSort ?? 0));

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
    dateSort?: number;
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

  type BankCommItem = {
    id: string;
    title: string;
    author: string;
    amount: number;
    time: string;
    dateSort?: number;
    rawTx?: RawTx;
    bankOp?: TBankOp;
  };

  const bankCommissions: BankCommItem[] = [];
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

    const txDate = tx.transaction_date || tx.created_at;

    if (
      desc.includes('комисси') ||
      cat.includes('комисси') ||
      desc.includes('за входящий перевод') ||
      desc.includes('плата за обслуживание')
    ) {
      bankCommissions.push({
        id: tx.id,
        title: tx.description || 'Комиссия банка',
        author: tx.counterparty?.name || 'Т-Банк',
        amount: parseFloat(tx.amount) || 0,
        time: formatTxTime(txDate),
        dateSort: new Date(txDate).getTime(),
        rawTx: tx,
      });
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

      const txTime = formatTxTime(txDate);
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
        dateSort: new Date(txDate).getTime(),
        rawTx: tx,
        linkedObligationId: oblId,
        linkedObligationTitle: oblTitle,
      });
    }
  });

  // 2. Банковские списания напрямую из API Т-Банка (если ещё не заведены в transactions)
  if (data?.bank_operations && data.bank_operations.length > 0) {
    const debitBankOps = data.bank_operations.filter((op) => {
      if (op.typeOfOperation !== 'Debit') return false;
      if (activeWallet !== 'all' && activeWallet !== 'bank') return false;
      if (period === 'day') {
        const opDay = getOpLocalDate(op);
        if (opDay && opDay !== selectedDate) return false;
      }
      return !(data?.transactions ?? []).some((t) => t.idempotency_key === op.operationId);
    });

    debitBankOps.forEach((op) => {
      const desc = (op.description || op.payPurpose || '').toLowerCase();
      const opAmt = op.operationAmount || op.rubleAmount || 0;
      const dateVal =
        op.trxnPostDate || op.authorizationDate || op.operationDate || op.operationTime;
      const opTime = formatTxTime(dateVal);
      const opDateSort = dateVal ? new Date(dateVal).getTime() : 0;

      if (
        desc.includes('комисси') ||
        desc.includes('плата за') ||
        desc.includes('тариф') ||
        op.category === 'commission'
      ) {
        bankCommissions.push({
          id: `tbank-deb-${op.operationId}`,
          title: op.description || op.payPurpose || 'Комиссия банка',
          author: 'Т-Банк (Авто)',
          amount: opAmt,
          time: opTime,
          dateSort: opDateSort,
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
          dateSort: opDateSort,
          bankOp: op,
        });
      }
    });
  }

  // 3. УНИВЕРСАЛЬНАЯ ГРУППИРОВКА ОДНОТИПНЫХ ТРАНЗАКЦИЙ:
  const expenseItems: ExpenseItem[] = [];

  // А) Сгруппированные банковские комиссии
  if (bankCommissions.length > 0) {
    const sortedComm = [...bankCommissions].sort((a, b) => (b.dateSort ?? 0) - (a.dateSort ?? 0));
    if (sortedComm.length === 1 && sortedComm[0]) {
      const comm = sortedComm[0];
      expenseItems.push({
        id: comm.id,
        title: comm.title,
        category: 'Банковские услуги',
        wallet: 'bank',
        walletName: 'Р/С Банк',
        author: comm.author,
        amount: comm.amount,
        time: comm.time,
        dateSort: comm.dateSort,
        rawTx: comm.rawTx,
        bankOp: comm.bankOp,
      });
    } else {
      const totalComm = sortedComm.reduce((s, t) => s + t.amount, 0);
      const latestComm = sortedComm[0];
      expenseItems.push({
        id: 'group-bank-commission',
        title: `Банковские комиссии (${sortedComm.length} списаний)`,
        category: 'Банковские услуги',
        wallet: 'bank',
        walletName: 'Р/С Банк',
        author: 'Т-Банк (Авто)',
        amount: totalComm,
        time: latestComm?.time,
        dateSort: latestComm?.dateSort,
        isGroup: true,
        subItems: sortedComm.map((t) => ({
          id: t.id,
          title: t.title,
          author: t.author,
          amount: t.amount,
          time: t.time,
          category: 'Банковские услуги',
          wallet: 'bank' as const,
          walletName: 'Р/С Банк',
          rawTx: t.rawTx,
          bankOp: t.bankOp,
        })),
      });
    }
  }

  // Б) Сгруппированные зарплаты
  if (payrollTxs.length > 0) {
    const sortedPay = [...payrollTxs].sort(
      (a, b) =>
        new Date(b.transaction_date || b.created_at).getTime() -
        new Date(a.transaction_date || a.created_at).getTime(),
    );
    if (sortedPay.length === 1 && sortedPay[0]) {
      const tx = sortedPay[0];
      const txDate = tx.transaction_date || tx.created_at;
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
        time: formatTxTime(txDate),
        dateSort: new Date(txDate).getTime(),
        rawTx: tx,
      });
    } else {
      const totalPay = sortedPay.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      const latestPay = sortedPay[0];
      const latestPayDate = latestPay ? latestPay.transaction_date || latestPay.created_at : null;
      expenseItems.push({
        id: 'group-payroll',
        title: `Выплата зарплаты сотрудникам (${sortedPay.length} выплат)`,
        category: 'ФОТ / Зарплата',
        wallet: 'bank',
        walletName: 'Сводная выплата',
        author: 'Бухгалтерия / Директор',
        amount: totalPay,
        time: formatTxTime(latestPayDate),
        dateSort: latestPayDate ? new Date(latestPayDate).getTime() : 0,
        isGroup: true,
        subItems: sortedPay.map((t) => ({
          id: t.id,
          title: t.description || 'Зарплата / Аванс',
          author: t.related_user?.name || 'Сотрудник',
          amount: parseFloat(t.amount) || 0,
          time: formatTxTime(t.transaction_date || t.created_at),
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
    const sortedFuel = [...fuelTxs].sort(
      (a, b) =>
        new Date(b.transaction_date || b.created_at).getTime() -
        new Date(a.transaction_date || a.created_at).getTime(),
    );
    if (sortedFuel.length === 1 && sortedFuel[0]) {
      const tx = sortedFuel[0];
      const txDate = tx.transaction_date || tx.created_at;
      expenseItems.push({
        id: tx.id,
        title: tx.description || 'Заправка ГСМ',
        category: 'ГСМ',
        categoryId: tx.category_id,
        wallet: 'fuel_card',
        walletName: 'Топливная карта',
        author: tx.related_user?.name || 'Водитель',
        amount: parseFloat(tx.amount) || 0,
        time: formatTxTime(txDate),
        dateSort: new Date(txDate).getTime(),
        rawTx: tx,
      });
    } else {
      const totalFuel = sortedFuel.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      const latestFuel = sortedFuel[0];
      const latestFuelDate = latestFuel
        ? latestFuel.transaction_date || latestFuel.created_at
        : null;
      expenseItems.push({
        id: 'group-fuel',
        title: `Заправки автопарка (${sortedFuel.length} транзакций)`,
        category: 'ГСМ / Топливо',
        wallet: 'fuel_card',
        walletName: 'Топливная карта',
        author: 'Водители парка',
        amount: totalFuel,
        time: formatTxTime(latestFuelDate),
        dateSort: latestFuelDate ? new Date(latestFuelDate).getTime() : 0,
        isGroup: true,
        subItems: sortedFuel.map((t) => ({
          id: t.id,
          title: t.description || 'Заправка ТС',
          author: t.related_user?.name || 'Водитель',
          amount: parseFloat(t.amount) || 0,
          time: formatTxTime(t.transaction_date || t.created_at),
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
    const sortedList = [...list].sort((a, b) => (b.dateSort ?? 0) - (a.dateSort ?? 0));
    if (sortedList.length === 1 && sortedList[0]) {
      expenseItems.push(sortedList[0]);
    } else if (sortedList.length > 1 && sortedList[0]) {
      const first = sortedList[0];
      const sumAmt = sortedList.reduce((s, it) => s + it.amount, 0);
      const groupTitle = `${first.category} (${sortedList.length} операций)`;
      const groupId = `group-cat-${catKey.slice(0, 30)}-${sortedList.length}`;
      expenseItems.push({
        id: groupId,
        title: groupTitle,
        category: first.category,
        categoryId: first.categoryId,
        wallet: first.wallet,
        walletName: sortedList.every((it) => it.wallet === first.wallet)
          ? first.walletName
          : 'Разные счета',
        author: first.author,
        amount: sumAmt,
        time: first.time,
        dateSort: first.dateSort,
        isGroup: true,
        subItems: sortedList.map((it) => ({
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

  // Сортировка расходов: новые сверху
  expenseItems.sort((a, b) => (b.dateSort ?? 0) - (a.dateSort ?? 0));

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
  const monthStrip = React.useMemo(() => {
    const now = new Date();
    const sel = new Date(selectedDate + 'T12:00:00Z');
    const monthsDiff =
      (now.getFullYear() - sel.getFullYear()) * 12 + (now.getMonth() - sel.getMonth());
    let startOffset = 4;
    let baseDate = now;
    if (monthsDiff >= 5 || monthsDiff < 0) {
      baseDate = sel;
      startOffset = 2;
    }

    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(baseDate);
      d.setDate(1);
      d.setMonth(d.getMonth() - (startOffset - i));
      const ym = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString('ru-RU', { month: 'short' }).toUpperCase();
      return { ym, label, isCurrent: selectedDate.startsWith(ym) };
    });
  }, [selectedDate]);

  // Week navigation strips (like Review page)
  const weekStrip = React.useMemo(() => {
    const list = [];
    const base = new Date(selectedDate + 'T12:00:00');
    for (let i = -2; i <= 2; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i * 7);
      const { weekStart, weekEnd } = getWeekDates(d.toISOString().slice(0, 10));
      const ws = new Date(weekStart + 'T12:00:00');
      const we = new Date(weekEnd + 'T12:00:00');
      list.push({
        date: weekStart,
        label: `${ws.getDate()} ${ws.toLocaleDateString('ru-RU', { month: 'short' })} — ${we.getDate()} ${we.toLocaleDateString('ru-RU', { month: 'short' })}`,
        isCurrent: getWeekDates(selectedDate).weekStart === weekStart,
      });
    }
    return list;
  }, [selectedDate]);

  return (
    <div className="space-y-3 font-sans pb-10">
      {/* ── 1. LIGHT CRISP DATE & PERIOD NAVIGATOR (Review Style: Day / Week / Month + Big Buttons) ── */}
      <div className="bg-white border-2 border-slate-300 rounded-2xl shadow-subtle overflow-hidden flex flex-col text-slate-800">
        {/* Top Bar: Title + Period Selector (Day / Week / Month) + Quick Actions */}
        <div className="flex flex-wrap border-b border-slate-300 bg-slate-100/80 px-3 py-2 items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-800">
              СУТОЧНЫЙ БАЛАНС И КОНТРОЛЬ КАССЫ
            </span>
          </div>

          {/* Period Mode Selector: [ ДЕНЬ ] [ НЕДЕЛЯ ] [ МЕСЯЦ ] */}
          <div className="flex bg-slate-200/80 p-0.5 rounded-xl border border-slate-300 max-w-xs w-full sm:w-auto">
            <button
              onClick={() => setPeriod('day')}
              className={`flex-1 sm:px-4 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                period === 'day'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-300/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              День
            </button>
            <button
              onClick={() => setPeriod('week')}
              className={`flex-1 sm:px-4 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                period === 'week'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-300/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Неделя
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`flex-1 sm:px-4 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                period === 'month'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-300/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Месяц
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => openManualModal('expense')}
              className="inline-flex items-center gap-1 text-[11px] font-black bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 px-2.5 py-1 rounded-lg transition shadow-2xs cursor-pointer"
              title="Внести расход / списание вручную"
            >
              <span>−</span>
              <span>Списание</span>
            </button>
            <button
              onClick={() => openManualModal('income')}
              className="inline-flex items-center gap-1 text-[11px] font-black bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-lg transition shadow-2xs cursor-pointer"
              title="Внести доход / пополнение вручную"
            >
              <span>+</span>
              <span>Пополнение</span>
            </button>

            {data?.audit?.status === 'confirmed' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-lg">
                ✓ СЕЙФ ПОДТВЕРЖДЁН (19:30)
              </span>
            ) : data?.audit?.status === 'discrepancy' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-lg">
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
                className="text-[11px] font-black bg-amber-100 hover:bg-amber-200 text-amber-950 px-2.5 py-1 rounded-lg transition border border-amber-400 shadow-2xs cursor-pointer"
              >
                🔒 ПРОВЕРИТЬ СЕЙФ (19:30)
              </button>
            )}

            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1 text-[11px] text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 px-2.5 py-1 rounded-lg transition cursor-pointer border border-slate-300 disabled:opacity-50 shadow-2xs"
              title="Запросить свежую выписку из Т-Банка прямо сейчас"
            >
              <span className={`text-[10px] ${isFetching ? 'animate-spin inline-block' : ''}`}>
                🔄
              </span>
              <span>{isFetching ? 'Синхронизация...' : 'Обновить'}</span>
            </button>
            <span className="text-[10px] text-slate-600 font-mono bg-white px-2 py-0.5 rounded border border-slate-300">
              API: {bankWallet?.api_synced ? '🟢 Live' : '⚪ DB'}
            </span>
          </div>
        </div>

        {/* Middle Date Bar - BIG SWITCH BUTTONS (Height h-14, width w-28 sm:w-40) */}
        <div className="flex items-stretch h-14 bg-white border-b border-slate-300">
          <button
            onClick={() => shiftPeriod(-1)}
            className="w-28 sm:w-40 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 transition-colors text-white shrink-0 group border-r border-sky-600 flex items-center justify-center gap-1 cursor-pointer"
            title="Предыдущий период"
            aria-label="Предыдущий период"
          >
            <span className="text-3xl font-black group-hover:-translate-x-1.5 transition-transform select-none">
              ←
            </span>
            <span className="text-xs font-black uppercase tracking-tight hidden sm:inline">
              Назад
            </span>
          </button>

          <div
            className="flex-1 flex items-center justify-center gap-3 px-3 cursor-pointer hover:bg-slate-50 transition"
            onClick={() => setSelectedDate(todayStr)}
            title="Нажмите, чтобы вернуться к сегодняшнему дню"
          >
            <span className="text-sky-600 text-xl font-bold">📅</span>
            <div className="flex items-center gap-2.5 flex-wrap justify-center">
              <span className="text-sm sm:text-base md:text-lg font-black tracking-tight text-slate-900 uppercase font-display">
                {formatPeriodHeader(selectedDate, period)}
              </span>
              {selectedDate === todayStr && period === 'day' && (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-300 font-mono">
                  СЕГОДНЯ
                </span>
              )}
              {selectedDate !== todayStr && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDate(todayStr);
                  }}
                  className="text-[10px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 px-2 py-0.5 rounded-full border border-sky-200 transition cursor-pointer"
                >
                  → вернуться к сегодня
                </button>
              )}
            </div>
          </div>

          <button
            onClick={() => shiftPeriod(1)}
            className="w-28 sm:w-40 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 transition-colors text-white shrink-0 group border-l border-sky-600 flex items-center justify-center gap-1 cursor-pointer"
            title="Следующий период"
            aria-label="Следующий период"
          >
            <span className="text-xs font-black uppercase tracking-tight hidden sm:inline">
              Вперёд
            </span>
            <span className="text-3xl font-black group-hover:translate-x-1.5 transition-transform select-none">
              →
            </span>
          </button>
        </div>

        {/* Bottom Strip: Month strip (for Day / Month) or Week strip (for Week) */}
        {period !== 'week' ? (
          <div className="grid grid-cols-5 text-center text-xs font-bold divide-x divide-slate-300 bg-slate-100/70">
            {monthStrip.map((m) => (
              <button
                key={m.ym}
                onClick={() => {
                  const target = m.ym === todayStr.slice(0, 7) ? todayStr : `${m.ym}-01`;
                  setSelectedDate(target);
                  setPeriod('month');
                }}
                className={`py-2 text-[11px] font-bold tracking-wider transition cursor-pointer ${
                  m.isCurrent
                    ? 'bg-white text-sky-800 font-black border-b-2 border-sky-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex overflow-x-auto text-xs font-bold divide-x divide-slate-300 bg-slate-100/70 scrollbar-none">
            {weekStrip.map((w) => (
              <button
                key={w.date}
                onClick={() => {
                  setSelectedDate(w.date);
                  setPeriod('week');
                }}
                className={`flex-1 py-2 px-3 min-w-[130px] text-[11px] font-bold tracking-wide transition whitespace-nowrap text-center cursor-pointer ${
                  w.isCurrent
                    ? 'bg-white text-sky-800 font-black border-b-2 border-sky-600 shadow-2xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 2. BRIGHT WALLET SELECTOR BUTTONS ── */}
      <div className="flex items-center gap-1.5 bg-white p-2 rounded-xl border border-slate-300 shadow-2xs overflow-x-auto text-xs">
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider pl-1.5 pr-1">
          Кошелёк:
        </span>

        {/* All Wallets */}
        <button
          onClick={() => setActiveWallet('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
            activeWallet === 'all'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
          }`}
        >
          🌐 Все 3 кошелька
        </button>

        {/* Bank */}
        <button
          onClick={() => setActiveWallet('bank')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer border ${
            activeWallet === 'bank'
              ? 'bg-sky-500 text-white border-sky-600 shadow-2xs'
              : 'bg-white text-slate-700 hover:bg-sky-50 hover:text-sky-900 border-slate-300'
          }`}
        >
          <span>🏦</span>
          <span>Р/С БАНК</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
              activeWallet === 'bank'
                ? 'bg-sky-700 text-white'
                : 'bg-sky-50 text-sky-800 border border-sky-100'
            }`}
          >
            {rub(bankWallet?.evening ?? 0)}
          </span>
        </button>

        {/* Cash Safe */}
        <button
          onClick={() => setActiveWallet('cash')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer border ${
            activeWallet === 'cash'
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
              : 'bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 border-slate-300'
          }`}
        >
          <span>🔒</span>
          <span>СЕЙФ (НАЛ)</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
              activeWallet === 'cash'
                ? 'bg-emerald-800 text-white'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
            }`}
          >
            {rub(cashWallet?.evening ?? 0)}
          </span>
        </button>

        {/* Fuel Card */}
        <button
          onClick={() => setActiveWallet('fuel_card')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer border ${
            activeWallet === 'fuel_card'
              ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
              : 'bg-white text-slate-700 hover:bg-amber-50 hover:text-amber-900 border-slate-300'
          }`}
        >
          <span>⛽</span>
          <span>ТОПЛИВНАЯ КАРТА</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
              activeWallet === 'fuel_card'
                ? 'bg-amber-700 text-white'
                : 'bg-amber-50 text-amber-800 border border-amber-100'
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

      {/* ── 4. TOP SUMMARY CARDS (Crisp Pro Light 0% Black) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {/* Morning Total */}
        <div className="bg-white rounded-xl p-3 border-2 border-slate-300 shadow-2xs relative overflow-hidden">
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
            {activeWallet === 'all'
              ? `ОСТАТОК НА НАЧАЛО ${period === 'day' ? '(00:00)' : period === 'week' ? 'НЕДЕЛИ' : 'МЕСЯЦА'}`
              : `НАЧАЛЬНЫЙ ОСТАТОК ${period === 'day' ? '(00:00)' : period === 'week' ? 'НЕДЕЛИ' : 'МЕСЯЦА'}`}
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-slate-900 mt-0.5 leading-tight">
            {rub(morningTotal)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {activeWallet === 'all' ? 'Банк + Сейф + Топливо' : 'По выбранной статье'}
          </div>
        </div>

        {/* Expenses Total */}
        <div className="bg-rose-50/50 rounded-xl p-3 border-2 border-rose-300 shadow-2xs relative overflow-hidden">
          <div className="text-[9px] font-black uppercase tracking-wider text-rose-700">
            РАСХОДЫ ЗА {period === 'day' ? 'ДЕНЬ' : period === 'week' ? 'НЕДЕЛЮ' : 'МЕСЯЦ'}
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-rose-600 mt-0.5 leading-tight">
            -{rub(totalDayExpenses)}
          </div>
          <div className="text-[10px] text-rose-700/80 mt-0.5">
            {expenseItems.length} позиций расходов
          </div>
        </div>

        {/* Incomes Total */}
        <div className="bg-emerald-50/50 rounded-xl p-3 border-2 border-emerald-300 shadow-2xs relative overflow-hidden">
          <div className="text-[9px] font-black uppercase tracking-wider text-emerald-800">
            ДОХОДЫ ЗА {period === 'day' ? 'ДЕНЬ' : period === 'week' ? 'НЕДЕЛЮ' : 'МЕСЯЦ'}
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-emerald-700 mt-0.5 leading-tight">
            +{rub(totalDayIncomes)}
          </div>
          <div className="text-[10px] text-emerald-700/80 mt-0.5">
            {incomeItems.length} поступлений
          </div>
        </div>

        {/* Evening Balance */}
        <div className="bg-sky-50/50 rounded-xl p-3 border-2 border-sky-300 shadow-2xs relative overflow-hidden">
          <div className="text-[9px] font-black uppercase tracking-wider text-sky-800">
            {activeWallet === 'all'
              ? `ИТОГО В КОНЦЕ ${period === 'day' ? 'ДНЯ' : period === 'week' ? 'НЕДЕЛИ' : 'МЕСЯЦА'}`
              : `КОНЕЧНЫЙ ИТОГ ${period === 'day' ? 'ДНЯ' : period === 'week' ? 'НЕДЕЛИ' : 'МЕСЯЦА'}`}
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-slate-900 mt-0.5 leading-tight">
            {rub(eveningTotal)}
          </div>
          <div className="text-[10px] text-sky-700 font-bold font-mono mt-0.5">
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
                РАСХОДЫ ЗА {period === 'day' ? 'СЕГОДНЯ' : period === 'week' ? 'НЕДЕЛЮ' : 'МЕСЯЦ'}
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
                Нет расходов за выбранный{' '}
                {period === 'day'
                  ? 'день'
                  : period === 'week'
                    ? 'период (неделю)'
                    : 'период (месяц)'}
              </div>
            ) : (
              expenseItems.map((item) =>
                item.isGroup ? (
                  /* ── СГРУППИРОВАННЫЕ ПЛАТЕЖИ (КОМИССИИ И Т.Д.) — ОТДЕЛЬНЫЙ ВЫДЕЛЯЮЩИЙСЯ ДИЗАЙН ── */
                  <div
                    key={item.id}
                    className="bg-slate-50/90 rounded-2xl border-2 border-indigo-200/90 shadow-2xs flex flex-col overflow-hidden transition-all ring-1 ring-indigo-100"
                  >
                    <div className="flex items-stretch flex-1">
                      <div className="w-2 flex-shrink-0 bg-indigo-500" />
                      <div className="p-3.5 flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-950 font-black text-xs uppercase tracking-wider border border-indigo-300">
                              <span>🗂️</span> ГРУППА ПЛАТЕЖЕЙ
                            </span>
                            <span className="text-xs font-black text-slate-900">{item.title}</span>
                            <span className="px-2.5 py-1 rounded-lg bg-white text-indigo-900 text-xs font-black uppercase tracking-wide border border-indigo-200">
                              {item.category}
                            </span>
                            <button
                              onClick={() => toggleGroup(item.id)}
                              className="text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                            >
                              <span>
                                {expandedGroups[item.id] ? '▲ Свернуть' : '▼ Раскрыть детализацию'}
                              </span>
                              <span className="bg-indigo-800 text-indigo-100 px-1.5 py-0.2 rounded text-[10px]">
                                {item.subItems?.length} списаний
                              </span>
                            </button>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1.5 flex-wrap">
                            <span className="px-1.5 py-0.2 rounded font-bold border text-[10px] bg-sky-50 text-sky-800 border-sky-200">
                              🏦 {item.walletName}
                            </span>
                            <span>·</span>
                            <span className="text-slate-600 font-medium">{item.author}</span>
                            <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-semibold">
                              {item.subItems?.length} микро-платежей объединены, чтобы не засорять
                              ленту
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                          <div className="text-sm font-black font-mono text-indigo-950 bg-indigo-100/80 px-2.5 py-1 rounded-xl border border-indigo-200">
                            -{rub(item.amount)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {expandedGroups[item.id] && item.subItems && (
                      <div className="w-full bg-white/95 border-t border-indigo-200 p-3 space-y-1.5 pl-6">
                        <div className="text-[10px] font-black uppercase text-indigo-900 tracking-wider">
                          СПИСОК ВСЕХ СПИСАНИЙ В ГРУППЕ ({item.subItems.length}):
                        </div>
                        <div className="space-y-1">
                          {item.subItems.map((sub) => (
                            <div
                              key={sub.id}
                              className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 px-2 rounded-lg"
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-mono text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                                  {sub.time}
                                </span>
                                <span className="font-semibold text-slate-800">{sub.title}</span>
                                <span className="text-[10px] text-slate-400">({sub.author})</span>
                              </div>
                              <div className="font-mono font-black text-rose-600 ml-2 flex-shrink-0">
                                -{rub(sub.amount)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── СТАНДАРТНОЕ СПИСАНИЕ: СТАТЬЯ РАСХОДОВ КРУПНО И НАГЛЯДНО ── */
                  <div
                    key={item.id}
                    className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs flex flex-col overflow-hidden group transition border-l-4 border-l-rose-500"
                  >
                    <div className="flex items-stretch flex-1">
                      <div
                        className={`w-1 flex-shrink-0 group-hover:w-1.5 transition-all ${
                          item.wallet === 'fuel_card'
                            ? 'bg-amber-500'
                            : item.wallet === 'cash'
                              ? 'bg-emerald-500'
                              : 'bg-rose-500'
                        }`}
                      />
                      <div className="p-3 flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
                        {/* Zone 1: Info with PROMINENT Category Tag */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* 🏷️ СТАТЬЯ РАСХОДОВ КРУПНО */}
                            <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-950 text-xs font-black uppercase tracking-wide border border-rose-300 shadow-2xs flex items-center gap-1 flex-shrink-0">
                              <span>🏷️</span>
                              <span>{item.category || 'Без статьи'}</span>
                            </span>

                            <span
                              className="text-xs font-black text-slate-900 line-clamp-2 leading-tight break-words max-w-[420px]"
                              title={item.title}
                            >
                              {item.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1.5 flex-wrap">
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
                                <span className="font-mono text-slate-400 font-bold">
                                  {item.time}
                                </span>
                              </>
                            )}
                            <span>·</span>
                            <span className="text-slate-500">{item.author}</span>
                          </div>
                        </div>

                        {/* Zone 2: Plan Link & Warehouse Badge */}
                        <div className="flex-shrink-0 self-start sm:self-center flex flex-col sm:flex-row items-start sm:items-center gap-1.5">
                          {item.linkedObligationTitle ? (
                            <div className="inline-flex items-center gap-1.5 bg-blue-50/90 text-blue-950 border-2 border-blue-200 text-[11px] font-black px-2.5 py-1 rounded-xl shadow-2xs">
                              <span>📅</span>
                              <span>{item.linkedObligationTitle}</span>
                              <span className="text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded text-[10px]">
                                ✓ Закрыт
                              </span>
                            </div>
                          ) : null}

                          {item.rawTx?.warehouse_parts && item.rawTx.warehouse_parts.length > 0 ? (
                            <div
                              className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-950 border-2 border-sky-300 text-[11px] font-black px-2.5 py-1 rounded-xl shadow-2xs"
                              title={item.rawTx.warehouse_parts
                                .map(
                                  (p) => `${p.name} (+${p.quantity} шт, ${rub(p.unit_price || 0)})`,
                                )
                                .join('\n')}
                            >
                              <span>📦</span>
                              <span>
                                {item.rawTx.warehouse_parts.length === 1
                                  ? `Склад: ${item.rawTx.warehouse_parts[0]!.name}`
                                  : `Склад: ${item.rawTx.warehouse_parts.length} дет. (${item.rawTx.warehouse_parts[0]!.name}...)`}
                              </span>
                              <span className="text-sky-700 bg-sky-100 font-black px-1.5 py-0.2 rounded text-[10px]">
                                +
                                {item.rawTx.warehouse_parts.reduce(
                                  (acc, p) => acc + (Number(p.quantity) || 1),
                                  0,
                                )}{' '}
                                шт
                              </span>
                            </div>
                          ) : item.rawTx?.warehouse_part ? (
                            <div className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-950 border-2 border-sky-300 text-[11px] font-black px-2.5 py-1 rounded-xl shadow-2xs">
                              <span>📦</span>
                              <span>Склад: {item.rawTx.warehouse_part.name}</span>
                              <span className="text-sky-700 bg-sky-100 font-black px-1.5 py-0.2 rounded text-[10px]">
                                +{item.rawTx.warehouse_part.quantity} шт
                              </span>
                            </div>
                          ) : null}

                          {!item.linkedObligationTitle &&
                            !item.rawTx?.warehouse_part &&
                            !(
                              item.rawTx?.warehouse_parts && item.rawTx.warehouse_parts.length > 0
                            ) && (
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
                                  (op
                                    ? op.trxnPostDate ||
                                      op.authorizationDate ||
                                      op.operationDate ||
                                      op.operationTime
                                    : selectedDate),
                                obligationId: item.linkedObligationId || null,
                                relatedUserId:
                                  raw?.related_user_id || raw?.related_user?.id || null,
                                warehousePart: raw?.warehouse_part || null,
                                warehouseParts:
                                  raw?.warehouse_parts ||
                                  (raw?.warehouse_part ? [raw.warehouse_part] : []),
                              });
                            }}
                            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 flex items-center justify-center text-xs font-black cursor-pointer shadow-2xs transition"
                            title="Редактировать / изменить статью"
                          >
                            ✏️
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ),
              )
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
                ДОХОДЫ ЗА {period === 'day' ? 'СЕГОДНЯ' : period === 'week' ? 'НЕДЕЛЮ' : 'МЕСЯЦ'}
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
                Нет поступлений за выбранный{' '}
                {period === 'day'
                  ? 'день'
                  : period === 'week'
                    ? 'период (неделю)'
                    : 'период (месяц)'}
              </div>
            ) : (
              incomeItems.map((item) => (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl border shadow-2xs flex flex-col overflow-hidden group transition ${
                    !item.isLinked && item.canLinkToTrip
                      ? 'border-amber-400 hover:border-amber-500 bg-amber-50/20 border-l-4 border-l-amber-500'
                      : 'border-slate-300 hover:border-slate-400 border-l-4 border-l-emerald-500'
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
                          {item.time && (
                            <>
                              <span>·</span>
                              <span className="font-mono text-slate-400">{item.time}</span>
                            </>
                          )}
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
                                      operationDate:
                                        item.bankOp?.trxnPostDate ||
                                        item.bankOp?.authorizationDate ||
                                        item.bankOp?.operationDate,
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
                                  autoSelectedOpIdRef.current = null;
                                  setLinkingBankOp(item.bankOp!);
                                  setLinkMode('trip');
                                  setLinkOrderSearch('');
                                  setLinkOrderPeriod('smart');
                                  setLinkOrderCustomDate('');
                                  if (item.suggestedOrder) {
                                    setSelectedOrderIdsToLink([item.suggestedOrder.id]);
                                    autoSelectedOpIdRef.current = item.bankOp!.operationId;
                                  } else {
                                    setSelectedOrderIdsToLink([]);
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
                                toWalletId:
                                  item.rawTx!.to_wallet_id ||
                                  (item.wallet === 'cash' ? CASH_ID : BANK_ID),
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
                                    toWalletId:
                                      sub.rawTx!.to_wallet_id ||
                                      (item.wallet === 'cash' ? CASH_ID : BANK_ID),
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
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingTx(null);
          }}
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header (fixed shrink-0) */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 flex-shrink-0 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <span className="text-base">✎</span>
                <span className="text-sm font-black uppercase text-slate-800">
                  {editingTx.direction === 'income'
                    ? 'Классификация и редактирование поступления'
                    : 'Классификация и редактирование расхода'}
                </span>
              </div>
              <button
                onClick={() => setEditingTx(null)}
                className="w-7 h-7 rounded-lg hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 text-sm font-bold flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 overscroll-contain">
              {/* Amount & Date Card */}
              <div
                className={
                  editingTx.direction === 'income'
                    ? 'bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3 flex items-center justify-between'
                    : 'bg-rose-50/60 border border-rose-200/80 rounded-xl p-3 flex items-center justify-between'
                }
              >
                <div>
                  <div
                    className={
                      editingTx.direction === 'income'
                        ? 'text-[10px] font-black uppercase text-emerald-800 tracking-wider'
                        : 'text-[10px] font-black uppercase text-rose-800 tracking-wider'
                    }
                  >
                    {editingTx.direction === 'income' ? 'Сумма поступления' : 'Сумма списания'}
                  </div>
                  <div
                    className={
                      editingTx.direction === 'income'
                        ? 'text-lg font-black font-mono text-emerald-600 mt-0.5'
                        : 'text-lg font-black font-mono text-rose-600 mt-0.5'
                    }
                  >
                    {editingTx.direction === 'income' ? '+' : '-'}
                    {rub(editingTx.amount)}
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

              {/* Description */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-700 tracking-wider">
                  Название / точное назначение (куда ушли деньги) *
                </label>
                <input
                  type="text"
                  value={editingTx.description}
                  onChange={(e) => {
                    const newDesc = e.target.value;
                    const prevDesc = editingTx.description;
                    setEditingTx({ ...editingTx, description: newDesc });
                    // Если у нас 1 деталь в складе и ее имя совпадало со старым описанием
                    if (
                      whItems.length === 1 &&
                      (whItems[0]!.name === prevDesc || !whItems[0]!.name)
                    ) {
                      setWhItems([{ ...whItems[0]!, name: newDesc }]);
                    }
                    const detected = detectBrandFromText(newDesc);
                    if (detected && whItems.length === 1) {
                      setWhItems([{ ...whItems[0]!, brand: detected }]);
                    }
                  }}
                  placeholder="Например: Пополнение топливной карты, Запчасти на Газель, Кредит Тинькофф"
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-700 tracking-wider">
                  {editingTx.direction === 'income'
                    ? 'Статья доходов / категория'
                    : 'Статья расходов (Группа расходов) *'}
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
                    const isPartsCat = (catObj?.name || '').toLowerCase().includes('запчаст');
                    if (isPartsCat && editingTx.direction !== 'income') {
                      setWhEnabled(true);
                      if (whItems.length === 0) {
                        setWhItems([
                          {
                            id: `wh-${Date.now()}`,
                            brand: detectBrandFromText(editingTx.description),
                            clientCarModel: '',
                            name: editingTx.description,
                            article: '',
                            quantity: 1,
                            unitPrice: editingTx.amount,
                          },
                        ]);
                      }
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
                  <option value="">
                    {editingTx.direction === 'income'
                      ? '(Выберите статью поступления)'
                      : '(Выберите статью расходов)'}
                  </option>
                  {getFilteredCategories(
                    data?.categories,
                    editingTx.direction,
                    editingTx.categoryId,
                  ).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination wallet for income */}
              {editingTx.direction === 'income' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-emerald-900 tracking-wider">
                    📥 Зачислить в кошелёк / на счёт:
                  </label>
                  <select
                    value={editingTx.toWalletId || BANK_ID}
                    onChange={(e) => setEditingTx({ ...editingTx, toWalletId: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-emerald-300 rounded-lg bg-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value={BANK_ID}>💳 Расчётный счёт (Банк / Р/С)</option>
                    <option value={CASH_ID}>🔒 Сейф (Наличные)</option>
                    <option value={FUEL_CARD_ID}>⛽ Топливная карта (ГСМ)</option>
                  </select>
                </div>
              )}

              {/* Destination wallet (for Fuel Card / Inter-wallet transfer) */}
              {editingTx.direction !== 'income' &&
                (editingTx.categoryId === '62cebf3f-9982-4cc6-904b-48c6169cf5e4' ||
                  editingTx.categoryId === 'b9946a5e-4a33-4ed9-a272-5dee12d4ca93' ||
                  (editingTx.categoryName || '').toLowerCase().includes('перевод') ||
                  (editingTx.description || '').toLowerCase().includes('перевод') ||
                  (editingTx.description || '').toLowerCase().includes('топливн') ||
                  (editingTx.description || '').toLowerCase().includes('пополнение тк') ||
                  (editingTx.description || '').toLowerCase().includes('гсм')) && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-amber-900 tracking-wider">
                      🔄 Зачислить на кошелек / карту:
                    </label>
                    <select
                      value={editingTx.toWalletId || ''}
                      onChange={(e) =>
                        setEditingTx({ ...editingTx, toWalletId: e.target.value || null })
                      }
                      className="w-full px-3 py-2 text-xs border border-amber-300 rounded-lg bg-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value={BANK_ID}>💳 Расчётный счёт (Банк / Р/С)</option>
                      <option value={CASH_ID}>🔒 Сейф (Наличные)</option>
                      <option value={FUEL_CARD_ID}>⛽ Топливная карта (ГСМ)</option>
                      <option value="">(Не переводить, оставить прямым списанием)</option>
                    </select>
                    <div className="text-[10px] text-amber-800">
                      💡 При выборе кошелька баланс автоматически пополнится на эту сумму (+
                      {rub(editingTx.amount)}).
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

              {/* ── МУЛЬТИПОЗИЦИОННОЕ ОПРИХОДОВАНИЕ НА СКЛАД (ГАРАЖ) ── */}
              {editingTx.direction !== 'income' && (
                <div
                  className={`p-3.5 rounded-xl border transition-all ${
                    whEnabled
                      ? 'bg-sky-50/80 border-sky-300 ring-2 ring-sky-100'
                      : 'bg-slate-50/70 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={whEnabled}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setWhEnabled(checked);
                          if (checked && whItems.length === 0) {
                            setWhItems([
                              {
                                id: `wh-${Date.now()}`,
                                brand: detectBrandFromText(editingTx.description),
                                clientCarModel: '',
                                name: editingTx.description,
                                article: '',
                                quantity: 1,
                                unitPrice: editingTx.amount,
                              },
                            ]);
                          }
                        }}
                        className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500 accent-sky-600 cursor-pointer"
                      />
                      <span className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                        <span>📦</span> Оприходовать на Склад запчастей (Гараж)
                      </span>
                    </label>
                    {whEnabled && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-200/80 text-sky-900 border border-sky-300">
                        {whItems.length} {whItems.length === 1 ? 'деталь' : 'детали(ей)'}
                      </span>
                    )}
                  </div>

                  {whEnabled && (
                    <div className="mt-3 space-y-3 pt-3 border-t border-sky-200/60">
                      {/* Сводка распределения сумм */}
                      {(() => {
                        const totalWhSum = whItems.reduce(
                          (acc, it) =>
                            acc + (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
                          0,
                        );
                        const diff = editingTx.amount - totalWhSum;
                        return (
                          <div className="bg-white/80 p-2.5 rounded-xl border border-sky-200 flex items-center justify-between flex-wrap gap-2 text-xs">
                            <div className="flex items-center gap-3">
                              <div>
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                                  Чек списания:
                                </span>
                                <span className="font-mono font-black text-rose-600 text-sm">
                                  {rub(editingTx.amount)}
                                </span>
                              </div>
                              <span className="text-slate-300 font-bold">→</span>
                              <div>
                                <span className="text-[10px] text-sky-700 uppercase font-bold block">
                                  Итого на склад:
                                </span>
                                <span className="font-mono font-black text-sky-800 text-sm">
                                  {rub(totalWhSum)}
                                </span>
                              </div>
                            </div>
                            <div>
                              {Math.abs(diff) < 0.01 ? (
                                <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                  <span>✓</span>
                                  <span>Сумма точно сходится</span>
                                </span>
                              ) : diff > 0 ? (
                                <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                                  <span>ℹ️</span>
                                  <span>Остаток чека: {rub(diff)}</span>
                                </span>
                              ) : (
                                <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-rose-100 text-rose-900 border border-rose-300 flex items-center gap-1">
                                  <span>⚠️</span>
                                  <span>Превышение: +{rub(Math.abs(diff))}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Список позиций деталей */}
                      <div className="space-y-3">
                        {whItems.map((item, idx) => {
                          const itemTotal =
                            (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0);

                          return (
                            <div
                              key={item.id}
                              className="bg-white p-3 rounded-xl border border-sky-200 shadow-2xs space-y-2.5"
                            >
                              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-black flex items-center justify-center">
                                    {idx + 1}
                                  </span>
                                  <span className="text-xs font-black text-slate-800">
                                    Позиция #{idx + 1}
                                  </span>
                                  <span className="text-[10px] font-mono font-black text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                                    {rub(itemTotal)}
                                  </span>
                                </div>
                                {whItems.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setWhItems((prev) => prev.filter((p) => p.id !== item.id))
                                    }
                                    className="text-slate-400 hover:text-rose-600 text-xs font-bold px-2 py-0.5 rounded hover:bg-rose-50 transition cursor-pointer"
                                    title="Удалить эту позицию"
                                  >
                                    ✕ Удалить
                                  </button>
                                )}
                              </div>

                              {/* Выбор марки автомобиля */}
                              <div>
                                <label className="text-[10px] font-black uppercase text-slate-600 tracking-wider block mb-1">
                                  Марка / Автомобиль: *
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1">
                                  {[
                                    { id: 'canter', label: '🚚 Canter', sub: 'Fuso' },
                                    { id: 'gazelle', label: '🚐 ГАЗель', sub: 'Next / Бизнес' },
                                    { id: 'valday', label: '🚛 Валдай', sub: 'ГАЗ-3310' },
                                    { id: 'consumables', label: '🛢️ ГСМ', sub: 'Масла' },
                                    { id: 'client', label: '🚗 Клиент', sub: 'Нива / др.' },
                                  ].map((b) => (
                                    <button
                                      key={b.id}
                                      type="button"
                                      onClick={() => {
                                        setWhItems((prev) =>
                                          prev.map((p) =>
                                            p.id === item.id
                                              ? {
                                                  ...p,
                                                  brand: b.id,
                                                  clientCarModel:
                                                    b.id === 'client' && !p.clientCarModel
                                                      ? 'Нива'
                                                      : p.clientCarModel,
                                                }
                                              : p,
                                          ),
                                        );
                                      }}
                                      className={`p-1.5 rounded-lg text-left border text-xs font-bold transition cursor-pointer ${
                                        item.brand === b.id
                                          ? 'bg-sky-600 text-white border-sky-700 shadow-2xs'
                                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-sky-50'
                                      }`}
                                    >
                                      <div className="font-black text-[11px] leading-tight">
                                        {b.label}
                                      </div>
                                      <div
                                        className={`text-[8px] leading-tight ${
                                          item.brand === b.id ? 'text-sky-100' : 'text-slate-400'
                                        }`}
                                      >
                                        {b.sub}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Если выбрано авто клиента (Нива, Ford, УАЗ и т.д.) */}
                              {item.brand === 'client' && (
                                <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg">
                                  <label className="text-[10px] font-black uppercase text-purple-900 tracking-wider block mb-1">
                                    🚗 Марка / модель клиентского авто:
                                  </label>
                                  <input
                                    type="text"
                                    value={item.clientCarModel}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setWhItems((prev) =>
                                        prev.map((p) =>
                                          p.id === item.id ? { ...p, clientCarModel: val } : p,
                                        ),
                                      );
                                    }}
                                    placeholder="Например: Нива 2121, Нива Шевроле, Ford Transit, УАЗ Патриот"
                                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-purple-300 rounded-md font-bold text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  />
                                </div>
                              )}

                              {/* Наименование и артикул */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div className="sm:col-span-2">
                                  <label className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                                    Наименование детали: *
                                  </label>
                                  <input
                                    type="text"
                                    list={`warehouse-suggestions-${item.id}`}
                                    value={item.name}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const matched = (warehousePartsData?.parts ?? []).find(
                                        (p) => p.name.toLowerCase() === val.toLowerCase(),
                                      );
                                      setWhItems((prev) =>
                                        prev.map((p) =>
                                          p.id === item.id
                                            ? {
                                                ...p,
                                                name: val,
                                                brand: matched?.category || p.brand,
                                                article: matched?.article || p.article,
                                              }
                                            : p,
                                        ),
                                      );
                                    }}
                                    placeholder={
                                      item.brand === 'canter'
                                        ? 'Ремень генератора Fuso Canter'
                                        : item.brand === 'gazelle'
                                          ? 'Колодки тормозные передние Газель'
                                          : item.brand === 'valday'
                                            ? 'Фильтр воздушный Валдай'
                                            : item.brand === 'client'
                                              ? 'Тормозные колодки Нива'
                                              : 'Масло моторное 10W-40'
                                    }
                                    className="w-full mt-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                                  />
                                  <datalist id={`warehouse-suggestions-${item.id}`}>
                                    {(warehousePartsData?.parts ?? [])
                                      .filter(
                                        (p) =>
                                          item.brand === 'all' ||
                                          !p.category ||
                                          p.category === item.brand,
                                      )
                                      .map((p) => (
                                        <option key={p.id} value={p.name}>
                                          {p.article ? `[${p.article}] ` : ''}
                                          {p.name}
                                        </option>
                                      ))}
                                  </datalist>
                                </div>
                                <div>
                                  <label className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                                    Артикул (OEM):
                                  </label>
                                  <input
                                    type="text"
                                    value={item.article}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setWhItems((prev) =>
                                        prev.map((p) =>
                                          p.id === item.id ? { ...p, article: val } : p,
                                        ),
                                      );
                                    }}
                                    placeholder="ME221833"
                                    className="w-full mt-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                                  />
                                </div>
                              </div>

                              {/* Количество и цена */}
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                <div>
                                  <label className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                                    Количество (шт):
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={item.quantity}
                                    onChange={(e) => {
                                      const q = Math.max(1, parseInt(e.target.value) || 1);
                                      setWhItems((prev) =>
                                        prev.map((p) =>
                                          p.id === item.id ? { ...p, quantity: q } : p,
                                        ),
                                      );
                                    }}
                                    className="w-full mt-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                                    Цена за шт (₽):
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={item.unitPrice}
                                    onChange={(e) => {
                                      const val =
                                        e.target.value === ''
                                          ? ''
                                          : Math.max(0, parseFloat(e.target.value) || 0);
                                      setWhItems((prev) =>
                                        prev.map((p) =>
                                          p.id === item.id ? { ...p, unitPrice: val } : p,
                                        ),
                                      );
                                    }}
                                    className="w-full mt-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                                  />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                  <label className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                                    Сумма строки:
                                  </label>
                                  <div className="mt-1 px-2.5 py-1.5 text-xs font-mono font-black text-sky-800 bg-sky-50 border border-sky-300 rounded-lg flex items-center justify-between">
                                    <span>{rub(itemTotal)}</span>
                                    <span className="text-[9px] text-sky-600 font-sans">
                                      ({item.quantity} шт)
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Кнопка добавления следующей детали */}
                      <button
                        type="button"
                        onClick={() => {
                          const currentTotal = whItems.reduce(
                            (acc, it) =>
                              acc + (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
                            0,
                          );
                          const remaining = Math.max(0, editingTx.amount - currentTotal);
                          setWhItems((prev) => [
                            ...prev,
                            {
                              id: `wh-${Date.now()}-${Math.random()}`,
                              brand: 'canter',
                              clientCarModel: '',
                              name: '',
                              article: '',
                              quantity: 1,
                              unitPrice: remaining > 0 ? remaining : '',
                            },
                          ]);
                        }}
                        className="w-full py-2 px-3 border-2 border-dashed border-sky-300 hover:border-sky-500 bg-sky-50/50 hover:bg-sky-100/60 text-sky-800 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>➕</span>
                        <span>Добавить ещё деталь в эту накладную</span>
                      </button>

                      <div className="text-[10px] text-sky-900 bg-sky-100/60 p-2.5 rounded-xl border border-sky-200 leading-relaxed flex items-center justify-between">
                        <div>
                          💡 Все добавленные детали поступят на склад в соответствующие разделы
                          автопарка и клиентов.
                        </div>
                        <a
                          href="/garage?tab=warehouse"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-sky-700 hover:text-sky-900 font-bold underline whitespace-nowrap ml-2"
                        >
                          Склад ТМЦ ↗
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}

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

            {/* Footer (fixed shrink-0) */}
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100 flex-shrink-0 bg-slate-50/70">
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!editingTx.description?.trim()}
                onClick={() => {
                  const validWhItems = whEnabled
                    ? whItems.filter((it) => it.name.trim().length > 0)
                    : [];

                  categorizeMutation.mutate({
                    id: editingTx.id,
                    description: editingTx.description,
                    category_id: editingTx.categoryId,
                    categoryName: editingTx.categoryName,
                    amount: editingTx.amount,
                    to_wallet_id: editingTx.toWalletId,
                    from_wallet_id: editingTx.fromWalletId,
                    direction: editingTx.direction,
                    obligation_id: editingTx.obligationId,
                    transaction_date: editingTx.transactionDate,
                    related_user_id: editingTx.relatedUserId,
                    warehouse_enabled: whEnabled,
                    warehouse_parts: whEnabled
                      ? validWhItems.map((it) => ({
                          brand: it.brand,
                          client_car_model:
                            it.brand === 'client' ? it.clientCarModel.trim() || 'Нива' : null,
                          name: it.name.trim(),
                          article: it.article.trim() || null,
                          quantity: Math.max(1, Number(it.quantity) || 1),
                          unit_price:
                            it.unitPrice !== '' && it.unitPrice !== undefined
                              ? Number(it.unitPrice)
                              : Math.round(editingTx.amount / Math.max(1, validWhItems.length)),
                        }))
                      : [],
                    warehouse_part:
                      whEnabled && validWhItems[0]
                        ? {
                            enabled: true,
                            brand: validWhItems[0].brand,
                            client_car_model:
                              validWhItems[0].brand === 'client'
                                ? validWhItems[0].clientCarModel.trim() || 'Нива'
                                : null,
                            name: validWhItems[0].name.trim(),
                            article: validWhItems[0].article.trim() || null,
                            quantity: Math.max(1, Number(validWhItems[0].quantity) || 1),
                            unit_price:
                              validWhItems[0].unitPrice !== '' &&
                              validWhItems[0].unitPrice !== undefined
                                ? Number(validWhItems[0].unitPrice)
                                : editingTx.amount,
                          }
                        : whEnabled === false && editingTx.warehousePart
                          ? { enabled: false }
                          : null,
                  });
                }}
                className="px-5 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                ✓ Сохранить и распределить
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
                    {formatTxTime(
                      linkingBankOp.trxnPostDate ||
                        linkingBankOp.authorizationDate ||
                        linkingBankOp.operationDate,
                    )}
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
                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-700">
                        Выберите рейс(ы) автопарка для привязки:
                      </label>
                      <div className="text-[10px] text-slate-500">
                        💡 Можно выбрать сразу несколько рейсов (оплата долга за 2 и более рейса)
                      </div>
                    </div>
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
                    <button
                      type="button"
                      onClick={() => {
                        setLinkOrderPeriod('30days');
                        setLinkOrderCustomDate('');
                      }}
                      className={`px-2 py-1 text-[10px] font-black rounded-lg transition cursor-pointer flex items-center gap-1 ${
                        linkOrderPeriod === '30days'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>🗓️</span>
                      <span>За 30 дней</span>
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
                    const selectedOrders = orders.filter((o) =>
                      selectedOrderIdsToLink.includes(o.id),
                    );
                    const selectedTotalAmount = selectedOrders.reduce(
                      (sum, o) => sum + parseFloat(String(o.amount || '0')),
                      0,
                    );
                    const isSumExactMatch =
                      selectedOrderIdsToLink.length > 0 &&
                      Math.abs(selectedTotalAmount - opAmt) < 0.01;
                    const isSumUnder =
                      selectedOrderIdsToLink.length > 0 && selectedTotalAmount < opAmt;
                    const isSumOver =
                      selectedOrderIdsToLink.length > 0 && selectedTotalAmount > opAmt;

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
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setLinkOrderPeriod('7days');
                                setLinkOrderSearch('');
                                setLinkOrderCustomDate('');
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold bg-white border border-slate-300 rounded-lg text-sky-700 hover:bg-slate-50 cursor-pointer"
                            >
                              Рейсы за 7 дней
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setLinkOrderPeriod('30days');
                                setLinkOrderSearch('');
                                setLinkOrderCustomDate('');
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold bg-white border border-slate-300 rounded-lg text-sky-700 hover:bg-slate-50 cursor-pointer"
                            >
                              Рейсы за 30 дней
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        {/* Status bar of selected orders */}
                        <div
                          className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition ${
                            selectedOrderIdsToLink.length === 0
                              ? 'bg-slate-50 border-slate-200 text-slate-500'
                              : isSumExactMatch
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium'
                                : isSumUnder
                                  ? 'bg-amber-50 border-amber-300 text-amber-950'
                                  : 'bg-purple-50 border-purple-300 text-purple-950'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>
                              {selectedOrderIdsToLink.length === 0 ? (
                                '💡 Отметьте один или сразу несколько рейсов'
                              ) : (
                                <>
                                  Выбрано: <b>{selectedOrderIdsToLink.length}</b> рейса на сумму{' '}
                                  <b className="font-mono text-slate-900">
                                    {rub(selectedTotalAmount)}
                                  </b>{' '}
                                  из <b className="font-mono text-slate-900">{rub(opAmt)}</b>
                                </>
                              )}
                            </span>
                            {isSumExactMatch && (
                              <span className="bg-emerald-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded shadow-2xs">
                                ✓ Сумма совпадает (100%)
                              </span>
                            )}
                            {isSumUnder && (
                              <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-1.5 py-0.2 rounded">
                                Остаток: {rub(opAmt - selectedTotalAmount)}
                              </span>
                            )}
                            {isSumOver && (
                              <span className="text-[10px] text-purple-800 font-bold bg-purple-100 px-1.5 py-0.2 rounded">
                                Превышение: +{rub(selectedTotalAmount - opAmt)}
                              </span>
                            )}
                          </div>
                          {selectedOrderIdsToLink.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setSelectedOrderIdsToLink([])}
                              className="text-[10px] text-slate-500 hover:text-slate-800 underline cursor-pointer ml-2 flex-shrink-0"
                            >
                              Сбросить выбор
                            </button>
                          )}
                        </div>

                        {/* List */}
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {orders.map((order) => {
                            const isMatchAmt =
                              order.is_match_amount ?? parseFloat(String(order.amount)) === opAmt;
                            const isSelected = selectedOrderIdsToLink.includes(order.id);
                            const isTopRecommendation = order.score && order.score >= 100;

                            return (
                              <div
                                key={order.id}
                                onClick={() => toggleOrderSelection(order.id)}
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
                                <div className="flex items-center gap-2.5">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      toggleOrderSelection(order.id);
                                    }}
                                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer"
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
                                          {order.trip_date
                                            .split('-')
                                            .reverse()
                                            .slice(0, 2)
                                            .join('.')}
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
                    (linkMode === 'trip' && selectedOrderIdsToLink.length === 0) ||
                    (linkMode === 'sto' && !stoOrderNumber.trim()) ||
                    (linkMode === 'dispatcher' && !dispatcherDetails.trim())
                  }
                  onClick={() =>
                    linkBankOpMutation.mutate({
                      operationId: linkingBankOp.operationId,
                      linkType: linkMode === 'sto' ? 'service_order' : linkMode,
                      tripOrderIds: linkMode === 'trip' ? selectedOrderIdsToLink : undefined,
                      tripOrderId:
                        linkMode === 'trip' && selectedOrderIdsToLink.length === 1
                          ? selectedOrderIdsToLink[0]
                          : undefined,
                      serviceOrderId: linkMode === 'sto' ? stoOrderNumber.trim() : undefined,
                      dispatcherDetails:
                        linkMode === 'dispatcher' ? dispatcherDetails.trim() : undefined,
                      clientName:
                        linkMode === 'sto'
                          ? stoClientName.trim()
                          : linkMode === 'dispatcher'
                            ? dispatcherClientName.trim()
                            : undefined,
                      amount: linkingBankOp.operationAmount || linkingBankOp.rubleAmount || 0,
                      operationDate:
                        linkingBankOp.trxnPostDate ||
                        linkingBankOp.authorizationDate ||
                        linkingBankOp.operationDate,
                      date: selectedDate,
                      action: 'link',
                    })
                  }
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition"
                >
                  {linkBankOpMutation.isPending
                    ? 'Связывание...'
                    : linkMode === 'sto'
                      ? '✓ Связать с заказ-нарядом СТО'
                      : linkMode === 'dispatcher'
                        ? '✓ Связать с рейсом диспетчера'
                        : (() => {
                            if (selectedOrderIdsToLink.length === 0) {
                              return 'Выберите рейс для привязки';
                            }
                            if (selectedOrderIdsToLink.length === 1) {
                              const selOrder = (linkableOrdersData?.orders ?? []).find(
                                (o) => o.id === selectedOrderIdsToLink[0],
                              );
                              return selOrder?.trip?.trip_number
                                ? `✓ Связать с рейсом №${selOrder.trip.trip_number}`
                                : '✓ Связать с рейсом автопарка';
                            }
                            const selOrders = (linkableOrdersData?.orders ?? []).filter((o) =>
                              selectedOrderIdsToLink.includes(o.id),
                            );
                            const tripNums = selOrders
                              .map((o) => o.trip?.trip_number)
                              .filter(Boolean)
                              .map((n) => `№${n}`);
                            const sumSel = selOrders.reduce(
                              (s, o) => s + parseFloat(String(o.amount || '0')),
                              0,
                            );
                            return tripNums.length > 0
                              ? `✓ Связать сразу с ${selectedOrderIdsToLink.length} рейсами (${tripNums.join(', ')}) · ${rub(sumSel)}`
                              : `✓ Связать сразу с ${selectedOrderIdsToLink.length} рейсами (${rub(sumSel)})`;
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
                  {getFilteredCategories(data?.categories, manualType, manualCategoryId).map(
                    (c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ),
                  )}
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
