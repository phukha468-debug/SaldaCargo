'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  asset?: { short_name: string; reg_number?: string };
  client_vehicle_brand?: string;
  client_vehicle_reg?: string;
}

export default function MechanicOrdersPage() {
  const [tab, setTab] = useState<'mine' | 'free'>('mine');

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => fetch('/api/driver/me').then((r) => r.json()),
    retry: false,
  });

  const { data: myOrders, isLoading: myLoading } = useQuery<ServiceOrder[]>({
    queryKey: ['mechanic-orders', me?.id, 'mine'],
    queryFn: async () => {
      const res = await fetch(`/api/mechanic/orders?mechanic_id=${me!.id}`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
    enabled: !!me?.id,
  });

  const { data: freeOrders, isLoading: freeLoading } = useQuery<ServiceOrder[]>({
    queryKey: ['mechanic-orders', me?.id, 'free'],
    queryFn: async () => {
      const res = await fetch(`/api/mechanic/orders?mechanic_id=${me!.id}&unassigned=true`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
    enabled: !!me?.id,
  });

  const orders = tab === 'mine' ? myOrders : freeOrders;
  const isLoading = tab === 'mine' ? myLoading : freeLoading;
  const freeCount = (freeOrders ?? []).length;

  return (
    <div className="flex flex-col min-h-full">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 flex gap-6 h-12 items-center">
        <button
          onClick={() => setTab('mine')}
          className={cn(
            'h-full text-xs font-black uppercase tracking-widest border-b-4 transition-colors',
            tab === 'mine'
              ? 'text-orange-600 border-orange-600'
              : 'text-slate-400 border-transparent',
          )}
        >
          Мои наряды
        </button>
        <button
          onClick={() => setTab('free')}
          className={cn(
            'h-full flex items-center gap-1.5 text-xs font-black uppercase tracking-widest border-b-4 transition-colors',
            tab === 'free'
              ? 'text-orange-600 border-orange-600'
              : 'text-slate-400 border-transparent',
          )}
        >
          Свободные
          {freeCount > 0 && (
            <span className="bg-orange-600 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
              {freeCount}
            </span>
          )}
        </button>
      </div>

      <div className="p-4 space-y-3">
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-200 rounded-xl animate-pulse" />
          ))
        ) : (orders ?? []).length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-4xl mb-2">{tab === 'mine' ? '🏖' : '✅'}</p>
            <p className="font-bold">
              {tab === 'mine' ? 'Нет активных нарядов' : 'Нет свободных нарядов'}
            </p>
            {tab === 'free' && <p className="text-xs mt-1">Все наряды уже распределены</p>}
          </div>
        ) : (
          orders?.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              showClaim={tab === 'free'}
              mechanicId={me?.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  showClaim,
  mechanicId,
}: {
  order: ServiceOrder;
  showClaim: boolean;
  mechanicId?: string;
}) {
  const queryClient = useQueryClient();

  const claimMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/mechanic/orders/${order.id}/claim`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mechanic-orders', mechanicId] });
      queryClient.invalidateQueries({ queryKey: ['mechanic-summary'] });
    },
  });

  const priorityColors = {
    low: 'bg-slate-100 text-slate-600',
    normal: 'bg-blue-50 text-blue-700',
    urgent: 'bg-red-50 text-red-700',
  };

  const vehicleName =
    order.machine_type === 'own' ? order.asset?.short_name : order.client_vehicle_brand;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <Link href={`/mechanic/orders/${order.id}`} className="block p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1 flex-1">
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
            <p className="text-sm font-bold text-slate-700">{vehicleName}</p>
            {order.asset?.reg_number && (
              <p className="text-[10px] font-bold text-slate-400 uppercase">
                {order.asset.reg_number}
              </p>
            )}
            <p className="text-[10px] font-bold text-slate-400 uppercase">
              {formatDate(order.created_at)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <StatusBadge status={order.status} />
            {!showClaim && (
              <p className="text-[10px] font-black text-orange-600 uppercase mt-2">Открыть →</p>
            )}
          </div>
        </div>
      </Link>

      {showClaim && (
        <div className="border-t border-slate-100 px-4 py-3">
          {claimMutation.isError && (
            <p className="text-xs text-red-500 font-bold mb-2">
              {(claimMutation.error as Error).message}
            </p>
          )}
          <button
            onClick={() => claimMutation.mutate()}
            disabled={claimMutation.isPending || claimMutation.isSuccess}
            className={cn(
              'w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95',
              claimMutation.isSuccess
                ? 'bg-green-100 text-green-700'
                : 'bg-zinc-900 text-white disabled:bg-zinc-400',
            )}
          >
            {claimMutation.isPending
              ? 'Берём наряд...'
              : claimMutation.isSuccess
                ? '✓ Наряд взят'
                : '▶ Взять наряд'}
          </button>
        </div>
      )}
    </div>
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
