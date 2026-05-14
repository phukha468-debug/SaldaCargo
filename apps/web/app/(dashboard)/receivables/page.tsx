'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Money } from '@saldacargo/ui';
import { formatDate, formatPhone } from '@saldacargo/shared';

type FollowUp = {
  status: 'active' | 'promised' | 'disputed' | 'bad_debt';
  promise_date: string | null;
  last_contact_at: string | null;
  next_contact_at: string | null;
  notes: string | null;
  updated_at: string;
};

type Order = {
  id: string;
  type: 'trip_order' | 'manual';
  amount: string;
  payment_method: string | null;
  description: string | null;
  created_at: string;
  trip_number: number | null;
  started_at: string | null;
  driver_name: string | null;
};

type Debtor = {
  counterparty_id: string;
  counterparty_name: string;
  counterparty_phone: string | null;
  counterparty_email: string | null;
  counterparty_subname: string | null;
  is_individual: boolean;
  total: string;
  oldest_at: string;
  orders: Order[];
  follow_up: FollowUp | null;
};

type ReceivablesData = {
  debtors: Debtor[];
  totalAmount: string;
  overdueCount: number;
};

type Counterparty = { id: string; name: string };
type AgingFilter = 'all' | '0-30' | '31-60' | '60+';

const PAYMENT_LABELS: Record<string, string> = {
  bank_invoice: 'Безнал',
  debt_cash: 'Долг нал',
  qr: 'QR',
  cash: 'Нал',
  card_driver: 'Карта',
};

