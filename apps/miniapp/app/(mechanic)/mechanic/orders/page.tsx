/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Money, cn } from '@saldacargo/ui';
import { formatDate } from '@saldacargo/shared';

export default function MechanicWorksPage() {
  const [filter, setFilter] = useState<'all' | 'completed' | 'in_progress'>('all');

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => fetch('/api/driver/me').then((r) => r.json()),
    retry: false,
  });

  const { data: orders = [], isLoading } = useQuery<any[]>({
    queryKey: ['mechanic-works-history', me?.id],
    queryFn: async () => {
      const res = await fetch(`/api/mechanic/orders?mechanic_id=${me!.id}`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
    enabled: !!me?.id,
    staleTime: 30000,
  });

  const filteredOrders = orders.filter((order) => {
    if (filter === 'completed') return order.status === 'completed';
    if (filter === 'in_progress')
      return order.status === 'in_progress' || order.status === 'created';
    return true;
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 animate-pulse max-w-lg mx-auto">
        <div className="h-8 w-56 bg-zinc-200 rounded-lg mb-6" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-zinc-200 rounded-2xl h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto">
      {/* Заголовок */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 uppercase tracking-tight">
            История работ
          </h1>
          <p className="text-xs font-bold text-zinc-400 mt-0.5">
            Выполненные заказ-наряды и ремонт
          </p>
        </div>
      </header>

      {/* Быстрые фильтры */}
      <div className="flex bg-zinc-200/60 p-1 rounded-2xl gap-1">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={cn(
            'flex-1 py-2 text-xs font-black uppercase rounded-xl transition-all',
            filter === 'all'
              ? 'bg-white text-zinc-900 shadow-xs'
              : 'text-zinc-500 hover:text-zinc-700',
          )}
        >
          Все ({orders.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('completed')}
          className={cn(
            'flex-1 py-2 text-xs font-black uppercase rounded-xl transition-all',
            filter === 'completed'
              ? 'bg-white text-zinc-900 shadow-xs'
              : 'text-zinc-500 hover:text-zinc-700',
          )}
        >
          Готово ({orders.filter((o) => o.status === 'completed').length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('in_progress')}
          className={cn(
            'flex-1 py-2 text-xs font-black uppercase rounded-xl transition-all',
            filter === 'in_progress'
              ? 'bg-white text-zinc-900 shadow-xs'
              : 'text-zinc-500 hover:text-zinc-700',
          )}
        >
          В работе (
          {orders.filter((o) => o.status === 'in_progress' || o.status === 'created').length})
        </button>
      </div>

      {/* Список работ */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-zinc-200 p-8 space-y-2">
            <span className="text-4xl block">🔧</span>
            <p className="text-sm font-black text-zinc-700 uppercase tracking-wide">
              {filter === 'completed'
                ? 'Нет завершённых работ'
                : filter === 'in_progress'
                  ? 'Нет работ в процессе'
                  : 'История работ пуста'}
            </p>
            <p className="text-xs text-zinc-400">
              {filter === 'all'
                ? 'Новые наряды будут появляться здесь при распределении'
                : 'Попробуйте переключить фильтр'}
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => <WorkHistoryCard key={order.id} order={order} />)
        )}
      </div>
    </div>
  );
}

function WorkHistoryCard({ order }: { order: any }) {
  const isCompleted = order.status === 'completed';
  const isInProgress = order.status === 'in_progress';
  const pay = parseFloat(order.mechanic_pay || '0');

  const vehicleName =
    order.machine_type === 'own'
      ? order.asset?.short_name || 'Автопарк'
      : order.client_vehicle_brand || 'Клиентское авто';

  const regNumber =
    order.machine_type === 'own' ? order.asset?.reg_number : order.client_vehicle_reg;

  const worksNames = (order.works ?? [])
    .map((w: any) => w.custom_work_name || w.work_catalog?.name)
    .filter(Boolean)
    .join(', ');

  return (
    <Link href={`/mechanic/orders/${order.id}`}>
      <div className="bg-white rounded-2xl p-4 shadow-xs border-2 border-zinc-200 flex items-center justify-between active:scale-[0.99] active:bg-zinc-50 transition-all relative overflow-hidden">
        {/* Индикатор статуса слева */}
        <div
          className={cn(
            'absolute left-0 top-0 bottom-0 w-1.5',
            isCompleted
              ? 'bg-green-500'
              : isInProgress
                ? 'bg-orange-500 animate-pulse'
                : 'bg-zinc-300',
          )}
        />

        <div className="pl-2 flex-1 min-w-0 pr-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
              Наряд #{order.order_number}
            </span>
            {isInProgress && (
              <span className="bg-orange-100 text-orange-700 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                В работе
              </span>
            )}
          </div>

          <p className="font-black text-zinc-900 text-sm mt-0.5 truncate">
            {vehicleName}
            {regNumber ? ` · ${regNumber}` : ''}
          </p>

          {worksNames && (
            <p className="text-xs text-zinc-500 mt-1 line-clamp-1 font-medium">{worksNames}</p>
          )}

          <p className="text-[10px] text-zinc-400 font-bold uppercase mt-1">
            {formatDate(order.created_at)}
          </p>
        </div>

        <div className="text-right shrink-0">
          {pay > 0 ? (
            <div className="text-green-600 font-black text-sm">
              +<Money amount={order.mechanic_pay} />
            </div>
          ) : (
            <span className="text-xs text-zinc-400 font-bold">—</span>
          )}

          <p
            className={cn(
              'text-[9px] font-black uppercase mt-1 px-2 py-0.5 rounded-full inline-block',
              isCompleted
                ? 'bg-green-100 text-green-700'
                : isInProgress
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-zinc-100 text-zinc-500',
            )}
          >
            {isCompleted ? '✓ Выполнен' : isInProgress ? 'В работе' : 'Ожидает'}
          </p>
        </div>
      </div>
    </Link>
  );
}
