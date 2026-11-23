'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@saldacargo/ui';
import type { ClientVehicle, CounterpartyOption } from '../types';
import { CounterpartySubForm } from './CounterpartySubForm';

export function ClientVehicleSelector({
  value,
  onChange,
}: {
  value: ClientVehicle | null;
  onChange: (v: ClientVehicle | null) => void;
}) {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newBrand, setNewBrand] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newReg, setNewReg] = useState('');
  const [newCounterparty, setNewCounterparty] = useState<CounterpartyOption | null>(null);
  const queryClient = useQueryClient();

  const { data: results = [], isFetching } = useQuery<ClientVehicle[]>({
    queryKey: ['client-vehicles-search', search],
    queryFn: async () => {
      const r = await fetch(`/api/garage/client-vehicles?search=${encodeURIComponent(search)}`);
      if (!r.ok) throw new Error('Ошибка загрузки');
      return r.json();
    },
    staleTime: 10_000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newBrand.trim() || !newReg.trim()) throw new Error('Марка и госномер обязательны');
      const r = await fetch('/api/garage/client-vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: newBrand.trim(),
          model: newModel.trim() || null,
          reg_number: newReg.trim(),
          counterparty_id: newCounterparty?.id ?? null,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Ошибка');
      return r.json() as Promise<ClientVehicle>;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['client-vehicles-search'] });
      onChange(created);
      setShowCreate(false);
      setNewBrand('');
      setNewModel('');
      setNewReg('');
      setNewCounterparty(null);
    },
  });

  if (value) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {value.brand} {value.model} · {value.reg_number}
          </p>
          {value.counterparty && (
            <p className="text-xs text-slate-500">{value.counterparty.name}</p>
          )}
        </div>
        <button
          onClick={() => onChange(null)}
          className="text-slate-400 hover:text-slate-700 text-lg font-bold leading-none ml-3"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowCreate(false);
          }}
          placeholder="Поиск по марке, модели, госномеру..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
        {isFetching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            ...
          </span>
        )}
      </div>

      {results.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
          {results.map((v, i) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                onChange(v);
                setSearch('');
              }}
              className={cn(
                'w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors',
                i < results.length - 1 && 'border-b border-slate-100',
              )}
            >
              <p className="text-sm font-medium text-slate-900">
                {v.brand} {v.model} · {v.reg_number}
              </p>
              {v.counterparty && <p className="text-xs text-slate-400">{v.counterparty.name}</p>}
            </button>
          ))}
        </div>
      )}

      {!showCreate ? (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
        >
          + Добавить новый автомобиль
        </button>
      ) : (
        <div className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50">
          <p className="text-xs font-semibold text-slate-500 uppercase">Новый автомобиль</p>
          <input
            value={newBrand}
            onChange={(e) => setNewBrand(e.target.value)}
            placeholder="Марка (Toyota) *"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
          />
          <input
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            placeholder="Модель (Camry)"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
          />
          <input
            value={newReg}
            onChange={(e) => setNewReg(e.target.value)}
            placeholder="Госномер (А001АА96) *"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
          />
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">
              Клиент (необязательно)
            </p>
            <CounterpartySubForm value={newCounterparty} onChange={setNewCounterparty} />
          </div>
          {createMutation.isError && (
            <p className="text-xs text-red-500">{(createMutation.error as Error).message}</p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setNewCounterparty(null);
              }}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 text-slate-600"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="flex-[2] py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white disabled:bg-slate-400"
            >
              {createMutation.isPending ? 'Сохраняем...' : 'Сохранить и выбрать'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
