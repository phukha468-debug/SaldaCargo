'use client';

import { useState } from 'react';
import { Money } from '@saldacargo/ui';
import type { OrderDetail } from '../../types';

export function OrderDetailNotesAndDanger({
  order,
  patchPending,
  deletePending,
  deleteError,
  onClearDeleteError,
  onSaveAdminNote,
  onReopen,
  onDeleteOrder,
}: {
  order: OrderDetail;
  patchPending: boolean;
  deletePending: boolean;
  deleteError: string | null;
  onClearDeleteError: () => void;
  onSaveAdminNote: (note: string) => void;
  onReopen: () => void;
  onDeleteOrder: (password: string) => void;
}) {
  const [editNote, setEditNote] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <>
      {/* Заметка admin */}
      <div>
        <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">Заметка (admin)</p>
        {editNote === null ? (
          <div className="flex items-start gap-2">
            <p className="text-sm text-slate-700 flex-1">
              {order.admin_note || <span className="italic text-slate-400">Нет заметки</span>}
            </p>
            <button
              onClick={() => setEditNote(order.admin_note ?? '')}
              className="text-xs text-blue-600 hover:underline shrink-0"
            >
              Изменить
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onSaveAdminNote(editNote);
                  setEditNote(null);
                }}
                disabled={patchPending}
                className="text-xs bg-slate-900 text-white px-4 py-1.5 rounded-lg font-semibold"
              >
                Сохранить
              </button>
              <button
                onClick={() => setEditNote(null)}
                className="text-xs text-slate-400 hover:text-slate-700"
              >
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>

      {order.mechanic_note && (
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3.5 space-y-1">
          <p className="text-[10px] font-black text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
            <span>💡</span> Рекомендации механика / мастера
          </p>
          <p className="text-sm text-slate-800 font-medium whitespace-pre-wrap">
            {order.mechanic_note}
          </p>
        </div>
      )}

      {/* Начисленная ЗП (для закрытых нарядов) */}
      {order.lifecycle_status === 'approved' && (
        <>
          {(order.mechanic_pay || order.second_mechanic_pay) && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
              <p className="text-xs text-slate-500 mb-2 font-semibold uppercase">
                ЗП начислено (стар. формат)
              </p>
              {order.mechanic_pay && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-700">{order.mechanic?.name ?? 'Механик'}</span>
                  <span className="font-black text-emerald-700">
                    <Money amount={order.mechanic_pay} />
                  </span>
                </div>
              )}
              {order.second_mechanic_pay && (
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-slate-700">
                    {order.second_mechanic?.name ?? 'Механик 2'}
                  </span>
                  <span className="font-black text-emerald-700">
                    <Money amount={order.second_mechanic_pay} />
                  </span>
                </div>
              )}
            </div>
          )}
          {order.transactions &&
            order.transactions.filter(
              (tx) => tx.category_id === '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6',
            ).length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
                <p className="text-xs text-slate-500 mb-2 font-semibold uppercase">ЗП НАЧИСЛЕНО</p>
                {order.transactions
                  .filter((tx) => tx.category_id === '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6')
                  .map((tx) => (
                    <div key={tx.id} className="flex justify-between text-sm mt-1">
                      <span className="text-slate-700">
                        {tx.related_user?.name ?? 'Исполнитель'}
                      </span>
                      <span className="font-black text-emerald-700">
                        <Money amount={tx.amount} />
                      </span>
                    </div>
                  ))}
              </div>
            )}
        </>
      )}

      {/* Опасная зона: переоткрытие и удаление */}
      <div className="border border-red-100 rounded-xl p-4 space-y-2">
        {!showDeleteConfirm ? (
          <div className="flex gap-2">
            {order.lifecycle_status === 'approved' && (
              <button
                onClick={onReopen}
                disabled={patchPending}
                className="flex-1 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold py-2 rounded-xl text-sm"
              >
                Открыть заново
              </button>
            )}
            <button
              onClick={() => {
                setShowDeleteConfirm(true);
                onClearDeleteError();
              }}
              className="flex-1 border border-red-200 text-red-500 hover:bg-red-50 font-semibold py-2 rounded-xl text-sm"
            >
              Удалить наряд
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-red-700">
              Удаление необратимо — будут удалены работы, запчасти, таймеры и все начисленные
              транзакции (ЗП, выручка СТО).
            </p>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => {
                setDeletePassword(e.target.value);
                onClearDeleteError();
              }}
              placeholder="Пароль администратора"
              className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onDeleteOrder(deletePassword);
              }}
            />
            {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => onDeleteOrder(deletePassword)}
                disabled={deletePending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-xl text-sm disabled:opacity-50"
              >
                {deletePending ? '...' : 'Удалить безвозвратно'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletePassword('');
                  onClearDeleteError();
                }}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold py-2 rounded-xl text-sm"
              >
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
