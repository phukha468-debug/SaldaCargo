'use client';

import Link from 'next/link';
import type { AtiOrder } from './types';

export type AtiClaimsArchiveTab = 'claims' | 'claims_archive' | 'simple';

export function AtiClaimsArchiveModal({
  cancelledCount,
  activeTab,
  onChangeTab,
  activeClaimOrders,
  paidClaimOrders,
  paidClaimsSum,
  simpleCancelledOrders,
  restorePending,
  claimUpdatePending,
  onOpenAgreeClaim,
  onOpenClaimPrint,
  onRestoreOrder,
  onUpdateClaimStatus,
  onOpenClaimForSimple,
  onClose,
}: {
  cancelledCount: number;
  activeTab: AtiClaimsArchiveTab;
  onChangeTab: (tab: AtiClaimsArchiveTab) => void;
  activeClaimOrders: AtiOrder[];
  paidClaimOrders: AtiOrder[];
  paidClaimsSum: number;
  simpleCancelledOrders: AtiOrder[];
  restorePending: boolean;
  claimUpdatePending: boolean;
  onOpenAgreeClaim: (order: AtiOrder) => void;
  onOpenClaimPrint: (order: AtiOrder) => void;
  onRestoreOrder: (id: string) => void;
  onUpdateClaimStatus: (payload: {
    id: string;
    claim_status: 'issued' | 'agreed' | 'waiting_payment' | 'paid' | 'rejected';
  }) => void;
  onOpenClaimForSimple: (order: AtiOrder) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden my-auto">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🗂️</span>
            <div>
              <h3 className="font-black text-sm uppercase tracking-wide">
                Управление претензиями и срывами ({cancelledCount})
              </h3>
              <p className="text-[10px] text-slate-400">
                Претензионная работа, контроль оплат и история сорванных рейсов
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="px-5 pt-2.5 border-b border-slate-200 flex gap-2 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={() => onChangeTab('claims')}
            className={`pb-2 px-3 text-xs font-black border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'claims'
                ? 'border-amber-600 text-amber-900 bg-white rounded-t-lg border-t border-x border-b-white -mb-px'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>⚖️ Претензии в работе</span>
            <span className="bg-amber-100 text-amber-900 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
              {activeClaimOrders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('claims_archive')}
            className={`pb-2 px-3 text-xs font-black border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'claims_archive'
                ? 'border-emerald-600 text-emerald-900 bg-white rounded-t-lg border-t border-x border-b-white -mb-px'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>📁 Архив оплаченных</span>
            <span className="bg-emerald-100 text-emerald-900 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
              {paidClaimOrders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('simple')}
            className={`pb-2 px-3 text-xs font-black border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'simple'
                ? 'border-slate-800 text-slate-900 bg-white rounded-t-lg border-t border-x border-b-white -mb-px'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>❌ Срывы без претензий</span>
            <span className="bg-slate-200 text-slate-800 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
              {simpleCancelledOrders.length}
            </span>
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto flex-1 text-xs">
          {activeTab === 'claims' && (
            <>
              <div className="p-3 bg-indigo-50 border-2 border-indigo-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-indigo-950">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl shrink-0">🚀</span>
                  <div className="space-y-0.5">
                    <div className="font-black text-[11px]">
                      Как перемещать претензию дальше (попадание в Дебиторку):
                    </div>
                    <div className="text-[10px] text-indigo-900 leading-tight">
                      <strong>1. Выставили:</strong> претензия сформирована и отправлена заказчику.{' '}
                      <br />
                      <strong>2. Согласовали:</strong> когда заказчик подтвердил срыв, нажмите{' '}
                      <span className="font-bold underline">
                        «✓ Заказчик согласовал → В Дебиторку»
                      </span>{' '}
                      (контрагент сразу появится в разделе <strong>Дебиторка</strong>!). <br />
                      <strong>3. Оплата:</strong> после поступления денег на р/с нажмите{' '}
                      <span className="font-bold underline">«✓ Оплачено на Р/С»</span>.
                    </div>
                  </div>
                </div>
              </div>

              {activeClaimOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-bold space-y-2">
                  <div className="text-3xl">🎉</div>
                  <div className="text-sm text-slate-700 font-bold">
                    Нет активных претензий в работе
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Все претензии согласованы и оплачены заказчиками.
                  </div>
                  {paidClaimOrders.length > 0 && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => onChangeTab('claims_archive')}
                        className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs rounded-xl cursor-pointer transition"
                      >
                        📁 Перейти в Архив оплаченных ({paidClaimOrders.length})
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                activeClaimOrders.map((ord) => {
                  const status = ord.claim_status || 'issued';
                  return (
                    <div
                      key={ord.id}
                      className="p-3.5 bg-white rounded-2xl border-2 border-amber-300 shadow-2xs space-y-3 hover:border-amber-400 transition"
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-900 text-sm">
                              Претензия № {ord.claim_number || '01-ПР'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold">
                              к заявке {ord.order_number}
                            </span>
                            <span className="text-slate-400 font-mono text-[10px]">
                              от {ord.claim_date || new Date().toLocaleDateString('ru-RU')}
                            </span>
                          </div>
                          <div className="font-bold text-slate-900 text-xs mt-0.5">
                            Заказчик: {ord.counterparty_name}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block">
                            Сумма требований:
                          </span>
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="font-mono font-black text-amber-950 text-base">
                              {Number(ord.claim_amount || 6000).toLocaleString('ru-RU')} ₽
                            </span>
                            <button
                              type="button"
                              onClick={() => onOpenAgreeClaim(ord)}
                              className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-[10px] font-bold cursor-pointer transition"
                              title="Изменить согласованную сумму претензии"
                            >
                              ✏️ Изменить
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold">
                        <div
                          className={`p-1.5 rounded-lg border ${
                            status === 'issued'
                              ? 'bg-amber-100 border-amber-300 text-amber-950 font-black'
                              : 'bg-slate-100 border-slate-200 text-slate-500'
                          }`}
                        >
                          1. Выставили претензию
                        </div>
                        <div
                          className={`p-1.5 rounded-lg border ${
                            status === 'agreed' || status === 'waiting_payment'
                              ? 'bg-rose-100 border-rose-300 text-rose-950 font-black'
                              : status === 'paid'
                                ? 'bg-slate-100 border-slate-200 text-slate-500'
                                : 'bg-slate-50 border-slate-200 text-slate-400'
                          }`}
                        >
                          2. Согласовали / Дебиторка
                        </div>
                        <div
                          className={`p-1.5 rounded-lg border ${
                            status === 'paid'
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-950 font-black'
                              : 'bg-slate-50 border-slate-200 text-slate-400'
                          }`}
                        >
                          3. Ждём оплаты / Оплачено
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenClaimPrint(ord)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center gap-1.5 border border-slate-300 cursor-pointer transition"
                          >
                            <span>📄</span>
                            <span>Печать претензии</span>
                          </button>

                          <button
                            type="button"
                            disabled={restorePending}
                            onClick={() => onRestoreOrder(ord.id)}
                            className="px-2 py-1.5 bg-white hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-[11px] border border-slate-200 cursor-pointer transition"
                            title="Аннулировать претензию и вернуть рейс на Канбан"
                          >
                            ↶ На доску
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          {status === 'issued' && (
                            <button
                              type="button"
                              onClick={() => onOpenAgreeClaim(ord)}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs cursor-pointer shadow-xs transition"
                              title="Выбрать согласованную сумму (10%, 20%) и передать в Дебиторку"
                            >
                              ✓ Заказчик согласовал → Передать в Дебиторку
                            </button>
                          )}

                          {(status === 'agreed' || status === 'waiting_payment') && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onOpenAgreeClaim(ord)}
                                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-bold text-xs cursor-pointer transition"
                                title="Изменить согласованную сумму претензии в Дебиторке"
                              >
                                ✏️ Изменить сумму
                              </button>
                              <Link
                                href="/receivables"
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl font-bold text-xs flex items-center gap-1 transition"
                              >
                                <span>
                                  В Дебиторке:{' '}
                                  {Number(ord.claim_amount || 6000).toLocaleString('ru-RU')} ₽
                                </span>
                                <span>↗</span>
                              </Link>
                              <button
                                type="button"
                                disabled={claimUpdatePending}
                                onClick={() =>
                                  onUpdateClaimStatus({ id: ord.id, claim_status: 'paid' })
                                }
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs cursor-pointer shadow-xs transition"
                              >
                                ✓ Оплачено на Р/С
                              </button>
                            </div>
                          )}

                          {status === 'paid' && (
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl font-black text-xs">
                              ✓ Претензия оплачена
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {activeTab === 'claims_archive' && (
            <>
              <div className="p-3 bg-emerald-50 border-2 border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-emerald-950">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl shrink-0">📁</span>
                  <div className="space-y-0.5">
                    <div className="font-black text-[11px]">
                      Архив успешно оплаченных претензий по срывам
                    </div>
                    <div className="text-[10px] text-emerald-900 leading-tight">
                      Здесь хранятся закрытые претензии, по которым заказчики перечислили штраф на
                      расчётный счёт. Они не занимают место на доске и закрыты в дебиторке.
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-emerald-700 font-bold block">
                    Всего взыскано:
                  </span>
                  <span className="font-mono font-black text-emerald-950 text-sm">
                    {paidClaimsSum.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </div>

              {paidClaimOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-bold">
                  В архиве пока нет оплаченных претензий.
                </div>
              ) : (
                paidClaimOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3.5 bg-white rounded-2xl border-2 border-emerald-300 shadow-2xs space-y-3 hover:border-emerald-400 transition"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-slate-900 text-sm">
                            Претензия № {ord.claim_number || '01-ПР'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold">
                            к заявке {ord.order_number}
                          </span>
                          <span className="text-slate-400 font-mono text-[10px]">
                            от {ord.claim_date || new Date().toLocaleDateString('ru-RU')}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                            ✓ Оплачено на Р/С
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 text-xs mt-0.5">
                          Заказчик: {ord.counterparty_name}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block">Оплаченная сумма:</span>
                        <span className="font-mono font-black text-emerald-700 text-base">
                          + {Number(ord.claim_amount || 6000).toLocaleString('ru-RU')} ₽
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] bg-emerald-50/60 p-2 rounded-xl border border-emerald-200 text-emerald-950">
                      <div className="flex items-center gap-1.5">
                        <span>✅</span>
                        <span className="font-semibold">
                          Штраф поступил на расчетный счёт. Задолженность в Дебиторке закрыта.
                        </span>
                      </div>
                      {ord.claim_paid_at && (
                        <span className="text-[10px] text-emerald-700 font-mono">
                          Дата оплаты: {new Date(ord.claim_paid_at).toLocaleDateString('ru-RU')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => onOpenClaimPrint(ord)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center gap-1.5 border border-slate-300 cursor-pointer transition"
                      >
                        <span>📄</span>
                        <span>Печать бланка претензии</span>
                      </button>

                      <button
                        type="button"
                        disabled={claimUpdatePending}
                        onClick={() =>
                          onUpdateClaimStatus({ id: ord.id, claim_status: 'waiting_payment' })
                        }
                        className="px-2.5 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-[10px] font-semibold cursor-pointer transition"
                        title="Вернуть претензию из архива в статус ожидания оплаты"
                      >
                        ↶ Вернуть в работу
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === 'simple' && (
            <>
              <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-950">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl shrink-0">⚖️</span>
                  <div>
                    <div className="font-black text-[11px]">
                      Срыв по вине заказчика? Переведите заявку в Претензию!
                    </div>
                    <div className="text-[10px] text-amber-900 leading-tight">
                      Нажмите кнопку <strong>«⚖️ Оформить Претензию (20%)»</strong> на карточке
                      ниже. Система рассчитает штраф 20% (ст. 35 УАТ РФ) и после согласования{' '}
                      <strong>автоматически перенесёт долг в Дебиторку</strong>.
                    </div>
                  </div>
                </div>
              </div>

              {simpleCancelledOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-bold">
                  Нет сорванных или отменённых заявок.
                </div>
              ) : (
                simpleCancelledOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3 bg-slate-50 rounded-2xl border-2 border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-slate-900 text-xs">
                          {ord.order_number}
                        </span>
                        <span className="text-[9px] font-bold bg-slate-200 text-slate-800 px-1.5 py-0.2 rounded">
                          В архиве срывов
                        </span>
                        <span className="text-slate-500 font-mono text-[10px]">
                          {new Date(ord.updated_at || ord.created_at).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                      <div className="font-bold text-slate-800 text-[11px]">
                        {ord.counterparty_name} ·{' '}
                        <span className="font-mono text-slate-900">
                          {Number(ord.price || 0).toLocaleString('ru-RU')} ₽
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-600 font-medium">
                        Причина: <strong>{ord.cancel_reason || 'Срыв рейса'}</strong>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onOpenClaimForSimple(ord)}
                        className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                        title="Оформить официальную претензию за срыв по ст. 35 УАТ РФ (20% штрафа)"
                      >
                        <span>⚖️</span>
                        <span>Оформить Претензию (20%)</span>
                      </button>
                      <button
                        type="button"
                        disabled={restorePending}
                        onClick={() => onRestoreOrder(ord.id)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border-2 border-slate-300 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                      >
                        <span>↶</span>
                        <span>На Канбан</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-slate-700 cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
