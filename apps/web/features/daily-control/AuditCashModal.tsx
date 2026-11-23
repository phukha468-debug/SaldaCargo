'use client';

import { useState } from 'react';
import type { DailyBalanceData } from './types';
import { formatDayHeader, rub } from './utils';

export function AuditCashModal({
  selectedDate,
  data,
  isPending,
  onSubmit,
  onClose,
}: {
  selectedDate: string;
  data: DailyBalanceData | undefined;
  isPending: boolean;
  onSubmit: (payload: {
    date: string;
    safe_cash_actual: number;
    safe_cash_expected: number;
    bank_balance: number;
    fuel_card_balance: number;
    audited_by: string;
    notes: string;
  }) => void;
  onClose: () => void;
}) {
  const bankWallet = data?.wallets?.bank;
  const cashWallet = data?.wallets?.cash;
  const fuelWallet = data?.wallets?.fuel_card;

  const [auditedBy, setAuditedBy] = useState(data?.audit?.audited_by || 'Директор');
  const [actualCash, setActualCash] = useState(
    String(data?.audit?.safe_cash_actual ?? cashWallet?.evening ?? ''),
  );
  const [actualFuel, setActualFuel] = useState(
    String(data?.audit?.fuel_card_balance ?? Math.max(0, fuelWallet?.evening ?? 0)),
  );
  const [notes, setNotes] = useState(data?.audit?.notes || '');

  const expectedCash = cashWallet?.evening ?? 0;
  const discrepancy = (parseFloat(actualCash) || 0) - expectedCash;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔒</span>
            <div>
              <div className="text-sm font-black uppercase text-slate-900">
                Вечерний аудит кассы (19:30)
              </div>
              <div className="text-[10px] text-slate-500">
                Дата контроля: {formatDayHeader(selectedDate)}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3.5">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-xs text-amber-900">
            Директор лично проверяет наличные деньги в сейфе. Банк сверяется по API Т-Банка
            автоматически, а топливные карты — по чекам.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[9px] font-black uppercase text-slate-400">
                Расчётный сейф (по учету)
              </div>
              <div className="text-base font-black font-mono text-slate-800 mt-1">
                {rub(expectedCash)}
              </div>
            </div>

            <div>
              <label className="text-[9px] font-black uppercase text-slate-500">
                Фактически в сейфе (рубли) *
              </label>
              <input
                type="number"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                placeholder="Например: 145000"
                className="w-full mt-1 px-3 py-2.5 text-sm font-bold font-mono border-2 border-emerald-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
          </div>

          {actualCash !== '' && (
            <div
              className={`p-2.5 rounded-xl border text-xs flex items-center justify-between font-mono ${
                Math.abs(discrepancy) < 0.01
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                  : 'bg-rose-50 border-rose-300 text-rose-800 font-bold'
              }`}
            >
              <span>Расхождение сейфа:</span>
              <span>{rub(discrepancy)}</span>
            </div>
          )}

          <div>
            <label className="text-[9px] font-black uppercase text-slate-500 flex items-center justify-between">
              <span>Фактически на Топливной карте (рубли)</span>
              <span className="text-[9px] text-slate-400 font-mono">
                по учёту: {rub(fuelWallet?.evening ?? 0)}
              </span>
            </label>
            <input
              type="number"
              step="0.01"
              value={actualFuel}
              onChange={(e) => setActualFuel(e.target.value)}
              placeholder="Например: 926.13"
              className="w-full mt-1 px-3 py-2 text-sm font-bold font-mono border-2 border-amber-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>

          <div className="text-[10px] text-slate-500 space-y-1 pt-1">
            <div className="flex justify-between">
              <span>Фиксация Р/С Банк:</span>
              <span className="font-mono font-bold text-slate-800">
                {rub(bankWallet?.evening ?? 0)}
              </span>
            </div>
          </div>

          <div>
            <label className="text-[9px] font-black uppercase text-slate-500">Кто утвердил</label>
            <input
              type="text"
              value={auditedBy}
              onChange={(e) => setAuditedBy(e.target.value)}
              className="w-full mt-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          <div>
            <label className="text-[9px] font-black uppercase text-slate-500">
              Комментарий (если есть расхождения или замечания)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Всё сходится копейка в копейку"
              className="w-full mt-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
          >
            Отмена
          </button>
          <button
            disabled={isPending || actualCash === ''}
            onClick={() =>
              onSubmit({
                date: selectedDate,
                safe_cash_actual: parseFloat(actualCash) || 0,
                safe_cash_expected: expectedCash,
                bank_balance: bankWallet?.evening ?? 0,
                fuel_card_balance:
                  actualFuel !== '' ? parseFloat(actualFuel) : (fuelWallet?.evening ?? 0),
                audited_by: auditedBy,
                notes,
              })
            }
            className="px-4 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {isPending ? 'Запись...' : 'Утвердить и отправить директору ✓'}
          </button>
        </div>
      </div>
    </div>
  );
}
