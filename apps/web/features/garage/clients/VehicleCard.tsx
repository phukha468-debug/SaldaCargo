'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { cn } from '@saldacargo/ui';
import type { VehicleDetail } from '../types';
import { ruleAlert } from '../utils';
import { VehicleCardTabs } from './VehicleCardTabs';

export function VehicleCard({ detail, onUpdate }: { detail: VehicleDetail; onUpdate: () => void }) {
  const { vehicle, orders, rules, recommendations } = detail;
  const [tab, setTab] = useState<'history' | 'rules' | 'recs'>('history');
  const [editOdo, setEditOdo] = useState('');
  const [showAddRule, setShowAddRule] = useState(false);
  const [showAddRec, setShowAddRec] = useState('');
  const [editNotes, setEditNotes] = useState<string | null>(null);

  const patchVehicle = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch(`/api/garage/client-vehicles/${vehicle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: onUpdate,
  });

  const addRec = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch(`/api/garage/client-vehicles/${vehicle.id}/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      setShowAddRec('');
      onUpdate();
    },
  });

  const patchRec = useMutation({
    mutationFn: ({ recId, body }: { recId: string; body: Record<string, unknown> }) =>
      fetch(`/api/garage/client-vehicles/${vehicle.id}/recommendations?rec_id=${recId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: onUpdate,
  });

  const addRule = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch(`/api/garage/client-vehicles/${vehicle.id}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      setShowAddRule(false);
      onUpdate();
    },
  });

  const patchRule = useMutation({
    mutationFn: ({ ruleId, body }: { ruleId: string; body: Record<string, unknown> }) =>
      fetch(`/api/garage/client-vehicles/${vehicle.id}/rules?rule_id=${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: onUpdate,
  });

  const totalSpent = orders.reduce((s, o) => s + parseFloat(o.total_cost), 0);
  const openRecs = recommendations.filter((r) => !r.is_done);
  const alertRules = rules.filter((r) => {
    const st = ruleAlert(r, vehicle.odometer_last);
    return st === 'overdue' || st === 'soon';
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Шапка машины */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              {vehicle.brand} {vehicle.model ?? ''} {vehicle.year ? `· ${vehicle.year}` : ''}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="font-mono text-sm font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                {vehicle.reg_number}
              </span>
              {vehicle.vin && <span className="text-xs text-slate-400">VIN: {vehicle.vin}</span>}
              {vehicle.color && <span className="text-xs text-slate-400">{vehicle.color}</span>}
            </div>
            {vehicle.counterparty && (
              <div className="mt-2 text-sm text-slate-600">
                Клиент: <span className="font-semibold">{vehicle.counterparty.name}</span>
                {vehicle.counterparty.phone && (
                  <span className="text-slate-400 ml-2">{vehicle.counterparty.phone}</span>
                )}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-slate-400 uppercase font-semibold">Потрачено всего</div>
            <div className="text-2xl font-black text-slate-900">
              {totalSpent.toLocaleString('ru-RU')} ₽
            </div>
            <div className="text-xs text-slate-400">{orders.length} визитов</div>
          </div>
        </div>

        {/* Одометр */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-3">
          <div className="flex-1">
            <span className="text-xs text-slate-400 uppercase font-semibold">Одометр</span>
            <div className="text-base font-bold text-slate-900">
              {vehicle.odometer_last
                ? `${vehicle.odometer_last.toLocaleString('ru-RU')} км`
                : 'не указан'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={editOdo}
              onChange={(e) => setEditOdo(e.target.value)}
              placeholder="Обновить..."
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-36"
            />
            <button
              onClick={() => {
                if (!editOdo) return;
                patchVehicle.mutate({ odometer_last: editOdo });
                setEditOdo('');
              }}
              disabled={!editOdo || patchVehicle.isPending}
              className="text-xs px-3 py-1.5 bg-slate-900 text-white rounded-lg font-semibold disabled:opacity-40"
            >
              Сохранить
            </button>
          </div>
        </div>

        {/* Предупреждения */}
        {(alertRules.length > 0 || openRecs.length > 0) && (
          <div className="mt-4 space-y-2">
            {alertRules.map((rule) => {
              const st = ruleAlert(rule, vehicle.odometer_last);
              return (
                <div
                  key={rule.id}
                  className={cn(
                    'flex items-start gap-2 text-sm px-3 py-2 rounded-lg',
                    st === 'overdue' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700',
                  )}
                >
                  <span className="font-bold shrink-0">{st === 'overdue' ? '⚠' : '!'}</span>
                  <span>
                    <span className="font-semibold">{rule.work_name}</span>
                    {st === 'overdue' ? ' — просрочено' : ' — скоро'}
                    {rule.interval_km && rule.last_done_km && vehicle.odometer_last && (
                      <span className="ml-1 text-xs opacity-70">
                        (осталось{' '}
                        {(
                          rule.last_done_km +
                          rule.interval_km -
                          vehicle.odometer_last
                        ).toLocaleString('ru-RU')}{' '}
                        км)
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
            {openRecs.length > 0 && (
              <div className="bg-blue-50 text-blue-700 text-sm px-3 py-2 rounded-lg">
                <span className="font-semibold">{openRecs.length} открытых рекомендаций</span> от
                мастера
              </div>
            )}
          </div>
        )}

        {/* Заметки */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          {editNotes !== null ? (
            <div className="flex gap-2">
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"
                placeholder="Особенности, пожелания клиента..."
              />
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => {
                    patchVehicle.mutate({ notes: editNotes });
                    setEditNotes(null);
                  }}
                  className="text-xs px-3 py-1.5 bg-slate-900 text-white rounded-lg font-semibold"
                >
                  Сохранить
                </button>
                <button
                  onClick={() => setEditNotes(null)}
                  className="text-xs text-slate-500 hover:underline"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditNotes(vehicle.notes ?? '')}
              className="text-sm text-slate-400 hover:text-slate-700 text-left w-full"
            >
              {vehicle.notes ? vehicle.notes : '+ Добавить заметку по автомобилю...'}
            </button>
          )}
        </div>
      </div>

      {/* Вкладки */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
        {(
          [
            { id: 'history' as const, label: `История (${orders.length})` },
            { id: 'rules' as const, label: `Регламент (${rules.length})` },
            { id: 'recs' as const, label: `Рекомендации (${recommendations.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 text-sm font-semibold py-2 rounded-lg transition-colors',
              tab === t.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <VehicleCardTabs
        tab={tab}
        orders={orders}
        rules={rules}
        recommendations={recommendations}
        odometerLast={vehicle.odometer_last}
        showAddRule={showAddRule}
        setShowAddRule={setShowAddRule}
        showAddRec={showAddRec}
        setShowAddRec={setShowAddRec}
        addRulePending={addRule.isPending}
        addRecPending={addRec.isPending}
        onAddRule={(body) => addRule.mutate(body)}
        onPatchRule={(ruleId, body) => patchRule.mutate({ ruleId, body })}
        onAddRec={(body) => addRec.mutate(body)}
        onPatchRec={(recId, body) => patchRec.mutate({ recId, body })}
      />
    </div>
  );
}
