'use client';

import { Fragment, useMemo, useState } from 'react';
import {
  BANK_ID,
  CASH_ID,
  FUEL_CARD_ID,
  type DailyBalanceData,
  type EditingTxState,
  type ExpenseItem,
  type IncomeItem,
  type TBankOp,
} from './types';
import type { LinkBankOpPayload } from './useDailyControlData';
import type { UnmatchedDebitItem } from './UnmatchedBankDebitsBanner';
import { rub } from './utils';

type LedgerFilter = 'all' | 'expense' | 'income' | 'unlinked';

interface UnifiedRow {
  key: string;
  direction: 'income' | 'expense';
  time: string;
  dateSort: number;
  wallet: 'bank' | 'cash' | 'fuel_card';
  walletLabel: string;
  category: string;
  title: string;
  author: string;
  amount: number;
  isGroup?: boolean;
  expenseItem?: ExpenseItem;
  incomeItem?: IncomeItem;
  isLinkedToBank: boolean | null; // true = linked, false = unlinked bank op/tx, null = non-bank
}

export function DailyLedgerTable({
  data,
  expenseItems,
  incomeItems,
  expandedGroups,
  linkPending,
  onToggleGroup,
  onEditTx,
  onOpenIncomeLinkModal,
  onQuickLinkIncome,
  onOpenDebitLinkModal,
}: {
  data?: DailyBalanceData;
  expenseItems: ExpenseItem[];
  incomeItems: IncomeItem[];
  expandedGroups: Record<string, boolean>;
  linkPending: boolean;
  onToggleGroup: (key: string) => void;
  onEditTx: (tx: EditingTxState) => void;
  onOpenIncomeLinkModal: (op: TBankOp, suggestedOrderId?: string) => void;
  onQuickLinkIncome: (payload: LinkBankOpPayload) => void;
  onOpenDebitLinkModal: (item: UnmatchedDebitItem) => void;
}) {
  const [filterTab, setFilterTab] = useState<LedgerFilter>('all');
  const [search, setSearch] = useState('');

  const linkedTxIds = useMemo(() => {
    const set = new Set<string>();
    for (const l of data?.bank_debit_links ?? []) {
      if (l.transaction_id) set.add(l.transaction_id);
    }
    const bankIds = new Set((data?.bank_operations ?? []).map((o) => String(o.operationId)));
    for (const tx of data?.transactions ?? []) {
      if (tx.idempotency_key && bankIds.has(String(tx.idempotency_key))) {
        set.add(tx.id);
      }
    }
    return set;
  }, [data?.bank_debit_links, data?.bank_operations, data?.transactions]);

  const rows = useMemo<UnifiedRow[]>(() => {
    const list: UnifiedRow[] = [];

    for (const exp of expenseItems) {
      const wLabel = exp.wallet === 'bank' ? '🏦 Р/С' : exp.wallet === 'cash' ? '🔒 Сейф' : '⛽ ТК';
      let isLinkedToBank: boolean | null = null;
      if (exp.wallet === 'bank') {
        if (exp.bankOp && !exp.rawTx) {
          isLinkedToBank = false;
        } else if (exp.rawTx) {
          isLinkedToBank = linkedTxIds.has(exp.rawTx.id);
        }
      }

      list.push({
        key: `exp-${exp.id}`,
        direction: 'expense',
        time: exp.time || '—',
        dateSort: exp.dateSort ?? 0,
        wallet: exp.wallet,
        walletLabel: wLabel,
        category: exp.category || 'Без статьи',
        title: exp.title,
        author: exp.author,
        amount: exp.amount,
        isGroup: exp.isGroup,
        expenseItem: exp,
        isLinkedToBank,
      });
    }

    for (const inc of incomeItems) {
      const wLabel = inc.wallet === 'bank' ? '🏦 Р/С' : inc.wallet === 'cash' ? '🔒 Сейф' : '⛽ ТК';
      let isLinkedToBank: boolean | null = null;
      if (inc.wallet === 'bank') {
        isLinkedToBank = Boolean(inc.isLinked || (inc.rawTx && !inc.canLinkToTrip));
      }

      list.push({
        key: `inc-${inc.id}`,
        direction: 'income',
        time: inc.time || '—',
        dateSort: inc.dateSort ?? 0,
        wallet: inc.wallet,
        walletLabel: wLabel,
        category: inc.category || 'Поступление',
        title: inc.title,
        author: inc.author,
        amount: inc.amount,
        isGroup: inc.isGroup,
        incomeItem: inc,
        isLinkedToBank,
      });
    }

    return list.sort((a, b) => b.dateSort - a.dateSort);
  }, [expenseItems, incomeItems, linkedTxIds]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterTab === 'expense' && r.direction !== 'expense') return false;
      if (filterTab === 'income' && r.direction !== 'income') return false;
      if (filterTab === 'unlinked' && r.isLinkedToBank !== false) return false;
      if (q) {
        const hay = `${r.time} ${r.category} ${r.title} ${r.author} ${r.amount}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filterTab, search]);

  const { totalIn, totalOut, unlinkedCount } = useMemo(() => {
    let sumIn = 0;
    let sumOut = 0;
    let unlinked = 0;
    for (const r of rows) {
      if (r.isLinkedToBank === false) unlinked++;
    }
    for (const r of filteredRows) {
      if (r.direction === 'income') sumIn += r.amount;
      else sumOut += r.amount;
    }
    return { totalIn: sumIn, totalOut: sumOut, unlinkedCount: unlinked };
  }, [rows, filteredRows]);

  const openEditFromExpense = (exp: ExpenseItem) => {
    const walletId =
      exp.wallet === 'cash' ? CASH_ID : exp.wallet === 'fuel_card' ? FUEL_CARD_ID : BANK_ID;
    onEditTx({
      id: exp.id,
      description: exp.title,
      amount: exp.amount,
      categoryId: exp.categoryId ?? exp.rawTx?.category_id ?? null,
      categoryName: exp.category,
      direction: 'expense',
      fromWalletId: exp.rawTx?.from_wallet_id ?? walletId,
      toWalletId: exp.rawTx?.to_wallet_id ?? null,
      obligationId: exp.linkedObligationId ?? null,
      transactionDate:
        exp.rawTx?.transaction_date ||
        exp.rawTx?.created_at ||
        exp.bankOp?.authorizationDate ||
        exp.bankOp?.operationDate,
      relatedUserId: exp.rawTx?.related_user_id ?? null,
      warehousePart: exp.rawTx?.warehouse_part ?? null,
      warehouseParts: exp.rawTx?.warehouse_parts ?? [],
    });
  };

  const openEditFromIncome = (inc: IncomeItem) => {
    const walletId =
      inc.wallet === 'cash' ? CASH_ID : inc.wallet === 'fuel_card' ? FUEL_CARD_ID : BANK_ID;
    onEditTx({
      id: inc.id,
      description: inc.title,
      amount: inc.amount,
      categoryId: inc.rawTx?.category_id ?? null,
      categoryName: inc.category,
      direction: 'income',
      fromWalletId: inc.rawTx?.from_wallet_id ?? null,
      toWalletId: inc.rawTx?.to_wallet_id ?? walletId,
      transactionDate:
        inc.rawTx?.transaction_date ||
        inc.rawTx?.created_at ||
        inc.bankOp?.authorizationDate ||
        inc.bankOp?.operationDate,
    });
  };

  const openDebitLinkFromRow = (exp: ExpenseItem) => {
    if (!exp.bankOp) return;
    const op = exp.bankOp;
    const total = op.operationAmount || op.rubleAmount || exp.amount;
    const linked = Math.max(0, Math.round((total - exp.amount) * 100) / 100);
    onOpenDebitLinkModal({
      operationId: op.operationId,
      operationDate:
        op.authorizationDate || op.trxnPostDate || op.operationDate || new Date().toISOString(),
      amount: total,
      linkedAmount: linked,
      remainingAmount: exp.amount,
      status: linked > 0 ? 'partial' : 'unmatched',
      receiverName: op.receiver?.name || op.counterParty?.name || exp.author,
      description: op.description || op.payPurpose || exp.title,
      isPersonalWithdrawal: /перевод собственных средств|на карту/i.test(
        `${op.description || ''} ${op.payPurpose || ''}`,
      ),
      isCommission: false,
      linkedTransactionIds: [],
      rawOp: op,
    });
  };

  const netSaldo = totalIn - totalOut;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs text-xs">
      {/* Тулбар таблицы в 1 строку */}
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 flex-wrap">
          {(
            [
              { id: 'all', label: `Все (${rows.length})` },
              { id: 'expense', label: `− Расходы (${expenseItems.length})` },
              { id: 'income', label: `+ Приходы (${incomeItems.length})` },
              { id: 'unlinked', label: `⚠️ Без связи с банком (${unlinkedCount})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilterTab(t.id)}
              className={`px-2.5 py-1 rounded-md font-bold cursor-pointer transition text-[11px] ${
                filterTab === t.id
                  ? 'bg-slate-900 text-white'
                  : t.id === 'unlinked' && unlinkedCount > 0
                    ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                    : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по описанию, статье, сумме..."
            className="px-2.5 py-1 rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 w-56 focus:outline-none focus:border-indigo-500 text-xs"
          />
          <span className="font-mono tabular-nums text-[11px] text-slate-500">
            {filteredRows.length} строк
          </span>
        </div>
      </div>

      {/* Excel-таблица (строго 1 строка = 1 операция) */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/80 text-slate-500 text-left font-bold border-b border-slate-200 select-none">
              <th className="px-2 py-1.5 w-[32px] text-center border-r border-slate-200">#</th>
              <th className="px-2 py-1.5 w-[98px] border-r border-slate-200">Время</th>
              <th className="px-2 py-1.5 w-[82px] border-r border-slate-200">Кошелёк</th>
              <th className="px-2 py-1.5 w-[140px] border-r border-slate-200">Статья</th>
              <th className="px-2 py-1.5 border-r border-slate-200">Описание / Контрагент</th>
              <th className="px-2 py-1.5 w-[165px] border-r border-slate-200">Связь / Статус</th>
              <th className="px-2 py-1.5 w-[112px] text-right border-r border-slate-200">
                Приход (+)
              </th>
              <th className="px-2 py-1.5 w-[112px] text-right border-r border-slate-200">
                Расход (−)
              </th>
              <th className="px-2 py-1.5 w-[84px] text-center">Действ.</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400">
                  Нет операций по выбранному фильтру
                </td>
              </tr>
            ) : (
              filteredRows.map((row, idx) => {
                const exp = row.expenseItem;
                const inc = row.incomeItem;
                const isGroupExpanded = Boolean(row.isGroup && expandedGroups[row.key]);

                return (
                  <Fragment key={row.key}>
                    <tr className="border-b border-slate-200/80 hover:bg-indigo-50/40 transition">
                      <td className="px-2 py-1.5 text-center font-mono text-[11px] text-slate-400 border-r border-slate-100">
                        {idx + 1}
                      </td>
                      <td className="px-2 py-1.5 font-mono tabular-nums text-[11px] text-slate-500 whitespace-nowrap border-r border-slate-100">
                        {row.time}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap font-bold text-slate-700 border-r border-slate-100">
                        {row.walletLabel}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap border-r border-slate-100">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded font-bold text-[11px] truncate max-w-[132px] ${
                            row.direction === 'income'
                              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                              : row.isLinkedToBank === false && exp?.bankOp
                                ? 'bg-amber-100 text-amber-950 border border-amber-300'
                                : 'bg-slate-100 text-slate-800 border border-slate-200'
                          }`}
                          title={row.category}
                        >
                          {row.category}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 border-r border-slate-100 max-w-[360px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {row.isGroup && (
                            <button
                              type="button"
                              onClick={() => onToggleGroup(row.key)}
                              className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 font-black text-[10px] cursor-pointer flex-shrink-0"
                            >
                              {isGroupExpanded ? '▲' : '▼'}
                            </button>
                          )}
                          <span
                            className="font-semibold text-slate-900 truncate"
                            title={`${row.title} · ${row.author}`}
                          >
                            {row.title}
                          </span>
                          {exp?.linkedObligationTitle && (
                            <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-800 border border-blue-200 font-bold text-[10px] flex-shrink-0">
                              📅 {exp.linkedObligationTitle}
                            </span>
                          )}
                          {exp?.rawTx?.warehouse_parts && exp.rawTx.warehouse_parts.length > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-sky-50 text-sky-800 border border-sky-200 font-bold text-[10px] flex-shrink-0">
                              📦 +{exp.rawTx.warehouse_parts.length} дет.
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap border-r border-slate-100">
                        {row.direction === 'expense' ? (
                          exp?.bankOp && !exp.rawTx ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                              ⚠️ API · Требует привязки
                            </span>
                          ) : row.isLinkedToBank === true ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              🔗 Т-Банк ✓
                            </span>
                          ) : row.isLinkedToBank === false ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px]">
                              ⚠️ Не привязан к Р/С
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">{row.author}</span>
                          )
                        ) : inc?.isLinked ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            ✓{' '}
                            {inc.linkTypeLabel ||
                              (inc.linkedTripNumber ? `Рейс №${inc.linkedTripNumber}` : 'Привязан')}
                          </span>
                        ) : inc?.canLinkToTrip ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-100 text-sky-900 font-bold text-[10px]">
                            🔗 Не привязан к рейсу
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">{row.author}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums font-black text-emerald-600 whitespace-nowrap border-r border-slate-100">
                        {row.direction === 'income' ? `+${rub(row.amount)}` : ''}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums font-black text-rose-600 whitespace-nowrap border-r border-slate-100">
                        {row.direction === 'expense' ? `−${rub(row.amount)}` : ''}
                      </td>
                      <td className="px-2 py-1.5 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {exp?.bankOp && !exp.rawTx && !row.isGroup && (
                            <button
                              type="button"
                              onClick={() => openDebitLinkFromRow(exp)}
                              className="px-1.5 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] cursor-pointer"
                              title="Привязать списание к расходу"
                            >
                              🔗
                            </button>
                          )}
                          {inc?.bankOp && inc.canLinkToTrip && (
                            <button
                              type="button"
                              disabled={linkPending}
                              onClick={() => {
                                if (inc.suggestedOrder) {
                                  onQuickLinkIncome({
                                    operationId: inc.bankOp!.operationId,
                                    tripOrderId: inc.suggestedOrder.id,
                                    amount: inc.amount,
                                    operationDate: inc.bankOp!.operationDate,
                                  });
                                } else {
                                  onOpenIncomeLinkModal(inc.bankOp!);
                                }
                              }}
                              className="px-1.5 py-0.5 rounded bg-sky-600 hover:bg-sky-700 text-white font-bold text-[10px] cursor-pointer"
                              title="Привязать поступление к рейсу"
                            >
                              🔗
                            </button>
                          )}
                          {!row.isGroup && (
                            <button
                              type="button"
                              onClick={() =>
                                row.direction === 'expense' && exp
                                  ? openEditFromExpense(exp)
                                  : inc
                                    ? openEditFromIncome(inc)
                                    : undefined
                              }
                              className="px-1.5 py-0.5 rounded border border-slate-300 hover:border-indigo-500 text-slate-600 hover:text-indigo-700 text-[10px] cursor-pointer"
                              title="Редактировать"
                            >
                              ✏️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Раскрытие сгруппированных микро-строк */}
                    {isGroupExpanded &&
                      (exp?.subItems ?? inc?.subItems ?? []).map((sub) => (
                        <tr
                          key={`${row.key}-${sub.id}`}
                          className="bg-slate-50/90 border-b border-slate-100"
                        >
                          <td className="px-2 py-1 text-center text-slate-300 border-r border-slate-100">
                            ↳
                          </td>
                          <td className="px-2 py-1 font-mono text-[10px] text-slate-500 border-r border-slate-100">
                            {sub.time}
                          </td>
                          <td className="px-2 py-1 text-[10px] text-slate-400 border-r border-slate-100">
                            {row.walletLabel}
                          </td>
                          <td className="px-2 py-1 text-[10px] text-slate-500 border-r border-slate-100">
                            {row.category}
                          </td>
                          <td
                            className="px-2 py-1 text-[11px] text-slate-700 truncate max-w-[360px] border-r border-slate-100"
                            title={sub.title}
                          >
                            {sub.title}
                          </td>
                          <td className="px-2 py-1 text-[10px] text-slate-400 border-r border-slate-100">
                            {sub.author}
                          </td>
                          <td className="px-2 py-1 text-right font-mono tabular-nums text-[11px] font-bold text-emerald-600 border-r border-slate-100">
                            {row.direction === 'income' ? `+${rub(sub.amount)}` : ''}
                          </td>
                          <td className="px-2 py-1 text-right font-mono tabular-nums text-[11px] font-bold text-rose-600 border-r border-slate-100">
                            {row.direction === 'expense' ? `−${rub(sub.amount)}` : ''}
                          </td>
                          <td className="px-2 py-1 text-center text-[10px] text-slate-300">—</td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })
            )}
          </tbody>

          {/* Итоговая строка Excel */}
          <tfoot>
            <tr className="bg-slate-100 border-t-2 border-slate-300 font-black">
              <td
                colSpan={6}
                className="px-3 py-2 text-right text-slate-600 uppercase tracking-wider text-[11px] border-r border-slate-200"
              >
                Итого по таблице ({filteredRows.length}):
              </td>
              <td className="px-2 py-2 text-right font-mono tabular-nums text-emerald-700 whitespace-nowrap border-r border-slate-200">
                +{rub(totalIn)}
              </td>
              <td className="px-2 py-2 text-right font-mono tabular-nums text-rose-700 whitespace-nowrap border-r border-slate-200">
                −{rub(totalOut)}
              </td>
              <td
                className={`px-2 py-2 text-center font-mono tabular-nums text-[11px] whitespace-nowrap ${
                  netSaldo >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {netSaldo >= 0 ? '+' : '−'}
                {rub(Math.abs(netSaldo))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
