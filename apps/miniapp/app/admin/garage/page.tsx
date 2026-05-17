'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { cn } from '@saldacargo/ui';
import { formatDate } from '@saldacargo/shared';

// ── Types ──────────────────────────────────────────────────────

interface Asset {
  short_name: string;
  reg_number: string;
}

interface RepairRequest {
  id: string;
  created_at: string;
  custom_description: string | null;
  asset: Asset | null;
  driver: { name: string } | null;
  fault: { name: string; category: string } | null;
}

interface ActiveOrder {
  id: string;
  order_number: number;
  status: string;
  created_at: string;
  asset: Asset | null;
  mechanic: { name: string } | null;
  second_mechanic: { name: string } | null;
}

interface PendingOrder {
  id: string;
  order_number: number;
  created_at: string;
  asset: Asset | null;
  mechanic: { name: string } | null;
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
    asset: Asset | null;
    mechanic: { name: string } | null;
  } | null;
}

interface MaintenanceAlert {
  id: string;
  work_name: string;
  alert_status: 'overdue' | 'soon';
  next_due_km: number | null;
  next_due_at: string | null;
  asset: (Asset & { odometer_current: number | null }) | null;
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

// ── Helpers ────────────────────────────────────────────────────

function SectionHeader({ title, count, color }: { title: string; count: number; color: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{title}</h2>
      {count > 0 && (
        <span className={cn('text-[9px] font-black px-2 py-0.5 rounded-full', color)}>{count}</span>
      )}
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 shadow-sm p-4', className)}>
      {children}
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

// ── Approve Repair Request Modal ───────────────────────────────

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
  const [odometer, setOdometer] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/repair-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          mechanic_id: mechanicId || undefined,
          odometer: odometer ? Number(odometer) : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка');
      }
      return res.json();
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-lg">Одобрить заявку</h3>
          <button onClick={onClose} className="text-zinc-400 text-xl font-bold">
            ✕
          </button>
        </div>

        <div className="bg-slate-50 rounded-xl p-3 text-sm">
          <p className="font-bold text-slate-900">{request.asset?.short_name ?? '—'}</p>
          <p className="text-slate-500 text-xs mt-0.5">
            {request.fault?.name ?? request.custom_description ?? 'Без описания'}
          </p>
          <p className="text-slate-400 text-xs mt-0.5">Водитель: {request.driver?.name ?? '—'}</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
              Назначить механика
            </label>
            <select
              value={mechanicId}
              onChange={(e) => setMechanicId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white"
            >
              <option value="">Не назначать</option>
              {mechanics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
              Одометр (км)
            </label>
            <input
              type="number"
              value={odometer}
              onChange={(e) => setOdometer(e.target.value)}
              placeholder="Необязательно"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold"
            />
          </div>
        </div>

        {mutation.isError && (
          <p className="text-xs text-red-500 font-bold">{(mutation.error as Error).message}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-slate-100 text-slate-600"
          >
            Отмена
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-green-600 text-white disabled:bg-green-300"
          >
            {mutation.isPending ? 'Создаём...' : 'Создать наряд'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Approve Order Modal ────────────────────────────────────────

function ApproveOrderModal({
  order,
  onClose,
  onSuccess,
}: {
  order: PendingOrder;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const totalNm = order.service_order_works
    .filter((w) => w.status !== 'cancelled')
    .reduce((sum, w) => sum + (w.actual_minutes ?? w.norm_minutes), 0);

  const [adjustedNm, setAdjustedNm] = useState('');
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/service-orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          adjusted_norm_minutes: adjustedNm ? Number(adjustedNm) : undefined,
          admin_note: note.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка');
      }
      return res.json();
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-lg">Утвердить наряд #{order.order_number}</h3>
          <button onClick={onClose} className="text-zinc-400 text-xl font-bold">
            ✕
          </button>
        </div>

        <div className="bg-slate-50 rounded-xl p-3 text-sm">
          <p className="font-bold">{order.asset?.short_name ?? '—'}</p>
          <p className="text-slate-500 text-xs">Механик: {order.mechanic?.name ?? 'Не назначен'}</p>
          <p className="text-slate-500 text-xs mt-1">
            Норм-часы (факт): {(totalNm / 60).toFixed(1)} ч
          </p>
        </div>

        <div className="space-y-3">
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
        </div>

        {mutation.isError && (
          <p className="text-xs text-red-500 font-bold">{(mutation.error as Error).message}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-slate-100 text-slate-600"
          >
            Отмена
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-green-600 text-white disabled:bg-green-300"
          >
            {mutation.isPending ? 'Утверждаем...' : 'Утвердить + начислить'}
          </button>
        </div>
      </div>
    </div>
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
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка');
      }
      return res.json();
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-lg">Вернуть на доработку</h3>
          <button onClick={onClose} className="text-zinc-400 text-xl font-bold">
            ✕
          </button>
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Укажите причину возврата..."
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none"
        />

        {mutation.isError && (
          <p className="text-xs text-red-500 font-bold">{(mutation.error as Error).message}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-slate-100 text-slate-600"
          >
            Отмена
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !note.trim()}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-amber-500 text-white disabled:opacity-50"
          >
            {mutation.isPending ? 'Возвращаем...' : 'Вернуть'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reject Repair Request Modal ────────────────────────────────

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
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка');
      }
      return res.json();
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-lg">Отклонить заявку</h3>
          <button onClick={onClose} className="text-zinc-400 text-xl font-bold">
            ✕
          </button>
        </div>
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
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────

type Modal =
  | { type: 'approve-request'; data: RepairRequest }
  | { type: 'reject-request'; data: RepairRequest }
  | { type: 'approve-order'; data: PendingOrder }
  | { type: 'return-order'; data: PendingOrder };

const TABS = [
  { id: 'requests', label: 'Заявки', countKey: 'repairRequests' },
  { id: 'extra', label: 'Доп. работы', countKey: 'extraWorkPending' },
  { id: 'approval', label: 'На утверждении', countKey: 'pendingApproval' },
  { id: 'active', label: 'Активные', countKey: 'activeOrders' },
  { id: 'alerts', label: 'ТО', countKey: 'maintenanceAlerts' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function AdminGaragePage() {
  const [tab, setTab] = useState<TabId>('requests');
  const [modal, setModal] = useState<Modal | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<GarageData>({
    queryKey: ['admin-garage'],
    queryFn: () => fetch('/api/admin/garage').then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const { data: mechanics = [] } = useQuery<Mechanic[]>({
    queryKey: ['admin-mechanics'],
    queryFn: () => fetch('/api/admin/mechanics').then((r) => r.json()),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-garage'] });
  };

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
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка');
      }
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

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-zinc-900 text-white px-4 h-14 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-lg font-black">Гараж</span>
          {Object.values(counts).some((c) => c > 0) && (
            <span className="text-[9px] font-black bg-orange-500 px-2 py-0.5 rounded-full">
              {Object.values(counts).reduce((a, b) => a + b, 0)}
            </span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className="text-zinc-400 text-xs font-black uppercase tracking-widest"
        >
          ↻ Обновить
        </button>
      </header>

      {/* Tab bar */}
      <div className="bg-white border-b border-slate-200 sticky top-14 z-30 flex overflow-x-auto">
        {TABS.map((t) => {
          const cnt = counts[t.countKey] ?? 0;
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
        {/* Tab: Заявки водителей */}
        {tab === 'requests' && (
          <>
            <SectionHeader
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

        {/* Tab: Доп. работы */}
        {tab === 'extra' && (
          <>
            <SectionHeader
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

        {/* Tab: На утверждении */}
        {tab === 'approval' && (
          <>
            <SectionHeader
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
                  .reduce((sum, w) => sum + (w.actual_minutes ?? w.norm_minutes), 0);
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

        {/* Tab: Активные наряды */}
        {tab === 'active' && (
          <>
            <SectionHeader
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

        {/* Tab: ТО алерты */}
        {tab === 'alerts' && (
          <>
            <SectionHeader
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
    </>
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

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="text-center py-12 text-slate-400">
      <p className="text-4xl mb-2">{icon}</p>
      <p className="font-bold text-sm">{text}</p>
    </div>
  );
}
