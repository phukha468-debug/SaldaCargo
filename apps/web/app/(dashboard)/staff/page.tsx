'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef } from 'react';
import { Money } from '@saldacargo/ui';
import { formatPhone } from '@saldacargo/shared';
import { cn } from '@saldacargo/ui';

// ─── Types ───────────────────────────────────────────────────────────────────

type UserRole =
  | 'owner'
  | 'admin'
  | 'driver'
  | 'loader'
  | 'mechanic'
  | 'mechanic_lead'
  | 'accountant'
  | 'welder'
  | 'painter'
  | 'electrician'
  | 'handyman';

type PayrollUser = {
  id: string;
  name: string;
  roles: UserRole[];
  auto_settle: boolean;
  max_user_id: string | null;
  phone: string | null;
  notes: string | null;
  asset: { short_name: string; reg_number: string } | null;
  shifts: number; // количество начислений за месяц
  earned: string; // начислено за месяц
  paid: string; // выплачено за месяц
  debt: string; // всего pending к выплате (all-time)
  unconfirmed_debt: string; // ожидает подтверждения сотрудником
  advance_balance: string; // остаток долга по авансу
  advance_offset: string; // сколько зачтётся при выплате
  payout: string; // сколько реально выплатить деньгами
  all_time_paid: string;
  history: Array<{
    id: string;
    amount: string;
    direction: string;
    description: string;
    created_at: string;
    settlement_status: string;
    category_id: string;
    employee_confirmed: boolean | null;
  }>;
};

type PayrollResponse = {
  drivers: PayrollUser[];
  loaders: PayrollUser[];
  mechanics: PayrollUser[];
  office: PayrollUser[];
  total_earned_month: string;
  total_paid_month: string;
  total_debt_alltime: string;
  total_payout_alltime: string;
  total_paid_alltime: string;
};

type StaffUser = {
  id: string;
  name: string;
  phone: string | null;
  max_user_id: string | null;
  roles: UserRole[];
  current_asset_id: string | null;
  auto_settle: boolean;
  is_active: boolean;
  notes: string | null;
};

type Asset = { id: string; short_name: string; reg_number: string };

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<UserRole, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  driver: 'Водитель',
  loader: 'Грузчик',
  mechanic: 'Механик',
  mechanic_lead: 'Ст. механик',
  accountant: 'Бухгалтер',
  welder: 'Сварщик',
  painter: 'Маляр',
  electrician: 'Электрик',
  handyman: 'Разнорабочий',
};

const ROLE_COLOR: Record<UserRole, string> = {
  owner: 'bg-violet-100 text-violet-700',
  admin: 'bg-blue-100 text-blue-700',
  driver: 'bg-emerald-100 text-emerald-700',
  loader: 'bg-orange-100 text-orange-700',
  mechanic: 'bg-amber-100 text-amber-700',
  mechanic_lead: 'bg-amber-200 text-amber-800',
  accountant: 'bg-slate-100 text-slate-600',
  welder: 'bg-cyan-100 text-cyan-700',
  painter: 'bg-pink-100 text-pink-700',
  electrician: 'bg-yellow-100 text-yellow-700',
  handyman: 'bg-stone-100 text-stone-600',
};

const ALL_ROLES: UserRole[] = [
  'driver',
  'mechanic',
  'mechanic_lead',
  'loader',
  'welder',
  'painter',
  'electrician',
  'handyman',
  'admin',
  'owner',
  'accountant',
];

const WALLETS = [
  { id: '10000000-0000-0000-0000-000000000001', label: '🏦 Р/С' },
  { id: '10000000-0000-0000-0000-000000000002', label: '💵 Касса' },
];

const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

const emptyForm = {
  name: '',
  phone: '',
  max_user_id: '',
  roles: [] as UserRole[],
  current_asset_id: '',
  auto_settle: false,
  notes: '',
};

