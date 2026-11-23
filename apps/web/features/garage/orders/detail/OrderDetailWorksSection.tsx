'use client';

import { useState } from 'react';
import { cn } from '@saldacargo/ui';
import type { Mechanic, MechanicWithPct, OrderDetail } from '../../types';
import { fmtDate, getSpecialtyLabel } from '../../utils';
import { type AddWorkPayload, OrderDetailAddWorkForm } from './OrderDetailAddWorkForm';
import { OrderDetailWorkEditForm, type PatchWorkBody } from './OrderDetailWorkEditForm';

export function OrderDetailWorksSection({
  order,
  mechanics,
  hourlyRate,
  approvalSentMsg,
  prevApprovalDate,
  sendApprovalPending,
  onOpenApproval,
  showAddWork,
  setShowAddWork,
  addWorkPending,
  addWorkError,
  onAddWork,
  editingWorkId,
  setEditingWorkId,
  onEditWorkPriceDraft,
  patchWorkPending,
  patchWorkError,
  onPatchWork,
  deleteWorkPending,
  onDeleteWork,
}: {
  order: OrderDetail;
  mechanics: Mechanic[];
  hourlyRate: number;
  approvalSentMsg: string | null;
  prevApprovalDate: string | null;
  sendApprovalPending: boolean;
  onOpenApproval: () => void;
  showAddWork: boolean;
  setShowAddWork: (v: boolean) => void;
  addWorkPending: boolean;
  addWorkError: string | null;
  onAddWork: (payload: AddWorkPayload) => void;
  editingWorkId: string | null;
  setEditingWorkId: (id: string | null) => void;
  onEditWorkPriceDraft: (price: string) => void;
  patchWorkPending: boolean;
  patchWorkError: Error | null;
  onPatchWork: (workId: string, body: PatchWorkBody) => void;
  deleteWorkPending: boolean;
  onDeleteWork: (workId: string) => void;
}) {
  const [confirmDeleteWorkId, setConfirmDeleteWorkId] = useState<string | null>(null);

  // Итог ЗП по исполнителям за заказ-наряд
  const mechSummaryMap: Record<
    string,
    { name: string; count: number; salary: number; pct: number }
  > = {};
  order.works.forEach((w) => {
    if (w.status === 'cancelled') return;
    const mechs = [w.mechanic_id, w.second_mechanic_id].filter((x): x is string => !!x);
    if (mechs.length === 0) return;
    const workPrice = parseFloat(w.price_client ?? '0');
    const basePrice = mechs.length === 2 ? workPrice / 2 : workPrice;
    for (const mechId of mechs) {
      const mech = mechanics.find((m) => m.id === mechId);
      const name = mech?.name ?? 'Исполнитель';
      const pct = parseFloat((mech as MechanicWithPct)?.mechanic_salary_pct ?? '50');
      const salary = (basePrice * pct) / 100;
      if (!mechSummaryMap[mechId]) {
        mechSummaryMap[mechId] = { name, count: 0, salary: 0, pct };
      }
      mechSummaryMap[mechId].count += 1;
      mechSummaryMap[mechId].salary += salary;
    }
  });

  const mechEntries = Object.entries(mechSummaryMap);
  const totalMechsSalary = mechEntries.reduce((sum, [, data]) => sum + data.salary, 0);

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-500 font-semibold uppercase">
              Работы ({order.works.length})
            </p>
            {(approvalSentMsg || prevApprovalDate) && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {approvalSentMsg || `Согласование в MAX (${prevApprovalDate})`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {order.works.length > 0 && (
              <button
                onClick={onOpenApproval}
                disabled={sendApprovalPending}
                className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1 transition-colors cursor-pointer"
                title="Отправить список работ руководителю в MAX"
              >
                💬 Согласовать в MAX
              </button>
            )}
            <button
              onClick={() => setShowAddWork(!showAddWork)}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors"
            >
              {showAddWork ? '✕ Закрыть' : '+ Добавить'}
            </button>
          </div>
        </div>

        {showAddWork && (
          <OrderDetailAddWorkForm
            order={order}
            mechanics={mechanics}
            hourlyRate={hourlyRate}
            isPending={addWorkPending}
            serverError={addWorkError}
            onSubmit={onAddWork}
          />
        )}

        {order.works.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Работы не добавлены</p>
        ) : (
          <div className="space-y-1">
            {order.works.map((w) => {
              const name = w.custom_work_name ?? w.work_catalog?.name ?? 'Без названия';
              const category =
                w.custom_work_description || w.notes?.match(/\[category:([^\]]+)\]/)?.[1] || null;
              const dateFormatted = w.created_at ? fmtDate(w.created_at) : null;
              const isEditing = editingWorkId === w.id;
              const isDone = w.status === 'completed';
              const priceNum = parseFloat(w.price_client ?? '0');
              const normHours = (w.norm_minutes * (w.quantity ?? 1)) / 60;

              const workMechs = [w.mechanic_id, w.second_mechanic_id]
                .filter(Boolean)
                .map((id) => mechanics.find((m) => m.id === id))
                .filter((m): m is Mechanic => !!m);

              return (
                <div key={w.id}>
                  <div
                    className={cn(
                      'group flex items-center gap-2 rounded-lg px-3 py-2.5 transition-all duration-150',
                      'hover:shadow-md hover:scale-[1.01] cursor-default',
                      isDone
                        ? 'bg-emerald-50/60 border border-emerald-100'
                        : 'bg-slate-50 border border-transparent',
                    )}
                  >
                    {/* Status circle */}
                    <div
                      className={cn(
                        'w-2.5 h-2.5 rounded-full flex-shrink-0',
                        isDone ? 'bg-emerald-500' : 'bg-red-400',
                      )}
                      title={isDone ? 'Завершена' : 'В работе'}
                    />

                    {/* Name + Date + Category + Performers */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-center gap-2 flex-wrap">
                        {dateFormatted && (
                          <span
                            className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-1.5 py-0.5 rounded leading-none shrink-0"
                            title="Дата выполнения"
                          >
                            📅 {dateFormatted}
                          </span>
                        )}
                        {category && (
                          <span
                            className="text-[10px] font-bold text-blue-700 bg-blue-100/90 px-1.5 py-0.5 rounded leading-none shrink-0"
                            title="Категория / Узел"
                          >
                            ⚙️ {category}
                          </span>
                        )}
                        <p className="text-sm font-semibold text-slate-800 leading-snug">
                          {name}
                          {(w.quantity ?? 1) > 1 && (
                            <span className="ml-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                              ×{w.quantity}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <p className="text-xs text-slate-400">
                          {normHours.toFixed(1)} нч
                          {w.actual_minutes
                            ? ` · факт ${(w.actual_minutes / 60).toFixed(1)} нч`
                            : ''}
                        </p>
                        {workMechs.map((m) => {
                          const basePrice = workMechs.length === 2 ? priceNum / 2 : priceNum;
                          const pct = parseFloat(m.mechanic_salary_pct ?? '50');
                          const salary = (basePrice * pct) / 100;
                          const specLabel = getSpecialtyLabel(m.roles);
                          return (
                            <span
                              key={m.id}
                              className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded leading-none inline-flex items-center gap-1"
                            >
                              <span>{m.name.split(' ')[0]}</span>
                              {specLabel && (
                                <span className="opacity-80 text-[9px] font-bold">
                                  ({specLabel})
                                </span>
                              )}
                              {salary > 0 ? <span>+{salary}₽</span> : ''}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Price */}
                    <span
                      className={cn(
                        'text-base font-black shrink-0',
                        isDone ? 'text-emerald-700' : 'text-slate-700',
                      )}
                    >
                      {priceNum > 0 ? `${priceNum.toLocaleString('ru-RU')} ₽` : '—'}
                    </span>

                    {/* Edit pencil */}
                    <button
                      onClick={() => {
                        if (isEditing) {
                          setEditingWorkId(null);
                          onEditWorkPriceDraft('');
                          return;
                        }
                        setEditingWorkId(w.id);
                        onEditWorkPriceDraft(
                          w.price_client ?? String(Math.round(normHours * hourlyRate)),
                        );
                      }}
                      className="shrink-0 text-slate-300 group-hover:text-blue-500 transition-all duration-150 text-base hover:text-2xl hover:text-blue-700"
                      title="Редактировать"
                    >
                      ✏
                    </button>

                    {/* Delete */}
                    {confirmDeleteWorkId === w.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            onDeleteWork(w.id);
                            setConfirmDeleteWorkId(null);
                          }}
                          disabled={deleteWorkPending}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-800 px-2 py-0.5 rounded bg-rose-50 border border-rose-200"
                        >
                          Удалить
                        </button>
                        <button
                          onClick={() => setConfirmDeleteWorkId(null)}
                          className="text-xs text-slate-400 hover:text-slate-600 px-1.5 py-0.5"
                        >
                          Отмена
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteWorkId(w.id)}
                        className="text-slate-300 hover:text-rose-500 text-lg leading-none shrink-0"
                        title="Удалить"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Edit panel */}
                  {isEditing && (
                    <OrderDetailWorkEditForm
                      key={w.id}
                      work={w}
                      mechanics={mechanics}
                      hourlyRate={hourlyRate}
                      isPending={patchWorkPending}
                      error={patchWorkError}
                      onPriceDraftChange={onEditWorkPriceDraft}
                      onSave={(body) => onPatchWork(w.id, body)}
                      onCancel={() => {
                        setEditingWorkId(null);
                        onEditWorkPriceDraft('');
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Итог ЗП по исполнителям за заказ-наряд */}
      {mechEntries.length > 0 && (
        <div className="mb-4 border border-emerald-200 bg-emerald-50/50 rounded-xl overflow-hidden">
          <div className="bg-emerald-100/70 px-3 py-2 text-[10px] font-black text-emerald-900 uppercase tracking-widest flex items-center justify-between">
            <span>Итог ЗП по исполнителям ({mechEntries.length})</span>
            <span className="font-bold normal-case text-emerald-800 text-xs">
              Всего ЗП: {Math.round(totalMechsSalary).toLocaleString('ru-RU')} ₽
            </span>
          </div>
          <div className="divide-y divide-emerald-100/80">
            {mechEntries.map(([mId, data]) => (
              <div key={mId} className="flex items-center justify-between px-3 py-2 text-xs">
                <div className="min-w-0 pr-2">
                  <span className="font-semibold text-slate-800">{data.name}</span>
                  <span className="text-slate-500 text-[11px] ml-1.5 font-normal">
                    ({data.count}{' '}
                    {data.count === 1 ? 'операция' : data.count < 5 ? 'операции' : 'операций'})
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-bold text-emerald-700 text-sm">
                    {Math.round(data.salary).toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
