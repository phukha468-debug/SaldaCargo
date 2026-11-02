/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Money, LifecycleBadge } from '@saldacargo/ui';
import { formatDate } from '@saldacargo/shared';
import { TripDetailsModal } from '@/components/TripDetailsModal';

export default function TripsPage() {
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

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
      <div className="p-3 space-y-2 animate-pulse">
        <div className="h-6 w-36 bg-zinc-200 rounded mb-3" />
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-zinc-200 rounded-xl h-12" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      <header className="mb-1">
        <h1 className="text-base font-black text-zinc-900 uppercase tracking-tight">
          История рейсов
        </h1>
      </header>

      <div className="space-y-1.5">
        {(trips ?? []).length === 0 ? (
          <div className="text-center py-16 text-zinc-400 font-bold uppercase tracking-widest text-xs">
            Рейсов пока нет
          </div>
        ) : (
          trips?.map((trip) => (
            <TripHistoryCard key={trip.id} trip={trip} onClick={() => setSelectedTripId(trip.id)} />
          ))
        )}
      </div>

      {/* Модальное окно деталей рейса с клиентами */}
      {selectedTripId && (
        <TripDetailsModal tripId={selectedTripId} onClose={() => setSelectedTripId(null)} />
      )}
    </div>
  );
}

function TripHistoryCard({ trip, onClick }: { trip: any; onClick: () => void }) {
  const activeOrders = (trip.trip_orders ?? []).filter(
    (o: any) => o.lifecycle_status !== 'cancelled',
  );
  const revenue = activeOrders.reduce((s: number, o: any) => s + (parseFloat(o.amount) || 0), 0);
  const driverPay = activeOrders.reduce(
    (s: number, o: any) => s + (parseFloat(o.driver_pay) || 0),
    0,
  );

  const hasMileage =
    trip.odometer_end != null &&
    trip.odometer_start != null &&
    trip.odometer_end >= trip.odometer_start;
  const mileageKm = hasMileage ? trip.odometer_end - trip.odometer_start : null;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl px-3 py-2 border border-zinc-200 flex items-center justify-between active:bg-zinc-50 transition-colors relative overflow-hidden cursor-pointer shadow-2xs"
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-300"></div>
      <div className="pl-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-zinc-900 text-xs">Рейс №{trip.trip_number}</span>
          <span className="text-[11px] text-zinc-500 font-medium truncate">
            · {trip.asset?.short_name ?? '—'}
          </span>
          <span className="text-[10px] text-zinc-400 font-medium">
            · {formatDate(trip.started_at)}
          </span>
          {mileageKm != null && (
            <span className="text-[10px] text-zinc-500 font-semibold bg-zinc-100 px-1 py-0.2 rounded">
              🛣 {mileageKm.toLocaleString('ru-RU')} км
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <div className="text-right">
          <Money amount={revenue.toString()} className="text-xs font-black text-zinc-900" />
          <div className="text-[10px] text-green-600 font-bold">
            ЗП: <Money amount={driverPay.toString()} />
          </div>
        </div>
        <LifecycleBadge
          status={trip.lifecycle_status as 'draft' | 'approved' | 'returned' | 'cancelled'}
        />
        <span className="text-zinc-400 text-xs font-bold">ℹ️</span>
      </div>
    </div>
  );
}
