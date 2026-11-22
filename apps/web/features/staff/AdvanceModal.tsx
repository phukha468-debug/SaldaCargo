'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Money } from '@saldacargo/ui';
import { WALLETS } from './constants';
import type { PayrollUser } from './types';

export function AdvanceModal({
  user,
  onClose,
  onSuccess,
}: {
  user: PayrollUser;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState(WALLETS[0]!.id);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      fetch('/api/staff/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          amount: parseFloat(amount.replace(',', '.')).toFixed(2),
          from_wallet_id: walletId,
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

  const advanceOutstanding = parseFloat(user.advance_balance ?? '0');

  const handleSubmit = () => {
    const val = parseFloat(amount.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      setError('Введите сумму');
      return;
    }
    setError('');
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Выдать аванс</h2>
            <p className="text-sm text-slate-500">{user.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-6 space-y-4">
          {advanceOutstanding > 0 && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-violet-700">Текущий аванс</span>
                <span className="text-lg font-black text-violet-700">
                  <Money amount={user.advance_balance} />
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Сумма аванса *</label>
            <input
              autoFocus
              type="number"
              min="1"
              step="500"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="0"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Из кассы / счёта
            </label>
            <select
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
            >
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
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Необязательно"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
          </div>

          <p className="text-xs text-slate-400">
            Аванс будет вычтен из будущих выплат. Сотрудник работает в счёт выданной суммы.
          </p>
          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="flex-1 bg-violet-600 text-white font-bold text-sm py-3 rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Проводим...' : '✓ Выдать аванс'}
          </button>
          <button
            onClick={onClose}
            className="text-sm text-slate-500 px-4 py-3 rounded-xl border border-slate-200"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
