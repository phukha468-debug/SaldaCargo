/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
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
    | 'collection'
    | 'debts'
    | 'salary'
    | 'receivables'
    | null
  >(
    initialAction === 'income'
      ? 'income'
      : initialAction === 'expense'
        ? 'expense'
        : initialAction === 'collection'
          ? 'collection'
          : initialAction === 'debts'
            ? 'debts'
            : initialAction === 'salary'
              ? 'salary'
              : initialAction === 'receivables'
                ? 'receivables'
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

  return (
    <div>
      <header className="bg-white border-b-2 border-zinc-200 px-4 h-16 flex items-center sticky top-0 z-40">
        <h1 className="font-black text-zinc-900 text-lg uppercase tracking-tight">Финансы</h1>
      </header>

      <div className="p-4 space-y-4">
        {/* Главный экран — 2 кнопки */}
        {!showForm && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowForm('income_menu')}
              className="bg-green-600 text-white rounded-2xl p-5 flex flex-col items-center gap-2 active:scale-[0.97] transition-all shadow-sm"
            >
              <span className="text-2xl">➕</span>
              <span className="text-[11px] font-black uppercase tracking-widest">Доход</span>
            </button>
            <button
              onClick={() => setShowForm('expense_menu')}
              className="bg-zinc-800 text-white rounded-2xl p-5 flex flex-col items-center gap-2 active:scale-[0.97] transition-all shadow-sm"
            >
              <span className="text-2xl">➖</span>
              <span className="text-[11px] font-black uppercase tracking-widest">Расход</span>
            </button>
          </div>
        )}

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
              <button
                onClick={() => setShowForm('collection')}
                className="bg-blue-600 text-white rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-all shadow-sm"
              >
                <span className="text-xl">💼</span>
                <span className="text-[10px] font-black uppercase tracking-widest">Инкасс.</span>
              </button>
              <button
                onClick={() => setShowForm('receivables')}
                className="col-span-2 bg-orange-500 text-white rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-all shadow-sm"
              >
                <span className="text-xl">📋</span>
                <span className="text-[10px] font-black uppercase tracking-widest">Дебиторка</span>
              </button>
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
                onClick={() => setShowForm('debts')}
                className="bg-rose-600 text-white rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-all shadow-sm"
              >
                <span className="text-xl">💳</span>
                <span className="text-[10px] font-black uppercase tracking-widest">Кредиты</span>
              </button>
              <button
                onClick={() => setShowForm('salary')}
                className="col-span-2 bg-violet-600 text-white rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-all shadow-sm"
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

        {/* Форма инкассации */}
        {showForm === 'collection' && (
          <CashCollectionForm
            onClose={() => setShowForm('income_menu')}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['admin-cash-balances'] });
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

        {/* Форма погашения дебиторки */}
        {showForm === 'receivables' && (
          <ReceivablesForm
            onClose={() => setShowForm('income_menu')}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
              queryClient.invalidateQueries({ queryKey: ['admin-receivables'] });
              setShowForm(null);
            }}
          />
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
              transactions.map((tx: any) => (
                <div
                  key={tx.id}
                  className="bg-white rounded-xl border border-zinc-100 px-4 py-3 flex justify-between items-center shadow-sm"
                >
                  <div>
                    <p className="font-bold text-zinc-900 text-sm">
                      {tx.category?.name ?? tx.description ?? '—'}
                    </p>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase mt-0.5">
                      {tx.direction === 'income' ? '📈' : '📉'}{' '}
                      {new Date(tx.created_at).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <Money
                    amount={tx.amount}
                    className={`font-black text-sm ${tx.direction === 'income' ? 'text-green-600' : 'text-red-500'}`}
                  />
                </div>
              ))
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function CashCollectionForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedDriver, setSelectedDriver] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const {
    data: balances = [],
    isLoading,
    isError,
    error: queryError,
  } = useQuery<any[]>({
    queryKey: ['admin-cash-balances'],
    queryFn: async () => {
      const r = await fetch('/api/admin/cash-collections');
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Ошибка сервера');
      if (!Array.isArray(data)) throw new Error('Неверный ответ сервера');
      return data;
    },
    staleTime: 0,
  });

  const mutation = useMutation({
    mutationFn: () =>
      fetch('/api/admin/cash-collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: selectedDriver, amount, note }),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? 'Ошибка');
        return data;
      }),
    onSuccess,
    onError: (e: Error) => setError(e.message),
  });

  const selectedBalance = balances.find((d: any) => d.driver_id === selectedDriver);

  const handleSubmit = () => {
    if (!selectedDriver) return setError('Выберите водителя');
    if (!amount || parseFloat(amount) <= 0) return setError('Введите сумму');
    setError('');
    mutation.mutate();
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-zinc-100 p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-black uppercase text-sm text-blue-600">💼 Инкассация</h2>
        <button onClick={onClose} className="text-zinc-400 font-bold text-lg">
          ✕
        </button>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-12 bg-zinc-200 rounded-lg" />
          <div className="h-12 bg-zinc-200 rounded-lg" />
        </div>
      ) : isError ? (
        <p className="text-center py-4 text-red-500 font-bold text-xs uppercase">
          ❌ {(queryError as Error)?.message ?? 'Ошибка загрузки'}
        </p>
      ) : balances.length === 0 ? (
        <p className="text-center py-4 text-zinc-400 font-bold text-xs uppercase">
          Нет данных по водителям
        </p>
      ) : (
        <>
          {/* Водители с подотчётом */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
              Водитель (подотчёт)
            </label>
            <div className="space-y-2">
              {balances.map((d: any) => (
                <button
                  key={d.driver_id}
                  type="button"
                  onClick={() => {
                    setSelectedDriver(d.driver_id);
                    setAmount(parseFloat(d.balance) > 0 ? d.balance : '');
                  }}
                  className={`w-full p-3 rounded-lg border-2 flex justify-between items-center text-sm font-bold transition-all active:scale-[0.97] ${
                    selectedDriver === d.driver_id
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-zinc-200 text-zinc-700'
                  }`}
                >
                  <span>{d.driver_name}</span>
                  <Money
                    amount={d.balance}
                    className={
                      parseFloat(d.balance) > 0
                        ? 'font-black text-orange-600'
                        : 'font-bold text-zinc-400'
                    }
                  />
                </button>
              ))}
            </div>
          </div>

          {selectedDriver && (
            <>
              {/* Сумма */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                  Сумма инкассации, ₽
                  {selectedBalance && (
                    <span className="ml-2 text-orange-600 normal-case">
                      (подотчёт: {parseFloat(selectedBalance.balance).toLocaleString('ru-RU')} ₽)
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border-2 border-zinc-200 px-4 h-14 text-2xl font-black text-zinc-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Заметка */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                  Заметка (необязательно)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Комментарий..."
                  className="w-full rounded-lg border-2 border-zinc-200 px-4 h-12 text-sm font-bold text-zinc-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </>
          )}

          {error && <p className="text-red-600 text-xs font-bold uppercase">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={mutation.isPending || !selectedDriver}
            className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-white bg-blue-600 active:scale-[0.97] transition-all disabled:opacity-50"
          >
            {mutation.isPending ? 'Сохраняем...' : '✓ Провести инкассацию'}
          </button>
        </>
      )}
    </div>
  );
}

const WALLET_OPTIONS = [
  { id: '10000000-0000-0000-0000-000000000001', label: '🏦 Расчётный счёт' },
  { id: '10000000-0000-0000-0000-000000000002', label: '💵 Сейф (Наличные)' },
  { id: '10000000-0000-0000-0000-000000000003', label: '💳 Карта' },
];

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

function DebtPaymentForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [selected, setSelected] = useState<DebtItem | null>(null);
  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState(WALLET_OPTIONS[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

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
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectItem(item)}
                  className={`w-full p-3 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${
                    isSelected ? 'border-rose-500 bg-rose-50' : 'border-zinc-200'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <p
                      className={`font-black text-sm ${isSelected ? 'text-rose-800' : 'text-zinc-900'}`}
                    >
                      {s.icon} {s.name}
                    </p>
                    <div className="text-right">
                      <p className="text-xs font-black text-rose-600">
                        {parseFloat(s.debt).toLocaleString('ru-RU')} ₽
                      </p>
                      <p className="text-[9px] text-zinc-400 font-bold uppercase">долг</p>
                    </div>
                  </div>
                </button>
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
  earned: string;
  paid: string;
  debt: string;
};

const ROLE_LABELS: Record<string, string> = {
  driver: 'Водитель',
  loader: 'Грузчик',
  mechanic: 'Механик',
  mechanic_lead: 'Ст.механик',
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
    for (const r of ['mechanic_lead', 'mechanic', 'loader', 'driver']) {
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
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
            Сотрудник (долг за месяц)
          </label>
          {staff.map((s) => {
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
        </div>
      )}

      {selected && (
        <div className="space-y-3 pt-2 border-t border-zinc-100">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
            Выплата: {selected.name}
            {parseFloat(selected.debt) > 0 && (
              <span className="text-rose-400 ml-1 normal-case">
                · долг: {parseFloat(selected.debt).toLocaleString('ru-RU')} ₽
              </span>
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

const FOLLOW_UP_STATUS_LABELS: Record<string, string> = {
  active: 'В работе',
  promised: 'Обещание',
  disputed: 'Оспаривает',
  bad_debt: 'Безнадёжный',
};

const FOLLOW_UP_STATUS_COLORS: Record<string, string> = {
  active: 'border-amber-400 bg-amber-50 text-amber-800',
  promised: 'border-blue-400 bg-blue-50 text-blue-800',
  disputed: 'border-zinc-300 bg-zinc-50 text-zinc-600',
  bad_debt: 'border-red-400 bg-red-50 text-red-700',
};

function ReceivablesForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [selectedDebtorId, setSelectedDebtorId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ReceivableOrder | null>(null);
  const [showFollowUpId, setShowFollowUpId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  // Follow-up form state
  const [fuStatus, setFuStatus] = useState<string>('active');
  const [fuPromiseDate, setFuPromiseDate] = useState('');
  const [fuNextContact, setFuNextContact] = useState('');
  const [fuNotes, setFuNotes] = useState('');
  const [fuSaving, setFuSaving] = useState(false);
  const [fuError, setFuError] = useState('');

  const {
    data,
    isLoading,
    isError,
    error: queryError,
  } = useQuery<{ debtors: Debtor[]; totalAmount: string }>({
    queryKey: ['admin-receivables'],
    queryFn: async () => {
      const r = await fetch('/api/admin/receivables');
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? 'Ошибка сервера');
      return json;
    },
    staleTime: 0,
  });

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrder) throw new Error('Не выбран заказ');
      const r = await fetch('/api/admin/receivables/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedOrder.id,
          type: selectedOrder.type,
          note: note || undefined,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? 'Ошибка');
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-receivables'] });
      setSelectedOrder(null);
      setNote('');
      setError('');
      onSuccess();
    },
    onError: (e: Error) => setError(e.message),
  });

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
      queryClient.invalidateQueries({ queryKey: ['admin-receivables'] });
      setShowFollowUpId(null);
    } catch (e: unknown) {
      setFuError(e instanceof Error ? e.message : String(e));
    } finally {
      setFuSaving(false);
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

  const debtors = data?.debtors ?? [];
  const selectedDebtor = debtors.find((d) => d.counterparty_id === selectedDebtorId) ?? null;

  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    qr: '📱 QR / Р/С',
    card_driver: '💳 На карту',
    debt_cash: '⏳ Долг нал',
    cash: '💵 Нал',
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-zinc-100 p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-black uppercase text-sm text-orange-600">📋 Дебиторка</h2>
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
      ) : debtors.length === 0 ? (
        <p className="text-center py-6 text-zinc-400 font-bold text-xs uppercase">Долгов нет 🎉</p>
      ) : (
        <div className="space-y-2">
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
            Должники · итого {parseFloat(data?.totalAmount ?? '0').toLocaleString('ru-RU')} ₽
          </label>
          {debtors.map((d) => {
            const isSelected = selectedDebtorId === d.counterparty_id;
            const fu = d.follow_up;
            const isReal = !d.is_individual && !String(d.counterparty_id).startsWith('__');
            const today = new Date().toISOString().split('T')[0];
            const promiseOverdue = fu?.promise_date && fu.promise_date < today;

            return (
              <div key={d.counterparty_id}>
                {/* Debtor header */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDebtorId(isSelected ? null : d.counterparty_id);
                    setSelectedOrder(null);
                    setShowFollowUpId(null);
                    setError('');
                  }}
                  className={`w-full p-3 rounded-xl border-2 flex justify-between items-start text-sm font-bold transition-all active:scale-[0.98] ${
                    isSelected
                      ? 'border-orange-500 bg-orange-50 text-orange-900'
                      : 'border-zinc-200 text-zinc-700'
                  }`}
                >
                  <div className="text-left">
                    <p>{d.counterparty_name}</p>
                    {d.is_individual && d.counterparty_subname && (
                      <p className="text-[9px] text-zinc-400 font-bold uppercase mt-0.5">
                        {d.counterparty_subname}
                      </p>
                    )}
                    {fu && (
                      <p
                        className={`text-[9px] font-bold uppercase mt-0.5 ${promiseOverdue ? 'text-red-500' : 'text-zinc-400'}`}
                      >
                        {promiseOverdue
                          ? `⚠ Обещание просрочено`
                          : FOLLOW_UP_STATUS_LABELS[fu.status]}
                        {fu.promise_date &&
                          !promiseOverdue &&
                          ` · ${new Date(fu.promise_date + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-black text-xs text-orange-600">
                      {parseFloat(d.total).toLocaleString('ru-RU')} ₽
                    </p>
                    <p className="text-[9px] text-zinc-400 font-bold uppercase">
                      {d.orders.length} {d.orders.length === 1 ? 'запись' : 'записи'}
                    </p>
                  </div>
                </button>

                {isSelected && (
                  <div className="mt-1 ml-2 space-y-2">
                    {/* Follow-up controls — only for real counterparties */}
                    {isReal && (
                      <div>
                        {showFollowUpId === d.counterparty_id ? (
                          /* Follow-up form */
                          <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 space-y-3">
                            <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">
                              📞 Фиксация звонка
                            </p>

                            {/* Status buttons */}
                            <div className="grid grid-cols-2 gap-1.5">
                              {Object.entries(FOLLOW_UP_STATUS_LABELS).map(([key, label]) => (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => setFuStatus(key)}
                                  className={`py-2 rounded-lg border-2 text-[10px] font-black uppercase tracking-wide transition-all active:scale-[0.97] ${
                                    fuStatus === key
                                      ? FOLLOW_UP_STATUS_COLORS[key]
                                      : 'border-zinc-200 text-zinc-500 bg-white'
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>

                            {/* Promise date — only when promised */}
                            {fuStatus === 'promised' && (
                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                                  Обещает оплатить
                                </label>
                                <input
                                  type="date"
                                  value={fuPromiseDate}
                                  onChange={(e) => setFuPromiseDate(e.target.value)}
                                  className="w-full rounded-lg border-2 border-zinc-200 bg-white px-3 h-11 text-sm font-bold text-zinc-900 focus:border-blue-500 focus:outline-none"
                                />
                              </div>
                            )}

                            {/* Next contact */}
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                                Следующий звонок
                              </label>
                              <input
                                type="date"
                                value={fuNextContact}
                                onChange={(e) => setFuNextContact(e.target.value)}
                                className="w-full rounded-lg border-2 border-zinc-200 bg-white px-3 h-11 text-sm font-bold text-zinc-900 focus:border-blue-500 focus:outline-none"
                              />
                            </div>

                            {/* Notes */}
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                                Заметка
                              </label>
                              <input
                                type="text"
                                value={fuNotes}
                                onChange={(e) => setFuNotes(e.target.value)}
                                placeholder="Итог разговора..."
                                className="w-full rounded-lg border-2 border-zinc-200 bg-white px-3 h-11 text-sm font-bold text-zinc-900 focus:border-blue-500 focus:outline-none"
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
                                onClick={() => handleFollowUpSave(d.counterparty_id)}
                                disabled={fuSaving}
                                className="flex-1 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest text-white bg-blue-600 active:scale-[0.97] disabled:opacity-50"
                              >
                                {fuSaving ? '...' : '✓ Сохранить'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Follow-up summary + open button */
                          <div className="flex items-center justify-between px-1 py-1.5">
                            <div>
                              {fu ? (
                                <div>
                                  <p
                                    className={`text-[10px] font-black uppercase ${promiseOverdue ? 'text-red-500' : 'text-zinc-400'}`}
                                  >
                                    {FOLLOW_UP_STATUS_LABELS[fu.status]}
                                    {fu.notes &&
                                      ` · «${fu.notes.slice(0, 30)}${fu.notes.length > 30 ? '…' : ''}»`}
                                  </p>
                                  {fu.next_contact_at && (
                                    <p className="text-[9px] text-blue-500 font-bold">
                                      Позвонить:{' '}
                                      {new Date(
                                        fu.next_contact_at + 'T12:00:00',
                                      ).toLocaleDateString('ru-RU', {
                                        day: 'numeric',
                                        month: 'short',
                                      })}
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
                              onClick={() => openFollowUp(d)}
                              className="px-3 py-2 rounded-lg border-2 border-blue-200 text-blue-600 text-[10px] font-black uppercase tracking-wide active:scale-[0.97] bg-blue-50"
                            >
                              📞 Звонок
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Phone button */}
                    {d.counterparty_phone && (
                      <a
                        href={`tel:${d.counterparty_phone}`}
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-zinc-200 text-zinc-700 text-xs font-black uppercase tracking-wide active:scale-[0.97]"
                      >
                        📲 Позвонить {d.counterparty_phone}
                      </a>
                    )}

                    {/* Orders list */}
                    {selectedDebtor?.orders.map((order) => {
                      const isOrderSelected = selectedOrder?.id === order.id;
                      return (
                        <div key={order.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrder(isOrderSelected ? null : order);
                              setError('');
                            }}
                            className={`w-full p-3 rounded-lg border-2 flex justify-between items-center text-xs font-bold transition-all active:scale-[0.98] ${
                              isOrderSelected
                                ? 'border-orange-400 bg-orange-50 text-orange-800'
                                : 'border-zinc-100 text-zinc-600 bg-zinc-50'
                            }`}
                          >
                            <div className="text-left">
                              {order.type === 'manual' ? (
                                <p className="font-black text-blue-600">Ист. долг</p>
                              ) : order.trip_number ? (
                                <p className="font-black text-zinc-700">
                                  Рейс №{order.trip_number}
                                </p>
                              ) : null}
                              <p className="text-[10px] text-zinc-400 uppercase">
                                {order.payment_method
                                  ? (PAYMENT_METHOD_LABELS[order.payment_method] ??
                                    order.payment_method)
                                  : 'Ручная запись'}
                                {' · '}
                                {formatDate(order.created_at)}
                                {order.driver_name ? ` · ${order.driver_name}` : ''}
                              </p>
                              {order.description && (
                                <p className="text-[9px] text-zinc-400 mt-0.5">
                                  {order.description}
                                </p>
                              )}
                            </div>
                            <p className="font-black text-orange-600">
                              {parseFloat(order.amount).toLocaleString('ru-RU')} ₽
                            </p>
                          </button>

                          {isOrderSelected && (
                            <div className="mt-2 ml-2 p-3 bg-orange-50 rounded-lg border border-orange-200 space-y-3">
                              {order.type !== 'manual' && (
                                <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                                  {order.payment_method === 'qr' && '→ 🏦 Расчётный счёт'}
                                  {order.payment_method === 'card_driver' && '→ 💳 Карта'}
                                  {order.payment_method === 'debt_cash' && '→ 💵 Сейф (Наличные)'}
                                </div>
                              )}
                              {order.type === 'manual' && (
                                <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                                  → 💵 Сейф (Наличные)
                                </div>
                              )}
                              <input
                                type="text"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Комментарий (необязательно)"
                                className="w-full rounded-lg border-2 border-zinc-200 bg-white px-3 h-11 text-sm font-bold text-zinc-900 focus:border-orange-500 focus:outline-none"
                              />
                              {error && (
                                <p className="text-red-600 text-xs font-bold uppercase">{error}</p>
                              )}
                              <button
                                onClick={() => mutation.mutate()}
                                disabled={mutation.isPending}
                                className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-white bg-orange-500 active:scale-[0.97] transition-all disabled:opacity-50"
                              >
                                {mutation.isPending
                                  ? 'Проводим...'
                                  : `✓ Погасить ${parseFloat(order.amount).toLocaleString('ru-RU')} ₽`}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
  { id: 'f4a66f83-63c0-4ba0-8eaa-0d42ce19d3ca', name: 'Налоги', code: 'TAX' },
  { id: '73f565eb-f509-4538-9658-9cdff69bee37', name: 'Офис и связь', code: 'OFFICE_COMMS' },
  { id: '992ed3ae-66a7-4a16-a2da-cecd9b7086c5', name: 'Страховка', code: 'INSURANCE' },
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
