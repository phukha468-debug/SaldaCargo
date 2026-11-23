'use client';

import type { OrderItem } from './types';

export function InvoiceDocModal({
  order,
  invoiceNumberInput,
  setInvoiceNumberInput,
  invoiceDateInput,
  setInvoiceDateInput,
  onSave,
  onClose,
}: {
  order: OrderItem;
  invoiceNumberInput: string;
  setInvoiceNumberInput: (v: string) => void;
  invoiceDateInput: string;
  setInvoiceDateInput: (v: string) => void;
  onSave: (isIssued: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full p-4 shadow-xl space-y-3 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 truncate">
            <span>🧾 Счёт:</span>
            <span className="text-indigo-600 font-black">
              {order.trip?.trip_number
                ? `Рейс № ${order.trip.trip_number}`
                : `Заявка № ${order.base_doc_number || order.order_number}`}
            </span>
            {order.base_doc_number &&
              (order.base_doc_number.includes('/') || order.base_doc_number.includes('\\')) && (
                <span className="px-1 py-0.2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[9.5px] font-bold">
                  ЭПЭ {order.base_doc_number}
                </span>
              )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 font-bold text-base cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="text-[11px] text-slate-500 font-medium">
          {order.client?.name} • Ставка:{' '}
          {order.price_without_vat
            ? `${Number(order.price_without_vat).toLocaleString('ru-RU')} ₽`
            : '—'}
        </div>

        <div className="space-y-2.5">
          <div>
            <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
              Номер счёта на оплату
            </label>
            <input
              type="text"
              value={invoiceNumberInput}
              onChange={(e) => setInvoiceNumberInput(e.target.value)}
              placeholder="Например, 104 или СЧ-793"
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Дата счёта</label>
            <input
              type="date"
              value={invoiceDateInput}
              onChange={(e) => setInvoiceDateInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onSave(false)}
            className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded text-xs font-bold cursor-pointer"
          >
            Снять счёт
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => onSave(true)}
              className="px-3.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold shadow-xs cursor-pointer"
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WaybillDocModal({
  order,
  waybillTypeInput,
  setWaybillTypeInput,
  waybillNumberInput,
  setWaybillNumberInput,
  waybillDeliveredInput,
  setWaybillDeliveredInput,
  onSave,
  onClose,
}: {
  order: OrderItem;
  waybillTypeInput: 'paper' | 'etrn';
  setWaybillTypeInput: (v: 'paper' | 'etrn') => void;
  waybillNumberInput: string;
  setWaybillNumberInput: (v: string) => void;
  waybillDeliveredInput: boolean;
  setWaybillDeliveredInput: (v: boolean) => void;
  onSave: (isReset: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full p-4 shadow-xl space-y-3 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 truncate">
            <span>📄 Транспортная накладная:</span>
            <span className="text-indigo-600 font-black">
              {order.trip?.trip_number
                ? `Рейс № ${order.trip.trip_number}`
                : `Заявка № ${order.base_doc_number || order.order_number}`}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 font-bold text-base cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="text-[11px] text-slate-500 font-medium">
          {order.client?.name} • Авто: {order.vehicle?.reg_number || '—'}
        </div>

        <div className="space-y-2.5">
          <div>
            <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
              Формат накладной (строго один)
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setWaybillTypeInput('paper')}
                className={`py-1 rounded text-xs font-bold transition cursor-pointer ${
                  waybillTypeInput === 'paper'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📄 Бумажная ТрН
              </button>
              <button
                type="button"
                onClick={() => setWaybillTypeInput('etrn')}
                className={`py-1 rounded text-xs font-bold transition cursor-pointer ${
                  waybillTypeInput === 'etrn'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ⚡ Электронная (ЭТрН)
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
              Номер накладной (ТрН / ЭТрН)
            </label>
            <input
              type="text"
              value={waybillNumberInput}
              onChange={(e) => setWaybillNumberInput(e.target.value)}
              placeholder="Например, 1664 или ТрН-26/1664"
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <label className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={waybillDeliveredInput}
              onChange={(e) => setWaybillDeliveredInput(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="text-[11px] font-bold text-slate-800">
              {waybillTypeInput === 'paper'
                ? 'Оригинал ТрН сдан водителем'
                : 'ЭТрН подписана в ЭДО'}
            </span>
          </label>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onSave(true)}
            className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded text-xs font-bold cursor-pointer"
          >
            Снять отметку
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => onSave(false)}
              className="px-3.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold shadow-xs cursor-pointer"
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EpeDocModal({
  order,
  epeNumberInput,
  setEpeNumberInput,
  epeReceivedInput,
  setEpeReceivedInput,
  onSave,
  onClose,
}: {
  order: OrderItem;
  epeNumberInput: string;
  setEpeNumberInput: (v: string) => void;
  epeReceivedInput: boolean;
  setEpeReceivedInput: (v: boolean) => void;
  onSave: (isReset: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full p-4 shadow-xl space-y-3 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 truncate">
            <span>📥 ЭПЭ в ЭДО:</span>
            <span className="text-indigo-600 font-black">
              {order.trip?.trip_number
                ? `Рейс № ${order.trip.trip_number}`
                : `Заявка № ${order.order_number}`}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 font-bold text-base cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="text-[11px] text-slate-500 font-medium">
          {order.client?.name} • Электронное поручение экспедитору
        </div>

        <div className="space-y-2.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10.5px] font-bold text-slate-700">Номер ЭПЭ</label>
              <button
                type="button"
                onClick={() => {
                  if (!epeNumberInput.includes('/2026') && !epeNumberInput.includes('\\2026')) {
                    setEpeNumberInput(epeNumberInput ? `${epeNumberInput}/2026` : '793/2026');
                  }
                }}
                className="text-[9.5px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
              >
                + /2026
              </button>
            </div>
            <input
              type="text"
              value={epeNumberInput}
              onChange={(e) => setEpeNumberInput(e.target.value)}
              placeholder="Например, 793/2026"
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Номер зафиксируется в заявке и отобразится во всех разделах.
            </span>
          </div>

          <label className="flex items-center gap-2 p-2 bg-emerald-50/70 border border-emerald-200 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={epeReceivedInput}
              onChange={(e) => setEpeReceivedInput(e.target.checked)}
              className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <span className="text-[11px] font-bold text-emerald-900">
              ЭПЭ поступило и доступно в ЭДО
            </span>
          </label>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onSave(true)}
            className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded text-xs font-bold cursor-pointer"
          >
            Снять ЭПЭ
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => onSave(false)}
              className="px-3.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold shadow-xs cursor-pointer"
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
