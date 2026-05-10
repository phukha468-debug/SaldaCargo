'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Money, LifecycleBadge, cn } from '@saldacargo/ui';
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

// ── Форма заявки на ремонт ───────────────────────────────────

function RepairForm({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: () => void }) {
  const [assetId, setAssetId] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: assets = [] } = useQuery<
    Array<{ id: string; short_name: string; reg_number: string }>
  >({
    queryKey: ['driver-assets'],
    queryFn: () =>
      fetch('/api/driver/assets')
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
    staleTime: 300000,
  });

  const submit = async () => {
    if (!assetId) {
      setError('Выберите автомобиль');
      return;
    }
    if (!description.trim()) {
      setError('Опишите проблему');
      return;
    }
    setSaving(true);
    setError('');
    const res = await fetch('/api/driver/service-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: assetId, problem_description: description, priority }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? 'Ошибка');
      return;
    }
    onSubmitted();
  };

  const inputCls =
    'w-full border border-zinc-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-zinc-400 transition-all';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.5)', touchAction: 'none' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-t-3xl shadow-2xl max-h-[90svh] flex flex-col"
        style={{ touchAction: 'none' }}
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-zinc-200 rounded-full" />
        </div>
        <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-black text-zinc-900 text-base">🔧 Заявка на ремонт</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Опиши проблему — администратор направит механика
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 text-xl font-bold active:bg-zinc-200"
          >
            ×
          </button>
        </div>

        <div
          className="overflow-y-auto flex-1 min-h-0 p-5 space-y-4"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' } as React.CSSProperties}
        >
          {/* Машина */}
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5">
              Автомобиль
            </label>
            <select
              className={inputCls}
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
            >
              <option value="">— Выбери машину —</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.short_name}
                  {a.reg_number ? ` · ${a.reg_number}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Приоритет */}
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5">
              Срочность
            </label>
            <div className="flex gap-2">
              {[
                { value: 'low', label: 'Не срочно' },
                { value: 'normal', label: 'Обычная' },
                { value: 'urgent', label: '🚨 Срочно' },
              ].map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all',
                    priority === p.value
                      ? p.value === 'urgent'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-zinc-500 border-zinc-200 active:bg-zinc-50',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Описание */}
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5">
              Что случилось?
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Опиши проблему подробно: что не работает, когда появилось, звуки, запахи..."
              className={`${inputCls} resize-none`}
            />
          </div>

          {error && (
            <p className="text-sm text-rose-700 font-medium bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          {/* Кнопки внутри скролла — всегда доступны */}
          <div className="flex gap-3 pt-2 pb-6">
            <button
              onClick={submit}
              disabled={saving}
              className="flex-1 bg-zinc-900 text-white font-black py-4 rounded-2xl active:bg-zinc-700 disabled:opacity-50 transition-all text-sm"
            >
              {saving ? 'Отправка...' : 'Отправить заявку'}
            </button>
            <button
              onClick={onClose}
              className="px-5 text-sm text-zinc-500 border border-zinc-200 rounded-2xl active:bg-zinc-50 font-bold"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Главная страница водителя ────────────────────────────────

export default function RootPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showRepairForm, setShowRepairForm] = useState(false);

  // 1. Проверяем профиль и роли
  const { data: user, isLoading: isUserLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch('/api/driver/me');
      if (!res.ok) throw new Error('Not authenticated');
      return res.json();
    },
    retry: false,
  });

  useEffect(() => {
    if (!isUserLoading && user) {
      const roles = user.roles || [];
      const isDriver =
        roles.includes('driver') || roles.includes('owner') || roles.includes('admin');
      const isMechanicOnly =
        !isDriver && (roles.includes('mechanic') || roles.includes('mechanic_lead'));
      if (isMechanicOnly) {
        router.push('/mechanic');
      }
    }
  }, [user, isUserLoading, router]);

  // 2. Загружаем данные водителя (если это водитель)
  const {
    data,
    isLoading: isDataLoading,
    error,
  } = useQuery<DriverSummary>({
    queryKey: ['driver-summary'],
    queryFn: async () => {
      const res = await fetch(`/api/driver/summary`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json() as Promise<DriverSummary>;
    },
    enabled:
      !!user &&
      ((user.roles || []).includes('driver') ||
        (user.roles || []).includes('owner') ||
        (user.roles || []).includes('admin')),
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

      {/* Кнопки действий */}
      <div className="flex gap-3">
        {!data?.activeTrip && (
          <Link
            href="/trip/new"
            className="flex-1 flex items-center justify-center gap-2 bg-orange-600 text-white rounded-lg py-5 text-lg font-black shadow-lg active:bg-orange-700 active:scale-[0.98] transition-all uppercase tracking-wide"
          >
            <span>🚚</span>
            <span>Начать рейс</span>
          </Link>
        )}
        <button
          onClick={() => setShowRepairForm(true)}
          className={cn(
            'flex items-center justify-center gap-2 bg-zinc-800 text-white rounded-lg py-5 font-black shadow-lg active:bg-zinc-700 active:scale-[0.98] transition-all uppercase tracking-wide text-base',
            data?.activeTrip ? 'flex-1' : 'px-5',
          )}
        >
          <span>🔧</span>
          {data?.activeTrip && <span>Починить</span>}
        </button>
      </div>

      {showRepairForm && (
        <RepairForm
          onClose={() => setShowRepairForm(false)}
          onSubmitted={() => {
            setShowRepairForm(false);
            queryClient.invalidateQueries({ queryKey: ['driver-summary'] });
          }}
        />
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
