/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

const DEFAULT_WORK_DESCRIPTIONS: Record<string, string> = {};

import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef, useMemo } from 'react';
import { cn, Money } from '@saldacargo/ui';
import { isOilOrFilterWork } from '@saldacargo/shared';
import { WarehouseSection } from './warehouse-section';

// ─── Types ───────────────────────────────────────────────────────────────────

type Mechanic = { id: string; name: string; roles?: string[]; mechanic_salary_pct?: string | null };

const SPECIALTY_LABELS: Record<string, string> = {
  welder: 'Сварщик',
  electrician: 'Электрик',
  painter: 'Маляр',
  mechanic_lead: 'Старший механик',
  mechanic: 'Механик',
  handyman: 'Разнорабочий',
  driver: 'Водитель',
  loader: 'Грузчик',
};

function getSpecialtyLabel(roles?: string[] | null) {
  if (!roles || roles.length === 0) return '';
  const priority = [
    'welder',
    'electrician',
    'painter',
    'mechanic_lead',
    'mechanic',
    'handyman',
    'driver',
    'loader',
  ];
  for (const p of priority) {
    if (roles.includes(p) && SPECIALTY_LABELS[p]) return SPECIALTY_LABELS[p];
  }
  return '';
}
type Asset = {
  id: string;
  short_name: string;
  reg_number: string;
  odometer_current?: number | null;
};

type OrderRow = {
  id: string;
  order_number: number;
  status: string;
  priority: string;
  machine_type: 'own' | 'client';
  problem_description: string;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  asset: Asset | null;
  client_vehicle_brand: string | null;
  client_vehicle_reg: string | null;
  client_name: string | null;
  mechanic: Mechanic | null;
  works: Array<{ id: string; status: string }>;
};

type DetailWork = {
  id: string;
  status: string;
  salary_paid: boolean;
  quantity: number;
  norm_minutes: number;
  actual_minutes: number;
  price_client: string | null;
  work_description: string | null;
  custom_work_name: string | null;
  mechanic_id: string | null;
  second_mechanic_id: string | null;
  notes?: string | null;
  work_catalog: { id: string; name: string; norm_minutes: number } | null;
  time_logs: Array<{ id: string; started_at: string; stopped_at: string | null; status: string }>;
};

type MechanicWithPct = Mechanic & { mechanic_salary_pct: string | null };

type OrderDetail = Omit<OrderRow, 'works' | 'mechanic'> & {
  lifecycle_status: string;
  admin_note: string | null;
  mechanic_note: string | null;
  mechanic_pay: string | null;
  second_mechanic_pay: string | null;
  mechanic: MechanicWithPct | null;
  second_mechanic: MechanicWithPct | null;
  client_vehicle_model: string | null;
  client_phone: string | null;
  odometer_start: number | null;
  odometer_end: number | null;
  works: DetailWork[];
  parts: Array<{
    id: string;
    quantity: number;
    custom_part_name: string | null;
    unit: string | null;
    unit_price: string | null;
    client_price: string | null;
    part: { id: string; name: string; unit: string } | null;
  }>;
  transactions?: Array<{
    id: string;
    amount: string;
    description: string;
    category_id: string;
    related_user_id: string | null;
    related_user: { name: string } | null;
  }>;
};

// type DashboardData removed

// interface ReminderItem removed

// type RepairRequest removed

type MaintenanceItem = {
  id: string;
  work_name: string;
  interval_km: number | null;
  interval_months: number | null;
  last_done_km: number | null;
  last_done_at: string | null;
  next_due_km: number | null;
  next_due_at: string | null;
  alert_status: string;
  created_at: string;
  asset: { id: string; short_name: string; reg_number: string; odometer_current: number } | null;
};

// type WorkCatalogItem removed

// type FaultCatalogItem removed

// type MechanicStat removed

// type VehicleHistoryItem removed

type SettingsData = {
  sto: { hourly_rate: string; hourly_rate_own: string };
  mechanics: Array<{ id: string; name: string; mechanic_salary_pct: string }>;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  in_progress: 'В работе',
  completed: 'Завершён',
  cancelled: 'Отменён',
};
const STATUS_COLOR: Record<string, string> = {
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-500',
};
const PRIORITY_LABEL: Record<string, string> = {
  low: 'Низкий',
  normal: 'Обычный',
  urgent: 'Срочно',
};
const PRIORITY_COLOR: Record<string, string> = {
  low: 'bg-slate-100 text-slate-500',
  normal: 'bg-blue-50 text-blue-600',
  urgent: 'bg-red-100 text-red-600',
};
const ALERT_LABEL: Record<string, string> = {
  overdue: 'СРОЧНО',
  soon: 'СКОРО',
  ok: 'В норме',
  active_order: 'Наряд открыт',
};
const ALERT_COLOR: Record<string, string> = {
  overdue: 'bg-red-100 text-red-700',
  soon: 'bg-amber-100 text-amber-700',
  ok: 'bg-emerald-100 text-emerald-700',
  active_order: 'bg-slate-100 text-slate-600',
};

const emptyForm = {
  machine_type: 'own' as 'own' | 'client',
  service_type: 'internal' as 'internal' | 'external',
  asset_id: '',
  client_vehicle_brand: '',
  client_vehicle_model: '',
  client_vehicle_reg: '',
  client_name: '',
  client_phone: '',
  problem_description: '',
  assigned_mechanic_id: '',
  odometer_start: '',
  priority: 'normal',
  admin_note: '',

  // External repair fields
  contractor_name: '',
  external_doc_number: '',
  order_date: new Date().toISOString().slice(0, 10),
  works_cost: '',
  parts_cost: '',
  is_completed: true,
  payment_wallet_id: '10000000-0000-0000-0000-000000000002',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(s: string | null | undefined) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}
