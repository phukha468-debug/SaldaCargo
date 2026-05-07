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
  const [showForm, setShowForm] = useState<'income' | 'expense' | null>(
    initialAction === 'income' ? 'income' : initialAction === 'expense' ? 'expense' : null,
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
              className="bg-green-600 text-white rounded-2xl p-5 flex flex-col items-center gap-2 active:scale-[0.97] transition-all shadow-sm"
            >
              <span className="text-2xl">➕</span>
              <span className="text-xs font-black uppercase tracking-widest">Доход</span>
            </button>
            <button
              onClick={() => setShowForm('expense')}
              className="bg-zinc-800 text-white rounded-2xl p-5 flex flex-col items-center gap-2 active:scale-[0.97] transition-all shadow-sm"
            >
              <span className="text-2xl">➖</span>
              <span className="text-xs font-black uppercase tracking-widest">Расход</span>
            </button>
          </div>
        )}

        {/* Форма добавления */}
        {showForm && (
          <AddTransactionForm
            direction={showForm}
            onClose={() => setShowForm(null)}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
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

const INCOME_CATEGORIES = [
  { id: '74008cf7-0527-4e9f-afd2-d232b8f8125a', name: 'Выручка с рейса', code: 'TRIP_REVENUE' },
  {
    id: '600e7f70-2797-474d-948b-432230036d67',
    name: 'Выручка с ремонта',
    code: 'SERVICE_REVENUE',
  },
  { id: '68225ea2-d7de-4442-8ed8-ce2366b5d369', name: 'Прочий доход', code: 'OTHER_INCOME' },
];

const EXPENSE_CATEGORIES = [
  { id: '62cebf3f-9982-4cc6-904b-48c6169cf5e4', name: 'ГСМ', code: 'FUEL' },
  { id: '9d18370d-3228-4f2a-8530-52b168cfa8d7', name: 'Запчасти', code: 'REPAIR_PARTS' },
  { id: '59ef1110-6c3f-49c7-a29c-b9e97a3a3d92', name: 'Аренда', code: 'RENT' },
  { id: 'f4a66f83-63c0-4ba0-8eaa-0d42ce19d3ca', name: 'Налоги', code: 'TAX' },
  { id: '73f565eb-f509-4538-9658-9cdff69bee37', name: 'Офис и связь', code: 'OFFICE_COMMS' },
  { id: '992ed3ae-66a7-4a16-a2da-cecd9b7086c5', name: 'Страховка', code: 'INSURANCE' },
  { id: '8c5f3080-d0a8-49ea-b759-3286f2084940', name: 'Сторонний ремонт', code: 'REPAIR_EXTERNAL' },
  { id: 'd79213ee-3bc6-4433-b58a-ca7ea1040d00', name: 'ЗП водителя', code: 'PAYROLL_DRIVER' },
  { id: '18792fa8-fda8-472d-8e04-e19d2c6c053c', name: 'ЗП грузчика', code: 'PAYROLL_LOADER' },
  { id: '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6', name: 'ЗП механика', code: 'PAYROLL_MECHANIC' },
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
