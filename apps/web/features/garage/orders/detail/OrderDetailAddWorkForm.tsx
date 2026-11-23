'use client';

import { useState } from 'react';
import {
  GARAGE_WORK_ACTIONS,
  GARAGE_WORK_CATEGORIES,
  GARAGE_WORK_POSITIONS,
  POPULAR_GARAGE_COMPONENTS,
  buildStandardWorkName,
} from '@saldacargo/shared';
import type { Mechanic, OrderDetail } from '../../types';

export interface AddWorkPayload {
  custom_work_name: string;
  category?: string;
  work_date?: string;
  price_client?: string;
  norm_minutes?: number;
  mechanic_id?: string | null;
  second_mechanic_id?: string | null;
  quantity: number;
}

export function OrderDetailAddWorkForm({
  order,
  mechanics,
  hourlyRate,
  isPending,
  serverError,
  onSubmit,
}: {
  order: OrderDetail;
  mechanics: Mechanic[];
  hourlyRate: number;
  isPending: boolean;
  serverError: string | null;
  onSubmit: (payload: AddWorkPayload) => void;
}) {
  const [addWorkQty, setAddWorkQty] = useState(1);
  const [addWorkDate, setAddWorkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [addWorkCategory, setAddWorkCategory] = useState<string>(GARAGE_WORK_CATEGORIES[0]);
  const [addWorkAction, setAddWorkAction] = useState<string>(GARAGE_WORK_ACTIONS[0]);
  const [addWorkComponent, setAddWorkComponent] = useState<string>('');
  const [addWorkPosition, setAddWorkPosition] = useState<string>('');
  const [customWorkName, setCustomWorkName] = useState('');
  const [customWorkPrice, setCustomWorkPrice] = useState(() => String(Math.round(hourlyRate)));
  const [addWorkMinutes, setAddWorkMinutes] = useState('60');
  const [addWorkMechanic, setAddWorkMechanic] = useState<string>('');
  const [addWorkSecondMechanic, setAddWorkSecondMechanic] = useState<string>('');
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = localError || serverError;

  return (
    <div className="mb-3 border border-blue-200 bg-blue-50/50 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
        <span>➕ Добавить работу (ручной ввод)</span>
        <span className="text-[11px] text-slate-400 font-normal">
          Тариф: {hourlyRate.toLocaleString('ru-RU')} ₽/ч
        </span>
      </div>

      {/* Row 1: Date, Category, 3-Word Standard (Action, Component, Position) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
        <div className="md:col-span-2">
          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
            📅 Дата работы *
          </label>
          <input
            type="date"
            value={addWorkDate}
            onChange={(e) => setAddWorkDate(e.target.value)}
            className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 font-medium"
          />
        </div>

        <div className="md:col-span-3">
          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
            ⚙️ Узел / Категория *
          </label>
          <select
            value={addWorkCategory}
            onChange={(e) => setAddWorkCategory(e.target.value)}
            className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 font-medium"
          >
            {GARAGE_WORK_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
            1. Действие *
          </label>
          <select
            value={addWorkAction}
            onChange={(e) => {
              const val = e.target.value;
              setAddWorkAction(val);
              setCustomWorkName(buildStandardWorkName(val, addWorkComponent, addWorkPosition));
              setLocalError(null);
            }}
            className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 font-medium"
          >
            {GARAGE_WORK_ACTIONS.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
            2. Деталь / Узел *
          </label>
          <input
            list="popular-components-list"
            type="text"
            value={addWorkComponent}
            onChange={(e) => {
              const val = e.target.value;
              setAddWorkComponent(val);
              setCustomWorkName(buildStandardWorkName(addWorkAction, val, addWorkPosition));
              setLocalError(null);
            }}
            placeholder="например: тормозные колодки"
            className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 font-medium"
          />
          <datalist id="popular-components-list">
            {POPULAR_GARAGE_COMPONENTS.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>

        <div className="md:col-span-2">
          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
            3. Сторона / Положение
          </label>
          <select
            value={addWorkPosition}
            onChange={(e) => {
              const val = e.target.value;
              setAddWorkPosition(val);
              setCustomWorkName(buildStandardWorkName(addWorkAction, addWorkComponent, val));
            }}
            className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 font-medium"
          >
            {GARAGE_WORK_POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Live Assembled Preview & Manual Override */}
      <div className="flex items-center gap-2 bg-white/90 border border-blue-200 rounded-lg px-2.5 py-1.5 shadow-2xs">
        <span className="text-[11px] font-bold text-blue-900 shrink-0">
          🏷 Итоговое наименование:
        </span>
        <input
          type="text"
          value={customWorkName}
          onChange={(e) => {
            setCustomWorkName(e.target.value);
            setLocalError(null);
          }}
          placeholder="Заполните действие и деталь выше или введите вручную..."
          className="w-full text-xs font-semibold text-slate-800 bg-transparent outline-none placeholder:text-slate-400"
        />
      </div>

      {/* Row 2: Mechanic, 2nd Mechanic, Minutes, Price, Qty, Add button */}
      <div className="grid grid-cols-2 md:grid-cols-12 gap-2 items-end pt-1">
        <div className="col-span-2 md:col-span-3">
          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
            👤 Исполнитель
          </label>
          <select
            value={addWorkMechanic}
            onChange={(e) => setAddWorkMechanic(e.target.value)}
            className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500"
          >
            <option value="">
              {order.mechanic
                ? `По наряду (${order.mechanic.name.split(' ')[0]})`
                : '— Не назначен —'}
            </option>
            {mechanics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2 md:col-span-3">
          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
            👥 2-й исполнитель
          </label>
          <select
            value={addWorkSecondMechanic}
            onChange={(e) => setAddWorkSecondMechanic(e.target.value)}
            className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500"
          >
            <option value="">— Нет —</option>
            {mechanics.map((m) => (
              <option key={m.id} value={m.id} disabled={m.id === addWorkMechanic}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-1 md:col-span-2">
          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
            ⏱ Время (мин)
          </label>
          <input
            type="number"
            step="15"
            min="0"
            value={addWorkMinutes}
            onChange={(e) => {
              const val = e.target.value;
              setAddWorkMinutes(val);
              const num = Number(val);
              if (val !== '' && !isNaN(num) && num >= 0 && hourlyRate > 0) {
                setCustomWorkPrice(String(Math.round((num / 60) * hourlyRate)));
              } else if (val === '') {
                setCustomWorkPrice('');
              }
            }}
            placeholder="60"
            className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 font-medium"
          />
        </div>

        <div className="col-span-1 md:col-span-2">
          <label className="text-[11px] font-semibold text-slate-600 block mb-1">💰 Цена (₽)</label>
          <input
            type="number"
            step="100"
            min="0"
            value={customWorkPrice}
            onChange={(e) => {
              const val = e.target.value;
              setCustomWorkPrice(val);
              const num = Number(val);
              if (val !== '' && !isNaN(num) && num >= 0 && hourlyRate > 0) {
                setAddWorkMinutes(String(Math.round((num / hourlyRate) * 60)));
              } else if (val === '') {
                setAddWorkMinutes('');
              }
            }}
            placeholder={String(Math.round(((Number(addWorkMinutes) || 60) / 60) * hourlyRate))}
            className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 font-bold text-slate-800"
          />
        </div>

        <div className="col-span-1 md:col-span-1">
          <label className="text-[11px] font-semibold text-slate-600 block mb-1 text-center">
            Кол-во
          </label>
          <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white h-[30px]">
            <button
              type="button"
              onClick={() => setAddWorkQty((q) => Math.max(1, q - 1))}
              className="px-1.5 py-1 text-slate-500 hover:bg-slate-100 text-xs font-bold"
            >
              −
            </button>
            <span className="flex-1 text-center text-xs font-bold text-slate-800">
              {addWorkQty}
            </span>
            <button
              type="button"
              onClick={() => setAddWorkQty((q) => q + 1)}
              className="px-1.5 py-1 text-slate-500 hover:bg-slate-100 text-xs font-bold"
            >
              +
            </button>
          </div>
        </div>

        <div className="col-span-1 md:col-span-1 flex gap-1 items-center">
          <button
            type="button"
            onClick={() => {
              if (!customWorkName.trim()) {
                setLocalError('Введите наименование работы');
                return;
              }
              onSubmit({
                custom_work_name: customWorkName.trim(),
                category: addWorkCategory,
                work_date: addWorkDate,
                price_client: customWorkPrice || undefined,
                norm_minutes: Number(addWorkMinutes) || 60,
                mechanic_id: addWorkMechanic || null,
                second_mechanic_id: addWorkSecondMechanic || null,
                quantity: addWorkQty,
              });
            }}
            disabled={isPending}
            className="h-[30px] w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition-colors shadow-sm"
            title="Добавить работу"
          >
            {isPending ? '...' : '+'}
          </button>
        </div>
      </div>

      {displayError && (
        <div className="p-2 bg-red-100 border border-red-300 rounded-lg text-xs text-red-700 font-semibold">
          {displayError}
        </div>
      )}
    </div>
  );
}
