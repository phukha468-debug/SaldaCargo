'use client';

import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Money, TripRouteSheet, cn } from '@saldacargo/ui';
import {
  formatTripPeriod,
  isWialonGpsAsset,
  auditTripFuel,
  auditTripWialon,
  type TripWialonAudit,
} from '@saldacargo/shared';
import type { TripForReview } from '../types';
import { calcTrip } from '../utils';
import { TripCardOrdersTable } from './TripCardOrdersTable';
import { TripFuelAuditModal, TripWialonAuditModal } from './TripAuditModals';

export function TripCard({
  trip,
  mode,
  expanded,
  onToggle,
  onEdit,
  onApprove,
  onReturn,
  onDelete,
  approving,
  deleting,
}: {
  trip: TripForReview;
  mode: 'review' | 'history' | 'active';
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onApprove: () => void;
  onReturn: () => void;
  onDelete: () => void;
  approving: boolean;
  deleting: boolean;
}) {
  const { activeOrders, expenses, revenue, driverPay, loaderPay, totalExpenses, mileage, profit } =
    calcTrip(trip);
  const totalCosts = driverPay + loaderPay + totalExpenses;
  const period = formatTripPeriod(trip.started_at, trip.ended_at, {
    createdAt: trip.created_at,
    asset: trip.asset,
  });

  const cashRevenue = activeOrders
    .filter((o) => o.payment_method === 'cash')
    .reduce((s, o) => s + parseFloat(o.amount), 0);
  const cashExpenses = expenses
    .filter((e) => e.payment_method === 'cash')
    .reduce((s, e) => s + parseFloat(e.amount), 0);
  const cashToSurrender = Math.max(0, cashRevenue - cashExpenses);
  const isCashNotSurrendered =
    (trip.admin_note ?? '').includes('[CASH_NOT_SURRENDERED]') ||
    (trip.driver_note ?? '').includes('[CASH_NOT_COLLECTED]') ||
    (trip.driver_note ?? '').includes('[НЕ СДАНО В КАССУ') ||
    (trip.driver_note ?? '').includes('[ПЕРЕНОС НАЛИЧНЫХ') ||
    (trip.driver_note ?? '').includes('[CARRYOVER]');
  const hasCarryover = isCashNotSurrendered;
  const fuelAudit = auditTripFuel(trip);
  const wialonAudit = auditTripWialon(trip);
  const queryClient = useQueryClient();
  const [showWialonModal, setShowWialonModal] = useState(false);
  const [isApplyingWialon, setIsApplyingWialon] = useState(false);
  const [togglingCashHold, setTogglingCashHold] = useState(false);

  const handleToggleCashHold = async (checked: boolean) => {
    try {
      setTogglingCashHold(true);
      const res = await fetch(`/api/trips/${trip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cash_not_surrendered: checked }),
      });
      if (!res.ok) {
        const j = await res.json();
        alert(j.error || 'Ошибка изменения статуса сдачи наличных');
      } else {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['trips-review'], refetchType: 'all' }),
          queryClient.invalidateQueries({ queryKey: ['trips-week'], refetchType: 'all' }),
          queryClient.invalidateQueries({ queryKey: ['trips-month'], refetchType: 'all' }),
          queryClient.invalidateQueries({
            queryKey: ['receivable-settlements'],
            refetchType: 'all',
          }),
        ]);
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ['trips-review'] }),
          queryClient.refetchQueries({ queryKey: ['trips-week'] }),
          queryClient.refetchQueries({ queryKey: ['trips-month'] }),
        ]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Неизвестная ошибка';
      alert(`Ошибка сети: ${msg}`);
    } finally {
      setTogglingCashHold(false);
    }
  };

  const handleApplyWialon = async (tripId: string, auditData?: TripWialonAudit) => {
    try {
      setIsApplyingWialon(true);
      const res = await fetch(`/api/trips/${tripId}/wialon-telematics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          auditData
            ? {
                wialonKm: auditData.wialonKm,
                startOdo: auditData.odoStart,
                endOdo: auditData.odoEnd,
                normLiters: auditData.normLiters,
                normCost: auditData.normCost,
                driverPay: auditData.driverPay,
              }
            : {},
        ),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        alert(`Ошибка применения Wialon: ${json.error || 'Неизвестная ошибка'}`);
      } else {
        queryClient.invalidateQueries({ queryKey: ['trips-review'] });
        queryClient.invalidateQueries({ queryKey: ['trips-month'] });
        queryClient.invalidateQueries({ queryKey: ['trips-week'] });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Неизвестная ошибка';
      alert(`Ошибка связи: ${msg}`);
    } finally {
      setIsApplyingWialon(false);
    }
  };

  const loaderNames = [
    ...new Set(
      activeOrders.flatMap((o) => [
        o.loader && parseFloat(o.loader_pay) > 0 ? o.loader.name.split(' ')[0] : null,
        o.loader2 && parseFloat(o.loader2_pay ?? '0') > 0 ? o.loader2.name.split(' ')[0] : null,
      ]),
    ),
  ].filter(Boolean) as string[];
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showFuelModal, setShowFuelModal] = useState(false);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accentColor =
    profit > 0 ? 'border-l-emerald-400' : profit < 0 ? 'border-l-rose-400' : 'border-l-slate-300';

  const handleDeleteClick = () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      deleteTimer.current = setTimeout(() => setDeleteConfirm(false), 4000);
    } else {
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
      setDeleteConfirm(false);
      onDelete();
    }
  };

  const [prevExpanded, setPrevExpanded] = useState(expanded);
  if (!expanded && prevExpanded) {
    setPrevExpanded(expanded);
    setDeleteConfirm(false);
  } else if (expanded !== prevExpanded) {
    setPrevExpanded(expanded);
  }

  useEffect(() => {
    if (!expanded && deleteTimer.current) {
      clearTimeout(deleteTimer.current);
      deleteTimer.current = null;
    }
    return () => {
      if (deleteTimer.current) {
        clearTimeout(deleteTimer.current);
        deleteTimer.current = null;
      }
    };
  }, [expanded]);

  return (
    <div
      className={cn(
        'bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-shadow duration-200 hover:shadow-md border-l-4',
        accentColor,
      )}
    >
      {/* Collapsed header — single compact row */}
      <div
        className="px-4 py-2.5 cursor-pointer hover:bg-slate-50/60 transition-colors select-none"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {/* Left: identity */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
            <span className="font-black text-slate-900 text-sm whitespace-nowrap">
              {trip.asset?.reg_number === 'БЕЗ АВТО' ? '👷 ПРР' : `🚚 ${trip.asset.short_name}`}
            </span>
            <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap">
              {trip.asset?.reg_number === 'БЕЗ АВТО' ? '(без авто)' : trip.asset.reg_number}
            </span>
            <span className="text-slate-300 text-xs">·</span>
            <span className="text-sm text-slate-700 font-semibold truncate max-w-[90px]">
              {trip.driver.name.split(' ')[0]}
            </span>
            {trip.loader && (
              <>
                <span className="text-slate-300 text-xs">+</span>
                <span className="text-sm text-blue-600 font-semibold truncate max-w-[80px]">
                  {trip.loader.name.split(' ')[0]}
                </span>
              </>
            )}
            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded text-[9px] font-bold shrink-0">
              #{trip.trip_number}
            </span>
            {trip.lifecycle_status === 'returned' && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-xs shrink-0 flex items-center gap-0.5"
                title="На доработке"
              >
                <span>⚠️</span>
                <span className="hidden sm:inline">Доработка</span>
              </span>
            )}
            {(trip.admin_note?.includes('[УТОЧНИТЬ_ВОДИТЕЛЯ]') ||
              trip.driver_note?.includes('ТРЕБУЕТСЯ УТОЧНИТЬ ВОДИТЕЛЯ')) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500 hover:bg-amber-600 text-white shadow-xs shrink-0 flex items-center gap-0.5 cursor-pointer"
                title="На автомобиле нет закрепленного водителя. Нажмите для выбора водителя"
              >
                <span>⚠️</span>
                <span className="hidden md:inline">Уточнить водителя</span>
              </button>
            )}
            {/* Бейджи типов заказов рейса (ППР / Авто) */}
            {(() => {
              const pprCount = activeOrders.filter(
                (o) => o.direction === 'loaders_only' || trip.asset?.reg_number === 'БЕЗ АВТО',
              ).length;
              const autoCount = activeOrders.length - pprCount;
              if (trip.asset?.reg_number !== 'БЕЗ АВТО' && pprCount > 0) {
                if (autoCount === 0) {
                  return (
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-2xs shrink-0 flex items-center gap-1"
                      title="Все заказы в этом рейсе — погрузо-разгрузочные работы (без авто)"
                    >
                      <span>👷</span>
                      <span>Только ППР</span>
                    </span>
                  );
                }
                return (
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs shrink-0 flex items-center gap-1"
                    title={`В рейсе ${pprCount} заказ(а) ППР и ${autoCount} на машине`}
                  >
                    <span>👷 ППР: {pprCount}</span>
                    <span className="text-amber-400">·</span>
                    <span>🚚 {autoCount}</span>
                  </span>
                );
              }
              return null;
            })()}
            {/* Бейджи способов оплаты и аудита */}
            <div className="flex items-center gap-1 shrink-0">
              {activeOrders.some((o) => o.payment_method === 'qr') && (
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-600 text-white shadow-xs flex items-center gap-0.5">
                  ⚡ QR
                </span>
              )}
              {activeOrders.some((o) => o.payment_method === 'cash') &&
                (isCashNotSurrendered ? (
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-600 text-white shadow-xs flex items-center gap-0.5"
                    title="Наличные не сданы в кассу: находятся в подотчёте сотрудника"
                  >
                    ⚠️ Подотчёт: {cashToSurrender.toLocaleString('ru-RU')} ₽
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-xs flex items-center gap-0.5">
                    💵 Нал: {cashToSurrender.toLocaleString('ru-RU')} ₽
                  </span>
                ))}
              {hasCarryover && !activeOrders.some((o) => o.payment_method === 'cash') && (
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-xs flex items-center gap-0.5">
                  ⚠️ Перенос
                </span>
              )}
              {fuelAudit.hasDiscrepancy && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFuelModal(true);
                  }}
                  className="px-1.5 py-0.5 rounded bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-[10px] leading-tight shrink-0 shadow-xs flex items-center justify-center cursor-pointer transition-transform"
                  title={`${fuelAudit.badgeText}\n(Нажмите для подробного расчета ГСМ)`}
                  aria-label="Сигнал по ГСМ"
                >
                  ⚠️
                </button>
              )}
              {wialonAudit.hasDiscrepancy && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowWialonModal(true);
                  }}
                  className="px-1.5 py-0.5 rounded bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black text-[10px] leading-tight shrink-0 shadow-xs flex items-center gap-0.5 cursor-pointer transition-transform"
                  title={`${wialonAudit.badgeText}\n(Нажмите для сверки одометра по Wialon)`}
                  aria-label="Расхождение Wialon"
                >
                  <span>📡</span>
                  <span className="hidden xl:inline">{wialonAudit.shortBadgeText}</span>
                </button>
              )}
            </div>
            <span
              className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 cursor-help transition-colors border',
                !period.isSameDay
                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200',
              )}
              title={period.fullPeriodText}
            >
              <span className="text-[9px] text-slate-400">📅</span>
              <span>{period.shortText}</span>
              {!period.isSameDay && (
                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-200/80 text-amber-950 font-black ml-0.5">
                  {period.badgeText}
                </span>
              )}
            </span>
          </div>

          {/* Center: metrics */}
          <div className="shrink-0 flex items-center ml-auto">
            <div className="w-[100px] text-center">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">
                Выручка
              </span>
              <span className="text-sm font-bold text-slate-700">
                <Money amount={revenue.toFixed(2)} />
              </span>
            </div>
            <span className="w-5 text-center text-slate-200 text-sm">−</span>
            <div className="w-[100px] text-center">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">
                Расходы
              </span>
              <span className="text-sm font-bold text-rose-500">
                <Money amount={totalCosts.toFixed(2)} />
              </span>
            </div>
            <span className="w-5 text-center text-slate-200 text-sm">=</span>
            <div className="w-[100px] text-center">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">
                Прибыль
              </span>
              <span
                className={cn(
                  'text-base font-black',
                  profit > 0 ? 'text-emerald-600' : profit < 0 ? 'text-rose-600' : 'text-slate-500',
                )}
              >
                {profit < 0 ? '−' : ''}
                <Money amount={Math.abs(profit).toFixed(2)} />
              </span>
            </div>
          </div>

          {/* Right: edit + chevron */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-300 hover:text-slate-600"
              title="Редактировать заказы"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
            </button>
            <span
              className={cn(
                'material-symbols-outlined text-slate-300 text-[20px] transition-transform duration-300',
                expanded ? 'rotate-180' : '',
              )}
            >
              expand_more
            </span>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          <TripCardOrdersTable trip={trip} activeOrders={activeOrders} expenses={expenses} />

          {/* Summary bar */}
          <div className="px-5 py-4 grid grid-cols-7 gap-3 border-t border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            {[
              {
                label: 'Выручка',
                value: <Money amount={revenue.toFixed(2)} />,
                cls: 'text-slate-800 text-base font-black',
              },
              {
                label: 'Сдать нал',
                value: cashToSurrender > 0 ? <Money amount={cashToSurrender.toFixed(2)} /> : '—',
                cls:
                  cashToSurrender > 0
                    ? 'text-emerald-700 text-base font-black'
                    : 'text-slate-300 text-base font-bold',
              },
              {
                label: `ЗП ${trip.driver.name.split(' ')[0]}`,
                value: (
                  <>
                    −<Money amount={driverPay.toFixed(2)} />
                  </>
                ),
                cls: 'text-emerald-700 text-base font-bold',
              },
              {
                label: loaderNames.length > 0 ? `ЗП ${loaderNames.join(', ')}` : 'ЗП груз.',
                value:
                  loaderPay > 0 ? (
                    <>
                      −<Money amount={loaderPay.toFixed(2)} />
                    </>
                  ) : (
                    '—'
                  ),
                cls:
                  loaderPay > 0
                    ? 'text-blue-600 text-base font-bold'
                    : 'text-slate-300 text-base font-bold',
              },
              {
                label: 'Расходы',
                value:
                  totalExpenses > 0 ? (
                    <>
                      −<Money amount={totalExpenses.toFixed(2)} />
                    </>
                  ) : (
                    '—'
                  ),
                cls: 'text-rose-600 text-base font-bold',
              },
              {
                label: 'Прибыль',
                value: (
                  <>
                    {profit < 0 ? '−' : ''}
                    <Money amount={Math.abs(profit).toFixed(2)} />
                  </>
                ),
                cls: cn(
                  'text-lg font-black',
                  profit > 0 ? 'text-emerald-700' : profit < 0 ? 'text-rose-700' : 'text-slate-500',
                ),
              },
              {
                label: 'Пробег',
                value: (
                  <span>
                    {mileage} км
                    {trip.odometer_end != null && (
                      <span className="text-[11px] font-normal text-slate-400 block sm:inline sm:ml-1.5 whitespace-nowrap">
                        (на одометре: {trip.odometer_end.toLocaleString('ru-RU')} км)
                      </span>
                    )}
                  </span>
                ),
                cls: 'text-slate-700 text-base font-bold',
              },
            ].map(({ label, value, cls }) => (
              <div key={label} className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  {label}
                </span>
                <span className={cn(cls)}>{value}</span>
              </div>
            ))}
          </div>

          {/* Плашка сдачи наличных */}
          {(cashRevenue > 0 || hasCarryover) && (
            <div
              className={cn(
                'px-4 py-2 border-t flex items-center justify-between text-xs gap-3',
                isCashNotSurrendered
                  ? 'bg-amber-50/90 border-amber-200'
                  : 'bg-emerald-50/80 border-emerald-200',
              )}
            >
              <span
                className={cn(
                  'font-bold flex items-center gap-1.5 truncate',
                  isCashNotSurrendered ? 'text-amber-950' : 'text-emerald-900',
                )}
              >
                <span>{isCashNotSurrendered ? '⚠️' : '💵'}</span>
                <span className="truncate">
                  Наличные за рейс: <strong>{cashToSurrender.toLocaleString('ru-RU')} ₽</strong>
                  {cashExpenses > 0 && (
                    <span className="text-slate-500 font-normal ml-1">
                      (выручка {cashRevenue.toLocaleString('ru-RU')} ₽ − расход{' '}
                      {cashExpenses.toLocaleString('ru-RU')} ₽)
                    </span>
                  )}
                  {isCashNotSurrendered ? (
                    <span className="text-amber-800 font-semibold ml-1.5">
                      · На руках у {trip.driver?.name || 'сотрудника'} (в сейф компании НЕ учтено)
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-normal ml-1.5">
                      · Учтено в кассу/сейф компании
                    </span>
                  )}
                </span>
              </span>

              <label
                className={cn(
                  'flex items-center gap-1.5 cursor-pointer select-none shrink-0 px-2.5 py-1 rounded-md border shadow-2xs transition-colors',
                  isCashNotSurrendered
                    ? 'bg-amber-100/90 border-amber-300 hover:bg-amber-100'
                    : 'bg-white border-slate-200 hover:bg-slate-50',
                  togglingCashHold && 'opacity-60 pointer-events-none',
                )}
                title="Если включено: деньги не попадают в сейф, а ложатся в подотчёт сотрудника"
              >
                <input
                  type="checkbox"
                  checked={isCashNotSurrendered}
                  disabled={togglingCashHold}
                  onChange={(e) => handleToggleCashHold(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span
                  className={cn(
                    'text-[11px] font-black',
                    isCashNotSurrendered ? 'text-amber-900' : 'text-slate-700',
                  )}
                >
                  Деньги не сданы (в подотчёт)
                </span>
              </label>
            </div>
          )}

          {/* Период рейса */}
          <div className="px-5 py-2 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between text-xs text-slate-700">
            {isWialonGpsAsset(trip.asset) ? (
              <div className="flex items-center gap-2 truncate">
                <span className="font-bold text-slate-700 flex items-center gap-1 shrink-0">
                  <span>🕒</span>
                  <span>Период рейса:</span>
                </span>
                <span className="truncate">
                  <span className="font-semibold text-slate-900">Выезд из геозоны:</span>{' '}
                  {period.startTime ? `${period.startDayNum} в ${period.startTime}` : '—'}
                  <span className="mx-1.5 text-slate-300">➔</span>
                  <span className="font-semibold text-slate-900">
                    Возврат на базу (Ревью):
                  </span>{' '}
                  {trip.ended_at ? `${period.endDayNum} в ${period.endTime}` : 'В пути'}
                </span>
                {period.durationText && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-500 font-medium">
                      в пути: <strong>{period.durationText}</strong>
                    </span>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 truncate">
                <span className="font-bold text-slate-700 flex items-center gap-1 shrink-0">
                  <span>📅</span>
                  <span>Дата отчёта:</span>
                </span>
                <span className="truncate font-semibold text-slate-900">{period.shortText}</span>
                <span className="text-[11px] text-slate-400 font-medium">
                  (без Wialon GPS — дата написания отчёта)
                </span>
              </div>
            )}
            {isWialonGpsAsset(trip.asset) ? (
              !period.isSameDay ? (
                <span className="text-[10px] text-amber-900 font-black bg-amber-100 border border-amber-300 px-2 py-0.5 rounded shrink-0">
                  Кругорейс ({period.badgeText})
                </span>
              ) : (
                <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded shrink-0">
                  1 день
                </span>
              )
            ) : null}
          </div>

          {/* Предупреждения Wialon / ГСМ */}
          {wialonAudit.hasDiscrepancy && (
            <div className="px-5 py-2.5 bg-amber-50/90 border-t border-amber-200 flex items-center justify-between text-xs">
              <span className="font-bold text-amber-950 flex items-center gap-2 min-w-0">
                <span className="text-base">⚠️</span>
                <span className="truncate">{wialonAudit.badgeText}</span>
                <span className="text-slate-500 font-normal hidden lg:inline truncate">
                  · ГСМ (18л/100км @ 82₽): {wialonAudit.normLiters} л ({wialonAudit.normCost} ₽) ·
                  ЗП вод: {wialonAudit.driverPay} ₽
                </span>
              </span>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <button
                  type="button"
                  onClick={() => setShowWialonModal(true)}
                  className="text-[11px] font-bold text-amber-800 underline hover:text-amber-950 cursor-pointer"
                >
                  Сверка
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyWialon(trip.id, wialonAudit)}
                  disabled={isApplyingWialon}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-[11px] rounded-lg transition-all shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-xs">sync</span>
                  <span>Применить {wialonAudit.wialonKm} км</span>
                </button>
              </div>
            </div>
          )}

          {wialonAudit.isAudited && !wialonAudit.hasDiscrepancy && (
            <div className="px-5 py-1.5 bg-sky-50/60 border-t border-sky-100 flex items-center justify-between text-[11px] text-slate-600">
              <div className="flex items-center gap-2 truncate">
                <span className="text-sky-700 font-bold flex items-center gap-1">
                  <span>📡</span>
                  <span>Wialon телеметрия:</span>
                </span>
                <span>
                  {wialonAudit.wialonKm} км (одометр {wialonAudit.odoStart} → {wialonAudit.odoEnd})
                </span>
                <span className="text-slate-300">·</span>
                <span>
                  ГСМ (18 л/100км @ 82 ₽): <strong>{wialonAudit.normLiters} л</strong> (
                  {wialonAudit.normCost} ₽)
                </span>
                <span className="text-slate-300">·</span>
                <span>
                  ЗП: <strong>{wialonAudit.driverPay} ₽</strong>
                </span>
              </div>
              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100/80 px-2 py-0.5 rounded shrink-0">
                ✓ Одометр подтвержден Wialon
              </span>
            </div>
          )}

          {fuelAudit.hasDiscrepancy && (
            <div className="px-5 py-2.5 bg-rose-50/90 border-t border-rose-200 flex items-center justify-between text-xs">
              <span className="font-bold text-rose-900 flex items-center gap-2">
                <span>⚠️</span>
                <span>{fuelAudit.badgeText}</span>
              </span>
              <button
                type="button"
                onClick={() => setShowFuelModal(true)}
                className="text-[11px] font-bold text-rose-700 underline hover:text-rose-900 cursor-pointer shrink-0 ml-3"
              >
                Подробный расчёт
              </button>
            </div>
          )}

          {trip.driver_note && (
            <div className="px-5 py-2 border-t border-slate-100">
              <TripRouteSheet driverNote={trip.driver_note} />
            </div>
          )}

          {/* Action bar */}
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-white">
            <button
              onClick={handleDeleteClick}
              disabled={deleting}
              className={cn(
                'flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all',
                deleteConfirm
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200',
              )}
            >
              <span className="material-symbols-outlined text-[15px]">
                {deleteConfirm ? 'warning' : 'delete_outline'}
              </span>
              {deleting
                ? 'Удаление...'
                : deleteConfirm
                  ? 'Нажмите снова — удалить рейс!'
                  : 'Удалить'}
            </button>

            {mode === 'review' && (
              <div className="flex gap-2">
                <button
                  onClick={onReturn}
                  disabled={approving}
                  className="px-4 py-2 border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 uppercase tracking-tight disabled:opacity-50 active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">replay</span>
                  Вернуть водителю
                </button>
                <button
                  onClick={onApprove}
                  disabled={approving}
                  className="px-6 py-2 bg-emerald-500 text-white hover:bg-emerald-600 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 uppercase tracking-tight disabled:opacity-50 shadow-sm shadow-emerald-200 active:scale-95"
                >
                  <span
                    className="material-symbols-outlined text-base"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  {approving ? '...' : 'Утвердить'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showFuelModal && (
        <TripFuelAuditModal
          trip={trip}
          fuelAudit={fuelAudit}
          onClose={() => setShowFuelModal(false)}
        />
      )}

      {showWialonModal && (
        <TripWialonAuditModal
          trip={trip}
          wialonAudit={wialonAudit}
          isApplying={isApplyingWialon}
          onApply={() => handleApplyWialon(trip.id, wialonAudit)}
          onClose={() => setShowWialonModal(false)}
        />
      )}
    </div>
  );
}
