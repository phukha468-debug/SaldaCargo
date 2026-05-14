'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect } from 'react';
import { Money } from '@saldacargo/ui';
import { formatPhone } from '@saldacargo/shared';

type Client = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  credit_limit: string | null;
  is_active: boolean;
  is_regular: boolean;
  total_revenue: string;
  revenue_30d: string;
  trips_count: number;
  orders_count: number;
  avg_order: string;
  last_trip_at: string | null;
  outstanding_debt: string;
  preferred_payment: string | null;
  payment_breakdown: Record<string, number>;
};

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Нал',
  qr: 'QR',
  card_driver: 'Карта',
  debt_cash: 'Долг',
  bank_invoice: 'Безнал',
};

const emptyForm = { name: '', phone: '', credit_limit: '', notes: '' };

function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function LastTripLabel({ date }: { date: string | null }) {
  const days = daysAgo(date);
  if (days === null) return <span className="text-slate-300">нет рейсов</span>;
  if (days === 0) return <span className="text-emerald-600 font-bold">сегодня</span>;
  if (days <= 7) return <span className="text-emerald-500 font-bold">{days} дн. назад</span>;
  if (days <= 30) return <span className="text-slate-400">{days} дн. назад</span>;
  if (days <= 90) return <span className="text-amber-500">{days} дн. назад</span>;
  return <span className="text-rose-400">{days} дн. назад</span>;
}

