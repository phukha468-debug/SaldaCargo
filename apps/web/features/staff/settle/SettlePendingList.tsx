'use client';

import { cn } from '@saldacargo/ui';

export interface SettlePendingTx {
  id: string;
  amount: string | number;
  description: string;
  created_at: string;
  transaction_date?: string | null;
  category_id: string;
  trip?: { trip_number: number; started_at?: string; lifecycle_status?: string } | null;
  service_order?: { order_number: number; created_at?: string } | null;
}

export function SettlePendingList({
  pendingList,
  selectedTxIds,
  selectedCount,
  unselectedCount,
  unselectedTotal,
  isLoading,
  onSelectAll,
  onSelectThursday,
  onDeselectAll,
  onToggleItem,
}: {
  pendingList: SettlePendingTx[];
  selectedTxIds: Set<string>;
  selectedCount: number;
  unselectedCount: number;
  unselectedTotal: number;
  isLoading: boolean;
  onSelectAll: () => void;
  onSelectThursday: () => void;
  onDeselectAll: () => void;
  onToggleItem: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <span>
            📋 Начисления к выплате ({selectedCount}/{pendingList.length})
          </span>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onSelectAll}
            className={cn(
              'text-[10px] px-2 py-0.5 rounded font-bold transition',
              selectedCount === pendingList.length && pendingList.length > 0
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700',
            )}
          >
            Все
          </button>
          <button
            type="button"
            onClick={onSelectThursday}
            title="Выбрать только начисления по четверг включительно"
            className="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 transition"
          >
            По Чт (срез)
          </button>
          <button
            type="button"
            onClick={onDeselectAll}
            className="text-[10px] px-1.5 py-0.5 rounded text-slate-400 hover:text-slate-700 transition"
          >
            Снять
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-3 text-center text-xs text-slate-400">Загрузка начислений...</div>
      ) : pendingList.length === 0 ? (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
          Нет ожидающих начислений
        </div>
      ) : (
        <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/50">
          {pendingList.map((t) => {
            const isChecked = selectedTxIds.has(t.id);
            const rawDate = t.transaction_date || t.created_at;
            const dateStr = rawDate
              ? new Date(rawDate).toLocaleDateString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                })
              : '';
            const rawDesc = t.description ?? '';
            const title = t.trip
              ? `Рейс №${t.trip.trip_number}`
              : t.service_order
                ? `Наряд #${t.service_order.order_number}`
                : (rawDesc.replace(/^ЗП(?:\s+механика)?:\s*/i, '').split('—')[0] ?? '').trim();
            const sub = rawDesc
              .replace(/^ЗП(?:\s+механика)?:\s*/i, '')
              .replace(/^[^\wа-яА-ЯёЁ]+/, '');

            return (
              <div
                key={t.id}
                onClick={() => onToggleItem(t.id)}
                className={cn(
                  'flex items-center justify-between px-2.5 py-1.5 text-xs cursor-pointer select-none transition-colors',
                  isChecked
                    ? 'bg-emerald-50/60 hover:bg-emerald-50'
                    : 'hover:bg-slate-100 opacity-60',
                )}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0 cursor-pointer"
                  />
                  <span className="font-mono text-[10px] text-slate-400 shrink-0">{dateStr}</span>
                  <span className="font-bold text-slate-800 truncate">{title}</span>
                  {sub && sub !== title && (
                    <span className="text-[10px] text-slate-500 truncate hidden sm:inline">
                      ({sub})
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    'font-black font-mono shrink-0',
                    isChecked ? 'text-emerald-700' : 'text-slate-400',
                  )}
                >
                  {parseFloat(String(t.amount)).toLocaleString('ru-RU')} ₽
                </span>
              </div>
            );
          })}
        </div>
      )}

      {unselectedCount > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 text-xs space-y-0.5">
          <div className="flex items-center gap-1.5 font-bold text-amber-900 text-[11px]">
            <span>⚠️</span>
            <span>
              Не включено: {unselectedCount} поз. на {unselectedTotal.toLocaleString('ru-RU')} ₽
            </span>
          </div>
          <p className="text-[10px] text-amber-800 leading-tight">
            Останутся в долге сотрудника и перенесутся на следующий расчёт.
          </p>
        </div>
      )}
    </div>
  );
}
