'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface UnmatchedDebit {
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
}

interface CandidateExpense {
  id: string;
  amount: number;
  date: string;
  categoryName: string;
  description: string;
  isExactAmountMatch: boolean;
  score: number;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface BankDebitsResponse {
  days: number;
  unmatched_debits: UnmatchedDebit[];
  unmatched_commissions: UnmatchedDebit[];
  candidate_expenses: CandidateExpense[];
  categories: CategoryOption[];
  summary: {
    unmatched_count: number;
    unmatched_total: string;
    commissions_count: number;
    commissions_total: string;
  };
}

interface SplitItem {
  category_id: string;
  description: string;
  amount: string;
}

function fmtMoney(n: number | string): string {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (!Number.isFinite(num)) return '0 ₽';
  return `${num.toLocaleString('ru-RU', {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })} ₽`;
}

function fmtShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

export default function MiniappBankDebitsPage() {
  const queryClient = useQueryClient();
  const [selectedDebit, setSelectedDebit] = useState<UnmatchedDebit | null>(null);
  const [modalTab, setModalTab] = useState<'existing' | 'create'>('existing');
  const [selectedMap, setSelectedMap] = useState<Record<string, string>>({});
  const [splitItems, setSplitItems] = useState<SplitItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery<BankDebitsResponse>({
    queryKey: ['miniapp-bank-debits'],
    queryFn: async () => {
      const res = await fetch('/api/admin/bank-debits?days=14', { cache: 'no-store' });
      if (!res.ok) throw new Error('Не удалось загрузить списания Т-Банка');
      return res.json();
    },
    staleTime: 15000,
  });

  const linkMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/admin/bank-debits/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Ошибка сохранения');
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['miniapp-bank-debits'] });
      queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      setSelectedDebit(null);
      setToast('Сохранено');
      setTimeout(() => setToast(null), 2500);
    },
    onError: (err: Error) => {
      setToast(`Ошибка: ${err.message}`);
      setTimeout(() => setToast(null), 3500);
    },
  });

  const openModal = (debit: UnmatchedDebit) => {
    setSelectedDebit(debit);
    setModalTab('existing');
    setSelectedMap({});
    setSplitItems([
      {
        category_id: data?.categories?.[0]?.id || '',
        description: debit.isPersonalWithdrawal ? '' : debit.description.slice(0, 120),
        amount: String(debit.remainingAmount),
      },
    ]);
  };

  const rankedCandidates = useMemo(() => {
    if (!selectedDebit || !data?.candidate_expenses) return [];
    const target = selectedDebit.remainingAmount;
    return [...data.candidate_expenses].sort((a, b) => {
      const aExact = Math.abs(a.amount - target) < 0.01 ? 1 : 0;
      const bExact = Math.abs(b.amount - target) < 0.01 ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      return Math.abs(a.amount - target) - Math.abs(b.amount - target);
    });
  }, [selectedDebit, data]);

  const toggleCandidate = (cand: CandidateExpense) => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (next[cand.id] !== undefined) {
        delete next[cand.id];
      } else {
        const cap = selectedDebit
          ? Math.min(cand.amount, selectedDebit.remainingAmount)
          : cand.amount;
        next[cand.id] = String(cap);
      }
      return next;
    });
  };

  const selectedExistingTotal = useMemo(
    () =>
      Object.values(selectedMap).reduce((s, v) => {
        const n = parseFloat(v.replace(',', '.'));
        return s + (Number.isFinite(n) && n > 0 ? n : 0);
      }, 0),
    [selectedMap],
  );

  const splitTotal = useMemo(
    () =>
      splitItems.reduce((s, it) => {
        const n = parseFloat(it.amount.replace(',', '.'));
        return s + (Number.isFinite(n) && n > 0 ? n : 0);
      }, 0),
    [splitItems],
  );

  const handleSubmitExisting = () => {
    if (!selectedDebit) return;
    const allocations = Object.entries(selectedMap)
      .map(([transaction_id, val]) => ({
        transaction_id,
        allocated_amount: parseFloat(val.replace(',', '.')),
      }))
      .filter((a) => Number.isFinite(a.allocated_amount) && a.allocated_amount > 0);

    if (allocations.length === 0) return;

    linkMutation.mutate({
      mode: 'link_existing',
      bank_operation_id: selectedDebit.operationId,
      bank_operation_date: selectedDebit.operationDate,
      bank_operation_amount: selectedDebit.amount,
      bank_operation_desc: selectedDebit.description,
      allocations,
    });
  };

  const handleSubmitCreate = () => {
    if (!selectedDebit) return;
    const items = splitItems
      .map((it) => ({
        category_id: it.category_id || null,
        description: it.description.trim() || selectedDebit.description || 'Расход с Р/С',
        amount: parseFloat(it.amount.replace(',', '.')),
      }))
      .filter((it) => Number.isFinite(it.amount) && it.amount > 0);

    if (items.length === 0) return;

    linkMutation.mutate({
      mode: 'create_and_link',
      bank_operation_id: selectedDebit.operationId,
      bank_operation_date: selectedDebit.operationDate,
      bank_operation_amount: selectedDebit.amount,
      bank_operation_desc: selectedDebit.description,
      items,
    });
  };

  const handleBatchCommissions = () => {
    const comms = data?.unmatched_commissions ?? [];
    if (comms.length === 0) return;
    linkMutation.mutate({
      mode: 'batch_commissions',
      operations: comms.map((c) => ({
        operationId: c.operationId,
        operationDate: c.operationDate,
        amount: c.remainingAmount,
        description: c.description,
      })),
    });
  };

  const debits = data?.unmatched_debits ?? [];
  const commissions = data?.unmatched_commissions ?? [];

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      {/* Компактная шапка в 1 строку */}
      <header className="bg-white border-b border-zinc-200 px-3 h-12 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/admin/finance"
            className="text-zinc-500 font-bold text-sm px-1.5 py-1 -ml-1 active:scale-95"
          >
            ←
          </Link>
          <h1 className="font-black text-zinc-900 text-sm uppercase tracking-tight truncate">
            Привязка списаний Р/С
          </h1>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg active:scale-95 disabled:opacity-50 shrink-0"
        >
          {isFetching ? '...' : 'Обновить'}
        </button>
      </header>

      {toast && (
        <div className="mx-3 mt-2 px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-bold text-center">
          {toast}
        </div>
      )}

      <div className="p-3 space-y-2.5">
        {/* 1-строчная сводка */}
        <div className="bg-white border border-zinc-200 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
          <span className="font-bold text-zinc-600">
            Не разобрано (14 дн.):{' '}
            <span className="text-zinc-900">{data?.summary.unmatched_count ?? 0} шт</span>
          </span>
          <span className="font-black text-amber-600 tabular-nums">
            {fmtMoney(data?.summary.unmatched_total ?? 0)}
          </span>
        </div>

        {/* 1-строчная полоса комиссий банка */}
        {commissions.length > 0 && (
          <div className="bg-zinc-100 border border-zinc-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs">
            <span className="text-zinc-700 truncate">
              Комиссии банка: <b>{commissions.length}</b> ·{' '}
              {fmtMoney(data?.summary.commissions_total ?? 0)}
            </span>
            <button
              onClick={handleBatchCommissions}
              disabled={linkMutation.isPending}
              className="shrink-0 bg-zinc-900 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] active:scale-95 disabled:opacity-50"
            >
              Списать все
            </button>
          </div>
        )}

        {/* Список списаний — строго 1 строка на запись */}
        {isLoading ? (
          <div className="space-y-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-11 bg-zinc-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : debits.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 text-center">
            <p className="text-sm font-black text-emerald-700">Все списания с Р/С разобраны</p>
            <p className="text-xs text-zinc-500 mt-1">
              За последние 14 дней неразобранных списаний нет.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-100 overflow-hidden">
            {debits.map((d) => {
              const title = d.isPersonalWithdrawal
                ? 'Вывод на карту'
                : d.receiverName || d.description || 'Списание Р/С';
              return (
                <button
                  key={d.operationId}
                  onClick={() => openModal(d)}
                  className="w-full px-3 h-11 flex items-center gap-2 text-left hover:bg-amber-50/40 active:bg-amber-50 transition-colors"
                >
                  <span className="text-[11px] font-mono text-zinc-400 shrink-0 w-10">
                    {fmtShortDate(d.operationDate)}
                  </span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      d.status === 'partial' ? 'bg-blue-500' : 'bg-amber-500'
                    }`}
                  />
                  <span className="text-xs font-semibold text-zinc-900 truncate flex-1 min-w-0">
                    {title}
                  </span>
                  <span className="text-xs font-black text-zinc-900 tabular-nums shrink-0">
                    {fmtMoney(d.remainingAmount)}
                  </span>
                  <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md shrink-0">
                    Привязать
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Модальное окно привязки / разбивки */}
      {selectedDebit && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
          onClick={() => !linkMutation.isPending && setSelectedDebit(null)}
        >
          <div
            className="bg-white w-full sm:max-w-md max-h-[88vh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Шапка модалки */}
            <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-black text-zinc-900 tabular-nums">
                  {fmtMoney(selectedDebit.remainingAmount)}{' '}
                  <span className="text-xs font-normal text-zinc-400">
                    · {fmtShortDate(selectedDebit.operationDate)}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-500 truncate">
                  {selectedDebit.receiverName} — {selectedDebit.description}
                </div>
              </div>
              <button
                onClick={() => setSelectedDebit(null)}
                className="text-zinc-400 text-lg font-bold px-2 py-1 shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Переключатель режимов */}
            <div className="px-4 pt-2.5 pb-2 grid grid-cols-2 gap-1.5 bg-zinc-50 border-b border-zinc-200">
              <button
                onClick={() => setModalTab('existing')}
                className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  modalTab === 'existing'
                    ? 'bg-zinc-900 text-white'
                    : 'bg-white text-zinc-600 border border-zinc-200'
                }`}
              >
                К расходу (без дубля)
              </button>
              <button
                onClick={() => setModalTab('create')}
                className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  modalTab === 'create'
                    ? 'bg-zinc-900 text-white'
                    : 'bg-white text-zinc-600 border border-zinc-200'
                }`}
              >
                Новый / разбить
              </button>
            </div>

            {/* Тело модалки */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {modalTab === 'existing' ? (
                rankedCandidates.length === 0 ? (
                  <div className="text-center py-6 text-xs text-zinc-500">
                    Нет подходящих непривязанных расходов. Перейдите на вкладку «Новый / разбить».
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl overflow-hidden">
                    {rankedCandidates.slice(0, 30).map((cand) => {
                      const checked = selectedMap[cand.id] !== undefined;
                      const isExact = Math.abs(cand.amount - selectedDebit.remainingAmount) < 0.01;
                      return (
                        <div
                          key={cand.id}
                          onClick={() => toggleCandidate(cand)}
                          className={`px-2.5 py-2 flex items-center gap-2 cursor-pointer ${
                            checked ? 'bg-blue-50/70' : isExact ? 'bg-emerald-50/50' : 'bg-white'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {}}
                            className="w-4 h-4 accent-blue-600 shrink-0"
                          />
                          <span className="text-[11px] font-mono text-zinc-400 shrink-0">
                            {fmtShortDate(cand.date)}
                          </span>
                          <span className="text-xs text-zinc-900 truncate flex-1 min-w-0">
                            <b>{cand.categoryName}</b>
                            {cand.description ? ` · ${cand.description}` : ''}
                          </span>
                          {isExact && !checked && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">
                              Точно
                            </span>
                          )}
                          {checked ? (
                            <input
                              type="number"
                              inputMode="decimal"
                              value={selectedMap[cand.id]}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                setSelectedMap((prev) => ({ ...prev, [cand.id]: e.target.value }))
                              }
                              className="w-20 text-right text-xs font-bold border border-blue-300 rounded px-1.5 py-0.5 bg-white shrink-0"
                            />
                          ) : (
                            <span className="text-xs font-bold text-zinc-800 tabular-nums shrink-0">
                              {fmtMoney(cand.amount)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className="space-y-2">
                  {splitItems.map((it, idx) => (
                    <div
                      key={idx}
                      className="bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <select
                          value={it.category_id}
                          onChange={(e) =>
                            setSplitItems((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, category_id: e.target.value } : row,
                              ),
                            )
                          }
                          className="flex-1 min-w-0 text-xs font-semibold bg-white border border-zinc-300 rounded-lg px-2 py-1.5"
                        >
                          {(data?.categories ?? []).map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          inputMode="decimal"
                          placeholder="Сумма"
                          value={it.amount}
                          onChange={(e) =>
                            setSplitItems((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, amount: e.target.value } : row,
                              ),
                            )
                          }
                          className="w-24 text-right text-xs font-black bg-white border border-zinc-300 rounded-lg px-2 py-1.5 tabular-nums"
                        />
                        {splitItems.length > 1 && (
                          <button
                            onClick={() =>
                              setSplitItems((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="text-zinc-400 font-bold text-xs px-1"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Комментарий (например: Налоги, Запчасти...)"
                        value={it.description}
                        onChange={(e) =>
                          setSplitItems((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, description: e.target.value } : row,
                            ),
                          )
                        }
                        className="w-full text-xs bg-white border border-zinc-300 rounded-lg px-2.5 py-1.5"
                      />
                    </div>
                  ))}

                  <button
                    onClick={() => {
                      const rem = Math.max(
                        0,
                        Math.round((selectedDebit.remainingAmount - splitTotal) * 100) / 100,
                      );
                      setSplitItems((prev) => [
                        ...prev,
                        {
                          category_id: data?.categories?.[0]?.id || '',
                          description: '',
                          amount: rem > 0 ? String(rem) : '',
                        },
                      ]);
                    }}
                    className="w-full py-2 border border-dashed border-zinc-300 rounded-xl text-xs font-bold text-zinc-600 active:bg-zinc-100"
                  >
                    + Добавить позицию (разбить сумму)
                  </button>
                </div>
              )}
            </div>

            {/* Футер модалки */}
            <div className="px-4 py-3 border-t border-zinc-200 bg-white flex items-center justify-between gap-3">
              <div className="text-xs text-zinc-600 tabular-nums">
                Выбрано:{' '}
                <b className="text-zinc-900">
                  {fmtMoney(modalTab === 'existing' ? selectedExistingTotal : splitTotal)}
                </b>
              </div>
              <button
                onClick={modalTab === 'existing' ? handleSubmitExisting : handleSubmitCreate}
                disabled={
                  linkMutation.isPending ||
                  (modalTab === 'existing' ? selectedExistingTotal <= 0 : splitTotal <= 0)
                }
                className="bg-blue-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl active:scale-95 disabled:opacity-40"
              >
                {linkMutation.isPending
                  ? 'Сохранение...'
                  : modalTab === 'existing'
                    ? 'Привязать'
                    : 'Создать и привязать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
