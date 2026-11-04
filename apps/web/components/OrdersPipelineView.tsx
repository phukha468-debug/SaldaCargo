/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface OrderItem {
  id: string;
  order_number: number;
  source_type: string;
  status: 'draft' | 'waiting_vehicle' | 'assigned' | 'in_progress' | 'pending_review' | 'completed';
  base_doc_name: string;
  base_doc_number: string | null;
  base_doc_date: string | null;
  internal_order_number: string | null;

  client?: {
    id: string;
    name: string;
    inn: string;
    phone?: string;
    legal_address?: string;
    default_contract_number?: string;
  };
  forwarder?: { id: string; name: string; inn: string };
  shipper?: { id: string; name: string; inn: string };
  consignee?: { id: string; name: string; inn: string };
  vehicle?: { id: string; reg_number: string; brand_name: string; short_name: string };
  driver?: { id: string; name: string; phone: string };
  loading_point?: { id: string; name: string; structured_address: any };
  trip?: {
    id: string;
    trip_number: number;
    odometer_start: number;
    odometer_end: number;
    admin_note?: string;
  };

  cargo_name: string;
  weight_gross_kg: number;
  places_count: number;
  price_without_vat: number;
  vat_rate: string;
  payment_terms: string;
  waybill_number: string | null;

  assigned_vehicle_id?: string | null;
  assigned_driver_id?: string | null;

  loading_address_json: any;
  unloading_address_json: any;
  planned_loading_at: string | null;
  planned_delivery_at: string | null;
}

