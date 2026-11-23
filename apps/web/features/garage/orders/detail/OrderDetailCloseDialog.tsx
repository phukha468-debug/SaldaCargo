'use client';

import { useState } from 'react';
import { isOilOrFilterWork } from '@saldacargo/shared';
import { cn } from '@saldacargo/ui';
import type { Mechanic, MechanicWithPct, OrderDetail } from '../../types';
import { computeMechanicDefaultPays } from '../../utils';

export function OrderDetailCloseDialog({
  order,
  mechanics,
  isPending,
  onConfirm,
  onClose,
}: {
  order: OrderDetail;
  mechanics: Mechanic[];
  isPending: boolean;
  onConfirm: (updates: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [closePays, setClosePays] = useState<Record<string, string>>(() =>
    computeMechanicDefaultPays(order.works, mechanics),
  );
  const [closeRecommendation, setCloseRecommendation] = useState(order.mechanic_note || '');
  const [closeDueKm, setCloseDueKm] = useState('');
  const [closeDueDate, setCloseDueDate] = useState('');
  const [closeCompletedAt, setCloseCompletedAt] = useState(() =>
    order.completed_at ? order.completed_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
  );
  const [closeOdometerStart, setCloseOdometerStart] = useState(
    order.odometer_start != null ? String(order.odometer_start) : '',
  );
  const [closeOdometerEnd, setCloseOdometerEnd] = useState(
    order.odometer_end != null
      ? String(order.odometer_end)
      : order.odometer_start != null
        ? String(order.odometer_start)
        : '',
  );

  const worksTotal = order.works
    .filter((w) => w.status !== 'cancelled')
    .reduce((s, w) => s + parseFloat(w.price_client ?? '0'), 0);
  const partsTotal = order.parts.reduce(
    (s, p) => s + parseFloat(p.client_price ?? '0') * (p.quantity ?? 1),
    0,
  );
  const orderTotal = worksTotal + partsTotal;
  const totalActMin = order.works
    .filter((w) => w.status === 'completed')
    .reduce((s, w) => s + (w.actual_minutes > 0 ? w.actual_minutes : w.norm_minutes), 0);

  let totalPay = 0;
  order.works.forEach((w) => {
    if (w.status === 'cancelled') return;
    const mechs = [w.mechanic_id, w.second_mechanic_id].filter(Boolean);
    if (mechs.length === 0) return;
    const workPrice = parseFloat(w.price_client ?? '0');
    if (workPrice <= 0) return;
    const basePrice = mechs.length === 2 ? workPrice / 2 : workPrice;
    for (const mechId of mechs) {
      const mech = mechanics.find((m) => m.id === mechId);
      if (mech) {
        const pct = parseFloat((mech as MechanicWithPct).mechanic_salary_pct ?? '50');
        totalPay += (basePrice * pct) / 100;
      }
    }
  });
  const margin = orderTotal - totalPay;
  const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');

  const hasOilWork = (order.works || []).some(
    (w) =>
      isOilOrFilterWork(w.work_catalog?.name) ||
      isOilOrFilterWork(w.custom_work_name) ||
      isOilOrFilterWork(w.work_description),
  );
  const hasOdo = Boolean(
    (closeOdometerEnd && Number(closeOdometerEnd) > 0) ||
    (closeOdometerStart && Number(closeOdometerStart) > 0),
  );

  return (
    <div
      className="absolute inset-0 z-10 bg-white rounded-2xl flex flex-col"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Шапка */}
      <div className="flex-shrink-0 border-b border-slate-200 px-6 py-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Завершить наряд #{order.order_number}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {order.machine_type === 'own'
              ? `${order.asset?.short_name ?? ''} · ${order.asset?.reg_number ?? ''}`
              : `${order.client_vehicle_brand ?? ''} ${order.client_vehicle_model ?? ''} · ${order.client_vehicle_reg ?? ''}`}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 text-2xl leading-none ml-4"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {/* Итог по наряду */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Выручка</p>
            <p className="text-lg font-black text-slate-900">{fmt(orderTotal)} ₽</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Факт. часов</p>
            <p className="text-lg font-black text-slate-900">{(totalActMin / 60).toFixed(1)} ч</p>
          </div>
          <div
            className={cn(
              'rounded-xl p-3 text-center',
              margin >= 0 ? 'bg-emerald-50' : 'bg-red-50',
            )}
          >
            <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Маржа</p>
            <p
              className={cn(
                'text-lg font-black',
                margin >= 0 ? 'text-emerald-700' : 'text-red-600',
              )}
            >
              {fmt(margin)} ₽
            </p>
          </div>
        </div>

        {/* Список работ */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Работы
          </div>
          {order.works
            .filter((w) => w.status !== 'cancelled')
            .map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between px-3 py-2 border-t border-slate-100 text-sm"
              >
                <span className="text-slate-700 truncate mr-2">
                  {w.work_catalog?.name ?? w.custom_work_name ?? '—'}
                </span>
                <span className="font-semibold text-slate-900 shrink-0">
                  {parseFloat(w.price_client ?? '0').toLocaleString('ru-RU')} ₽
                </span>
              </div>
            ))}
        </div>

        {/* Запчасти */}
        {order.parts.length > 0 && (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
              <span>Запчасти</span>
              {partsTotal > 0 && (
                <span className="text-slate-600 normal-case font-semibold">
                  {partsTotal.toLocaleString('ru-RU')} ₽
                </span>
              )}
            </div>
            {order.parts.map((p) => {
              const pPrice = parseFloat(p.client_price ?? '0');
              const pName = p.part?.name ?? p.custom_part_name ?? '—';
              const pUnit = p.part?.unit ?? p.unit ?? 'шт';
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-3 py-2 border-t border-slate-100 text-sm"
                >
                  <span className="text-slate-700 truncate mr-2">
                    {pName}
                    <span className="text-slate-400 text-xs ml-1">
                      × {p.quantity} {pUnit}
                    </span>
                  </span>
                  {pPrice > 0 ? (
                    <span className="font-semibold text-slate-900 shrink-0">
                      {(pPrice * (p.quantity ?? 1)).toLocaleString('ru-RU')} ₽
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 italic shrink-0">Клиент</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ЗП механиков */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Зарплата исполнителей
            </p>
            {Object.keys(closePays).length > 0 && (
              <span className="text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-md border border-emerald-200">
                Всего ЗП:{' '}
                {Object.values(closePays)
                  .reduce((sum, val) => sum + (parseFloat(val) || 0), 0)
                  .toLocaleString('ru-RU')}{' '}
                ₽
              </span>
            )}
          </div>
          {Object.keys(closePays).length === 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-800 text-sm">
              Нет неоплаченных работ для начисления зарплаты.
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(closePays).map(([mechId, amount]) => {
                const mech = mechanics.find((m) => m.id === mechId);
                let mechWorksCount = 0;
                let calcSalary = 0;
                order.works.forEach((w) => {
                  if (w.status === 'cancelled' || w.salary_paid) return;
                  const mechs = [w.mechanic_id, w.second_mechanic_id].filter(
                    (x): x is string => !!x,
                  );
                  if (!mechs.includes(mechId)) return;
                  mechWorksCount += 1;
                  const workPrice = parseFloat(w.price_client ?? '0');
                  if (workPrice <= 0) return;
                  const basePrice = mechs.length === 2 ? workPrice / 2 : workPrice;
                  const pct = parseFloat((mech as MechanicWithPct)?.mechanic_salary_pct ?? '50');
                  calcSalary += (basePrice * pct) / 100;
                });

                return (
                  <div
                    key={mechId}
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-bold text-slate-800 block truncate">
                          {mech?.name ?? 'Исполнитель'}
                        </span>
                        <span className="text-xs text-slate-500 font-normal">
                          {mechWorksCount}{' '}
                          {mechWorksCount === 1
                            ? 'операция'
                            : mechWorksCount < 5
                              ? 'операции'
                              : 'операций'}{' '}
                          (расчёт: {Math.round(calcSalary).toLocaleString('ru-RU')} ₽)
                        </span>
                      </div>
                      <div className="relative shrink-0">
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) =>
                            setClosePays((prev) => ({
                              ...prev,
                              [mechId]: e.target.value,
                            }))
                          }
                          className="w-32 border border-slate-300 rounded-lg px-3 py-1.5 text-right font-bold text-slate-900 focus:ring-2 focus:ring-emerald-400 outline-none pr-8 bg-white"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">
                          ₽
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Рекомендации механика / мастера */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
            Рекомендации механика / мастера по машине
          </label>
          <textarea
            value={closeRecommendation}
            onChange={(e) => setCloseRecommendation(e.target.value)}
            placeholder="Укажите рекомендации по авто (например: через 5 000 км замена масла и фильтров...)"
            rows={2}
            className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-400 outline-none resize-none bg-slate-50 focus:bg-white transition-colors"
          />

          {/* Быстрый расчёт напоминания об обслуживании */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Напомнить клиенту об обслуживании (прозвон):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: '+5 000 км (~1.5 мес)', km: 5000, days: 50 },
                { label: '+10 000 км (~3.3 мес)', km: 10000, days: 100 },
                { label: '+15 000 км (~5 мес)', km: 15000, days: 150 },
              ].map((preset) => (
                <button
                  key={preset.km}
                  type="button"
                  onClick={() => {
                    const baseKm = order.odometer_end || order.odometer_start || 0;
                    if (baseKm > 0) setCloseDueKm(String(baseKm + preset.km));
                    const d = new Date();
                    d.setDate(d.getDate() + preset.days);
                    setCloseDueDate(d.toISOString().slice(0, 10));
                  }}
                  className="bg-white border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-lg transition-all"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                  Целевой пробег (км)
                </label>
                <input
                  type="number"
                  value={closeDueKm}
                  onChange={(e) => setCloseDueKm(e.target.value)}
                  placeholder="например: 256549"
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-white outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                  Дата напоминания (звонка)
                </label>
                <input
                  type="date"
                  value={closeDueDate}
                  onChange={(e) => setCloseDueDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-white outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>
            </div>
          </div>

          {/* Пробег заезда и выезда */}
          <div
            className={`border rounded-xl p-3 space-y-2 ${
              hasOilWork ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                Пробег при заезде и выезде из сервиса:
              </p>
              {hasOilWork && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-200 text-amber-900 uppercase tracking-wide">
                  🛢️ Замена масла/фильтра (одометр обязателен)
                </span>
              )}
            </div>
            {hasOilWork && !hasOdo && (
              <p className="text-xs text-rose-600 font-bold">
                ⚠️ В наряде есть замена масла/фильтров! Без указания одометра закрыть наряд нельзя.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                  Дата окончания наряда
                </label>
                <input
                  type="date"
                  value={closeCompletedAt}
                  onChange={(e) => setCloseCompletedAt(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-white outline-none focus:ring-1 focus:ring-emerald-400 font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                  Пробег выезда / после тестов (км)
                </label>
                <input
                  type="number"
                  value={closeOdometerEnd}
                  onChange={(e) => setCloseOdometerEnd(e.target.value)}
                  placeholder="Одометр на выходе..."
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-white outline-none focus:ring-1 focus:ring-emerald-400 font-mono font-bold"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                Пробег заезда (км)
              </label>
              <input
                type="number"
                value={closeOdometerStart}
                onChange={(e) => setCloseOdometerStart(e.target.value)}
                placeholder="Одометр на входе..."
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-white outline-none focus:ring-1 focus:ring-emerald-400 font-mono"
              />
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-400 font-semibold">
                Быстро прибавить тест-драйв:
              </span>
              {[
                { label: '+0 км (без тестов)', add: 0 },
                { label: '+5 км (тест-драйв)', add: 5 },
                { label: '+10 км', add: 10 },
              ].map((preset) => (
                <button
                  key={preset.add}
                  type="button"
                  onClick={() => {
                    const base = Number(closeOdometerStart || 0);
                    if (base > 0) setCloseOdometerEnd(String(base + preset.add));
                  }}
                  className="bg-white border border-slate-200 hover:border-emerald-500 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded transition-all"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Кнопки */}
      <div className="flex-shrink-0 border-t border-slate-100 px-6 py-4 flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold py-2.5 rounded-xl text-sm"
        >
          Отмена
        </button>
        <button
          onClick={() => {
            if (hasOilWork && !hasOdo) {
              alert('При замене масла или фильтров ввод одометра обязателен!');
              return;
            }
            const updates: Record<string, unknown> = {
              status: 'completed',
              lifecycle_status: 'approved',
              mechanic_pays: closePays,
              mechanic_note: closeRecommendation.trim() || null,
              due_km: closeDueKm ? Number(closeDueKm) : null,
              due_date: closeDueDate || null,
              completed_at: closeCompletedAt
                ? `${closeCompletedAt}T17:00:00.000Z`
                : new Date().toISOString(),
            };
            if (closeOdometerStart) updates.odometer_start = Number(closeOdometerStart);
            if (closeOdometerEnd) updates.odometer_end = Number(closeOdometerEnd);
            onConfirm(updates);
          }}
          disabled={isPending || (hasOilWork && !hasOdo)}
          className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50"
        >
          {isPending ? 'Сохраняем...' : 'Подтвердить и закрыть наряд'}
        </button>
      </div>
    </div>
  );
}
