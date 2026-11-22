'use client';

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@saldacargo/ui';
import {
  getMechanicSpecialty,
  ServiceOrderWorksAndParts,
  type QuickViewExecutor,
  type QuickViewPart,
  type QuickViewTx,
  type QuickViewWork,
} from './ServiceOrderViewSections';

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  in_progress: { label: 'В работе', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  completed: { label: 'Завершен', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  draft: { label: 'Черновик', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
  cancelled: { label: 'Отменен', cls: 'bg-rose-100 text-rose-800 border-rose-300' },
};

export function ServiceOrderViewModal({
  orderId,
  onClose,
}: {
  orderId: string;
  onClose: () => void;
}) {
  const backdropRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const {
    data: order,
    isLoading,
    error,
  } = useQuery<{
    id: string;
    order_number: number | string;
    status: string;
    priority?: string;
    machine_type: 'own' | 'client';
    problem_description?: string | null;
    admin_note?: string | null;
    mechanic_note?: string | null;
    mechanic_pay?: string | null;
    second_mechanic_pay?: string | null;
    client_name?: string | null;
    client_phone?: string | null;
    client_vehicle_brand?: string | null;
    client_vehicle_model?: string | null;
    client_vehicle_reg?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    asset?: { id: string; short_name: string; reg_number: string } | null;
    mechanic?: QuickViewExecutor | null;
    second_mechanic?: QuickViewExecutor | null;
    executors?: QuickViewExecutor[];
    works?: QuickViewWork[];
    parts?: QuickViewPart[];
    transactions?: QuickViewTx[];
  }>({
    queryKey: ['service-order-quick-view', orderId],
    queryFn: async () => {
      const res = await fetch(`/api/garage/orders/${orderId}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Не удалось загрузить заказ-наряд');
      }
      return res.json();
    },
    staleTime: 30000,
  });

  const isClientMachine = order?.machine_type === 'client';
  const vehicleTitle = isClientMachine
    ? `${order.client_name ? `Клиент: ${order.client_name}` : 'Клиент'} • ${[order.client_vehicle_brand, order.client_vehicle_model].filter(Boolean).join(' ') || 'Авто клиента'} ${order.client_vehicle_reg ? `(${order.client_vehicle_reg})` : ''}`
    : `${order?.asset?.short_name || 'Автопарк компании'} ${order?.asset?.reg_number ? `(${order.asset.reg_number})` : ''}`;

  const works = (order?.works || []).filter((w) => w.status !== 'cancelled');
  const parts = order?.parts || [];
  const transactions = order?.transactions || [];

  const totalWorksClient = works.reduce(
    (s, w) => s + parseFloat(w.price_client || '0') * (w.quantity || 1),
    0,
  );
  const totalPartsClient = parts.reduce(
    (s, p) => s + parseFloat(p.client_price || p.unit_price || '0') * (p.quantity || 1),
    0,
  );
  const totalClient = totalWorksClient + totalPartsClient;

  const statusInfo = STATUS_LABELS[order?.status || ''] || {
    label: order?.status || '—',
    cls: 'bg-slate-100 text-slate-700 border-slate-300',
  };

  const orderExecutors = (() => {
    const map = new Map<string, QuickViewExecutor>();
    if (order?.executors) {
      for (const ex of order.executors) {
        if (ex?.id) map.set(ex.id, ex);
        else if (ex?.name) map.set(ex.name, ex);
      }
    }
    if (order?.mechanic) map.set(order.mechanic.id || order.mechanic.name, order.mechanic);
    if (order?.second_mechanic) {
      map.set(order.second_mechanic.id || order.second_mechanic.name, order.second_mechanic);
    }
    for (const w of works) {
      if (w.mechanic) map.set(w.mechanic.id || w.mechanic.name, w.mechanic);
      if (w.second_mechanic) {
        map.set(w.second_mechanic.id || w.second_mechanic.name, w.second_mechanic);
      }
    }
    return Array.from(map.values());
  })();

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => {
        backdropRef.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (backdropRef.current && e.target === e.currentTarget) onClose();
        backdropRef.current = false;
      }}
    >
      <div
        className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black text-lg">
              🛠️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white">
                  Заказ-наряд #{order?.order_number || orderId}
                </h3>
                {order && (
                  <span
                    className={cn(
                      'text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border',
                      statusInfo.cls,
                    )}
                  >
                    {statusInfo.label}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {isLoading ? 'Загрузка данных...' : vehicleTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {order && (
              <a
                href={`/garage?orderId=${order.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors"
                title="Открыть полный наряд в разделе Гараж"
              >
                <span>В Гараж</span>
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              </a>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="inline-block animate-spin text-3xl">⚙️</div>
              <p className="text-sm font-bold text-slate-500">
                Загрузка информации о наряде #{orderId}...
              </p>
            </div>
          ) : error || !order ? (
            <div className="py-12 text-center space-y-3 bg-white rounded-2xl border border-rose-200 p-6">
              <span className="material-symbols-outlined text-4xl text-rose-500">error</span>
              <p className="text-sm font-bold text-rose-700">
                {error instanceof Error ? error.message : 'Не удалось загрузить заказ-наряд'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-amber-500">
                      calendar_today
                    </span>
                    Внесён в базу (создан)
                  </div>
                  <div className="text-xs font-black text-slate-900">
                    {order.created_at
                      ? new Date(order.created_at).toLocaleString('ru-RU', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-blue-500">
                      directions_car
                    </span>
                    Автомобиль / Объект
                  </div>
                  <div className="text-xs font-black text-slate-900 truncate" title={vehicleTitle}>
                    {vehicleTitle}
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1 sm:col-span-2 lg:col-span-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-emerald-500">
                      badge
                    </span>
                    Исполнители (Мастера)
                  </div>
                  <div className="text-xs font-black text-slate-900">
                    {orderExecutors.length > 0 ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {orderExecutors.map((ex, i) => {
                          const spec = getMechanicSpecialty(ex.roles);
                          return (
                            <span key={ex.id || i} className="inline-flex items-center gap-1">
                              <span>{ex.name}</span>
                              <span
                                className={cn(
                                  'text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border',
                                  spec.cls,
                                )}
                              >
                                {spec.label}
                              </span>
                              {i < orderExecutors.length - 1 && (
                                <span className="text-slate-400 font-bold">+</span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      'Не назначен'
                    )}
                  </div>
                </div>
              </div>

              {order.problem_description && (
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">report_problem</span>
                    Причина обращения / Жалоба
                  </div>
                  <p className="text-xs font-semibold text-amber-950 leading-relaxed">
                    {order.problem_description}
                  </p>
                </div>
              )}

              <ServiceOrderWorksAndParts
                works={works}
                parts={parts}
                executors={order.executors}
                orderExecutors={orderExecutors}
                totalWorksClient={totalWorksClient}
                totalPartsClient={totalPartsClient}
              />

              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4.5 space-y-3 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">
                      account_balance_wallet
                    </span>
                    Финансовый расчёт и начисленная ЗП
                  </span>
                  <span className="text-xs font-bold text-slate-300">
                    Итого по наряду: <b>{totalClient.toLocaleString('ru-RU')} ₽</b>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {order.mechanic_pay && parseFloat(order.mechanic_pay) > 0 ? (
                    <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                      <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
                        <span>Начислено: {order.mechanic?.name || 'Основной мастер'}</span>
                        {order.mechanic?.roles && (
                          <span className="text-[9px] bg-slate-700 text-slate-300 px-1.5 py-0.2 rounded font-bold">
                            {getMechanicSpecialty(order.mechanic.roles).label}
                          </span>
                        )}
                      </div>
                      <div className="text-lg font-black text-emerald-400 mt-0.5">
                        {parseFloat(order.mechanic_pay).toLocaleString('ru-RU')} ₽
                      </div>
                    </div>
                  ) : null}

                  {order.second_mechanic_pay && parseFloat(order.second_mechanic_pay) > 0 ? (
                    <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                      <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
                        <span>Начислено: {order.second_mechanic?.name || '2-й мастер'}</span>
                        {order.second_mechanic?.roles && (
                          <span className="text-[9px] bg-slate-700 text-slate-300 px-1.5 py-0.2 rounded font-bold">
                            {getMechanicSpecialty(order.second_mechanic.roles).label}
                          </span>
                        )}
                      </div>
                      <div className="text-lg font-black text-emerald-400 mt-0.5">
                        {parseFloat(order.second_mechanic_pay).toLocaleString('ru-RU')} ₽
                      </div>
                    </div>
                  ) : null}
                </div>

                {transactions.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 space-y-1.5">
                    <div className="text-[10px] font-bold uppercase text-slate-400">
                      Начисления ЗП мастерам по операциям:
                    </div>
                    {transactions.map((tx) => {
                      const userRoles =
                        tx.related_user?.roles ||
                        orderExecutors.find((e) => e.name === tx.related_user?.name)?.roles;
                      const spec = userRoles ? getMechanicSpecialty(userRoles) : null;
                      return (
                        <div
                          key={tx.id}
                          className="text-xs flex items-center justify-between bg-slate-800/50 px-2.5 py-1.5 rounded-lg gap-2"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-slate-300 font-medium truncate">
                              {tx.description || 'Начисление ЗП'}
                            </span>
                            {spec && (
                              <span
                                className={cn(
                                  'text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded border shrink-0',
                                  spec.cls,
                                )}
                              >
                                {spec.label}
                              </span>
                            )}
                          </div>
                          <span className="font-mono font-bold text-amber-400 shrink-0">
                            +{parseFloat(tx.amount || '0').toLocaleString('ru-RU')} ₽
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
