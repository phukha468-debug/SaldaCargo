'use client';

import {
  BANK_ID,
  CASH_ID,
  FUEL_CARD_ID,
  type EditingTxState,
  type ExpenseItem,
  type PeriodMode,
} from './types';
import { rub } from './utils';

export function DailyExpensesColumn({
  period,
  selectedDate,
  expenseItems,
  totalDayExpenses,
  expandedGroups,
  onToggleGroup,
  onOpenManualExpense,
  onEditExpense,
}: {
  period: PeriodMode;
  selectedDate: string;
  expenseItems: ExpenseItem[];
  totalDayExpenses: number;
  expandedGroups: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
  onOpenManualExpense: () => void;
  onEditExpense: (tx: EditingTxState) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-white rounded-2xl border-2 border-rose-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-rose-500 flex items-center justify-center text-white text-[9px] font-black">
            −
          </span>
          <span className="text-xs font-black uppercase tracking-tight text-slate-900">
            РАСХОДЫ ЗА {period === 'day' ? 'СЕГОДНЯ' : period === 'week' ? 'НЕДЕЛЮ' : 'МЕСЯЦ'}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-mono">
            {expenseItems.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs font-black font-mono text-rose-600">-{rub(totalDayExpenses)}</div>
          <button
            onClick={onOpenManualExpense}
            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-black shadow-xs flex items-center gap-1 cursor-pointer transition"
          >
            <span>+</span> <span>Списание</span>
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {expenseItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-white rounded-2xl border-2 border-dashed border-slate-200">
            Нет расходов за выбранный{' '}
            {period === 'day' ? 'день' : period === 'week' ? 'период (неделю)' : 'период (месяц)'}
          </div>
        ) : (
          expenseItems.map((item) =>
            item.isGroup ? (
              <div
                key={item.id}
                className="bg-slate-50/90 rounded-2xl border-2 border-indigo-200/90 shadow-2xs flex flex-col overflow-hidden transition-all ring-1 ring-indigo-100"
              >
                <div className="flex items-stretch flex-1">
                  <div className="w-2 flex-shrink-0 bg-indigo-500" />
                  <div className="p-3.5 flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-950 font-black text-xs uppercase tracking-wider border border-indigo-300">
                          <span>🗂️</span> ГРУППА ПЛАТЕЖЕЙ
                        </span>
                        <span className="text-xs font-black text-slate-900">{item.title}</span>
                        <span className="px-2.5 py-1 rounded-lg bg-white text-indigo-900 text-xs font-black uppercase tracking-wide border border-indigo-200">
                          {item.category}
                        </span>
                        <button
                          onClick={() => onToggleGroup(item.id)}
                          className="text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                        >
                          <span>
                            {expandedGroups[item.id] ? '▲ Свернуть' : '▼ Раскрыть детализацию'}
                          </span>
                          <span className="bg-indigo-800 text-indigo-100 px-1.5 py-0.2 rounded text-[10px]">
                            {item.subItems?.length} списаний
                          </span>
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1.5 flex-wrap">
                        <span className="px-1.5 py-0.2 rounded font-bold border text-[10px] bg-sky-50 text-sky-800 border-sky-200">
                          🏦 {item.walletName}
                        </span>
                        <span>·</span>
                        <span className="text-slate-600 font-medium">{item.author}</span>
                        <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-semibold">
                          {item.subItems?.length} микро-платежей объединены, чтобы не засорять ленту
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                      <div className="text-sm font-black font-mono text-indigo-950 bg-indigo-100/80 px-2.5 py-1 rounded-xl border border-indigo-200">
                        -{rub(item.amount)}
                      </div>
                    </div>
                  </div>
                </div>

                {expandedGroups[item.id] && item.subItems && (
                  <div className="w-full bg-white/95 border-t border-indigo-200 p-3 space-y-1.5 pl-6">
                    <div className="text-[10px] font-black uppercase text-indigo-900 tracking-wider">
                      СПИСОК ВСЕХ СПИСАНИЙ В ГРУППЕ ({item.subItems.length}):
                    </div>
                    <div className="space-y-1">
                      {item.subItems.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 px-2 rounded-lg"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                              {sub.time}
                            </span>
                            <span className="font-semibold text-slate-800">{sub.title}</span>
                            <span className="text-[10px] text-slate-400">({sub.author})</span>
                          </div>
                          <div className="font-mono font-black text-rose-600 ml-2 flex-shrink-0">
                            -{rub(sub.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs flex flex-col overflow-hidden group transition border-l-4 border-l-rose-500"
              >
                <div className="flex items-stretch flex-1">
                  <div
                    className={`w-1 flex-shrink-0 group-hover:w-1.5 transition-all ${
                      item.wallet === 'fuel_card'
                        ? 'bg-amber-500'
                        : item.wallet === 'cash'
                          ? 'bg-emerald-500'
                          : 'bg-rose-500'
                    }`}
                  />
                  <div className="p-3 flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-950 text-xs font-black uppercase tracking-wide border border-rose-300 shadow-2xs flex items-center gap-1 flex-shrink-0">
                          <span>🏷️</span>
                          <span>{item.category || 'Без статьи'}</span>
                        </span>

                        <span
                          className="text-xs font-black text-slate-900 line-clamp-2 leading-tight break-words max-w-[420px]"
                          title={item.title}
                        >
                          {item.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1.5 flex-wrap">
                        <span
                          className={`px-1.5 py-0.2 rounded font-bold border text-[10px] ${
                            item.wallet === 'bank'
                              ? 'bg-sky-50 text-sky-800 border-sky-200'
                              : item.wallet === 'cash'
                                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                : 'bg-amber-50 text-amber-900 border-amber-200'
                          }`}
                        >
                          {item.wallet === 'bank' ? '🏦' : item.wallet === 'cash' ? '🔒' : '⛽'}{' '}
                          {item.walletName}
                        </span>
                        {item.time && (
                          <>
                            <span>·</span>
                            <span className="font-mono text-slate-400 font-bold">{item.time}</span>
                          </>
                        )}
                        <span>·</span>
                        <span className="text-slate-500">{item.author}</span>
                      </div>
                    </div>

                    <div className="flex-shrink-0 self-start sm:self-center flex flex-col sm:flex-row items-start sm:items-center gap-1.5">
                      {item.linkedObligationTitle ? (
                        <div className="inline-flex items-center gap-1.5 bg-blue-50/90 text-blue-950 border-2 border-blue-200 text-[11px] font-black px-2.5 py-1 rounded-xl shadow-2xs">
                          <span>📅</span>
                          <span>{item.linkedObligationTitle}</span>
                          <span className="text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded text-[10px]">
                            ✓ Закрыт
                          </span>
                        </div>
                      ) : null}

                      {item.rawTx?.warehouse_parts && item.rawTx.warehouse_parts.length > 0 ? (
                        <div
                          className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-950 border-2 border-sky-300 text-[11px] font-black px-2.5 py-1 rounded-xl shadow-2xs"
                          title={item.rawTx.warehouse_parts
                            .map((p) => `${p.name} (+${p.quantity} шт, ${rub(p.unit_price || 0)})`)
                            .join('\n')}
                        >
                          <span>📦</span>
                          <span>
                            {item.rawTx.warehouse_parts.length === 1
                              ? `Склад: ${item.rawTx.warehouse_parts[0]!.name}`
                              : `Склад: ${item.rawTx.warehouse_parts.length} дет. (${item.rawTx.warehouse_parts[0]!.name}...)`}
                          </span>
                          <span className="text-sky-700 bg-sky-100 font-black px-1.5 py-0.2 rounded text-[10px]">
                            +
                            {item.rawTx.warehouse_parts.reduce(
                              (acc, p) => acc + (Number(p.quantity) || 1),
                              0,
                            )}{' '}
                            шт
                          </span>
                        </div>
                      ) : item.rawTx?.warehouse_part ? (
                        <div className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-950 border-2 border-sky-300 text-[11px] font-black px-2.5 py-1 rounded-xl shadow-2xs">
                          <span>📦</span>
                          <span>Склад: {item.rawTx.warehouse_part.name}</span>
                          <span className="text-sky-700 bg-sky-100 font-black px-1.5 py-0.2 rounded text-[10px]">
                            +{item.rawTx.warehouse_part.quantity} шт
                          </span>
                        </div>
                      ) : null}

                      {!item.linkedObligationTitle &&
                        !item.rawTx?.warehouse_part &&
                        !(item.rawTx?.warehouse_parts && item.rawTx.warehouse_parts.length > 0) && (
                          <span className="text-[10px] text-slate-400 font-medium">
                            Без привязки
                          </span>
                        )}
                    </div>

                    <div className="text-right flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-sm font-black font-mono text-rose-600">
                        -{rub(item.amount)}
                      </div>
                      <button
                        onClick={() => {
                          const raw = item.rawTx;
                          const op = item.bankOp;
                          onEditExpense({
                            id: raw ? raw.id : op ? op.operationId : item.id,
                            description: raw
                              ? raw.description || ''
                              : op
                                ? op.description || op.payPurpose || ''
                                : item.title,
                            amount: item.amount,
                            categoryId: raw?.category_id || item.categoryId || null,
                            categoryName: raw?.category?.name || item.category,
                            direction:
                              (raw?.direction === 'income' || raw?.direction === 'transfer'
                                ? raw.direction
                                : 'expense') ||
                              (item.wallet === 'fuel_card' ? 'transfer' : 'expense'),
                            fromWalletId:
                              raw?.from_wallet_id ||
                              (item.wallet === 'cash'
                                ? CASH_ID
                                : item.wallet === 'fuel_card'
                                  ? FUEL_CARD_ID
                                  : BANK_ID),
                            toWalletId:
                              raw?.to_wallet_id ||
                              (item.wallet === 'fuel_card' ? FUEL_CARD_ID : null),
                            transactionDate:
                              raw?.transaction_date ||
                              raw?.created_at ||
                              (op
                                ? op.authorizationDate ||
                                  op.operationDate ||
                                  op.trxnPostDate ||
                                  op.operationTime
                                : selectedDate),
                            obligationId: item.linkedObligationId || null,
                            relatedUserId: raw?.related_user_id || raw?.related_user?.id || null,
                            warehousePart: raw?.warehouse_part || null,
                            warehouseParts:
                              raw?.warehouse_parts ||
                              (raw?.warehouse_part ? [raw.warehouse_part] : []),
                          });
                        }}
                        className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 flex items-center justify-center text-xs font-black cursor-pointer shadow-2xs transition"
                        title="Редактировать / изменить статью"
                      >
                        ✏️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ),
          )
        )}
      </div>
    </div>
  );
}
