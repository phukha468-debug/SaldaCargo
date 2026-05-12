'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Money } from '@saldacargo/ui';

type Client = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  credit_limit: string | null;
  is_active: boolean;
  total_revenue: string;
  revenue_30d: string;
  trips_count: number;
  orders_count: number;
  avg_order: string;
  last_trip_at: string | null;
  outstanding_debt: string;
  preferred_payment: string | null;
  payment_breakdown: Record<string, number>;
};

const PAYMENT_LABEL: Record<string, string> = {
  cash: '💵 Нал',
  qr: '📱 QR',
  card_driver: '💳 Карта',
  debt_cash: '⏳ Долг',
};

const emptyForm = { name: '', phone: '', credit_limit: '', notes: '' };

function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function LastTripBadge({ date }: { date: string | null }) {
  const days = daysAgo(date);
  if (days === null)
    return <span className="text-[10px] font-bold text-slate-300 uppercase">Рейсов нет</span>;
  if (days === 0)
    return <span className="text-[10px] font-bold text-emerald-600 uppercase">Сегодня</span>;
  if (days <= 7)
    return (
      <span className="text-[10px] font-bold text-emerald-500 uppercase">{days} дн. назад</span>
    );
  if (days <= 30)
    return <span className="text-[10px] font-bold text-slate-400 uppercase">{days} дн. назад</span>;
  if (days <= 90)
    return <span className="text-[10px] font-bold text-amber-500 uppercase">{days} дн. назад</span>;
  return <span className="text-[10px] font-bold text-rose-400 uppercase">{days} дн. назад</span>;
}

function PaymentPills({ breakdown }: { breakdown: Record<string, number> }) {
  const entries = Object.entries(breakdown)
    .filter(([, pct]) => pct > 0)
    .sort(([, a], [, b]) => b - a);
  if (entries.length === 0) return null;
  return (
    <div className="flex gap-1.5 flex-wrap">
      {entries.map(([pm, pct]) => (
        <span
          key={pm}
          className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500"
        >
          {PAYMENT_LABEL[pm] ?? pm} {pct}%
        </span>
      ))}
    </div>
  );
}

