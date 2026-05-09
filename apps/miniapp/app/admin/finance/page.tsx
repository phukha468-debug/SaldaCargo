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
  const [showForm, setShowForm] = useState<'income' | 'expense' | 'collection' | 'debts' | null>(
    initialAction === 'income'
      ? 'income'
      : initialAction === 'expense'
        ? 'expense'
        : initialAction === 'collection'
          ? 'collection'
          : initialAction === 'debts'
            ? 'debts'
            : null,
  );
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading } = useQuery<any[]>({
    queryKey: ['admin-transactions'],
    queryFn: () => fetch('/api/admin/transactions').then((r) => r.json()),
    staleTime: 15000,
  });

  return (
    <div>
      <header className="bg-white border-b-2 border-zinc-200 px-4 h-16 flex items-center sticky top-0 z-40">
        <h1 className="font-black text-zinc-900 text-lg uppercase tracking-tight">Финансы</h1>
      </header>

      <div className="p-4 space-y-4">
        {/* Кнопки добавления */}
        {!showForm && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowForm('income')}
              className="bg-green-600 text-white rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-all shadow-sm"
            >
              <span className="text-xl">➕</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Доход</span>
            </button>
            <button
              onClick={() => setShowForm('expense')}
              className="bg-zinc-800 text-white rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-all shadow-sm"
            >
              <span className="text-xl">➖</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Расход</span>
            </button>
            <button
              onClick={() => setShowForm('debts')}
              className="bg-rose-600 text-white rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-all shadow-sm"
            >
              <span className="text-xl">💳</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Долги</span>
            </button>
            <button
              onClick={() => setShowForm('collection')}
              className="bg-blue-600 text-white rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-all shadow-sm"
            >
              <span className="text-xl">💼</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Инкасс.</span>
            </button>
          </div>
        )}

        {/* Форма добавления транзакции */}
        {(showForm === 'income' || showForm === 'expense') && (
          <AddTransactionForm
            direction={showForm}
            onClose={() => setShowForm(null)}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
              setShowForm(null);
            }}
          />
        )}

        {/* Форма оплаты долгов */}
        {showForm === 'debts' && (
          <DebtPaymentForm
            onClose={() => setShowForm(null)}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
              setShowForm(null);
            }}
          />
        )}

        {/* Форма инкассации */}
        {showForm === 'collection' && (
          <CashCollectionForm
            onClose={() => setShowForm(null)}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['admin-cash-balances'] });
              setShowForm(null);
            }}
          />
        )}

        {/* История */}
        {!showForm && (
          <section className="space-y-3">
            <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
              Последние операции
            </h2>
            {isLoading ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-zinc-200 rounded-xl" />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-center py-10 text-zinc-400 font-bold uppercase text-xs">
                Операций нет
              </p>
            ) : (
              transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-white rounded-xl border border-zinc-100 p-4 flex justify-between items-center shadow-sm"
                >
                  <div>
                    <p className="font-bold text-zinc-900 text-sm">
                      {tx.category?.name ?? tx.description ?? '—'}
                    </p>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase mt-0.5">
                      {tx.direction === 'income' ? '📈 Доход' : '📉 Расход'} ·{' '}
                      {formatDate(tx.created_at)}
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
  const [walletId, setWalletId] = useState(WALLET_OPTIONS[0].id);
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
        <h2 className="font-black uppercase text-sm text-rose-600">💳 Оплата долгов</h2>
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
  { id: '59ef1110-6c3f-49c7-a29c-b9e97a3a3d92', name: 'Аренда', code: 'RENT' },
  { id: 'f4a66f83-63c0-4ba0-8eaa-0d42ce19d3ca', name: 'Налоги', code: 'TAX' },
  { id: '73f565eb-f509-4538-9658-9cdff69bee37', name: 'Офис и связь', code: 'OFFICE_COMMS' },
  { id: '992ed3ae-66a7-4a16-a2da-cecd9b7086c5', name: 'Страховка', code: 'INSURANCE' },
  { id: 'd79213ee-3bc6-4433-b58a-ca7ea1040d00', name: 'ЗП водителя', code: 'PAYROLL_DRIVER' },
  { id: '18792fa8-fda8-472d-8e04-e19d2c6c053c', name: 'ЗП грузчика', code: 'PAYROLL_LOADER' },
  { id: '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6', name: 'ЗП механика', code: 'PAYROLL_MECHANIC' },
  { id: 'c88b4234-2a91-4223-aad4-56f6e1ab4ded', name: 'Амортизация', code: 'DEPRECIATION' },
  { id: '63babd3d-b1d3-4710-86e2-5d1ff348b21f', name: 'Списание актива', code: 'ASSET_WRITE_OFF' },
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
