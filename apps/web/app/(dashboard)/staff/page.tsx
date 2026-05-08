'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Money } from '@saldacargo/ui';

// ─── Types ───────────────────────────────────────────────────────────────────

type UserRole =
  | 'owner'
  | 'admin'
  | 'driver'
  | 'loader'
  | 'mechanic'
  | 'mechanic_lead'
  | 'accountant';

type StaffUser = {
  id: string;
  name: string;
  phone: string | null;
  max_user_id: string | null;
  roles: UserRole[];
  current_asset_id: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
};

type Asset = { id: string; short_name: string; reg_number: string };

type DriverStats = {
  role: 'driver';
  trip_count: number;
  approved_count: number;
  total_earned: string;
  total_revenue: string;
  trips: {
    id: string;
    trip_number: number;
    started_at: string;
    lifecycle_status: string;
    trip_type: string;
    asset: { short_name: string; reg_number: string } | null;
    order_total: string;
    driver_pay_total: string;
    orders: {
      amount: string;
      driver_pay: string;
      payment_method: string;
      description: string | null;
    }[];
  }[];
};

type MechanicStats = {
  role: 'mechanic';
  order_count: number;
  completed_count: number;
  total_minutes: number;
  orders: {
    id: string;
    order_number: number;
    status: string;
    machine_type: string;
    problem_description: string | null;
    created_at: string;
    asset: { short_name: string; reg_number: string } | null;
    works: { name: string; actual_minutes: number; status: string }[];
  }[];
};

type StaffStats = DriverStats | MechanicStats | { role: 'other' };

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<UserRole, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  driver: 'Водитель',
  loader: 'Грузчик',
  mechanic: 'Механик',
  mechanic_lead: 'Ст. механик',
  accountant: 'Бухгалтер',
};

const ROLE_COLOR: Record<UserRole, string> = {
  owner: 'bg-violet-100 text-violet-700',
  admin: 'bg-blue-100 text-blue-700',
  driver: 'bg-emerald-100 text-emerald-700',
  loader: 'bg-orange-100 text-orange-700',
  mechanic: 'bg-amber-100 text-amber-700',
  mechanic_lead: 'bg-amber-200 text-amber-800',
  accountant: 'bg-slate-100 text-slate-600',
};

const ALL_ROLES: UserRole[] = [
  'driver',
  'mechanic',
  'mechanic_lead',
  'loader',
  'admin',
  'owner',
  'accountant',
];

const GROUP_ORDER: UserRole[] = [
  'driver',
  'mechanic',
  'mechanic_lead',
  'loader',
  'admin',
  'owner',
  'accountant',
];

const emptyForm = {
  name: '',
  phone: '',
  max_user_id: '',
  roles: [] as UserRole[],
  current_asset_id: '',
  notes: '',
};

// ─── Modal ───────────────────────────────────────────────────────────────────

