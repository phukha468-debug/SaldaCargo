'use client';

import { useState } from 'react';
import type { TBankOp } from './types';
import { rub } from './utils';

export interface UnmatchedDebitItem {
  operationId: string;
  operationDate: string;
  amount: number;
  linkedAmount: number;
  remainingAmount: number;
  status: 'unmatched' | 'partial' | 'matched';
  receiverName: string;
  description: string;
  isPersonalWithdrawal: boolean;
  isCommission: boolean;
  linkedTransactionIds: string[];
  rawOp: TBankOp;
}

export interface UnmatchedDebitsResponse {
  days: number;
  unmatched_debits: UnmatchedDebitItem[];
  unmatched_commissions: UnmatchedDebitItem[];
  candidate_expenses: Array<{
    id: string;
    amount: number;
    date: string;
    categoryName: string;
    description: string;
    fromWalletId: string | null;
    isExactAmountMatch: boolean;
    score: number;
  }>;
  summary: {
    unmatched_count: number;
    unmatched_total: string;
    commissions_count: number;
    commissions_total: string;
  };
}

function formatShortLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function UnmatchedBankDebitsBanner({
  data,
  defaultExpanded = false,
  isBatchingCommissions = false,
  onLinkDebit,
  onBatchCommissions,
}: {
  data?: UnmatchedDebitsResponse;
  defaultExpanded?: boolean;
  isBatchingCommissions?: boolean;
  onLinkDebit: (item: UnmatchedDebitItem) => void;
  onBatchCommissions: (ops: UnmatchedDebitItem[]) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const debits = data?.unmatched_debits ?? [];
  const commissions = data?.unmatched_commissions ?? [];
  const debitsTotal = parseFloat(data?.summary?.unmatched_total || '0') || 0;
  const commissionsTotal = parseFloat(data?.summary?.commissions_total || '0') || 0;

  if (debits.length === 0 && commissions.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border-2 border-amber-300 rounded-xl overflow-hidden shadow-2xs">
      {/* Компактная шапка ровно в 1 строку */}
      <div className="px-3 py-1.5 bg-amber-50/90 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-amber-500 text-white font-black text-[11px] flex-shrink-0">
            !
          </span>
          <span className="font-black text-slate-900">
            Неразобранные списания с Р/С ({data?.days ?? 14} дн.):
          </span>
          {debits.length > 0 ? (
            <span className="font-mono tabular-nums font-black px-2 py-0.5 rounded-md bg-amber-400/90 text-slate-950">
              {debits.length} операц. · {rub(debitsTotal)}
            </span>
          ) : (
            <span className="font-bold text-emerald-700">Все выводы на карту разобраны ✓</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {commissions.length > 0 && (
            <button
              type="button"
              disabled={isBatchingCommissions}
              onClick={() => onBatchCommissions(commissions)}
              className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:border-indigo-500 text-slate-800 font-bold text-[11px] cursor-pointer disabled:opacity-50 transition"
            >
              {isBatchingCommissions
                ? 'Проводим...'
                : `✓ Провести комиссии (${commissions.length} · ${rub(commissionsTotal)})`}
            </button>
          )}
          {debits.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] cursor-pointer transition"
            >
              {expanded ? 'Свернуть ▲' : 'Развернуть ▼'}
            </button>
          )}
        </div>
      </div>

      {/* Раскрытая 1-строчная таблица неразобранных списаний */}
      {expanded && debits.length > 0 && (
        <div className="overflow-x-auto border-t border-amber-200 max-h-64 overflow-y-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-left font-bold border-b border-slate-200 sticky top-0">
                <th className="px-2.5 py-1.5 w-[108px] border-r border-slate-200">Дата</th>
                <th className="px-2.5 py-1.5 w-[170px] border-r border-slate-200">Получатель</th>
                <th className="px-2.5 py-1.5 border-r border-slate-200">Назначение Т-Банка</th>
                <th className="px-2.5 py-1.5 w-[115px] text-right border-r border-slate-200">
                  Сумма
                </th>
                <th className="px-2.5 py-1.5 w-[120px] text-right border-r border-slate-200">
                  Остаток
                </th>
                <th className="px-2.5 py-1.5 w-[120px] text-right">Действие</th>
              </tr>
            </thead>
            <tbody>
              {debits.map((op) => {
                const isPartial = op.linkedAmount > 0;
                return (
                  <tr
                    key={op.operationId}
                    className="border-b border-slate-100 last:border-b-0 hover:bg-amber-50/40 transition"
                  >
                    <td className="px-2.5 py-1 font-mono tabular-nums text-slate-500 whitespace-nowrap border-r border-slate-100">
                      {formatShortLocal(op.operationDate)}
                    </td>
                    <td
                      className="px-2.5 py-1 font-bold text-slate-800 truncate max-w-[170px] border-r border-slate-100"
                      title={op.receiverName}
                    >
                      {op.receiverName}
                    </td>
                    <td
                      className="px-2.5 py-1 text-slate-600 truncate max-w-[340px] border-r border-slate-100"
                      title={op.description}
                    >
                      {op.isPersonalWithdrawal && (
                        <span className="inline-block mr-1.5 px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                          На карту
                        </span>
                      )}
                      {op.description || 'Списание с Р/С'}
                    </td>
                    <td className="px-2.5 py-1 text-right font-mono tabular-nums font-bold text-slate-800 whitespace-nowrap border-r border-slate-100">
                      {rub(op.amount)}
                    </td>
                    <td
                      className={`px-2.5 py-1 text-right font-mono tabular-nums font-black whitespace-nowrap border-r border-slate-100 ${
                        isPartial ? 'text-amber-600' : 'text-rose-600'
                      }`}
                    >
                      {isPartial ? `ост. ${rub(op.remainingAmount)}` : rub(op.remainingAmount)}
                    </td>
                    <td className="px-2.5 py-1 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onLinkDebit(op)}
                        className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] cursor-pointer transition"
                      >
                        🔗 Привязать
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