function moneyVal(s: string | null | undefined): number {
  return parseFloat(s ?? '0');
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
// todayLabel removed

// ─── SVG Icons ───────────────────────────────────────────────────────────────

// Icons removed

// ═══════════════════════════ MODALS (unchanged) ═══════════════════════════════

function OrderDetailModal({
  orderId,
  onClose,
  mechanics,
}: {
  orderId: string;
  onClose: () => void;
  mechanics: Mechanic[];
}) {
  const queryClient = useQueryClient();
  const backdropMouseDownOnSelf = useRef(false);
  const [editNote, setEditNote] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [editPriority, setEditPriority] = useState<string | null>(null);
  const [editOdometerStart, setEditOdometerStart] = useState<string | null>(null);
  const [editOdometerEnd, setEditOdometerEnd] = useState<string | null>(null);
  const [editStartedAt, setEditStartedAt] = useState<string | null>(null);
  const [editCompletedAt, setEditCompletedAt] = useState<string | null>(null);
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  const [showAddWork, setShowAddWork] = useState(false);
  const [workSearch, setWorkSearch] = useState('');
  const [workCatFilter, setWorkCatFilter] = useState<string | null>(null);
  const [confirmDeleteWorkId, setConfirmDeleteWorkId] = useState<string | null>(null);
  const [addWorkError, setAddWorkError] = useState<string | null>(null);
  const [addWorkQty, setAddWorkQty] = useState(1);
  const [isCustomWork, setIsCustomWork] = useState(false);
  const [customWorkName, setCustomWorkName] = useState('');
  const [customWorkPrice, setCustomWorkPrice] = useState('');
  const [editingWorkId, setEditingWorkId] = useState<string | null>(null);
  const [editWorkDesc, setEditWorkDesc] = useState('');
  const [editWorkQty, setEditWorkQty] = useState(1);
  const [editWorkPrice, setEditWorkPrice] = useState('');
  const [editWorkMechanic, setEditWorkMechanic] = useState<string | null>(null);
  const [editWorkSecondMechanic, setEditWorkSecondMechanic] = useState<string | null>(null);
  const [editWorkCustomPct, setEditWorkCustomPct] = useState<string>('');
  const [partPricesDraft, setPartPricesDraft] = useState<Record<string, string>>({});
  const [partUnitPricesDraft, setPartUnitPricesDraft] = useState<Record<string, string>>({});
  const [showAddPart, setShowAddPart] = useState(false);
  const [addPartName, setAddPartName] = useState('');
  const [addPartQty, setAddPartQty] = useState(1);
  const [addPartCost, setAddPartCost] = useState('');
  const [addPartPrice, setAddPartPrice] = useState('');
  const [addPartError, setAddPartError] = useState<string | null>(null);

  const { data: order, isLoading } = useQuery<OrderDetail>({
    queryKey: ['garage-order', orderId],
    queryFn: async () => {
      const r = await fetch(`/api/garage/orders/${orderId}`);
      if (!r.ok) throw new Error('Ошибка');
      return r.json();
    },
    staleTime: 30000,
  });

  const patchMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch(`/api/garage/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? 'Ошибка при сохранении наряда');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['garage-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['garage-orders'] });
      queryClient.invalidateQueries({ queryKey: ['garage-dashboard'] });
      setShowCloseDialog(false);
      setEditNote(null);
      setEditStatus(null);
      setEditPriority(null);
      setEditOdometerStart(null);
      setEditOdometerEnd(null);
      setEditStartedAt(null);
      setEditCompletedAt(null);
      onClose();
    },
    onError: (err: Error) => {
      alert(`Ошибка: ${err.message}`);
    },
  });

  const [closePays, setClosePays] = useState<Record<string, string>>({});
  const [closeRecommendation, setCloseRecommendation] = useState<string>('');
  const [closeDueKm, setCloseDueKm] = useState<string>('');
  const [closeDueDate, setCloseDueDate] = useState<string>('');
  const [closeCompletedAt, setCloseCompletedAt] = useState<string>('');
  const [closeOdometerStart, setCloseOdometerStart] = useState<string>('');
  const [closeOdometerEnd, setCloseOdometerEnd] = useState<string>('');

  useEffect(() => {
    if (!showCloseDialog || !order) return;
    setCloseRecommendation(order.mechanic_note || '');
    setCloseDueKm('');
    setCloseDueDate('');
    setCloseCompletedAt(
      order.completed_at ? order.completed_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
    );
    setCloseOdometerStart(order.odometer_start != null ? String(order.odometer_start) : '');
    setCloseOdometerEnd(
      order.odometer_end != null
        ? String(order.odometer_end)
        : order.odometer_start != null
          ? String(order.odometer_start)
          : '',
    );
    const defaults: Record<string, number> = {};
    order.works.forEach((w) => {
      if (w.status === 'cancelled' || w.salary_paid) return;
      const mechs = [w.mechanic_id, w.second_mechanic_id].filter((x): x is string => !!x);
      if (mechs.length === 0) return;
      const workPrice = parseFloat(w.price_client ?? '0');
      if (workPrice <= 0) return;
      const basePrice = mechs.length === 2 ? workPrice / 2 : workPrice;
      for (const mechId of mechs) {
        const mech = mechanics.find((m) => m.id === mechId);
        const pct = mech ? parseFloat((mech as MechanicWithPct).mechanic_salary_pct ?? '50') : 50;
        defaults[mechId] = (defaults[mechId] || 0) + (basePrice * pct) / 100;
      }
    });
    const formatted: Record<string, string> = {};
    for (const [id, val] of Object.entries(defaults)) {
      formatted[id] = Math.round(val).toString();
    }
    setClosePays(formatted);
  }, [showCloseDialog, order, mechanics]);

  const isClosed = order?.lifecycle_status === 'approved';

  const { data: workCatalog = [] } = useQuery<
    Array<{
      id: string;
      name: string;
      category: string | null;
      norm_minutes: number;
      norm_minutes_valdai: number | null;
      default_price_client: string | null;
    }>
  >({
    queryKey: ['garage-work-catalog'],
    queryFn: () => fetch('/api/garage/work-catalog').then((r) => r.json()),
    staleTime: 300000,
    enabled: showAddWork,
  });

  const addWorkMutation = useMutation({
    mutationFn: ({
      work_catalog_id,
      custom_work_name,
      price_client,
      quantity,
    }: {
      work_catalog_id?: string;
      custom_work_name?: string;
      price_client?: string;
      quantity: number;
    }) =>
      fetch(`/api/garage/orders/${orderId}/works`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_catalog_id, custom_work_name, price_client, quantity }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Ошибка');
        return d;
      }),
    onSuccess: () => {
      setAddWorkError(null);
      setWorkSearch('');
      setAddWorkQty(1);
      setIsCustomWork(false);
      setCustomWorkName('');
      setCustomWorkPrice('');
      setShowAddWork(false);
      queryClient.invalidateQueries({ queryKey: ['garage-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['garage-orders'] });
      queryClient.invalidateQueries({ queryKey: ['garage-dashboard'] });
    },
    onError: (err: Error) => {
      setAddWorkError(err.message);
    },
  });

  const deleteWorkMutation = useMutation({
    mutationFn: (workId: string) =>
      fetch(`/api/garage/orders/${orderId}/works/${workId}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) throw new Error('Ошибка');
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['garage-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['garage-orders'] });
      queryClient.invalidateQueries({ queryKey: ['garage-dashboard'] });
    },
  });

  const patchWorkMutation = useMutation({
    mutationFn: ({
      workId,
      body,
    }: {
      workId: string;
      body: {
        actual_minutes?: number;
        price_client?: string;
        status?: string;
        work_description?: string | null;
        quantity?: number;
        mechanic_id?: string | null;
        second_mechanic_id?: string | null;
        custom_salary_pct?: number | null;
      };
    }) =>
      fetch(`/api/garage/orders/${orderId}/works/${workId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Ошибка');
        return d;
      }),
    onSuccess: () => {
      setEditingWorkId(null);
      queryClient.invalidateQueries({ queryKey: ['garage-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['garage-orders'] });
      queryClient.invalidateQueries({ queryKey: ['garage-dashboard'] });
    },
  });

  const patchPartMutation = useMutation({
    mutationFn: ({
      partId,
      client_price,
      unit_price,
    }: {
      partId: string;
      client_price?: string;
      unit_price?: string;
    }) =>
      fetch(`/api/garage/orders/${orderId}/parts/${partId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_price, unit_price }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Ошибка');
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['garage-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['garage-orders'] });
      queryClient.invalidateQueries({ queryKey: ['garage-dashboard'] });
    },
  });

  const addPartMutation = useMutation({
    mutationFn: (body: {
      custom_part_name: string;
      quantity: number;
      unit_price?: string;
      client_price?: string;
    }) =>
      fetch(`/api/garage/orders/${orderId}/parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Ошибка');
        return d;
      }),
    onSuccess: () => {
      setAddPartError(null);
      setAddPartName('');
      setAddPartQty(1);
      setAddPartCost('');
      setAddPartPrice('');
      setShowAddPart(false);
      queryClient.invalidateQueries({ queryKey: ['garage-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['garage-orders'] });
      queryClient.invalidateQueries({ queryKey: ['garage-dashboard'] });
    },
    onError: (err: Error) => setAddPartError(err.message),
  });

  const deletePartMutation = useMutation({
    mutationFn: (partId: string) =>
      fetch(`/api/garage/orders/${orderId}/parts/${partId}`, { method: 'DELETE' }).then(
        async (r) => {
          if (!r.ok) throw new Error('Ошибка');
          return r.json();
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['garage-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['garage-orders'] });
      queryClient.invalidateQueries({ queryKey: ['garage-dashboard'] });
    },
  });

  // Sync part price drafts when order loads (only reset on order switch)
  useEffect(() => {
    if (!order) return;
    const draft: Record<string, string> = {};
    order.parts.forEach((p) => {
      const val = parseFloat(p.client_price ?? '0');
      draft[p.id] = val > 0 ? String(Math.round(val)) : '';
    });
    setPartPricesDraft(draft);
  }, [order?.id]);

  const filteredCatalog = workSearch.trim()
    ? workCatalog.filter((w) => w.name.toLowerCase().includes(workSearch.toLowerCase().trim()))
    : workCatFilter
      ? workCatalog.filter((w) => (w.category ?? 'Прочее') === workCatFilter)
      : workCatalog;

  const catalogCategories = [...new Set(workCatalog.map((w) => w.category ?? 'Прочее'))].sort();

  const totalNormMin =
    order?.works
      .filter((w) => w.status !== 'cancelled')
      .reduce((s, w) => s + w.norm_minutes * (w.quantity ?? 1), 0) ?? 0;
  const allWorksCompleted =
    (order?.works.length ?? 0) > 0 && (order?.works ?? []).every((w) => w.status === 'completed');

  const hourlyRate = order?.machine_type === 'own' ? 1600 : 2000;
  const dynamicTotal = (order?.works ?? [])
    .filter((w) => w.status !== 'cancelled')
    .reduce((sum, w) => {
      if (editingWorkId === w.id && editWorkPrice !== '') {
        return sum + parseFloat(editWorkPrice || '0');
      }
      return sum + parseFloat(w.price_client ?? '0');
    }, 0);

  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteOrderMutation = useMutation({
    mutationFn: (password: string) =>
      fetch(`/api/garage/orders/${orderId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Ошибка');
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['garage-orders'] });
      onClose();
    },
    onError: (err: Error) => setDeleteError(err.message),
  });

  const [showApprovalPrompt, setShowApprovalPrompt] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');
  const [approvalSentMsg, setApprovalSentMsg] = useState<string | null>(null);

  const prevApprovalMatch = order?.admin_note?.match(
    /\[Отправлено на согласование Александру в MAX: ([^\]]+)\]/,
  );

  const sendApprovalMutation = useMutation({
    mutationFn: async (comment?: string) => {
      const res = await fetch(`/api/garage/orders/${orderId}/send-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка отправки в MAX');
      return data;
    },
    onSuccess: () => {
      setApprovalSentMsg(
        `Отправлено в MAX (${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })})`,
      );
      setShowApprovalPrompt(false);
      setApprovalComment('');
      queryClient.invalidateQueries({ queryKey: ['garage-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['garage-orders'] });
    },
  });

  function printAgreement() {
    if (!order) return;
    window.open(
      `/api/garage/orders/${orderId}/print?doc=agreement`,
      '_blank',
      'width=900,height=1000',
    );
  }

  function printWorks() {
    if (!order) return;
    window.open(`/api/garage/orders/${orderId}/print?doc=works`, '_blank', 'width=900,height=1000');
  }

  function printParts() {
    if (!order) return;
    window.open(`/api/garage/orders/${orderId}/print?doc=parts`, '_blank', 'width=900,height=1000');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        backdropMouseDownOnSelf.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (backdropMouseDownOnSelf.current && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Наряд #{order?.order_number ?? '...'}
            </h2>
            {order && <p className="text-xs text-slate-400">{fmtDate(order.created_at)}</p>}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {isClosed && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">
                Закрыт
              </span>
            )}
            {order && (
              <>
                <button
                  onClick={printAgreement}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 flex items-center gap-1 shrink-0"
                  title="Предварительный заказ-наряд на согласование (до выполнения, без описания)"
                >
                  📄 1. На согласование
                </button>
                <button
                  onClick={printWorks}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 flex items-center gap-1 shrink-0"
                  title="Окончательный Акт выполненных работ (после выполнения, с полным описанием)"
                >
                  🖨 2. Акт работ
                </button>
                <button
                  onClick={printParts}
                  className="text-xs font-medium px-2 py-1.5 rounded-lg border border-violet-200 text-violet-600 hover:bg-violet-50 flex items-center gap-1 shrink-0"
                  title="Перечень запчастей (внутренний документ)"
                >
                  📦 Запчасти
                </button>
                <button
                  onClick={() => setShowApprovalPrompt(true)}
                  disabled={sendApprovalMutation.isPending}
                  className={cn(
                    'text-xs font-bold px-2.5 py-1.5 rounded-lg border flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-xs',
                    approvalSentMsg || prevApprovalMatch
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                      : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-700 text-white',
                  )}
                  title="Отправить список работ на согласование Александру Нигамедьянову в MAX"
                >
                  <span>
                    {sendApprovalMutation.isPending
                      ? '⏳'
                      : approvalSentMsg || prevApprovalMatch
                        ? '✓'
                        : '💬'}
                  </span>
                  <span>
                    {sendApprovalMutation.isPending
                      ? 'Отправка...'
                      : approvalSentMsg
                        ? 'Согласование отправлено'
                        : prevApprovalMatch
                          ? 'Согласование отправлено'
                          : 'Согласовать (MAX)'}
                  </span>
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 text-2xl leading-none ml-2"
            >
              ×
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading && <div className="p-6 text-sm text-slate-400 animate-pulse">Загрузка...</div>}
          {order && (
            <div className="p-6 space-y-6">
              <div className="flex flex-wrap gap-2 items-center">
                <span
                  className={cn(
                    'text-xs font-semibold px-3 py-1 rounded-full',
                    STATUS_COLOR[order.status],
                  )}
                >
                  {STATUS_LABEL[order.status] ?? order.status}
                </span>
                <span
                  className={cn(
                    'text-xs font-semibold px-3 py-1 rounded-full',
                    PRIORITY_COLOR[order.priority],
                  )}
                >
                  {PRIORITY_LABEL[order.priority] ?? order.priority}
                </span>
                <span className="text-sm font-bold text-slate-700">
                  {order.machine_type === 'own'
                    ? `${order.asset?.short_name} · ${order.asset?.reg_number}`
                    : `${order.client_vehicle_brand ?? ''} ${order.client_vehicle_model ?? ''} · ${order.client_vehicle_reg ?? ''}`}
                </span>
              </div>
              {order.machine_type === 'client' && (order.client_name || order.client_phone) && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">Клиент</p>
                  {order.client_name && (
                    <p className="text-sm font-medium text-slate-800">{order.client_name}</p>
                  )}
                  {order.client_phone && (
                    <p className="text-sm text-slate-500">{order.client_phone}</p>
                  )}
                </div>
              )}
              <div>
                <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">Описание</p>
                <p className="text-sm text-slate-800">{order.problem_description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">Статус</p>
                  <select
                    value={editStatus ?? order.status}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  >
                    {Object.entries(STATUS_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  {editStatus && editStatus !== order.status && (
                    <button
                      onClick={() => patchMutation.mutate({ status: editStatus })}
                      disabled={patchMutation.isPending}
                      className="mt-1 text-xs text-blue-600 font-semibold hover:underline"
                    >
                      Сохранить
                    </button>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">Приоритет</p>
                  <select
                    value={editPriority ?? order.priority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  >
                    {Object.entries(PRIORITY_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  {editPriority && editPriority !== order.priority && (
                    <button
                      onClick={() => patchMutation.mutate({ priority: editPriority })}
                      disabled={patchMutation.isPending}
                      className="mt-1 text-xs text-blue-600 font-semibold hover:underline"
                    >
                      Сохранить
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">
                    Одометр заезда (км)
                  </p>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={
                        editOdometerStart ??
                        (order.odometer_start != null ? String(order.odometer_start) : '')
                      }
                      onChange={(e) => setEditOdometerStart(e.target.value)}
                      placeholder="Заезд км..."
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
                    />
                    {editOdometerStart !== null &&
                      editOdometerStart !==
                        (order.odometer_start != null ? String(order.odometer_start) : '') && (
                        <button
                          onClick={() => {
                            patchMutation.mutate({
                              odometer_start: editOdometerStart ? Number(editOdometerStart) : null,
                            });
                            setEditOdometerStart(null);
                          }}
                          disabled={patchMutation.isPending}
                          className="text-xs bg-blue-600 text-white font-semibold px-2 py-1.5 rounded-lg shrink-0 hover:bg-blue-700"
                        >
                          ✓
                        </button>
                      )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">
                    Одометр выезда (км)
                  </p>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={
                        editOdometerEnd ??
                        (order.odometer_end != null ? String(order.odometer_end) : '')
                      }
                      onChange={(e) => setEditOdometerEnd(e.target.value)}
                      placeholder="Выезд км..."
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
                    />
                    {editOdometerEnd !== null &&
                      editOdometerEnd !==
                        (order.odometer_end != null ? String(order.odometer_end) : '') && (
                        <button
                          onClick={() => {
                            patchMutation.mutate({
                              odometer_end: editOdometerEnd ? Number(editOdometerEnd) : null,
                            });
                            setEditOdometerEnd(null);
                          }}
                          disabled={patchMutation.isPending}
                          className="text-xs bg-blue-600 text-white font-semibold px-2 py-1.5 rounded-lg shrink-0 hover:bg-blue-700"
                        >
                          ✓
                        </button>
                      )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">
                    Дата начала наряда
                  </p>
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      value={
                        editStartedAt ??
                        (order.started_at
                          ? order.started_at.slice(0, 10)
                          : order.created_at
                            ? order.created_at.slice(0, 10)
                            : '')
                      }
                      onChange={(e) => setEditStartedAt(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
                    />
                    {editStartedAt !== null &&
                      editStartedAt !==
                        (order.started_at
                          ? order.started_at.slice(0, 10)
                          : order.created_at
                            ? order.created_at.slice(0, 10)
                            : '') && (
                        <button
                          onClick={() => {
                            patchMutation.mutate({
                              started_at: editStartedAt ? `${editStartedAt}T08:00:00.000Z` : null,
                            });
                            setEditStartedAt(null);
                          }}
                          disabled={patchMutation.isPending}
                          className="text-xs bg-blue-600 text-white font-semibold px-2 py-1.5 rounded-lg shrink-0 hover:bg-blue-700"
                          title="Сохранить дату начала"
                        >
                          ✓
                        </button>
                      )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">
                    Дата окончания наряда
                  </p>
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      value={
                        editCompletedAt ??
                        (order.completed_at ? order.completed_at.slice(0, 10) : '')
                      }
                      onChange={(e) => setEditCompletedAt(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
                    />
                    {editCompletedAt !== null &&
                      editCompletedAt !==
                        (order.completed_at ? order.completed_at.slice(0, 10) : '') && (
                        <button
                          onClick={() => {
                            patchMutation.mutate({
                              completed_at: editCompletedAt
                                ? `${editCompletedAt}T17:00:00.000Z`
                                : null,
                            });
                            setEditCompletedAt(null);
                          }}
                          disabled={patchMutation.isPending}
                          className="text-xs bg-blue-600 text-white font-semibold px-2 py-1.5 rounded-lg shrink-0 hover:bg-blue-700"
                          title="Сохранить дату окончания"
                        >
                          ✓
                        </button>
                      )}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-500 font-semibold uppercase">
                      Работы ({order.works.length})
                    </p>
                    {(approvalSentMsg || prevApprovalMatch) && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {approvalSentMsg || `Согласование в MAX (${prevApprovalMatch![1]})`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {order.works.length > 0 && (
                      <button
                        onClick={() => setShowApprovalPrompt(true)}
                        disabled={sendApprovalMutation.isPending}
                        className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1 transition-colors cursor-pointer"
                        title="Отправить список работ руководителю в MAX"
                      >
                        💬 Согласовать в MAX
                      </button>
                    )}
                    <button
                      onClick={() => setShowAddWork((v) => !v)}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors"
                    >
                      {showAddWork ? '✕ Закрыть' : '+ Добавить'}
                    </button>
                  </div>
                </div>

                {showAddWork && (
                  <div className="mb-3 border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex gap-2 items-center flex-wrap">
                      {!isCustomWork ? (
                        <>
                          <input
                            autoFocus
                            type="text"
                            value={workSearch}
                            onChange={(e) => {
                              setWorkSearch(e.target.value);
                              setAddWorkError(null);
                            }}
                            placeholder="Поиск по названию..."
                            className="flex-1 text-sm bg-transparent outline-none placeholder-slate-400 min-w-[150px]"
                          />
                          <button
                            type="button"
                            onClick={() => setIsCustomWork(true)}
                            className="text-xs font-semibold text-blue-600 hover:underline shrink-0"
                          >
                            Ввести вручную
                          </button>
                        </>
                      ) : (
                        <>
                          <input
                            autoFocus
                            type="text"
                            value={customWorkName}
                            onChange={(e) => {
                              setCustomWorkName(e.target.value);
                              setAddWorkError(null);
                            }}
                            placeholder="Название работы..."
                            className="flex-1 text-sm bg-white border border-slate-200 rounded px-2 py-1 outline-none min-w-[150px]"
                          />
                          <input
                            type="number"
                            value={customWorkPrice}
                            onChange={(e) => {
                              setCustomWorkPrice(e.target.value);
                              setAddWorkError(null);
                            }}
                            placeholder="Цена (₽)"
                            className="w-20 text-sm bg-white border border-slate-200 rounded px-2 py-1 outline-none shrink-0"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!customWorkName.trim()) {
                                setAddWorkError('Введите название работы');
                                return;
                              }
                              addWorkMutation.mutate({
                                custom_work_name: customWorkName,
                                price_client: customWorkPrice || undefined,
                                quantity: addWorkQty,
                              });
                            }}
                            disabled={addWorkMutation.isPending}
                            className="text-xs bg-blue-600 text-white px-2 py-1.5 rounded font-semibold disabled:opacity-50 shrink-0"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsCustomWork(false)}
                            className="text-xs text-slate-500 hover:text-slate-700 shrink-0"
                          >
                            Отмена
                          </button>
                        </>
                      )}
                      <div className="flex items-center gap-1 shrink-0 border border-slate-300 rounded-lg overflow-hidden bg-white">
                        <button
                          type="button"
                          onClick={() => setAddWorkQty((q) => Math.max(1, q - 1))}
                          className="px-2 py-1 text-slate-500 hover:bg-slate-100 text-sm font-bold"
                        >
                          −
                        </button>
                        <span className="px-1 text-sm font-bold text-slate-800 min-w-[20px] text-center">
                          {addWorkQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setAddWorkQty((q) => q + 1)}
                          className="px-2 py-1 text-slate-500 hover:bg-slate-100 text-sm font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    {addWorkError && (
                      <div className="px-3 py-2 bg-red-50 border-b border-red-200">
                        <p className="text-xs text-red-700 font-medium">{addWorkError}</p>
                      </div>
                    )}
                    {!workSearch.trim() && (
                      <div className="px-3 py-2 flex gap-1.5 flex-wrap border-b border-slate-100 bg-slate-50/70">
                        {catalogCategories.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => setWorkCatFilter(workCatFilter === cat ? null : cat)}
                            className={cn(
                              'text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors',
                              workCatFilter === cat
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
                            )}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    )}
                    {!isCustomWork && (
                      <div className="max-h-60 overflow-y-auto">
                        {!workSearch.trim() && !workCatFilter ? (
                          <p className="text-xs text-slate-400 px-3 py-4 italic text-center">
                            Выберите категорию или введите название для поиска
                          </p>
                        ) : filteredCatalog.length === 0 ? (
                          <p className="text-xs text-slate-400 px-3 py-3 italic">
                            Ничего не найдено
                          </p>
                        ) : (
                          filteredCatalog.map((w) => (
                            <button
                              key={w.id}
                              onClick={() =>
                                addWorkMutation.mutate({
                                  work_catalog_id: w.id,
                                  quantity: addWorkQty,
                                })
                              }
                              disabled={addWorkMutation.isPending}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-0 flex justify-between items-center group disabled:opacity-50"
                            >
                              <span className="text-sm text-slate-800 group-hover:text-blue-700">
                                {w.name}
                              </span>
                              <span className="text-xs text-slate-400 shrink-0 ml-2">
                                {(w.norm_minutes / 60).toFixed(1)} нч
                                {w.default_price_client
                                  ? ` · ${parseInt(w.default_price_client).toLocaleString('ru-RU')} ₽`
                                  : ''}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {order.works.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">Работы не добавлены</p>
                ) : (
                  <div className="space-y-1">
                    {order.works.map((w) => {
                      const name = w.work_catalog?.name ?? w.custom_work_name ?? 'Без названия';
                      const isEditing = editingWorkId === w.id;
                      const isDone = w.status === 'completed';
                      const workCode = (w.work_catalog as unknown as { code?: string } | null)
                        ?.code;
                      const priceNum = parseFloat(w.price_client ?? '0');
                      const normHours = (w.norm_minutes * (w.quantity ?? 1)) / 60;
                      return (
                        <div key={w.id}>
                          <div
                            className={cn(
                              'group flex items-center gap-2 rounded-lg px-3 py-2.5 transition-all duration-150',
                              'hover:shadow-md hover:scale-[1.01] cursor-default',
                              isDone
                                ? 'bg-emerald-50/60 border border-emerald-100'
                                : 'bg-slate-50 border border-transparent',
                            )}
                          >
                            {/* Status circle */}
                            <div
                              className={cn(
                                'w-2.5 h-2.5 rounded-full flex-shrink-0',
                                isDone ? 'bg-emerald-500' : 'bg-red-400',
                              )}
                            />

                            {/* Name + hours */}
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <p className="text-sm font-medium text-slate-800 leading-snug">
                                {name}
                                {(w.quantity ?? 1) > 1 && (
                                  <span className="ml-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                    ×{w.quantity}
                                  </span>
                                )}
                              </p>
                              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                <p className="text-xs text-slate-400">
                                  {normHours.toFixed(1)} нч
                                  {w.actual_minutes
                                    ? ` · факт ${(w.actual_minutes / 60).toFixed(1)} нч`
                                    : ''}
                                </p>
                                {(() => {
                                  const mechs = [w.mechanic_id, w.second_mechanic_id]
                                    .filter(Boolean)
                                    .map((id) => mechanics.find((m) => m.id === id))
                                    .filter(Boolean) as Mechanic[];
                                  if (mechs.length === 0) return null;
                                  const basePrice = mechs.length === 2 ? priceNum / 2 : priceNum;
                                  return mechs.map((m) => {
                                    const pct = parseFloat(m.mechanic_salary_pct ?? '50');
                                    const salary = (basePrice * pct) / 100;
                                    const specLabel = getSpecialtyLabel(m.roles);
                                    return (
                                      <span
                                        key={m.id}
                                        className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded leading-none inline-flex items-center gap-1"
                                      >
                                        <span>{m.name.split(' ')[0]}</span>
                                        {specLabel && (
                                          <span className="opacity-80 text-[9px] font-bold">
                                            ({specLabel})
                                          </span>
                                        )}
                                        {salary > 0 ? <span>+{salary}₽</span> : ''}
                                      </span>
                                    );
                                  });
                                })()}
                              </div>
                            </div>

                            {/* Price — prominent */}
                            <span
                              className={cn(
                                'text-base font-black shrink-0',
                                isDone ? 'text-emerald-700' : 'text-slate-700',
                              )}
                            >
                              {priceNum > 0 ? `${priceNum.toLocaleString('ru-RU')} ₽` : '—'}
                            </span>

                            {/* Edit pencil — grows on hover */}
                            <button
                              onClick={() => {
                                if (isEditing) {
                                  setEditingWorkId(null);
                                  return;
                                }
                                setEditingWorkId(w.id);
                                setEditWorkPrice(
                                  w.price_client ?? String(Math.round(normHours * hourlyRate)),
                                );
                                setEditWorkDesc(
                                  w.work_description ??
                                    (workCode ? (DEFAULT_WORK_DESCRIPTIONS[workCode] ?? '') : ''),
                                );
                                setEditWorkQty(w.quantity ?? 1);
                                setEditWorkMechanic(w.mechanic_id ?? null);
                                setEditWorkSecondMechanic(w.second_mechanic_id ?? null);
                                setEditWorkCustomPct(
                                  w.notes?.match(/\[salary_pct:(\d+(?:\.\d+)?)\]/)?.[1] ?? '',
                                );
                              }}
                              className="shrink-0 text-slate-300 group-hover:text-blue-500 transition-all duration-150 text-base hover:text-2xl hover:text-blue-700"
                              title="Редактировать"
                            >
                              ✏
                            </button>

                            {/* Delete */}
                            {confirmDeleteWorkId === w.id ? (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => {
                                    deleteWorkMutation.mutate(w.id);
                                    setConfirmDeleteWorkId(null);
                                  }}
                                  disabled={deleteWorkMutation.isPending}
                                  className="text-xs font-semibold text-rose-600 hover:text-rose-800 px-2 py-0.5 rounded bg-rose-50 border border-rose-200"
                                >
                                  Удалить
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteWorkId(null)}
                                  className="text-xs text-slate-400 hover:text-slate-600 px-1.5 py-0.5"
                                >
                                  Отмена
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteWorkId(w.id)}
                                className="text-slate-300 hover:text-rose-500 text-lg leading-none shrink-0"
                                title="Удалить"
                              >
                                ×
                              </button>
                            )}
                          </div>

                          {/* Edit panel */}
                          {isEditing &&
                            (() => {
                              const editPrice = parseFloat(editWorkPrice || '0');
                              const computedMinutes =
                                editPrice > 0
                                  ? Math.max(1, Math.round((editPrice / hourlyRate) * 60))
                                  : w.norm_minutes * editWorkQty;
                              const computedHours = computedMinutes / 60;
                              return (
                                <div className="mx-1 mb-1 border border-blue-200 bg-blue-50 rounded-b-xl px-4 py-3 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-black text-blue-800 uppercase tracking-wide">
                                      Редактировать параметры работы
                                    </p>
                                    <span className="text-xs text-blue-500">
                                      Тариф: {hourlyRate.toLocaleString('ru-RU')} ₽/ч
                                    </span>
                                  </div>

                                  {/* Price + computed hours */}
                                  <div className="flex gap-3 items-end">
                                    <div className="flex-1">
                                      <label className="text-xs text-slate-500 block mb-1">
                                        Стоимость (₽)
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        step="100"
                                        value={editWorkPrice}
                                        onChange={(e) => setEditWorkPrice(e.target.value)}
                                        className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                                        placeholder="0"
                                      />
                                    </div>
                                    <div className="shrink-0 pb-1 text-right">
                                      <p className="text-xs text-slate-400">расчетное время</p>
                                      <p className="text-lg font-black text-blue-700">
                                        {computedHours.toFixed(1)} нч
                                      </p>
                                    </div>
                                    <div style={{ width: '72px' }}>
                                      <label className="text-xs text-slate-500 block mb-1 text-center">
                                        Кол-во
                                      </label>
                                      <div className="flex items-center border border-blue-200 rounded-lg overflow-hidden bg-white">
                                        <button
                                          type="button"
                                          onClick={() => setEditWorkQty((q) => Math.max(1, q - 1))}
                                          className="px-2 py-2 text-slate-500 hover:bg-slate-100 text-sm font-bold"
                                        >
                                          −
                                        </button>
                                        <span className="flex-1 text-center text-sm font-semibold text-slate-800">
                                          {editWorkQty}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => setEditWorkQty((q) => q + 1)}
                                          className="px-2 py-2 text-slate-500 hover:bg-slate-100 text-sm font-bold"
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Description */}
                                  <div>
                                    <label className="text-xs text-slate-500 block mb-1">
                                      Описание для заказ-наряда
                                    </label>
                                    <textarea
                                      rows={2}
                                      value={editWorkDesc}
                                      onChange={(e) => setEditWorkDesc(e.target.value)}
                                      placeholder="Что именно сделано..."
                                      className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm resize-none bg-white"
                                    />
                                  </div>

                                  {/* Mechanic & Custom Salary Pct */}
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <label className="text-xs text-slate-500 block mb-1">
                                        Исполнитель
                                      </label>
                                      <select
                                        value={editWorkMechanic ?? ''}
                                        onChange={(e) => setEditWorkMechanic(e.target.value)}
                                        className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white"
                                      >
                                        <option value="">— Не назначен —</option>
                                        {mechanics.map((m) => {
                                          const spec = getSpecialtyLabel(m.roles);
                                          return (
                                            <option key={m.id} value={m.id}>
                                              {m.name} {spec ? `(${spec})` : ''}
                                            </option>
                                          );
                                        })}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-500 block mb-1">
                                        2-й исполнитель
                                      </label>
                                      <select
                                        value={editWorkSecondMechanic ?? ''}
                                        onChange={(e) => setEditWorkSecondMechanic(e.target.value)}
                                        className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white"
                                        disabled={!editWorkMechanic}
                                      >
                                        <option value="">— Нет —</option>
                                        {mechanics.map((m) => {
                                          const spec = getSpecialtyLabel(m.roles);
                                          return (
                                            <option
                                              key={m.id}
                                              value={m.id}
                                              disabled={m.id === editWorkMechanic}
                                            >
                                              {m.name} {spec ? `(${spec})` : ''}
                                            </option>
                                          );
                                        })}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-500 block mb-1">
                                        Ставка ЗП мастера (%)
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        placeholder="По умолчанию (50%)"
                                        value={editWorkCustomPct}
                                        onChange={(e) => setEditWorkCustomPct(e.target.value)}
                                        className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white font-semibold"
                                      />
                                    </div>
                                  </div>

                                  {/* Actions */}
                                  <div className="flex gap-2 pt-1">
                                    <button
                                      onClick={() =>
                                        patchWorkMutation.mutate({
                                          workId: w.id,
                                          body: {
                                            quantity: editWorkQty,
                                            actual_minutes: computedMinutes,
                                            price_client:
                                              editPrice > 0 ? editPrice.toFixed(2) : undefined,
                                            work_description: editWorkDesc || null,
                                            mechanic_id: editWorkMechanic || null,
                                            second_mechanic_id: editWorkSecondMechanic || null,
                                            custom_salary_pct: editWorkCustomPct
                                              ? parseFloat(editWorkCustomPct)
                                              : null,
                                          },
                                        })
                                      }
                                      disabled={patchWorkMutation.isPending}
                                      className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black py-2.5 rounded-lg disabled:opacity-50 uppercase tracking-wide"
                                    >
                                      {patchWorkMutation.isPending ? '...' : 'Сохранить изменения'}
                                    </button>
                                    <button
                                      onClick={() =>
                                        patchWorkMutation.mutate({
                                          workId: w.id,
                                          body: {
                                            quantity: editWorkQty,
                                            actual_minutes: computedMinutes,
                                            price_client:
                                              editPrice > 0 ? editPrice.toFixed(2) : undefined,
                                            work_description: editWorkDesc || null,
                                            mechanic_id: editWorkMechanic || null,
                                            second_mechanic_id: editWorkSecondMechanic || null,
                                            custom_salary_pct: editWorkCustomPct
                                              ? parseFloat(editWorkCustomPct)
                                              : null,
                                            status: 'completed',
                                          },
                                        })
                                      }
                                      disabled={patchWorkMutation.isPending}
                                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black py-2.5 rounded-lg disabled:opacity-50 uppercase tracking-wide"
                                    >
                                      {patchWorkMutation.isPending
                                        ? '...'
                                        : isDone
                                          ? '✓ Обновить'
                                          : '✓ Отметить выполненной'}
                                    </button>
                                    <button
                                      onClick={() => setEditingWorkId(null)}
                                      className="px-3 text-xs text-slate-500 hover:text-slate-700 font-semibold"
                                    >
                                      Отмена
                                    </button>
                                  </div>
                                  {patchWorkMutation.isError && (
                                    <div className="text-xs text-red-600 font-semibold bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                                      Ошибка:{' '}
                                      {patchWorkMutation.error instanceof Error
                                        ? patchWorkMutation.error.message
                                        : 'Неизвестная ошибка'}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Итог ЗП по исполнителям за заказ-наряд */}
              {(() => {
                const mechSummaryMap: Record<
                  string,
                  { name: string; count: number; salary: number; pct: number }
                > = {};
                order.works.forEach((w) => {
                  if (w.status === 'cancelled') return;
                  const mechs = [w.mechanic_id, w.second_mechanic_id].filter(
                    (x): x is string => !!x,
                  );
                  if (mechs.length === 0) return;
                  const workPrice = parseFloat(w.price_client ?? '0');
                  const basePrice = mechs.length === 2 ? workPrice / 2 : workPrice;
                  for (const mechId of mechs) {
                    const mech = mechanics.find((m) => m.id === mechId);
                    const name = mech?.name ?? 'Исполнитель';
                    const pct = parseFloat((mech as MechanicWithPct)?.mechanic_salary_pct ?? '50');
                    const salary = (basePrice * pct) / 100;
                    if (!mechSummaryMap[mechId]) {
                      mechSummaryMap[mechId] = { name, count: 0, salary: 0, pct };
                    }
                    mechSummaryMap[mechId].count += 1;
                    mechSummaryMap[mechId].salary += salary;
                  }
                });

                const mechEntries = Object.entries(mechSummaryMap);
                if (mechEntries.length === 0) return null;
                const totalMechsSalary = mechEntries.reduce(
                  (sum, [, data]) => sum + data.salary,
                  0,
                );

                return (
                  <div className="mb-4 border border-emerald-200 bg-emerald-50/50 rounded-xl overflow-hidden">
                    <div className="bg-emerald-100/70 px-3 py-2 text-[10px] font-black text-emerald-900 uppercase tracking-widest flex items-center justify-between">
                      <span>Итог ЗП по исполнителям ({mechEntries.length})</span>
                      <span className="font-bold normal-case text-emerald-800 text-xs">
                        Всего ЗП: {Math.round(totalMechsSalary).toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                    <div className="divide-y divide-emerald-100/80">
                      {mechEntries.map(([mId, data]) => (
                        <div
                          key={mId}
                          className="flex items-center justify-between px-3 py-2 text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-semibold text-slate-800">{data.name}</span>
                            <span className="text-slate-500 text-[11px] ml-1.5 font-normal">
                              ({data.count}{' '}
                              {data.count === 1
                                ? 'операция'
                                : data.count < 5
                                  ? 'операции'
                                  : 'операций'}
                              )
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-bold text-emerald-700 text-sm">
                              {Math.round(data.salary).toLocaleString('ru-RU')} ₽
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Parts section regardless of length, so we can add to empty order */}
              <div className={order.parts.length === 0 && !showAddPart ? 'mb-2' : 'mb-0'}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-500 font-semibold uppercase">
                      Запчасти ({order.parts.length})
                    </p>
                    {order.parts.length > 0 && (
                      <p className="text-[10px] text-slate-400 italic hidden sm:block">
                        — цена пустая = запчасть клиента
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowAddPart((v) => !v)}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors"
                  >
                    {showAddPart ? '✕ Закрыть' : '+ Добавить'}
                  </button>
                </div>
                {showAddPart && (
                  <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex gap-2 items-center flex-wrap">
                      <input
                        autoFocus
                        type="text"
                        value={addPartName}
                        onChange={(e) => {
                          setAddPartName(e.target.value);
                          setAddPartError(null);
                        }}
                        placeholder="Название запчасти..."
                        className="flex-1 text-sm bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none min-w-[160px] font-bold"
                      />
                      <div className="flex items-center gap-1 shrink-0 border border-slate-300 rounded-lg overflow-hidden bg-white">
                        <button
                          type="button"
                          onClick={() => setAddPartQty((q) => Math.max(1, q - 1))}
                          className="px-2 py-1 text-slate-500 hover:bg-slate-100 text-sm font-bold"
                        >
                          −
                        </button>
                        <span className="px-1 text-sm font-bold text-slate-800 min-w-[20px] text-center">
                          {addPartQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setAddPartQty((q) => q + 1)}
                          className="px-2 py-1 text-slate-500 hover:bg-slate-100 text-sm font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs pt-1 border-t border-slate-200">
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-slate-500">Закупка:</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={addPartCost}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAddPartCost(val);
                            const num = parseFloat(val) || 0;
                            if (num > 0 && !addPartPrice) {
                              setAddPartPrice(String(Math.round(num * 1.3)));
                            }
                          }}
                          className="w-20 text-xs bg-white border border-slate-200 rounded px-2 py-1 outline-none font-bold text-right"
                        />
                        <span className="text-slate-400">₽</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const cost = parseFloat(addPartCost) || 0;
                          if (cost > 0) {
                            setAddPartPrice(String(Math.round(cost * 1.3)));
                          }
                        }}
                        title="Наценка +30%"
                        className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded font-black text-[11px] cursor-pointer transition-colors shadow-2xs"
                      >
                        +30%
                      </button>

                      <div className="flex items-center gap-1">
                        <span className="font-bold text-slate-700">Клиенту:</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={addPartPrice}
                          onChange={(e) => setAddPartPrice(e.target.value)}
                          className="w-20 text-xs bg-white border border-emerald-300 rounded px-2 py-1 outline-none font-bold text-right text-emerald-900"
                        />
                        <span className="text-slate-400">₽</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (!addPartName.trim()) {
                            setAddPartError('Введите название');
                            return;
                          }
                          addPartMutation.mutate({
                            custom_part_name: addPartName,
                            unit_price: addPartCost || undefined,
                            client_price: addPartPrice || addPartCost || undefined,
                            quantity: addPartQty,
                          });
                        }}
                        disabled={addPartMutation.isPending}
                        className="ml-auto text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg font-bold disabled:opacity-50 shrink-0 cursor-pointer"
                      >
                        Добавить
                      </button>
                    </div>

                    {addPartError && (
                      <p className="text-xs text-red-600 font-medium">{addPartError}</p>
                    )}
                  </div>
                )}
                {order.parts.length > 0 && (
                  <>
                    <div className="space-y-1.5">
                      {order.parts.map((p) => {
                        const partName = p.part?.name ?? p.custom_part_name ?? '—';
                        const partUnit = p.part?.unit ?? p.unit ?? 'шт';
                        const draftClient =
                          partPricesDraft[p.id] ?? (p.client_price ? String(p.client_price) : '');
                        const draftUnit =
                          partUnitPricesDraft[p.id] ?? (p.unit_price ? String(p.unit_price) : '');
                        const savedClientPrice = parseFloat(p.client_price ?? '0');
                        const savedUnitPrice = parseFloat(p.unit_price ?? '0');
                        const margin = Math.max(
                          0,
                          (savedClientPrice - savedUnitPrice) * (p.quantity || 1),
                        );

                        return (
                          <div
                            key={p.id}
                            className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 flex items-center justify-between gap-3 group text-xs"
                          >
                            <div className="min-w-0 flex-1 flex items-center gap-2">
                              <span className="font-bold text-slate-800 truncate">{partName}</span>
                              <span className="text-slate-500 font-semibold shrink-0">
                                {p.quantity} {partUnit}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {/* Закупка */}
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">
                                  Закупка:
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  value={draftUnit}
                                  onChange={(e) =>
                                    setPartUnitPricesDraft((prev) => ({
                                      ...prev,
                                      [p.id]: e.target.value,
                                    }))
                                  }
                                  onBlur={() => {
                                    const newVal = parseFloat(draftUnit || '0');
                                    if (Math.abs(newVal - savedUnitPrice) > 0.01) {
                                      patchPartMutation.mutate({
                                        partId: p.id,
                                        unit_price: newVal.toFixed(2),
                                      });
                                    }
                                  }}
                                  placeholder="0.00"
                                  className="w-16 text-right text-xs border border-slate-200 rounded px-1.5 py-0.5 bg-white font-bold"
                                />
                                <span className="text-slate-400">₽</span>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  const cost = parseFloat(draftUnit || String(savedUnitPrice)) || 0;
                                  if (cost > 0) {
                                    const cPrice = Math.round(cost * 1.3).toFixed(2);
                                    setPartPricesDraft((prev) => ({ ...prev, [p.id]: cPrice }));
                                    patchPartMutation.mutate({
                                      partId: p.id,
                                      client_price: cPrice,
                                    });
                                  }
                                }}
                                title="Рассчитать цену клиенту с накруткой +30%"
                                className="px-1.5 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded font-black text-[10px] cursor-pointer"
                              >
                                +30%
                              </button>

                              {/* Клиенту */}
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">
                                  Клиенту:
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  value={draftClient}
                                  onChange={(e) =>
                                    setPartPricesDraft((prev) => ({
                                      ...prev,
                                      [p.id]: e.target.value,
                                    }))
                                  }
                                  onBlur={() => {
                                    const newVal = parseFloat(draftClient || '0');
                                    if (Math.abs(newVal - savedClientPrice) > 0.01) {
                                      patchPartMutation.mutate({
                                        partId: p.id,
                                        client_price: newVal.toFixed(2),
                                      });
                                    }
                                  }}
                                  placeholder="0.00"
                                  className="w-18 text-right text-xs border border-emerald-300 rounded px-1.5 py-0.5 bg-white font-bold text-emerald-900"
                                />
                                <span className="text-slate-400">₽</span>
                              </div>

                              {margin > 0 && (
                                <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                  +{Math.round(margin).toLocaleString('ru-RU')} ₽
                                </span>
                              )}

                              <button
                                onClick={() => deletePartMutation.mutate(p.id)}
                                disabled={deletePartMutation.isPending}
                                className="ml-1 text-slate-300 hover:text-rose-500 opacity-60 group-hover:opacity-100 transition-opacity font-bold"
                                title="Удалить"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {order.parts.length > 0 && (
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-600 bg-emerald-50/50 border border-emerald-200/80 rounded-xl px-3 py-1.5 font-bold">
                        <span>
                          Закупка:{' '}
                          <span className="text-slate-900 font-black">
                            {order.parts
                              .reduce(
                                (s, p) =>
                                  s + (parseFloat(p.unit_price ?? '0') || 0) * (p.quantity ?? 1),
                                0,
                              )
                              .toLocaleString('ru-RU')}{' '}
                            ₽
                          </span>
                        </span>
                        <span>
                          Клиенту:{' '}
                          <span className="text-slate-900 font-black">
                            {order.parts
                              .reduce(
                                (s, p) =>
                                  s + (parseFloat(p.client_price ?? '0') || 0) * (p.quantity ?? 1),
                                0,
                              )
                              .toLocaleString('ru-RU')}{' '}
                            ₽
                          </span>
                        </span>
                        <span className="text-emerald-700 font-black">
                          Заработок на з/ч: +
                          {Math.max(
                            0,
                            order.parts.reduce(
                              (s, p) =>
                                s +
                                ((parseFloat(p.client_price ?? '0') || 0) -
                                  (parseFloat(p.unit_price ?? '0') || 0)) *
                                  (p.quantity ?? 1),
                              0,
                            ),
                          ).toLocaleString('ru-RU')}{' '}
                          ₽
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">
                  Заметка (admin)
                </p>
                {editNote === null ? (
                  <div className="flex items-start gap-2">
                    <p className="text-sm text-slate-700 flex-1">
                      {order.admin_note || (
                        <span className="italic text-slate-400">Нет заметки</span>
                      )}
                    </p>
                    <button
                      onClick={() => setEditNote(order.admin_note ?? '')}
                      className="text-xs text-blue-600 hover:underline shrink-0"
                    >
                      Изменить
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      rows={3}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => patchMutation.mutate({ admin_note: editNote })}
                        disabled={patchMutation.isPending}
                        className="text-xs bg-slate-900 text-white px-4 py-1.5 rounded-lg font-semibold"
                      >
                        Сохранить
                      </button>
                      <button
                        onClick={() => setEditNote(null)}
                        className="text-xs text-slate-400 hover:text-slate-700"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {order.mechanic_note && (
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3.5 space-y-1">
                  <p className="text-[10px] font-black text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>💡</span> Рекомендации механика / мастера
                  </p>
                  <p className="text-sm text-slate-800 font-medium whitespace-pre-wrap">
                    {order.mechanic_note}
                  </p>
                </div>
              )}
              {order.lifecycle_status === 'approved' && (
                <>
                  {/* Старый формат ЗП (совместимость) */}
                  {(order.mechanic_pay || order.second_mechanic_pay) && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
                      <p className="text-xs text-slate-500 mb-2 font-semibold uppercase">
                        ЗП начислено (стар. формат)
                      </p>
                      {order.mechanic_pay && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-700">
                            {order.mechanic?.name ?? 'Механик'}
                          </span>
                          <span className="font-black text-emerald-700">
                            <Money amount={order.mechanic_pay} />
                          </span>
                        </div>
                      )}
                      {order.second_mechanic_pay && (
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-slate-700">
                            {order.second_mechanic?.name ?? 'Механик 2'}
                          </span>
                          <span className="font-black text-emerald-700">
                            <Money amount={order.second_mechanic_pay} />
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Новый формат ЗП через транзакции */}
                  {order.transactions &&
                    order.transactions.filter(
                      (tx) => tx.category_id === '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6',
                    ).length > 0 && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
                        <p className="text-xs text-slate-500 mb-2 font-semibold uppercase">
                          ЗП НАЧИСЛЕНО
                        </p>
                        {order.transactions
                          .filter((tx) => tx.category_id === '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6')
                          .map((tx) => (
                            <div key={tx.id} className="flex justify-between text-sm mt-1">
                              <span className="text-slate-700">
                                {tx.related_user?.name ?? 'Исполнитель'}
                              </span>
                              <span className="font-black text-emerald-700">
                                <Money amount={tx.amount} />
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                </>
              )}
              <div className="border border-red-100 rounded-xl p-4 space-y-2">
                {!showDeleteConfirm ? (
                  <div className="flex gap-2">
                    {order.lifecycle_status === 'approved' && (
                      <button
                        onClick={() => {
                          patchMutation.mutate({ lifecycle_status: 'draft' });
                          onClose();
                        }}
                        disabled={patchMutation.isPending}
                        className="flex-1 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold py-2 rounded-xl text-sm"
                      >
                        Открыть заново
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(true);
                        setDeleteError(null);
                      }}
                      className="flex-1 border border-red-200 text-red-500 hover:bg-red-50 font-semibold py-2 rounded-xl text-sm"
                    >
                      Удалить наряд
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-red-700">
                      Удаление необратимо — будут удалены работы, запчасти, таймеры и все
                      начисленные транзакции (ЗП, выручка СТО).
                    </p>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => {
                        setDeletePassword(e.target.value);
                        setDeleteError(null);
                      }}
                      placeholder="Пароль администратора"
                      className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') deleteOrderMutation.mutate(deletePassword);
                      }}
                    />
                    {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => deleteOrderMutation.mutate(deletePassword)}
                        disabled={deleteOrderMutation.isPending}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-xl text-sm disabled:opacity-50"
                      >
                        {deleteOrderMutation.isPending ? '...' : 'Удалить безвозвратно'}
                      </button>
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeletePassword('');
                          setDeleteError(null);
                        }}
                        className="flex-1 border border-slate-200 text-slate-600 font-semibold py-2 rounded-xl text-sm"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {order && (
          <div className="flex-shrink-0 border-t border-slate-100 px-6 py-4 bg-slate-50/50 rounded-b-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide">
                  Итого
                </p>
                <p className="text-2xl font-black text-slate-900">
                  {dynamicTotal.toLocaleString('ru-RU')} ₽
                </p>
                {totalNormMin > 0 && (
                  <p className="text-xs text-slate-400">{(totalNormMin / 60).toFixed(1)} нч план</p>
                )}
              </div>
              {!isClosed && allWorksCompleted && (
                <button
                  onClick={() => {
                    setShowCloseDialog(true);
                  }}
                  disabled={patchMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl text-sm disabled:opacity-50 shrink-0"
                >
                  Завершить наряд →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Диалог закрытия наряда с вводом зарплат */}
        {showCloseDialog &&
          order &&
          (() => {
            const worksTotal = order.works
              .filter((w) => w.status !== 'cancelled')
              .reduce((s, w) => s + parseFloat(w.price_client ?? '0'), 0);
            const partsTotal = order.parts.reduce(
              (s, p) => s + parseFloat(p.client_price ?? '0') * (p.quantity ?? 1),
              0,
            );
            const orderTotal = worksTotal + partsTotal;
            const totalActMin = order.works
              .filter((w) => w.status === 'completed')
              .reduce((s, w) => s + (w.actual_minutes > 0 ? w.actual_minutes : w.norm_minutes), 0);

            let totalPay = 0;
            order.works.forEach((w) => {
              if (w.status === 'cancelled') return;
              const mechs = [w.mechanic_id, w.second_mechanic_id].filter(Boolean);
              if (mechs.length === 0) return;
              const workPrice = parseFloat(w.price_client ?? '0');
              if (workPrice <= 0) return;
              const basePrice = mechs.length === 2 ? workPrice / 2 : workPrice;
              for (const mechId of mechs) {
                const mech = mechanics.find((m) => m.id === mechId);
                if (mech) {
                  const pct = parseFloat((mech as MechanicWithPct).mechanic_salary_pct ?? '50');
                  totalPay += (basePrice * pct) / 100;
                }
              }
            });
            const margin = orderTotal - totalPay;
            const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');

            return (
              <div
                className="absolute inset-0 z-10 bg-white rounded-2xl flex flex-col"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {/* Шапка */}
                <div className="flex-shrink-0 border-b border-slate-200 px-6 py-4 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Завершить наряд #{order.order_number}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {order.machine_type === 'own'
                        ? `${order.asset?.short_name ?? ''} · ${order.asset?.reg_number ?? ''}`
                        : `${order.client_vehicle_brand ?? ''} ${order.client_vehicle_model ?? ''} · ${order.client_vehicle_reg ?? ''}`}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCloseDialog(false)}
                    className="text-slate-400 hover:text-slate-600 text-2xl leading-none ml-4"
                  >
                    ×
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                  {/* Итог по наряду */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">
                        Выручка
                      </p>
                      <p className="text-lg font-black text-slate-900">{fmt(orderTotal)} ₽</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">
                        Факт. часов
                      </p>
                      <p className="text-lg font-black text-slate-900">
                        {(totalActMin / 60).toFixed(1)} ч
                      </p>
                    </div>
                    <div
                      className={cn(
                        'rounded-xl p-3 text-center',
                        margin >= 0 ? 'bg-emerald-50' : 'bg-red-50',
                      )}
                    >
                      <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">
                        Маржа
                      </p>
                      <p
                        className={cn(
                          'text-lg font-black',
                          margin >= 0 ? 'text-emerald-700' : 'text-red-600',
                        )}
                      >
                        {fmt(margin)} ₽
                      </p>
                    </div>
                  </div>

                  {/* Список работ */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Работы
                    </div>
                    {order.works
                      .filter((w) => w.status !== 'cancelled')
                      .map((w) => (
                        <div
                          key={w.id}
                          className="flex items-center justify-between px-3 py-2 border-t border-slate-100 text-sm"
                        >
                          <span className="text-slate-700 truncate mr-2">
                            {w.work_catalog?.name ?? w.custom_work_name ?? '—'}
                          </span>
                          <span className="font-semibold text-slate-900 shrink-0">
                            {parseFloat(w.price_client ?? '0').toLocaleString('ru-RU')} ₽
                          </span>
                        </div>
                      ))}
                  </div>

                  {/* Запчасти */}
                  {order.parts.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                        <span>Запчасти</span>
                        {partsTotal > 0 && (
                          <span className="text-slate-600 normal-case font-semibold">
                            {partsTotal.toLocaleString('ru-RU')} ₽
                          </span>
                        )}
                      </div>
                      {order.parts.map((p) => {
                        const pPrice = parseFloat(p.client_price ?? '0');
                        const pName = p.part?.name ?? p.custom_part_name ?? '—';
                        const pUnit = p.part?.unit ?? p.unit ?? 'шт';
                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between px-3 py-2 border-t border-slate-100 text-sm"
                          >
                            <span className="text-slate-700 truncate mr-2">
                              {pName}
                              <span className="text-slate-400 text-xs ml-1">
                                × {p.quantity} {pUnit}
                              </span>
                            </span>
                            {pPrice > 0 ? (
                              <span className="font-semibold text-slate-900 shrink-0">
                                {(pPrice * (p.quantity ?? 1)).toLocaleString('ru-RU')} ₽
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic shrink-0">Клиент</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ЗП механиков */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Зарплата исполнителей
                      </p>
                      {Object.keys(closePays).length > 0 && (
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-md border border-emerald-200">
                          Всего ЗП:{' '}
                          {Object.values(closePays)
                            .reduce((sum, val) => sum + (parseFloat(val) || 0), 0)
                            .toLocaleString('ru-RU')}{' '}
                          ₽
                        </span>
                      )}
                    </div>
                    {Object.keys(closePays).length === 0 ? (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-800 text-sm">
                        Нет неоплаченных работ для начисления зарплаты.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {Object.entries(closePays).map(([mechId, amount]) => {
                          const mech = mechanics.find((m) => m.id === mechId);
                          let mechWorksCount = 0;
                          let calcSalary = 0;
                          order.works.forEach((w) => {
                            if (w.status === 'cancelled' || w.salary_paid) return;
                            const mechs = [w.mechanic_id, w.second_mechanic_id].filter(
                              (x): x is string => !!x,
                            );
                            if (!mechs.includes(mechId)) return;
                            mechWorksCount += 1;
                            const workPrice = parseFloat(w.price_client ?? '0');
                            if (workPrice <= 0) return;
                            const basePrice = mechs.length === 2 ? workPrice / 2 : workPrice;
                            const pct = parseFloat(
                              (mech as MechanicWithPct)?.mechanic_salary_pct ?? '50',
                            );
                            calcSalary += (basePrice * pct) / 100;
                          });

                          return (
                            <div
                              key={mechId}
                              className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <span className="text-sm font-bold text-slate-800 block truncate">
                                    {mech?.name ?? 'Исполнитель'}
                                  </span>
                                  <span className="text-xs text-slate-500 font-normal">
                                    {mechWorksCount}{' '}
                                    {mechWorksCount === 1
                                      ? 'операция'
                                      : mechWorksCount < 5
                                        ? 'операции'
                                        : 'операций'}{' '}
                                    (расчёт: {Math.round(calcSalary).toLocaleString('ru-RU')} ₽)
                                  </span>
                                </div>
                                <div className="relative shrink-0">
                                  <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) =>
                                      setClosePays((prev) => ({
                                        ...prev,
                                        [mechId]: e.target.value,
                                      }))
                                    }
                                    className="w-32 border border-slate-300 rounded-lg px-3 py-1.5 text-right font-bold text-slate-900 focus:ring-2 focus:ring-emerald-400 outline-none pr-8 bg-white"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">
                                    ₽
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Рекомендации механика / мастера */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                      Рекомендации механика / мастера по машине
                    </label>
                    <textarea
                      value={closeRecommendation}
                      onChange={(e) => setCloseRecommendation(e.target.value)}
                      placeholder="Укажите рекомендации по авто (например: через 5 000 км замена масла и фильтров...)"
                      rows={2}
                      className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-400 outline-none resize-none bg-slate-50 focus:bg-white transition-colors"
                    />

                    {/* Быстрый расчёт напоминания об обслуживании */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Напомнить клиенту об обслуживании (прозвон):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: '+5 000 км (~1.5 мес)', km: 5000, days: 50 },
                          { label: '+10 000 км (~3.3 мес)', km: 10000, days: 100 },
                          { label: '+15 000 км (~5 мес)', km: 15000, days: 150 },
                        ].map((preset) => (
                          <button
                            key={preset.km}
                            type="button"
                            onClick={() => {
                              const baseKm = order.odometer_end || order.odometer_start || 0;
                              if (baseKm > 0) setCloseDueKm(String(baseKm + preset.km));
                              const d = new Date();
                              d.setDate(d.getDate() + preset.days);
                              setCloseDueDate(d.toISOString().slice(0, 10));
                            }}
                            className="bg-white border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-lg transition-all"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                            Целевой пробег (км)
                          </label>
                          <input
                            type="number"
                            value={closeDueKm}
                            onChange={(e) => setCloseDueKm(e.target.value)}
                            placeholder="например: 256549"
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-white outline-none focus:ring-1 focus:ring-emerald-400"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                            Дата напоминания (звонка)
                          </label>
                          <input
                            type="date"
                            value={closeDueDate}
                            onChange={(e) => setCloseDueDate(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-white outline-none focus:ring-1 focus:ring-emerald-400"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Пробег заезда и выезда (после тестов) */}
                    {(() => {
                      const hasOilWork = (order.works || []).some(
                        (w: {
                          work_catalog?: { name?: string | null } | null;
                          custom_work_name?: string | null;
                          work_description?: string | null;
                        }) =>
                          isOilOrFilterWork(w.work_catalog?.name) ||
                          isOilOrFilterWork(w.custom_work_name) ||
                          isOilOrFilterWork(w.work_description),
                      );
                      const hasOdo = Boolean(
                        (closeOdometerEnd && Number(closeOdometerEnd) > 0) ||
                        (closeOdometerStart && Number(closeOdometerStart) > 0),
                      );

                      return (
                        <div
                          className={`border rounded-xl p-3 space-y-2 ${
                            hasOilWork
                              ? 'bg-amber-50/70 border-amber-300'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                              Пробег при заезде и выезде из сервиса:
                            </p>
                            {hasOilWork && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-200 text-amber-900 uppercase tracking-wide">
                                🛢️ Замена масла/фильтра (одометр обязателен)
                              </span>
                            )}
                          </div>
                          {hasOilWork && !hasOdo && (
                            <p className="text-xs text-rose-600 font-bold">
                              ⚠️ В наряде есть замена масла/фильтров! Без указания одометра закрыть
                              наряд нельзя.
                            </p>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                                Дата окончания наряда
                              </label>
                              <input
                                type="date"
                                value={closeCompletedAt}
                                onChange={(e) => setCloseCompletedAt(e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-white outline-none focus:ring-1 focus:ring-emerald-400 font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                                Пробег выезда / после тестов (км)
                              </label>
                              <input
                                type="number"
                                value={closeOdometerEnd}
                                onChange={(e) => setCloseOdometerEnd(e.target.value)}
                                placeholder="Одометр на выходе..."
                                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-white outline-none focus:ring-1 focus:ring-emerald-400 font-mono font-bold"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                              Пробег заезда (км)
                            </label>
                            <input
                              type="number"
                              value={closeOdometerStart}
                              onChange={(e) => setCloseOdometerStart(e.target.value)}
                              placeholder="Одометр на входе..."
                              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-white outline-none focus:ring-1 focus:ring-emerald-400 font-mono"
                            />
                          </div>
                          <div className="flex items-center gap-1.5 pt-1">
                            <span className="text-[10px] text-slate-400 font-semibold">
                              Быстро прибавить тест-драйв:
                            </span>
                            {[
                              { label: '+0 км (без тестов)', add: 0 },
                              { label: '+5 км (тест-драйв)', add: 5 },
                              { label: '+10 км', add: 10 },
                            ].map((preset) => (
                              <button
                                key={preset.add}
                                type="button"
                                onClick={() => {
                                  const base = Number(closeOdometerStart || 0);
                                  if (base > 0) setCloseOdometerEnd(String(base + preset.add));
                                }}
                                className="bg-white border border-slate-200 hover:border-emerald-500 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded transition-all"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Кнопки */}
                <div className="flex-shrink-0 border-t border-slate-100 px-6 py-4 flex gap-3">
                  <button
                    onClick={() => setShowCloseDialog(false)}
                    className="flex-1 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold py-2.5 rounded-xl text-sm"
                  >
                    Отмена
                  </button>
                  {(() => {
                    const hasOilWork = (order.works || []).some(
                      (w: {
                        work_catalog?: { name?: string | null } | null;
                        custom_work_name?: string | null;
                        work_description?: string | null;
                      }) =>
                        isOilOrFilterWork(w.work_catalog?.name) ||
                        isOilOrFilterWork(w.custom_work_name) ||
                        isOilOrFilterWork(w.work_description),
                    );
                    const hasOdo = Boolean(
                      (closeOdometerEnd && Number(closeOdometerEnd) > 0) ||
                      (closeOdometerStart && Number(closeOdometerStart) > 0),
                    );
                    return (
                      <button
                        onClick={() => {
                          if (hasOilWork && !hasOdo) {
                            alert('При замене масла или фильтров ввод одометра обязателен!');
                            return;
                          }
                          const updates: Record<string, unknown> = {
                            status: 'completed',
                            lifecycle_status: 'approved',
                            mechanic_pays: closePays,
                            mechanic_note: closeRecommendation.trim() || null,
                            due_km: closeDueKm ? Number(closeDueKm) : null,
                            due_date: closeDueDate || null,
                            completed_at: closeCompletedAt
                              ? `${closeCompletedAt}T17:00:00.000Z`
                              : new Date().toISOString(),
                          };
                          if (closeOdometerStart)
                            updates.odometer_start = Number(closeOdometerStart);
                          if (closeOdometerEnd) updates.odometer_end = Number(closeOdometerEnd);
                          patchMutation.mutate(updates);
                        }}
                        disabled={patchMutation.isPending || (hasOilWork && !hasOdo)}
                        className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50"
                      >
                        {patchMutation.isPending ? 'Сохраняем...' : 'Подтвердить и закрыть наряд'}
                      </button>
                    );
                  })()}
                </div>
              </div>
            );
          })()}

        {/* Модальное окно подтверждения отправки на согласование в MAX */}
        {showApprovalPrompt && order && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
            onClick={() => setShowApprovalPrompt(false)}
          >
            <div
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 via-slate-50 to-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💬</span>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">
                      Согласование работ в MAX
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Наряд #{order.order_number} · Руководитель: Нигамедьянов Александр
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowApprovalPrompt(false)}
                  className="text-slate-400 hover:text-slate-700 text-lg leading-none cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
                  <div className="font-bold text-slate-700 flex items-center justify-between">
                    <span>Список работ на согласование:</span>
                    <span className="text-slate-400 font-normal">({order.works.length} поз.)</span>
                  </div>
                  {order.works.length === 0 ? (
                    <p className="text-amber-600 font-medium italic">Работы ещё не добавлены</p>
                  ) : (
                    <ul className="space-y-1.5 pl-1 max-h-48 overflow-y-auto">
                      {order.works.map((w, idx) => (
                        <li
                          key={w.id}
                          className="text-slate-800 font-medium flex items-start gap-1.5"
                        >
                          <span className="text-indigo-600 font-bold">{idx + 1}.</span>
                          <div className="flex-1">
                            <span className="font-semibold">
                              {w.custom_work_name || w.work_catalog?.name}
                            </span>
                            <div className="text-slate-500 text-[10px] mt-0.5">
                              {w.norm_minutes
                                ? `${(w.norm_minutes / 60).toFixed(1)} нч`
                                : 'нч не указаны'}{' '}
                              ·{' '}
                              {w.price_client
                                ? `${parseFloat(w.price_client).toLocaleString('ru-RU')} ₽`
                                : '1 ₽'}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Комментарий для Александра (опционально)
                  </label>
                  <textarea
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                    placeholder="Например: Саша, глянь заднюю ступицу, сколько тут нч поставить?"
                    rows={2}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                  />
                </div>

                {sendApprovalMutation.isError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-xl text-xs font-semibold">
                    {(sendApprovalMutation.error as Error)?.message || 'Ошибка отправки'}
                  </div>
                )}
              </div>

              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowApprovalPrompt(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  disabled={sendApprovalMutation.isPending || order.works.length === 0}
                  onClick={() => sendApprovalMutation.mutate(approvalComment)}
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  {sendApprovalMutation.isPending
                    ? '⏳ Отправляем...'
                    : '🚀 Отправить Александру в MAX'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Client Vehicle Selector ──────────────────────────────────────────────────

interface CounterpartyOption {
  id: string;
  name: string;
  phone: string | null;
}

function CounterpartySubForm({
  value,
  onChange,
  stoOnly = false,
}: {
  value: CounterpartyOption | null;
  onChange: (v: CounterpartyOption | null) => void;
  stoOnly?: boolean;
}) {
  const [cpSearch, setCpSearch] = useState('');
  const [showNewCp, setShowNewCp] = useState(false);
  const [newCpName, setNewCpName] = useState('');
  const [newCpPhone, setNewCpPhone] = useState('');
  const queryClient = useQueryClient();

  const { data: cpResults = [] } = useQuery<CounterpartyOption[]>({
    queryKey: ['cp-search', cpSearch, stoOnly],
    queryFn: async () => {
      const params = new URLSearchParams({ q: cpSearch });
      if (stoOnly) params.set('sto_only', '1');
      const r = await fetch(`/api/counterparties/search?${params}`);
      if (!r.ok) throw new Error('Ошибка загрузки');
      return r.json();
    },
    staleTime: 10_000,
  });

  const createCpMutation = useMutation({
    mutationFn: async () => {
      if (!newCpName.trim()) throw new Error('Введите имя клиента');
      const r = await fetch('/api/counterparties/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCpName.trim(), phone: newCpPhone.trim() || null }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Ошибка');
      return r.json() as Promise<CounterpartyOption>;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['cp-search'] });
      onChange(created);
      setShowNewCp(false);
      setNewCpName('');
      setNewCpPhone('');
    },
  });

  if (value) {
    return (
      <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{value.name}</p>
          {value.phone && <p className="text-xs text-slate-400">{value.phone}</p>}
        </div>
        <button
          onClick={() => onChange(null)}
          className="text-slate-400 hover:text-slate-600 text-lg leading-none ml-2"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {!showNewCp ? (
        <>
          <input
            value={cpSearch}
            onChange={(e) => setCpSearch(e.target.value)}
            placeholder="Поиск клиента по имени/телефону..."
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
          />
          {cpResults.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-32 overflow-y-auto">
              {cpResults.map((cp, i) => (
                <button
                  key={cp.id}
                  type="button"
                  onClick={() => {
                    onChange(cp);
                    setCpSearch('');
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 hover:bg-slate-50 text-sm',
                    i < cpResults.length - 1 && 'border-b border-slate-100',
                  )}
                >
                  <span className="font-medium text-slate-900">{cp.name}</span>
                  {cp.phone && <span className="text-slate-400 text-xs ml-2">{cp.phone}</span>}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowNewCp(true)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            + Новый клиент
          </button>
        </>
      ) : (
        <div className="space-y-1.5 bg-blue-50 border border-blue-100 rounded-lg p-2.5">
          <input
            value={newCpName}
            onChange={(e) => setNewCpName(e.target.value)}
            placeholder="Имя клиента *"
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
          />
          <input
            value={newCpPhone}
            onChange={(e) => setNewCpPhone(e.target.value)}
            placeholder="Телефон"
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
          />
          {createCpMutation.isError && (
            <p className="text-xs text-red-500">{(createCpMutation.error as Error).message}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowNewCp(false)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 text-slate-600"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => createCpMutation.mutate()}
              disabled={createCpMutation.isPending}
              className="flex-[2] py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white disabled:bg-blue-300"
            >
              {createCpMutation.isPending ? '...' : 'Добавить клиента'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ClientVehicleSelector({
  value,
  onChange,
}: {
  value: ClientVehicle | null;
  onChange: (v: ClientVehicle | null) => void;
}) {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newBrand, setNewBrand] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newReg, setNewReg] = useState('');
  const [newCounterparty, setNewCounterparty] = useState<CounterpartyOption | null>(null);
  const queryClient = useQueryClient();

  const { data: results = [], isFetching } = useQuery<ClientVehicle[]>({
    queryKey: ['client-vehicles-search', search],
    queryFn: async () => {
      const r = await fetch(`/api/garage/client-vehicles?search=${encodeURIComponent(search)}`);
      if (!r.ok) throw new Error('Ошибка загрузки');
      return r.json();
    },
    staleTime: 10_000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newBrand.trim() || !newReg.trim()) throw new Error('Марка и госномер обязательны');
      const r = await fetch('/api/garage/client-vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: newBrand.trim(),
          model: newModel.trim() || null,
          reg_number: newReg.trim(),
          counterparty_id: newCounterparty?.id ?? null,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Ошибка');
      return r.json() as Promise<ClientVehicle>;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['client-vehicles-search'] });
      onChange(created);
      setShowCreate(false);
      setNewBrand('');
      setNewModel('');
      setNewReg('');
      setNewCounterparty(null);
    },
  });

  if (value) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {value.brand} {value.model} · {value.reg_number}
          </p>
          {value.counterparty && (
            <p className="text-xs text-slate-500">{value.counterparty.name}</p>
          )}
        </div>
        <button
          onClick={() => onChange(null)}
          className="text-slate-400 hover:text-slate-700 text-lg font-bold leading-none ml-3"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowCreate(false);
          }}
          placeholder="Поиск по марке, модели, госномеру..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
        {isFetching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            ...
          </span>
        )}
      </div>

      {results.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
          {results.map((v, i) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                onChange(v);
                setSearch('');
              }}
              className={cn(
                'w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors',
                i < results.length - 1 && 'border-b border-slate-100',
              )}
            >
              <p className="text-sm font-medium text-slate-900">
                {v.brand} {v.model} · {v.reg_number}
              </p>
              {v.counterparty && <p className="text-xs text-slate-400">{v.counterparty.name}</p>}
            </button>
          ))}
        </div>
      )}

      {!showCreate ? (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
        >
          + Добавить новый автомобиль
        </button>
      ) : (
        <div className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50">
          <p className="text-xs font-semibold text-slate-500 uppercase">Новый автомобиль</p>
          <input
            value={newBrand}
            onChange={(e) => setNewBrand(e.target.value)}
            placeholder="Марка (Toyota) *"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
          />
          <input
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            placeholder="Модель (Camry)"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
          />
          <input
            value={newReg}
            onChange={(e) => setNewReg(e.target.value)}
            placeholder="Госномер (А001АА96) *"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
          />
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">
              Клиент (необязательно)
            </p>
            <CounterpartySubForm value={newCounterparty} onChange={setNewCounterparty} />
          </div>
          {createMutation.isError && (
            <p className="text-xs text-red-500">{(createMutation.error as Error).message}</p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setNewCounterparty(null);
              }}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 text-slate-600"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="flex-[2] py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white disabled:bg-slate-400"
            >
              {createMutation.isPending ? 'Сохраняем...' : 'Сохранить и выбрать'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateOrderModal({
  onClose,
  assets,
  mechanics = [],
  onCreated,
}: {
  onClose: () => void;
  assets: Asset[];
  mechanics?: Mechanic[];
  onCreated?: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [selectedClientVehicle, setSelectedClientVehicle] = useState<ClientVehicle | null>(null);
  const [error, setError] = useState('');

  const isExternal = form.machine_type === 'own' && form.service_type === 'external';

  const createMutation = useMutation({
    mutationFn: async () => {
      if (form.machine_type === 'own' && !form.asset_id) {
        throw new Error('Выберите автомобиль из парка');
      }
      if (form.machine_type === 'client' && !selectedClientVehicle) {
        throw new Error('Выберите или создайте клиентский автомобиль');
      }
      if (!form.problem_description.trim()) {
        throw new Error('Укажите описание проблемы или выполненных работ');
      }
      if (isExternal && !form.contractor_name.trim()) {
        throw new Error('Укажите исполнителя / сторонний сервис');
      }

      const r = await fetch('/api/garage/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          is_external: isExternal,
          client_vehicle_id: form.machine_type === 'client' ? selectedClientVehicle?.id : undefined,
          assigned_mechanic_id: isExternal ? undefined : form.assigned_mechanic_id || undefined,
          odometer_start: form.odometer_start ? parseInt(form.odometer_start) : undefined,
          work_description: isExternal ? form.problem_description : undefined,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? 'Ошибка');
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['garage-orders'] });
      queryClient.invalidateQueries({ queryKey: ['garage-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['service-orders-month'] });
      onClose();
      if (data?.id) onCreated?.(data.id);
    },
    onError: (e: Error) => setError(e.message),
  });

  const set = <K extends keyof typeof emptyForm>(field: K, value: (typeof emptyForm)[K]) =>
    setForm((f) => ({ ...f, [field]: value }));

  const totalExternalCost =
    (parseFloat(String(form.works_cost)) || 0) + (parseFloat(String(form.parts_cost)) || 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'material-symbols-outlined text-xl',
                isExternal ? 'text-purple-600' : 'text-slate-700',
              )}
            >
              {isExternal ? 'store' : 'car_repair'}
            </span>
            <h2 className="text-base font-bold text-slate-900">
              {isExternal ? 'Ремонт в стороннем сервисе' : 'Новый заказ-наряд'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Machine Type */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
              Тип машины *
            </label>
            <div className="flex gap-2">
              {(['own', 'client'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('machine_type', t)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-semibold transition-colors',
                    form.machine_type === t
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  {t === 'own' ? 'Своя машина' : 'Клиентская'}
                </button>
              ))}
            </div>
          </div>

          {/* Service Type Toggle (for own vehicles) */}
          {form.machine_type === 'own' && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                Исполнитель ремонта *
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => set('service_type', 'internal')}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                    form.service_type === 'internal'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  <span className="material-symbols-outlined text-[16px]">build</span>
                  Наш бокс (свои слесари)
                </button>
                <button
                  type="button"
                  onClick={() => set('service_type', 'external')}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                    form.service_type === 'external'
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100',
                  )}
                >
                  <span className="material-symbols-outlined text-[16px]">store</span>
                  Сторонний сервис
                </button>
              </div>
            </div>
          )}

          {/* Vehicle Selection */}
          {form.machine_type === 'own' ? (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                Машина парка *
              </label>
              <select
                value={form.asset_id}
                onChange={(e) => {
                  const assetId = e.target.value;
                  set('asset_id', assetId);
                  const selectedAsset = assets.find((a) => a.id === assetId) as
                    | (Asset & { odometer_current?: number | null })
                    | undefined;
                  if (selectedAsset?.odometer_current != null) {
                    set('odometer_start', String(selectedAsset.odometer_current));
                  }
                }}
                className={cn(
                  'w-full border rounded-lg px-3 py-2 text-sm bg-white',
                  !form.asset_id ? 'border-red-400 bg-red-50' : 'border-slate-200',
                )}
              >
                <option value="">— Выберите машину —</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.short_name} · {a.reg_number}
                  </option>
                ))}
              </select>
              {!form.asset_id && <p className="text-xs text-red-500 mt-0.5">Обязательно</p>}
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                Автомобиль клиента *
              </label>
              <ClientVehicleSelector
                value={selectedClientVehicle}
                onChange={(v) => {
                  setSelectedClientVehicle(v);
                  if (v?.odometer_last != null) {
                    set('odometer_start', String(v.odometer_last));
                  }
                }}
              />
              {!selectedClientVehicle && <p className="text-xs text-red-500 mt-0.5">Обязательно</p>}
            </div>
          )}

          {/* External Repair Specific Fields */}
          {isExternal ? (
            <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Дата ремонта *
                  </label>
                  <input
                    type="date"
                    value={form.order_date}
                    onChange={(e) => set('order_date', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white font-medium"
                  />
                  <span className="text-[10px] text-slate-400">Можно указать прошлую дату</span>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Акт / наряд №
                  </label>
                  <input
                    value={form.external_doc_number}
                    onChange={(e) => set('external_doc_number', e.target.value)}
                    placeholder="№ 452"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Исполнитель / Сервис *
                </label>
                <input
                  value={form.contractor_name}
                  onChange={(e) => set('contractor_name', e.target.value)}
                  placeholder="Например, ООО Дизель-Сервис, Мастер по КПП..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Что ремонтировали *
                </label>
                <textarea
                  value={form.problem_description}
                  onChange={(e) => set('problem_description', e.target.value)}
                  rows={2}
                  placeholder="Например, Капитальный ремонт двигателя Д-245, замена поршневой..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Стоимость работ (₽)
                  </label>
                  <input
                    type="number"
                    value={form.works_cost}
                    onChange={(e) => set('works_cost', e.target.value)}
                    placeholder="0"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Стоимость запчастей (₽)
                  </label>
                  <input
                    type="number"
                    value={form.parts_cost}
                    onChange={(e) => set('parts_cost', e.target.value)}
                    placeholder="0"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white font-bold"
                  />
                </div>
              </div>

              {totalExternalCost > 0 && (
                <div className="bg-purple-100/70 p-3 rounded-lg flex items-center justify-between text-xs">
                  <span className="font-bold text-purple-900">Итого расход автопарка:</span>
                  <span className="font-black text-purple-700 text-sm">
                    {totalExternalCost.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="ext_completed"
                  checked={form.is_completed}
                  onChange={(e) => set('is_completed', e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded"
                />
                <label
                  htmlFor="ext_completed"
                  className="text-xs text-slate-700 font-semibold cursor-pointer"
                >
                  Ремонт завершён и оплачен (сразу в архив и P&L)
                </label>
              </div>

              {form.is_completed && form.machine_type === 'own' && totalExternalCost > 0 && (
                <div className="bg-white p-3 rounded-xl border border-purple-200 space-y-1.5 shadow-2xs">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span>💵</span> Источник списания оплаты (Кошелёк)
                  </label>
                  <select
                    value={form.payment_wallet_id}
                    onChange={(e) => set('payment_wallet_id', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-slate-50 font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="10000000-0000-0000-0000-000000000002">
                      💵 Сейф (Наличные ТК) — списать из кассы
                    </option>
                    <option value="10000000-0000-0000-0000-000000000001">
                      🏦 Расчётный счёт (Т-Банк) — безналичный расчёт
                    </option>
                    <option value="none">
                      🚫 Без списания (уже учтено в выписке / личные средства)
                    </option>
                  </select>
                  <p className="text-[10px] text-slate-500">
                    Сумма {totalExternalCost.toLocaleString('ru-RU')} ₽ сразу отобразится в Дневном
                    контроле и уменьшит остаток выбранного счёта.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Standard In-House Repair Fields */
            <>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                  Описание проблемы *
                </label>
                <textarea
                  value={form.problem_description}
                  onChange={(e) => set('problem_description', e.target.value)}
                  rows={3}
                  placeholder="Что случилось..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                    Исполнитель (опционально)
                  </label>
                  <select
                    value={form.assigned_mechanic_id}
                    onChange={(e) => set('assigned_mechanic_id', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">— Не выбран —</option>
                    {mechanics.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                    Пробег (км)
                  </label>
                  <input
                    type="number"
                    value={form.odometer_start}
                    onChange={(e) => set('odometer_start', e.target.value)}
                    placeholder="Одометр..."
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                    Приоритет
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) => set('priority', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    {Object.entries(PRIORITY_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                  Заметка
                </label>
                <input
                  value={form.admin_note}
                  onChange={(e) => set('admin_note', e.target.value)}
                  placeholder="Дополнительно..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={
                createMutation.isPending ||
                (form.machine_type === 'own' ? !form.asset_id : !selectedClientVehicle) ||
                !form.problem_description.trim() ||
                (isExternal && !form.contractor_name.trim())
              }
              className={cn(
                'flex-[2] text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm',
                isExternal
                  ? 'bg-purple-700 hover:bg-purple-800'
                  : 'bg-slate-900 hover:bg-slate-800',
              )}
            >
              {createMutation.isPending
                ? 'Сохраняем...'
                : isExternal
                  ? 'Сохранить сторонний ремонт'
                  : 'Создать наряд'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type TabOrder = Omit<OrderRow, 'works'> & {
  lifecycle_status?: string;
  payment_received?: boolean;
  mechanic_note?: string | null;
  admin_note?: string | null;
  mechanic_pay?: string | number | null;
  second_mechanic_pay?: string | number | null;
  odometer_start?: number | null;
  odometer_end?: number | null;
  client_vehicle_model?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  works: Array<{
    id: string;
    status: string;
    salary_paid?: boolean;
    custom_work_name?: string | null;
    actual_minutes?: number | null;
    price_client?: string | null;
    norm_minutes?: number;
    work_catalog?: { name: string } | null;
  }>;
  parts?: Array<{
    id: string;
    custom_part_name?: string | null;
    quantity: number;
    unit_price?: string | null;
    client_price?: string | null;
    unit?: string | null;
    part?: { name: string; unit: string } | null;
  }>;
};

// ─── Date Navigation ─────────────────────────────────────────────────────────

// DateNav removed

// MonthNav removed

// ─── Archive Analytics & Review-Style Flow ───────────────────────────────────

function getArchiveWeekDates(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay();
  const monOffset = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d);
  mon.setDate(d.getDate() + monOffset);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { weekStart: mon.toISOString().slice(0, 10), weekEnd: sun.toISOString().slice(0, 10) };
}

// ── Order card (компактный однострочный вид) ─────────────────────────────────
function OrderCard({ o, onSelect }: { o: TabOrder; onSelect: (id: string) => void }) {
  const qc = useQueryClient();
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      fetch(`/api/garage/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garage-orders'] });
    },
  });

  const works = o.works ?? [];
  const parts = o.parts ?? [];
  const worksCost = works.reduce((s, w) => s + moneyVal(w.price_client), 0);
  const partsCost = parts.reduce(
    (s, p) => s + (parseFloat(p.client_price ?? p.unit_price ?? '0') || 0) * (p.quantity || 1),
    0,
  );
  const cost = worksCost + partsCost;
  const isCancelled = o.lifecycle_status === 'cancelled' || o.status === 'cancelled';
  const isReview = !isCancelled && o.lifecycle_status === 'draft' && o.status === 'completed';
  const isPendingPayment =
    !isCancelled &&
    o.lifecycle_status === 'approved' &&
    o.machine_type === 'client' &&
    !o.payment_received;
  const isClosed = !isCancelled && o.lifecycle_status === 'approved' && !isPendingPayment;

  const vehicleLabel =
    o.machine_type === 'own'
      ? [o.asset?.short_name, o.asset?.reg_number].filter(Boolean).join(' · ')
      : [
          o.client_vehicle_brand,
          (o as TabOrder & { client_vehicle_model?: string }).client_vehicle_model,
          o.client_vehicle_reg,
        ]
          .filter(Boolean)
          .join(' ');
  const clientLabel = o.machine_type === 'client' ? (o.client_name as string | null) : null;

  const statusBadge = isCancelled
    ? { label: 'Отменён', cls: 'bg-red-100 text-red-700' }
    : isClosed
      ? { label: 'Закрыт', cls: 'bg-emerald-100 text-emerald-700' }
      : isPendingPayment
        ? { label: 'Ждёт оплаты', cls: 'bg-orange-100 text-orange-700' }
        : isReview
          ? { label: 'На ревью', cls: 'bg-amber-100 text-amber-700' }
          : o.status === 'completed'
            ? { label: 'Завершён', cls: 'bg-slate-100 text-slate-600' }
            : { label: 'В работе', cls: 'bg-blue-100 text-blue-700' };

  return (
    <div
      onClick={() => onSelect(o.id)}
      className={cn(
        'bg-white border rounded-xl px-4 py-2.5 cursor-pointer hover:border-slate-300 hover:shadow-xs transition-all flex items-center justify-between gap-3',
        isReview ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200',
      )}
    >
      {/* Left: number + type + vehicle + tags */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="font-mono text-xs font-black text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
          НЗ-{o.order_number}
        </span>
        <span
          className={cn(
            'text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0',
            o.machine_type === 'own' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700',
          )}
        >
          {o.machine_type === 'own' ? 'Свой' : 'Клиент'}
        </span>
        <span
          className="font-bold text-sm text-slate-900 truncate max-w-[200px]"
          title={vehicleLabel || '—'}
        >
          {vehicleLabel || '—'}
        </span>
        {clientLabel && (
          <span className="text-xs text-slate-400 truncate max-w-[120px] hidden sm:block">
            · {clientLabel}
          </span>
        )}
        <span className="text-[11px] text-slate-400 shrink-0 hidden md:block">
          {new Date(o.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
        </span>
        {/* Работы/запчасти в виде коротких тегов */}
        <div className="hidden lg:flex items-center gap-1 overflow-hidden max-w-[320px]">
          {works.slice(0, 2).map((w) => (
            <span
              key={w.id}
              className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 truncate max-w-[140px]"
            >
              {w.work_catalog?.name ?? w.custom_work_name ?? '—'}
            </span>
          ))}
          {parts.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
              📦 {parts.length} з/ч
            </span>
          )}
        </div>
      </div>

      {/* Right: mechanic + cost + status */}
      <div className="shrink-0 flex items-center gap-4">
        {o.mechanic?.name && (
          <span className="text-xs text-slate-500 truncate max-w-[110px] hidden sm:block">
            👨‍🔧 {o.mechanic.name.split(' ')[0]}
          </span>
        )}
        <div className="text-right min-w-[90px]">
          <span className="text-sm font-bold text-slate-900 block">
            {cost > 0 ? `${cost.toLocaleString('ru-RU')} ₽` : '0 ₽'}
          </span>
          {partsCost > 0 && worksCost > 0 && (
            <span className="text-[9px] text-slate-400 block">
              раб: {Math.round(worksCost).toLocaleString('ru-RU')} | з/ч:{' '}
              {Math.round(partsCost).toLocaleString('ru-RU')}
            </span>
          )}
        </div>
        <span
          className={cn(
            'text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0',
            statusBadge.cls,
          )}
        >
          {statusBadge.label}
        </span>
        {isPendingPayment && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!confirm(`Подтвердить оплату наряда НЗ-${o.order_number}?`)) return;
              patch.mutate({ id: o.id, body: { payment_received: true } });
            }}
            className="text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs shrink-0 cursor-pointer"
          >
            Оплачено ✓
          </button>
        )}
        {isClosed && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              patch.mutate({ id: o.id, body: { lifecycle_status: 'draft' } });
            }}
            className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            Открыть заново
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════ MAINTENANCE ═════════════════════════════════════

function MaintenanceSection() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MaintenanceItem>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    asset_id: '',
    work_name: '',
    interval_km: '',
    interval_months: '6',
    last_done_km: '',
    last_done_at: todayStr(),
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['assets-select'],
    queryFn: () => fetch('/api/garage/assets').then((r) => r.json()),
    staleTime: 300000,
  });
  const { data: items = [], isLoading } = useQuery<MaintenanceItem[]>({
    queryKey: ['garage-maintenance'],
    queryFn: () =>
      fetch('/api/garage/maintenance')
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
  });
  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch('/api/garage/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garage-maintenance'] });
      qc.invalidateQueries({ queryKey: ['garage-dashboard'] });
      setShowCreate(false);
      setCreateForm({
        asset_id: '',
        work_name: '',
        interval_km: '',
        interval_months: '6',
        last_done_km: '',
        last_done_at: todayStr(),
      });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      fetch(`/api/garage/maintenance/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garage-maintenance'] });
      setEditingId(null);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/garage/maintenance/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['garage-maintenance'] }),
  });

  const startEdit = (item: MaintenanceItem) => {
    setEditingId(item.id);
    setEditForm(item);
  };
  const remainingKm = (item: MaintenanceItem) => {
    const current = item.asset?.odometer_current ?? 0;
    const due = item.next_due_km ?? 0;
    if (!due || !current) return null;
    return due - current;
  };

  // Vehicle summary cards
  const vehicleMap = new Map<
    string,
    { asset: MaintenanceItem['asset']; overdue: number; soon: number }
  >();
  items.forEach((item) => {
    if (!item.asset) return;
    const key = item.asset.id;
    if (!vehicleMap.has(key)) vehicleMap.set(key, { asset: item.asset, overdue: 0, soon: 0 });
    const v = vehicleMap.get(key)!;
    if (item.alert_status === 'overdue') v.overdue++;
    else if (item.alert_status === 'soon') v.soon++;
  });
  const vehicles = Array.from(vehicleMap.values());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Регламенты ТО</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Плановое техническое обслуживание и контроль сроков по дате и пробегу
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-slate-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Добавить регламент
        </button>
      </div>

      {vehicles.length > 0 && (
        <div className={cn('grid gap-3', vehicles.length <= 4 ? 'grid-cols-4' : 'grid-cols-3')}>
          {vehicles.map(
            ({ asset, overdue, soon }) =>
              asset && (
                <div key={asset.id} className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">{asset.short_name}</div>
                      <div className="text-xs text-slate-400">
                        {asset.odometer_current
                          ? `${asset.odometer_current.toLocaleString('ru-RU')} км`
                          : 'Одометр не указан'}
                      </div>
                    </div>
                    {overdue > 0 ? (
                      <div
                        className="w-2.5 h-2.5 bg-red-500 rounded-full mt-1"
                        style={{ animation: 'pulse 2s infinite' }}
                      />
                    ) : soon > 0 ? (
                      <div className="w-2.5 h-2.5 bg-amber-400 rounded-full mt-1" />
                    ) : (
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full mt-1" />
                    )}
                  </div>
                  {overdue > 0 ? (
                    <div className="text-xs text-red-500 font-medium">{overdue} просрочено</div>
                  ) : (
                    <div className="text-xs text-slate-400">0 просрочено</div>
                  )}
                  {soon > 0 ? (
                    <div className="text-xs text-amber-600">{soon} скоро</div>
                  ) : (
                    <div className="text-xs text-slate-400">0 скоро</div>
                  )}
                </div>
              ),
          )}
        </div>
      )}

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Новый регламент ТО</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Контроль срока по дате и/или пробегу
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Автомобиль *
                </label>
                <select
                  value={createForm.asset_id}
                  onChange={(e) => setCreateForm({ ...createForm, asset_id: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                >
                  <option value="">— Выберите —</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.short_name} · {a.reg_number}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Вид работы *
                </label>
                <input
                  value={createForm.work_name}
                  onChange={(e) => setCreateForm({ ...createForm, work_name: e.target.value })}
                  placeholder="Замена масла двигателя и всех фильтров"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              {/* DATE SECTION (Primary for broken odometers or past replacement dates) */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>📅</span> Контроль по дате и сроку
                  </span>
                  <span className="text-[11px] text-blue-600 font-medium">
                    Основное, если одометр не работает
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">
                      Дата последней замены *
                    </label>
                    <input
                      type="date"
                      value={createForm.last_done_at}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, last_done_at: e.target.value })
                      }
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Сегодня или прошлая дата
                    </span>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">
                      Интервал (мес.)
                    </label>
                    <input
                      type="number"
                      value={createForm.interval_months}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, interval_months: e.target.value })
                      }
                      placeholder="6"
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Обычно 3, 6 или 12 мес.
                    </span>
                  </div>
                </div>

                {(() => {
                  if (!createForm.last_done_at || !createForm.interval_months) return null;
                  const d = new Date(createForm.last_done_at);
                  d.setMonth(d.getMonth() + Number(createForm.interval_months));
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const targetDay = new Date(d);
                  targetDay.setHours(0, 0, 0, 0);
                  const diff = Math.ceil(
                    (targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
                  );
                  const dateStr = d.toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  });
                  return (
                    <div
                      className={cn(
                        'text-xs p-2.5 rounded-lg border flex items-center justify-between',
                        diff < 0
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : diff === 0
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : diff <= 30
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200',
                      )}
                    >
                      <div>
                        Следующая замена: <strong>{dateStr}</strong>
                      </div>
                      <div className="font-semibold text-[11px]">
                        {diff < 0
                          ? `Просрочено на ${Math.abs(diff)} дн.`
                          : diff === 0
                            ? 'Срок наступил сегодня!'
                            : `Через ${diff} дн.`}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* ODOMETER SECTION */}
              <div className="border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span>🚗</span> Контроль по пробегу
                  </span>
                  <span className="text-[11px] text-slate-400">Необязательно</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">
                      Интервал (км)
                    </label>
                    <input
                      type="number"
                      value={createForm.interval_km}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, interval_km: e.target.value })
                      }
                      placeholder="10000"
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">
                      Пробег при замене (км)
                    </label>
                    <input
                      type="number"
                      value={createForm.last_done_km}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, last_done_km: e.target.value })
                      }
                      placeholder="80000"
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Если одометр не работает, оставьте поля пробега пустыми — система будет
                  ориентироваться на дату.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-50 transition"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() =>
                    createMutation.mutate({
                      asset_id: createForm.asset_id,
                      work_name: createForm.work_name,
                      interval_km: createForm.interval_km ? Number(createForm.interval_km) : null,
                      interval_months: createForm.interval_months
                        ? Number(createForm.interval_months)
                        : null,
                      last_done_km: createForm.last_done_km
                        ? Number(createForm.last_done_km)
                        : null,
                      last_done_at: createForm.last_done_at || null,
                    })
                  }
                  disabled={
                    createMutation.isPending || !createForm.asset_id || !createForm.work_name.trim()
                  }
                  className="flex-[2] bg-slate-900 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition"
                >
                  {createMutation.isPending ? 'Сохранение...' : 'Создать регламент'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isLoading ? (
        <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
          <p className="text-5xl mb-3">🔧</p>
          <p className="font-medium text-slate-500">Регламентов ТО нет</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Автомобиль
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Работа
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Интервал
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Последнее ТО
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Следующее ТО
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Остаток
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Статус
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const rem = remainingKm(item);
                const isEditing = editingId === item.id;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dueTime = item.next_due_at ? new Date(item.next_due_at).getTime() : null;
                const diffDays =
                  dueTime !== null
                    ? Math.ceil((dueTime - today.getTime()) / (1000 * 60 * 60 * 24))
                    : null;

                return (
                  <tr
                    key={item.id}
                    className={cn(
                      item.alert_status === 'overdue'
                        ? 'bg-red-50/70 hover:bg-red-50'
                        : item.alert_status === 'soon'
                          ? 'bg-amber-50/70 hover:bg-amber-50'
                          : 'hover:bg-slate-50/60',
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {item.asset?.short_name ?? '—'}
                      </div>
                      {item.asset?.reg_number && (
                        <div className="text-xs text-slate-400 font-mono">
                          {item.asset.reg_number}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-800">
                      {isEditing ? (
                        <input
                          value={editForm.work_name ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, work_name: e.target.value })}
                          className="border border-slate-200 rounded-lg px-2 py-1 text-sm w-full"
                        />
                      ) : (
                        <span className="font-medium">{item.work_name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              placeholder="мес."
                              value={editForm.interval_months ?? ''}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  interval_months: e.target.value ? Number(e.target.value) : null,
                                })
                              }
                              className="border border-slate-200 rounded px-1.5 py-0.5 text-xs w-16"
                              title="Интервал в месяцах"
                            />
                            <span className="text-[11px] text-slate-400">мес.</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              placeholder="км"
                              value={editForm.interval_km ?? ''}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  interval_km: e.target.value ? Number(e.target.value) : null,
                                })
                              }
                              className="border border-slate-200 rounded px-1.5 py-0.5 text-xs w-16"
                              title="Интервал в км"
                            />
                            <span className="text-[11px] text-slate-400">км</span>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {item.interval_months ? (
                            <div className="font-medium text-slate-800">
                              {item.interval_months} мес.
                            </div>
                          ) : null}
                          {item.interval_km ? (
                            <div className="text-xs text-slate-500 font-mono">
                              {item.interval_km.toLocaleString('ru-RU')} км
                            </div>
                          ) : null}
                          {!item.interval_months && !item.interval_km && (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="space-y-1">
                          <input
                            type="date"
                            value={editForm.last_done_at ? editForm.last_done_at.slice(0, 10) : ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, last_done_at: e.target.value })
                            }
                            className="border border-slate-200 rounded px-1.5 py-0.5 text-xs w-full"
                            title="Дата последней замены"
                          />
                          <input
                            type="number"
                            placeholder="км"
                            value={editForm.last_done_km ?? ''}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                last_done_km: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                            className="border border-slate-200 rounded px-1.5 py-0.5 text-xs w-full font-mono"
                            title="Пробег при последней замене"
                          />
                        </div>
                      ) : (
                        <div>
                          {item.last_done_at ? (
                            <div className="font-medium text-slate-800">
                              {fmtDate(item.last_done_at)}
                            </div>
                          ) : null}
                          {item.last_done_km ? (
                            <div className="text-xs text-slate-500 font-mono">
                              {item.last_done_km.toLocaleString('ru-RU')} км
                            </div>
                          ) : null}
                          {!item.last_done_at && !item.last_done_km && (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        {item.next_due_at ? (
                          <div className="font-medium text-slate-800">
                            {fmtDate(item.next_due_at)}
                          </div>
                        ) : null}
                        {item.next_due_km ? (
                          <div className="text-xs text-slate-500 font-mono">
                            {item.next_due_km.toLocaleString('ru-RU')} км
                          </div>
                        ) : null}
                        {!item.next_due_at && !item.next_due_km && (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        {diffDays !== null && (
                          <div
                            className={cn(
                              'font-semibold text-xs',
                              diffDays < 0
                                ? 'text-red-600'
                                : diffDays === 0
                                  ? 'text-red-600'
                                  : diffDays <= 30
                                    ? 'text-amber-600'
                                    : 'text-slate-700',
                            )}
                          >
                            {diffDays < 0
                              ? `Просрочено на ${Math.abs(diffDays)} дн.`
                              : diffDays === 0
                                ? 'Срок сегодня!'
                                : `${diffDays} дн. осталось`}
                          </div>
                        )}
                        {rem !== null && (
                          <div
                            className={cn(
                              'text-xs font-mono',
                              rem < 0
                                ? 'text-red-500 font-medium'
                                : rem < 1500
                                  ? 'text-amber-600'
                                  : 'text-slate-400',
                            )}
                          >
                            {rem < 0
                              ? `Просрочено: ${Math.abs(rem).toLocaleString('ru-RU')} км`
                              : `${rem.toLocaleString('ru-RU')} км`}
                          </div>
                        )}
                        {diffDays === null && rem === null && (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'badge text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1',
                          ALERT_COLOR[item.alert_status] ?? 'bg-slate-100 text-slate-700',
                        )}
                      >
                        {item.alert_status === 'overdue' && '⚠️ '}
                        {item.alert_status === 'soon' && '⏳ '}
                        {item.alert_status === 'ok' && '✓ '}
                        {ALERT_LABEL[item.alert_status] ?? item.alert_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => updateMutation.mutate({ id: item.id, body: editForm })}
                            className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
                            title="Сохранить"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition"
                            title="Отмена"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => startEdit(item)}
                            className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
                            title="Редактировать регламент"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate(item.id)}
                            className="text-xs text-slate-400 hover:text-red-600 px-2 py-1 rounded-lg border border-slate-200 hover:bg-red-50 transition"
                            title="Удалить регламент"
                          >
                            🗑
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════ CLIENTS SECTION ══════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────────────────

type StoClient = {
  id: string;
  name: string;
  phone: string | null;
  vehicles_count: number;
  orders_count: number;
  total_revenue: string;
  last_order_date: string | null;
};

type ClientVehicle = {
  id: string;
  brand: string;
  model: string | null;
  year: number | null;
  reg_number: string;
  vin: string | null;
  color: string | null;
  odometer_last: number | null;
  odometer_updated_at: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  counterparty: { id: string; name: string; phone: string | null } | null;
};

type VehicleRule = {
  id: string;
  work_name: string;
  interval_km: number | null;
  interval_months: number | null;
  last_done_km: number | null;
  last_done_at: string | null;
};

type VehicleRec = {
  id: string;
  text: string;
  due_km: number | null;
  due_date: string | null;
  is_done: boolean;
  done_at: string | null;
  created_at: string;
  created_user: { name: string } | null;
};

type VehicleOrder = {
  id: string;
  order_number: number;
  created_at: string;
  status: string;
  lifecycle_status: string;
  problem_description: string | null;
  odometer_start: number | null;
  odometer_end: number | null;
  mechanic: { id: string; name: string } | null;
  works_cost: string;
  parts_cost: string;
  total_cost: string;
  works: Array<{
    id: string;
    status: string;
    price_client: string | null;
    custom_work_name: string | null;
    work_catalog: { name: string } | null;
  }>;
  parts: Array<{
    id: string;
    quantity: number;
    custom_part_name: string | null;
    part: { name: string; unit: string } | null;
  }>;
};

type VehicleDetail = {
  vehicle: ClientVehicle;
  orders: VehicleOrder[];
  rules: VehicleRule[];
  recommendations: VehicleRec[];
};

function ruleAlert(rule: VehicleRule, odometer: number | null): 'ok' | 'soon' | 'overdue' | null {
  const now = new Date();
  let kmStatus: 'ok' | 'soon' | 'overdue' | null = null;
  let dateStatus: 'ok' | 'soon' | 'overdue' | null = null;

  if (rule.interval_km && rule.last_done_km && odometer) {
    const nextKm = rule.last_done_km + rule.interval_km;
    const remaining = nextKm - odometer;
    if (remaining <= 0) kmStatus = 'overdue';
    else if (remaining <= rule.interval_km * 0.15) kmStatus = 'soon';
    else kmStatus = 'ok';
  }

  if (rule.interval_months && rule.last_done_at) {
    const nextDate = new Date(rule.last_done_at);
    nextDate.setMonth(nextDate.getMonth() + rule.interval_months);
    const daysLeft = Math.ceil((nextDate.getTime() - now.getTime()) / 86400000);
    if (daysLeft <= 0) dateStatus = 'overdue';
    else if (daysLeft <= 30) dateStatus = 'soon';
    else dateStatus = 'ok';
  }

  const statuses = [kmStatus, dateStatus].filter(Boolean) as Array<'ok' | 'soon' | 'overdue'>;
  if (statuses.includes('overdue')) return 'overdue';
  if (statuses.includes('soon')) return 'soon';
  if (statuses.includes('ok')) return 'ok';
  return null;
}

// ─── STO Clients Detail Types ─────────────────────────────────────────────────

type StoClientVehicle = {
  id: string;
  brand: string;
  model: string | null;
  year: number | null;
  reg_number: string;
  vin: string | null;
  color: string | null;
  odometer_last: number | null;
  notes: string | null;
  total_spent: string;
  orders: Array<{
    id: string;
    order_number: number;
    created_at: string;
    status: string;
    lifecycle_status: string;
    problem_description: string | null;
    admin_note: string | null;
    total: string;
    mechanic: { name: string } | null;
    second_mechanic: { name: string } | null;
    works: Array<{
      id: string;
      custom_work_name: string | null;
      price_client: string | null;
      status: string;
      work_catalog: { name: string } | null;
    }>;
    parts: Array<{
      id: string;
      custom_part_name: string | null;
      quantity: number;
      unit: string | null;
      client_price: string | null;
      part: { name: string; unit: string } | null;
    }>;
  }>;
};

type StoClientDetail = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  vehicles: StoClientVehicle[];
};

// ─── Create Client Modal (клиент + первый автомобиль за один шаг) ────────────

function CreateClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [client, setClient] = useState({ name: '', phone: '' });
  const [vehicle, setVehicle] = useState({
    brand: '',
    model: '',
    reg_number: '',
    year: '',
    vin: '',
    color: '',
  });
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/garage/sto-clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...client, ...vehicle }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Ошибка');
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sto-clients'] });
      onCreated();
    },
    onError: (e: Error) => setError(e.message),
  });

  const canSubmit = client.name.trim() && vehicle.brand.trim() && vehicle.reg_number.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Новый клиент СТО</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-6 space-y-5">
          {/* Клиент */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Клиент</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                  Имя / организация *
                </label>
                <input
                  value={client.name}
                  onChange={(e) => setClient({ ...client, name: e.target.value })}
                  placeholder="Иванов Иван"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                  Телефон
                </label>
                <input
                  value={client.phone}
                  onChange={(e) => setClient({ ...client, phone: e.target.value })}
                  placeholder="+7 900 000-00-00"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Автомобиль */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
              Автомобиль
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                    Марка *
                  </label>
                  <input
                    value={vehicle.brand}
                    onChange={(e) => setVehicle({ ...vehicle, brand: e.target.value })}
                    placeholder="Toyota"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                    Модель
                  </label>
                  <input
                    value={vehicle.model}
                    onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })}
                    placeholder="Camry"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                    Госномер *
                  </label>
                  <input
                    value={vehicle.reg_number}
                    onChange={(e) => setVehicle({ ...vehicle, reg_number: e.target.value })}
                    placeholder="А123ВС96"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                    Год
                  </label>
                  <input
                    value={vehicle.year}
                    onChange={(e) => setVehicle({ ...vehicle, year: e.target.value })}
                    placeholder="2020"
                    type="number"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                    VIN
                  </label>
                  <input
                    value={vehicle.vin}
                    onChange={(e) => setVehicle({ ...vehicle, vin: e.target.value })}
                    placeholder="JTMBE..."
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                    Цвет
                  </label>
                  <input
                    value={vehicle.color}
                    onChange={(e) => setVehicle({ ...vehicle, color: e.target.value })}
                    placeholder="Белый"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="border-t border-slate-100 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-slate-300 text-slate-700 font-semibold py-2.5 rounded-xl text-sm"
          >
            Отмена
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit || mutation.isPending}
            className="flex-1 bg-slate-900 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-40"
          >
            {mutation.isPending ? '...' : 'Добавить клиента'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientsSection() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [showCreateVehicle, setShowCreateVehicle] = useState(false);

  const {
    data: clients = [],
    isLoading,
    error: clientsError,
  } = useQuery<StoClient[]>({
    queryKey: ['sto-clients', search],
    queryFn: async () => {
      const r = await fetch(`/api/garage/sto-clients?search=${encodeURIComponent(search)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Ошибка загрузки');
      return Array.isArray(d) ? d : [];
    },
    staleTime: 30000,
  });

  const { data: detail, isLoading: detailLoading } = useQuery<StoClientDetail>({
    queryKey: ['sto-client-detail', selectedId],
    queryFn: async () => {
      const r = await fetch(`/api/garage/sto-clients/${selectedId}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Ошибка');
      return d;
    },
    enabled: !!selectedId,
    staleTime: 15000,
  });

  return (
    <div className="space-y-3">
      {/* Шапка раздела клиентов и поиск */}
      <div className="flex items-center justify-between flex-wrap gap-2 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Поиск клиента по названию, телефону..."
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:bg-white focus:outline-hidden focus:border-sky-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateClient(true)}
            className="text-xs font-bold px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>➕</span>
            <span>Новый клиент</span>
          </button>
          <button
            onClick={() => setShowCreateVehicle(true)}
            className="text-xs font-bold px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>🚗</span>
            <span>Добавить авто</span>
          </button>
        </div>
      </div>

      {/* Список клиентов в виде красивых строчных карточек (как заказ-наряды) */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : clientsError ? (
        <div className="p-8 text-center text-rose-500 text-xs font-bold bg-white rounded-2xl border border-rose-200">
          Ошибка: {(clientsError as Error).message}
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
          <p className="text-4xl mb-2">👥</p>
          <p className="font-bold text-slate-600">Клиентов СТО пока нет</p>
          <p className="text-xs text-slate-400 mt-1">
            Добавляйте сторонних клиентов для учёта коммерческих ремонтов и расширения базы
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className="bg-white border border-slate-200 hover:border-indigo-300 rounded-xl px-4 py-2.5 cursor-pointer hover:shadow-xs transition-all flex items-center justify-between gap-3 group"
            >
              {/* Левая часть: иконка, имя, телефон, количество авто и нарядов */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200/70 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  🏢
                </div>
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="font-bold text-sm text-slate-900 truncate">{c.name}</span>
                  {c.phone && (
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60">
                      📞 {c.phone}
                    </span>
                  )}
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60">
                    🚗 {c.vehicles_count} {c.vehicles_count === 1 ? 'авто' : 'авто'}
                  </span>
                  <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                    📋 {c.orders_count} нарядов
                  </span>
                </div>
              </div>

              {/* Правая часть: выручка и кнопка шестеренки */}
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Выручка
                  </span>
                  <span className="font-black text-sm text-emerald-700">
                    {parseFloat(c.total_revenue || '0') > 0
                      ? `${parseFloat(c.total_revenue).toLocaleString('ru-RU')} ₽`
                      : '0 ₽'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(c.id);
                  }}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
                  title="Открыть карточку и настройки"
                >
                  ⚙️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Модальное окно 100% информации о клиенте (с редактированием по шестерёнке) ── */}
      {selectedId && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-indigo-50/60">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <span>🏢</span>
                <span>Карточка клиента СТО</span>
              </h3>
              <button
                onClick={() => setSelectedId(null)}
                className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {detailLoading ? (
                <div className="p-12 text-center text-slate-400 text-sm font-semibold">
                  Загрузка полной информации о клиенте...
                </div>
              ) : detail ? (
                <StoClientDetailView
                  detail={detail}
                  onUpdate={() => {
                    qc.invalidateQueries({ queryKey: ['sto-client-detail', selectedId] });
                    qc.invalidateQueries({ queryKey: ['sto-clients'] });
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {showCreateClient && (
        <CreateClientModal
          onClose={() => setShowCreateClient(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['sto-clients'] });
            setShowCreateClient(false);
          }}
        />
      )}
      {showCreateVehicle && (
        <CreateVehicleModal
          onClose={() => setShowCreateVehicle(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['sto-clients'] });
            setShowCreateVehicle(false);
          }}
        />
      )}
    </div>
  );
}

function StoClientDetailView({
  detail,
  onUpdate,
}: {
  detail: StoClientDetail;
  onUpdate: () => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState(detail.name);
  const [editPhone, setEditPhone] = useState(detail.phone ?? '');
  const [editNotes, setEditNotes] = useState(detail.notes ?? '');
  const [expandedVehicle, setExpandedVehicle] = useState<string | null>(
    detail.vehicles.length === 1 ? (detail.vehicles[0]?.id ?? null) : null,
  );
  const [vehicleDetailId, setVehicleDetailId] = useState<string | null>(null);

  const { data: vehicleDetail, isLoading: vehicleDetailLoading } = useQuery<VehicleDetail>({
    queryKey: ['client-vehicle-detail', vehicleDetailId],
    queryFn: async () => {
      const r = await fetch(`/api/garage/client-vehicles/${vehicleDetailId}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Ошибка');
      return d;
    },
    enabled: !!vehicleDetailId,
    staleTime: 15000,
  });

  const patchClient = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/garage/sto-clients/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, phone: editPhone, notes: editNotes }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Ошибка');
      return d;
    },
    onSuccess: () => {
      setEditMode(false);
      onUpdate();
    },
  });

  const totalRevenue = detail.vehicles.reduce((s, v) => s + parseFloat(v.total_spent), 0);
  const totalOrders = detail.vehicles.reduce((s, v) => s + v.orders.length, 0);

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      {/* Шапка клиента */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        {editMode ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                  Имя
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                  Телефон
                </label>
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                Заметки
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditMode(false)}
                className="text-sm text-slate-500 hover:underline"
              >
                Отмена
              </button>
              <button
                onClick={() => patchClient.mutate()}
                disabled={patchClient.isPending || !editName.trim()}
                className="text-sm px-4 py-1.5 bg-slate-900 text-white rounded-lg font-semibold disabled:opacity-40"
              >
                {patchClient.isPending ? '...' : 'Сохранить'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">{detail.name}</h2>
              {detail.phone && <div className="text-sm text-slate-500 mt-0.5">{detail.phone}</div>}
              {detail.notes && (
                <div className="text-sm text-slate-400 mt-1 italic">{detail.notes}</div>
              )}
            </div>
            <div className="flex items-start gap-4 shrink-0">
              <div className="text-right">
                <div className="text-xs text-slate-400 uppercase font-semibold">Выручка</div>
                <div className="text-2xl font-black text-slate-900">
                  {totalRevenue.toLocaleString('ru-RU')} ₽
                </div>
                <div className="text-xs text-slate-400">
                  {detail.vehicles.length} авто · {totalOrders} нарядов
                </div>
              </div>
              <button
                onClick={() => setEditMode(true)}
                className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-semibold mt-1"
              >
                Изменить
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Список автомобилей */}
      {detail.vehicles.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">
          У этого клиента нет автомобилей
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide px-1">
            Автомобили
          </h3>
          {detail.vehicles.map((v) => {
            const isExpanded = expandedVehicle === v.id;
            return (
              <div
                key={v.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
              >
                {/* Vehicle header */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-bold text-slate-900">
                        {v.brand} {v.model ?? ''} {v.year ? `· ${v.year}` : ''}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="font-mono text-sm text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {v.reg_number}
                        </span>
                        {v.vin && <span className="text-xs text-slate-400">VIN: {v.vin}</span>}
                        {v.odometer_last && (
                          <span className="text-xs text-slate-400">
                            {v.odometer_last.toLocaleString('ru-RU')} км
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-black text-slate-900">
                        {parseFloat(v.total_spent).toLocaleString('ru-RU')} ₽
                      </div>
                      <div className="text-xs text-slate-400">{v.orders.length} нарядов</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={() => setExpandedVehicle(isExpanded ? null : v.id)}
                      className="text-xs text-blue-500 hover:text-blue-700"
                    >
                      {isExpanded ? '▲ Скрыть историю' : '▼ История нарядов'}
                    </button>
                    <button
                      onClick={() => setVehicleDetailId(vehicleDetailId === v.id ? null : v.id)}
                      className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-2 py-0.5"
                    >
                      {vehicleDetailId === v.id ? 'Скрыть карточку' : 'Карточка ТО'}
                    </button>
                  </div>
                </div>

                {/* Full vehicle card (maintenance rules & recommendations) */}
                {vehicleDetailId === v.id && (
                  <div className="border-t border-slate-100">
                    {vehicleDetailLoading ? (
                      <div className="p-4 text-sm text-slate-400">Загрузка карточки...</div>
                    ) : vehicleDetail ? (
                      <VehicleCard
                        detail={vehicleDetail}
                        onUpdate={() => {
                          onUpdate();
                        }}
                      />
                    ) : null}
                  </div>
                )}

                {/* Order history */}
                {isExpanded && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100">
                    {v.orders.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-slate-400">
                        Нарядов нет
                      </div>
                    ) : (
                      v.orders.map((o) => (
                        <div key={o.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-bold text-slate-900 text-sm">
                                Наряд #{o.order_number}
                              </span>
                              <span
                                className={cn(
                                  'ml-2 text-xs px-2 py-0.5 rounded-full font-semibold',
                                  o.lifecycle_status === 'approved'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : o.lifecycle_status === 'cancelled'
                                      ? 'bg-red-100 text-red-600'
                                      : 'bg-amber-100 text-amber-700',
                                )}
                              >
                                {o.lifecycle_status === 'approved'
                                  ? 'Принят'
                                  : o.lifecycle_status === 'cancelled'
                                    ? 'Отменён'
                                    : 'В работе'}
                              </span>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-black text-slate-900 text-sm">
                                {parseFloat(o.total).toLocaleString('ru-RU')} ₽
                              </div>
                              <div className="text-xs text-slate-400">
                                {new Date(o.created_at).toLocaleDateString('ru-RU')}
                              </div>
                            </div>
                          </div>
                          {o.problem_description && (
                            <p className="text-xs text-slate-500 mt-1">{o.problem_description}</p>
                          )}
                          {(o.mechanic || o.second_mechanic) && (
                            <div className="text-xs text-slate-400 mt-0.5">
                              Мастер:{' '}
                              {[o.mechanic?.name, o.second_mechanic?.name]
                                .filter(Boolean)
                                .join(', ')}
                            </div>
                          )}
                          {o.works.length > 0 && (
                            <div className="mt-2 space-y-0.5">
                              {o.works.map((w) => (
                                <div
                                  key={w.id}
                                  className="flex justify-between text-xs text-slate-600"
                                >
                                  <span>{w.work_catalog?.name ?? w.custom_work_name ?? '—'}</span>
                                  {w.price_client && (
                                    <span className="font-mono text-slate-500">
                                      {parseFloat(w.price_client).toLocaleString('ru-RU')} ₽
                                    </span>
                                  )}
                                </div>
                              ))}
                              {o.parts.map((p) => (
                                <div
                                  key={p.id}
                                  className="flex justify-between text-xs text-slate-400 italic"
                                >
                                  <span>
                                    {p.part?.name ?? p.custom_part_name ?? '—'} × {p.quantity}{' '}
                                    {p.unit ?? p.part?.unit ?? ''}
                                  </span>
                                  {p.client_price && (
                                    <span className="font-mono not-italic">
                                      {(parseFloat(p.client_price) * p.quantity).toLocaleString(
                                        'ru-RU',
                                      )}{' '}
                                      ₽
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {o.admin_note && (
                            <div className="mt-1 text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">
                              Заметка: {o.admin_note}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VehicleCard({ detail, onUpdate }: { detail: VehicleDetail; onUpdate: () => void }) {
  const { vehicle, orders, rules, recommendations } = detail;
  const [tab, setTab] = useState<'history' | 'rules' | 'recs'>('history');
  const [editOdo, setEditOdo] = useState('');
  const [showAddRule, setShowAddRule] = useState(false);
  const [showAddRec, setShowAddRec] = useState('');
  const [editNotes, setEditNotes] = useState<string | null>(null);

  const patchVehicle = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch(`/api/garage/client-vehicles/${vehicle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: onUpdate,
  });

  const addRec = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch(`/api/garage/client-vehicles/${vehicle.id}/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      setShowAddRec('');
      onUpdate();
    },
  });

  const patchRec = useMutation({
    mutationFn: ({ recId, body }: { recId: string; body: Record<string, unknown> }) =>
      fetch(`/api/garage/client-vehicles/${vehicle.id}/recommendations?rec_id=${recId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: onUpdate,
  });

  const addRule = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch(`/api/garage/client-vehicles/${vehicle.id}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      setShowAddRule(false);
      onUpdate();
    },
  });

  const patchRule = useMutation({
    mutationFn: ({ ruleId, body }: { ruleId: string; body: Record<string, unknown> }) =>
      fetch(`/api/garage/client-vehicles/${vehicle.id}/rules?rule_id=${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: onUpdate,
  });

  const totalSpent = orders.reduce((s, o) => s + parseFloat(o.total_cost), 0);
  const openRecs = recommendations.filter((r) => !r.is_done);
  const alertRules = rules.filter((r) => {
    const st = ruleAlert(r, vehicle.odometer_last);
    return st === 'overdue' || st === 'soon';
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Шапка машины */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              {vehicle.brand} {vehicle.model ?? ''} {vehicle.year ? `· ${vehicle.year}` : ''}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="font-mono text-sm font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                {vehicle.reg_number}
              </span>
              {vehicle.vin && <span className="text-xs text-slate-400">VIN: {vehicle.vin}</span>}
              {vehicle.color && <span className="text-xs text-slate-400">{vehicle.color}</span>}
            </div>
            {vehicle.counterparty && (
              <div className="mt-2 text-sm text-slate-600">
                Клиент: <span className="font-semibold">{vehicle.counterparty.name}</span>
                {vehicle.counterparty.phone && (
                  <span className="text-slate-400 ml-2">{vehicle.counterparty.phone}</span>
                )}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-slate-400 uppercase font-semibold">Потрачено всего</div>
            <div className="text-2xl font-black text-slate-900">
              {totalSpent.toLocaleString('ru-RU')} ₽
            </div>
            <div className="text-xs text-slate-400">{orders.length} визитов</div>
          </div>
        </div>

        {/* Одометр */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-3">
          <div className="flex-1">
            <span className="text-xs text-slate-400 uppercase font-semibold">Одометр</span>
            <div className="text-base font-bold text-slate-900">
              {vehicle.odometer_last
                ? `${vehicle.odometer_last.toLocaleString('ru-RU')} км`
                : 'не указан'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={editOdo}
              onChange={(e) => setEditOdo(e.target.value)}
              placeholder="Обновить..."
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-36"
            />
            <button
              onClick={() => {
                if (!editOdo) return;
                patchVehicle.mutate({ odometer_last: editOdo });
                setEditOdo('');
              }}
              disabled={!editOdo || patchVehicle.isPending}
              className="text-xs px-3 py-1.5 bg-slate-900 text-white rounded-lg font-semibold disabled:opacity-40"
            >
              Сохранить
            </button>
          </div>
        </div>

        {/* Предупреждения */}
        {(alertRules.length > 0 || openRecs.length > 0) && (
          <div className="mt-4 space-y-2">
            {alertRules.map((rule) => {
              const st = ruleAlert(rule, vehicle.odometer_last);
              return (
                <div
                  key={rule.id}
                  className={cn(
                    'flex items-start gap-2 text-sm px-3 py-2 rounded-lg',
                    st === 'overdue' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700',
                  )}
                >
                  <span className="font-bold shrink-0">{st === 'overdue' ? '⚠' : '!'}</span>
                  <span>
                    <span className="font-semibold">{rule.work_name}</span>
                    {st === 'overdue' ? ' — просрочено' : ' — скоро'}
                    {rule.interval_km && rule.last_done_km && vehicle.odometer_last && (
                      <span className="ml-1 text-xs opacity-70">
                        (осталось{' '}
                        {(
                          rule.last_done_km +
                          rule.interval_km -
                          vehicle.odometer_last
                        ).toLocaleString('ru-RU')}{' '}
                        км)
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
            {openRecs.length > 0 && (
              <div className="bg-blue-50 text-blue-700 text-sm px-3 py-2 rounded-lg">
                <span className="font-semibold">{openRecs.length} открытых рекомендаций</span> от
                мастера
              </div>
            )}
          </div>
        )}

        {/* Заметки */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          {editNotes !== null ? (
            <div className="flex gap-2">
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"
                placeholder="Особенности, пожелания клиента..."
              />
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => {
                    patchVehicle.mutate({ notes: editNotes });
                    setEditNotes(null);
                  }}
                  className="text-xs px-3 py-1.5 bg-slate-900 text-white rounded-lg font-semibold"
                >
                  Сохранить
                </button>
                <button
                  onClick={() => setEditNotes(null)}
                  className="text-xs text-slate-500 hover:underline"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditNotes(vehicle.notes ?? '')}
              className="text-sm text-slate-400 hover:text-slate-700 text-left w-full"
            >
              {vehicle.notes ? vehicle.notes : '+ Добавить заметку по автомобилю...'}
            </button>
          )}
        </div>
      </div>

      {/* Вкладки */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
        {(
          [
            { id: 'history' as const, label: `История (${orders.length})` },
            { id: 'rules' as const, label: `Регламент (${rules.length})` },
            { id: 'recs' as const, label: `Рекомендации (${recommendations.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 text-sm font-semibold py-2 rounded-lg transition-colors',
              tab === t.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* История нарядов */}
      {tab === 'history' && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              Нарядов по этой машине нет
            </div>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="font-bold text-slate-900">Наряд #{o.order_number}</span>
                    <span
                      className={cn(
                        'ml-2 text-xs px-2 py-0.5 rounded-full font-semibold',
                        STATUS_COLOR[o.status],
                      )}
                    >
                      {STATUS_LABEL[o.status]}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-black text-slate-900">
                      {parseFloat(o.total_cost).toLocaleString('ru-RU')} ₽
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(o.created_at).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                </div>
                {o.problem_description && (
                  <p className="text-sm text-slate-600 mb-2">{o.problem_description}</p>
                )}
                {o.mechanic && (
                  <div className="text-xs text-slate-400 mb-2">Мастер: {o.mechanic.name}</div>
                )}
                {o.odometer_start && (
                  <div className="text-xs text-slate-400">
                    Одометр: {o.odometer_start.toLocaleString('ru-RU')} км
                    {o.odometer_end ? ` → ${o.odometer_end.toLocaleString('ru-RU')} км` : ''}
                  </div>
                )}
                {o.works.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                    {o.works.map((w) => (
                      <div key={w.id} className="flex justify-between text-xs text-slate-600">
                        <span>{w.work_catalog?.name ?? w.custom_work_name ?? '—'}</span>
                        {w.price_client && (
                          <span className="font-mono">
                            {parseFloat(w.price_client).toLocaleString('ru-RU')} ₽
                          </span>
                        )}
                      </div>
                    ))}
                    {o.parts.length > 0 &&
                      o.parts.map((p) => (
                        <div key={p.id} className="flex justify-between text-xs text-slate-500">
                          <span className="italic">
                            {p.part?.name ?? p.custom_part_name ?? '—'} × {p.quantity}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Регламенты ТО */}
      {tab === 'rules' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddRule(true)}
              className="text-xs font-semibold px-3 py-1.5 bg-slate-900 text-white rounded-lg"
            >
              + Добавить регламент
            </button>
          </div>
          {showAddRule && (
            <AddRuleForm
              onSubmit={(body) => addRule.mutate(body)}
              onCancel={() => setShowAddRule(false)}
              isPending={addRule.isPending}
            />
          )}
          {rules.length === 0 && !showAddRule ? (
            <div className="text-center py-8 text-slate-400 text-sm">Регламенты не настроены</div>
          ) : (
            rules.map((rule) => {
              const st = ruleAlert(rule, vehicle.odometer_last);
              return (
                <div
                  key={rule.id}
                  className={cn(
                    'bg-white rounded-xl border p-4',
                    st === 'overdue'
                      ? 'border-red-200'
                      : st === 'soon'
                        ? 'border-amber-200'
                        : 'border-slate-200',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-slate-900">{rule.work_name}</div>
                    {st && (
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-semibold shrink-0',
                          st === 'overdue'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700',
                        )}
                      >
                        {st === 'overdue' ? 'Просрочено' : 'Скоро'}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 space-y-0.5">
                    {rule.interval_km && (
                      <div>Каждые {rule.interval_km.toLocaleString('ru-RU')} км</div>
                    )}
                    {rule.interval_months && <div>Каждые {rule.interval_months} мес.</div>}
                    {rule.last_done_km && (
                      <div>
                        Последний раз: {rule.last_done_km.toLocaleString('ru-RU')} км
                        {rule.last_done_at
                          ? ` · ${new Date(rule.last_done_at).toLocaleDateString('ru-RU')}`
                          : ''}
                      </div>
                    )}
                    {rule.interval_km && rule.last_done_km && vehicle.odometer_last && (
                      <div
                        className={cn(
                          'font-semibold',
                          st === 'overdue'
                            ? 'text-red-600'
                            : st === 'soon'
                              ? 'text-amber-600'
                              : 'text-emerald-600',
                        )}
                      >
                        Следующий: {(rule.last_done_km + rule.interval_km).toLocaleString('ru-RU')}{' '}
                        км (осталось{' '}
                        {(
                          rule.last_done_km +
                          rule.interval_km -
                          vehicle.odometer_last
                        ).toLocaleString('ru-RU')}{' '}
                        км)
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => {
                        const km = prompt('Одометр при последней замене (км):');
                        const date = prompt('Дата последней замены (ГГГГ-ММ-ДД):');
                        if (km)
                          patchRule.mutate({
                            ruleId: rule.id,
                            body: { last_done_km: km, last_done_at: date || null },
                          });
                      }}
                      className="text-xs px-3 py-1 border border-slate-300 rounded-lg hover:bg-slate-50 font-semibold"
                    >
                      Обновить данные
                    </button>
                    <button
                      onClick={() =>
                        patchRule.mutate({ ruleId: rule.id, body: { is_active: false } })
                      }
                      className="text-xs px-2 py-1 text-red-400 hover:text-red-600"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Рекомендации */}
      {tab === 'recs' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddRec('new')}
              className="text-xs font-semibold px-3 py-1.5 bg-slate-900 text-white rounded-lg"
            >
              + Добавить рекомендацию
            </button>
          </div>
          {showAddRec === 'new' && (
            <AddRecForm
              onSubmit={(text, dueKm, dueDate) =>
                addRec.mutate({ text, due_km: dueKm || null, due_date: dueDate || null })
              }
              onCancel={() => setShowAddRec('')}
              isPending={addRec.isPending}
            />
          )}
          {recommendations.length === 0 && showAddRec !== 'new' ? (
            <div className="text-center py-8 text-slate-400 text-sm">Рекомендаций нет</div>
          ) : (
            <div className="space-y-2">
              {recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className={cn(
                    'bg-white rounded-xl border p-4',
                    rec.is_done ? 'border-slate-100 opacity-60' : 'border-slate-200',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() =>
                        patchRec.mutate({ recId: rec.id, body: { is_done: !rec.is_done } })
                      }
                      className={cn(
                        'mt-0.5 w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center',
                        rec.is_done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300',
                      )}
                    >
                      {rec.is_done && <span className="text-white text-xs font-bold">✓</span>}
                    </button>
                    <div className="flex-1">
                      <p
                        className={cn(
                          'text-sm',
                          rec.is_done ? 'line-through text-slate-400' : 'text-slate-800',
                        )}
                      >
                        {rec.text}
                      </p>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {rec.due_km && (
                          <span className="text-xs text-slate-400">
                            до {rec.due_km.toLocaleString('ru-RU')} км
                          </span>
                        )}
                        {rec.due_date && (
                          <span className="text-xs text-slate-400">
                            до {new Date(rec.due_date).toLocaleDateString('ru-RU')}
                          </span>
                        )}
                        <span className="text-xs text-slate-300">
                          {new Date(rec.created_at).toLocaleDateString('ru-RU')}
                          {rec.created_user && ` · ${rec.created_user.name}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddRuleForm({
  onSubmit,
  onCancel,
  isPending,
}: {
  onSubmit: (body: Record<string, unknown>) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [workName, setWorkName] = useState('');
  const [intervalKm, setIntervalKm] = useState('');
  const [intervalMonths, setIntervalMonths] = useState('');
  const [lastKm, setLastKm] = useState('');
  const [lastDate, setLastDate] = useState('');

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-slate-700">Новый регламент</p>
      <input
        type="text"
        value={workName}
        onChange={(e) => setWorkName(e.target.value)}
        placeholder="Название работы (напр. Замена масла)"
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          value={intervalKm}
          onChange={(e) => setIntervalKm(e.target.value)}
          placeholder="Интервал, км"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="number"
          value={intervalMonths}
          onChange={(e) => setIntervalMonths(e.target.value)}
          placeholder="Интервал, мес."
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          value={lastKm}
          onChange={(e) => setLastKm(e.target.value)}
          placeholder="Последний раз, км"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={lastDate}
          onChange={(e) => setLastDate(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 border border-slate-300 text-slate-600 rounded-lg py-2 text-sm font-semibold"
        >
          Отмена
        </button>
        <button
          disabled={!workName || isPending}
          onClick={() =>
            onSubmit({
              work_name: workName,
              interval_km: intervalKm,
              interval_months: intervalMonths,
              last_done_km: lastKm,
              last_done_at: lastDate,
            })
          }
          className="flex-1 bg-slate-900 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-40"
        >
          Добавить
        </button>
      </div>
    </div>
  );
}

function AddRecForm({
  onSubmit,
  onCancel,
  isPending,
}: {
  onSubmit: (text: string, dueKm: string, dueDate: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [text, setText] = useState('');
  const [dueKm, setDueKm] = useState('');
  const [dueDate, setDueDate] = useState('');

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-slate-700">Новая рекомендация</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Что рекомендует мастер..."
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          value={dueKm}
          onChange={(e) => setDueKm(e.target.value)}
          placeholder="Сделать до, км"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 border border-slate-300 text-slate-600 rounded-lg py-2 text-sm font-semibold"
        >
          Отмена
        </button>
        <button
          disabled={!text || isPending}
          onClick={() => onSubmit(text, dueKm, dueDate)}
          className="flex-1 bg-slate-900 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-40"
        >
          Добавить
        </button>
      </div>
    </div>
  );
}

function CreateVehicleModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id?: string) => void;
}) {
  const [form, setForm] = useState({
    brand: '',
    model: '',
    year: '',
    reg_number: '',
    vin: '',
    color: '',
    odometer_last: '',
    notes: '',
  });
  const [selectedCounterparty, setSelectedCounterparty] = useState<CounterpartyOption | null>(null);
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/garage/client-vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, counterparty_id: selectedCounterparty?.id ?? null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Ошибка');
      return d;
    },
    onSuccess: (data) => onCreated(data.id),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Новый автомобиль клиента</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                Марка *
              </label>
              <input
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="Toyota"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                Модель
              </label>
              <input
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="Camry"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                Госномер *
              </label>
              <input
                value={form.reg_number}
                onChange={(e) => setForm({ ...form, reg_number: e.target.value })}
                placeholder="А123ВС96"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                Год
              </label>
              <input
                type="number"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
                placeholder="2020"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                VIN
              </label>
              <input
                value={form.vin}
                onChange={(e) => setForm({ ...form, vin: e.target.value })}
                placeholder="JTMBE..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                Цвет
              </label>
              <input
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                placeholder="Белый"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
              Клиент
            </label>
            <CounterpartySubForm
              value={selectedCounterparty}
              onChange={setSelectedCounterparty}
              stoOnly
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
              Текущий одометр, км
            </label>
            <input
              type="number"
              value={form.odometer_last}
              onChange={(e) => setForm({ ...form, odometer_last: e.target.value })}
              placeholder="150000"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="border-t border-slate-100 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-slate-300 text-slate-700 font-semibold py-2.5 rounded-xl text-sm"
          >
            Отмена
          </button>
          <button
            disabled={!form.brand || !form.reg_number || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="flex-1 bg-slate-900 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-40"
          >
            {createMutation.isPending ? '...' : 'Добавить автомобиль'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════ SETTINGS MODAL ═══════════════════════════════════

function SettingsModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<SettingsData>({
    queryKey: ['garage-settings'],
    queryFn: () => fetch('/api/garage/settings').then((r) => r.json()),
  });
  const [rate, setRate] = useState('');
  const [rateOwn, setRateOwn] = useState('');
  const [mechPct, setMechPct] = useState<Record<string, string>>({});
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (!data) return;
    setRate(data.sto?.hourly_rate ?? '2000');
    setRateOwn(data.sto?.hourly_rate_own ?? '1600');
    const pctMap: Record<string, string> = {};
    for (const m of data.mechanics ?? []) pctMap[m.id] = m.mechanic_salary_pct ?? '40';
    setMechPct(pctMap);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch('/api/garage/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garage-settings'] });
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1000);
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 bg-sky-50/70 border-b border-sky-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900">⚙️ Настройки СТО и ставок</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ставки нормо-часа и базовый процент оплаты механикам
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Загрузка настроек...</div>
        ) : (
          <div className="p-5 space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Ставка нормо-часа для своего автопарка (₽/час)
              </label>
              <input
                type="number"
                value={rateOwn}
                onChange={(e) => setRateOwn(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-800"
              />
              <span className="text-[10px] text-slate-400">
                Используется для калькуляции себестоимости обслуживания
              </span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Ставка нормо-часа для сторонних клиентов (₽/час)
              </label>
              <input
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-full px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-xl font-black text-emerald-900"
              />
              <span className="text-[10px] text-slate-400">
                Выставляется в заказ-нарядах коммерческим клиентам
              </span>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <label className="block font-bold text-slate-700 mb-1">
                Базовый процент зарплаты механиков (%)
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {(data?.mechanics ?? []).map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200/70"
                  >
                    <span className="font-semibold text-slate-800 truncate">{m.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={mechPct[m.id] ?? '40'}
                        onChange={(e) => setMechPct({ ...mechPct, [m.id]: e.target.value })}
                        className="w-14 px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-bold text-xs"
                      />
                      <span className="text-slate-400 font-bold">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {savedSuccess && (
              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-center font-bold">
                ✓ Настройки успешно сохранены
              </div>
            )}
          </div>
        )}

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 font-bold"
          >
            Отмена
          </button>
          <button
            onClick={async () => {
              await saveMutation.mutateAsync({
                hourly_rate: rate,
                hourly_rate_own: rateOwn,
              });
              for (const [mId, pct] of Object.entries(mechPct)) {
                await fetch('/api/garage/settings', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ mechanic_id: mId, mechanic_salary_pct: pct }),
                });
              }
              qc.invalidateQueries({ queryKey: ['garage-settings'] });
              setSavedSuccess(true);
              setTimeout(() => {
                setSavedSuccess(false);
                onClose();
              }, 800);
            }}
            disabled={saveMutation.isPending}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════ MAIN PAGE ═══════════════════════════════════════

// ── Date & Period Navigation (Clean Sky/Emerald Theme) ───────────────────────
function DatePeriodNav({
  period,
  setPeriod,
  date,
  setDate,
}: {
  period: 'all' | 'day' | 'week' | 'month';
  setPeriod: (p: 'all' | 'day' | 'week' | 'month') => void;
  date: string;
  setDate: (d: string) => void;
}) {
  const today = todayStr();

  const shift = (amount: number) => {
    const d = new Date(date + 'T12:00:00');
    if (period === 'day') {
      d.setDate(d.getDate() + amount);
    } else if (period === 'week') {
      d.setDate(d.getDate() + amount * 7);
    } else if (period === 'month') {
      d.setMonth(d.getMonth() + amount);
    }
    const s = d.toISOString().slice(0, 10);
    setDate(s <= today ? s : today);
  };

  const getWeekRangeLabel = (dateStr: string) => {
    const { weekStart, weekEnd } = getArchiveWeekDates(dateStr);
    const ws = new Date(weekStart + 'T12:00:00');
    const we = new Date(weekEnd + 'T12:00:00');
    return `${ws.getDate()} ${ws.toLocaleDateString('ru-RU', { month: 'short' })} — ${we.getDate()} ${we.toLocaleDateString('ru-RU', { month: 'short' })}`;
  };

  const getMonthLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  };

  const getDayLabel = (dateStr: string) => {
    if (dateStr === today) return 'Сегодня';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  };

  return (
    <div className="flex flex-wrap items-center justify-between bg-white border border-slate-200/80 rounded-2xl p-2.5 gap-2 shadow-2xs">
      {/* Кнопки переключения периода */}
      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
        <button
          type="button"
          onClick={() => setPeriod('all')}
          className={cn(
            'px-3 py-1 rounded-lg transition-all cursor-pointer',
            period === 'all'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-500 hover:text-slate-900',
          )}
        >
          Все время
        </button>
        <button
          type="button"
          onClick={() => setPeriod('day')}
          className={cn(
            'px-3 py-1 rounded-lg transition-all cursor-pointer',
            period === 'day'
              ? 'bg-white text-sky-700 shadow-2xs'
              : 'text-slate-500 hover:text-slate-900',
          )}
        >
          День
        </button>
        <button
          type="button"
          onClick={() => setPeriod('week')}
          className={cn(
            'px-3 py-1 rounded-lg transition-all cursor-pointer',
            period === 'week'
              ? 'bg-white text-sky-700 shadow-2xs'
              : 'text-slate-500 hover:text-slate-900',
          )}
        >
          Неделя
        </button>
        <button
          type="button"
          onClick={() => setPeriod('month')}
          className={cn(
            'px-3 py-1 rounded-lg transition-all cursor-pointer',
            period === 'month'
              ? 'bg-white text-sky-700 shadow-2xs'
              : 'text-slate-500 hover:text-slate-900',
          )}
        >
          Месяц
        </button>
      </div>

      {/* Селектор даты для периода != 'all' */}
      {period !== 'all' && (
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors cursor-pointer"
            title="Предыдущий период"
          >
            ←
          </button>

          <span className="font-bold text-slate-800 min-w-[130px] text-center capitalize">
            {period === 'day' && getDayLabel(date)}
            {period === 'week' && getWeekRangeLabel(date)}
            {period === 'month' && getMonthLabel(date)}
          </span>

          <button
            type="button"
            onClick={() => shift(1)}
            disabled={date >= today}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title="Следующий период"
          >
            →
          </button>

          {date !== today && (
            <button
              type="button"
              onClick={() => setDate(today)}
              className="text-[11px] font-bold text-sky-600 hover:text-sky-800 bg-sky-50 px-2 py-1 rounded-lg border border-sky-200 transition-colors cursor-pointer ml-1"
            >
              Сегодня
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function GaragePage() {
  const searchParams = useSearchParams();
  const orderFromQuery =
    searchParams.get('order') || searchParams.get('order_id') || searchParams.get('id');
  const tabFromQuery = searchParams.get('tab');

  // 3 основные кнопки: 1. В работе, 2. Ждут оплаты, 3. Архив + Дополнительные вкладки
  const [activeTab, setActiveTab] = useState<
    'active' | 'pending_payment' | 'archive' | 'warehouse' | 'clients' | 'maintenance'
  >(
    (tabFromQuery === 'warehouse' ||
    tabFromQuery === 'clients' ||
    tabFromQuery === 'archive' ||
    tabFromQuery === 'pending_payment' ||
    tabFromQuery === 'maintenance'
      ? tabFromQuery
      : 'active') as any,
  );
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(orderFromQuery || null);

  // Фильтры и навигация по дням, неделям, месяцам
  const [period, setPeriod] = useState<'all' | 'day' | 'week' | 'month'>('all');
  const [periodDate, setPeriodDate] = useState(todayStr());
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'own' | 'client'>('all');

  useEffect(() => {
    if (orderFromQuery) {
      setSelectedOrderId(orderFromQuery);
    }
  }, [orderFromQuery]);

  const qc = useQueryClient();

  // Queries
  const { data: allOrders = [], isLoading: ordersLoading } = useQuery<TabOrder[]>({
    queryKey: ['garage-orders', 'all'],
    queryFn: () =>
      fetch('/api/garage/orders?filter=all')
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['assets-select'],
    queryFn: () => fetch('/api/garage/assets').then((r) => r.json()),
    staleTime: 300000,
  });

  const { data: mechanics = [] } = useQuery<Mechanic[]>({
    queryKey: ['mechanics-list'],
    queryFn: () => fetch('/api/users?role=mechanic').then((r) => r.json()),
    staleTime: 300000,
  });

  const { data: partsData } = useQuery<{ totals?: { totalStockVal: number } }>({
    queryKey: ['garage-parts', 'all', ''],
    queryFn: () => fetch('/api/garage/parts').then((r) => r.json()),
    staleTime: 60000,
  });

  const { data: clientsData = [] } = useQuery<any[]>({
    queryKey: ['garage-clients'],
    queryFn: () => fetch('/api/garage/clients').then((r) => r.json()),
    staleTime: 60000,
  });

  const { data: maintenanceItems = [] } = useQuery<MaintenanceItem[]>({
    queryKey: ['garage-maintenance'],
    queryFn: () =>
      fetch('/api/garage/maintenance')
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
    staleTime: 60000,
  });

  // 1. В РАБОТЕ: ТОЛЬКО ТЕ МАШИНЫ, ПО КОТОРЫМ ЕЩЕ БУДУТ ПРОХОДИТЬ РАБОТЫ (НЕТ ЗАКРЫТЫХ!)
  const activeOrders = useMemo(() => {
    return allOrders.filter((o) => {
      const isCancelled = o.lifecycle_status === 'cancelled' || o.status === 'cancelled';
      if (isCancelled) return false;
      // Если наряд закрыт или подтверждён — он не в работе!
      if (o.status === 'completed') return false;
      if (o.lifecycle_status === 'approved') return false;
      return o.status === 'in_progress' || o.status === 'created' || o.lifecycle_status === 'draft';
    });
  }, [allOrders]);

  // 2. ЖДУТ ОПЛАТЫ: МАШИНЫ КЛИЕНТОВ, РАБОТЫ ПО КОТОРЫМ ЗАКОНЧЕНЫ, НО НЕТ ОПЛАТЫ
  const pendingPaymentOrders = useMemo(() => {
    return allOrders.filter((o) => {
      const isCancelled = o.lifecycle_status === 'cancelled' || o.status === 'cancelled';
      if (isCancelled) return false;
      return (
        o.machine_type === 'client' &&
        !o.payment_received &&
        (o.status === 'completed' || o.lifecycle_status === 'approved')
      );
    });
  }, [allOrders]);

  // 3. АРХИВ: ОПЛАЧЕННЫЕ КЛИЕНТСКИЕ МАШИНЫ И НАШИ МАШИНЫ, ПО КОТОРЫМ ЗАКОНЧЕНА РАБОТА
  const archiveOrders = useMemo(() => {
    return allOrders.filter((o) => {
      const isCancelled = o.lifecycle_status === 'cancelled' || o.status === 'cancelled';
      if (isCancelled) return true;
      if (o.machine_type === 'own') {
        return o.status === 'completed' || o.lifecycle_status === 'approved';
      }
      if (o.machine_type === 'client') {
        return (
          o.payment_received === true || (o.lifecycle_status === 'approved' && o.payment_received)
        );
      }
      return false;
    });
  }, [allOrders]);

  // Фильтрация текущего пула по типу авто, поиску и выбранному периоду
  const filterByDateAndSearch = (list: TabOrder[]) => {
    let res = list;

    // Фильтр по принадлежности
    if (filterType !== 'all') {
      res = res.filter((o) => o.machine_type === filterType);
    }

    // Фильтр по дате (день, неделя, месяц)
    if (period === 'day') {
      res = res.filter((o) => o.created_at?.startsWith(periodDate));
    } else if (period === 'week') {
      const { weekStart, weekEnd } = getArchiveWeekDates(periodDate);
      res = res.filter((o) => {
        const d = o.created_at?.slice(0, 10);
        return d && d >= weekStart && d <= weekEnd;
      });
    } else if (period === 'month') {
      const mPrefix = periodDate.slice(0, 7);
      res = res.filter((o) => o.created_at?.startsWith(mPrefix));
    }

    // Текстовый поиск
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter(
        (o) =>
          o.order_number?.toString().includes(q) ||
          o.asset?.short_name?.toLowerCase().includes(q) ||
          o.asset?.reg_number?.toLowerCase().includes(q) ||
          o.client_vehicle_brand?.toLowerCase().includes(q) ||
          o.client_vehicle_reg?.toLowerCase().includes(q) ||
          o.mechanic?.name?.toLowerCase().includes(q) ||
          o.problem_description?.toLowerCase().includes(q),
      );
    }

    return res;
  };

  const filteredActiveOrders = useMemo(
    () => filterByDateAndSearch(activeOrders),
    [activeOrders, filterType, period, periodDate, search],
  );
  const filteredPendingOrders = useMemo(
    () => filterByDateAndSearch(pendingPaymentOrders),
    [pendingPaymentOrders, filterType, period, periodDate, search],
  );
  const filteredArchiveOrders = useMemo(
    () => filterByDateAndSearch(archiveOrders),
    [archiveOrders, filterType, period, periodDate, search],
  );

  // Counts for badges & summary
  const inWorkCount = activeOrders.length;
  const pendingPaymentCount = pendingPaymentOrders.length;
  const archiveCount = archiveOrders.length;
  const maintenanceAlertsCount = maintenanceItems.filter(
    (item) => item.alert_status === 'overdue' || item.alert_status === 'soon',
  ).length;

  const totalPendingPaymentSum = useMemo(() => {
    return pendingPaymentOrders.reduce((sum, o) => {
      const worksSum = (o.works ?? []).reduce(
        (s, w) => s + (parseFloat(w.price_client ?? '0') || 0),
        0,
      );
      const partsSum = (o.parts ?? []).reduce(
        (s, p) => s + (parseFloat(p.client_price ?? p.unit_price ?? '0') || 0) * (p.quantity || 1),
        0,
      );
      return sum + worksSum + partsSum;
    }, 0);
  }, [pendingPaymentOrders]);

  const totalWarehouseVal = partsData?.totals?.totalStockVal ?? 405000;
  const ownActiveCount = activeOrders.filter((o) => o.machine_type === 'own').length;
  const clientActiveCount = activeOrders.filter((o) => o.machine_type === 'client').length;

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* ── 1. ВЕРХНЯЯ ШАПКА УПРАВЛЕНИЯ (БЕЗ ЧЁРНОГО ЦВЕТА) ── */}
      <header className="bg-white border border-sky-100 rounded-2xl px-5 py-3.5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-emerald-400 flex items-center justify-center text-xl shadow-xs shrink-0 text-white">
            🛠️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Гараж и СТО
              </h1>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Свой парк + Клиенты
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Управление заказ-нарядами, складом запчастей и обслуживанием автопарка
            </p>
          </div>
        </div>

        {/* Кнопки быстрых действий */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => setShowSettings(true)}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            title="Настройки ставок СТО и % зарплат"
          >
            <span>⚙️</span>
            <span className="hidden md:inline">Ставки нормо-часа</span>
          </button>

          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <span>➕</span>
            <span>Новый заказ-наряд</span>
          </button>
        </div>
      </header>

      {/* ── 2. СВОДНЫЕ МЕТРИКИ СВЕРХУ ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
        {/* В боксах */}
        <div
          onClick={() => setActiveTab('active')}
          className={cn(
            'bg-white border rounded-2xl p-3 shadow-2xs transition-all cursor-pointer flex flex-col justify-between',
            activeTab === 'active'
              ? 'border-sky-300 ring-2 ring-sky-100'
              : 'border-sky-100 hover:border-sky-200',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              В боксах СТО
            </span>
            <span className="text-sm">🔧</span>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-sky-950">{inWorkCount} наряда</div>
            <div className="text-[11px] text-sky-700 font-bold mt-0.5 flex items-center gap-1">
              <span>{ownActiveCount} своих</span> · <span>{clientActiveCount} клиент</span>
            </div>
          </div>
        </div>

        {/* Ждёт оплаты */}
        <div
          onClick={() => setActiveTab('pending_payment')}
          className={cn(
            'bg-white border rounded-2xl p-3 shadow-2xs transition-all cursor-pointer flex flex-col justify-between',
            activeTab === 'pending_payment'
              ? 'border-amber-300 ring-2 ring-amber-100'
              : 'border-amber-100 hover:border-amber-200',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
              Ждут оплаты
            </span>
            <span className="text-sm">💳</span>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-amber-900">
              <Money amount={totalPendingPaymentSum} />
            </div>
            <div className="text-[11px] text-amber-600 font-bold mt-0.5">
              {pendingPaymentCount}{' '}
              {pendingPaymentCount === 1 ? 'наряд клиента' : 'наряда клиентов'}
            </div>
          </div>
        </div>

        {/* Архив */}
        <div
          onClick={() => setActiveTab('archive')}
          className={cn(
            'bg-white border rounded-2xl p-3 shadow-2xs transition-all cursor-pointer flex flex-col justify-between',
            activeTab === 'archive'
              ? 'border-emerald-300 ring-2 ring-emerald-100'
              : 'border-emerald-100 hover:border-emerald-200',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Архив
            </span>
            <span className="text-sm">📚</span>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-emerald-900">{archiveCount} нарядов</div>
            <div className="text-[11px] text-emerald-600 font-bold mt-0.5">
              Закрытые и оплаченные
            </div>
          </div>
        </div>

        {/* Склад запчастей */}
        <div
          onClick={() => setActiveTab('warehouse')}
          className={cn(
            'bg-white border rounded-2xl p-3 shadow-2xs transition-all cursor-pointer flex flex-col justify-between',
            activeTab === 'warehouse'
              ? 'border-sky-300 ring-2 ring-sky-100'
              : 'border-sky-100 hover:border-sky-200',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Склад (ТМЦ)
            </span>
            <span className="text-sm">📦</span>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-slate-800">
              <Money amount={totalWarehouseVal} />
            </div>
            <div className="text-[11px] text-slate-500 font-bold mt-0.5">Оценка: +30%</div>
          </div>
        </div>

        {/* Клиенты СТО */}
        <div
          onClick={() => setActiveTab('clients')}
          className={cn(
            'bg-white border rounded-2xl p-3 shadow-2xs transition-all cursor-pointer flex flex-col justify-between col-span-2 lg:col-span-1',
            activeTab === 'clients'
              ? 'border-indigo-300 ring-2 ring-indigo-100'
              : 'border-indigo-100 hover:border-indigo-200',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
              Клиенты СТО
            </span>
            <span className="text-sm">👥</span>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-indigo-950">
              {clientsData.length} контрагентов
            </div>
            <div className="text-[11px] text-indigo-600 font-bold mt-0.5">Коммерческий сервис</div>
          </div>
        </div>
      </div>

      {/* ── 3. ВКЛАДКИ НАВИГАЦИИ (3 ГЛАВНЫЕ КНОПКИ НАРЯДОВ + СКЛАД, КЛИЕНТЫ, ТО) ── */}
      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200/80 pb-2">
        <div className="flex flex-wrap gap-1 bg-slate-100/90 p-1 rounded-xl">
          {/* 1. В работе */}
          <button
            onClick={() => setActiveTab('active')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
              activeTab === 'active'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <span>🔧</span>
            <span>В работе</span>
            {inWorkCount > 0 && (
              <span className="bg-sky-500 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {inWorkCount}
              </span>
            )}
          </button>

          {/* 2. Ждут оплаты */}
          <button
            onClick={() => setActiveTab('pending_payment')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
              activeTab === 'pending_payment'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <span>💳</span>
            <span>Ждут оплаты</span>
            {pendingPaymentCount > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {pendingPaymentCount}
              </span>
            )}
          </button>

          {/* 3. Архив */}
          <button
            onClick={() => setActiveTab('archive')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
              activeTab === 'archive'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <span>📚</span>
            <span>Архив</span>
            {archiveCount > 0 && (
              <span className="bg-emerald-500 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {archiveCount}
              </span>
            )}
          </button>

          {/* Дополнительные разделы */}
          <button
            onClick={() => setActiveTab('warehouse')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
              activeTab === 'warehouse'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <span>📦</span>
            <span>Склад запчастей</span>
          </button>

          <button
            onClick={() => setActiveTab('clients')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
              activeTab === 'clients'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <span>👥</span>
            <span>Клиенты СТО</span>
            {clientsData.length > 0 && (
              <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {clientsData.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('maintenance')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
              activeTab === 'maintenance'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <span>🛢️</span>
            <span>Регламенты ТО</span>
            {maintenanceAlertsCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {maintenanceAlertsCount}
              </span>
            )}
          </button>
        </div>

        {/* Быстрая ссылка на раздел согласования: Ревью Механики */}
        <div className="hidden sm:flex items-center gap-2 text-xs">
          <span className="text-slate-400">Приёмка работ и зарплаты:</span>
          <a
            href="/review"
            className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1"
          >
            <span>👁️</span>
            <span>Ревью (Механики) ↗</span>
          </a>
        </div>
      </div>

      {/* ── НАВИГАЦИЯ ПО ДНЯМ, НЕДЕЛЯМ, МЕСЯЦАМ (В СТИЛЕ РЕВЬЮ) ── */}
      {(activeTab === 'active' || activeTab === 'pending_payment' || activeTab === 'archive') && (
        <DatePeriodNav
          period={period}
          setPeriod={setPeriod}
          date={periodDate}
          setDate={setPeriodDate}
        />
      )}

      {/* ── 4. СОДЕРЖИМОЕ АКТИВНОЙ ВКЛАДКИ ── */}

      {/* Вкладка 1: В РАБОТЕ (ТОЛЬКО МАШИНЫ, ГДЕ ЕЩЕ БУДУТ ПРОХОДИТЬ РАБОТЫ) */}
      {activeTab === 'active' && (
        <div className="space-y-3">
          {/* Панель фильтров: поиск и принадлежность (свой/клиент) */}
          <div className="flex items-center justify-between flex-wrap gap-2 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <input
                type="text"
                placeholder="🔍 Поиск по номеру наряда, авто или механику..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:bg-white focus:outline-hidden focus:border-sky-400"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <button
                onClick={() => setFilterType('all')}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-all cursor-pointer',
                  filterType === 'all'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                Все ({filteredActiveOrders.length})
              </button>
              <button
                onClick={() => setFilterType('own')}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-all cursor-pointer',
                  filterType === 'own'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                🚛 Свой парк ({filteredActiveOrders.filter((o) => o.machine_type === 'own').length})
              </button>
              <button
                onClick={() => setFilterType('client')}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-all cursor-pointer',
                  filterType === 'client'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                🏢 Сторонние клиенты (
                {filteredActiveOrders.filter((o) => o.machine_type === 'client').length})
              </button>
            </div>
          </div>

          {/* Список нарядов */}
          {ordersLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredActiveOrders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
              <p className="text-4xl mb-2">🔧</p>
              <p className="font-bold text-slate-600">Нарядов в работе по фильтру не найдено</p>
              <p className="text-xs text-slate-400 mt-1">
                Здесь отображаются только автомобили, ремонт которых ещё выполняется
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredActiveOrders.map((o) => (
                <OrderCard key={o.id} o={o} onSelect={(id) => setSelectedOrderId(id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Вкладка 2: ЖДУТ ОПЛАТЫ (МАШИНЫ КЛИЕНТОВ БЕЗ ОПЛАТЫ) */}
      {activeTab === 'pending_payment' && (
        <div className="space-y-3">
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-sm text-amber-950">
                Заказ-наряды сторонних клиентов, ожидающие оплаты
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                После приёма оплаты заказ-наряд закрывается и выручка поступает в кассу
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase text-amber-800 block">
                Всего к оплате:
              </span>
              <span className="text-xl font-black text-amber-950">
                <Money amount={totalPendingPaymentSum} />
              </span>
            </div>
          </div>

          {filteredPendingOrders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
              <p className="text-4xl mb-2">💳</p>
              <p className="font-bold text-slate-600">Нет неоплаченных нарядов</p>
              <p className="text-xs text-slate-400 mt-1">
                Все завершённые наряды клиентов полностью рассчитаны
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPendingOrders.map((o) => (
                <OrderCard key={o.id} o={o} onSelect={(id) => setSelectedOrderId(id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Вкладка 3: АРХИВ (ОПЛАЧЕННЫЕ КЛИЕНТСКИЕ И ЗАВЕРШЁННЫЕ СВОИ МАШИНЫ) */}
      {activeTab === 'archive' && (
        <div className="space-y-3">
          {/* Фильтры по типу авто и поиск */}
          <div className="flex items-center justify-between flex-wrap gap-2 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <input
                type="text"
                placeholder="🔍 Поиск в архиве по номеру наряда, авто или механику..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:bg-white focus:outline-hidden focus:border-sky-400"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <button
                onClick={() => setFilterType('all')}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-all cursor-pointer',
                  filterType === 'all'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                Все закрытые ({filteredArchiveOrders.length})
              </button>
              <button
                onClick={() => setFilterType('own')}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-all cursor-pointer',
                  filterType === 'own'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                🚛 Свой парк ({filteredArchiveOrders.filter((o) => o.machine_type === 'own').length}
                )
              </button>
              <button
                onClick={() => setFilterType('client')}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-all cursor-pointer',
                  filterType === 'client'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                🏢 Оплаченные клиенты (
                {filteredArchiveOrders.filter((o) => o.machine_type === 'client').length})
              </button>
            </div>
          </div>

          {ordersLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredArchiveOrders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
              <p className="text-4xl mb-2">📚</p>
              <p className="font-bold text-slate-600">В архиве за выбранный период нет нарядов</p>
              <p className="text-xs text-slate-400 mt-1">
                Выберите другой день, неделю или переключитесь на «Все время»
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredArchiveOrders.map((o) => (
                <OrderCard key={o.id} o={o} onSelect={(id) => setSelectedOrderId(id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Вкладка 4: Склад запчастей (Вариант 3) */}
      {activeTab === 'warehouse' && <WarehouseSection />}

      {/* Вкладка 5: Клиенты СТО */}
      {activeTab === 'clients' && <ClientsSection />}

      {/* Вкладка 6: Регламенты ТО */}
      {activeTab === 'maintenance' && <MaintenanceSection />}

      {/* ── 5. МОДАЛЬНЫЕ ОКНА ── */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {showCreate && (
        <CreateOrderModal
          onClose={() => setShowCreate(false)}
          assets={assets}
          mechanics={mechanics}
          onCreated={(id) => {
            qc.invalidateQueries({ queryKey: ['garage-orders'] });
            setShowCreate(false);
            setSelectedOrderId(id);
          }}
        />
      )}

      {selectedOrderId && (
        <OrderDetailModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          mechanics={mechanics}
        />
      )}
    </div>
  );
}
