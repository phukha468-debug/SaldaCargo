'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@saldacargo/ui';
import type { Mechanic, OrderDetail } from '../../types';
import { fmtDate } from '../../utils';
import type { AddWorkPayload } from './OrderDetailAddWorkForm';
import { OrderDetailApprovalModal } from './OrderDetailApprovalModal';
import { OrderDetailCloseDialog } from './OrderDetailCloseDialog';
import { OrderDetailMetaSection } from './OrderDetailMetaSection';
import { OrderDetailNotesAndDanger } from './OrderDetailNotesAndDanger';
import { OrderDetailPartsSection } from './OrderDetailPartsSection';
import type { PatchWorkBody } from './OrderDetailWorkEditForm';
import { OrderDetailWorksSection } from './OrderDetailWorksSection';

export function OrderDetailModal({
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
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  const [showAddWork, setShowAddWork] = useState(false);
  const [addWorkError, setAddWorkError] = useState<string | null>(null);
  const [editingWorkId, setEditingWorkId] = useState<string | null>(null);
  const [editWorkPriceDraft, setEditWorkPriceDraft] = useState('');

  const [showAddPart, setShowAddPart] = useState(false);
  const [addPartError, setAddPartError] = useState<string | null>(null);

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [showApprovalPrompt, setShowApprovalPrompt] = useState(false);
  const [approvalSentMsg, setApprovalSentMsg] = useState<string | null>(null);

  const { data: order, isLoading } = useQuery<OrderDetail>({
    queryKey: ['garage-order', orderId],
    queryFn: async () => {
      const r = await fetch(`/api/garage/orders/${orderId}`);
      if (!r.ok) throw new Error('Ошибка');
      return r.json();
    },
    staleTime: 30000,
  });

  const invalidateOrder = () => {
    queryClient.invalidateQueries({ queryKey: ['garage-order', orderId] });
    queryClient.invalidateQueries({ queryKey: ['garage-orders'] });
    queryClient.invalidateQueries({ queryKey: ['garage-dashboard'] });
  };

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
    onSuccess: (_data, variables: Record<string, unknown>) => {
      invalidateOrder();
      if (
        showCloseDialog ||
        variables?.status === 'completed' ||
        variables?.lifecycle_status === 'approved'
      ) {
        setShowCloseDialog(false);
        onClose();
      }
    },
    onError: (err: Error) => {
      alert(`Ошибка: ${err.message}`);
    },
  });

  const addWorkMutation = useMutation({
    mutationFn: (payload: AddWorkPayload) =>
      fetch(`/api/garage/orders/${orderId}/works`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Ошибка');
        return d;
      }),
    onSuccess: () => {
      setAddWorkError(null);
      setShowAddWork(false);
      invalidateOrder();
    },
    onError: (err: Error) => setAddWorkError(err.message),
  });

  const deleteWorkMutation = useMutation({
    mutationFn: (workId: string) =>
      fetch(`/api/garage/orders/${orderId}/works/${workId}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) throw new Error('Ошибка');
        return r.json();
      }),
    onSuccess: invalidateOrder,
  });

  const patchWorkMutation = useMutation({
    mutationFn: ({ workId, body }: { workId: string; body: PatchWorkBody }) =>
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
      setEditWorkPriceDraft('');
      invalidateOrder();
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
    onSuccess: invalidateOrder,
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
      setShowAddPart(false);
      invalidateOrder();
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
    onSuccess: invalidateOrder,
  });

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
      queryClient.invalidateQueries({ queryKey: ['garage-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['garage-orders'] });
    },
  });

  const isClosed = order?.lifecycle_status === 'approved';
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
      if (editingWorkId === w.id && editWorkPriceDraft !== '') {
        return sum + parseFloat(editWorkPriceDraft || '0');
      }
      return sum + parseFloat(w.price_client ?? '0');
    }, 0);

  const prevApprovalMatch = order?.admin_note?.match(
    /\[Отправлено на согласование Александру в MAX: ([^\]]+)\]/,
  );
  const prevApprovalDate: string | null = prevApprovalMatch?.[1] ?? null;

  const openPrint = (doc: 'agreement' | 'works' | 'parts') => {
    if (!order) return;
    window.open(
      `/api/garage/orders/${orderId}/print?doc=${doc}`,
      '_blank',
      'width=900,height=1000',
    );
  };

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
        {/* Шапка */}
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Наряд #{order?.order_number ?? '...'}
            </h2>
            {order && (
              <p className="text-xs text-slate-400">
                Создан: {fmtDate(order.created_at)}
                {order.completed_at && ` · Завершён: ${fmtDate(order.completed_at)}`}
              </p>
            )}
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
                  onClick={() => openPrint('agreement')}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 flex items-center gap-1 shrink-0"
                  title="Предварительный заказ-наряд на согласование (до выполнения, без описания)"
                >
                  📄 1. На согласование
                </button>
                <button
                  onClick={() => openPrint('works')}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 flex items-center gap-1 shrink-0"
                  title="Окончательный Акт выполненных работ (после выполнения, с полным описанием)"
                >
                  🖨 2. Акт работ
                </button>
                <button
                  onClick={() => openPrint('parts')}
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
                    approvalSentMsg || prevApprovalDate
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                      : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-700 text-white',
                  )}
                  title="Отправить список работ на согласование Александру Нигамедьянову в MAX"
                >
                  <span>
                    {sendApprovalMutation.isPending
                      ? '⏳'
                      : approvalSentMsg || prevApprovalDate
                        ? '✓'
                        : '💬'}
                  </span>
                  <span>
                    {sendApprovalMutation.isPending
                      ? 'Отправка...'
                      : approvalSentMsg || prevApprovalDate
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

        {/* Тело */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && <div className="p-6 text-sm text-slate-400 animate-pulse">Загрузка...</div>}
          {order && (
            <div className="p-6 space-y-6">
              <OrderDetailMetaSection
                order={order}
                patchPending={patchMutation.isPending}
                onPatch={(body) => patchMutation.mutate(body)}
              />

              <OrderDetailWorksSection
                order={order}
                mechanics={mechanics}
                hourlyRate={hourlyRate}
                approvalSentMsg={approvalSentMsg}
                prevApprovalDate={prevApprovalDate}
                sendApprovalPending={sendApprovalMutation.isPending}
                onOpenApproval={() => setShowApprovalPrompt(true)}
                showAddWork={showAddWork}
                setShowAddWork={setShowAddWork}
                addWorkPending={addWorkMutation.isPending}
                addWorkError={addWorkError}
                onAddWork={(payload) => addWorkMutation.mutate(payload)}
                editingWorkId={editingWorkId}
                setEditingWorkId={setEditingWorkId}
                onEditWorkPriceDraft={setEditWorkPriceDraft}
                patchWorkPending={patchWorkMutation.isPending}
                patchWorkError={
                  patchWorkMutation.isError ? (patchWorkMutation.error as Error) : null
                }
                onPatchWork={(workId, body) => patchWorkMutation.mutate({ workId, body })}
                deleteWorkPending={deleteWorkMutation.isPending}
                onDeleteWork={(workId) => deleteWorkMutation.mutate(workId)}
              />

              <OrderDetailPartsSection
                key={order.id}
                parts={order.parts}
                showAddPart={showAddPart}
                setShowAddPart={setShowAddPart}
                addPartPending={addPartMutation.isPending}
                addPartError={addPartError}
                onAddPart={(body) => addPartMutation.mutate(body)}
                onPatchPart={(body) => patchPartMutation.mutate(body)}
                deletePartPending={deletePartMutation.isPending}
                onDeletePart={(partId) => deletePartMutation.mutate(partId)}
              />

              <OrderDetailNotesAndDanger
                order={order}
                patchPending={patchMutation.isPending}
                deletePending={deleteOrderMutation.isPending}
                deleteError={deleteError}
                onClearDeleteError={() => setDeleteError(null)}
                onSaveAdminNote={(note) => patchMutation.mutate({ admin_note: note })}
                onReopen={() => {
                  patchMutation.mutate({ lifecycle_status: 'draft' });
                  onClose();
                }}
                onDeleteOrder={(password) => deleteOrderMutation.mutate(password)}
              />
            </div>
          )}
        </div>

        {/* Футер */}
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
                  onClick={() => setShowCloseDialog(true)}
                  disabled={patchMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl text-sm disabled:opacity-50 shrink-0"
                >
                  Завершить наряд →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Диалог закрытия наряда */}
        {showCloseDialog && order && (
          <OrderDetailCloseDialog
            order={order}
            mechanics={mechanics}
            isPending={patchMutation.isPending}
            onConfirm={(updates) => patchMutation.mutate(updates)}
            onClose={() => setShowCloseDialog(false)}
          />
        )}

        {/* Модальное окно согласования в MAX */}
        {showApprovalPrompt && order && (
          <OrderDetailApprovalModal
            order={order}
            isPending={sendApprovalMutation.isPending}
            error={sendApprovalMutation.isError ? (sendApprovalMutation.error as Error) : null}
            onSend={(comment) => sendApprovalMutation.mutate(comment)}
            onClose={() => setShowApprovalPrompt(false)}
          />
        )}
      </div>
    </div>
  );
}
