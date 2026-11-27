'use client';

import { useState } from 'react';
import { formatDate } from '@saldacargo/shared';
import { LifecycleBadge, Money, cn } from '@saldacargo/ui';
import type { MiniappServiceOrder, MiniappServiceOrderWork } from './types';

export function ServiceOrderReviewCard({
  order,
  onEdit,
  onEditWork,
  onApprove,
  onReturn,
  onDelete,
  approving,
  defaultExpanded = true,
  readOnly = false,
}: {
  order: MiniappServiceOrder;
  onEdit: (o: MiniappServiceOrder) => void;
  onEditWork?: (o: MiniappServiceOrder, w: MiniappServiceOrderWork) => void;
  onApprove: (
    id: string,
    isPartialWorkReview?: boolean,
    mechanicPay?: number,
    workId?: string,
  ) => void;
  onReturn: (id: string) => void;
  onDelete: (id: string) => void;
  approving: boolean;
  defaultExpanded?: boolean;
  readOnly?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isOwn = order.machine_type === 'own';
  const hourlyRate = Number(order.hourly_rate || (isOwn ? 1600 : 2000));
  const salaryPct = Number(order.salary_pct || 50);
  const activeWorks = (order.works ?? []).filter((w) => w.status !== 'cancelled');
  const parts = order.parts ?? [];
  const totalMinutes =
    Number(order.total_minutes) ||
    activeWorks.reduce(
      (s, w) =>
        s + Number(w.actual_minutes || w.norm_minutes || 0) * Math.max(1, Number(w.quantity || 1)),
      0,
    );
  const mechanicPay = parseFloat(order.mechanic_pay || order.estimated_pay || '0');
  const worksSum = parseFloat(order.works_total || '0') || (totalMinutes / 60) * hourlyRate;
  const odo = order.odometer_end || order.odometer_start;
  const canReview = order.lifecycle_status === 'draft' || order.lifecycle_status === 'returned';
  const isPartialWorkReview = Boolean(order.is_partial_work_review);

  const vehicleTitle = isOwn
    ? `${order.asset?.short_name ?? 'Свой ТС'} · ${order.asset?.reg_number ?? ''}`
    : `${order.client_vehicle_model || order.client_vehicle_brand || 'Клиентский авто'} · ${order.client_vehicle_reg || 'без номера'}`;

  const cleanMechanicNote = (order.mechanic_note || '')
    .replace('[Запчасти предоставил автосервис]', '')
    .trim();

  // Компактный режим ревью конкретных работ (когда заказ-наряд в работе — показываем только работы на проверку)
  if (!readOnly && isPartialWorkReview && activeWorks.length > 0) {
    return (
      <div className="space-y-2.5">
        {activeWorks.map((w, idx) => {
          const mins =
            Number(w.actual_minutes || w.norm_minutes || 0) * Math.max(1, Number(w.quantity || 1));
          const explicitPrice = parseFloat(String(w.price_client || '0'));
          const wPrice = explicitPrice > 0 ? explicitPrice : (mins / 60) * hourlyRate;
          const customPctMatch = w.notes
            ? String(w.notes).match(/\[salary_pct:(\d+(?:\.\d+)?)\]/)
            : null;
          const wPct =
            customPctMatch && customPctMatch[1] ? parseFloat(customPctMatch[1]) : salaryPct;
          const wPay = (wPrice * wPct) / 100;
          const wMech1 = w.mechanic_name || (!w.mechanic_id ? order.mechanic?.name : null);
          const wMech2 =
            w.second_mechanic_name ||
            (!w.mechanic_id && !w.second_mechanic_id ? order.second_mechanic?.name : null);
          const mechLabel =
            wMech1 && wMech2 && wMech2 !== wMech1
              ? `${wMech1.split(' ')[0]} + ${wMech2.split(' ')[0]}`
              : (wMech1 || wMech2 || 'Не назначен').split(' ')[0];
          const hoursVal = mins / 60;
          const hoursStr = `${Number.isInteger(hoursVal) ? hoursVal.toString() : hoursVal.toFixed(1)} ч`;

          return (
            <div
              key={w.id || `${order.id}-${idx}`}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                    НЗ-{order.order_number}
                  </span>
                  <span className="text-xs font-bold text-slate-700 truncate">{vehicleTitle}</span>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border',
                    isOwn
                      ? 'bg-sky-50 text-sky-700 border-sky-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200',
                  )}
                >
                  {isOwn ? '🏢 Свой' : '🚗 Клиент'}
                </span>
              </div>

              <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {w.custom_work_name || w.work_catalog?.name || w.work_description || 'Работа'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    👨‍🔧 {mechLabel} · ⏱ {mins} мин ({hoursStr})
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-slate-900 tabular-nums">
                    {Math.round(wPrice).toLocaleString('ru-RU')} ₽
                  </p>
                  <p className="text-xs font-bold text-emerald-600 tabular-nums">
                    ЗП {Math.round(wPay).toLocaleString('ru-RU')} ₽
                  </p>
                </div>
              </div>

              <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => (onEditWork ? onEditWork(order, w) : onEdit(order))}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 active:bg-slate-100 shrink-0"
                >
                  ✏️ Изменить
                </button>
                <button
                  type="button"
                  onClick={() => onReturn(order.id)}
                  disabled={approving}
                  className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-600 active:bg-rose-100 disabled:opacity-50 shrink-0"
                >
                  ↩ Вернуть
                </button>
                <button
                  type="button"
                  onClick={() => onApprove(order.id, true, undefined, w.id)}
                  disabled={approving}
                  className="flex-1 py-1.5 rounded-xl bg-emerald-600 active:bg-emerald-700 text-white text-xs font-black disabled:opacity-50 shadow-xs"
                >
                  {approving ? '...' : '✓ Утвердить работу'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-zinc-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full p-4 text-left flex items-start justify-between gap-2 active:bg-zinc-50 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="font-black text-zinc-900 text-sm">Наряд №{order.order_number}</span>
            <span
              className={cn(
                'text-[10px] font-black px-2 py-0.5 rounded-full uppercase',
                isOwn
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-sky-50 text-sky-700 border border-sky-200',
              )}
            >
              {isOwn ? '🏢 Свой авто · 1 600 ₽/ч' : '🚗 Клиентский · 2 000 ₽/ч'}
            </span>
            <LifecycleBadge status={order.lifecycle_status} />
            {isPartialWorkReview && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                🔧 В работе · работы на ревью
              </span>
            )}
          </div>
          <p className="text-xs font-extrabold text-zinc-800 truncate">{vehicleTitle}</p>
          <p className="text-[11px] text-zinc-500 font-bold mt-0.5">
            👨‍🔧 {order.mechanic?.name ?? 'Механик не указан'}
            {order.second_mechanic?.name ? ` + ${order.second_mechanic.name}` : ''} · 📅{' '}
            {formatDate(order.created_at)}
            {odo ? ` · 🛣 ${Number(odo).toLocaleString('ru-RU')} км` : ''}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] font-bold text-zinc-400 uppercase">ЗП Механика</p>
          <p className="font-black text-emerald-600 text-base">
            <Money amount={mechanicPay.toFixed(2)} />
          </p>
          <p className="text-[10px] text-zinc-400 font-bold">{totalMinutes} мин</p>
        </div>
      </button>

      {expanded && (
        <div>
          <div className="px-4 pb-3 border-t border-zinc-100 pt-3 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
              4. Перечень работ ({activeWorks.length})
            </p>
            {activeWorks.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">
                {order.problem_description || 'Работы не указаны'}
              </p>
            ) : (
              <div className="space-y-1.5">
                {activeWorks.map((w, i) => {
                  const mins =
                    Number(w.actual_minutes || w.norm_minutes || 0) *
                    Math.max(1, Number(w.quantity || 1));
                  const explicitPrice = parseFloat(String(w.price_client || '0'));
                  const wPrice = explicitPrice > 0 ? explicitPrice : (mins / 60) * hourlyRate;
                  const customPctMatch = w.notes
                    ? String(w.notes).match(/\[salary_pct:(\d+(?:\.\d+)?)\]/)
                    : null;
                  const wPct =
                    customPctMatch && customPctMatch[1] ? parseFloat(customPctMatch[1]) : salaryPct;
                  const wPay = (wPrice * wPct) / 100;
                  const wMech1 = w.mechanic_name || (!w.mechanic_id ? order.mechanic?.name : null);
                  const wMech2 =
                    w.second_mechanic_name ||
                    (!w.mechanic_id && !w.second_mechanic_id ? order.second_mechanic?.name : null);
                  const hasWorkMechs = Boolean(
                    w.mechanic_id ||
                    w.second_mechanic_id ||
                    order.second_mechanic?.name ||
                    w.mechanic_name ||
                    w.second_mechanic_name,
                  );
                  const workMechsLabel =
                    wMech1 && wMech2 && wMech2 !== wMech1
                      ? `${wMech1} + ${wMech2}`
                      : wMech1 || wMech2 || null;
                  return (
                    <div
                      key={w.id || i}
                      className="bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-zinc-900 flex items-center gap-1.5 flex-wrap">
                          <span>
                            {i + 1}.{' '}
                            {w.custom_work_name ||
                              w.work_catalog?.name ||
                              w.work_description ||
                              'Работа'}
                          </span>
                          {hasWorkMechs && workMechsLabel && (
                            <span className="text-[9px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">
                              👨‍🔧 {workMechsLabel}
                            </span>
                          )}
                          {isPartialWorkReview &&
                            (w.salary_paid || String(w.notes || '').includes('[reviewed]') ? (
                              <span className="text-[9px] font-extrabold text-zinc-500 bg-zinc-200/80 px-1.5 py-0.5 rounded">
                                Оценено
                              </span>
                            ) : (
                              <span className="text-[9px] font-extrabold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                                На ревью
                              </span>
                            ))}
                        </p>
                        <p className="text-[11px] text-emerald-700 font-extrabold mt-0.5">
                          ⏱ Время: {mins} мин · ЗП: {Math.round(wPay).toLocaleString('ru-RU')} ₽
                          {customPctMatch && (
                            <span className="text-[10px] text-emerald-600 font-bold ml-1.5 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              {wPct}%
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="text-xs font-black text-zinc-700 shrink-0">
                        {Math.round(wPrice).toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {(order.parts_provided_by_service || parts.length > 0) && (
            <div className="px-4 pb-3 pt-2 border-t border-zinc-100 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-600 font-black text-xs">☑</span>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                  Запчасти предоставил автосервис ({parts.length})
                </span>
              </div>
              {parts.length > 0 && (
                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-2.5 space-y-1">
                  {parts.map((p, idx) => (
                    <div
                      key={p.id || idx}
                      className="flex items-center justify-between text-xs font-bold text-zinc-800"
                    >
                      <span>• {p.custom_part_name || p.part?.name || 'Запчасть'}</span>
                      <span className="text-emerald-700 font-black">
                        {p.quantity} {p.unit || p.part?.unit || 'шт'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {(cleanMechanicNote || order.admin_note) && (
            <div className="px-4 py-2 border-t border-zinc-100 space-y-1 text-xs">
              {cleanMechanicNote && (
                <p className="text-amber-700 font-medium">💬 Механик: {cleanMechanicNote}</p>
              )}
              {order.admin_note && (
                <p className="text-zinc-600 font-medium">📌 Админ: {order.admin_note}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 border-t border-zinc-100 bg-zinc-50">
            <div className="text-center px-2 py-2.5 border-r border-zinc-100">
              <p className="text-[9px] font-bold text-zinc-400 uppercase">Время работ</p>
              <p className="font-black text-zinc-800 text-xs">
                {totalMinutes} мин ({(totalMinutes / 60).toFixed(1)} ч)
              </p>
            </div>
            <div className="text-center px-2 py-2.5 border-r border-zinc-100">
              <p className="text-[9px] font-bold text-zinc-400 uppercase">Сумма работ</p>
              <p className="font-bold text-zinc-800 text-xs">
                <Money amount={worksSum.toFixed(2)} />
              </p>
            </div>
            <div className="text-center px-2 py-2.5">
              <p className="text-[9px] font-bold text-zinc-400 uppercase">ЗП ({salaryPct}%)</p>
              <p className="font-black text-emerald-600 text-xs">
                <Money amount={mechanicPay.toFixed(2)} />
              </p>
            </div>
          </div>

          {!readOnly && (
            <div className="px-4 pb-4 pt-3 border-t border-zinc-100 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onEdit(order)}
                className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 border border-zinc-200 px-3.5 py-2.5 rounded-xl active:bg-zinc-100 shrink-0"
              >
                ✏️ Изменить
              </button>
              <button
                type="button"
                onClick={() => onDelete(order.id)}
                disabled={approving}
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-500 active:bg-rose-100 disabled:opacity-50 shrink-0"
                title="Удалить заказ-наряд"
              >
                🗑️
              </button>
              {canReview && (
                <>
                  <button
                    type="button"
                    onClick={() => onReturn(order.id)}
                    disabled={approving}
                    className="flex-1 text-xs font-bold text-red-600 border border-red-200 bg-red-50 py-2.5 rounded-xl active:bg-red-100 text-center disabled:opacity-50"
                  >
                    Вернуть
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onApprove(
                        order.id,
                        isPartialWorkReview,
                        mechanicPay > 0 ? Number(mechanicPay.toFixed(2)) : undefined,
                      )
                    }
                    disabled={approving}
                    className="flex-1 text-xs font-black text-white bg-emerald-600 py-2.5 rounded-xl active:bg-emerald-700 text-center disabled:opacity-50 shadow-sm"
                  >
                    {approving
                      ? '...'
                      : isPartialWorkReview
                        ? '✓ Зафиксировать оценку'
                        : '✓ Одобрить'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
