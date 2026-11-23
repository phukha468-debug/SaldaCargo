'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@saldacargo/ui';
import type { CounterpartyOption } from '../types';

export function CounterpartySubForm({
  value,
  onChange,
  stoOnly = false,
}: {
  value: CounterpartyOption | null;
  onChange: (v: CounterpartyOption | null) => void;
  stoOnly?: boolean;
}) {
  const [cpSearch, setCpSearch] = useState('');
  const [showNewCp, setShowNewCp] = useState(false);
  const [newCpName, setNewCpName] = useState('');
  const [newCpPhone, setNewCpPhone] = useState('');
  const queryClient = useQueryClient();

  const { data: cpResults = [] } = useQuery<CounterpartyOption[]>({
    queryKey: ['cp-search', cpSearch, stoOnly],
    queryFn: async () => {
      const params = new URLSearchParams({ q: cpSearch });
      if (stoOnly) params.set('sto_only', '1');
      const r = await fetch(`/api/counterparties/search?${params}`);
      if (!r.ok) throw new Error('Ошибка загрузки');
      return r.json();
    },
    staleTime: 10_000,
  });

  const createCpMutation = useMutation({
    mutationFn: async () => {
      if (!newCpName.trim()) throw new Error('Введите имя клиента');
      const r = await fetch('/api/counterparties/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCpName.trim(), phone: newCpPhone.trim() || null }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Ошибка');
      return r.json() as Promise<CounterpartyOption>;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['cp-search'] });
      onChange(created);
      setShowNewCp(false);
      setNewCpName('');
      setNewCpPhone('');
    },
  });

  if (value) {
    return (
      <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{value.name}</p>
          {value.phone && <p className="text-xs text-slate-400">{value.phone}</p>}
        </div>
        <button
          onClick={() => onChange(null)}
          className="text-slate-400 hover:text-slate-600 text-lg leading-none ml-2"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {!showNewCp ? (
        <>
          <input
            value={cpSearch}
            onChange={(e) => setCpSearch(e.target.value)}
            placeholder="Поиск клиента по имени/телефону..."
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
          />
          {cpResults.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-32 overflow-y-auto">
              {cpResults.map((cp, i) => (
                <button
                  key={cp.id}
                  type="button"
                  onClick={() => {
                    onChange(cp);
                    setCpSearch('');
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 hover:bg-slate-50 text-sm',
                    i < cpResults.length - 1 && 'border-b border-slate-100',
                  )}
                >
                  <span className="font-medium text-slate-900">{cp.name}</span>
                  {cp.phone && <span className="text-slate-400 text-xs ml-2">{cp.phone}</span>}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowNewCp(true)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            + Новый клиент
          </button>
        </>
      ) : (
        <div className="space-y-1.5 bg-blue-50 border border-blue-100 rounded-lg p-2.5">
          <input
            value={newCpName}
            onChange={(e) => setNewCpName(e.target.value)}
            placeholder="Имя клиента *"
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
          />
          <input
            value={newCpPhone}
            onChange={(e) => setNewCpPhone(e.target.value)}
            placeholder="Телефон"
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
          />
          {createCpMutation.isError && (
            <p className="text-xs text-red-500">{(createCpMutation.error as Error).message}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowNewCp(false)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 text-slate-600"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => createCpMutation.mutate()}
              disabled={createCpMutation.isPending}
              className="flex-[2] py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white disabled:bg-blue-300"
            >
              {createCpMutation.isPending ? '...' : 'Добавить клиента'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
