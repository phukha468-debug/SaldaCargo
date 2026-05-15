'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect } from 'react';
import { Money } from '@saldacargo/ui';
import { formatPhone } from '@saldacargo/shared';

type Client = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  credit_limit: string | null;
  is_active: boolean;
  is_regular: boolean;
  total_revenue: string;
  revenue_30d: string;
  net_profit: string;
  trips_count: number;
  orders_count: number;
  avg_order: string;
  last_trip_at: string | null;
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

const emptyForm = { name: '', phone: '', email: '', credit_limit: '', notes: '' };

function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function lastTripColor(days: number | null) {
  if (days === null) return 'text-slate-300';
  if (days <= 7) return 'text-emerald-600 font-bold';
  if (days <= 30) return 'text-slate-500';
  if (days <= 90) return 'text-amber-500';
  return 'text-rose-400';
}

function lastTripLabel(days: number | null) {
  if (days === null) return 'нет рейсов';
  if (days === 0) return 'сегодня';
  return `${days} дн. назад`;
}

function avatarBg(days: number | null) {
  if (days !== null && days <= 7) return 'bg-emerald-100 text-emerald-700';
  if (days !== null && days <= 30) return 'bg-orange-100 text-orange-700';
  return 'bg-slate-100 text-slate-500';
}

// ── Email copy button ─────────────────────────────────────

function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(email).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="ml-1 text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
      title="Скопировать"
    >
      {copied ? '✓' : 'копировать'}
    </button>
  );
}

// ── Client row (compact) ──────────────────────────────────

