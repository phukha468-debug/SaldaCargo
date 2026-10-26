/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Money, cn } from '@saldacargo/ui';
import { formatDate } from '@saldacargo/shared';
import CreateOrderModal from '../CreateOrderModal';

export default function MechanicWorksPage() {
  const [filter, setFilter] = useState<'all' | 'approved' | 'review' | 'in_progress'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

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
    if (filter === 'approved') return order.lifecycle_status === 'approved';
    if (filter === 'review')
      return order.status === 'completed' && order.lifecycle_status === 'draft';
    if (filter === 'in_progress')
      return (
        order.status === 'in_progress' ||
        order.status === 'created' ||
        order.lifecycle_status === 'returned'
      );
    return true;
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 animate-pulse max-w-lg mx-auto">
        <div className="h-8 w-56 bg-slate-200 rounded-lg mb-4" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl h-28" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      {/* Заголовок + кнопка открытия наряда */}
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">История нарядов</h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Все открытые, проверяемые и закрытые заказ-наряды
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="bg-[#21A038] text-white font-extrabold text-xs px-4 py-3 rounded-2xl shadow-sm active:scale-95 transition-transform shrink-0"
        >
          + Наряд
        </button>
      </header>

      {/* Банковские фильтры */}
      <div className="grid grid-cols-4 bg-white border border-slate-200/80 p-1 rounded-2xl gap-1">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={cn(
            'py-2 text-[11px] font-extrabold rounded-xl transition-all',
            filter === 'all' ? 'bg-[#21A038] text-white shadow-2xs' : 'text-slate-500',
          )}
        >
          Все ({orders.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('approved')}
          className={cn(
            'py-2 text-[11px] font-extrabold rounded-xl transition-all',
            filter === 'approved' ? 'bg-[#21A038] text-white shadow-2xs' : 'text-slate-500',
          )}
        >
          Закрытые ({orders.filter((o) => o.lifecycle_status === 'approved').length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('review')}
          className={cn(
            'py-2 text-[11px] font-extrabold rounded-xl transition-all',
            filter === 'review' ? 'bg-[#21A038] text-white shadow-2xs' : 'text-slate-500',
          )}
        >
          Проверка (
          {orders.filter((o) => o.status === 'completed' && o.lifecycle_status === 'draft').length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('in_progress')}
          className={cn(
            'py-2 text-[11px] font-extrabold rounded-xl transition-all',
            filter === 'in_progress' ? 'bg-[#21A038] text-white shadow-2xs' : 'text-slate-500',
          )}
        >
          В работе (
          {
            orders.filter(
              (o) =>
                o.status === 'in_progress' ||
                o.status === 'created' ||
                o.lifecycle_status === 'returned',
            ).length
          }
          )
        </button>
      </div>

      {/* Список работ */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 p-8 space-y-2">
            <span className="text-4xl block">📋</span>
            <p className="text-sm font-extrabold text-slate-800">Заказ-нарядов не найдено</p>
            <p className="text-xs text-slate-500">
              Нажмите «+ Наряд», чтобы самостоятельно открыть заказ-наряд и записать работы
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => <WorkHistoryCard key={order.id} order={order} />)
        )}
      </div>

      <CreateOrderModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        mechanicId={me?.id}
      />
    </div>
  );
}

function WorkHistoryCard({ order }: { order: any }) {
  const isApproved = order.lifecycle_status === 'approved';
  const isCompleted = order.status === 'completed';
  const isReturned = order.lifecycle_status === 'returned';
  const pay = parseFloat(order.mechanic_pay || order.estimated_pay || '0');
  const isOwn = order.machine_type === 'own';

  const vehicleName = isOwn
    ? order.asset?.short_name || 'Свой автопарк'
    : order.client_vehicle_brand || order.client_vehicle_model || 'Клиентское авто';

  const regNumber = isOwn ? order.asset?.reg_number : order.client_vehicle_reg;
  const odo = order.odometer_end || order.odometer_start;

  const worksList = order.works ?? [];
  const partsList = order.parts ?? [];
  const totalMins =
    order.total_minutes ||
    worksList.reduce((s: number, w: any) => s + Number(w.actual_minutes || w.norm_minutes || 0), 0);

  return (
    <Link href={`/mechanic/orders/${order.id}`} className="block">
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs active:scale-[0.99] transition-all">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-extrabold text-slate-900">
                Наряд #{order.order_number}
              </span>
              <span
                className={cn(
                  'text-[10px] font-extrabold px-2 py-0.5 rounded-md',
                  isOwn ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-700',
                )}
              >
                {isOwn ? '🚛 Свой (1600 ₽/ч)' : '🚗 Клиент (2000 ₽/ч)'}
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                {order.started_at &&
                order.completed_at &&
                order.started_at.slice(0, 10) !== order.completed_at.slice(0, 10)
                  ? `${formatDate(order.started_at)} — ${formatDate(order.completed_at)}`
                  : formatDate(order.started_at || order.created_at)}
              </span>
            </div>

            <p className="font-extrabold text-slate-900 text-sm mt-1 truncate">
              {vehicleName}
              {regNumber ? ` · ${regNumber}` : ''}
              {odo ? ` · ${Number(odo).toLocaleString('ru-RU')} км` : ''}
            </p>
          </div>

          <div className="text-right shrink-0">
            {pay > 0 ? (
              <div className="text-[#21A038] font-black text-base leading-none">
                +<Money amount={String(pay)} />
              </div>
            ) : (
              <span className="text-xs text-slate-400 font-bold">—</span>
            )}
            <span
              className={cn(
                'text-[10px] font-extrabold px-2 py-0.5 rounded-full inline-block mt-1',
                isApproved
                  ? 'bg-[#E8F7EC] text-[#0E7C5B]'
                  : isReturned
                    ? 'bg-red-50 text-red-600'
                    : isCompleted
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-blue-50 text-blue-700',
              )}
            >
              {isApproved
                ? '✓ Закрыт'
                : isReturned
                  ? 'На доработке'
                  : isCompleted
                    ? '⏳ На проверке'
                    : 'В работе'}
            </span>
          </div>
        </div>

        {/* Работы */}
        {worksList.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1">
            {worksList.map((w: any, idx: number) => {
              const name = w.custom_work_name || w.work_catalog?.name || 'Работа';
              const mins = w.actual_minutes || w.norm_minutes || 0;
              return (
                <div key={w.id || idx} className="flex items-center justify-between text-xs">
                  <span className="text-slate-700 font-semibold truncate pr-2">
                    {idx + 1}. {name}
                  </span>
                  <span className="text-slate-500 font-bold shrink-0">{mins} мин</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Запчасти сервиса */}
        {partsList.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
            <span className="text-[10px] font-extrabold text-[#0E7C5B] bg-[#E8F7EC] px-2 py-0.5 rounded-md">
              ✓ Запчасти автосервиса:
            </span>
            {partsList.map((p: any, i: number) => (
              <span
                key={p.id || i}
                className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md"
              >
                {p.custom_part_name || p.part?.name || 'Запчасть'} ({p.quantity}{' '}
                {p.unit || p.part?.unit || 'шт'})
              </span>
            ))}
          </div>
        )}

        <div className="mt-2.5 flex items-center justify-between text-[11px] font-bold text-slate-400">
          <span>⏱ Общее время: {totalMins} мин</span>
          <span className="text-[#21A038]">Открыть карточку →</span>
        </div>
      </div>
    </Link>
  );
}
