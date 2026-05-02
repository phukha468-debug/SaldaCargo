'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Money, LifecycleBadge } from '@saldacargo/ui';
import { formatDate, formatDuration } from '@saldacargo/shared';

// Тип ответа API
interface DriverSummary {
  activeTrip: {
    id: string;
    trip_number: number;
    started_at: string;
    trip_type: string;
    asset: { short_name: string; reg_number: string };
    loader: { name: string } | null;
  } | null;
  recentTrips: Array<{
    id: string;
    trip_number: number;
    status: string;
    lifecycle_status: string;
    started_at: string;
    asset: { short_name: string };
    trip_orders: Array<{ amount: string; driver_pay: string; lifecycle_status: string }>;
  }>;
  accountableBalance: string;
  monthPayApproved: string;
  monthPayDraft: string;
}

export default function RootPage() {
  const router = useRouter();

  // 1. Проверяем профиль и роли
  const { data: user, isLoading: isUserLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch('/api/driver/me');
      if (res.status === 401) {
        document.cookie = 'salda_user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Not authenticated');
      return res.json();
    },
    retry: false,
  });

  useEffect(() => {
    if (!isUserLoading && user) {
      const roles = user.roles || [];
      if (roles.includes('mechanic') || roles.includes('mechanic_lead')) {
        router.push('/mechanic');
      }
    }
  }, [user, isUserLoading, router]);

  // 2. Загружаем данные водителя (если это водитель)
  const { data, isLoading: isDataLoading, error } = useQuery<DriverSummary>({
    queryKey: ['driver-summary'],
    queryFn: async () => {
      const res = await fetch(`/api/driver/summary`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json() as Promise<DriverSummary>;
    },
    enabled: !!user && !(user.roles || []).includes('mechanic'),
  });

  if (isUserLoading || isDataLoading) {
    return <DriverHomeSkeleton />;
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-600">
        Ошибка загрузки. Потяните вниз для обновления.
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="p-4 space-y-4">
      {/* Приветствие */}
      <div className="mb-2">
        <h1 className="text-2xl font-black text-zinc-900">Привет, {user.name}! 👋</h1>
      </div>

      {/* Карточка подотчёта */}
      <AccountableCard balance={data?.accountableBalance ?? '0'} />

      {/* Карточка ЗП */}
      <PayCard approved={data?.monthPayApproved ?? '0'} draft={data?.monthPayDraft ?? '0'} />

      {/* Кнопка начать рейс (если нет активного) */}
      {!data?.activeTrip && (
        <Link
          href="/trip/new"
          className="flex items-center justify-center gap-3 w-full bg-orange-600 text-white rounded-lg py-5 text-lg font-black shadow-lg active:bg-orange-700 active:scale-[0.98] transition-all uppercase tracking-wide"
        >
          <span>🚚</span>
          <span>Начать рейс</span>
        </Link>
      )}

      {/* Активный рейс */}
      {data?.activeTrip && <ActiveTripCard trip={data.activeTrip} />}

      {/* Последние рейсы */}
      {(data?.recentTrips ?? []).length > 0 && (
        <section className="pt-2">
          <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">
            Последние рейсы
          </h2>
          <div className="space-y-3">
            {data?.recentTrips.map((trip) => (
              <RecentTripCard key={trip.id} trip={trip} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ... (остальные компоненты карточек остаются без изменений)

function AccountableCard({ balance }: { balance: string }) {
  return (
    <Link href="/finance?tab=accountable">
      <div className="bg-white rounded-lg p-4 shadow-sm border border-zinc-200 active:bg-zinc-50 transition-colors">
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">На руках</p>
        <Money amount={balance} className="text-2xl font-black text-zinc-900 mt-1" />
        <p className="text-xs text-zinc-400 mt-1 font-medium">Подотчётные наличные →</p>
      </div>
    </Link>
  );
}

function PayCard({ approved, draft }: { approved: string; draft: string }) {
  const hasDraft = parseFloat(draft) > 0;
  return (
    <Link href="/finance?tab=pay">
      <div className="bg-white rounded-lg p-4 shadow-sm border border-zinc-200 active:bg-zinc-50 transition-colors">
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">ЗП за месяц</p>
        <Money amount={approved} className="text-2xl font-black text-green-600 mt-1" />
        {hasDraft && (
          <div className="text-xs text-amber-600 mt-1 font-bold">
            В черновиках: <Money amount={draft} />
          </div>
        )}
        <p className="text-xs text-zinc-400 mt-1 font-medium">Детализация →</p>
      </div>
    </Link>
  );
}

function ActiveTripCard({
  trip,
}: {
  trip: {
    id: string;
    trip_number: number;
    started_at: string;
    asset: { short_name: string };
    loader: { name: string } | null;
  };
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const durationMs = now - new Date(trip.started_at).getTime();
  const durationMin = Math.floor(durationMs / 60000);

  return (
    <Link href={`/trip/${trip.id}`}>
      <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4 active:bg-orange-100 transition-colors relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500"></div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">
            Активный рейс
          </span>
          <span className="text-xs font-bold text-orange-500">⏱ {formatDuration(durationMin)}</span>
        </div>
        <p className="font-black text-zinc-900 text-lg">
          Рейс №{trip.trip_number} · {trip.asset.short_name}
        </p>
        {trip.loader && (
          <p className="text-sm text-zinc-600 font-bold mt-0.5">+ {trip.loader.name}</p>
        )}
        <p className="text-sm text-orange-600 font-black mt-2 uppercase tracking-wide">
          Открыть рейс →
        </p>
      </div>
    </Link>
  );
}

function RecentTripCard({
  trip,
}: {
  trip: {
    id: string;
    trip_number: number;
    lifecycle_status: string;
    started_at: string;
    asset: { short_name: string };
    trip_orders: Array<{ amount: string; driver_pay: string; lifecycle_status: string }>;
  };
}) {
  const revenue = trip.trip_orders
    .filter((o) => o.lifecycle_status !== 'cancelled')
    .reduce((s, o) => s + parseFloat(o.amount), 0);

  const driverPay = trip.trip_orders
    .filter((o) => o.lifecycle_status !== 'cancelled')
    .reduce((s, o) => s + parseFloat(o.driver_pay), 0);

  return (
    <Link href={`/trip/${trip.id}`}>
      <div className="bg-white rounded-lg p-4 shadow-sm border border-zinc-200 flex items-center justify-between active:bg-zinc-50 transition-colors relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-300"></div>
        <div className="pl-2">
          <p className="font-bold text-zinc-900 text-sm">
            Рейс №{trip.trip_number} · {trip.asset.short_name}
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

function DriverHomeSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-zinc-200 rounded" />
      <div className="bg-zinc-200 rounded-lg h-24" />
      <div className="bg-zinc-200 rounded-lg h-24" />
      <div className="bg-zinc-200 rounded-lg h-20" />
      <div className="space-y-3 pt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-zinc-200 rounded-lg h-16" />
        ))}
      </div>
    </div>
  );
}
