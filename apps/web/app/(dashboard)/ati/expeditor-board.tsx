'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ExpeditorOrder, ExpeditorDocument } from '@/app/api/ati-expeditor/route';
import { ExpeditorPrintDocs } from './expeditor-print-docs';

const EXPEDITOR_STAGES: Record<
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
    title: '1. Заявка клиента (Поиск)',
    shortTitle: '1. Заявка',
    colorDot: 'bg-slate-500',
    bgHeader: 'bg-slate-100',
    borderCol: 'border-slate-300',
    btnForward: 'Назначить перевозчика →',
    btnClass: 'bg-indigo-600 hover:bg-indigo-500 text-white',
  },
  2: {
    title: '2. Перевозчик найден (Оформление)',
    shortTitle: '2. Оформление',
    colorDot: 'bg-sky-500',
    bgHeader: 'bg-sky-50',
    borderCol: 'border-sky-200',
    btnForward: 'На погрузку →',
    btnClass: 'bg-sky-600 hover:bg-sky-500 text-white',
  },
  3: {
    title: '3. Погрузка & В пути',
    shortTitle: '3. В пути',
    colorDot: 'bg-amber-500',
    bgHeader: 'bg-amber-50',
    borderCol: 'border-amber-200',
    btnForward: 'На выгрузку →',
    btnClass: 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold',
  },
  4: {
    title: '4. Доставлено & Сдача',
    shortTitle: '4. Доставлено',
    colorDot: 'bg-indigo-600',
    bgHeader: 'bg-indigo-50',
    borderCol: 'border-indigo-200',
    btnForward: 'В расчеты →',
    btnClass: 'bg-indigo-600 hover:bg-indigo-500 text-white',
  },
  5: {
    title: '5. Взаиморасчёты (Оплата)',
    shortTitle: '5. Оплата',
    colorDot: 'bg-purple-600',
    bgHeader: 'bg-purple-50',
    borderCol: 'border-purple-200',
    btnForward: '✓ Закрыть рейс',
    btnClass: 'bg-emerald-600 hover:bg-emerald-500 text-white',
  },
  6: {
    title: '6. Полностью закрыто',
    shortTitle: '6. Закрыто',
    colorDot: 'bg-emerald-600',
    bgHeader: 'bg-emerald-50',
    borderCol: 'border-emerald-200',
    btnForward: '✓ Завершено',
    btnClass: 'bg-slate-300 text-slate-700',
  },
};

