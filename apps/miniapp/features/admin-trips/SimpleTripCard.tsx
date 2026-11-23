'use client';

import Link from 'next/link';
import { formatDate } from '@saldacargo/shared';
import { LifecycleBadge, Money, cn } from '@saldacargo/ui';
import type { MiniappTrip } from './types';

export function SimpleTripCard({ trip }: { trip: MiniappTrip }) {
  const activeOrders = (trip.trip_orders ?? []).filter((o) => o.lifecycle_status !== 'cancelled');
  const revenue = activeOrders.reduce((s, o) => s + parseFloat(o.amount), 0);
  const driverPay = activeOrders.reduce((s, o) => s + parseFloat(o.driver_pay), 0);
  const expenses = (trip.trip_expenses ?? []).reduce((s, e) => s + parseFloat(e.amount), 0);

  const cashRevenue = (trip.trip_orders ?? [])
    .filter((o) => o.payment_method === 'cash' && o.lifecycle_status !== 'cancelled')
    .reduce((s, o) => s + parseFloat(o.amount || '0'), 0);
  const cashExpenses = (trip.trip_expenses ?? [])
    .filter((e) => e.payment_method === 'cash')
    .reduce((s, e) => s + parseFloat(e.amount || '0'), 0);
  const cashToSurrender = Math.max(0, cashRevenue - cashExpenses);
  const hasCarryover =
    (trip.driver_note ?? '').includes('[ПЕРЕНОС НАЛИЧНЫХ') ||
    (trip.driver_note ?? '').includes('[CARRYOVER]');
  const isRepair = Boolean(
    (trip.driver_note ?? '').includes('[РЕЙС_НА_РЕМОНТ]') ||
    (trip.admin_note ?? '').includes('[РЕЙС_НА_РЕМОНТ]') ||
    (trip.trip_orders ?? []).some((o) => (o.description ?? '').toLowerCase().includes('ремонт')),
  );

  return (
    <Link href={`/admin/trips/${trip.id}`}>
      <div className="bg-white rounded-2xl p-4 border-2 border-zinc-100 shadow-sm active:scale-[0.98] transition-all relative overflow-hidden">
        <div
          className={cn(
            'absolute left-0 top-0 bottom-0 w-1',
            isRepair ? 'bg-amber-400' : 'bg-zinc-300',
          )}
        />
        <div className="pl-2">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="font-black text-zinc-900 text-sm">
                №{trip.trip_number} ·{' '}
                {trip.asset?.reg_number === 'БЕЗ АВТО'
                  ? '👷 ПРР (без авто)'
                  : (trip.asset?.short_name ?? '—')}
              </span>
              <p className="text-[10px] text-zinc-400 font-bold uppercase mt-0.5">
                {trip.driver?.name ?? '—'} · {formatDate(trip.started_at)}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {isRepair && (
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                  🔧 Ремонт
                </span>
              )}
              <LifecycleBadge status={trip.lifecycle_status} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {isRepair ? (
              <span className="text-amber-700 font-bold flex items-center gap-1">
                <span>🔧 По заезду в геозону встанет на РЕВЬЮ-ГАРАЖ</span>
              </span>
            ) : (
              <>
                <span className="text-zinc-900 font-bold">
                  Выручка: <Money amount={revenue.toString()} className="font-black" />
                </span>
                <span className="text-green-600 font-bold">
                  ЗП: <Money amount={driverPay.toString()} />
                </span>
              </>
            )}
            {expenses > 0 && (
              <span className="text-red-500 font-bold">
                Расх: <Money amount={expenses.toString()} />
              </span>
            )}
            {cashToSurrender > 0 && (
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-bold text-[11px]">
                💵 Нал: <Money amount={cashToSurrender.toString()} className="font-black" />
              </span>
            )}
            {hasCarryover && (
              <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded-md font-bold text-[10px]">
                ⚠️ Перенос
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
