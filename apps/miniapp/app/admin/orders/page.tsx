/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState, useRef, useEffect } from 'react';
import { Money, cn } from '@saldacargo/ui';

// ── Вспомогательные функции ──────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  created: 'Создан',
  in_progress: 'В работе',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-rose-50 text-rose-700 border-rose-200',
  normal: 'bg-zinc-100 text-zinc-500 border-zinc-200',
  low: 'bg-blue-50 text-blue-600 border-blue-200',
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Срочно',
  normal: 'Обычный',
  low: 'Низкий',
};

function calcOrderTotals(order: any) {
  const works = order.works ?? [];
  const parts = order.parts ?? [];
  const worksTotal = works.reduce((s: number, w: any) => s + parseFloat(w.price_client ?? '0'), 0);
  const partsTotal = parts.reduce(
    (s: number, p: any) => s + parseFloat(p.price_per_unit ?? '0') * parseFloat(p.quantity ?? '1'),
    0,
  );
  return { worksTotal, partsTotal, total: worksTotal + partsTotal };
}

function vehicleLabel(order: any) {
  if (order.machine_type === 'own') {
    const a = order.asset;
    if (!a) return '—';
    return [a.short_name, a.reg_number].filter(Boolean).join(' · ');
  }
  return [order.client_vehicle_brand, order.client_vehicle_model, order.client_vehicle_reg]
    .filter(Boolean)
    .join(' ');
}

// ── DateNav ──────────────────────────────────────────────────

function DateNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const today = new Date().toISOString().slice(0, 10);

  const shift = (days: number) => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    const s = d.toISOString().slice(0, 10);
    if (s <= today) onChange(s);
  };

  const months = Array.from({ length: 5 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (4 - i));
    return {
      label: d.toLocaleDateString('ru-RU', { month: 'short' }),
      year: d.getFullYear(),
      month: d.getMonth(),
    };
  });

  const goMonth = (year: number, month: number) => {
    const now = new Date();
    if (year === now.getFullYear() && month === now.getMonth()) {
      onChange(today);
    } else {
      const last = new Date(year, month + 1, 0);
      onChange(last.toISOString().slice(0, 10));
    }
  };

  const dt = new Date(date + 'T12:00:00');
  const curMonth = dt.getMonth();
  const curYear = dt.getFullYear();
  const isToday = date === today;

  const dateLabel = dt.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    weekday: 'short',
  });

  return (
    <div className="bg-zinc-900">
      <div className="flex items-stretch h-14">
        <button
          onClick={() => shift(-1)}
          className="flex items-center justify-center w-16 bg-sky-600 active:bg-sky-700 transition-colors text-white shrink-0"
        >
          <span className="text-2xl font-black select-none">←</span>
        </button>

        <label className="flex-1 flex items-center justify-center gap-2 cursor-pointer px-2">
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && onChange(e.target.value)}
            className="sr-only"
          />
          <span className="text-white font-black text-sm text-center leading-tight">
            {dateLabel}
          </span>
          {!isToday && (
            <span className="text-[9px] font-bold text-sky-300 bg-sky-600/30 border border-sky-500/30 px-1.5 py-0.5 rounded-full whitespace-nowrap">
              → сег.
            </span>
          )}
        </label>

        <button
          onClick={() => shift(1)}
          disabled={date >= today}
          className="flex items-center justify-center w-16 bg-sky-600 active:bg-sky-700 transition-colors text-white shrink-0 disabled:bg-zinc-800 disabled:text-zinc-600"
        >
          <span className="text-2xl font-black select-none">→</span>
        </button>
      </div>

      <div className="flex border-t border-zinc-800">
        {months.map((m) => {
          const active = m.month === curMonth && m.year === curYear;
          return (
            <button
              key={`${m.year}-${m.month}`}
              onClick={() => goMonth(m.year, m.month)}
              className={cn(
                'flex-1 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors border-r border-zinc-800 last:border-r-0',
                active
                  ? 'bg-sky-600 text-white'
                  : 'text-zinc-500 active:bg-zinc-800 active:text-zinc-200',
              )}
            >
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Модал редактирования заметки ─────────────────────────────

function NoteModal({
  order,
  onClose,
  onSaved,
}: {
  order: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [note, setNote] = useState(order.admin_note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const y = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${y}px`;
    document.body.style.width = '100%';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, y);
    };
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    const res = await fetch(`/api/admin/service-orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit_note', admin_note: note }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? 'Ошибка сохранения');
      return;
    }
    onSaved();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-t-3xl shadow-2xl max-h-[90svh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-zinc-200 rounded-full" />
        </div>

        <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-black text-zinc-900 text-base">Наряд #{order.order_number}</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Заметка администратора</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 text-xl font-bold active:bg-zinc-200"
          >
            ×
          </button>
        </div>

        <div
          className="overflow-y-auto flex-1 min-h-0 p-5 space-y-4"
          style={
            {
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
            } as React.CSSProperties
          }
        >
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="Заметка для механика..."
            className="w-full border border-zinc-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-zinc-400 resize-none"
          />
          {error && (
            <p className="text-sm text-rose-700 font-medium bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}
          <div className="flex gap-3 pb-6">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 bg-zinc-900 text-white font-black py-4 rounded-2xl active:bg-zinc-700 disabled:opacity-50 transition-all text-sm"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              onClick={onClose}
              className="px-5 text-sm text-zinc-500 border border-zinc-200 rounded-2xl active:bg-zinc-50 font-bold"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Карточка наряда (expandable) ─────────────────────────────

function OrderCard({
  order,
  onEdit,
  onAction,
  actioning,
}: {
  order: any;
  onEdit: (o: any) => void;
  onAction: (id: string, action: 'approve' | 'return' | 'cancel') => void;
  actioning: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { worksTotal, partsTotal, total } = calcOrderTotals(order);
  const canReview = order.lifecycle_status === 'draft';
  const isActive = ['created', 'in_progress'].includes(order.status);

  const vehicle = vehicleLabel(order);
  const works = order.works ?? [];
  const parts = order.parts ?? [];

  const handleCancelClick = () => {
    if (!cancelConfirm) {
      setCancelConfirm(true);
      cancelTimerRef.current = setTimeout(() => setCancelConfirm(false), 4000);
    } else {
      if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
      setCancelConfirm(false);
      onAction(order.id, 'cancel');
    }
  };

  useEffect(() => {
    return () => {
      if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
    };
  }, []);

  return (
    <div
      className={cn(
        'bg-white rounded-2xl border-2 overflow-hidden shadow-sm',
        canReview ? 'border-orange-300' : 'border-zinc-100',
      )}
    >
      <button
        className="w-full text-left active:bg-zinc-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-stretch">
          <div
            className={cn(
              'w-1 shrink-0',
              order.priority === 'urgent' ? 'bg-rose-400' : 'bg-zinc-200',
            )}
          />
          <div className="flex-1 p-4">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-black text-zinc-900 text-sm">{vehicle || '—'}</span>
                  <span className="text-[9px] font-bold bg-zinc-100 text-zinc-400 px-1.5 py-0.5 rounded">
                    #{order.order_number}
                  </span>
                  {order.priority && order.priority !== 'normal' && (
                    <span
                      className={cn(
                        'text-[9px] font-bold px-1.5 py-0.5 rounded border',
                        PRIORITY_STYLES[order.priority],
                      )}
                    >
                      {PRIORITY_LABELS[order.priority]}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 font-medium truncate">
                  {order.mechanic?.name ?? 'Без механика'} ·{' '}
                  {STATUS_LABELS[order.status] ?? order.status}
                </p>
                {order.problem_description && (
                  <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
                    {order.problem_description}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                {total > 0 && (
                  <p className="font-black text-zinc-900 text-base">
                    <Money amount={total.toFixed(2)} />
                  </p>
                )}
                {isActive && (
                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                    В работе
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'text-zinc-300 text-xl shrink-0 mt-0.5 transition-transform duration-200',
                  expanded ? 'rotate-180' : '',
                )}
              >
                ↓
              </span>
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-zinc-100 animate-in slide-in-from-top-1 duration-150">
          {/* Работы */}
          {works.length > 0 && (
            <div className="px-4 py-3 space-y-2">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                Работы
              </p>
              {works.map((w: any) => {
                const name = w.work_catalog?.name ?? w.custom_work_name ?? 'Работа';
                const price = parseFloat(w.price_client ?? '0');
                const done = w.status === 'done';
                return (
                  <div key={w.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span
                        className={cn('text-[10px]', done ? 'text-emerald-500' : 'text-zinc-300')}
                      >
                        {done ? '●' : '○'}
                      </span>
                      <span className="text-sm text-zinc-700 truncate">{name}</span>
                    </div>
                    {price > 0 && (
                      <span className="text-sm font-bold text-zinc-800 shrink-0">
                        <Money amount={price.toFixed(2)} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Запчасти */}
          {parts.length > 0 && (
            <div className="px-4 pb-3 space-y-2 border-t border-zinc-50 pt-3">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                Запчасти
              </p>
              {parts.map((p: any) => {
                const qty = parseFloat(p.quantity ?? '1');
                const ppu = parseFloat(p.price_per_unit ?? '0');
                const line = qty * ppu;
                return (
                  <div key={p.id} className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-zinc-700 truncate block">
                        {p.part?.name ?? '—'}
                      </span>
                      {p.part?.unit && (
                        <span className="text-[10px] text-zinc-400">
                          {qty} {p.part.unit}
                        </span>
                      )}
                    </div>
                    {line > 0 && (
                      <span className="text-sm font-bold text-zinc-800 shrink-0">
                        <Money amount={line.toFixed(2)} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Итого */}
          {total > 0 && (
            <div className="grid grid-cols-3 border-t border-zinc-100 bg-zinc-50">
              <div className="text-center px-2 py-3 border-r border-zinc-100">
                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                  Работы
                </p>
                <p className="font-bold text-zinc-800 text-sm">
                  <Money amount={worksTotal.toFixed(2)} />
                </p>
              </div>
              <div className="text-center px-2 py-3 border-r border-zinc-100">
                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                  Запчасти
                </p>
                <p className="font-bold text-zinc-800 text-sm">
                  <Money amount={partsTotal.toFixed(2)} />
                </p>
              </div>
              <div className="text-center px-2 py-3">
                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                  Итого
                </p>
                <p className="font-black text-zinc-900 text-sm">
                  <Money amount={total.toFixed(2)} />
                </p>
              </div>
            </div>
          )}

          {/* Заметки */}
          {order.mechanic_note && (
            <div className="px-4 py-2.5 border-t border-zinc-100 bg-amber-50">
              <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">
                Заметка механика
              </p>
              <p className="text-sm text-amber-800">{order.mechanic_note}</p>
            </div>
          )}

          {order.admin_note && (
            <div className="px-4 py-2.5 border-t border-zinc-100 bg-blue-50">
              <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">
                Заметка администратора
              </p>
              <p className="text-sm text-blue-800">{order.admin_note}</p>
            </div>
          )}

          {/* Действия */}
          <div className="px-4 pb-4 pt-3 border-t border-zinc-100 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onEdit(order)}
              className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 border border-zinc-200 px-3 py-2.5 rounded-xl active:bg-zinc-100 shrink-0"
            >
              ✏️ Заметка
            </button>

            <button
              onClick={handleCancelClick}
              disabled={actioning}
              className={cn(
                'text-xs font-bold px-3 py-2.5 rounded-xl border transition-all shrink-0 disabled:opacity-50',
                cancelConfirm
                  ? 'bg-rose-600 text-white border-rose-600 active:bg-rose-700'
                  : 'text-rose-600 border-rose-200 bg-rose-50 active:bg-rose-100',
              )}
            >
              {cancelConfirm ? 'Подтвердить?' : 'Отменить'}
            </button>

            {canReview && (
              <>
                <button
                  onClick={() => onAction(order.id, 'return')}
                  disabled={actioning}
                  className="flex-1 text-xs font-bold text-red-600 border border-red-200 bg-red-50 py-2.5 rounded-xl active:bg-red-100 text-center disabled:opacity-50"
                >
                  ↩ Вернуть
                </button>
                <button
                  onClick={() => onAction(order.id, 'approve')}
                  disabled={actioning}
                  className="flex-1 text-xs font-black text-white bg-emerald-500 py-2.5 rounded-xl active:bg-emerald-600 text-center disabled:opacity-50 shadow-sm"
                >
                  {actioning ? '...' : '✓ Одобрить'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Скелетон ─────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-zinc-200 rounded-2xl h-20" />
      ))}
    </div>
  );
}

// ── Основной контент ─────────────────────────────────────────

function OrdersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const filter = (searchParams.get('filter') ?? 'review') as 'review' | 'active' | 'history';
  const queryClient = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [editOrder, setEditOrder] = useState<any>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchOrders = async (url: string) => {
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Ошибка загрузки нарядов');
    return Array.isArray(json) ? json : [];
  };

  const {
    data: simpleOrders = [],
    isLoading: simpleLoading,
    error: simpleError,
  } = useQuery<any[]>({
    queryKey: ['admin-orders', filter],
    queryFn: () => fetchOrders(`/api/admin/service-orders?filter=${filter}`),
    enabled: filter !== 'history',
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const {
    data: historyOrders = [],
    isLoading: historyLoading,
    error: historyError,
  } = useQuery<any[]>({
    queryKey: ['admin-orders-history', selectedDate],
    queryFn: () => fetchOrders(`/api/admin/service-orders?filter=history&date=${selectedDate}`),
    enabled: filter === 'history',
    staleTime: 30000,
  });

  const orders = filter === 'history' ? historyOrders : simpleOrders;
  const isLoading = filter === 'history' ? historyLoading : simpleLoading;
  const queryError = (filter === 'history' ? historyError : simpleError) as Error | null;

  const refresh = () => {
    if (filter === 'history') {
      queryClient.invalidateQueries({ queryKey: ['admin-orders-history', selectedDate] });
    } else {
      queryClient.invalidateQueries({ queryKey: ['admin-orders', filter] });
    }
  };

  async function handleAction(orderId: string, action: 'approve' | 'return' | 'cancel') {
    if (action === 'return' && !confirm('Вернуть наряд механику на доработку?')) return;
    setActioningId(orderId);
    try {
      const res = await fetch(`/api/admin/service-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка');
      refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setActioningId(null);
    }
  }

  const FILTERS = [
    { key: 'review', label: '📋 На ревью' },
    { key: 'active', label: '🔧 Активные' },
    { key: 'history', label: '📅 История' },
  ];

  const emptyLabel =
    filter === 'review'
      ? 'Нет нарядов на ревью'
      : filter === 'active'
        ? 'Нет активных нарядов'
        : 'Нет нарядов за этот день';

  const emptyIcon = filter === 'review' ? '✅' : filter === 'active' ? '🔧' : '📅';

  return (
    <div>
      {/* Шапка */}
      <header className="bg-white border-b-2 border-zinc-200 px-4 h-16 flex items-center sticky top-0 z-40">
        <h1 className="font-black text-zinc-900 text-lg uppercase tracking-tight">Наряды</h1>
      </header>

      {/* Фильтры */}
      <div className="bg-white border-b border-zinc-100 px-4 py-2 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => router.replace(`/admin/orders?filter=${f.key}`)}
            className={cn(
              'flex-shrink-0 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all',
              filter === f.key
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100 text-zinc-500 active:bg-zinc-200',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filter === 'history' && <DateNav date={selectedDate} onChange={setSelectedDate} />}

      {isLoading ? (
        <Skeleton />
      ) : queryError ? (
        <div className="p-4">
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
            <p className="text-xs font-black text-rose-600 uppercase tracking-widest mb-1">
              Ошибка загрузки
            </p>
            <p className="text-sm text-rose-700 font-mono break-all">{queryError.message}</p>
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
          <span className="text-5xl mb-4">{emptyIcon}</span>
          <p className="font-bold uppercase tracking-widest text-sm">{emptyLabel}</p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {orders.map((order: any) => (
            <OrderCard
              key={order.id}
              order={order}
              onEdit={(o) => setEditOrder(o)}
              onAction={handleAction}
              actioning={actioningId === order.id}
            />
          ))}
        </div>
      )}

      {editOrder && (
        <NoteModal
          order={editOrder}
          onClose={() => setEditOrder(null)}
          onSaved={() => {
            setEditOrder(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

// ── Страница с Suspense ───────────────────────────────────────

export default function AdminOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-zinc-200 rounded-2xl h-20" />
          ))}
        </div>
      }
    >
      <OrdersContent />
    </Suspense>
  );
}
