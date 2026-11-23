'use client';

import {
  BANK_ID,
  CASH_ID,
  type DailyBalanceData,
  type EditingTxState,
  type IncomeItem,
  type PeriodMode,
  type TBankOp,
} from './types';
import type { LinkBankOpPayload } from './useDailyControlData';
import { rub } from './utils';

export function DailyIncomesColumn({
  data,
  period,
  selectedDate,
  incomeItems,
  totalDayIncomes,
  expandedGroups,
  linkPending,
  onToggleGroup,
  onOpenManualIncome,
  onEditIncome,
  onLinkBankOp,
  onOpenLinkModal,
}: {
  data: DailyBalanceData | undefined;
  period: PeriodMode;
  selectedDate: string;
  incomeItems: IncomeItem[];
  totalDayIncomes: number;
  expandedGroups: Record<string, boolean>;
  linkPending: boolean;
  onToggleGroup: (key: string) => void;
  onOpenManualIncome: () => void;
  onEditIncome: (tx: EditingTxState) => void;
  onLinkBankOp: (payload: LinkBankOpPayload) => void;
  onOpenLinkModal: (op: TBankOp, suggestedOrderId?: string) => void;
}) {
  const qrOrders = (data?.trip_orders ?? []).filter((o) => o.payment_method === 'qr');
  const qrCompleted = qrOrders.filter(
    (o) =>
      (data?.transactions ?? []).some((t) => t.trip_order_id === o.id) ||
      o.settlement_status === 'completed',
  );
  const qrPending = qrOrders.filter((o) => !qrCompleted.some((c) => c.id === o.id));
  const totalQrAmt = qrOrders.reduce((s, o) => s + parseFloat(o.amount || '0'), 0);
  const pendingAmt = qrPending.reduce((s, o) => s + parseFloat(o.amount || '0'), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-white rounded-2xl border-2 border-emerald-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[9px] font-black">
            +
          </span>
          <span className="text-xs font-black uppercase tracking-tight text-slate-900">
            ДОХОДЫ ЗА {period === 'day' ? 'СЕГОДНЯ' : period === 'week' ? 'НЕДЕЛЮ' : 'МЕСЯЦ'}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono">
            {incomeItems.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs font-black font-mono text-emerald-600">
            +{rub(totalDayIncomes)}
          </div>
          <button
            onClick={onOpenManualIncome}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black shadow-xs flex items-center gap-1 cursor-pointer transition"
          >
            <span>+</span> <span>Пополнение</span>
          </button>
        </div>
      </div>

      {qrOrders.length > 0 && (
        <div className="p-3 bg-white text-slate-850 rounded-2xl border-2 border-slate-200 text-xs flex flex-col gap-2 shadow-2xs">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">📱</span>
              <span className="font-black text-slate-900 uppercase tracking-wide text-[10px]">
                Сверка QR-кодов от водителей
              </span>
              <span className="text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md font-bold">
                Всего: {qrOrders.length} ({rub(totalQrAmt)})
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">
                ✓ В банке: {qrCompleted.length}
              </span>
              <span
                className={`px-2 py-0.5 rounded-md font-black ${
                  qrPending.length > 0
                    ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}
              >
                {qrPending.length > 0
                  ? `⚠️ НЕ ДОШЛО: ${qrPending.length} (${rub(pendingAmt)})`
                  : 'Все оплачены ✓'}
              </span>
            </div>
          </div>

          {qrPending.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-[11px] space-y-1.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-rose-900 flex items-center justify-between">
                <span>Заказы с QR, по которым оплата ещё НЕ поступила:</span>
                <span className="text-rose-700 font-bold">Требуется проверка водителей</span>
              </div>
              {qrPending.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between text-slate-700 py-0.5 border-b border-rose-100 last:border-0"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    <span className="font-bold text-slate-900">
                      {o.trip?.trip_number ? `Рейс №${o.trip.trip_number}` : 'Рейс'}
                    </span>
                    <span className="text-slate-600 font-medium">
                      ({o.trip?.driver?.name || 'Водитель'})
                    </span>
                    {o.counterparty?.name && (
                      <span className="text-[10px] text-slate-500">· {o.counterparty.name}</span>
                    )}
                  </div>
                  <span className="font-mono font-black text-rose-700">
                    {rub(parseFloat(o.amount || '0'))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2.5">
        {incomeItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-white rounded-2xl border-2 border-dashed border-slate-200">
            Нет поступлений за выбранный{' '}
            {period === 'day' ? 'день' : period === 'week' ? 'период (неделю)' : 'период (месяц)'}
          </div>
        ) : (
          incomeItems.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-xl border shadow-2xs flex flex-col overflow-hidden group transition ${
                !item.isLinked && item.canLinkToTrip
                  ? 'border-amber-400 hover:border-amber-500 bg-amber-50/20 border-l-4 border-l-amber-500'
                  : 'border-slate-300 hover:border-slate-400 border-l-4 border-l-emerald-500'
              }`}
            >
              <div className="flex items-stretch flex-1">
                <div
                  className={`w-1.5 flex-shrink-0 group-hover:w-2 transition-all ${
                    item.wallet === 'cash'
                      ? 'bg-emerald-500'
                      : item.category.toLowerCase().includes('безнал')
                        ? 'bg-sky-500'
                        : !item.isLinked && item.canLinkToTrip
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                  }`}
                />

                <div className="p-3 flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-slate-900 truncate">
                        {item.title}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                        {item.category}
                      </span>
                      {item.isGroup && (
                        <button
                          onClick={() => onToggleGroup(item.id)}
                          className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded hover:bg-emerald-200 transition cursor-pointer flex items-center gap-1"
                        >
                          <span>{expandedGroups[item.id] ? '▲ Свернуть' : '▼ Раскрыть'}</span>
                          <span className="bg-emerald-200/80 px-1 rounded-sm text-[8px]">
                            {item.subItems?.length}
                          </span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1 flex-wrap">
                      <span
                        className={`px-1.5 py-0.2 rounded font-bold border text-[10px] ${
                          item.wallet === 'bank'
                            ? 'bg-sky-50 text-sky-800 border-sky-200'
                            : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        }`}
                      >
                        {item.wallet === 'bank' ? '🏦' : '🔒'} {item.walletName}
                      </span>
                      <span>·</span>
                      <span className="text-slate-500">{item.author}</span>
                      {item.time && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-slate-400">{item.time}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0 self-start sm:self-center">
                    {item.bankOp && item.canLinkToTrip ? (
                      item.isLinked ? (
                        <div className="flex items-center gap-1.5">
                          <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-950 border-2 border-emerald-200 text-[11px] font-black px-2.5 py-1 rounded-xl shadow-2xs">
                            <span>
                              {item.linkTypeLabel?.includes('Заказ-наряд')
                                ? '🔧'
                                : item.linkTypeLabel?.includes('Диспетчер')
                                  ? '🤝'
                                  : '🚚'}
                            </span>
                            <span>
                              {item.linkTypeLabel ||
                                (item.linkedTripNumber
                                  ? `Рейс №${item.linkedTripNumber}`
                                  : 'Связано')}
                            </span>
                            <span className="text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded text-[10px]">
                              ✓
                            </span>
                          </div>
                          <button
                            onClick={() =>
                              onLinkBankOp({
                                operationId: item.bankOp!.operationId,
                                action: 'unlink',
                              })
                            }
                            disabled={linkPending}
                            className="text-[10px] text-slate-400 hover:text-rose-600 font-bold cursor-pointer"
                            title="Отвязать операцию"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.suggestedOrder && (
                            <button
                              onClick={() =>
                                onLinkBankOp({
                                  operationId: item.bankOp!.operationId,
                                  tripOrderId: item.suggestedOrder!.id,
                                  amount: item.amount,
                                  operationDate:
                                    item.bankOp?.trxnPostDate ||
                                    item.bankOp?.authorizationDate ||
                                    item.bankOp?.operationDate,
                                  date: selectedDate,
                                  action: 'link',
                                })
                              }
                              disabled={linkPending}
                              className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-xs border-2 border-amber-500/40 flex items-center gap-1 cursor-pointer transition"
                              title="Быстро связать с совпадающим заказом рейса"
                            >
                              <span>⚡</span>
                              <span>
                                Рейс №{item.suggestedOrder.trip?.trip_number} (
                                {item.suggestedOrder.trip?.driver?.name})
                              </span>
                            </button>
                          )}
                          <button
                            onClick={() => onOpenLinkModal(item.bankOp!, item.suggestedOrder?.id)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] rounded-xl border border-slate-300 cursor-pointer transition"
                          >
                            🔗 Связать (Рейс / Гараж / Диспетчер)
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-900 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                        <span>✓ Зачислено</span>
                      </div>
                    )}
                  </div>

                  <div className="text-right flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-sm font-black font-mono text-emerald-600">
                      +{rub(item.amount)}
                    </div>
                    {item.rawTx && (
                      <button
                        onClick={() =>
                          onEditIncome({
                            id: item.rawTx!.id,
                            description: item.rawTx!.description || '',
                            amount: parseFloat(item.rawTx!.amount) || 0,
                            categoryId: item.rawTx!.category_id,
                            categoryName: item.rawTx!.category?.name,
                            direction: 'income',
                            toWalletId:
                              item.rawTx!.to_wallet_id ||
                              (item.wallet === 'cash' ? CASH_ID : BANK_ID),
                          })
                        }
                        className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 flex items-center justify-center text-xs font-black cursor-pointer shadow-2xs transition"
                        title="Редактировать название / категорию"
                      >
                        ✏️
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {item.isGroup && expandedGroups[item.id] && item.subItems && (
                <div className="w-full bg-slate-50/90 border-t-2 border-slate-200 p-2.5 space-y-1.5 pl-6">
                  <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                    ДЕТАЛИЗАЦИЯ ПОСТУПЛЕНИЙ:
                  </div>
                  {item.subItems.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60 last:border-0 hover:bg-slate-100/60 px-2 rounded-lg"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-slate-400">{sub.time}</span>
                        <span className="font-semibold text-slate-700">{sub.title}</span>
                        <span className="text-[10px] text-slate-400">({sub.author})</span>
                        {sub.rawTx && (
                          <button
                            onClick={() =>
                              onEditIncome({
                                id: sub.rawTx!.id,
                                description: sub.rawTx!.description || '',
                                amount: parseFloat(sub.rawTx!.amount) || 0,
                                categoryId: sub.rawTx!.category_id,
                                categoryName: sub.rawTx!.category?.name,
                                direction: 'income',
                                toWalletId:
                                  sub.rawTx!.to_wallet_id ||
                                  (item.wallet === 'cash' ? CASH_ID : BANK_ID),
                              })
                            }
                            className="text-[9px] text-slate-400 hover:text-sky-600 cursor-pointer ml-1 font-bold underline"
                          >
                            ✎
                          </button>
                        )}
                      </div>
                      <div className="font-mono font-bold text-emerald-600">+{rub(sub.amount)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