export function OrdersPipelineView() {
  const queryClient = useQueryClient();
  const [activeStatusTab, setActiveStatusTab] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [assignModalOrder, setAssignModalOrder] = useState<OrderItem | null>(null);

  // 1. Загрузка заявок
  const { data: orders = [], isLoading } = useQuery<OrderItem[]>({
    queryKey: ['orders-pipeline', activeStatusTab],
    queryFn: async () => {
      const url =
        activeStatusTab === 'all' ? '/api/orders' : `/api/orders?status=${activeStatusTab}`;
      const res = await fetch(url);
      const json = await res.json();
      return json.orders || [];
    },
    refetchInterval: 10000,
  });

  // 2. Справочники ТС и водителей
  const { data: vehicles = [] } = useQuery<any[]>({
    queryKey: ['vehicles-list'],
    queryFn: async () => {
      const res = await fetch('/api/fleet');
      const json = await res.json();
      return json.vehicles || json.assets || [];
    },
  });

  const { data: drivers = [] } = useQuery<any[]>({
    queryKey: ['drivers-list'],
    queryFn: async () => {
      const res = await fetch('/api/users');
      const json = await res.json();
      return (json.users || []).filter((u: any) => u.roles?.includes('driver'));
    },
  });

  // 3. Справочник контрагентов
  const { data: counterparties = [] } = useQuery<any[]>({
    queryKey: ['counterparties-all'],
    queryFn: async () => {
      const res = await fetch('/api/counterparties');
      const json = await res.json();
      return json.counterparties || [];
    },
  });

  // 4. Справочник пресетов постоянных клиентов
  const { data: presets = [] } = useQuery<any[]>({
    queryKey: ['order-presets'],
    queryFn: async () => {
      const res = await fetch('/api/order-presets');
      const json = await res.json();
      return json.presets || [];
    },
  });

  // 5. Справочник точек погрузки
  const { data: loadingPoints = [] } = useQuery<any[]>({
    queryKey: ['loading-points'],
    queryFn: async () => {
      const res = await fetch('/api/loading-points');
      const json = await res.json();
      return json.loading_points || [];
    },
  });

  // Мутация Wialon (выезд / приезд)
  const autoProgressMutation = useMutation({
    mutationFn: async ({ orderId, action }: { orderId: string; action: 'depart' | 'arrive' }) => {
      const res = await fetch(`/api/orders/${orderId}/auto-progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка смены статуса');
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.status === 'pending_review') {
        alert(
          `🏁 Wialon зафиксировал возврат в Верхнюю Салду!\nПробег: ${data.distanceKm} км (${data.kmPay} ₽) + Суточные: ${data.daysCount} дн (${data.perDiemPay} ₽) = Итого ЗП водителя: ${data.totalDriverPay} ₽.\nСформирована дебиторская задолженность, рейс отправлен на ревью.`,
        );
      } else if (data.status === 'in_progress') {
        alert(
          `🚀 Wialon зафиксировал выезд за радиус Верхней Салды!\nСтатус: В ПУТИ, создан связанный рейс trips, одометр выезда зафиксирован.`,
        );
      }
      queryClient.invalidateQueries({ queryKey: ['orders-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['ati-orders'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
    },
    onError: (err: any) => {
      alert(`Ошибка Wialon: ${err.message}`);
    },
  });

  // Мутация назначения ТС
  const assignMutation = useMutation({
    mutationFn: async ({
      orderId,
      vehicleId,
      driverId,
    }: {
      orderId: string;
      vehicleId: string;
      driverId: string;
    }) => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigned_vehicle_id: vehicleId,
          assigned_driver_id: driverId,
          status: 'assigned',
        }),
      });
      if (!res.ok) throw new Error('Не удалось назначить ТС');
      return res.json();
    },
    onSuccess: () => {
      setAssignModalOrder(null);
      queryClient.invalidateQueries({ queryKey: ['orders-pipeline'] });
    },
  });

  const filteredOrders = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.base_doc_number?.toLowerCase().includes(q) ||
      o.client?.name?.toLowerCase().includes(q) ||
      o.cargo_name?.toLowerCase().includes(q) ||
      o.vehicle?.reg_number?.toLowerCase().includes(q) ||
      o.driver?.name?.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status: OrderItem['status']) => {
    switch (status) {
      case 'waiting_vehicle':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300">
            ⏳ Ждет авто
          </span>
        );
      case 'assigned':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-300">
            📋 Назначен
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-100 text-purple-800 border border-purple-300 animate-pulse">
            🚛 В пути
          </span>
        );
      case 'pending_review':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-orange-100 text-orange-800 border border-orange-300">
            🔍 На ревью
          </span>
        );
      case 'completed':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
            ✅ Завершен
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-800">
            Черновик
          </span>
        );
    }
  };

  return (
    <div className="space-y-3 font-sans">
      {/* Верхняя строка управления фильтрами и действиями */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-bold">
          <button
            onClick={() => setActiveStatusTab('all')}
            className={`px-2.5 py-1 rounded-md transition ${activeStatusTab === 'all' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Все ({orders.length})
          </button>
          <button
            onClick={() => setActiveStatusTab('waiting_vehicle')}
            className={`px-2.5 py-1 rounded-md transition ${activeStatusTab === 'waiting_vehicle' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            ⏳ Лист ожидания ({orders.filter((o) => o.status === 'waiting_vehicle').length})
          </button>
          <button
            onClick={() => setActiveStatusTab('assigned')}
            className={`px-2.5 py-1 rounded-md transition ${activeStatusTab === 'assigned' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            📋 Назначены ({orders.filter((o) => o.status === 'assigned').length})
          </button>
          <button
            onClick={() => setActiveStatusTab('in_progress')}
            className={`px-2.5 py-1 rounded-md transition ${activeStatusTab === 'in_progress' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            🚛 В пути ({orders.filter((o) => o.status === 'in_progress').length})
          </button>
          <button
            onClick={() => setActiveStatusTab('pending_review')}
            className={`px-2.5 py-1 rounded-md transition ${activeStatusTab === 'pending_review' ? 'bg-white text-orange-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            🔍 На ревью ({orders.filter((o) => o.status === 'pending_review').length})
          </button>
        </div>

        {/* Поиск и создание */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Поиск по номеру, клиенту, грузу..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 w-56"
          />
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition active:scale-95"
          >
            <span>+ Создать заявку</span>
          </button>
        </div>
      </div>

      {/* DENSE 1-LINE СПИСОК ЗАЯВОК (СТРОГО 1 СТРОКА НА ЗАЯВКУ) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-500">Загрузка конвейера заявок...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Заявок в этой категории нет. Нажмите <b>«+ Создать заявку»</b>, выберите постоянного
            клиента или загрузите PDF Поручения экспедитору.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 text-[11px] whitespace-nowrap">
            {filteredOrders.map((order) => {
              const routeText = `${order.loading_address_json?.city || 'Заречный'} → ${order.unloading_address_json?.city || 'В.Салда'}`;
              const cargoText = `${order.cargo_name || 'Груз'}, ${order.weight_gross_kg || 0} кг`;
              const isAssigned = Boolean(order.assigned_vehicle_id && order.assigned_driver_id);
              const isCash = order.payment_terms?.includes('Наличные');

              return (
                <div
                  key={order.id}
                  className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-50/80 transition"
                >
                  {/* Статус и номер */}
                  <div className="flex items-center gap-2 min-w-[210px] shrink-0">
                    {getStatusBadge(order.status)}
                    <span className="font-bold text-slate-900 truncate">
                      № {order.base_doc_number || order.order_number}
                    </span>
                    {order.cargo_name?.includes('⚠️') && (
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white animate-pulse shadow-xs shrink-0"
                        title="Автомашина выехала без заявки! Необходимо заполнить все данные"
                      >
                        ⚠️ БЕЗ ЗАЯВКИ
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">
                      (
                      {order.base_doc_date
                        ? order.base_doc_date.slice(5)
                        : order.planned_loading_at?.slice(5, 10) || '—'}
                      )
                    </span>
                  </div>

                  {/* Клиент и экспедитор */}
                  <div className="flex items-center gap-1.5 min-w-[200px] max-w-[230px] truncate text-slate-700 shrink-0">
                    <span className="font-semibold text-slate-900 truncate">
                      {order.client?.name?.replace(/ПАО|ООО|«|»/g, '').trim() || 'ВСМПО'}
                    </span>
                    {order.forwarder && (
                      <>
                        <span className="text-slate-400">/</span>
                        <span className="text-slate-500 truncate">
                          {order.forwarder?.name?.split(' ')[1] || 'Парфенов'}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Маршрут */}
                  <div className="min-w-[140px] max-w-[170px] truncate font-medium text-slate-800 shrink-0">
                    📍 {routeText}
                  </div>

                  {/* Груз */}
                  <div className="min-w-[160px] max-w-[210px] truncate text-slate-600 shrink-0">
                    📦 {cargoText}
                  </div>

                  {/* Ставка и тип оплаты (Дебиторка / Касса) */}
                  <div className="min-w-[120px] text-right shrink-0">
                    <div className="font-black text-slate-900">
                      {order.price_without_vat
                        ? `${Number(order.price_without_vat).toLocaleString('ru-RU')} ₽`
                        : '—'}
                    </div>
                    <div className="text-[9.5px] font-bold text-slate-500">
                      {isCash ? '💵 В кассу' : '🏦 В дебиторку'}
                    </div>
                  </div>

                  {/* Авто и Водитель */}
                  <div className="min-w-[180px] max-w-[220px] truncate text-slate-700 shrink-0">
                    {isAssigned ? (
                      <span className="flex items-center gap-1 font-medium">
                        <span className="px-1.5 py-0.2 bg-slate-200 text-slate-800 rounded font-mono text-[10px] font-bold">
                          {order.vehicle?.reg_number || 'О188ТА196'}
                        </span>
                        <span className="truncate">{order.driver?.name || 'Никифоров'}</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => setAssignModalOrder(order)}
                        className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded font-bold text-[10px] cursor-pointer shadow-2xs"
                      >
                        + Назначить ТС
                      </button>
                    )}
                  </div>

                  {/* Кнопки Wialon и документов */}
                  <div className="flex items-center gap-1.5 shrink-0 justify-end">
                    {order.status === 'assigned' && (
                      <button
                        onClick={() =>
                          autoProgressMutation.mutate({ orderId: order.id, action: 'depart' })
                        }
                        title="Эмуляция Wialon: грузовик покинул геозону Верхней Салды -> старт рейса"
                        className="px-2 py-0.8 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded cursor-pointer transition active:scale-95 text-[10px]"
                      >
                        🚀 Выезд (Wialon)
                      </button>
                    )}
                    {order.status === 'in_progress' && (
                      <button
                        onClick={() =>
                          autoProgressMutation.mutate({ orderId: order.id, action: 'arrive' })
                        }
                        title="Эмуляция Wialon: возврат в геозону Верхней Салды -> расчет ЗП и закрытие в дебиторку"
                        className="px-2 py-0.8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded cursor-pointer transition active:scale-95 text-[10px]"
                      >
                        🏁 Возврат (Ревью)
                      </button>
                    )}

                    <a
                      href={`/api/orders/${order.id}/docs/etrn-xml`}
                      download
                      title="Скачать XML ЭТрН (ФНС КНД 1110339, windows-1251)"
                      className="px-2 py-0.8 bg-slate-800 hover:bg-slate-900 text-white rounded font-bold flex items-center gap-1 transition"
                    >
                      <span>📥 XML</span>
                    </a>

                    <div className="inline-flex items-center rounded overflow-hidden shadow-xs">
                      <a
                        href={`/api/orders/${order.id}/docs/tn-pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Печать Транспортной накладной (с данными заявки, доступно редактирование)"
                        className="px-2 py-0.8 bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1 transition"
                      >
                        <span>📄 ТН</span>
                      </a>
                      <a
                        href={`/api/orders/${order.id}/docs/tn-pdf?empty=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Распечатать чистый пустой бланк ТН (ПП РФ № 2116)"
                        className="px-1.5 py-0.8 bg-blue-800 hover:bg-blue-900 text-blue-200 hover:text-white font-bold text-[10px] transition border-l border-blue-500/40"
                      >
                        ⬜
                      </a>
                    </div>

                    <a
                      href={`/api/orders/${order.id}/docs/waybill-4c`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Печать Путевого листа № 4-С (ОКУД 0345004)"
                      className="px-2 py-0.8 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-bold flex items-center gap-1 transition"
                    >
                      <span>📋 ПЛ</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* МОДАЛЬНОЕ ОКНО СОЗДАНИЯ ЗАЯВКИ С АВТОЗАПОЛНЕНИЕМ ПОСТОЯННЫХ КЛИЕНТОВ */}
      {isCreateModalOpen && (
        <CreateSmartOrderModal
          presets={presets}
          loadingPoints={loadingPoints}
          counterparties={counterparties}
          vehicles={vehicles}
          drivers={drivers}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['orders-pipeline'] });
          }}
        />
      )}

      {/* МОДАЛЬНОЕ ОКНО НАЗНАЧЕНИЯ ТС */}
      {assignModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-bold text-sm text-slate-900">
                Назначить машину на заявку №{' '}
                {assignModalOrder.base_doc_number || assignModalOrder.order_number}
              </h3>
              <button
                onClick={() => setAssignModalOrder(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const vehicleId = formData.get('vehicle_id') as string;
                const driverId = formData.get('driver_id') as string;
                if (!vehicleId || !driverId) {
                  alert('Выберите машину и водителя');
                  return;
                }
                assignMutation.mutate({ orderId: assignModalOrder.id, vehicleId, driverId });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-bold text-slate-700 block mb-1">Грузовой автомобиль</label>
                <select
                  name="vehicle_id"
                  required
                  className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50"
                >
                  <option value="">-- Выберите автомобиль --</option>
                  {vehicles.map((v: any) => (
                    <option key={v.id} value={v.id}>
                      {v.brand_name || v.short_name || 'Авто'} ({v.reg_number})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Водитель</label>
                <select
                  name="driver_id"
                  required
                  className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50"
                >
                  <option value="">-- Выберите водителя --</option>
                  {drivers.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.phone ? `(${d.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOrder(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={assignMutation.isPending}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs"
                >
                  {assignMutation.isPending ? 'Назначение...' : 'Назначить и выписать ПЛ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Умная форма создания заявки:
 * - Автозаполнение ВСМПО-АВИСМА (Экспедитор Парфенов, перевозчик ИП Нигамедьянов)
 * - Автозаполнение ООО "Геостройиндустрия" (прямой заказчик, перевозчик мы)
 * - Ручной ввод нового клиента с возможностью сохранения в справочник
 * - Выбор финала: Дебиторская задолженность (безнал) или Наличные (касса)
 */
function CreateSmartOrderModal({
  presets,
  counterparties,
  vehicles,
  drivers,
  onClose,
  onSuccess,
}: {
  presets: any[];
  loadingPoints?: any[];
  counterparties: any[];
  vehicles: any[];
  drivers: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedClientType, setSelectedClientType] = useState<'vsmpo' | 'geostroy' | 'manual'>(
    'vsmpo',
  );
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Сохранить нового клиента в справочник
  const [saveToDirectory, setSaveToDirectory] = useState<boolean>(true);

  // Форма заявки
  const [form, setForm] = useState<any>({
    base_doc_number: '752/2026-1',
    base_doc_date: new Date().toISOString().slice(0, 10),
    client_id: '',
    client_name: 'ПАО «Корпорация ВСМПО-АВИСМА»',
    client_inn: '6607000556',
    forwarder_id: '',
    forwarder_name: 'ИП Парфенов Андрей Виталиевич',
    preset_id: '',
    loading_point_id: '',

    loading_address: '624250, Свердловская область, г. Заречный, ул. Промзона БЗСК, д 2',
    loading_city: 'Заречный',
    loading_org_name: 'ООО "Континенталь"',
    loading_org_inn: '6609002301',
    loading_contact_fio: 'Гончарова Марина Владимировна',

    unloading_address:
      '624760, Свердловская область, г. Верхняя Салда, ул. Парковая, д 1, склад 0802',
    unloading_city: 'Верхняя Салда',

    cargo_name: 'Пруток 20мм, труба нерж.сталь',
    weight_gross_kg: 110,
    places_count: 1,
    packaging_type: 'палетты',
    price_without_vat: 15000,

    // Финансовая ветка: Дебиторка vs Касса
    payment_method: 'bank_invoice', // 'bank_invoice' (дебиторка) | 'cash' (касса)
    payment_terms: 'Безналичный расчет (Дебиторская задолженность, отсрочка 15 дней)',

    planned_loading_at: new Date().toISOString().slice(0, 10) + 'T08:00',
    planned_delivery_at: new Date().toISOString().slice(0, 10) + 'T18:00',

    assigned_vehicle_id: vehicles[0]?.id || '',
    assigned_driver_id: drivers[0]?.id || '',
  });

  // Быстрое переключение между постоянными клиентами
  const selectClientPreset = (type: 'vsmpo' | 'geostroy' | 'manual') => {
    setSelectedClientType(type);
    if (type === 'vsmpo') {
      const vsmpoPreset = presets.find((p: any) => p.title?.includes('ВСМПО')) || presets[0];
      setForm((prev: any) => ({
        ...prev,
        preset_id: vsmpoPreset?.id || '',
        client_id: vsmpoPreset?.client_counterparty_id || '',
        client_name: 'ПАО «Корпорация ВСМПО-АВИСМА»',
        client_inn: '6607000556',
        forwarder_id: vsmpoPreset?.forwarder_counterparty_id || '',
        forwarder_name: 'ИП Парфенов Андрей Виталиевич',
        loading_point_id: vsmpoPreset?.default_loading_point_id || '',
        loading_org_name: 'ООО "Континенталь"',
        loading_org_inn: '6609002301',
        loading_address: '624250, Свердловская область, г. Заречный, ул. Промзона БЗСК, д 2',
        loading_city: 'Заречный',
        unloading_address:
          '624760, Свердловская область, г. Верхняя Салда, ул. Парковая, д 1, склад 0802',
        unloading_city: 'Верхняя Салда',
        cargo_name: 'Пруток 20мм, труба нерж.сталь',
        weight_gross_kg: 110,
        price_without_vat: 15000,
        payment_method: 'bank_invoice',
        payment_terms: 'Безналичный расчет (Дебиторская задолженность, отсрочка 15 дней)',
      }));
      setStatusMessage(
        '⭐ Предзаполнена схема ВСМПО-АВИСМА через экспедитора ИП Парфенов А.В. (Перевозчик: ИП Нигамедьянов, Дебиторка)',
      );
    } else if (type === 'geostroy') {
      const geoPreset = presets.find((p: any) => p.title?.includes('Геострой')) || presets[1];
      const geoCp = counterparties.find((c: any) => c.name?.includes('Геострой'));
      setForm((prev: any) => ({
        ...prev,
        preset_id: geoPreset?.id || '',
        client_id: geoCp?.id || geoPreset?.client_counterparty_id || '',
        client_name: 'ООО "Геостройиндустрия"',
        client_inn: '6623101234',
        forwarder_id: '',
        forwarder_name: '— (Прямой заказчик)',
        loading_org_name: 'ООО "Геостройиндустрия" (ЛОП)',
        loading_org_inn: '6623101234',
        loading_address: '624760, Свердловская область, г. Верхняя Салда, ул. Ленина, д 10',
        loading_city: 'Верхняя Салда',
        unloading_address: '624930, Свердловская область, г. Карпинск, промплощадка',
        unloading_city: 'Карпинск',
        cargo_name: 'Оборудование, металлоконструкции',
        weight_gross_kg: 2800,
        price_without_vat: 25000,
        payment_method: 'bank_invoice',
        payment_terms: 'Безналичный расчет (Дебиторская задолженность, договор ГСИ-2026/01)',
      }));
      setStatusMessage(
        '⭐ Предзаполнена схема ООО "Геостройиндустрия": прямой заказчик, они же ЛОП на погрузке. (Перевозчик: ИП Нигамедьянов)',
      );
    } else {
      // Ручной ввод
      setForm((prev: any) => ({
        ...prev,
        preset_id: '',
        client_id: '',
        client_name: '',
        client_inn: '',
        forwarder_id: '',
        forwarder_name: '— (Прямой заказчик)',
        loading_org_name: '',
        loading_org_inn: '',
        loading_address: '',
        loading_city: '',
        unloading_address: '',
        unloading_city: '',
        cargo_name: '',
        weight_gross_kg: 1000,
        price_without_vat: 20000,
        payment_method: 'bank_invoice',
        payment_terms: 'Безналичный расчет (Дебиторская задолженность)',
      }));
      setStatusMessage(
        '📝 Ручной ввод по карточке предприятия. Данные будут автоматически сохранены в справочник!',
      );
    }
  };

  useEffect(() => {
    selectClientPreset('vsmpo');
  }, []);

  // Парсинг PDF
  const handlePdfUpload = async (file: File) => {
    setIsParsing(true);
    setStatusMessage(null);
    try {
      const data = new FormData();
      data.append('file', file);
      const res = await fetch('/api/orders/parse-doc', { method: 'POST', body: data });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Ошибка разбора');

      const p = json.parsed;
      setForm((prev: any) => ({
        ...prev,
        base_doc_number: p.order_number || prev.base_doc_number,
        base_doc_date: p.order_date || prev.base_doc_date,
        cargo_name: p.cargo_name || prev.cargo_name,
        weight_gross_kg: p.weight_gross_kg || prev.weight_gross_kg,
        places_count: p.places_count || prev.places_count,
        price_without_vat: p.price_without_vat || prev.price_without_vat,
        loading_city: p.loading_address?.city || prev.loading_city,
        loading_address: p.loading_address?.raw || prev.loading_address,
        unloading_city: p.unloading_address?.city || prev.unloading_city,
        unloading_address: p.unloading_address?.raw || prev.unloading_address,
        client_id: p.matched_client_id || prev.client_id,
        forwarder_id: p.matched_forwarder_id || prev.forwarder_id,
        loading_point_id: p.matched_loading_point_id || prev.loading_point_id,
        preset_id: p.matched_preset_id || prev.preset_id,
        loading_org_name: p.loading_org_name || prev.loading_org_name,
        loading_org_inn: p.loading_org_inn || prev.loading_org_inn,
        loading_contact_fio: p.loading_contact_fio || prev.loading_contact_fio,
      }));
      setStatusMessage(
        `✨ PDF успешно распознан! Поручение № ${p.order_number || ''}. Все реквизиты сопоставлены.`,
      );
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let finalClientId = form.client_id;

      // Если новый клиент и включена галочка сохранения в справочник
      if (!finalClientId && form.client_name && saveToDirectory) {
        const createCpRes = await fetch('/api/counterparties', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.client_name,
            inn: form.client_inn || null,
            legal_address: form.loading_address || null,
            phone: form.loading_contact_phone || null,
            type: 'client',
            is_regular: true,
          }),
        });
        const createdCpJson = await createCpRes.json();
        if (createdCpJson?.counterparty?.id) {
          finalClientId = createdCpJson.counterparty.id;
        }
      }

      const payload = {
        base_doc_number: form.base_doc_number,
        base_doc_date: form.base_doc_date,
        client_id: finalClientId || null,
        forwarder_id: form.forwarder_id || null,
        preset_id: form.preset_id || null,
        loading_point_id: form.loading_point_id || null,

        cargo_name: form.cargo_name,
        weight_gross_kg: Number(form.weight_gross_kg),
        weight_net_kg: Number(form.weight_gross_kg),
        places_count: Number(form.places_count),
        packaging_type: form.packaging_type,
        price_without_vat: Number(form.price_without_vat),
        payment_terms:
          form.payment_method === 'cash'
            ? 'Оплата наличными водителю (В кассу)'
            : 'Безналичный расчет (Дебиторская задолженность)',

        loading_address_json: { city: form.loading_city, raw: form.loading_address },
        unloading_address_json: { city: form.unloading_city, raw: form.unloading_address },

        loading_org_name: form.loading_org_name,
        loading_org_inn: form.loading_org_inn,
        loading_contact_fio: form.loading_contact_fio,

        planned_loading_at: form.planned_loading_at ? `${form.planned_loading_at}:00+05:00` : null,
        planned_delivery_at: form.planned_delivery_at
          ? `${form.planned_delivery_at}:00+05:00`
          : null,

        assigned_vehicle_id: form.assigned_vehicle_id || null,
        assigned_driver_id: form.assigned_driver_id || null,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка создания заявки');
      }

      onSuccess();
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-5 max-w-3xl w-full shadow-2xl border border-slate-200 space-y-4 my-8">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Новая заявка на перевозку</h3>
            <p className="text-xs text-slate-400">
              Автозаполнение постоянных клиентов (ВСМПО / Геостройиндустрия) или загрузка PDF
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-base">
            ✕
          </button>
        </div>

        {/* ПЕРЕКЛЮЧАТЕЛЬ: ПОСТОЯННЫЙ КЛИЕНТ / PDF / ВРУЧНУЮ */}
        <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => selectClientPreset('vsmpo')}
            className={`py-1.5 rounded-lg transition ${selectedClientType === 'vsmpo' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'}`}
          >
            🏢 ВСМПО-АВИСМА (Парфенов)
          </button>
          <button
            type="button"
            onClick={() => selectClientPreset('geostroy')}
            className={`py-1.5 rounded-lg transition ${selectedClientType === 'geostroy' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'}`}
          >
            🏗️ ООО «Геостройиндустрия»
          </button>
          <button
            type="button"
            onClick={() => selectClientPreset('manual')}
            className={`py-1.5 rounded-lg transition ${selectedClientType === 'manual' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'}`}
          >
            ➕ Новый клиент / По карточке
          </button>
        </div>

        {/* Зона Drag and Drop PDF */}
        <div className="border border-dashed border-indigo-200 bg-indigo-50/40 rounded-xl p-2.5 text-center flex items-center justify-between gap-3 text-xs">
          <div className="text-left">
            <span className="font-bold text-slate-900 block">
              📄 Загрузить скан / PDF Поручения экспедитору
            </span>
            <span className="text-[11px] text-slate-500">
              Авто-извлечение ИНН, дат, груза, веса и ставки в 1 клик
            </span>
          </div>
          <label className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold cursor-pointer transition shadow-2xs">
            <span>{isParsing ? 'Распознавание...' : 'Загрузить PDF'}</span>
            <input
              type="file"
              accept=".pdf"
              disabled={isParsing}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) handlePdfUpload(e.target.files[0]);
              }}
              className="hidden"
            />
          </label>
        </div>

        {statusMessage && (
          <div className="p-2 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold flex items-center justify-between">
            <span>{statusMessage}</span>
            <span className="text-emerald-600 text-[10px]">Готово</span>
          </div>
        )}

        {/* ФОРМА ЗАЯВКИ */}
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {/* Секция 1: Реквизиты и участники */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div>
              <label className="font-bold text-slate-700 block mb-0.5">№ Поручения / Заявки</label>
              <input
                type="text"
                required
                value={form.base_doc_number}
                onChange={(e) => setForm({ ...form, base_doc_number: e.target.value })}
                className="w-full p-1.5 border border-slate-300 rounded bg-slate-50 font-bold"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-0.5">Дата документа</label>
              <input
                type="date"
                required
                value={form.base_doc_date}
                onChange={(e) => setForm({ ...form, base_doc_date: e.target.value })}
                className="w-full p-1.5 border border-slate-300 rounded bg-slate-50"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-0.5">Заказчик (Клиент)</label>
              <input
                type="text"
                required
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                placeholder="ООО / ПАО..."
                className="w-full p-1.5 border border-slate-300 rounded bg-white font-semibold"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-0.5">Экспедитор</label>
              <input
                type="text"
                readOnly
                value={form.forwarder_name}
                className="w-full p-1.5 border border-slate-200 rounded bg-slate-100 text-slate-600 font-medium"
              />
            </div>
          </div>

          {/* Секция 2: Маршрут и ЛОП (Лицо на погрузке) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div>
              <label className="font-bold text-slate-700 block mb-0.5">
                📍 Пункт погрузки (Откуда)
              </label>
              <input
                type="text"
                required
                value={form.loading_address}
                onChange={(e) => setForm({ ...form, loading_address: e.target.value })}
                className="w-full p-1.5 border border-slate-300 rounded bg-white"
              />
              <div className="flex justify-between mt-1 text-[11px] text-slate-500">
                <span>
                  Кто грузит (ЛОП): <b>{form.loading_org_name || form.client_name}</b>
                </span>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-0.5">
                🏁 Пункт выгрузки (Куда)
              </label>
              <input
                type="text"
                required
                value={form.unloading_address}
                onChange={(e) => setForm({ ...form, unloading_address: e.target.value })}
                className="w-full p-1.5 border border-slate-300 rounded bg-white"
              />
              <div className="mt-1 text-[11px] text-slate-500">
                <span>
                  Грузополучатель: <b>{form.client_name}</b>
                </span>
              </div>
            </div>
          </div>

          {/* Секция 3: Груз, Ставка и Финансовое закрытие (Дебиторка vs Касса) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="col-span-2">
              <label className="font-bold text-slate-700 block mb-0.5">Наименование груза</label>
              <input
                type="text"
                required
                value={form.cargo_name}
                onChange={(e) => setForm({ ...form, cargo_name: e.target.value })}
                className="w-full p-1.5 border border-slate-300 rounded bg-slate-50"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-0.5">Масса брутто (кг)</label>
              <input
                type="number"
                required
                value={form.weight_gross_kg}
                onChange={(e) => setForm({ ...form, weight_gross_kg: e.target.value })}
                className="w-full p-1.5 border border-slate-300 rounded bg-slate-50 font-bold"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-0.5">Ставка без НДС (руб.)</label>
              <input
                type="number"
                required
                value={form.price_without_vat}
                onChange={(e) => setForm({ ...form, price_without_vat: e.target.value })}
                className="w-full p-1.5 border border-slate-300 rounded bg-slate-50 font-black text-indigo-700"
              />
            </div>
          </div>

          {/* ФИНАНСОВАЯ ЦЕПОЧКА ЗАКРЫТИЯ: ДЕБИТОРКА ИЛИ НАЛИЧНЫЕ В КАССУ */}
          <div className="p-2.5 rounded-xl border border-indigo-200 bg-indigo-50/60 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-bold text-slate-900 block text-xs">
                Завершение оплаты после рейса:
              </span>
              <span className="text-[11px] text-slate-600">
                Куда поступит оплата после закрытия рейса по Wialon
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 font-bold cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-indigo-300 text-indigo-900">
                <input
                  type="radio"
                  name="payment_method"
                  value="bank_invoice"
                  checked={form.payment_method === 'bank_invoice'}
                  onChange={() => setForm({ ...form, payment_method: 'bank_invoice' })}
                />
                <span>🏦 Безнал на Р/С → Дебиторка</span>
              </label>
              <label className="flex items-center gap-1.5 font-bold cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-300 text-slate-700">
                <input
                  type="radio"
                  name="payment_method"
                  value="cash"
                  checked={form.payment_method === 'cash'}
                  onChange={() => setForm({ ...form, payment_method: 'cash' })}
                />
                <span>💵 Наличные → Касса компании</span>
              </label>
            </div>
          </div>

          {/* Секция 4: Назначение машины и водителя */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div>
              <label className="font-bold text-slate-700 block mb-0.5">
                Грузовой автомобиль (ТС)
              </label>
              <select
                value={form.assigned_vehicle_id}
                onChange={(e) => setForm({ ...form, assigned_vehicle_id: e.target.value })}
                className="w-full p-1.5 border border-slate-300 rounded bg-white"
              >
                <option value="">-- В лист ожидания (без назначения) --</option>
                {vehicles.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {v.brand_name || v.short_name || 'Авто'} ({v.reg_number})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-0.5">Водитель</label>
              <select
                value={form.assigned_driver_id}
                onChange={(e) => setForm({ ...form, assigned_driver_id: e.target.value })}
                className="w-full p-1.5 border border-slate-300 rounded bg-white"
              >
                <option value="">-- Назначить позже --</option>
                {drivers.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.phone ? `(${d.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Сохранить в справочник при ручном вводе */}
          {selectedClientType === 'manual' && (
            <label className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={saveToDirectory}
                onChange={(e) => setSaveToDirectory(e.target.checked)}
              />
              <span>
                Сохранить контрагента в справочник постоянных клиентов (чтобы в следующий раз
                заполнялось автоматически)
              </span>
            </label>
          )}

          {/* Кнопки */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs cursor-pointer transition active:scale-95"
            >
              Создать заявку
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
