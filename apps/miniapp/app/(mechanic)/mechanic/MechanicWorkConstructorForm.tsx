'use client';

import { useEffect, useId, useState } from 'react';
import {
  GARAGE_WORK_ACTIONS,
  GARAGE_WORK_CATEGORIES,
  GARAGE_WORK_POSITIONS,
  POPULAR_GARAGE_COMPONENTS,
  buildStandardWorkName,
} from '@saldacargo/shared';

export interface MechanicOption {
  id: string;
  name: string;
}

export interface MechanicWorkPayload {
  custom_work_name: string;
  category: string;
  work_date: string;
  mechanic_id: string | null;
  second_mechanic_id: string | null;
  quantity: number;
}

export interface MechanicWorkConstructorFormProps {
  mechanics: MechanicOption[];
  currentMechanicId?: string;
  defaultSecondMechanicId?: string;
  defaultDate?: string;
  isPending?: boolean;
  serverError?: string | null;
  submitLabel?: string;
  onSubmit: (payload: MechanicWorkPayload) => Promise<void> | void;
  onDraftChange?: (draft: MechanicWorkPayload | null) => void;
}

export default function MechanicWorkConstructorForm({
  mechanics,
  currentMechanicId,
  defaultSecondMechanicId = '',
  defaultDate,
  isPending = false,
  serverError = null,
  submitLabel = '+ Добавить работу',
  onSubmit,
  onDraftChange,
}: MechanicWorkConstructorFormProps) {
  const datalistId = useId();
  const [workDate, setWorkDate] = useState<string>(
    () => defaultDate || new Date().toISOString().slice(0, 10),
  );
  const [category, setCategory] = useState<string>(GARAGE_WORK_CATEGORIES[0]);
  const [action, setAction] = useState<string>(GARAGE_WORK_ACTIONS[0]);
  const [component, setComponent] = useState<string>('');
  const [position, setPosition] = useState<string>('');
  const [finalName, setFinalName] = useState<string>('');
  const [mechanicIdOverride, setMechanicIdOverride] = useState<string | null>(null);
  const [secondMechanicOverride, setSecondMechanicOverride] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [localError, setLocalError] = useState<string | null>(null);

  const mechanicId = mechanicIdOverride ?? currentMechanicId ?? '';
  const rawSecondId = secondMechanicOverride ?? defaultSecondMechanicId ?? '';
  const secondMechanicId = rawSecondId && rawSecondId !== mechanicId ? rawSecondId : '';

  useEffect(() => {
    if (!onDraftChange) return;
    const trimmed = finalName.trim();
    if (!trimmed) {
      onDraftChange(null);
      return;
    }
    onDraftChange({
      custom_work_name: trimmed,
      category,
      work_date: workDate,
      mechanic_id: mechanicId || null,
      second_mechanic_id: secondMechanicId || null,
      quantity,
    });
  }, [finalName, category, workDate, mechanicId, secondMechanicId, quantity, onDraftChange]);

  const handleSubmit = async () => {
    const cleanName = finalName.trim();
    if (!cleanName) {
      setLocalError('Укажите деталь или введите итоговое наименование работы');
      return;
    }
    setLocalError(null);
    try {
      await onSubmit({
        custom_work_name: cleanName,
        category,
        work_date: workDate,
        mechanic_id: mechanicId || currentMechanicId || null,
        second_mechanic_id:
          secondMechanicId && secondMechanicId !== (mechanicId || currentMechanicId)
            ? secondMechanicId
            : null,
        quantity,
      });
      setComponent('');
      setPosition('');
      setFinalName('');
      setQuantity(1);
    } catch (err) {
      if (err instanceof Error && err.message) {
        setLocalError(err.message);
      }
    }
  };

  const displayError = localError || serverError;

  return (
    <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3 space-y-2.5">
      {/* Шапка */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-extrabold text-slate-800">
          ➕ Добавить работу (ручной ввод)
        </span>
        <span className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full shrink-0">
          Без цены и времени
        </span>
      </div>

      {/* Сетка 2×2: Дата + Узел/Категория */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
            📅 Дата работы <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            className="w-full h-9 px-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
            ⚙️ Узел / Категория <span className="text-red-500">*</span>
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full h-9 px-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
          >
            {GARAGE_WORK_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Сетка 2×2: 1. Действие + 3. Сторона/Положение */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
            1. Действие <span className="text-red-500">*</span>
          </label>
          <select
            value={action}
            onChange={(e) => {
              const val = e.target.value;
              setAction(val);
              setFinalName(buildStandardWorkName(val, component, position));
              setLocalError(null);
            }}
            className="w-full h-9 px-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
          >
            {GARAGE_WORK_ACTIONS.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
            3. Сторона / Положение
          </label>
          <select
            value={position}
            onChange={(e) => {
              const val = e.target.value;
              setPosition(val);
              setFinalName(buildStandardWorkName(action, component, val));
            }}
            className="w-full h-9 px-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
          >
            {GARAGE_WORK_POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Деталь / Узел */}
      <div>
        <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
          2. Деталь / Узел <span className="text-red-500">*</span>
        </label>
        <input
          list={datalistId}
          type="text"
          value={component}
          onChange={(e) => {
            const val = e.target.value;
            setComponent(val);
            setFinalName(buildStandardWorkName(action, val, position));
            setLocalError(null);
          }}
          placeholder="например: тормозные колодки"
          className="w-full h-9 px-2.5 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
        />
        <datalist id={datalistId}>
          {POPULAR_GARAGE_COMPONENTS.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </div>

      {/* Итоговое наименование */}
      <div className="bg-white border border-blue-200 rounded-xl px-2.5 py-1.5">
        <div className="flex items-center justify-between text-[9.5px] font-extrabold text-blue-800 mb-0.5">
          <span>🏷 Итоговое наименование</span>
          <span className="text-slate-400 font-semibold">можно править</span>
        </div>
        <input
          type="text"
          value={finalName}
          onChange={(e) => {
            setFinalName(e.target.value);
            setLocalError(null);
          }}
          placeholder="Заполните действие и деталь выше или введите вручную..."
          className="w-full text-xs font-extrabold text-slate-900 bg-transparent outline-none placeholder:text-slate-400 placeholder:font-medium"
        />
      </div>

      <div className="h-px bg-blue-100" />

      {/* Исполнитель + 2-й исполнитель */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
            👤 Исполнитель
          </label>
          <select
            value={mechanicId}
            onChange={(e) => {
              const nextMech = e.target.value;
              setMechanicIdOverride(nextMech);
              if (nextMech && nextMech === secondMechanicId) {
                setSecondMechanicOverride('');
              }
            }}
            className="w-full h-9 px-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
          >
            {mechanics.length === 0 && (
              <option value={currentMechanicId || ''}>Текущий механик</option>
            )}
            {mechanics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id === currentMechanicId ? `${m.name} (Вы)` : m.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
            👥 2-й исполнитель
          </label>
          <select
            value={secondMechanicId}
            onChange={(e) => setSecondMechanicOverride(e.target.value)}
            className="w-full h-9 px-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
          >
            <option value="">— Нет —</option>
            {mechanics.map((m) => (
              <option key={m.id} value={m.id} disabled={m.id === mechanicId}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Кол-во + Кнопка добавления */}
      <div className="grid grid-cols-[104px_1fr] gap-2 items-end pt-0.5">
        <div>
          <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider text-center mb-1">
            Кол-во
          </label>
          <div className="flex items-center h-10 bg-white border border-slate-300 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-8 h-full flex items-center justify-center text-slate-600 font-extrabold text-base hover:bg-slate-100 active:bg-slate-200"
            >
              −
            </button>
            <span className="flex-1 text-center text-xs font-extrabold text-slate-900">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="w-8 h-full flex items-center justify-center text-slate-600 font-extrabold text-base hover:bg-slate-100 active:bg-slate-200"
            >
              +
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="h-10 w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs tracking-wide shadow-xs active:scale-[0.985] transition-all disabled:opacity-50"
        >
          {isPending ? 'Сохранение...' : `${submitLabel}${quantity > 1 ? ` (×${quantity})` : ''}`}
        </button>
      </div>

      {displayError && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-xl text-[11px] font-bold text-red-600">
          {displayError}
        </div>
      )}
    </div>
  );
}
