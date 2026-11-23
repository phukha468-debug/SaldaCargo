'use client';

import type { OrderDriverOption, OrderItem, OrderVehicleOption } from './types';

export function QuickRateModal({
  order,
  rateInput,
  setRateInput,
  isPending,
  onSave,
  onClose,
}: {
  order: OrderItem;
  rateInput: string;
  setRateInput: (v: string) => void;
  isPending: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xl">💰</span>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Изменить ставку рейса</h3>
              <span className="text-[11px] text-slate-500 font-mono">
                {order.trip?.trip_number
                  ? `Рейс № ${order.trip.trip_number}`
                  : `Заявка № ${order.base_doc_number || order.order_number}`}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 font-bold text-base cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
          <div className="flex justify-between text-slate-600 text-[11px]">
            <span>Контрагент:</span>
            <span className="font-semibold text-slate-800 truncate max-w-[170px]">
              {order.client?.name || 'ПАО «Корпорация ВСМПО-АВИСМА»'}
            </span>
          </div>
          <div className="flex justify-between text-slate-600 text-[11px]">
            <span>Транспорт:</span>
            <span className="font-mono font-semibold text-slate-800">
              {order.vehicle?.reg_number || 'Авто не назначено'}
            </span>
          </div>
          <div className="flex justify-between text-slate-600 text-[11px]">
            <span>Текущий статус:</span>
            <span className="font-bold text-indigo-700">
              {order.status === 'in_progress'
                ? '🚛 В пути'
                : order.status === 'assigned'
                  ? '📋 Назначен'
                  : order.status === 'pending_review'
                    ? '🔍 На ревью'
                    : order.status}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10.5px] font-bold text-slate-700 block">
            Новая ставка (без НДС), руб.
          </label>
          <div className="relative">
            <input
              type="number"
              step="500"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              placeholder="Например, 55000"
              autoFocus
              className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-base font-mono font-black text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="absolute right-3 top-2.5 text-slate-400 font-bold text-xs">₽</span>
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            {[1000, 5000, 10000].map((delta) => (
              <button
                key={delta}
                type="button"
                onClick={() => setRateInput(String((Number(rateInput) || 0) + delta))}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold cursor-pointer transition"
              >
                +{delta.toLocaleString('ru-RU')}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            ℹ️ Изменение ставки сохраняет статус рейса и автоматически обновляет стоимость в
            расчетах.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer transition"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onSave}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition disabled:opacity-50"
          >
            {isPending ? 'Сохранение...' : 'Сохранить ставку'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AssignVehicleModal({
  order,
  vehicles,
  drivers,
  isPending,
  onOpenDriverModal,
  onAssign,
  onClose,
}: {
  order: OrderItem;
  vehicles: OrderVehicleOption[];
  drivers: OrderDriverOption[];
  isPending: boolean;
  onOpenDriverModal: () => void;
  onAssign: (vehicleId: string, driverId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <h3 className="font-bold text-sm text-slate-900">
            Назначить машину на заявку № {order.base_doc_number || order.order_number}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const vehicleId = formData.get('vehicle_id') as string;
            const driverId = formData.get('driver_id') as string;
            if (!vehicleId || !driverId) {
              alert('Выберите машину и водителя');
              return;
            }
            onAssign(vehicleId, driverId);
          }}
          className="space-y-3 text-xs"
        >
          <div>
            <label className="font-bold text-slate-700 block mb-1">Грузовой автомобиль</label>
            <select
              name="vehicle_id"
              required
              className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50"
            >
              <option value="">-- Выберите автомобиль --</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.brand_name || v.short_name || 'Авто'} ({v.reg_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700 block">Водитель</label>
              <button
                type="button"
                onClick={onOpenDriverModal}
                className="text-[10.5px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
              >
                ⚙️ Справочник / + Новый
              </button>
            </div>
            <select
              name="driver_id"
              required
              className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50"
            >
              <option value="">-- Выберите водителя --</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.phone ? `(${d.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs"
            >
              {isPending ? 'Назначение...' : 'Назначить и выписать ПЛ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
