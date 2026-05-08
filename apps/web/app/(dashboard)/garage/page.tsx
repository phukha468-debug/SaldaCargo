'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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

const STATUS_TABS = [
  { value: '', label: 'Все' },
  { value: 'created', label: 'В очереди' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'completed', label: 'Завершённые' },
];

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

function worksProgress(works: Array<{ status: string }>) {
  if (!works.length) return null;
  const done = works.filter((w) => w.status === 'completed').length;
  return `${done}/${works.length}`;
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

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({ order, onClick }: { order: OrderRow; onClick: () => void }) {
  const progress = worksProgress(order.works);
  const vehicleName =
    order.machine_type === 'own'
      ? `${order.asset?.short_name ?? '?'} · ${order.asset?.reg_number ?? ''}`
      : `${order.client_vehicle_brand ?? 'Неизвестно'} · ${order.client_vehicle_reg ?? ''}`;

  return (
    <div
      onClick={onClick}
      className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-400 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-slate-400">#{order.order_number}</span>
            <span
              className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                STATUS_COLOR[order.status],
              )}
            >
              {STATUS_LABEL[order.status] ?? order.status}
            </span>
            {order.priority === 'urgent' && (
              <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                Срочно
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-slate-900">{vehicleName}</p>
          {order.machine_type === 'client' && order.client_name && (
            <p className="text-xs text-slate-500">{order.client_name}</p>
          )}
        </div>
        <span className="text-xs text-slate-400 shrink-0">{fmtDate(order.created_at)}</span>
      </div>

      <p className="text-sm text-slate-600 line-clamp-2 mb-3">{order.problem_description}</p>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{order.mechanic ? order.mechanic.name : 'Механик не назначен'}</span>
        {progress && <span className="font-semibold text-slate-600">Работы: {progress}</span>}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GaragePage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery<OrderRow[]>({
    queryKey: ['garage-orders', statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      const r = await fetch(`/api/garage/orders?${params}`);
      const json = await r.json();
      return Array.isArray(json) ? json : [];
    },
  });

  const { data: mechanics = [] } = useQuery<Mechanic[]>({
    queryKey: ['mechanics-list'],
    queryFn: async () => {
      const r = await fetch('/api/users?role=mechanic');
      const json = await r.json();
      return Array.isArray(json) ? json : [];
    },
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['assets-select'],
    queryFn: async () => {
      const r = await fetch('/api/fleet');
      const json = await r.json();
      return Array.isArray(json?.assets) ? json.assets : [];
    },
  });

  const counts = {
    created: orders.filter((o) => o.status === 'created').length,
    in_progress: orders.filter((o) => o.status === 'in_progress').length,
    completed: orders.filter((o) => o.status === 'completed').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Гараж / СТО</h1>
          <p className="text-sm text-slate-500">Наряды на техническое обслуживание</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
        >
          + Новый наряд
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'В очереди', value: counts.created, color: 'text-slate-700' },
          { label: 'В работе', value: counts.in_progress, color: 'text-amber-600' },
          { label: 'Завершены', value: counts.completed, color: 'text-emerald-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{label}</p>
            <p className={cn('text-3xl font-bold mt-1', color)}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                statusFilter === tab.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по описанию или клиенту..."
          className="flex-1 min-w-48 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse h-32"
            />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-3">🔧</p>
          <p className="font-semibold">Нарядов нет</p>
          {statusFilter && <p className="text-sm mt-1">Попробуйте изменить фильтр</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} onClick={() => setSelectedOrderId(order.id)} />
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
