'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@saldacargo/ui';
import type { TabOrder } from '../types';
import { fmtDate, moneyVal } from '../utils';

export function OrderCard({ o, onSelect }: { o: TabOrder; onSelect: (id: string) => void }) {
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
      : [o.client_vehicle_brand, o.client_vehicle_model, o.client_vehicle_reg]
          .filter(Boolean)
          .join(' ');
  const clientLabel = o.machine_type === 'client' ? (o.client_name ?? null) : null;

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
        <span
          className="text-[11px] text-slate-400 shrink-0 hidden md:block"
          title={
            o.completed_at
              ? `Завершён: ${fmtDate(o.completed_at)} (создан: ${fmtDate(o.created_at)})`
              : `Создан: ${fmtDate(o.created_at)}`
          }
        >
          {o.completed_at
            ? new Date(o.completed_at).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
              })
            : new Date(o.created_at).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
              })}
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
