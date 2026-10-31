'use client';

import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface SafeAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCashBalance: number;
}

export function SafeAdjustmentModal({
  isOpen,
  onClose,
  currentCashBalance,
}: SafeAdjustmentModalProps) {
  const queryClient = useQueryClient();
  const [targetAmount, setTargetAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setTargetAmount(currentCashBalance >= 0 ? String(Math.round(currentCashBalance)) : '0');
      setNotes('');
      setErrorMsg('');
    }
  }, [isOpen, currentCashBalance]);

  const targetNum = parseFloat(targetAmount) || 0;
  const delta = targetNum - currentCashBalance;

  const mutation = useMutation({
    mutationFn: async () => {
      setErrorMsg('');
      const res = await fetch('/api/wallets/set-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: 'cash',
          target_amount: targetNum,
          notes: notes.trim() || 'Коррекция остатка наличных в сейфе',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка сохранения коррекции');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['daily-balance'] });
      onClose();
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || 'Не удалось применить коррекцию');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border-2 border-slate-900 overflow-hidden font-sans">
        {/* Заголовок в 1 компактную строку */}
        <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 text-base">🔒</span>
            <h3 className="font-black text-xs sm:text-sm uppercase tracking-wide">
              Коррекция наличных в сейфе
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-base leading-none px-1.5 py-0.5 rounded transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Тело модалки: плотный 1-строчный лейаут с занятием места справа */}
        <div className="p-3.5 space-y-2.5 text-xs">
          {/* Строка 1: Текущий остаток */}
          <div className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
            <span className="text-slate-500 font-bold">Расчетный остаток сейфа:</span>
            <span
              className={`font-mono font-black ${
                currentCashBalance < 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {currentCashBalance.toLocaleString('ru-RU')} ₽
            </span>
          </div>

          {/* Строка 2: Ввод фактической суммы + расчет разницы справа в одну строку */}
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
              Фактическая сумма в сейфе:
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  step="any"
                  autoFocus
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="0"
                  className="w-full pl-2.5 pr-7 py-1.5 bg-white border-2 border-slate-900 rounded-lg font-mono font-black text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                  ₽
                </span>
              </div>

              {/* Расчет дельты справа в одну строку */}
              <div
                className={`px-2 py-1.5 rounded-lg border font-mono font-bold text-[11px] whitespace-nowrap shrink-0 flex items-center gap-1 ${
                  Math.abs(delta) < 0.01
                    ? 'bg-slate-100 text-slate-600 border-slate-300'
                    : delta > 0
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-rose-50 text-rose-700 border-rose-300'
                }`}
                title="Разница между фактической и расчетной суммой"
              >
                <span>{delta >= 0 ? '▲ +' : '▼ '}</span>
                <span>{delta.toLocaleString('ru-RU')} ₽</span>
              </div>
            </div>
          </div>

          {/* Строка 3: Примечание (в 1 компактную строку) */}
          <div className="space-y-1">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Причина коррекции (например: пересчёт кассы, внесение)"
              className="w-full px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-500"
            />
          </div>

          {errorMsg && (
            <div className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-1 rounded">
              {errorMsg}
            </div>
          )}

          {/* Подвал с кнопками в 1 строку */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={mutation.isPending || isNaN(parseFloat(targetAmount))}
              onClick={() => mutation.mutate()}
              className="px-3.5 py-1.5 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <span>{mutation.isPending ? 'Запись...' : 'Сохранить остаток ✓'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
