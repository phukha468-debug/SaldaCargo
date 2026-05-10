'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Money } from '@saldacargo/ui';
import { formatDate } from '@saldacargo/shared';
import { cn } from '@saldacargo/ui';

const WALLETS = [
  { id: '10000000-0000-0000-0000-000000000001', label: 'Расчётный счёт' },
  { id: '10000000-0000-0000-0000-000000000002', label: 'Сейф (Наличные)' },
  { id: '10000000-0000-0000-0000-000000000003', label: 'Карта' },
];

type SupplierEntry = {
  id: string;
  name: string;
  icon: string;
  category: string;
  debtDays: number;
  autoAccrue: boolean;
  description: string;
  debt: string;
  history: Array<{
    id: string;
    amount: string;
    description: string | null;
    settlement_status: string;
    created_at: string;
  }>;
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
            Кредиторская задолженность — Опти24, Новиков, Ромашин
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
  const [modal, setModal] = useState<'pay' | 'debt' | null>(null);
  const debt = parseFloat(s.debt);
  const hasDebt = debt > 0;

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

        {/* Действия */}
        <div className="flex gap-2 mt-4">
          {hasDebt && (
            <button
              onClick={() => setModal('pay')}
              className="bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Оплатить
            </button>
          )}
          {!s.autoAccrue && (
            <button
              onClick={() => setModal('debt')}
              className="text-xs font-bold px-4 py-2 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-600 transition-colors"
            >
              + Добавить долг
            </button>
          )}
          {s.autoAccrue && (
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              ⚡ Долг накапливается автоматически из расходов по топливной карте
            </p>
          )}
        </div>
      </div>

      {/* История */}
      {s.history.length > 0 && (
        <div className="border-t border-slate-100">
          <div className="px-5 py-2 bg-slate-50/60">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Последние записи
            </p>
          </div>
          <div className="divide-y divide-slate-50">
            {s.history.map((h) => (
              <div key={h.id} className="px-5 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-700">{h.description || '—'}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(h.created_at)}</p>
                </div>
                <div className="text-right">
                  <p
                    className={cn(
                      'text-xs font-bold',
                      h.settlement_status === 'completed' ? 'text-emerald-600' : 'text-rose-600',
                    )}
                  >
                    {h.settlement_status === 'completed' ? '−' : '+'}
                    <Money amount={h.amount} />
                  </p>
                  <span
                    className={cn(
                      'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded',
                      h.settlement_status === 'completed'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-rose-50 text-rose-600',
                    )}
                  >
                    {h.settlement_status === 'completed' ? 'оплачено' : 'долг'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? 'Ошибка');
        return json;
      }),
    onSuccess: onDone,
    onError: (e: Error) => setError(e.message),
  });

  const inputCls =
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
              className={inputCls}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Оплата с</label>
            <select className={inputCls} value={wallet} onChange={(e) => setWallet(e.target.value)}>
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
              className={inputCls}
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
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? 'Ошибка');
        return json;
      }),
    onSuccess: onDone,
    onError: (e: Error) => setError(e.message),
  });

  const inputCls =
    'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Долг за запчасти · {supplier.name}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl">
            ×
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Сумма (₽)</label>
            <input
              type="number"
              className={inputCls}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Что купили</label>
            <input
              type="text"
              className={inputCls}
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
