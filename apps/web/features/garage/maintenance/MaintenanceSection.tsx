'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@saldacargo/ui';
import { ALERT_COLOR, ALERT_LABEL } from '../constants';
import type { Asset, MaintenanceItem } from '../types';
import { fmtDate, todayStr } from '../utils';
import { CreateMaintenanceModal, type MaintenanceCreateForm } from './CreateMaintenanceModal';

export function MaintenanceSection() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MaintenanceItem>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<MaintenanceCreateForm>({
    asset_id: '',
    work_name: '',
    interval_km: '',
    interval_months: '6',
    last_done_km: '',
    last_done_at: todayStr(),
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['assets-select'],
    queryFn: () => fetch('/api/garage/assets').then((r) => r.json()),
    staleTime: 300000,
  });
  const { data: items = [], isLoading } = useQuery<MaintenanceItem[]>({
    queryKey: ['garage-maintenance'],
    queryFn: () =>
      fetch('/api/garage/maintenance')
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
  });
  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch('/api/garage/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garage-maintenance'] });
      qc.invalidateQueries({ queryKey: ['garage-dashboard'] });
      setShowCreate(false);
      setCreateForm({
        asset_id: '',
        work_name: '',
        interval_km: '',
        interval_months: '6',
        last_done_km: '',
        last_done_at: todayStr(),
      });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      fetch(`/api/garage/maintenance/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garage-maintenance'] });
      setEditingId(null);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/garage/maintenance/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['garage-maintenance'] }),
  });

  const startEdit = (item: MaintenanceItem) => {
    setEditingId(item.id);
    setEditForm(item);
  };
  const remainingKm = (item: MaintenanceItem) => {
    const current = item.asset?.odometer_current ?? 0;
    const due = item.next_due_km ?? 0;
    if (!due || !current) return null;
    return due - current;
  };

  const vehicleMap = new Map<
    string,
    { asset: MaintenanceItem['asset']; overdue: number; soon: number }
  >();
  items.forEach((item) => {
    if (!item.asset) return;
    const key = item.asset.id;
    if (!vehicleMap.has(key)) vehicleMap.set(key, { asset: item.asset, overdue: 0, soon: 0 });
    const v = vehicleMap.get(key)!;
    if (item.alert_status === 'overdue') v.overdue++;
    else if (item.alert_status === 'soon') v.soon++;
  });
  const vehicles = Array.from(vehicleMap.values());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Регламенты ТО</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Плановое техническое обслуживание и контроль сроков по дате и пробегу
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-slate-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Добавить регламент
        </button>
      </div>

      {vehicles.length > 0 && (
        <div className={cn('grid gap-3', vehicles.length <= 4 ? 'grid-cols-4' : 'grid-cols-3')}>
          {vehicles.map(
            ({ asset, overdue, soon }) =>
              asset && (
                <div key={asset.id} className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">{asset.short_name}</div>
                      <div className="text-xs text-slate-400">
                        {asset.odometer_current
                          ? `${asset.odometer_current.toLocaleString('ru-RU')} км`
                          : 'Одометр не указан'}
                      </div>
                    </div>
                    {overdue > 0 ? (
                      <div
                        className="w-2.5 h-2.5 bg-red-500 rounded-full mt-1"
                        style={{ animation: 'pulse 2s infinite' }}
                      />
                    ) : soon > 0 ? (
                      <div className="w-2.5 h-2.5 bg-amber-400 rounded-full mt-1" />
                    ) : (
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full mt-1" />
                    )}
                  </div>
                  {overdue > 0 ? (
                    <div className="text-xs text-red-500 font-medium">{overdue} просрочено</div>
                  ) : (
                    <div className="text-xs text-slate-400">0 просрочено</div>
                  )}
                  {soon > 0 ? (
                    <div className="text-xs text-amber-600">{soon} скоро</div>
                  ) : (
                    <div className="text-xs text-slate-400">0 скоро</div>
                  )}
                </div>
              ),
          )}
        </div>
      )}

      {showCreate && (
        <CreateMaintenanceModal
          assets={assets}
          createForm={createForm}
          setCreateForm={setCreateForm}
          isPending={createMutation.isPending}
          onClose={() => setShowCreate(false)}
          onSubmit={() =>
            createMutation.mutate({
              asset_id: createForm.asset_id,
              work_name: createForm.work_name,
              interval_km: createForm.interval_km ? Number(createForm.interval_km) : null,
              interval_months: createForm.interval_months
                ? Number(createForm.interval_months)
                : null,
              last_done_km: createForm.last_done_km ? Number(createForm.last_done_km) : null,
              last_done_at: createForm.last_done_at || null,
            })
          }
        />
      )}

      {isLoading ? (
        <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
          <p className="text-5xl mb-3">🔧</p>
          <p className="font-medium text-slate-500">Регламентов ТО нет</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Автомобиль
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Работа
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Интервал
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Последнее ТО
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Следующее ТО
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Остаток
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Статус
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const rem = remainingKm(item);
                const isEditing = editingId === item.id;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dueTime = item.next_due_at ? new Date(item.next_due_at).getTime() : null;
                const diffDays =
                  dueTime !== null
                    ? Math.ceil((dueTime - today.getTime()) / (1000 * 60 * 60 * 24))
                    : null;

                return (
                  <tr
                    key={item.id}
                    className={cn(
                      item.alert_status === 'overdue'
                        ? 'bg-red-50/70 hover:bg-red-50'
                        : item.alert_status === 'soon'
                          ? 'bg-amber-50/70 hover:bg-amber-50'
                          : 'hover:bg-slate-50/60',
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {item.asset?.short_name ?? '—'}
                      </div>
                      {item.asset?.reg_number && (
                        <div className="text-xs text-slate-400 font-mono">
                          {item.asset.reg_number}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-800">
                      {isEditing ? (
                        <input
                          value={editForm.work_name ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, work_name: e.target.value })}
                          className="border border-slate-200 rounded-lg px-2 py-1 text-sm w-full"
                        />
                      ) : (
                        <span className="font-medium">{item.work_name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              placeholder="мес."
                              value={editForm.interval_months ?? ''}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  interval_months: e.target.value ? Number(e.target.value) : null,
                                })
                              }
                              className="border border-slate-200 rounded px-1.5 py-0.5 text-xs w-16"
                              title="Интервал в месяцах"
                            />
                            <span className="text-[11px] text-slate-400">мес.</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              placeholder="км"
                              value={editForm.interval_km ?? ''}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  interval_km: e.target.value ? Number(e.target.value) : null,
                                })
                              }
                              className="border border-slate-200 rounded px-1.5 py-0.5 text-xs w-16"
                              title="Интервал в км"
                            />
                            <span className="text-[11px] text-slate-400">км</span>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {item.interval_months ? (
                            <div className="font-medium text-slate-800">
                              {item.interval_months} мес.
                            </div>
                          ) : null}
                          {item.interval_km ? (
                            <div className="text-xs text-slate-500 font-mono">
                              {item.interval_km.toLocaleString('ru-RU')} км
                            </div>
                          ) : null}
                          {!item.interval_months && !item.interval_km && (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="space-y-1">
                          <input
                            type="date"
                            value={editForm.last_done_at ? editForm.last_done_at.slice(0, 10) : ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, last_done_at: e.target.value })
                            }
                            className="border border-slate-200 rounded px-1.5 py-0.5 text-xs w-full"
                            title="Дата последней замены"
                          />
                          <input
                            type="number"
                            placeholder="км"
                            value={editForm.last_done_km ?? ''}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                last_done_km: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                            className="border border-slate-200 rounded px-1.5 py-0.5 text-xs w-full font-mono"
                            title="Пробег при последней замене"
                          />
                        </div>
                      ) : (
                        <div>
                          {item.last_done_at ? (
                            <div className="font-medium text-slate-800">
                              {fmtDate(item.last_done_at)}
                            </div>
                          ) : null}
                          {item.last_done_km ? (
                            <div className="text-xs text-slate-500 font-mono">
                              {item.last_done_km.toLocaleString('ru-RU')} км
                            </div>
                          ) : null}
                          {!item.last_done_at && !item.last_done_km && (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        {item.next_due_at ? (
                          <div className="font-medium text-slate-800">
                            {fmtDate(item.next_due_at)}
                          </div>
                        ) : null}
                        {item.next_due_km ? (
                          <div className="text-xs text-slate-500 font-mono">
                            {item.next_due_km.toLocaleString('ru-RU')} км
                          </div>
                        ) : null}
                        {!item.next_due_at && !item.next_due_km && (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        {diffDays !== null && (
                          <div
                            className={cn(
                              'font-semibold text-xs',
                              diffDays <= 0
                                ? 'text-red-600'
                                : diffDays <= 30
                                  ? 'text-amber-600'
                                  : 'text-slate-700',
                            )}
                          >
                            {diffDays < 0
                              ? `Просрочено на ${Math.abs(diffDays)} дн.`
                              : diffDays === 0
                                ? 'Срок сегодня!'
                                : `${diffDays} дн. осталось`}
                          </div>
                        )}
                        {rem !== null && (
                          <div
                            className={cn(
                              'text-xs font-mono',
                              rem < 0
                                ? 'text-red-500 font-medium'
                                : rem < 1500
                                  ? 'text-amber-600'
                                  : 'text-slate-400',
                            )}
                          >
                            {rem < 0
                              ? `Просрочено: ${Math.abs(rem).toLocaleString('ru-RU')} км`
                              : `${rem.toLocaleString('ru-RU')} км`}
                          </div>
                        )}
                        {diffDays === null && rem === null && (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'badge text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1',
                          ALERT_COLOR[item.alert_status] ?? 'bg-slate-100 text-slate-700',
                        )}
                      >
                        {item.alert_status === 'overdue' && '⚠️ '}
                        {item.alert_status === 'soon' && '⏳ '}
                        {item.alert_status === 'ok' && '✓ '}
                        {ALERT_LABEL[item.alert_status] ?? item.alert_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => updateMutation.mutate({ id: item.id, body: editForm })}
                            className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
                            title="Сохранить"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition"
                            title="Отмена"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => startEdit(item)}
                            className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
                            title="Редактировать регламент"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate(item.id)}
                            className="text-xs text-slate-400 hover:text-red-600 px-2 py-1 rounded-lg border border-slate-200 hover:bg-red-50 transition"
                            title="Удалить регламент"
                          >
                            🗑
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
