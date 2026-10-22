'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

export type AtiOrder = {
  id: string;
  order_number: string;
  order_date: string;
  stage: number; // 1..7 (без промежуточного блока 'в пути')
  doc_type: 'etrn' | 'paper';
  counterparty_id?: string | null;
  counterparty_name: string;
  counterparty_inn?: string;
  counterparty_contact?: string;
  counterparty_phone?: string;
  counterparty_email?: string;
  ati_code?: string;
  carrier_name: string;
  carrier_inn: string;
  carrier_contact: string;
  carrier_account: string;
  carrier_bank: string;
  carrier_bik: string;
  asset_name: string;
  asset_reg_number: string;
  driver_name: string;
  driver_phone: string;
  driver_passport: string;
  driver_license: string;
  shipper_name: string;
  pickup_address: string;
  pickup_date_time: string;
  pickup_contact: string;
  cargo_description: string;
  consignee_name: string;
  delivery_address: string;
  delivery_date: string;
  delivery_contact: string;
  price: number;
  payment_terms: string;
  postal_address?: string;
  postal_tracking_number?: string;
  docs_sent?: boolean;
  docs_sent_date?: string | null;
  docs_received?: boolean;
  docs_received_date?: string | null;
  payment_promised_date?: string | null;
  is_cancelled?: boolean;
  cancel_reason?: string;
  cancelled_at?: string;
  // Претензионная работа
  has_claim?: boolean;
  claim_status?: 'none' | 'issued' | 'agreed' | 'waiting_payment' | 'paid' | 'rejected';
  claim_number?: string;
  claim_date?: string;
  claim_amount?: number;
  claim_penalty_amount?: number;
  claim_empty_run_amount?: number;
  claim_idle_amount?: number;
  claim_due_days?: number;
  claim_due_date?: string;
  claim_agreed_at?: string;
  claim_paid_at?: string;
  claim_notes?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
};

type ApiResponse = {
  success: boolean;
  orders: AtiOrder[];
  counterparties: { id: string; name: string; phone?: string; email?: string }[];
  assets: { id: string; name: string; short_name: string; reg_number: string }[];
  drivers: { id: string; name: string; phone?: string }[];
};

// Конфигурация 7 этапов (лишний блок 'в пути' исключён)
const STAGE_CONFIG: Record<
  number,
  {
    title: string;
    shortTitle: string;
    colorDot: string;
    bgHeader: string;
    borderCol: string;
    btnForward: string;
    btnClass: string;
  }
> = {
  1: {
    title: '1. Договор на почте',
    shortTitle: '1. Договор',
    colorDot: 'bg-slate-500',
    bgHeader: 'bg-slate-200/70',
    borderCol: 'border-slate-300',
    btnForward: 'Согласовать →',
    btnClass: 'bg-indigo-600 hover:bg-indigo-500 text-white',
  },
  2: {
    title: '2. Согласование Заявки-ЭТрН',
    shortTitle: '2. ЭТрН Заявка',
    colorDot: 'bg-sky-500',
    bgHeader: 'bg-sky-50/80',
    borderCol: 'border-sky-200',
    btnForward: 'На погрузку →',
    btnClass: 'bg-sky-600 hover:bg-sky-500 text-white',
  },
  3: {
    title: '3. Погрузка & Подпись',
    shortTitle: '3. Погрузка',
    colorDot: 'bg-amber-500',
    bgHeader: 'bg-amber-50/80',
    borderCol: 'border-amber-200',
    btnForward: 'На выгрузку →',
    btnClass: 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black',
  },
  4: {
    title: '4. Выгрузка & Сдача рейса',
    shortTitle: '4. Выгрузка',
    colorDot: 'bg-indigo-600',
    bgHeader: 'bg-indigo-50/80',
    borderCol: 'border-indigo-200',
    btnForward: 'В документы →',
    btnClass: 'bg-indigo-600 hover:bg-indigo-500 text-white',
  },
  5: {
    title: '5. Документооборот (ЭДО / Почта)',
    shortTitle: '5. Документы',
    colorDot: 'bg-purple-600',
    bgHeader: 'bg-purple-50/80',
    borderCol: 'border-purple-200',
    btnForward: 'В оплату →',
    btnClass: 'bg-purple-600 hover:bg-purple-500 text-white',
  },
  6: {
    title: '6. Ожидание оплаты (Дебиторка)',
    shortTitle: '6. Дебиторка',
    colorDot: 'bg-rose-600',
    bgHeader: 'bg-rose-50/80',
    borderCol: 'border-rose-200',
    btnForward: '✓ Оплачено на Р/С',
    btnClass: 'bg-emerald-600 hover:bg-emerald-500 text-white',
  },
  7: {
    title: '7. Оплачено и закрыто',
    shortTitle: '7. Оплачено',
    colorDot: 'bg-emerald-600',
    bgHeader: 'bg-emerald-50/80',
    borderCol: 'border-emerald-200',
    btnForward: '✓ Закрыто',
    btnClass: 'bg-slate-300 text-slate-700',
  },
};

