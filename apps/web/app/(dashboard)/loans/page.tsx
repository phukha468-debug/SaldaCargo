'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Money } from '@saldacargo/ui';

type Loan = {
  id: string;
  lender_name: string;
  loan_type: 'credit' | 'leasing' | 'borrow';
  purpose: string | null;
  original_amount: string;
  remaining_amount: string;
  annual_rate: string | null;
  monthly_payment: string | null;
  started_at: string;
  ends_at: string | null;
  notes: string | null;
  is_active: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  credit: 'Кредит',
  leasing: 'Лизинг',
  borrow: 'Займ',
};

const TYPE_COLOR: Record<string, string> = {
  credit: 'bg-blue-100 text-blue-700',
  leasing: 'bg-violet-100 text-violet-700',
  borrow: 'bg-amber-100 text-amber-700',
};

const emptyForm = {
  lender_name: '',
  loan_type: 'credit',
  purpose: '',
  original_amount: '',
  remaining_amount: '',
  annual_rate: '',
  monthly_payment: '',
  started_at: '',
  ends_at: '',
  notes: '',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function monthsLeft(endsAt: string | null): number | null {
  if (!endsAt) return null;
  const now = new Date();
  const end = new Date(endsAt);
  const m = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  return Math.max(0, m);
}

function paidPct(original: string, remaining: string): number {
  const orig = parseFloat(original);
  if (!orig) return 0;
  return Math.min(100, Math.max(0, ((orig - parseFloat(remaining)) / orig) * 100));
}

export default function LoansPage() {
  const qc = useQueryClient();
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const { data: loans = [], isLoading } = useQuery<Loan[]>({
    queryKey: ['loans'],
    queryFn: () => fetch('/api/loans').then((r) => r.json()),
    staleTime: 60000,
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof emptyForm) =>
      fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? 'Ошибка');
        return json;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] });
      setShowForm(false);
      setForm(emptyForm);
      setFormError('');
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      fetch(`/api/loans/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? 'Ошибка');
        return json;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] });
      setEditId(null);
      setForm(emptyForm);
      setFormError('');
      setShowForm(false);
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (loan: Loan) => {
    setEditId(loan.id);
    setForm({
      lender_name: loan.lender_name,
      loan_type: loan.loan_type,
      purpose: loan.purpose ?? '',
      original_amount: loan.original_amount,
      remaining_amount: loan.remaining_amount,
      annual_rate: loan.annual_rate ?? '',
      monthly_payment: loan.monthly_payment ?? '',
      started_at: loan.started_at,
      ends_at: loan.ends_at ?? '',
      notes: loan.notes ?? '',
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.lender_name.trim()) {
      setFormError('Введите кредитора');
      return;
    }
    if (!form.original_amount) {
      setFormError('Введите исходную сумму');
      return;
    }
    if (!form.started_at) {
      setFormError('Введите дату начала');
      return;
    }
    if (editId) {
      updateMutation.mutate({ id: editId, body: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleDelete = (loan: Loan) => {
    if (!window.confirm(`Удалить кредит "${loan.lender_name}"? Это действие необратимо.`)) return;
    updateMutation.mutate({ id: loan.id, body: { is_active: false } });
  };

  const handleRestore = (loan: Loan) => {
    updateMutation.mutate({ id: loan.id, body: { is_active: true } });
  };

  const visible = loans.filter((l) => showInactive || l.is_active);

  const totalRemaining = loans
    .filter((l) => l.is_active)
    .reduce((s, l) => s + parseFloat(l.remaining_amount), 0)
    .toFixed(2);

  const totalMonthly = loans
    .filter((l) => l.is_active && l.monthly_payment)
    .reduce((s, l) => s + parseFloat(l.monthly_payment!), 0)
    .toFixed(2);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Кредиты и займы</h1>
        <button
          onClick={openCreate}
          className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
        >
          + Добавить
        </button>
      </div>

      {!isLoading && loans.filter((l) => l.is_active).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Общий долг
            </p>
            <p className="text-2xl font-black text-rose-600">
              <Money amount={totalRemaining} />
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Выплат в месяц
            </p>
            <p className="text-2xl font-black text-amber-600">
              <Money amount={totalMonthly} />
            </p>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-700">
            {editId ? 'Редактировать кредит' : 'Новый кредит / займ'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Кредитор *</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                placeholder="Сбербанк"
                value={form.lender_name}
                onChange={(e) => setForm({ ...form, lender_name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Тип</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                value={form.loan_type}
                onChange={(e) => setForm({ ...form, loan_type: e.target.value })}
              >
                <option value="credit">Кредит</option>
                <option value="leasing">Лизинг</option>
                <option value="borrow">Займ</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Назначение</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                placeholder="Валдай 2022, оборотные средства..."
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Исходная сумма, руб. *
              </label>
              <input
                type="number"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                placeholder="1500000"
                value={form.original_amount}
                onChange={(e) => setForm({ ...form, original_amount: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Остаток на сегодня, руб. *
              </label>
              <input
                type="number"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                placeholder="850000"
                value={form.remaining_amount}
                onChange={(e) => setForm({ ...form, remaining_amount: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Ставка, % годовых
              </label>
              <input
                type="number"
                step="0.1"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                placeholder="14.5"
                value={form.annual_rate}
                onChange={(e) => setForm({ ...form, annual_rate: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Платёж в месяц, руб.
              </label>
              <input
                type="number"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                placeholder="45000"
                value={form.monthly_payment}
                onChange={(e) => setForm({ ...form, monthly_payment: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Дата начала *</label>
              <input
                type="date"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                value={form.started_at}
                onChange={(e) => setForm({ ...form, started_at: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Дата окончания
              </label>
              <input
                type="date"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="text-xs font-medium text-slate-500 block mb-1">Примечание</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                placeholder="Любая дополнительная информация"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          {formError && <p className="text-xs text-rose-600 font-medium">{formError}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setEditId(null);
                setFormError('');
              }}
              className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg border border-slate-200 transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end">
        <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="accent-slate-700"
          />
          Показать закрытые
        </label>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <p className="text-4xl mb-3">🏦</p>
          <p className="font-medium text-slate-500">Кредитов нет</p>
          <p className="text-sm text-slate-400 mt-1">Нажмите «+ Добавить» чтобы внести первый</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              onEdit={() => openEdit(loan)}
              onDelete={() => handleDelete(loan)}
              onRestore={() => handleRestore(loan)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LoanCard({
  loan,
  onEdit,
  onDelete,
  onRestore,
}: {
  loan: Loan;
  onEdit: () => void;
  onDelete: () => void;
  onRestore: () => void;
}) {
  const pct = paidPct(loan.original_amount, loan.remaining_amount);
  const months = monthsLeft(loan.ends_at);
  const paid = (parseFloat(loan.original_amount) - parseFloat(loan.remaining_amount)).toFixed(2);

  return (
    <div
      className={`bg-white border border-slate-200 rounded-lg shadow-sm p-5 transition-opacity${!loan.is_active ? ' opacity-50' : ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold text-slate-900">{loan.lender_name}</span>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${TYPE_COLOR[loan.loan_type]}`}
            >
              {TYPE_LABEL[loan.loan_type]}
            </span>
            {!loan.is_active && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">
                Закрыт
              </span>
            )}
          </div>
          {loan.purpose && <p className="text-sm text-slate-500 mb-3">{loan.purpose}</p>}

          <div className="mb-3">
            <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
              <span>Выплачено {pct.toFixed(0)}%</span>
              <span>Остаток</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-emerald-600 font-bold">
                <Money amount={paid} />
              </span>
              <span className="text-xs text-rose-600 font-bold">
                <Money amount={loan.remaining_amount} />
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            {loan.annual_rate && (
              <span>
                <span className="font-bold text-slate-700">{loan.annual_rate}%</span> годовых
              </span>
            )}
            {loan.monthly_payment && (
              <span>
                Платёж:{' '}
                <span className="font-bold text-slate-700">
                  <Money amount={loan.monthly_payment} />
                </span>
                /мес
              </span>
            )}
            <span>
              С {fmtDate(loan.started_at)}
              {loan.ends_at && ` по ${fmtDate(loan.ends_at)}`}
            </span>
            {months !== null && (
              <span className={months <= 3 ? 'font-bold text-amber-600' : ''}>
                {months === 0 ? 'Срок истёк' : `${months} мес. осталось`}
              </span>
            )}
          </div>

          {loan.notes && <p className="text-xs text-slate-400 italic mt-2">{loan.notes}</p>}
        </div>

        <div className="flex flex-col items-end gap-3 shrink-0">
          <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Исходная</p>
            <p className="text-sm font-bold text-slate-500">
              <Money amount={loan.original_amount} />
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="text-xs text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded border border-slate-200 hover:border-slate-300 transition-colors"
            >
              Изменить
            </button>
            {loan.is_active ? (
              <button
                onClick={onDelete}
                className="text-xs text-slate-400 hover:text-rose-600 px-3 py-1.5 rounded border border-slate-200 hover:border-rose-200 transition-colors"
              >
                Удалить
              </button>
            ) : (
              <button
                onClick={onRestore}
                className="text-xs text-emerald-600 hover:text-emerald-700 px-3 py-1.5 rounded border border-emerald-200 hover:border-emerald-300 transition-colors"
              >
                Восстановить
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
