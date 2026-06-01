/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { formatPhone } from '@saldacargo/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReceivableOrder = {
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

type FollowUp = {
  status: 'active' | 'promised' | 'disputed' | 'bad_debt';
  promise_date: string | null;
  last_contact_at: string | null;
  next_contact_at: string | null;
  notes: string | null;
};

type Debtor = {
  counterparty_id: string;
  counterparty_name: string;
  counterparty_phone: string | null;
  counterparty_subname: string | null;
  is_individual: boolean;
  total: string;
  oldest_at: string;
  orders: ReceivableOrder[];
  follow_up: FollowUp | null;
};

type CounterpartyOption = { id: string; name: string; phone: string | null };

// ─── Constants ────────────────────────────────────────────────────────────────

const WALLET_OPTIONS = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    label: '🏦 Р/С',
    color: 'border-blue-500 bg-blue-600 text-white',
  },
  {
    id: '10000000-0000-0000-0000-000000000002',
    label: '💵 Нал',
    color: 'border-green-500 bg-green-600 text-white',
  },
  {
    id: '10000000-0000-0000-0000-000000000003',
    label: '💳 Карта',
    color: 'border-violet-500 bg-violet-600 text-white',
  },
];

const FOLLOW_UP_STATUSES = [
  { key: 'active', label: 'В работе', color: 'border-amber-400 bg-amber-50 text-amber-800' },
  { key: 'promised', label: 'Обещание', color: 'border-blue-400 bg-blue-50 text-blue-800' },
  { key: 'disputed', label: 'Оспаривает', color: 'border-zinc-300 bg-zinc-50 text-zinc-600' },
  { key: 'bad_debt', label: 'Безнадёжный', color: 'border-red-400 bg-red-50 text-red-700' },
];

const PM_LABELS: Record<string, string> = {
  qr: '📱 QR / Р/С',
  card_driver: '💳 Карта',
  debt_cash: '⏳ Долг нал',
  cash: '💵 Нал',
};

