'use client';

import type React from 'react';
import { OrderCounterpartySelect } from '../OrderCounterpartySelect';
import type {
  ClientOrderPart,
  OrderCounterpartyOption,
  OrderDriverOption,
  OrderVehicleOption,
  SmartOrderFormState,
} from '../types';

export function SmartOrderCargoSection({
  form,
  setForm,
  clientOrders,
  counterparties,
  vehicles,
  drivers,
  totalClientsRevenue,
  totalClientsWeight,
  isCurrentShaytankaMaminskoe,
  minBillingPrice,
  onAddClientOrder,
  onRemoveClientOrder,
  onUpdateClientOrder,
  onOpenDriverModal,
}: {
  form: SmartOrderFormState;
  setForm: React.Dispatch<React.SetStateAction<SmartOrderFormState>>;
  clientOrders: ClientOrderPart[];
  counterparties: OrderCounterpartyOption[];
  vehicles: OrderVehicleOption[];
  drivers: OrderDriverOption[];
  totalClientsRevenue: number;
  totalClientsWeight: number;
  isCurrentShaytankaMaminskoe: boolean;
  minBillingPrice: number | null;
  onAddClientOrder: () => void;
  onRemoveClientOrder: (idx: number) => void;
  onUpdateClientOrder: (idx: number, patch: Partial<ClientOrderPart>) => void;
  onOpenDriverModal?: (driverId?: string) => void;
}) {
  return (
    <>
      {/* Секция 3: Клиенты, груз и ставки */}
      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
          <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
            <span>📦</span>
            <span>Груз и клиенты в рейсе</span>
            {clientOrders.length > 1 && (
              <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded font-bold text-[10.5px]">
                Сборный рейс ({clientOrders.length} кл.)
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={onAddClientOrder}
            className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[11px] font-bold cursor-pointer transition flex items-center gap-1 active:scale-95"
          >
            <span>+ Добавить клиента / догруз ({clientOrders.length}/6)</span>
          </button>
        </div>

        {clientOrders.length > 1 ? (
          <div className="space-y-2">
            {clientOrders.map((co, idx) => (
              <div
                key={co.id || idx}
                className="p-2 bg-white border border-slate-200 rounded-lg space-y-1.5 shadow-2xs"
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 border-b border-slate-100 pb-1">
                  <span className="text-indigo-900">
                    {idx === 0 ? '👑 Основной заказчик' : `📦 Догруз / Клиент #${idx + 1}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveClientOrder(idx)}
                    className="text-rose-500 hover:text-rose-700 text-[10.5px] font-bold cursor-pointer"
                  >
                    ✕ Удалить
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5 items-end">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-500 font-bold block mb-0.5">
                      Клиент (Контрагент):
                    </label>
                    <OrderCounterpartySelect
                      inputValue={co.client_name}
                      counterparties={counterparties}
                      onChange={(cp, name) =>
                        onUpdateClientOrder(idx, {
                          client_id: cp?.id || '',
                          client_name: name,
                          client_inn: cp?.inn || '',
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-0.5">
                      № Заявки / ЭПЭ:
                    </label>
                    <input
                      type="text"
                      value={co.base_doc_number || ''}
                      onChange={(e) =>
                        onUpdateClientOrder(idx, { base_doc_number: e.target.value })
                      }
                      placeholder={form.base_doc_number || '№'}
                      className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-0.5">
                      Груз и вес:
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={co.cargo_name || ''}
                        onChange={(e) => onUpdateClientOrder(idx, { cargo_name: e.target.value })}
                        placeholder="Груз"
                        className="w-2/3 p-1.5 border border-slate-300 rounded bg-white text-xs font-semibold"
                      />
                      <input
                        type="number"
                        value={co.weight_gross_kg || ''}
                        onChange={(e) =>
                          onUpdateClientOrder(idx, {
                            weight_gross_kg: e.target.value ? Number(e.target.value) : '',
                          })
                        }
                        placeholder="кг"
                        className="w-1/3 p-1.5 border border-slate-300 rounded bg-white text-xs font-bold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-0.5">
                      Ставка без НДС (₽):
                    </label>
                    <input
                      type="number"
                      value={co.price_without_vat || ''}
                      onChange={(e) =>
                        onUpdateClientOrder(idx, {
                          price_without_vat: Number(e.target.value) || '',
                        })
                      }
                      placeholder="Ставка ₽"
                      className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs font-bold text-indigo-700"
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-bold text-indigo-950">
              <span>
                Итого по рейсу: <b>{totalClientsRevenue.toLocaleString('ru-RU')} ₽</b> • Общий вес:{' '}
                <b>{totalClientsWeight.toLocaleString('ru-RU')} кг</b>
              </span>
              <span className="text-[10.5px] text-indigo-700 font-semibold">
                ✓ Раздельные счета (trip_orders) на каждого клиента
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="font-bold text-slate-700 block mb-0.5 text-xs">
                Наименование груза
              </label>
              <input
                type="text"
                required
                value={form.cargo_name}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((prev) => ({ ...prev, cargo_name: v }));
                  onUpdateClientOrder(0, { cargo_name: v });
                }}
                placeholder="⚠️ Укажите наименование груза..."
                className={`w-full p-1.5 border rounded text-xs font-semibold ${
                  !form.cargo_name
                    ? 'border-amber-400 bg-amber-50/50 text-slate-800 placeholder:text-amber-700/60'
                    : 'border-slate-300 bg-white'
                }`}
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-0.5 text-xs">
                Вес груза (брутто, кг)
              </label>
              <input
                type="number"
                value={form.weight_gross_kg}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((prev) => ({ ...prev, weight_gross_kg: v }));
                  onUpdateClientOrder(0, { weight_gross_kg: v ? Number(v) : '' });
                }}
                placeholder="Напр. 3000"
                className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs font-bold"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="font-bold text-slate-700 text-xs">Ставка без НДС (₽)</label>
                <div className="flex items-center gap-1">
                  {isCurrentShaytankaMaminskoe && (
                    <button
                      type="button"
                      onClick={() => {
                        setForm((f) => ({ ...f, price_without_vat: 40000 }));
                        onUpdateClientOrder(0, { price_without_vat: 40000 });
                      }}
                      className="text-[10px] bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-1 py-0.2 rounded font-bold cursor-pointer transition"
                      title="Фиксированная базовая ставка Шайтанка ↔ Маминское"
                    >
                      ⚡ 40 000 ₽
                    </button>
                  )}
                  {minBillingPrice && !isCurrentShaytankaMaminskoe && (
                    <span
                      className="text-[10px] text-slate-500 font-semibold"
                      title="Минимальная расчетная цена из расчета 50 ₽/км"
                    >
                      мин. {minBillingPrice.toLocaleString('ru-RU')} ₽
                    </span>
                  )}
                </div>
              </div>
              <input
                type="number"
                required
                value={form.price_without_vat}
                onChange={(e) => {
                  const v = Number(e.target.value) || '';
                  setForm((prev) => ({ ...prev, price_without_vat: v }));
                  onUpdateClientOrder(0, { price_without_vat: v });
                }}
                placeholder="⚠️ Укажите ставку рейса..."
                className={`w-full p-1.5 border rounded text-xs font-bold ${
                  !form.price_without_vat
                    ? 'border-amber-400 bg-amber-50/50 text-slate-800 placeholder:text-amber-700/60'
                    : 'border-slate-300 bg-white text-indigo-700'
                }`}
              />
            </div>
          </div>
        )}
      </div>

      {/* Канал оплаты */}
      <div className="p-2.5 rounded-xl border border-indigo-200 bg-indigo-50/60 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-bold text-slate-900 block text-xs">
            Завершение оплаты после рейса:
          </span>
          <span className="text-[11px] text-slate-600">
            Куда поступит оплата после закрытия рейса по Wialon
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 font-bold cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-indigo-300 text-indigo-900">
            <input
              type="radio"
              name="payment_method"
              value="bank_invoice"
              checked={form.payment_method === 'bank_invoice'}
              onChange={() => setForm((prev) => ({ ...prev, payment_method: 'bank_invoice' }))}
            />
            <span>🏦 Безнал на Р/С → Дебиторка</span>
          </label>
          <label className="flex items-center gap-1.5 font-bold cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-300 text-slate-700">
            <input
              type="radio"
              name="payment_method"
              value="cash"
              checked={form.payment_method === 'cash'}
              onChange={() => setForm((prev) => ({ ...prev, payment_method: 'cash' }))}
            />
            <span>💵 Наличные → Касса компании</span>
          </label>
        </div>
      </div>

      {/* Секция 4: Назначение машины и водителя */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
        <div>
          <label className="font-bold text-slate-700 block mb-0.5">Грузовой автомобиль (ТС)</label>
          <select
            value={form.assigned_vehicle_id}
            onChange={(e) => setForm((prev) => ({ ...prev, assigned_vehicle_id: e.target.value }))}
            className="w-full p-1.5 border border-slate-300 rounded bg-white font-bold"
          >
            <option value="">-- В лист ожидания (без назначения) --</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.brand_name || v.short_name || 'Авто'} ({v.reg_number})
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <label className="font-bold text-slate-700 block">Водитель</label>
            {onOpenDriverModal && (
              <button
                type="button"
                onClick={() => onOpenDriverModal(form.assigned_driver_id || undefined)}
                className="text-[10.5px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
              >
                ⚙️ Справочник / + Новый
              </button>
            )}
          </div>
          <select
            value={form.assigned_driver_id}
            onChange={(e) => setForm((prev) => ({ ...prev, assigned_driver_id: e.target.value }))}
            className="w-full p-1.5 border border-slate-300 rounded bg-white font-bold"
          >
            <option value="">-- Назначить позже --</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} {d.phone ? `(${d.phone})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
