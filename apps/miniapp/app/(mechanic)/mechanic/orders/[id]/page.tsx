'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { cn } from '@saldacargo/ui';


interface OrderDetail {
  id: string;
  order_number: number;
  status: string;
  machine_type: 'own' | 'client';
  asset?: { short_name: string; reg_number: string };
  client_vehicle_brand?: string;
  client_vehicle_reg?: string;
  problem_description: string;
  works: Array<{
    id: string;
    work_catalog?: { name: string; norm_minutes: number };
    custom_work_name?: string;
    status: string;
    actual_minutes: number;
    time_logs: Array<{ started_at: string; stopped_at: string | null; status: string }>;
  }>;
  parts: Array<{
    id: string;
    part: { name: string; unit: string };
    quantity: number;
  }>;
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());

  const { data: order, isLoading } = useQuery<OrderDetail>({
    queryKey: ['order-detail', id],
    queryFn: async () => {
      const res = await fetch(`/api/mechanic/orders/${id}`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const startMutation = useMutation({
    mutationFn: async (workId: string) => {
      const res = await fetch(`/api/mechanic/orders/${id}/work/${workId}/start`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка запуска');
      }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order-detail', id] }),
  });

  const stopMutation = useMutation({
    mutationFn: async ({ workId, status }: { workId: string; status: 'paused' | 'completed' }) => {
      const res = await fetch(`/api/mechanic/orders/${id}/work/${workId}/stop`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Ошибка остановки');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order-detail', id] }),
  });

  if (isLoading) return <div className="p-4 animate-pulse">Загрузка...</div>;
  if (!order) return <div className="p-4">Наряд не найден</div>;

  return (
    <div className="space-y-4 pb-12">
      {/* Шапка наряда */}
      <div className="bg-white p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-black text-slate-900">Наряд #{order.order_number}</h1>
          <StatusBadge status={order.status} />
        </div>
        <p className="text-lg font-bold text-slate-700">
          {order.machine_type === 'own' ? order.asset?.short_name : order.client_vehicle_brand}
        </p>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
          {order.machine_type === 'own' ? order.asset?.reg_number : order.client_vehicle_reg}
        </p>
      </div>

      {/* Описание проблемы */}
      <section className="px-4">
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">Что болит:</p>
          <p className="text-sm text-orange-900 font-medium leading-relaxed">{order.problem_description || 'Описание отсутствует'}</p>
        </div>
      </section>

      {/* Список работ */}
      <section className="px-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Работы</h2>
          <button className="text-[10px] font-black text-orange-600 uppercase">+ Добавить</button>
        </div>

        {order.works.map((work) => (
          <WorkCard 
            key={work.id} 
            work={work} 
            now={now}
            onStart={() => startMutation.mutate(work.id)}
            onStop={(status) => stopMutation.mutate({ workId: work.id, status })}
            isStarting={startMutation.isPending}
            isStopping={stopMutation.isPending}
          />
        ))}
      </section>

      {/* Запчасти */}
      <section className="px-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Запчасти</h2>
          <button className="text-[10px] font-black text-orange-600 uppercase">+ Списать</button>
        </div>
        
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {order.parts.length === 0 ? (
            <p className="p-4 text-center text-xs text-slate-400 font-bold italic">Запчасти ещё не списаны</p>
          ) : (
            order.parts.map((p) => (
              <div key={p.id} className="p-3 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">{p.part.name}</span>
                <span className="text-sm font-black text-slate-900">{p.quantity} {p.part.unit}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function WorkCard({ work, now, onStart, onStop, isStarting, isStopping }: { 
  work: OrderDetail['works'][number]; 
  now: number; 
  onStart: () => void; 
  onStop: (status: 'paused' | 'completed') => void; 
  isStarting: boolean; 
  isStopping: boolean; 
}) {
  const activeLog = work.time_logs.find((l) => l.status === 'running');
  const isRunning = !!activeLog;

  // Считаем время
  let totalMinutes = work.actual_minutes || 0;
  if (isRunning) {
    const activeMs = now - new Date(activeLog.started_at).getTime();
    totalMinutes += Math.floor(activeMs / 60000);
  }

  return (
    <div className={cn(
      "bg-white rounded-xl border-2 p-4 transition-all relative overflow-hidden",
      isRunning ? "border-orange-500 shadow-lg shadow-orange-100" : "border-slate-100"
    )}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <p className="text-sm font-black text-slate-900 leading-tight">
            {work.work_catalog?.name || work.custom_work_name}
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
            Норма: {work.work_catalog?.norm_minutes || 0}м · Факт: {totalMinutes}м
          </p>
        </div>
        <div className="text-right">
          <span className={cn(
            "text-[9px] font-black uppercase px-2 py-1 rounded-full",
            isRunning ? "bg-orange-600 text-white animate-pulse" : "bg-slate-100 text-slate-400"
          )}>
            {isRunning ? 'В работе' : work.status === 'completed' ? 'Готово' : 'В очереди'}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        {isRunning ? (
          <>
            <button 
              onClick={() => onStop('paused')}
              disabled={isStopping}
              className="flex-1 bg-slate-100 text-slate-900 rounded-lg py-3 text-xs font-black uppercase tracking-widest active:scale-95 transition-transform"
            >
              ⏸ Пауза
            </button>
            <button 
              onClick={() => onStop('completed')}
              disabled={isStopping}
              className="flex-[1.5] bg-green-600 text-white rounded-lg py-3 text-xs font-black uppercase tracking-widest active:scale-95 transition-transform"
            >
              ✅ Завершить
            </button>
          </>
        ) : work.status !== 'completed' ? (
          <button 
            onClick={onStart}
            disabled={isStarting}
            className="flex-1 bg-zinc-900 text-white rounded-lg py-3 text-xs font-black uppercase tracking-widest active:scale-95 transition-transform"
          >
            ▶️ Начать работу
          </button>
        ) : (
          <div className="flex-1 text-center py-2 text-green-600 font-black text-xs uppercase italic opacity-50">
            Работа выполнена
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, { label: string, color: string }> = {
    created: { label: "В очереди", color: "bg-slate-100 text-slate-500" },
    in_progress: { label: "В работе", color: "bg-orange-100 text-orange-700" },
    completed: { label: "Готово", color: "bg-green-100 text-green-700" },
    cancelled: { label: "Отменён", color: "bg-red-100 text-red-700" },
  };

  const { label, color } = labels[status] ?? { label: status, color: "bg-slate-100 text-slate-500" };

  return (
    <span className={cn("text-[10px] font-black uppercase px-3 py-1 rounded-full", color)}>
      {label}
    </span>
  );
}
