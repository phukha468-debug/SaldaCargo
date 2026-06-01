/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { Money } from '@saldacargo/ui';
import { formatDate } from '@saldacargo/shared';

export default function AdminFinancePage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 animate-pulse space-y-3">
          <div className="h-10 bg-zinc-200 rounded" />
          <div className="h-32 bg-zinc-200 rounded" />
        </div>
      }
    >
      <FinanceContent />
    </Suspense>
  );
}

function FinanceContent() {
  const searchParams = useSearchParams();
  const initialAction = searchParams.get('action');
  const [showForm, setShowForm] = useState<
    | 'income_menu'
    | 'expense_menu'
    | 'income'
    | 'expense'
    | 'debts'
    | 'supplier_debt'
    | 'salary'
    | null
  >(
    initialAction === 'income_menu'
      ? 'income_menu'
      : initialAction === 'expense_menu'
        ? 'expense_menu'
        : initialAction === 'income'
          ? 'income_menu'
          : initialAction === 'expense'
            ? 'expense_menu'
            : initialAction === 'debts'
              ? 'debts'
              : initialAction === 'supplier_debt'
                ? 'supplier_debt'
                : initialAction === 'salary'
                  ? 'salary'
                  : null,
  );
  const queryClient = useQueryClient();

  const [txDate, setTxDate] = useState(() => new Date().toISOString().split('T')[0]);
  const isTxToday = txDate === new Date().toISOString().split('T')[0];

  const shiftDay = (n: number) => {
    const d = new Date(txDate + 'T12:00:00');
    d.setDate(d.getDate() + n);
    setTxDate(d.toISOString().split('T')[0]);
  };

  const navDateLabel = (() => {
    const d = new Date(txDate + 'T12:00:00');
    return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
  })();

  const { data: transactions = [], isLoading } = useQuery<any[]>({
    queryKey: ['admin-transactions', txDate],
    queryFn: () => fetch(`/api/admin/transactions?date=${txDate}`).then((r) => r.json()),
    staleTime: 15000,
  });

  const { data: receivablesSummary } = useQuery<{ debtors: any[]; totalAmount: string }>({
    queryKey: ['admin-receivables'],
    queryFn: () => fetch('/api/admin/receivables').then((r) => r.json()),
    staleTime: 60000,
  });

  const debtorCount = receivablesSummary?.debtors?.length ?? 0;
  const totalDebt = parseFloat(receivablesSummary?.totalAmount ?? '0');

  return (
    <div>
      <header className="bg-white border-b-2 border-zinc-200 px-4 h-16 flex items-center sticky top-0 z-40">
        <h1 className="font-black text-zinc-900 text-lg uppercase tracking-tight">Финансы</h1>
      </header>

      <div className="p-4 space-y-4">
        {/* Подменю ДОХОД */}
        {showForm === 'income_menu' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowForm(null)}
                className="text-zinc-400 font-bold text-sm active:scale-[0.97]"
              >
                ← Назад
              </button>
              <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">
                ➕ Доход
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowForm('income')}
                className="bg-green-600 text-white rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-all shadow-sm"
              >
                <span className="text-xl">📝</span>
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Добавить доход
                </span>
              </button>
              <Link
                href="/admin/finance/receivables"
                className="col-span-2 bg-orange-500 text-white rounded-2xl p-4 flex items-center justify-between active:scale-[0.97] transition-all shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">📋</span>
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    Дебиторка
                  </span>
                </div>
                {debtorCount > 0 && (
                  <span className="text-[11px] font-black bg-white/20 rounded-xl px-3 py-1">
                    {debtorCount} · {totalDebt.toLocaleString('ru-RU')} ₽
                  </span>
                )}
              </Link>
            </div>
          </div>
        )}

        {/* Подменю РАСХОД */}
        {showForm === 'expense_menu' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowForm(null)}
                className="text-zinc-400 font-bold text-sm active:scale-[0.97]"
              >
                ← Назад
              </button>
              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                ➖ Расход
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowForm('expense')}
                className="bg-zinc-800 text-white rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-all shadow-sm"
              >
                <span className="text-xl">📝</span>
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Добавить расход
                </span>
              </button>
              <button
                onClick={() => setShowForm('supplier_debt')}
                className="bg-amber-600 text-white rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-all shadow-sm"
              >
                <span className="text-xl">🧾</span>
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Долг поставщику
                </span>
              </button>
              <button
                onClick={() => setShowForm('debts')}
                className="bg-rose-600 text-white rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-all shadow-sm"
              >
                <span className="text-xl">💳</span>
                <span className="text-[10px] font-black uppercase tracking-widest">Кредиты</span>
              </button>
              <button
                onClick={() => setShowForm('salary')}
                className="bg-violet-600 text-white rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-all shadow-sm"
              >
                <span className="text-xl">💰</span>
                <span className="text-[10px] font-black uppercase tracking-widest">
                  ЗП сотрудников
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Форма добавления транзакции */}
        {(showForm === 'income' || showForm === 'expense') && (
          <AddTransactionForm
            direction={showForm}
            onClose={() => setShowForm(showForm === 'income' ? 'income_menu' : 'expense_menu')}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
              setShowForm(null);
            }}
          />
        )}

        {/* Форма записи долга поставщику */}
        {showForm === 'supplier_debt' && (
          <SupplierDebtForm
            onClose={() => setShowForm('expense_menu')}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['admin-payables'] });
              queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
              setShowForm(null);
            }}
          />
        )}

        {/* Форма оплаты кредитов */}
        {showForm === 'debts' && (
          <DebtPaymentForm
            onClose={() => setShowForm('expense_menu')}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
              setShowForm(null);
            }}
          />
        )}

        {/* Форма выплаты ЗП */}
        {showForm === 'salary' && (
          <SalaryPaymentForm
            onClose={() => setShowForm('expense_menu')}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['admin-payroll'] });
              queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
              setShowForm(null);
            }}
          />
        )}

        {/* Быстрые кнопки */}
        {showForm === null && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowForm('income_menu')}
              className="bg-green-600 text-white rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-all shadow-sm"
            >
              <span className="text-xl">➕</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Доход</span>
            </button>
            <button
              onClick={() => setShowForm('expense_menu')}
              className="bg-zinc-800 text-white rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-all shadow-sm"
            >
              <span className="text-xl">➖</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Расход</span>
            </button>

            {/* Дебиторка — большая карточка */}
            <Link
              href="/admin/finance/receivables"
              className="col-span-2 rounded-2xl p-4 flex items-center justify-between active:scale-[0.97] transition-all shadow-sm overflow-hidden relative"
              style={{
                background:
                  debtorCount > 0 ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : '#f4f4f5',
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <p
                    className={`text-[10px] font-black uppercase tracking-widest ${debtorCount > 0 ? 'text-orange-100' : 'text-zinc-400'}`}
                  >
                    Дебиторка
                  </p>
                  {debtorCount > 0 ? (
                    <p className="text-white font-black text-lg leading-tight">
                      {totalDebt.toLocaleString('ru-RU')} ₽
                    </p>
                  ) : (
                    <p className="text-zinc-400 font-black text-sm leading-tight">Долгов нет</p>
                  )}
                </div>
              </div>
              {debtorCount > 0 && (
                <div className="text-right">
                  <p className="text-white font-black text-2xl">{debtorCount}</p>
                  <p className="text-orange-200 text-[9px] font-black uppercase">должн.</p>
                </div>
              )}
            </Link>
          </div>
        )}

        {/* История */}
        {showForm === null && (
          <section className="space-y-3">
            {/* Навигация по дням */}
            <div className="bg-white rounded-2xl border border-zinc-100 px-3 py-2 flex items-center gap-2 shadow-sm">
              <button
                onClick={() => shiftDay(-1)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 active:bg-zinc-100 text-lg"
              >
                ←
              </button>
              <div className="flex-1 text-center">
                <p className="text-sm font-black text-zinc-900">{navDateLabel}</p>
                {!isLoading &&
                  (() => {
                    const inc = transactions
                      .filter((t: any) => t.direction === 'income')
                      .reduce((s: number, t: any) => s + parseFloat(t.amount), 0);
                    const exp = transactions
                      .filter((t: any) => t.direction === 'expense')
                      .reduce((s: number, t: any) => s + parseFloat(t.amount), 0);
                    return (
                      <p className="text-[10px] font-bold mt-0.5">
                        {inc > 0 && (
                          <span className="text-green-600">+{inc.toLocaleString('ru-RU')} ₽</span>
                        )}
                        {inc > 0 && exp > 0 && <span className="text-zinc-300 mx-1">|</span>}
                        {exp > 0 && (
                          <span className="text-red-500">−{exp.toLocaleString('ru-RU')} ₽</span>
                        )}
                        {inc === 0 && exp === 0 && (
                          <span className="text-zinc-300">Нет операций</span>
                        )}
                      </p>
                    );
                  })()}
              </div>
              <button
                onClick={() => shiftDay(1)}
                disabled={isTxToday}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 active:bg-zinc-100 disabled:opacity-30 text-lg"
              >
                →
              </button>
            </div>
            {!isTxToday && (
              <button
                onClick={() => setTxDate(new Date().toISOString().split('T')[0])}
                className="w-full text-[10px] font-black uppercase tracking-widest text-zinc-400 py-1 active:text-zinc-700"
              >
                ← вернуться к сегодня
              </button>
            )}

            {isLoading ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-zinc-200 rounded-xl" />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-center py-8 text-zinc-300 font-bold uppercase text-xs">
                Операций нет
              </p>
            ) : (
              transactions.map((tx: any) => {
                const walletName =
                  tx.direction === 'income' ? tx.to_wallet?.name : tx.from_wallet?.name;
                return (
                  <div
                    key={tx.id}
                    className="bg-white rounded-xl border border-zinc-100 px-4 py-3 flex justify-between items-start shadow-sm gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-zinc-900 text-sm">
                        {tx.category?.name ?? tx.description ?? '—'}
                      </p>
                      {tx.description && tx.description !== tx.category?.name && (
                        <p className="text-[10px] text-zinc-500 font-bold mt-0.5 truncate">
                          {tx.description}
                        </p>
                      )}
                      {tx.counterparty?.name && (
                        <p className="text-[10px] text-blue-600 font-bold mt-0.5 truncate">
                          {tx.direction === 'income' ? 'от: ' : 'кому: '}
                          {tx.counterparty.name}
                        </p>
                      )}
                      <p className="text-[10px] text-zinc-400 font-bold uppercase mt-0.5">
                        {tx.direction === 'income' ? '📈' : '📉'}{' '}
                        {new Date(tx.created_at).toLocaleTimeString('ru-RU', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {walletName && <span className="text-zinc-300"> · {walletName}</span>}
                      </p>
                    </div>
                    <Money
                      amount={tx.amount}
                      className={`font-black text-sm shrink-0 ${tx.direction === 'income' ? 'text-green-600' : 'text-red-500'}`}
                    />
                  </div>
                );
              })
            )}
          </section>
        )}
      </div>
    </div>
  );
}

