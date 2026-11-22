'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { cn } from '@saldacargo/ui';
import { WALLETS } from './constants';
import type { PayrollUser } from './types';

export function ManualPayModal({
  user,
  onClose,
  onSuccess,
}: {
  user: PayrollUser;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState(WALLETS[1]!.id);
  const [walletMode, setWalletMode] = useState<'single' | 'split'>('single');
  const [cashSplit, setCashSplit] = useState('');
  const [bankSplit, setBankSplit] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const numAmount = parseFloat(amount.replace(',', '.')) || 0;

  const handleCashChange = (val: string) => {
    setCashSplit(val);
    const c = parseFloat(val.replace(',', '.')) || 0;
    const b = Math.max(0, Math.round((numAmount - c) * 100) / 100);
    setBankSplit(b > 0 ? b.toString() : '0');
    setError('');
  };

  const handleBankChange = (val: string) => {
    setBankSplit(val);
    const b = parseFloat(val.replace(',', '.')) || 0;
    const c = Math.max(0, Math.round((numAmount - b) * 100) / 100);
    setCashSplit(c > 0 ? c.toString() : '0');
    setError('');
  };

  const setSplit5050 = () => {
    const half = Math.round((numAmount / 2) * 100) / 100;
    setCashSplit(half.toString());
    setBankSplit((Math.round((numAmount - half) * 100) / 100).toString());
    setError('');
  };

  const cashVal = parseFloat(cashSplit.replace(',', '.')) || 0;
  const bankVal = parseFloat(bankSplit.replace(',', '.')) || 0;
  const totalSplit = Math.round((cashVal + bankVal) * 100) / 100;
  const isSplitValid =
    walletMode === 'single' || (numAmount > 0 ? Math.abs(totalSplit - numAmount) < 0.05 : true);

  const mutation = useMutation({
    mutationFn: () => {
      const splitsPayload =
        walletMode === 'split'
          ? [
              { wallet_id: WALLETS[1]!.id, amount: cashVal },
              { wallet_id: WALLETS[0]!.id, amount: bankVal },
            ].filter((s) => s.amount > 0)
          : [{ wallet_id: walletId, amount: numAmount }];

      return fetch('/api/staff/pay-salary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          amount: numAmount.toFixed(2),
          from_wallet_id: walletMode === 'single' ? walletId : undefined,
          wallet_splits: splitsPayload,
          note: note.trim() || undefined,
        }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Ошибка');
        return d;
      });
    },
    onSuccess,
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = () => {
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Введите сумму');
      return;
    }
    if (walletMode === 'split' && !isSplitValid) {
      setError('Сумма по кошелькам должна совпадать с общей суммой выплаты');
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
            <h2 className="font-bold text-slate-900">Выплата ЗП</h2>
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
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Сумма, ₽ *</label>
            <input
              autoFocus
              type="number"
              min="1"
              step="1000"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
                if (walletMode === 'split') {
                  const n = parseFloat(e.target.value.replace(',', '.')) || 0;
                  const half = Math.round((n / 2) * 100) / 100;
                  setCashSplit(half.toString());
                  setBankSplit((Math.round((n - half) * 100) / 100).toString());
                }
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="0"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-500">Списать с</label>
              <div className="flex bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setWalletMode('single')}
                  className={cn(
                    'px-2 py-0.5 rounded-md transition-all',
                    walletMode === 'single'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800',
                  )}
                >
                  Один кошелёк
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWalletMode('split');
                    if (!cashSplit && !bankSplit && numAmount > 0) {
                      setSplit5050();
                    }
                  }}
                  className={cn(
                    'px-2 py-0.5 rounded-md transition-all',
                    walletMode === 'split'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800',
                  )}
                >
                  🔀 Разделить
                </button>
              </div>
            </div>

            {walletMode === 'single' ? (
              <div className="flex gap-2">
                {WALLETS.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setWalletId(w.id)}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl border-2 text-xs font-black transition-all',
                      walletId === w.id
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-500',
                    )}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700">💵 Касса (наличные):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={cashSplit}
                      onChange={(e) => handleCashChange(e.target.value)}
                      className="w-24 border border-slate-300 rounded-lg px-2 py-1 text-right text-xs font-black text-slate-900 bg-white"
                      placeholder="0"
                    />
                    <span className="text-xs text-slate-500">₽</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700">🏦 Расчётный счёт:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={bankSplit}
                      onChange={(e) => handleBankChange(e.target.value)}
                      className="w-24 border border-slate-300 rounded-lg px-2 py-1 text-right text-xs font-black text-slate-900 bg-white"
                      placeholder="0"
                    />
                    <span className="text-xs text-slate-500">₽</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[11px]">
                  <button
                    type="button"
                    onClick={setSplit5050}
                    className="text-[10px] text-blue-600 hover:underline font-bold"
                  >
                    50/50
                  </button>
                  <span
                    className={cn('font-bold', isSplitValid ? 'text-emerald-700' : 'text-rose-600')}
                  >
                    {isSplitValid
                      ? `${totalSplit.toLocaleString('ru-RU')} ₽ ✓`
                      : `Разница: ${(numAmount - totalSplit).toLocaleString('ru-RU')} ₽`}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Комментарий</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Необязательно"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>

          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending || (walletMode === 'split' && !isSplitValid)}
            className="flex-1 bg-emerald-600 text-white font-bold text-sm py-3 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Проводим...' : '✓ Выплатить'}
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
