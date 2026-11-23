'use client';

import type { OrderItem, PipelineFolderId } from './types';
import { formatRouteSummary, getOrderEffectiveClientName } from './utils';

export function OrderPipelineRow({
  order,
  activeFolder,
  onSelect,
  onOpenWaybill,
  onOpenEpe,
  onOpenInvoice,
  onToggleDocsSent,
  onStep5Click,
  onOpenRate,
  onOpenAssign,
  onManualStage,
}: {
  order: OrderItem;
  activeFolder: PipelineFolderId;
  onSelect: (order: OrderItem) => void;
  onOpenWaybill: (order: OrderItem) => void;
  onOpenEpe: (order: OrderItem) => void;
  onOpenInvoice: (order: OrderItem) => void;
  onToggleDocsSent: (order: OrderItem) => void;
  onStep5Click: (order: OrderItem) => void;
  onOpenRate: (order: OrderItem) => void;
  onOpenAssign: (order: OrderItem) => void;
  onManualStage: (orderId: string, stage: OrderItem['status']) => void;
}) {
  const displayNum = order.trip?.trip_number
    ? `№ ${order.trip.trip_number}`
    : order.base_doc_number
      ? `№ ${order.base_doc_number}`
      : `#${order.order_number}`;
  const rawDate = order.trip?.started_at || order.created_at;
  const dateStr = rawDate
    ? new Date(rawDate).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
      })
    : '—';
  const clientName =
    getOrderEffectiveClientName(order) ||
    (order.base_doc_name?.includes('ВЫЕЗД БЕЗ ЗАЯВКИ')
      ? '⚠️ Выезд без заявки'
      : 'Клиент не указан');
  const routeText = order.raw_parser_payload?.detected_route_summary || formatRouteSummary(order);
  const docs = order.billing_docs || {};
  const isWaybillDone =
    docs.waybill_type === 'etrn'
      ? Boolean(docs.etrn_signed_edo)
      : Boolean(docs.tn_driver_delivered);
  const isInvoiceDone = Boolean(docs.invoice_issued || docs.invoice_number);
  const isAccepted = Boolean(docs.client_accepted_edo || docs.status === 'accepted');
  const isSaldaOvernight = Boolean(order.raw_parser_payload?.in_salda_transit);
  const isShaytanka = Boolean(order.raw_parser_payload?.visited_shaytanka);

  return (
    <div
      onClick={() => {
        if (order.is_trip_only_review) {
          window.location.href = '/review';
        } else {
          onSelect(order);
        }
      }}
      className="bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-xs rounded-xl px-3.5 py-2.5 flex items-center gap-3 cursor-pointer transition-all"
    >
      <div className="font-mono text-[12.5px] font-extrabold text-slate-900 min-w-[74px] shrink-0">
        {displayNum}
      </div>

      <div className="text-[11.5px] text-slate-500 min-w-[48px] shrink-0 tabular-nums">
        {dateStr}
      </div>

      <div
        className="text-[12.5px] font-bold text-slate-900 min-w-[160px] max-w-[210px] truncate shrink-0"
        title={clientName}
      >
        {clientName}
      </div>

      <div className="text-[12.5px] text-slate-700 flex-1 min-w-[160px] truncate" title={routeText}>
        {routeText}
      </div>

      <div className="text-[12px] text-slate-700 min-w-[165px] max-w-[200px] truncate shrink-0 flex items-center gap-1.5">
        {order.vehicle?.reg_number ? (
          <>
            <span className="font-mono text-[11px] font-bold bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-900 shrink-0">
              {order.vehicle.reg_number}
            </span>
            <span className="truncate">{order.driver?.full_name || order.driver?.name || ''}</span>
          </>
        ) : (
          <span className="text-slate-400 italic text-[11.5px]">Не назначен</span>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {activeFolder === 'docs_collection' ? (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenWaybill(order);
              }}
              title="ТН / ЭТрН — нажмите, чтобы отметить сдачу водителем или номер"
              className={`text-[11px] font-bold px-2 py-0.5 rounded-md border transition cursor-pointer ${
                isWaybillDone
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-orange-50 border-orange-300 text-orange-800 hover:bg-orange-100'
              }`}
            >
              {isWaybillDone
                ? `✓ ${docs.waybill_type === 'etrn' ? 'ЭТрН' : 'ТН'}`
                : `○ ${docs.waybill_type === 'etrn' ? 'ЭТрН' : 'ТН'}`}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenEpe(order);
              }}
              title="ЭПЭ (поручение экспедитору) в ЭДО"
              className={`text-[11px] font-bold px-2 py-0.5 rounded-md border transition cursor-pointer ${
                docs.epe_received_edo
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-orange-50 border-orange-300 text-orange-800 hover:bg-orange-100'
              }`}
            >
              {docs.epe_received_edo ? '✓ ЭПЭ' : '○ ЭПЭ'}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenInvoice(order);
              }}
              title="Счёт на оплату"
              className={`text-[11px] font-bold px-2 py-0.5 rounded-md border transition cursor-pointer ${
                isInvoiceDone
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-orange-50 border-orange-300 text-orange-800 hover:bg-orange-100'
              }`}
            >
              {isInvoiceDone ? `✓ Сч ${docs.invoice_number || ''}` : '○ Счёт'}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleDocsSent(order);
              }}
              title="Отправка полного пакета в ЭДО"
              className={`text-[11px] font-bold px-2 py-0.5 rounded-md border transition cursor-pointer ${
                docs.docs_sent_edo
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-orange-50 border-orange-300 text-orange-800 hover:bg-orange-100'
              }`}
            >
              {docs.docs_sent_edo ? '✓ ЭДО' : '○ ЭДО'}
            </button>
          </>
        ) : activeFolder === 'in_progress' ? (
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${
              isSaldaOvernight
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : isShaytanka
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            {isSaldaOvernight
              ? '🛰️ Ночёвка В.Салда'
              : isShaytanka
                ? '🌲 Погружен Шайтанка'
                : '🚛 В пути'}
          </span>
        ) : activeFolder === 'pending_review' ? (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border bg-purple-50 border-purple-200 text-purple-800 whitespace-nowrap">
            🔍 Синхронно в Ревью
          </span>
        ) : activeFolder === 'completed' ? (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border bg-emerald-50 border-emerald-200 text-emerald-800 whitespace-nowrap">
            {docs.invoice_number ? `✓ Счёт №${docs.invoice_number}` : '✓ Закрыт'}
          </span>
        ) : null}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!order.is_trip_only_review) onOpenRate(order);
        }}
        title={order.is_trip_only_review ? 'Ставка рейса' : 'Нажмите, чтобы изменить ставку'}
        className="text-[12.5px] font-extrabold text-slate-900 min-w-[82px] text-right tabular-nums shrink-0 hover:text-emerald-700 cursor-pointer"
      >
        {order.price_without_vat
          ? `${Number(order.price_without_vat).toLocaleString('ru-RU')} ₽`
          : '—'}
      </button>

      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        {activeFolder === 'waiting_vehicle' && (
          <button
            onClick={() => onOpenAssign(order)}
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 cursor-pointer whitespace-nowrap"
          >
            Назначить авто
          </button>
        )}
        {activeFolder === 'assigned' && (
          <>
            <a
              href={`/api/orders/${order.id}/docs/waybill-4c`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 text-[11px] font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 whitespace-nowrap"
              title="Печать путевого листа 4-С"
            >
              📋 4-С
            </a>
            <button
              onClick={() => onManualStage(order.id, 'in_progress')}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 cursor-pointer whitespace-nowrap"
            >
              В путь →
            </button>
          </>
        )}
        {activeFolder === 'in_progress' && (
          <button
            onClick={() => onManualStage(order.id, 'pending_review')}
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 cursor-pointer whitespace-nowrap"
          >
            На ревью
          </button>
        )}
        {activeFolder === 'pending_review' && (
          <a
            href="/review"
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 whitespace-nowrap"
          >
            Открыть в Ревью →
          </a>
        )}
        {activeFolder === 'docs_collection' && (
          <>
            <a
              href={`/api/orders/${order.id}/docs/tn-pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-1.5 py-1 text-[10.5px] font-bold rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
              title="Печать ТН"
            >
              📄
            </a>
            <a
              href={`/api/orders/${order.id}/docs/waybill-4c`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-1.5 py-1 text-[10.5px] font-bold rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
              title="Печать Путевого листа 4-С"
            >
              📋
            </a>
            <button
              onClick={() => onStep5Click(order)}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer whitespace-nowrap"
            >
              {isAccepted ? 'В Архиве ✓' : 'В оплату ✓'}
            </button>
          </>
        )}
        {activeFolder === 'completed' && (
          <button
            onClick={() => onSelect(order)}
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer whitespace-nowrap"
          >
            Детали
          </button>
        )}
      </div>
    </div>
  );
}
