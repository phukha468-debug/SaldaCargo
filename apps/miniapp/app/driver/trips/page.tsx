/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Money, LifecycleBadge } from '@saldacargo/ui';
import { formatDate } from '@saldacargo/shared';

export default function TripsPage() {
  const { data: trips, isLoading } = useQuery<any[]>({
    queryKey: ['driver-trips'],
    queryFn: async () => {
      const res = await fetch('/api/driver/trips');
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-zinc-200 rounded mb-6" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-zinc-200 rounded-lg h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <header>
        <h1 className="text-2xl font-black text-zinc-900 uppercase tracking-tight">
          История рейсов
        </h1>
      </header>

      <div className="space-y-3">
        {(trips ?? []).length === 0 ? (
          <div className="text-center py-20 text-zinc-400 font-bold uppercase tracking-widest text-sm">
            Рейсов пока нет
          </div>
        ) : (
          trips?.map((trip) => <TripHistoryCard key={trip.id} trip={trip} />)
        )}
      </div>
    </div>
  );
}

function TripHistoryCard({ trip }: { trip: any }) {
  const activeOrders = (trip.trip_orders ?? []).filter(
    (o: any) => o.lifecycle_status !== 'cancelled',
  );
  const revenue = activeOrders.reduce((s: number, o: any) => s + parseFloat(o.amount), 0);
  const driverPay = activeOrders.reduce((s: number, o: any) => s + parseFloat(o.driver_pay), 0);

  return (
    <Link href={`/trip/${trip.id}`}>
      <div className="bg-white rounded-lg p-4 shadow-sm border border-zinc-200 flex items-center justify-between active:bg-zinc-50 transition-colors relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-300"></div>
        <div className="pl-2">
          <p className="font-bold text-zinc-900 text-sm">
            Рейс №{trip.trip_number} · {trip.asset?.short_name ?? '—'}
          </p>
          <p className="text-[10px] text-zinc-400 font-bold uppercase mt-1">
            {formatDate(trip.started_at)}
          </p>
        </div>
        <div className="text-right">
          <Money amount={revenue.toString()} className="text-sm font-black text-zinc-900" />
          <div className="text-xs text-green-600 font-bold mt-0.5">
            ЗП: <Money amount={driverPay.toString()} />
          </div>
          <div className="mt-1">
            <LifecycleBadge
              status={trip.lifecycle_status as 'draft' | 'approved' | 'returned' | 'cancelled'}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
