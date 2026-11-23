'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function CreateClientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [client, setClient] = useState({ name: '', phone: '' });
  const [vehicle, setVehicle] = useState({
    brand: '',
    model: '',
    reg_number: '',
    year: '',
    vin: '',
    color: '',
  });
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/garage/sto-clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...client, ...vehicle }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Ошибка');
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sto-clients'] });
      onCreated();
    },
    onError: (e: Error) => setError(e.message),
  });

  const canSubmit = client.name.trim() && vehicle.brand.trim() && vehicle.reg_number.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Новый клиент СТО</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-6 space-y-5">
          {/* Клиент */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Клиент</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                  Имя / организация *
                </label>
                <input
                  value={client.name}
                  onChange={(e) => setClient({ ...client, name: e.target.value })}
                  placeholder="Иванов Иван"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                  Телефон
                </label>
                <input
                  value={client.phone}
                  onChange={(e) => setClient({ ...client, phone: e.target.value })}
                  placeholder="+7 900 000-00-00"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Автомобиль */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
              Автомобиль
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                    Марка *
                  </label>
                  <input
                    value={vehicle.brand}
                    onChange={(e) => setVehicle({ ...vehicle, brand: e.target.value })}
                    placeholder="Toyota"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                    Модель
                  </label>
                  <input
                    value={vehicle.model}
                    onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })}
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
                    value={vehicle.reg_number}
                    onChange={(e) => setVehicle({ ...vehicle, reg_number: e.target.value })}
                    placeholder="А123ВС96"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                    Год
                  </label>
                  <input
                    value={vehicle.year}
                    onChange={(e) => setVehicle({ ...vehicle, year: e.target.value })}
                    placeholder="2020"
                    type="number"
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
                    value={vehicle.vin}
                    onChange={(e) => setVehicle({ ...vehicle, vin: e.target.value })}
                    placeholder="JTMBE..."
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                    Цвет
                  </label>
                  <input
                    value={vehicle.color}
                    onChange={(e) => setVehicle({ ...vehicle, color: e.target.value })}
                    placeholder="Белый"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
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
            onClick={() => mutation.mutate()}
            disabled={!canSubmit || mutation.isPending}
            className="flex-1 bg-slate-900 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-40"
          >
            {mutation.isPending ? '...' : 'Добавить клиента'}
          </button>
        </div>
      </div>
    </div>
  );
}