export default function AtiPage() {
  const queryClient = useQueryClient();
  const [filterDoc, setFilterDoc] = useState<'all' | 'etrn' | 'paper'>('all');
  const [selectedOrder, setSelectedOrder] = useState<AtiOrder | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Форма новой заявки
  const [newOrderNumber, setNewOrderNumber] = useState(
    `№ 002 от ${new Date().toLocaleDateString('ru-RU')}`,
  );
  const [newCounterpartyMode, setNewCounterpartyMode] = useState<'select' | 'create'>('select');
  const [selectedCpId, setSelectedCpId] = useState('');
  const [newCpName, setNewCpName] = useState('');
  const [newCpInn, setNewCpInn] = useState('');
  const [newCpPhone, setNewCpPhone] = useState('');
  const [newCpEmail, setNewCpEmail] = useState('');
  const [newPickup, setNewPickup] = useState('');
  const [newDelivery, setNewDelivery] = useState('');
  const [newPrice, setNewPrice] = useState('30000');
  const [newDocType, setNewDocType] = useState<'etrn' | 'paper'>('etrn');
  const [newCargo, setNewCargo] = useState('');
  const [newAssetReg, setNewAssetReg] = useState('О188ТА 196 (Валдай)');
  const [newDriver, setNewDriver] = useState('Насртдинов Вячеслав Аксанович');

  // Автозагрузка и распознавание Договор-Заявки (PDF / скан / фото)
  const [isParsingContract, setIsParsingContract] = useState(false);
  const [contractParseSuccess, setContractParseSuccess] = useState<string | null>(null);
  const [contractParseError, setContractParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleContractFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingContract(true);
    setContractParseSuccess(null);
    setContractParseError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/ati/parse-contract', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Ошибка распознавания');
      }

      const p = json.data;
      if (p.order_number) {
        const dateStr = p.order_date
          ? new Date(p.order_date).toLocaleDateString('ru-RU')
          : new Date().toLocaleDateString('ru-RU');
        setNewOrderNumber(`№ ${p.order_number} от ${dateStr}`);
      }
      if (p.pickup_address) setNewPickup(p.pickup_address);
      if (p.delivery_address) setNewDelivery(p.delivery_address);
      if (p.price) setNewPrice(String(p.price));
      if (p.cargo_description) setNewCargo(p.cargo_description);
      if (p.asset_name) setNewAssetReg(p.asset_name);
      if (p.driver_name) setNewDriver(p.driver_name);
      if (p.doc_type) setNewDocType(p.doc_type);

      // Контрагент: связываем с базой или предзаполняем поля создания нового
      if (p.matched_counterparty) {
        setNewCounterpartyMode('select');
        setSelectedCpId(p.matched_counterparty.id);
      } else {
        setNewCounterpartyMode('create');
        if (p.counterparty_name) setNewCpName(p.counterparty_name);
        if (p.counterparty_inn) setNewCpInn(p.counterparty_inn);
        if (p.counterparty_phone) setNewCpPhone(p.counterparty_phone);
        if (p.counterparty_email) setNewCpEmail(p.counterparty_email);
      }

      const cpLabel = p.matched_counterparty
        ? `${p.matched_counterparty.name} (найден в базе)`
        : p.counterparty_name || 'Новый контрагент';

      setContractParseSuccess(
        `✓ Договор распознан: ${cpLabel} | ${p.order_number ? `№ ${p.order_number}` : ''} | ${p.price ? `${Number(p.price).toLocaleString('ru-RU')} ₽` : ''}. Проверьте данные и нажмите «Создать заявку».`,
      );
    } catch (err: unknown) {
      console.error(err);
      setContractParseError(err instanceof Error ? err.message : 'Не удалось распознать документ');
    } finally {
      setIsParsingContract(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Запрос данных
  const { data, isLoading } = useQuery<ApiResponse>({
    queryKey: ['ati-orders'],
    queryFn: async () => {
      const res = await fetch('/api/ati');
      if (!res.ok) throw new Error('Ошибка загрузки заявок АТИ');
      return res.json();
    },
    staleTime: 15000,
    refetchInterval: 30000,
  });

  // Мутация смены этапа
  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: number }) => {
      const res = await fetch(`/api/ati/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Ошибка обновления этапа');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ati-orders'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
    },
    onError: (err: Error) => {
      alert(err.message);
    },
  });

  // Мутация сохранения трек-номера Почты РФ и статусов документооборота
  const updateDocFieldsMutation = useMutation({
    mutationFn: async ({
      id,
      ...fields
    }: {
      id: string;
      postal_tracking_number?: string;
      docs_sent?: boolean;
      docs_sent_date?: string | null;
      docs_received?: boolean;
      docs_received_date?: string | null;
      payment_promised_date?: string | null;
      stage?: number;
    }) => {
      const res = await fetch(`/api/ati/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error('Ошибка обновления статуса документов');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ati-orders'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
    },
  });

  // Состояния для отмены / срыва / претензии
  const [cancellingOrder, setCancellingOrder] = useState<AtiOrder | null>(null);
  const [cancelMode, setCancelMode] = useState<'claim' | 'simple'>('claim');
  const [cancelReason, setCancelReason] = useState<string>('Отказ заказчика по обоюдному согласию');
  const [showCancelledList, setShowCancelledList] = useState(false);
  const [cancelledListTab, setCancelledListTab] = useState<'claims' | 'claims_archive' | 'simple'>(
    'claims',
  );
  const [viewingClaimOrder, setViewingClaimOrder] = useState<AtiOrder | null>(null);
  const [viewingPowerOfAttorney, setViewingPowerOfAttorney] = useState<AtiOrder | null>(null);

  // Параметры претензии
  const [claimNumber, setClaimNumber] = useState<string>('01-ПР');
  const [claimDate, setClaimDate] = useState<string>(new Date().toISOString().split('T')[0] ?? '');
  const [claimPenaltyAmount, setClaimPenaltyAmount] = useState<string>('6000');
  const [claimEmptyRunAmount, setClaimEmptyRunAmount] = useState<string>('0');
  const [claimIdleAmount, setClaimIdleAmount] = useState<string>('0');
  const [claimDueDays, setClaimDueDays] = useState<string>('5');
  const [showDetailedClaim, setShowDetailedClaim] = useState<boolean>(false);

  // Состояние согласования / редактирования суммы претензии
  const [agreeingClaim, setAgreeingClaim] = useState<{
    order: AtiOrder;
    amount: string;
    notes: string;
  } | null>(null);

  const openAgreeClaimModal = (ord: AtiOrder) => {
    const freight = Number(ord.price || 30000);
    const tenPercent = Math.round(freight * 0.1);
    const defaultAmt = ord.claim_amount !== undefined ? ord.claim_amount : tenPercent;
    setAgreeingClaim({
      order: ord,
      amount: String(defaultAmt),
      notes: ord.claim_notes || 'Согласовано 10% от фрахта без бюрократических проволочек',
    });
  };

  // Мутация отмены / фиксации срыва / выставления претензии
  const cancelOrderMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      reason: string;
      has_claim?: boolean;
      claim_status?: 'issued';
      claim_number?: string;
      claim_date?: string;
      claim_amount?: number;
      claim_penalty_amount?: number;
      claim_empty_run_amount?: number;
      claim_idle_amount?: number;
      claim_due_days?: number;
    }) => {
      const res = await fetch(`/api/ati/${payload.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_cancelled: true,
          cancel_reason: payload.reason,
          has_claim: payload.has_claim,
          claim_status: payload.claim_status,
          claim_number: payload.claim_number,
          claim_date: payload.claim_date,
          claim_amount: payload.claim_amount,
          claim_penalty_amount: payload.claim_penalty_amount,
          claim_empty_run_amount: payload.claim_empty_run_amount,
          claim_idle_amount: payload.claim_idle_amount,
          claim_due_days: payload.claim_due_days,
        }),
      });
      if (!res.ok) throw new Error('Ошибка обработки срыва заявки');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ati-orders'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      setCancellingOrder(null);
    },
  });

  // Мутация обновления статуса и суммы претензии (Согласовано -> Ждем оплаты -> Оплачено)
  const updateClaimStatusMutation = useMutation({
    mutationFn: async ({
      id,
      claim_status,
      claim_agreed_at,
      claim_amount,
      claim_notes,
    }: {
      id: string;
      claim_status?: 'issued' | 'agreed' | 'waiting_payment' | 'paid' | 'rejected';
      claim_agreed_at?: string;
      claim_amount?: number;
      claim_notes?: string;
    }) => {
      const res = await fetch(`/api/ati/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim_status,
          claim_agreed_at:
            claim_agreed_at || (claim_status === 'agreed' ? new Date().toISOString() : undefined),
          claim_amount,
          claim_notes,
        }),
      });
      if (!res.ok) throw new Error('Ошибка обновления претензии');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ati-orders'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
    },
  });

  // Мутация восстановления сорванной заявки на доску
  const restoreOrderMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const res = await fetch(`/api/ati/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restore: true }),
      });
      if (!res.ok) throw new Error('Ошибка восстановления заявки');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ati-orders'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
    },
  });

  // Мутация создания новой заявки
  const createOrderMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/ati', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Ошибка создания заявки');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ati-orders'] });
      queryClient.invalidateQueries({ queryKey: ['counterparties'] });
      setIsNewModalOpen(false);
    },
  });

  const orders = data?.orders || [];
  const counterparties = data?.counterparties || [];

  // Синхронизация активного выбранного договора с актуальными данными из кэша
  const activeSelectedOrder = useMemo(
    () => (selectedOrder ? (orders.find((o) => o.id === selectedOrder.id) ?? selectedOrder) : null),
    [orders, selectedOrder],
  );

  const contractModalBackdropRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewingPowerOfAttorney) {
          setViewingPowerOfAttorney(null);
          return;
        }
        if (cancellingOrder) {
          setCancellingOrder(null);
          return;
        }
        if (selectedOrder) {
          setSelectedOrder(null);
          return;
        }
        if (isNewModalOpen) {
          setIsNewModalOpen(false);
          return;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOrder, viewingPowerOfAttorney, cancellingOrder, isNewModalOpen]);

  // Разделение на активные, претензии и простые срывы
  const cancelledOrders = orders.filter((o) => o.is_cancelled || o.stage === 0);
  const claimOrders = cancelledOrders.filter((o) => o.has_claim);
  const activeClaimOrders = claimOrders.filter((o) => o.claim_status !== 'paid');
  const paidClaimOrders = claimOrders.filter((o) => o.claim_status === 'paid');
  const simpleCancelledOrders = cancelledOrders.filter((o) => !o.has_claim);
  const activeOrders = orders.filter((o) => !o.is_cancelled && o.stage > 0);

  const activeClaimsSum = activeClaimOrders.reduce(
    (sum, o) => sum + (Number(o.claim_amount) || 0),
    0,
  );
  const paidClaimsSum = paidClaimOrders.reduce((sum, o) => sum + (Number(o.claim_amount) || 0), 0);

  // Фильтрация активных по типу документов
  const filteredOrders = activeOrders.filter((o) => {
    if (filterDoc === 'all') return true;
    return o.doc_type === filterDoc;
  });

  // Распределение по этапам (1..8)
  const ordersByStage: Record<number, AtiOrder[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
    7: [],
  };

  for (const ord of filteredOrders) {
    const st = ord.stage >= 1 && ord.stage <= 7 ? ord.stage : 1;
    ordersByStage[st]?.push(ord);
  }

  // Общая сумма активных
  const totalFreight = activeOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
  const inReceivables = activeOrders
    .filter((o) => o.stage === 6)
    .reduce((sum, o) => sum + (Number(o.price) || 0), 0);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let cpName = '';
    let cpId = null;

    if (newCounterpartyMode === 'create') {
      cpName = newCpName;
    } else {
      const found = counterparties.find((c) => c.id === selectedCpId);
      cpName = found ? found.name : 'ООО Заказчик';
      cpId = selectedCpId || null;
    }

    createOrderMutation.mutate({
      order_number: newOrderNumber,
      create_counterparty: newCounterpartyMode === 'create',
      counterparty_id: cpId,
      counterparty_name: cpName,
      counterparty_inn: newCpInn,
      counterparty_phone: newCpPhone,
      counterparty_email: newCpEmail,
      doc_type: newDocType,
      pickup_address: newPickup,
      delivery_address: newDelivery,
      price: Number(newPrice) || 0,
      cargo_description: newCargo,
      asset_name: newAssetReg,
      driver_name: newDriver,
    });
  };

  return (
    <div className="w-full space-y-2 pb-6">
      {/* ══════════════════════════════════════════════════════════════════════
           ШАПКА РАЗДЕЛА
           ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-3 shadow-2xs flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-xs shrink-0">
            🚚
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight font-display">
                АТИ ПЕРЕВОЗКИ
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                Канбан договоров-заявок
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-300">
                Компактный финтех (8 колонок)
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Сквозной процесс: Менеджер заносит Контрагента → Рейс → Водитель выбирает клиента →
              Заказ в Дебиторке
            </p>
          </div>
        </div>

        {/* Фильтры и действия */}
        <div className="flex items-center gap-2 flex-wrap self-end xl:self-center">
          <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-300 text-xs font-bold">
            <button
              onClick={() => setFilterDoc('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterDoc === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-black'
                  : 'text-slate-600 hover:bg-white/50'
              }`}
            >
              Все ({activeOrders.length})
            </button>
            <button
              onClick={() => setFilterDoc('etrn')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterDoc === 'etrn'
                  ? 'bg-white text-emerald-800 shadow-2xs font-black'
                  : 'text-emerald-700 hover:bg-white/50'
              }`}
            >
              ⚡ ЭТрН ({activeOrders.filter((o) => o.doc_type === 'etrn').length})
            </button>
            <button
              onClick={() => setFilterDoc('paper')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterDoc === 'paper'
                  ? 'bg-white text-amber-900 shadow-2xs font-black'
                  : 'text-amber-800 hover:bg-white/50'
              }`}
            >
              📮 Почта РФ ({activeOrders.filter((o) => o.doc_type === 'paper').length})
            </button>
          </div>

          {/* Кнопка претензий и архива */}
          {claimOrders.length > 0 && (
            <button
              onClick={() => {
                setCancelledListTab(activeClaimOrders.length > 0 ? 'claims' : 'claims_archive');
                setShowCancelledList(true);
              }}
              className={`px-2.5 py-1.5 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition shadow-2xs ${
                activeClaimOrders.length > 0
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300'
              }`}
              title="Претензии к заказчикам за срыв погрузки (активные и архив)"
            >
              <span>{activeClaimOrders.length > 0 ? '⚖️ Претензии:' : '📁 Архив претензий:'}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full font-mono text-[11px] font-black ${
                  activeClaimOrders.length > 0
                    ? 'bg-amber-200 text-amber-950'
                    : 'bg-emerald-200 text-emerald-950'
                }`}
              >
                {activeClaimOrders.length > 0 ? activeClaimOrders.length : paidClaimOrders.length}
              </span>
              {activeClaimsSum > 0 ? (
                <span className="text-[10px] font-mono font-black text-amber-800">
                  ({activeClaimsSum.toLocaleString('ru-RU')} ₽)
                </span>
              ) : (
                <span className="text-[10px] text-emerald-700 font-bold">
                  (оплачено {paidClaimsSum.toLocaleString('ru-RU')} ₽ ✓)
                </span>
              )}
            </button>
          )}

          {/* Кнопка архива простых срывов */}
          {simpleCancelledOrders.length > 0 && (
            <button
              onClick={() => {
                setCancelledListTab('simple');
                setShowCancelledList(true);
              }}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
              title="Сорванные рейсы без претензий"
            >
              <span>❌ Срывы:</span>
              <span className="font-black bg-slate-200 text-slate-900 px-1.5 py-0.2 rounded-full font-mono text-[11px]">
                {simpleCancelledOrders.length}
              </span>
            </button>
          )}

          <button
            onClick={() => setIsNewModalOpen(true)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
          >
            <span>+</span>
            <span>Новая заявка АТИ</span>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
           БАННЕР АКТИВНОЙ ПРЕТЕНЗИОННОЙ РАБОТЫ (ТОЛЬКО НЕОПЛАЧЕННЫЕ ПРЕТЕНЗИИ)
           ══════════════════════════════════════════════════════════════════════ */}
      {activeClaimOrders.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 via-white to-amber-50/50 border-2 border-amber-300 rounded-2xl p-3 shadow-2xs space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚖️</span>
              <span className="text-xs font-black uppercase text-amber-950 tracking-wide">
                Претензионная работа по срывам ({activeClaimOrders.length} в работе)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                ст. 35 УАТ РФ · Штраф 20%
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-600 font-medium">Сумма требований:</span>
              <span className="font-mono font-black text-amber-950 text-sm">
                {activeClaimsSum.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          </div>

          {/* Список претензий в работе */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {activeClaimOrders.map((ord) => {
              const status = ord.claim_status || 'issued';
              return (
                <div
                  key={ord.id}
                  className="bg-white border-2 border-amber-200 rounded-xl p-2.5 shadow-2xs space-y-2 text-xs hover:border-amber-400 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-black text-slate-900 text-xs">
                          Претензия № {ord.claim_number || '01-ПР'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          к {ord.order_number.split(' ')[0]}
                        </span>
                      </div>
                      <div className="font-bold text-slate-800 text-[11px] truncate max-w-[220px]">
                        {ord.counterparty_name}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center justify-end gap-1">
                        <div className="font-mono font-black text-amber-950 text-xs">
                          {Number(ord.claim_amount || 6000).toLocaleString('ru-RU')} ₽
                        </div>
                        <button
                          type="button"
                          onClick={() => openAgreeClaimModal(ord)}
                          className="px-1 py-0.5 hover:bg-amber-100 rounded text-amber-800 text-[10px] font-bold cursor-pointer"
                          title="Изменить согласованную сумму претензии"
                        >
                          ✏️
                        </button>
                      </div>
                      <div className="text-[9px] text-slate-500">
                        {ord.claim_date || new Date().toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                  </div>

                  {/* Статус претензии */}
                  <div className="flex items-center justify-between text-[10px] bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                    <span className="text-slate-600">Статус:</span>
                    {status === 'issued' && (
                      <span className="font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                        1. Выставлена (Ждём согласования)
                      </span>
                    )}
                    {(status === 'agreed' || status === 'waiting_payment') && (
                      <span className="font-bold text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-300">
                        2. Согласована · В Дебиторке ⏳
                      </span>
                    )}
                    {status === 'paid' && (
                      <span className="font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">
                        ✓ Оплачено на Р/С
                      </span>
                    )}
                  </div>

                  {/* Действия с претензией */}
                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setViewingClaimOrder(ord)}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold border border-slate-300 cursor-pointer transition flex items-center gap-1"
                      title="Открыть официальный бланк претензии"
                    >
                      <span>📄</span> <span>Бланк</span>
                    </button>

                    {status === 'issued' && (
                      <button
                        type="button"
                        onClick={() => openAgreeClaimModal(ord)}
                        className="flex-1 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black cursor-pointer transition text-center shadow-2xs"
                        title="Заказчик согласовал срыв -> выбрать согласованную сумму (10%, 20%) и отправить в Дебиторку"
                      >
                        ✓ Согласовано → В Дебиторку
                      </button>
                    )}

                    {(status === 'agreed' || status === 'waiting_payment') && (
                      <div className="flex-1 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openAgreeClaimModal(ord)}
                          className="px-1.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-bold text-center cursor-pointer"
                          title="Изменить согласованную сумму претензии в Дебиторке"
                        >
                          ✏️ Сумма
                        </button>
                        <Link
                          href="/receivables"
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold text-center"
                          title="Посмотреть задолженность в разделе Дебиторка"
                        >
                          В Дебиторке ↗
                        </Link>
                        <button
                          type="button"
                          disabled={updateClaimStatusMutation.isPending}
                          onClick={() =>
                            updateClaimStatusMutation.mutate({
                              id: ord.id,
                              claim_status: 'paid',
                            })
                          }
                          className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black cursor-pointer transition text-center"
                          title="Отметить оплаченной на расчетный счет"
                        >
                          ✓ Оплачено
                        </button>
                      </div>
                    )}

                    {status === 'paid' && (
                      <div className="flex-1 text-center py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-black">
                        ✓ Долг закрыт
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           ИНФО-БЛОК СВЯЗКИ С ДЕБИТОРКОЙ
           ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border-2 border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-[11px] text-slate-600">
          <span className="text-base">💡</span>
          <span>
            Кликните на карточку для просмотра полного договора. Кнопка <strong>↶</strong> отменяет
            ошибочный шаг. Претензии после согласования автоматически попадают в{' '}
            <strong>Дебиторку</strong>.
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono font-bold shrink-0">
          <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">
            Фрахт: {totalFreight.toLocaleString('ru-RU')} ₽
          </span>
          <Link
            href="/receivables"
            className="px-2 py-0.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded flex items-center gap-1 transition"
          >
            <span>В Дебиторке: {inReceivables.toLocaleString('ru-RU')} ₽</span>
            <span>↗</span>
          </Link>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
           КАНБАН-СЕТКА: РОVНО 8 КОЛОНОК БЕЗ СКРОЛЛА (Fit-to-Screen)
           ══════════════════════════════════════════════════════════════════════ */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 font-bold bg-white rounded-2xl border-2 border-slate-200">
          Загрузка канбан-доски АТИ...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-1.5 w-full items-start">
          {[1, 2, 3, 4, 5, 6, 7].map((stageNum) => {
            const cfg = STAGE_CONFIG[stageNum];
            if (!cfg) return null;
            const colOrders = ordersByStage[stageNum] || [];

            return (
              <div
                key={stageNum}
                className={`${cfg.bgHeader} rounded-xl border-2 ${cfg.borderCol} p-1.5 flex flex-col gap-1.5 min-w-0 shadow-2xs`}
              >
                {/* Заголовок колонки */}
                <div
                  className={`flex items-center justify-between px-1 pb-1 border-b ${cfg.borderCol}`}
                >
                  <div className="flex items-center gap-1 min-w-0">
                    <span className={`w-2 h-2 rounded-full ${cfg.colorDot} shrink-0`} />
                    <span
                      className="text-[11px] font-black uppercase text-slate-800 truncate"
                      title={cfg.title}
                    >
                      {cfg.shortTitle}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-black bg-white px-1 rounded border border-slate-300">
                    {colOrders.length}
                  </span>
                </div>

                {/* Список карточек в колонке */}
                <div className="flex flex-col gap-1.5 min-h-[120px]">
                  {colOrders.length === 0 ? (
                    <div className="h-16 border-2 border-dashed border-slate-300/60 rounded-lg flex items-center justify-center text-[10px] text-slate-400 font-bold">
                      Пусто
                    </div>
                  ) : (
                    colOrders.map((order) => {
                      // Валидация 3 пунктов на этапе 5 (Документы)
                      const isStage5 = stageNum === 5;
                      const isDocsSent = Boolean(order.docs_sent);
                      const isDocsReceived = Boolean(order.docs_received);
                      const hasPaymentDate = Boolean(order.payment_promised_date);
                      const isStage5Ready =
                        !isStage5 || (isDocsSent && isDocsReceived && hasPaymentDate);
                      const stage5CompletedCount = [
                        isDocsSent,
                        isDocsReceived,
                        hasPaymentDate,
                      ].filter(Boolean).length;

                      return (
                        <div
                          key={order.id}
                          onClick={() => setSelectedOrder(order)}
                          className="bg-white rounded-2xl border-2 border-slate-300 hover:border-indigo-500 hover:shadow-md p-2.5 space-y-2 text-xs shadow-2xs transition cursor-pointer group select-none relative"
                          title="Нажмите, чтобы открыть полноэкранный договор-заявку"
                        >
                          {/* Шапка: Номер, Документ, Фрахт */}
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-mono font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] shrink-0 border border-slate-200">
                                {order.order_number.split(' ')[0] || order.order_number}
                              </span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                                  order.doc_type === 'etrn'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : 'bg-amber-100 text-amber-900 border-amber-300'
                                }`}
                              >
                                {order.doc_type === 'etrn' ? '⚡ ЭТрН' : '📮 Почта'}
                              </span>
                            </div>
                            <span className="font-mono font-black text-slate-900 text-xs shrink-0">
                              {Number(order.price || 0).toLocaleString('ru-RU')} ₽
                            </span>
                          </div>

                          {/* Контрагент */}
                          <div>
                            <div
                              className="font-black text-slate-900 text-[11px] leading-snug line-clamp-2 group-hover:text-indigo-600 transition"
                              title={order.counterparty_name}
                            >
                              {order.counterparty_name}
                            </div>
                            {order.ati_code && (
                              <span className="text-[9px] font-mono text-indigo-700 font-bold">
                                АТИ {order.ati_code}
                              </span>
                            )}
                          </div>

                          {/* Маршрут */}
                          <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80 space-y-1 text-[10px]">
                            <div className="flex items-center gap-1.5 font-bold text-slate-700 truncate">
                              <span className="text-emerald-600 text-xs shrink-0">🟢</span>
                              <span className="truncate">
                                {order.pickup_address
                                  ? order.pickup_address.split(',')[1] ||
                                    order.pickup_address.split(',')[0]
                                  : 'Погрузка'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 font-bold text-slate-700 truncate">
                              <span className="text-rose-600 text-xs shrink-0">🔴</span>
                              <span className="truncate">
                                {order.delivery_address
                                  ? order.delivery_address.split(',')[1] ||
                                    order.delivery_address.split(',')[0]
                                  : 'Выгрузка'}
                              </span>
                            </div>
                          </div>

                          {/* Авто и Водитель */}
                          <div className="text-[10px] text-slate-600 space-y-0.5 pt-0.5">
                            {order.asset_name && (
                              <div className="truncate flex items-center gap-1">
                                <span>🚛</span>
                                <span className="font-bold text-slate-800">{order.asset_name}</span>
                                {order.asset_reg_number && (
                                  <span className="font-mono text-[9px] text-slate-500">
                                    ({order.asset_reg_number})
                                  </span>
                                )}
                              </div>
                            )}
                            {order.driver_name && (
                              <div className="truncate flex items-center gap-1 text-[9px] text-slate-500">
                                <span>👤</span>
                                <span className="truncate">{order.driver_name}</span>
                              </div>
                            )}
                          </div>

                          {/* Индикаторы этапа 5 и 6 */}
                          {isStage5 && (
                            <div className="pt-0.5">
                              <span
                                className={`w-full block text-center text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                                  isStage5Ready
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : 'bg-amber-50 text-amber-900 border-amber-300'
                                }`}
                              >
                                {isStage5Ready
                                  ? '3/3 готово к оплате ✓'
                                  : `Документы: ${stage5CompletedCount}/3`}
                              </span>
                            </div>
                          )}

                          {stageNum === 6 && order.payment_promised_date && (
                            <div className="pt-0.5">
                              <span className="w-full block text-center text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-900 border-amber-300">
                                📅 Оплата: {order.payment_promised_date}
                              </span>
                            </div>
                          )}

                          {/* Кнопка открытия полноэкранного договора-заявки */}
                          <div className="pt-1">
                            <div className="w-full py-1.5 px-2 bg-indigo-50/80 group-hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-[10px] flex items-center justify-center gap-1.5 transition">
                              <span>📋</span>
                              <span>Открыть договор-заявку</span>
                              <span className="text-[10px] text-indigo-500">↗</span>
                            </div>
                          </div>

                          {/* Кнопки управления этапами на карточке */}
                          <div
                            className="pt-1 border-t border-slate-100 flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {stageNum <= 5 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCancellingOrder(order);
                                  setCancelMode('claim');
                                  setCancelReason('Отказ заказчика по обоюдному согласию');
                                  const penalty = Math.round((Number(order.price) || 30000) * 0.2);
                                  setClaimPenaltyAmount(String(penalty));
                                  setClaimEmptyRunAmount('0');
                                  setClaimIdleAmount('0');
                                  setClaimNumber(
                                    order.order_number.includes('001')
                                      ? '01-ПР'
                                      : `${order.order_number.replace(/\D/g, '') || '1'}-ПР`,
                                  );
                                  setClaimDate(new Date().toISOString().split('T')[0] ?? '');
                                  setClaimDueDays('5');
                                }}
                                title="Срыв договора-заявки / Претензия"
                                className="px-1.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-black text-[10px] border border-rose-200 cursor-pointer active:scale-95 transition"
                              >
                                ✕
                              </button>
                            )}

                            {stageNum > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateStageMutation.mutate({
                                    id: order.id,
                                    stage: stageNum - 1,
                                  })
                                }
                                title="Вернуть на предыдущий этап"
                                className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-black text-[10px] border border-slate-300 cursor-pointer active:scale-95 transition"
                              >
                                ↶
                              </button>
                            )}

                            {stageNum < 7 ? (
                              <button
                                type="button"
                                disabled={isStage5 && !isStage5Ready}
                                onClick={() => {
                                  if (isStage5 && !isStage5Ready) {
                                    setSelectedOrder(order);
                                    return;
                                  }
                                  updateStageMutation.mutate({
                                    id: order.id,
                                    stage: stageNum + 1,
                                  });
                                }}
                                title={
                                  isStage5 && !isStage5Ready
                                    ? 'Нажмите, чтобы открыть заявку и заполнить 3 пункта'
                                    : cfg.btnForward
                                }
                                className={`flex-1 py-1 rounded-lg font-black text-[10px] transition text-center ${
                                  isStage5 && !isStage5Ready
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300 cursor-pointer hover:bg-amber-200'
                                    : `${cfg.btnClass} cursor-pointer active:scale-95`
                                }`}
                              >
                                {isStage5 && !isStage5Ready ? 'Заполнить 3/3 ↗' : cfg.btnForward}
                              </button>
                            ) : (
                              <div className="flex-1 text-center py-1 bg-emerald-100 text-emerald-900 rounded-lg font-black text-[10px]">
                                ✓ Закрыто
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           ПОЛНОЭКРАННОЕ ОКНО ДОГОВОР-ЗАЯВКИ
           ══════════════════════════════════════════════════════════════════════ */}
      {activeSelectedOrder && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 lg:p-6 overflow-y-auto"
          onMouseDown={(e) => {
            contractModalBackdropRef.current = e.target === e.currentTarget;
          }}
          onMouseUp={(e) => {
            if (contractModalBackdropRef.current && e.target === e.currentTarget) {
              setSelectedOrder(null);
            }
            contractModalBackdropRef.current = false;
          }}
        >
          <div
            className="bg-white rounded-3xl border border-slate-300 shadow-2xl w-full max-w-6xl max-h-[96vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── ШАПКА ПОЛНОЭКРАННОГО ДОГОВОРА ── */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between gap-4 shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-2xl shrink-0">
                  📋
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-black font-display tracking-tight text-white">
                      Договор-Заявка {activeSelectedOrder.order_number}
                    </h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${
                        activeSelectedOrder.doc_type === 'etrn'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400'
                          : 'bg-amber-500/20 text-amber-300 border-amber-400'
                      }`}
                    >
                      {activeSelectedOrder.doc_type === 'etrn'
                        ? '⚡ ЭТрН (ЭДО)'
                        : '📮 Почта РФ / СДЭК'}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      от {new Date(activeSelectedOrder.created_at).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 pt-0.5">
                    Междугородняя перевозка груза автотранспортом • Статус:{' '}
                    <strong className="text-indigo-300">
                      {STAGE_CONFIG[activeSelectedOrder.stage]?.title}
                    </strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Стоимость перевозки
                  </span>
                  <span className="text-lg sm:text-xl font-black font-mono text-emerald-400">
                    {Number(activeSelectedOrder.price || 0).toLocaleString('ru-RU')} ₽
                  </span>
                  <span className="text-[10px] text-slate-400">без НДС</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-lg font-black transition cursor-pointer"
                  title="Закрыть (Esc)"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* ── ИНТЕРАКТИВНЫЙ STEPPER ЭТАПОВ (1..7) ── */}
            <div className="bg-slate-100 border-b border-slate-200 px-6 py-2.5 shrink-0 overflow-x-auto">
              <div className="flex items-center justify-between gap-1.5 min-w-[700px]">
                {[1, 2, 3, 4, 5, 6, 7].map((s) => {
                  const cfg = STAGE_CONFIG[s] || STAGE_CONFIG[1];
                  const isCurrent = activeSelectedOrder.stage === s;
                  const isPast = activeSelectedOrder.stage > s;
                  return (
                    <div
                      key={s}
                      className={`flex-1 flex items-center gap-2 py-1.5 px-2.5 rounded-xl border transition select-none ${
                        isCurrent
                          ? 'bg-white border-indigo-500 shadow-xs text-indigo-950 font-black ring-2 ring-indigo-500/20'
                          : isPast
                            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 font-bold'
                            : 'bg-slate-50/60 border-slate-200 text-slate-400'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                          isCurrent
                            ? 'bg-indigo-600 text-white'
                            : isPast
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-300 text-slate-600'
                        }`}
                      >
                        {isPast ? '✓' : s}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] leading-tight truncate">
                          {cfg?.shortTitle || ''}
                        </div>
                        {isCurrent && (
                          <div className="text-[9px] text-indigo-600 uppercase font-black tracking-wider">
                            Текущий
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── ТЕЛО ДОГОВОР-ЗАЯВКИ (ПРОСТОРНАЯ СЕТКА) ── */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 flex-1 bg-slate-50/60">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* ── ЛЕВАЯ КОЛОНКА (7 ИЗ 12): СТОРОНЫ, МАРШРУТ, ТРАНСПОРТ ── */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Блок 1: Стороны договора */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Заказчик */}
                    <div className="bg-white rounded-2xl border-2 border-indigo-100 shadow-2xs p-4 space-y-2">
                      <div className="flex items-center justify-between pb-1 border-b border-indigo-50">
                        <span className="text-[11px] font-black uppercase text-indigo-950 tracking-wider flex items-center gap-1.5">
                          <span>🏢</span> 1. ЗАКАЗЧИК
                        </span>
                        {activeSelectedOrder.ati_code && (
                          <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                            Код АТИ: {activeSelectedOrder.ati_code}
                          </span>
                        )}
                      </div>
                      <div className="font-black text-slate-900 text-sm leading-snug">
                        {activeSelectedOrder.counterparty_name}
                      </div>
                      {activeSelectedOrder.counterparty_inn && (
                        <div className="text-slate-600 text-xs">
                          ИНН:{' '}
                          <span className="font-mono font-bold text-slate-800">
                            {activeSelectedOrder.counterparty_inn}
                          </span>
                        </div>
                      )}
                      {activeSelectedOrder.counterparty_contact && (
                        <div className="text-slate-600 text-xs">
                          Контактное лицо:{' '}
                          <strong className="text-slate-800">
                            {activeSelectedOrder.counterparty_contact}
                          </strong>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {activeSelectedOrder.counterparty_phone && (
                          <a
                            href={`tel:${activeSelectedOrder.counterparty_phone.replace(/[^\d+]/g, '')}`}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 flex items-center gap-1 transition"
                            title="Позвонить заказчику"
                          >
                            <span>📞</span>
                            <span>{activeSelectedOrder.counterparty_phone}</span>
                          </a>
                        )}
                        {activeSelectedOrder.counterparty_email && (
                          <a
                            href={`mailto:${activeSelectedOrder.counterparty_email}`}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border border-slate-200 flex items-center gap-1 transition"
                            title="Написать письмо"
                          >
                            <span>✉️</span>
                            <span className="truncate max-w-[150px]">
                              {activeSelectedOrder.counterparty_email}
                            </span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Перевозчик */}
                    <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-2xs p-4 space-y-2">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                        <span className="text-[11px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                          <span>🚚</span> 2. ПЕРЕВОЗЧИК
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 font-bold">ИП</span>
                      </div>
                      <div className="font-black text-slate-900 text-sm leading-snug">
                        {activeSelectedOrder.carrier_name}
                      </div>
                      <div className="text-slate-600 text-xs">
                        ИНН:{' '}
                        <span className="font-mono font-bold text-slate-800">
                          {activeSelectedOrder.carrier_inn}
                        </span>
                      </div>
                      <div className="text-slate-600 text-xs">
                        Контакт:{' '}
                        <strong className="text-slate-800">
                          {activeSelectedOrder.carrier_contact}
                        </strong>
                      </div>
                      <div className="text-[11px] text-slate-600 space-y-0.5 pt-1 border-t border-slate-100">
                        <div>
                          Р/С:{' '}
                          <span className="font-mono font-bold text-slate-800">
                            {activeSelectedOrder.carrier_account}
                          </span>
                        </div>
                        <div>
                          Банк:{' '}
                          <strong className="text-slate-800">
                            {activeSelectedOrder.carrier_bank}
                          </strong>{' '}
                          (БИК {activeSelectedOrder.carrier_bik})
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Блок 2: Маршрут (Погрузка и Выгрузка) */}
                  <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-2xs p-4 space-y-3">
                    <div className="text-[11px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100">
                      <span>🗺️</span> 3. МАРШРУТ И АДРЕСА СКЛАДОВ
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Погрузка */}
                      <div className="bg-emerald-50/50 rounded-xl border border-emerald-200 p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                            <span className="text-sm">🟢</span> ПОГРУЗКА
                          </span>
                          <span className="font-mono font-black text-emerald-800 text-xs bg-emerald-100/80 px-2 py-0.5 rounded-md">
                            {activeSelectedOrder.pickup_date_time || 'По графику'}
                          </span>
                        </div>
                        {activeSelectedOrder.shipper_name && (
                          <div className="text-xs">
                            <span className="text-slate-500 block text-[10px] uppercase font-bold">
                              Грузоотправитель:
                            </span>
                            <span className="font-bold text-slate-900">
                              {activeSelectedOrder.shipper_name}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">
                            Точный адрес:
                          </span>
                          <span className="font-bold text-slate-800 text-xs leading-snug">
                            {activeSelectedOrder.pickup_address || 'Адрес не указан'}
                          </span>
                        </div>
                        {activeSelectedOrder.pickup_contact && (
                          <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-emerald-100">
                            <span className="text-slate-400">Контакты склада: </span>
                            <span className="font-bold text-slate-800">
                              {activeSelectedOrder.pickup_contact}
                            </span>
                          </div>
                        )}
                        {activeSelectedOrder.cargo_description && (
                          <div className="text-[11px] text-slate-700 bg-white p-2 rounded-lg border border-emerald-100">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">
                              Характер груза:
                            </span>
                            <span className="font-bold text-slate-900">
                              {activeSelectedOrder.cargo_description}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Выгрузка */}
                      <div className="bg-rose-50/50 rounded-xl border border-rose-200 p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-rose-900 flex items-center gap-1.5">
                            <span className="text-sm">🔴</span> ВЫГРУЗКА
                          </span>
                          <span className="font-mono font-black text-rose-800 text-xs bg-rose-100/80 px-2 py-0.5 rounded-md">
                            {activeSelectedOrder.delivery_date || 'По графику'}
                          </span>
                        </div>
                        {activeSelectedOrder.consignee_name && (
                          <div className="text-xs">
                            <span className="text-slate-500 block text-[10px] uppercase font-bold">
                              Грузополучатель:
                            </span>
                            <span className="font-bold text-slate-900">
                              {activeSelectedOrder.consignee_name}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">
                            Точный адрес:
                          </span>
                          <span className="font-bold text-slate-800 text-xs leading-snug">
                            {activeSelectedOrder.delivery_address || 'Адрес не указан'}
                          </span>
                        </div>
                        {activeSelectedOrder.delivery_contact && (
                          <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-rose-100">
                            <span className="text-slate-400">Контакты приемки: </span>
                            <span className="font-bold text-slate-800">
                              {activeSelectedOrder.delivery_contact}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Блок 3: Транспорт и водитель */}
                  <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-2xs p-4 space-y-3">
                    <div className="text-[11px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100">
                      <span>🚛</span> 4. СВЕДЕНИЯ О ТРАНСПОРТЕ И ВОДИТЕЛЕ
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">
                          Автомобиль и госномер:
                        </span>
                        <div className="font-black text-slate-900 text-sm flex items-center gap-2">
                          <span>{activeSelectedOrder.asset_name}</span>
                          {activeSelectedOrder.asset_reg_number && (
                            <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-300">
                              {activeSelectedOrder.asset_reg_number}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">
                          Водитель:
                        </span>
                        <div className="font-black text-slate-900 text-sm">
                          {activeSelectedOrder.driver_name || 'Не назначен'}
                        </div>
                        {activeSelectedOrder.driver_phone && (
                          <a
                            href={`tel:${activeSelectedOrder.driver_phone.replace(/[^\d+]/g, '')}`}
                            className="inline-flex items-center gap-1 font-mono font-bold text-xs text-blue-600 hover:underline pt-0.5"
                          >
                            <span>📞</span>
                            <span>{activeSelectedOrder.driver_phone}</span>
                          </a>
                        )}
                      </div>
                      <div className="sm:col-span-2 text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <div>
                          Паспорт:{' '}
                          <strong className="text-slate-800">
                            {activeSelectedOrder.driver_passport || 'Указан в системе'}
                          </strong>
                        </div>
                        <div>
                          В/У:{' '}
                          <strong className="text-slate-800">
                            {activeSelectedOrder.driver_license || 'Указано в системе'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── ПРАВАЯ КОЛОНКА (5 ИЗ 12): ФИНАНСЫ, ДОКУМЕНТООБОРОТ, ДЕЙСТВИЯ ── */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Финансы и оплата */}
                  <div className="bg-white rounded-2xl border-2 border-emerald-200 shadow-2xs p-4 space-y-3">
                    <div className="flex items-center justify-between pb-1 border-b border-emerald-100">
                      <span className="text-[11px] font-black uppercase text-emerald-950 tracking-wider flex items-center gap-1.5">
                        <span>💰</span> 5. СТОИМОСТЬ И ПОРЯДОК ОПЛАТЫ
                      </span>
                      <span className="font-mono font-black text-base text-emerald-700">
                        {Number(activeSelectedOrder.price || 0).toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-700">
                      <div>
                        <span className="text-slate-500 font-bold">Форма и срок расчетов: </span>
                        <span className="font-semibold text-slate-900">
                          {activeSelectedOrder.payment_terms || 'Безналичный расчет без НДС'}
                        </span>
                      </div>
                      {activeSelectedOrder.postal_address && (
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px] space-y-0.5">
                          <span className="text-slate-500 font-bold block uppercase text-[10px]">
                            Почтовый адрес для оригиналов:
                          </span>
                          <span className="font-medium text-slate-800">
                            {activeSelectedOrder.postal_address}
                          </span>
                        </div>
                      )}
                      {activeSelectedOrder.notes && (
                        <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-[11px] text-amber-950 font-medium">
                          📌 {activeSelectedOrder.notes}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ИНТЕРАКТИВНЫЙ БЛОК: ДОКУМЕНТООБОРОТ (3 ПУНКТА) */}
                  <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-2xs p-4 space-y-3">
                    <div className="flex items-center justify-between pb-1 border-b border-purple-100">
                      <span className="text-[11px] font-black uppercase text-purple-950 tracking-wider flex items-center gap-1.5">
                        <span>📄</span> 6. ДОКУМЕНТООБОРОТ И ОПЛАТА
                      </span>
                      <span
                        className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full border ${
                          activeSelectedOrder.docs_sent &&
                          activeSelectedOrder.docs_received &&
                          activeSelectedOrder.payment_promised_date
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                        }`}
                      >
                        {
                          [
                            activeSelectedOrder.docs_sent,
                            activeSelectedOrder.docs_received,
                            Boolean(activeSelectedOrder.payment_promised_date),
                          ].filter(Boolean).length
                        }
                        /3 пунктов
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      Для перевода заявки в статус <strong>Ожидание оплаты (Дебиторка)</strong>{' '}
                      необходимо заполнить все 3 пункта:
                    </p>

                    <div className="space-y-2.5">
                      {/* Пункт 1 */}
                      <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer font-black text-xs text-slate-900 select-none">
                          <input
                            type="checkbox"
                            checked={Boolean(activeSelectedOrder.docs_sent)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              updateDocFieldsMutation.mutate({
                                id: activeSelectedOrder.id,
                                docs_sent: checked,
                                docs_sent_date: checked
                                  ? activeSelectedOrder.docs_sent_date ||
                                    new Date().toISOString().split('T')[0]
                                  : null,
                              });
                            }}
                            className="rounded border-purple-400 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                          />
                          <span>1. Документы отправлены на почту</span>
                          {activeSelectedOrder.docs_sent_date && (
                            <span className="font-mono text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded ml-auto">
                              {activeSelectedOrder.docs_sent_date}
                            </span>
                          )}
                        </label>
                        <div className="flex items-center gap-2 pt-1 pl-6">
                          <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">
                            Трек-номер:
                          </span>
                          <input
                            type="text"
                            defaultValue={activeSelectedOrder.postal_tracking_number || ''}
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val !== (activeSelectedOrder.postal_tracking_number || '')) {
                                updateDocFieldsMutation.mutate({
                                  id: activeSelectedOrder.id,
                                  postal_tracking_number: val,
                                  docs_sent: val ? true : activeSelectedOrder.docs_sent,
                                  docs_sent_date:
                                    val && !activeSelectedOrder.docs_sent_date
                                      ? new Date().toISOString().split('T')[0]
                                      : activeSelectedOrder.docs_sent_date,
                                });
                              }
                            }}
                            placeholder="Почтовый трек / код отправления..."
                            className="w-full px-2.5 py-1 border border-purple-300 rounded-lg text-xs font-mono font-bold bg-white text-slate-900 focus:ring-2 focus:ring-purple-400"
                          />
                        </div>
                      </div>

                      {/* Пункт 2 */}
                      <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200">
                        <label className="flex items-center gap-2 cursor-pointer font-black text-xs text-slate-900 select-none">
                          <input
                            type="checkbox"
                            checked={Boolean(activeSelectedOrder.docs_received)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              updateDocFieldsMutation.mutate({
                                id: activeSelectedOrder.id,
                                docs_received: checked,
                                docs_received_date: checked
                                  ? activeSelectedOrder.docs_received_date ||
                                    new Date().toISOString().split('T')[0]
                                  : null,
                              });
                            }}
                            className="rounded border-purple-400 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                          />
                          <span>2. Документы получены заказчиком / на почте</span>
                          {activeSelectedOrder.docs_received_date && (
                            <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded ml-auto">
                              {activeSelectedOrder.docs_received_date}
                            </span>
                          )}
                        </label>
                      </div>

                      {/* Пункт 3 */}
                      <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-300 space-y-1.5">
                        <div className="flex items-center justify-between font-black text-xs text-amber-950">
                          <span className="flex items-center gap-1.5">
                            <span>📞</span> 3. Согласованная дата оплаты (прозвон):
                          </span>
                          {activeSelectedOrder.payment_promised_date ? (
                            <span className="text-[10px] font-mono font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                              В графике ✓
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-800 font-bold">не указана</span>
                          )}
                        </div>
                        <input
                          type="date"
                          defaultValue={activeSelectedOrder.payment_promised_date || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateDocFieldsMutation.mutate({
                              id: activeSelectedOrder.id,
                              payment_promised_date: val || null,
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-amber-400 rounded-lg text-xs font-mono font-bold bg-white text-slate-900"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Быстрые документы */}
                  <div className="bg-slate-100/90 rounded-2xl border border-slate-200 p-4 space-y-2">
                    <span className="text-[11px] font-black uppercase text-slate-700 tracking-wider block">
                      Документы и действия
                    </span>
                    <button
                      type="button"
                      onClick={() => setViewingPowerOfAttorney(activeSelectedOrder)}
                      className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs transition active:scale-95"
                    >
                      <span>📄</span>
                      <span>Сформировать доверенность на водителя</span>
                    </button>
                    {activeSelectedOrder.stage >= 6 && (
                      <Link
                        href="/receivables"
                        className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-xs transition text-center"
                      >
                        <span>📊</span>
                        <span>Открыть в разделе Дебиторка ↗</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── ПОДВАЛ ПОЛНОЭКРАННОГО ОКНА: КНОПКИ ДЕЙСТВИЙ И ПЕРЕХОДОВ ── */}
            <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 cursor-pointer transition text-xs"
                >
                  Закрыть
                </button>
                {activeSelectedOrder.stage <= 5 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCancellingOrder(activeSelectedOrder);
                      setCancelMode('claim');
                      setCancelReason('Отказ заказчика по обоюдному согласию');
                      const penalty = Math.round(
                        (Number(activeSelectedOrder.price) || 30000) * 0.2,
                      );
                      setClaimPenaltyAmount(String(penalty));
                      setClaimEmptyRunAmount('0');
                      setClaimIdleAmount('0');
                      setClaimNumber(
                        activeSelectedOrder.order_number.includes('001')
                          ? '01-ПР'
                          : `${activeSelectedOrder.order_number.replace(/\D/g, '') || '1'}-ПР`,
                      );
                      setClaimDate(new Date().toISOString().split('T')[0] ?? '');
                      setClaimDueDays('5');
                    }}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl font-black text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span>✕</span>
                    <span>Срыв заявки / Претензия</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {activeSelectedOrder.stage > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      updateStageMutation.mutate({
                        id: activeSelectedOrder.id,
                        stage: activeSelectedOrder.stage - 1,
                      })
                    }
                    className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>↶</span>
                    <span>Назад на этап {activeSelectedOrder.stage - 1}</span>
                  </button>
                )}

                {activeSelectedOrder.stage < 7 ? (
                  <button
                    type="button"
                    disabled={
                      activeSelectedOrder.stage === 5 &&
                      !(
                        activeSelectedOrder.docs_sent &&
                        activeSelectedOrder.docs_received &&
                        activeSelectedOrder.payment_promised_date
                      )
                    }
                    onClick={() => {
                      const isReady5 =
                        activeSelectedOrder.docs_sent &&
                        activeSelectedOrder.docs_received &&
                        activeSelectedOrder.payment_promised_date;
                      if (activeSelectedOrder.stage === 5 && !isReady5) {
                        alert(
                          'Заполните 3 пункта документооборота выше перед переводом в Дебиторку!',
                        );
                        return;
                      }
                      updateStageMutation.mutate({
                        id: activeSelectedOrder.id,
                        stage: activeSelectedOrder.stage + 1,
                      });
                    }}
                    className={`px-5 py-2 rounded-xl font-black text-xs transition flex items-center gap-2 shadow-sm ${
                      activeSelectedOrder.stage === 5 &&
                      !(
                        activeSelectedOrder.docs_sent &&
                        activeSelectedOrder.docs_received &&
                        activeSelectedOrder.payment_promised_date
                      )
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : `${STAGE_CONFIG[activeSelectedOrder.stage]?.btnClass || ''} cursor-pointer active:scale-95`
                    }`}
                  >
                    <span>
                      {activeSelectedOrder.stage === 5 &&
                      !(
                        activeSelectedOrder.docs_sent &&
                        activeSelectedOrder.docs_received &&
                        activeSelectedOrder.payment_promised_date
                      )
                        ? '🔒 Требуется 3/3 для Дебиторки'
                        : STAGE_CONFIG[activeSelectedOrder.stage]?.btnForward || 'Вперед →'}
                    </span>
                  </button>
                ) : (
                  <div className="px-4 py-2 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl font-black text-xs">
                    ✓ Заявка оплачена и закрыта
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           МОДАЛЬНОЕ ОКНО СОЗДАНИЯ НОВОЙ ЗАЯВКИ АТИ
           ══════════════════════════════════════════════════════════════════════ */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <span className="text-xl">🚚</span>
                <div>
                  <h3 className="text-sm font-black font-display">Новый Договор-Заявка АТИ</h3>
                  <p className="text-[11px] text-slate-400">
                    Менеджер заносит контрагента для связки с рейсом и дебиторкой
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-3 text-xs">
              {/* Автозагрузка Договор-Заявки (PDF / скан / фото) */}
              <div className="p-3.5 bg-gradient-to-br from-indigo-50/90 via-sky-50/60 to-purple-50/90 border-2 border-dashed border-indigo-300 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={handleContractFileUpload}
                />
                <button
                  type="button"
                  disabled={isParsingContract}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="text-base">{isParsingContract ? '⏳' : '📎'}</span>
                  <span>
                    {isParsingContract
                      ? 'Распознавание договора (OCR / PDF)...'
                      : 'Загрузить Договор-Заявку (PDF / скан / фото)'}
                  </span>
                </button>
                <p className="text-[11px] text-slate-500 font-medium max-w-sm">
                  Поддерживает цифровые PDF (из 1С, Word, АТИ), сканы и фото. Форма заполнится всеми
                  данными автоматически.
                </p>

                {contractParseSuccess && (
                  <div className="w-full px-3 py-2 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl font-bold text-left text-[11px] flex items-start gap-2 shadow-2xs">
                    <span className="text-emerald-600 text-sm">✓</span>
                    <span>{contractParseSuccess}</span>
                  </div>
                )}

                {contractParseError && (
                  <div className="w-full px-3 py-2 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl font-bold text-left text-[11px] flex items-start gap-2 shadow-2xs">
                    <span className="text-rose-600 text-sm">✕</span>
                    <span>{contractParseError}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                  Номер Договор-Заявки *
                </label>
                <input
                  type="text"
                  required
                  value={newOrderNumber}
                  onChange={(e) => setNewOrderNumber(e.target.value)}
                  className="w-full px-3 py-1.5 border-2 border-slate-300 rounded-xl font-mono font-bold text-slate-900"
                />
              </div>

              {/* Блок выбора / создания контрагента */}
              <div className="p-3 bg-indigo-50/70 border-2 border-indigo-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-indigo-950 uppercase">
                    Контрагент (Заказчик) *
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setNewCounterpartyMode('select')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        newCounterpartyMode === 'select'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-indigo-700 border border-indigo-200'
                      }`}
                    >
                      Из базы
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCounterpartyMode('create')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        newCounterpartyMode === 'create'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-indigo-700 border border-indigo-200'
                      }`}
                    >
                      + Новый
                    </button>
                  </div>
                </div>

                {newCounterpartyMode === 'select' ? (
                  <select
                    value={selectedCpId}
                    onChange={(e) => setSelectedCpId(e.target.value)}
                    className="w-full px-3 py-1.5 border-2 border-indigo-300 rounded-xl font-bold bg-white text-slate-900"
                  >
                    <option value="">Выберите контрагента из базы...</option>
                    {counterparties.map((cp) => (
                      <option key={cp.id} value={cp.id}>
                        {cp.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      required
                      placeholder="Название: ООО «Новый Заказчик»"
                      value={newCpName}
                      onChange={(e) => setNewCpName(e.target.value)}
                      className="w-full px-3 py-1.5 border-2 border-indigo-300 rounded-xl font-bold bg-white text-slate-900"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="ИНН"
                        value={newCpInn}
                        onChange={(e) => setNewCpInn(e.target.value)}
                        className="w-full px-2.5 py-1 border border-indigo-200 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Телефон"
                        value={newCpPhone}
                        onChange={(e) => setNewCpPhone(e.target.value)}
                        className="w-full px-2.5 py-1 border border-indigo-200 rounded-lg text-xs"
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={newCpEmail}
                        onChange={(e) => setNewCpEmail(e.target.value)}
                        className="w-full px-2.5 py-1 border border-indigo-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                )}
                <span className="text-[10px] text-indigo-700 block">
                  Этот контрагент будет доступен водителю при завершении рейса
                </span>
              </div>

              {/* Маршрут */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                    Откуда (Погрузка) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="г. Арамиль"
                    value={newPickup}
                    onChange={(e) => setNewPickup(e.target.value)}
                    className="w-full px-3 py-1.5 border-2 border-slate-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                    Куда (Выгрузка) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="г. Уфа"
                    value={newDelivery}
                    onChange={(e) => setNewDelivery(e.target.value)}
                    className="w-full px-3 py-1.5 border-2 border-slate-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              {/* Автомобиль и водитель */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                    Автотранспорт
                  </label>
                  <input
                    type="text"
                    value={newAssetReg}
                    onChange={(e) => setNewAssetReg(e.target.value)}
                    placeholder="Валдай О188ТА 196"
                    className="w-full px-3 py-1.5 border-2 border-slate-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                    Водитель
                  </label>
                  <input
                    type="text"
                    value={newDriver}
                    onChange={(e) => setNewDriver(e.target.value)}
                    placeholder="ФИО водителя"
                    className="w-full px-3 py-1.5 border-2 border-slate-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              {/* Финансы и Документооборот */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                    Фрахт (₽) *
                  </label>
                  <input
                    type="number"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full px-3 py-1.5 border-2 border-slate-300 rounded-xl font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                    Тип документов *
                  </label>
                  <select
                    value={newDocType}
                    onChange={(e) => setNewDocType(e.target.value as 'etrn' | 'paper')}
                    className="w-full px-3 py-1.5 border-2 border-slate-300 rounded-xl font-bold bg-white"
                  >
                    <option value="etrn">⚡ ЭТрН + ЭДО</option>
                    <option value="paper">📮 Бумажная ТрН + Почта РФ</option>
                  </select>
                </div>
              </div>

              {/* Груз */}
              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                  Груз и параметры
                </label>
                <input
                  type="text"
                  placeholder="Подоконники, 4т, 5 поддонов, ремни"
                  value={newCargo}
                  onChange={(e) => setNewCargo(e.target.value)}
                  className="w-full px-3 py-1.5 border-2 border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div className="p-2 bg-amber-50 rounded-xl border border-amber-200 text-[10px] text-amber-900">
                ⚠️ <strong>Правило старта:</strong> Работа начинается после отправки подписанного
                скана на почту заказчику.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={createOrderMutation.isPending}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {createOrderMutation.isPending ? 'Создание...' : 'Создать заявку'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           МОДАЛЬНОЕ ОКНО СРЫВА / ВЫСТАВЛЕНИЯ ПРЕТЕНЗИИ
           ══════════════════════════════════════════════════════════════════════ */}
      {/* ══════════════════════════════════════════════════════════════════════
           МОДАЛЬНОЕ ОКНО СРЫВА / ВЫСТАВЛЕНИЯ ПРЕТЕНЗИИ (УПРОЩЕННОЕ)
           ══════════════════════════════════════════════════════════════════════ */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-2xl max-w-lg w-full overflow-hidden my-auto">
            {/* Шапка модалки */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-2">
                  <span>⚠️</span>
                  <span>Срыв договор-заявки {cancellingOrder.order_number}</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Контрагент:{' '}
                  <strong className="text-white">{cancellingOrder.counterparty_name}</strong> ·
                  Фрахт:{' '}
                  <strong className="text-emerald-400 font-mono">
                    {Number(cancellingOrder.price || 0).toLocaleString('ru-RU')} ₽
                  </strong>
                </p>
              </div>
              <button
                onClick={() => setCancellingOrder(null)}
                className="text-slate-400 hover:text-white text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <p className="text-xs font-bold text-slate-800">
                Выберите действие по сорванной заявке:
              </p>

              {/* ── ВАРИАНТ 1: ВЫСТАВИТЬ ПРЕТЕНЗИЮ (ГЛАВНЫЙ) ── */}
              <div
                onClick={() => setCancelMode('claim')}
                className={`p-4 rounded-2xl border-2 transition cursor-pointer ${
                  cancelMode === 'claim'
                    ? 'border-indigo-600 bg-indigo-50/70 shadow-sm'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⚖️</span>
                      <span className="font-black text-sm text-slate-900">
                        Выставить Претензию Заказчику
                      </span>
                      <span className="bg-amber-100 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-bold">
                        Штраф 20%
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Срыв по вине заказчика (не готов груз / отказ от машины). Штраф по ст. 35 УАТ
                      РФ:{' '}
                      <strong>
                        {(
                          (Number(claimPenaltyAmount) || 0) +
                          (Number(claimEmptyRunAmount) || 0) +
                          (Number(claimIdleAmount) || 0)
                        ).toLocaleString('ru-RU')}{' '}
                        ₽
                      </strong>
                      .
                    </p>
                    <div className="text-[11px] text-indigo-700 font-bold pt-0.5">
                      ✓ Заявка станет претензией, а при согласовании сумма автоматически попадёт в{' '}
                      <strong>Дебиторку</strong>.
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="modal_cancel_mode"
                    checked={cancelMode === 'claim'}
                    onChange={() => setCancelMode('claim')}
                    className="mt-1 w-4 h-4 text-indigo-600 cursor-pointer shrink-0"
                  />
                </div>

                {cancelMode === 'claim' && (
                  <div
                    className="mt-3 pt-3 border-t border-indigo-200/80 space-y-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Ссылка на детальные настройки (по умолчанию скрыты для простоты) */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowDetailedClaim(!showDetailedClaim)}
                        className="text-[11px] text-indigo-700 hover:text-indigo-900 underline font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <span>
                          {showDetailedClaim
                            ? '▲ Скрыть детализацию'
                            : '⚙️ Изменить номер / дату / добавить простой или подачу'}
                        </span>
                      </button>

                      {showDetailedClaim && (
                        <div className="mt-2 p-3 bg-white rounded-xl border border-indigo-200 space-y-2.5 shadow-2xs">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                                Исх. номер:
                              </label>
                              <input
                                type="text"
                                value={claimNumber}
                                onChange={(e) => setClaimNumber(e.target.value)}
                                className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                                Срок оплаты (дней):
                              </label>
                              <input
                                type="number"
                                value={claimDueDays}
                                onChange={(e) => setClaimDueDays(e.target.value)}
                                className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-bold text-center"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                            <div>
                              <label className="text-[9px] font-bold text-slate-600 block">
                                Штраф 20%:
                              </label>
                              <input
                                type="number"
                                value={claimPenaltyAmount}
                                onChange={(e) => setClaimPenaltyAmount(e.target.value)}
                                className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-600 block">
                                Подача/пробег:
                              </label>
                              <input
                                type="number"
                                value={claimEmptyRunAmount}
                                onChange={(e) => setClaimEmptyRunAmount(e.target.value)}
                                className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-600 block">
                                Простой:
                              </label>
                              <input
                                type="number"
                                value={claimIdleAmount}
                                onChange={(e) => setClaimIdleAmount(e.target.value)}
                                className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={cancelOrderMutation.isPending}
                      onClick={() => {
                        const totalClaim =
                          (Number(claimPenaltyAmount) || 0) +
                          (Number(claimEmptyRunAmount) || 0) +
                          (Number(claimIdleAmount) || 0);

                        cancelOrderMutation.mutate({
                          id: cancellingOrder.id,
                          reason: 'Срыв на погрузке (груз не готов / отказ заказчика)',
                          has_claim: true,
                          claim_status: 'issued',
                          claim_number: claimNumber.trim() || '01-ПР',
                          claim_date: claimDate,
                          claim_amount: totalClaim,
                          claim_penalty_amount: Number(claimPenaltyAmount) || 0,
                          claim_empty_run_amount: Number(claimEmptyRunAmount) || 0,
                          claim_idle_amount: Number(claimIdleAmount) || 0,
                          claim_due_days: Number(claimDueDays) || 5,
                        });
                      }}
                      className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <span>⚖️</span>
                      <span>
                        {cancelOrderMutation.isPending
                          ? 'Оформление претензии...'
                          : `Снять с доски и выставить Претензию (${(
                              (Number(claimPenaltyAmount) || 0) +
                              (Number(claimEmptyRunAmount) || 0) +
                              (Number(claimIdleAmount) || 0)
                            ).toLocaleString('ru-RU')} ₽)`}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* ── ВАРИАНТ 2: ПРОСТАЯ ОТМЕНА БЕЗ ПРЕТЕНЗИЙ ── */}
              <div
                onClick={() => setCancelMode('simple')}
                className={`p-4 rounded-2xl border-2 transition cursor-pointer ${
                  cancelMode === 'simple'
                    ? 'border-rose-500 bg-rose-50/70 shadow-sm'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">❌</span>
                      <span className="font-black text-sm text-slate-900">
                        Простая отмена (без претензий)
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Поломка автомобиля парка или отказ по обоюдному согласию. Финансовые
                      требования не предъявляются, заявка уходит в архив срывов.
                    </p>
                  </div>
                  <input
                    type="radio"
                    name="modal_cancel_mode"
                    checked={cancelMode === 'simple'}
                    onChange={() => setCancelMode('simple')}
                    className="mt-1 w-4 h-4 text-rose-600 cursor-pointer shrink-0"
                  />
                </div>

                {cancelMode === 'simple' && (
                  <div
                    className="mt-3 pt-3 border-t border-rose-200/80 space-y-2.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">
                        Причина отмены:
                      </label>
                      <select
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                      >
                        <option value="Отказ заказчика по обоюдному согласию">
                          Отказ заказчика по обоюдному согласию
                        </option>
                        <option value="Поломка / опоздание автомобиля парка">
                          Поломка / опоздание автомобиля парка
                        </option>
                        <option value="Несоответствие веса / габаритов груза">
                          Несоответствие веса / габаритов груза
                        </option>
                        <option value="Другая причина">Другая причина</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      disabled={cancelOrderMutation.isPending}
                      onClick={() =>
                        cancelOrderMutation.mutate({
                          id: cancellingOrder.id,
                          reason: cancelReason,
                          has_claim: false,
                        })
                      }
                      className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <span>✕</span>
                      <span>
                        {cancelOrderMutation.isPending ? 'Снятие...' : 'Снять без претензий'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setCancellingOrder(null)}
                className="px-4 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-100 cursor-pointer text-xs"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           СПИСОК ПРЕТЕНЗИЙ И СОРВАННЫХ ЗАЯВОК (АРХИВ СРЫВОВ)
           ══════════════════════════════════════════════════════════════════════ */}
      {showCancelledList && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden my-auto">
            {/* Шапка */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🗂️</span>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wide">
                    Управление претензиями и срывами ({cancelledOrders.length})
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Претензионная работа, контроль оплат и история сорванных рейсов
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCancelledList(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Вкладки: В работе vs Архив оплаченных vs Простые срывы */}
            <div className="px-5 pt-2.5 border-b border-slate-200 flex gap-2 bg-slate-50 shrink-0">
              <button
                type="button"
                onClick={() => setCancelledListTab('claims')}
                className={`pb-2 px-3 text-xs font-black border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  cancelledListTab === 'claims'
                    ? 'border-amber-600 text-amber-900 bg-white rounded-t-lg border-t border-x border-b-white -mb-px'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>⚖️ Претензии в работе</span>
                <span className="bg-amber-100 text-amber-900 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
                  {activeClaimOrders.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCancelledListTab('claims_archive')}
                className={`pb-2 px-3 text-xs font-black border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  cancelledListTab === 'claims_archive'
                    ? 'border-emerald-600 text-emerald-900 bg-white rounded-t-lg border-t border-x border-b-white -mb-px'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>📁 Архив оплаченных</span>
                <span className="bg-emerald-100 text-emerald-900 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
                  {paidClaimOrders.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCancelledListTab('simple')}
                className={`pb-2 px-3 text-xs font-black border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  cancelledListTab === 'simple'
                    ? 'border-slate-800 text-slate-900 bg-white rounded-t-lg border-t border-x border-b-white -mb-px'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>❌ Срывы без претензий</span>
                <span className="bg-slate-200 text-slate-800 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
                  {simpleCancelledOrders.length}
                </span>
              </button>
            </div>

            {/* Содержимое вкладок */}
            <div className="p-5 space-y-3 overflow-y-auto flex-1 text-xs">
              {cancelledListTab === 'claims' ? (
                <>
                  {/* Памятка по этапам претензии */}
                  <div className="p-3 bg-indigo-50 border-2 border-indigo-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-indigo-950">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl shrink-0">🚀</span>
                      <div className="space-y-0.5">
                        <div className="font-black text-[11px]">
                          Как перемещать претензию дальше (попадание в Дебиторку):
                        </div>
                        <div className="text-[10px] text-indigo-900 leading-tight">
                          <strong>1. Выставили:</strong> претензия сформирована и отправлена
                          заказчику. <br />
                          <strong>2. Согласовали:</strong> когда заказчик подтвердил срыв, нажмите{' '}
                          <span className="font-bold underline">
                            «✓ Заказчик согласовал → В Дебиторку»
                          </span>{' '}
                          (контрагент сразу появится в разделе <strong>Дебиторка</strong>!). <br />
                          <strong>3. Оплата:</strong> после поступления денег на р/с нажмите{' '}
                          <span className="font-bold underline">«✓ Оплачено на Р/С»</span>.
                        </div>
                      </div>
                    </div>
                  </div>

                  {activeClaimOrders.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 font-bold space-y-2">
                      <div className="text-3xl">🎉</div>
                      <div className="text-sm text-slate-700 font-bold">
                        Нет активных претензий в работе
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Все претензии согласованы и оплачены заказчиками.
                      </div>
                      {paidClaimOrders.length > 0 && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => setCancelledListTab('claims_archive')}
                            className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs rounded-xl cursor-pointer transition"
                          >
                            📁 Перейти в Архив оплаченных ({paidClaimOrders.length})
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    activeClaimOrders.map((ord) => {
                      const status = ord.claim_status || 'issued';
                      return (
                        <div
                          key={ord.id}
                          className="p-3.5 bg-white rounded-2xl border-2 border-amber-300 shadow-2xs space-y-3 hover:border-amber-400 transition"
                        >
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-slate-900 text-sm">
                                  Претензия № {ord.claim_number || '01-ПР'}
                                </span>
                                <span className="text-[10px] text-slate-500 font-bold">
                                  к заявке {ord.order_number}
                                </span>
                                <span className="text-slate-400 font-mono text-[10px]">
                                  от {ord.claim_date || new Date().toLocaleDateString('ru-RU')}
                                </span>
                              </div>
                              <div className="font-bold text-slate-900 text-xs mt-0.5">
                                Заказчик: {ord.counterparty_name}
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="text-[10px] text-slate-500 block">
                                Сумма требований:
                              </span>
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="font-mono font-black text-amber-950 text-base">
                                  {Number(ord.claim_amount || 6000).toLocaleString('ru-RU')} ₽
                                </span>
                                <button
                                  type="button"
                                  onClick={() => openAgreeClaimModal(ord)}
                                  className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-[10px] font-bold cursor-pointer transition"
                                  title="Изменить согласованную сумму претензии"
                                >
                                  ✏️ Изменить
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Пайплайн претензии */}
                          <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold">
                            <div
                              className={`p-1.5 rounded-lg border ${
                                status === 'issued'
                                  ? 'bg-amber-100 border-amber-300 text-amber-950 font-black'
                                  : 'bg-slate-100 border-slate-200 text-slate-500'
                              }`}
                            >
                              1. Выставили претензию
                            </div>
                            <div
                              className={`p-1.5 rounded-lg border ${
                                status === 'agreed' || status === 'waiting_payment'
                                  ? 'bg-rose-100 border-rose-300 text-rose-950 font-black'
                                  : status === 'paid'
                                    ? 'bg-slate-100 border-slate-200 text-slate-500'
                                    : 'bg-slate-50 border-slate-200 text-slate-400'
                              }`}
                            >
                              2. Согласовали / Дебиторка
                            </div>
                            <div
                              className={`p-1.5 rounded-lg border ${
                                status === 'paid'
                                  ? 'bg-emerald-100 border-emerald-300 text-emerald-950 font-black'
                                  : 'bg-slate-50 border-slate-200 text-slate-400'
                              }`}
                            >
                              3. Ждём оплаты / Оплачено
                            </div>
                          </div>

                          {/* Кнопки управления */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setViewingClaimOrder(ord)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center gap-1.5 border border-slate-300 cursor-pointer transition"
                              >
                                <span>📄</span>
                                <span>Печать претензии</span>
                              </button>

                              <button
                                type="button"
                                disabled={restoreOrderMutation.isPending}
                                onClick={() => restoreOrderMutation.mutate({ id: ord.id })}
                                className="px-2 py-1.5 bg-white hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-[11px] border border-slate-200 cursor-pointer transition"
                                title="Аннулировать претензию и вернуть рейс на Канбан"
                              >
                                ↶ На доску
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              {status === 'issued' && (
                                <button
                                  type="button"
                                  onClick={() => openAgreeClaimModal(ord)}
                                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs cursor-pointer shadow-xs transition"
                                  title="Выбрать согласованную сумму (10%, 20%) и передать в Дебиторку"
                                >
                                  ✓ Заказчик согласовал → Передать в Дебиторку
                                </button>
                              )}

                              {(status === 'agreed' || status === 'waiting_payment') && (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openAgreeClaimModal(ord)}
                                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-bold text-xs cursor-pointer transition"
                                    title="Изменить согласованную сумму претензии в Дебиторке"
                                  >
                                    ✏️ Изменить сумму
                                  </button>
                                  <Link
                                    href="/receivables"
                                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl font-bold text-xs flex items-center gap-1 transition"
                                  >
                                    <span>
                                      В Дебиторке:{' '}
                                      {Number(ord.claim_amount || 6000).toLocaleString('ru-RU')} ₽
                                    </span>
                                    <span>↗</span>
                                  </Link>
                                  <button
                                    type="button"
                                    disabled={updateClaimStatusMutation.isPending}
                                    onClick={() =>
                                      updateClaimStatusMutation.mutate({
                                        id: ord.id,
                                        claim_status: 'paid',
                                      })
                                    }
                                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs cursor-pointer shadow-xs transition"
                                  >
                                    ✓ Оплачено на Р/С
                                  </button>
                                </div>
                              )}

                              {status === 'paid' && (
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl font-black text-xs">
                                  ✓ Претензия оплачена
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              ) : cancelledListTab === 'claims_archive' ? (
                /* Вкладка: Архив оплаченных претензий */
                <>
                  <div className="p-3 bg-emerald-50 border-2 border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-emerald-950">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl shrink-0">📁</span>
                      <div className="space-y-0.5">
                        <div className="font-black text-[11px]">
                          Архив успешно оплаченных претензий по срывам
                        </div>
                        <div className="text-[10px] text-emerald-900 leading-tight">
                          Здесь хранятся закрытые претензии, по которым заказчики перечислили штраф
                          на расчётный счёт. Они не занимают место на доске и закрыты в дебиторке.
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-emerald-700 font-bold block">
                        Всего взыскано:
                      </span>
                      <span className="font-mono font-black text-emerald-950 text-sm">
                        {paidClaimsSum.toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  </div>

                  {paidClaimOrders.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 font-bold">
                      В архиве пока нет оплаченных претензий.
                    </div>
                  ) : (
                    paidClaimOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-3.5 bg-white rounded-2xl border-2 border-emerald-300 shadow-2xs space-y-3 hover:border-emerald-400 transition"
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-slate-900 text-sm">
                                Претензия № {ord.claim_number || '01-ПР'}
                              </span>
                              <span className="text-[10px] text-slate-500 font-bold">
                                к заявке {ord.order_number}
                              </span>
                              <span className="text-slate-400 font-mono text-[10px]">
                                от {ord.claim_date || new Date().toLocaleDateString('ru-RU')}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                ✓ Оплачено на Р/С
                              </span>
                            </div>
                            <div className="font-bold text-slate-900 text-xs mt-0.5">
                              Заказчик: {ord.counterparty_name}
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 block">
                              Оплаченная сумма:
                            </span>
                            <span className="font-mono font-black text-emerald-700 text-base">
                              + {Number(ord.claim_amount || 6000).toLocaleString('ru-RU')} ₽
                            </span>
                          </div>
                        </div>

                        {/* Инфо-полоса */}
                        <div className="flex items-center justify-between text-[11px] bg-emerald-50/60 p-2 rounded-xl border border-emerald-200 text-emerald-950">
                          <div className="flex items-center gap-1.5">
                            <span>✅</span>
                            <span className="font-semibold">
                              Штраф поступил на расчетный счёт. Задолженность в Дебиторке закрыта.
                            </span>
                          </div>
                          {ord.claim_paid_at && (
                            <span className="text-[10px] text-emerald-700 font-mono">
                              Дата оплаты: {new Date(ord.claim_paid_at).toLocaleDateString('ru-RU')}
                            </span>
                          )}
                        </div>

                        {/* Кнопки */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setViewingClaimOrder(ord)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center gap-1.5 border border-slate-300 cursor-pointer transition"
                          >
                            <span>📄</span>
                            <span>Печать бланка претензии</span>
                          </button>

                          <button
                            type="button"
                            disabled={updateClaimStatusMutation.isPending}
                            onClick={() =>
                              updateClaimStatusMutation.mutate({
                                id: ord.id,
                                claim_status: 'waiting_payment',
                              })
                            }
                            className="px-2.5 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-[10px] font-semibold cursor-pointer transition"
                            title="Вернуть претензию из архива в статус ожидания оплаты"
                          >
                            ↶ Вернуть в работу
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </>
              ) : (
                /* Вкладка простых срывов */
                <>
                  <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-950">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl shrink-0">⚖️</span>
                      <div>
                        <div className="font-black text-[11px]">
                          Срыв по вине заказчика? Переведите заявку в Претензию!
                        </div>
                        <div className="text-[10px] text-amber-900 leading-tight">
                          Нажмите кнопку <strong>«⚖️ Оформить Претензию (20%)»</strong> на карточке
                          ниже. Система рассчитает штраф 20% (ст. 35 УАТ РФ) и после согласования{' '}
                          <strong>автоматически перенесёт долг в Дебиторку</strong>.
                        </div>
                      </div>
                    </div>
                  </div>

                  {simpleCancelledOrders.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 font-bold">
                      Нет сорванных или отменённых заявок.
                    </div>
                  ) : (
                    simpleCancelledOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-3 bg-slate-50 rounded-2xl border-2 border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-900 text-xs">
                              {ord.order_number}
                            </span>
                            <span className="text-[9px] font-bold bg-slate-200 text-slate-800 px-1.5 py-0.2 rounded">
                              В архиве срывов
                            </span>
                            <span className="text-slate-500 font-mono text-[10px]">
                              {new Date(ord.updated_at || ord.created_at).toLocaleDateString(
                                'ru-RU',
                              )}
                            </span>
                          </div>
                          <div className="font-bold text-slate-800 text-[11px]">
                            {ord.counterparty_name} ·{' '}
                            <span className="font-mono text-slate-900">
                              {Number(ord.price || 0).toLocaleString('ru-RU')} ₽
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-600 font-medium">
                            Причина: <strong>{ord.cancel_reason || 'Срыв рейса'}</strong>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setShowCancelledList(false);
                              setCancellingOrder(ord);
                              setCancelMode('claim');
                              setCancelReason(
                                ord.cancel_reason || 'Отказ заказчика по обоюдному согласию',
                              );
                              const penalty = Math.round((Number(ord.price) || 30000) * 0.2);
                              setClaimPenaltyAmount(String(penalty));
                              setClaimEmptyRunAmount('0');
                              setClaimIdleAmount('0');
                              setClaimNumber(
                                ord.order_number.includes('001')
                                  ? '01-ПР'
                                  : `${ord.order_number.replace(/\D/g, '') || '1'}-ПР`,
                              );
                              setClaimDate(new Date().toISOString().split('T')[0] ?? '');
                              setClaimDueDays('5');
                            }}
                            className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                            title="Оформить официальную претензию за срыв по ст. 35 УАТ РФ (20% штрафа)"
                          >
                            <span>⚖️</span>
                            <span>Оформить Претензию (20%)</span>
                          </button>
                          <button
                            type="button"
                            disabled={restoreOrderMutation.isPending}
                            onClick={() => restoreOrderMutation.mutate({ id: ord.id })}
                            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border-2 border-slate-300 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                          >
                            <span>↶</span>
                            <span>На Канбан</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowCancelledList(false)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-slate-700 cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           ОФИЦИАЛЬНЫЙ БЛАНК ПРЕТЕНЗИИ (ПО ПРИЛОЖЕННОМУ ДОКУМЕНТУ ПРЕТЕНЗИЯ № 1)
           ══════════════════════════════════════════════════════════════════════ */}
      {viewingClaimOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white">
          <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col overflow-hidden my-auto print:max-h-none print:border-none print:shadow-none print:rounded-none">
            {/* Панель действий вверху */}
            <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0 print:hidden">
              <div className="flex items-center gap-2">
                <span className="text-xl">📄</span>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wide">
                    Официальная Претензия Исх. № {viewingClaimOrder.claim_number || '01-ПР'}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Готовый к отправке и печати документ по ст. 35 УАТ РФ
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                >
                  <span>🖨️</span>
                  <span>Распечатать / Сохранить в PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingClaimOrder(null)}
                  className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer px-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Тело официального документа */}
            <div className="p-8 sm:p-12 overflow-y-auto flex-1 font-serif text-[13px] leading-relaxed text-slate-950 bg-white">
              {/* Шапка КОМУ / ОТ КОГО */}
              <div className="grid grid-cols-2 gap-8 border-b-2 border-slate-950 pb-4 mb-4">
                <div className="space-y-1">
                  <div className="font-bold text-[11px] uppercase tracking-wide text-slate-600 font-sans">
                    КОМУ (ЗАКАЗЧИК):
                  </div>
                  <div className="font-black text-sm font-sans">
                    {viewingClaimOrder.counterparty_name || 'ООО «ТРАНССЕРВИС»'}
                  </div>
                  <div className="text-[11px] leading-tight text-slate-700 font-sans space-y-0.5">
                    <div>
                      ИНН: {viewingClaimOrder.counterparty_inn || '6679091866'} / КПП: 667001001
                    </div>
                    <div>ОГРН: 1169658048560</div>
                    <div>
                      Адрес: 620041, Свердловская обл., г. Екатеринбург, ул. Уральская, д. 1, кв. 31
                    </div>
                    <div>
                      Почтовый адрес: 620000, г. Екатеринбург, пр-кт Ленина, стр. 39, а/я 494
                    </div>
                    <div>
                      Тел.:{' '}
                      {viewingClaimOrder.counterparty_phone || '(343) 286-73-65, +7-952-147-6114'}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="font-bold text-[11px] uppercase tracking-wide text-slate-600 font-sans">
                    ОТ КОГО (ПЕРЕВОЗЧИК):
                  </div>
                  <div className="font-black text-sm font-sans">
                    ИП Нигамедьянов Александр Сергеевич
                  </div>
                  <div className="text-[11px] leading-tight text-slate-700 font-sans space-y-0.5">
                    <div>ИНН: 660704814106</div>
                    <div>ОГРНИП: 321665800053976</div>
                    <div>
                      Адрес: 624760, Свердловская обл., г. Верхняя Салда, ул. 25 Октября, д. 11, кв.
                      22
                    </div>
                    <div>Тел.: +7 (922) 180-09-11 (Александр)</div>
                    <div className="font-bold">АТИ: 923131</div>
                  </div>
                </div>
              </div>

              {/* Номер и дата */}
              <div className="flex justify-between items-center my-4 font-sans text-xs">
                <div>
                  <strong>Исх. № {viewingClaimOrder.claim_number || '01-ПР'}</strong>
                </div>
                <div>
                  «<strong>{viewingClaimOrder.claim_date || '15'}</strong>» октября 2026 г., г.
                  Екатеринбург
                </div>
              </div>

              {/* Название */}
              <div className="text-center space-y-1 my-6 font-sans">
                <h1 className="text-base font-black uppercase tracking-wider">ПРЕТЕНЗИЯ № 1</h1>
                <p className="text-xs font-bold text-slate-800 max-w-xl mx-auto leading-normal">
                  о возмещении штрафа и расходов в связи с непредставлением груза / отказом от
                  использования транспортного средства
                </p>
              </div>

              {/* Текст претензии */}
              <div className="space-y-3 text-justify text-xs leading-relaxed font-sans">
                <p>
                  Между Перевозчиком (ИП Нигамедьянов А. С.) и Заказчиком (
                  {viewingClaimOrder.counterparty_name}) был заключен Договор-заявка{' '}
                  {viewingClaimOrder.order_number} от 14.10.2026 г. на междугороднюю перевозку груза
                  ({viewingClaimOrder.cargo_description || 'подоконники, 4 т, 5 поддонов'}) по
                  маршруту: {viewingClaimOrder.pickup_address || 'г. Арамиль'} —{' '}
                  {viewingClaimOrder.delivery_address || 'г. Уфа'}. Согласованная стоимость фрахта
                  составляет{' '}
                  <strong>
                    {Number(viewingClaimOrder.price || 30000).toLocaleString('ru-RU')} (тридцать
                    тысяч) рублей 00 копеек, без НДС
                  </strong>
                  .
                </p>

                <p>
                  Во исполнение взятых на себя обязательств Перевозчиком под погрузку к назначенному
                  сроку ({viewingClaimOrder.pickup_date_time || '15.10.2026 г. к 09:00'}) было
                  предоставлено надлежащее транспортное средство:{' '}
                  <strong>{viewingClaimOrder.asset_name || 'Валдай, г/н О 188 ТА 196'}</strong>, под
                  управлением водителя {viewingClaimOrder.driver_name || 'Насртдинов В. А.'}.
                  Автомобиль своевременно прибыл по указанному в заявке адресу погрузки
                  грузоотправителя.
                </p>

                <p>
                  Однако 15.10.2026 г. Заказчик уведомил об отказе от использования предоставленного
                  автотранспорта (груз к отправке не предоставлен / срыв погрузки по вине
                  Заказчика). Согласно п. 3 условий Договора-заявки {viewingClaimOrder.order_number}
                  , а также в соответствии с ч. 1 ст. 35 Федерального закона от 08.11.2007 № 259-ФЗ
                  «Устав автомобильного транспорта и городского наземного электрического
                  транспорта», в случае непредоставления груза и отказа Клиента от использования ТС
                  Перевозчик вправе потребовать от Клиента выплаты{' '}
                  <strong>
                    штрафа в размере 20% от стоимости согласованного фрахта, а также возмещения
                    фактических расходов
                  </strong>
                  .
                </p>

                {/* Таблица */}
                <table className="w-full border-collapse border-2 border-slate-900 my-3 text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b-2 border-slate-900 font-bold">
                      <th className="border border-slate-400 p-1.5 w-8 text-center">№</th>
                      <th className="border border-slate-400 p-1.5 text-left">
                        Наименование требования / Основание
                      </th>
                      <th className="border border-slate-400 p-1.5 w-36 text-center">
                        Расчет суммы
                      </th>
                      <th className="border border-slate-400 p-1.5 w-28 text-right">Сумма, руб.</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-slate-400 p-1.5 text-center">1</td>
                      <td className="border border-slate-400 p-1.5">
                        Штраф за непредоставление груза / отказ от использования ТС (п. 3
                        Договора-заявки {viewingClaimOrder.order_number}, ч. 1 ст. 35 УАТ РФ)
                      </td>
                      <td className="border border-slate-400 p-1.5 text-center">
                        {Math.round(
                          (Number(
                            viewingClaimOrder.claim_penalty_amount ||
                              viewingClaimOrder.claim_amount ||
                              6000,
                          ) /
                            Number(viewingClaimOrder.price || 30000)) *
                            100,
                        )}
                        % от {Number(viewingClaimOrder.price || 30000).toLocaleString('ru-RU')} руб.
                      </td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono font-bold">
                        {Number(
                          viewingClaimOrder.claim_penalty_amount ||
                            viewingClaimOrder.claim_amount ||
                            Math.round(Number(viewingClaimOrder.price || 30000) * 0.2),
                        ).toLocaleString('ru-RU')}
                        ,00
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-400 p-1.5 text-center">2</td>
                      <td className="border border-slate-400 p-1.5">
                        Компенсация расходов на холостой пробег и подачу ТС к месту погрузки (г.
                        Арамиль)
                      </td>
                      <td className="border border-slate-400 p-1.5 text-center">
                        По фактическим затратам
                      </td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono font-bold">
                        {Number(viewingClaimOrder.claim_empty_run_amount || 0).toLocaleString(
                          'ru-RU',
                        )}
                        ,00
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-400 p-1.5 text-center">3</td>
                      <td className="border border-slate-400 p-1.5">
                        Простой автотранспорта в ожидании погрузки / отмены рейса
                      </td>
                      <td className="border border-slate-400 p-1.5 text-center">
                        По подтверждающим док.
                      </td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono font-bold">
                        {Number(viewingClaimOrder.claim_idle_amount || 0).toLocaleString('ru-RU')}
                        ,00
                      </td>
                    </tr>
                    <tr className="bg-slate-100 font-black border-t-2 border-slate-900">
                      <td
                        colSpan={3}
                        className="border border-slate-400 p-1.5 text-right uppercase"
                      >
                        ИТОГО К ОПЛАТЕ:
                      </td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono text-sm">
                        {Number(viewingClaimOrder.claim_amount || 6000).toLocaleString('ru-RU')},00
                      </td>
                    </tr>
                  </tbody>
                </table>

                <p className="font-bold">
                  Общая сумма требований составляет:{' '}
                  {Number(viewingClaimOrder.claim_amount || 6000).toLocaleString('ru-RU')} рублей 00
                  копеек.
                  {viewingClaimOrder.claim_notes && (
                    <span className="block font-normal text-slate-600 text-[11px] mt-0.5">
                      Условия согласования: {viewingClaimOrder.claim_notes}
                    </span>
                  )}
                </p>

                {/* Банковские реквизиты */}
                <div className="border border-slate-300 p-2.5 rounded-lg bg-slate-50 space-y-1 font-sans text-[11px] my-3">
                  <div className="font-black text-slate-800">
                    Реквизиты для перечисления денежных средств:
                  </div>
                  <div className="grid grid-cols-2 gap-x-4">
                    <div>Получатель: ИП Нигамедьянов Александр Сергеевич</div>
                    <div>Расчетный счет: 40802810500001961654</div>
                    <div>Банк получателя: АО «ТБанк»</div>
                    <div>Корр. счет: 30101810145250000974</div>
                    <div>БИК банка: 044525974</div>
                    <div>ИНН получателя / банка: 660704814106 / 7710140679</div>
                  </div>
                </div>

                <p>
                  На основании изложенного, руководствуясь условиями Договора-заявки{' '}
                  {viewingClaimOrder.order_number}, нормами ст. 309, 310, 784, 794 ГК РФ и ст. 35,
                  39 ФЗ «УАТ и ГНЭТ» № 259-ФЗ, просим перечислить указанную сумму в течение{' '}
                  <strong>{viewingClaimOrder.claim_due_days || 5} (пяти) банковских дней</strong> с
                  момента получения настоящей претензии. В случае неудовлетворения законных
                  требований в установленный срок мы будем вынуждены обратиться в Арбитражный суд
                  Свердловской области с отнесением на Ваш счет расходов на оплату госпошлины, услуг
                  представителя и процентов по ст. 395 ГК РФ.
                </p>

                <div className="pt-2 text-[11px] text-slate-700">
                  <div className="font-bold">Приложения:</div>
                  <ol className="list-decimal pl-4 space-y-0.5">
                    <li>
                      Копия Договора-заявки {viewingClaimOrder.order_number} с отметками сторон;
                    </li>
                    <li>
                      Копия путевого листа / подтверждение прибытия автомобиля{' '}
                      {viewingClaimOrder.asset_name || 'Валдай О 188 ТА 196'} на погрузку в г.
                      Арамиль;
                    </li>
                    <li>
                      Письменное / электронное подтверждение Заказчика об отказе от перевозки;
                    </li>
                    <li>Расчет и подтверждающие документы понесенных расходов.</li>
                  </ol>
                </div>

                {/* Подпись */}
                <div className="pt-6 flex justify-between items-end font-sans">
                  <div>
                    <div className="font-bold">Индивидуальный предприниматель</div>
                    <div className="font-black text-sm">ИП Нигамедьянов А. С.</div>
                  </div>
                  <div className="text-right">
                    <div className="inline-block border-b border-slate-900 w-44 pb-1 text-center italic text-slate-500 text-[11px]">
                      / Нигамедьянов А. С. /
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold mt-1">М.П.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           ОФИЦИАЛЬНЫЙ БЛАНК ДОВЕРЕННОСТИ ОТ ИП НА ВОДИТЕЛЯ
           ══════════════════════════════════════════════════════════════════════ */}
      {viewingPowerOfAttorney && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white">
          <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col overflow-hidden my-auto print:max-h-none print:border-none print:shadow-none print:rounded-none">
            {/* Панель действий вверху (скрыта при печати) */}
            <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0 print:hidden">
              <div className="flex items-center gap-2">
                <span className="text-xl">📄</span>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wide">
                    Доверенность от ИП на водителя
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Для сдачи оригиналов документов в {viewingPowerOfAttorney.counterparty_name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="/Doverennost_Voditel_Bayt_Tranzit.docx"
                  download
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <span>📥</span>
                  <span>Скачать Word (.docx)</span>
                </a>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                >
                  <span>🖨️</span>
                  <span>Распечатать / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingPowerOfAttorney(null)}
                  className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer px-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Официальный бланк А4 */}
            <div className="p-8 sm:p-12 overflow-y-auto flex-1 font-serif text-[13px] leading-relaxed text-slate-950 bg-white">
              {/* Реквизиты ИП */}
              <div className="border-b-2 border-slate-950 pb-3 mb-4 font-sans text-xs space-y-0.5 text-slate-800">
                <div className="font-black text-sm text-slate-950">
                  {viewingPowerOfAttorney.carrier_name ||
                    'Индивидуальный предприниматель Нигамедьянов Александр Сергеевич'}
                </div>
                <div>
                  <strong>Юридический адрес:</strong> 624760, Россия, Свердловская обл., г. Верхняя
                  Салда, ул. 25 Октября, д. 11, кв. 22
                </div>
                <div>
                  <strong>ИНН:</strong> {viewingPowerOfAttorney.carrier_inn || '660704814106'}{' '}
                  &nbsp;|&nbsp; <strong>ОГРНИП:</strong> 321665800053976
                </div>
                <div>
                  <strong>Банк:</strong>{' '}
                  {viewingPowerOfAttorney.carrier_bank || 'АО «ТБанк» г. Москва'} &nbsp;|&nbsp;{' '}
                  <strong>БИК:</strong> {viewingPowerOfAttorney.carrier_bik || '044525974'}
                </div>
                <div>
                  <strong>Р/С:</strong>{' '}
                  {viewingPowerOfAttorney.carrier_account || '40802810500001961654'} &nbsp;|&nbsp;{' '}
                  <strong>К/С:</strong> 30101810145250000974
                </div>
                <div>
                  <strong>Контакты:</strong>{' '}
                  {viewingPowerOfAttorney.carrier_contact || '7 922 180-09-11 Александр'}{' '}
                  &nbsp;|&nbsp; uralavto707@mail.ru
                </div>
              </div>

              {/* Заголовок */}
              <div className="text-center my-6">
                <h1 className="text-xl font-bold tracking-widest uppercase">ДОВЕРЕННОСТЬ</h1>
              </div>

              {/* Город и дата */}
              <div className="flex justify-between items-center mb-6 text-sm font-sans">
                <div>г. Верхняя Салда / г. Екатеринбург</div>
                <div className="font-bold">«15» октября 2026 г.</div>
              </div>

              {/* Текст поручения */}
              <div className="text-justify indent-8 space-y-3 mb-6 text-sm leading-relaxed">
                <p>
                  Индивидуальный предприниматель <strong>Нигамедьянов Александр Сергеевич</strong>{' '}
                  (ОГРНИП 321665800053976, ИНН 660704814106), настоящей доверенностью уполномочивает
                  гражданина РФ{' '}
                  <strong>
                    {viewingPowerOfAttorney.driver_name || 'Насртдинова Вячеслава Аксановича'}
                  </strong>
                  ,{' '}
                  {viewingPowerOfAttorney.driver_passport ||
                    'паспорт серия 6521 номер 342609, выдан 27.07.2021 г. ГУ МВД России по Свердловской области'}
                  , водительское удостоверение{' '}
                  <strong>{viewingPowerOfAttorney.driver_license || '99 31 051064'}</strong>,
                  управляющего грузовым автомобилем{' '}
                  <strong>
                    {viewingPowerOfAttorney.asset_name || 'Валдай'} (
                    {viewingPowerOfAttorney.asset_reg_number || 'О 188 ТА 196'})
                  </strong>
                  , производить в{' '}
                  <strong>
                    {viewingPowerOfAttorney.counterparty_name ||
                      'ООО «Байт Транзит Континент» (ООО «БТК»)'}
                  </strong>{' '}
                  следующие операции:
                </p>

                <ol className="list-decimal pl-8 space-y-2 mt-3 font-normal">
                  <li>Сдавать и получать грузы для транспортировки;</li>
                  <li>
                    Подписывать заявки на транспортировку груза, транспортные накладные (ТрН / ТТН),
                    акты выполненных работ (оказанных услуг), акты сдачи-приемки, экспедиторские
                    расписки, а также совершать все иные фактические и юридические действия и
                    формальности, связанные с выполнением настоящего поручения.
                  </li>
                </ol>

                <p className="pt-2">
                  Настоящая доверенность выдана сроком с <strong>15.10.2026 г.</strong> и
                  действительна по <strong>31.12.2026 г.</strong> включительно без права
                  передоверия.
                </p>
              </div>

              {/* Образец подписи */}
              <div className="my-6 text-sm">
                Образец подписи доверенного лица:{' '}
                <span className="inline-block border-b border-slate-900 w-44 pb-0.5"></span> /{' '}
                <strong>
                  {viewingPowerOfAttorney.driver_name
                    ? viewingPowerOfAttorney.driver_name.split(' ')[0] +
                      ' ' +
                      (viewingPowerOfAttorney.driver_name.split(' ')[1]?.[0] || '') +
                      '.' +
                      (viewingPowerOfAttorney.driver_name.split(' ')[2]?.[0] || '') +
                      '.'
                    : 'Насртдинов В. А.'}
                </strong>{' '}
                / подтверждаю.
              </div>

              {/* Подпись доверителя и М.П. */}
              <div className="mt-8 pt-4 flex justify-between items-end font-sans">
                <div>
                  <div className="font-bold text-xs uppercase text-slate-600">Доверитель:</div>
                  <div className="font-bold text-sm">Индивидуальный предприниматель</div>
                  <div className="font-black text-base">ИП Нигамедьянов А. С.</div>
                  <div className="font-bold text-xs mt-3 text-slate-500">М. П.</div>
                </div>
                <div className="text-right">
                  <div className="inline-block border-b border-slate-900 w-48 pb-1 text-center italic text-slate-500 text-xs">
                    / Нигамедьянов А. С. /
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           МОДАЛКА СОГЛАСОВАНИЯ / ИЗМЕНЕНИЯ СУММЫ ПРЕТЕНЗИИ
           ══════════════════════════════════════════════════════════════════════ */}
      {agreeingClaim && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-2xl max-w-lg w-full overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Шапка */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">⚖️</span>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wide">
                    {agreeingClaim.order.claim_status === 'issued'
                      ? 'Согласование претензии'
                      : 'Изменение суммы претензии'}
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Претензия № {agreeingClaim.order.claim_number || '01-ПР'} ·{' '}
                    {agreeingClaim.order.order_number}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAgreeingClaim(null)}
                className="text-slate-400 hover:text-white text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Информация о контрагенте и рейсе */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Контрагент (Заказчик):</span>
                  <strong className="text-slate-900 text-right">
                    {agreeingClaim.order.counterparty_name}
                  </strong>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Стоимость фрахта по заявке:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {Number(agreeingClaim.order.price || 30000).toLocaleString('ru-RU')} ₽
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600 border-t border-slate-200/80 pt-1">
                  <span>Текущая сумма претензии:</span>
                  <span className="font-mono font-bold text-amber-900">
                    {Number(agreeingClaim.order.claim_amount || 6000).toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </div>

              {/* Быстрые пресеты */}
              <div>
                <label className="text-[11px] font-black text-slate-700 block mb-1.5">
                  Быстрый выбор согласованной суммы:
                </label>
                {(() => {
                  const freight = Number(agreeingClaim.order.price || 30000);
                  const tenP = Math.round(freight * 0.1);
                  const fifteenP = Math.round(freight * 0.15);
                  const twentyP = Math.round(freight * 0.2);
                  const currentNum = Number(agreeingClaim.amount) || 0;

                  return (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setAgreeingClaim({
                            ...agreeingClaim,
                            amount: String(tenP),
                            notes: 'Согласовано 10% от фрахта без бюрократических проволочек',
                          })
                        }
                        className={`p-2.5 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                          currentNum === tenP
                            ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 shadow-xs'
                            : 'border-slate-200 hover:border-indigo-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-indigo-700">
                            ⭐ 10% (Рекомендовано)
                          </span>
                          <span className="font-mono font-bold text-xs">
                            {tenP.toLocaleString('ru-RU')} ₽
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 leading-tight">
                          Без бюрократических проволочек
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setAgreeingClaim({
                            ...agreeingClaim,
                            amount: String(fifteenP),
                            notes: 'Согласовано 15% от фрахта по обоюдному согласию',
                          })
                        }
                        className={`p-2.5 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                          currentNum === fifteenP
                            ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 shadow-xs'
                            : 'border-slate-200 hover:border-indigo-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-slate-800">15%</span>
                          <span className="font-mono font-bold text-xs">
                            {fifteenP.toLocaleString('ru-RU')} ₽
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 leading-tight">
                          Компромиссная сумма
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setAgreeingClaim({
                            ...agreeingClaim,
                            amount: String(twentyP),
                            notes: 'Стандартный штраф 20% по УАТ РФ',
                          })
                        }
                        className={`p-2.5 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                          currentNum === twentyP
                            ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 shadow-xs'
                            : 'border-slate-200 hover:border-indigo-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-slate-800">20% (УАТ РФ)</span>
                          <span className="font-mono font-bold text-xs">
                            {twentyP.toLocaleString('ru-RU')} ₽
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 leading-tight">
                          Полный законный штраф
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setAgreeingClaim({
                            ...agreeingClaim,
                            amount: String(freight),
                            notes: '100% компенсация полной стоимости фрахта',
                          })
                        }
                        className={`p-2.5 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                          currentNum === freight
                            ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 shadow-xs'
                            : 'border-slate-200 hover:border-indigo-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-slate-800">100% Фрахт</span>
                          <span className="font-mono font-bold text-xs">
                            {freight.toLocaleString('ru-RU')} ₽
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 leading-tight">
                          Полная оплата рейса
                        </span>
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* Поле ввода суммы */}
              <div>
                <label className="text-[11px] font-black text-slate-700 block mb-1">
                  Итоговая согласованная сумма к взысканию (₽):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={agreeingClaim.amount}
                    onChange={(e) =>
                      setAgreeingClaim({
                        ...agreeingClaim,
                        amount: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 focus:border-indigo-600 rounded-xl font-mono font-black text-base text-slate-900 outline-none"
                    placeholder="3000"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    ₽
                  </span>
                </div>
                {(() => {
                  const freight = Number(agreeingClaim.order.price || 30000);
                  const currentNum = Number(agreeingClaim.amount) || 0;
                  const pct = freight > 0 ? Math.round((currentNum / freight) * 100) : 0;
                  return (
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        Составляет <strong>{pct}%</strong> от стоимости рейса (
                        {freight.toLocaleString('ru-RU')} ₽)
                      </span>
                      {pct === 10 && (
                        <span className="text-emerald-700 font-bold">✓ Согласованные 10%</span>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Примечание */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Примечание к соглашению (необязательно):
                </label>
                <input
                  type="text"
                  value={agreeingClaim.notes}
                  onChange={(e) =>
                    setAgreeingClaim({
                      ...agreeingClaim,
                      notes: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 focus:border-indigo-600 rounded-xl text-xs text-slate-800"
                  placeholder="например: Согласовано 10% от фрахта без бюрократических проволочек"
                />
              </div>

              {/* Пояснение про Дебиторку */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-emerald-950">
                <span className="text-base shrink-0">💡</span>
                <p className="text-[11px] leading-relaxed">
                  Сумма{' '}
                  <strong>{Number(agreeingClaim.amount || 0).toLocaleString('ru-RU')} ₽</strong>{' '}
                  будет зафиксирована в заявке и автоматически отразится в{' '}
                  <strong>Дебиторке</strong> заказчика «{agreeingClaim.order.counterparty_name}».
                </p>
              </div>

              {/* Кнопки действий */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAgreeingClaim(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  disabled={updateClaimStatusMutation.isPending || !agreeingClaim.amount}
                  onClick={() => {
                    const finalAmount = Number(agreeingClaim.amount) || 0;
                    updateClaimStatusMutation.mutate(
                      {
                        id: agreeingClaim.order.id,
                        claim_status: 'agreed',
                        claim_amount: finalAmount,
                        claim_notes: agreeingClaim.notes,
                      },
                      {
                        onSuccess: () => {
                          setAgreeingClaim(null);
                        },
                      },
                    );
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs shadow-md transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span>✓</span>
                  <span>
                    {agreeingClaim.order.claim_status === 'issued'
                      ? `Согласовать и отправить ${Number(agreeingClaim.amount || 0).toLocaleString('ru-RU')} ₽ в Дебиторку`
                      : `Сохранить ${Number(agreeingClaim.amount || 0).toLocaleString('ru-RU')} ₽ в Дебиторке`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
