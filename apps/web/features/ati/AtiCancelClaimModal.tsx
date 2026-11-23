'use client';

import { useState } from 'react';
import type { AtiOrder } from './types';
import { calcAtiClaimTotal, defaultClaimNumberForOrder } from './utils';

export function AtiCancelClaimModal({
  order,
  isPending,
  onSubmitCancel,
  onClose,
}: {
  order: AtiOrder;
  isPending: boolean;
  onSubmitCancel: (payload: {
    id: string;
    reason: string;
    has_claim?: boolean;
    claim_status?: 'issued';
    claim_number?: string;
    claim_date?: string;
    claim_amount?: number;
    claim_penalty_amount?: number;
    claim_empty_run_amount?: number;
    claim_idle_amount?: number;
    claim_due_days?: number;
  }) => void;
  onClose: () => void;
}) {
  const [cancelMode, setCancelMode] = useState<'claim' | 'simple'>('claim');
  const [cancelReason, setCancelReason] = useState('Отказ заказчика по обоюдному согласию');
  const [claimNumber, setClaimNumber] = useState(() =>
    defaultClaimNumberForOrder(order.order_number),
  );
  const [claimDate] = useState(() => new Date().toISOString().split('T')[0] ?? '');
  const [claimPenaltyAmount, setClaimPenaltyAmount] = useState(() =>
    String(Math.round((Number(order.price) || 30000) * 0.2)),
  );
  const [claimEmptyRunAmount, setClaimEmptyRunAmount] = useState('0');
  const [claimIdleAmount, setClaimIdleAmount] = useState('0');
  const [claimDueDays, setClaimDueDays] = useState('5');
  const [showDetailedClaim, setShowDetailedClaim] = useState(false);

  const totalClaim = calcAtiClaimTotal(claimPenaltyAmount, claimEmptyRunAmount, claimIdleAmount);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-2xl max-w-lg w-full overflow-hidden my-auto">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-2">
              <span>⚠️</span>
              <span>Срыв договор-заявки {order.order_number}</span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Контрагент: <strong className="text-white">{order.counterparty_name}</strong> · Фрахт:{' '}
              <strong className="text-emerald-400 font-mono">
                {Number(order.price || 0).toLocaleString('ru-RU')} ₽
              </strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-3.5 text-xs">
          <p className="text-xs font-bold text-slate-800">Выберите действие по сорванной заявке:</p>

          {/* Вариант 1: Претензия */}
          <div
            onClick={() => setCancelMode('claim')}
            className={`p-4 rounded-2xl border-2 transition cursor-pointer ${
              cancelMode === 'claim'
                ? 'border-indigo-600 bg-indigo-50/70 shadow-sm'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70'
            }`}
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚖️</span>
                  <span className="font-black text-sm text-slate-900">
                    Выставить Претензию Заказчику
                  </span>
                  <span className="bg-amber-100 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-bold">
                    Штраф 20%
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Срыв по вине заказчика (не готов груз / отказ от машины). Штраф по ст. 35 УАТ РФ:{' '}
                  <strong>{totalClaim.toLocaleString('ru-RU')} ₽</strong>.
                </p>
                <div className="text-[11px] text-indigo-700 font-bold pt-0.5">
                  ✓ Заявка станет претензией, а при согласовании сумма автоматически попадёт в{' '}
                  <strong>Дебиторку</strong>.
                </div>
              </div>
              <input
                type="radio"
                name="modal_cancel_mode"
                checked={cancelMode === 'claim'}
                onChange={() => setCancelMode('claim')}
                className="mt-1 w-4 h-4 text-indigo-600 cursor-pointer shrink-0"
              />
            </div>

            {cancelMode === 'claim' && (
              <div
                className="mt-3 pt-3 border-t border-indigo-200/80 space-y-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div>
                  <button
                    type="button"
                    onClick={() => setShowDetailedClaim(!showDetailedClaim)}
                    className="text-[11px] text-indigo-700 hover:text-indigo-900 underline font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span>
                      {showDetailedClaim
                        ? '▲ Скрыть детализацию'
                        : '⚙️ Изменить номер / дату / добавить простой или подачу'}
                    </span>
                  </button>

                  {showDetailedClaim && (
                    <div className="mt-2 p-3 bg-white rounded-xl border border-indigo-200 space-y-2.5 shadow-2xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                            Исх. номер:
                          </label>
                          <input
                            type="text"
                            value={claimNumber}
                            onChange={(e) => setClaimNumber(e.target.value)}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                            Срок оплаты (дней):
                          </label>
                          <input
                            type="number"
                            value={claimDueDays}
                            onChange={(e) => setClaimDueDays(e.target.value)}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-bold text-center"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                        <div>
                          <label className="text-[9px] font-bold text-slate-600 block">
                            Штраф 20%:
                          </label>
                          <input
                            type="number"
                            value={claimPenaltyAmount}
                            onChange={(e) => setClaimPenaltyAmount(e.target.value)}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-600 block">
                            Подача/пробег:
                          </label>
                          <input
                            type="number"
                            value={claimEmptyRunAmount}
                            onChange={(e) => setClaimEmptyRunAmount(e.target.value)}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-600 block">
                            Простой:
                          </label>
                          <input
                            type="number"
                            value={claimIdleAmount}
                            onChange={(e) => setClaimIdleAmount(e.target.value)}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    onSubmitCancel({
                      id: order.id,
                      reason: 'Срыв на погрузке (груз не готов / отказ заказчика)',
                      has_claim: true,
                      claim_status: 'issued',
                      claim_number: claimNumber.trim() || '01-ПР',
                      claim_date: claimDate,
                      claim_amount: totalClaim,
                      claim_penalty_amount: Number(claimPenaltyAmount) || 0,
                      claim_empty_run_amount: Number(claimEmptyRunAmount) || 0,
                      claim_idle_amount: Number(claimIdleAmount) || 0,
                      claim_due_days: Number(claimDueDays) || 5,
                    })
                  }
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>⚖️</span>
                  <span>
                    {isPending
                      ? 'Оформление претензии...'
                      : `Снять с доски и выставить Претензию (${totalClaim.toLocaleString('ru-RU')} ₽)`}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Вариант 2: Простая отмена */}
          <div
            onClick={() => setCancelMode('simple')}
            className={`p-4 rounded-2xl border-2 transition cursor-pointer ${
              cancelMode === 'simple'
                ? 'border-rose-500 bg-rose-50/70 shadow-sm'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70'
            }`}
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">❌</span>
                  <span className="font-black text-sm text-slate-900">
                    Простая отмена (без претензий)
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Поломка автомобиля парка или отказ по обоюдному согласию. Финансовые требования не
                  предъявляются, заявка уходит в архив срывов.
                </p>
              </div>
              <input
                type="radio"
                name="modal_cancel_mode"
                checked={cancelMode === 'simple'}
                onChange={() => setCancelMode('simple')}
                className="mt-1 w-4 h-4 text-rose-600 cursor-pointer shrink-0"
              />
            </div>

            {cancelMode === 'simple' && (
              <div
                className="mt-3 pt-3 border-t border-rose-200/80 space-y-2.5"
                onClick={(e) => e.stopPropagation()}
              >
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Причина отмены:
                  </label>
                  <select
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                  >
                    <option value="Отказ заказчика по обоюдному согласию">
                      Отказ заказчика по обоюдному согласию
                    </option>
                    <option value="Поломка / опоздание автомобиля парка">
                      Поломка / опоздание автомобиля парка
                    </option>
                    <option value="Несоответствие веса / габаритов груза">
                      Несоответствие веса / габаритов груза
                    </option>
                    <option value="Другая причина">Другая причина</option>
                  </select>
                </div>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    onSubmitCancel({
                      id: order.id,
                      reason: cancelReason,
                      has_claim: false,
                    })
                  }
                  className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>✕</span>
                  <span>{isPending ? 'Снятие...' : 'Снять без претензий'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-100 cursor-pointer text-xs"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
