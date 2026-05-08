'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { cn } from '@saldacargo/ui';

interface MechanicSummary {
  activeOrder: {
    id: string;
    order_number: number;
    machine_type: 'own' | 'client';
    status: string;
    asset: { short_name: string; reg_number: string } | null;
    client_vehicle_brand: string | null;
    client_vehicle_reg: string | null;
  } | null;
  assignedCount: number;
  completedToday: number;
}

export default function MechanicHomePage() {
  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => fetch('/api/driver/me').then((r) => r.json()),
    retry: false,
  });

  const { data, isLoading } = useQuery<MechanicSummary>({
    queryKey: ['mechanic-summary', me?.id],
    queryFn: async () => {
      const res = await fetch(`/api/mechanic/summary?mechanic_id=${me!.id}`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
    enabled: !!me?.id,
  });

  if (meLoading || isLoading) return <MechanicHomeSkeleton />;

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900">Привет, {me?.name}! 🔧</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            В очереди
          </p>
          <p className="text-3xl font-black text-slate-900 mt-1">{data?.assignedCount ?? 0}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Готово сегодня
          </p>
          <p className="text-3xl font-black text-green-600 mt-1">{data?.completedToday ?? 0}</p>
        </div>
      </div>

      {data?.activeOrder ? (
        <Link href={`/mechanic/orders/${data.activeOrder.id}`}>
          <div className="bg-orange-600 text-white rounded-2xl p-5 shadow-lg shadow-orange-200 relative overflow-hidden active:scale-[0.98] transition-all">
            <div className="absolute right-[-20px] top-[-20px] text-8xl opacity-10 rotate-12">
              🔧
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest bg-orange-500/50 px-2 py-1 rounded">
                Активный наряд
              </span>
              <span className="flex h-2 w-2 rounded-full bg-white animate-pulse"></span>
            </div>
            <p className="text-xl font-black">
              #{data.activeOrder.order_number} ·{' '}
              {data.activeOrder.machine_type === 'own'
                ? data.activeOrder.asset?.short_name
                : data.activeOrder.client_vehicle_brand}
            </p>
            <p className="text-sm font-bold opacity-80 mt-1">
              {data.activeOrder.machine_type === 'own'
                ? data.activeOrder.asset?.reg_number
                : data.activeOrder.client_vehicle_reg}
            </p>
            <p className="text-sm font-black mt-4 uppercase tracking-wider">Открыть наряд →</p>
          </div>
        </Link>
      ) : (
        <Link href="/mechanic/orders">
          <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-3 active:bg-slate-50 transition-colors">
            <div className="text-4xl">📋</div>
            <div>
              <p className="font-bold text-slate-900">Нет активной работы</p>
              <p className="text-xs text-slate-500 mt-1">Выберите наряд из списка, чтобы начать</p>
            </div>
            <span className="bg-slate-900 text-white text-[10px] font-bold px-4 py-2 rounded-full uppercase tracking-widest">
              Открыть список
            </span>
          </div>
        </Link>
      )}

      <section>
        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
          Быстрые действия
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <ActionButton
            href="/mechanic/warehouse"
            icon="🔍"
            label="Склад запчастей"
            color="bg-blue-50 text-blue-700"
          />
          <Link href="/mechanic/orders">
            <div
              className={cn(
                'p-4 rounded-2xl border border-transparent flex flex-col items-center text-center gap-2 active:scale-95 transition-all shadow-sm',
                'bg-slate-50 text-slate-700',
              )}
            >
              <span className="text-2xl">📋</span>
              <span className="text-[10px] font-black uppercase tracking-tight leading-tight">
                Все наряды
              </span>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}

function ActionButton({
  href,
  icon,
  label,
  color,
}: {
  href: string;
  icon: string;
  label: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'p-4 rounded-2xl border border-transparent flex flex-col items-center text-center gap-2 active:scale-95 transition-all shadow-sm',
        color,
      )}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-[10px] font-black uppercase tracking-tight leading-tight">{label}</span>
    </Link>
  );
}

function MechanicHomeSkeleton() {
  return (
    <div className="p-4 space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-slate-200 rounded-lg" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 bg-slate-200 rounded-2xl" />
        <div className="h-24 bg-slate-200 rounded-2xl" />
      </div>
      <div className="h-40 bg-slate-200 rounded-2xl" />
    </div>
  );
}
