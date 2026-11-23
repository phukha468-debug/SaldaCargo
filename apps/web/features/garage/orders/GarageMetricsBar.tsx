'use client';

import { cn, Money } from '@saldacargo/ui';

export type GarageTab =
  | 'active'
  | 'pending_payment'
  | 'archive'
  | 'warehouse'
  | 'clients'
  | 'maintenance';

export function GarageMetricsBar({
  activeTab,
  setActiveTab,
  inWorkCount,
  ownActiveCount,
  clientActiveCount,
  pendingPaymentCount,
  totalPendingPaymentSum,
  archiveCount,
  totalWarehouseVal,
  clientsCount,
}: {
  activeTab: GarageTab;
  setActiveTab: (tab: GarageTab) => void;
  inWorkCount: number;
  ownActiveCount: number;
  clientActiveCount: number;
  pendingPaymentCount: number;
  totalPendingPaymentSum: number;
  archiveCount: number;
  totalWarehouseVal: number;
  clientsCount: number;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
      <div
        onClick={() => setActiveTab('active')}
        className={cn(
          'bg-white border rounded-2xl p-3 shadow-2xs transition-all cursor-pointer flex flex-col justify-between',
          activeTab === 'active'
            ? 'border-sky-300 ring-2 ring-sky-100'
            : 'border-sky-100 hover:border-sky-200',
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            В боксах СТО
          </span>
          <span className="text-sm">🔧</span>
        </div>
        <div className="mt-2">
          <div className="text-xl font-black text-sky-950">{inWorkCount} наряда</div>
          <div className="text-[11px] text-sky-700 font-bold mt-0.5 flex items-center gap-1">
            <span>{ownActiveCount} своих</span> · <span>{clientActiveCount} клиент</span>
          </div>
        </div>
      </div>

      <div
        onClick={() => setActiveTab('pending_payment')}
        className={cn(
          'bg-white border rounded-2xl p-3 shadow-2xs transition-all cursor-pointer flex flex-col justify-between',
          activeTab === 'pending_payment'
            ? 'border-amber-300 ring-2 ring-amber-100'
            : 'border-amber-100 hover:border-amber-200',
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
            Ждут оплаты
          </span>
          <span className="text-sm">💳</span>
        </div>
        <div className="mt-2">
          <div className="text-xl font-black text-amber-900">
            <Money amount={totalPendingPaymentSum} />
          </div>
          <div className="text-[11px] text-amber-600 font-bold mt-0.5">
            {pendingPaymentCount} {pendingPaymentCount === 1 ? 'наряд клиента' : 'наряда клиентов'}
          </div>
        </div>
      </div>

      <div
        onClick={() => setActiveTab('archive')}
        className={cn(
          'bg-white border rounded-2xl p-3 shadow-2xs transition-all cursor-pointer flex flex-col justify-between',
          activeTab === 'archive'
            ? 'border-emerald-300 ring-2 ring-emerald-100'
            : 'border-emerald-100 hover:border-emerald-200',
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
            Архив
          </span>
          <span className="text-sm">📚</span>
        </div>
        <div className="mt-2">
          <div className="text-xl font-black text-emerald-900">{archiveCount} нарядов</div>
          <div className="text-[11px] text-emerald-600 font-bold mt-0.5">Закрытые и оплаченные</div>
        </div>
      </div>

      <div
        onClick={() => setActiveTab('warehouse')}
        className={cn(
          'bg-white border rounded-2xl p-3 shadow-2xs transition-all cursor-pointer flex flex-col justify-between',
          activeTab === 'warehouse'
            ? 'border-sky-300 ring-2 ring-sky-100'
            : 'border-sky-100 hover:border-sky-200',
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Склад (ТМЦ)
          </span>
          <span className="text-sm">📦</span>
        </div>
        <div className="mt-2">
          <div className="text-xl font-black text-slate-800">
            <Money amount={totalWarehouseVal} />
          </div>
          <div className="text-[11px] text-slate-500 font-bold mt-0.5">Оценка: +30%</div>
        </div>
      </div>

      <div
        onClick={() => setActiveTab('clients')}
        className={cn(
          'bg-white border rounded-2xl p-3 shadow-2xs transition-all cursor-pointer flex flex-col justify-between col-span-2 lg:col-span-1',
          activeTab === 'clients'
            ? 'border-indigo-300 ring-2 ring-indigo-100'
            : 'border-indigo-100 hover:border-indigo-200',
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
            Клиенты СТО
          </span>
          <span className="text-sm">👥</span>
        </div>
        <div className="mt-2">
          <div className="text-xl font-black text-indigo-950">{clientsCount} контрагентов</div>
          <div className="text-[11px] text-indigo-600 font-bold mt-0.5">Коммерческий сервис</div>
        </div>
      </div>
    </div>
  );
}