function ClientRow({
  client: c,
  selected,
  mergeMode,
  mergeSelected,
  onSelect,
  onMergeToggle,
}: {
  client: Client;
  selected: boolean;
  mergeMode: boolean;
  mergeSelected: boolean;
  onSelect: () => void;
  onMergeToggle: () => void;
}) {
  const days = daysAgo(c.last_trip_at);
  return (
    <div
      onClick={mergeMode ? onMergeToggle : onSelect}
      className={[
        'flex items-center gap-2.5 px-3 py-2.5 cursor-pointer border-b border-slate-50 transition-colors select-none',
        selected && !mergeMode ? 'bg-slate-900 hover:bg-slate-800' : 'hover:bg-slate-50',
        mergeMode && mergeSelected ? 'bg-blue-50' : '',
        !c.is_active ? 'opacity-40' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {mergeMode ? (
        <div
          className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${mergeSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}
        >
          {mergeSelected && <span className="text-white text-[9px] font-black">✓</span>}
        </div>
      ) : (
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${selected && !mergeMode ? 'bg-white/20 text-white' : avatarBg(days)}`}
        >
          {c.name.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-bold truncate ${selected && !mergeMode ? 'text-white' : 'text-slate-800'}`}
        >
          {c.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className={`text-[10px] ${selected && !mergeMode ? 'text-slate-300' : lastTripColor(days)}`}
          >
            {lastTripLabel(days)}
          </span>
          {parseFloat(c.revenue_30d) > 0 && (
            <span
              className={`text-[10px] font-bold ${selected && !mergeMode ? 'text-emerald-300' : 'text-emerald-600'}`}
            >
              <Money amount={c.revenue_30d} />
            </span>
          )}
        </div>
      </div>

      {!mergeMode && (
        <span className={`text-sm shrink-0 ${selected ? 'text-white' : 'text-slate-200'}`}>›</span>
      )}
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────

function DetailPanel({
  client: c,
  onEdit,
  onToggleActive,
  onPromote,
  onDelete,
}: {
  client: Client;
  onEdit: () => void;
  onToggleActive: () => void;
  onPromote: () => void;
  onDelete: () => void;
}) {
  const days = daysAgo(c.last_trip_at);
  const netProfit = parseFloat(c.net_profit);

  return (
    <div className="flex flex-col h-full">
      {/* Name + badge */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-slate-900 leading-tight">{c.name}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {c.is_regular ? (
                <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded uppercase tracking-wide">
                  Постоянный
                </span>
              ) : (
                <span className="text-[9px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded uppercase tracking-wide">
                  Новый
                </span>
              )}
              {!c.is_active && (
                <span className="text-[9px] font-bold px-2 py-0.5 bg-rose-100 text-rose-600 rounded uppercase tracking-wide">
                  Архив
                </span>
              )}
              <span className={`text-[10px] ${lastTripColor(days)}`}>{lastTripLabel(days)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="px-5 py-4 grid grid-cols-2 gap-3 border-b border-slate-100">
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            Выручка всего
          </p>
          <p className="text-base font-black text-slate-900 mt-1">
            {parseFloat(c.total_revenue) > 0 ? <Money amount={c.total_revenue} /> : '—'}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            За 30 дней
          </p>
          <p
            className={`text-base font-black mt-1 ${parseFloat(c.revenue_30d) > 0 ? 'text-emerald-600' : 'text-slate-300'}`}
          >
            {parseFloat(c.revenue_30d) > 0 ? <Money amount={c.revenue_30d} /> : '—'}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            Чистая прибыль
          </p>
          <p
            className={`text-base font-black mt-1 ${netProfit > 0 ? 'text-indigo-600' : netProfit < 0 ? 'text-rose-500' : 'text-slate-300'}`}
          >
            {parseFloat(c.total_revenue) > 0 ? <Money amount={c.net_profit} /> : '—'}
          </p>
          {parseFloat(c.total_revenue) > 0 && (
            <p className="text-[9px] text-slate-400 mt-0.5">выручка − ЗП − ГСМ</p>
          )}
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            Рейсов / ср. заказ
          </p>
          <p className="text-base font-black text-slate-900 mt-1">{c.trips_count}</p>
          {parseFloat(c.avg_order) > 0 && (
            <p className="text-[10px] text-slate-400 mt-0.5">
              ср. <Money amount={c.avg_order} />
            </p>
          )}
        </div>
      </div>

      {/* Contacts */}
      <div className="px-5 py-4 space-y-2 border-b border-slate-100">
        {c.phone && (
          <div className="flex items-center gap-2">
            <span className="text-slate-300 text-sm w-4">📞</span>
            <a
              href={`tel:${c.phone}`}
              className="text-sm text-blue-600 hover:text-blue-800 font-mono font-medium"
            >
              {formatPhone(c.phone)}
            </a>
          </div>
        )}
        {c.email && (
          <div className="flex items-center gap-2">
            <span className="text-slate-300 text-sm w-4">✉</span>
            <span className="text-sm text-slate-600 font-medium">{c.email}</span>
            <CopyEmail email={c.email} />
          </div>
        )}
        {c.notes && (
          <div className="flex items-start gap-2">
            <span className="text-slate-300 text-sm w-4 mt-0.5">💬</span>
            <p className="text-sm text-slate-400 italic">{c.notes}</p>
          </div>
        )}
        {!c.phone && !c.email && !c.notes && (
          <p className="text-xs text-slate-300">Контакты не указаны</p>
        )}
      </div>

      {/* Payment breakdown */}
      {Object.keys(c.payment_breakdown).length > 0 && (
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Способы оплаты
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(c.payment_breakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([pm, pct]) => (
                <span
                  key={pm}
                  className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded"
                >
                  {PAYMENT_LABEL[pm] ?? pm} {pct}%
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-5 py-4 space-y-2 mt-auto">
        <button
          onClick={onEdit}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
        >
          <span className="text-base">✎</span> Редактировать
        </button>
        <button
          onClick={onPromote}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
            c.is_regular
              ? 'border-slate-200 text-slate-400 hover:bg-slate-50'
              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
          }`}
        >
          <span className="text-base">{c.is_regular ? '↓' : '★'}</span>
          {c.is_regular ? 'Перевести в новые' : 'В постоянные'}
        </button>
        <button
          onClick={onToggleActive}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-400 hover:bg-slate-50 transition-colors"
        >
          <span className="text-base">{c.is_active ? '⊗' : '↺'}</span>
          {c.is_active ? 'В архив' : 'Восстановить'}
        </button>
        {c.orders_count === 0 && (
          <button
            onClick={onDelete}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-100 bg-white text-sm font-semibold text-rose-400 hover:bg-rose-50 hover:border-rose-200 transition-colors"
          >
            <span className="text-base">🗑</span> Удалить
          </button>
        )}
      </div>
    </div>
  );
}

// ── Client form modal ─────────────────────────────────────

function ClientModal({
  editId,
  form,
  setForm,
  onSave,
  onClose,
  saving,
  error,
}: {
  editId: string | null;
  form: typeof emptyForm;
  setForm: (f: typeof emptyForm) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  error: string;
}) {
  const inputCls =
    'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 transition-colors';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-black text-slate-900">
            {editId ? 'Редактировать клиента' : 'Новый клиент'}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-lg flex items-center justify-center transition-colors"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-5 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
              Название / Имя *
            </label>
            <input
              className={inputCls}
              placeholder="ООО Агрострой или Иванов П.П."
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
              Телефон
            </label>
            <input
              className={inputCls}
              placeholder="+7 999 123-45-67"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
              E-mail
            </label>
            <input
              type="email"
              className={inputCls}
              placeholder="client@company.ru"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
              Кредитный лимит (₽)
            </label>
            <input
              type="number"
              className={inputCls}
              placeholder="50 000"
              value={form.credit_limit}
              onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
              Примечание
            </label>
            <input
              className={inputCls}
              placeholder="Постоянный с 2024"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        {error && <p className="mx-6 mb-3 text-xs text-rose-600 font-medium">{error}</p>}
        <div className="px-6 pb-5 flex gap-2">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 bg-slate-900 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            onClick={onClose}
            className="px-5 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Merge panel ───────────────────────────────────────────

function MergePanel({
  clients,
  selected,
  onConfirm,
  pending,
  error,
}: {
  clients: Client[];
  selected: Set<string>;
  onConfirm: (sourceId: string, targetId: string) => void;
  pending: boolean;
  error: string;
}) {
  const [a, b] = Array.from(selected);
  if (!a || !b) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 font-medium">
        Выберите двух клиентов из списка ({selected.size} / 2)
      </div>
    );
  }
  const ca = clients.find((c) => c.id === a)!;
  const cb = clients.find((c) => c.id === b)!;
  const targetId = parseFloat(ca.total_revenue) >= parseFloat(cb.total_revenue) ? a : b;
  const sourceId = targetId === a ? b : a;
  const target = clients.find((c) => c.id === targetId)!;
  const source = clients.find((c) => c.id === sourceId)!;
  const mergedRevenue = (
    parseFloat(source.total_revenue) + parseFloat(target.total_revenue)
  ).toFixed(2);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
        Предпросмотр объединения
      </p>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
        <div className="bg-white rounded-lg border border-rose-200 px-3 py-2">
          <p className="text-[9px] font-bold text-rose-400 uppercase">Будет деактивирован</p>
          <p className="text-sm font-bold text-slate-800 truncate mt-0.5">{source.name}</p>
          <p className="text-xs text-slate-400">{source.trips_count} рейс.</p>
        </div>
        <span className="text-blue-300 font-black text-lg">+</span>
        <div className="bg-white rounded-lg border border-emerald-200 px-3 py-2">
          <p className="text-[9px] font-bold text-emerald-500 uppercase">Останется</p>
          <p className="text-sm font-bold text-slate-800 truncate mt-0.5">{target.name}</p>
          <p className="text-xs text-slate-400">{target.trips_count} рейс.</p>
        </div>
      </div>
      <div className="bg-white rounded-lg border-2 border-blue-300 px-3 py-2 flex items-center justify-between">
        <p className="text-sm font-bold text-slate-900">{target.name}</p>
        <p className="text-sm font-black text-slate-900">
          <Money amount={mergedRevenue} />
        </p>
      </div>
      {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}
      <button
        onClick={() => onConfirm(sourceId, targetId)}
        disabled={pending}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
      >
        {pending ? 'Объединяю...' : `Объединить → ${target.name}`}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────

export default function ClientsPage() {
  const qc = useQueryClient();

  const [tab, setTab] = useState<'regular' | 'new'>('regular');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSelected, setMergeSelected] = useState<Set<string>>(new Set());
  const [mergeError, setMergeError] = useState('');

  const listRef = useRef<HTMLDivElement>(null);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => fetch('/api/counterparties').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const selectedClient = clients.find((c) => c.id === selectedId) ?? null;

  // Auto-select first client when tab changes
  useEffect(() => {
    const list = filtered();
    if (list.length > 0 && !list.find((c) => c.id === selectedId)) {
      setSelectedId(list[0]?.id ?? null);
    }
  }, [tab, clients]);

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

  const toggleActive = (c: Client) =>
    fetch(`/api/counterparties/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !c.is_active }),
    }).then(() => qc.invalidateQueries({ queryKey: ['clients'] }));

  const promoteClient = (c: Client) =>
    fetch(`/api/counterparties/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_regular: !c.is_regular }),
    }).then(() => qc.invalidateQueries({ queryKey: ['clients'] }));

  const deleteClient = async (c: Client) => {
    if (!confirm(`Удалить «${c.name}»? Это действие необратимо.`)) return;
    const res = await fetch(`/api/counterparties/${c.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error ?? 'Ошибка удаления');
      return;
    }
    if (selectedId === c.id) setSelectedId(null);
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
      email: c.email ?? '',
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

  function filtered() {
    const q = search.toLowerCase();
    return clients.filter((c) => {
      if (!showInactive && !c.is_active) return false;
      if (tab === 'regular' && !c.is_regular) return false;
      if (tab === 'new' && c.is_regular) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q) ||
        (c.email ?? '').toLowerCase().includes(q)
      );
    });
  }

  const list = filtered();
  const regular = clients.filter((c) => c.is_active && c.is_regular);
  const newOnes = clients.filter((c) => c.is_active && !c.is_regular);

  const totalRevenue = clients
    .filter((c) => c.is_active)
    .reduce((s, c) => s + parseFloat(c.total_revenue), 0);
  const activeCount = clients.filter((c) => c.is_active && parseFloat(c.revenue_30d) > 0).length;
  return (
    <div className="flex flex-col gap-4 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900">Клиенты</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {regular.length} постоянных · {newOnes.length} новых
          </p>
        </div>
        <div className="flex gap-2">
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
            className="bg-slate-900 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
          >
            + Добавить
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Всего</p>
          <p className="text-xl font-black text-slate-900 mt-1">
            {clients.filter((c) => c.is_active).length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            Активны 30 дн.
          </p>
          <p className="text-xl font-black text-emerald-600 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Выручка</p>
          <p className="text-xl font-black text-orange-600 mt-1">
            <Money amount={totalRevenue.toFixed(2)} />
          </p>
        </div>
      </div>

      {/* Merge panel */}
      {mergeMode && (
        <MergePanel
          clients={clients}
          selected={mergeSelected}
          onConfirm={(s, t) => mergeMutation.mutate({ source_id: s, target_id: t })}
          pending={mergeMutation.isPending}
          error={mergeError}
        />
      )}

      {/* Master-detail */}
      <div className="grid grid-cols-[1fr_320px] gap-4 items-start">
        {/* Left: list */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {/* Search */}
          <div className="px-3 pt-3 pb-2 border-b border-slate-100">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-sm">
                🔍
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по имени, телефону, email..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 transition-colors"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setTab('regular')}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors ${tab === 'regular' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Постоянные
              <span className="ml-1.5 text-[10px] font-medium opacity-60">{regular.length}</span>
            </button>
            <button
              onClick={() => setTab('new')}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors ${tab === 'new' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Новые
              <span className="ml-1.5 text-[10px] font-medium opacity-60">{newOnes.length}</span>
            </button>
          </div>

          {/* List */}
          <div
            ref={listRef}
            className="overflow-y-auto"
            style={{ maxHeight: 'calc(100vh - 320px)' }}
          >
            {isLoading ? (
              <div className="space-y-0">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="h-12 border-b border-slate-50 animate-pulse bg-slate-50"
                  />
                ))}
              </div>
            ) : list.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-2xl mb-2">🏢</p>
                <p className="text-sm font-semibold text-slate-400">
                  {search ? 'Ничего не найдено' : 'Список пуст'}
                </p>
              </div>
            ) : (
              list.map((c) => (
                <ClientRow
                  key={c.id}
                  client={c}
                  selected={selectedId === c.id}
                  mergeMode={mergeMode}
                  mergeSelected={mergeSelected.has(c.id)}
                  onSelect={() => setSelectedId(c.id)}
                  onMergeToggle={() => handleMergeToggle(c.id)}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-slate-100 flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="accent-slate-600"
              />
              Показать архивных
            </label>
            <span className="text-[10px] text-slate-300 ml-auto">{list.length} клиентов</span>
          </div>
        </div>

        {/* Right: detail panel */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden sticky top-4">
          {selectedClient ? (
            <DetailPanel
              client={selectedClient}
              onEdit={() => openEdit(selectedClient)}
              onToggleActive={() => toggleActive(selectedClient)}
              onPromote={() => promoteClient(selectedClient)}
              onDelete={() => deleteClient(selectedClient)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <p className="text-3xl mb-3">👈</p>
              <p className="text-sm font-bold text-slate-400">Выберите клиента</p>
              <p className="text-xs text-slate-300 mt-1">Детали появятся здесь</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <ClientModal
          editId={editId}
          form={form}
          setForm={setForm}
          onSave={() => saveMutation.mutate(form)}
          onClose={() => {
            setShowForm(false);
            setEditId(null);
            setFormError('');
          }}
          saving={saveMutation.isPending}
          error={formError}
        />
      )}
    </div>
  );
}
