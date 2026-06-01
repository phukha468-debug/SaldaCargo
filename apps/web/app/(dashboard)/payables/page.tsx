'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Money } from '@saldacargo/ui';
import { formatDate } from '@saldacargo/shared';
import { cn } from '@saldacargo/ui';

const WALLETS = [
  { id: '10000000-0000-0000-0000-000000000001', label: 'Р/счёт' },
  { id: '10000000-0000-0000-0000-000000000002', label: 'Касса' },
];

type HistoryEntry = {
  id: string;
  amount: string;
  description: string | null;
  settlement_status: string;
  created_at: string;
  source?: 'fuel_card' | 'manual';
  direction?: string;
  trip_number?: number | null;
  asset_short_name?: string | null;
  asset_reg_number?: string | null;
};

type SupplierEntry = {
  id: string;
  name: string;
  icon: string;
  category: string;
  debtDays: number;
  autoAccrue: boolean;
  description: string;
  debt: string;
  accumulated: string | null;
  discount: string | null;
  history: HistoryEntry[];
};

export default function PayablesPage() {
  const qc = useQueryClient();

  const { data: suppliers = [], isLoading } = useQuery<SupplierEntry[]>({
    queryKey: ['payables'],
    queryFn: () => fetch('/api/payables').then((r) => r.json()),
    staleTime: 30000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['payables'] });

  const totalDebt = suppliers.reduce((s, sup) => s + Math.max(0, parseFloat(sup.debt)), 0);

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-300">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Долги поставщикам</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Кредиторская задолженность — Дерябин ГСМ, Новиков, Ромашин
          </p>
        </div>
        {!isLoading && totalDebt > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-2">
            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">
              Итого долгов
            </p>
            <p className="text-xl font-black text-rose-700">
              <Money amount={totalDebt.toFixed(2)} />
            </p>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {suppliers.map((s) => (
            <SupplierCard key={s.id} supplier={s} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function SupplierCard({
  supplier: s,
  onChanged,
}: {
  supplier: SupplierEntry;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [modal, setModal] = useState<'pay' | 'debt' | null>(null);
  const debt = parseFloat(s.debt);
  const hasDebt = debt > 0;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const paidThisMonth = s.history
    .filter((h) => h.created_at >= monthStart && h.settlement_status === 'completed')
    .reduce((acc, h) => acc + parseFloat(h.amount ?? '0'), 0);

  return (
    <div
      className={cn(
        'bg-white border rounded-2xl shadow-sm overflow-hidden',
        hasDebt ? 'border-rose-200' : 'border-slate-200',
      )}
    >
      {/* Шапка */}
      <div className={cn('px-5 py-4', hasDebt ? 'bg-rose-50/40' : 'bg-white')}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{s.icon}</span>
            <div>
              <p className="font-black text-slate-900 text-lg leading-tight">{s.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.description}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Текущий долг
            </p>
            <p
              className={cn('text-2xl font-black', hasDebt ? 'text-rose-700' : 'text-emerald-600')}
            >
              <Money amount={Math.max(0, debt).toFixed(2)} />
            </p>
          </div>
        </div>

        {/* Блок скидки Дерябина */}
        {s.accumulated !== null && s.discount !== null && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wide">
                Накоплено всего
              </p>
              <p className="text-sm font-black text-amber-800">
                <Money amount={s.accumulated} />
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wide">
                Скидка 12%
              </p>
              <p className="text-sm font-black text-emerald-700">
                −&nbsp;
                <Money amount={s.discount} />
              </p>
            </div>
          </div>
        )}

        {/* Оплачено в этом месяце */}
        {paidThisMonth > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400">Оплачено в этом месяце:</span>
            <span className="text-[10px] font-bold text-emerald-600">
              <Money amount={paidThisMonth.toFixed(2)} />
            </span>
          </div>
        )}

        {/* Действия */}
        <div className="flex flex-wrap gap-2 mt-4">
          {hasDebt && (
            <button
              onClick={() => setModal('pay')}
              className="bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Оплатить
            </button>
          )}
          <button
            onClick={() => setModal('debt')}
            className="text-xs font-bold px-4 py-2 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-600 transition-colors"
          >
            + Добавить долг
          </button>
        </div>
      </div>

      {/* Спойлер со всеми транзакциями */}
      <div className="border-t border-slate-100">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-2.5 bg-slate-50/60 hover:bg-slate-100/60 transition-colors"
        >
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            История операций ({s.history.length})
          </p>
          <svg
            className={cn(
              'w-3.5 h-3.5 text-slate-400 transition-transform',
              expanded && 'rotate-180',
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {expanded && (
          <div className="divide-y divide-slate-50">
            {s.history.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-400 italic">Операций нет</p>
            ) : (
              s.history.map((h) => {
                const isPayment = h.settlement_status === 'completed';
                const tripLabel = h.trip_number ? `Рейс №${h.trip_number}` : null;
                const assetLabel = h.asset_short_name
                  ? h.asset_reg_number
                    ? `${h.asset_short_name} (${h.asset_reg_number})`
                    : h.asset_short_name
                  : null;
                return (
                  <div key={h.id} className="px-5 py-2.5 flex items-center justify-between">
                    <div className="min-w-0 flex-1 mr-3">
                      <p className="text-xs text-slate-700 truncate">{h.description || '—'}</p>
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                        <p className="text-[10px] text-slate-400">{formatDate(h.created_at)}</p>
                        {h.source === 'fuel_card' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">
                            карта
                          </span>
                        )}
                        {tripLabel && (
                          <span className="text-[9px] text-slate-500 font-medium">{tripLabel}</span>
                        )}
                        {assetLabel && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-600">
                            {assetLabel}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={cn(
                          'text-xs font-bold',
                          isPayment ? 'text-emerald-600' : 'text-rose-600',
                        )}
                      >
                        {isPayment ? '−' : '+'}
                        <Money amount={h.amount} />
                      </p>
                      <span
                        className={cn(
                          'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded',
                          isPayment ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600',
                        )}
                      >
                        {isPayment ? 'оплачено' : 'долг'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Модалки */}
      {modal === 'pay' && (
        <PayModal
          supplier={s}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            onChanged();
          }}
        />
      )}
      {modal === 'debt' && (
        <DebtModal
          supplier={s}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function PayModal({
  supplier,
  onClose,
  onDone,
}: {
  supplier: SupplierEntry;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(Math.max(0, parseFloat(supplier.debt)).toFixed(2));
  const [wallet, setWallet] = useState(WALLETS[0]!.id);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (body: object) =>
      fetch('/api/payables/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? 'Ошибка');
        return j;
      }),
    onSuccess: onDone,
    onError: (e: Error) => setError(e.message),
  });

  const cls =
    'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Оплата · {supplier.name}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl">
            ×
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Сумма (₽)</label>
            <input
              type="number"
              className={cls}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Оплата с</label>
            <select className={cls} value={wallet} onChange={(e) => setWallet(e.target.value)}>
              {WALLETS.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Комментарий</label>
            <input
              type="text"
              className={cls}
              placeholder={`Оплата долга ${supplier.name}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={() => {
              setError('');
              mutation.mutate({
                supplier_id: supplier.id,
                amount,
                from_wallet_id: wallet,
                description: note,
              });
            }}
            disabled={mutation.isPending}
            className="flex-1 bg-slate-900 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Сохранение...' : 'Записать оплату'}
          </button>
          <button
            onClick={onClose}
            className="px-4 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

function DebtModal({
  supplier,
  onClose,
  onDone,
}: {
  supplier: SupplierEntry;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (body: object) =>
      fetch('/api/payables/debt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? 'Ошибка');
        return j;
      }),
    onSuccess: onDone,
    onError: (e: Error) => setError(e.message),
  });

  const cls =
    'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Добавить долг · {supplier.name}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl">
            ×
          </button>
        </div>
        <div className="p-5 space-y-3">
          {supplier.autoAccrue && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
              ⚡ ГСМ по карте учитывается автоматически. Здесь — только ручные закупки.
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Сумма (₽)</label>
            <input
              type="number"
              className={cls}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Что купили</label>
            <input
              type="text"
              className={cls}
              placeholder="Тормозные колодки, масло фильтр..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={() => {
              setError('');
              mutation.mutate({ supplier_id: supplier.id, amount, description: note });
            }}
            disabled={mutation.isPending}
            className="flex-1 bg-slate-900 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Сохранение...' : 'Добавить долг'}
          </button>
          <button
            onClick={onClose}
            className="px-4 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
