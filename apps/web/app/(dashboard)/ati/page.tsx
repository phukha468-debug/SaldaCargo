'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

export type AtiOrder = {
  id: string;
  order_number: string;
  order_date: string;
  stage: number; // 1..8
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

// Конфигурация 8 этапов
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
    btnForward: 'В путь →',
    btnClass: 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black',
  },
  4: {
    title: '4. В пути на выгрузку',
    shortTitle: '4. В пути',
    colorDot: 'bg-blue-600',
    bgHeader: 'bg-blue-50/80',
    borderCol: 'border-blue-200',
    btnForward: 'На выгрузку →',
    btnClass: 'bg-blue-600 hover:bg-blue-500 text-white',
  },
  5: {
    title: '5. Выгрузка & Сдача рейса',
    shortTitle: '5. Выгрузка',
    colorDot: 'bg-indigo-600',
    bgHeader: 'bg-indigo-50/80',
    borderCol: 'border-indigo-200',
    btnForward: 'В документы →',
    btnClass: 'bg-indigo-600 hover:bg-indigo-500 text-white',
  },
  6: {
    title: '6. Документооборот (ЭДО / Почта)',
    shortTitle: '6. Документы',
    colorDot: 'bg-purple-600',
    bgHeader: 'bg-purple-50/80',
    borderCol: 'border-purple-200',
    btnForward: 'В Дебиторку →',
    btnClass: 'bg-purple-600 hover:bg-purple-500 text-white',
  },
  7: {
    title: '7. Дебиторка (Ожидание оплаты)',
    shortTitle: '7. Дебиторка',
    colorDot: 'bg-rose-600',
    bgHeader: 'bg-rose-50/80',
    borderCol: 'border-rose-200',
    btnForward: '✓ Оплачено на Р/С',
    btnClass: 'bg-emerald-600 hover:bg-emerald-500 text-white',
  },
  8: {
    title: '8. Оплачено и закрыто',
    shortTitle: '8. Оплачено',
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

  // Запрос данных
  const { data, isLoading } = useQuery<ApiResponse>({
    queryKey: ['ati-orders'],
    queryFn: async () => {
      const res = await fetch('/api/ati');
      if (!res.ok) throw new Error('Ошибка загрузки заявок АТИ');
      return res.json();
    },
    refetchInterval: 15000,
  });

  // Мутация смены этапа
  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: number }) => {
      const res = await fetch(`/api/ati/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error('Ошибка обновления этапа');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ati-orders'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
    },
  });

  // Мутация сохранения трек-номера Почты РФ
  const updateTrackingMutation = useMutation({
    mutationFn: async ({
      id,
      postal_tracking_number,
    }: {
      id: string;
      postal_tracking_number: string;
    }) => {
      const res = await fetch(`/api/ati/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postal_tracking_number }),
      });
      if (!res.ok) throw new Error('Ошибка сохранения трек-номера');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ati-orders'] });
    },
  });

  // Состояния для отмены / срыва / претензии
  const [cancellingOrder, setCancellingOrder] = useState<AtiOrder | null>(null);
  const [cancelMode, setCancelMode] = useState<'claim' | 'simple'>('claim');
  const [cancelReason, setCancelReason] = useState<string>('Отказ заказчика по обоюдному согласию');
  const [showCancelledList, setShowCancelledList] = useState(false);
  const [cancelledListTab, setCancelledListTab] = useState<'claims' | 'simple'>('claims');
  const [viewingClaimOrder, setViewingClaimOrder] = useState<AtiOrder | null>(null);

  // Параметры претензии
  const [claimNumber, setClaimNumber] = useState<string>('01-ПР');
  const [claimDate, setClaimDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [claimPenaltyAmount, setClaimPenaltyAmount] = useState<string>('6000');
  const [claimEmptyRunAmount, setClaimEmptyRunAmount] = useState<string>('0');
  const [claimIdleAmount, setClaimIdleAmount] = useState<string>('0');
  const [claimDueDays, setClaimDueDays] = useState<string>('5');
  const [showDetailedClaim, setShowDetailedClaim] = useState<boolean>(false);

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

  // Мутация обновления статуса претензии (Согласовано -> Ждем оплаты -> Оплачено)
  const updateClaimStatusMutation = useMutation({
    mutationFn: async ({
      id,
      claim_status,
      claim_agreed_at,
    }: {
      id: string;
      claim_status: 'issued' | 'agreed' | 'waiting_payment' | 'paid' | 'rejected';
      claim_agreed_at?: string;
    }) => {
      const res = await fetch(`/api/ati/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim_status,
          claim_agreed_at:
            claim_agreed_at || (claim_status === 'agreed' ? new Date().toISOString() : undefined),
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

  // Разделение на активные, претензии и простые срывы
  const cancelledOrders = orders.filter((o) => o.is_cancelled || o.stage === 0);
  const claimOrders = cancelledOrders.filter((o) => o.has_claim);
  const simpleCancelledOrders = cancelledOrders.filter((o) => !o.has_claim);
  const activeOrders = orders.filter((o) => !o.is_cancelled && o.stage > 0);

  const activeClaimsCount = claimOrders.filter((o) => o.claim_status !== 'paid').length;
  const activeClaimsSum = claimOrders
    .filter((o) => o.claim_status !== 'paid')
    .reduce((sum, o) => sum + (Number(o.claim_amount) || 0), 0);

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
    8: [],
  };

  for (const ord of filteredOrders) {
    const st = ord.stage >= 1 && ord.stage <= 8 ? ord.stage : 1;
    ordersByStage[st].push(ord);
  }

  // Общая сумма активных
  const totalFreight = activeOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
  const inReceivables = activeOrders
    .filter((o) => o.stage === 7)
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

          {/* Кнопка претензий */}
          {claimOrders.length > 0 && (
            <button
              onClick={() => {
                setCancelledListTab('claims');
                setShowCancelledList(true);
              }}
              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
              title="Претензии к заказчикам за срыв погрузки"
            >
              <span>⚖️ Претензии:</span>
              <span className="font-black bg-amber-200 text-amber-950 px-1.5 py-0.2 rounded-full font-mono text-[11px]">
                {claimOrders.length}
              </span>
              {activeClaimsSum > 0 && (
                <span className="text-[10px] font-mono font-black text-amber-800">
                  ({activeClaimsSum.toLocaleString('ru-RU')} ₽)
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
           БАННЕР АКТИВНОЙ ПРЕТЕНЗИОННОЙ РАБОТЫ (ЕСЛИ ЕСТЬ ПРЕТЕНЗИИ)
           ══════════════════════════════════════════════════════════════════════ */}
      {claimOrders.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 via-white to-amber-50/50 border-2 border-amber-300 rounded-2xl p-3 shadow-2xs space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚖️</span>
              <span className="text-xs font-black uppercase text-amber-950 tracking-wide">
                Претензионная работа по срывам (
                {activeClaimsCount > 0 ? `${activeClaimsCount} в работе` : `${claimOrders.length}`})
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                ст. 35 УАТ РФ · Штраф 20%
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-600 font-medium">Сумма требований:</span>
              <span className="font-mono font-black text-amber-950 text-sm">
                {(activeClaimsSum > 0
                  ? activeClaimsSum
                  : claimOrders.reduce((sum, o) => sum + (Number(o.claim_amount) || 0), 0)
                ).toLocaleString('ru-RU')}{' '}
                ₽
              </span>
            </div>
          </div>

          {/* Список претензий в работе */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {claimOrders.map((ord) => {
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
                      <div className="font-mono font-black text-amber-950 text-xs">
                        {Number(ord.claim_amount || 6000).toLocaleString('ru-RU')} ₽
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
                        disabled={updateClaimStatusMutation.isPending}
                        onClick={() =>
                          updateClaimStatusMutation.mutate({
                            id: ord.id,
                            claim_status: 'agreed',
                          })
                        }
                        className="flex-1 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black cursor-pointer transition text-center shadow-2xs"
                        title="Заказчик согласовал срыв -> отправить в Дебиторку"
                      >
                        ✓ Согласовано → В Дебиторку
                      </button>
                    )}

                    {(status === 'agreed' || status === 'waiting_payment') && (
                      <div className="flex-1 flex items-center gap-1">
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
        <div className="grid grid-cols-8 gap-1.5 w-full items-start">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((stageNum) => {
            const cfg = STAGE_CONFIG[stageNum];
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
                    colOrders.map((order) => (
                      <div
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className="bg-white rounded-xl border-2 border-slate-300 hover:border-indigo-400 hover:shadow-card p-2 space-y-1.5 text-xs shadow-2xs cursor-pointer transition relative"
                      >
                        {/* Верх карточки: номер + бейдж ЭТрН/Почта */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono font-black text-slate-900 text-[11px] truncate">
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

                        {/* Контрагент */}
                        <div className="bg-slate-50 rounded p-1 border border-slate-200">
                          <div
                            className="font-bold text-slate-900 truncate text-[11px]"
                            title={order.counterparty_name}
                          >
                            {order.counterparty_name}
                          </div>
                          <div className="text-[9px] text-emerald-700 font-semibold flex items-center gap-0.5">
                            <span>✓</span> <span>Контрагент в базе</span>
                          </div>
                        </div>

                        {/* Маршрут */}
                        <div>
                          <div className="text-[11px] font-bold text-slate-800 truncate">
                            {order.pickup_address
                              ? order.pickup_address.split(',')[1] ||
                                order.pickup_address.split(',')[0]
                              : 'Погрузка'}
                            {' ➔ '}
                            {order.delivery_address
                              ? order.delivery_address.split(',')[1] ||
                                order.delivery_address.split(',')[0]
                              : 'Выгрузка'}
                          </div>
                          <div className="text-[9px] text-slate-500 truncate">
                            {order.asset_name || 'Авто'}
                          </div>
                        </div>

                        {/* Сумма */}
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-500">Фрахт:</span>
                          <span className="font-mono font-black text-slate-900">
                            {Number(order.price || 0).toLocaleString('ru-RU')} ₽
                          </span>
                        </div>

                        {/* На этапе 6 (Документы) — ввод трек-номера для Почты РФ */}
                        {stageNum === 6 && order.doc_type === 'paper' && (
                          <div
                            className="space-y-0.5 pt-1 border-t border-purple-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="text-[9px] font-bold text-slate-500 block">
                              Трек Почты РФ:
                            </span>
                            <input
                              type="text"
                              defaultValue={order.postal_tracking_number || ''}
                              onBlur={(e) =>
                                updateTrackingMutation.mutate({
                                  id: order.id,
                                  postal_tracking_number: e.target.value.trim(),
                                })
                              }
                              placeholder="620000..."
                              className="w-full px-1.5 py-0.5 border border-purple-300 rounded text-[10px] font-mono font-bold bg-purple-50/40"
                            />
                          </div>
                        )}

                        {/* На этапе 7 (Дебиторка) — бейдж связки с дебиторкой */}
                        {stageNum === 7 && (
                          <div className="bg-rose-50 rounded p-1 border border-rose-200 text-[9px] space-y-0.5">
                            <div className="text-rose-700 font-bold flex justify-between">
                              <span>В Дебиторке:</span>
                              <span className="font-mono font-black">
                                {Number(order.price || 0).toLocaleString('ru-RU')} ₽
                              </span>
                            </div>
                            <Link
                              href="/receivables"
                              onClick={(e) => e.stopPropagation()}
                              className="text-rose-700 hover:underline font-bold block"
                            >
                              Открыть в Дебиторке ↗
                            </Link>
                          </div>
                        )}

                        {/* Кнопки управления: Вперед и Назад ↶ */}
                        <div
                          className="pt-1 border-t border-slate-100 flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Кнопка срыва / отмены с Канбана (доступна на этапах 1..6) */}
                          {stageNum <= 6 && (
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
                                setClaimDate(new Date().toISOString().split('T')[0]);
                                setClaimDueDays('5');
                              }}
                              title="Срыв договора-заявки / Претензия / Снять с доски"
                              className="px-1.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded font-black text-[10px] border border-rose-200 cursor-pointer active:scale-95 transition"
                            >
                              ✕
                            </button>
                          )}

                          {/* Кнопка возврата ↶ (доступна со 2 этапа) */}
                          {stageNum > 1 && (
                            <button
                              onClick={() =>
                                updateStageMutation.mutate({
                                  id: order.id,
                                  stage: stageNum - 1,
                                })
                              }
                              title="Вернуть на предыдущий этап"
                              className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-black text-[10px] border border-slate-300 cursor-pointer active:scale-95 transition"
                            >
                              ↶
                            </button>
                          )}

                          {/* Кнопка шага вперед */}
                          {stageNum < 8 ? (
                            <button
                              onClick={() =>
                                updateStageMutation.mutate({
                                  id: order.id,
                                  stage: stageNum + 1,
                                })
                              }
                              className={`flex-1 py-1 ${cfg.btnClass} rounded font-black text-[10px] cursor-pointer active:scale-95 transition text-center`}
                            >
                              {cfg.btnForward}
                            </button>
                          ) : (
                            <div className="flex-1 text-center py-1 bg-emerald-100 text-emerald-900 rounded font-black text-[10px]">
                              ✓ Закрыто
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           МОДАЛЬНОЕ ОКНО ДЕТАЛЕЙ ДОГОВОР-ЗАЯВКИ
           (Полный образец по предоставленному документу № 001)
           ══════════════════════════════════════════════════════════════════════ */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            {/* Шапка модалки */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black font-display tracking-tight">
                      Договор-Заявка {selectedOrder.order_number}
                    </h2>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        selectedOrder.doc_type === 'etrn'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400'
                          : 'bg-amber-500/20 text-amber-300 border-amber-400'
                      }`}
                    >
                      {selectedOrder.doc_type === 'etrn' ? '⚡ ЭТрН' : '📮 Почта РФ'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Междугородняя перевозка груза автотранспортом
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Тело модалки */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
              {/* Текущий этап и Дебиторка */}
              <div className="bg-slate-50 rounded-2xl border-2 border-slate-200 p-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    Текущий этап заявки
                  </span>
                  <span className="text-xs font-black text-indigo-700">
                    {STAGE_CONFIG[selectedOrder.stage]?.title}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">Связка с Дебиторкой:</span>
                  <span
                    className={`px-2 py-0.5 rounded font-bold border ${
                      selectedOrder.stage >= 7
                        ? 'bg-rose-50 text-rose-800 border-rose-300'
                        : 'bg-amber-50 text-amber-800 border-amber-300'
                    }`}
                  >
                    {selectedOrder.stage >= 8
                      ? 'Оплачено и закрыто'
                      : selectedOrder.stage === 7
                        ? 'В реестре дебиторки'
                        : 'Будет привязана после сдачи рейса'}
                  </span>
                </div>
              </div>

              {/* Стороны договора */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Заказчик */}
                <div className="bg-indigo-50/40 rounded-2xl border border-indigo-200 p-3 space-y-1.5">
                  <div className="text-[11px] font-black uppercase text-indigo-950 flex items-center justify-between">
                    <span>🏢 1. ЗАКАЗЧИК</span>
                    <span className="text-[10px] font-mono text-indigo-700">
                      {selectedOrder.ati_code || 'АТИ'}
                    </span>
                  </div>
                  <div className="font-bold text-slate-900 text-sm">
                    {selectedOrder.counterparty_name}
                  </div>
                  {selectedOrder.counterparty_inn && (
                    <div className="text-slate-600">
                      ИНН:{' '}
                      <span className="font-mono font-bold">{selectedOrder.counterparty_inn}</span>
                    </div>
                  )}
                  {selectedOrder.counterparty_contact && (
                    <div className="text-slate-600">
                      Контакт: <strong>{selectedOrder.counterparty_contact}</strong>
                    </div>
                  )}
                  {selectedOrder.counterparty_phone && (
                    <div className="text-slate-600">
                      Тел: <strong>{selectedOrder.counterparty_phone}</strong>
                    </div>
                  )}
                  {selectedOrder.counterparty_email && (
                    <div className="text-slate-600">
                      Email:{' '}
                      <span className="text-indigo-600">{selectedOrder.counterparty_email}</span>
                    </div>
                  )}
                  <div className="pt-1 text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                    <span>✓</span> <span>Контрагент сохранён в единой базе</span>
                  </div>
                </div>

                {/* Перевозчик */}
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3 space-y-1.5">
                  <div className="text-[11px] font-black uppercase text-slate-800 flex items-center justify-between">
                    <span>🚚 ПЕРЕВОЗЧИК</span>
                    <span className="text-[10px] font-mono text-slate-500">ИП</span>
                  </div>
                  <div className="font-bold text-slate-900 text-sm">
                    {selectedOrder.carrier_name}
                  </div>
                  <div className="text-slate-600">
                    ИНН: <span className="font-mono font-bold">{selectedOrder.carrier_inn}</span>
                  </div>
                  <div className="text-slate-600">
                    Контакт: <strong>{selectedOrder.carrier_contact}</strong>
                  </div>
                  <div className="text-slate-600">
                    Р/С:{' '}
                    <span className="font-mono font-semibold">{selectedOrder.carrier_account}</span>
                  </div>
                  <div className="text-slate-600">
                    Банк: <strong>{selectedOrder.carrier_bank}</strong> (БИК{' '}
                    {selectedOrder.carrier_bik})
                  </div>
                </div>
              </div>

              {/* Транспорт и водитель */}
              <div className="bg-amber-50/40 rounded-2xl border border-amber-200 p-3 space-y-2">
                <div className="text-[11px] font-black uppercase text-amber-950 flex items-center justify-between">
                  <span>🚛 2.7. СВЕДЕНИЯ ОБ АВТОТРАНСПОРТЕ И ВОДИТЕЛЕ</span>
                  <span className="text-[10px] font-bold text-amber-800">
                    {selectedOrder.asset_name}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Автомобиль:</span>
                    <span className="font-bold text-slate-900 text-xs">
                      {selectedOrder.asset_name} ({selectedOrder.asset_reg_number})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Водитель:</span>
                    <span className="font-bold text-slate-900 text-xs">
                      {selectedOrder.driver_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Телефон водителя:</span>
                    <span className="font-bold font-mono text-slate-900">
                      {selectedOrder.driver_phone}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Документы водителя:</span>
                    <span className="font-mono text-slate-700 text-[11px]">
                      {selectedOrder.driver_passport || 'Паспорт указан'} •{' '}
                      {selectedOrder.driver_license || 'ВУ указано'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Погрузка и Разгрузка */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 2.3 Погрузка */}
                <div className="bg-emerald-50/40 rounded-2xl border border-emerald-200 p-3 space-y-1.5">
                  <div className="text-[11px] font-black uppercase text-emerald-950 flex items-center justify-between">
                    <span>📦 2.3. ПОГРУЗКА</span>
                    <span className="font-mono text-emerald-800 font-bold">
                      {selectedOrder.pickup_date_time || 'По графику'}
                    </span>
                  </div>
                  {selectedOrder.shipper_name && (
                    <div>
                      <span className="text-slate-500 block text-[10px]">Грузоотправитель:</span>
                      <span className="font-bold text-slate-900">{selectedOrder.shipper_name}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500 block text-[10px]">Адрес погрузки:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedOrder.pickup_address || 'Не указан'}
                    </span>
                  </div>
                  {selectedOrder.pickup_contact && (
                    <div>
                      <span className="text-slate-500 block text-[10px]">Контакты склада:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {selectedOrder.pickup_contact}
                      </span>
                    </div>
                  )}
                  {selectedOrder.cargo_description && (
                    <div className="text-[10px] text-slate-700 bg-white p-1 rounded border border-emerald-100 mt-1">
                      Груз: <strong>{selectedOrder.cargo_description}</strong>
                    </div>
                  )}
                </div>

                {/* 2.4 Разгрузка */}
                <div className="bg-blue-50/40 rounded-2xl border border-blue-200 p-3 space-y-1.5">
                  <div className="text-[11px] font-black uppercase text-blue-950 flex items-center justify-between">
                    <span>🏁 2.4. РАЗГРУЗКА</span>
                    <span className="font-mono text-blue-800 font-bold">
                      {selectedOrder.delivery_date || 'По графику'}
                    </span>
                  </div>
                  {selectedOrder.consignee_name && (
                    <div>
                      <span className="text-slate-500 block text-[10px]">Грузополучатель:</span>
                      <span className="font-bold text-slate-900">
                        {selectedOrder.consignee_name}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500 block text-[10px]">Адрес разгрузки:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedOrder.delivery_address || 'Не указан'}
                    </span>
                  </div>
                  {selectedOrder.delivery_contact && (
                    <div>
                      <span className="text-slate-500 block text-[10px]">Контакты приёмки:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {selectedOrder.delivery_contact}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 2.5 Финансы и оплата */}
              <div className="bg-white rounded-2xl border-2 border-slate-200 p-3 space-y-2">
                <div className="text-[11px] font-black uppercase text-slate-900 flex items-center justify-between">
                  <span>💰 2.5. СТОИМОСТЬ И ПОРЯДОК ОПЛАТЫ</span>
                  <span className="text-sm font-mono font-black text-emerald-600">
                    {Number(selectedOrder.price || 0).toLocaleString('ru-RU')} ₽ без НДС
                  </span>
                </div>
                <div className="text-xs text-slate-700">
                  <strong>Форма и срок:</strong> {selectedOrder.payment_terms}
                </div>
                {selectedOrder.postal_address && (
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-[11px] space-y-1">
                    <div className="font-bold text-slate-800">
                      Почтовый адрес для оригиналов документов:
                    </div>
                    <div className="text-slate-600">{selectedOrder.postal_address}</div>
                  </div>
                )}
                {selectedOrder.postal_tracking_number && (
                  <div className="p-2 bg-purple-50 rounded-xl border border-purple-200 text-[11px] flex items-center justify-between">
                    <span className="font-bold text-purple-900">Трек-номер Почты РФ:</span>
                    <span className="font-mono font-black text-purple-950">
                      {selectedOrder.postal_tracking_number}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Подвал модалки */}
            <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500">
                Создана: {new Date(selectedOrder.created_at).toLocaleDateString('ru-RU')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Закрыть
                </button>
                <Link
                  href="/receivables"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black shadow-xs flex items-center gap-1"
                >
                  <span>В Дебиторку</span>
                  <span>↗</span>
                </Link>
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

            {/* Вкладки: Претензии vs Простые срывы */}
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
                <span>⚖️ Претензии к заказчикам</span>
                <span className="bg-amber-100 text-amber-900 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
                  {claimOrders.length}
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

                  {claimOrders.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 font-bold">
                      Нет активных претензий к заказчикам.
                    </div>
                  ) : (
                    claimOrders.map((ord) => {
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
                              <span className="font-mono font-black text-amber-950 text-base">
                                {Number(ord.claim_amount || 6000).toLocaleString('ru-RU')} ₽
                              </span>
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
                                  disabled={updateClaimStatusMutation.isPending}
                                  onClick={() =>
                                    updateClaimStatusMutation.mutate({
                                      id: ord.id,
                                      claim_status: 'agreed',
                                    })
                                  }
                                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs cursor-pointer shadow-xs transition"
                                >
                                  ✓ Заказчик согласовал → Передать в Дебиторку
                                </button>
                              )}

                              {(status === 'agreed' || status === 'waiting_payment') && (
                                <div className="flex items-center gap-2">
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
                              setClaimDate(new Date().toISOString().split('T')[0]);
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
                        20% от {Number(viewingClaimOrder.price || 30000).toLocaleString('ru-RU')}{' '}
                        руб.
                      </td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono font-bold">
                        {Number(
                          viewingClaimOrder.claim_penalty_amount ||
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
                  {Number(viewingClaimOrder.claim_amount || 6000).toLocaleString('ru-RU')} (шесть
                  тысяч) рублей 00 копеек.
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
    </div>
  );
}
