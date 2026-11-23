'use client';

import { useState } from 'react';
import type { OrderDetail } from '../../types';

export function OrderDetailApprovalModal({
  order,
  isPending,
  error,
  onSend,
  onClose,
}: {
  order: OrderDetail;
  isPending: boolean;
  error: Error | null;
  onSend: (comment: string) => void;
  onClose: () => void;
}) {
  const [approvalComment, setApprovalComment] = useState('');

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 via-slate-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">💬</span>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Согласование работ в MAX</h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Наряд #{order.order_number} · Руководитель: Нигамедьянов Александр
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
            <div className="font-bold text-slate-700 flex items-center justify-between">
              <span>Список работ на согласование:</span>
              <span className="text-slate-400 font-normal">({order.works.length} поз.)</span>
            </div>
            {order.works.length === 0 ? (
              <p className="text-amber-600 font-medium italic">Работы ещё не добавлены</p>
            ) : (
              <ul className="space-y-1.5 pl-1 max-h-48 overflow-y-auto">
                {order.works.map((w, idx) => (
                  <li key={w.id} className="text-slate-800 font-medium flex items-start gap-1.5">
                    <span className="text-indigo-600 font-bold">{idx + 1}.</span>
                    <div className="flex-1">
                      <span className="font-semibold">
                        {w.custom_work_name || w.work_catalog?.name}
                      </span>
                      <div className="text-slate-500 text-[10px] mt-0.5">
                        {w.norm_minutes
                          ? `${(w.norm_minutes / 60).toFixed(1)} нч`
                          : 'нч не указаны'}{' '}
                        ·{' '}
                        {w.price_client
                          ? `${parseFloat(w.price_client).toLocaleString('ru-RU')} ₽`
                          : '1 ₽'}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Комментарий для Александра (опционально)
            </label>
            <textarea
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
              placeholder="Например: Саша, глянь заднюю ступицу, сколько тут нч поставить?"
              rows={2}
              className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-xl text-xs font-semibold">
              {error.message || 'Ошибка отправки'}
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={isPending || order.works.length === 0}
            onClick={() => onSend(approvalComment)}
            className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            {isPending ? '⏳ Отправляем...' : '🚀 Отправить Александру в MAX'}
          </button>
        </div>
      </div>
    </div>
  );
}