const WALLET_OPTIONS = [
  { id: '10000000-0000-0000-0000-000000000001', label: '🏦 Расчётный счёт' },
  { id: '10000000-0000-0000-0000-000000000002', label: '💵 Касса (Наличные)' },
];

const DEBT_SUPPLIERS = [
  { id: '20000000-0000-0000-0000-000000000002', name: 'Новиков А.В.', icon: '🔧' },
  { id: '20000000-0000-0000-0000-000000000003', name: 'Ромашин', icon: '🔧' },
];

function SupplierDebtForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [supplierId, setSupplierId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/admin/payable-debt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: supplierId,
          amount,
          description: description || undefined,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? 'Ошибка');
      return json;
    },
    onSuccess,
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = () => {
    if (!supplierId) return setError('Выберите поставщика');
    if (!amount || parseFloat(amount) <= 0) return setError('Введите сумму');
    setError('');
    mutation.mutate();
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-zinc-100 p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-black uppercase text-sm text-amber-600">🧾 Долг поставщику</h2>
        <button onClick={onClose} className="text-zinc-400 font-bold text-lg">
          ✕
        </button>
      </div>

      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">
        Взяли запчасти в кредит — деньги ещё не заплачены
      </p>

      {/* Выбор поставщика */}
      <div className="space-y-2">
        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
          Поставщик
        </label>
        <div className="space-y-2">
          {DEBT_SUPPLIERS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSupplierId(s.id)}
              className={`w-full p-3 rounded-xl border-2 flex items-center gap-3 text-sm font-bold transition-all active:scale-[0.98] ${
                supplierId === s.id
                  ? 'border-amber-500 bg-amber-50 text-amber-900'
                  : 'border-zinc-200 text-zinc-700'
              }`}
            >
              <span className="text-lg">{s.icon}</span>
              <span>{s.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Сумма */}
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
          className="w-full rounded-lg border-2 border-zinc-200 px-4 h-14 text-2xl font-black text-zinc-900 focus:border-amber-500 focus:outline-none"
          onFocus={(e) =>
            setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
          }
        />
      </div>

      {/* Описание */}
      <div className="space-y-1">
        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
          Что взяли (необязательно)
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Тормозные колодки, масло фильтр..."
          className="w-full rounded-lg border-2 border-zinc-200 px-4 h-12 text-sm font-bold text-zinc-900 focus:border-amber-500 focus:outline-none"
        />
      </div>

      {error && <p className="text-red-600 text-xs font-bold uppercase">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={mutation.isPending}
        className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-white bg-amber-600 active:scale-[0.97] transition-all disabled:opacity-50"
      >
        {mutation.isPending ? 'Записываем...' : '✓ Записать долг'}
      </button>
    </div>
  );
}

