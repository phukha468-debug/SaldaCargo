'use client';

import { useState } from 'react';
import { cn } from '@saldacargo/ui';
import { PRIORITY_COLOR, PRIORITY_LABEL, STATUS_COLOR, STATUS_LABEL } from '../../constants';
import type { OrderDetail } from '../../types';

export function OrderDetailMetaSection({
  order,
  patchPending,
  onPatch,
}: {
  order: OrderDetail;
  patchPending: boolean;
  onPatch: (body: Record<string, unknown>) => void;
}) {
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [editPriority, setEditPriority] = useState<string | null>(null);
  const [editOdometerStart, setEditOdometerStart] = useState<string | null>(null);
  const [editOdometerEnd, setEditOdometerEnd] = useState<string | null>(null);
  const [editStartedAt, setEditStartedAt] = useState<string | null>(null);
  const [editCompletedAt, setEditCompletedAt] = useState<string | null>(null);

  const startedAtDefault = order.started_at
    ? order.started_at.slice(0, 10)
    : order.created_at
      ? order.created_at.slice(0, 10)
      : '';
  const completedAtDefault = order.completed_at ? order.completed_at.slice(0, 10) : '';
  const odoStartDefault = order.odometer_start != null ? String(order.odometer_start) : '';
  const odoEndDefault = order.odometer_end != null ? String(order.odometer_end) : '';

  return (
    <>
      <div className="flex flex-wrap gap-2 items-center">
        <span
          className={cn('text-xs font-semibold px-3 py-1 rounded-full', STATUS_COLOR[order.status])}
        >
          {STATUS_LABEL[order.status] ?? order.status}
        </span>
        <span
          className={cn(
            'text-xs font-semibold px-3 py-1 rounded-full',
            PRIORITY_COLOR[order.priority],
          )}
        >
          {PRIORITY_LABEL[order.priority] ?? order.priority}
        </span>
        <span className="text-sm font-bold text-slate-700">
          {order.machine_type === 'own'
            ? `${order.asset?.short_name} · ${order.asset?.reg_number}`
            : `${order.client_vehicle_brand ?? ''} ${order.client_vehicle_model ?? ''} · ${order.client_vehicle_reg ?? ''}`}
        </span>
      </div>

      {order.machine_type === 'client' && (order.client_name || order.client_phone) && (
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">Клиент</p>
          {order.client_name && (
            <p className="text-sm font-medium text-slate-800">{order.client_name}</p>
          )}
          {order.client_phone && <p className="text-sm text-slate-500">{order.client_phone}</p>}
        </div>
      )}

      <div>
        <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">Описание</p>
        <p className="text-sm text-slate-800">{order.problem_description}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">Статус</p>
          <select
            value={editStatus ?? order.status}
            onChange={(e) => setEditStatus(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          >
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          {editStatus && editStatus !== order.status && (
            <button
              onClick={() => {
                onPatch({ status: editStatus });
                setEditStatus(null);
              }}
              disabled={patchPending}
              className="mt-1 text-xs text-blue-600 font-semibold hover:underline"
            >
              Сохранить
            </button>
          )}
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">Приоритет</p>
          <select
            value={editPriority ?? order.priority}
            onChange={(e) => setEditPriority(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          >
            {Object.entries(PRIORITY_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          {editPriority && editPriority !== order.priority && (
            <button
              onClick={() => {
                onPatch({ priority: editPriority });
                setEditPriority(null);
              }}
              disabled={patchPending}
              className="mt-1 text-xs text-blue-600 font-semibold hover:underline"
            >
              Сохранить
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">Одометр заезда (км)</p>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={editOdometerStart ?? odoStartDefault}
              onChange={(e) => setEditOdometerStart(e.target.value)}
              placeholder="Заезд км..."
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
            />
            {editOdometerStart !== null && editOdometerStart !== odoStartDefault && (
              <button
                onClick={() => {
                  onPatch({
                    odometer_start: editOdometerStart ? Number(editOdometerStart) : null,
                  });
                  setEditOdometerStart(null);
                }}
                disabled={patchPending}
                className="text-xs bg-blue-600 text-white font-semibold px-2 py-1.5 rounded-lg shrink-0 hover:bg-blue-700"
              >
                ✓
              </button>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">Одометр выезда (км)</p>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={editOdometerEnd ?? odoEndDefault}
              onChange={(e) => setEditOdometerEnd(e.target.value)}
              placeholder="Выезд км..."
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
            />
            {editOdometerEnd !== null && editOdometerEnd !== odoEndDefault && (
              <button
                onClick={() => {
                  onPatch({
                    odometer_end: editOdometerEnd ? Number(editOdometerEnd) : null,
                  });
                  setEditOdometerEnd(null);
                }}
                disabled={patchPending}
                className="text-xs bg-blue-600 text-white font-semibold px-2 py-1.5 rounded-lg shrink-0 hover:bg-blue-700"
              >
                ✓
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">Дата начала наряда</p>
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={editStartedAt ?? startedAtDefault}
              onChange={(e) => setEditStartedAt(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
            />
            {editStartedAt !== null && editStartedAt !== startedAtDefault && (
              <button
                onClick={() => {
                  onPatch({
                    started_at: editStartedAt ? `${editStartedAt}T08:00:00.000Z` : null,
                  });
                  setEditStartedAt(null);
                }}
                disabled={patchPending}
                className="text-xs bg-blue-600 text-white font-semibold px-2 py-1.5 rounded-lg shrink-0 hover:bg-blue-700"
                title="Сохранить дату начала"
              >
                ✓
              </button>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">
            Дата окончания наряда
          </p>
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={editCompletedAt ?? completedAtDefault}
              onChange={(e) => setEditCompletedAt(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
            />
            {editCompletedAt !== null && editCompletedAt !== completedAtDefault && (
              <button
                onClick={() => {
                  onPatch({
                    completed_at: editCompletedAt ? `${editCompletedAt}T17:00:00.000Z` : null,
                  });
                  setEditCompletedAt(null);
                }}
                disabled={patchPending}
                className="text-xs bg-blue-600 text-white font-semibold px-2 py-1.5 rounded-lg shrink-0 hover:bg-blue-700"
                title="Сохранить дату окончания"
              >
                ✓
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
