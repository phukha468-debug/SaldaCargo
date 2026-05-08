'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Money } from '@saldacargo/ui';

type Counterparty = {
  id: string;
  name: string;
  phone: string | null;
  type: 'client' | 'supplier' | 'both';
  credit_limit: string | null;
  notes: string | null;
  is_active: boolean;
  outstanding_debt: string;
};

const TYPE_LABEL: Record<string, string> = {
  client: 'Клиент',
  supplier: 'Поставщик',
  both: 'Клиент и поставщик',
};

const TYPE_COLOR: Record<string, string> = {
  client: 'bg-sky-100 text-sky-700',
  supplier: 'bg-violet-100 text-violet-700',
  both: 'bg-teal-100 text-teal-700',
};

const FILTERS = [
  { key: '', label: 'Все' },
  { key: 'client', label: 'Клиенты' },
  { key: 'supplier', label: 'Поставщики' },
  { key: 'both', label: 'Оба' },
] as const;

const emptyForm = { name: '', type: 'client', phone: '', credit_limit: '', notes: '' };

export default function CounterpartiesPage() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const { data: counterparties = [], isLoading } = useQuery<Counterparty[]>({
    queryKey: ['counterparties', typeFilter],
    queryFn: () => {
      const params = typeFilter ? `?type=${typeFilter}` : '';
      return fetch(`/api/counterparties${params}`).then((r) => r.json());
    },
    staleTime: 30000,
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof emptyForm) =>
      fetch('/api/counterparties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? 'Ошибка');
        return json;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['counterparties'] });
      setShowForm(false);
      setForm(emptyForm);
      setFormError('');
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Partial<typeof emptyForm & { is_active: boolean }>;
    }) =>
      fetch(`/api/counterparties/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? 'Ошибка');
        return json;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['counterparties'] });
      setEditId(null);
      setForm(emptyForm);
      setFormError('');
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (cp: Counterparty) => {
    setEditId(cp.id);
    setForm({
      name: cp.name,
      type: cp.type,
      phone: cp.phone ?? '',
      credit_limit: cp.credit_limit ?? '',
      notes: cp.notes ?? '',
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      setFormError('Введите название');
      return;
    }
    if (editId) {
      updateMutation.mutate({ id: editId, body: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleDelete = (cp: Counterparty) => {
    if (!window.confirm(`Удалить контрагента "${cp.name}"? Это действие необратимо.`)) return;
    updateMutation.mutate({ id: cp.id, body: { is_active: false } });
  };

  const handleRestore = (cp: Counterparty) => {
    updateMutation.mutate({ id: cp.id, body: { is_active: true } });
  };

  const visible = counterparties.filter((cp) => (showInactive ? true : cp.is_active));

  const totalDebt = counterparties
    .filter((cp) => cp.is_active)
    .reduce((s, cp) => s + parseFloat(cp.outstanding_debt), 0)
    .toFixed(2);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Контрагенты</h1>
        <button
          onClick={openCreate}
          className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
        >
          + Добавить
        </button>
      </div>

      {/* Форма создания / редактирования */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-700">
            {editId ? 'Редактировать контрагента' : 'Новый контрагент'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Название *</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                placeholder="ООО Агрострой"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Тип</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="client">Клиент</option>
                <option value="supplier">Поставщик</option>
                <option value="both">Клиент и поставщик</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Телефон</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                placeholder="+79001234567"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Кредитный лимит (₽)
              </label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                placeholder="50000"
                type="number"
                value={form.credit_limit}
                onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-500 block mb-1">Примечание</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                placeholder="Любая дополнительная информация"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          {formError && <p className="text-xs text-rose-600 font-medium">{formError}</p>}

          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setEditId(null);
                setFormError('');
              }}
              className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg border border-slate-200 transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Фильтры */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setTypeFilter(f.key)}
            className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors ${
              typeFilter === f.key
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="accent-slate-700"
          />
          Показать неактивных
        </label>
      </div>

      {/* Сводка долга */}
      {parseFloat(totalDebt) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <span className="text-amber-600 font-bold text-sm">Общий долг контрагентов:</span>
          <span className="text-amber-700 font-bold text-lg">
            <Money amount={totalDebt} />
          </span>
        </div>
      )}

      {/* Таблица */}
      <section className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Список</h2>
          <span className="text-xs text-slate-400">{visible.length} записей</span>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-4xl mb-3">🏢</p>
            <p className="font-medium text-slate-500">Контрагентов нет</p>
            <p className="text-sm mt-1">Нажмите «+ Добавить» чтобы создать первого</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visible.map((cp) => (
              <div
                key={cp.id}
                className={`px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors ${!cp.is_active ? 'opacity-50' : ''}`}
              >
                {/* Основная инфа */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 text-sm">{cp.name}</span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${TYPE_COLOR[cp.type]}`}
                    >
                      {TYPE_LABEL[cp.type]}
                    </span>
                    {!cp.is_active && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">
                        Неактивен
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-0.5">
                    {cp.phone && <span className="text-xs text-slate-500">{cp.phone}</span>}
                    {cp.credit_limit && (
                      <span className="text-xs text-slate-500">
                        лимит: <Money amount={cp.credit_limit} />
                      </span>
                    )}
                    {cp.notes && (
                      <span className="text-xs text-slate-400 italic truncate max-w-xs">
                        {cp.notes}
                      </span>
                    )}
                  </div>
                </div>

                {/* Долг */}
                {parseFloat(cp.outstanding_debt) > 0 && (
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Долг</p>
                    <p className="text-sm font-bold text-amber-600">
                      <Money amount={cp.outstanding_debt} />
                    </p>
                  </div>
                )}

                {/* Действия */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(cp)}
                    className="text-xs text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded border border-slate-200 hover:border-slate-300 transition-colors"
                  >
                    Изменить
                  </button>
                  {cp.is_active ? (
                    <button
                      onClick={() => handleDelete(cp)}
                      className="text-xs px-3 py-1.5 rounded border transition-colors text-slate-400 hover:text-rose-600 border-slate-200 hover:border-rose-200"
                    >
                      Удалить
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRestore(cp)}
                      className="text-xs px-3 py-1.5 rounded border transition-colors text-emerald-600 hover:text-emerald-700 border-emerald-200 hover:border-emerald-300"
                    >
                      Восстановить
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
