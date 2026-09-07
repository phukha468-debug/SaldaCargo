'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

type DeliveryOrder = {
  id: string;
  createdAt: string;
  order_number?: string;
  orderNumber?: string;
  store_name?: string;
  storeName?: string;
  pickup_address?: string;
  delivery_address?: string;
  has_extra_point?: boolean;
  extra_point_address?: string;
  extra_point_price?: number;
  extra_disposal_carry?: boolean;
  distance_km?: number;
  distance_km_leg1?: number;
  distance_km_leg2?: number;
  has_loaders?: boolean;
  loaders_count?: number;
  cargo_name?: string;
  total_price?: number;
  totalPrice?: number;
  client_name?: string;
  client_phone?: string;
  notes?: string;
};

type ApiResponse = {
  success: boolean;
  orders: DeliveryOrder[];
  storeStats: Record<string, { count: number; totalSum: number }>;
  totalCount: number;
  grandTotal: number;
};

export default function DeliveriesPage() {
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('all');

  const now = new Date();
  let fromDate = '';
  if (period === 'today') {
    fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  } else if (period === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    fromDate = d.toISOString();
  } else if (period === 'month') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    fromDate = d.toISOString();
  }

  const { data, isLoading, refetch } = useQuery<ApiResponse>({
    queryKey: ['delivery-orders', selectedStore, period],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStore !== 'all') params.set('store', selectedStore);
      if (fromDate) params.set('fromDate', fromDate);
      const res = await fetch(`/api/public/delivery-order?${params.toString()}`);
      if (!res.ok) throw new Error('Ошибка загрузки заявок');
      return res.json();
    },
    refetchInterval: 30000,
  });

  const orders = data?.orders || [];
  const storeStats = data?.storeStats || {};
  const totalCount = data?.totalCount || 0;
  const grandTotal = data?.grandTotal || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="material-symbols-outlined text-amber-500 text-3xl">
              local_shipping
            </span>
            Заявки на доставку из магазинов
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Учёт заказов с сайта ancargo66.ru, суммы по магазинам и связь с рейсами
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/review"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">rate_review</span>
            Ревью рейсов
          </Link>
          <button
            onClick={() => refetch()}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl transition shadow-sm"
            title="Обновить"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Магазин:
          </span>
          {[
            { key: 'all', label: 'Все магазины' },
            { key: 'Обстановочка', label: 'Обстановочка' },
            { key: 'Двери', label: 'Двери & Сейфы' },
            { key: 'Керамика', label: 'Керамика' },
            { key: 'Стройбаза', label: 'Стройбаза' },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setSelectedStore(s.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                selectedStore === s.key
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto justify-end">
          {(
            [
              { key: 'today', label: 'Сегодня' },
              { key: 'week', label: '7 дней' },
              { key: 'month', label: 'Месяц' },
              { key: 'all', label: 'Всё время' },
            ] as const
          ).map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                period === p.key
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Всего доставок
          </div>
          <div className="text-3xl font-black text-slate-900 mt-1 font-mono">{totalCount}</div>
          <div className="text-xs text-slate-500 mt-1">за выбранный период</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Общая сумма выручки
          </div>
          <div className="text-3xl font-black text-amber-600 mt-1 font-mono">
            {grandTotal.toLocaleString('ru-RU')} ₽
          </div>
          <div className="text-xs text-slate-500 mt-1">доставка + погрузка / подъем</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Средний чек доставки
          </div>
          <div className="text-3xl font-black text-slate-900 mt-1 font-mono">
            {totalCount > 0 ? Math.round(grandTotal / totalCount).toLocaleString('ru-RU') : 0} ₽
          </div>
          <div className="text-xs text-slate-500 mt-1">на 1 заявку</div>
        </div>
      </div>

      {Object.keys(storeStats).length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
            Оборот по магазинам-партнёрам
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(storeStats).map(([name, stat]) => (
              <div key={name} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-xs font-bold text-slate-800 truncate" title={name}>
                  {name}
                </div>
                <div className="text-lg font-black text-slate-900 font-mono mt-1">
                  {stat.totalSum.toLocaleString('ru-RU')} ₽
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">{stat.count} доставок</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Реестр заявок ({orders.length})
          </h2>
          <span className="text-xs text-slate-400">Автообновление каждые 30 сек.</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Загрузка данных...</div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">
              inventory_2
            </span>
            <p className="text-sm">За выбранный период заявок от магазинов не найдено</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Заказ / Дата</th>
                  <th className="py-3 px-4">Магазин</th>
                  <th className="py-3 px-4">Куда / Расстояние</th>
                  <th className="py-3 px-4">Груз и бригада</th>
                  <th className="py-3 px-4">Клиент / Телефон</th>
                  <th className="py-3 px-4 text-right">Сумма</th>
                  <th className="py-3 px-4 text-center">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {orders.map((ord) => {
                  const num = ord.order_number || ord.orderNumber || '№----';
                  const sName = ord.store_name || ord.storeName || 'Магазин';
                  const dest = ord.delivery_address || '---';
                  const km = ord.distance_km || 0;
                  const price = ord.total_price || ord.totalPrice || 0;
                  const cName = ord.client_name || 'Клиент';
                  const phone = ord.client_phone || '---';
                  const loaders = ord.has_loaders
                    ? `${ord.loaders_count || 1} грузч.`
                    : 'Без грузчиков';
                  const cargo = ord.cargo_name || 'Товар';
                  const dateStr = ord.createdAt
                    ? new Date(ord.createdAt).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '---';

                  return (
                    <tr key={ord.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-medium">
                        <div className="font-mono font-bold text-slate-900">{num}</div>
                        <div className="text-[11px] text-slate-400">{dateStr}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{sName}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 max-w-xs truncate" title={dest}>
                          {dest}
                        </div>
                        {ord.has_extra_point && ord.extra_point_address ? (
                          <div
                            className="text-[11px] text-blue-700 font-semibold flex items-center gap-1 max-w-xs truncate"
                            title={ord.extra_point_address}
                          >
                            <span>➔ {ord.extra_point_address}</span>
                            <span className="text-[9px] bg-blue-100 text-blue-800 px-1 rounded">
                              2 точки
                            </span>
                          </div>
                        ) : null}
                        <div className="text-[11px] text-slate-500">{km} км</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{cargo}</div>
                        <div className="text-[11px] text-amber-600 font-semibold">{loaders}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{cName}</div>
                        <a
                          href={`tel:${phone}`}
                          className="text-[11px] font-mono text-blue-600 hover:underline"
                        >
                          {phone}
                        </a>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {Number(price).toLocaleString('ru-RU')} ₽
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Link
                          href="/review"
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition inline-flex items-center gap-1"
                          title="Перейти к рейсам для назначения водителя"
                        >
                          <span className="material-symbols-outlined text-xs">local_shipping</span>
                          Рейс
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
