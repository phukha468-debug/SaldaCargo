'use client';

import React, { useState } from 'react';
import { parseTripRouteSheet, TripRouteLeg } from '@saldacargo/shared';
import { cn } from '../lib/utils';

export interface TripRouteSheetProps {
  driverNote?: string | null;
  className?: string;
  defaultExpanded?: boolean;
}

export function TripRouteSheet({
  driverNote,
  className,
  defaultExpanded = true,
}: TripRouteSheetProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!driverNote) return null;

  const parsed = parseTripRouteSheet(driverNote);
  const {
    isAutoDeparture,
    hasRouteSheet,
    legs,
    totalKm,
    startOdo,
    endOdo,
    routeSummary,
    cleanNote,
  } = parsed;

  // Если нет ни маршрутного листа, ни автовыезда, ни заметки — ничего не рендерим
  if (!isAutoDeparture && !hasRouteSheet && !cleanNote) return null;

  return (
    <div
      className={cn(
        'w-full rounded-lg border text-xs transition-all overflow-hidden',
        isAutoDeparture
          ? 'bg-amber-50/70 border-amber-200/90 text-amber-950'
          : 'bg-slate-50/80 border-slate-200 text-slate-800',
        className,
      )}
    >
      {/* 1-я строка (1-Row Priority по AGENTS.md): компактная плашка со спойлером справа */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 font-medium leading-none min-h-[30px]">
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
          {isAutoDeparture && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-900 font-bold text-[11px] shrink-0 border border-amber-500/25">
              ⚡ Автовыезд
            </span>
          )}

          {routeSummary ? (
            <span className="truncate text-slate-800 font-medium">{routeSummary}</span>
          ) : cleanNote ? (
            <span className="truncate text-slate-700">{cleanNote}</span>
          ) : null}

          {totalKm > 0 && (
            <span className="shrink-0 text-slate-500 font-normal">
              · <strong className="text-emerald-700 font-bold">{totalKm} км</strong>
            </span>
          )}
        </div>

        {hasRouteSheet && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded hover:bg-black/5 text-slate-700 transition-colors ml-2"
          >
            <span>{expanded ? '▴ Скрыть' : '▾ Маршрутный лист'}</span>
            <span className="text-[10px] text-slate-500 font-normal">({legs.length})</span>
          </button>
        )}
      </div>

      {/* Разворачиваемый спойлер: Вариант 3 (мини-таблица с колонками) */}
      {hasRouteSheet && expanded && (
        <div className="border-t border-amber-200/70 bg-white/90 p-2 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] text-slate-500 font-semibold bg-slate-50/70">
                <th className="py-1 px-2 text-center w-7">№</th>
                <th className="py-1 px-2.5">Рейс</th>
                <th className="py-1 px-2 text-center">Выезд</th>
                <th className="py-1 px-2 text-center">В пути</th>
                <th className="py-1 px-2 text-center">Прибытие</th>
                <th className="py-1 px-2 text-center">Дата</th>
                <th className="py-1 px-2 text-right">Км</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {legs.map((leg: TripRouteLeg) => (
                <tr key={leg.n} className="hover:bg-slate-50/70">
                  <td className="py-1 px-2 text-center text-slate-400 font-semibold">{leg.n}</td>
                  <td className="py-1 px-2.5 font-medium text-slate-900">{leg.route}</td>
                  <td className="py-1 px-2 text-center text-slate-600">{leg.dep}</td>
                  <td className="py-1 px-2 text-center text-slate-500">{leg.dur}</td>
                  <td className="py-1 px-2 text-center text-slate-600">{leg.arr}</td>
                  <td className="py-1 px-2 text-center font-bold text-slate-900">{leg.date}</td>
                  <td className="py-1 px-2 text-right font-semibold text-emerald-700">
                    {leg.km} км
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50/80 font-bold text-[11px] text-slate-800">
                <td colSpan={6} className="py-1 px-2.5 text-right text-slate-600">
                  {startOdo && endOdo ? (
                    <span>
                      Одометр: {startOdo.toLocaleString('ru-RU')} ➔ {endOdo.toLocaleString('ru-RU')}{' '}
                      (пробег {totalKm} км)
                    </span>
                  ) : (
                    <span>Итоговый пробег:</span>
                  )}
                </td>
                <td className="py-1 px-2 text-right text-emerald-800 font-extrabold">
                  {totalKm} км
                </td>
              </tr>
            </tfoot>
          </table>

          {cleanNote && cleanNote !== routeSummary && (
            <p className="mt-2 text-[11px] text-slate-500 border-t pt-1.5">
              <span className="font-semibold text-slate-700">Примечание:</span> {cleanNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
