'use client';

import { useState } from 'react';
import { GARAGE_WORK_CATEGORIES } from '@saldacargo/shared';
import { DEFAULT_WORK_DESCRIPTIONS } from '../../constants';
import type { DetailWork, Mechanic } from '../../types';
import { getSpecialtyLabel } from '../../utils';

export interface PatchWorkBody {
  actual_minutes?: number;
  price_client?: string;
  status?: string;
  work_description?: string | null;
  quantity?: number;
  mechanic_id?: string | null;
  second_mechanic_id?: string | null;
  custom_salary_pct?: number | null;
  custom_work_name?: string;
  category?: string;
  work_date?: string;
}

export function OrderDetailWorkEditForm({
  work,
  mechanics,
  hourlyRate,
  isPending,
  error,
  onPriceDraftChange,
  onSave,
  onCancel,
}: {
  work: DetailWork;
  mechanics: Mechanic[];
  hourlyRate: number;
  isPending: boolean;
  error: Error | null;
  onPriceDraftChange: (price: string) => void;
  onSave: (body: PatchWorkBody) => void;
  onCancel: () => void;
}) {
  const isDone = work.status === 'completed';
  const workCode = (work.work_catalog as unknown as { code?: string } | null)?.code;
  const normHours = (work.norm_minutes * (work.quantity ?? 1)) / 60;

  const [editWorkName, setEditWorkName] = useState(
    work.custom_work_name ?? work.work_catalog?.name ?? '',
  );
  const [editWorkCategory, setEditWorkCategory] = useState(
    work.custom_work_description ||
      work.notes?.match(/\[category:([^\]]+)\]/)?.[1] ||
      GARAGE_WORK_CATEGORIES[0],
  );
  const [editWorkDate, setEditWorkDate] = useState(
    work.created_at ? work.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
  );
  const [editWorkPrice, setEditWorkPrice] = useState(
    work.price_client ?? String(Math.round(normHours * hourlyRate)),
  );
  const [editWorkDesc, setEditWorkDesc] = useState(
    work.work_description ?? (workCode ? (DEFAULT_WORK_DESCRIPTIONS[workCode] ?? '') : ''),
  );
  const [editWorkQty, setEditWorkQty] = useState(work.quantity ?? 1);
  const [editWorkMechanic, setEditWorkMechanic] = useState<string | null>(work.mechanic_id ?? null);
  const [editWorkSecondMechanic, setEditWorkSecondMechanic] = useState<string | null>(
    work.second_mechanic_id ?? null,
  );
  const [editWorkCustomPct, setEditWorkCustomPct] = useState(
    work.notes?.match(/\[salary_pct:(\d+(?:\.\d+)?)\]/)?.[1] ?? '',
  );

  const editPrice = parseFloat(editWorkPrice || '0');
  const computedMinutes =
    editPrice > 0
      ? Math.max(1, Math.round((editPrice / hourlyRate) * 60))
      : work.norm_minutes * editWorkQty;
  const computedHours = computedMinutes / 60;

  const updatePrice = (val: string) => {
    setEditWorkPrice(val);
    onPriceDraftChange(val);
  };

  const buildPayload = (status?: string): PatchWorkBody => ({
    custom_work_name: editWorkName.trim() || undefined,
    category: editWorkCategory,
    work_date: editWorkDate,
    quantity: editWorkQty,
    actual_minutes: computedMinutes,
    price_client: editPrice > 0 ? editPrice.toFixed(2) : undefined,
    work_description: editWorkDesc || null,
    mechanic_id: editWorkMechanic || null,
    second_mechanic_id: editWorkSecondMechanic || null,
    custom_salary_pct: editWorkCustomPct ? parseFloat(editWorkCustomPct) : null,
    ...(status ? { status } : {}),
  });

  return (
    <div className="mx-1 mb-1 border border-blue-200 bg-blue-50 rounded-b-xl px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black text-blue-800 uppercase tracking-wide">
          Редактировать параметры работы
        </p>
        <span className="text-xs text-blue-500">
          Тариф: {hourlyRate.toLocaleString('ru-RU')} ₽/ч
        </span>
      </div>

      {/* Name, Date, Category */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
        <div className="md:col-span-3">
          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
            📅 Дата работы
          </label>
          <input
            type="date"
            value={editWorkDate}
            onChange={(e) => setEditWorkDate(e.target.value)}
            className="w-full text-xs bg-white border border-blue-200 rounded-lg px-2.5 py-1.5 outline-none font-medium"
          />
        </div>

        <div className="md:col-span-4">
          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
            ⚙️ Категория / Узел
          </label>
          <select
            value={editWorkCategory}
            onChange={(e) => setEditWorkCategory(e.target.value)}
            className="w-full text-xs bg-white border border-blue-200 rounded-lg px-2.5 py-1.5 outline-none font-medium"
          >
            {GARAGE_WORK_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-5">
          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
            ✏️ Наименование работы
          </label>
          <input
            list="popular-components-list"
            type="text"
            value={editWorkName}
            onChange={(e) => setEditWorkName(e.target.value)}
            placeholder="Название работы..."
            className="w-full text-xs bg-white border border-blue-200 rounded-lg px-2.5 py-1.5 outline-none font-semibold text-slate-800"
          />
        </div>
      </div>

      {/* Price + Minutes bidirectional */}
      <div className="grid grid-cols-2 md:grid-cols-12 gap-3 items-end">
        <div className="col-span-1 md:col-span-4">
          <label className="text-xs text-slate-500 block mb-1">⏱ Время (мин)</label>
          <input
            type="number"
            min="0"
            step="15"
            value={computedMinutes}
            onChange={(e) => {
              const val = e.target.value;
              const num = Number(val);
              if (val !== '' && !isNaN(num) && num >= 0 && hourlyRate > 0) {
                updatePrice(String(Math.round((num / 60) * hourlyRate)));
              } else if (val === '') {
                updatePrice('0');
              }
            }}
            className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div className="col-span-1 md:col-span-4">
          <label className="text-xs text-slate-500 block mb-1">💰 Стоимость (₽)</label>
          <input
            type="number"
            min="0"
            step="100"
            value={editWorkPrice}
            onChange={(e) => updatePrice(e.target.value)}
            className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="0"
          />
        </div>

        <div className="col-span-1 md:col-span-2 pb-1 text-right">
          <p className="text-xs text-slate-400">расчетное время</p>
          <p className="text-lg font-black text-blue-700">{computedHours.toFixed(1)} нч</p>
        </div>

        <div className="col-span-1 md:col-span-2">
          <label className="text-xs text-slate-500 block mb-1 text-center">Кол-во</label>
          <div className="flex items-center border border-blue-200 rounded-lg overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setEditWorkQty((q) => Math.max(1, q - 1))}
              className="px-2 py-2 text-slate-500 hover:bg-slate-100 text-sm font-bold"
            >
              −
            </button>
            <span className="flex-1 text-center text-sm font-semibold text-slate-800">
              {editWorkQty}
            </span>
            <button
              type="button"
              onClick={() => setEditWorkQty((q) => q + 1)}
              className="px-2 py-2 text-slate-500 hover:bg-slate-100 text-sm font-bold"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-xs text-slate-500 block mb-1">Описание для заказ-наряда</label>
        <textarea
          rows={2}
          value={editWorkDesc}
          onChange={(e) => setEditWorkDesc(e.target.value)}
          placeholder="Что именно сделано..."
          className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm resize-none bg-white"
        />
      </div>

      {/* Mechanic & Custom Salary Pct */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Исполнитель</label>
          <select
            value={editWorkMechanic ?? ''}
            onChange={(e) => setEditWorkMechanic(e.target.value)}
            className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">— Не назначен —</option>
            {mechanics.map((m) => {
              const spec = getSpecialtyLabel(m.roles);
              return (
                <option key={m.id} value={m.id}>
                  {m.name} {spec ? `(${spec})` : ''}
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">2-й исполнитель</label>
          <select
            value={editWorkSecondMechanic ?? ''}
            onChange={(e) => setEditWorkSecondMechanic(e.target.value)}
            className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white"
            disabled={!editWorkMechanic}
          >
            <option value="">— Нет —</option>
            {mechanics.map((m) => {
              const spec = getSpecialtyLabel(m.roles);
              return (
                <option key={m.id} value={m.id} disabled={m.id === editWorkMechanic}>
                  {m.name} {spec ? `(${spec})` : ''}
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Ставка ЗП мастера (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            placeholder="По умолчанию (50%)"
            value={editWorkCustomPct}
            onChange={(e) => setEditWorkCustomPct(e.target.value)}
            className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white font-semibold"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave(buildPayload())}
          disabled={isPending}
          className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black py-2.5 rounded-lg disabled:opacity-50 uppercase tracking-wide"
        >
          {isPending ? '...' : 'Сохранить изменения'}
        </button>
        <button
          onClick={() => onSave(buildPayload('completed'))}
          disabled={isPending}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black py-2.5 rounded-lg disabled:opacity-50 uppercase tracking-wide"
        >
          {isPending ? '...' : isDone ? '✓ Обновить' : '✓ Отметить выполненной'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 text-xs text-slate-500 hover:text-slate-700 font-semibold"
        >
          Отмена
        </button>
      </div>
      {error && (
        <div className="text-xs text-red-600 font-semibold bg-red-50 px-3 py-2 rounded-lg border border-red-100">
          Ошибка: {error.message || 'Неизвестная ошибка'}
        </div>
      )}
    </div>
  );
}
