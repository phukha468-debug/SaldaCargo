'use client';

import type React from 'react';
import { LOCATION_PRESETS } from '../constants';
import type { RouteStop, SmartOrderFormState } from '../types';

export function SmartOrderRouteSection({
  form,
  setForm,
  routes,
  isMultiStop,
  preventSaldaAutoFinish,
  setPreventSaldaAutoFinish,
  routeDistKm,
  routeTimeStr,
  onAddRouteStop,
  onRemoveRouteStop,
  onUpdateRouteStop,
  onApplyLocationPreset,
  onAutoSetDeliveryTime,
}: {
  form: SmartOrderFormState;
  setForm: React.Dispatch<React.SetStateAction<SmartOrderFormState>>;
  routes: RouteStop[];
  isMultiStop: boolean;
  preventSaldaAutoFinish: boolean;
  setPreventSaldaAutoFinish: (v: boolean) => void;
  routeDistKm: number | null;
  routeTimeStr: string | null;
  onAddRouteStop: () => void;
  onRemoveRouteStop: (idx: number) => void;
  onUpdateRouteStop: (idx: number, patch: Partial<RouteStop>) => void;
  onApplyLocationPreset: (
    field: 'loading' | 'unloading',
    presetKey: string,
    stopIdx?: number,
  ) => void;
  onAutoSetDeliveryTime: () => void;
}) {
  return (
    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
        <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
          <span>📍</span>
          <span>Маршрут перевозки</span>
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddRouteStop}
            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded font-bold text-[10.5px] cursor-pointer transition active:scale-95 flex items-center gap-1"
          >
            <span>+ Добавить точку маршрута ({routes.length}/6)</span>
          </button>
        </div>
      </div>

      {isMultiStop ? (
        <div className="space-y-2">
          {routes.map((stop, idx) => (
            <div
              key={stop.id}
              className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-2 shadow-2xs relative"
            >
              <div className="flex items-center justify-between text-[11px] font-bold text-indigo-900 border-b border-slate-100 pb-1">
                <span>Точка маршрута #{idx + 1}</span>
                {routes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveRouteStop(idx)}
                    className="text-rose-500 hover:text-rose-700 text-[10.5px] font-bold cursor-pointer"
                  >
                    ✕ Удалить точку
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-600 block mb-0.5 text-[10px]">
                    📍 Погрузка (Откуда) #{idx + 1}
                  </label>
                  <input
                    type="text"
                    required
                    value={stop.loading_address}
                    onChange={(e) =>
                      onUpdateRouteStop(idx, {
                        loading_address: e.target.value,
                        loading_city: e.target.value.split(',')[0] || e.target.value,
                      })
                    }
                    className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-0.5 text-[10px]">
                    🏁 Выгрузка (Куда) #{idx + 1}
                  </label>
                  <input
                    type="text"
                    required
                    value={stop.unloading_address}
                    onChange={(e) =>
                      onUpdateRouteStop(idx, {
                        unloading_address: e.target.value,
                        unloading_city: e.target.value.split(',')[0] || e.target.value,
                      })
                    }
                    className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10.5px]">
                <div>
                  <label className="text-slate-500 block mb-0.5">Груз точки:</label>
                  <input
                    type="text"
                    value={stop.cargo_name || ''}
                    onChange={(e) => onUpdateRouteStop(idx, { cargo_name: e.target.value })}
                    className="w-full p-1 border border-slate-200 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-0.5">Вес точки (кг):</label>
                  <input
                    type="number"
                    value={stop.weight_kg || ''}
                    onChange={(e) => onUpdateRouteStop(idx, { weight_kg: Number(e.target.value) })}
                    className="w-full p-1 border border-slate-200 rounded text-xs font-bold"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-slate-500 block mb-0.5">Кто грузит (ЛОП):</label>
                  <input
                    type="text"
                    value={stop.loading_org || ''}
                    onChange={(e) => onUpdateRouteStop(idx, { loading_org: e.target.value })}
                    className="w-full p-1 border border-slate-200 rounded text-xs"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <label className="font-bold text-slate-700 text-xs">📍 Пункт погрузки (Откуда)</label>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) onApplyLocationPreset('loading', e.target.value);
                }}
                className="text-[11px] py-0.5 px-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded font-semibold text-slate-700 cursor-pointer transition"
              >
                <option value="" disabled>
                  ⚡ Выбрать точку...
                </option>
                {LOCATION_PRESETS.map((loc) => (
                  <option key={`load-opt-${loc.key}`} value={loc.key}>
                    {loc.label}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              required
              value={form.loading_address}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  loading_address: e.target.value,
                  loading_city: e.target.value.split(',')[0] || e.target.value,
                }))
              }
              placeholder="⚠️ Укажите пункт погрузки (или выберите пресет)..."
              className={`w-full p-1.5 border rounded text-xs font-medium ${
                !form.loading_address
                  ? 'border-amber-400 bg-amber-50/50 text-slate-800 placeholder:text-amber-700/60'
                  : 'border-slate-300 bg-white'
              }`}
            />
            <div className="flex justify-between mt-1 text-[11px] text-slate-500">
              <span>
                Кто грузит (ЛОП): <b>{form.loading_org_name || form.client_name}</b>
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-0.5">
              <label className="font-bold text-slate-700 text-xs">🏁 Пункт выгрузки (Куда)</label>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) onApplyLocationPreset('unloading', e.target.value);
                }}
                className="text-[11px] py-0.5 px-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded font-semibold text-slate-700 cursor-pointer transition"
              >
                <option value="" disabled>
                  ⚡ Выбрать точку...
                </option>
                {LOCATION_PRESETS.map((loc) => (
                  <option key={`unload-opt-${loc.key}`} value={loc.key}>
                    {loc.label}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              required
              value={form.unloading_address}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  unloading_address: e.target.value,
                  unloading_city: e.target.value.split(',')[0] || e.target.value,
                }))
              }
              placeholder="⚠️ Укажите пункт выгрузки (или выберите пресет)..."
              className={`w-full p-1.5 border rounded text-xs font-medium ${
                !form.unloading_address
                  ? 'border-amber-400 bg-amber-50/50 text-slate-800 placeholder:text-amber-700/60'
                  : 'border-slate-300 bg-white'
              }`}
            />
            <div className="mt-1 text-[11px] text-slate-500">
              <span>
                Грузополучатель: <b>{form.client_name}</b>
              </span>
            </div>
          </div>
        </div>
      )}

      {routeDistKm && (
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">
          <span className="flex items-center gap-1.5">
            <span>
              🛣️ Норматив: <b>{routeDistKm} км</b>
            </span>
            <span className="text-slate-300">•</span>
            <span>
              ⏱️ В пути: <b>{routeTimeStr}</b> (при 70 км/ч)
            </span>
          </span>
          <button
            type="button"
            onClick={onAutoSetDeliveryTime}
            className="text-[11px] text-indigo-600 hover:text-indigo-800 underline font-bold cursor-pointer"
            title="Рассчитать время выгрузки на основе времени погрузки и скорости 70 км/ч (+1ч погрузка)"
          >
            ⚡ Подставить в дату доставки
          </button>
        </div>
      )}

      <label className="flex items-start gap-2 p-2 bg-amber-50/90 border border-amber-300 rounded-lg text-amber-950 font-bold cursor-pointer select-none">
        <input
          type="checkbox"
          checked={preventSaldaAutoFinish}
          onChange={(e) => setPreventSaldaAutoFinish(e.target.checked)}
          className="mt-0.5 w-4 h-4 text-indigo-600 rounded cursor-pointer"
        />
        <div className="text-xs">
          <span className="flex items-center gap-1.5">
            🔄 Составной маршрут через Верхнюю Салду (транзит / защита от закрытия Wialon)
            {preventSaldaAutoFinish && (
              <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded text-[10px] font-bold">
                🛡️ Защита активна
              </span>
            )}
          </span>
          <span className="block font-normal text-[10.5px] text-amber-900 mt-0.5">
            Если машина проезжает или ночует в Салде перед выгрузкой (например: Шайтанка →
            Маминское), рейс останется в статусе «В пути» и не завершится преждевременно.
          </span>
        </div>
      </label>
    </div>
  );
}
