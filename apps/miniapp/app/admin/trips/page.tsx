/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { Money, LifecycleBadge } from '@saldacargo/ui';
import { formatDate } from '@saldacargo/shared';

export default function AdminTripsPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <TripsContent />
    </Suspense>
  );
}

function TripsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const filter = (searchParams.get('filter') ?? 'review') as 'review' | 'active' | 'all';

  const { data: trips = [], isLoading } = useQuery<any[]>({
    queryKey: ['admin-trips', filter],
    queryFn: () => fetch(`/api/admin/trips?filter=${filter}`).then((r) => r.json()),
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const FILTERS = [
    { key: 'review', label: '📋 На ревью' },
    { key: 'active', label: '🚛 Активные' },
    { key: 'all', label: '📁 Все' },
  ];

  return (
    <div>
      <header className="bg-white border-b-2 border-zinc-200 px-4 h-16 flex items-center sticky top-0 z-40">
        <h1 className="font-black text-zinc-900 text-lg uppercase tracking-tight">Рейсы</h1>
      </header>

      {/* Фильтры */}
      <div className="bg-white border-b border-zinc-100 px-4 py-2 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => router.replace(`/admin/trips?filter=${f.key}`)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
              filter === f.key
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100 text-zinc-500 active:bg-zinc-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton />
      ) : trips.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
          <span className="text-5xl mb-4">
            {filter === 'review' ? '✅' : filter === 'active' ? '🚛' : '📁'}
          </span>
          <p className="font-bold uppercase tracking-widest text-sm">
            {filter === 'review'
              ? 'Нет рейсов на ревью'
              : filter === 'active'
                ? 'Нет активных рейсов'
                : 'Рейсов нет'}
          </p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  );
}

function TripCard({ trip }: { trip: any }) {
  const activeOrders = (trip.trip_orders ?? []).filter(
    (o: any) => o.lifecycle_status !== 'cancelled',
  );
  const revenue = activeOrders.reduce((s: number, o: any) => s + parseFloat(o.amount), 0);
  const driverPay = activeOrders.reduce((s: number, o: any) => s + parseFloat(o.driver_pay), 0);
  const expenses = (trip.trip_expenses ?? []).reduce(
    (s: number, e: any) => s + parseFloat(e.amount),
    0,
  );

  const isPendingReview = trip.status === 'completed' && trip.lifecycle_status === 'draft';

  return (
    <Link href={`/admin/trips/${trip.id}`}>
      <div
        className={`bg-white rounded-2xl p-4 border-2 shadow-sm active:scale-[0.98] transition-all relative overflow-hidden ${
          isPendingReview ? 'border-orange-300' : 'border-zinc-100'
        }`}
      >
        <div
          className={`absolute left-0 top-0 bottom-0 w-1 ${isPendingReview ? 'bg-orange-500' : 'bg-zinc-300'}`}
        />
        <div className="pl-2">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="font-black text-zinc-900 text-sm">
                №{trip.trip_number} · {trip.asset?.short_name ?? '—'}
              </span>
              <p className="text-[10px] text-zinc-400 font-bold uppercase mt-0.5">
                {trip.driver?.name ?? '—'} · {formatDate(trip.started_at)}
              </p>
            </div>
            <LifecycleBadge status={trip.lifecycle_status} />
          </div>
          <div className="flex gap-4 text-xs">
            <span className="text-zinc-900 font-bold">
              Выручка: <Money amount={revenue.toString()} className="font-black" />
            </span>
            <span className="text-green-600 font-bold">
              ЗП: <Money amount={driverPay.toString()} />
            </span>
            {expenses > 0 && (
              <span className="text-red-500 font-bold">
                Расх: <Money amount={expenses.toString()} />
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function Skeleton() {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-zinc-200 rounded-2xl h-20" />
      ))}
    </div>
  );
}
