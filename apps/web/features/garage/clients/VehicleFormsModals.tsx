'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { CounterpartyOption } from '../types';
import { CounterpartySubForm } from '../orders/CounterpartySubForm';

export function AddRuleForm({
  onSubmit,
  onCancel,
  isPending,
}: {
  onSubmit: (body: Record<string, unknown>) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [workName, setWorkName] = useState('');
  const [intervalKm, setIntervalKm] = useState('');
  const [intervalMonths, setIntervalMonths] = useState('');
  const [lastKm, setLastKm] = useState('');
  const [lastDate, setLastDate] = useState('');

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-slate-700">Новый регламент</p>
      <input
        type="text"
        value={workName}
        onChange={(e) => setWorkName(e.target.value)}
        placeholder="Название работы (напр. Замена масла)"
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          value={intervalKm}
          onChange={(e) => setIntervalKm(e.target.value)}
          placeholder="Интервал, км"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="number"
          value={intervalMonths}
          onChange={(e) => setIntervalMonths(e.target.value)}
          placeholder="Интервал, мес."
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          value={lastKm}
          onChange={(e) => setLastKm(e.target.value)}
          placeholder="Последний раз, км"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={lastDate}
          onChange={(e) => setLastDate(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 border border-slate-300 text-slate-600 rounded-lg py-2 text-sm font-semibold"
        >
          Отмена
        </button>
        <button
          disabled={!workName || isPending}
          onClick={() =>
            onSubmit({
              work_name: workName,
              interval_km: intervalKm,
              interval_months: intervalMonths,
              last_done_km: lastKm,
              last_done_at: lastDate,
            })
          }
          className="flex-1 bg-slate-900 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-40"
        >
          Добавить
        </button>
      </div>
    </div>
  );
}

export function AddRecForm({
  onSubmit,
  onCancel,
  isPending,
}: {
  onSubmit: (text: string, dueKm: string, dueDate: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [text, setText] = useState('');
  const [dueKm, setDueKm] = useState('');
  const [dueDate, setDueDate] = useState('');

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-slate-700">Новая рекомендация</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Что рекомендует мастер..."
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          value={dueKm}
          onChange={(e) => setDueKm(e.target.value)}
          placeholder="Сделать до, км"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 border border-slate-300 text-slate-600 rounded-lg py-2 text-sm font-semibold"
        >
          Отмена
        </button>
        <button
          disabled={!text || isPending}
          onClick={() => onSubmit(text, dueKm, dueDate)}
          className="flex-1 bg-slate-900 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-40"
        >
          Добавить
        </button>
      </div>
    </div>
  );
}

export function CreateVehicleModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id?: string) => void;
}) {
  const [form, setForm] = useState({
    brand: '',
    model: '',
    year: '',
    reg_number: '',
    vin: '',
    color: '',
    odometer_last: '',
    notes: '',
  });
  const [selectedCounterparty, setSelectedCounterparty] = useState<CounterpartyOption | null>(null);
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/garage/client-vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, counterparty_id: selectedCounterparty?.id ?? null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Ошибка');
      return d;
    },
    onSuccess: (data) => onCreated(data.id),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Новый автомобиль клиента</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                Марка *
              </label>
              <input
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="Toyota"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                Модель
              </label>
              <input
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="Camry"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                Госномер *
              </label>
              <input
                value={form.reg_number}
                onChange={(e) => setForm({ ...form, reg_number: e.target.value })}
                placeholder="А123ВС96"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                Год
              </label>
              <input
                type="number"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
                placeholder="2020"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                VIN
              </label>
              <input
                value={form.vin}
                onChange={(e) => setForm({ ...form, vin: e.target.value })}
                placeholder="JTMBE..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                Цвет
              </label>
              <input
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                placeholder="Белый"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
              Клиент
            </label>
            <CounterpartySubForm
              value={selectedCounterparty}
              onChange={setSelectedCounterparty}
              stoOnly
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
              Текущий одометр, км
            </label>
            <input
              type="number"
              value={form.odometer_last}
              onChange={(e) => setForm({ ...form, odometer_last: e.target.value })}
              placeholder="150000"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="border-t border-slate-100 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-slate-300 text-slate-700 font-semibold py-2.5 rounded-xl text-sm"
          >
            Отмена
          </button>
          <button
            disabled={!form.brand || !form.reg_number || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="flex-1 bg-slate-900 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-40"
          >
            {createMutation.isPending ? '...' : 'Добавить автомобиль'}
          </button>
        </div>
      </div>
    </div>
  );
}
