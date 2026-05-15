'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef } from 'react';
import { cn } from '@saldacargo/ui';

// ─── Types ───────────────────────────────────────────────────────────────────

type Mechanic = { id: string; name: string };
type Asset = { id: string; short_name: string; reg_number: string };

type OrderRow = {
  id: string;
  order_number: number;
  status: string;
  priority: string;
  machine_type: 'own' | 'client';
  problem_description: string;
  created_at: string;
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
  norm_minutes: number;
  actual_minutes: number;
  custom_work_name: string | null;
  work_catalog: { id: string; name: string; norm_minutes: number } | null;
  time_logs: Array<{ id: string; started_at: string; stopped_at: string | null; status: string }>;
};

type OrderDetail = Omit<OrderRow, 'works'> & {
  admin_note: string | null;
  mechanic_note: string | null;
  client_vehicle_model: string | null;
  client_phone: string | null;
  odometer_start: number | null;
  odometer_end: number | null;
  works: DetailWork[];
  parts: Array<{
    id: string;
    quantity: number;
    part: { id: string; name: string; unit: string };
  }>;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  created: 'В очереди',
  in_progress: 'В работе',
  completed: 'Завершён',
  cancelled: 'Отменён',
};
const STATUS_COLOR: Record<string, string> = {
  created: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-amber-100 text-amber-700',
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

const emptyForm = {
  machine_type: 'own' as 'own' | 'client',
  asset_id: '',
  client_vehicle_brand: '',
  client_vehicle_model: '',
  client_vehicle_reg: '',
  client_name: '',
  client_phone: '',
  problem_description: '',
  assigned_mechanic_id: '',
  priority: 'normal',
  admin_note: '',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ─── Order Detail Modal ───────────────────────────────────────────────────────

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
  const [editNote, setEditNote] = useState<string | null>(null);
  const [editMechanic, setEditMechanic] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [editPriority, setEditPriority] = useState<string | null>(null);

  const { data: order, isLoading } = useQuery<OrderDetail>({
    queryKey: ['garage-order', orderId],
    queryFn: async () => {
      const r = await fetch(`/api/garage/orders/${orderId}`);
      if (!r.ok) throw new Error('Ошибка загрузки');
      return r.json();
    },
  });

  const patchMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch(`/api/garage/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error('Ошибка обновления');
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['garage-orders'] });
      queryClient.invalidateQueries({ queryKey: ['garage-order', orderId] });
      setEditNote(null);
      setEditMechanic(null);
      setEditStatus(null);
      setEditPriority(null);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white h-full overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Наряд #{order?.order_number ?? '...'}
            </h2>
            {order && <p className="text-xs text-slate-400">{fmtDate(order.created_at)}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

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
                <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wide">
                  Клиент
                </p>
                {order.client_name && (
                  <p className="text-sm font-medium text-slate-800">{order.client_name}</p>
                )}
                {order.client_phone && (
                  <p className="text-sm text-slate-500">{order.client_phone}</p>
                )}
              </div>
            )}

            <div>
              <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wide">
                Описание проблемы
              </p>
              <p className="text-sm text-slate-800 leading-relaxed">{order.problem_description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wide">
                  Статус
                </p>
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
                <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wide">
                  Приоритет
                </p>
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

            <div>
              <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wide">
                Механик
              </p>
              <select
                value={editMechanic ?? order.mechanic?.id ?? ''}
                onChange={(e) => setEditMechanic(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— Не назначен —</option>
                {mechanics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              {editMechanic !== null && editMechanic !== (order.mechanic?.id ?? '') && (
                <button
                  onClick={() =>
                    patchMutation.mutate({ assigned_mechanic_id: editMechanic || null })
                  }
                  disabled={patchMutation.isPending}
                  className="mt-1 text-xs text-blue-600 font-semibold hover:underline"
                >
                  Сохранить
                </button>
              )}
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wide">
                Работы ({order.works.length})
              </p>
              {order.works.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Работы не добавлены</p>
              ) : (
                <div className="space-y-2">
                  {order.works.map((w) => {
                    const name = w.work_catalog?.name ?? w.custom_work_name ?? 'Без названия';
                    const activeLog = w.time_logs.find((l) => l.status === 'running');
                    return (
                      <div
                        key={w.id}
                        className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-800">{name}</p>
                          <p className="text-xs text-slate-400">
                            Норма: {w.norm_minutes}м · Факт: {w.actual_minutes ?? 0}м
                            {activeLog && ' · ⏱ в работе'}
                          </p>
                        </div>
                        <span
                          className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', {
                            'bg-slate-100 text-slate-500': w.status === 'pending',
                            'bg-amber-100 text-amber-700':
                              w.status === 'in_progress' || w.status === 'paused',
                            'bg-emerald-100 text-emerald-700': w.status === 'completed',
                          })}
                        >
                          {w.status === 'pending'
                            ? 'Очередь'
                            : w.status === 'in_progress'
                              ? 'В работе'
                              : w.status === 'paused'
                                ? 'Пауза'
                                : w.status === 'completed'
                                  ? 'Готово'
                                  : w.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {order.parts.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wide">
                  Запчасти ({order.parts.length})
                </p>
                <div className="space-y-1">
                  {order.parts.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2"
                    >
                      <span className="text-sm text-slate-800">{p.part.name}</span>
                      <span className="text-sm font-semibold text-slate-700">
                        {p.quantity} {p.part.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wide">
                Заметка (admin)
              </p>
              {editNote === null ? (
                <div className="flex items-start gap-2">
                  <p className="text-sm text-slate-700 flex-1">
                    {order.admin_note || <span className="italic text-slate-400">Нет заметки</span>}
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
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
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
              <div>
                <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wide">
                  Заметка механика
                </p>
                <p className="text-sm text-slate-700">{order.mechanic_note}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create Order Form ────────────────────────────────────────────────────────

function CreateOrderModal({
  onClose,
  mechanics,
  assets,
}: {
  onClose: () => void;
  mechanics: Mechanic[];
  assets: Asset[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: async (body: typeof emptyForm) => {
      const r = await fetch('/api/garage/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? 'Ошибка');
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['garage-orders'] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const set = (field: keyof typeof emptyForm, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Новый наряд</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
              Тип машины *
            </label>
            <div className="flex gap-2">
              {(['own', 'client'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => set('machine_type', t)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-semibold transition-colors',
                    form.machine_type === t
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {t === 'own' ? 'Своя машина' : 'Клиентская'}
                </button>
              ))}
            </div>
          </div>

          {form.machine_type === 'own' ? (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Машина *
              </label>
              <select
                value={form.asset_id}
                onChange={(e) => set('asset_id', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— Выберите машину —</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.short_name} · {a.reg_number}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-3">
              {(
                [
                  {
                    field: 'client_vehicle_brand' as const,
                    label: 'Марка *',
                    placeholder: 'Toyota',
                  },
                  { field: 'client_vehicle_model' as const, label: 'Модель', placeholder: 'Camry' },
                  {
                    field: 'client_vehicle_reg' as const,
                    label: 'Госномер',
                    placeholder: 'А001АА96',
                  },
                  {
                    field: 'client_name' as const,
                    label: 'Имя клиента',
                    placeholder: 'Иван Иванов',
                  },
                  {
                    field: 'client_phone' as const,
                    label: 'Телефон',
                    placeholder: '+7 900 000-00-00',
                  },
                ] as const
              ).map(({ field, label, placeholder }) => (
                <div key={field}>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                    {label}
                  </label>
                  <input
                    value={form[field]}
                    onChange={(e) => set(field, e.target.value)}
                    placeholder={placeholder}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
              Описание проблемы *
            </label>
            <textarea
              value={form.problem_description}
              onChange={(e) => set('problem_description', e.target.value)}
              rows={3}
              placeholder="Что случилось с машиной..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Механик
              </label>
              <select
                value={form.assigned_mechanic_id}
                onChange={(e) => set('assigned_mechanic_id', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— Не назначен —</option>
                {mechanics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Приоритет
              </label>
              <select
                value={form.priority}
                onChange={(e) => set('priority', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
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
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
              Заметка
            </label>
            <input
              value={form.admin_note}
              onChange={(e) => set('admin_note', e.target.value)}
              placeholder="Дополнительно..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending}
              className="flex-[2] bg-slate-900 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Создаём...' : 'Создать наряд'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Collapsible Order Card ──────────────────────────────────────────────────

type TabOrder = Omit<OrderRow, 'works'> & {
  lifecycle_status?: string;
  mechanic_note?: string | null;
  admin_note?: string | null;
  works: Array<{
    id: string;
    status: string;
    custom_work_name?: string | null;
    actual_minutes?: number | null;
    price_client?: string | null;
    norm_minutes?: number;
    work_catalog?: { name: string } | null;
  }>;
  parts?: Array<{
    id: string;
    quantity: number;
    unit_price?: string | null;
    part: { name: string; unit: string };
  }>;
};

function CollapsibleOrderCard({
  order,
  showActions,
  onApprove,
  onReturn,
  onCancel,
  onDelete,
  onOpenDetail,
}: {
  order: TabOrder;
  showActions: boolean;
  onApprove?: () => void;
  onReturn?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onOpenDetail: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const cancelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const worksTotal = (order.works ?? []).reduce((s, w) => s + parseFloat(w.price_client ?? '0'), 0);
  const partsTotal = (order.parts ?? []).reduce(
    (s, p) => s + parseFloat(p.unit_price ?? '0') * p.quantity,
    0,
  );
  const total = worksTotal + partsTotal;

  const vehicleName =
    order.machine_type === 'own'
      ? (order.asset?.short_name ?? '—')
      : (order.client_vehicle_brand ?? 'Клиент.авто');

  const handleCancel = () => {
    if (!cancelConfirm) {
      setCancelConfirm(true);
      cancelTimer.current = setTimeout(() => setCancelConfirm(false), 4000);
    } else {
      if (cancelTimer.current) clearTimeout(cancelTimer.current);
      setCancelConfirm(false);
      onCancel?.();
    }
  };

  const handleDeleteClick = () => {
    setDeleteConfirm(true);
    deleteTimer.current = setTimeout(() => setDeleteConfirm(false), 4000);
  };

  const handleDeleteConfirm = () => {
    if (deleteTimer.current) clearTimeout(deleteTimer.current);
    setDeleteConfirm(false);
    onDelete?.();
  };

  const priorityBorder =
    order.priority === 'urgent'
      ? 'border-l-red-500'
      : order.lifecycle_status === 'approved'
        ? 'border-l-emerald-400'
        : 'border-l-slate-300';

  return (
    <div
      className={cn(
        'bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden border-l-4',
        priorityBorder,
      )}
    >
      <div
        className="px-4 py-3 cursor-pointer hover:bg-slate-50/60 transition-colors select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-slate-900 text-sm">#{order.order_number}</span>
              <span className="font-semibold text-slate-700 text-sm truncate">{vehicleName}</span>
              {order.machine_type === 'own' && order.asset?.reg_number && (
                <span className="text-[10px] text-slate-400">{order.asset.reg_number}</span>
              )}
              <span
                className={cn(
                  'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full',
                  PRIORITY_COLOR[order.priority] ?? 'bg-slate-100 text-slate-500',
                )}
              >
                {PRIORITY_LABEL[order.priority] ?? order.priority}
              </span>
              <span
                className={cn(
                  'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full',
                  STATUS_COLOR[order.status] ?? 'bg-slate-100 text-slate-500',
                )}
              >
                {STATUS_LABEL[order.status] ?? order.status}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              {order.mechanic && (
                <span className="text-[10px] text-slate-500">👤 {order.mechanic.name}</span>
              )}
              <span className="text-[10px] text-slate-400">{fmtDate(order.created_at)}</span>
              {order.problem_description && (
                <span className="text-[10px] text-slate-400 truncate max-w-xs">
                  {order.problem_description}
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right flex items-center gap-2">
            {total > 0 && (
              <p className="text-sm font-black text-slate-800">{total.toLocaleString('ru-RU')} ₽</p>
            )}
            <span
              className={cn(
                'material-symbols-outlined text-slate-300 text-[20px] transition-transform duration-300',
                expanded ? 'rotate-180' : '',
              )}
            >
              expand_more
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Работы */}
          {(order.works ?? []).length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Работы
              </p>
              <div className="space-y-1">
                {order.works.map((w) => {
                  const name = w.work_catalog?.name ?? w.custom_work_name ?? '—';
                  return (
                    <div key={w.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'w-1.5 h-1.5 rounded-full shrink-0',
                            w.status === 'completed' ? 'bg-emerald-400' : 'bg-slate-300',
                          )}
                        />
                        <span className="text-slate-700">{name}</span>
                      </div>
                      {w.price_client && parseFloat(w.price_client) > 0 && (
                        <span className="font-bold text-slate-700 shrink-0">
                          {parseFloat(w.price_client).toLocaleString('ru-RU')} ₽
                        </span>
                      )}
                    </div>
                  );
                })}
                {worksTotal > 0 && (
                  <div className="flex justify-between text-xs font-bold text-slate-600 pt-1 border-t border-slate-100 mt-1">
                    <span>Итого работы</span>
                    <span>{worksTotal.toLocaleString('ru-RU')} ₽</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Запчасти */}
          {(order.parts ?? []).length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Запчасти
              </p>
              <div className="space-y-1">
                {(order.parts ?? []).map((p) => {
                  const lineTotal = parseFloat(p.unit_price ?? '0') * p.quantity;
                  return (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-700">
                        {p.part?.name ?? '—'} × {p.quantity} {p.part?.unit ?? 'шт'}
                      </span>
                      {lineTotal > 0 && (
                        <span className="font-bold text-slate-700 shrink-0">
                          {lineTotal.toLocaleString('ru-RU')} ₽
                        </span>
                      )}
                    </div>
                  );
                })}
                {partsTotal > 0 && (
                  <div className="flex justify-between text-xs font-bold text-slate-600 pt-1 border-t border-slate-100 mt-1">
                    <span>Итого запчасти</span>
                    <span>{partsTotal.toLocaleString('ru-RU')} ₽</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {total > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <span className="text-xs font-black text-slate-700 uppercase tracking-wide">
                Итого наряд
              </span>
              <span className="text-base font-black text-slate-900">
                {total.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          )}

          {order.mechanic_note && (
            <div className="px-4 py-2 border-t border-slate-100 bg-amber-50/40">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-0.5">
                Заметка механика
              </p>
              <p className="text-xs text-slate-700">{order.mechanic_note}</p>
            </div>
          )}

          {order.admin_note && (
            <div className="px-4 py-2 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                Заметка администратора
              </p>
              <p className="text-xs text-slate-700">{order.admin_note}</p>
            </div>
          )}

          {/* Действия */}
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2 bg-white">
            <div className="flex gap-2">
              {showActions && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancel();
                  }}
                  className={cn(
                    'flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all',
                    cancelConfirm
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50',
                  )}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {cancelConfirm ? 'warning' : 'delete_outline'}
                  </span>
                  {cancelConfirm ? 'Ещё раз!' : 'Отменить'}
                </button>
              )}
              {onDelete && !deleteConfirm && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick();
                  }}
                  className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 transition-all"
                >
                  <span className="material-symbols-outlined text-[14px]">delete_forever</span>
                  Удалить
                </button>
              )}
              {onDelete && deleteConfirm && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-red-700 font-bold">Удалить насовсем?</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(false);
                      if (deleteTimer.current) clearTimeout(deleteTimer.current);
                    }}
                    className="text-xs font-bold px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConfirm();
                    }}
                    className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-700 text-white hover:bg-red-800 transition-colors"
                  >
                    Да, удалить
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetail();
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-400 rounded-lg py-1.5 px-3 transition-colors"
              >
                ✏️ Изменить
              </button>
              {showActions && onReturn && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReturn();
                  }}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg border border-amber-200 text-amber-600 hover:border-amber-300 transition-colors"
                >
                  ↩ Вернуть
                </button>
              )}
              {showActions && onApprove && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onApprove();
                  }}
                  className="text-xs font-bold px-4 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                >
                  ✓ Одобрить
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Date Navigation ──────────────────────────────────────────────────────────

function DateNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const shift = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    onChange(d.toISOString().slice(0, 10));
  };
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => shift(-1)}
        className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <span className="material-symbols-outlined text-slate-500 text-[18px]">chevron_left</span>
      </button>
      <input
        type="date"
        value={date}
        max={today}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm font-semibold text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400"
      />
      <button
        onClick={() => shift(1)}
        disabled={date >= today}
        className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-30"
      >
        <span className="material-symbols-outlined text-slate-500 text-[18px]">chevron_right</span>
      </button>
      {date !== today && (
        <button
          onClick={() => onChange(today)}
          className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded border border-slate-200 hover:border-slate-400 transition-colors"
        >
          Сегодня
        </button>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type GarageTab = 'review' | 'active' | 'history';

export default function GaragePage() {
  const [tab, setTab] = useState<GarageTab>('review');
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().slice(0, 10));
  const [showCreate, setShowCreate] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const qc = useQueryClient();

  const queryKey = ['garage-orders', tab, tab === 'history' ? historyDate : ''];

  const {
    data: orders = [],
    isLoading,
    isError,
  } = useQuery<TabOrder[]>({
    queryKey,
    queryFn: () => {
      const url =
        tab === 'history'
          ? `/api/garage/orders?filter=history&date=${historyDate}`
          : `/api/garage/orders?filter=${tab}`;
      return fetch(url)
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : []));
    },
    staleTime: 120000,
  });

  const { data: mechanics = [] } = useQuery<Mechanic[]>({
    queryKey: ['mechanics-list'],
    queryFn: () => fetch('/api/users?role=mechanic').then((r) => r.json()),
    staleTime: 300000,
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['assets-select'],
    queryFn: async () => {
      const json = await fetch('/api/fleet').then((r) => r.json());
      return Array.isArray(json?.assets) ? json.assets : [];
    },
    staleTime: 300000,
  });

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      fetch(`/api/garage/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['garage-orders'] }),
  });

  const TABS: { key: GarageTab; label: string }[] = [
    { key: 'review', label: 'На ревью' },
    { key: 'active', label: 'Активные' },
    { key: 'history', label: 'История' },
  ];

  return (
    <div className="space-y-6 max-w-[1920px] animate-in fade-in duration-500">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Гараж / Наряды</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors"
        >
          + Новый наряд
        </button>
      </div>

      {/* Вкладки */}
      <div className="flex items-center gap-0 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors',
              tab === t.key
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'history' && <DateNav date={historyDate} onChange={setHistoryDate} />}

      {isError && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-700 font-bold">
          Ошибка загрузки данных
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
          <p className="text-5xl mb-3">🔧</p>
          <p className="font-medium text-slate-500">
            {tab === 'review'
              ? 'Нарядов на ревью нет'
              : tab === 'active'
                ? 'Активных нарядов нет'
                : 'За этот день нарядов нет'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <CollapsibleOrderCard
              key={order.id}
              order={order}
              showActions={tab === 'review'}
              onApprove={
                tab === 'review'
                  ? () => patch.mutate({ id: order.id, body: { lifecycle_status: 'approved' } })
                  : undefined
              }
              onReturn={
                tab === 'review'
                  ? () => patch.mutate({ id: order.id, body: { lifecycle_status: 'returned' } })
                  : undefined
              }
              onCancel={
                tab === 'review'
                  ? () => patch.mutate({ id: order.id, body: { lifecycle_status: 'cancelled' } })
                  : undefined
              }
              onDelete={() =>
                fetch(`/api/garage/orders/${order.id}`, { method: 'DELETE' }).then(() =>
                  qc.invalidateQueries({ queryKey: ['garage-orders'] }),
                )
              }
              onOpenDetail={() => setSelectedOrderId(order.id)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateOrderModal
          onClose={() => setShowCreate(false)}
          mechanics={mechanics}
          assets={assets}
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
