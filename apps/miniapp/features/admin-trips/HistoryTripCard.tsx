'use client';

import { useState } from 'react';
import { calcTrip, formatTime, isMeaningfulDriverComment } from '@saldacargo/shared';
import { LifecycleBadge, Money, TripRouteSheet, cn } from '@saldacargo/ui';
import { PAYMENT_LABELS, PAYMENT_STYLES, type MiniappTrip } from './types';

export function HistoryTripCard({
  trip,
  onEdit,
  onApprove,
  onReturn,
  onDelete,
  approving,
}: {
  trip: MiniappTrip;
  onEdit: (t: MiniappTrip) => void;
  onApprove: (id: string, cashNotSurrendered?: boolean) => void;
  onReturn: (id: string) => void;
  onDelete: (id: string) => void;
  approving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { activeOrders, expenses, revenue, driverPay, loaderPay, mileage, profit } = calcTrip(trip);
  const canReview = trip.status === 'completed' && trip.lifecycle_status === 'draft';

  const cashOrders = activeOrders.filter((o) => o.payment_method === 'cash');
  const cashExpenses = (trip.trip_expenses ?? [])
    .filter((e) => e.payment_method === 'cash')
    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const cashRevenue = cashOrders.reduce((s, o) => s + (parseFloat(o.amount) || 0), 0);
  const cashToSurrender = Math.max(0, cashRevenue - cashExpenses);

  const initialCashNotSurrendered = Boolean(
    (trip.admin_note ?? '').includes('[CASH_NOT_SURRENDERED]') ||
    (trip.driver_note ?? '').includes('[CASH_NOT_COLLECTED]') ||
    (trip.driver_note ?? '').includes('[НЕ СДАНО В КАССУ') ||
    (trip.driver_note ?? '').includes('[ПЕРЕНОС НАЛИЧНЫХ') ||
    (trip.driver_note ?? '').includes('[CARRYOVER]'),
  );
  const [isCashNotSurrendered, setIsCashNotSurrendered] = useState(initialCashNotSurrendered);
  const [togglingCashHold, setTogglingCashHold] = useState(false);

  const hasLoader = Boolean(trip.loader);

  const isOrderUnpaidDebt = (o: { payment_method: string; settlement_status?: string | null }) =>
    o.settlement_status === 'pending' ||
    (o.payment_method === 'debt_cash' && o.settlement_status !== 'completed');

  const unpaidDebtTotal = activeOrders
    .filter(isOrderUnpaidDebt)
    .reduce((s, o) => s + (parseFloat(o.amount) || 0), 0);

  function getOrderPaymentBadge(o: { payment_method: string; settlement_status?: string | null }): {
    label: string;
    cls: string;
  } {
    if (o.settlement_status === 'pending') {
      if (o.payment_method === 'bank_invoice') {
        return {
          label: '⏳ Долг (Р/С)',
          cls: 'bg-amber-50 text-amber-800 border-amber-300',
        };
      }
      return {
        label: '⏳ Долг',
        cls: 'bg-rose-50 text-rose-700 border-rose-300',
      };
    }
    if (o.payment_method === 'debt_cash') {
      if (o.settlement_status === 'completed') {
        return {
          label: '✅ Оплачен (долг)',
          cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      }
      return {
        label: '⏳ Долг',
        cls: 'bg-rose-50 text-rose-700 border-rose-300',
      };
    }
    return {
      label: PAYMENT_LABELS[o.payment_method] ?? o.payment_method,
      cls: PAYMENT_STYLES[o.payment_method] ?? 'bg-zinc-100 border-zinc-200 text-zinc-500',
    };
  }

  return (
    <div
      className={cn(
        'bg-white rounded-2xl border-2 overflow-hidden shadow-sm transition-shadow',
        canReview ? 'border-orange-300' : 'border-zinc-100',
      )}
    >
      <button
        className="w-full text-left active:bg-zinc-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-stretch">
          <div
            className={cn(
              'w-1 shrink-0',
              profit > 0 ? 'bg-emerald-400' : profit < 0 ? 'bg-rose-400' : 'bg-zinc-200',
            )}
          />
          <div className="flex-1 p-4">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-black text-zinc-900 text-sm">
                    {trip.asset?.reg_number === 'БЕЗ АВТО'
                      ? '👷 ПРР (без авто)'
                      : (trip.asset?.short_name ?? '—')}
                  </span>
                  <span className="text-[9px] font-bold bg-zinc-100 text-zinc-400 px-1.5 py-0.5 rounded">
                    #{trip.trip_number}
                  </span>
                  <LifecycleBadge status={trip.lifecycle_status} />
                  {unpaidDebtTotal > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                      ⏳ Долг: {Math.round(unpaidDebtTotal).toLocaleString('ru-RU')} ₽
                    </span>
                  )}
                  {isCashNotSurrendered ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                      ⚠️ Подотчёт
                    </span>
                  ) : cashRevenue > 0 ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                      💵 Нал
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-zinc-400 font-medium">
                  {trip.driver?.name ?? '—'} · {formatTime(trip.started_at)}
                  {trip.ended_at ? `–${formatTime(trip.ended_at)}` : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-black text-zinc-900 text-base">
                  <Money amount={revenue.toFixed(2)} />
                </p>
                <p
                  className={cn(
                    'text-xs font-bold',
                    profit >= 0 ? 'text-emerald-600' : 'text-rose-500',
                  )}
                >
                  {profit < 0 ? '−' : '+'}
                  <Money amount={Math.abs(profit).toFixed(2)} />
                </p>
              </div>
              <span
                className={cn(
                  'text-zinc-300 text-xl shrink-0 mt-0.5 transition-transform duration-200',
                  expanded ? 'rotate-180' : '',
                )}
              >
                ↓
              </span>
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-zinc-100">
          <div className="px-4 py-3 space-y-3">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Заявки</p>
            {activeOrders.length === 0 ? (
              <p className="text-xs text-zinc-400">Нет заявок</p>
            ) : (
              activeOrders.map((order, i) => {
                const amt = parseFloat(order.amount);
                const dp = parseFloat(order.driver_pay);
                let lp = 0;
                if (Array.isArray(order.loaders_data) && order.loaders_data.length > 0) {
                  lp = order.loaders_data.reduce(
                    (sub, l) => sub + (parseFloat(String(l.pay || '0')) || 0),
                    0,
                  );
                } else {
                  lp =
                    (parseFloat(String(order.loader_pay ?? '0')) || 0) +
                    (parseFloat(String(order.loader2_pay ?? '0')) || 0);
                }
                const split = amt > 0 ? Math.round((dp / amt) * 100) : 0;
                return (
                  <div key={order.id} className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">
                        {order.counterparty?.name ?? `Заявка ${i + 1}`}
                      </p>
                      {isMeaningfulDriverComment(order.description) && (
                        <div className="mt-0.5 p-1.5 bg-amber-50 border border-amber-200/90 rounded text-[11px] text-amber-950 font-medium line-clamp-2">
                          <span className="font-bold text-amber-900">💬 Водитель:</span>{' '}
                          {order.description}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-emerald-600 font-medium">
                          ЗП {split}% · <Money amount={order.driver_pay} />
                        </span>
                        {lp > 0 && (
                          <span className="text-[11px] text-blue-500 font-medium">
                            Груз: <Money amount={lp.toString()} />
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-zinc-800 text-sm">
                        <Money amount={order.amount} />
                      </p>
                      {(() => {
                        const badge = getOrderPaymentBadge(order);
                        return (
                          <span
                            className={cn(
                              'text-[9px] font-bold px-1.5 py-0.5 rounded border inline-block',
                              badge.cls,
                            )}
                          >
                            {badge.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {expenses.length > 0 && (
            <div className="px-4 pb-3 space-y-2 border-t border-zinc-50 pt-3">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                Расходы
              </p>
              {expenses.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between text-sm gap-2">
                  <span className="text-rose-500 font-medium truncate flex-1">
                    ↳ {exp.category?.name ?? 'Расход'}
                    {exp.description ? (
                      <span className="text-rose-400 font-normal"> · {exp.description}</span>
                    ) : null}
                  </span>
                  <span className="font-bold text-rose-600 shrink-0">
                    −<Money amount={exp.amount} />
                  </span>
                </div>
              ))}
            </div>
          )}

          <div
            className={cn(
              'border-t border-zinc-100 bg-zinc-50',
              hasLoader ? 'grid grid-cols-2' : 'grid grid-cols-3',
            )}
          >
            <div className="text-center px-2 py-3 border-r border-zinc-100">
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                Выручка
              </p>
              <p className="font-bold text-zinc-800 text-sm">
                <Money amount={revenue.toFixed(2)} />
              </p>
            </div>
            <div className={cn('text-center px-2 py-3', !hasLoader && 'border-r border-zinc-100')}>
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                ЗП Водитель
              </p>
              <p className="font-bold text-green-600 text-sm">
                <Money amount={driverPay.toFixed(2)} />
              </p>
            </div>
            {hasLoader && (
              <div className="text-center px-2 py-3 border-r border-zinc-100">
                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                  ЗП Грузчик
                </p>
                <p className="font-bold text-blue-500 text-sm">
                  <Money amount={loaderPay.toFixed(2)} />
                </p>
              </div>
            )}
            <div className="text-center px-2 py-3">
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                Прибыль
              </p>
              <p
                className={cn(
                  'font-black text-sm',
                  profit >= 0 ? 'text-emerald-600' : 'text-rose-600',
                )}
              >
                {profit < 0 ? '−' : ''}
                <Money amount={Math.abs(profit).toFixed(2)} />
              </p>
            </div>
          </div>

          {(mileage > 0 || trip.odometer_end != null) && (
            <div className="px-4 py-2 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span>
                  🛣 <span className="font-bold">{mileage} км</span>
                </span>
                {trip.odometer_end != null && (
                  <span className="text-[11px] text-zinc-400 font-normal">
                    (на одометре: {trip.odometer_end.toLocaleString('ru-RU')} км)
                  </span>
                )}
              </span>
            </div>
          )}

          {trip.driver_note && (
            <div className="px-4 py-1.5 border-t border-zinc-100">
              <TripRouteSheet driverNote={trip.driver_note} defaultExpanded={false} />
            </div>
          )}

          {(cashRevenue > 0 || isCashNotSurrendered) && (
            <div
              className={cn(
                'px-4 py-2 border-t flex items-center justify-between text-xs gap-2',
                isCashNotSurrendered
                  ? 'bg-amber-50/90 border-amber-200'
                  : 'bg-emerald-50/80 border-emerald-200',
              )}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="shrink-0">{isCashNotSurrendered ? '⚠️' : '💵'}</span>
                <span
                  className={cn(
                    'font-bold truncate text-[11px]',
                    isCashNotSurrendered ? 'text-amber-950' : 'text-emerald-950',
                  )}
                >
                  {isCashNotSurrendered ? 'Подотчёт: ' : 'Нал в кассу: '}
                  <strong>{cashToSurrender.toLocaleString('ru-RU')} ₽</strong>
                  <span className="font-normal text-zinc-500 ml-1 hidden sm:inline">
                    {isCashNotSurrendered ? '(не сдано)' : '(сдано в сейф)'}
                  </span>
                </span>
              </div>

              <label
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'flex items-center gap-1.5 cursor-pointer select-none shrink-0 px-2 py-1 rounded-lg border shadow-2xs transition-colors',
                  isCashNotSurrendered
                    ? 'bg-amber-100 border-amber-300 text-amber-950 font-black'
                    : 'bg-white border-zinc-200 text-zinc-700 font-bold hover:bg-zinc-50',
                  togglingCashHold && 'opacity-60 pointer-events-none',
                )}
                title="Если включено: деньги не попадают в кассу, а ложатся в подотчёт сотрудника"
              >
                <input
                  type="checkbox"
                  checked={isCashNotSurrendered}
                  disabled={togglingCashHold}
                  onChange={async (e) => {
                    const nextVal = e.target.checked;
                    setIsCashNotSurrendered(nextVal);
                    setTogglingCashHold(true);
                    try {
                      const res = await fetch(`/api/admin/trips/${trip.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cash_not_surrendered: nextVal }),
                      });
                      if (!res.ok) {
                        setIsCashNotSurrendered(!nextVal);
                        const j = await res.json();
                        alert(j.error || 'Ошибка изменения статуса подотчёта');
                      }
                    } catch {
                      setIsCashNotSurrendered(!nextVal);
                    } finally {
                      setTogglingCashHold(false);
                    }
                  }}
                  className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span className="text-[11px] whitespace-nowrap">
                  {isCashNotSurrendered ? '⚠️ Не сдано' : 'Деньги не сданы (в подотчёт)'}
                </span>
              </label>
            </div>
          )}

          <div className="px-4 pb-4 pt-3 border-t border-zinc-100 flex items-center gap-2">
            <button
              onClick={() => onEdit(trip)}
              className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 border border-zinc-200 px-4 py-2.5 rounded-xl active:bg-zinc-100 shrink-0"
            >
              ✏️ Изменить
            </button>
            <button
              onClick={() => onDelete(trip.id)}
              disabled={approving}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-500 active:bg-rose-100 disabled:opacity-50 shrink-0"
              title="Удалить рейс"
            >
              🗑️
            </button>
            {canReview && (
              <>
                <button
                  onClick={() => onReturn(trip.id)}
                  disabled={approving}
                  className="flex-1 text-xs font-bold text-red-600 border border-red-200 bg-red-50 py-2.5 rounded-xl active:bg-red-100 text-center disabled:opacity-50"
                >
                  Вернуть
                </button>
                <button
                  onClick={() => onApprove(trip.id, isCashNotSurrendered)}
                  disabled={approving}
                  className="flex-1 text-xs font-black text-white bg-emerald-500 py-2.5 rounded-xl active:bg-emerald-600 text-center disabled:opacity-50 shadow-sm"
                >
                  {approving ? '...' : '✓ Одобрить'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
