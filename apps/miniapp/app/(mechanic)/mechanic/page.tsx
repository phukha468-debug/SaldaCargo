/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Money, cn } from '@saldacargo/ui';
import { formatDate } from '@saldacargo/shared';

export default function MechanicHomePage() {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<string | null>(null);

  // 1. Текущий пользователь
  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => fetch('/api/driver/me').then((r) => r.json()),
    retry: false,
  });

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // 2. Зарплата механика и ожидающие подтверждения начисления
  const { data: salary, isLoading: salaryLoading } = useQuery({
    queryKey: ['mechanic-salary', currentYear, currentMonth],
    queryFn: async () => {
      const res = await fetch(`/api/mechanic/salary?year=${currentYear}&month=${currentMonth}`);
      if (!res.ok) {
        return {
          accruals: [],
          pending_confirmation: [],
          pending_confirmation_count: 0,
          summary: { total_accrued: '0', total_paid: '0', to_pay: '0' },
        };
      }
      return res.json();
    },
    enabled: !!me?.id,
  });

  // 3. История работ механика
  const { data: orders = [], isLoading: ordersLoading } = useQuery<any[]>({
    queryKey: ['mechanic-works-history', me?.id],
    queryFn: async () => {
      const res = await fetch(`/api/mechanic/orders?mechanic_id=${me!.id}`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
    enabled: !!me?.id,
    staleTime: 30000,
  });

  // 4. Мутация подтверждения ЗП (в точности как у водителя)
  const confirmMutation = useMutation({
    mutationFn: async (body: { action: 'confirm' | 'reject'; ids?: string[]; id?: string }) => {
      const res = await fetch('/api/employee/payroll', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Ошибка подтверждения');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mechanic-salary'] });
      queryClient.invalidateQueries({ queryKey: ['mechanic-works-history'] });
      setRejecting(null);
    },
  });

  if (meLoading || salaryLoading || ordersLoading) {
    return <MechanicHomeSkeleton />;
  }

  const pendingItems: any[] = salary?.pending_confirmation ?? [];
  const toPay = salary?.summary?.to_pay ?? '0';
  const totalAccrued = salary?.summary?.total_accrued ?? '0';
  const totalPaid = salary?.summary?.total_paid ?? '0';

  // Последние 3 работы
  const recentOrders = orders.slice(0, 3);

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto">
      {/* ── 1. ПРИВЕТСТВИЕ ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 tracking-tight">
            Привет, {me?.name || 'Механик'}! 🛠
          </h1>
          <p className="text-xs font-bold text-zinc-400 mt-0.5">СТО TK501 · Личный кабинет</p>
        </div>
        <Link
          href="/mechanic/profile"
          className="w-10 h-10 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-lg active:scale-95 transition-transform"
        >
          👤
        </Link>
      </div>

      {/* ── 2. ПОДТВЕРЖДЕНИЕ ЗАРПЛАТЫ (по аналогии с водителем) ── */}
      {pendingItems.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl overflow-hidden shadow-sm">
          <div className="bg-amber-400 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-amber-900 uppercase tracking-widest">
                ⏳ Ожидает вашего подтверждения
              </p>
              <p className="text-[10px] text-amber-800 font-bold mt-0.5">
                {pendingItems.length} начислений
              </p>
            </div>
            {pendingItems.length > 1 && (
              <button
                type="button"
                onClick={() => confirmMutation.mutate({ action: 'confirm' })}
                disabled={confirmMutation.isPending}
                className="bg-amber-900 text-white text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-wide active:scale-95 transition-all disabled:opacity-50"
              >
                Подтвердить всё
              </button>
            )}
          </div>

          <div className="divide-y divide-amber-200">
            {pendingItems.map((item) => (
              <div key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1">
                    <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-0.5">
                      ЗП за выполненную работу
                    </p>
                    <p className="text-xs text-amber-900 font-bold">{item.context}</p>
                  </div>
                  <p className="text-lg font-black text-amber-900 shrink-0">
                    +<Money amount={item.amount} />
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => confirmMutation.mutate({ action: 'confirm', ids: [item.id] })}
                    disabled={confirmMutation.isPending}
                    className="flex-1 bg-green-600 text-white font-black text-xs py-2.5 rounded-xl uppercase tracking-wide active:scale-95 transition-all disabled:opacity-50"
                  >
                    ✓ Подтвердить
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejecting(item.id)}
                    disabled={confirmMutation.isPending}
                    className="px-4 border-2 border-amber-400 text-amber-800 font-black text-xs py-2.5 rounded-xl uppercase tracking-wide active:scale-95 transition-all disabled:opacity-50"
                  >
                    ✗ Не согласен
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Модалка Не согласен */}
      {rejecting && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => e.target === e.currentTarget && setRejecting(null)}
        >
          <div className="bg-white rounded-t-3xl w-full p-6 space-y-4 max-w-lg">
            <div className="w-10 h-1 bg-zinc-200 rounded-full mx-auto" />
            <p className="font-black text-zinc-900 text-base">Не согласны с суммой ЗП?</p>
            <p className="text-sm text-zinc-600">
              Начисление вернётся администратору на пересмотр и корректировку суммы.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRejecting(null)}
                className="flex-1 border-2 border-zinc-200 text-zinc-600 font-black py-3 rounded-xl text-xs uppercase active:scale-95 transition-all"
              >
                Вернуться
              </button>
              <button
                type="button"
                onClick={() => confirmMutation.mutate({ action: 'reject', id: rejecting })}
                disabled={confirmMutation.isPending}
                className="flex-1 bg-red-500 text-white font-black py-3 rounded-xl text-xs uppercase active:scale-95 transition-all disabled:opacity-50"
              >
                {confirmMutation.isPending ? '...' : 'Отклонить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. КАРТОЧКА ЗАРПЛАТЫ ── */}
      <Link href="/mechanic/salary">
        <div className="bg-white rounded-3xl p-5 border-2 border-zinc-200 shadow-xs active:scale-[0.99] transition-transform relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
              Зарплата механика
            </span>
            <span className="text-xs font-black text-orange-600 uppercase tracking-wide flex items-center gap-1">
              Детализация →
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-[11px] font-bold text-zinc-500">К выплате сейчас</p>
              <p className="text-3xl font-black text-green-600 tracking-tight mt-0.5">
                <Money amount={toPay} />
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-2xl">
              💰
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-zinc-100">
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase">Начислено за месяц</p>
              <p className="text-sm font-black text-zinc-800 mt-0.5">
                <Money amount={totalAccrued} />
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase">Уже выплачено</p>
              <p className="text-sm font-black text-zinc-800 mt-0.5">
                <Money amount={totalPaid} />
              </p>
            </div>
          </div>
        </div>
      </Link>

      {/* ── 4. ИСТОРИЯ ВЫПОЛНЕННЫХ РАБОТ (по аналогии с рейсами водителя) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest">
            История выполненных работ
          </h2>
          <Link
            href="/mechanic/orders"
            className="text-xs font-black text-orange-600 uppercase tracking-wide hover:underline"
          >
            Все работы ({orders.length}) →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="bg-white rounded-3xl border-2 border-dashed border-zinc-200 p-8 text-center space-y-2">
            <span className="text-3xl block">🔧</span>
            <p className="text-xs font-black text-zinc-700 uppercase tracking-wide">
              Пока нет выполненных работ
            </p>
            <p className="text-[11px] text-zinc-400">
              Здесь появится список завершённых заказ-нарядов и заработанная ЗП
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentOrders.map((order) => {
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
                <Link key={order.id} href={`/mechanic/orders/${order.id}`}>
                  <div className="bg-white rounded-2xl p-4 shadow-xs border-2 border-zinc-200 flex items-center justify-between active:scale-[0.99] transition-all relative overflow-hidden">
                    <div
                      className={cn(
                        'absolute left-0 top-0 bottom-0 w-1.5',
                        isCompleted
                          ? 'bg-green-500'
                          : isInProgress
                            ? 'bg-orange-500'
                            : 'bg-zinc-300',
                      )}
                    />

                    <div className="pl-2 flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                          Наряд #{order.order_number}
                        </span>
                        {isInProgress && (
                          <span className="bg-orange-100 text-orange-700 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                            В работе
                          </span>
                        )}
                      </div>

                      <p className="font-black text-zinc-900 text-sm mt-0.5 truncate">
                        {vehicleName}
                        {regNumber ? ` · ${regNumber}` : ''}
                      </p>

                      {worksNames && (
                        <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1 font-medium">
                          {worksNames}
                        </p>
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
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MechanicHomeSkeleton() {
  return (
    <div className="p-4 space-y-6 animate-pulse max-w-lg mx-auto">
      <div className="h-8 w-48 bg-zinc-200 rounded-lg" />
      <div className="h-40 bg-zinc-200 rounded-3xl" />
      <div className="space-y-3">
        <div className="h-4 w-32 bg-zinc-200 rounded" />
        <div className="h-20 bg-zinc-200 rounded-2xl" />
        <div className="h-20 bg-zinc-200 rounded-2xl" />
      </div>
    </div>
  );
}
