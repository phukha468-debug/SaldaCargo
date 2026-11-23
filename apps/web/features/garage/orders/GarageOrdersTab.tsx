'use client';

import { cn, Money } from '@saldacargo/ui';
import type { TabOrder } from '../types';
import { OrderCard } from './OrderCard';

export function GarageOrdersTab({
  activeTab,
  ordersLoading,
  filteredActiveOrders,
  filteredPendingOrders,
  filteredArchiveOrders,
  totalPendingPaymentSum,
  search,
  setSearch,
  filterType,
  setFilterType,
  onSelectOrder,
}: {
  activeTab: 'active' | 'pending_payment' | 'archive';
  ordersLoading: boolean;
  filteredActiveOrders: TabOrder[];
  filteredPendingOrders: TabOrder[];
  filteredArchiveOrders: TabOrder[];
  totalPendingPaymentSum: number;
  search: string;
  setSearch: (v: string) => void;
  filterType: 'all' | 'own' | 'client';
  setFilterType: (v: 'all' | 'own' | 'client') => void;
  onSelectOrder: (id: string) => void;
}) {
  if (activeTab === 'active') {
    return (
      <div className="space-y-3">
        {/* Панель фильтров: поиск и принадлежность (свой/клиент) */}
        <div className="flex items-center justify-between flex-wrap gap-2 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <input
              type="text"
              placeholder="🔍 Поиск по номеру наряда, авто или механику..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:bg-white focus:outline-hidden focus:border-sky-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <button
              onClick={() => setFilterType('all')}
              className={cn(
                'px-3 py-1.5 rounded-lg transition-all cursor-pointer',
                filterType === 'all'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              Все ({filteredActiveOrders.length})
            </button>
            <button
              onClick={() => setFilterType('own')}
              className={cn(
                'px-3 py-1.5 rounded-lg transition-all cursor-pointer',
                filterType === 'own'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              🚛 Свой парк ({filteredActiveOrders.filter((o) => o.machine_type === 'own').length})
            </button>
            <button
              onClick={() => setFilterType('client')}
              className={cn(
                'px-3 py-1.5 rounded-lg transition-all cursor-pointer',
                filterType === 'client'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              🏢 Сторонние клиенты (
              {filteredActiveOrders.filter((o) => o.machine_type === 'client').length})
            </button>
          </div>
        </div>

        {/* Список нарядов */}
        {ordersLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredActiveOrders.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
            <p className="text-4xl mb-2">🔧</p>
            <p className="font-bold text-slate-600">Нарядов в работе по фильтру не найдено</p>
            <p className="text-xs text-slate-400 mt-1">
              Здесь отображаются только автомобили, ремонт которых ещё выполняется
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredActiveOrders.map((o) => (
              <OrderCard key={o.id} o={o} onSelect={onSelectOrder} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (activeTab === 'pending_payment') {
    return (
      <div className="space-y-3">
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-sm text-amber-950">
              Заказ-наряды сторонних клиентов, ожидающие оплаты
            </h3>
            <p className="text-xs text-amber-800 mt-0.5">
              После приёма оплаты заказ-наряд закрывается и выручка поступает в кассу
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase text-amber-800 block">
              Всего к оплате:
            </span>
            <span className="text-xl font-black text-amber-950">
              <Money amount={totalPendingPaymentSum} />
            </span>
          </div>
        </div>

        {filteredPendingOrders.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
            <p className="text-4xl mb-2">💳</p>
            <p className="font-bold text-slate-600">Нет неоплаченных нарядов</p>
            <p className="text-xs text-slate-400 mt-1">
              Все завершённые наряды клиентов полностью рассчитаны
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPendingOrders.map((o) => (
              <OrderCard key={o.id} o={o} onSelect={onSelectOrder} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Фильтры по типу авто и поиск */}
      <div className="flex items-center justify-between flex-wrap gap-2 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <input
            type="text"
            placeholder="🔍 Поиск в архиве по номеру наряда, авто или механику..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:bg-white focus:outline-hidden focus:border-sky-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <button
            onClick={() => setFilterType('all')}
            className={cn(
              'px-3 py-1.5 rounded-lg transition-all cursor-pointer',
              filterType === 'all'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            Все закрытые ({filteredArchiveOrders.length})
          </button>
          <button
            onClick={() => setFilterType('own')}
            className={cn(
              'px-3 py-1.5 rounded-lg transition-all cursor-pointer',
              filterType === 'own'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            🚛 Свой парк ({filteredArchiveOrders.filter((o) => o.machine_type === 'own').length})
          </button>
          <button
            onClick={() => setFilterType('client')}
            className={cn(
              'px-3 py-1.5 rounded-lg transition-all cursor-pointer',
              filterType === 'client'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            🏢 Оплаченные клиенты (
            {filteredArchiveOrders.filter((o) => o.machine_type === 'client').length})
          </button>
        </div>
      </div>

      {ordersLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredArchiveOrders.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
          <p className="text-4xl mb-2">📚</p>
          <p className="font-bold text-slate-600">В архиве за выбранный период нет нарядов</p>
          <p className="text-xs text-slate-400 mt-1">
            Выберите другой день, неделю или переключитесь на «Все время»
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredArchiveOrders.map((o) => (
            <OrderCard key={o.id} o={o} onSelect={onSelectOrder} />
          ))}
        </div>
      )}
    </div>
  );
}