// ─── StaffModal ───────────────────────────────────────────────────────────────

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
          auto_settle: editUser.auto_settle,
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
      auto_settle: form.auto_settle,
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
                  className={cn(
                    'text-xs font-bold px-3 py-1 rounded-full border transition-colors',
                    form.roles.includes(role)
                      ? `${ROLE_COLOR[role]} border-transparent`
                      : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300',
                  )}
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
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.auto_settle}
              onChange={(e) => setForm((p) => ({ ...p, auto_settle: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 text-emerald-600"
            />
            <div>
              <span className="text-sm font-medium text-slate-700">Расчёт в день работы</span>
              <p className="text-[11px] text-slate-400">
                Для временных грузчиков — долг не накапливается
              </p>
            </div>
          </label>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Примечание</label>
            <textarea
              className={cn(inputCls, 'resize-none')}
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

// ─── SettleModal ──────────────────────────────────────────────────────────────

function SettleModal({
  user,
  onClose,
  onSuccess,
}: {
  user: PayrollUser;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const salaryTotal = parseFloat(user.debt);
  const advanceBalance = parseFloat(user.advance_balance ?? '0');
  const maxOffset = Math.min(salaryTotal, advanceBalance);

  const [walletId, setWalletId] = useState(WALLETS[1]!.id);
  const [offsetInput, setOffsetInput] = useState(maxOffset.toFixed(2));
  const [partialInput, setPartialInput] = useState(salaryTotal.toFixed(2));
  const [error, setError] = useState('');

  const isPartial = parseFloat(partialInput) < salaryTotal - 0.001;
  const partialVal = Math.min(Math.max(0, parseFloat(partialInput) || 0), salaryTotal);

  const offsetVal = Math.min(Math.max(0, parseFloat(offsetInput) || 0), maxOffset);
  // При частичной выплате зачёт аванса пропорционально
  const effectiveOffset = isPartial ? Math.min(offsetVal, partialVal) : offsetVal;
  const payout = Math.max(0, partialVal - effectiveOffset);
  const remainingDebt = Math.max(0, advanceBalance - effectiveOffset);
  const remainingSalary = Math.max(0, salaryTotal - partialVal);
  const needsWallet = payout > 0;

  const mutation = useMutation({
    mutationFn: () =>
      fetch('/api/staff/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          from_wallet_id: needsWallet ? walletId : undefined,
          partial_offset: effectiveOffset.toFixed(2),
          ...(isPartial ? { partial_amount: partialVal.toFixed(2) } : {}),
        }),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? 'Ошибка');
        return data;
      }),
    onSuccess,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Выплата ЗП</h2>
            <p className="text-sm text-slate-500">{user.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-6 space-y-3">
          {/* Сумма к выплате */}
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">
              Сумма к выплате сейчас
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max={salaryTotal}
                step="100"
                value={partialInput}
                onChange={(e) => setPartialInput(e.target.value)}
                className="flex-1 border border-slate-300 rounded-xl px-3 py-2.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <span className="text-sm text-slate-500 shrink-0">₽</span>
              <button
                type="button"
                onClick={() => setPartialInput(salaryTotal.toFixed(2))}
                className={cn(
                  'text-xs px-2.5 py-1.5 rounded-lg border font-semibold shrink-0 transition-colors',
                  !isPartial
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50',
                )}
              >
                Всё
              </button>
            </div>
            {isPartial && (
              <p className="text-xs text-amber-600 mt-1.5 font-medium">
                Остаток долга {remainingSalary.toLocaleString('ru-RU')} ₽ останется к выплате
              </p>
            )}
          </div>

          {/* Разбивка */}
          <div className="bg-slate-50 rounded-xl divide-y divide-slate-200 overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-sm text-slate-600">Начислено ЗП</span>
              <span className="text-sm font-bold text-slate-900">
                <Money amount={user.debt} />
              </span>
            </div>
            {advanceBalance > 0 && (
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-sm text-slate-600">Долг сотрудника (аванс)</span>
                <span className="text-sm font-bold text-rose-600">
                  <Money amount={user.advance_balance} />
                </span>
              </div>
            )}
            {advanceBalance > 0 && (
              <div className="px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-violet-700">Зачесть в счёт долга</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setOffsetInput('0')}
                      className="text-[10px] px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
                    >
                      0%
                    </button>
                    <button
                      type="button"
                      onClick={() => setOffsetInput((maxOffset * 0.3).toFixed(2))}
                      className="text-[10px] px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
                    >
                      30%
                    </button>
                    <button
                      type="button"
                      onClick={() => setOffsetInput((maxOffset * 0.5).toFixed(2))}
                      className="text-[10px] px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      onClick={() => setOffsetInput(maxOffset.toFixed(2))}
                      className="text-[10px] px-2 py-0.5 rounded border border-violet-200 text-violet-600 hover:bg-violet-50 transition-colors font-bold"
                    >
                      Весь
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max={maxOffset}
                    step="100"
                    value={offsetInput}
                    onChange={(e) => setOffsetInput(e.target.value)}
                    className="w-full border border-violet-200 rounded-lg px-3 py-2 text-sm font-bold text-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-violet-50"
                  />
                  <span className="text-sm text-slate-500 shrink-0">₽</span>
                </div>
              </div>
            )}
            <div className="flex justify-between items-center px-4 py-3 bg-emerald-50">
              <span className="text-sm font-bold text-emerald-800">
                {isPartial ? 'К выплате сейчас' : 'К выплате деньгами'}
              </span>
              <span className="text-lg font-black text-emerald-700">
                {payout > 0 ? <Money amount={payout.toFixed(2)} /> : '0 ₽'}
              </span>
            </div>
          </div>

          {advanceBalance > 0 && (
            <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-2.5 flex justify-between">
              <span className="text-xs text-violet-600">Остаток долга после зачёта</span>
              <span className="text-xs font-bold text-violet-700">
                <Money amount={remainingDebt.toFixed(2)} />
              </span>
            </div>
          )}

          {needsWallet && (
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-2">Списать с</label>
              <div className="flex gap-2">
                {WALLETS.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setWalletId(w.id)}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl border-2 text-xs font-black transition-all',
                      walletId === w.id
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-500',
                    )}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {parseFloat(user.unconfirmed_debt) > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <span className="text-amber-500 material-symbols-outlined shrink-0">warning</span>
              <div>
                <p className="text-[11px] font-bold text-amber-900 leading-tight">
                  Есть неподтверждённые начисления: <Money amount={user.unconfirmed_debt} />
                </p>
                <p className="text-[10px] text-amber-700 mt-0.5 leading-tight">
                  Сотрудник ещё не подтвердил их в своём приложении. Рекомендуется выплачивать
                  только подтверждённую ЗП.
                </p>
              </div>
            </div>
          )}

          {salaryTotal <= 0 && (
            <p className="text-sm text-slate-400 text-center py-2">Нет начисленной ЗП к выплате</p>
          )}
          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || salaryTotal <= 0}
            className="flex-1 bg-emerald-600 text-white font-bold text-sm py-3 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Проводим...' : '✓ Подтвердить'}
          </button>
          <button
            onClick={onClose}
            className="text-sm text-slate-500 px-4 py-3 rounded-xl border border-slate-200"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PayrollHistoryModal ──────────────────────────────────────────────────────

const ADVANCE_CAT = 'a0000000-0000-0000-0000-000000000001';
const PAYROLL_CATS = [
  'd79213ee-3bc6-4433-b58a-ca7ea1040d00',
  '18792fa8-fda8-472d-8e04-e19d2c6c053c',
  '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6',
];

function txLabel(tx: PayrollUser['history'][number]): string {
  if (tx.category_id === ADVANCE_CAT) {
    return tx.direction === 'expense' ? 'Аванс выдан' : 'Аванс зачтён';
  }
  return tx.settlement_status === 'pending' ? 'ЗП начислена' : 'ЗП выплачена';
}

function PayrollHistoryModal({
  user,
  onClose,
  onChanged,
}: {
  user: PayrollUser;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(txId: string) {
    const val = parseFloat(editAmount);
    if (isNaN(val) || val < 0) {
      setError('Некорректная сумма');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const r = await fetch(`/api/staff/transactions/${txId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: val.toFixed(2) }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? 'Ошибка');
      setEditingId(null);
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmAdmin(txId: string) {
    if (!confirm('Подтвердить это начисление за водителя?')) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/staff/transactions/${txId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_confirmed: true }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? 'Ошибка');
      onChanged();
    } catch (e: unknown) {
      alert('Ошибка: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(txId: string, label: string) {
    if (!confirm(`Удалить запись «${label}»? Это действие необратимо.`)) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/staff/transactions/${txId}`, { method: 'DELETE' });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? 'Ошибка');
      onChanged();
    } catch (e: unknown) {
      alert('Ошибка: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }

  const history = user.history;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-slate-900">История транзакций</h2>
            <p className="text-sm text-slate-500">{user.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Предупреждение */}
        <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 text-[10px] text-amber-800 leading-relaxed">
          <span className="font-bold">Правила редактирования:</span> ЗП начислена (ожидает выплаты)
          — можно смело исправлять или удалять.{' '}
          <span className="font-bold text-rose-700">
            ЗП выплачена и Авансы — редактировать только для исправления ошибки ввода:
          </span>{' '}
          изменение суммы повлияет на P&L и остаток долга, удаление необратимо.
        </div>

        <div className="overflow-y-auto flex-1">
          {history.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">История пуста</p>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    Дата
                  </th>
                  <th className="px-2 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    Описание
                  </th>
                  <th className="px-2 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-right">
                    Сумма
                  </th>
                  <th className="px-2 py-2 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((tx) => {
                  const label = txLabel(tx);
                  const isAdvance = tx.category_id === ADVANCE_CAT;
                  const isPayroll = PAYROLL_CATS.includes(tx.category_id);
                  const canEdit = isAdvance || isPayroll;
                  const colorCls =
                    isAdvance && tx.direction === 'expense'
                      ? 'text-violet-600'
                      : isAdvance
                        ? 'text-violet-400'
                        : tx.settlement_status === 'pending'
                          ? 'text-amber-600'
                          : 'text-emerald-600';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="px-4 py-2.5 text-[10px] text-slate-400 whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          year: '2-digit',
                        })}
                      </td>
                      <td className="px-2 py-2.5">
                        <span className={cn('text-[10px] font-bold', colorCls)}>{label}</span>
                        {tx.description && (
                          <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">
                            {tx.description}
                          </p>
                        )}
                        {isPayroll && tx.employee_confirmed === false && (
                          <div className="mt-1 flex items-center gap-2">
                            <p className="text-[9px] text-amber-600 font-bold flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[10px]">timer</span>
                              ожидает подтверждения
                            </p>
                            <button
                              onClick={() => handleConfirmAdmin(tx.id)}
                              disabled={saving}
                              className="text-[9px] text-emerald-600 border border-emerald-200 rounded px-1.5 py-0.5 hover:bg-emerald-50 transition-colors"
                              title="Подтвердить за водителя"
                            >
                              Подтвердить
                            </button>
                          </div>
                        )}
                        {isPayroll && tx.employee_confirmed === true && (
                          <p className="text-[9px] text-emerald-600 font-bold mt-0.5 flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[10px]">done_all</span>
                            подтверждено водителем
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        {editingId === tx.id ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            autoFocus
                            className="w-24 border border-blue-300 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        ) : (
                          <span className={cn('text-xs font-bold', colorCls)}>
                            {tx.direction === 'income' ? '+' : '−'}&nbsp;
                            <Money amount={tx.amount} />
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2.5">
                        {canEdit &&
                          (editingId === tx.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleSave(tx.id)}
                                disabled={saving}
                                className="text-[9px] font-bold px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                              >
                                {saving ? '...' : '✓'}
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(null);
                                  setError('');
                                }}
                                className="text-[9px] font-bold px-2 py-1 border border-slate-200 text-slate-500 rounded hover:bg-slate-100 transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setEditingId(tx.id);
                                  setEditAmount(tx.amount);
                                  setError('');
                                }}
                                className="text-[9px] text-slate-400 hover:text-blue-600 transition-colors p-1"
                                title="Изменить сумму"
                              >
                                <span className="material-symbols-outlined text-sm">edit</span>
                              </button>
                              <button
                                onClick={() => handleDelete(tx.id, label)}
                                disabled={saving}
                                className="text-[9px] text-slate-400 hover:text-rose-600 transition-colors p-1 disabled:opacity-50"
                                title="Удалить"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            </div>
                          ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {error && <p className="px-4 py-2 text-xs text-rose-600 font-medium">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            onClick={onClose}
            className="w-full text-sm text-slate-500 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PayrollRow ───────────────────────────────────────────────────────────────

function PayrollRow({
  user,
  onSettle,
  onEdit,
  onDeactivate,
  onAdvance,
  onManualPay,
  onHistory,
}: {
  user: PayrollUser;
  onSettle: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
  onAdvance: () => void;
  onManualPay: () => void;
  onHistory: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deactivateConfirm, setDeactivateConfirm] = useState(false);
  const deactivateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debt = parseFloat(user.debt);
  const earned = parseFloat(user.earned);
  const advanceBalance = parseFloat(user.advance_balance ?? '0');
  const hasDebt = debt > 0;
  const hasAdvance = advanceBalance > 0;
  const isAdminOrOwner = user.roles.some((r) => r === 'owner' || r === 'admin');

  const handleDeactivate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!deactivateConfirm) {
      setDeactivateConfirm(true);
      deactivateTimer.current = setTimeout(() => setDeactivateConfirm(false), 4000);
    } else {
      if (deactivateTimer.current) clearTimeout(deactivateTimer.current);
      setDeactivateConfirm(false);
      onDeactivate();
    }
  };

  return (
    <div
      className={cn(
        'border-b border-slate-100 last:border-0 border-l-4',
        hasAdvance
          ? 'border-l-violet-400 bg-violet-50/20'
          : hasDebt
            ? 'border-l-amber-400 bg-amber-50/20'
            : 'border-l-emerald-300',
      )}
    >
      {/* Main row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50/60 transition-colors select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Name + roles */}
        <div className="w-44 shrink-0 min-w-0">
          <div className="flex flex-wrap items-center gap-1 mb-0.5">
            {user.roles.slice(0, 2).map((role) => (
              <span
                key={role}
                className={cn(
                  'text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
                  ROLE_COLOR[role as UserRole] ?? 'bg-slate-100 text-slate-500',
                )}
              >
                {ROLE_LABEL[role as UserRole] ?? role}
              </span>
            ))}
            {user.roles.length > 2 && (
              <span className="text-[9px] text-slate-400 font-bold">+{user.roles.length - 2}</span>
            )}
            {user.auto_settle && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0">
                день
              </span>
            )}
          </div>
          <span className="font-bold text-slate-900 text-sm truncate block">{user.name}</span>
          {user.asset && (
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
              {user.asset.reg_number}
            </p>
          )}
        </div>

        {/* Shifts/orders */}
        <div className="w-16 shrink-0 text-center">
          <p className="text-xs font-black text-slate-700">{user.shifts > 0 ? user.shifts : '—'}</p>
          <p className="text-[9px] text-slate-400">смен</p>
        </div>

        {/* Earned */}
        <div className="w-28 shrink-0 text-right">
          {earned > 0 ? (
            <p className="text-sm font-bold text-slate-700">
              <Money amount={user.earned} />
            </p>
          ) : (
            <p className="text-xs text-slate-300">—</p>
          )}
          <p className="text-[9px] text-slate-400">заработал</p>
        </div>

        {/* Paid */}
        <div className="w-28 shrink-0 text-right">
          {parseFloat(user.paid) > 0 ? (
            <p className="text-sm font-bold text-emerald-600">
              <Money amount={user.paid} />
            </p>
          ) : (
            <p className="text-xs text-slate-300">—</p>
          )}
          <p className="text-[9px] text-slate-400">выплачено</p>
        </div>

        {/* Debt / Advance */}
        <div className="w-28 shrink-0 text-right">
          {hasDebt ? (
            <>
              <p className="text-sm font-black text-amber-600">
                <Money amount={user.debt} />
              </p>
              {hasAdvance && (
                <p className="text-[9px] text-violet-500">
                  аванс −<Money amount={user.advance_offset} />
                </p>
              )}
              {!hasAdvance && <p className="text-[9px] text-slate-400">к выплате</p>}
            </>
          ) : hasAdvance ? (
            <>
              <p className="text-sm font-black text-violet-600">
                <Money amount={user.advance_balance} />
              </p>
              <p className="text-[9px] text-violet-400">аванс долг</p>
            </>
          ) : earned > 0 ? (
            <>
              <p className="text-xs font-bold text-emerald-500">✓ выплачено</p>
              <p className="text-[9px] text-slate-400">&nbsp;</p>
            </>
          ) : (
            <p className="text-xs text-slate-300">—</p>
          )}

          {/* Unconfirmed debt warning */}
          {parseFloat(user.unconfirmed_debt) > 0 && (
            <div
              className="mt-1 flex items-center justify-end gap-1 text-rose-500"
              title="Сотрудник ещё не подтвердил это начисление в приложении"
            >
              <span className="text-[10px] font-bold">
                <Money amount={user.unconfirmed_debt} />
              </span>
              <span className="material-symbols-outlined text-[14px]">pending_actions</span>
            </div>
          )}
        </div>

        {/* Action */}
        <div className="flex-1 flex items-center justify-end gap-1.5">
          {hasDebt && !user.auto_settle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSettle();
              }}
              className="text-xs font-black px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shrink-0"
            >
              Рассчитаться
            </button>
          )}
          {isAdminOrOwner && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onManualPay();
              }}
              className="text-xs font-black px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors shrink-0"
            >
              Выплатить ЗП
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdvance();
            }}
            className="text-xs font-black px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors shrink-0"
            title="Выдать аванс"
          >
            Аванс
          </button>
          <span
            className={cn(
              'material-symbols-outlined text-slate-300 text-[18px] shrink-0 transition-transform duration-200',
              expanded && 'rotate-180',
            )}
          >
            expand_more
          </span>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 bg-slate-50/50 border-t border-slate-100 flex flex-wrap items-center gap-x-6 gap-y-2 animate-in fade-in duration-150">
          {user.asset && (
            <span className="text-xs text-slate-600 font-semibold">
              🚛 {user.asset.short_name} ({user.asset.reg_number})
            </span>
          )}
          {user.max_user_id ? (
            <span className="text-xs text-slate-500">
              MAX: <span className="font-mono text-emerald-700">{user.max_user_id}</span>
            </span>
          ) : (
            <span className="text-xs text-rose-400 font-medium">MAX не привязан</span>
          )}
          {user.phone && (
            <span className="text-xs text-slate-500 font-mono">📞 {formatPhone(user.phone)}</span>
          )}
          {user.notes && <span className="text-xs text-slate-400 italic">{user.notes}</span>}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onHistory();
              }}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-lg py-1 px-3 transition-colors"
            >
              История
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-lg py-1 px-3 transition-colors"
            >
              Изменить
            </button>
            <button
              onClick={handleDeactivate}
              className={cn(
                'text-xs font-bold px-3 py-1 rounded-lg border transition-all',
                deactivateConfirm
                  ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                  : 'text-slate-400 border-slate-200 hover:text-rose-600 hover:border-rose-300',
              )}
            >
              {deactivateConfirm ? 'Ещё раз — деактивировать!' : 'Деактивировать'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function PayrollSection({
  users,
  headerBg,
  headerTextColor,
  onSettle,
  onEdit,
  onDeactivate,
  onAdvance,
  onManualPay,
  onHistory,
}: {
  users: PayrollUser[];
  headerBg: string;
  headerTextColor: string;
  onSettle: (u: PayrollUser) => void;
  onEdit: (u: PayrollUser) => void;
  onDeactivate: (u: PayrollUser) => void;
  onAdvance: (u: PayrollUser) => void;
  onManualPay: (u: PayrollUser) => void;
  onHistory: (u: PayrollUser) => void;
}) {
  if (users.length === 0)
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-6 py-10 text-center">
        <p className="text-sm text-slate-400 font-medium">Нет сотрудников в этой группе</p>
      </div>
    );

  const totalDebt = users.reduce((s, u) => s + parseFloat(u.debt), 0);
  const totalAdvance = users.reduce((s, u) => s + parseFloat(u.advance_balance ?? '0'), 0);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Coloured column headers */}
      <div className={cn('flex items-center gap-3 px-4 py-2.5', headerBg)}>
        <div className="w-44 shrink-0">
          <span className={cn('text-[10px] font-bold uppercase tracking-widest', headerTextColor)}>
            Сотрудник
          </span>
        </div>
        <div className="w-16 shrink-0 text-center">
          <span className={cn('text-[10px] font-bold uppercase tracking-widest', headerTextColor)}>
            Смен
          </span>
        </div>
        <div className="w-28 shrink-0 text-right">
          <span className={cn('text-[10px] font-bold uppercase tracking-widest', headerTextColor)}>
            Заработал
          </span>
        </div>
        <div className="w-28 shrink-0 text-right">
          <span className={cn('text-[10px] font-bold uppercase tracking-widest', headerTextColor)}>
            Выплачено
          </span>
        </div>
        <div className="w-28 shrink-0 text-right">
          <span className={cn('text-[10px] font-bold uppercase tracking-widest', headerTextColor)}>
            Долг / Аванс
          </span>
        </div>
        <div className="flex-1 text-right">
          {totalDebt > 0 && (
            <span className="text-xs font-black text-white">
              Долг: <Money amount={totalDebt.toFixed(2)} />
            </span>
          )}
          {totalDebt === 0 && totalAdvance > 0 && (
            <span className="text-xs font-black text-white/80">
              Авансы: <Money amount={totalAdvance.toFixed(2)} />
            </span>
          )}
        </div>
      </div>

      {/* Rows */}
      {users.map((u) => (
        <PayrollRow
          key={u.id}
          user={u}
          onSettle={() => onSettle(u)}
          onEdit={() => onEdit(u)}
          onDeactivate={() => onDeactivate(u)}
          onAdvance={() => onAdvance(u)}
          onManualPay={() => onManualPay(u)}
          onHistory={() => onHistory(u)}
        />
      ))}
    </div>
  );
}