export default function ClientsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'active' | 'debt'>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => fetch('/api/counterparties').then((r) => r.json()),
    staleTime: 60000,
  });

  const saveMutation = useMutation({
    mutationFn: (body: typeof emptyForm) => {
      const url = editId ? `/api/counterparties/${editId}` : '/api/counterparties';
      return fetch(url, {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? 'Ошибка');
        return json;
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      setFormError('');
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const toggleActive = (client: Client) => {
    fetch(`/api/counterparties/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !client.is_active }),
    }).then(() => qc.invalidateQueries({ queryKey: ['clients'] }));
  };

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (c: Client) => {
    setEditId(c.id);
    setForm({
      name: c.name,
      phone: c.phone ?? '',
      credit_limit: c.credit_limit ?? '',
      notes: c.notes ?? '',
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      setFormError('Введите название');
      return;
    }
    saveMutation.mutate(form);
  };

  // Фильтрация
  const visible = clients.filter((c) => {
    if (!showInactive && !c.is_active) return false;
    if (filter === 'active') return parseFloat(c.revenue_30d) > 0;
    if (filter === 'debt') return parseFloat(c.outstanding_debt) > 0;
    return true;
  });

  // KPI
  const activeCount = clients.filter((c) => c.is_active && parseFloat(c.revenue_30d) > 0).length;
  const totalRevenue = clients
    .filter((c) => c.is_active)
    .reduce((s, c) => s + parseFloat(c.total_revenue), 0);
  const totalDebt = clients
    .filter((c) => c.is_active)
    .reduce((s, c) => s + parseFloat(c.outstanding_debt), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Постоянные клиенты</h1>
          <p className="text-sm text-slate-500 mt-0.5">Аналитика по клиентам с историей заказов</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
        >
          + Добавить
        </button>
      </div>

      {/* KPI полоса */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Всего клиентов',
            value: clients.filter((c) => c.is_active).length,
            sub: null,
            color: 'text-slate-900',
          },
          {
            label: 'Активны (30 дн.)',
            value: activeCount,
            sub: null,
            color: 'text-emerald-600',
          },
          {
            label: 'Выручка (всего)',
            value: <Money amount={totalRevenue.toFixed(2)} />,
            sub: null,
            color: 'text-orange-600',
          },
          {
            label: 'Долгов',
            value: <Money amount={totalDebt.toFixed(2)} />,
            sub: null,
            color: totalDebt > 0 ? 'text-amber-600' : 'text-slate-300',
          },
        ].map((kpi, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {kpi.label}
            </p>
            <p className={`text-xl font-black mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Форма */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-700">
            {editId ? 'Редактировать клиента' : 'Новый постоянный клиент'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Название / Имя *
              </label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                placeholder="ООО Агрострой или Иванов П.П."
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Телефон</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                placeholder="+7 999 123-45-67"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Кредитный лимит (₽)
              </label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                placeholder="50 000"
                type="number"
                value={form.credit_limit}
                onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Максимальный допустимый долг</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Примечание</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                placeholder="Постоянный с 2024, возит строй. материалы"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          {formError && <p className="text-xs text-rose-600 font-medium">{formError}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={saveMutation.isPending}
              className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setEditId(null);
                setFormError('');
              }}
              className="text-sm text-slate-500 px-4 py-2 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Фильтры */}
      <div className="flex items-center gap-2 flex-wrap">
        {(
          [
            { key: 'all', label: 'Все' },
            { key: 'active', label: 'Активны (30 дн.)' },
            { key: 'debt', label: 'С долгом' },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors ${
              filter === f.key
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
          Показать архивных
        </label>
      </div>

      {/* Карточки */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-5xl mb-3">🏢</p>
          <p className="font-semibold text-slate-500">
            {filter !== 'all' ? 'Нет клиентов по этому фильтру' : 'Клиентов нет'}
          </p>
          {filter === 'all' && (
            <p className="text-sm text-slate-400 mt-1">
              Нажмите «+ Добавить» чтобы создать карточку
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((c) => {
            const debt = parseFloat(c.outstanding_debt);
            const limit = parseFloat(c.credit_limit ?? '0');
            const limitPct = limit > 0 ? Math.min((debt / limit) * 100, 100) : 0;
            const hasRevenue = parseFloat(c.total_revenue) > 0;
            const days = daysAgo(c.last_trip_at);

            return (
              <div
                key={c.id}
                className={`bg-white border rounded-xl p-5 space-y-4 shadow-sm hover:shadow-md transition-shadow ${
                  !c.is_active ? 'opacity-50 border-slate-100' : 'border-slate-200'
                }`}
              >
                {/* Шапка карточки */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
                        days !== null && days <= 7
                          ? 'bg-emerald-100 text-emerald-700'
                          : days !== null && days <= 30
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-sm leading-tight truncate">
                        {c.name}
                      </p>
                      {c.phone && <p className="text-xs text-slate-500 mt-0.5">{c.phone}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => openEdit(c)}
                      className="text-xs text-slate-400 hover:text-slate-700 px-2 py-1 rounded border border-slate-200 hover:border-slate-300 transition-colors"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => toggleActive(c)}
                      className="text-xs text-slate-400 hover:text-slate-700 px-2 py-1 rounded border border-slate-200 hover:border-slate-300 transition-colors"
                      title={c.is_active ? 'В архив' : 'Восстановить'}
                    >
                      {c.is_active ? '⊗' : '↺'}
                    </button>
                  </div>
                </div>

                {/* Примечание */}
                {c.notes && (
                  <p className="text-xs text-slate-400 italic leading-tight">{c.notes}</p>
                )}

                {/* Три метрики */}
                <div className="grid grid-cols-3 gap-0 border border-slate-100 rounded-lg overflow-hidden">
                  <div className="px-3 py-2.5 text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      Выручка
                    </p>
                    {hasRevenue ? (
                      <Money
                        amount={c.total_revenue}
                        className="text-sm font-black text-slate-900 leading-tight"
                      />
                    ) : (
                      <p className="text-sm font-black text-slate-300">—</p>
                    )}
                  </div>
                  <div className="px-3 py-2.5 text-center border-x border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      Рейсов
                    </p>
                    <p className="text-sm font-black text-slate-900 leading-tight">
                      {c.trips_count || '—'}
                    </p>
                  </div>
                  <div className="px-3 py-2.5 text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      Средний
                    </p>
                    {parseFloat(c.avg_order) > 0 ? (
                      <Money
                        amount={c.avg_order}
                        className="text-sm font-black text-slate-900 leading-tight"
                      />
                    ) : (
                      <p className="text-sm font-black text-slate-300">—</p>
                    )}
                  </div>
                </div>

                {/* Активность + динамика */}
                <div className="flex items-center justify-between">
                  <LastTripBadge date={c.last_trip_at} />
                  {parseFloat(c.revenue_30d) > 0 && (
                    <span className="text-[10px] font-bold text-emerald-600">
                      +<Money amount={c.revenue_30d} /> за 30 дн.
                    </span>
                  )}
                </div>

                {/* Долг + кредитный лимит */}
                {debt > 0 && (
                  <div
                    className={`rounded-lg px-3 py-2 space-y-1.5 ${
                      limit > 0 && limitPct >= 80
                        ? 'bg-rose-50 border border-rose-200'
                        : 'bg-amber-50 border border-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold ${
                          limit > 0 && limitPct >= 80 ? 'text-rose-700' : 'text-amber-700'
                        }`}
                      >
                        ⚠ Долг
                      </span>
                      <Money
                        amount={c.outstanding_debt}
                        className={`text-sm font-black ${
                          limit > 0 && limitPct >= 80 ? 'text-rose-700' : 'text-amber-700'
                        }`}
                      />
                    </div>
                    {limit > 0 && (
                      <div>
                        <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                          <span>Лимит</span>
                          <span>
                            <Money amount={c.outstanding_debt} /> /{' '}
                            <Money amount={c.credit_limit!} />
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/70 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              limitPct >= 80 ? 'bg-rose-400' : 'bg-amber-400'
                            }`}
                            style={{ width: `${limitPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Способы оплаты */}
                {Object.keys(c.payment_breakdown).length > 0 && (
                  <PaymentPills breakdown={c.payment_breakdown} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