function StaffModal({
  editUser,
  assets,
  onClose,
  onSaved,
}: {
  editUser: StaffUser | null;
  assets: Asset[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(
    editUser
      ? {
          name: editUser.name,
          phone: editUser.phone ?? '',
          max_user_id: editUser.max_user_id ?? '',
          roles: editUser.roles,
          current_asset_id: editUser.current_asset_id ?? '',
          notes: editUser.notes ?? '',
        }
      : emptyForm,
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const f =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const toggleRole = (role: UserRole) =>
    setForm((p) => ({
      ...p,
      roles: p.roles.includes(role) ? p.roles.filter((r) => r !== role) : [...p.roles, role],
    }));

  const save = async () => {
    if (!form.name.trim()) {
      setError('Имя обязательно');
      return;
    }
    if (!form.roles.length) {
      setError('Выберите хотя бы одну роль');
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      name: form.name,
      phone: form.phone || null,
      max_user_id: form.max_user_id || null,
      roles: form.roles,
      current_asset_id: form.current_asset_id || null,
      notes: form.notes || null,
    };

    const url = editUser ? `/api/users/${editUser.id}` : '/api/users';
    const method = editUser ? 'PATCH' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? 'Ошибка');
      return;
    }
    onSaved();
  };

  const inputCls =
    'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">
            {editUser ? 'Редактировать сотрудника' : 'Добавить сотрудника'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Имя *</label>
            <input
              className={inputCls}
              placeholder="Иван Иванович"
              value={form.name}
              onChange={f('name')}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-2">Роли *</label>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  className={`text-xs font-bold px-3 py-1 rounded-full border transition-colors ${
                    form.roles.includes(role)
                      ? `${ROLE_COLOR[role]} border-transparent`
                      : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {ROLE_LABEL[role]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Телефон</label>
              <input
                className={inputCls}
                placeholder="+79001234567"
                value={form.phone}
                onChange={f('phone')}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">MAX user_id</label>
              <input
                className={inputCls}
                placeholder="ID в МАХ"
                value={form.max_user_id}
                onChange={f('max_user_id')}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Закреплённая машина
            </label>
            <select
              className={inputCls}
              value={form.current_asset_id}
              onChange={f('current_asset_id')}
            >
              <option value="">— не назначена —</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.short_name} ({a.reg_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Примечание</label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={form.notes}
              onChange={f('notes')}
            />
          </div>

          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="bg-slate-900 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-700 px-5 py-2.5 rounded-xl border border-slate-200 transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Panel ────────────────────────────────────────────────────────────

const TRIP_TYPE_LABEL: Record<string, string> = {
  local: 'Городской',
  intercity: 'Межгород',
  moving: 'Переезд',
  hourly: 'Почасовой',
};

const LC_LABEL: Record<string, { label: string; cls: string }> = {
  approved: { label: 'Одобрен', cls: 'bg-emerald-100 text-emerald-700' },
  draft: { label: 'На ревью', cls: 'bg-amber-100 text-amber-700' },
  returned: { label: 'Возвращён', cls: 'bg-rose-100 text-rose-600' },
};

const ORDER_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  completed: { label: 'Выполнен', cls: 'bg-emerald-100 text-emerald-700' },
  in_progress: { label: 'В работе', cls: 'bg-blue-100 text-blue-700' },
  created: { label: 'Создан', cls: 'bg-slate-100 text-slate-500' },
};

function fmt(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}

function StaffDetailPanel({ user, onClose }: { user: StaffUser; onClose: () => void }) {
  const { data: stats, isLoading } = useQuery<StaffStats>({
    queryKey: ['staff-stats', user.id],
    queryFn: () => fetch(`/api/staff/${user.id}`).then((r) => r.json()),
    staleTime: 60000,
  });

  const now = new Date();
  const monthLabel = now.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-3 sticky top-0 bg-white z-10">
          <div>
            <p className="font-black text-lg text-slate-900">{user.name}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {user.roles.map((r) => (
                <span
                  key={r}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_COLOR[r]}`}
                >
                  {ROLE_LABEL[r]}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1 capitalize">{monthLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none mt-0.5"
          >
            ×
          </button>
        </div>

        <div className="flex-1 p-6 space-y-6">
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {/* ── Водитель ── */}
          {!isLoading && stats && stats.role === 'driver' && (
            <>
              {/* KPI */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: 'Рейсов',
                    value: stats.trip_count,
                    sub: `${stats.approved_count} одобрено`,
                    color: 'text-slate-900',
                  },
                  {
                    label: 'Заработал',
                    value: <Money amount={stats.total_earned} />,
                    sub: 'ЗП с кассовых рейсов',
                    color: 'text-emerald-600',
                  },
                  {
                    label: 'Выручка компании',
                    value: <Money amount={stats.total_revenue} />,
                    sub: 'все заказы',
                    color: 'text-slate-700',
                  },
                  {
                    label: 'Нагрузка',
                    value: `${Math.round((parseFloat(stats.total_earned) / (parseFloat(stats.total_revenue) || 1)) * 100)}%`,
                    sub: 'ЗП / выручка',
                    color: 'text-slate-500',
                  },
                ].map(({ label, value, sub, color }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      {label}
                    </p>
                    <p className={`text-xl font-black ${color}`}>{value}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>

              {/* Список рейсов */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                  Рейсы
                </p>
                {stats.trips.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">
                    Рейсов в этом месяце нет
                  </p>
                ) : (
                  <div className="space-y-2">
                    {stats.trips.map((t) => {
                      const lc = LC_LABEL[t.lifecycle_status] ?? {
                        label: t.lifecycle_status,
                        cls: 'bg-slate-100 text-slate-500',
                      };
                      return (
                        <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800 text-sm">
                                #{t.trip_number}
                              </span>
                              <span className="text-xs text-slate-400">
                                {TRIP_TYPE_LABEL[t.trip_type] ?? t.trip_type}
                              </span>
                              {t.asset && (
                                <span className="text-xs text-slate-400">
                                  · {t.asset.short_name}
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${lc.cls}`}
                            >
                              {lc.label}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">
                              {new Date(t.started_at).toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </span>
                            <div className="flex gap-4">
                              <span className="text-slate-500">
                                Выручка:{' '}
                                <span className="font-bold text-slate-800">
                                  <Money amount={t.order_total} />
                                </span>
                              </span>
                              <span className="text-emerald-600">
                                ЗП:{' '}
                                <span className="font-bold">
                                  <Money amount={t.driver_pay_total} />
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Механик ── */}
          {!isLoading && stats && stats.role === 'mechanic' && (
            <>
              {/* KPI */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Нарядов', value: stats.order_count, color: 'text-slate-900' },
                  { label: 'Выполнено', value: stats.completed_count, color: 'text-emerald-600' },
                  { label: 'Часов', value: fmt(stats.total_minutes), color: 'text-amber-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      {label}
                    </p>
                    <p className={`text-xl font-black ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Список нарядов */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                  Наряды
                </p>
                {stats.orders.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">
                    Нарядов в этом месяце нет
                  </p>
                ) : (
                  <div className="space-y-3">
                    {stats.orders.map((o) => {
                      const st = ORDER_STATUS_LABEL[o.status] ?? {
                        label: o.status,
                        cls: 'bg-slate-100 text-slate-500',
                      };
                      return (
                        <div key={o.id} className="bg-white border border-slate-200 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800 text-sm">
                                №{o.order_number}
                              </span>
                              {o.asset ? (
                                <span className="text-xs text-slate-500">{o.asset.short_name}</span>
                              ) : (
                                <span className="text-xs text-slate-400">Клиентская машина</span>
                              )}
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}
                            >
                              {st.label}
                            </span>
                          </div>
                          {o.problem_description && (
                            <p className="text-xs text-slate-500 mb-2 italic">
                              «{o.problem_description}»
                            </p>
                          )}
                          {o.works.length > 0 && (
                            <div className="space-y-1 border-t border-slate-50 pt-2">
                              {o.works.map((w, i) => (
                                <div key={i} className="flex items-center justify-between text-xs">
                                  <span className="text-slate-600">{w.name}</span>
                                  <span className="text-slate-400 font-medium">
                                    {w.actual_minutes > 0 ? fmt(w.actual_minutes) : '—'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          <p className="text-[10px] text-slate-400 mt-2">
                            {new Date(o.created_at).toLocaleDateString('ru-RU', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {!isLoading && stats && stats.role === 'other' && (
            <div className="text-center py-12">
              <p className="text-3xl mb-3">📊</p>
              <p className="text-slate-400 text-sm">Статистика для этой роли пока не реализована</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

function StaffCard({
  user,
  assetMap,
  onEdit,
  onToggleActive,
  onSelect,
}: {
  user: StaffUser;
  assetMap: Record<string, Asset>;
  onEdit: () => void;
  onToggleActive: () => void;
  onSelect: () => void;
}) {
  const asset = user.current_asset_id ? assetMap[user.current_asset_id] : null;

  return (
    <div
      className={`bg-white border rounded-xl shadow-sm p-4 flex flex-col gap-3 transition-all cursor-pointer hover:shadow-md hover:border-slate-300 ${!user.is_active ? 'opacity-50' : ''}`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-900">{user.name}</p>
          {asset && (
            <p className="text-xs text-slate-400 mt-0.5">
              🚛 {asset.short_name} ({asset.reg_number})
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-1 justify-end">
          {user.roles.map((r) => (
            <span
              key={r}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_COLOR[r]}`}
            >
              {ROLE_LABEL[r]}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        {user.phone && (
          <p className="text-xs text-slate-500">
            <span className="text-slate-400">Тел: </span>
            {user.phone}
          </p>
        )}
        <p className="text-xs text-slate-500">
          <span className="text-slate-400">MAX ID: </span>
          {user.max_user_id ? (
            <span className="text-emerald-600 font-medium">{user.max_user_id}</span>
          ) : (
            <span className="text-rose-400">не привязан</span>
          )}
        </p>
        {user.notes && <p className="text-[11px] text-slate-400 italic">{user.notes}</p>}
      </div>

      <div
        className="flex gap-2 pt-1 border-t border-slate-50"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onEdit}
          className="flex-1 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-lg py-1.5 transition-colors"
        >
          Изменить
        </button>
        <button
          onClick={onToggleActive}
          className={`text-xs font-medium border rounded-lg py-1.5 px-3 transition-colors ${
            user.is_active
              ? 'text-slate-400 hover:text-rose-600 border-slate-100 hover:border-rose-200'
              : 'text-emerald-600 hover:text-emerald-700 border-emerald-100 hover:border-emerald-200'
          }`}
        >
          {user.is_active ? 'Деактивировать' : 'Восстановить'}
        </button>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type GroupFilter = 'all' | UserRole;

export default function StaffPage() {
  const qc = useQueryClient();
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [modalUser, setModalUser] = useState<StaffUser | 'new' | null>(null);
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);

  const { data: users = [], isLoading } = useQuery<StaffUser[]>({
    queryKey: ['staff', showInactive],
    queryFn: () => fetch(`/api/users?includeInactive=${showInactive}`).then((r) => r.json()),
    staleTime: 30000,
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['fleet-list'],
    queryFn: () =>
      fetch('/api/fleet?period=month')
        .then((r) => r.json())
        .then((r) => r.assets ?? []),
    staleTime: 300000,
  });

  const assetMap: Record<string, Asset> = Object.fromEntries(assets.map((a) => [a.id, a]));

  const patchMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  });

  const filtered = users.filter((u) => {
    if (groupFilter === 'all') return true;
    return u.roles.includes(groupFilter as UserRole);
  });

  const counts: Partial<Record<GroupFilter, number>> = { all: users.length };
  for (const role of GROUP_ORDER) {
    counts[role] = users.filter((u) => u.roles.includes(role)).length;
  }

  const FILTER_TABS: { key: GroupFilter; label: string }[] = [
    { key: 'all', label: 'Все' },
    { key: 'driver', label: 'Водители' },
    { key: 'mechanic', label: 'Механики' },
    { key: 'loader', label: 'Грузчики' },
    { key: 'admin', label: 'Администраторы' },
  ];

  return (
    <div className="space-y-6 max-w-[1920px] animate-in fade-in duration-500">
      {/* Заголовок */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Персонал</h1>
        <button
          onClick={() => setModalUser('new')}
          className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors"
        >
          + Добавить сотрудника
        </button>
      </div>

      {/* Сводка */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Всего',
            value: users.filter((u) => u.is_active).length,
            color: 'text-slate-900',
          },
          { label: 'Водителей', value: counts['driver'] ?? 0, color: 'text-emerald-600' },
          {
            label: 'Механиков',
            value: (counts['mechanic'] ?? 0) + (counts['mechanic_lead'] ?? 0),
            color: 'text-amber-600',
          },
          {
            label: 'Без MAX ID',
            value: users.filter((u) => !u.max_user_id && u.is_active).length,
            color: 'text-rose-500',
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              {label}
            </p>
            {isLoading ? (
              <div className="h-7 w-10 bg-slate-100 rounded animate-pulse" />
            ) : (
              <p className={`text-2xl font-black ${color}`}>{value}</p>
            )}
          </div>
        ))}
      </div>

      {/* Фильтры */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-slate-100 p-0.5 rounded-xl">
          {FILTER_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setGroupFilter(key)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                groupFilter === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              {label}
              {counts[key] ? <span className="ml-1 opacity-60">{counts[key]}</span> : null}
            </button>
          ))}
        </div>

        <label className="ml-auto flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded"
          />
          Показать неактивных
        </label>
      </div>

      {/* Карточки */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
          <p className="text-5xl mb-3">👤</p>
          <p className="font-medium text-slate-500">Сотрудники не найдены</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((user) => (
            <StaffCard
              key={user.id}
              user={user}
              assetMap={assetMap}
              onEdit={() => setModalUser(user)}
              onToggleActive={() => {
                if (user.is_active) {
                  if (!window.confirm(`Деактивировать сотрудника "${user.name}"?`)) return;
                }
                patchMutation.mutate({ id: user.id, body: { is_active: !user.is_active } });
              }}
              onSelect={() => setSelectedUser(user)}
            />
          ))}
        </div>
      )}

      {/* Детальная панель */}
      {selectedUser && (
        <StaffDetailPanel user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}

      {/* Модал редактирования */}
      {modalUser !== null && (
        <StaffModal
          editUser={modalUser === 'new' ? null : modalUser}
          assets={assets}
          onClose={() => setModalUser(null)}
          onSaved={() => {
            setModalUser(null);
            qc.invalidateQueries({ queryKey: ['staff'] });
          }}
        />
      )}
    </div>
  );
}