type DebtItem =
  | {
      kind: 'loan';
      id: string;
      name: string;
      remaining: string;
      monthly: string | null;
      nextDate: string | null;
    }
  | { kind: 'supplier'; id: string; name: string; icon: string; debt: string };

type SupplierTx = {
  id: string;
  amount: string;
  description: string | null;
  created_at: string;
  settlement_status: 'pending' | 'completed';
};

type SupplierWithTxns = {
  id: string;
  name: string;
  icon: string;
  pending: SupplierTx[];
  completed: SupplierTx[];
};

function DebtPaymentForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [selected, setSelected] = useState<DebtItem | null>(null);
  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState(WALLET_OPTIONS[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);

  const { data: loans = [], isLoading: loansLoading } = useQuery<any[]>({
    queryKey: ['admin-loans'],
    queryFn: () => fetch('/api/admin/loans').then((r) => r.json()),
    staleTime: 30000,
  });

  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery<any[]>({
    queryKey: ['admin-payables'],
    queryFn: () => fetch('/api/admin/payables').then((r) => r.json()),
    staleTime: 30000,
  });

  const { data: supplierTxns = [] } = useQuery<SupplierWithTxns[]>({
    queryKey: ['admin-payables-txns'],
    queryFn: () => fetch('/api/admin/payables/transactions').then((r) => r.json()),
    staleTime: 30000,
  });

  const isLoading = loansLoading || suppliersLoading;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Не выбрано');
      const url =
        selected.kind === 'loan' ? '/api/admin/loan-payment' : '/api/admin/supplier-payment';
      const body =
        selected.kind === 'loan'
          ? { loan_id: selected.id, amount, from_wallet_id: walletId, description: note }
          : { supplier_id: selected.id, amount, from_wallet_id: walletId, description: note };

      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? 'Ошибка');
      return json;
    },
    onSuccess,
    onError: (e: Error) => setError(e.message),
  });

  const selectItem = (item: DebtItem) => {
    setSelected(item);
    setError('');
    if (item.kind === 'loan' && item.monthly) {
      setAmount(parseFloat(item.monthly).toFixed(0));
    } else if (item.kind === 'supplier') {
      setAmount(parseFloat(item.debt).toFixed(0));
    } else {
      setAmount('');
    }
  };

  const handleSubmit = () => {
    if (!selected) return setError('Выберите что оплачиваем');
    if (!amount || parseFloat(amount) <= 0) return setError('Введите сумму');
    setError('');
    mutation.mutate();
  };

  const hasDebts =
    loans.some((l) => parseFloat(l.remaining_amount) > 0) ||
    suppliers.some((s) => parseFloat(s.debt) > 0);

  return (
    <div className="bg-white rounded-2xl border-2 border-zinc-100 p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-black uppercase text-sm text-rose-600">💳 Кредиты и долги</h2>
        <button onClick={onClose} className="text-zinc-400 font-bold text-lg">
          ✕
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-zinc-200 rounded-xl" />
          ))}
        </div>
      ) : !hasDebts ? (
        <p className="text-center py-6 text-zinc-400 font-bold text-xs uppercase">Долгов нет 🎉</p>
      ) : (
        <div className="space-y-2">
          {/* Кредиты */}
          {loans.filter((l) => parseFloat(l.remaining_amount) > 0).length > 0 && (
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
              Кредиты и займы
            </p>
          )}
          {loans
            .filter((l) => parseFloat(l.remaining_amount) > 0)
            .map((l) => {
              const item: DebtItem = {
                kind: 'loan',
                id: l.id,
                name: l.lender_name,
                remaining: l.remaining_amount,
                monthly: l.monthly_payment,
                nextDate: l.next_payment_date,
              };
              const isSelected = selected?.id === l.id;
              const daysLeft = l.next_payment_date
                ? Math.round((new Date(l.next_payment_date).getTime() - Date.now()) / 86400000)
                : null;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => selectItem(item)}
                  className={`w-full p-3 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${
                    isSelected ? 'border-rose-500 bg-rose-50' : 'border-zinc-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p
                        className={`font-black text-sm ${isSelected ? 'text-rose-800' : 'text-zinc-900'}`}
                      >
                        🏦 {l.lender_name}
                      </p>
                      {l.monthly_payment && (
                        <p className="text-[10px] text-zinc-400 font-bold uppercase mt-0.5">
                          Платёж: {parseFloat(l.monthly_payment).toLocaleString('ru-RU')} ₽/мес
                          {daysLeft !== null && daysLeft <= 7 && (
                            <span
                              className={`ml-2 ${daysLeft < 0 ? 'text-red-500' : 'text-amber-500'}`}
                            >
                              {daysLeft < 0 ? '⚠ просрочен!' : `· через ${daysLeft} дн.`}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-rose-600">
                        {parseFloat(l.remaining_amount).toLocaleString('ru-RU')} ₽
                      </p>
                      <p className="text-[9px] text-zinc-400 font-bold uppercase">остаток</p>
                    </div>
                  </div>
                </button>
              );
            })}

          {/* Поставщики */}
          {suppliers.filter((s) => parseFloat(s.debt) > 0).length > 0 && (
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pt-2">
              Долги поставщикам
            </p>
          )}
          {suppliers
            .filter((s) => parseFloat(s.debt) > 0)
            .map((s) => {
              const item: DebtItem = {
                kind: 'supplier',
                id: s.id,
                name: s.name,
                icon: s.icon,
                debt: s.debt,
              };
              const isSelected = selected?.id === s.id;
              const isExpanded = expandedSupplierId === s.id;
              const txData = supplierTxns.find((t) => t.id === s.id);
              return (
                <div key={s.id} className="space-y-1">
                  <div
                    className={`rounded-xl border-2 transition-all ${
                      isSelected ? 'border-rose-500 bg-rose-50' : 'border-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 p-3">
                      <button
                        type="button"
                        onClick={() => selectItem(item)}
                        className="flex-1 flex justify-between items-center text-left"
                      >
                        <p
                          className={`font-black text-sm ${isSelected ? 'text-rose-800' : 'text-zinc-900'}`}
                        >
                          {s.icon} {s.name}
                        </p>
                        <div className="text-right mr-2">
                          <p className="text-xs font-black text-rose-600">
                            {parseFloat(s.debt).toLocaleString('ru-RU')} ₽
                          </p>
                          <p className="text-[9px] text-zinc-400 font-bold uppercase">долг</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedSupplierId(isExpanded ? null : s.id)}
                        className="shrink-0 w-8 h-8 rounded-lg border border-zinc-200 bg-white flex items-center justify-center text-zinc-500 active:scale-95"
                        title="История транзакций"
                      >
                        <span
                          style={{
                            fontSize: 12,
                            transition: 'transform .2s',
                            display: 'block',
                            transform: isExpanded ? 'rotate(180deg)' : 'none',
                          }}
                        >
                          ▾
                        </span>
                      </button>
                    </div>

                    {/* Transaction history */}
                    {isExpanded && (
                      <div className="border-t border-zinc-100 px-3 pb-3 space-y-2">
                        {/* Pending charges */}
                        {(txData?.pending ?? []).length > 0 && (
                          <div className="pt-2">
                            <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">
                              Начислено (не оплачено)
                            </p>
                            <div className="space-y-1">
                              {txData!.pending.map((t) => (
                                <div
                                  key={t.id}
                                  className="flex justify-between items-center py-1.5 border-b border-zinc-50"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-zinc-700 font-semibold truncate">
                                      {t.description ?? 'Без описания'}
                                    </p>
                                    <p className="text-[9px] text-zinc-400">
                                      {formatDate(t.created_at)}
                                    </p>
                                  </div>
                                  <p className="text-xs font-black text-rose-600 ml-2 shrink-0">
                                    −{parseFloat(t.amount).toLocaleString('ru-RU')} ₽
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Completed payments */}
                        {(txData?.completed ?? []).length > 0 && (
                          <div className="pt-1">
                            <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-1">
                              Оплачено
                            </p>
                            <div className="space-y-1">
                              {txData!.completed.map((t) => (
                                <div
                                  key={t.id}
                                  className="flex justify-between items-center py-1.5 border-b border-zinc-50"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-zinc-700 font-semibold truncate">
                                      {t.description ?? 'Оплата'}
                                    </p>
                                    <p className="text-[9px] text-zinc-400">
                                      {formatDate(t.created_at)}
                                    </p>
                                  </div>
                                  <p className="text-xs font-black text-green-600 ml-2 shrink-0">
                                    {parseFloat(t.amount).toLocaleString('ru-RU')} ₽
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(txData?.pending ?? []).length === 0 &&
                          (txData?.completed ?? []).length === 0 && (
                            <p className="text-center text-zinc-400 text-xs py-3">Транзакций нет</p>
                          )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Форма оплаты после выбора */}
      {selected && (
        <div className="space-y-3 pt-2 border-t border-zinc-100">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
            Оплата: {selected.name}
            {selected.kind === 'loan' && selected.monthly && (
              <span className="text-zinc-300 ml-1">
                · рекомендуемый платёж: {parseFloat(selected.monthly).toLocaleString('ru-RU')} ₽
              </span>
            )}
          </p>

          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full rounded-lg border-2 border-zinc-200 px-4 h-14 text-2xl font-black text-zinc-900 focus:border-rose-500 focus:outline-none"
            onFocus={(e) =>
              setTimeout(
                () => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }),
                300,
              )
            }
          />

          <div className="space-y-1">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
              Списать с
            </label>
            <div className="flex gap-2">
              {WALLET_OPTIONS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWalletId(w.id)}
                  className={`flex-1 py-2.5 rounded-lg border-2 text-xs font-black transition-all active:scale-[0.97] ${
                    walletId === w.id
                      ? 'border-rose-500 bg-rose-50 text-rose-700'
                      : 'border-zinc-200 text-zinc-500'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Комментарий (необязательно)"
            className="w-full rounded-lg border-2 border-zinc-200 px-4 h-11 text-sm font-bold text-zinc-900 focus:border-rose-500 focus:outline-none"
          />
        </div>
      )}

      {error && <p className="text-red-600 text-xs font-bold uppercase">{error}</p>}

      {selected && (
        <button
          onClick={handleSubmit}
          disabled={mutation.isPending}
          className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-white bg-rose-600 active:scale-[0.97] transition-all disabled:opacity-50"
        >
          {mutation.isPending ? 'Проводим...' : '✓ Провести платёж'}
        </button>
      )}
    </div>
  );
}

type PayrollStaff = {
  id: string;
  name: string;
  roles: string[];
  auto_settle: boolean;
  is_management: boolean;
  earned: string;
  paid: string;
  debt: string;
};

const ROLE_LABELS: Record<string, string> = {
  driver: 'Водитель',
  loader: 'Грузчик',
  mechanic: 'Механик',
  mechanic_lead: 'Ст.механик',
  welder: 'Сварщик',
  painter: 'Маляр',
  electrician: 'Электрик',
  handyman: 'Разнорабочий',
  owner: 'Владелец',
  admin: 'Администратор',
};

function SalaryPaymentForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [selected, setSelected] = useState<PayrollStaff | null>(null);
  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState(WALLET_OPTIONS[0]!.id);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const {
    data: staff = [],
    isLoading,
    isError,
    error: queryError,
  } = useQuery<PayrollStaff[]>({
    queryKey: ['admin-payroll', year, month],
    queryFn: async () => {
      const r = await fetch(`/api/admin/payroll?year=${year}&month=${month}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Ошибка сервера');
      return data;
    },
    staleTime: 0,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Не выбран сотрудник');
      const r = await fetch('/api/admin/staff-settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selected.id,
          amount,
          from_wallet_id: walletId,
          description: note || undefined,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? 'Ошибка');
      return json;
    },
    onSuccess,
    onError: (e: Error) => setError(e.message),
  });

  const selectStaff = (s: PayrollStaff) => {
    setSelected(s);
    // Для руководства долга нет — сумму вводят вручную
    setAmount(parseFloat(s.debt) > 0 ? parseFloat(s.debt).toFixed(0) : '');
    setError('');
  };

  const handleSubmit = () => {
    if (!selected) return setError('Выберите сотрудника');
    if (!amount || parseFloat(amount) <= 0) return setError('Введите сумму');
    setError('');
    mutation.mutate();
  };

  const getRoleLabel = (roles: string[]) => {
    for (const r of ['mechanic_lead', 'mechanic', 'loader', 'driver', 'owner', 'admin']) {
      if (roles.includes(r)) return ROLE_LABELS[r] ?? r;
    }
    return roles[0] ?? '—';
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-zinc-100 p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-black uppercase text-sm text-violet-600">💰 Выплата ЗП</h2>
        <button onClick={onClose} className="text-zinc-400 font-bold text-lg">
          ✕
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-zinc-200 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-center py-4 text-red-500 font-bold text-xs uppercase">
          ❌ {(queryError as Error)?.message ?? 'Ошибка загрузки'}
        </p>
      ) : staff.length === 0 ? (
        <p className="text-center py-6 text-zinc-400 font-bold text-xs uppercase">
          Долгов по ЗП нет 🎉
        </p>
      ) : (
        <div className="space-y-2">
          {/* Операционный персонал */}
          {staff.filter((s) => !s.is_management).length > 0 && (
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
              Сотрудники (долг за месяц)
            </label>
          )}
          {staff
            .filter((s) => !s.is_management)
            .map((s) => {
              const isSelected = selected?.id === s.id;
              const hasDebt = parseFloat(s.debt) > 0;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectStaff(s)}
                  className={`w-full p-3 rounded-xl border-2 flex justify-between items-center text-sm font-bold transition-all active:scale-[0.98] ${
                    isSelected
                      ? 'border-violet-500 bg-violet-50 text-violet-900'
                      : 'border-zinc-200 text-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wide text-zinc-400">
                      {getRoleLabel(s.roles)}
                    </span>
                    <span>{s.name}</span>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-black text-xs ${hasDebt ? 'text-rose-600' : 'text-zinc-400'}`}
                    >
                      {parseFloat(s.debt).toLocaleString('ru-RU')} ₽
                    </p>
                    <p className="text-[9px] text-zinc-400 font-bold uppercase">долг</p>
                  </div>
                </button>
              );
            })}

          {/* Руководство */}
          {staff.filter((s) => s.is_management).length > 0 && (
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pt-2 block">
              Руководство (ручная выплата)
            </label>
          )}
          {staff
            .filter((s) => s.is_management)
            .map((s) => {
              const isSelected = selected?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectStaff(s)}
                  className={`w-full p-3 rounded-xl border-2 flex justify-between items-center text-sm font-bold transition-all active:scale-[0.98] ${
                    isSelected
                      ? 'border-violet-500 bg-violet-50 text-violet-900'
                      : 'border-zinc-200 text-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wide text-violet-400">
                      {getRoleLabel(s.roles)}
                    </span>
                    <span>{s.name}</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase">ввести сумму</p>
                </button>
              );
            })}
        </div>
      )}

      {selected && (
        <div className="space-y-3 pt-2 border-t border-zinc-100">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
            Выплата: {selected.name}
            {!selected.is_management && parseFloat(selected.debt) > 0 && (
              <span className="text-rose-400 ml-1 normal-case">
                · долг: {parseFloat(selected.debt).toLocaleString('ru-RU')} ₽
              </span>
            )}
            {selected.is_management && (
              <span className="text-violet-400 ml-1 normal-case">· введите сумму</span>
            )}
          </p>

          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full rounded-lg border-2 border-zinc-200 px-4 h-14 text-2xl font-black text-zinc-900 focus:border-violet-500 focus:outline-none"
            onFocus={(e) =>
              setTimeout(
                () => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }),
                300,
              )
            }
          />

          <div className="space-y-1">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
              Списать с
            </label>
            <div className="flex gap-2">
              {WALLET_OPTIONS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWalletId(w.id)}
                  className={`flex-1 py-2.5 rounded-lg border-2 text-xs font-black transition-all active:scale-[0.97] ${
                    walletId === w.id
                      ? 'border-violet-500 bg-violet-50 text-violet-700'
                      : 'border-zinc-200 text-zinc-500'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Комментарий (необязательно)"
            className="w-full rounded-lg border-2 border-zinc-200 px-4 h-11 text-sm font-bold text-zinc-900 focus:border-violet-500 focus:outline-none"
          />
        </div>
      )}

      {error && <p className="text-red-600 text-xs font-bold uppercase">{error}</p>}

      {selected && (
        <button
          onClick={handleSubmit}
          disabled={mutation.isPending}
          className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-white bg-violet-600 active:scale-[0.97] transition-all disabled:opacity-50"
        >
          {mutation.isPending ? 'Проводим...' : '✓ Выплатить ЗП'}
        </button>
      )}
    </div>
  );
}

const INCOME_CATEGORIES = [
  { id: '74008cf7-0527-4e9f-afd2-d232b8f8125a', name: 'Выручка с рейса', code: 'TRIP_REVENUE' },
  {
    id: '600e7f70-2797-474d-948b-432230036d67',
    name: 'Выручка с ремонта',
    code: 'SERVICE_REVENUE',
  },
  { id: '84562648-767a-47b8-8821-a5c938da6e75', name: 'Продажа актива', code: 'ASSET_SALE' },
  { id: '68225ea2-d7de-4442-8ed8-ce2366b5d369', name: 'Прочий доход', code: 'OTHER_INCOME' },
];

const EXPENSE_CATEGORIES = [
  { id: '62cebf3f-9982-4cc6-904b-48c6169cf5e4', name: 'ГСМ', code: 'FUEL' },
  { id: '9d18370d-3228-4f2a-8530-52b168cfa8d7', name: 'Запчасти', code: 'REPAIR_PARTS' },
  { id: '8c5f3080-d0a8-49ea-b759-3286f2084940', name: 'Сторонний ремонт', code: 'REPAIR_EXTERNAL' },
  { id: 'f4a66f83-63c0-4ba0-8eaa-0d42ce19d3ca', name: 'Налоги / Страховки', code: 'TAX' },
  { id: '73f565eb-f509-4538-9658-9cdff69bee37', name: 'Офис и связь', code: 'OFFICE_COMMS' },
  { id: 'df1022df-4ea6-46fc-b9aa-f3c9eb4e7f30', name: 'Прочий расход', code: 'OTHER_EXPENSE' },
];

const PAYMENT_METHODS = [
  { value: 'cash', label: '💵 Нал' },
  { value: 'bank_transfer', label: '🏦 Безнал' },
  { value: 'card', label: '💳 Карта' },
];

function AddTransactionForm({
  direction,
  onClose,
  onSuccess,
}: {
  direction: 'income' | 'expense';
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const categories = direction === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const mutation = useMutation({
    mutationFn: () =>
      fetch('/api/admin/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction,
          category_id: categoryId,
          amount,
          payment_method: paymentMethod,
          description,
        }),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? 'Ошибка');
        return data;
      }),
    onSuccess,
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = () => {
    if (!categoryId) return setError('Выберите категорию');
    if (!amount || parseFloat(amount) <= 0) return setError('Введите сумму');
    setError('');
    mutation.mutate();
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-zinc-100 p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2
          className={`font-black uppercase text-sm ${direction === 'income' ? 'text-green-600' : 'text-red-500'}`}
        >
          {direction === 'income' ? '➕ Добавить доход' : '➖ Добавить расход'}
        </h2>
        <button onClick={onClose} className="text-zinc-400 font-bold text-lg">
          ✕
        </button>
      </div>

      {/* Категория */}
      <div className="space-y-2">
        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
          Категория
        </label>
        <div className="grid grid-cols-2 gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={`p-3 rounded-lg border-2 text-xs font-bold uppercase tracking-wide text-center transition-all active:scale-[0.97] ${
                categoryId === c.id
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : 'border-zinc-200 text-zinc-600'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Сумма */}
      <div className="space-y-1">
        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
          Сумма, ₽
        </label>
        <input
          type="number"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="w-full rounded-lg border-2 border-zinc-200 px-4 h-14 text-2xl font-black text-zinc-900 focus:border-orange-500 focus:outline-none"
          onFocus={(e) =>
            setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
          }
        />
      </div>

      {/* Способ оплаты */}
      <div className="space-y-2">
        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
          Способ
        </label>
        <div className="flex gap-2">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setPaymentMethod(m.value)}
              className={`flex-1 py-3 rounded-lg border-2 text-xs font-black uppercase tracking-tight transition-all ${
                paymentMethod === m.value
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : 'border-zinc-200 text-zinc-500'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Описание */}
      <div className="space-y-1">
        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
          Описание (необязательно)
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Комментарий..."
          className="w-full rounded-lg border-2 border-zinc-200 px-4 h-12 text-sm font-bold text-zinc-900 focus:border-orange-500 focus:outline-none"
        />
      </div>

      {error && <p className="text-red-600 text-xs font-bold uppercase">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={mutation.isPending}
        className={`w-full h-14 rounded-2xl font-black uppercase tracking-widest text-white active:scale-[0.97] transition-all disabled:opacity-50 ${
          direction === 'income' ? 'bg-green-600' : 'bg-zinc-900'
        }`}
      >
        {mutation.isPending ? 'Сохраняем...' : '✓ Сохранить'}
      </button>
    </div>
  );
}