export const ExpeditorBoard: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<ExpeditorOrder | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [printDoc, setPrintDoc] = useState<{
    order: ExpeditorOrder;
    type: 'order' | 'offer';
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'individual' | 'legal'>('all');

  // Форма добавления новой заявки
  const [newClientType, setNewClientType] = useState<'individual' | 'legal'>('individual');
  const [newOrderNumber, setNewOrderNumber] = useState(
    `№ ${new Date().getDate()}.${new Date().getMonth() + 1} от ${new Date().toLocaleDateString('ru-RU')}`,
  );
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientPassport, setNewClientPassport] = useState('');
  const [newPassengerInCabin, setNewPassengerInCabin] = useState(true);

  const [newCarrierName, setNewCarrierName] = useState('');
  const [newCarrierInn, setNewCarrierInn] = useState('');
  const [newCarrierPhone, setNewCarrierPhone] = useState('');
  const [newCarrierVehicle, setNewCarrierVehicle] = useState('');
  const [newCarrierRegNumber, setNewCarrierRegNumber] = useState('');
  const [newCarrierDriverName, setNewCarrierDriverName] = useState('');

  const [newPickup, setNewPickup] = useState('');
  const [newDelivery, setNewDelivery] = useState('');
  const [newPickupDateTime, setNewPickupDateTime] = useState('');
  const [newCargo, setNewCargo] = useState('Личные (домашние) вещи, бытовой инвентарь');

  const [newTotalClientPrice, setNewTotalClientPrice] = useState('70000');
  const [newCarrierFreightPrice, setNewCarrierFreightPrice] = useState('70000');
  const [newStage1Amount, setNewStage1Amount] = useState('20000');
  const [newStage2Amount, setNewStage2Amount] = useState('50000');

  // Загрузка заявок
  const { data, isLoading } = useQuery<{
    success: boolean;
    orders: ExpeditorOrder[];
    storage_stats?: {
      total_orders: number;
      max_orders: number;
      purge_threshold: number;
      purge_batch: number;
      is_near_limit: boolean;
    };
  }>({
    queryKey: ['ati-expeditor-orders'],
    queryFn: async () => {
      const res = await fetch('/api/ati-expeditor');
      if (!res.ok) throw new Error('Ошибка загрузки экспедиторских заявок');
      return res.json();
    },
    staleTime: 15000,
  });

  // Мутация ручной очистки старых завершенных заявок
  const purgeOldOrdersMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ati-expeditor/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_size: 150 }),
      });
      if (!res.ok) throw new Error('Ошибка очистки архива');
      return res.json();
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries({ queryKey: ['ati-expeditor-orders'] });
      alert(resData.message || 'Очистка успешно выполнена');
    },
    onError: (err: Error) => {
      alert(err.message);
    },
  });

  // Мутация смены этапа
  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: number }) => {
      const res = await fetch(`/api/ati-expeditor/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error('Ошибка обновления этапа');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ati-expeditor-orders'] });
    },
  });

  // Мутация обновления статусов оплаты
  const updatePaymentStatusMutation = useMutation({
    mutationFn: async ({ id, fields }: { id: string; fields: Partial<ExpeditorOrder> }) => {
      const res = await fetch(`/api/ati-expeditor/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error('Ошибка обновления');
      return res.json();
    },
    onSuccess: (updatedData) => {
      queryClient.invalidateQueries({ queryKey: ['ati-expeditor-orders'] });
      if (selectedOrder && updatedData?.order) {
        setSelectedOrder(updatedData.order);
      }
    },
  });

  // Мутация добавления документа в папку
  const addDocumentMutation = useMutation({
    mutationFn: async ({
      id,
      category,
      name,
    }: {
      id: string;
      category: ExpeditorDocument['category'];
      name: string;
    }) => {
      const currentDocs = selectedOrder?.documents || [];
      const newDoc: ExpeditorDocument = {
        id: `doc-${Date.now()}`,
        category,
        name,
        created_at: new Date().toISOString(),
      };
      const res = await fetch(`/api/ati-expeditor/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents: [...currentDocs, newDoc] }),
      });
      if (!res.ok) throw new Error('Ошибка добавления документа');
      return res.json();
    },
    onSuccess: (updatedData) => {
      queryClient.invalidateQueries({ queryKey: ['ati-expeditor-orders'] });
      if (selectedOrder && updatedData?.order) {
        setSelectedOrder(updatedData.order);
      }
    },
  });

  // Создание заявки
  const createOrderMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/ati-expeditor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Ошибка создания');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ati-expeditor-orders'] });
      setIsNewModalOpen(false);
    },
  });

  const orders = data?.orders || [];
  const filteredOrders = orders.filter((o) => {
    if (activeTab === 'all') return true;
    return o.client_type === activeTab;
  });

  // Сводные финпоказатели
  const totalClientFreight = orders.reduce((sum, o) => sum + (o.total_client_price || 0), 0);
  const totalCarrierFreight = orders.reduce((sum, o) => sum + (o.carrier_freight_price || 0), 0);
  const totalMargin = totalClientFreight - totalCarrierFreight;

  const ordersByStage: Record<number, ExpeditorOrder[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
  };

  for (const ord of filteredOrders) {
    const st = ord.stage >= 1 && ord.stage <= 6 ? ord.stage : 1;
    ordersByStage[st]?.push(ord);
  }

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createOrderMutation.mutate({
      order_number: newOrderNumber,
      client_type: newClientType,
      client_name: newClientName || (newClientType === 'individual' ? 'Физлицо' : 'ООО Заказчик'),
      client_phone: newClientPhone,
      client_passport: newClientPassport,
      passenger_in_cabin: newPassengerInCabin,

      carrier_name: newCarrierName || 'ИП Перевозчик',
      carrier_inn: newCarrierInn,
      carrier_phone: newCarrierPhone,
      carrier_vehicle: newCarrierVehicle,
      carrier_reg_number: newCarrierRegNumber,
      carrier_driver_name: newCarrierDriverName,

      pickup_address: newPickup,
      delivery_address: newDelivery,
      pickup_date_time: newPickupDateTime,
      cargo_description: newCargo,

      total_client_price: Number(newTotalClientPrice) || 0,
      carrier_freight_price: Number(newCarrierFreightPrice) || 0,
      payment_scheme: 'two_stage',
      stage1_amount: Number(newStage1Amount) || 0,
      stage2_amount: Number(newStage2Amount) || 0,
    });
  };

  return (
    <div className="space-y-3">
      {/* ── ФИНАНСОВЫЙ ИНФО-БАННЕР ЭКСПЕДИТОРА ───────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 shadow-md border border-indigo-900/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-2xl shadow-inner">
            📦
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-tight text-white uppercase font-sans">
                ЭКСПЕДИТОРСКИЕ РЕЙСЫ
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                Сторонние перевозчики
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Организация перевозок: поиск грузов, привлечение перевозчиков, контроль документов и
              расчётов.
            </p>
          </div>
        </div>

        {/* Метрики маржинальности и индикатор лимита */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Индикатор лимита бесплатного тарифа (500 рейсов / авто-очистка при 450) */}
          <div className="bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-right">
            <div className="flex items-center gap-1.5 justify-end">
              <span
                className={`w-2 h-2 rounded-full ${orders.length >= 450 ? 'bg-rose-500 animate-pulse' : orders.length >= 400 ? 'bg-amber-400' : 'bg-emerald-400'}`}
              />
              <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
                Лимит: {orders.length} / 500
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium">
              {orders.length >= 450 ? (
                <span className="text-rose-300 font-bold">Авто-ротация активна</span>
              ) : (
                'Авто-очистка при 450'
              )}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs px-3 py-2 rounded-xl border border-white/10 text-right">
            <div className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
              Выручка от клиентов
            </div>
            <div className="text-sm font-black font-mono text-emerald-300">
              {totalClientFreight.toLocaleString('ru-RU')} ₽
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs px-3 py-2 rounded-xl border border-white/10 text-right">
            <div className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
              Ставка перевозчикам
            </div>
            <div className="text-sm font-black font-mono text-amber-300">
              {totalCarrierFreight.toLocaleString('ru-RU')} ₽
            </div>
          </div>

          <div className="bg-indigo-600/40 border border-indigo-400/40 px-3.5 py-2 rounded-xl text-right shadow-sm">
            <div className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider">
              Экспедиторская маржа
            </div>
            <div className="text-sm font-black font-mono text-white">
              +{totalMargin.toLocaleString('ru-RU')} ₽
            </div>
          </div>

          {/* Кнопка ручной очистки архива старых завершённых заявок */}
          {orders.some((o) => o.stage === 6 || o.is_cancelled) && (
            <button
              onClick={() => {
                if (
                  confirm(
                    'Очистить до 150 самых старых закрытых/отмененных заявок для освобождения памяти? Активные рейсы не затрагиваются.',
                  )
                ) {
                  purgeOldOrdersMutation.mutate();
                }
              }}
              disabled={purgeOldOrdersMutation.isPending}
              className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-slate-700 cursor-pointer transition flex items-center gap-1"
              title="Удалить закрытые рейсы для освобождения лимита"
            >
              <span>🧹</span>
              <span>Очистить архив</span>
            </button>
          )}

          <button
            onClick={() => setIsNewModalOpen(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow cursor-pointer transition active:scale-95 flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Новый рейс экспедитора</span>
          </button>
        </div>
      </div>

      {/* ── ФИЛЬТРЫ ПО ТИПУ КЛИЕНТА (ФИЗЛИЦО / ЮРЛИЦО) ──────────────────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center bg-slate-200/80 rounded-xl p-1 text-xs font-bold border border-slate-300/80">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1 rounded-lg transition-all ${
              activeTab === 'all'
                ? 'bg-white text-slate-900 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Все заказчики ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('individual')}
            className={`px-3 py-1 rounded-lg transition-all ${
              activeTab === 'individual'
                ? 'bg-white text-sky-800 shadow-xs font-black'
                : 'text-sky-700 hover:text-sky-900'
            }`}
          >
            👤 Физлица ({orders.filter((o) => o.client_type === 'individual').length})
          </button>
          <button
            onClick={() => setActiveTab('legal')}
            className={`px-3 py-1 rounded-lg transition-all ${
              activeTab === 'legal'
                ? 'bg-white text-indigo-800 shadow-xs font-black'
                : 'text-indigo-700 hover:text-indigo-900'
            }`}
          >
            🏢 Юрлица / B2B ({orders.filter((o) => o.client_type === 'legal').length})
          </button>
        </div>

        <div className="text-xs text-slate-500 italic">
          💡 Нажмите на карточку, чтобы открыть папку документов и распечатать Договор-Заявку /
          Оферту
        </div>
      </div>

      {/* ── КАНБАН-СЕТКА: 6 КОЛОНОК ──────────────────────────────────────── */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 font-bold bg-white rounded-2xl border-2 border-slate-200">
          Загрузка экспедиторских рейсов...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2 w-full items-start">
          {[1, 2, 3, 4, 5, 6].map((stageNum) => {
            const cfg = EXPEDITOR_STAGES[stageNum];
            if (!cfg) return null;
            const colOrders = ordersByStage[stageNum] || [];

            return (
              <div
                key={stageNum}
                className={`${cfg.bgHeader} rounded-xl border-2 ${cfg.borderCol} p-2 flex flex-col gap-2 min-w-0 shadow-2xs`}
              >
                {/* Заголовок колонки */}
                <div
                  className={`flex items-center justify-between pb-1.5 border-b ${cfg.borderCol}`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full ${cfg.colorDot} shrink-0`} />
                    <span
                      className="text-xs font-black uppercase text-slate-800 truncate"
                      title={cfg.title}
                    >
                      {cfg.shortTitle}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-black bg-white px-1.5 py-0.5 rounded border border-slate-300">
                    {colOrders.length}
                  </span>
                </div>

                {/* Список карточек */}
                <div className="flex flex-col gap-2 min-h-[140px]">
                  {colOrders.length === 0 ? (
                    <div className="h-20 border-2 border-dashed border-slate-300/60 rounded-xl flex items-center justify-center text-[10px] text-slate-400 font-bold">
                      Нет рейсов
                    </div>
                  ) : (
                    colOrders.map((order) => {
                      const margin =
                        (order.total_client_price || 0) - (order.carrier_freight_price || 0);

                      return (
                        <div
                          key={order.id}
                          onClick={() => setSelectedOrder(order)}
                          className="bg-white rounded-xl border-2 border-slate-300 hover:border-indigo-500 hover:shadow-md p-2.5 space-y-2 text-xs shadow-2xs transition cursor-pointer group select-none relative"
                        >
                          {/* Шапка: Номер, Бейдж физ/юрлица */}
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] border border-slate-200">
                              {order.order_number.split(' ')[0] || order.order_number}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                                order.client_type === 'individual'
                                  ? 'bg-sky-50 text-sky-800 border-sky-300'
                                  : 'bg-indigo-50 text-indigo-800 border-indigo-300'
                              }`}
                            >
                              {order.client_type === 'individual' ? '👤 Физлицо' : '🏢 B2B'}
                            </span>
                          </div>

                          {/* Заказчик */}
                          <div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase">
                              Заказчик:
                            </div>
                            <div className="font-black text-slate-900 text-[11px] truncate group-hover:text-indigo-600">
                              {order.client_name}
                            </div>
                            {order.passenger_in_cabin && (
                              <span className="inline-block mt-0.5 text-[9px] bg-amber-100 text-amber-900 border border-amber-300 px-1 rounded font-bold">
                                💺 Пассажир в кабине
                              </span>
                            )}
                          </div>

                          {/* Маршрут */}
                          <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200 space-y-0.5 text-[10px]">
                            <div className="truncate font-semibold text-slate-700">
                              🟢 {order.pickup_route_title || order.pickup_address}
                            </div>
                            <div className="truncate font-semibold text-slate-700">
                              🔴 {order.delivery_route_title || order.delivery_address}
                            </div>
                          </div>

                          {/* Перевозчик */}
                          <div className="border-t border-slate-100 pt-1">
                            <div className="text-[10px] text-slate-400 font-bold uppercase">
                              Перевозчик:
                            </div>
                            <div className="font-bold text-slate-800 text-[11px] truncate">
                              {order.carrier_name || 'Не назначен'}
                            </div>
                            {order.carrier_reg_number && (
                              <div className="text-[10px] font-mono text-slate-600 font-bold">
                                🚛 {order.carrier_reg_number} ({order.carrier_vehicle || 'Тент'})
                              </div>
                            )}
                          </div>

                          {/* Финансы и маржа */}
                          <div className="bg-indigo-50/60 p-1.5 rounded-lg border border-indigo-100 space-y-0.5 text-[10px]">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600">Клиент:</span>
                              <span className="font-mono font-bold text-slate-900">
                                {order.total_client_price.toLocaleString('ru-RU')} ₽
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600">Водитель:</span>
                              <span className="font-mono font-bold text-slate-900">
                                {order.carrier_freight_price.toLocaleString('ru-RU')} ₽
                              </span>
                            </div>
                            {margin > 0 && (
                              <div className="flex justify-between items-center pt-0.5 border-t border-indigo-200/60 font-black text-emerald-700">
                                <span>Маржа:</span>
                                <span className="font-mono">
                                  +{margin.toLocaleString('ru-RU')} ₽
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Документы */}
                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                            <span>📁 Документов: {order.documents?.length || 0}</span>
                            <span className="text-indigo-600 font-bold">Открыть ↗</span>
                          </div>

                          {/* Кнопка смены этапа */}
                          {stageNum < 6 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStageMutation.mutate({ id: order.id, stage: stageNum + 1 });
                              }}
                              className={`w-full py-1 rounded-lg text-[10px] font-bold cursor-pointer transition shadow-2xs ${cfg.btnClass}`}
                            >
                              {cfg.btnForward}
                            </button>
                          )}
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

      {/* ── ПОЛНОЭКРАННАЯ КАРТОЧКА РЕЙСА С ПАПКАМИ ДОКУМЕНТОВ ─────────────── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border-2 border-slate-300 flex flex-col max-h-[92vh] overflow-hidden">
            {/* Шапка модала */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📦</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black tracking-tight">
                      Рейс Экспедитора {selectedOrder.order_number}
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        selectedOrder.client_type === 'individual'
                          ? 'bg-sky-500/20 text-sky-200 border-sky-400/40'
                          : 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40'
                      }`}
                    >
                      {selectedOrder.client_type === 'individual'
                        ? '👤 Заказчик — Физлицо'
                        : '🏢 B2B Юрлицо'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Маршрут: {selectedOrder.pickup_route_title || selectedOrder.pickup_address} →{' '}
                    {selectedOrder.delivery_route_title || selectedOrder.delivery_address}
                  </p>
                </div>
              </div>

              {/* Быстрая печать */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPrintDoc({ order: selectedOrder, type: 'order' })}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow flex items-center gap-1 transition"
                  title="Открыть официальный бланк Договор-Заявки для печати"
                >
                  <span>📄 Договор-Заявка</span>
                </button>
                <button
                  onClick={() => setPrintDoc({ order: selectedOrder, type: 'offer' })}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl cursor-pointer border border-slate-700 flex items-center gap-1 transition"
                  title="Открыть официальную Договор-Оферту"
                >
                  <span>📜 Оферта</span>
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold cursor-pointer ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Тело модала с прокруткой */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-800">
              {/* Сетка основных реквизитов */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Блок Заказчика */}
                <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                    <span className="font-black text-slate-900 uppercase">
                      1. Заказчик перевозки
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">
                      {selectedOrder.client_type === 'individual'
                        ? 'Физическое лицо'
                        : 'Юридическое лицо'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div>
                      <strong>ФИО / Наименование:</strong> {selectedOrder.client_name}
                    </div>
                    <div>
                      <strong>Телефон:</strong> {selectedOrder.client_phone || 'Не указан'}
                    </div>
                    {selectedOrder.client_passport && (
                      <div>
                        <strong>Паспорт:</strong> {selectedOrder.client_passport}
                      </div>
                    )}
                    {selectedOrder.passenger_in_cabin && (
                      <div className="bg-amber-100 text-amber-900 border border-amber-300 p-2 rounded-xl font-bold mt-2">
                        💺 Пассажирское место в кабине закреплено за Заказчиком на всем маршруте
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Блок Перевозчика */}
                <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                    <span className="font-black text-slate-900 uppercase">
                      2. Привлечённый перевозчик
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                      Проверен
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div>
                      <strong>ИП / Организация:</strong> {selectedOrder.carrier_name}
                    </div>
                    <div>
                      <strong>ИНН:</strong> {selectedOrder.carrier_inn || '—'} |{' '}
                      <strong>ОГРНИП:</strong> {selectedOrder.carrier_ogrnip || '—'}
                    </div>
                    <div>
                      <strong>Водитель:</strong> {selectedOrder.carrier_driver_name} (
                      {selectedOrder.carrier_driver_phone})
                    </div>
                    <div>
                      <strong>Автомобиль:</strong> {selectedOrder.carrier_vehicle} —{' '}
                      <strong>{selectedOrder.carrier_reg_number}</strong>
                    </div>
                    <div>
                      <strong>Банк:</strong> {selectedOrder.carrier_bank} (Р/с{' '}
                      {selectedOrder.carrier_account})
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Финансовая схема и 2 этапа оплаты */}
              <div className="bg-gradient-to-r from-emerald-50 via-white to-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💰</span>
                    <span className="font-black text-emerald-950 uppercase">
                      Порядок расчётов и фиксация оплаты
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono font-black text-sm">
                    <span className="text-slate-600">Всего:</span>
                    <span className="text-emerald-900">
                      {selectedOrder.carrier_freight_price.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Этап 1 */}
                  <div
                    className={`p-3 rounded-xl border-2 transition ${selectedOrder.stage1_paid ? 'bg-emerald-100/50 border-emerald-400' : 'bg-white border-amber-300'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">1 этап: Аванс на погрузке</span>
                      <span className="font-mono font-black text-emerald-900">
                        {selectedOrder.stage1_amount?.toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      {selectedOrder.stage1_terms ||
                        'Выплачивается Экспедитором наличными на погрузке перед отправлением.'}
                    </p>
                    <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500">
                        {selectedOrder.stage1_paid
                          ? '✓ Выплачено на погрузке'
                          : '⏳ Ожидает выплаты'}
                      </span>
                      <button
                        onClick={() =>
                          updatePaymentStatusMutation.mutate({
                            id: selectedOrder.id,
                            fields: { stage1_paid: !selectedOrder.stage1_paid },
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer transition ${
                          selectedOrder.stage1_paid
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                        }`}
                      >
                        {selectedOrder.stage1_paid ? '✓ Оплачено' : 'Отметить выплату'}
                      </button>
                    </div>
                  </div>

                  {/* Этап 2 */}
                  <div
                    className={`p-3 rounded-xl border-2 transition ${selectedOrder.stage2_paid ? 'bg-emerald-100/50 border-emerald-400' : 'bg-white border-slate-300'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">2 этап: Расчет на выгрузке</span>
                      <span className="font-mono font-black text-slate-900">
                        {selectedOrder.stage2_amount?.toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      {selectedOrder.stage2_terms ||
                        'Оплачивается Заказчиком водителю на конечной выгрузке.'}
                    </p>
                    <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500">
                        {selectedOrder.stage2_paid
                          ? '✓ Водитель получил остаток'
                          : '⏳ Оплата при сдаче'}
                      </span>
                      <button
                        onClick={() =>
                          updatePaymentStatusMutation.mutate({
                            id: selectedOrder.id,
                            fields: { stage2_paid: !selectedOrder.stage2_paid },
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer transition ${
                          selectedOrder.stage2_paid
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-white hover:bg-slate-700'
                        }`}
                      >
                        {selectedOrder.stage2_paid ? '✓ Оплачено' : 'Подтвердить получение'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. СИСТЕМА ПАПОК ДОКУМЕНТОВ РЕЙСА (ZERO STORAGE / ЛАЙФХАКИ ХРАНЕНИЯ) */}
              <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📁</span>
                    <div>
                      <h4 className="font-black text-slate-900 uppercase">
                        Папки документов рейса (Zero-Storage архитектура)
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        PDF формируются на лету (0 байт в базе). Фото и файлы хранятся в
                        MAX/Telegram/E-mail и на диске.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full font-bold">
                    ✓ Не расходует лимит Supabase
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {/* Папка 1: С Заказчиком */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between font-bold text-slate-900 border-b pb-1">
                      <span>📂 1. С Заказчиком</span>
                      <span className="text-[9px] text-indigo-700 bg-indigo-50 px-1 rounded">
                        PDF live
                      </span>
                    </div>
                    <div className="space-y-1">
                      <button
                        onClick={() => setPrintDoc({ order: selectedOrder, type: 'order' })}
                        className="w-full text-left p-1.5 rounded bg-white hover:bg-indigo-50 border border-slate-200 text-[10.5px] font-medium text-slate-800 flex items-center justify-between"
                      >
                        <span className="flex items-center gap-1 truncate">
                          <span>📄</span> <span>Договор-Заявка</span>
                        </span>
                        <span className="text-[9px] font-bold text-indigo-600">Печать/PDF ↗</span>
                      </button>
                      <button
                        onClick={() => setPrintDoc({ order: selectedOrder, type: 'offer' })}
                        className="w-full text-left p-1.5 rounded bg-white hover:bg-indigo-50 border border-slate-200 text-[10.5px] font-medium text-slate-800 flex items-center justify-between"
                      >
                        <span className="flex items-center gap-1 truncate">
                          <span>📜</span> <span>Договор-Оферта</span>
                        </span>
                        <span className="text-[9px] font-bold text-indigo-600">Печать/PDF ↗</span>
                      </button>
                      {selectedOrder.documents
                        ?.filter((d) => d.category === 'client')
                        .map((d) => (
                          <div
                            key={d.id}
                            className="p-1 rounded bg-sky-50 text-[10px] text-sky-900 truncate"
                          >
                            📎 {d.name}
                          </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-1 pt-1">
                      <button
                        onClick={() => {
                          const note = prompt(
                            'Отметка о сообщении в мессенджере MAX / Telegram (напр: Согласовано в MAX от 22.10):',
                          );
                          if (note)
                            addDocumentMutation.mutate({
                              id: selectedOrder.id,
                              category: 'client',
                              name: `💬 MAX/TG: ${note}`,
                            });
                        }}
                        className="py-1 bg-slate-200 hover:bg-slate-300 rounded text-[9.5px] font-bold text-slate-700 cursor-pointer"
                        title="Добавить ссылку или заметку о согласовании в MAX/TG"
                      >
                        💬 MAX/TG
                      </button>
                      <button
                        onClick={() => {
                          const emailNote = prompt(
                            'Отметка о письме (напр: Скан на e-mail от 22.10):',
                          );
                          if (emailNote)
                            addDocumentMutation.mutate({
                              id: selectedOrder.id,
                              category: 'client',
                              name: `📧 E-mail: ${emailNote}`,
                            });
                        }}
                        className="py-1 bg-slate-200 hover:bg-slate-300 rounded text-[9.5px] font-bold text-slate-700 cursor-pointer"
                        title="Добавить отметку о письме"
                      >
                        📧 E-mail
                      </button>
                    </div>
                  </div>

                  {/* Папка 2: С Перевозчиком */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between font-bold text-slate-900 border-b pb-1">
                      <span>📂 2. С Перевозчиком</span>
                      <span className="text-[9px] text-indigo-700 bg-indigo-50 px-1 rounded">
                        Штамп
                      </span>
                    </div>
                    <div className="space-y-1">
                      <button
                        onClick={() => setPrintDoc({ order: selectedOrder, type: 'order' })}
                        className="w-full text-left p-1.5 rounded bg-white hover:bg-indigo-50 border border-slate-200 text-[10.5px] font-medium text-slate-800 flex items-center justify-between"
                      >
                        <span className="flex items-center gap-1 truncate">
                          <span>📑</span>{' '}
                          <span>
                            Заявка ИП {selectedOrder.carrier_name.split(' ')[1] || 'Перевозчик'}
                          </span>
                        </span>
                        <span className="text-[9px] font-bold text-indigo-600">Печать ↗</span>
                      </button>
                      {selectedOrder.documents
                        ?.filter((d) => d.category === 'carrier')
                        .map((d) => (
                          <div
                            key={d.id}
                            className="p-1 rounded bg-indigo-50 text-[10px] text-indigo-900 truncate"
                          >
                            📎 {d.name}
                          </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-1 pt-1">
                      <button
                        onClick={() => {
                          const note = prompt('Отметка о согласовании с перевозчиком в MAX/TG:');
                          if (note)
                            addDocumentMutation.mutate({
                              id: selectedOrder.id,
                              category: 'carrier',
                              name: `💬 MAX/TG: ${note}`,
                            });
                        }}
                        className="py-1 bg-slate-200 hover:bg-slate-300 rounded text-[9.5px] font-bold text-slate-700 cursor-pointer"
                      >
                        💬 MAX/TG
                      </button>
                      <button
                        onClick={() => {
                          const note = prompt('Отметка о проверке АТИ / договоре на E-mail:');
                          if (note)
                            addDocumentMutation.mutate({
                              id: selectedOrder.id,
                              category: 'carrier',
                              name: `📧 E-mail: ${note}`,
                            });
                        }}
                        className="py-1 bg-slate-200 hover:bg-slate-300 rounded text-[9.5px] font-bold text-slate-700 cursor-pointer"
                      >
                        📧 E-mail
                      </button>
                    </div>
                  </div>

                  {/* Папка 3: Транспорт и водитель */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between font-bold text-slate-900 border-b pb-1">
                      <span>📂 3. Транспорт и ТС</span>
                      <span className="text-[9px] text-amber-800 bg-amber-100 px-1 rounded">
                        Фото кузова
                      </span>
                    </div>
                    <div className="space-y-1">
                      {selectedOrder.documents
                        ?.filter((d) => d.category === 'vehicle')
                        .map((d) => (
                          <div
                            key={d.id}
                            className="p-1 rounded bg-amber-50 text-[10px] text-amber-900 truncate"
                          >
                            📷 {d.name}
                          </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-1 pt-1">
                      <button
                        onClick={() => {
                          const note = prompt(
                            'Фото кузова / ТС в мессенджере (напр: Фото чистого кузова получено в MAX в 07:50):',
                          );
                          if (note)
                            addDocumentMutation.mutate({
                              id: selectedOrder.id,
                              category: 'vehicle',
                              name: `📷 Фото в MAX: ${note}`,
                            });
                        }}
                        className="py-1 bg-slate-200 hover:bg-slate-300 rounded text-[9.5px] font-bold text-slate-700 cursor-pointer"
                      >
                        📷 Фото MAX
                      </button>
                      <button
                        onClick={() => {
                          const note = prompt('Данные ВУ / СТС / Локальный диск:');
                          if (note)
                            addDocumentMutation.mutate({
                              id: selectedOrder.id,
                              category: 'vehicle',
                              name: `💾 Диск: ${note}`,
                            });
                        }}
                        className="py-1 bg-slate-200 hover:bg-slate-300 rounded text-[9.5px] font-bold text-slate-700 cursor-pointer"
                      >
                        💾 Локально
                      </button>
                    </div>
                  </div>

                  {/* Папка 4: Финансы и чеки */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between font-bold text-slate-900 border-b pb-1">
                      <span>📂 4. Чеки и расписки</span>
                      <span className="text-[9px] text-emerald-800 bg-emerald-100 px-1 rounded">
                        Оплата
                      </span>
                    </div>
                    <div className="space-y-1">
                      {selectedOrder.documents
                        ?.filter((d) => d.category === 'finance')
                        .map((d) => (
                          <div
                            key={d.id}
                            className="p-1 rounded bg-emerald-50 text-[10px] text-emerald-900 truncate"
                          >
                            💵 {d.name}
                          </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-1 pt-1">
                      <button
                        onClick={() => {
                          const note = prompt('Отметка о расписке/чеке в MAX/TG:');
                          if (note)
                            addDocumentMutation.mutate({
                              id: selectedOrder.id,
                              category: 'finance',
                              name: `💵 Чек/Расписка: ${note}`,
                            });
                        }}
                        className="py-1 bg-slate-200 hover:bg-slate-300 rounded text-[9.5px] font-bold text-slate-700 cursor-pointer"
                      >
                        💵 Чек MAX
                      </button>
                      <button
                        onClick={() => {
                          const note = prompt('Чек из банка / E-mail:');
                          if (note)
                            addDocumentMutation.mutate({
                              id: selectedOrder.id,
                              category: 'finance',
                              name: `📧 Банк: ${note}`,
                            });
                        }}
                        className="py-1 bg-slate-200 hover:bg-slate-300 rounded text-[9.5px] font-bold text-slate-700 cursor-pointer"
                      >
                        📧 E-mail чек
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Подвал модала */}
            <div className="bg-slate-100 p-4 border-t border-slate-300 flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-500">
                Защита интересов: штраф за прямой контакт перевозчика с клиентом —{' '}
                <strong>200 000 ₽</strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── МОДАЛ СОЗДАНИЯ НОВОЙ ЗАЯВКИ ЭКСПЕДИТОРА ──────────────────────── */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border-2 border-slate-300 overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-black text-sm uppercase">Новый рейс Экспедитора</h3>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 text-xs">
              {/* Номер и тип клиента */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Номер заявки:</label>
                  <input
                    type="text"
                    value={newOrderNumber}
                    onChange={(e) => setNewOrderNumber(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 mt-1 font-mono font-bold"
                    required
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="font-bold text-slate-700">Тип Заказчика перевозки:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewClientType('individual')}
                      className={`p-2 rounded-xl border-2 font-bold cursor-pointer transition flex items-center justify-center gap-1.5 ${
                        newClientType === 'individual'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <span>👤</span> <span>Физлицо (Переезд)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewClientType('legal')}
                      className={`p-2 rounded-xl border-2 font-bold cursor-pointer transition flex items-center justify-center gap-1.5 ${
                        newClientType === 'legal'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <span>🏢</span> <span>Юрлицо (B2B)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Данные клиента */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="font-bold text-slate-700">ФИО / Наименование заказчика:</label>
                  <input
                    type="text"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder={
                      newClientType === 'individual' ? 'Иванов Иван Иванович' : 'ООО Заказчик'
                    }
                    className="w-full p-2 rounded-lg border border-slate-300 mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Телефон заказчика:</label>
                  <input
                    type="text"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    placeholder="+7 (922) 000-00-00"
                    className="w-full p-2 rounded-lg border border-slate-300 mt-1"
                  />
                </div>
                {newClientType === 'individual' && (
                  <div className="md:col-span-2 space-y-2">
                    <div>
                      <label className="font-bold text-slate-700">
                        Паспортные данные заказчика (для договора/расписки):
                      </label>
                      <input
                        type="text"
                        value={newClientPassport}
                        onChange={(e) => setNewClientPassport(e.target.value)}
                        placeholder="Серия, номер, кем и когда выдан, адрес регистрации"
                        className="w-full p-2 rounded-lg border border-slate-300 mt-1"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="passInCabin"
                        checked={newPassengerInCabin}
                        onChange={(e) => setNewPassengerInCabin(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600"
                      />
                      <label htmlFor="passInCabin" className="font-bold text-slate-800">
                        Пассажир в кабине (Заказчик следует совместно с водителем в рейсе)
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Перевозчик */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="md:col-span-2">
                  <label className="font-bold text-slate-700">Перевозчик (ИП / Организация):</label>
                  <input
                    type="text"
                    value={newCarrierName}
                    onChange={(e) => setNewCarrierName(e.target.value)}
                    placeholder="ИП Салихов Руслан Маснавиевич"
                    className="w-full p-2 rounded-lg border border-slate-300 mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">ИНН Перевозчика:</label>
                  <input
                    type="text"
                    value={newCarrierInn}
                    onChange={(e) => setNewCarrierInn(e.target.value)}
                    placeholder="741701150716"
                    className="w-full p-2 rounded-lg border border-slate-300 mt-1"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Водитель (ФИО):</label>
                  <input
                    type="text"
                    value={newCarrierDriverName}
                    onChange={(e) => setNewCarrierDriverName(e.target.value)}
                    placeholder="Салихов Руслан Маснавиевич"
                    className="w-full p-2 rounded-lg border border-slate-300 mt-1"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Автомобиль и кузов:</label>
                  <input
                    type="text"
                    value={newCarrierVehicle}
                    onChange={(e) => setNewCarrierVehicle(e.target.value)}
                    placeholder="ГАЗ 2824DH (тент)"
                    className="w-full p-2 rounded-lg border border-slate-300 mt-1"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Госномер ТС:</label>
                  <input
                    type="text"
                    value={newCarrierRegNumber}
                    onChange={(e) => setNewCarrierRegNumber(e.target.value)}
                    placeholder="В 003 ХС 174"
                    className="w-full p-2 rounded-lg border border-slate-300 mt-1"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="font-bold text-slate-700">
                    Телефон перевозчика / водителя:
                  </label>
                  <input
                    type="text"
                    value={newCarrierPhone}
                    onChange={(e) => setNewCarrierPhone(e.target.value)}
                    placeholder="+7 (982) 360-02-56"
                    className="w-full p-2 rounded-lg border border-slate-300 mt-1"
                  />
                </div>
              </div>

              {/* Маршрут и груз */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Адрес погрузки:</label>
                  <input
                    type="text"
                    value={newPickup}
                    onChange={(e) => setNewPickup(e.target.value)}
                    placeholder="г. Верхняя Салда (2 адреса)"
                    className="w-full p-2 rounded-lg border border-slate-300 mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Адрес выгрузки:</label>
                  <input
                    type="text"
                    value={newDelivery}
                    onChange={(e) => setNewDelivery(e.target.value)}
                    placeholder="Новосибирская обл., р.п. Кольцово"
                    className="w-full p-2 rounded-lg border border-slate-300 mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Дата и время подачи:</label>
                  <input
                    type="text"
                    value={newPickupDateTime}
                    onChange={(e) => setNewPickupDateTime(e.target.value)}
                    placeholder="30.10.2026 г. ровно к 08:00"
                    className="w-full p-2 rounded-lg border border-slate-300 mt-1"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Характер груза:</label>
                  <input
                    type="text"
                    value={newCargo}
                    onChange={(e) => setNewCargo(e.target.value)}
                    placeholder="Личные (домашние) вещи, бытовой инвентарь"
                    className="w-full p-2 rounded-lg border border-slate-300 mt-1"
                  />
                </div>
              </div>

              {/* Финансы: клиент, водитель и этапы */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-emerald-50/70 p-3 rounded-xl border border-emerald-300">
                <div>
                  <label className="font-bold text-slate-700">Ставка заказчика:</label>
                  <input
                    type="number"
                    value={newTotalClientPrice}
                    onChange={(e) => setNewTotalClientPrice(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 mt-1 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Ставка перевозчика:</label>
                  <input
                    type="number"
                    value={newCarrierFreightPrice}
                    onChange={(e) => setNewCarrierFreightPrice(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 mt-1 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">1 этап (на погрузке):</label>
                  <input
                    type="number"
                    value={newStage1Amount}
                    onChange={(e) => setNewStage1Amount(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">2 этап (на выгрузке):</label>
                  <input
                    type="number"
                    value={newStage2Amount}
                    onChange={(e) => setNewStage2Amount(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 mt-1 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={createOrderMutation.isPending}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black cursor-pointer shadow"
                >
                  {createOrderMutation.isPending ? 'Создание...' : 'Создать рейс экспедитора'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ОКНО ПЕЧАТИ ДОКУМЕНТОВ ───────────────────────────────────────── */}
      {printDoc && (
        <ExpeditorPrintDocs
          order={printDoc.order}
          docType={printDoc.type}
          onClose={() => setPrintDoc(null)}
        />
      )}
    </div>
  );
};
