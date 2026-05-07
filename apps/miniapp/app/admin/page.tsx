/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Money } from '@saldacargo/ui';

export default function AdminDashboard() {
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => fetch('/api/driver/me').then((r) => r.json()),
    staleTime: 300000,
  });

  const { data: summary, isLoading } = useQuery<any>({
    queryKey: ['admin-summary'],
    queryFn: () => fetch('/api/admin/summary').then((r) => r.json()),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const handleLogout = () => {
    document.cookie = 'salda_user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    localStorage.clear();
    window.location.href = '/';
  };

  return (
    <div className="p-4 space-y-6">
      <header className="pt-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 uppercase tracking-tight">
            Пульт <span className="text-orange-600">Админа</span>
          </h1>
          <p className="text-zinc-400 font-bold text-xs uppercase tracking-widest mt-1">
            {me?.name ?? '...'}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:text-red-400 transition-colors"
        >
          Выйти
        </button>
      </header>

      {/* Статус */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="На ревью"
          value={isLoading ? '...' : String(summary?.pendingReview ?? 0)}
          accent={summary?.pendingReview > 0}
          href="/admin/trips?filter=review"
        />
        <StatCard
          label="В рейсе"
          value={isLoading ? '...' : String(summary?.activeTrips ?? 0)}
          href="/admin/trips?filter=active"
        />
        <StatCard
          label="Сегодня"
          value={isLoading ? '...' : undefined}
          money={summary?.todayRevenue}
        />
      </div>

      {/* Быстрые действия */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
          Быстрые действия
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/admin/finance?action=income"
            className="bg-green-600 text-white rounded-2xl p-5 flex flex-col items-center gap-2 active:scale-[0.97] transition-all shadow-sm"
          >
            <span className="text-2xl">➕</span>
            <span className="text-xs font-black uppercase tracking-widest">Доход</span>
          </Link>
          <Link
            href="/admin/finance?action=expense"
            className="bg-zinc-800 text-white rounded-2xl p-5 flex flex-col items-center gap-2 active:scale-[0.97] transition-all shadow-sm"
          >
            <span className="text-2xl">➖</span>
            <span className="text-xs font-black uppercase tracking-widest">Расход</span>
          </Link>
        </div>
      </section>

      {/* Рейсы на ревью */}
      {(summary?.pendingReview ?? 0) > 0 && (
        <section>
          <Link
            href="/admin/trips?filter=review"
            className="block bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 active:scale-[0.98] transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black text-orange-700 uppercase tracking-tight">
                  {summary.pendingReview} рейс{summary.pendingReview > 1 ? 'а' : ''} ждут ревью
                </p>
                <p className="text-orange-500 text-xs font-bold uppercase tracking-widest mt-1">
                  Нажми чтобы проверить →
                </p>
              </div>
              <span className="text-3xl">📋</span>
            </div>
          </Link>
        </section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  money,
  accent,
  href,
}: {
  label: string;
  value?: string;
  money?: string;
  accent?: boolean;
  href?: string;
}) {
  const inner = (
    <div
      className={`bg-white rounded-2xl p-4 border-2 text-center shadow-sm ${
        accent ? 'border-orange-400 bg-orange-50' : 'border-zinc-100'
      }`}
    >
      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">{label}</p>
      {money !== undefined ? (
        <Money
          amount={money}
          className={`text-lg font-black ${accent ? 'text-orange-600' : 'text-zinc-900'}`}
        />
      ) : (
        <p className={`text-2xl font-black ${accent ? 'text-orange-600' : 'text-zinc-900'}`}>
          {value}
        </p>
      )}
    </div>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}