const STATUS_CONFIG = {
  active: { label: 'В работе', bg: 'bg-amber-100 text-amber-800', dot: 'bg-amber-400' },
  promised: { label: 'Обещание', bg: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  disputed: { label: 'Оспаривает', bg: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  bad_debt: { label: 'Безнадёжный', bg: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
};

function daysAgo(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function passesAgingFilter(debtor: Debtor, filter: AgingFilter): boolean {
  const days = daysAgo(debtor.oldest_at);
  if (filter === '0-30') return days <= 30;
  if (filter === '31-60') return days > 30 && days <= 60;
  if (filter === '60+') return days > 60;
  return true;
}

function EmailCopyButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-[10px] text-slate-500 font-bold hover:text-slate-700 flex items-center gap-0.5 transition-colors"
      title="Скопировать e-mail"
    >
      <span className="material-symbols-outlined text-xs">{copied ? 'check_circle' : 'mail'}</span>
      <span className={copied ? 'text-green-600' : ''}>{copied ? 'Скопировано' : email}</span>
    </button>
  );
}

function PromiseDateBadge({ follow_up }: { follow_up: FollowUp | null }) {
  if (!follow_up?.promise_date) return null;
  const today = new Date().toISOString().split('T')[0]!;
  const diff = Math.floor((new Date(follow_up.promise_date).getTime() - Date.now()) / 86400000);
  const isOverdue = follow_up.promise_date < today;
  return (
    <span
      className={`text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-blue-50 text-blue-700'}`}
    >
      {isOverdue
        ? `⚠ Обещание просрочено ${Math.abs(diff)} дн.`
        : `Обещает ${new Date(follow_up.promise_date + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} (через ${diff} дн.)`}
    </span>
  );
}

function FollowUpForm({
  counterpartyId,
  current,
  onClose,
  onSaved,
}: {
  counterpartyId: string;
  current: FollowUp | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<keyof typeof STATUS_CONFIG>(current?.status ?? 'active');
  const [promiseDate, setPromiseDate] = useState(current?.promise_date ?? '');
  const [nextContact, setNextContact] = useState(current?.next_contact_at ?? '');
  const [notes, setNotes] = useState(current?.notes ?? '');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/receivables/follow-up/${counterpartyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          promise_date: promiseDate || null,
          next_contact_at: nextContact || null,
          notes: notes || null,
        }),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? `Статус ${r.status}`);
        return json;
      }),
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 mx-6 mb-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Фиксация звонка
        </p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(
          Object.entries(STATUS_CONFIG) as [
            keyof typeof STATUS_CONFIG,
            (typeof STATUS_CONFIG)[keyof typeof STATUS_CONFIG],
          ][]
        ).map(([key, cfg]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatus(key)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border-2 transition-colors ${
              status === key
                ? `${cfg.bg} border-current`
                : 'border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {status === 'promised' && (
        <div>
          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">
            Обещает оплатить
          </label>
          <input
            type="date"
            value={promiseDate}
            onChange={(e) => setPromiseDate(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      <div>
        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">
          Следующий звонок
        </label>
        <input
          type="date"
          value={nextContact}
          onChange={(e) => setNextContact(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">
          Заметка
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Итог звонка..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
      >
        {mutation.isPending ? 'Сохранение...' : '✓ Зафиксировать звонок'}
      </button>
    </div>
  );
}

function AddDebtForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [cpId, setCpId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: counterparties = [] } = useQuery<Counterparty[]>({
    queryKey: ['counterparties-active'],
    queryFn: () => fetch('/api/counterparties?active=1').then((r) => r.json()),
    staleTime: 60000,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cpId || !amount || !date) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/receivables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counterparty_id: cpId, amount, date, description }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `Статус ${r.status}`);
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Добавить исторический долг</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              Контрагент
            </label>
            <select
              value={cpId}
              onChange={(e) => setCpId(e.target.value)}
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Выберите...</option>
              {(Array.isArray(counterparties) ? counterparties : []).map((cp) => (
                <option key={cp.id} value={cp.id}>
                  {cp.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Сумма, ₽
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="0"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Дата возникновения
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              Описание (необязательно)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="За что долг..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving || !cpId || !amount}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : 'Добавить долг'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ReceivablesPage() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null);
  const [agingFilter, setAgingFilter] = useState<AgingFilter>('all');

  useEffect(() => {
    if (!expandedId) return;
    const el = document.querySelector(`[data-debtor-id="${expandedId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [expandedId]);

  useEffect(() => {
    if (!editingFollowUpId) return;
    const el = document.querySelector(`[data-followup-id="${editingFollowUpId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [editingFollowUpId]);

  const { data, isLoading, isError } = useQuery<ReceivablesData>({
    queryKey: ['receivables'],
    queryFn: () => fetch('/api/receivables').then((r) => r.json()),
    staleTime: 30000,
  });

  const allDebtors = data?.debtors ?? [];
  const debtors = allDebtors.filter((d) => passesAgingFilter(d, agingFilter));

  function countByAging(filter: AgingFilter) {
    return allDebtors.filter((d) => passesAgingFilter(d, filter)).length;
  }

  async function handleMarkPaid(order: Order) {
    setMarkingId(order.id);
    try {
      const url =
        order.type === 'manual'
          ? `/api/receivables/manual/${order.id}`
          : `/api/receivables/${order.id}`;
      const r = await fetch(url, { method: 'PATCH' });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `Статус ${r.status}`);
      await queryClient.invalidateQueries({ queryKey: ['receivables'] });
      await queryClient.invalidateQueries({ queryKey: ['receivables-summary'] });
    } catch (e: unknown) {
      alert('Ошибка: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setMarkingId(null);
    }
  }

  async function handleDeleteManual(orderId: string) {
    if (!confirm('Удалить эту запись?')) return;
    setDeletingId(orderId);
    try {
      const r = await fetch(`/api/receivables/manual/${orderId}`, { method: 'DELETE' });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `Статус ${r.status}`);
      await queryClient.invalidateQueries({ queryKey: ['receivables'] });
      await queryClient.invalidateQueries({ queryKey: ['receivables-summary'] });
    } catch (e: unknown) {
      alert('Ошибка: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDeletingId(null);
    }
  }

  function handleAddSuccess() {
    setShowAddForm(false);
    queryClient.invalidateQueries({ queryKey: ['receivables'] });
    queryClient.invalidateQueries({ queryKey: ['receivables-summary'] });
  }

  function handleFollowUpSaved() {
    setEditingFollowUpId(null);
    queryClient.invalidateQueries({ queryKey: ['receivables'] });
    queryClient.invalidateQueries({ queryKey: ['receivables-summary'] });
  }

  const promisedCount = allDebtors.filter((d) => d.follow_up?.status === 'promised').length;

  return (
    <>
      {showAddForm && (
        <AddDebtForm onClose={() => setShowAddForm(false)} onSuccess={handleAddSuccess} />
      )}

      <div className="space-y-6 p-4 max-w-7xl mx-auto animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Дебиторская задолженность</h1>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Добавить долг
          </button>
        </div>

        {/* KPI Cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-slate-200 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Всего к получению
              </p>
              <p className="text-2xl font-black text-rose-600 mt-1">
                <Money amount={data?.totalAmount ?? '0'} />
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Должников
              </p>
              <p className="text-2xl font-black text-slate-800 mt-1">{allDebtors.length}</p>
            </div>
            <div
              className={`border rounded-lg p-4 shadow-sm ${(data?.overdueCount ?? 0) > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}
            >
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Просрочено (&gt;30 дн.)
              </p>
              <p
                className={`text-2xl font-black mt-1 ${(data?.overdueCount ?? 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}
              >
                {data?.overdueCount ?? 0}
              </p>
            </div>
            <div
              className={`border rounded-lg p-4 shadow-sm ${promisedCount > 0 ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}
            >
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Обещали заплатить
              </p>
              <p
                className={`text-2xl font-black mt-1 ${promisedCount > 0 ? 'text-blue-600' : 'text-slate-400'}`}
              >
                {promisedCount}
              </p>
            </div>
          </div>
        )}

        {isError && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-700 font-bold">
            Ошибка загрузки данных
          </div>
        )}

        {/* Aging filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {(
            [
              { key: 'all', label: `Все (${allDebtors.length})` },
              { key: '0-30', label: `0–30 дн. (${countByAging('0-30')})` },
              { key: '31-60', label: `31–60 дн. (${countByAging('31-60')})` },
              { key: '60+', label: `60+ дн. (${countByAging('60+')})` },
            ] as { key: AgingFilter; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setAgingFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                agingFilter === key
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Debtors list */}
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/80">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-widest">
              Список должников
            </h2>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-2 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-slate-100 rounded" />
              ))}
            </div>
          ) : debtors.length === 0 ? (
            <div className="py-16 text-center">
              <span className="material-symbols-outlined text-slate-200 text-[64px]">
                check_circle
              </span>
              <p className="text-slate-400 font-medium mt-2">
                {agingFilter === 'all'
                  ? 'Дебиторской задолженности нет'
                  : 'В этой категории должников нет'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {debtors.map((debtor) => {
                const days = daysAgo(debtor.oldest_at);
                const isOverdue = days > 30;
                const isExpanded = expandedId === debtor.counterparty_id;
                const isReal =
                  !debtor.is_individual && !String(debtor.counterparty_id).startsWith('__');
                const fu = debtor.follow_up;
                const statusCfg = fu ? STATUS_CONFIG[fu.status] : null;

                return (
                  <div key={debtor.counterparty_id} data-debtor-id={debtor.counterparty_id}>
                    {/* Debtor header row */}
                    <div
                      className={`px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50' : ''}`}
                      onClick={() => {
                        setExpandedId(isExpanded ? null : debtor.counterparty_id);
                        setEditingFollowUpId(null);
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}
                        >
                          {debtor.counterparty_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-slate-900">
                              {debtor.counterparty_name}
                            </p>
                            {debtor.is_individual && debtor.counterparty_subname && (
                              <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {debtor.counterparty_subname}
                              </span>
                            )}
                            {statusCfg && (
                              <span
                                className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${statusCfg.bg}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                                {statusCfg.label}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <p className="text-[10px] text-slate-400">
                              {debtor.orders.length}{' '}
                              {debtor.orders.length === 1 ? 'запись' : 'записи'} ·{' '}
                              {isOverdue ? (
                                <span className="text-rose-500 font-bold">
                                  просрочка {days} дн.
                                </span>
                              ) : (
                                <span>{days} дн. назад</span>
                              )}
                            </p>
                            {debtor.counterparty_phone && (
                              <a
                                href={`tel:${debtor.counterparty_phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-[10px] text-blue-500 font-bold hover:text-blue-700 flex items-center gap-0.5"
                              >
                                <span className="material-symbols-outlined text-xs">call</span>
                                <span className="font-mono">
                                  {formatPhone(debtor.counterparty_phone)}
                                </span>
                              </a>
                            )}
                            {debtor.counterparty_email && (
                              <EmailCopyButton email={debtor.counterparty_email} />
                            )}
                            <PromiseDateBadge follow_up={fu} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span
                          className={`text-base font-black ${isOverdue ? 'text-rose-600' : 'text-amber-600'}`}
                        >
                          <Money amount={debtor.total} />
                        </span>
                        <span
                          className="material-symbols-outlined text-slate-400 text-lg transition-transform duration-200"
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        >
                          expand_more
                        </span>
                      </div>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50">
                        {/* Follow-up panel — only for real counterparties */}
                        {isReal && (
                          <div className="px-6 py-3 border-b border-slate-100">
                            {fu ? (
                              <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${statusCfg?.bg}`}
                                    >
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${statusCfg?.dot}`}
                                      />
                                      {statusCfg?.label}
                                    </span>
                                    {fu.last_contact_at && (
                                      <span className="text-[10px] text-slate-400">
                                        Последний звонок: {formatDate(fu.last_contact_at)}
                                      </span>
                                    )}
                                    {fu.next_contact_at && (
                                      <span className="text-[10px] text-blue-500 font-bold">
                                        Следующий:{' '}
                                        {new Date(
                                          fu.next_contact_at + 'T12:00:00',
                                        ).toLocaleDateString('ru-RU', {
                                          day: 'numeric',
                                          month: 'short',
                                        })}
                                      </span>
                                    )}
                                  </div>
                                  {fu.notes && (
                                    <p className="text-xs text-slate-600 italic">«{fu.notes}»</p>
                                  )}
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingFollowUpId(
                                      editingFollowUpId === debtor.counterparty_id
                                        ? null
                                        : debtor.counterparty_id,
                                    );
                                  }}
                                  className="shrink-0 px-3 py-1.5 text-[10px] font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-white transition-colors uppercase tracking-wide bg-white"
                                >
                                  <span className="material-symbols-outlined text-xs align-middle mr-1">
                                    call
                                  </span>
                                  Обновить
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] text-slate-400">
                                  Звонки не фиксировались
                                </p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingFollowUpId(
                                      editingFollowUpId === debtor.counterparty_id
                                        ? null
                                        : debtor.counterparty_id,
                                    );
                                  }}
                                  className="px-3 py-1.5 text-[10px] font-bold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors uppercase tracking-wide"
                                >
                                  <span className="material-symbols-outlined text-xs align-middle mr-1">
                                    add_call
                                  </span>
                                  Зафиксировать звонок
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Inline follow-up form */}
                        {isReal && editingFollowUpId === debtor.counterparty_id && (
                          <div data-followup-id={debtor.counterparty_id}>
                            <FollowUpForm
                              counterpartyId={debtor.counterparty_id}
                              current={debtor.follow_up}
                              onClose={() => setEditingFollowUpId(null)}
                              onSaved={handleFollowUpSaved}
                            />
                          </div>
                        )}

                        {/* Orders table */}
                        <table className="w-full text-left">
                          <thead className="bg-slate-100/50">
                            <tr>
                              <th className="px-8 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                Рейс / Запись
                              </th>
                              <th className="px-4 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                Водитель
                              </th>
                              <th className="px-4 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                Дата
                              </th>
                              <th className="px-4 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                Тип
                              </th>
                              <th className="px-4 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-right">
                                Сумма
                              </th>
                              <th className="px-4 py-2" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {debtor.orders.map((order) => (
                              <tr key={order.id} className="hover:bg-white transition-colors">
                                <td className="px-8 py-3 text-xs font-semibold text-slate-700">
                                  {order.type === 'manual' ? (
                                    <span className="text-blue-600">Ручная запись</span>
                                  ) : (
                                    `№${order.trip_number}`
                                  )}
                                  {order.description && (
                                    <span className="block text-[10px] text-slate-400 font-normal">
                                      {order.description}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-600">
                                  {order.driver_name ?? '—'}
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                                  {order.started_at ? formatDate(order.started_at) : '—'}
                                </td>
                                <td className="px-4 py-3">
                                  {order.type === 'manual' ? (
                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-bold uppercase">
                                      Ист. долг
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[9px] font-bold uppercase">
                                      {PAYMENT_LABELS[order.payment_method ?? ''] ??
                                        order.payment_method ??
                                        '—'}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right text-xs font-black text-slate-800">
                                  <Money amount={order.amount} />
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {order.type === 'manual' && (
                                      <button
                                        onClick={() => handleDeleteManual(order.id)}
                                        disabled={deletingId === order.id}
                                        className="px-2 py-1.5 text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-50"
                                        title="Удалить запись"
                                      >
                                        <span className="material-symbols-outlined text-base">
                                          delete
                                        </span>
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleMarkPaid(order)}
                                      disabled={markingId === order.id}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded uppercase tracking-wide transition-colors disabled:opacity-50"
                                    >
                                      {markingId === order.id ? '...' : '✓ Оплачено'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
