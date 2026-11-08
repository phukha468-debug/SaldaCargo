/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface RouteStop {
  id: string;
  loading_city: string;
  loading_address: string;
  loading_org?: string;
  loading_contact?: string;
  unloading_city: string;
  unloading_address: string;
  unloading_org?: string;
  cargo_name?: string;
  weight_kg?: number;
}

export interface BillingDocsWorkflow {
  waybill_type?: 'paper' | 'etrn'; // Строго один из двух: либо бумага (ТрН), либо ЭТрН!
  invoice_issued?: boolean;
  invoice_number?: string | null;
  invoice_date?: string | null;
  tn_driver_delivered?: boolean;
  etrn_signed_edo?: boolean;
  epe_received_edo?: boolean;
  epe_number?: string | null;
  docs_sent_edo?: boolean;
  docs_sent_at?: string | null;
  client_accepted_edo?: boolean;
  client_accepted_at?: string | null;
  status?: 'in_progress' | 'accepted';
}

export function isStrictDocCounterparty(name?: string | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return n.includes('всмпо') || n.includes('ависма') || n.includes('геострой');
}

export function getDocCounterpartyBadge(name?: string | null): {
  label: string;
  badgeClass: string;
} {
  if (!name) return { label: 'Контрагент', badgeClass: 'bg-slate-100 text-slate-700' };
  const n = name.toLowerCase();
  if (n.includes('всмпо')) {
    return {
      label: '🏢 ВСМПО-АВИСМА',
      badgeClass: 'bg-indigo-100 text-indigo-900 border border-indigo-200',
    };
  }
  if (n.includes('ависма')) {
    return {
      label: '🏢 ООО Ависма',
      badgeClass: 'bg-blue-100 text-blue-900 border border-blue-200',
    };
  }
  if (n.includes('геострой')) {
    return {
      label: '🏗️ Геостройиндустрия',
      badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300',
    };
  }
  return { label: name, badgeClass: 'bg-slate-100 text-slate-700' };
}

export interface OrderItem {
  id: string;
  order_number: number;
  source_type: string;
  status: 'draft' | 'waiting_vehicle' | 'assigned' | 'in_progress' | 'pending_review' | 'completed';
  base_doc_name: string;
  base_doc_number: string | null;
  base_doc_date: string | null;
  internal_order_number: string | null;
  created_at?: string;
  loading_org_name?: string;

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
  vehicle?: {
    id: string;
    reg_number: string;
    brand_name: string;
    short_name: string;
    garage_number?: string;
    odometer_current?: number;
  };
  driver?: {
    id: string;
    name: string;
    phone: string;
    tab_number?: string;
    license_series?: string;
    license_number?: string;
    license_class?: string;
    notes?: any;
  };
  loading_point?: { id: string; name: string; structured_address: any };
  trip?: {
    id: string;
    trip_number: number;
    odometer_start: number;
    odometer_end: number;
    admin_note?: string;
    driver_note?: string;
    started_at?: string;
    ended_at?: string;
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

  routes_json?: RouteStop[];
  prevent_salda_auto_finish?: boolean;
  salda_transit_count?: number;
  billing_docs?: BillingDocsWorkflow | null;
  raw_parser_payload?: any;
}

const KANBAN_STAGES: Array<{
  status: OrderItem['status'];
  title: string;
  icon: string;
  badgeBg: string;
  badgeText: string;
  borderCol: string;
  headerBg: string;
}> = [
  {
    status: 'waiting_vehicle',
    title: 'Лист ожидания',
    icon: '⏳',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-900',
    borderCol: 'border-amber-300',
    headerBg: 'bg-amber-50/80',
  },
  {
    status: 'assigned',
    title: 'Назначены',
    icon: '📋',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-900',
    borderCol: 'border-sky-300',
    headerBg: 'bg-sky-50/80',
  },
  {
    status: 'in_progress',
    title: 'В пути',
    icon: '🚛',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-900',
    borderCol: 'border-purple-300',
    headerBg: 'bg-purple-50/80',
  },
  {
    status: 'pending_review',
    title: 'На ревью',
    icon: '🔍',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-900',
    borderCol: 'border-orange-300',
    headerBg: 'bg-orange-50/80',
  },
  {
    status: 'completed',
    title: 'Завершены',
    icon: '✅',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-900',
    borderCol: 'border-emerald-300',
    headerBg: 'bg-emerald-50/80',
  },
];

export function OrdersPipelineView() {
  const queryClient = useQueryClient();

  // Вид: 'kanban' (по умолчанию) | 'list' (1 строка) | 'documents' (Документооборот ВСМПО/Ависма/Геострой)
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'documents'>('kanban');
  const [activeStatusTab, setActiveStatusTab] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  // Состояние раздела «Документы» (ВСМПО, ООО Ависма, Геостройиндустрия)
  const [docClientFilter, setDocClientFilter] = useState<'all' | 'vsmpo' | 'avisma' | 'geostroy'>(
    'all',
  );
  const [showArchivedDocs, setShowArchivedDocs] = useState<boolean>(false);
  const [invoiceModalOrder, setInvoiceModalOrder] = useState<{
    order: OrderItem;
    initialStep5?: boolean;
  } | null>(null);
  const [invoiceNumberInput, setInvoiceNumberInput] = useState<string>('');
  const [invoiceDateInput, setInvoiceDateInput] = useState<string>('');

  // Модальные окна
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingOrder, setEditingOrder] = useState<OrderItem | null>(null);
  const [selectedDetailsOrder, setSelectedDetailsOrder] = useState<OrderItem | null>(null);
  const [isDriverModalOpen, setIsDriverModalOpen] = useState<boolean>(false);
  const [driverModalInitialId, setDriverModalInitialId] = useState<string | undefined>(undefined);
  const [assignModalOrder, setAssignModalOrder] = useState<OrderItem | null>(null);

