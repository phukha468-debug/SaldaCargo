'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { cn } from '@saldacargo/ui';
import { formatDate } from '@saldacargo/shared';

// ── Types ──────────────────────────────────────────────────────

interface AssetItem {
  id: string;
  short_name: string;
  reg_number: string;
}

interface WorkCatalogItem {
  id: string;
  name: string;
  category: string | null;
  norm_minutes: number | null;
  default_price_client: string | null;
}

interface RepairRequest {
  id: string;
  created_at: string;
  custom_description: string | null;
  asset: Omit<AssetItem, 'id'> | null;
  driver: { name: string } | null;
  fault: { name: string; category: string } | null;
}

interface ActiveOrder {
  id: string;
  order_number: number;
  status: string;
  created_at: string;
  asset: Omit<AssetItem, 'id'> | null;
  mechanic: { name: string } | null;
  second_mechanic: { name: string } | null;
}

interface PendingOrder {
  id: string;
  order_number: number;
  created_at: string;
  machine_type: 'own' | 'client';
  asset: Omit<AssetItem, 'id'> | null;
  mechanic: { id: string; name: string } | null;
  second_mechanic: { id: string; name: string } | null;
  service_order_works: { norm_minutes: number; actual_minutes: number | null; status: string }[];
}

interface ExtraWork {
  id: string;
  extra_work_mechanic_note: string | null;
  norm_minutes: number;
  created_at: string;
  custom_work_name: string | null;
  work: { name: string } | null;
  service_order: {
    id: string;
    order_number: number;
    asset: Omit<AssetItem, 'id'> | null;
    mechanic: { name: string } | null;
  } | null;
}

interface MaintenanceAlert {
  id: string;
  work_name: string;
  alert_status: 'overdue' | 'soon';
  next_due_km: number | null;
  next_due_at: string | null;
  asset: (Omit<AssetItem, 'id'> & { odometer_current: number | null }) | null;
}

interface GarageData {
  repairRequests: RepairRequest[];
  activeOrders: ActiveOrder[];
  pendingApproval: PendingOrder[];
  extraWorkPending: ExtraWork[];
  maintenanceAlerts: MaintenanceAlert[];
  counts: Record<string, number>;
}

interface Mechanic {
  id: string;
  name: string;
  mechanic_salary_pct: string | null;
}

// ── Shared UI ──────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 shadow-sm p-4', className)}>
      {children}
    </div>
  );
}

