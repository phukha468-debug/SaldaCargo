/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Money, cn } from '@saldacargo/ui';
import { formatDate } from '@saldacargo/shared';
import CreateOrderModal from './CreateOrderModal';

export default function MechanicHomePage() {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // 1. Текущий пользователь
  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => fetch('/api/driver/me').then((r) => r.json()),
    retry: false,
  });

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // 2. Зарплата механика, история выплат и ожидающие подтверждения начисления
  const { data: salary, isLoading: salaryLoading } = useQuery({
    queryKey: ['mechanic-salary', currentYear, currentMonth],
    queryFn: async () => {
      const res = await fetch(`/api/mechanic/salary?year=${currentYear}&month=${currentMonth}`);
      if (!res.ok) {
        return {
          accruals: [],
          payouts: [],
          pending_confirmation: [],
          pending_confirmation_count: 0,
          rates: { hourly_rate_client: 2000, hourly_rate_own: 1600, mechanic_salary_pct: 50 },
          summary: { total_accrued: '0', total_paid: '0', to_pay: '0', draft_pay: '0' },
        };
      }
      return res.json();
    },
    enabled: !!me?.id,
  });

  // 3. История заказ-нарядов механика
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
  const payouts: any[] = salary?.payouts ?? [];
  const toPay = salary?.summary?.to_pay ?? '0';
  const draftPay = salary?.summary?.draft_pay ?? '0';
  const totalAccrued = salary?.summary?.total_accrued ?? '0';
  const totalPaid = salary?.summary?.total_paid ?? '0';

  const hourlyRateClient = salary?.rates?.hourly_rate_client ?? 2000;
  const hourlyRateOwn = salary?.rates?.hourly_rate_own ?? 1600;
  const salaryPct = salary?.rates?.mechanic_salary_pct ?? 50;

  // Разделяем наряды: В работе, На проверке (draft + completed), Закрытые (approved)
  const activeOrders = orders.filter(
    (o) =>
      o.status === 'in_progress' || o.status === 'created' || o.lifecycle_status === 'returned',
  );
  const reviewOrders = orders.filter(
    (o) => o.status === 'completed' && o.lifecycle_status === 'draft',
  );
  const closedOrders = orders.filter((o) => o.lifecycle_status === 'approved').slice(0, 5);

  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto">
      {/* ── 1. БАНКОВСКАЯ ШАПКА ПРОФИЛЯ ── */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold text-[#21A038] uppercase tracking-wider">
            СТО · Автосервис TK501
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {me?.name || 'Механик'}
          </h1>
        </div>
        <Link
          href="/mechanic/profile"
          className="w-11 h-11 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-center text-lg active:scale-95 transition-transform"
        >
          👤
        </Link>
      </div>

      {/* ── 2. БАНКОВСКАЯ КАРТОЧКА ЗАРПЛАТЫ (Стиль Сбербанк) ── */}
      <Link href="/mechanic/salary" className="block">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.04)] active:scale-[0.99] transition-transform relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#21A038]" />
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                Баланс механика
              </span>
            </div>
            <span className="text-xs font-extrabold text-[#21A038] bg-[#E8F7EC] px-3 py-1 rounded-full">
              Все выплаты →
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-500">К выплате сейчас</p>
              <p className="text-3xl font-black text-slate-900 tracking-tight mt-0.5">
                <Money amount={toPay} />
              </p>
              {parseFloat(draftPay) > 0 && (
                <div className="inline-flex items-center gap-1.5 mt-2 bg-[#E8F7EC] text-[#0E7C5B] px-2.5 py-1 rounded-lg text-xs font-extrabold">
                  <span>⏳ На проверке:</span>
                  <span>
                    +<Money amount={draftPay} />
                  </span>
                </div>
              )}
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#E8F7EC] text-[#21A038] flex items-center justify-center text-2xl shrink-0">
              💳
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4 pt-3.5 border-t border-slate-100">
            <div className="bg-[#F2F4F7] rounded-2xl p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                Закрытые наряды (мес.)
              </p>
              <p className="text-base font-extrabold text-slate-900 mt-0.5">
                <Money amount={totalAccrued} />
              </p>
            </div>
            <div className="bg-[#F2F4F7] rounded-2xl p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                Выплачено (мес.)
              </p>
              <p className="text-base font-extrabold text-[#21A038] mt-0.5">
                <Money amount={totalPaid} />
              </p>
            </div>
          </div>
        </div>
      </Link>

      {/* ── 3. ГЛАВНАЯ КНОПКА: ОТКРЫТЬ ЗАКАЗ-НАРЯД ── */}
      <button
        type="button"
        onClick={() => setShowCreateModal(true)}
        className="w-full bg-[#21A038] hover:bg-[#1b8a2f] text-white rounded-3xl p-4 shadow-lg shadow-[#21A038]/25 flex items-center justify-between active:scale-[0.99] transition-all"
      >
        <div className="flex items-center gap-3.5 text-left">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-black">
            +
          </div>
          <div>
            <p className="text-base font-extrabold tracking-tight leading-snug">
              Открыть заказ-наряд
            </p>
            <p className="text-xs text-white/85 font-medium">
              Свой авто ({hourlyRateOwn} ₽/ч) или Клиентский ({hourlyRateClient} ₽/ч)
            </p>
          </div>
        </div>
        <span className="text-xl font-bold pr-1">→</span>
      </button>

      {/* ── 4. ПОДТВЕРЖДЕНИЕ НАЧИСЛЕННОЙ ЗАРПЛАТЫ ── */}
      {pendingItems.length > 0 && (
        <div className="bg-white border-2 border-amber-300 rounded-3xl overflow-hidden shadow-xs">
          <div className="bg-amber-50 px-4 py-3 border-b border-amber-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-extrabold text-amber-900">⏳ Подтвердите начисленную ЗП</p>
              <p className="text-[11px] text-amber-700 font-semibold">
                {pendingItems.length} начислений по закрытым нарядам
              </p>
            </div>
            {pendingItems.length > 1 && (
              <button
                type="button"
                onClick={() => confirmMutation.mutate({ action: 'confirm' })}
                disabled={confirmMutation.isPending}
                className="bg-[#21A038] text-white text-xs font-extrabold px-3 py-1.5 rounded-xl active:scale-95 transition-all disabled:opacity-50"
              >
                Подтвердить всё
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {pendingItems.map((item) => (
              <div key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Зарплата за закрытый наряд
                    </p>
                    <p className="text-xs text-slate-900 font-extrabold mt-0.5">{item.context}</p>
                  </div>
                  <p className="text-lg font-black text-[#21A038] shrink-0">
                    +<Money amount={item.amount} />
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => confirmMutation.mutate({ action: 'confirm', ids: [item.id] })}
                    disabled={confirmMutation.isPending}
                    className="flex-1 bg-[#21A038] text-white font-extrabold text-xs py-2.5 rounded-xl active:scale-95 transition-all disabled:opacity-50"
                  >
                    ✓ Подтвердить
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejecting(item.id)}
                    disabled={confirmMutation.isPending}
                    className="px-4 border border-slate-200 bg-[#F2F4F7] text-slate-700 font-extrabold text-xs py-2.5 rounded-xl active:scale-95 transition-all disabled:opacity-50"
                  >
                    Не согласен
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50"
          onClick={(e) => e.target === e.currentTarget && setRejecting(null)}
        >
          <div className="bg-white rounded-t-3xl w-full p-6 space-y-4 max-w-lg">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" />
            <p className="font-extrabold text-slate-900 text-base">Не согласны с суммой ЗП?</p>
            <p className="text-sm text-slate-600">
              Начисление вернётся администратору на пересмотр и корректировку суммы.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRejecting(null)}
                className="flex-1 border border-slate-200 text-slate-700 font-extrabold py-3 rounded-xl text-xs uppercase active:scale-95 transition-all"
              >
                Вернуться
              </button>
              <button
                type="button"
                onClick={() => confirmMutation.mutate({ action: 'reject', id: rejecting })}
                disabled={confirmMutation.isPending}
                className="flex-1 bg-red-500 text-white font-extrabold py-3 rounded-xl text-xs uppercase active:scale-95 transition-all disabled:opacity-50"
              >
                {confirmMutation.isPending ? '...' : 'Отклонить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. АКТИВНЫЕ НАРЯДЫ В РАБОТЕ ── */}
      {activeOrders.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              🔧 Сейчас в работе ({activeOrders.length})
            </h2>
          </div>
          <div className="space-y-2.5">
            {activeOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        </div>
      )}

      {/* ── 6. НА ПРОВЕРКЕ У АДМИНИСТРАТОРА ── */}
      {reviewOrders.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              ⏳ На проверке в гараже ({reviewOrders.length})
            </h2>
          </div>
          <div className="space-y-2.5">
            {reviewOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        </div>
      )}

      {/* ── 7. ИСТОРИЯ ЗАКРЫТЫХ НАРЯДОВ ── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
            Закрытые наряды и ЗП
          </h2>
          <Link
            href="/mechanic/orders"
            className="text-xs font-extrabold text-[#21A038] hover:underline"
          >
            Все наряды ({orders.length}) →
          </Link>
        </div>

        {closedOrders.length === 0 && reviewOrders.length === 0 && activeOrders.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center space-y-2">
            <span className="text-3xl block">📋</span>
            <p className="text-sm font-extrabold text-slate-800">Пока нет заказ-нарядов</p>
            <p className="text-xs text-slate-500">
              Нажмите «+ Открыть заказ-наряд», чтобы записать выполненные работы и запчасти
            </p>
          </div>
        ) : closedOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 text-center">
            <p className="text-xs font-semibold text-slate-500">
              Утверждённых закрытых нарядов пока нет — созданные наряды находятся выше
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {closedOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>

      {/* ── 8. ИСТОРИЯ ВЫПЛАТ ОТ ГАРАЖА (Превью) ── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
            История выплат на руки / карту
          </h2>
          <Link
            href="/mechanic/salary"
            className="text-xs font-extrabold text-[#21A038] hover:underline"
          >
            Подробнее →
          </Link>
        </div>

        {payouts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 text-center">
            <p className="text-xs font-semibold text-slate-400">
              История полученных выплат и авансов будет отображаться здесь
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
            {payouts.slice(0, 4).map((p: any) => (
              <div key={p.id} className="p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-[#E8F7EC] text-[#0E7C5B]">
                      {p.wallet_label}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {formatDate(p.date)}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 truncate mt-1">{p.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-black text-[#21A038]">
                    +<Money amount={p.amount} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модалка открытия нового заказ-наряда */}
      <CreateOrderModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        mechanicId={me?.id}
        hourlyRateClient={hourlyRateClient}
        hourlyRateOwn={hourlyRateOwn}
        salaryPct={salaryPct}
      />
    </div>
  );
}

function OrderCard({ order }: { order: any }) {
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
                {isOwn ? '🚛 Свой' : '🚗 Клиент'}
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                {formatDate(order.created_at)}
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

        {/* Работы и время */}
        {worksList.length > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-1">
            {worksList.slice(0, 3).map((w: any, idx: number) => {
              const name = w.custom_work_name || w.work_catalog?.name || 'Работа';
              const mins = w.actual_minutes || w.norm_minutes || 0;
              return (
                <div key={w.id || idx} className="flex items-center justify-between text-xs">
                  <span className="text-slate-700 font-semibold truncate pr-2">
                    {idx + 1}. {name}
                  </span>
                  <span className="text-slate-400 font-bold shrink-0">{mins} мин</span>
                </div>
              );
            })}
            {worksList.length > 3 && (
              <p className="text-[11px] font-bold text-slate-400">
                + ещё {worksList.length - 3} работ...
              </p>
            )}
          </div>
        )}

        {/* Нижняя плашка: общее время + запчасти автосервиса */}
        <div className="mt-2.5 flex items-center justify-between text-[11px] font-bold text-slate-400">
          <span>⏱ Итого: {totalMins} мин</span>
          {partsList.length > 0 && (
            <span className="text-[#0E7C5B] bg-[#E8F7EC] px-2 py-0.5 rounded-md">
              🔩 Запчасти сервиса: {partsList.length} поз.
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function MechanicHomeSkeleton() {
  return (
    <div className="p-4 space-y-5 animate-pulse max-w-lg mx-auto">
      <div className="h-10 w-48 bg-slate-200 rounded-xl" />
      <div className="h-44 bg-white rounded-3xl border border-slate-200" />
      <div className="h-16 bg-slate-200 rounded-3xl" />
      <div className="space-y-3">
        <div className="h-24 bg-white rounded-2xl" />
        <div className="h-24 bg-white rounded-2xl" />
      </div>
    </div>
  );
}