const PM_WALLET_LABEL: Record<string, string> = {
  qr: '→ 🏦 Р/С',
  card_driver: '→ 💳 Карта',
  debt_cash: '→ 💵 Сейф',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function ageBadge(days: number): string {
  if (days <= 7) return 'bg-green-100 text-green-700';
  if (days <= 30) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-600';
}

function fmt(amount: string): string {
  return parseFloat(amount).toLocaleString('ru-RU');
}

function followUpColor(fu: FollowUp | null, promiseOverdue: boolean): string {
  if (promiseOverdue) return 'text-red-500';
  if (!fu) return 'text-zinc-300';
  return (
    FOLLOW_UP_STATUSES.find((s) => s.key === fu.status)
      ?.color.split(' ')
      .find((c) => c.startsWith('text-')) ?? 'text-zinc-400'
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReceivablesPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ReceivableOrder | null>(null);
  const [showFollowUpId, setShowFollowUpId] = useState<string | null>(null);
  const [closeAllWallet, setCloseAllWallet] = useState(WALLET_OPTIONS[0]!.id);
  const [closingAllId, setClosingAllId] = useState<string | null>(null);
  const [settleNote, setSettleNote] = useState('');
  const [settleError, setSettleError] = useState('');
  const [closeAllError, setCloseAllError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useState('');

  // Follow-up form state
  const [fuStatus, setFuStatus] = useState('active');
  const [fuPromiseDate, setFuPromiseDate] = useState('');
  const [fuNextContact, setFuNextContact] = useState('');
  const [fuNotes, setFuNotes] = useState('');
  const [fuSaving, setFuSaving] = useState(false);
  const [fuError, setFuError] = useState('');

  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery<{
    debtors: Debtor[];
    totalAmount: string;
  }>({
    queryKey: ['receivables-page'],
    queryFn: async () => {
      const r = await fetch('/api/admin/receivables');
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? 'Ошибка');
      return json;
    },
    staleTime: 0,
  });

  const settleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrder) throw new Error('Нет заказа');
      const r = await fetch('/api/admin/receivables/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedOrder.id,
          type: selectedOrder.type,
          note: settleNote || undefined,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? 'Ошибка');
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivables-page'] });
      queryClient.invalidateQueries({ queryKey: ['admin-receivables'] });
      setSelectedOrder(null);
      setSettleNote('');
      setSettleError('');
    },
    onError: (e: Error) => setSettleError(e.message),
  });

  async function handleCloseAll(debtor: Debtor) {
    setClosingAllId(debtor.counterparty_id);
    setCloseAllError('');
    try {
      const r = await fetch('/api/admin/receivables/close-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orders: debtor.orders.map((o) => ({ id: o.id, type: o.type, amount: o.amount })),
          to_wallet_id: closeAllWallet,
          counterparty_name: debtor.counterparty_name,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? 'Ошибка');
      queryClient.invalidateQueries({ queryKey: ['receivables-page'] });
      queryClient.invalidateQueries({ queryKey: ['admin-receivables'] });
      setExpandedId(null);
      setSelectedOrder(null);
    } catch (e: any) {
      setCloseAllError(e.message ?? 'Ошибка');
    } finally {
      setClosingAllId(null);
    }
  }

  function openFollowUp(debtor: Debtor) {
    const fu = debtor.follow_up;
    setFuStatus(fu?.status ?? 'active');
    setFuPromiseDate(fu?.promise_date ?? '');
    setFuNextContact(fu?.next_contact_at ?? '');
    setFuNotes(fu?.notes ?? '');
    setFuError('');
    setShowFollowUpId(debtor.counterparty_id);
  }

  async function handleFollowUpSave(counterpartyId: string) {
    setFuSaving(true);
    setFuError('');
    try {
      const r = await fetch(`/api/admin/receivables/follow-up/${counterpartyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: fuStatus,
          promise_date: fuPromiseDate || null,
          next_contact_at: fuNextContact || null,
          notes: fuNotes || null,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? 'Ошибка');
      queryClient.invalidateQueries({ queryKey: ['receivables-page'] });
      setShowFollowUpId(null);
    } catch (e: any) {
      setFuError(e.message ?? 'Ошибка');
    } finally {
      setFuSaving(false);
    }
  }

  const allDebtors = data?.debtors ?? [];
  const filtered = search.trim()
    ? allDebtors.filter((d) => d.counterparty_name.toLowerCase().includes(search.toLowerCase()))
    : allDebtors;

  const today = new Date().toISOString().split('T')[0]!;

  if (showAddForm) {
    return (
      <AddDebtorForm
        onClose={() => setShowAddForm(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['receivables-page'] });
          queryClient.invalidateQueries({ queryKey: ['admin-receivables'] });
          setShowAddForm(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="bg-white border-b-2 border-zinc-200 px-4 h-16 flex items-center gap-3 sticky top-0 z-40">
        <Link
          href="/admin/finance"
          className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 active:bg-zinc-100 text-xl shrink-0"
        >
          ←
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-black text-zinc-900 text-base uppercase tracking-tight leading-tight">
            Дебиторка
          </h1>
          {!isLoading && data && (
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
              {allDebtors.length} должн.
              {allDebtors.length > 0 && (
                <span className="text-orange-600 ml-1 font-black">· {fmt(data.totalAmount)} ₽</span>
              )}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="shrink-0 bg-orange-500 text-white rounded-2xl px-4 py-2.5 text-[11px] font-black uppercase tracking-widest active:scale-[0.97] transition-all shadow-sm"
        >
          + Добавить
        </button>
      </header>

      <div className="p-4 space-y-3 pb-8">
        {/* Summary card */}
        {!isLoading && allDebtors.length > 0 && (
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-5 text-white shadow-lg">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">
              Общая задолженность
            </p>
            <p className="text-3xl font-black tracking-tight">{fmt(data?.totalAmount ?? '0')} ₽</p>
            <div className="mt-3 flex gap-3 text-[10px] font-black uppercase opacity-80">
              <span>{allDebtors.length} должника</span>
              <span>·</span>
              <span>{allDebtors.reduce((s, d) => s + d.orders.length, 0)} записей</span>
            </div>
          </div>
        )}

        {/* Search */}
        {allDebtors.length > 3 && (
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300 text-sm">
              🔍
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени..."
              className="w-full rounded-2xl border-2 border-zinc-200 bg-white pl-10 pr-4 h-12 text-sm font-bold text-zinc-900 focus:border-orange-400 focus:outline-none"
            />
          </div>
        )}

        {/* States */}
        {isLoading && (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-white rounded-2xl border border-zinc-100" />
            ))}
          </div>
        )}

        {isError && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-center">
            <p className="text-red-600 font-black text-sm">❌ Ошибка загрузки</p>
            <button
              onClick={() => refetch()}
              className="mt-2 text-[10px] font-black uppercase text-red-500 active:opacity-70"
            >
              Повторить
            </button>
          </div>
        )}

        {!isLoading && !isError && allDebtors.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🎉</div>
            <p className="font-black text-zinc-700 text-base">Долгов нет!</p>
            <p className="text-zinc-400 text-xs font-bold uppercase tracking-wide mt-1">
              Все клиенты оплатили
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-6 bg-orange-500 text-white rounded-2xl px-6 py-3 text-[11px] font-black uppercase tracking-widest active:scale-[0.97] transition-all"
            >
              + Добавить должника
            </button>
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && allDebtors.length > 0 && (
          <p className="text-center py-8 text-zinc-400 font-bold text-xs uppercase">
            Ничего не найдено
          </p>
        )}

        {/* Debtors list */}
        {filtered.map((debtor) => {
          const isExpanded = expandedId === debtor.counterparty_id;
          const fu = debtor.follow_up;
          const promiseOverdue = !!fu?.promise_date && fu.promise_date < today;
          const days = daysAgo(debtor.oldest_at);
          const isReal = !debtor.is_individual && !debtor.counterparty_id.startsWith('__');
          const expandedDebtor = isExpanded ? debtor : null;

          return (
            <div key={debtor.counterparty_id}>
              {/* Debtor card */}
              <button
                type="button"
                onClick={() => {
                  setExpandedId(isExpanded ? null : debtor.counterparty_id);
                  setSelectedOrder(null);
                  setShowFollowUpId(null);
                  setSettleError('');
                  setCloseAllError('');
                }}
                className={`w-full rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.98] shadow-sm ${
                  isExpanded ? 'border-orange-400 bg-orange-50' : 'border-zinc-200 bg-white'
                }`}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p
                        className={`font-black text-base ${isExpanded ? 'text-orange-900' : 'text-zinc-900'}`}
                      >
                        {debtor.counterparty_name}
                      </p>
                      {debtor.is_individual && debtor.counterparty_subname && (
                        <span className="text-[9px] font-black uppercase bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">
                          {debtor.counterparty_subname}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {/* Age badge */}
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${ageBadge(days)}`}
                      >
                        {days === 0 ? 'сегодня' : `${days} дн.`}
                      </span>

                      {/* Orders count */}
                      <span className="text-[9px] font-bold text-zinc-400 uppercase">
                        {debtor.orders.length} {debtor.orders.length === 1 ? 'запись' : 'записи'}
                      </span>

                      {/* Follow-up badge */}
                      {fu && (
                        <span
                          className={`text-[9px] font-black uppercase ${promiseOverdue ? 'text-red-500' : followUpColor(fu, promiseOverdue)}`}
                        >
                          {promiseOverdue
                            ? '⚠ просрочено'
                            : FOLLOW_UP_STATUSES.find((s) => s.key === fu.status)?.label}
                        </span>
                      )}
                    </div>

                    {/* Next call reminder */}
                    {fu?.next_contact_at && !isExpanded && (
                      <p className="text-[9px] text-blue-500 font-bold mt-1 uppercase">
                        📞 Позвонить:{' '}
                        {new Date(fu.next_contact_at + 'T12:00:00').toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className={`font-black text-xl ${isExpanded ? 'text-orange-600' : 'text-orange-500'}`}
                    >
                      {fmt(debtor.total)} ₽
                    </p>
                    <p
                      className={`text-[10px] font-black uppercase mt-0.5 transition-transform ${isExpanded ? 'text-orange-400 rotate-180' : 'text-zinc-300'}`}
                    >
                      ▾
                    </p>
                  </div>
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && expandedDebtor && (
                <div className="mt-2 ml-3 space-y-3">
                  {/* Phone */}
                  {debtor.counterparty_phone && (
                    <a
                      href={`tel:${debtor.counterparty_phone}`}
                      className="flex items-center justify-center gap-2 w-full h-11 rounded-xl border-2 border-zinc-200 bg-white text-zinc-700 text-xs font-black uppercase tracking-wide active:scale-[0.97] transition-all"
                    >
                      📲 {formatPhone(debtor.counterparty_phone)}
                    </a>
                  )}

                  {/* Follow-up section */}
                  {isReal && (
                    <div>
                      {showFollowUpId === debtor.counterparty_id ? (
                        <div className="p-4 bg-blue-50 rounded-2xl border-2 border-blue-200 space-y-3">
                          <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">
                            📞 Фиксация звонка
                          </p>

                          <div className="grid grid-cols-2 gap-2">
                            {FOLLOW_UP_STATUSES.map((s) => (
                              <button
                                key={s.key}
                                type="button"
                                onClick={() => setFuStatus(s.key)}
                                className={`py-2.5 rounded-xl border-2 text-[10px] font-black uppercase tracking-wide transition-all active:scale-[0.97] ${
                                  fuStatus === s.key
                                    ? s.color
                                    : 'border-zinc-200 text-zinc-500 bg-white'
                                }`}
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>

                          {fuStatus === 'promised' && (
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                                Обещает оплатить
                              </label>
                              <input
                                type="date"
                                value={fuPromiseDate}
                                onChange={(e) => setFuPromiseDate(e.target.value)}
                                className="w-full rounded-xl border-2 border-zinc-200 bg-white px-3 h-11 text-sm font-bold text-zinc-900 focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                          )}

                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                              Следующий звонок
                            </label>
                            <input
                              type="date"
                              value={fuNextContact}
                              onChange={(e) => setFuNextContact(e.target.value)}
                              className="w-full rounded-xl border-2 border-zinc-200 bg-white px-3 h-11 text-sm font-bold text-zinc-900 focus:border-blue-500 focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                              Итог разговора
                            </label>
                            <input
                              type="text"
                              value={fuNotes}
                              onChange={(e) => setFuNotes(e.target.value)}
                              placeholder="Что сказал, что обещал..."
                              className="w-full rounded-xl border-2 border-zinc-200 bg-white px-3 h-11 text-sm font-bold text-zinc-900 focus:border-blue-500 focus:outline-none"
                            />
                          </div>

                          {fuError && <p className="text-red-600 text-xs font-bold">{fuError}</p>}

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setShowFollowUpId(null)}
                              className="flex-1 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest border-2 border-zinc-200 text-zinc-500 active:scale-[0.97]"
                            >
                              Отмена
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFollowUpSave(debtor.counterparty_id)}
                              disabled={fuSaving}
                              className="flex-1 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest text-white bg-blue-600 active:scale-[0.97] disabled:opacity-50"
                            >
                              {fuSaving ? '...' : '✓ Сохранить'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between px-1">
                          <div>
                            {fu ? (
                              <div>
                                <p
                                  className={`text-[10px] font-black uppercase ${promiseOverdue ? 'text-red-500' : 'text-zinc-400'}`}
                                >
                                  {promiseOverdue
                                    ? '⚠ Обещание просрочено'
                                    : FOLLOW_UP_STATUSES.find((s) => s.key === fu.status)?.label}
                                  {fu.notes &&
                                    ` · «${fu.notes.slice(0, 25)}${fu.notes.length > 25 ? '…' : ''}»`}
                                </p>
                                {fu.next_contact_at && (
                                  <p className="text-[9px] text-blue-500 font-bold mt-0.5">
                                    📞 Позвонить:{' '}
                                    {new Date(fu.next_contact_at + 'T12:00:00').toLocaleDateString(
                                      'ru-RU',
                                      {
                                        day: 'numeric',
                                        month: 'short',
                                      },
                                    )}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-[10px] text-zinc-300 font-bold uppercase">
                                Звонки не фиксировались
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => openFollowUp(debtor)}
                            className="px-3 py-2 rounded-xl border-2 border-blue-200 text-blue-600 text-[10px] font-black uppercase tracking-wide active:scale-[0.97] bg-blue-50"
                          >
                            📞 Звонок
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Settle ALL */}
                  <div className="p-4 bg-green-50 rounded-2xl border-2 border-green-200 space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-black text-green-700 uppercase tracking-widest">
                        Погасить весь долг
                      </p>
                      <p className="font-black text-green-700 text-lg">{fmt(debtor.total)} ₽</p>
                    </div>

                    <div className="flex gap-2">
                      {WALLET_OPTIONS.map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => setCloseAllWallet(w.id)}
                          className={`flex-1 py-2.5 rounded-xl border-2 text-[10px] font-black transition-all active:scale-[0.97] ${
                            closeAllWallet === w.id
                              ? w.color
                              : 'border-zinc-200 bg-white text-zinc-500'
                          }`}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>

                    {closeAllError && (
                      <p className="text-red-600 text-xs font-bold">{closeAllError}</p>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCloseAll(debtor)}
                      disabled={closingAllId === debtor.counterparty_id}
                      className="w-full h-13 rounded-xl font-black uppercase tracking-widest text-white bg-green-600 active:scale-[0.97] transition-all disabled:opacity-50 py-3 text-sm"
                    >
                      {closingAllId === debtor.counterparty_id
                        ? '⏳ Проводим...'
                        : `✓ Погасить ${fmt(debtor.total)} ₽ · ${debtor.orders.length} записей`}
                    </button>
                  </div>

                  {/* Individual orders */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">
                      Отдельные записи
                    </p>
                    {expandedDebtor.orders.map((order) => {
                      const isOrderSelected = selectedOrder?.id === order.id;
                      const orderDays = daysAgo(order.created_at);

                      return (
                        <div key={order.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrder(isOrderSelected ? null : order);
                              setSettleNote('');
                              setSettleError('');
                            }}
                            className={`w-full p-3 rounded-xl border-2 flex justify-between items-center transition-all active:scale-[0.98] ${
                              isOrderSelected
                                ? 'border-orange-400 bg-orange-50'
                                : 'border-zinc-100 bg-white'
                            }`}
                          >
                            <div className="text-left flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {order.type === 'manual' ? (
                                  <span className="text-[10px] font-black text-blue-600 uppercase">
                                    Ручная запись
                                  </span>
                                ) : order.trip_number ? (
                                  <span className="text-[10px] font-black text-zinc-700 uppercase">
                                    Рейс №{order.trip_number}
                                  </span>
                                ) : null}
                                <span
                                  className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${ageBadge(orderDays)}`}
                                >
                                  {orderDays === 0 ? 'сегодня' : `${orderDays} дн.`}
                                </span>
                              </div>
                              <p className="text-[10px] text-zinc-400 font-bold uppercase mt-0.5">
                                {order.payment_method
                                  ? (PM_LABELS[order.payment_method] ?? order.payment_method)
                                  : 'Ручная запись'}
                                {order.driver_name ? ` · ${order.driver_name}` : ''}
                              </p>
                              {order.description && (
                                <p className="text-[9px] text-zinc-400 mt-0.5 truncate">
                                  {order.description}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <p
                                className={`font-black text-base ${isOrderSelected ? 'text-orange-600' : 'text-zinc-700'}`}
                              >
                                {fmt(order.amount)} ₽
                              </p>
                            </div>
                          </button>

                          {/* Settle panel for individual order */}
                          {isOrderSelected && (
                            <div className="mt-1 ml-2 p-3 bg-orange-50 rounded-xl border-2 border-orange-200 space-y-3">
                              {order.payment_method && PM_WALLET_LABEL[order.payment_method] && (
                                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                                  {PM_WALLET_LABEL[order.payment_method]}
                                </p>
                              )}
                              {order.type === 'manual' && (
                                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                                  → 💵 Сейф
                                </p>
                              )}
                              <input
                                type="text"
                                value={settleNote}
                                onChange={(e) => setSettleNote(e.target.value)}
                                placeholder="Комментарий (необязательно)"
                                className="w-full rounded-lg border-2 border-zinc-200 bg-white px-3 h-11 text-sm font-bold text-zinc-900 focus:border-orange-400 focus:outline-none"
                              />
                              {settleError && (
                                <p className="text-red-600 text-xs font-bold uppercase">
                                  {settleError}
                                </p>
                              )}
                              <button
                                onClick={() => settleMutation.mutate()}
                                disabled={settleMutation.isPending}
                                className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-white bg-orange-500 active:scale-[0.97] transition-all disabled:opacity-50 text-sm"
                              >
                                {settleMutation.isPending
                                  ? '⏳ Проводим...'
                                  : `✓ Погасить ${fmt(order.amount)} ₽`}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Add Debtor Form ──────────────────────────────────────────────────────────

function AddDebtorForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<'search' | 'form'>('search');
  const [searchText, setSearchText] = useState('');
  const [selectedCp, setSelectedCp] = useState<CounterpartyOption | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]!);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: counterparties = [], isLoading: cpLoading } = useQuery<CounterpartyOption[]>({
    queryKey: ['counterparties-search', searchText],
    queryFn: async () => {
      const params = searchText.trim() ? `?search=${encodeURIComponent(searchText)}` : '';
      const r = await fetch(`/api/admin/counterparties${params}`);
      if (!r.ok) throw new Error('Ошибка');
      return r.json();
    },
    staleTime: 10000,
  });

  useEffect(() => {
    if (step === 'search') {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [step]);

  async function handleSubmit() {
    if (!selectedCp) return setError('Выберите клиента');
    if (!amount || parseFloat(amount) <= 0) return setError('Введите сумму долга');
    setError('');
    setCreating(true);
    try {
      const r = await fetch('/api/admin/manual-receivable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counterparty_id: selectedCp.id,
          amount,
          description: description || undefined,
          date,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? 'Ошибка');
      onSuccess();
    } catch (e: any) {
      setError(e.message ?? 'Ошибка');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="bg-white border-b-2 border-zinc-200 px-4 h-16 flex items-center gap-3 sticky top-0 z-40">
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 active:bg-zinc-100 text-xl shrink-0"
        >
          ←
        </button>
        <h1 className="font-black text-zinc-900 text-base uppercase tracking-tight">
          Новый должник
        </h1>
      </header>

      <div className="p-4 space-y-4">
        {step === 'search' ? (
          <>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                Найти клиента
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300 text-sm">
                  🔍
                </span>
                <input
                  ref={searchRef}
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Имя или телефон..."
                  className="w-full rounded-2xl border-2 border-zinc-200 bg-white pl-10 pr-4 h-13 py-3 text-sm font-bold text-zinc-900 focus:border-orange-400 focus:outline-none"
                />
              </div>
            </div>

            {cpLoading ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-white rounded-xl border border-zinc-100" />
                ))}
              </div>
            ) : counterparties.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-zinc-400 font-bold text-xs uppercase">
                  {searchText ? 'Не найдено' : 'Введите имя клиента'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {counterparties.map((cp) => (
                  <button
                    key={cp.id}
                    type="button"
                    onClick={() => {
                      setSelectedCp(cp);
                      setStep('form');
                    }}
                    className="w-full bg-white rounded-2xl border-2 border-zinc-200 p-4 text-left active:scale-[0.98] transition-all active:border-orange-400"
                  >
                    <p className="font-black text-zinc-900 text-sm">{cp.name}</p>
                    {cp.phone && (
                      <p className="text-[10px] text-zinc-400 font-bold mt-0.5">
                        {formatPhone(cp.phone)}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Selected client */}
            <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">
                  Клиент
                </p>
                <p className="font-black text-orange-900 text-base">{selectedCp?.name}</p>
                {selectedCp?.phone && (
                  <p className="text-[10px] text-orange-700 font-bold mt-0.5">
                    {formatPhone(selectedCp.phone)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep('search');
                  setSelectedCp(null);
                }}
                className="text-orange-400 font-black text-[10px] uppercase tracking-widest active:opacity-70"
              >
                Изменить
              </button>
            </div>

            {/* Amount */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                Сумма долга, ₽
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                autoFocus
                className="w-full rounded-2xl border-2 border-zinc-200 px-5 h-16 text-3xl font-black text-zinc-900 focus:border-orange-400 focus:outline-none"
                onFocus={(e) =>
                  setTimeout(
                    () => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }),
                    300,
                  )
                }
              />
            </div>

            {/* Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                Дата возникновения долга
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 h-12 text-sm font-bold text-zinc-900 focus:border-orange-400 focus:outline-none"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                За что (необязательно)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Рейс, услуга, ремонт..."
                className="w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 h-12 text-sm font-bold text-zinc-900 focus:border-orange-400 focus:outline-none"
              />
            </div>

            {error && <p className="text-red-600 text-xs font-bold uppercase">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={creating}
              className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-white bg-orange-500 active:scale-[0.97] transition-all disabled:opacity-50 text-sm"
            >
              {creating ? '⏳ Сохраняем...' : '✓ Добавить должника'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
