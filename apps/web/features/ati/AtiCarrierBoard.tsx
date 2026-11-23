'use client';

import Link from 'next/link';
import { STAGE_CONFIG, STAGE_ICONS } from './constants';
import type { AtiOrder } from './types';

export function AtiCarrierBoard({
  isLoading,
  activeClaimOrders,
  activeClaimsSum,
  totalFreight,
  inReceivables,
  ordersByStage,
  activeCarrierStage,
  setActiveCarrierStage,
  claimUpdatePending,
  onSelectOrder,
  onOpenCancelModal,
  onUpdateStage,
  onOpenClaimPrint,
  onOpenAgreeClaim,
  onMarkClaimPaid,
}: {
  isLoading: boolean;
  activeClaimOrders: AtiOrder[];
  activeClaimsSum: number;
  totalFreight: number;
  inReceivables: number;
  ordersByStage: Record<number, AtiOrder[]>;
  activeCarrierStage: number;
  setActiveCarrierStage: (stage: number) => void;
  claimUpdatePending: boolean;
  onSelectOrder: (order: AtiOrder) => void;
  onOpenCancelModal: (order: AtiOrder) => void;
  onUpdateStage: (id: string, stage: number) => void;
  onOpenClaimPrint: (order: AtiOrder) => void;
  onOpenAgreeClaim: (order: AtiOrder) => void;
  onMarkClaimPaid: (id: string) => void;
}) {
  const stageNum = activeCarrierStage;
  const cfg = STAGE_CONFIG[stageNum] || STAGE_CONFIG[1]!;
  const colOrders = ordersByStage[stageNum] || [];

  return (
    <>
      {/* БАННЕР АКТИВНОЙ ПРЕТЕНЗИОННОЙ РАБОТЫ */}
      {activeClaimOrders.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 via-white to-amber-50/50 border-2 border-amber-300 rounded-2xl p-3 shadow-2xs space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚖️</span>
              <span className="text-xs font-black uppercase text-amber-950 tracking-wide">
                Претензионная работа по срывам ({activeClaimOrders.length} в работе)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                ст. 35 УАТ РФ · Штраф 20%
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-600 font-medium">Сумма требований:</span>
              <span className="font-mono font-black text-amber-950 text-sm">
                {activeClaimsSum.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {activeClaimOrders.map((ord) => {
              const status = ord.claim_status || 'issued';
              return (
                <div
                  key={ord.id}
                  className="bg-white border-2 border-amber-200 rounded-xl p-2.5 shadow-2xs space-y-2 text-xs hover:border-amber-400 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-black text-slate-900 text-xs">
                          Претензия № {ord.claim_number || '01-ПР'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          к {ord.order_number.split(' ')[0]}
                        </span>
                      </div>
                      <div className="font-bold text-slate-800 text-[11px] truncate max-w-[220px]">
                        {ord.counterparty_name}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center justify-end gap-1">
                        <div className="font-mono font-black text-amber-950 text-xs">
                          {Number(ord.claim_amount || 6000).toLocaleString('ru-RU')} ₽
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenAgreeClaim(ord)}
                          className="px-1 py-0.5 hover:bg-amber-100 rounded text-amber-800 text-[10px] font-bold cursor-pointer"
                          title="Изменить согласованную сумму претензии"
                        >
                          ✏️
                        </button>
                      </div>
                      <div className="text-[9px] text-slate-500">
                        {ord.claim_date || new Date().toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                    <span className="text-slate-600">Статус:</span>
                    {status === 'issued' && (
                      <span className="font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                        1. Выставлена (Ждём согласования)
                      </span>
                    )}
                    {(status === 'agreed' || status === 'waiting_payment') && (
                      <span className="font-bold text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-300">
                        2. Согласована · В Дебиторке ⏳
                      </span>
                    )}
                    {status === 'paid' && (
                      <span className="font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">
                        ✓ Оплачено на Р/С
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onOpenClaimPrint(ord)}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold border border-slate-300 cursor-pointer transition flex items-center gap-1"
                      title="Открыть официальный бланк претензии"
                    >
                      <span>📄</span> <span>Бланк</span>
                    </button>

                    {status === 'issued' && (
                      <button
                        type="button"
                        onClick={() => onOpenAgreeClaim(ord)}
                        className="flex-1 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black cursor-pointer transition text-center shadow-2xs"
                        title="Заказчик согласовал срыв -> выбрать согласованную сумму (10%, 20%) и отправить в Дебиторку"
                      >
                        ✓ Согласовано → В Дебиторку
                      </button>
                    )}

                    {(status === 'agreed' || status === 'waiting_payment') && (
                      <div className="flex-1 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onOpenAgreeClaim(ord)}
                          className="px-1.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-bold text-center cursor-pointer"
                          title="Изменить согласованную сумму претензии в Дебиторке"
                        >
                          ✏️ Сумма
                        </button>
                        <Link
                          href="/receivables"
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold text-center"
                          title="Посмотреть задолженность в разделе Дебиторка"
                        >
                          В Дебиторке ↗
                        </Link>
                        <button
                          type="button"
                          disabled={claimUpdatePending}
                          onClick={() => onMarkClaimPaid(ord.id)}
                          className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black cursor-pointer transition text-center"
                          title="Отметить оплаченной на расчетный счет"
                        >
                          ✓ Оплачено
                        </button>
                      </div>
                    )}

                    {status === 'paid' && (
                      <div className="flex-1 text-center py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-black">
                        ✓ Долг закрыт
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ИНФО-БЛОК СВЯЗКИ С ДЕБИТОРКОЙ */}
      <div className="bg-white border-2 border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-[11px] text-slate-600">
          <span className="text-base">💡</span>
          <span>
            Кликните на карточку для просмотра полного договора. Кнопка <strong>↶</strong> отменяет
            ошибочный шаг. Претензии после согласования автоматически попадают в{' '}
            <strong>Дебиторку</strong>.
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono font-bold shrink-0">
          <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">
            Фрахт: {totalFreight.toLocaleString('ru-RU')} ₽
          </span>
          <Link
            href="/receivables"
            className="px-2 py-0.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded flex items-center gap-1 transition"
          >
            <span>В Дебиторке: {inReceivables.toLocaleString('ru-RU')} ₽</span>
            <span>↗</span>
          </Link>
        </div>
      </div>

      {/* ПАПКИ ДОГОВОРОВ АТИ + 1-СТРОЧНЫЕ КАРТОЧКИ */}
      {isLoading ? (
        <div className="p-10 text-center text-slate-400 font-bold bg-white rounded-xl border border-slate-200 text-xs">
          Загрузка договоров АТИ...
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2.5">
            {[1, 2, 3, 4, 5, 6, 7].map((sNum) => {
              const sCfg = STAGE_CONFIG[sNum];
              if (!sCfg) return null;
              const sOrders = ordersByStage[sNum] || [];
              const isActive = activeCarrierStage === sNum;

              return (
                <button
                  key={sNum}
                  type="button"
                  onClick={() => setActiveCarrierStage(sNum)}
                  className={`text-left rounded-xl px-3 py-2.5 border transition-all cursor-pointer flex flex-col gap-1.5 ${
                    isActive
                      ? 'border-emerald-600 bg-emerald-50 shadow-sm ring-1 ring-emerald-600/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span
                      className={`text-[12px] font-bold truncate ${
                        isActive ? 'text-emerald-900' : 'text-slate-800'
                      }`}
                      title={sCfg.title}
                    >
                      {STAGE_ICONS[sNum] || '📁'} {sCfg.shortTitle}
                    </span>
                    <span
                      className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full tabular-nums shrink-0 ${
                        isActive ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {sOrders.length}
                    </span>
                  </div>
                  <div
                    className={`text-[10.5px] truncate ${
                      isActive ? 'text-emerald-700/80' : 'text-slate-500'
                    }`}
                  >
                    {sCfg.title}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <div className="text-[13px] font-bold text-slate-700 px-1 flex items-center gap-2">
              <span>{cfg.title}</span>
              <span className="text-[11.5px] font-medium text-slate-500">({colOrders.length})</span>
            </div>

            {colOrders.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center text-xs font-semibold text-slate-500">
                В папке «{cfg.shortTitle}» пока нет договоров АТИ
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {colOrders.map((order) => {
                  const isStage5 = stageNum === 5;
                  const isDocsSent = Boolean(order.docs_sent);
                  const isDocsReceived = Boolean(order.docs_received);
                  const hasPaymentDate = Boolean(order.payment_promised_date);
                  const isStage5Ready =
                    !isStage5 || (isDocsSent && isDocsReceived && hasPaymentDate);
                  const stage5CompletedCount = [isDocsSent, isDocsReceived, hasPaymentDate].filter(
                    Boolean,
                  ).length;

                  return (
                    <div
                      key={order.id}
                      onClick={() => onSelectOrder(order)}
                      title="Нажмите, чтобы открыть полноэкранный договор-заявку"
                      className="bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-xs rounded-xl px-3.5 py-2.5 flex items-center gap-3 cursor-pointer transition-all"
                    >
                      <div className="font-mono text-[12.5px] font-extrabold text-slate-900 min-w-[78px] shrink-0">
                        {order.order_number.split(' ')[0] || order.order_number}
                      </div>

                      <span
                        className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                          order.doc_type === 'etrn'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-900 border-amber-200'
                        }`}
                      >
                        {order.doc_type === 'etrn' ? '⚡ ЭТрН' : '📮 Почта'}
                      </span>

                      <div className="min-w-[160px] max-w-[210px] shrink-0 truncate">
                        <span
                          className="text-[12.5px] font-bold text-slate-900"
                          title={order.counterparty_name}
                        >
                          {order.counterparty_name}
                        </span>
                        {order.ati_code && (
                          <span className="ml-1.5 text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                            АТИ {order.ati_code}
                          </span>
                        )}
                      </div>

                      <div
                        className="text-[12.5px] text-slate-700 flex-1 min-w-[160px] truncate"
                        title={`${order.pickup_address || '—'} → ${order.delivery_address || '—'}`}
                      >
                        {order.pickup_address || '—'} <span className="text-slate-400">➔</span>{' '}
                        {order.delivery_address || '—'}
                      </div>

                      <div className="text-[12px] text-slate-700 min-w-[155px] max-w-[190px] truncate shrink-0 flex items-center gap-1.5">
                        {order.asset_reg_number ? (
                          <span className="font-mono text-[11px] font-bold bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-900 shrink-0">
                            {order.asset_reg_number}
                          </span>
                        ) : null}
                        <span className="truncate">
                          {order.driver_name || (
                            <span className="text-slate-400 italic">Не назначен</span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isStage5 && (
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${
                              isStage5Ready
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : 'bg-amber-50 border-amber-200 text-amber-900'
                            }`}
                          >
                            Доки: {stage5CompletedCount}/3
                          </span>
                        )}
                        {stageNum === 6 && order.payment_promised_date && (
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border bg-amber-50 text-amber-900 border-amber-200 whitespace-nowrap">
                            📅 {order.payment_promised_date}
                          </span>
                        )}
                      </div>

                      <div className="font-mono text-[12.5px] font-extrabold text-slate-900 min-w-[82px] text-right tabular-nums shrink-0">
                        {Number(order.price || 0).toLocaleString('ru-RU')} ₽
                      </div>

                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {stageNum <= 5 && (
                          <button
                            type="button"
                            onClick={() => onOpenCancelModal(order)}
                            title="Срыв договора-заявки / Претензия"
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold text-[11px] border border-rose-200 cursor-pointer transition"
                          >
                            ✕
                          </button>
                        )}

                        {stageNum > 1 && (
                          <button
                            type="button"
                            onClick={() => onUpdateStage(order.id, stageNum - 1)}
                            title="Вернуть на предыдущий этап"
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] border border-slate-300 cursor-pointer transition"
                          >
                            ↶
                          </button>
                        )}

                        {stageNum < 7 ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (isStage5 && !isStage5Ready) {
                                onSelectOrder(order);
                                return;
                              }
                              onUpdateStage(order.id, stageNum + 1);
                            }}
                            title={
                              isStage5 && !isStage5Ready
                                ? 'Нажмите, чтобы открыть заявку и заполнить 3 пункта'
                                : cfg.btnForward
                            }
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition whitespace-nowrap cursor-pointer ${
                              isStage5 && !isStage5Ready
                                ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            {isStage5 && !isStage5Ready ? 'Заполнить 3/3 ↗' : cfg.btnForward}
                          </button>
                        ) : (
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-bold text-[11px]">
                            ✓ Закрыто
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