// ─── ManualPayModal ───────────────────────────────────────────────────────────

function ManualPayModal({
  user,
  onClose,
  onSuccess,
}: {
  user: PayrollUser;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState(WALLETS[1]!.id);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      fetch('/api/staff/pay-salary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          amount: parseFloat(amount.replace(',', '.')).toFixed(2),
          from_wallet_id: walletId,
          note: note.trim() || undefined,
        }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Ошибка');
        return d;
      }),
    onSuccess,
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = () => {
    const val = parseFloat(amount.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      setError('Введите сумму');
      return;
    }
    setError('');
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Выплата ЗП</h2>
            <p className="text-sm text-slate-500">{user.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Сумма, ₽ *</label>
            <input
              autoFocus
              type="number"
              min="1"
              step="1000"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="0"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-2">Списать с</label>
            <div className="flex gap-2">
              {WALLETS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWalletId(w.id)}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl border-2 text-xs font-black transition-all',
                    walletId === w.id
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 text-slate-500',
                  )}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Комментарий</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Необязательно"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>

          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="flex-1 bg-emerald-600 text-white font-bold text-sm py-3 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Проводим...' : '✓ Выплатить'}
          </button>
          <button
            onClick={onClose}
            className="text-sm text-slate-500 px-4 py-3 rounded-xl border border-slate-200"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AdvanceModal ─────────────────────────────────────────────────────────────

