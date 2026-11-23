'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { cn } from '@saldacargo/ui';
import type { StoClientDetail, VehicleDetail } from '../types';
import { VehicleCard } from './VehicleCard';

export function StoClientDetailView({
  detail,
  onUpdate,
}: {
  detail: StoClientDetail;
  onUpdate: () => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState(detail.name);
  const [editPhone, setEditPhone] = useState(detail.phone ?? '');
  const [editNotes, setEditNotes] = useState(detail.notes ?? '');
  const [expandedVehicle, setExpandedVehicle] = useState<string | null>(
    detail.vehicles.length === 1 ? (detail.vehicles[0]?.id ?? null) : null,
  );
  const [vehicleDetailId, setVehicleDetailId] = useState<string | null>(null);

  const { data: vehicleDetail, isLoading: vehicleDetailLoading } = useQuery<VehicleDetail>({
    queryKey: ['client-vehicle-detail', vehicleDetailId],
    queryFn: async () => {
      const r = await fetch(`/api/garage/client-vehicles/${vehicleDetailId}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Ошибка');
      return d;
    },
    enabled: !!vehicleDetailId,
    staleTime: 15000,
  });

  const patchClient = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/garage/sto-clients/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, phone: editPhone, notes: editNotes }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Ошибка');
      return d;
    },
    onSuccess: () => {
      setEditMode(false);
      onUpdate();
    },
  });

  const totalRevenue = detail.vehicles.reduce((s, v) => s + parseFloat(v.total_spent), 0);
  const totalOrders = detail.vehicles.reduce((s, v) => s + v.orders.length, 0);

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      {/* Шапка клиента */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        {editMode ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                  Имя
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                  Телефон
                </label>
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                Заметки
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditMode(false)}
                className="text-sm text-slate-500 hover:underline"
              >
                Отмена
              </button>
              <button
                onClick={() => patchClient.mutate()}
                disabled={patchClient.isPending || !editName.trim()}
                className="text-sm px-4 py-1.5 bg-slate-900 text-white rounded-lg font-semibold disabled:opacity-40"
              >
                {patchClient.isPending ? '...' : 'Сохранить'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">{detail.name}</h2>
              {detail.phone && <div className="text-sm text-slate-500 mt-0.5">{detail.phone}</div>}
              {detail.notes && (
                <div className="text-sm text-slate-400 mt-1 italic">{detail.notes}</div>
              )}
            </div>
            <div className="flex items-start gap-4 shrink-0">
              <div className="text-right">
                <div className="text-xs text-slate-400 uppercase font-semibold">Выручка</div>
                <div className="text-2xl font-black text-slate-900">
                  {totalRevenue.toLocaleString('ru-RU')} ₽
                </div>
                <div className="text-xs text-slate-400">
                  {detail.vehicles.length} авто · {totalOrders} нарядов
                </div>
              </div>
              <button
                onClick={() => setEditMode(true)}
                className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-semibold mt-1"
              >
                Изменить
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Список автомобилей */}
      {detail.vehicles.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">
          У этого клиента нет автомобилей
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide px-1">
            Автомобили
          </h3>
          {detail.vehicles.map((v) => {
            const isExpanded = expandedVehicle === v.id;
            return (
              <div
                key={v.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
              >
                {/* Vehicle header */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-bold text-slate-900">
                        {v.brand} {v.model ?? ''} {v.year ? `· ${v.year}` : ''}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="font-mono text-sm text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {v.reg_number}
                        </span>
                        {v.vin && <span className="text-xs text-slate-400">VIN: {v.vin}</span>}
                        {v.odometer_last && (
                          <span className="text-xs text-slate-400">
                            {v.odometer_last.toLocaleString('ru-RU')} км
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-black text-slate-900">
                        {parseFloat(v.total_spent).toLocaleString('ru-RU')} ₽
                      </div>
                      <div className="text-xs text-slate-400">{v.orders.length} нарядов</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={() => setExpandedVehicle(isExpanded ? null : v.id)}
                      className="text-xs text-blue-500 hover:text-blue-700"
                    >
                      {isExpanded ? '▲ Скрыть историю' : '▼ История нарядов'}
                    </button>
                    <button
                      onClick={() => setVehicleDetailId(vehicleDetailId === v.id ? null : v.id)}
                      className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-2 py-0.5"
                    >
                      {vehicleDetailId === v.id ? 'Скрыть карточку' : 'Карточка ТО'}
                    </button>
                  </div>
                </div>

                {/* Full vehicle card (maintenance rules & recommendations) */}
                {vehicleDetailId === v.id && (
                  <div className="border-t border-slate-100">
                    {vehicleDetailLoading ? (
                      <div className="p-4 text-sm text-slate-400">Загрузка карточки...</div>
                    ) : vehicleDetail ? (
                      <VehicleCard
                        detail={vehicleDetail}
                        onUpdate={() => {
                          onUpdate();
                        }}
                      />
                    ) : null}
                  </div>
                )}

                {/* Order history */}
                {isExpanded && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100">
                    {v.orders.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-slate-400">
                        Нарядов нет
                      </div>
                    ) : (
                      v.orders.map((o) => (
                        <div key={o.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-bold text-slate-900 text-sm">
                                Наряд #{o.order_number}
                              </span>
                              <span
                                className={cn(
                                  'ml-2 text-xs px-2 py-0.5 rounded-full font-semibold',
                                  o.lifecycle_status === 'approved'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : o.lifecycle_status === 'cancelled'
                                      ? 'bg-red-100 text-red-600'
                                      : 'bg-amber-100 text-amber-700',
                                )}
                              >
                                {o.lifecycle_status === 'approved'
                                  ? 'Принят'
                                  : o.lifecycle_status === 'cancelled'
                                    ? 'Отменён'
                                    : 'В работе'}
                              </span>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-black text-slate-900 text-sm">
                                {parseFloat(o.total).toLocaleString('ru-RU')} ₽
                              </div>
                              <div className="text-xs text-slate-400">
                                {new Date(o.created_at).toLocaleDateString('ru-RU')}
                              </div>
                            </div>
                          </div>
                          {o.problem_description && (
                            <p className="text-xs text-slate-500 mt-1">{o.problem_description}</p>
                          )}
                          {(o.mechanic || o.second_mechanic) && (
                            <div className="text-xs text-slate-400 mt-0.5">
                              Мастер:{' '}
                              {[o.mechanic?.name, o.second_mechanic?.name]
                                .filter(Boolean)
                                .join(', ')}
                            </div>
                          )}
                          {o.works.length > 0 && (
                            <div className="mt-2 space-y-0.5">
                              {o.works.map((w) => (
                                <div
                                  key={w.id}
                                  className="flex justify-between text-xs text-slate-600"
                                >
                                  <span>{w.work_catalog?.name ?? w.custom_work_name ?? '—'}</span>
                                  {w.price_client && (
                                    <span className="font-mono text-slate-500">
                                      {parseFloat(w.price_client).toLocaleString('ru-RU')} ₽
                                    </span>
                                  )}
                                </div>
                              ))}
                              {o.parts.map((p) => (
                                <div
                                  key={p.id}
                                  className="flex justify-between text-xs text-slate-400 italic"
                                >
                                  <span>
                                    {p.part?.name ?? p.custom_part_name ?? '—'} × {p.quantity}{' '}
                                    {p.unit ?? p.part?.unit ?? ''}
                                  </span>
                                  {p.client_price && (
                                    <span className="font-mono not-italic">
                                      {(parseFloat(p.client_price) * p.quantity).toLocaleString(
                                        'ru-RU',
                                      )}{' '}
                                      ₽
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {o.admin_note && (
                            <div className="mt-1 text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">
                              Заметка: {o.admin_note}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
