'use client';

import { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Money, cn } from '@saldacargo/ui';
import { WALLETS } from '../constants';
import type { PayrollUser } from '../types';
import { SettlePendingList, type SettlePendingTx } from './SettlePendingList';

export function SettleModal({
  user,
  onClose,
  onSuccess,
}: {
  user: PayrollUser;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const initialSalaryTotal = parseFloat(user.debt);
  const advanceBalance = parseFloat(user.advance_balance ?? '0');

  const {
    data: settleData,
    isLoading: isSettleLoading,
    refetch: refetchSettle,
  } = useQuery<{
    salary_total: string;
    advance_balance: string;
    offset: string;
    payout: string;
    uncollected_cash: string;
    pending_transactions: SettlePendingTx[];
  }>({
    queryKey: ['staff-settle-data', user.id],
    queryFn: () => fetch(`/api/staff/settle?user_id=${user.id}`).then((r) => r.json()),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const pendingList = useMemo(
    () => settleData?.pending_transactions ?? [],
    [settleData?.pending_transactions],
  );
  const [selectedTxIdsState, setSelectedTxIdsState] = useState<Set<string> | null>(null);

  const selectedTxIds = useMemo(
    () => selectedTxIdsState ?? new Set(pendingList.map((t) => t.id)),
    [selectedTxIdsState, pendingList],
  );

  const selectedItems = pendingList.filter((t) => selectedTxIds.has(t.id));
  const unselectedItems = pendingList.filter((t) => !selectedTxIds.has(t.id));

  const salaryTotal =
    pendingList.length > 0
      ? selectedItems.reduce((s, t) => s + parseFloat(String(t.amount || '0')), 0)
      : initialSalaryTotal;

  const maxOffset = Math.min(salaryTotal, advanceBalance);

  const [walletId, setWalletId] = useState(WALLETS[1]!.id);
  const [walletMode, setWalletMode] = useState<'single' | 'split'>('single');
  const [cashSplit, setCashSplit] = useState('');
  const [bankSplit, setBankSplit] = useState('');
  const [offsetInput, setOffsetInput] = useState('0');
  const [error, setError] = useState('');
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOffsetConfirm, setShowOffsetConfirm] = useState(false);

  const offsetVal = Math.min(Math.max(0, parseFloat(offsetInput) || 0), maxOffset);
  const effectiveOffset = offsetVal;
  const payout = Math.max(0, salaryTotal - effectiveOffset);
  const remainingDebt = Math.max(0, advanceBalance - effectiveOffset);
  const unselectedTotal = unselectedItems.reduce(
    (s, t) => s + parseFloat(String(t.amount || '0')),
    0,
  );
  const needsWallet = payout > 0;

  const selectAll = () => setSelectedTxIdsState(new Set(pendingList.map((t) => t.id)));

  const selectThursday = () => {
    const now = new Date();
    const day = now.getDay();
    const diffToThu = day >= 4 ? day - 4 : day + 3;
    const endThu = new Date(now);
    endThu.setDate(now.getDate() - diffToThu);
    endThu.setHours(23, 59, 59, 999);

    const thuIds = pendingList
      .filter((t) => new Date(t.transaction_date || t.created_at) <= endThu)
      .map((t) => t.id);
    setSelectedTxIdsState(new Set(thuIds));
  };

  const deselectAll = () => setSelectedTxIdsState(new Set());

  const toggleItem = (id: string) => {
    const next = new Set(selectedTxIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTxIdsState(next);
  };

  const handleCashChange = (val: string) => {
    setCashSplit(val);
    const c = parseFloat(val.replace(',', '.')) || 0;
    const b = Math.max(0, Math.round((payout - c) * 100) / 100);
    setBankSplit(b > 0 ? b.toString() : '0');
    setError('');
  };

  const handleBankChange = (val: string) => {
    setBankSplit(val);
    const b = parseFloat(val.replace(',', '.')) || 0;
    const c = Math.max(0, Math.round((payout - b) * 100) / 100);
    setCashSplit(c > 0 ? c.toString() : '0');
    setError('');
  };

  const setSplit5050 = () => {
    const half = Math.round((payout / 2) * 100) / 100;
    setCashSplit(half.toString());
    setBankSplit((Math.round((payout - half) * 100) / 100).toString());
    setError('');
  };

  const cashVal = parseFloat(cashSplit.replace(',', '.')) || 0;
  const bankVal = parseFloat(bankSplit.replace(',', '.')) || 0;
  const totalSplit = Math.round((cashVal + bankVal) * 100) / 100;
  const isSplitValid =
    walletMode === 'single' || (!needsWallet ? true : Math.abs(totalSplit - payout) < 0.05);

  const getSplitsPayload = () => {
    if (!needsWallet) return undefined;
    if (walletMode === 'single') {
      return [{ wallet_id: walletId, amount: payout }];
    }
    return [
      { wallet_id: WALLETS[1]!.id, amount: cashVal },
      { wallet_id: WALLETS[0]!.id, amount: bankVal },
    ].filter((s) => s.amount > 0);
  };

  const mutation = useMutation({
    mutationFn: () => {
      const splits = getSplitsPayload();
      return fetch('/api/staff/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          selected_transaction_ids: pendingList.length > 0 ? Array.from(selectedTxIds) : undefined,
          from_wallet_id: needsWallet && walletMode === 'single' ? walletId : undefined,
          wallet_splits: needsWallet ? splits : undefined,
          partial_offset: effectiveOffset.toFixed(2),
          idempotency_key: idempotencyKey,
        }),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? 'Ошибка');
        return data;
      });
    },
    onSuccess,
    onError: (e: Error) => {
      setError(e.message);
      void refetchSettle();
    },
    onSettled: () => setIsSubmitting(false),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Выплата ЗП (Ведомость)</h2>
            <p className="text-sm text-slate-500">{user.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {showOffsetConfirm ? (
          <div className="p-6 space-y-4">
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-black text-sm">
                <span className="material-symbols-outlined text-amber-600">warning</span>
                <span>Внимание: Списание аванса!</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Вы указали удержание в зачёт аванса на сумму{' '}
                <strong className="text-amber-950 font-black">
                  <Money amount={effectiveOffset.toFixed(2)} />
                </strong>
                .
              </p>
              <div className="bg-white/80 rounded-xl p-3 text-xs space-y-1.5 border border-amber-200">
                <div className="flex justify-between">
                  <span className="text-slate-600">Текущий долг водителя:</span>
                  <span className="font-bold text-rose-600">
                    <Money amount={advanceBalance.toFixed(2)} />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Остаток долга после зачёта:</span>
                  <span className="font-bold text-violet-700">
                    <Money amount={remainingDebt.toFixed(2)} />
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-100">
                  <span className="text-slate-700 font-bold">Будет выплачено на руки:</span>
                  <span className="font-black text-emerald-700">
                    <Money amount={payout.toFixed(2)} />
                  </span>
                </div>
              </div>
              <p className="text-xs font-bold text-amber-950 pt-1 text-center">
                Вы точно хотите списать этот аванс?
              </p>
            </div>

            {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (isSubmitting || mutation.isPending) return;
                  setIsSubmitting(true);
                  mutation.mutate();
                }}
                disabled={mutation.isPending || isSubmitting}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm py-3.5 rounded-xl transition-colors shadow-lg shadow-amber-600/20 active:scale-[0.98]"
              >
                {mutation.isPending || isSubmitting
                  ? 'Проводим...'
                  : '✓ Да, списать аванс и выплатить'}
              </button>
              <button
                type="button"
                onClick={() => setShowOffsetConfirm(false)}
                className="w-full text-xs font-medium text-slate-600 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                ← Вернуться и изменить
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-6 space-y-3">
              {(user.accountable_hold ?? 0) > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl px-3 py-2 text-xs flex items-center justify-between text-amber-900 font-medium">
                  <span className="flex items-center gap-1.5">
                    <span>💵</span>
                    <span>Подотчёт на руках:</span>
                  </span>
                  <span className="font-black text-amber-950">
                    {(user.accountable_hold ?? 0).toLocaleString('ru-RU')} ₽ (долг в кассу)
                  </span>
                </div>
              )}

              <SettlePendingList
                pendingList={pendingList}
                selectedTxIds={selectedTxIds}
                selectedCount={selectedItems.length}
                unselectedCount={unselectedItems.length}
                unselectedTotal={unselectedTotal}
                isLoading={isSettleLoading}
                onSelectAll={selectAll}
                onSelectThursday={selectThursday}
                onDeselectAll={deselectAll}
                onToggleItem={toggleItem}
              />

              <div className="bg-slate-50 rounded-xl divide-y divide-slate-200 overflow-hidden">
                <div className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-xs text-slate-600">Выбрано к выплате</span>
                  <span className="text-sm font-bold text-slate-900">
                    <Money amount={salaryTotal.toFixed(2)} />
                  </span>
                </div>
                {advanceBalance > 0 && (
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-xs text-slate-600">Долг сотрудника (аванс)</span>
                    <span className="text-sm font-bold text-rose-600">
                      <Money amount={user.advance_balance} />
                    </span>
                  </div>
                )}
                {advanceBalance > 0 && (
                  <div className="px-4 py-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-violet-700">Зачесть в счёт аванса</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setOffsetInput('0')}
                          className="text-[10px] px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors font-bold"
                        >
                          0%
                        </button>
                        <button
                          type="button"
                          onClick={() => setOffsetInput((maxOffset * 0.3).toFixed(2))}
                          className="text-[10px] px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                          30%
                        </button>
                        <button
                          type="button"
                          onClick={() => setOffsetInput((maxOffset * 0.5).toFixed(2))}
                          className="text-[10px] px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                          50%
                        </button>
                        <button
                          type="button"
                          onClick={() => setOffsetInput(maxOffset.toFixed(2))}
                          className="text-[10px] px-2 py-0.5 rounded border border-violet-200 text-violet-600 hover:bg-violet-50 transition-colors font-bold"
                        >
                          Весь
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max={maxOffset}
                        step="100"
                        value={offsetInput}
                        onChange={(e) => setOffsetInput(e.target.value)}
                        className="w-full border border-violet-200 rounded-lg px-3 py-1.5 text-xs font-bold text-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-violet-50"
                      />
                      <span className="text-xs text-slate-500 shrink-0">₽</span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center px-4 py-2.5 bg-emerald-50">
                  <span className="text-xs font-bold text-emerald-800">К выплате на руки</span>
                  <span className="text-base font-black text-emerald-700">
                    {payout > 0 ? <Money amount={payout.toFixed(2)} /> : '0 ₽'}
                  </span>
                </div>
              </div>

              {advanceBalance > 0 && parseFloat(offsetInput) > 0 && (
                <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-2 flex justify-between">
                  <span className="text-xs text-violet-600">Остаток долга после зачёта</span>
                  <span className="text-xs font-bold text-violet-700">
                    <Money amount={remainingDebt.toFixed(2)} />
                  </span>
                </div>
              )}

              {needsWallet && (
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
                          if (!cashSplit && !bankSplit) setSplit5050();
                        }}
                        className={cn(
                          'px-2 py-0.5 rounded-md transition-all',
                          walletMode === 'split'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800',
                        )}
                      >
                        🔀 Разделить (Касса + Р/С)
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
                            'flex-1 py-2 rounded-xl border-2 text-xs font-black transition-all',
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
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          💵 Касса (наличные):
                        </span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={cashSplit}
                            onChange={(e) => handleCashChange(e.target.value)}
                            className="w-28 border border-slate-300 rounded-lg px-2 py-1 text-right text-xs font-black text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                            placeholder="0"
                          />
                          <span className="text-xs text-slate-500">₽</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          🏦 Расчётный счёт:
                        </span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={bankSplit}
                            onChange={(e) => handleBankChange(e.target.value)}
                            className="w-28 border border-slate-300 rounded-lg px-2 py-1 text-right text-xs font-black text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
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
                          Пополам (50/50)
                        </button>
                        <span
                          className={cn(
                            'font-bold',
                            isSplitValid ? 'text-emerald-700' : 'text-rose-600',
                          )}
                        >
                          {isSplitValid ? (
                            <>Итого: {totalSplit.toLocaleString('ru-RU')} ₽ ✓</>
                          ) : (
                            <>Разница: {(payout - totalSplit).toLocaleString('ru-RU')} ₽</>
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {salaryTotal <= 0 && (
                <p className="text-sm text-slate-400 text-center py-2">
                  Нет начисленной ЗП к выплате
                </p>
              )}
              {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => {
                  if (isSubmitting || mutation.isPending || salaryTotal <= 0 || !isSplitValid)
                    return;
                  if (effectiveOffset > 0) {
                    setShowOffsetConfirm(true);
                    return;
                  }
                  setIsSubmitting(true);
                  mutation.mutate();
                }}
                disabled={mutation.isPending || isSubmitting || salaryTotal <= 0 || !isSplitValid}
                className="flex-1 bg-emerald-600 text-white font-bold text-sm py-3 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {mutation.isPending || isSubmitting
                  ? 'Проводим...'
                  : `✓ Выплатить ${payout.toLocaleString('ru-RU')} ₽ (${selectedItems.length} поз.)`}
              </button>
              <button
                onClick={onClose}
                className="text-sm text-slate-500 px-4 py-3 rounded-xl border border-slate-200"
              >
                Отмена
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