  // 1. Загрузка заявок
  const { data: orders = [], isLoading } = useQuery<OrderItem[]>({
    queryKey: ['orders-pipeline'],
    queryFn: async () => {
      const res = await fetch('/api/orders');
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
      const list = Array.isArray(json) ? json : json.users || [];
      return list.filter((u: any) => u.roles?.includes('driver'));
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

  // Ручная синхронизация Wialon по кнопке администратора (автоматический опрос Wialon из браузера отключен:
  // синхронизация происходит строго через Вебхук Wialon либо серверный крон GitHub Actions)
  const wialonSyncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/cron/wialon-sync', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка синхронизации Wialon');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles-list'] });
    },
  });

  // Мутация Wialon (выезд / приезд)
  const autoProgressMutation = useMutation({
    mutationFn: async ({
      orderId,
      action,
      forceFinish = true,
    }: {
      orderId: string;
      action: 'depart' | 'arrive';
      forceFinish?: boolean;
    }) => {
      const res = await fetch(`/api/orders/${orderId}/auto-progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, forceFinish }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка смены статуса');
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.transit) {
        alert(
          `🔄 Зафиксирован промежуточный заезд в Верхнюю Салду (заезд #${data.salda_transit_count})!\nГалочка составного рейса автоматически снята. Рейс продолжается в статусе «В ПУТИ» — второй заезд в Салду автоматически закроет заявку.`,
        );
      } else if (data.status === 'pending_review') {
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
      if (selectedDetailsOrder) {
        setSelectedDetailsOrder(null);
      }
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
      if (selectedDetailsOrder) {
        setSelectedDetailsOrder(null);
      }
    },
  });

  // Мутация смены статуса на завершенный (одобрение ревью)
  const completeOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      if (!res.ok) throw new Error('Ошибка закрытия заявки');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      if (selectedDetailsOrder) {
        setSelectedDetailsOrder(null);
      }
    },
  });

  // Мутация удаления заявки
  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка удаления заявки');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-pipeline'] });
      setSelectedDetailsOrder(null);
    },
    onError: (err: any) => {
      alert(`Ошибка удаления: ${err.message}`);
    },
  });

  const handleDeleteOrder = (orderId: string, orderNumber: any) => {
    if (window.confirm(`Вы уверены, что хотите удалить заявку № ${orderNumber}?`)) {
      deleteOrderMutation.mutate(orderId);
    }
  };

  // ── РАБОТА С ДОКУМЕНТАМИ И СЧЕТАМИ (ВСМПО, АВИСМА, ГЕОСТРОЙ) ──
  const billingDocsMutation = useMutation({
    mutationFn: async ({
      orderId,
      docs,
    }: {
      orderId: string;
      docs: Partial<BillingDocsWorkflow>;
    }) => {
      const res = await fetch(`/api/orders/${orderId}/billing-docs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docs),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка сохранения документов');
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      if (variables.docs.client_accepted_edo) {
        alert(
          '✅ Документы подписаны контрагентом в ЭДО (поставлены В ОПЛАТУ)!\nСчёт передан в Дебиторку, рейс скрыт из списка активных документов.',
        );
      }
    },
    onError: (err: any) => {
      alert(`Ошибка: ${err.message}`);
    },
  });

  // Ручной перевод этапа заказа (для машин без Wialon или ручной корректировки)
  const manualStageMutation = useMutation({
    mutationFn: async ({ orderId, stage }: { orderId: string; stage: OrderItem['status'] }) => {
      const res = await fetch(`/api/orders/${orderId}/manual-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка смены этапа');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      if (selectedDetailsOrder && selectedDetailsOrder.id === data.order?.id) {
        setSelectedDetailsOrder(data.order);
      }
    },
    onError: (err: any) => {
      alert(`Ошибка: ${err.message}`);
    },
  });

  const handleToggleWaybillType = (order: OrderItem, newType: 'paper' | 'etrn') => {
    const cur = order.billing_docs || {};
    billingDocsMutation.mutate({
      orderId: order.id,
      docs: { ...cur, waybill_type: newType },
    });
  };

  const handleToggleTn = (order: OrderItem) => {
    const cur = order.billing_docs || {};
    billingDocsMutation.mutate({
      orderId: order.id,
      docs: { ...cur, waybill_type: 'paper', tn_driver_delivered: !cur.tn_driver_delivered },
    });
  };

  const handleToggleEtrn = (order: OrderItem) => {
    const cur = order.billing_docs || {};
    billingDocsMutation.mutate({
      orderId: order.id,
      docs: { ...cur, waybill_type: 'etrn', etrn_signed_edo: !cur.etrn_signed_edo },
    });
  };

  const handleToggleEpe = (order: OrderItem) => {
    const cur = order.billing_docs || {};
    billingDocsMutation.mutate({
      orderId: order.id,
      docs: { ...cur, epe_received_edo: !cur.epe_received_edo },
    });
  };

  const handleToggleDocsSent = (order: OrderItem) => {
    const cur = order.billing_docs || {};
    billingDocsMutation.mutate({
      orderId: order.id,
      docs: {
        ...cur,
        docs_sent_edo: !cur.docs_sent_edo,
        docs_sent_at: !cur.docs_sent_edo ? new Date().toISOString() : null,
      },
    });
  };

  const handleOpenInvoiceModal = (order: OrderItem, initialStep5: boolean = false) => {
    const cur = order.billing_docs || {};
    setInvoiceNumberInput(
      cur.invoice_number || order.base_doc_number || `СЧ-${order.order_number}`,
    );
    setInvoiceDateInput(cur.invoice_date || new Date().toISOString().slice(0, 10));
    setInvoiceModalOrder({ order, initialStep5 });
  };

  const handleSaveInvoice = (isIssued: boolean) => {
    if (!invoiceModalOrder) return;
    const { order, initialStep5 } = invoiceModalOrder;
    const trimmed = invoiceNumberInput.trim();
    if (isIssued && !trimmed) {
      alert('Пожалуйста, укажите номер счёта');
      return;
    }

    const cur = order.billing_docs || {};
    const updatedDocs: Partial<BillingDocsWorkflow> = {
      ...cur,
      invoice_issued: isIssued,
      invoice_number: isIssued ? trimmed : null,
      invoice_date: isIssued ? invoiceDateInput : null,
    };

    if (initialStep5 && isIssued) {
      updatedDocs.client_accepted_edo = true;
      updatedDocs.status = 'accepted';
    }

    billingDocsMutation.mutate({
      orderId: order.id,
      docs: updatedDocs,
    });

    setInvoiceModalOrder(null);
  };

  const handleStep5Click = (order: OrderItem) => {
    const cur = order.billing_docs || {};
    if (cur.client_accepted_edo) {
      if (
        confirm(
          `Вернуть рейс № ${order.base_doc_number || order.order_number} из архива в работу над документами?`,
        )
      ) {
        billingDocsMutation.mutate({
          orderId: order.id,
          docs: { ...cur, client_accepted_edo: false, status: 'in_progress' },
        });
      }
      return;
    }

    // Если номер счета еще не введен — открываем модалку для ввода
    if (!cur.invoice_number) {
      handleOpenInvoiceModal(order, true);
      return;
    }

    if (
      confirm(
        `Подтвердить: Контрагент подписал документы в ЭДО и поставил в ОПЛАТУ?\n\n` +
          `• Счёт № ${cur.invoice_number} появится в Дебиторке (статус "Выставить счёт" снимется)\n` +
          `• Рейс исчезнет из раздела "Документы"`,
      )
    ) {
      billingDocsMutation.mutate({
        orderId: order.id,
        docs: {
          ...cur,
          client_accepted_edo: true,
          status: 'accepted',
        },
      });
    }
  };

  // Все рейсы 3-х контрагентов (ВСМПО, Ависма, Геострой), которые в пути, на ревью или завершены
  const strictCounterpartyOrders = orders.filter((o) => {
    if (!isStrictDocCounterparty(o.client?.name)) return false;
    return ['in_progress', 'pending_review', 'completed'].includes(o.status);
  });

  const pendingDocsCount = strictCounterpartyOrders.filter((o) => {
    const isAccepted = Boolean(
      o.billing_docs?.client_accepted_edo || o.billing_docs?.status === 'accepted',
    );
    return !isAccepted;
  }).length;

  const filteredDocOrders = strictCounterpartyOrders.filter((o) => {
    if (docClientFilter !== 'all') {
      const name = o.client?.name?.toLowerCase() || '';
      if (docClientFilter === 'vsmpo' && !name.includes('всмпо')) return false;
      if (docClientFilter === 'avisma' && !name.includes('ависма')) return false;
      if (docClientFilter === 'geostroy' && !name.includes('геострой')) return false;
    }
    const isAccepted = Boolean(
      o.billing_docs?.client_accepted_edo || o.billing_docs?.status === 'accepted',
    );
    if (!showArchivedDocs && isAccepted) return false;
    if (search) {
      const q = search.toLowerCase();
      const match =
        String(o.trip?.trip_number || '').includes(q) ||
        o.base_doc_number?.toLowerCase().includes(q) ||
        String(o.order_number).includes(q) ||
        o.client?.name?.toLowerCase().includes(q) ||
        o.vehicle?.reg_number?.toLowerCase().includes(q) ||
        o.driver?.name?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Фильтрация
  const filteredOrders = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(o.trip?.trip_number || '').includes(q) ||
      o.base_doc_number?.toLowerCase().includes(q) ||
      String(o.order_number).includes(q) ||
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
          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
            ⏳ Лист ожидания
          </span>
        );
      case 'assigned':
        return (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-sky-100 text-sky-800 border border-sky-300">
            📋 Назначен
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-800 border border-purple-300 animate-pulse">
            🚛 В пути
          </span>
        );
      case 'pending_review':
        return (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-orange-100 text-orange-800 border border-orange-300">
            🔍 На ревью
          </span>
        );
      case 'completed':
        return (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
            ✅ Завершен
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800">
            Черновик
          </span>
        );
    }
  };

  // Вычисление краткого маршрута
  const formatRouteSummary = (order: OrderItem) => {
    const routes = order.routes_json || order.raw_parser_payload?.routes;
    if (routes && Array.isArray(routes) && routes.length > 1) {
      const count = routes.length;
      const first = routes[0]?.loading_city || 'Шайтанка';
      const last = routes[count - 1]?.unloading_city || 'Салда';
      return `${first} → ${last} (${count} точки)`;
    }
    const load = order.loading_address_json?.city || 'Погрузка';
    const unload = order.unloading_address_json?.city || 'Салда';
    return `${load} → ${unload}`;
  };

  return (
    <div className="space-y-3 font-sans">
      {/* ── ВЕРХНЯЯ СТРОКА: ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМОВ (КАНБАН / СПИСОК), ПОИСК, ДЕЙСТВИЯ ── */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          {/* Переключатель вида */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-bold">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1 rounded-md transition flex items-center gap-1.5 ${
                viewMode === 'kanban'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📊 Канбан-доска</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-md transition flex items-center gap-1.5 ${
                viewMode === 'list'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📑 Компактный список (1 строка)</span>
            </button>
            <button
              onClick={() => setViewMode('documents')}
              title="Документооборот и выставление счетов: ВСМПО-Ависма, ООО Ависма, Геостройиндустрия"
              className={`px-3 py-1 rounded-md transition flex items-center gap-1.5 ${
                viewMode === 'documents'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📑 Документы</span>
              {pendingDocsCount > 0 ? (
                <span className="px-1.5 py-0.2 bg-amber-500 text-white text-[9.5px] rounded-full font-bold">
                  {pendingDocsCount}
                </span>
              ) : (
                <span className="px-1.5 py-0.2 bg-slate-200 text-slate-600 text-[9.5px] rounded-full font-bold">
                  0
                </span>
              )}
            </button>
          </div>

          <div className="text-[11px] font-bold text-slate-500 hidden sm:block">
            Всего заявок: <span className="text-slate-900 font-mono">{orders.length}</span>
          </div>
        </div>

        {/* Поиск и создание */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Поиск по номеру, клиенту, грузу..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 w-52"
          />
          <button
            onClick={() => wialonSyncMutation.mutate()}
            disabled={wialonSyncMutation.isPending}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg border border-slate-300 shadow-2xs flex items-center gap-1.5 cursor-pointer transition active:scale-95 disabled:opacity-50"
          >
            <span>{wialonSyncMutation.isPending ? '⏳...' : '🛰️ Wialon'}</span>
          </button>
          <button
            onClick={() => {
              setDriverModalInitialId(undefined);
              setIsDriverModalOpen(true);
            }}
            title="Справочник водителей: добавление и редактирование паспорта, прав, ИНН и телефона"
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg border border-slate-300 shadow-2xs flex items-center gap-1.5 cursor-pointer transition active:scale-95"
          >
            <span>👤 Водители ({drivers.length})</span>
          </button>
          <button
            onClick={() => {
              setEditingOrder(null);
              setIsCreateModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition active:scale-95"
          >
            <span>+ Создать заявку</span>
          </button>
        </div>
      </div>

      {/* ── РЕЖИМ 1: КАНБАН-ДОСКА (ПО АНАЛОГИИ С ЭКСПЕДИЦИЕЙ, УЛЬТРА-КОМПАКТНЫЕ КАРТОЧКИ) ── */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5 items-start">
          {KANBAN_STAGES.map((col) => {
            const colOrders = filteredOrders.filter((o) => {
              if (col.status === 'waiting_vehicle') {
                return o.status === 'waiting_vehicle' || o.status === 'draft';
              }
              return o.status === col.status;
            });

            const colSum = colOrders.reduce(
              (acc, o) => acc + (Number(o.price_without_vat) || 0),
              0,
            );

            return (
              <div
                key={col.status}
                className={`bg-slate-50/70 rounded-xl border ${col.borderCol} p-2 flex flex-col min-h-[500px] shadow-2xs`}
              >
                {/* Шапка колонки */}
                <div
                  className={`p-1.5 rounded-lg ${col.headerBg} border border-slate-200/80 mb-2 flex items-center justify-between text-xs font-bold`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.icon}</span>
                    <span className="text-slate-900">{col.title}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] font-black ${col.badgeBg} ${col.badgeText}`}
                    >
                      {colOrders.length}
                    </span>
                  </div>
                  {colSum > 0 && (
                    <span className="text-[10px] font-black text-slate-700">
                      {(colSum / 1000).toFixed(0)}k ₽
                    </span>
                  )}
                </div>

                {/* Список ультра-компактных карточек */}
                <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[calc(100vh-260px)] pr-0.5">
                  {colOrders.length === 0 ? (
                    <div className="p-4 text-center text-[10.5px] text-slate-400 border border-dashed border-slate-200 rounded-lg">
                      Нет заявок
                    </div>
                  ) : (
                    colOrders.map((order) => {
                      const isMulti = Boolean(
                        (order.routes_json && order.routes_json.length > 1) ||
                        (order.raw_parser_payload?.routes &&
                          order.raw_parser_payload.routes.length > 1),
                      );
                      const isTransit = Boolean(
                        order.prevent_salda_auto_finish ||
                        order.raw_parser_payload?.prevent_salda_auto_finish,
                      );
                      const isCash = order.payment_terms?.includes('Наличные');
                      const clientShort =
                        order.client?.name?.replace(/ПАО|ООО|«|»/g, '').trim() || 'Клиент';
                      const routeText = formatRouteSummary(order);

                      return (
                        <div
                          key={order.id}
                          onClick={() => setSelectedDetailsOrder(order)}
                          className="p-2 bg-white rounded-lg border border-slate-200 hover:border-indigo-400 hover:shadow-xs transition cursor-pointer select-none space-y-1 group relative active:scale-[0.99]"
                        >
                          {/* СТРОКА 1: Номер, Клиент, Бейджи, Ставка (Dense layout) */}
                          <div className="flex items-center justify-between gap-1 text-[11px]">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition shrink-0">
                                {order.trip?.trip_number
                                  ? `Рейс № ${order.trip.trip_number}`
                                  : `№ ${order.base_doc_number || order.order_number}`}
                              </span>
                              {order.base_doc_number &&
                                (order.base_doc_number.includes('/') ||
                                order.base_doc_number.includes('\\') ? (
                                  <span
                                    className="px-1 py-0.2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[9px] font-bold shrink-0"
                                    title="Номер Электронного поручения экспедитору (ЭПЭ)"
                                  >
                                    ЭПЭ {order.base_doc_number}
                                  </span>
                                ) : order.trip?.trip_number &&
                                  order.base_doc_number !== String(order.trip.trip_number) ? (
                                  <span
                                    className="text-[9.5px] text-slate-400 font-mono shrink-0"
                                    title="Входящий номер заявки"
                                  >
                                    (№{order.base_doc_number})
                                  </span>
                                ) : null)}
                              <span className="text-[10px] text-slate-500 font-semibold truncate max-w-[85px]">
                                {clientShort}
                              </span>
                              {isTransit && (
                                <span
                                  className="px-1 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[9px] font-bold shrink-0"
                                  title="Составной рейс через Салду (без авто-закрытия)"
                                >
                                  🔄 Салда
                                </span>
                              )}
                              {isMulti && (
                                <span
                                  className="px-1 py-0.2 bg-indigo-100 text-indigo-900 border border-indigo-200 rounded text-[9px] font-bold shrink-0"
                                  title="Мульти-стоп маршрут (несколько погрузок/разгрузок)"
                                >
                                  📍 Мульти
                                </span>
                              )}
                            </div>

                            <span className="font-black text-slate-900 shrink-0 text-[11px]">
                              {order.price_without_vat
                                ? `${Number(order.price_without_vat).toLocaleString('ru-RU')} ₽`
                                : '—'}
                            </span>
                          </div>

                          {/* СТРОКА 2: Автомобиль/Водитель, маршрут, вес */}
                          <div className="flex items-center justify-between gap-1 text-[10px] text-slate-600">
                            <div className="flex items-center gap-1 truncate">
                              {order.vehicle?.reg_number ? (
                                <span className="font-mono font-bold bg-slate-100 text-slate-800 px-1 py-0.2 rounded text-[9.5px]">
                                  {order.vehicle.reg_number}
                                </span>
                              ) : (
                                <span className="text-amber-600 font-bold text-[9.5px]">
                                  + Назначить
                                </span>
                              )}
                              <span className="truncate max-w-[105px] font-medium text-slate-700">
                                {routeText}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-slate-400 font-medium">
                                {order.weight_gross_kg
                                  ? `${(order.weight_gross_kg / 1000).toFixed(1)} т`
                                  : ''}
                              </span>
                              <span className="text-[9.5px]">{isCash ? '💵' : '🏦'}</span>
                            </div>
                          </div>

                          {/* СТРОКА 3: Ручное перемещение этапа (для машин без Wialon) */}
                          <div
                            className="pt-1 mt-1 border-t border-slate-100 flex items-center justify-between gap-1 text-[10px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1">
                              {order.status === 'assigned' && (
                                <>
                                  <button
                                    onClick={() =>
                                      manualStageMutation.mutate({
                                        orderId: order.id,
                                        stage: 'in_progress',
                                      })
                                    }
                                    title="Отправить в рейс (В пути)"
                                    className="px-1.5 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded border border-purple-200 cursor-pointer"
                                  >
                                    🚀 В рейс
                                  </button>
                                  <button
                                    onClick={() =>
                                      manualStageMutation.mutate({
                                        orderId: order.id,
                                        stage: 'pending_review',
                                      })
                                    }
                                    title="Машина уже разгрузилась — сразу перевести на ревью и сбор документов"
                                    className="px-1.5 py-0.5 bg-orange-100 hover:bg-orange-200 text-orange-900 font-bold rounded border border-orange-300 cursor-pointer"
                                  >
                                    ⏩ Разгружен (Ревью)
                                  </button>
                                </>
                              )}
                              {order.status === 'in_progress' && (
                                <button
                                  onClick={() =>
                                    manualStageMutation.mutate({
                                      orderId: order.id,
                                      stage: 'pending_review',
                                    })
                                  }
                                  title="Завершить рейс и отправить на ревью"
                                  className="px-2 py-0.5 bg-orange-100 hover:bg-orange-200 text-orange-900 font-bold rounded border border-orange-300 cursor-pointer"
                                >
                                  🏁 Разгружен (Ревью)
                                </button>
                              )}
                              {order.status === 'pending_review' && (
                                <button
                                  onClick={() =>
                                    manualStageMutation.mutate({
                                      orderId: order.id,
                                      stage: 'completed',
                                    })
                                  }
                                  title="Одобрить и закрыть рейс в дебиторку"
                                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-2xs cursor-pointer"
                                >
                                  ✓ В дебиторку
                                </button>
                              )}
                              {order.status === 'waiting_vehicle' && (
                                <button
                                  onClick={() => setAssignModalOrder(order)}
                                  className="px-1.5 py-0.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded shadow-2xs cursor-pointer"
                                >
                                  + Назначить ТС
                                </button>
                              )}
                            </div>

                            <select
                              value={order.status}
                              onChange={(e) =>
                                manualStageMutation.mutate({
                                  orderId: order.id,
                                  stage: e.target.value as any,
                                })
                              }
                              className="bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[9.5px] font-bold text-slate-700 cursor-pointer focus:outline-none"
                              title="Переместить заявку на любой этап вручную"
                            >
                              <option value="waiting_vehicle">Лист ожидания</option>
                              <option value="assigned">Назначен</option>
                              <option value="in_progress">В пути</option>
                              <option value="pending_review">На ревью</option>
                              <option value="completed">Завершён</option>
                            </select>
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

      {/* ── РЕЖИМ 2: КОМПАКТНЫЙ СПИСОК (1 СТРОКА НА ЗАЯВКУ) ── */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Табы фильтров для списка */}
          <div className="p-2 border-b border-slate-100 flex items-center gap-1 bg-slate-50/60 text-xs font-bold">
            <button
              onClick={() => setActiveStatusTab('all')}
              className={`px-2.5 py-1 rounded-md transition ${activeStatusTab === 'all' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'}`}
            >
              Все ({orders.length})
            </button>
            {KANBAN_STAGES.map((s) => (
              <button
                key={s.status}
                onClick={() => setActiveStatusTab(s.status)}
                className={`px-2.5 py-1 rounded-md transition ${activeStatusTab === s.status ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'}`}
              >
                {s.icon} {s.title} ({orders.filter((o) => o.status === s.status).length})
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-500">Загрузка заявок...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">Заявок не найдено.</div>
          ) : (
            <div className="divide-y divide-slate-100 text-[11px] whitespace-nowrap">
              {filteredOrders
                .filter((o) => (activeStatusTab === 'all' ? true : o.status === activeStatusTab))
                .map((order) => {
                  const routeText = formatRouteSummary(order);
                  const cargoText = `${order.cargo_name || 'Груз'}, ${order.weight_gross_kg || 0} кг`;
                  const isAssigned = Boolean(order.assigned_vehicle_id && order.assigned_driver_id);
                  const isCash = order.payment_terms?.includes('Наличные');
                  const isTransit = Boolean(
                    order.prevent_salda_auto_finish ||
                    order.raw_parser_payload?.prevent_salda_auto_finish,
                  );

                  return (
                    <div
                      key={order.id}
                      onClick={() => setSelectedDetailsOrder(order)}
                      className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-50/80 transition cursor-pointer select-none"
                    >
                      {/* Статус и номер */}
                      <div className="flex items-center gap-2 min-w-[210px] shrink-0">
                        {getStatusBadge(order.status)}
                        <span className="font-bold text-slate-900 truncate shrink-0">
                          {order.trip?.trip_number
                            ? `Рейс № ${order.trip.trip_number}`
                            : `№ ${order.base_doc_number || order.order_number}`}
                        </span>
                        {order.base_doc_number &&
                          (order.base_doc_number.includes('/') ||
                          order.base_doc_number.includes('\\') ? (
                            <span
                              className="px-1 py-0.2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[9px] font-bold shrink-0"
                              title="Номер Электронного поручения (ЭПЭ)"
                            >
                              ЭПЭ {order.base_doc_number}
                            </span>
                          ) : order.trip?.trip_number &&
                            order.base_doc_number !== String(order.trip.trip_number) ? (
                            <span
                              className="text-[9.5px] text-slate-400 font-mono shrink-0"
                              title="Входящий номер заявки"
                            >
                              (№{order.base_doc_number})
                            </span>
                          ) : null)}
                        {isTransit && (
                          <span
                            className="px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[9.5px] font-bold"
                            title="Составной рейс через Салду"
                          >
                            🔄 Салда
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

                      {/* Клиент */}
                      <div className="flex items-center gap-1.5 min-w-[180px] max-w-[220px] truncate text-slate-700 shrink-0">
                        <span className="font-semibold text-slate-900 truncate">
                          {order.client?.name?.replace(/ПАО|ООО|«|»/g, '').trim() || 'Клиент'}
                        </span>
                        {order.forwarder && (
                          <>
                            <span className="text-slate-400">/</span>
                            <span className="text-slate-500 truncate">
                              {order.forwarder?.name?.split(' ')[1] || 'Экспедитор'}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Маршрут */}
                      <div className="min-w-[140px] max-w-[180px] truncate font-medium text-slate-800 shrink-0">
                        📍 {routeText}
                      </div>

                      {/* Груз */}
                      <div className="min-w-[150px] max-w-[200px] truncate text-slate-600 shrink-0">
                        📦 {cargoText}
                      </div>

                      {/* Ставка и тип оплаты */}
                      <div className="min-w-[110px] text-right shrink-0">
                        <div className="font-black text-slate-900">
                          {order.price_without_vat
                            ? `${Number(order.price_without_vat).toLocaleString('ru-RU')} ₽`
                            : '—'}
                        </div>
                        <div className="text-[9.5px] font-bold text-slate-500">
                          {isCash ? '💵 Касса' : '🏦 Дебиторка'}
                        </div>
                      </div>

                      {/* Авто и Водитель */}
                      <div className="min-w-[170px] max-w-[210px] truncate text-slate-700 shrink-0">
                        {isAssigned ? (
                          <span className="flex items-center gap-1 font-medium">
                            <span className="px-1.5 py-0.2 bg-slate-200 text-slate-800 rounded font-mono text-[10px] font-bold">
                              {order.vehicle?.reg_number || 'Авто'}
                            </span>
                            <span className="truncate">{order.driver?.name || 'Водитель'}</span>
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAssignModalOrder(order);
                            }}
                            className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded font-bold text-[10px] cursor-pointer shadow-2xs"
                          >
                            + Назначить ТС
                          </button>
                        )}
                      </div>

                      {/* Быстрое перемещение этапа (для машин без Wialon) */}
                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {order.status === 'assigned' && (
                          <button
                            onClick={() =>
                              manualStageMutation.mutate({
                                orderId: order.id,
                                stage: 'pending_review',
                              })
                            }
                            title="Машина уже разгрузилась — сразу перевести на ревью и сбор документов"
                            className="px-2 py-0.8 bg-orange-100 hover:bg-orange-200 text-orange-900 font-bold rounded text-[10px] border border-orange-300 cursor-pointer shadow-2xs"
                          >
                            ⏩ На ревью
                          </button>
                        )}
                        {order.status === 'in_progress' && (
                          <button
                            onClick={() =>
                              manualStageMutation.mutate({
                                orderId: order.id,
                                stage: 'pending_review',
                              })
                            }
                            title="Машина разгрузилась — перевести на ревью"
                            className="px-2 py-0.8 bg-orange-100 hover:bg-orange-200 text-orange-900 font-bold rounded text-[10px] border border-orange-300 cursor-pointer shadow-2xs"
                          >
                            🏁 На ревью
                          </button>
                        )}
                        {order.status === 'pending_review' && (
                          <button
                            onClick={() =>
                              manualStageMutation.mutate({
                                orderId: order.id,
                                stage: 'completed',
                              })
                            }
                            title="Завершить рейс в дебиторку"
                            className="px-2 py-0.8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px] shadow-2xs cursor-pointer"
                          >
                            ✓ В дебиторку
                          </button>
                        )}
                      </div>

                      {/* Кнопки документов и Wialon */}
                      <div
                        className="flex items-center gap-1.5 shrink-0 justify-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a
                          href={`/api/orders/${order.id}/docs/tn-pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Печать Транспортной накладной"
                          className="px-2 py-0.8 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-[10.5px]"
                        >
                          📄 ТН
                        </a>

                        <a
                          href={`/api/orders/${order.id}/docs/waybill-4c`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Печать Путевого листа № 4-С"
                          className="px-2 py-0.8 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded text-[10.5px]"
                        >
                          📋 ПЛ
                        </a>

                        <button
                          onClick={() =>
                            handleDeleteOrder(order.id, order.base_doc_number || order.order_number)
                          }
                          title="Удалить заявку"
                          className="px-1.5 py-0.8 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded font-bold text-[11px]"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ── РЕЖИМ 3: ДОКУМЕНТООБОРОТ И СЧЕТА (ВСМПО, АВИСМА, ГЕОСТРОЙИНДУСТРИЯ) ── */}
      {viewMode === 'documents' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden space-y-0">
          {/* Панель фильтров по контрагентам и архив */}
          <div className="p-2.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-slate-700 mr-1">Контрагент:</span>
              <button
                onClick={() => setDocClientFilter('all')}
                className={`px-2.5 py-1 rounded-md transition font-bold text-[11px] ${
                  docClientFilter === 'all'
                    ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-200'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                Все 3 контрагента ({strictCounterpartyOrders.length})
              </button>
              <button
                onClick={() => setDocClientFilter('vsmpo')}
                className={`px-2.5 py-1 rounded-md transition font-bold text-[11px] ${
                  docClientFilter === 'vsmpo'
                    ? 'bg-indigo-100 text-indigo-900 border border-indigo-300 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                🏢 ВСМПО-АВИСМА (
                {
                  strictCounterpartyOrders.filter((o) =>
                    o.client?.name?.toLowerCase().includes('всмпо'),
                  ).length
                }
                )
              </button>
              <button
                onClick={() => setDocClientFilter('avisma')}
                className={`px-2.5 py-1 rounded-md transition font-bold text-[11px] ${
                  docClientFilter === 'avisma'
                    ? 'bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                🏢 ООО Ависма (
                {
                  strictCounterpartyOrders.filter((o) =>
                    o.client?.name?.toLowerCase().includes('ависма'),
                  ).length
                }
                )
              </button>
              <button
                onClick={() => setDocClientFilter('geostroy')}
                className={`px-2.5 py-1 rounded-md transition font-bold text-[11px] ${
                  docClientFilter === 'geostroy'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                🏗️ Геостройиндустрия (
                {
                  strictCounterpartyOrders.filter((o) =>
                    o.client?.name?.toLowerCase().includes('геострой'),
                  ).length
                }
                )
              </button>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-semibold select-none">
                <input
                  type="checkbox"
                  checked={showArchivedDocs}
                  onChange={(e) => setShowArchivedDocs(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Показать завершённые в ЭДО (архив)</span>
              </label>

              <span className="text-[11px] text-slate-500 font-bold">
                В сборе: <b className="text-amber-600 font-mono">{pendingDocsCount}</b>
              </span>
            </div>
          </div>

          {/* Таблица строго в 1 строчку на рейс */}
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-500">Загрузка документов...</div>
          ) : filteredDocOrders.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 space-y-1">
              <div className="text-base">🎉</div>
              <div className="font-bold text-slate-700">
                Все документы собраны и выставлены в оплату!
              </div>
              <div className="text-[11px] text-slate-400">
                Нет активных рейсов, ожидающих сбора документов для выбранного контрагента.
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-[11px] whitespace-nowrap overflow-x-auto">
              {/* Шапка таблицы */}
              <div className="px-3 py-1.5 bg-slate-50 font-bold text-slate-500 text-[10px] uppercase tracking-wider flex items-center justify-between gap-2 border-b border-slate-200">
                <div className="w-[195px] shrink-0">Рейс / ЭПЭ / Дата</div>
                <div className="w-[160px] shrink-0">Транспорт / Водитель</div>
                <div className="w-[150px] shrink-0">Контрагент</div>
                <div className="w-[85px] text-right shrink-0">Ставка</div>
                <div className="w-[130px] text-center shrink-0">1. Счёт</div>
                <div className="w-[135px] text-center shrink-0">2. ТрН / ЭТрН (строго 1)</div>
                <div className="w-[105px] text-center shrink-0">3. ЭПЭ в ЭДО</div>
                <div className="w-[115px] text-center shrink-0">4. Пакет в ЭДО</div>
                <div className="w-[155px] text-center shrink-0">5. В оплату (ЭДО)</div>
                <div className="w-[100px] text-right shrink-0">Печать</div>
              </div>

              {/* Строки рейсов (строго 1 строка на рейс) */}
              {filteredDocOrders.map((order) => {
                const docs = order.billing_docs || {};
                const isAccepted = Boolean(docs.client_accepted_edo || docs.status === 'accepted');
                const badge = getDocCounterpartyBadge(order.client?.name);
                const isAssigned = Boolean(order.assigned_vehicle_id && order.assigned_driver_id);
                const tripDate = order.base_doc_date
                  ? order.base_doc_date.slice(5)
                  : order.planned_loading_at?.slice(5, 10) || order.created_at?.slice(5, 10) || '—';

                return (
                  <div
                    key={order.id}
                    className={`px-3 py-1.5 flex items-center justify-between gap-2 transition select-none ${
                      isAccepted
                        ? 'bg-slate-50/50 opacity-70 hover:opacity-100'
                        : 'hover:bg-slate-50/80 bg-white'
                    }`}
                  >
                    {/* Рейс / Номер / Дата */}
                    <div className="w-[195px] flex items-center gap-1.5 shrink-0">
                      <span className="font-bold text-slate-900 truncate">
                        {order.trip?.trip_number
                          ? `Рейс № ${order.trip.trip_number}`
                          : `Заявка № ${order.base_doc_number || order.order_number}`}
                      </span>
                      {order.base_doc_number &&
                        (order.base_doc_number.includes('/') ||
                        order.base_doc_number.includes('\\') ? (
                          <span
                            className="px-1 py-0.2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[9px] font-bold shrink-0"
                            title="Номер Электронного поручения экспедитору (ЭПЭ)"
                          >
                            ЭПЭ {order.base_doc_number}
                          </span>
                        ) : order.trip?.trip_number &&
                          order.base_doc_number !== String(order.trip.trip_number) ? (
                          <span
                            className="text-[9.5px] text-slate-400 font-mono shrink-0"
                            title="Номер входящей заявки"
                          >
                            (№{order.base_doc_number})
                          </span>
                        ) : null)}
                      <span className="text-[10px] text-slate-400 font-mono">({tripDate})</span>
                      {order.status === 'in_progress' ? (
                        <span className="px-1 py-0.2 bg-purple-100 text-purple-900 font-bold rounded text-[9px] animate-pulse">
                          В пути
                        </span>
                      ) : order.status === 'pending_review' ? (
                        <span className="px-1 py-0.2 bg-orange-100 text-orange-900 font-bold rounded text-[9px]">
                          Ревью
                        </span>
                      ) : (
                        <span className="px-1 py-0.2 bg-emerald-100 text-emerald-900 font-bold rounded text-[9px]">
                          Завершён
                        </span>
                      )}
                    </div>

                    {/* Авто и Водитель */}
                    <div className="w-[160px] truncate text-slate-700 shrink-0 flex items-center gap-1">
                      {isAssigned ? (
                        <>
                          <span className="px-1.5 py-0.2 bg-slate-200 text-slate-800 rounded font-mono text-[10px] font-bold shrink-0">
                            {order.vehicle?.reg_number || 'Авто'}
                          </span>
                          <span className="truncate text-slate-700">
                            {order.driver?.name?.split(' ')[0] || 'Водитель'}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400 italic text-[10px]">ТС не назначено</span>
                      )}
                    </div>

                    {/* Контрагент */}
                    <div className="w-[150px] shrink-0 truncate">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10.5px] truncate inline-block max-w-[145px] ${badge.badgeClass}`}
                        title={order.client?.name || ''}
                      >
                        {badge.label}
                      </span>
                    </div>

                    {/* Ставка */}
                    <div className="w-[85px] text-right shrink-0 font-black text-slate-900 font-mono">
                      {order.price_without_vat
                        ? `${Number(order.price_without_vat).toLocaleString('ru-RU')} ₽`
                        : '—'}
                    </div>

                    {/* 1. Счёт выставлен */}
                    <div className="w-[130px] flex items-center justify-center shrink-0">
                      {docs.invoice_issued && docs.invoice_number ? (
                        <button
                          onClick={() => handleOpenInvoiceModal(order)}
                          title="Счёт выставлен. Клик — изменить номер или дату"
                          className="px-2 py-0.8 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded font-bold text-[10.5px] flex items-center gap-1 cursor-pointer transition truncate max-w-[125px]"
                        >
                          <span>🧾 № {docs.invoice_number}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenInvoiceModal(order)}
                          title="Выставить счёт на этот рейс"
                          className="px-2 py-0.8 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded font-semibold text-[10px] flex items-center gap-1 cursor-pointer transition"
                        >
                          <span>+ 🧾 Счёт</span>
                        </button>
                      )}
                    </div>

                    {/* 2. Либо ТрН (бумага), либо ЭТрН (электронная) — строго один из двух вариантов! */}
                    <div className="w-[135px] flex items-center justify-center shrink-0">
                      {docs.waybill_type === 'etrn' ? (
                        <div className="flex items-center">
                          <button
                            onClick={() => handleToggleWaybillType(order, 'paper')}
                            title="Сейчас: ЭТрН. Клик — переключить на бумажную ТрН"
                            className="px-1.5 py-0.8 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded-l text-[10px] font-bold border-y border-l border-purple-300 cursor-pointer"
                          >
                            ⚡ ЭТрН
                          </button>
                          <button
                            onClick={() => handleToggleEtrn(order)}
                            title="Клик — переключить статус подписания ЭТрН в ЭДО"
                            className={`px-1.5 py-0.8 rounded-r text-[10px] font-bold border transition cursor-pointer ${
                              docs.etrn_signed_edo
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                            }`}
                          >
                            {docs.etrn_signed_edo ? '✔ Подписана' : '⏳ Ждём'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <button
                            onClick={() => handleToggleWaybillType(order, 'etrn')}
                            title="Сейчас: Бумажная ТрН. Клик — переключить на электронную ЭТрН"
                            className="px-1.5 py-0.8 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-l text-[10px] font-bold border-y border-l border-slate-300 cursor-pointer"
                          >
                            📄 ТрН
                          </button>
                          <button
                            onClick={() => handleToggleTn(order)}
                            title="Клик — отметить сдачу оригинала ТрН водителем"
                            className={`px-1.5 py-0.8 rounded-r text-[10px] font-bold border transition cursor-pointer ${
                              docs.tn_driver_delivered
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                            }`}
                          >
                            {docs.tn_driver_delivered ? '✔ Сдана' : '❌ Ждём'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 3. ЭПЭ пришло в ЭДО */}
                    <div className="w-[105px] flex items-center justify-center shrink-0">
                      <button
                        onClick={() => handleToggleEpe(order)}
                        title="Клик — переключить статус поступления Электронного поручения (ЭПЭ) в ЭДО"
                        className={`px-2 py-0.8 rounded font-bold text-[10.5px] flex items-center gap-1 cursor-pointer transition ${
                          docs.epe_received_edo
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300'
                        }`}
                      >
                        <span>{docs.epe_received_edo ? '✔ ЭПЭ в ЭДО' : '⏳ Ждём ЭПЭ'}</span>
                      </button>
                    </div>

                    {/* 4. Отправлены все документы по ЭДО */}
                    <div className="w-[115px] flex items-center justify-center shrink-0">
                      <button
                        onClick={() => handleToggleDocsSent(order)}
                        title="Клик — отметить отправку полного пакета документов заказчику в ЭДО"
                        className={`px-2 py-0.8 rounded font-bold text-[10.5px] flex items-center gap-1 cursor-pointer transition ${
                          docs.docs_sent_edo
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300'
                        }`}
                      >
                        <span>{docs.docs_sent_edo ? '✔ Пакет в ЭДО' : '✉️ Не отправлен'}</span>
                      </button>
                    </div>

                    {/* 5. В ЭДО контрагент поставил В ОПЛАТУ (подписал) */}
                    <div className="w-[155px] flex items-center justify-center shrink-0">
                      {isAccepted ? (
                        <button
                          onClick={() => handleStep5Click(order)}
                          title="Контрагент подписал документы и поставил в оплату. Счёт передан в Дебиторку. Клик — вернуть в работу"
                          className="px-2.5 py-0.8 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 rounded font-bold text-[10.5px] flex items-center gap-1 cursor-pointer transition"
                        >
                          <span>🟢 В оплате (ЭДО)</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStep5Click(order)}
                          title="Контрагент подписал документы в ЭДО: зафиксировать счёт в Дебиторке и завершить документооборот"
                          className="px-2.5 py-0.8 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10.5px] shadow-2xs flex items-center gap-1 cursor-pointer transition active:scale-95"
                        >
                          <span>⏳ Поставить В ОПЛАТУ</span>
                        </button>
                      )}
                    </div>

                    {/* Кнопки печати и детали */}
                    <div className="w-[100px] flex items-center gap-1 shrink-0 justify-end">
                      <a
                        href={`/api/orders/${order.id}/docs/tn-pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Печать Транспортной накладной"
                        className="px-1.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-[10px]"
                      >
                        📄 ТН
                      </a>
                      <a
                        href={`/api/orders/${order.id}/docs/waybill-4c`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Печать Путевого листа № 4-С"
                        className="px-1.5 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded text-[10px]"
                      >
                        📋 ПЛ
                      </a>
                      <button
                        onClick={() => setSelectedDetailsOrder(order)}
                        title="Детали заявки"
                        className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold text-[10px]"
                      >
                        🔍
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── МОДАЛЬНОЕ ОКНО БЫСТРОГО ВВОДА СЧЁТА ── */}
      {invoiceModalOrder && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full p-4 shadow-xl space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 truncate">
                <span>🧾 Счёт:</span>
                <span className="text-indigo-600 font-black">
                  {invoiceModalOrder.order.trip?.trip_number
                    ? `Рейс № ${invoiceModalOrder.order.trip.trip_number}`
                    : `Заявка № ${invoiceModalOrder.order.base_doc_number || invoiceModalOrder.order.order_number}`}
                </span>
                {invoiceModalOrder.order.base_doc_number &&
                  (invoiceModalOrder.order.base_doc_number.includes('/') ||
                  invoiceModalOrder.order.base_doc_number.includes('\\') ? (
                    <span className="px-1 py-0.2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[9.5px] font-bold">
                      ЭПЭ {invoiceModalOrder.order.base_doc_number}
                    </span>
                  ) : null)}
              </div>
              <button
                onClick={() => setInvoiceModalOrder(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-[11px] text-slate-500 font-medium">
              {invoiceModalOrder.order.client?.name} • Ставка:{' '}
              {invoiceModalOrder.order.price_without_vat
                ? `${Number(invoiceModalOrder.order.price_without_vat).toLocaleString('ru-RU')} ₽`
                : '—'}
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                  Номер счёта на оплату
                </label>
                <input
                  type="text"
                  value={invoiceNumberInput}
                  onChange={(e) => setInvoiceNumberInput(e.target.value)}
                  placeholder="Например, 104 или СЧ-793"
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                  Дата счёта
                </label>
                <input
                  type="date"
                  value={invoiceDateInput}
                  onChange={(e) => setInvoiceDateInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleSaveInvoice(false)}
                className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded text-xs font-bold cursor-pointer"
              >
                Снять счёт
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInvoiceModalOrder(null)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveInvoice(true)}
                  className="px-3.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold shadow-xs cursor-pointer"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {selectedDetailsOrder && (
        <OrderDetailsModal
          order={selectedDetailsOrder}
          onClose={() => setSelectedDetailsOrder(null)}
          onEdit={() => {
            setEditingOrder(selectedDetailsOrder);
            setSelectedDetailsOrder(null);
            setIsCreateModalOpen(true);
          }}
          onAssignVehicle={() => {
            setAssignModalOrder(selectedDetailsOrder);
            setSelectedDetailsOrder(null);
          }}
          onDepart={() =>
            autoProgressMutation.mutate({ orderId: selectedDetailsOrder.id, action: 'depart' })
          }
          onArrive={() =>
            autoProgressMutation.mutate({
              orderId: selectedDetailsOrder.id,
              action: 'arrive',
              forceFinish: false,
            })
          }
          onComplete={() => completeOrderMutation.mutate(selectedDetailsOrder.id)}
          onManualStage={(stage) =>
            manualStageMutation.mutate({ orderId: selectedDetailsOrder.id, stage })
          }
          onDelete={() =>
            handleDeleteOrder(
              selectedDetailsOrder.id,
              selectedDetailsOrder.base_doc_number || selectedDetailsOrder.order_number,
            )
          }
        />
      )}

      {/* ── МОДАЛЬНОЕ ОКНО СОЗДАНИЯ / РЕДАКТИРОВАНИЯ ЗАЯВКИ (МУЛЬТИ-СТОП + САЛДА) ── */}
      {isCreateModalOpen && (
        <CreateSmartOrderModal
          initialOrder={editingOrder}
          presets={presets}
          loadingPoints={loadingPoints}
          counterparties={counterparties}
          vehicles={vehicles}
          drivers={drivers}
          onOpenDriverModal={(driverId) => {
            setDriverModalInitialId(driverId);
            setIsDriverModalOpen(true);
          }}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingOrder(null);
          }}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            setEditingOrder(null);
            queryClient.invalidateQueries({ queryKey: ['orders-pipeline'] });
          }}
        />
      )}

      {/* ── МОДАЛЬНОЕ ОКНО УПРАВЛЕНИЯ СПРАВОЧНИКОМ ВОДИТЕЛЕЙ ── */}
      {isDriverModalOpen && (
        <DriverEditModal
          drivers={drivers}
          initialDriverId={driverModalInitialId}
          onClose={() => setIsDriverModalOpen(false)}
          onSaved={() => {
            setIsDriverModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['drivers-list'] });
          }}
        />
      )}

      {/* ── МОДАЛЬНОЕ ОКНО НАЗНАЧЕНИЯ ТС ── */}
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
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 block">Водитель</label>
                  <button
                    type="button"
                    onClick={() => {
                      setDriverModalInitialId(undefined);
                      setIsDriverModalOpen(true);
                    }}
                    className="text-[10.5px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                  >
                    ⚙️ Справочник / + Новый
                  </button>
                </div>
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
 * ─────────────────────────────────────────────────────────────────────────────
 * ДЕТАЛЬНОЕ МОДАЛЬНОЕ ОКНО ЗАЯВКИ (ПО АНАЛОГИИ С ЭКСПЕДИЦИЕЙ)
 * Вся информация: точки, груз, финансы, ТС, водитель, документы и Wialon
 * ─────────────────────────────────────────────────────────────────────────────
 */
function OrderDetailsModal({
  order,
  onClose,
  onEdit,
  onAssignVehicle,
  onDepart,
  onArrive,
  onComplete,
  onManualStage,
  onDelete,
}: {
  order: OrderItem;
  onClose: () => void;
  onEdit: () => void;
  onAssignVehicle: () => void;
  onDepart: () => void;
  onArrive: () => void;
  onComplete: () => void;
  onManualStage?: (stage: OrderItem['status']) => void;
  onDelete: () => void;
}) {
  const routes: RouteStop[] = order.routes_json || order.raw_parser_payload?.routes || [];
  const isMulti = routes.length > 1;
  const isTransit = Boolean(
    order.prevent_salda_auto_finish || order.raw_parser_payload?.prevent_salda_auto_finish,
  );
  const isCash = order.payment_terms?.includes('Наличные');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Шапка модального окна */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📋</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <span>
                    {order.trip?.trip_number
                      ? `Рейс № ${order.trip.trip_number}`
                      : `Заявка № ${order.base_doc_number || order.order_number}`}
                  </span>
                  {order.base_doc_number &&
                    (order.base_doc_number.includes('/') || order.base_doc_number.includes('\\') ? (
                      <span className="px-1.5 py-0.5 bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 rounded text-[11px] font-bold">
                        ЭПЭ {order.base_doc_number}
                      </span>
                    ) : order.trip?.trip_number &&
                      order.base_doc_number !== String(order.trip.trip_number) ? (
                      <span className="text-xs text-slate-300 font-mono font-normal">
                        (№{order.base_doc_number})
                      </span>
                    ) : null)}
                </h3>
                <span className="text-xs text-slate-300">
                  от {order.base_doc_date ? order.base_doc_date : order.created_at?.slice(0, 10)}
                </span>
                {order.status === 'in_progress' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-500 text-white animate-pulse">
                    🚛 В пути
                  </span>
                ) : order.status === 'assigned' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-sky-500 text-white">
                    📋 Назначен
                  </span>
                ) : order.status === 'pending_review' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-orange-500 text-white">
                    🔍 На ревью
                  </span>
                ) : order.status === 'completed' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500 text-white">
                    ✅ Завершен
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-500 text-white">
                    ⏳ Лист ожидания
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {order.client?.name || 'ПАО «Корпорация ВСМПО-АВИСМА»'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-black text-sm text-emerald-400">
                {order.price_without_vat
                  ? `${Number(order.price_without_vat).toLocaleString('ru-RU')} ₽`
                  : '—'}
              </div>
              <div className="text-[10px] text-slate-300 font-bold">
                {isCash ? '💵 В кассу' : '🏦 В дебиторку'}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-lg p-1 transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Тело модального окна */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs font-sans">
          {/* ПАНЕЛЬ РУЧНОГО УПРАВЛЕНИЯ ЭТАПАМИ (ДЛЯ МАШИН БЕЗ WIALON) */}
          <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                <span>🔄</span>
                <span>Текущий этап заявки (ручное перемещение для машин без Wialon):</span>
              </div>
              <span className="text-[10.5px] text-indigo-700 font-semibold">
                Кликните этап для мгновенного перевода
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {KANBAN_STAGES.map((st) => (
                <button
                  key={st.status}
                  onClick={() => onManualStage && onManualStage(st.status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    order.status === st.status
                      ? `${st.badgeBg} ${st.badgeText} ring-2 ring-indigo-600 shadow-xs font-black scale-105`
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{st.icon}</span>
                  <span>{st.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Блок 1: Телематика Wialon и управление рейсом */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xl">🛰️</span>
              <div>
                <span className="font-bold text-slate-900 block text-xs">
                  Телематика Wialon & Рейс
                </span>
                <span className="text-[11px] text-slate-600">
                  {order.status === 'in_progress' ? (
                    <span className="text-purple-700 font-bold">
                      Грузовик покинул Салду. Одометр: {order.trip?.odometer_start || 120500} км.
                      {isTransit
                        ? ' Включен составной маршрут (1-й заезд снимет галочку, 2-й закроет).'
                        : (order.salda_transit_count || 0) > 0
                          ? ` Промежуточный транзит пройден (следующий заезд завершит).`
                          : ''}
                    </span>
                  ) : order.status === 'assigned' ? (
                    <span className="text-sky-700 font-bold">
                      Машина назначена. При выезде за радиус 8 км Салды рейс стартует автоматически
                      (или используйте кнопки справа).
                    </span>
                  ) : order.status === 'pending_review' ? (
                    <span className="text-orange-700 font-bold">
                      Грузовик вернулся / разгрузился. Ожидает одобрения ЗП и ГСМ, документы в
                      обработке.
                    </span>
                  ) : order.status === 'completed' ? (
                    <span className="text-emerald-700 font-bold">
                      Рейс успешно закрыт, дебиторка зафиксирована.
                    </span>
                  ) : (
                    <span className="text-amber-700 font-bold">
                      В листе ожидания. Назначьте автомобиль и водителя.
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Кнопки Wialon и быстрых действий */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {order.status === 'assigned' && (
                <>
                  <button
                    onClick={onDepart}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-xs transition active:scale-95 cursor-pointer text-[11px]"
                  >
                    🚀 Выезд (Wialon)
                  </button>
                  <button
                    onClick={() => onManualStage && onManualStage('pending_review')}
                    className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold shadow-xs transition active:scale-95 cursor-pointer text-[11px]"
                    title="Машина уже разгрузилась — сразу перевести в ревью и открыть сбор документов"
                  >
                    ⏩ Разгрузился (На ревью)
                  </button>
                </>
              )}
              {order.status === 'in_progress' && (
                <>
                  <button
                    onClick={onArrive}
                    className={`px-3 py-1.5 text-white rounded-lg font-bold shadow-xs transition active:scale-95 cursor-pointer text-[11px] ${
                      isTransit
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    {isTransit ? '🔄 Заезд (транзит, снять флаг)' : '🏁 Возврат в Салду (Ревью)'}
                  </button>
                  <button
                    onClick={() => onManualStage && onManualStage('pending_review')}
                    className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold shadow-xs transition active:scale-95 cursor-pointer text-[11px]"
                  >
                    ⏩ Разгрузился (На ревью)
                  </button>
                </>
              )}
              {order.status === 'pending_review' && (
                <button
                  onClick={onComplete}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs transition active:scale-95 cursor-pointer text-[11px]"
                >
                  ✓ Закрыть рейс в дебиторку
                </button>
              )}
              {!order.assigned_vehicle_id && (
                <button
                  onClick={onAssignVehicle}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold shadow-xs cursor-pointer text-[11px]"
                >
                  + Назначить ТС
                </button>
              )}
            </div>
          </div>

          {/* Блок 2: Маршрут (Мульти-стоп и транзит Салды) */}
          <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <span>📍</span>
                <span>Маршрут перевозки {isMulti ? `(${routes.length} сегмента)` : ''}</span>
              </span>

              {isTransit && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded font-bold text-[10.5px]">
                  🔄 Составной рейс: транзит через Салду разрешен (заездов:{' '}
                  {order.salda_transit_count || 0})
                </span>
              )}
            </div>

            {/* Список точек маршрута */}
            {isMulti ? (
              <div className="space-y-2">
                {routes.map((r, idx) => (
                  <div
                    key={r.id || idx}
                    className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1"
                  >
                    <div className="flex items-center justify-between font-bold text-slate-800 text-[11px]">
                      <span>
                        Сегмент #{idx + 1}: {r.loading_city} → {r.unloading_city}
                      </span>
                      {r.weight_kg && (
                        <span className="text-slate-500 font-mono">{r.weight_kg} кг</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                      <div>
                        <span className="text-slate-500 block">Погрузка (Откуда):</span>
                        <span className="font-semibold text-slate-900">{r.loading_address}</span>
                        {r.loading_org && (
                          <span className="text-slate-500 block text-[10px]">
                            ЛОП: {r.loading_org}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-slate-500 block">Выгрузка (Куда):</span>
                        <span className="font-semibold text-slate-900">{r.unloading_address}</span>
                        {r.unloading_org && (
                          <span className="text-slate-500 block text-[10px]">
                            Получатель: {r.unloading_org}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[10.5px]">
                    📍 Пункт погрузки (Откуда):
                  </span>
                  <span className="font-bold text-slate-900 text-xs">
                    {order.loading_address_json?.raw || 'г. Заречный'}
                  </span>
                  <div className="mt-1 text-[10px] text-slate-500">
                    ЛОП:{' '}
                    <b>{order.loading_org_name || order.client?.name || 'ООО "Континенталь"'}</b>
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10.5px]">
                    🏁 Пункт выгрузки (Куда):
                  </span>
                  <span className="font-bold text-slate-900 text-xs">
                    {order.unloading_address_json?.raw || 'г. Верхняя Салда'}
                  </span>
                  <div className="mt-1 text-[10px] text-slate-500">
                    Получатель: <b>{order.client?.name || 'ПАО «Корпорация ВСМПО-АВИСМА»'}</b>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Блок 3: Груз, Финансы и Участники */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Груз и Финансы */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
              <span className="font-bold text-slate-900 text-xs block border-b border-slate-100 pb-1">
                📦 Груз и Финансы
              </span>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Груз:</span>
                  <span className="font-bold text-slate-900">{order.cargo_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Масса брутто:</span>
                  <span className="font-bold text-slate-900">{order.weight_gross_kg} кг</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ставка (без НДС):</span>
                  <span className="font-black text-slate-900">
                    {order.price_without_vat
                      ? `${Number(order.price_without_vat).toLocaleString('ru-RU')} ₽`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Канал оплаты:</span>
                  <span className="font-bold text-indigo-700">
                    {isCash ? '💵 В кассу компании' : '🏦 В дебиторку (Р/С)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Условия:</span>
                  <span className="text-slate-700 text-right truncate max-w-[180px]">
                    {order.payment_terms || 'По факту доставки'}
                  </span>
                </div>
              </div>
            </div>

            {/* Автомобиль и Водитель */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                <span className="font-bold text-slate-900 text-xs">🚚 Автомобиль и Водитель</span>
                <button
                  onClick={onAssignVehicle}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                >
                  Сменить
                </button>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Автомобиль:</span>
                  <span className="font-bold text-slate-900">
                    {order.vehicle ? (
                      <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                        {order.vehicle.reg_number}
                      </span>
                    ) : (
                      <span className="text-amber-600 font-bold">Не назначен</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Модель:</span>
                  <span className="font-medium text-slate-800">
                    {order.vehicle?.brand_name || order.vehicle?.short_name || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Водитель:</span>
                  <span className="font-bold text-slate-900">{order.driver?.name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Телефон водителя:</span>
                  <span className="font-mono text-slate-700">{order.driver?.phone || '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Блок 4: Документы (ТН, Путевой лист, XML) */}
          <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl flex flex-wrap items-center justify-between gap-2.5">
            <div>
              <span className="font-bold text-slate-900 block text-xs">
                📄 Комплект перевозочных документов
              </span>
              <span className="text-[10.5px] text-slate-600">
                Печать готовых бланков с данными заявки или чистых пустых форм
              </span>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`/api/orders/${order.id}/docs/tn-pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs transition active:scale-95 flex items-center gap-1"
              >
                <span>📄 ТН</span>
              </a>

              <a
                href={`/api/orders/${order.id}/docs/waybill-4c`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs shadow-xs transition active:scale-95 flex items-center gap-1"
              >
                <span>📋 Путевой лист № 4-С</span>
              </a>

              <a
                href={`/api/orders/${order.id}/docs/etrn-xml`}
                download
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs shadow-xs transition active:scale-95 flex items-center gap-1"
              >
                <span>📥 XML</span>
              </a>
            </div>
          </div>
        </div>

        {/* Футер с кнопками управления */}
        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onDelete}
            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-xs cursor-pointer transition active:scale-95"
          >
            🗑️ Удалить заявку
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="px-4 py-1.5 bg-white hover:bg-slate-200 border border-slate-300 text-slate-800 rounded-lg font-bold text-xs cursor-pointer transition active:scale-95"
            >
              ✏️ Редактировать заявку
            </button>
            <button
              onClick={onClose}
              className="px-5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs cursor-pointer transition active:scale-95"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * УМНАЯ ФОРМА СОЗДАНИЯ И РЕДАКТИРОВАНИЯ ЗАЯВКИ
 * - Поддержка 1-6 точек погрузки / разгрузки (Мульти-стоп маршрут)
 * - Флаг «Составной маршрут через Салду» (Wialon не завершит рейс при заезде в Салду)
 * - Автозаполнение ВСМПО-АВИСМА, ООО «Геостройиндустрия», ручной ввод
 * ─────────────────────────────────────────────────────────────────────────────
 */
function CreateSmartOrderModal({
  initialOrder,
  presets,
  counterparties,
  vehicles,
  drivers,
  onOpenDriverModal,
  onClose,
  onSuccess,
}: {
  initialOrder?: OrderItem | null;
  presets: any[];
  loadingPoints?: any[];
  counterparties: any[];
  vehicles: any[];
  drivers: any[];
  onOpenDriverModal?: (driverId?: string) => void;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEditing = Boolean(initialOrder);

  const [selectedClientType, setSelectedClientType] = useState<'vsmpo' | 'geostroy' | 'manual'>(
    'vsmpo',
  );
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saveToDirectory] = useState<boolean>(true);

  // Режим мульти-стоп точек маршрута
  const [isMultiStop, setIsMultiStop] = useState<boolean>(
    Boolean(
      (initialOrder?.routes_json && initialOrder.routes_json.length > 1) ||
      (initialOrder?.raw_parser_payload?.routes &&
        initialOrder.raw_parser_payload.routes.length > 1),
    ),
  );

  // Список точек маршрута (до 6 точек для путевого листа)
  const [routes, setRoutes] = useState<RouteStop[]>(() => {
    const existing = initialOrder?.routes_json || initialOrder?.raw_parser_payload?.routes;
    if (existing && Array.isArray(existing) && existing.length > 0) {
      return existing.map((r: any, idx: number) => ({
        id: String(idx + 1),
        loading_city: r.loading_city || r.loadingCity || 'Шайтанка',
        loading_address: r.loading_address || r.loadingAddress || 'Шайтанка',
        loading_org: r.loading_org || r.clientName || '',
        unloading_city: r.unloading_city || r.unloadingCity || 'Маминское',
        unloading_address: r.unloading_address || r.unloadingAddress || 'Маминское',
        unloading_org: r.unloading_org || '',
        cargo_name: r.cargo_name || r.cargoName || 'Пробы',
        weight_kg: r.weight_kg
          ? Number(r.weight_kg)
          : r.weightTons
            ? Math.round(Number(r.weightTons) * 1000)
            : 4000,
      }));
    }
    return [
      {
        id: '1',
        loading_city: initialOrder?.loading_address_json?.city || 'Шайтанка',
        loading_address: initialOrder?.loading_address_json?.raw || 'Шайтанка',
        loading_org: initialOrder?.loading_org_name || 'ООО "Геостройиндустрия" (ЛОП)',
        unloading_city: initialOrder?.unloading_address_json?.city || 'Маминское',
        unloading_address: initialOrder?.unloading_address_json?.raw || 'Маминское',
        unloading_org: initialOrder?.client?.name || 'ООО "Геостройиндустрия"',
        cargo_name: initialOrder?.cargo_name || 'Пробы',
        weight_kg: initialOrder?.weight_gross_kg || 4000,
      },
    ];
  });

  // Флаг составного рейса через Верхнюю Салду
  const [preventSaldaAutoFinish, setPreventSaldaAutoFinish] = useState<boolean>(
    Boolean(
      initialOrder?.prevent_salda_auto_finish ||
      initialOrder?.raw_parser_payload?.prevent_salda_auto_finish,
    ),
  );

  // Форма заявки
  const [form, setForm] = useState<any>(() => {
    if (initialOrder) {
      return {
        base_doc_number: initialOrder.base_doc_number || String(initialOrder.order_number),
        base_doc_date: initialOrder.base_doc_date || initialOrder.created_at?.slice(0, 10),
        client_id: initialOrder.client?.id || '',
        client_name: initialOrder.client?.name || 'ООО "Геостройиндустрия"',
        client_inn: initialOrder.client?.inn || '6623101234',
        forwarder_id: initialOrder.forwarder?.id || '',
        forwarder_name: initialOrder.forwarder?.name || '— (Прямой заказчик)',
        preset_id: '',
        loading_point_id: '',

        loading_address: initialOrder.loading_address_json?.raw || 'Шайтанка',
        loading_city: initialOrder.loading_address_json?.city || 'Шайтанка',
        loading_org_name: initialOrder.loading_org_name || 'ООО "Геостройиндустрия" (ЛОП)',

        unloading_address: initialOrder.unloading_address_json?.raw || 'Маминское',
        unloading_city: initialOrder.unloading_address_json?.city || 'Маминское',

        cargo_name: initialOrder.cargo_name || 'Пробы',
        weight_gross_kg: initialOrder.weight_gross_kg || 4000,
        places_count: initialOrder.places_count || 1,
        packaging_type: 'палетты',
        price_without_vat: initialOrder.price_without_vat || 60000,

        payment_method: initialOrder.payment_terms?.includes('Наличные') ? 'cash' : 'bank_invoice',
        payment_terms:
          initialOrder.payment_terms ||
          'Безналичный расчет (Дебиторская задолженность, отсрочка 15 дней)',

        planned_loading_at:
          initialOrder.planned_loading_at?.slice(0, 16) ||
          new Date().toISOString().slice(0, 10) + 'T08:00',
        planned_delivery_at:
          initialOrder.planned_delivery_at?.slice(0, 16) ||
          new Date().toISOString().slice(0, 10) + 'T18:00',

        assigned_vehicle_id: initialOrder.assigned_vehicle_id || vehicles[0]?.id || '',
        assigned_driver_id: initialOrder.assigned_driver_id || drivers[0]?.id || '',
      };
    }

    // По умолчанию для новой заявки (по скриншоту пользователя: Геостройиндустрия, Шайтанка -> Маминское)
    const valdaiCar = vehicles.find((v: any) => v.reg_number?.includes('188')) || vehicles[0];
    const nasrtdinov = drivers.find((d: any) => d.name?.includes('Насртдинов')) || drivers[0];
    const today = new Date().toISOString().slice(0, 10);

    return {
      base_doc_number: '',
      base_doc_date: today,
      client_id: '',
      client_name: 'ООО "Геостройиндустрия"',
      client_inn: '6623101234',
      forwarder_id: '',
      forwarder_name: '— (Прямой заказчик)',
      preset_id: '',
      loading_point_id: '',

      loading_address: 'Шайтанка',
      loading_city: 'Шайтанка',
      loading_org_name: 'ООО "Геостройиндустрия" (ЛОП)',

      unloading_address: 'Маминское',
      unloading_city: 'Маминское',

      cargo_name: 'Пробы',
      weight_gross_kg: 4000,
      places_count: 1,
      packaging_type: 'палетты',
      price_without_vat: 60000,

      payment_method: 'bank_invoice',
      payment_terms: 'Безналичный расчет (Дебиторская задолженность)',

      planned_loading_at: `${today}T08:00`,
      planned_delivery_at: `${today}T18:00`,

      assigned_vehicle_id: valdaiCar?.id || '',
      assigned_driver_id: nasrtdinov?.id || '',
    };
  });

  // Загружаем следующий порядковый номер рейса
  const [nextTripNumber, setNextTripNumber] = useState<number | null>(null);

  useEffect(() => {
    if (!isEditing) {
      fetch('/api/orders/next-number')
        .then((r) => r.json())
        .then((data) => {
          if (data?.nextNumber) {
            setNextTripNumber(data.nextNumber);
            setForm((prev: any) => {
              if (!prev.base_doc_number || prev.base_doc_number === '1') {
                return { ...prev, base_doc_number: String(data.nextNumber) };
              }
              return prev;
            });
          }
        })
        .catch((err) => console.warn('Ошибка загрузки следующего номера рейса:', err));
    }
  }, [isEditing]);

  // Быстрое переключение пресетов
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
        loading_org_name: 'ООО "Континенталь"',
        loading_address: '624250, Свердловская область, г. Заречный, ул. Промзона БЗСК, д 2',
        loading_city: 'Заречный',
        unloading_address: '624760, Свердловская область, г. Верхняя Салда, ул. Парковая, д 1',
        unloading_city: 'Верхняя Салда',
        cargo_name: 'Пруток 20мм, труба нерж.сталь',
        weight_gross_kg: 110,
        price_without_vat: 15000,
        payment_method: 'bank_invoice',
        payment_terms: 'Безналичный расчет (Дебиторская задолженность, отсрочка 15 дней)',
      }));
      setStatusMessage('⭐ Предзаполнена схема ВСМПО-АВИСМА через экспедитора ИП Парфенов А.В.');
    } else if (type === 'geostroy') {
      const geoCp = counterparties.find((c: any) => c.name?.includes('Геострой'));
      setForm((prev: any) => ({
        ...prev,
        client_id: geoCp?.id || '',
        client_name: 'ООО "Геостройиндустрия"',
        client_inn: '6623101234',
        forwarder_id: '',
        forwarder_name: '— (Прямой заказчик)',
        loading_org_name: 'ООО "Геостройиндустрия" (ЛОП)',
        loading_address: 'Шайтанка',
        loading_city: 'Шайтанка',
        unloading_address: 'Маминское',
        unloading_city: 'Маминское',
        cargo_name: 'Пробы',
        weight_gross_kg: 4000,
        price_without_vat: 60000,
        payment_method: 'bank_invoice',
        payment_terms: 'Безналичный расчет (Дебиторская задолженность)',
      }));
      setStatusMessage('⭐ Предзаполнена схема ООО "Геостройиндустрия": прямой заказчик.');
    } else {
      setForm((prev: any) => ({
        ...prev,
        preset_id: '',
        client_id: '',
        client_name: '',
        client_inn: '',
        forwarder_id: '',
        forwarder_name: '— (Прямой заказчик)',
        loading_org_name: '',
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
      setStatusMessage('📝 Ручной ввод по карточке предприятия.');
    }
  };

  // Добавление точки в маршрут
  const handleAddRouteStop = () => {
    if (routes.length >= 6) {
      alert('Максимальное количество сегментов маршрута для Путевого листа — 6');
      return;
    }
    const newStop: RouteStop = {
      id: String(Date.now()),
      loading_city: 'Верхняя Салда',
      loading_address: 'г. Верхняя Салда, база',
      loading_org: form.client_name || 'ООО "Геостройиндустрия"',
      unloading_city: 'Маминское',
      unloading_address: 'с. Маминское, склад 2',
      unloading_org: form.client_name || 'ООО "Геостройиндустрия"',
      cargo_name: form.cargo_name || 'Пробы',
      weight_kg: 2000,
    };
    setRoutes([...routes, newStop]);
    setIsMultiStop(true);
  };

  // Удаление точки маршрута
  const handleRemoveRouteStop = (idx: number) => {
    if (routes.length <= 1) return;
    const updated = routes.filter((_, i) => i !== idx);
    setRoutes(updated);
    if (updated.length <= 1) {
      setIsMultiStop(false);
    }
  };

  // Обновление точки маршрута
  const handleUpdateRouteStop = (idx: number, patch: Partial<RouteStop>) => {
    const updated = [...routes];
    const current = updated[idx];
    if (current) {
      updated[idx] = { ...current, ...patch } as RouteStop;
      setRoutes(updated);
    }
  };

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
        price_without_vat: p.price_without_vat || prev.price_without_vat,
        loading_city: p.loading_address?.city || prev.loading_city,
        loading_address: p.loading_address?.raw || prev.loading_address,
        unloading_city: p.unloading_address?.city || prev.unloading_city,
        unloading_address: p.unloading_address?.raw || prev.unloading_address,
        client_id: p.matched_client_id || prev.client_id,
        client_name: p.client_name || prev.client_name,
        forwarder_id: p.matched_forwarder_id || prev.forwarder_id,
        forwarder_name: p.forwarder_name || prev.forwarder_name,
        loading_org_name: p.loading_org_name || prev.loading_org_name,
        planned_loading_at: p.planned_loading_from?.slice(0, 16) || prev.planned_loading_at,
        planned_delivery_at: p.planned_delivery_from?.slice(0, 16) || prev.planned_delivery_at,
      }));

      // Обновляем первый сегмент маршрута
      setRoutes((prevRoutes) => {
        if (prevRoutes.length <= 1) {
          return [
            {
              id: prevRoutes[0]?.id || 'stop-1',
              loading_city: p.loading_address?.city || prevRoutes[0]?.loading_city || '',
              loading_address: p.loading_address?.raw || prevRoutes[0]?.loading_address || '',
              loading_org: p.loading_org_name || prevRoutes[0]?.loading_org || '',
              unloading_city: p.unloading_address?.city || prevRoutes[0]?.unloading_city || '',
              unloading_address: p.unloading_address?.raw || prevRoutes[0]?.unloading_address || '',
              unloading_org: p.client_name || prevRoutes[0]?.unloading_org || '',
              cargo_name: p.cargo_name || prevRoutes[0]?.cargo_name || '',
              weight_kg: p.weight_gross_kg || prevRoutes[0]?.weight_kg || 0,
            },
          ];
        }
        return prevRoutes;
      });

      const summaryParts = [
        p.order_number ? `Поручение № ${p.order_number}` : '',
        p.cargo_name ? p.cargo_name : '',
        p.weight_gross_kg ? `${p.weight_gross_kg} кг` : '',
        p.price_without_vat ? `${p.price_without_vat.toLocaleString('ru-RU')} ₽` : '',
      ].filter(Boolean);

      setStatusMessage(`✨ PDF распознан: ${summaryParts.join(' · ')}`);
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

      if (!finalClientId && form.client_name && saveToDirectory) {
        const createCpRes = await fetch('/api/counterparties', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.client_name,
            inn: form.client_inn || null,
            legal_address: form.loading_address || null,
            type: 'client',
            is_regular: true,
          }),
        });
        const createdCpJson = await createCpRes.json();
        if (createdCpJson?.counterparty?.id) {
          finalClientId = createdCpJson.counterparty.id;
        }
      }

      // Если включен мульти-стоп, берем адреса первого и последнего сегментов
      const primaryLoadCity = isMultiStop
        ? routes[0]?.loading_city || form.loading_city
        : form.loading_city;
      const primaryLoadAddress = isMultiStop
        ? routes[0]?.loading_address || form.loading_address
        : form.loading_address;
      const primaryUnloadCity = isMultiStop
        ? routes[routes.length - 1]?.unloading_city || form.unloading_city
        : form.unloading_city;
      const primaryUnloadAddress = isMultiStop
        ? routes[routes.length - 1]?.unloading_address || form.unloading_address
        : form.unloading_address;

      // Суммарный вес из всех точек
      const totalWeightKg = isMultiStop
        ? routes.reduce((acc, r) => acc + (Number(r.weight_kg) || 0), 0)
        : Number(form.weight_gross_kg);

      const payload = {
        base_doc_number: form.base_doc_number,
        base_doc_date: form.base_doc_date,
        client_id: finalClientId || null,
        forwarder_id: form.forwarder_id || null,
        preset_id: form.preset_id || null,
        loading_point_id: form.loading_point_id || null,

        cargo_name: form.cargo_name,
        weight_gross_kg: totalWeightKg,
        weight_net_kg: totalWeightKg,
        places_count: Number(form.places_count),
        packaging_type: form.packaging_type,
        price_without_vat: Number(form.price_without_vat),
        payment_terms:
          form.payment_method === 'cash'
            ? 'Оплата наличными водителю (В кассу)'
            : 'Безналичный расчет (Дебиторская задолженность)',

        loading_address_json: { city: primaryLoadCity, raw: primaryLoadAddress },
        unloading_address_json: { city: primaryUnloadCity, raw: primaryUnloadAddress },

        loading_org_name: form.loading_org_name,
        loading_contact_fio: form.loading_contact_fio,

        planned_loading_at: form.planned_loading_at ? `${form.planned_loading_at}:00+05:00` : null,
        planned_delivery_at: form.planned_delivery_at
          ? `${form.planned_delivery_at}:00+05:00`
          : null,

        assigned_vehicle_id: form.assigned_vehicle_id || null,
        assigned_driver_id: form.assigned_driver_id || null,

        // Составной рейс и мульти-стоп точки
        routes_json: isMultiStop ? routes : [],
        prevent_salda_auto_finish: Boolean(preventSaldaAutoFinish),
        salda_transit_count: initialOrder?.salda_transit_count || 0,
      };

      const url = isEditing ? `/api/orders/${initialOrder!.id}` : '/api/orders';
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка сохранения заявки');
      }

      alert(
        isEditing
          ? `✅ Заявка № ${form.base_doc_number} успешно обновлена!`
          : `✅ Заявка № ${form.base_doc_number} успешно создана!`,
      );
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
            <h3 className="font-bold text-sm text-slate-900">
              {isEditing
                ? `Редактирование заявки № ${form.base_doc_number}`
                : 'Новая заявка на перевозку'}
            </h3>
            <p className="text-xs text-slate-400">
              Автозаполнение постоянных клиентов (ВСМПО / Геостройиндустрия) или загрузка PDF
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-base cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Быстрые пресеты клиентов */}
        {!isEditing && (
          <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => selectClientPreset('vsmpo')}
              className={`py-1.5 rounded-lg transition cursor-pointer ${
                selectedClientType === 'vsmpo'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600'
              }`}
            >
              🏢 ВСМПО-АВИСМА (Парфенов)
            </button>
            <button
              type="button"
              onClick={() => selectClientPreset('geostroy')}
              className={`py-1.5 rounded-lg transition cursor-pointer ${
                selectedClientType === 'geostroy'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600'
              }`}
            >
              🏗️ ООО «Геостройиндустрия»
            </button>
            <button
              type="button"
              onClick={() => selectClientPreset('manual')}
              className={`py-1.5 rounded-lg transition cursor-pointer ${
                selectedClientType === 'manual'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600'
              }`}
            >
              ➕ Новый клиент / По карточке
            </button>
          </div>
        )}

        {/* Зона Drag and Drop PDF */}
        {!isEditing && (
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
        )}

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
              <div className="flex items-center justify-between mb-0.5">
                <label className="font-bold text-slate-700">№ Заявки / Рейса</label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const cur = form.base_doc_number || '';
                      const year = new Date().getFullYear();
                      if (!cur.includes(String(year))) {
                        setForm((prev: any) => ({
                          ...prev,
                          base_doc_number: cur
                            ? `${cur.replace(/[\/\\]\d+/, '')}/${year}`
                            : `/${year}`,
                        }));
                      }
                    }}
                    className="text-[10px] text-purple-700 hover:text-purple-900 font-bold cursor-pointer transition hover:underline"
                    title="Формат Электронного поручения (ЭПЭ) для ВСМПО-АВИСМА"
                  >
                    +ЭПЭ \{new Date().getFullYear()}
                  </button>
                  {nextTripNumber && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev: any) => ({
                          ...prev,
                          base_doc_number: String(nextTripNumber),
                        }))
                      }
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer transition hover:underline"
                      title="Привязать номер заявки к следующему рейсу по очереди"
                    >
                      #{nextTripNumber}
                    </button>
                  )}
                </div>
              </div>
              <input
                type="text"
                required
                value={form.base_doc_number}
                onChange={(e) => setForm({ ...form, base_doc_number: e.target.value })}
                placeholder={
                  selectedClientType === 'vsmpo'
                    ? `794/${new Date().getFullYear()}`
                    : nextTripNumber
                      ? String(nextTripNumber)
                      : 'Напр. 987'
                }
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

          {/* Секция 2: Маршрут (Одиночный или Мульти-стоп) */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <span>📍</span>
                <span>Маршрут перевозки</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddRouteStop}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded font-bold text-[10.5px] cursor-pointer transition active:scale-95 flex items-center gap-1"
                >
                  <span>+ Добавить точку маршрута ({routes.length}/6)</span>
                </button>
              </div>
            </div>

            {/* Мульти-стоп карточки точек маршрута */}
            {isMultiStop ? (
              <div className="space-y-2">
                {routes.map((stop, idx) => (
                  <div
                    key={stop.id}
                    className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-2 shadow-2xs relative"
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold text-indigo-900 border-b border-slate-100 pb-1">
                      <span>Точка маршрута #{idx + 1}</span>
                      {routes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRouteStop(idx)}
                          className="text-rose-500 hover:text-rose-700 text-[10.5px] font-bold cursor-pointer"
                        >
                          ✕ Удалить точку
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="font-semibold text-slate-600 block mb-0.5 text-[10px]">
                          📍 Погрузка (Откуда) #{idx + 1}
                        </label>
                        <input
                          type="text"
                          required
                          value={stop.loading_address}
                          onChange={(e) =>
                            handleUpdateRouteStop(idx, {
                              loading_address: e.target.value,
                              loading_city: e.target.value.split(',')[0] || e.target.value,
                            })
                          }
                          className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs font-medium"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-600 block mb-0.5 text-[10px]">
                          🏁 Выгрузка (Куда) #{idx + 1}
                        </label>
                        <input
                          type="text"
                          required
                          value={stop.unloading_address}
                          onChange={(e) =>
                            handleUpdateRouteStop(idx, {
                              unloading_address: e.target.value,
                              unloading_city: e.target.value.split(',')[0] || e.target.value,
                            })
                          }
                          className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10.5px]">
                      <div>
                        <label className="text-slate-500 block mb-0.5">Груз точки:</label>
                        <input
                          type="text"
                          value={stop.cargo_name || ''}
                          onChange={(e) =>
                            handleUpdateRouteStop(idx, { cargo_name: e.target.value })
                          }
                          className="w-full p-1 border border-slate-200 rounded text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 block mb-0.5">Вес точки (кг):</label>
                        <input
                          type="number"
                          value={stop.weight_kg || ''}
                          onChange={(e) =>
                            handleUpdateRouteStop(idx, { weight_kg: Number(e.target.value) })
                          }
                          className="w-full p-1 border border-slate-200 rounded text-xs font-bold"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <label className="text-slate-500 block mb-0.5">Кто грузит (ЛОП):</label>
                        <input
                          type="text"
                          value={stop.loading_org || ''}
                          onChange={(e) =>
                            handleUpdateRouteStop(idx, { loading_org: e.target.value })
                          }
                          className="w-full p-1 border border-slate-200 rounded text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Одиночный рейс */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-0.5">
                    📍 Пункт погрузки (Откуда)
                  </label>
                  <input
                    type="text"
                    required
                    value={form.loading_address}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        loading_address: e.target.value,
                        loading_city: e.target.value.split(',')[0] || e.target.value,
                      })
                    }
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
                    onChange={(e) =>
                      setForm({
                        ...form,
                        unloading_address: e.target.value,
                        unloading_city: e.target.value.split(',')[0] || e.target.value,
                      })
                    }
                    className="w-full p-1.5 border border-slate-300 rounded bg-white"
                  />
                  <div className="mt-1 text-[11px] text-slate-500">
                    <span>
                      Грузополучатель: <b>{form.client_name}</b>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ЧЕКБОКС: СОСТАВНОЙ РЕЙС ЧЕРЕЗ САЛДУ (НЕТ АВТО-ЗАКРЫТИЯ ПО WIALON) */}
            <label className="flex items-start gap-2 p-2 bg-amber-50/90 border border-amber-300 rounded-lg text-amber-950 font-bold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={preventSaldaAutoFinish}
                onChange={(e) => setPreventSaldaAutoFinish(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-indigo-600 rounded cursor-pointer"
              />
              <div className="text-xs">
                <span>
                  🔄 Составной маршрут (1-й заезд в Салду — транзит, снимает галочку; 2-й заезд —
                  завершает)
                </span>
                <span className="block font-normal text-[10.5px] text-amber-800 mt-0.5">
                  При первом заезде в геозону Салды Wialon фиксирует промежуточную отметку и
                  автоматически снимает эту галочку. Второй заезд в Салду штатно завершит рейс и
                  переведет заявку на ревью.
                </span>
              </div>
            </label>
          </div>

          {/* Секция 3: Груз, Ставка и Финансовое закрытие */}
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
              <label className="font-bold text-slate-700 block mb-0.5">
                Масса брутто (кг) {isMultiStop ? '(суммарная)' : ''}
              </label>
              <input
                type="number"
                required
                value={
                  isMultiStop
                    ? routes.reduce((acc, r) => acc + (Number(r.weight_kg) || 0), 0)
                    : form.weight_gross_kg
                }
                onChange={(e) => setForm({ ...form, weight_gross_kg: Number(e.target.value) })}
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

          {/* ФИНАНСОВАЯ ЦЕПОЧКА ЗАКРЫТИЯ */}
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
                className="w-full p-1.5 border border-slate-300 rounded bg-white font-bold"
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
              <div className="flex items-center justify-between mb-0.5">
                <label className="font-bold text-slate-700 block">Водитель</label>
                {onOpenDriverModal && (
                  <button
                    type="button"
                    onClick={() => onOpenDriverModal(form.assigned_driver_id || undefined)}
                    className="text-[10.5px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                  >
                    ⚙️ Справочник / + Новый
                  </button>
                )}
              </div>
              <select
                value={form.assigned_driver_id}
                onChange={(e) => setForm({ ...form, assigned_driver_id: e.target.value })}
                className="w-full p-1.5 border border-slate-300 rounded bg-white font-bold"
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

          {/* Кнопки */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs cursor-pointer transition active:scale-95"
            >
              {isEditing ? 'Сохранить изменения' : 'Создать заявку'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * МОДАЛЬНОЕ ОКНО УПРАВЛЕНИЯ СПРАВОЧНИКОМ ВОДИТЕЛЕЙ
 * ─────────────────────────────────────────────────────────────────────────────
 */
function DriverEditModal({
  drivers,
  initialDriverId,
  onClose,
  onSaved,
}: {
  drivers: any[];
  initialDriverId?: string;
  onClose: () => void;
  onSaved: (driverId: string) => void;
}) {
  const getFormDataForId = (id: string, allDrivers: any[]) => {
    if (id === 'new') {
      return {
        name: '',
        phone: '',
        inn: '',
        tab_number: '',
        passport_series: '',
        passport_number: '',
        passport_issued_by: '',
        passport_issue_date: '',
        passport_department_code: '',
        license_series: '',
        license_number: '',
        license_issue_date: '',
        license_class: 'C',
      };
    }
    const found = allDrivers.find((d) => d.id === id);
    return {
      name: found?.name || '',
      phone: found?.phone || '',
      inn: found?.inn || '',
      tab_number: found?.tab_number || '',
      passport_series: found?.passport_series || '',
      passport_number: found?.passport_number || '',
      passport_issued_by: found?.passport_issued_by || '',
      passport_issue_date: found?.passport_issue_date || '',
      passport_department_code: found?.passport_department_code || '',
      license_series: found?.license_series || '',
      license_number: found?.license_number || '',
      license_issue_date: found?.license_issue_date || '',
      license_class: found?.license_class || 'C',
    };
  };

  const initialId = initialDriverId || (drivers.length > 0 ? drivers[0]?.id : 'new');
  const [selectedId, setSelectedId] = useState<string>(initialId);
  const [formData, setFormData] = useState(() => getFormDataForId(initialId, drivers));
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const isNew = selectedId === 'new';

  const handleSelectDriver = (id: string) => {
    setSelectedId(id);
    setFormData(getFormDataForId(id, drivers));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Укажите ФИО водителя');
      return;
    }
    setIsSaving(true);
    try {
      if (isNew) {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name.trim(),
            phone: formData.phone || null,
            inn: formData.inn || null,
            tab_number: formData.tab_number || null,
            roles: ['driver'],
            passport_series: formData.passport_series || null,
            passport_number: formData.passport_number || null,
            passport_issued_by: formData.passport_issued_by || null,
            passport_issue_date: formData.passport_issue_date || null,
            passport_department_code: formData.passport_department_code || null,
            license_series: formData.license_series || null,
            license_number: formData.license_number || null,
            license_issue_date: formData.license_issue_date || null,
            license_class: formData.license_class || 'C',
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Ошибка создания водителя');
        }
        const created = await res.json();
        alert(`✅ Водитель ${formData.name} успешно добавлен в справочник!`);
        onSaved(created.id);
      } else {
        const res = await fetch(`/api/users/${selectedId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name.trim(),
            phone: formData.phone || null,
            inn: formData.inn || null,
            tab_number: formData.tab_number || null,
            passport_series: formData.passport_series || null,
            passport_number: formData.passport_number || null,
            passport_issued_by: formData.passport_issued_by || null,
            passport_issue_date: formData.passport_issue_date || null,
            passport_department_code: formData.passport_department_code || null,
            license_series: formData.license_series || null,
            license_number: formData.license_number || null,
            license_issue_date: formData.license_issue_date || null,
            license_class: formData.license_class || 'C',
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Ошибка обновления водителя');
        }
        alert(`✅ Данные водителя ${formData.name} сохранены в справочнике!`);
        onSaved(selectedId);
      }
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-5 max-w-2xl w-full shadow-2xl border border-slate-200 space-y-4 my-8">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              Справочник водителей (паспорт, права, контакты)
            </h3>
            <p className="text-xs text-slate-400">
              Данные сохраняются в системе и подставляются в заявки, ТН, путевые листы и
              доверенности
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-base cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Выбор водителя или создание нового */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl text-xs">
          <label className="font-bold text-slate-700 shrink-0">Водитель:</label>
          <select
            value={selectedId}
            onChange={(e) => handleSelectDriver(e.target.value)}
            className="flex-1 p-1 bg-white border border-slate-300 rounded font-bold text-slate-900"
          >
            <option value="new">➕ Добавить нового водителя</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} {d.phone ? `(${d.phone})` : ''}
              </option>
            ))}
          </select>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {/* Блок 1: Основные данные */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div>
              <label className="font-bold text-slate-700 block mb-0.5">ФИО водителя *</label>
              <input
                type="text"
                required
                placeholder="напр. Насртдинов В.А."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-1.5 border border-slate-300 rounded bg-white font-bold"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-0.5">Телефон</label>
              <input
                type="text"
                placeholder="+7 900 000-00-00"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-1.5 border border-slate-300 rounded bg-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="font-bold text-slate-700 block mb-0.5">ИНН (12 знаков)</label>
                <input
                  type="text"
                  maxLength={12}
                  placeholder="6607..."
                  value={formData.inn}
                  onChange={(e) => setFormData({ ...formData, inn: e.target.value })}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-0.5">Табельный №</label>
                <input
                  type="text"
                  placeholder="096"
                  value={formData.tab_number}
                  onChange={(e) => setFormData({ ...formData, tab_number: e.target.value })}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white"
                />
              </div>
            </div>
          </div>

          {/* Блок 2: Паспорт гражданина РФ */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
            <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wide">
              🪪 Паспорт гражданина РФ (для доверенностей и пропусков)
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              <div>
                <label className="font-semibold text-slate-600 block mb-0.5">Серия</label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="6521"
                  value={formData.passport_series}
                  onChange={(e) => setFormData({ ...formData, passport_series: e.target.value })}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-0.5">Номер</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="342609"
                  value={formData.passport_number}
                  onChange={(e) => setFormData({ ...formData, passport_number: e.target.value })}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-0.5">Дата выдачи</label>
                <input
                  type="date"
                  value={formData.passport_issue_date}
                  onChange={(e) =>
                    setFormData({ ...formData, passport_issue_date: e.target.value })
                  }
                  className="w-full p-1.5 border border-slate-300 rounded bg-white"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-0.5">Код подр.</label>
                <input
                  type="text"
                  placeholder="660-001"
                  value={formData.passport_department_code}
                  onChange={(e) =>
                    setFormData({ ...formData, passport_department_code: e.target.value })
                  }
                  className="w-full p-1.5 border border-slate-300 rounded bg-white font-mono"
                />
              </div>
            </div>
            <div>
              <label className="font-semibold text-slate-600 block mb-0.5">Кем выдан</label>
              <input
                type="text"
                placeholder="ГУ МВД России по Свердловской области..."
                value={formData.passport_issued_by}
                onChange={(e) => setFormData({ ...formData, passport_issued_by: e.target.value })}
                className="w-full p-1.5 border border-slate-300 rounded bg-white"
              />
            </div>
          </div>

          {/* Блок 3: Водительское удостоверение */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
            <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wide">
              🚚 Водительское удостоверение (для Путевых листов и ЭТрН)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="font-semibold text-slate-600 block mb-0.5">Серия ВУ</label>
                <input
                  type="text"
                  placeholder="99 31"
                  value={formData.license_series}
                  onChange={(e) => setFormData({ ...formData, license_series: e.target.value })}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-0.5">Номер ВУ</label>
                <input
                  type="text"
                  placeholder="051064"
                  value={formData.license_number}
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-0.5">Категории</label>
                <input
                  type="text"
                  placeholder="C, CE"
                  value={formData.license_class}
                  onChange={(e) => setFormData({ ...formData, license_class: e.target.value })}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-0.5">Дата выдачи ВУ</label>
                <input
                  type="date"
                  value={formData.license_issue_date}
                  onChange={(e) => setFormData({ ...formData, license_issue_date: e.target.value })}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white"
                />
              </div>
            </div>
          </div>

          {/* Кнопки */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs cursor-pointer transition active:scale-95"
            >
              {isSaving ? 'Сохранение...' : 'Сохранить в справочник'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
