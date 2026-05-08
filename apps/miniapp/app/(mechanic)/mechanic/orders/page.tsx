'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@saldacargo/ui';
import { formatDate } from '@saldacargo/shared';

interface ServiceOrder {
  id: string;
  order_number: number;
  machine_type: 'own' | 'client';
  status: string;
  priority: 'low' | 'normal' | 'urgent';
  created_at: string;
  asset?: { short_name: string };
  client_vehicle_brand?: string;
  client_vehicle_reg?: string;
}

export default function MechanicOrdersPage() {
  const [tab, setTab] = useState<'active' | 'completed'>('active');

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => fetch('/api/driver/me').then((r) => r.json()),
    retry: false,
  });

  const { data: orders, isLoading } = useQuery<ServiceOrder[]>({
    queryKey: ['mechanic-orders', me?.id, tab],
    queryFn: async () => {
      const status = tab === 'completed' ? 'completed' : '';
      const res = await fetch(`/api/mechanic/orders?mechanic_id=${me!.id}&status=${status}`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
    enabled: !!me?.id,
  });

  return (
    <div className="flex flex-col min-h-full">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 flex gap-6 h-12 items-center">
        <button
          onClick={() => setTab('active')}
          className={cn(
            'h-full text-xs font-black uppercase tracking-widest border-b-4 transition-colors',
            tab === 'active'
              ? 'text-orange-600 border-orange-600'
              : 'text-slate-400 border-transparent',
          )}
        >
          Активные
        </button>
        <button
          onClick={() => setTab('completed')}
          className={cn(
            'h-full text-xs font-black uppercase tracking-widest border-b-4 transition-colors',
            tab === 'completed'
              ? 'text-orange-600 border-orange-600'
              : 'text-slate-400 border-transparent',
          )}
        >
          История
        </button>
      </div>

      <div className="p-4 space-y-3">
        {isLoading ? (
          [1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-slate-200 rounded-xl animate-pulse" />
          ))
        ) : (orders ?? []).length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-4xl mb-2">🏖</p>
            <p className="font-bold">Нарядов не найдено</p>
          </div>
        ) : (
          orders?.map((order) => <OrderCard key={order.id} order={order} />)
        )}
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: ServiceOrder }) {
  const priorityColors = {
    low: 'bg-slate-100 text-slate-600',
    normal: 'bg-blue-50 text-blue-700',
    urgent: 'bg-red-50 text-red-700 animate-pulse',
  };

  return (
    <Link href={`/mechanic/orders/${order.id}`}>
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm active:bg-slate-50 transition-colors flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-black text-slate-900">#{order.order_number}</span>
            <span
              className={cn(
                'text-[8px] font-black uppercase px-1.5 py-0.5 rounded',
                priorityColors[order.priority],
              )}
            >
              {order.priority === 'urgent'
                ? '🔥 Срочно'
                : order.priority === 'normal'
                  ? 'Норм'
                  : 'Низкий'}
            </span>
          </div>
          <p className="text-sm font-bold text-slate-700">
            {order.machine_type === 'own' ? order.asset?.short_name : order.client_vehicle_brand}
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase">
            {formatDate(order.created_at)}
          </p>
        </div>
        <div className="text-right">
          <StatusBadge status={order.status} />
          <p className="text-[10px] font-black text-orange-600 uppercase mt-2">Открыть →</p>
        </div>
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, { label: string; color: string }> = {
    created: { label: 'В очереди', color: 'bg-slate-100 text-slate-500' },
    in_progress: { label: 'В работе', color: 'bg-orange-100 text-orange-700' },
    completed: { label: 'Готово', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Отменён', color: 'bg-red-100 text-red-700' },
  };
  const { label, color } = labels[status] ?? {
    label: status,
    color: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={cn('text-[9px] font-black uppercase px-2 py-1 rounded-full', color)}>
      {label}
    </span>
  );
}