function SectionLabel({ title, count, color }: { title: string; count?: number; color?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{title}</h2>
      {count != null && count > 0 && (
        <span
          className={cn(
            'text-[9px] font-black px-2 py-0.5 rounded-full',
            color ?? 'bg-slate-100 text-slate-500',
          )}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function ActionBtn({
  onClick,
  variant,
  disabled,
  children,
}: {
  onClick: () => void;
  variant: 'approve' | 'reject' | 'return' | 'neutral';
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const colors = {
    approve: 'bg-green-600 text-white disabled:bg-green-300',
    reject: 'bg-red-100 text-red-700 disabled:opacity-50',
    return: 'bg-amber-100 text-amber-700 disabled:opacity-50',
    neutral: 'bg-zinc-900 text-white disabled:bg-zinc-400',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95',
        colors[variant],
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="text-center py-12 text-slate-400">
      <p className="text-4xl mb-2">{icon}</p>
      <p className="font-bold text-sm">{text}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    created: { label: 'В очереди', color: 'bg-slate-100 text-slate-500' },
    in_progress: { label: 'В работе', color: 'bg-orange-100 text-orange-700' },
    completed: { label: 'Готово', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Отменён', color: 'bg-red-100 text-red-700' },
  };
  const { label, color } = map[status] ?? { label: status, color: 'bg-slate-100 text-slate-500' };
  return (
    <span className={cn('text-[9px] font-black uppercase px-2 py-1 rounded-full', color)}>
      {label}
    </span>
  );
}

// ── Work Selector (shared) ─────────────────────────────────────

function WorkSelector({
  workCatalog,
  selectedIds,
  onToggle,
}: {
  workCatalog: WorkCatalogItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const categories = [...new Set(workCatalog.map((w) => w.category ?? 'Прочее'))];
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());

  const toggleCat = (cat: string) =>
    setOpenCats((p) => {
      const n = new Set(p);
      if (n.has(cat)) {
        n.delete(cat);
      } else {
        n.add(cat);
      }
      return n;
    });

  if (workCatalog.length === 0)
    return <p className="text-xs text-slate-400 py-2">Загрузка каталога...</p>;
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {categories.map((cat) => {
        const works = workCatalog.filter((w) => (w.category ?? 'Прочее') === cat);
        const isOpen = openCats.has(cat);
        const selectedCount = works.filter((w) => selectedIds.has(w.id)).length;
        return (
          <div key={cat}>
            <button
              type="button"
              onClick={() => toggleCat(cat)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 border-b border-slate-100 active:bg-slate-100"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {cat}
                </span>
                {selectedCount > 0 && (
                  <span className="text-[8px] font-black bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                    {selectedCount}
                  </span>
                )}
              </div>
              <span className="text-slate-400 text-xs">{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen &&
              works.map((w, i) => (
                <label
                  key={w.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 cursor-pointer',
                    i < works.length - 1 && 'border-b border-slate-50',
                    selectedIds.has(w.id) && 'bg-green-50',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(w.id)}
                    onChange={() => onToggle(w.id)}
                    className="w-4 h-4 accent-green-600 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 leading-tight">{w.name}</p>
                    <p className="text-xs text-slate-400">
                      {w.norm_minutes != null ? `${(w.norm_minutes / 60).toFixed(1)} нч` : '—'}
                      {w.default_price_client
                        ? ` · ~${Math.round(parseFloat(w.default_price_client) * 0.5).toLocaleString('ru-RU')} ₽ ЗП`
                        : ''}
                    </p>
                  </div>
                </label>
              ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Bottom Sheet ───────────────────────────────────────────────

function BottomSheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <h3 className="font-black text-lg">{title}</h3>
          <button onClick={onClose} className="text-zinc-400 text-2xl font-bold leading-none">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 pb-4 space-y-4">{children}</div>
        <div className="px-6 pb-6 pt-3 flex-shrink-0 border-t border-slate-100">{footer}</div>
      </div>
    </div>
  );
}

// ── Approve Request Modal ──────────────────────────────────────

function ApproveRequestModal({
  request,
  mechanics,
  onClose,
  onSuccess,
}: {
  request: RepairRequest;
  mechanics: Mechanic[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mechanicId, setMechanicId] = useState('');
  const [secondMechanicId, setSecondMechanicId] = useState('');
  const [odometer, setOdometer] = useState('');
  const [selectedWorkIds, setSelectedWorkIds] = useState<Set<string>>(new Set());

  const { data: workCatalog = [] } = useQuery<WorkCatalogItem[]>({
    queryKey: ['admin-work-catalog'],
    queryFn: async () => {
      const r = await fetch('/api/admin/work-catalog');
      if (!r.ok) throw new Error('Ошибка загрузки каталога');
      return r.json();
    },
    staleTime: 60_000,
  });

  const toggleWork = (id: string) =>
    setSelectedWorkIds((p) => {
      const n = new Set(p);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
      }
      return n;
    });

  const selectedWorks = workCatalog.filter((w) => selectedWorkIds.has(w.id));
  const totalNormHours = selectedWorks.reduce((s, w) => s + (w.norm_minutes ?? 0), 0) / 60;
  const mechPct = parseFloat(
    mechanics.find((m) => m.id === mechanicId)?.mechanic_salary_pct ?? '50',
  );
  const estimatedSalary = totalNormHours * 2000 * (mechPct / 100);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/repair-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          mechanic_id: mechanicId || undefined,
          second_mechanic_id: secondMechanicId || undefined,
          odometer: odometer ? Number(odometer) : undefined,
          work_ids: selectedWorkIds.size > 0 ? [...selectedWorkIds] : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Ошибка');
      return res.json();
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  return (
    <BottomSheet
      title="Одобрить → Создать наряд"
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-slate-100 text-slate-600"
          >
            Отмена
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-[2] py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-green-600 text-white disabled:bg-green-300"
          >
            {mutation.isPending ? 'Создаём...' : 'Одобрить и создать наряд'}
          </button>
        </div>
      }
    >
      <div className="bg-slate-50 rounded-xl p-3 text-sm">
        <p className="font-bold text-slate-900">
          {request.asset?.short_name ?? '—'} · {request.asset?.reg_number ?? ''}
        </p>
        <p className="text-slate-500 text-xs mt-0.5">
          {request.fault?.name ?? request.custom_description ?? 'Без описания'}
        </p>
        <p className="text-slate-400 text-xs mt-0.5">Водитель: {request.driver?.name ?? '—'}</p>
      </div>

      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
          Текущий пробег (км)
        </label>
        <input
          type="number"
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
          placeholder="Необязательно"
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold"
        />
      </div>

      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
          Выбрать работы
        </label>
        <WorkSelector
          workCatalog={workCatalog}
          selectedIds={selectedWorkIds}
          onToggle={toggleWork}
        />
      </div>

      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
          Механик
        </label>
        <select
          value={mechanicId}
          onChange={(e) => setMechanicId(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white"
        >
          <option value="">— Любой (возьмёт сам) —</option>
          {mechanics.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
          Второй механик
        </label>
        <select
          value={secondMechanicId}
          onChange={(e) => setSecondMechanicId(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white"
        >
          <option value="">— Не нужен —</option>
          {mechanics
            .filter((m) => m.id !== mechanicId)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </select>
      </div>

      {totalNormHours > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Итого нч план</span>
            <span className="font-semibold">{totalNormHours.toFixed(1)} нч</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-slate-500">ЗП механика (при утверждении)</span>
            <span className="font-semibold text-green-700">
              ~{Math.round(estimatedSalary).toLocaleString('ru-RU')} ₽
            </span>
          </div>
        </div>
      )}

      {mutation.isError && (
        <p className="text-xs text-red-500 font-bold">{(mutation.error as Error).message}</p>
      )}
    </BottomSheet>
  );
}

// ── Approve Order Modal ────────────────────────────────────────

function ApproveOrderModal({
  order,
  mechanics,
  onClose,
  onSuccess,
}: {
  order: PendingOrder;
  mechanics: Mechanic[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const totalNm = order.service_order_works
    .filter((w) => w.status !== 'cancelled')
    .reduce((s, w) => s + (w.actual_minutes ?? w.norm_minutes), 0);
  const [adjustedNm, setAdjustedNm] = useState('');
  const [note, setNote] = useState('');
  const [mechanicId, setMechanicId] = useState(order.mechanic?.id ?? '');
  const [secondMechanicId, setSecondMechanicId] = useState(order.second_mechanic?.id ?? '');

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/service-orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          adjusted_norm_minutes: adjustedNm ? Number(adjustedNm) : undefined,
          admin_note: note.trim() || undefined,
          mechanic_id: mechanicId || undefined,
          second_mechanic_id: secondMechanicId || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Ошибка');
      return res.json();
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  const nmToUse = adjustedNm ? Number(adjustedNm) : totalNm;
  const rate = order.machine_type === 'client' ? 2000 : 1600;
  const mechPct = parseFloat(
    mechanics.find((m) => m.id === mechanicId)?.mechanic_salary_pct ?? '50',
  );
  const mechCount = [mechanicId, secondMechanicId].filter(Boolean).length || 1;
  const estimatedSalary = Math.round(((nmToUse / 60 / mechCount) * rate * mechPct) / 100);

  return (
    <BottomSheet
      title={`Утвердить наряд #${order.order_number}`}
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-slate-100 text-slate-600"
          >
            Отмена
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-[2] py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-green-600 text-white disabled:bg-green-300"
          >
            {mutation.isPending ? 'Утверждаем...' : 'Утвердить + начислить'}
          </button>
        </div>
      }
    >
      <div className="bg-slate-50 rounded-xl p-3 text-sm">
        <p className="font-bold">{order.asset?.short_name ?? '—'}</p>
        <p className="text-slate-500 text-xs mt-1">
          Норм-часы (факт): {(totalNm / 60).toFixed(1)} ч
        </p>
        <p className="text-[10px] text-slate-400 mt-1">
          Тариф:{' '}
          <span className="font-black text-slate-600">
            {rate.toLocaleString('ru-RU')} ₽/ч (
            {order.machine_type === 'client' ? 'клиент' : 'свой автопарк'})
          </span>
        </p>
      </div>

      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
          Исполнитель
        </label>
        <select
          value={mechanicId}
          onChange={(e) => setMechanicId(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white"
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
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
          Второй исполнитель
        </label>
        <select
          value={secondMechanicId}
          onChange={(e) => setSecondMechanicId(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white"
        >
          <option value="">— Не нужен —</option>
          {mechanics
            .filter((m) => m.id !== mechanicId)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </select>
      </div>

      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
          Скорректировать норм-минуты
        </label>
        <input
          type="number"
          value={adjustedNm}
          onChange={(e) => setAdjustedNm(e.target.value)}
          placeholder={`По умолчанию: ${totalNm} мин`}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold"
        />
      </div>

      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
          Заметка администратора
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Необязательно"
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none"
        />
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
        <p className="text-xs text-emerald-600 mb-0.5">Начисление ЗП при утверждении</p>
        <p className="font-bold text-emerald-800 text-lg">
          {estimatedSalary.toLocaleString('ru-RU')} ₽{mechCount === 2 && ' × 2'}
        </p>
        <p className="text-xs text-emerald-500">
          {(nmToUse / 60).toFixed(1)} нч × {rate.toLocaleString('ru-RU')} ₽ × {mechPct}%
          {mechanicId
            ? ` · ${mechanics.find((m) => m.id === mechanicId)?.name ?? '—'}`
            : ' · нет исполнителя'}
        </p>
      </div>

      {mutation.isError && (
        <p className="text-xs text-red-500 font-bold">{(mutation.error as Error).message}</p>
      )}
    </BottomSheet>
  );
}

// ── Return Order Modal ─────────────────────────────────────────

function ReturnOrderModal({
  order,
  onClose,
  onSuccess,
}: {
  order: PendingOrder;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/service-orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'return', admin_note: note.trim() || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Ошибка');
      return res.json();
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  return (
    <BottomSheet
      title="Вернуть на доработку"
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-slate-100 text-slate-600"
          >
            Назад
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !note.trim()}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-amber-500 text-white disabled:opacity-50"
          >
            {mutation.isPending ? 'Возвращаем...' : 'Вернуть'}
          </button>
        </div>
      }
    >
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={4}
        placeholder="Укажите причину возврата..."
        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none"
      />
      {mutation.isError && (
        <p className="text-xs text-red-500 font-bold">{(mutation.error as Error).message}</p>
      )}
    </BottomSheet>
  );
}

// ── Reject Request Modal ───────────────────────────────────────

function RejectRequestModal({
  request,
  onClose,
  onSuccess,
}: {
  request: RepairRequest;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/repair-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', admin_note: note.trim() || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Ошибка');
      return res.json();
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  return (
    <BottomSheet
      title="Отклонить заявку"
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-slate-100 text-slate-600"
          >
            Назад
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-red-600 text-white disabled:opacity-50"
          >
            {mutation.isPending ? 'Отклоняем...' : 'Отклонить'}
          </button>
        </div>
      }
    >
      <div className="bg-slate-50 rounded-xl p-3 text-sm">
        <p className="font-bold">{request.asset?.short_name ?? '—'}</p>
        <p className="text-slate-500 text-xs">
          {request.fault?.name ?? request.custom_description ?? 'Без описания'}
        </p>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="Причина отклонения (необязательно)..."
        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none"
      />
      {mutation.isError && (
        <p className="text-xs text-red-500 font-bold">{(mutation.error as Error).message}</p>
      )}
    </BottomSheet>
  );
}

// ── Client Vehicle Selector ────────────────────────────────────

interface ClientVehicle {
  id: string;
  brand: string;
  model: string | null;
  reg_number: string;
  color: string | null;
  counterparty: { id: string; name: string; phone: string | null } | null;
}

interface CounterpartyOption {
  id: string;
  name: string;
  phone: string | null;
}

function CounterpartySubForm({
  value,
  onChange,
  apiBase,
}: {
  value: CounterpartyOption | null;
  onChange: (v: CounterpartyOption | null) => void;
  apiBase: string;
}) {
  const [cpSearch, setCpSearch] = useState('');
  const [showNewCp, setShowNewCp] = useState(false);
  const [newCpName, setNewCpName] = useState('');
  const [newCpPhone, setNewCpPhone] = useState('');
  const queryClient = useQueryClient();

  const { data: cpResults = [] } = useQuery<CounterpartyOption[]>({
    queryKey: ['cp-search', apiBase, cpSearch],
    queryFn: async () => {
      const r = await fetch(`${apiBase}?search=${encodeURIComponent(cpSearch)}`);
      if (!r.ok) throw new Error('Ошибка загрузки');
      return r.json();
    },
    staleTime: 10_000,
  });

  const createCpMutation = useMutation({
    mutationFn: async () => {
      if (!newCpName.trim()) throw new Error('Введите имя клиента');
      const r = await fetch(apiBase, {
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
          <p className="text-xs font-black text-slate-900">{value.name}</p>
          {value.phone && <p className="text-xs text-slate-400">{value.phone}</p>}
        </div>
        <button onClick={() => onChange(null)} className="text-slate-400 text-sm font-bold ml-2">
          ✕
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
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
          />
          {cpResults.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              {cpResults.map((cp, i) => (
                <button
                  key={cp.id}
                  type="button"
                  onClick={() => {
                    onChange(cp);
                    setCpSearch('');
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 active:bg-slate-100 text-sm',
                    i < cpResults.length - 1 && 'border-b border-slate-100',
                  )}
                >
                  <span className="font-bold text-slate-900">{cp.name}</span>
                  {cp.phone && <span className="text-slate-400 text-xs ml-2">{cp.phone}</span>}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowNewCp(true)}
            className="text-xs font-black text-blue-600 uppercase tracking-widest py-0.5"
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
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
          />
          <input
            value={newCpPhone}
            onChange={(e) => setNewCpPhone(e.target.value)}
            placeholder="Телефон"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
          />
          {createCpMutation.isError && (
            <p className="text-xs text-red-500">{(createCpMutation.error as Error).message}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowNewCp(false)}
              className="flex-1 py-1.5 rounded-lg text-xs font-black bg-slate-200 text-slate-600"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => createCpMutation.mutate()}
              disabled={createCpMutation.isPending}
              className="flex-[2] py-1.5 rounded-lg text-xs font-black bg-blue-600 text-white disabled:bg-blue-300"
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
      const r = await fetch(`/api/admin/client-vehicles?search=${encodeURIComponent(search)}`);
      if (!r.ok) throw new Error('Ошибка загрузки');
      return r.json();
    },
    staleTime: 10_000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newBrand.trim() || !newReg.trim()) throw new Error('Марка и госномер обязательны');
      const r = await fetch('/api/admin/client-vehicles', {
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
      <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 flex items-center justify-between">
        <div>
          <p className="text-sm font-black text-slate-900">
            {value.brand} {value.model} · {value.reg_number}
          </p>
          {value.counterparty && (
            <p className="text-xs text-slate-500">{value.counterparty.name}</p>
          )}
        </div>
        <button
          onClick={() => onChange(null)}
          className="text-slate-400 text-lg font-bold leading-none ml-3"
        >
          ✕
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
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold"
        />
        {isFetching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            ...
          </span>
        )}
      </div>

      {results.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          {results.map((v, i) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                onChange(v);
                setSearch('');
              }}
              className={cn(
                'w-full text-left px-3 py-2.5 active:bg-slate-100',
                i < results.length - 1 && 'border-b border-slate-100',
              )}
            >
              <p className="text-sm font-bold text-slate-900">
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
          className="text-xs font-black text-blue-600 uppercase tracking-widest py-1"
        >
          + Добавить новый автомобиль
        </button>
      ) : (
        <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Новый автомобиль
          </p>
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
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              Клиент (необязательно)
            </p>
            <CounterpartySubForm
              value={newCounterparty}
              onChange={setNewCounterparty}
              apiBase="/api/admin/counterparties"
            />
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
              className="flex-1 py-2 rounded-lg text-xs font-black bg-slate-200 text-slate-600"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="flex-[2] py-2 rounded-lg text-xs font-black bg-zinc-900 text-white disabled:bg-zinc-400"
            >
              {createMutation.isPending ? 'Сохраняем...' : 'Сохранить и выбрать'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Create Order Modal ─────────────────────────────────────────

function CreateOrderModal({
  mechanics,
  onClose,
  onSuccess,
}: {
  mechanics: Mechanic[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [machineType, setMachineType] = useState<'own' | 'client'>('own');
  const [assetId, setAssetId] = useState('');
  const [selectedClientVehicle, setSelectedClientVehicle] = useState<ClientVehicle | null>(null);
  const [problemDesc, setProblemDesc] = useState('');
  const [mechanicId, setMechanicId] = useState('');
  const [secondMechanicId, setSecondMechanicId] = useState('');
  const [odometer, setOdometer] = useState('');
  const [selectedWorkIds, setSelectedWorkIds] = useState<Set<string>>(new Set());

  const { data: assets = [] } = useQuery<AssetItem[]>({
    queryKey: ['admin-assets'],
    queryFn: async () => {
      const r = await fetch('/api/admin/assets');
      if (!r.ok) throw new Error('Ошибка загрузки');
      return r.json();
    },
    staleTime: 60_000,
  });

  const { data: workCatalog = [] } = useQuery<WorkCatalogItem[]>({
    queryKey: ['admin-work-catalog'],
    queryFn: async () => {
      const r = await fetch('/api/admin/work-catalog');
      if (!r.ok) throw new Error('Ошибка загрузки');
      return r.json();
    },
    staleTime: 60_000,
  });

  const toggleWork = (id: string) =>
    setSelectedWorkIds((p) => {
      const n = new Set(p);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
      }
      return n;
    });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!problemDesc.trim()) throw new Error('Введите описание проблемы');
      if (machineType === 'own' && !assetId) throw new Error('Выберите автомобиль из парка');
      if (machineType === 'client' && !selectedClientVehicle)
        throw new Error('Выберите или создайте клиентский автомобиль');
      const res = await fetch('/api/admin/service-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_type: machineType,
          asset_id: machineType === 'own' ? assetId : undefined,
          client_vehicle_id: machineType === 'client' ? selectedClientVehicle?.id : undefined,
          problem_description: problemDesc,
          assigned_mechanic_id: mechanicId || undefined,
          second_mechanic_id: secondMechanicId || undefined,
          odometer_start: odometer ? Number(odometer) : undefined,
          work_ids: selectedWorkIds.size > 0 ? [...selectedWorkIds] : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Ошибка');
      return res.json();
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  return (
    <BottomSheet
      title="Новый наряд"
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-slate-100 text-slate-600"
          >
            Отмена
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-[2] py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-zinc-900 text-white disabled:bg-zinc-400"
          >
            {mutation.isPending ? 'Создаём...' : 'Создать наряд'}
          </button>
        </div>
      }
    >
      {/* Machine type */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
          Тип машины
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(['own', 'client'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setMachineType(t)}
              className={cn(
                'py-2.5 rounded-xl text-sm font-bold transition-all',
                machineType === t ? 'bg-zinc-900 text-white' : 'bg-slate-100 text-slate-600',
              )}
            >
              {t === 'own' ? 'Свой автопарк' : 'Клиентская'}
            </button>
          ))}
        </div>
      </div>

      {/* Asset or client vehicle */}
      {machineType === 'own' ? (
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
            Автомобиль *
          </label>
          <select
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white"
          >
            <option value="">— Выберите —</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.short_name} · {a.reg_number}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
            Автомобиль клиента *
          </label>
          <ClientVehicleSelector
            value={selectedClientVehicle}
            onChange={setSelectedClientVehicle}
          />
        </div>
      )}

      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
          Текущий пробег (км)
        </label>
        <input
          type="number"
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
          placeholder="Необязательно"
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold"
        />
      </div>

      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
          Описание проблемы *
        </label>
        <textarea
          value={problemDesc}
          onChange={(e) => setProblemDesc(e.target.value)}
          rows={2}
          placeholder="Что случилось..."
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none"
        />
      </div>

      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
          Виды работ
        </label>
        <WorkSelector
          workCatalog={workCatalog}
          selectedIds={selectedWorkIds}
          onToggle={toggleWork}
        />
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
            Механик
          </label>
          <select
            value={mechanicId}
            onChange={(e) => setMechanicId(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white"
          >
            <option value="">— Не назначать —</option>
            {mechanics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
            Второй механик
          </label>
          <select
            value={secondMechanicId}
            onChange={(e) => setSecondMechanicId(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white"
          >
            <option value="">— Не нужен —</option>
            {mechanics
              .filter((m) => m.id !== mechanicId)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {mutation.isError && (
        <p className="text-xs text-red-500 font-bold">{(mutation.error as Error).message}</p>
      )}
    </BottomSheet>
  );
}

// ── Tabs ───────────────────────────────────────────────────────

const TABS = [
  { id: 'home', label: 'Главная', countKey: null },
  { id: 'requests', label: 'Заявки', countKey: 'repairRequests' },
  { id: 'approval', label: 'Утверждение', countKey: 'pendingApproval' },
  { id: 'active', label: 'Наряды', countKey: 'activeOrders' },
  { id: 'extra', label: 'Доп. работы', countKey: 'extraWorkPending' },
  { id: 'alerts', label: 'ТО', countKey: 'maintenanceAlerts' },
] as const;

type TabId = (typeof TABS)[number]['id'];
type Modal =
  | { type: 'approve-request'; data: RepairRequest }
  | { type: 'reject-request'; data: RepairRequest }
  | { type: 'approve-order'; data: PendingOrder }
  | { type: 'return-order'; data: PendingOrder }
  | { type: 'create-order' };

// ── Main Page ──────────────────────────────────────────────────

export default function AdminGaragePage() {
  const [tab, setTab] = useState<TabId>('home');
  const [modal, setModal] = useState<Modal | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<GarageData>({
    queryKey: ['admin-garage'],
    queryFn: async () => {
      const r = await fetch('/api/admin/garage');
      if (!r.ok) throw new Error('Ошибка загрузки гаража');
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const { data: mechanics = [] } = useQuery<Mechanic[]>({
    queryKey: ['admin-mechanics'],
    queryFn: async () => {
      const r = await fetch('/api/admin/mechanics');
      if (!r.ok) throw new Error('Ошибка загрузки механиков');
      return r.json();
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-garage'] });

  const extraWorkMutation = useMutation({
    mutationFn: async ({
      orderId,
      workId,
      action,
    }: {
      orderId: string;
      workId: string;
      action: 'approve_extra_work' | 'reject_extra_work';
    }) => {
      const res = await fetch(`/api/admin/service-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, work_id: workId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Ошибка');
      return res.json();
    },
    onSuccess: invalidate,
  });

  const counts = data?.counts ?? {};

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-10 bg-slate-200 rounded-xl" />
        <div className="h-32 bg-slate-200 rounded-xl" />
        <div className="h-32 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  const totalAlerts = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-zinc-900 text-white px-4 h-14 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-lg font-black">Гараж</span>
          {totalAlerts > 0 && (
            <span className="text-[9px] font-black bg-orange-500 px-2 py-0.5 rounded-full">
              {totalAlerts}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setModal({ type: 'create-order' })}
            className="bg-white text-zinc-900 text-xs font-black px-3 py-1.5 rounded-lg"
          >
            + Создать
          </button>
          <button
            onClick={() => refetch()}
            className="text-zinc-400 text-xs font-black uppercase tracking-widest"
          >
            ↻
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="bg-white border-b border-slate-200 sticky top-14 z-30 flex overflow-x-auto">
        {TABS.map((t) => {
          const cnt = t.countKey ? (counts[t.countKey] ?? 0) : 0;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-shrink-0 px-4 h-11 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest border-b-2 transition-colors',
                tab === t.id
                  ? 'text-orange-600 border-orange-600'
                  : 'text-zinc-400 border-transparent',
              )}
            >
              {t.label}
              {cnt > 0 && (
                <span className="bg-orange-500 text-white text-[8px] font-black rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-4 space-y-3">
        {/* ── Главная ── */}
        {tab === 'home' && (
          <>
            {/* KPI grid 2×2 */}
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: 'Заявок водителей',
                  value: counts.repairRequests ?? 0,
                  color: 'text-violet-600',
                  sub: 'ждут одобрения',
                  onClick: () => setTab('requests'),
                },
                {
                  label: 'На утверждении',
                  value: counts.pendingApproval ?? 0,
                  color: 'text-amber-600',
                  sub: 'нарядов закрыто',
                  onClick: () => setTab('approval'),
                },
                {
                  label: 'В работе',
                  value: counts.activeOrders ?? 0,
                  color: 'text-blue-600',
                  sub: 'нарядов сейчас',
                  onClick: () => setTab('active'),
                },
                {
                  label: 'Алертов ТО',
                  value: counts.maintenanceAlerts ?? 0,
                  color: 'text-red-600',
                  sub: 'требуют внимания',
                  onClick: () => setTab('alerts'),
                },
              ].map((kpi) => (
                <button
                  key={kpi.label}
                  onClick={kpi.onClick}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-left active:scale-95 transition-transform"
                >
                  <p className="text-xs text-slate-400 mb-1">{kpi.label}</p>
                  <p className={cn('text-3xl font-bold mb-1', kpi.color)}>{kpi.value}</p>
                  <p className="text-xs text-slate-400">{kpi.sub}</p>
                </button>
              ))}
            </div>

            {/* Требуют действий */}
            {(data?.pendingApproval ?? []).length > 0 && (
              <>
                <SectionLabel
                  title="Требуют утверждения"
                  count={data?.pendingApproval.length}
                  color="bg-amber-100 text-amber-700"
                />
                {(data?.pendingApproval ?? []).slice(0, 3).map((order) => {
                  const totalNm = order.service_order_works
                    .filter((w) => w.status !== 'cancelled')
                    .reduce((s, w) => s + (w.actual_minutes ?? w.norm_minutes), 0);
                  return (
                    <Card key={order.id} className="border-l-4 border-l-amber-400">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-black text-slate-900">
                            #{order.order_number} · {order.asset?.short_name ?? '—'}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {order.mechanic?.name ?? 'Без механика'} · {(totalNm / 60).toFixed(1)}{' '}
                            н/ч факт
                          </p>
                        </div>
                        <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                          На проверке
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <ActionBtn
                          variant="approve"
                          onClick={() => setModal({ type: 'approve-order', data: order })}
                        >
                          Утвердить
                        </ActionBtn>
                        <ActionBtn
                          variant="return"
                          onClick={() => setModal({ type: 'return-order', data: order })}
                        >
                          Вернуть
                        </ActionBtn>
                      </div>
                    </Card>
                  );
                })}
                {(data?.pendingApproval ?? []).length > 3 && (
                  <button
                    onClick={() => setTab('approval')}
                    className="w-full text-center text-xs font-bold text-orange-600 py-2"
                  >
                    Ещё {(data?.pendingApproval.length ?? 0) - 3} нарядов →
                  </button>
                )}
              </>
            )}

            {/* Заявки водителей */}
            {(data?.repairRequests ?? []).length > 0 && (
              <>
                <SectionLabel
                  title="Новые заявки от водителей"
                  count={data?.repairRequests.length}
                  color="bg-violet-100 text-violet-700"
                />
                {(data?.repairRequests ?? []).slice(0, 2).map((req) => (
                  <Card key={req.id} className="border-l-4 border-l-violet-400">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-900">{req.asset?.short_name ?? '—'}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {req.fault?.name ?? req.custom_description ?? 'Без описания'}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {req.driver?.name ?? '—'} · {formatDate(req.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <ActionBtn
                        variant="approve"
                        onClick={() => setModal({ type: 'approve-request', data: req })}
                      >
                        Создать наряд
                      </ActionBtn>
                      <ActionBtn
                        variant="reject"
                        onClick={() => setModal({ type: 'reject-request', data: req })}
                      >
                        Отклонить
                      </ActionBtn>
                    </div>
                  </Card>
                ))}
              </>
            )}

            {/* В работе */}
            {(data?.activeOrders ?? []).length > 0 && (
              <>
                <SectionLabel title="В работе прямо сейчас" />
                {(data?.activeOrders ?? []).slice(0, 3).map((order) => (
                  <Card key={order.id} className="border-l-4 border-l-blue-400">
                    <p className="font-black text-slate-900">{order.asset?.short_name ?? '—'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      НЗ-{order.order_number} ·{' '}
                      {[order.mechanic?.name, order.second_mechanic?.name]
                        .filter(Boolean)
                        .join(' + ') || 'Без механика'}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[10px] text-slate-400">{formatDate(order.created_at)}</p>
                      <StatusBadge status={order.status} />
                    </div>
                  </Card>
                ))}
              </>
            )}

            {totalAlerts === 0 && <EmptyState icon="✅" text="Всё под контролем" />}
          </>
        )}

        {/* ── Заявки водителей ── */}
        {tab === 'requests' && (
          <>
            <SectionLabel
              title="Заявки водителей"
              count={data?.repairRequests.length ?? 0}
              color="bg-orange-100 text-orange-700"
            />
            {(data?.repairRequests ?? []).length === 0 ? (
              <EmptyState icon="✅" text="Нет новых заявок" />
            ) : (
              data?.repairRequests.map((req) => (
                <Card key={req.id}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-900 truncate">
                        {req.asset?.short_name ?? '—'}
                      </p>
                      <p className="text-xs font-bold text-slate-500 mt-0.5">
                        {req.fault?.name ?? req.custom_description ?? 'Без описания'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {req.driver?.name ?? '—'} · {formatDate(req.created_at)}
                      </p>
                    </div>
                    {req.fault?.category && (
                      <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-full flex-shrink-0">
                        {req.fault.category}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <ActionBtn
                      variant="approve"
                      onClick={() => setModal({ type: 'approve-request', data: req })}
                    >
                      Создать наряд
                    </ActionBtn>
                    <ActionBtn
                      variant="reject"
                      onClick={() => setModal({ type: 'reject-request', data: req })}
                    >
                      Отклонить
                    </ActionBtn>
                  </div>
                </Card>
              ))
            )}
          </>
        )}

        {/* ── На утверждении ── */}
        {tab === 'approval' && (
          <>
            <SectionLabel
              title="На утверждении"
              count={data?.pendingApproval.length ?? 0}
              color="bg-blue-100 text-blue-700"
            />
            {(data?.pendingApproval ?? []).length === 0 ? (
              <EmptyState icon="✅" text="Нет нарядов на утверждении" />
            ) : (
              data?.pendingApproval.map((order) => {
                const totalNm = order.service_order_works
                  .filter((w) => w.status !== 'cancelled')
                  .reduce((s, w) => s + (w.actual_minutes ?? w.norm_minutes), 0);
                return (
                  <Card key={order.id}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-black text-slate-900">
                          #{order.order_number} · {order.asset?.short_name ?? '—'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {order.mechanic?.name ?? 'Механик не назначен'}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {formatDate(order.created_at)} · {(totalNm / 60).toFixed(1)} н/ч факт
                        </p>
                      </div>
                      <span className="text-[9px] font-black bg-blue-50 text-blue-700 px-2 py-1 rounded-full flex-shrink-0">
                        На проверке
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <ActionBtn
                        variant="approve"
                        onClick={() => setModal({ type: 'approve-order', data: order })}
                      >
                        Утвердить
                      </ActionBtn>
                      <ActionBtn
                        variant="return"
                        onClick={() => setModal({ type: 'return-order', data: order })}
                      >
                        Вернуть
                      </ActionBtn>
                    </div>
                  </Card>
                );
              })
            )}
          </>
        )}

        {/* ── Активные наряды ── */}
        {tab === 'active' && (
          <>
            <SectionLabel
              title="Активные наряды"
              count={data?.activeOrders.length ?? 0}
              color="bg-zinc-200 text-zinc-600"
            />
            {(data?.activeOrders ?? []).length === 0 ? (
              <EmptyState icon="🏖" text="Нет активных нарядов" />
            ) : (
              data?.activeOrders.map((order) => (
                <Card key={order.id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-black text-slate-900">
                        #{order.order_number} · {order.asset?.short_name ?? '—'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {[order.mechanic?.name, order.second_mechanic?.name]
                          .filter(Boolean)
                          .join(', ') || 'Не назначен'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {formatDate(order.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                </Card>
              ))
            )}
          </>
        )}

        {/* ── Доп. работы ── */}
        {tab === 'extra' && (
          <>
            <SectionLabel
              title="Доп. работы на согласовании"
              count={data?.extraWorkPending.length ?? 0}
              color="bg-amber-100 text-amber-700"
            />
            {(data?.extraWorkPending ?? []).length === 0 ? (
              <EmptyState icon="✅" text="Нет доп. работ на согласовании" />
            ) : (
              data?.extraWorkPending.map((ew) => (
                <Card key={ew.id} className="border-amber-200">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-black text-slate-900 text-sm">
                      {ew.work?.name ?? ew.custom_work_name ?? 'Доп. работа'}
                    </p>
                    <span className="text-[10px] font-black text-slate-400 flex-shrink-0">
                      {(ew.norm_minutes / 60).toFixed(1)} н/ч
                    </span>
                  </div>
                  {ew.extra_work_mechanic_note && (
                    <p className="text-xs text-slate-600 italic mb-2">
                      «{ew.extra_work_mechanic_note}»
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 mb-3">
                    Наряд #{ew.service_order?.order_number ?? '—'} ·{' '}
                    {ew.service_order?.asset?.short_name ?? '—'} ·{' '}
                    {ew.service_order?.mechanic?.name ?? '—'}
                  </p>
                  <div className="flex gap-2">
                    <ActionBtn
                      variant="approve"
                      disabled={extraWorkMutation.isPending}
                      onClick={() =>
                        extraWorkMutation.mutate({
                          orderId: ew.service_order!.id,
                          workId: ew.id,
                          action: 'approve_extra_work',
                        })
                      }
                    >
                      Одобрить
                    </ActionBtn>
                    <ActionBtn
                      variant="reject"
                      disabled={extraWorkMutation.isPending}
                      onClick={() =>
                        extraWorkMutation.mutate({
                          orderId: ew.service_order!.id,
                          workId: ew.id,
                          action: 'reject_extra_work',
                        })
                      }
                    >
                      Отклонить
                    </ActionBtn>
                  </div>
                </Card>
              ))
            )}
          </>
        )}

        {/* ── ТО алерты ── */}
        {tab === 'alerts' && (
          <>
            <SectionLabel
              title="Алерты технического обслуживания"
              count={data?.maintenanceAlerts.length ?? 0}
              color="bg-red-100 text-red-700"
            />
            {(data?.maintenanceAlerts ?? []).length === 0 ? (
              <EmptyState icon="✅" text="Нет алертов ТО" />
            ) : (
              data?.maintenanceAlerts.map((alert) => (
                <Card
                  key={alert.id}
                  className={
                    alert.alert_status === 'overdue' ? 'border-red-300' : 'border-amber-200'
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-900 text-sm truncate">
                        {alert.work_name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {alert.asset?.short_name ?? '—'} · {alert.asset?.reg_number ?? '—'}
                      </p>
                      <div className="flex gap-3 mt-1.5">
                        {alert.next_due_km != null && (
                          <p className="text-[10px] font-bold text-slate-500">
                            До: {alert.next_due_km.toLocaleString('ru-RU')} км
                          </p>
                        )}
                        {alert.asset?.odometer_current != null && (
                          <p className="text-[10px] font-bold text-slate-500">
                            Тек: {alert.asset.odometer_current.toLocaleString('ru-RU')} км
                          </p>
                        )}
                        {alert.next_due_at && (
                          <p className="text-[10px] font-bold text-slate-500">
                            {formatDate(alert.next_due_at)}
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'text-[8px] font-black px-2 py-1 rounded-full flex-shrink-0',
                        alert.alert_status === 'overdue'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700',
                      )}
                    >
                      {alert.alert_status === 'overdue' ? '🔴 Просрочено' : '🟡 Скоро'}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {modal?.type === 'approve-request' && (
        <ApproveRequestModal
          request={modal.data}
          mechanics={mechanics}
          onClose={() => setModal(null)}
          onSuccess={invalidate}
        />
      )}
      {modal?.type === 'reject-request' && (
        <RejectRequestModal
          request={modal.data}
          onClose={() => setModal(null)}
          onSuccess={invalidate}
        />
      )}
      {modal?.type === 'approve-order' && (
        <ApproveOrderModal
          order={modal.data}
          mechanics={mechanics}
          onClose={() => setModal(null)}
          onSuccess={invalidate}
        />
      )}
      {modal?.type === 'return-order' && (
        <ReturnOrderModal
          order={modal.data}
          onClose={() => setModal(null)}
          onSuccess={invalidate}
        />
      )}
      {modal?.type === 'create-order' && (
        <CreateOrderModal
          mechanics={mechanics}
          onClose={() => setModal(null)}
          onSuccess={invalidate}
        />
      )}
    </>
  );
}
