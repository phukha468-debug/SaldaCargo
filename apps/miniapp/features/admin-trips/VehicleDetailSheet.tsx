'use client';

import type React from 'react';
import { useState } from 'react';
import { calcServiceOrder, calcTrip, formatDate } from '@saldacargo/shared';
import { cn } from '@saldacargo/ui';
import type { MiniappTrip, VehicleGroup } from './types';

export function VehicleDetailSheet({
  group,
  onClose,
  onEditTrip,
}: {
  group: VehicleGroup;
  onClose: () => void;
  onEditTrip: (trip: MiniappTrip) => void;
}) {
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{
        background: 'rgba(0,0,0,0.5)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-slate-50 rounded-t-3xl shadow-2xl flex flex-col"
        style={
          {
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            maxHeight: 'calc(100vh - 70px)',
          } as React.CSSProperties
        }
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-lg',
                group.isPrr ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-600',
              )}
            >
              {group.isPrr ? '👷' : '🚚'}
            </div>
            <div className="min-w-0 truncate">
              <h2 className="font-black text-slate-900 text-sm truncate">{group.assetName}</h2>
              {group.regNumber && (
                <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                  Госномер: {group.regNumber}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 text-xl font-bold cursor-pointer"
          >
            ×
          </button>
        </div>

        <div className="p-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Финансовый результат
              </span>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-md font-black text-xs border',
                  group.netProfit >= 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200',
                )}
              >
                {group.netProfit >= 0 ? '+' : ''}
                {Math.round(group.netProfit).toLocaleString('ru-RU')} ₽ ЧИСТЫМИ
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                <span className="text-[9px] text-slate-400 font-bold uppercase block">Выручка</span>
                <span className="font-black text-slate-900 text-sm">
                  {Math.round(group.tripsRevenue).toLocaleString('ru-RU')} ₽
                </span>
              </div>
              <div className="bg-amber-50/50 p-2 rounded-xl border border-amber-100">
                <span className="text-[9px] text-amber-600 font-bold uppercase block">
                  ФОТ (ЗП)
                </span>
                <span className="font-black text-amber-600 text-sm">
                  {Math.round(group.tripsPayroll).toLocaleString('ru-RU')} ₽
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  Водитель: {Math.round(group.driverPayroll).toLocaleString('ru-RU')} ₽ · Грузчики:{' '}
                  {Math.round(group.loaderPayroll).toLocaleString('ru-RU')} ₽
                </span>
              </div>
              {!group.isPrr && (
                <div className="bg-rose-50/50 p-2 rounded-xl border border-rose-100">
                  <span className="text-[9px] text-rose-600 font-bold uppercase block">ГСМ</span>
                  <span className="font-black text-rose-600 text-sm">
                    {Math.round(group.tripsFuel).toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              )}
              {!group.isPrr && (
                <div className="bg-rose-50/50 p-2 rounded-xl border border-rose-200">
                  <span className="text-[9px] text-rose-700 font-bold uppercase block">
                    Ремонт ТО (Гараж)
                  </span>
                  <span className="font-black text-rose-700 text-sm">
                    {group.maintenanceTotal > 0
                      ? `−${Math.round(group.maintenanceTotal).toLocaleString('ru-RU')} ₽`
                      : '0 ₽'}
                  </span>
                  {group.maintenanceTotal > 0 && (
                    <span className="text-[9px] text-slate-400 block mt-0.5">
                      Запчасти: {Math.round(group.maintenanceParts).toLocaleString('ru-RU')} ₽ ·
                      Работы: {Math.round(group.maintenanceSalary).toLocaleString('ru-RU')} ₽
                    </span>
                  )}
                </div>
              )}
              {group.isPrr && (
                <div className="bg-emerald-50/60 p-2 rounded-xl border border-emerald-200 col-span-2">
                  <span className="text-[9px] text-emerald-700 font-bold uppercase block">
                    Маржа компании с грузчиков (30%)
                  </span>
                  <span className="font-black text-emerald-700 text-sm">
                    +{Math.round(group.loaderProfit).toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {group.trips.length > 0 && (
          <div className="px-3 pb-3 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                Рейсы ({group.trips.length})
              </span>
            </div>
            {group.trips.map((trip) => {
              const ct = calcTrip(trip);
              const isExp = expandedTripId === trip.id;
              return (
                <div
                  key={trip.id}
                  className="bg-white rounded-xl border border-slate-200 p-2.5 shadow-2xs space-y-1.5"
                >
                  <div
                    onClick={() => setExpandedTripId(isExp ? null : trip.id)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-slate-900 text-xs">
                          Рейс #{trip.trip_number}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatDate(trip.started_at || trip.created_at)}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                        {trip.driver?.name || 'Водитель не назначен'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] font-bold text-slate-400 block uppercase">
                        Прибыль
                      </span>
                      <span
                        className={cn(
                          'text-xs font-black',
                          ct.profit >= 0 ? 'text-emerald-600' : 'text-rose-600',
                        )}
                      >
                        {ct.profit >= 0 ? '+' : ''}
                        {Math.round(ct.profit).toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-100 text-slate-600">
                    <span>
                      Выр:{' '}
                      <b className="text-slate-800">
                        {Math.round(ct.revenue).toLocaleString('ru-RU')} ₽
                      </b>
                    </span>
                    <span>
                      ЗП:{' '}
                      <b className="text-amber-600">
                        {Math.round(ct.driverPay + ct.loaderPay).toLocaleString('ru-RU')} ₽
                      </b>
                    </span>
                    <span>
                      ГСМ:{' '}
                      <b className="text-rose-600">
                        {Math.round(ct.fuelExpense).toLocaleString('ru-RU')} ₽
                      </b>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditTrip(trip);
                      }}
                      className="text-sky-600 hover:underline font-bold text-[10px] cursor-pointer"
                    >
                      ✏️ Изм.
                    </button>
                  </div>

                  {isExp && ct.activeOrders.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                        Заявки рейса ({ct.activeOrders.length}):
                      </span>
                      {ct.activeOrders.map((o, idx) => (
                        <div
                          key={o.id || idx}
                          className="bg-slate-50 p-2 rounded-lg text-[11px] flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-slate-800 block">
                              #{idx + 1} {o.counterparty_name || o.counterparty?.name || 'Клиент'}
                            </span>
                            {o.address_to && (
                              <span className="text-[9px] text-slate-500 block truncate max-w-[200px]">
                                {o.address_to}
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="font-black text-slate-900 block">
                              {Math.round(parseFloat(o.amount || '0')).toLocaleString('ru-RU')} ₽
                            </span>
                            <span className="text-[9px] text-slate-500 block">
                              ЗП вод:{' '}
                              {Math.round(parseFloat(o.driver_pay || '0')).toLocaleString('ru-RU')}{' '}
                              ₽
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {group.serviceOrders.length > 0 && (
          <div className="px-3 pb-3 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-rose-700">
                Заказ-наряды ТО ({group.serviceOrders.length})
              </span>
            </div>
            {group.serviceOrders.map((order) => {
              const cso = calcServiceOrder(order);
              const isExp = expandedOrderId === order.id;
              return (
                <div
                  key={order.id}
                  className="bg-white rounded-xl border border-rose-200 p-2.5 shadow-2xs space-y-1.5"
                >
                  <div
                    onClick={() => setExpandedOrderId(isExp ? null : order.id)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-rose-800 text-xs">
                          Наряд #{order.order_number || order.id?.slice(0, 6)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatDate(order.created_at)}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 mt-0.5 line-clamp-1">
                        {order.problem_description || 'Ремонт / ТО'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] font-bold text-slate-400 block uppercase">
                        Сумма ТО
                      </span>
                      <span className="text-xs font-black text-rose-600">
                        −{Math.round(cso.totalCost).toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-rose-100 text-slate-600">
                    <span>
                      Запчасти:{' '}
                      <b className="text-slate-800">
                        {Math.round(cso.partsCost).toLocaleString('ru-RU')} ₽
                      </b>
                    </span>
                    <span>
                      Работы:{' '}
                      <b className="text-slate-800">
                        {Math.round(cso.isExternal ? cso.worksCost : cso.salaryCost).toLocaleString(
                          'ru-RU',
                        )}{' '}
                        ₽
                      </b>
                    </span>
                    <span className="text-slate-500">
                      {cso.isExternal
                        ? cso.contractorName || 'Сторонний сервис'
                        : order.mechanic?.name || 'Механик'}
                    </span>
                  </div>

                  {isExp && order.parts && order.parts.length > 0 && (
                    <div className="pt-2 border-t border-rose-100 space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                        Установленные запчасти:
                      </span>
                      {order.parts.map((p, idx) => (
                        <div
                          key={p.id || idx}
                          className="bg-rose-50/50 p-1.5 rounded-lg text-[10px] flex items-center justify-between"
                        >
                          <span className="text-slate-700">
                            {p.custom_part_name || p.part?.name || 'Деталь'} ({p.quantity || 1} шт)
                          </span>
                          <span className="font-bold text-rose-700">
                            {Math.round(
                              (parseFloat(String(p.unit_price ?? p.price ?? 0)) || 0) *
                                (parseFloat(String(p.quantity ?? 1)) || 1),
                            ).toLocaleString('ru-RU')}{' '}
                            ₽
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