function AdvanceModal({
  user,
  onClose,
  onSuccess,
}: {
  user: PayrollUser;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState(WALLETS[0]!.id);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      fetch('/api/staff/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          amount: parseFloat(amount.replace(',', '.')).toFixed(2),
          from_wallet_id: walletId,
          note: note.trim() || undefined,
        }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Ошибка');
        return d;
      }),
    onSuccess,
    onError: (e: Error) => setError(e.message),
  });

  const advanceOutstanding = parseFloat(user.advance_balance ?? '0');

  const handleSubmit = () => {
    const val = parseFloat(amount.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      setError('Введите сумму');
      return;
    }
    setError('');
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Выдать аванс</h2>
            <p className="text-sm text-slate-500">{user.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-6 space-y-4">
          {advanceOutstanding > 0 && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-violet-700">Текущий аванс</span>
                <span className="text-lg font-black text-violet-700">
                  <Money amount={user.advance_balance} />
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Сумма аванса *</label>
            <input
              autoFocus
              type="number"
              min="1"
              step="500"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="0"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Из кассы / счёта
            </label>
            <select
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
            >
              {WALLETS.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Комментарий</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Необязательно"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
          </div>

          <p className="text-xs text-slate-400">
            Аванс будет вычтен из будущих выплат. Сотрудник работает в счёт выданной суммы.
          </p>
          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="flex-1 bg-violet-600 text-white font-bold text-sm py-3 rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Проводим...' : '✓ Выдать аванс'}
          </button>
          <button
            onClick={onClose}
            className="text-sm text-slate-500 px-4 py-3 rounded-xl border border-slate-200"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Group config ─────────────────────────────────────────────────────────────

type GroupKey = 'drivers' | 'loaders' | 'workshop';

const GROUP_CONFIG: Record<
  GroupKey,
  {
    label: string;
    headerBg: string;
    headerTextColor: string;
    tabActive: string;
    tabInactive: string;
    countActive: string;
    countInactive: string;
    getUsers: (p: PayrollResponse) => PayrollUser[];
    getCount: (p: PayrollResponse) => number;
  }
> = {
  drivers: {
    label: 'Водители',
    headerBg: 'bg-emerald-600',
    headerTextColor: 'text-emerald-100',
    tabActive: 'bg-emerald-600 text-white shadow-sm',
    tabInactive:
      'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700',
    countActive: 'bg-white/25 text-white',
    countInactive: 'bg-slate-100 text-slate-500',
    getUsers: (p) => p.drivers,
    getCount: (p) => p.drivers.length,
  },
  loaders: {
    label: 'Грузчики',
    headerBg: 'bg-orange-500',
    headerTextColor: 'text-orange-100',
    tabActive: 'bg-orange-500 text-white shadow-sm',
    tabInactive:
      'bg-white border border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-700',
    countActive: 'bg-white/25 text-white',
    countInactive: 'bg-slate-100 text-slate-500',
    getUsers: (p) => p.loaders,
    getCount: (p) => p.loaders.length,
  },
  workshop: {
    label: 'Цех',
    headerBg: 'bg-indigo-600',
    headerTextColor: 'text-indigo-100',
    tabActive: 'bg-indigo-600 text-white shadow-sm',
    tabInactive:
      'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700',
    countActive: 'bg-white/25 text-white',
    countInactive: 'bg-slate-100 text-slate-500',
    getUsers: (p) => [...p.mechanics, ...p.office],
    getCount: (p) => p.mechanics.length + p.office.length,
  },
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [activeGroup, setActiveGroup] = useState<GroupKey>('drivers');
  const [settleUser, setSettleUser] = useState<PayrollUser | null>(null);
  const [advanceUser, setAdvanceUser] = useState<PayrollUser | null>(null);
  const [manualPayUser, setManualPayUser] = useState<PayrollUser | null>(null);
  const [editUser, setEditUser] = useState<StaffUser | 'new' | null>(null);
  const [historyUser, setHistoryUser] = useState<PayrollUser | null>(null);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const { data: payroll, isLoading } = useQuery<PayrollResponse>({
    queryKey: ['staff-payroll', year, month],
    queryFn: () => fetch(`/api/staff/payroll?year=${year}&month=${month}`).then((r) => r.json()),
    staleTime: 120000,
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['assets-list'],
    queryFn: () =>
      fetch('/api/fleet?period=current_month')
        .then((r) => r.json())
        .then((r) => r.assets ?? []),
    staleTime: 300000,
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-payroll'] }),
  });

  const handleDeactivate = (u: PayrollUser) => {
    patchMutation.mutate({ id: u.id, body: { is_active: false } });
  };

  const handleEdit = (u: PayrollUser) => {
    setEditUser({
      id: u.id,
      name: u.name,
      phone: u.phone,
      max_user_id: u.max_user_id,
      roles: u.roles,
      current_asset_id: null,
      auto_settle: u.auto_settle,
      is_active: true,
      notes: u.notes,
    });
  };

  const totalDebt = payroll ? parseFloat(payroll.total_debt_alltime) : 0;
  const totalFundMonth = payroll ? parseFloat(payroll.total_earned_month) : 0;
  const totalPaidMonth = payroll ? parseFloat(payroll.total_paid_month) : 0;
  const totalStaff =
    (payroll?.drivers.length ?? 0) +
    (payroll?.loaders.length ?? 0) +
    (payroll?.mechanics.length ?? 0) +
    (payroll?.office.length ?? 0);

  const cfg = GROUP_CONFIG[activeGroup];
  const activeUsers = payroll ? cfg.getUsers(payroll) : [];

  return (
    <div className="space-y-3 max-w-5xl mx-auto animate-in fade-in duration-500">
      {/* Переключатель месяца — компактный */}
      <div className="bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-stretch h-11">
          <button
            onClick={() => shiftMonth(-1)}
            className="flex items-center justify-center w-14 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 transition-colors shrink-0"
          >
            <span className="text-xl font-black text-white">←</span>
          </button>
          <div className="flex-1 flex items-center justify-center gap-3 px-4">
            <span className="text-base font-black text-white tracking-wide">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            {!isCurrentMonth && (
              <button
                onClick={() => {
                  setYear(now.getFullYear());
                  setMonth(now.getMonth() + 1);
                }}
                className="text-xs font-bold text-sky-300 bg-sky-500/20 border border-sky-500/40 px-2 py-0.5 rounded-full hover:bg-sky-500/30 transition-colors"
              >
                → сейчас
              </button>
            )}
          </div>
          <button
            onClick={() => shiftMonth(1)}
            disabled={isCurrentMonth}
            className="flex items-center justify-center w-14 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <span className="text-xl font-black text-white">→</span>
          </button>
        </div>
      </div>

      {/* Сводка — компактная */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Сотрудников', value: totalStaff, color: 'text-slate-900' },
          {
            label: 'Фонд ЗП (мес)',
            value: isLoading ? '—' : <Money amount={totalFundMonth.toFixed(2)} />,
            color: 'text-slate-800',
          },
          {
            label: 'Выплачено (мес)',
            value: isLoading ? '—' : <Money amount={totalPaidMonth.toFixed(2)} />,
            color: 'text-emerald-600',
          },
          {
            label: 'Долг (всего)',
            value: isLoading ? '—' : <Money amount={totalDebt.toFixed(2)} />,
            color: totalDebt > 0 ? 'text-amber-600' : 'text-slate-400',
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm"
          >
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
              {label}
            </p>
            <p className={cn('text-xl font-black', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Табы + кнопка добавить */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2">
          {(Object.keys(GROUP_CONFIG) as GroupKey[]).map((key) => {
            const g = GROUP_CONFIG[key];
            const isActive = activeGroup === key;
            const count = payroll ? g.getCount(payroll) : 0;
            return (
              <button
                key={key}
                onClick={() => setActiveGroup(key)}
                className={cn(
                  'flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all',
                  isActive ? g.tabActive : g.tabInactive,
                )}
              >
                {g.label}
                <span
                  className={cn(
                    'text-[10px] font-black px-1.5 py-0.5 rounded-full',
                    isActive ? g.countActive : g.countInactive,
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setEditUser('new')}
          className="bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors shrink-0"
        >
          + Добавить сотрудника
        </button>
      </div>

      {/* Таблица активной группы */}
      {isLoading ? (
        <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
      ) : (
        <PayrollSection
          users={activeUsers}
          headerBg={cfg.headerBg}
          headerTextColor={cfg.headerTextColor}
          onSettle={setSettleUser}
          onEdit={handleEdit}
          onDeactivate={handleDeactivate}
          onAdvance={setAdvanceUser}
          onManualPay={setManualPayUser}
          onHistory={setHistoryUser}
        />
      )}

      {/* Модал истории транзакций */}
      {historyUser && (
        <PayrollHistoryModal
          user={historyUser}
          onClose={() => setHistoryUser(null)}
          onChanged={() => {
            setHistoryUser(null);
            qc.invalidateQueries({ queryKey: ['staff-payroll'] });
          }}
        />
      )}

      {/* Модал выплаты */}
      {settleUser && (
        <SettleModal
          user={settleUser}
          onClose={() => setSettleUser(null)}
          onSuccess={() => {
            setSettleUser(null);
            qc.invalidateQueries({ queryKey: ['staff-payroll'] });
          }}
        />
      )}

      {/* Модал ручной выплаты ЗП */}
      {manualPayUser && (
        <ManualPayModal
          user={manualPayUser}
          onClose={() => setManualPayUser(null)}
          onSuccess={() => {
            setManualPayUser(null);
            qc.invalidateQueries({ queryKey: ['staff-payroll'] });
            qc.invalidateQueries({ queryKey: ['wallets'] });
          }}
        />
      )}

      {/* Модал аванса */}
      {advanceUser && (
        <AdvanceModal
          user={advanceUser}
          onClose={() => setAdvanceUser(null)}
          onSuccess={() => {
            setAdvanceUser(null);
            qc.invalidateQueries({ queryKey: ['staff-payroll'] });
            qc.invalidateQueries({ queryKey: ['wallets'] });
          }}
        />
      )}

      {/* Модал редактирования */}
      {editUser !== null && (
        <StaffModal
          editUser={editUser === 'new' ? null : editUser}
          assets={assets}
          onClose={() => setEditUser(null)}
          onSaved={() => {
            setEditUser(null);
            qc.invalidateQueries({ queryKey: ['staff-payroll'] });
          }}
        />
      )}
    </div>
  );
}
