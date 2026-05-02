'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { cn } from '@saldacargo/ui';

// TODO: Реальный ID из сессии
const MOCK_MECHANIC_ID = '00000000-0000-0000-0000-000000000000';

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
  const { data, isLoading, error } = useQuery<MechanicSummary>({
    queryKey: ['mechanic-summary', MOCK_MECHANIC_ID],
    queryFn: async () => {
      const res = await fetch(`/api/mechanic/summary?mechanic_id=${MOCK_MECHANIC_ID}`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
  });

  if (isLoading) return <MechanicHomeSkeleton />;
  if (error) return <div className="p-4 text-red-600">Ошибка загрузки сводки</div>;

  return (
    <div className="p-4 space-y-6">
      {/* Приветствие */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900">Работа кипит? 🔧</h1>
      </div>

      {/* Статистика за день */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">В очереди</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{data?.assignedCount}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Готово сегодня</p>
          <p className="text-3xl font-black text-green-600 mt-1">{data?.completedToday}</p>
        </div>
      </div>

      {/* Активный наряд (или кнопка выбора) */}
      {data?.activeOrder ? (
        <Link href={`/mechanic/orders/${data.activeOrder.id}`}>
          <div className="bg-orange-600 text-white rounded-2xl p-5 shadow-lg shadow-orange-200 relative overflow-hidden active:scale-[0.98] transition-all">
            <div className="absolute right-[-20px] top-[-20px] text-8xl opacity-10 rotate-12">🔧</div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest bg-orange-500/50 px-2 py-1 rounded">Активный наряд</span>
              <span className="flex h-2 w-2 rounded-full bg-white animate-pulse"></span>
            </div>
            <p className="text-xl font-black">
              #{data.activeOrder.order_number} · {data.activeOrder.machine_type === 'own' 
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
            <span className="bg-slate-900 text-white text-[10px] font-bold px-4 py-2 rounded-full uppercase tracking-widest">Открыть список</span>
          </div>
        </Link>
      )}

      {/* Быстрые действия */}
      <section>
        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Быстрые действия</h2>
        <div className="grid grid-cols-2 gap-3">
          <ActionButton href="/mechanic/defects/new" icon="📷" label="Сообщить о дефекте" color="bg-red-50 text-red-700" />
          <ActionButton href="/mechanic/warehouse/search" icon="🔍" label="Найти запчасть" color="bg-blue-50 text-blue-700" />
        </div>
      </section>
    </div>
  );
}

function ActionButton({ href, icon, label, color }: { href: string; icon: string; label: string; color: string }) {
  return (
    <Link href={href} className={cn("p-4 rounded-2xl border border-transparent flex flex-col items-center text-center gap-2 active:scale-95 transition-all shadow-sm", color)}>
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
      <div className="space-y-3">
        <div className="h-4 w-24 bg-slate-200 rounded" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-20 bg-slate-200 rounded-2xl" />
          <div className="h-20 bg-slate-200 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
