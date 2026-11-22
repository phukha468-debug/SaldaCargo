'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Money, cn } from '@saldacargo/ui';
import type { PayrollUser } from './types';

export function AddStaffDebtModal({
  allUsers,
  initialUserId,
  initialAction = 'add',
  onClose,
  onSuccess,
}: {
  allUsers: PayrollUser[];
  initialUserId?: string;
  initialAction?: 'add' | 'repay' | 'adjust';
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [action, setAction] = useState<'add' | 'repay' | 'adjust'>(initialAction);
  const [userId, setUserId] = useState(initialUserId || (allUsers[0]?.id ?? ''));
  const selectedUser = allUsers.find((u) => u.id === userId);
  const currentDebt = selectedUser ? parseFloat(selectedUser.advance_balance ?? '0') : 0;

  const [amount, setAmount] = useState(initialAction === 'adjust' ? currentDebt.toFixed(0) : '');
  const [walletId, setWalletId] = useState('none');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      fetch('/api/staff/debt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          user_id: userId,
          ...(action === 'adjust'
            ? { target_amount: parseFloat(amount.replace(',', '.')).toFixed(2) }
            : { amount: parseFloat(amount.replace(',', '.')).toFixed(2) }),
          ...(action === 'add'
            ? { from_wallet_id: walletId }
            : action === 'repay'
              ? { to_wallet_id: walletId }
              : {}),
          note: note.trim() || undefined,
        }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Ошибка');
        return d;
      }),
    onSuccess,
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = () => {
    if (!userId) {
      setError('Выберите сотрудника');
      return;
    }
    const val = parseFloat(amount.replace(',', '.'));
    if (isNaN(val) || val < 0) {
      setError('Введите корректную сумму');
      return;
    }
    setError('');
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">
              {action === 'add'
                ? '💳 Записать долг сотруднику'
                : action === 'repay'
                  ? '📥 Погашение долга сотрудником'
                  : '✏️ Редактирование суммы долга'}
            </h2>
            <p className="text-xs text-slate-500">Учёт авансов и внутренних займов</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setAction('add');
                setAmount('');
              }}
              className={cn(
                'flex-1 py-2 text-[11px] font-bold rounded-lg transition-all',
                action === 'add'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800',
              )}
            >
              + Записать
            </button>
            <button
              type="button"
              onClick={() => {
                setAction('repay');
                setAmount('');
              }}
              className={cn(
                'flex-1 py-2 text-[11px] font-bold rounded-lg transition-all',
                action === 'repay'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800',
              )}
            >
              ✓ Погашение
            </button>
            <button
              type="button"
              onClick={() => {
                setAction('adjust');
                setAmount(currentDebt.toFixed(0));
              }}
              className={cn(
                'flex-1 py-2 text-[11px] font-bold rounded-lg transition-all',
                action === 'adjust'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800',
              )}
            >
              ✏️ Задать долг
            </button>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Сотрудник *</label>
            <select
              value={userId}
              onChange={(e) => {
                const id = e.target.value;
                setUserId(id);
                const u = allUsers.find((x) => x.id === id);
                if (action === 'adjust' && u) {
                  setAmount(parseFloat(u.advance_balance ?? '0').toFixed(0));
                }
              }}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
              {allUsers.map((u) => {
                const adv = parseFloat(u.advance_balance ?? '0');
                return (
                  <option key={u.id} value={u.id}>
                    {u.name} {adv > 0 ? `(Долг: ${adv.toLocaleString('ru-RU')} ₽)` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {currentDebt > 0 && action !== 'adjust' && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5 flex justify-between items-center">
              <span className="text-xs text-violet-700 font-medium">Текущий долг сотрудника:</span>
              <span className="text-sm font-black text-violet-800">
                <Money amount={currentDebt.toFixed(2)} />
              </span>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              {action === 'add'
                ? 'Сумма выдачи/долга, ₽ *'
                : action === 'repay'
                  ? 'Сумма погашения, ₽ *'
                  : 'Новый целевой баланс долга, ₽ *'}
            </label>
            <input
              autoFocus
              type="number"
              min="0"
              step="500"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
              placeholder="0"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-lg font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            {action === 'adjust' && (
              <p className="text-[11px] text-slate-500 mt-1">
                Текущий долг: <b>{currentDebt.toLocaleString('ru-RU')} ₽</b>. Баланс будет
                откорректирован на{' '}
                <b>
                  {(parseFloat(amount || '0') - currentDebt > 0 ? '+' : '') +
                    (parseFloat(amount || '0') - currentDebt).toLocaleString('ru-RU')}{' '}
                  ₽
                </b>
              </p>
            )}
          </div>

          {action !== 'adjust' && (
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                {action === 'add' ? 'Списать из' : 'Внести в'}
              </label>
              <select
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
              >
                <option value="none">
                  🚫 Без списания с кошелька (внутренний долг: комиссия, штраф, недостача)
                </option>
                <option value="10000000-0000-0000-0000-000000000002">
                  💵 Касса (Наличные) — выдать физические деньги
                </option>
                <option value="10000000-0000-0000-0000-000000000001">
                  🏦 Расчётный счёт (автосвязка с операцией банка)
                </option>
              </select>
              {walletId === 'none' && (
                <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2 mt-1.5 leading-snug">
                  💡 Внутренний долг запишется сотруднику и удержится при выплате ЗП, но не уменьшит
                  остаток в кассе и не попадёт в расходы компании.
                </p>
              )}
              {walletId === '10000000-0000-0000-0000-000000000001' && (
                <p className="text-[11px] text-sky-700 bg-sky-50 border border-sky-200 rounded-lg p-2 mt-1.5 leading-snug">
                  ℹ️ Если перевод уже сделан с расчетного счета, система автоматически найдет
                  списание банка на эту сумму и свяжет его с водителем во избежание задвоения
                  расходов.
                </p>
              )}
              {walletId === '10000000-0000-0000-0000-000000000002' && (
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1.5 leading-snug">
                  ⚠️ Деньги будут списаны из Кассы (Сейфа) и отразятся в кассовых списаниях за день.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Причина / Комментарий
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                action === 'add' ? 'На личные нужды, ремонт авто...' : 'Возврат наличными...'
              }
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
          </div>

          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className={cn(
              'flex-1 text-white font-bold text-sm py-3 rounded-xl disabled:opacity-50 transition-colors',
              action === 'add'
                ? 'bg-violet-600 hover:bg-violet-700'
                : 'bg-emerald-600 hover:bg-emerald-700',
            )}
          >
            {mutation.isPending
              ? 'Сохранение...'
              : action === 'add'
                ? '✓ Записать долг'
                : '✓ Внести погашение'}
          </button>
          <button
            onClick={onClose}
            className="text-sm text-slate-500 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
