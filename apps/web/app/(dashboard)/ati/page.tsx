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

  // Фильтрация
  const filteredOrders = orders.filter((o) => {
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
  const totalFreight = orders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
  const inReceivables = orders
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
              Все ({orders.length})
            </button>
            <button
              onClick={() => setFilterDoc('etrn')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterDoc === 'etrn'
                  ? 'bg-white text-emerald-800 shadow-2xs font-black'
                  : 'text-emerald-700 hover:bg-white/50'
              }`}
            >
              ⚡ ЭТрН ({orders.filter((o) => o.doc_type === 'etrn').length})
            </button>
            <button
              onClick={() => setFilterDoc('paper')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterDoc === 'paper'
                  ? 'bg-white text-amber-900 shadow-2xs font-black'
                  : 'text-amber-800 hover:bg-white/50'
              }`}
            >
              📮 Почта РФ ({orders.filter((o) => o.doc_type === 'paper').length})
            </button>
          </div>

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
           ИНФО-БЛОК СВЯЗКИ С ДЕБИТОРКОЙ
           ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border-2 border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-[11px] text-slate-600">
          <span className="text-base">💡</span>
          <span>
            Кликните на карточку для просмотра полного договора. Кнопка <strong>↶</strong> отменяет
            ошибочный шаг. Заявки на 7 этапе автоматически связаны с разделом{' '}
            <strong>Дебиторка</strong>.
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
    </div>
  );
}
