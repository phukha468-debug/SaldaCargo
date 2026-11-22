'use client';

import { Money, cn } from '@saldacargo/ui';
import { PAYMENT_LABELS, PAYMENT_STYLES } from '../constants';
import type { TripForReview, TripOrder } from '../types';
import { calcOrderLoaderMetrics } from '../utils';

export function TripCardOrdersTable({
  trip,
  activeOrders,
  expenses,
}: {
  trip: TripForReview;
  activeOrders: TripOrder[];
  expenses: TripForReview['trip_expenses'];
}) {
  return (
    <div className="border-t border-slate-100 overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            <th className="px-5 py-2.5 text-[10px] text-slate-500 uppercase tracking-wider font-bold">
              Клиент
            </th>
            <th className="px-5 py-2.5 text-[10px] text-slate-500 uppercase tracking-wider font-bold">
              Сумма
            </th>
            <th className="px-5 py-2.5 text-[10px] text-slate-500 uppercase tracking-wider font-bold text-right">
              ЗП вод.
            </th>
            <th className="px-5 py-2.5 text-[10px] text-slate-500 uppercase tracking-wider font-bold text-center">
              %
            </th>
            <th className="px-5 py-2.5 text-[10px] text-slate-500 uppercase tracking-wider font-bold text-right">
              ЗП груз.
            </th>
            <th className="px-5 py-2.5 text-[10px] text-slate-500 uppercase tracking-wider font-bold">
              Оплата
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {activeOrders.map((order) => {
            const amt = parseFloat(order.amount);
            const dp = parseFloat(order.driver_pay);
            const split = amt > 0 ? Math.round((dp / amt) * 100) : 0;
            const isOrderPpr =
              order.direction === 'loaders_only' || trip.asset?.reg_number === 'БЕЗ АВТО';
            const orderLoaderMetrics = calcOrderLoaderMetrics(order, trip.started_at, trip.asset);
            return (
              <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-5 py-3 text-sm font-semibold text-slate-900">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900">
                      {order.counterparty?.name ?? '—'}
                    </span>
                    {isOrderPpr ? (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs shrink-0"
                        title="Погрузочно-разгрузочные работы (без авто)"
                      >
                        <span>👷</span>
                        <span>ППР (без авто)</span>
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-50 text-sky-800 border border-sky-200 shrink-0"
                        title="Рейс на автомобиле"
                      >
                        <span>🚚</span>
                        <span>На машине</span>
                      </span>
                    )}
                  </div>
                  {(() => {
                    const rawDesc = String(order.description || '').trim();
                    const cleanDesc = rawDesc
                      .replace(/^Маршрут:.*?\|\s*/i, '')
                      .replace(/^\[.*?➔.*?\]\s*/, '')
                      .trim();
                    if (!cleanDesc) return null;
                    return (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600 max-w-sm">
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 px-2 py-0.5 rounded border border-slate-200 transition-colors truncate"
                          title={cleanDesc}
                        >
                          <span className="text-slate-400">📦</span>
                          <span className="truncate">{cleanDesc}</span>
                        </span>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-5 py-3 text-sm font-bold text-slate-800">
                  <Money amount={order.amount} />
                  {isOrderPpr && orderLoaderMetrics.profit > 0 && (
                    <span
                      className="block text-[10px] font-black text-emerald-600 leading-tight mt-0.5"
                      title="Прибыль компании с услуг ППР (маржа 30%)"
                    >
                      +{Math.round(orderLoaderMetrics.profit).toLocaleString('ru-RU')} ₽ маржа
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-sm text-right font-bold">
                  <span className="text-emerald-600">
                    <Money amount={order.driver_pay} />
                  </span>
                  {isOrderPpr ? (
                    <span
                      className="block text-[10px] font-bold text-amber-700 leading-tight"
                      title="Водитель грузил сам в качестве грузчика (без управления ТС)"
                    >
                      👷 за погрузку
                    </span>
                  ) : order.is_driver_loader &&
                    parseFloat(String(order.driver_loader_pay || '0')) > 0 ? (
                    <span
                      className="block text-[9px] text-slate-400 font-medium leading-tight"
                      title={`Руль: ${Math.round(parseFloat(String(order.driver_car_pay || '0')))} ₽, Погрузка: ${Math.round(parseFloat(String(order.driver_loader_pay || '0')))} ₽`}
                    >
                      руль {Math.round(parseFloat(String(order.driver_car_pay || '0')))} + груз.{' '}
                      {Math.round(parseFloat(String(order.driver_loader_pay || '0')))}
                    </span>
                  ) : null}
                </td>
                <td className="px-5 py-3 text-center">
                  {isOrderPpr ? (
                    <span
                      className="text-[10px] font-black text-amber-900 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded shadow-2xs whitespace-nowrap"
                      title="Распределение ППР: 70% бригаде грузчиков / 30% компании"
                    >
                      30% фирма
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      {split}%
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-sm text-right font-medium text-slate-600">
                  {parseFloat(order.loader_pay) > 0 ||
                  parseFloat(order.loader2_pay ?? '0') > 0 ||
                  (order.is_driver_loader &&
                    parseFloat(String(order.driver_loader_pay || '0')) > 0) ? (
                    <div className="space-y-0.5">
                      {order.loader && parseFloat(order.loader_pay) > 0 && (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-[10px] text-slate-400 font-medium">
                            {order.loader.name.split(' ')[0]}
                          </span>
                          <Money amount={order.loader_pay} />
                        </div>
                      )}
                      {order.loader2 && parseFloat(order.loader2_pay ?? '0') > 0 && (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-[10px] text-slate-400 font-medium">
                            {order.loader2.name.split(' ')[0]}
                          </span>
                          <Money amount={order.loader2_pay} />
                        </div>
                      )}
                      {order.is_driver_loader &&
                        !isOrderPpr &&
                        parseFloat(String(order.driver_loader_pay || '0')) > 0 && (
                          <div className="flex items-center justify-end gap-1.5 text-amber-600">
                            <span className="text-[10px] opacity-75 font-medium">вод.-груз.</span>
                            <Money amount={String(order.driver_loader_pay)} />
                          </div>
                        )}
                      {!isOrderPpr && orderLoaderMetrics.profit > 0 && (
                        <div
                          className="text-[9px] font-bold text-emerald-600 text-right leading-none"
                          title="Прибыль компании с услуг погрузки (маржа 30%)"
                        >
                          +{Math.round(orderLoaderMetrics.profit).toLocaleString('ru-RU')} ₽ маржа
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[10px] font-bold border',
                      PAYMENT_STYLES[order.payment_method] || 'bg-slate-100 border-slate-200',
                    )}
                  >
                    {PAYMENT_LABELS[order.payment_method] || order.payment_method}
                  </span>
                </td>
              </tr>
            );
          })}
          {expenses.map((exp) => (
            <tr key={exp.id} className="bg-rose-50/40 hover:bg-rose-50/70 transition-colors">
              <td className="px-5 py-2.5 text-rose-700 font-semibold text-sm">
                ↳ {exp.category?.name ?? 'Расход'}
                {exp.description ? (
                  <span className="text-rose-400 font-normal"> · {exp.description}</span>
                ) : null}
              </td>
              <td className="px-5 py-2.5 text-sm font-bold text-rose-600">
                −<Money amount={exp.amount} />
              </td>
              <td className="px-5 py-2.5 text-slate-300 text-right text-sm">—</td>
              <td className="px-5 py-2.5 text-slate-300 text-center text-sm">—</td>
              <td className="px-5 py-2.5 text-slate-300 text-right text-sm">—</td>
              <td className="px-5 py-2.5">
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold border bg-rose-50 text-rose-600 border-rose-200">
                  {PAYMENT_LABELS[exp.payment_method] ?? exp.payment_method}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
