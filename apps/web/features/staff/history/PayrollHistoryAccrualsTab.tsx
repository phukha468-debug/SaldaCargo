'use client';

import { cn } from '@saldacargo/ui';
import type { GroupedAccrualItem, PayrollUser } from '../types';

export function PayrollHistoryAccrualsTab({
  user,
  groupedAccruals,
  expandedGroups,
  editingId,
  editAmount,
  saving,
  onToggleGroup,
  onViewOrder,
  onViewTrip,
  onStartEdit,
  onCancelEdit,
  onEditAmountChange,
  onSaveEdit,
  onDelete,
}: {
  user: PayrollUser;
  groupedAccruals: GroupedAccrualItem[];
  expandedGroups: Record<string, boolean>;
  editingId: string | null;
  editAmount: string;
  saving: boolean;
  onToggleGroup: (key: string) => void;
  onViewOrder: (orderId: string | null) => void;
  onViewTrip: (tripId: string | null) => void;
  onStartEdit: (txId: string, amount: number) => void;
  onCancelEdit: () => void;
  onEditAmountChange: (val: string) => void;
  onSaveEdit: (txId: string) => void;
  onDelete: (txId: string, label: string) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Список начислений по рейсам и нарядам
        </span>
        <span className="text-xs text-slate-400 font-medium">
          Всего {groupedAccruals.length} операций
        </span>
      </div>

      {groupedAccruals.length === 0 ? (
        <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
          <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">
            receipt_long
          </span>
          <p className="text-sm font-medium">Нет поступлений и начислений</p>
        </div>
      ) : (
        groupedAccruals.map((g) => {
          const isCompleted = g.settlement_status === 'completed';
          const isPartial = g.settlement_status === 'partial';
          const isPending = g.settlement_status === 'pending';

          const parsedEventDate = g.eventDate
            ? new Date(g.eventDate)
            : g.latestDate
              ? new Date(g.latestDate)
              : null;
          const eventDateStr =
            parsedEventDate && !isNaN(parsedEventDate.getTime())
              ? parsedEventDate.toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : '—';

          const parsedPaidDate = g.paidDate
            ? new Date(g.paidDate)
            : g.latestDate
              ? new Date(g.latestDate)
              : null;
          const paidDateStr =
            parsedPaidDate && !isNaN(parsedPaidDate.getTime())
              ? parsedPaidDate.toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : eventDateStr;

          const displayVehicle =
            g.vehicle_desc ||
            (g.isTrip && user.asset
              ? [user.asset.short_name, user.asset.reg_number ? `(${user.asset.reg_number})` : '']
                  .filter(Boolean)
                  .join(' ')
              : null);

          const isExpanded = Boolean(expandedGroups[g.groupKey]);
          const hasMultipleWorks = g.works.length > 1;

          return (
            <div
              key={g.groupKey}
              className={cn(
                'rounded-2xl p-4.5 shadow-xs relative overflow-hidden transition-all border-2 group',
                isCompleted
                  ? 'bg-emerald-50/70 border-emerald-300 hover:border-emerald-400'
                  : isPartial
                    ? 'bg-emerald-50/40 border-amber-300 hover:border-amber-400'
                    : 'bg-white border-slate-200 hover:border-slate-300',
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        'text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border',
                        g.isOrder
                          ? 'bg-amber-100 text-amber-900 border-amber-200'
                          : 'bg-indigo-100 text-indigo-900 border-indigo-200',
                      )}
                    >
                      {g.source}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">📅 {eventDateStr}</span>
                    {displayVehicle && (
                      <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        🚛 {displayVehicle}
                      </span>
                    )}
                  </div>

                  {g.isOrder ? (
                    <div className="flex items-center gap-2 flex-wrap pt-0.5">
                      <button
                        type="button"
                        onClick={() => onViewOrder(g.service_order_id || g.orderNumber || null)}
                        className="text-base font-extrabold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 cursor-pointer text-left leading-tight group/link"
                        title="Нажмите, чтобы открыть детали и смету заказ-наряда"
                      >
                        <span>{g.title}</span>
                        <span className="material-symbols-outlined text-[16px] text-blue-500 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform">
                          open_in_new
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onViewOrder(g.service_order_id || g.orderNumber || null)}
                        className="text-[10px] font-black uppercase text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-md transition-all active:scale-95 cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[12px]">visibility</span>
                        <span>Детали наряда</span>
                      </button>
                    </div>
                  ) : g.isTrip ? (
                    <div className="flex items-center gap-2 flex-wrap pt-0.5">
                      <button
                        type="button"
                        onClick={() => onViewTrip(g.trip_id || g.tripNumber || null)}
                        className="text-base font-extrabold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1.5 cursor-pointer text-left leading-tight group/link"
                        title="Нажмите, чтобы открыть детали рейса и начислений"
                      >
                        <span>{g.title}</span>
                        <span className="material-symbols-outlined text-[16px] text-indigo-500 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform">
                          open_in_new
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onViewTrip(g.trip_id || g.tripNumber || null)}
                        className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-md transition-all active:scale-95 cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[12px]">visibility</span>
                        <span>Детали рейса</span>
                      </button>
                    </div>
                  ) : (
                    <h4 className="text-base font-extrabold text-slate-900 leading-tight">
                      {g.title}
                    </h4>
                  )}
                </div>

                <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-lg sm:text-xl font-black tracking-tight',
                        isCompleted ? 'text-emerald-700' : 'text-slate-900',
                      )}
                    >
                      +&nbsp;{g.totalAmount.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>

                  {isCompleted && (
                    <div className="flex flex-col items-end gap-1">
                      <div className="inline-flex items-center gap-1 px-3 py-1 bg-white/90 border-2 border-emerald-600 text-emerald-700 font-black text-[11px] rounded-lg uppercase tracking-wider shadow-xs rotate-[-2deg] select-none">
                        <span className="material-symbols-outlined text-[15px]">verified</span>
                        ОПЛАЧЕНО
                      </div>
                      <span className="text-[10px] text-emerald-800 font-extrabold bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-md shadow-2xs">
                        выплачено {paidDateStr}
                      </span>
                    </div>
                  )}

                  {isPending && (
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/90 border-2 border-rose-500 text-rose-700 font-black text-[10px] rounded-lg uppercase tracking-wider rotate-[-2deg] select-none">
                      <span className="material-symbols-outlined text-[13px]">hourglass_top</span>
                      НЕ ОПЛАЧЕНО
                    </div>
                  )}

                  {isPartial && (
                    <div className="flex flex-col items-end gap-1">
                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100/90 border border-emerald-300 text-emerald-900 font-extrabold text-[10px] rounded-md uppercase tracking-wide">
                        <span className="material-symbols-outlined text-[12px] text-emerald-700">
                          done
                        </span>
                        <span>
                          Оплачено {g.paidAmount.toLocaleString('ru-RU')} ₽ ({Math.round(g.paidPct)}
                          %)
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-700 font-bold">
                        выплачено {paidDateStr}
                      </span>
                      <span className="text-[11px] font-bold text-rose-700">
                        Остаток: {g.unpaidAmount.toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {hasMultipleWorks && (
                <div className="relative z-10 mt-3 pt-2.5 border-t border-slate-200/70">
                  <button
                    type="button"
                    onClick={() => onToggleGroup(g.groupKey)}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 py-1 cursor-pointer transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px] text-slate-500">
                      {isExpanded ? 'expand_less' : 'expand_more'}
                    </span>
                    <span>
                      {isExpanded
                        ? 'Скрыть детализацию'
                        : `Показать все работы (${g.works.length})`}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="mt-2 space-y-1.5 bg-white/80 rounded-xl p-3 border border-slate-200 shadow-xs">
                      <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                        Состав работ:
                      </div>
                      {g.works.map((w) => {
                        const isWorkPaid = w.settlement_status === 'completed';
                        return (
                          <div
                            key={w.id}
                            className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0 group/item hover:bg-slate-50 rounded px-1.5 transition-colors"
                          >
                            <div className="flex-1 pr-2">
                              <span className="font-medium text-slate-800">{w.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {editingId === w.id ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editAmount}
                                    onChange={(e) => onEditAmountChange(e.target.value)}
                                    className="w-20 border border-emerald-400 rounded px-1.5 py-0.5 text-xs font-bold"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => onSaveEdit(w.id)}
                                    disabled={saving}
                                    className="text-xs bg-emerald-600 text-white rounded px-2 py-0.5 font-bold hover:bg-emerald-700 disabled:opacity-50"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={onCancelEdit}
                                    className="text-xs text-slate-400 hover:text-slate-600 px-1"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span
                                    className={cn(
                                      'font-bold',
                                      isWorkPaid ? 'text-emerald-700' : 'text-rose-600',
                                    )}
                                  >
                                    {w.amount.toLocaleString('ru-RU')} ₽
                                  </span>
                                  <span
                                    className={cn(
                                      'text-[9px] font-black px-1.5 py-0.5 rounded border uppercase',
                                      isWorkPaid
                                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                        : 'bg-rose-100 text-rose-800 border-rose-200',
                                    )}
                                  >
                                    {isWorkPaid ? 'Оплачено' : 'К выплате'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => onStartEdit(w.id, w.amount)}
                                    className="text-slate-400 hover:text-blue-600 opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5"
                                    title="Изменить сумму работы"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">
                                      edit
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDelete(w.id, w.title)}
                                    disabled={saving}
                                    className="text-slate-400 hover:text-rose-600 opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5"
                                    title="Удалить работу"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">
                                      delete
                                    </span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {!hasMultipleWorks && g.works[0] && (
                <div className="relative z-10 flex items-center justify-end gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {editingId === g.works[0].id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editAmount}
                        onChange={(e) => onEditAmountChange(e.target.value)}
                        className="w-24 border border-emerald-400 rounded-lg px-2 py-1 text-xs font-bold"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => onSaveEdit(g.works[0]!.id)}
                        disabled={saving}
                        className="text-xs bg-emerald-600 text-white rounded-lg px-2.5 py-1 font-bold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                      >
                        ✓ Сохранить
                      </button>
                      <button
                        type="button"
                        onClick={onCancelEdit}
                        className="text-xs text-slate-400 hover:text-slate-600 px-1.5 py-1"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onStartEdit(g.works[0]!.id, g.works[0]!.amount)}
                        className="text-slate-400 hover:text-blue-600 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                        title="Редактировать сумму"
                      >
                        <span className="material-symbols-outlined text-[15px]">edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(g.works[0]!.id, g.title)}
                        disabled={saving}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                        title="Удалить"
                      >
                        <span className="material-symbols-outlined text-[15px]">delete</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </>
  );
}
