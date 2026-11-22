'use client';

import Link from 'next/link';
import { cn } from '@saldacargo/ui';
import type { ReviewServiceOrder } from './types';
import { calcServiceOrder } from './utils';

export function MaintenanceDetailModal({
  group,
  onClose,
}: {
  group: {
    assetName: string;
    regNumber: string;
    assetKey: string;
    maintenanceParts: number;
    maintenanceSalary: number;
    maintenanceTotal: number;
    serviceOrders: ReviewServiceOrder[];
  };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-600 text-2xl">car_repair</span>
              <h3 className="text-lg font-black text-slate-900">
                Заказ-наряды на ремонт: {group.assetKey}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap font-medium">
              <span>
                Всего расходов за период:{' '}
                <span className="font-black text-rose-600 text-sm">
                  −{group.maintenanceTotal.toLocaleString('ru-RU')} ₽
                </span>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                Запчасти и материалы:{' '}
                <strong className="text-slate-700">
                  {group.maintenanceParts.toLocaleString('ru-RU')} ₽
                </strong>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                Работы (свои + сторонние):{' '}
                <strong className="text-slate-700">
                  {(group.maintenanceTotal - group.maintenanceParts).toLocaleString('ru-RU')} ₽
                </strong>
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/garage"
              target="_blank"
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              Раздел Гараж
            </Link>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {group.serviceOrders.map((so) => {
            const cso = calcServiceOrder(so);
            const cleanDesc = (so.problem_description || so.admin_note || '')
              .replace(/\[Сторонний сервис[^\]]*\]\s*/gi, '')
              .trim();
            return (
              <div
                key={so.id}
                className={cn(
                  'bg-white rounded-2xl border p-5 shadow-xs space-y-4 transition-colors',
                  cso.isExternal
                    ? 'border-purple-200 hover:border-purple-400'
                    : 'border-slate-200 hover:border-rose-300',
                )}
              >
                {/* Order Header */}
                <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        'font-mono font-black text-white px-2.5 py-1 rounded-lg text-sm tracking-wide shadow-xs',
                        cso.isExternal ? 'bg-purple-600' : 'bg-rose-600',
                      )}
                    >
                      НЗ-{so.order_number}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-800">
                          {new Date(so.created_at).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                        {cso.isExternal && (
                          <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded flex items-center gap-1">
                            <span>🏢</span>
                            <span>
                              {cso.contractorName
                                ? `Сторонний сервис: ${cso.contractorName}`
                                : 'Сторонний сервис'}
                            </span>
                          </span>
                        )}
                        {cso.isEquipment && (
                          <span className="bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded flex items-center gap-1">
                            <span>⚙️</span>
                            <span>Доп. оборудование</span>
                          </span>
                        )}
                      </div>
                      {cleanDesc && (
                        <p className="text-xs text-slate-700 font-medium mt-1">{cleanDesc}</p>
                      )}
                      {!cso.isExternal && so.mechanic?.name && (
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          Слесарь:{' '}
                          <span className="text-slate-700 font-semibold">{so.mechanic.name}</span>
                          {so.second_mechanic?.name && (
                            <span className="ml-1 text-slate-500">
                              + 2-й слесарь: {so.second_mechanic.name}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Расход по наряду
                    </span>
                    <span className="font-black text-rose-600 text-base">
                      −{cso.totalCost.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                </div>

                {/* Works list */}
                {so.works && so.works.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-amber-500">
                          build
                        </span>
                        {cso.isExternal
                          ? 'Работы стороннего сервиса'
                          : 'Выполненные работы (ЗП слесаря)'}
                      </span>
                      <span className="text-xs font-bold text-amber-700">
                        Итого работы:{' '}
                        {cso.isExternal
                          ? cso.worksCost.toLocaleString('ru-RU')
                          : cso.salaryCost.toLocaleString('ru-RU')}{' '}
                        ₽
                      </span>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 divide-y divide-slate-100 text-xs">
                      {so.works.map((w) => {
                        const customPctMatch = w.notes
                          ? String(w.notes).match(/\[salary_pct:(\d+(?:\.\d+)?)\]/)
                          : null;
                        const pct =
                          customPctMatch && customPctMatch[1]
                            ? parseFloat(customPctMatch[1]) / 100
                            : 0.5;
                        const wage = cso.isExternal
                          ? Number(w.price_client) || 0
                          : w.status !== 'cancelled'
                            ? (Number(w.price_client) || 0) * pct
                            : 0;
                        return (
                          <div
                            key={w.id}
                            className="py-1.5 first:pt-0 last:pb-0 flex justify-between items-center text-slate-700"
                          >
                            <span className="font-medium">
                              🔧 {w.work_catalog?.name ?? w.custom_work_name ?? 'Работа'}
                            </span>
                            <div className="text-right font-bold text-amber-700">
                              {wage.toLocaleString('ru-RU')} ₽
                              {!cso.isExternal && w.price_client && (
                                <span className="text-[10px] text-slate-400 font-normal ml-1">
                                  (тариф {Number(w.price_client || 0).toLocaleString('ru-RU')} ₽)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Parts list */}
                {so.parts && so.parts.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-rose-500">
                          inventory_2
                        </span>
                        Установленные запчасти
                      </span>
                      <span className="text-xs font-bold text-rose-700">
                        Итого запчасти: {cso.partsCost.toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                    <div className="bg-rose-50/40 rounded-xl p-3 border border-rose-100 divide-y divide-rose-100/60 text-xs">
                      {so.parts.map((p) => {
                        const cost = (Number(p.unit_price) || 0) * (Number(p.quantity) || 1);
                        return (
                          <div
                            key={p.id}
                            className="py-1.5 first:pt-0 last:pb-0 flex justify-between items-center text-slate-700"
                          >
                            <span className="font-medium">
                              📦 {p.part?.name ?? p.custom_part_name ?? 'Деталь'}{' '}
                              <span className="text-slate-400">
                                ({p.quantity} {p.unit ?? 'шт'} ×{' '}
                                {Number(p.unit_price || 0).toLocaleString('ru-RU')} ₽)
                              </span>
                            </span>
                            <span className="font-bold text-rose-700">
                              {cost.toLocaleString('ru-RU')} ₽
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Всего {group.serviceOrders.length} заказ-наряд
            {group.serviceOrders.length === 1 ? '' : group.serviceOrders.length < 5 ? 'а' : 'ов'}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
