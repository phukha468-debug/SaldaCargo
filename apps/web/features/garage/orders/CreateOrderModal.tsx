'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@saldacargo/ui';
import { PRIORITY_LABEL, emptyForm } from '../constants';
import type { Asset, ClientVehicle, Mechanic } from '../types';
import { ClientVehicleSelector } from './ClientVehicleSelector';
import { CreateOrderExternalFields } from './CreateOrderExternalFields';

export function CreateOrderModal({
  onClose,
  assets,
  mechanics = [],
  onCreated,
}: {
  onClose: () => void;
  assets: Asset[];
  mechanics?: Mechanic[];
  onCreated?: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [selectedClientVehicle, setSelectedClientVehicle] = useState<ClientVehicle | null>(null);
  const [error, setError] = useState('');

  const isExternal = form.machine_type === 'own' && form.service_type === 'external';

  const createMutation = useMutation({
    mutationFn: async () => {
      if (form.machine_type === 'own' && !form.asset_id) {
        throw new Error('Выберите автомобиль из парка');
      }
      if (form.machine_type === 'client' && !selectedClientVehicle) {
        throw new Error('Выберите или создайте клиентский автомобиль');
      }
      if (!form.problem_description.trim()) {
        throw new Error('Укажите описание проблемы или выполненных работ');
      }
      if (isExternal && !form.contractor_name.trim()) {
        throw new Error('Укажите исполнителя / сторонний сервис');
      }

      const r = await fetch('/api/garage/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          is_external: isExternal,
          client_vehicle_id: form.machine_type === 'client' ? selectedClientVehicle?.id : undefined,
          assigned_mechanic_id: isExternal ? undefined : form.assigned_mechanic_id || undefined,
          odometer_start: form.odometer_start ? parseInt(form.odometer_start) : undefined,
          work_description: isExternal ? form.problem_description : undefined,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? 'Ошибка');
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['garage-orders'] });
      queryClient.invalidateQueries({ queryKey: ['garage-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['service-orders-month'] });
      onClose();
      if (data?.id) onCreated?.(data.id);
    },
    onError: (e: Error) => setError(e.message),
  });

  const set = <K extends keyof typeof emptyForm>(field: K, value: (typeof emptyForm)[K]) =>
    setForm((f) => ({ ...f, [field]: value }));

  const totalExternalCost =
    (parseFloat(String(form.works_cost)) || 0) + (parseFloat(String(form.parts_cost)) || 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'material-symbols-outlined text-xl',
                isExternal ? 'text-purple-600' : 'text-slate-700',
              )}
            >
              {isExternal ? 'store' : 'car_repair'}
            </span>
            <h2 className="text-base font-bold text-slate-900">
              {isExternal ? 'Ремонт в стороннем сервисе' : 'Новый заказ-наряд'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Machine Type */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
              Тип машины *
            </label>
            <div className="flex gap-2">
              {(['own', 'client'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('machine_type', t)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-semibold transition-colors',
                    form.machine_type === t
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  {t === 'own' ? 'Своя машина' : 'Клиентская'}
                </button>
              ))}
            </div>
          </div>

          {/* Service Type Toggle (for own vehicles) */}
          {form.machine_type === 'own' && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                Исполнитель ремонта *
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => set('service_type', 'internal')}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                    form.service_type === 'internal'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  <span className="material-symbols-outlined text-[16px]">build</span>
                  Наш бокс (свои слесари)
                </button>
                <button
                  type="button"
                  onClick={() => set('service_type', 'external')}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                    form.service_type === 'external'
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100',
                  )}
                >
                  <span className="material-symbols-outlined text-[16px]">store</span>
                  Сторонний сервис
                </button>
              </div>
            </div>
          )}

          {/* Vehicle Selection */}
          {form.machine_type === 'own' ? (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                Машина парка *
              </label>
              <select
                value={form.asset_id}
                onChange={(e) => {
                  const assetId = e.target.value;
                  set('asset_id', assetId);
                  const selectedAsset = assets.find((a) => a.id === assetId) as
                    | (Asset & { odometer_current?: number | null })
                    | undefined;
                  if (selectedAsset?.odometer_current != null) {
                    set('odometer_start', String(selectedAsset.odometer_current));
                  }
                }}
                className={cn(
                  'w-full border rounded-lg px-3 py-2 text-sm bg-white',
                  !form.asset_id ? 'border-red-400 bg-red-50' : 'border-slate-200',
                )}
              >
                <option value="">— Выберите машину —</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.short_name} · {a.reg_number}
                  </option>
                ))}
              </select>
              {!form.asset_id && <p className="text-xs text-red-500 mt-0.5">Обязательно</p>}
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                Автомобиль клиента *
              </label>
              <ClientVehicleSelector
                value={selectedClientVehicle}
                onChange={(v) => {
                  setSelectedClientVehicle(v);
                  if (v?.odometer_last != null) {
                    set('odometer_start', String(v.odometer_last));
                  }
                }}
              />
              {!selectedClientVehicle && <p className="text-xs text-red-500 mt-0.5">Обязательно</p>}
            </div>
          )}

          {/* External Repair Specific Fields */}
          {isExternal ? (
            <CreateOrderExternalFields
              form={form}
              set={set}
              totalExternalCost={totalExternalCost}
            />
          ) : (
            /* Standard In-House Repair Fields */
            <>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                  Описание проблемы *
                </label>
                <textarea
                  value={form.problem_description}
                  onChange={(e) => set('problem_description', e.target.value)}
                  rows={3}
                  placeholder="Что случилось..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                    Исполнитель (опционально)
                  </label>
                  <select
                    value={form.assigned_mechanic_id}
                    onChange={(e) => set('assigned_mechanic_id', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">— Не выбран —</option>
                    {mechanics.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                    Пробег (км)
                  </label>
                  <input
                    type="number"
                    value={form.odometer_start}
                    onChange={(e) => set('odometer_start', e.target.value)}
                    placeholder="Одометр..."
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                    Приоритет
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) => set('priority', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    {Object.entries(PRIORITY_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                  Заметка
                </label>
                <input
                  value={form.admin_note}
                  onChange={(e) => set('admin_note', e.target.value)}
                  placeholder="Дополнительно..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={
                createMutation.isPending ||
                (form.machine_type === 'own' ? !form.asset_id : !selectedClientVehicle) ||
                !form.problem_description.trim() ||
                (isExternal && !form.contractor_name.trim())
              }
              className={cn(
                'flex-[2] text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm',
                isExternal
                  ? 'bg-purple-700 hover:bg-purple-800'
                  : 'bg-slate-900 hover:bg-slate-800',
              )}
            >
              {createMutation.isPending
                ? 'Сохраняем...'
                : isExternal
                  ? 'Сохранить сторонний ремонт'
                  : 'Создать наряд'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