function ClientRow({
  client: c,
  mergeMode,
  mergeSelected,
  onMergeToggle,
  onEdit,
  onToggleActive,
  onPromote,
  onDelete,
}: {
  client: Client;
  mergeMode: boolean;
  mergeSelected: boolean;
  onMergeToggle: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onPromote: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef<HTMLDivElement>(null);
  const hasRevenue = parseFloat(c.total_revenue) > 0;

  useEffect(() => {
    if (expanded && expandedRef.current) {
      expandedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [expanded]);

  const avatarColor =
    daysAgo(c.last_trip_at) !== null && daysAgo(c.last_trip_at)! <= 7
      ? 'bg-emerald-100 text-emerald-700'
      : daysAgo(c.last_trip_at) !== null && daysAgo(c.last_trip_at)! <= 30
        ? 'bg-orange-100 text-orange-700'
        : 'bg-slate-100 text-slate-500';

  return (
    <div
      className={[
        !c.is_active ? 'opacity-50' : '',
        mergeMode && mergeSelected ? 'ring-2 ring-inset ring-blue-500 bg-blue-50' : '',
      ].join(' ')}
    >
      {/* Compact row */}
      <div
        className="px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-slate-50/60 transition-colors select-none"
        onClick={() => {
          if (mergeMode) {
            onMergeToggle();
          } else {
            setExpanded((v) => !v);
          }
        }}
      >
        {mergeMode ? (
          <div
            className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center ${mergeSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}
          >
            {mergeSelected && <span className="text-white text-xs font-black">✓</span>}
          </div>
        ) : (
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${avatarColor}`}
          >
            {c.name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Name + phone + stats — all in one line */}
        <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
          <p className="font-bold text-slate-900 text-sm truncate max-w-[180px]">{c.name}</p>
          {c.phone && (
            <a
              href={`tel:${c.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] text-blue-500 hover:text-blue-700 font-mono shrink-0"
            >
              {formatPhone(c.phone)}
            </a>
          )}
          <span className="text-[10px] text-slate-400 shrink-0">
            <LastTripLabel date={c.last_trip_at} />
          </span>
          {c.trips_count > 0 && (
            <span className="text-[10px] text-slate-400 shrink-0">{c.trips_count} рейс.</span>
          )}
          {parseFloat(c.revenue_30d) > 0 && (
            <span className="text-[10px] font-bold text-emerald-600 shrink-0">
              <Money amount={c.revenue_30d} /> за 30 дн.
            </span>
          )}
        </div>

        {!mergeMode && (
          <span
            className="material-symbols-outlined text-slate-300 text-[18px] shrink-0 transition-transform duration-200"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            expand_more
          </span>
        )}
      </div>

      {/* Expanded panel */}
      {expanded && !mergeMode && (
        <div
          ref={expandedRef}
          className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 space-y-3"
        >
          {/* Revenue stats — one line */}
          {hasRevenue && (
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span>
                Выручка:{' '}
                <strong className="text-slate-900">
                  <Money amount={c.total_revenue} />
                </strong>
              </span>
              <span>
                Средний:{' '}
                <strong className="text-slate-900">
                  <Money amount={c.avg_order} />
                </strong>
              </span>
              {Object.entries(c.payment_breakdown)
                .filter(([, pct]) => pct > 0)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 2)
                .map(([pm, pct]) => (
                  <span key={pm} className="text-slate-400">
                    {PAYMENT_LABEL[pm] ?? pm} {pct}%
                  </span>
                ))}
            </div>
          )}
          {c.notes && <p className="text-xs text-slate-400 italic">{c.notes}</p>}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
            >
              ✎ Редактировать
            </button>
            {!c.is_regular && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPromote();
                }}
                className="text-xs text-emerald-600 hover:text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200 hover:border-emerald-300 transition-colors"
              >
                ★ В постоянные
              </button>
            )}
            {c.is_regular && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPromote();
                }}
                className="text-xs text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
              >
                ↓ В новые
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleActive();
              }}
              className="text-xs text-slate-400 hover:text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
            >
              {c.is_active ? '⊗ В архив' : '↺ Восстановить'}
            </button>
            {c.orders_count === 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="text-xs text-rose-400 hover:text-rose-600 px-3 py-1.5 rounded-lg border border-rose-100 hover:border-rose-300 transition-colors"
              >
                🗑 Удалить
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ClientList({
  title,
  clients,
  badge,
  mergeMode,
  mergeSelected,
  onMergeToggle,
  onEdit,
  onToggleActive,
  onPromote,
  onDelete,
}: {
  title: string;
  badge?: React.ReactNode;
  clients: Client[];
  mergeMode: boolean;
  mergeSelected: Set<string>;
  onMergeToggle: (id: string) => void;
  onEdit: (c: Client) => void;
  onToggleActive: (c: Client) => void;
  onPromote: (c: Client) => void;
  onDelete: (c: Client) => void;
}) {
  if (clients.length === 0) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/80 flex items-center gap-2">
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-widest">{title}</h2>
        {badge}
        <span className="ml-auto text-xs text-slate-400">{clients.length}</span>
      </div>
      <div className="divide-y divide-slate-100">
        {clients.map((c) => (
          <ClientRow
            key={c.id}
            client={c}
            mergeMode={mergeMode}
            mergeSelected={mergeSelected.has(c.id)}
            onMergeToggle={() => onMergeToggle(c.id)}
            onEdit={() => onEdit(c)}
            onToggleActive={() => onToggleActive(c)}
            onPromote={() => onPromote(c)}
            onDelete={() => onDelete(c)}
          />
        ))}
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const qc = useQueryClient();
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const formRef = useRef<HTMLDivElement>(null);

  // Merge mode
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSelected, setMergeSelected] = useState<Set<string>>(new Set());
  const [mergeError, setMergeError] = useState('');

  useEffect(() => {
    if (showForm && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showForm]);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => fetch('/api/counterparties').then((r) => r.json()),
    staleTime: 60000,
  });

  const saveMutation = useMutation({
    mutationFn: (body: typeof emptyForm) => {
      const url = editId ? `/api/counterparties/${editId}` : '/api/counterparties';
      return fetch(url, {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? 'Ошибка');
        return json;
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      setFormError('');
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const mergeMutation = useMutation({
    mutationFn: ({ source_id, target_id }: { source_id: string; target_id: string }) =>
      fetch('/api/counterparties/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id, target_id }),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? 'Ошибка объединения');
        return json;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      setMergeMode(false);
      setMergeSelected(new Set());
      setMergeError('');
    },
    onError: (e: Error) => setMergeError(e.message),
  });

  const toggleActive = (client: Client) => {
    fetch(`/api/counterparties/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !client.is_active }),
    }).then(() => qc.invalidateQueries({ queryKey: ['clients'] }));
  };

  const promoteClient = (client: Client) => {
    fetch(`/api/counterparties/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_regular: !client.is_regular }),
    }).then(() => qc.invalidateQueries({ queryKey: ['clients'] }));
  };

  const deleteClient = async (client: Client) => {
    if (!confirm(`Удалить «${client.name}»? Это действие необратимо.`)) return;
    const res = await fetch(`/api/counterparties/${client.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error ?? 'Ошибка удаления');
      return;
    }
    qc.invalidateQueries({ queryKey: ['clients'] });
  };

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (c: Client) => {
    setEditId(c.id);
    setForm({
      name: c.name,
      phone: c.phone ?? '',
      credit_limit: c.credit_limit ?? '',
      notes: c.notes ?? '',
    });
    setFormError('');
    setShowForm(true);
  };

  const handleMergeToggle = (id: string) => {
    setMergeSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 2) {
        next.add(id);
      }
      return next;
    });
    setMergeError('');
  };

  const getMergePreview = () => {
    const [a, b] = Array.from(mergeSelected);
    if (!a || !b) return null;
    const ca = clients.find((c) => c.id === a)!;
    const cb = clients.find((c) => c.id === b)!;
    const targetId = parseFloat(ca.total_revenue) >= parseFloat(cb.total_revenue) ? a : b;
    const sourceId = targetId === a ? b : a;
    const target = clients.find((c) => c.id === targetId)!;
    const source = clients.find((c) => c.id === sourceId)!;
    return {
      source,
      target,
      sourceId,
      targetId,
      mergedTrips: source.trips_count + target.trips_count,
      mergedRevenue: (parseFloat(source.total_revenue) + parseFloat(target.total_revenue)).toFixed(
        2,
      ),
      mergedRevenue30d: (parseFloat(source.revenue_30d) + parseFloat(target.revenue_30d)).toFixed(
        2,
      ),
    };
  };

  const handleMergeConfirm = () => {
    const preview = getMergePreview();
    if (!preview) return;
    mergeMutation.mutate({ source_id: preview.sourceId, target_id: preview.targetId });
  };

  // Split lists
  const active = clients.filter((c) => c.is_active || showInactive);
  const regular = active.filter((c) => c.is_regular);
  const newClients = active.filter((c) => !c.is_regular);

  // KPI
  const totalRevenue = clients
    .filter((c) => c.is_active)
    .reduce((s, c) => s + parseFloat(c.total_revenue), 0);
  const activeCount = clients.filter((c) => c.is_active && parseFloat(c.revenue_30d) > 0).length;

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Клиенты</h1>
          <p className="text-sm text-slate-500 mt-0.5">Управление клиентской базой</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setMergeMode((v) => !v);
              setMergeSelected(new Set());
              setMergeError('');
            }}
            className={`text-sm font-medium px-3 py-2 rounded-lg border transition-colors ${mergeMode ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
          >
            {mergeMode ? '✕ Отмена' : '⇋ Объединить'}
          </button>
          <button
            onClick={openCreate}
            className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
          >
            + Добавить
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Всего</p>
          <p className="text-xl font-black text-slate-900 mt-0.5">
            {clients.filter((c) => c.is_active).length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Активны (30 дн.)
          </p>
          <p className="text-xl font-black text-emerald-600 mt-0.5">{activeCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Выручка</p>
          <p className="text-xl font-black text-orange-600 mt-0.5">
            <Money amount={totalRevenue.toFixed(2)} />
          </p>
        </div>
      </div>

      {/* Merge panel */}
      {mergeMode &&
        (() => {
          const preview = getMergePreview();
          return (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-widest">
                Режим объединения — выберите двух клиентов
              </p>

              {mergeSelected.size < 2 && (
                <p className="text-sm text-blue-600">Выбрано: {mergeSelected.size} / 2</p>
              )}

              {preview && (
                <div className="space-y-3">
                  {/* Before: two clients side by side */}
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                    <div className="bg-white rounded-lg border border-rose-200 px-3 py-2.5 space-y-1">
                      <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest">
                        Будет деактивирован
                      </p>
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {preview.source.name}
                      </p>
                      <p className="text-xs text-slate-500">{preview.source.trips_count} рейс.</p>
                      <p className="text-xs font-bold text-slate-700">
                        <Money amount={preview.source.total_revenue} />
                      </p>
                    </div>
                    <div className="text-center">
                      <span className="text-lg text-blue-400 font-black">+</span>
                    </div>
                    <div className="bg-white rounded-lg border border-emerald-200 px-3 py-2.5 space-y-1">
                      <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">
                        Останется
                      </p>
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {preview.target.name}
                      </p>
                      <p className="text-xs text-slate-500">{preview.target.trips_count} рейс.</p>
                      <p className="text-xs font-bold text-slate-700">
                        <Money amount={preview.target.total_revenue} />
                      </p>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-center">
                    <span className="text-blue-400 text-sm">↓ Результат объединения</span>
                  </div>

                  {/* After: merged result */}
                  <div className="bg-white rounded-lg border-2 border-blue-300 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{preview.target.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {preview.source.trips_count} + {preview.target.trips_count} ={' '}
                        <strong className="text-slate-800">{preview.mergedTrips} рейсов</strong>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Итого выручка</p>
                      <p className="text-base font-black text-slate-900">
                        <Money amount={preview.mergedRevenue} />
                      </p>
                      {parseFloat(preview.mergedRevenue30d) > 0 && (
                        <p className="text-[10px] text-emerald-600 font-bold">
                          <Money amount={preview.mergedRevenue30d} /> за 30 дн.
                        </p>
                      )}
                    </div>
                  </div>

                  {mergeError && (
                    <p className="text-xs text-rose-600 font-semibold">{mergeError}</p>
                  )}

                  <button
                    onClick={handleMergeConfirm}
                    disabled={mergeMutation.isPending}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {mergeMutation.isPending
                      ? 'Объединяю...'
                      : `Объединить → ${preview.target.name}`}
                  </button>
                </div>
              )}
            </div>
          );
        })()}

      {/* Edit/Create form */}
      {showForm && (
        <div
          ref={formRef}
          className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4"
        >
          <h2 className="text-sm font-bold text-slate-700">
            {editId ? 'Редактировать клиента' : 'Новый клиент'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Название / Имя *
              </label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                placeholder="ООО Агрострой или Иванов П.П."
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Телефон</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                placeholder="+7 999 123-45-67"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Кредитный лимит (₽)
              </label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                placeholder="50000"
                type="number"
                value={form.credit_limit}
                onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Примечание</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                placeholder="Постоянный с 2024"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          {formError && <p className="text-xs text-rose-600 font-medium">{formError}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending}
              className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setEditId(null);
                setFormError('');
              }}
              className="text-sm text-slate-500 px-4 py-2 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Show inactive toggle */}
      <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
          className="accent-slate-700"
        />
        Показать архивных
      </label>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-11 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-5xl mb-3">🏢</p>
          <p className="font-semibold text-slate-500">Клиентов нет</p>
          <p className="text-sm text-slate-400 mt-1">Нажмите «+ Добавить» чтобы создать карточку</p>
        </div>
      ) : (
        <>
          <ClientList
            title="Постоянные клиенты"
            badge={
              <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded uppercase tracking-wide">
                Проверенные
              </span>
            }
            clients={regular}
            mergeMode={mergeMode}
            mergeSelected={mergeSelected}
            onMergeToggle={handleMergeToggle}
            onEdit={openEdit}
            onToggleActive={toggleActive}
            onPromote={promoteClient}
            onDelete={deleteClient}
          />
          <ClientList
            title="Новые клиенты"
            clients={newClients}
            mergeMode={mergeMode}
            mergeSelected={mergeSelected}
            onMergeToggle={handleMergeToggle}
            onEdit={openEdit}
            onToggleActive={toggleActive}
            onPromote={promoteClient}
            onDelete={deleteClient}
          />
        </>
      )}
    </div>
  );
}
