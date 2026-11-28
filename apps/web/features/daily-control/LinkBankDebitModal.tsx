'use client';

import { useMemo, useState } from 'react';
import type { CategoryItem, PaymentCalendarItem } from './types';
import type { UnmatchedDebitItem, UnmatchedDebitsResponse } from './UnmatchedBankDebitsBanner';
import { getFilteredCategories, rub } from './utils';

export type LinkDebitSubmitPayload =
  | {
      mode: 'link_existing';
      bank_operation_id: string;
      bank_operation_date?: string;
      bank_operation_amount: number;
      bank_operation_desc?: string;
      allocations: Array<{ transaction_id: string; allocated_amount: number }>;
    }
  | {
      mode: 'create_and_link';
      bank_operation_id: string;
      bank_operation_date?: string;
      bank_operation_amount: number;
      bank_operation_desc?: string;
      items: Array<{
        category_id?: string | null;
        description: string;
        amount: number;
        obligation_id?: string | null;
      }>;
    };

interface SplitRow {
  id: string;
  categoryId: string;
  description: string;
  amount: string;
  obligationId: string;
}

export function LinkBankDebitModal({
  debitOp,
  candidates,
  categories,
  calendarItems,
  isPending,
  errorMessage,
  onSubmit,
  onClose,
}: {
  debitOp: UnmatchedDebitItem;
  candidates: UnmatchedDebitsResponse['candidate_expenses'];
  categories: CategoryItem[];
  calendarItems: PaymentCalendarItem[];
  isPending: boolean;
  errorMessage?: string | null;
  onSubmit: (payload: LinkDebitSubmitPayload) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'existing' | 'split'>(
    candidates.length > 0 ? 'existing' : 'split',
  );
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const exact = candidates.find((c) => Math.abs(c.amount - debitOp.remainingAmount) < 1);
    return exact ? [exact.id] : [];
  });
  const [splitRows, setSplitRows] = useState<SplitRow[]>([
    {
      id: `sp-${Date.now()}`,
      categoryId: '',
      description: '',
      amount: String(debitOp.remainingAmount),
      obligationId: '',
    },
  ]);

  const expenseCategories = useMemo(
    () => getFilteredCategories(categories, 'expense'),
    [categories],
  );

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = candidates.filter((c) => {
      if (!q) return true;
      return `${c.categoryName} ${c.description} ${c.amount}`.toLowerCase().includes(q);
    });
    return [...list].sort((a, b) => {
      const aExact = Math.abs(a.amount - debitOp.remainingAmount) < 1 ? 1 : 0;
      const bExact = Math.abs(b.amount - debitOp.remainingAmount) < 1 ? 1 : 0;
      if (bExact !== aExact) return bExact - aExact;
      return b.score - a.score;
    });
  }, [candidates, search, debitOp.remainingAmount]);

  const selectedAmount = useMemo(() => {
    if (mode === 'existing') {
      return candidates.filter((c) => selectedIds.includes(c.id)).reduce((s, c) => s + c.amount, 0);
    }
    return splitRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  }, [mode, candidates, selectedIds, splitRows]);

  const totalAllocated = Math.min(
    debitOp.amount,
    Math.round((debitOp.linkedAmount + selectedAmount) * 100) / 100,
  );
  const remainingAfter = Math.max(0, Math.round((debitOp.amount - totalAllocated) * 100) / 100);
  const progressPct = Math.min(
    100,
    Math.round((totalAllocated / Math.max(1, debitOp.amount)) * 100),
  );

  const toggleCandidate = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const addSplitRow = () => {
    const rem = Math.max(0, Math.round((debitOp.remainingAmount - selectedAmount) * 100) / 100);
    setSplitRows((prev) => [
      ...prev,
      {
        id: `sp-${Date.now()}-${prev.length}`,
        categoryId: '',
        description: '',
        amount: rem > 0 ? String(rem) : '',
        obligationId: '',
      },
    ]);
  };

  const handleSubmit = () => {
    if (mode === 'existing') {
      const chosen = candidates.filter((c) => selectedIds.includes(c.id));
      if (chosen.length === 0) return;

      // Распределяем сумму списания пропорционально/последовательно, не превышая остаток
      let budget = debitOp.remainingAmount;
      const allocations: Array<{ transaction_id: string; allocated_amount: number }> = [];
      for (const c of chosen) {
        if (budget <= 0.01) break;
        const alloc = Math.min(c.amount, budget);
        allocations.push({
          transaction_id: c.id,
          allocated_amount: Math.round(alloc * 100) / 100,
        });
        budget = Math.round((budget - alloc) * 100) / 100;
      }
      if (allocations.length === 0) return;

      onSubmit({
        mode: 'link_existing',
        bank_operation_id: debitOp.operationId,
        bank_operation_date: debitOp.operationDate,
        bank_operation_amount: debitOp.amount,
        bank_operation_desc: debitOp.description,
        allocations,
      });
    } else {
      const validItems = splitRows
        .map((r) => ({
          category_id: r.categoryId || null,
          description:
            r.description.trim() ||
            expenseCategories.find((c) => c.id === r.categoryId)?.name ||
            'Расход с Р/С',
          amount: Math.round((parseFloat(r.amount) || 0) * 100) / 100,
          obligation_id: r.obligationId || null,
        }))
        .filter((it) => it.amount > 0);

      if (validItems.length === 0) return;

      onSubmit({
        mode: 'create_and_link',
        bank_operation_id: debitOp.operationId,
        bank_operation_date: debitOp.operationDate,
        bank_operation_amount: debitOp.amount,
        bank_operation_desc: debitOp.description,
        items: validItems,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-2xl w-full overflow-hidden text-xs">
        {/* Шапка */}
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-black text-sm flex items-center gap-1.5">
              <span>🔗</span>
              <span>Привязка списания с Р/С к расходам</span>
            </h3>
            <p className="text-[11px] text-slate-300 truncate mt-0.5">
              {new Date(debitOp.operationDate).toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              · {debitOp.receiverName} · {debitOp.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Прогресс-бар распределения */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 space-y-1.5">
          <div className="flex items-center justify-between font-mono tabular-nums">
            <span>
              Списание: <b className="text-slate-900">{rub(debitOp.amount)}</b>
            </span>
            <span>
              Распределено: <b className="text-emerald-600">{rub(totalAllocated)}</b>
            </span>
            <span>
              Остаток:{' '}
              <b className={remainingAfter > 0.01 ? 'text-amber-600' : 'text-emerald-600'}>
                {rub(remainingAfter)}
              </b>
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-200"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Переключатель режимов */}
        <div className="px-4 pt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('existing')}
            className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer transition ${
              mode === 'existing'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Привязать к внесённым расходам ({candidates.length})
          </button>
          <button
            type="button"
            onClick={() => setMode('split')}
            className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer transition ${
              mode === 'split'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Создать / Разбить остаток (Сплит)
          </button>
        </div>

        {errorMessage && (
          <div className="mx-4 mt-2.5 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-bold">
            {errorMessage}
          </div>
        )}

        {/* Вкладка 1: Привязать к существующим расходам */}
        {mode === 'existing' ? (
          <div className="p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">
                Выберите уже внесённые расходы — дубль в P&amp;L не создаётся:
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск расхода..."
                className="px-2.5 py-1 rounded-lg border border-slate-300 bg-slate-50 w-48 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
              {filteredCandidates.length === 0 ? (
                <div className="py-6 text-center text-slate-400">
                  Нет непривязанных расходов — переключитесь на вкладку «Создать / Разбить»
                </div>
              ) : (
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-left border-b border-slate-200 sticky top-0">
                      <th className="px-2 py-1.5 w-8 text-center">✓</th>
                      <th className="px-2 py-1.5 w-[92px]">Дата</th>
                      <th className="px-2 py-1.5 w-[115px]">Статья</th>
                      <th className="px-2 py-1.5">Описание</th>
                      <th className="px-2 py-1.5 w-[100px] text-right">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCandidates.map((c) => {
                      const checked = selectedIds.includes(c.id);
                      const isExact = Math.abs(c.amount - debitOp.remainingAmount) < 1;
                      return (
                        <tr
                          key={c.id}
                          onClick={() => toggleCandidate(c.id)}
                          className={`border-b border-slate-100 last:border-b-0 cursor-pointer transition ${
                            checked ? 'bg-indigo-50/80' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCandidate(c.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="accent-indigo-600 cursor-pointer"
                            />
                          </td>
                          <td className="px-2 py-1.5 font-mono text-slate-500 whitespace-nowrap">
                            {c.date
                              ? new Date(c.date).toLocaleDateString('ru-RU', {
                                  day: '2-digit',
                                  month: '2-digit',
                                })
                              : '—'}
                          </td>
                          <td className="px-2 py-1.5 font-bold text-slate-700 truncate max-w-[115px]">
                            {c.categoryName}
                          </td>
                          <td className="px-2 py-1.5 text-slate-800 truncate max-w-[240px]">
                            {c.description}
                            {isExact && (
                              <span className="ml-1.5 px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                ✓ Точное совпадение
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono tabular-nums font-black text-slate-900 whitespace-nowrap">
                            {rub(c.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          /* Вкладка 2: Сплит / Создание новых расходов */
          <div className="p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">
                Разбейте сумму (или остаток) по статьям расходов:
              </span>
              <button
                type="button"
                onClick={addSplitRow}
                className="px-2.5 py-1 rounded-lg border border-slate-300 hover:border-indigo-500 font-bold text-slate-700 cursor-pointer"
              >
                + Добавить строку
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {splitRows.map((row, idx) => (
                <div
                  key={row.id}
                  className="grid grid-cols-12 gap-1.5 items-center bg-slate-50 p-2 rounded-xl border border-slate-200"
                >
                  <select
                    value={row.categoryId}
                    onChange={(e) =>
                      setSplitRows((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, categoryId: e.target.value } : r)),
                      )
                    }
                    className="col-span-3 px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800"
                  >
                    <option value="">— Статья —</option>
                    {expenseCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={row.description}
                    onChange={(e) =>
                      setSplitRows((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, description: e.target.value } : r)),
                      )
                    }
                    placeholder="Описание (напр. Налоги ИП)"
                    className="col-span-4 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                  />
                  <select
                    value={row.obligationId}
                    onChange={(e) =>
                      setSplitRows((prev) =>
                        prev.map((r, i) =>
                          i === idx ? { ...r, obligationId: e.target.value } : r,
                        ),
                      )
                    }
                    className="col-span-2 px-1.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] text-slate-600"
                    title="Привязать к Календарю платежей"
                  >
                    <option value="">📅 Нет</option>
                    {calendarItems.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.title}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={row.amount}
                    onChange={(e) =>
                      setSplitRows((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, amount: e.target.value } : r)),
                      )
                    }
                    placeholder="Сумма"
                    className="col-span-2 px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-right font-black"
                  />
                  <button
                    type="button"
                    disabled={splitRows.length === 1}
                    onClick={() => setSplitRows((prev) => prev.filter((_, i) => i !== idx))}
                    className="col-span-1 py-1.5 rounded-lg border border-slate-300 text-rose-600 hover:bg-rose-50 font-bold cursor-pointer disabled:opacity-30"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Футер */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500">
            Можно привязать частично — остаток останется в списке до разбора
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={isPending || selectedAmount <= 0}
              onClick={handleSubmit}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black cursor-pointer disabled:opacity-50 transition"
            >
              {isPending ? 'Сохранение...' : '✓ Сохранить привязку'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
