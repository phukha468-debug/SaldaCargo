'use client';

import Link from 'next/link';
import type { AtiOrder } from './types';

export type UpdateDocFieldsPayload = {
  id: string;
  postal_tracking_number?: string;
  docs_sent?: boolean;
  docs_sent_date?: string | null;
  docs_received?: boolean;
  docs_received_date?: string | null;
  payment_promised_date?: string | null;
  stage?: number;
};

export function AtiOrderDetailDocsPanel({
  order,
  onUpdateDocFields,
  onOpenPowerOfAttorney,
}: {
  order: AtiOrder;
  onUpdateDocFields: (payload: UpdateDocFieldsPayload) => void;
  onOpenPowerOfAttorney: (order: AtiOrder) => void;
}) {
  const completedCount = [
    order.docs_sent,
    order.docs_received,
    Boolean(order.payment_promised_date),
  ].filter(Boolean).length;

  return (
    <div className="lg:col-span-5 space-y-4">
      {/* Финансы и оплата */}
      <div className="bg-white rounded-2xl border-2 border-emerald-200 shadow-2xs p-4 space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-emerald-100">
          <span className="text-[11px] font-black uppercase text-emerald-950 tracking-wider flex items-center gap-1.5">
            <span>💰</span> 5. СТОИМОСТЬ И ПОРЯДОК ОПЛАТЫ
          </span>
          <span className="font-mono font-black text-base text-emerald-700">
            {Number(order.price || 0).toLocaleString('ru-RU')} ₽
          </span>
        </div>
        <div className="space-y-1.5 text-xs text-slate-700">
          <div>
            <span className="text-slate-500 font-bold">Форма и срок расчетов: </span>
            <span className="font-semibold text-slate-900">
              {order.payment_terms || 'Безналичный расчет без НДС'}
            </span>
          </div>
          {order.postal_address && (
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px] space-y-0.5">
              <span className="text-slate-500 font-bold block uppercase text-[10px]">
                Почтовый адрес для оригиналов:
              </span>
              <span className="font-medium text-slate-800">{order.postal_address}</span>
            </div>
          )}
          {order.notes && (
            <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-[11px] text-amber-950 font-medium">
              📌 {order.notes}
            </div>
          )}
        </div>
      </div>

      {/* Документооборот (3 пункта) */}
      <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-2xs p-4 space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-purple-100">
          <span className="text-[11px] font-black uppercase text-purple-950 tracking-wider flex items-center gap-1.5">
            <span>📄</span> 6. ДОКУМЕНТООБОРОТ И ОПЛАТА
          </span>
          <span
            className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full border ${
              completedCount === 3
                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                : 'bg-amber-100 text-amber-900 border-amber-300'
            }`}
          >
            {completedCount}/3 пунктов
          </span>
        </div>

        <p className="text-[11px] text-slate-500">
          Для перевода заявки в статус <strong>Ожидание оплаты (Дебиторка)</strong> необходимо
          заполнить все 3 пункта:
        </p>

        <div className="space-y-2.5">
          {/* Пункт 1 */}
          <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer font-black text-xs text-slate-900 select-none">
              <input
                type="checkbox"
                checked={Boolean(order.docs_sent)}
                onChange={(e) => {
                  const checked = e.target.checked;
                  onUpdateDocFields({
                    id: order.id,
                    docs_sent: checked,
                    docs_sent_date: checked
                      ? order.docs_sent_date || new Date().toISOString().split('T')[0]
                      : null,
                  });
                }}
                className="rounded border-purple-400 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
              />
              <span>1. Документы отправлены на почту</span>
              {order.docs_sent_date && (
                <span className="font-mono text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded ml-auto">
                  {order.docs_sent_date}
                </span>
              )}
            </label>
            <div className="flex items-center gap-2 pt-1 pl-6">
              <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">
                Трек-номер:
              </span>
              <input
                type="text"
                defaultValue={order.postal_tracking_number || ''}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val !== (order.postal_tracking_number || '')) {
                    onUpdateDocFields({
                      id: order.id,
                      postal_tracking_number: val,
                      docs_sent: val ? true : order.docs_sent,
                      docs_sent_date:
                        val && !order.docs_sent_date
                          ? new Date().toISOString().split('T')[0]
                          : order.docs_sent_date,
                    });
                  }
                }}
                placeholder="Почтовый трек / код отправления..."
                className="w-full px-2.5 py-1 border border-purple-300 rounded-lg text-xs font-mono font-bold bg-white text-slate-900 focus:ring-2 focus:ring-purple-400"
              />
            </div>
          </div>

          {/* Пункт 2 */}
          <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200">
            <label className="flex items-center gap-2 cursor-pointer font-black text-xs text-slate-900 select-none">
              <input
                type="checkbox"
                checked={Boolean(order.docs_received)}
                onChange={(e) => {
                  const checked = e.target.checked;
                  onUpdateDocFields({
                    id: order.id,
                    docs_received: checked,
                    docs_received_date: checked
                      ? order.docs_received_date || new Date().toISOString().split('T')[0]
                      : null,
                  });
                }}
                className="rounded border-purple-400 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
              />
              <span>2. Документы получены заказчиком / на почте</span>
              {order.docs_received_date && (
                <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded ml-auto">
                  {order.docs_received_date}
                </span>
              )}
            </label>
          </div>

          {/* Пункт 3 */}
          <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-300 space-y-1.5">
            <div className="flex items-center justify-between font-black text-xs text-amber-950">
              <span className="flex items-center gap-1.5">
                <span>📞</span> 3. Согласованная дата оплаты (прозвон):
              </span>
              {order.payment_promised_date ? (
                <span className="text-[10px] font-mono font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                  В графике ✓
                </span>
              ) : (
                <span className="text-[10px] text-amber-800 font-bold">не указана</span>
              )}
            </div>
            <input
              type="date"
              defaultValue={order.payment_promised_date || ''}
              onChange={(e) =>
                onUpdateDocFields({
                  id: order.id,
                  payment_promised_date: e.target.value || null,
                })
              }
              className="w-full px-3 py-1.5 border border-amber-400 rounded-lg text-xs font-mono font-bold bg-white text-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Быстрые документы */}
      <div className="bg-slate-100/90 rounded-2xl border border-slate-200 p-4 space-y-2">
        <span className="text-[11px] font-black uppercase text-slate-700 tracking-wider block">
          Документы и действия
        </span>
        <button
          type="button"
          onClick={() => onOpenPowerOfAttorney(order)}
          className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs transition active:scale-95"
        >
          <span>📄</span>
          <span>Сформировать доверенность на водителя</span>
        </button>
        {order.stage >= 6 && (
          <Link
            href="/receivables"
            className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-xs transition text-center"
          >
            <span>📊</span>
            <span>Открыть в разделе Дебиторка ↗</span>
          </Link>
        )}
      </div>
    </div>
  );
}
