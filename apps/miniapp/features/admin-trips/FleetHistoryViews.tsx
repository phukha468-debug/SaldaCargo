'use client';

import { cn } from '@saldacargo/ui';
import type { VehicleGroup } from './types';

export function FleetHistorySummary({
  totalRevenue,
  totalPayroll,
  totalFuel,
  totalMaintenance,
  totalNetProfit,
  tripsCount,
  ordersCount,
}: {
  totalRevenue: number;
  totalPayroll: number;
  totalFuel: number;
  totalMaintenance: number;
  totalNetProfit: number;
  tripsCount: number;
  ordersCount: number;
}) {
  return (
    <div className="p-2.5">
      <div className="bg-white rounded-2xl border-2 border-slate-200/90 p-2.5 shadow-xs space-y-1.5">
        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-100">
          <span>
            ИТОГО АВТОПАРК · {tripsCount} РЕЙС{tripsCount === 1 ? '' : tripsCount < 5 ? 'А' : 'ОВ'}{' '}
            · {ordersCount} ТО
          </span>
          <span
            className={cn(
              'font-black px-1.5 py-0.5 rounded border text-[9px]',
              totalNetProfit >= 0
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-rose-700 bg-rose-50 border-rose-200',
            )}
          >
            {totalNetProfit >= 0 ? '+' : ''}
            {Math.round(totalNetProfit).toLocaleString('ru-RU')} ₽ ЧИСТЫМИ
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
          <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-100">
            <span className="text-[7px] text-slate-400 font-bold block uppercase">Выручка</span>
            <span className="font-black text-slate-900 text-xs sm:text-sm">
              {Math.round(totalRevenue).toLocaleString('ru-RU')} ₽
            </span>
          </div>
          <div className="bg-amber-50/60 p-1.5 rounded-xl border border-amber-100">
            <span className="text-[7px] text-amber-600 font-bold block uppercase">ЗП (ФОТ)</span>
            <span className="font-black text-amber-600 text-xs sm:text-sm">
              {Math.round(totalPayroll).toLocaleString('ru-RU')} ₽
            </span>
          </div>
          <div className="bg-rose-50/60 p-1.5 rounded-xl border border-rose-100">
            <span className="text-[7px] text-rose-600 font-bold block uppercase">ГСМ</span>
            <span className="font-black text-rose-600 text-xs sm:text-sm">
              {Math.round(totalFuel).toLocaleString('ru-RU')} ₽
            </span>
          </div>
          <div className="bg-rose-50 p-1.5 rounded-xl border border-rose-200">
            <span className="text-[7px] text-rose-700 font-bold block uppercase">Ремонт ТО</span>
            <span className="font-black text-rose-700 text-xs sm:text-sm">
              {totalMaintenance > 0
                ? `−${Math.round(totalMaintenance).toLocaleString('ru-RU')} ₽`
                : '0 ₽'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VehicleGroupCard({ group, onClick }: { group: VehicleGroup; onClick: () => void }) {
  const displayedPay = group.isPrr
    ? group.loaderPayroll
    : group.isTruck
      ? group.driverPayroll
      : group.tripsPayroll;

  return (
    <div
      onClick={onClick}
      className="bg-white border border-slate-200 hover:border-sky-300 rounded-2xl p-2.5 shadow-2xs cursor-pointer transition-all active:scale-[0.99] space-y-1.5"
    >
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm',
              group.isPrr ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-600',
            )}
          >
            {group.isPrr ? '👷' : '🚚'}
          </div>
          <div className="min-w-0 truncate">
            <div className="flex items-center gap-1">
              <span className="font-black text-slate-900 text-xs truncate">{group.assetName}</span>
              {group.regNumber && (
                <span className="text-[10px] text-slate-400 font-semibold truncate shrink-0">
                  ({group.regNumber})
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <div className="text-right">
            <span className="text-[7px] font-bold uppercase tracking-wider text-slate-400 block leading-none">
              Прибыль
            </span>
            <span
              className={cn(
                'text-xs font-black',
                group.netProfit > 0
                  ? 'text-emerald-600'
                  : group.netProfit < 0
                    ? 'text-rose-600'
                    : 'text-slate-500',
              )}
            >
              {group.netProfit > 0 ? '+' : ''}
              {Math.round(group.netProfit).toLocaleString('ru-RU')} ₽
            </span>
          </div>
          <span className="text-slate-300 text-sm font-bold pl-0.5">›</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 text-[10px]">
        <div className="flex items-center gap-1 shrink-0 flex-wrap">
          {group.trips.length > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100 font-bold text-[9px]">
              <span>📋</span>
              <span>
                {group.trips.length} рейс
                {group.trips.length === 1 ? '' : group.trips.length < 5 ? 'а' : 'ов'}
              </span>
              <span className="text-[8px] text-sky-500">▾</span>
            </span>
          )}
          {group.serviceOrders.length > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[9px]">
              <span>🔧</span>
              <span>
                {group.serviceOrders.length} ТО (−
                {Math.round(group.maintenanceTotal).toLocaleString('ru-RU')} ₽)
              </span>
              <span className="text-[8px] text-rose-500">▾</span>
            </span>
          )}
          {group.trips.length === 0 && group.serviceOrders.length === 0 && (
            <span className="text-slate-400 text-[9px]">Нет рейсов</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-right">
          <div title="Выручка">
            <span className="text-[7px] text-slate-400 block font-bold uppercase leading-none">
              Выручка
            </span>
            <span className="font-bold text-slate-800 text-[10px]">
              {Math.round(group.tripsRevenue).toLocaleString('ru-RU')} ₽
            </span>
          </div>

          <div
            title={group.isTruck ? 'Зарплата водителя' : group.isPrr ? 'ФОТ грузчиков' : 'ЗП (ФОТ)'}
          >
            <span className="text-[7px] text-slate-400 block font-bold uppercase leading-none">
              ЗП (ФОТ)
            </span>
            <span className="font-bold text-amber-500 text-[10px] block">
              {Math.round(displayedPay).toLocaleString('ru-RU')} ₽
            </span>
            {group.loaderProfit > 0 && !group.isPrr && !group.isTruck && (
              <span className="text-[7px] font-bold text-emerald-600 block leading-none">
                +{Math.round(group.loaderProfit).toLocaleString('ru-RU')} ₽ с гр.
              </span>
            )}
          </div>

          {!group.isPrr && (
            <div title="ГСМ">
              <span className="text-[7px] text-slate-400 block font-bold uppercase leading-none">
                ГСМ
              </span>
              <span className="font-bold text-rose-500 text-[10px]">
                {Math.round(group.tripsFuel).toLocaleString('ru-RU')} ₽
              </span>
            </div>
          )}

          {group.maintenanceTotal > 0 && (
            <div
              className="bg-rose-50 border border-rose-200 px-1 py-0.5 rounded"
              title="Ремонт ТО"
            >
              <span className="text-[7px] text-rose-700 block font-bold uppercase leading-none">
                Ремонт ТО
              </span>
              <span className="font-black text-rose-600 text-[10px]">
                −{Math.round(group.maintenanceTotal).toLocaleString('ru-RU')} ₽
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
