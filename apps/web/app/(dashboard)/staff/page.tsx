'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useMemo } from 'react';
import { Money } from '@saldacargo/ui';
import { formatPhone } from '@saldacargo/shared';
import { cn } from '@saldacargo/ui';
import { DriverDocuments } from '@/components/DriverDocuments';
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
    updated_at?: string;
    settlement_status: string;
    category_id: string;
    employee_confirmed: boolean | null;
    from_wallet_id?: string | null;
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
          {editUser && <DriverDocuments driverId={editUser.id} />}
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
  // По умолчанию НЕ списываем аванс (0 ₽), чтобы исключить случайные удержания
  const [offsetInput, setOffsetInput] = useState('0');
  const [partialInput, setPartialInput] = useState(salaryTotal.toFixed(2));
  const [error, setError] = useState('');
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOffsetConfirm, setShowOffsetConfirm] = useState(false);

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
          idempotency_key: idempotencyKey,
          ...(isPartial ? { partial_amount: partialVal.toFixed(2) } : {}),
        }),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? 'Ошибка');
        return data;
      }),
    onSuccess,
    onError: (e: Error) => setError(e.message),
    onSettled: () => setIsSubmitting(false),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
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

        {showOffsetConfirm ? (
          /* Шаг подтверждения списания аванса */
          <div className="p-6 space-y-4">
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-black text-sm">
                <span className="material-symbols-outlined text-amber-600">warning</span>
                <span>Внимание: Списание аванса!</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Вы указали удержание в зачёт аванса на сумму{' '}
                <strong className="text-amber-950 font-black">
                  <Money amount={effectiveOffset.toFixed(2)} />
                </strong>
                .
              </p>
              <div className="bg-white/80 rounded-xl p-3 text-xs space-y-1.5 border border-amber-200">
                <div className="flex justify-between">
                  <span className="text-slate-600">Текущий долг водителя:</span>
                  <span className="font-bold text-rose-600">
                    <Money amount={advanceBalance.toFixed(2)} />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Остаток долга после зачёта:</span>
                  <span className="font-bold text-violet-700">
                    <Money amount={remainingDebt.toFixed(2)} />
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-100">
                  <span className="text-slate-700 font-bold">Будет выплачено на руки:</span>
                  <span className="font-black text-emerald-700">
                    <Money amount={payout.toFixed(2)} />
                  </span>
                </div>
              </div>
              <p className="text-xs font-bold text-amber-950 pt-1 text-center">
                Вы точно хотите списать этот аванс?
              </p>
            </div>

            {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (isSubmitting || mutation.isPending) return;
                  setIsSubmitting(true);
                  mutation.mutate();
                }}
                disabled={mutation.isPending || isSubmitting}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm py-3.5 rounded-xl transition-colors shadow-lg shadow-amber-600/20 active:scale-[0.98]"
              >
                {mutation.isPending || isSubmitting
                  ? 'Проводим...'
                  : '✓ Да, списать аванс и выплатить'}
              </button>
              <button
                type="button"
                onClick={() => setShowOffsetConfirm(false)}
                className="w-full text-xs font-medium text-slate-600 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                ← Вернуться и изменить
              </button>
            </div>
          </div>
        ) : (
          /* Обычная форма выплаты */
          <>
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
                          className="text-[10px] px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors font-bold"
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

              {advanceBalance > 0 && parseFloat(offsetInput) > 0 && (
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
                <p className="text-sm text-slate-400 text-center py-2">
                  Нет начисленной ЗП к выплате
                </p>
              )}
              {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => {
                  if (isSubmitting || mutation.isPending || salaryTotal <= 0) return;
                  if (effectiveOffset > 0) {
                    setShowOffsetConfirm(true);
                    return;
                  }
                  setIsSubmitting(true);
                  mutation.mutate();
                }}
                disabled={mutation.isPending || isSubmitting || salaryTotal <= 0}
                className="flex-1 bg-emerald-600 text-white font-bold text-sm py-3 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {mutation.isPending || isSubmitting ? 'Проводим...' : '✓ Подтвердить'}
              </button>
              <button
                onClick={onClose}
                className="text-sm text-slate-500 px-4 py-3 rounded-xl border border-slate-200"
              >
                Отмена
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── ServiceOrderViewModal ──────────────────────────────────────────────────

function ServiceOrderViewModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const backdropRef = useRef(false);
  const {
    data: order,
    isLoading,
    error,
  } = useQuery<{
    id: string;
    order_number: number | string;
    status: string;
    priority?: string;
    machine_type: 'own' | 'client';
    problem_description?: string | null;
    admin_note?: string | null;
    mechanic_note?: string | null;
    mechanic_pay?: string | null;
    second_mechanic_pay?: string | null;
    client_name?: string | null;
    client_phone?: string | null;
    client_vehicle_brand?: string | null;
    client_vehicle_model?: string | null;
    client_vehicle_reg?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    asset?: { id: string; short_name: string; reg_number: string } | null;
    mechanic?: { id: string; name: string; mechanic_salary_pct?: number } | null;
    second_mechanic?: { id: string; name: string; mechanic_salary_pct?: number } | null;
    works?: Array<{
      id: string;
      status: string;
      salary_paid?: boolean;
      quantity?: number;
      norm_minutes?: number;
      actual_minutes?: number;
      price_client?: string;
      work_description?: string;
      custom_work_name?: string;
      work_catalog?: { id: string; name: string; norm_minutes?: number } | null;
    }>;
    parts?: Array<{
      id: string;
      quantity: number;
      custom_part_name?: string;
      unit?: string;
      unit_price?: string;
      client_price?: string;
      part?: { id: string; name: string; unit?: string } | null;
    }>;
    transactions?: Array<{
      id: string;
      amount: string;
      description?: string;
      related_user?: { name: string } | null;
    }>;
  }>({
    queryKey: ['service-order-quick-view', orderId],
    queryFn: async () => {
      const res = await fetch(`/api/garage/orders/${orderId}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Не удалось загрузить заказ-наряд');
      }
      return res.json();
    },
    staleTime: 30000,
  });

  const isClientMachine = order?.machine_type === 'client';
  const vehicleTitle = isClientMachine
    ? `${order.client_name ? `Клиент: ${order.client_name}` : 'Клиент'} • ${[order.client_vehicle_brand, order.client_vehicle_model].filter(Boolean).join(' ') || 'Авто клиента'} ${order.client_vehicle_reg ? `(${order.client_vehicle_reg})` : ''}`
    : `${order?.asset?.short_name || 'Автопарк компании'} ${order?.asset?.reg_number ? `(${order.asset.reg_number})` : ''}`;

  const works = (order?.works || []).filter((w) => w.status !== 'cancelled');
  const parts = order?.parts || [];
  const transactions = order?.transactions || [];

  const totalWorksClient = works.reduce(
    (s, w) => s + parseFloat(w.price_client || '0') * (w.quantity || 1),
    0,
  );
  const totalPartsClient = parts.reduce(
    (s, p) => s + parseFloat(p.client_price || p.unit_price || '0') * (p.quantity || 1),
    0,
  );
  const totalClient = totalWorksClient + totalPartsClient;

  const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
    in_progress: { label: 'В работе', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
    completed: { label: 'Завершен', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    draft: { label: 'Черновик', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
    cancelled: { label: 'Отменен', cls: 'bg-rose-100 text-rose-800 border-rose-300' },
  };

  const statusInfo = STATUS_LABELS[order?.status || ''] || {
    label: order?.status || '—',
    cls: 'bg-slate-100 text-slate-700 border-slate-300',
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onMouseDown={(e) => {
        backdropRef.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (backdropRef.current && e.target === e.currentTarget) {
          onClose();
        }
        backdropRef.current = false;
      }}
    >
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black text-lg">
              🛠️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white">
                  Заказ-наряд #{order?.order_number || orderId}
                </h3>
                {order && (
                  <span
                    className={cn(
                      'text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border',
                      statusInfo.cls,
                    )}
                  >
                    {statusInfo.label}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {isLoading ? 'Загрузка данных...' : vehicleTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {order && (
              <a
                href={`/garage?orderId=${order.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors"
                title="Открыть полный наряд в разделе Гараж"
              >
                <span>В Гараж</span>
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="inline-block animate-spin text-3xl">⚙️</div>
              <p className="text-sm font-bold text-slate-500">
                Загрузка информации о наряде #{orderId}...
              </p>
            </div>
          ) : error || !order ? (
            <div className="py-12 text-center space-y-3 bg-white rounded-2xl border border-rose-200 p-6">
              <span className="material-symbols-outlined text-4xl text-rose-500">error</span>
              <p className="text-sm font-bold text-rose-700">
                {error instanceof Error ? error.message : 'Не удалось загрузить заказ-наряд'}
              </p>
            </div>
          ) : (
            <>
              {/* Информация о датах и внесении в базу */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-amber-500">
                      calendar_today
                    </span>
                    Внесён в базу (создан)
                  </div>
                  <div className="text-xs font-black text-slate-900">
                    {order.created_at
                      ? new Date(order.created_at).toLocaleString('ru-RU', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-blue-500">
                      directions_car
                    </span>
                    Автомобиль / Объект
                  </div>
                  <div className="text-xs font-black text-slate-900 truncate" title={vehicleTitle}>
                    {vehicleTitle}
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1 sm:col-span-2 lg:col-span-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-emerald-500">
                      badge
                    </span>
                    Исполнитель (Механик)
                  </div>
                  <div className="text-xs font-black text-slate-900">
                    {order.mechanic?.name || 'Не назначен'}
                    {order.second_mechanic?.name ? ` + ${order.second_mechanic.name}` : ''}
                  </div>
                </div>
              </div>

              {/* Причина обращения / Проблема */}
              {order.problem_description && (
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">report_problem</span>
                    Причина обращения / Жалоба
                  </div>
                  <p className="text-xs font-semibold text-amber-950 leading-relaxed">
                    {order.problem_description}
                  </p>
                </div>
              )}

              {/* Работы и расчет ЗП («за что именно начислено») */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">
                      construction
                    </span>
                    Выполненные работы ({works.length})
                  </span>
                  <span className="text-xs font-black text-slate-900">
                    Сумма работ: {totalWorksClient.toLocaleString('ru-RU')} ₽
                  </span>
                </div>

                {works.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 font-medium">
                    Работы не указаны
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {works.map((w, idx) => {
                      const workName =
                        w.custom_work_name ||
                        w.work_catalog?.name ||
                        w.work_description ||
                        `Работа #${idx + 1}`;
                      const priceClient = parseFloat(w.price_client || '0') * (w.quantity || 1);
                      const normMin = w.norm_minutes || w.work_catalog?.norm_minutes;
                      const actMin = w.actual_minutes;

                      return (
                        <div
                          key={w.id}
                          className="p-3.5 hover:bg-slate-50/80 transition-colors flex items-start justify-between gap-3"
                        >
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-slate-900">
                                {idx + 1}. {workName}
                              </span>
                              {(w.quantity || 1) > 1 && (
                                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                  × {w.quantity}
                                </span>
                              )}
                              {w.salary_paid ? (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                  ✓ Выплачено
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                  ⏳ Начислено
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium flex-wrap">
                              {normMin && (
                                <span>
                                  Норма: <b>{normMin} мин</b>
                                </span>
                              )}
                              {actMin && (
                                <span>
                                  Факт: <b>{actMin} мин</b>
                                </span>
                              )}
                              {w.work_description && w.work_description !== workName && (
                                <span className="text-slate-400">({w.work_description})</span>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-sm font-black text-slate-900">
                              {priceClient.toLocaleString('ru-RU')} ₽
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Использованные запчасти */}
              {parts.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-blue-600">
                        inventory_2
                      </span>
                      Установленные запчасти и материалы ({parts.length})
                    </span>
                    <span className="text-xs font-black text-slate-900">
                      Сумма запчастей: {totalPartsClient.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {parts.map((p, idx) => {
                      const partName = p.custom_part_name || p.part?.name || `Запчасть #${idx + 1}`;
                      const price =
                        parseFloat(p.client_price || p.unit_price || '0') * (p.quantity || 1);

                      return (
                        <div
                          key={p.id}
                          className="p-3.5 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3"
                        >
                          <div>
                            <span className="text-xs font-bold text-slate-900">
                              {idx + 1}. {partName}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium ml-2">
                              ({p.quantity} {p.unit || p.part?.unit || 'шт'})
                            </span>
                          </div>
                          <span className="text-xs font-black text-slate-900">
                            {price.toLocaleString('ru-RU')} ₽
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Начисления ЗП и финансовая сводка наряда */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4.5 space-y-3 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">
                      account_balance_wallet
                    </span>
                    Финансовый расчёт и начисленная ЗП
                  </span>
                  <span className="text-xs font-bold text-slate-300">
                    Итого по наряду: <b>{totalClient.toLocaleString('ru-RU')} ₽</b>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                    <div className="text-[10px] font-bold uppercase text-slate-400">
                      Начислено механику ({order.mechanic?.name || 'Основной'})
                    </div>
                    <div className="text-lg font-black text-emerald-400 mt-0.5">
                      {parseFloat(order.mechanic_pay || '0').toLocaleString('ru-RU')} ₽
                    </div>
                  </div>

                  {order.second_mechanic?.name && (
                    <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                      <div className="text-[10px] font-bold uppercase text-slate-400">
                        Начислено 2-му механику ({order.second_mechanic.name})
                      </div>
                      <div className="text-lg font-black text-emerald-400 mt-0.5">
                        {parseFloat(order.second_mechanic_pay || '0').toLocaleString('ru-RU')} ₽
                      </div>
                    </div>
                  )}
                </div>

                {transactions.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 space-y-1.5">
                    <div className="text-[10px] font-bold uppercase text-slate-400">
                      Связанные финансовые транзакции:
                    </div>
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="text-xs flex items-center justify-between bg-slate-800/50 px-2.5 py-1.5 rounded-lg"
                      >
                        <span className="text-slate-300 font-medium truncate max-w-[70%]">
                          {tx.description || 'Начисление ЗП'}
                        </span>
                        <span className="font-mono font-bold text-amber-400">
                          +{parseFloat(tx.amount || '0').toLocaleString('ru-RU')} ₽
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
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

type StaffTx = PayrollUser['history'][number] & {
  from_wallet?: { id: string; name: string; type: string } | null;
  transaction_date?: string | null;
  service_order_id?: string | null;
  trip_id?: string | null;
  service_order?: {
    id: string;
    order_number: number | string;
    machine_type: 'own' | 'client';
    client_name?: string | null;
    client_vehicle_brand?: string | null;
    client_vehicle_model?: string | null;
    client_vehicle_reg?: string | null;
    vehicle_label?: string;
    order_date?: string | null;
    created_at?: string | null;
    asset?: {
      id: string;
      short_name: string;
      reg_number: string;
      make?: string;
      model?: string;
    } | null;
  } | null;
  trip?: {
    id: string;
    trip_number?: string | number;
    vehicle_label?: string;
    started_at?: string | null;
    trip_date?: string | null;
    created_at?: string | null;
  } | null;
};

function classifyStaffTx(tx: StaffTx) {
  const isAdvanceGiven = tx.category_id === ADVANCE_CAT && tx.direction === 'expense';
  const isAdvanceOffset = tx.category_id === ADVANCE_CAT && tx.direction === 'income';
  const isPayout =
    Boolean(tx.from_wallet_id) ||
    Boolean(tx.description && tx.description.startsWith('Выплата зарплаты'));
  const isPayrollAccrual = PAYROLL_CATS.includes(tx.category_id) && !isPayout;

  if (isPayrollAccrual) {
    let source = 'Зарплата';
    const lower = (tx.description || '').toLowerCase();
    if (lower.includes('рейс')) {
      source = 'Рейс';
    } else if (lower.includes('наряд') || lower.includes('нз-') || lower.includes('н3-')) {
      source = 'Гараж / СТО';
    }
    return {
      type: 'accrual' as const,
      isIncome: true,
      badgeText: 'Заработано',
      badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      source,
      title: tx.description || 'Начисление зарплаты',
    };
  }

  if (isPayout) {
    const walletName =
      tx.from_wallet?.name ||
      (tx.description?.includes('Касса')
        ? '💵 Касса наличные'
        : tx.description?.includes('Р/С') || tx.description?.includes('Банк')
          ? '🏦 Р/С (Банк)'
          : '💵 Выплата деньгами');
    return {
      type: 'payout' as const,
      isIncome: false,
      badgeText: 'Выплата ЗП',
      badgeCls: 'bg-blue-50 text-blue-700 border-blue-200',
      source: walletName,
      title: tx.description || 'Выплата зарплаты',
    };
  }

  if (isAdvanceGiven) {
    const walletName =
      tx.from_wallet?.name ||
      (tx.description?.includes('Касса') ? '💵 Касса наличные' : '💰 Аванс');
    return {
      type: 'advance' as const,
      isIncome: false,
      badgeText: 'Выдан аванс',
      badgeCls: 'bg-purple-50 text-purple-700 border-purple-200',
      source: walletName,
      title: tx.description || 'Выдан аванс',
    };
  }

  if (isAdvanceOffset) {
    return {
      type: 'offset' as const,
      isIncome: true,
      badgeText: 'Зачёт аванса',
      badgeCls: 'bg-slate-100 text-slate-600 border-slate-200',
      source: 'Взаимозачёт',
      title: tx.description || 'Зачёт ранее выданного аванса',
    };
  }

  return {
    type: 'other' as const,
    isIncome: tx.direction === 'income',
    badgeText: tx.direction === 'income' ? 'Поступление' : 'Списание',
    badgeCls: 'bg-slate-100 text-slate-700 border-slate-200',
    source: 'Операция',
    title: tx.description || 'Операция',
  };
}

function parseAccrualMeta(tx: StaffTx) {
  const desc = tx.description || '';
  const so = tx.service_order;
  const trip = tx.trip;

  const orderMatch =
    desc.match(/(?:наряд|наряда|заказ-наряд|заказ-наряда)\s*[#№]?\s*([A-Za-zА-Яа-я0-9_-]+)/i) ||
    desc.match(/\b(Н[3З]-[0-9]+)\b/i);

  const tripMatch = desc.match(/(?:рейс|рейса)\s*[#№]?\s*([0-9]+)/i);

  let workName = '';
  const colonIndex = desc.indexOf(':');
  if (colonIndex !== -1) {
    const afterColon = desc.slice(colonIndex + 1).trim();
    const parenIndex = afterColon.indexOf('(');
    workName = parenIndex !== -1 ? afterColon.slice(0, parenIndex).trim() : afterColon;
  }

  if (tx.service_order_id || so || orderMatch) {
    const orderNum = so?.order_number
      ? String(so.order_number)
      : orderMatch
        ? orderMatch[1]
        : tx.service_order_id
          ? tx.service_order_id.slice(0, 8)
          : '';

    const orderIdToOpen = so?.id || tx.service_order_id || orderNum;
    const vehicleDesc = so?.vehicle_label || '';
    const eventDate =
      so?.order_date || so?.created_at || tx.transaction_date || tx.created_at || null;

    return {
      isOrder: true,
      isTrip: false,
      orderNumber: orderNum,
      service_order_id: orderIdToOpen,
      vehicleDesc,
      eventDate,
      workName: workName || 'Выполненные работы',
      groupKey: `order_${orderIdToOpen || orderNum}`,
    };
  }

  if (tx.trip_id || trip || tripMatch) {
    const tripNum = trip?.trip_number
      ? String(trip.trip_number)
      : tripMatch
        ? tripMatch[1]
        : tx.trip_id
          ? tx.trip_id.slice(0, 8)
          : '';
    const vehicleDesc = trip?.vehicle_label || '';
    const eventDate =
      trip?.trip_date ||
      trip?.started_at ||
      trip?.created_at ||
      tx.transaction_date ||
      tx.created_at ||
      null;

    return {
      isOrder: false,
      isTrip: true,
      tripNumber: tripNum,
      trip_id: trip?.id || tx.trip_id || null,
      vehicleDesc,
      eventDate,
      workName: desc,
      groupKey: `trip_${tx.trip_id || tripNum}`,
    };
  }

  return {
    isOrder: false,
    isTrip: false,
    vehicleDesc: '',
    eventDate: tx.transaction_date || tx.created_at || null,
    workName: desc || 'Начисление',
    groupKey: `tx_${tx.id}`,
  };
}

type GroupedAccrualItem = {
  id: string;
  groupKey: string;
  isOrder: boolean;
  isTrip: boolean;
  title: string;
  orderNumber?: string;
  tripNumber?: string;
  service_order_id?: string | null;
  trip_id?: string | null;
  vehicle_desc?: string;
  eventDate?: string | null;
  paidDate?: string | null;
  category_id: string;
  source: string;
  latestDate: string;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  paidPct: number;
  settlement_status: 'completed' | 'pending' | 'partial';
  employee_confirmed?: boolean | null;
  works: Array<{
    id: string;
    title: string;
    amount: number;
    settlement_status: string;
    employee_confirmed: boolean | null;
    updated_at?: string | null;
    rawTx: StaffTx;
  }>;
};

function PayrollHistoryModal({
  user,
  onClose,
  onChanged,
}: {
  user: PayrollUser;
  onClose: () => void;
  onSettle?: () => void;
  onChanged: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'accruals' | 'payouts' | 'advances'>('accruals');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null);

  const history = (user.history ?? []) as StaffTx[];

  // Accruals (Поступления)
  const accruals = useMemo(
    () => history.filter((t) => classifyStaffTx(t).type === 'accrual'),
    [history],
  );

  // Payouts (Выплаты)
  const payouts = useMemo(
    () => history.filter((t) => classifyStaffTx(t).type === 'payout'),
    [history],
  );

  // Advances (Авансы и займы)
  const advancesHistory = useMemo(() => {
    return history.filter((t) => {
      const isAdvCat = t.category_id === ADVANCE_CAT;
      const desc = (t.description || '').toLowerCase();
      const isWorkAccrual =
        PAYROLL_CATS.includes(t.category_id) ||
        desc.includes('наряд') ||
        desc.includes('долг механику') ||
        desc.includes('рейс');
      if (isWorkAccrual) return false;
      return (
        isAdvCat ||
        desc.includes('аванс') ||
        desc.includes('займ') ||
        (desc.includes('долг') && !desc.includes('долг механику'))
      );
    });
  }, [history]);

  const totalAdvancesGiven = useMemo(() => {
    return advancesHistory
      .filter((t) => t.direction === 'expense')
      .reduce((sum, t) => sum + (parseFloat(t.amount || '0') || 0), 0);
  }, [advancesHistory]);

  const totalAdvancesOffset = useMemo(() => {
    return advancesHistory
      .filter((t) => t.direction === 'income')
      .reduce((sum, t) => sum + (parseFloat(t.amount || '0') || 0), 0);
  }, [advancesHistory]);

  // Group service order and trip works
  const groupedAccruals = useMemo(() => {
    const map = new Map<string, GroupedAccrualItem>();

    for (const tx of accruals) {
      const parsed = parseAccrualMeta(tx);
      const amt = parseFloat(tx.amount || '0') || 0;
      const isCompleted = tx.settlement_status === 'completed';
      const txDate = tx.transaction_date || tx.created_at || '';
      const txPaidDate = isCompleted ? tx.updated_at || tx.transaction_date || tx.created_at : null;

      let group = map.get(parsed.groupKey);
      if (!group) {
        let title = tx.description || 'Начисление';
        let source = 'Зарплата';
        if (parsed.isOrder) {
          title = `Заказ-наряд #${parsed.orderNumber}`;
          source = 'Гараж / СТО';
        } else if (parsed.isTrip) {
          title = `Рейс #${parsed.tripNumber}`;
          source = 'Рейс';
        }

        group = {
          id: tx.id,
          groupKey: parsed.groupKey,
          isOrder: parsed.isOrder,
          isTrip: parsed.isTrip,
          title,
          orderNumber: parsed.orderNumber,
          tripNumber: parsed.tripNumber,
          service_order_id: parsed.service_order_id,
          trip_id: parsed.trip_id,
          vehicle_desc: parsed.vehicleDesc,
          eventDate: parsed.eventDate,
          paidDate: txPaidDate,
          category_id: tx.category_id,
          source,
          latestDate: txDate,
          totalAmount: 0,
          paidAmount: 0,
          unpaidAmount: 0,
          paidPct: 0,
          settlement_status: 'pending',
          works: [],
        };
        map.set(parsed.groupKey, group);
      } else {
        if (parsed.vehicleDesc && !group.vehicle_desc) {
          group.vehicle_desc = parsed.vehicleDesc;
        }
        if (parsed.eventDate && !group.eventDate) {
          group.eventDate = parsed.eventDate;
        }
        if (txPaidDate && (!group.paidDate || new Date(txPaidDate) > new Date(group.paidDate))) {
          group.paidDate = txPaidDate;
        }
      }

      if (txDate && (!group.latestDate || new Date(txDate) > new Date(group.latestDate))) {
        group.latestDate = txDate;
      }

      group.totalAmount += amt;
      if (isCompleted) {
        group.paidAmount += amt;
      } else {
        group.unpaidAmount += amt;
      }

      group.works.push({
        id: tx.id,
        title: parsed.workName || tx.description || 'Работа',
        amount: amt,
        settlement_status: tx.settlement_status,
        employee_confirmed: tx.employee_confirmed,
        updated_at: tx.updated_at,
        rawTx: tx,
      });
    }

    return Array.from(map.values()).map((g) => {
      const paidPct = g.totalAmount > 0 ? (g.paidAmount / g.totalAmount) * 100 : 0;
      let settlement_status: 'completed' | 'pending' | 'partial' = 'pending';
      if (g.paidAmount >= g.totalAmount - 0.01) {
        settlement_status = 'completed';
      } else if (g.paidAmount > 0.01) {
        settlement_status = 'partial';
      }

      const hasUnconfirmed = g.works.some((w) => w.employee_confirmed === false);

      return {
        ...g,
        paidPct,
        settlement_status,
        employee_confirmed: hasUnconfirmed ? false : true,
      };
    });
  }, [accruals]);

  const advanceDebt = parseFloat(user.advance_balance || '0') || 0;

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
    if (!confirm('Подтвердить это начисление за сотрудника?')) return;
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-800 text-2xl">payments</span>
              <h2 className="font-black text-slate-900 text-lg">
                Поступления и выплаты: {user.name}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 text-xl leading-none transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* ── Tabs Navigation ── */}
        <div className="flex border-b border-slate-200 bg-white px-6 shrink-0 gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('accruals')}
            className={cn(
              'py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer',
              activeTab === 'accruals'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            <span>Начисления</span>
            <span
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-full font-extrabold',
                activeTab === 'accruals'
                  ? 'bg-emerald-200 text-emerald-900'
                  : 'bg-slate-100 text-slate-600',
              )}
            >
              {groupedAccruals.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payouts')}
            className={cn(
              'py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer',
              activeTab === 'payouts'
                ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            <span className="material-symbols-outlined text-[18px]">payments</span>
            <span>Выплаты ЗП</span>
            <span
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-full font-extrabold',
                activeTab === 'payouts'
                  ? 'bg-blue-200 text-blue-900'
                  : 'bg-slate-100 text-slate-600',
              )}
            >
              {payouts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('advances')}
            className={cn(
              'py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer',
              activeTab === 'advances'
                ? 'border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            <span className="material-symbols-outlined text-[18px]">savings</span>
            <span>Авансы и займы</span>
            <span
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-full font-extrabold',
                advanceDebt > 0
                  ? 'bg-rose-100 text-rose-700 font-black'
                  : activeTab === 'advances'
                    ? 'bg-purple-200 text-purple-900'
                    : 'bg-slate-100 text-slate-600',
              )}
            >
              {advanceDebt > 0
                ? `${advanceDebt.toLocaleString('ru-RU')} ₽`
                : advancesHistory.length}
            </span>
          </button>
        </div>

        {/* ── Tab Content ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-100/50">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-xs font-bold">
              {error}
            </div>
          )}

          {/* TAB 1: ACCRUALS */}
          {activeTab === 'accruals' && (
            <>
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Список начислений по рейсам и нарядам
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  Всего {groupedAccruals.length} операций
                </span>
              </div>

              {groupedAccruals.length === 0 ? (
                <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                  <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">
                    receipt_long
                  </span>
                  <p className="text-sm font-medium">Нет поступлений и начислений</p>
                </div>
              ) : (
                groupedAccruals.map((g) => {
                  const isCompleted = g.settlement_status === 'completed';
                  const isPartial = g.settlement_status === 'partial';
                  const isPending = g.settlement_status === 'pending';

                  const parsedEventDate = g.eventDate
                    ? new Date(g.eventDate)
                    : g.latestDate
                      ? new Date(g.latestDate)
                      : null;
                  const eventDateStr =
                    parsedEventDate && !isNaN(parsedEventDate.getTime())
                      ? parsedEventDate.toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—';

                  const parsedPaidDate = g.paidDate
                    ? new Date(g.paidDate)
                    : g.latestDate
                      ? new Date(g.latestDate)
                      : null;
                  const paidDateStr =
                    parsedPaidDate && !isNaN(parsedPaidDate.getTime())
                      ? parsedPaidDate.toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : eventDateStr;

                  const displayVehicle =
                    g.vehicle_desc ||
                    (g.isTrip && user.asset
                      ? [
                          user.asset.short_name,
                          user.asset.reg_number ? `(${user.asset.reg_number})` : '',
                        ]
                          .filter(Boolean)
                          .join(' ')
                      : null);

                  const isExpanded = Boolean(expandedGroups[g.groupKey]);
                  const hasMultipleWorks = g.works.length > 1;

                  return (
                    <div
                      key={g.groupKey}
                      className={cn(
                        'rounded-2xl p-4.5 shadow-xs relative overflow-hidden transition-all border-2 group',
                        isCompleted
                          ? 'bg-emerald-50/70 border-emerald-300 hover:border-emerald-400'
                          : isPartial
                            ? 'bg-emerald-50/40 border-amber-300 hover:border-amber-400'
                            : 'bg-white border-slate-200 hover:border-slate-300',
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={cn(
                                'text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border',
                                g.isOrder
                                  ? 'bg-amber-100 text-amber-900 border-amber-200'
                                  : 'bg-indigo-100 text-indigo-900 border-indigo-200',
                              )}
                            >
                              {g.source}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                              📅 {eventDateStr}
                            </span>
                            {displayVehicle && (
                              <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                                🚛 {displayVehicle}
                              </span>
                            )}
                          </div>

                          {g.isOrder ? (
                            <div className="flex items-center gap-2 flex-wrap pt-0.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setViewingOrderId(g.service_order_id || g.orderNumber || null)
                                }
                                className="text-base font-extrabold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 cursor-pointer text-left leading-tight group/link"
                                title="Нажмите, чтобы открыть детали и смету заказ-наряда"
                              >
                                <span>{g.title}</span>
                                <span className="material-symbols-outlined text-[16px] text-blue-500 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform">
                                  open_in_new
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setViewingOrderId(g.service_order_id || g.orderNumber || null)
                                }
                                className="text-[10px] font-black uppercase text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-md transition-all active:scale-95 cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                <span className="material-symbols-outlined text-[12px]">
                                  visibility
                                </span>
                                <span>Детали наряда</span>
                              </button>
                            </div>
                          ) : (
                            <h4 className="text-base font-extrabold text-slate-900 leading-tight">
                              {g.title}
                            </h4>
                          )}

                          {g.employee_confirmed === false && (
                            <div className="flex items-center gap-2 pt-0.5">
                              <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1 bg-amber-100/80 border border-amber-300 px-2 py-0.5 rounded">
                                <span className="material-symbols-outlined text-[12px]">timer</span>
                                Ожидает подтверждения
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  g.works.forEach((w) => {
                                    if (w.employee_confirmed === false) handleConfirmAdmin(w.id);
                                  });
                                }}
                                disabled={saving}
                                className="text-[10px] text-emerald-800 bg-emerald-100 border border-emerald-300 hover:bg-emerald-200 rounded px-2 py-0.5 font-bold transition-colors cursor-pointer"
                              >
                                ✓ Подтвердить всё
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'text-lg sm:text-xl font-black tracking-tight',
                                isCompleted ? 'text-emerald-700' : 'text-slate-900',
                              )}
                            >
                              +&nbsp;{g.totalAmount.toLocaleString('ru-RU')} ₽
                            </span>
                          </div>

                          {isCompleted && (
                            <div className="flex flex-col items-end gap-1">
                              <div className="inline-flex items-center gap-1 px-3 py-1 bg-white/90 border-2 border-emerald-600 text-emerald-700 font-black text-[11px] rounded-lg uppercase tracking-wider shadow-xs rotate-[-2deg] select-none">
                                <span className="material-symbols-outlined text-[15px]">
                                  verified
                                </span>
                                ОПЛАЧЕНО
                              </div>
                              <span className="text-[10px] text-emerald-800 font-extrabold bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-md shadow-2xs">
                                выплачено {paidDateStr}
                              </span>
                            </div>
                          )}

                          {isPending && (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/90 border-2 border-rose-500 text-rose-700 font-black text-[10px] rounded-lg uppercase tracking-wider rotate-[-2deg] select-none">
                              <span className="material-symbols-outlined text-[13px]">
                                hourglass_top
                              </span>
                              НЕ ОПЛАЧЕНО
                            </div>
                          )}

                          {isPartial && (
                            <div className="flex flex-col items-end gap-1">
                              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100/90 border border-emerald-300 text-emerald-900 font-extrabold text-[10px] rounded-md uppercase tracking-wide">
                                <span className="material-symbols-outlined text-[12px] text-emerald-700">
                                  done
                                </span>
                                <span>
                                  Оплачено {g.paidAmount.toLocaleString('ru-RU')} ₽ (
                                  {Math.round(g.paidPct)}%)
                                </span>
                              </div>
                              <span className="text-[10px] text-emerald-700 font-bold">
                                выплачено {paidDateStr}
                              </span>
                              <span className="text-[11px] font-bold text-rose-700">
                                Остаток: {g.unpaidAmount.toLocaleString('ru-RU')} ₽
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {hasMultipleWorks && (
                        <div className="relative z-10 mt-3 pt-2.5 border-t border-slate-200/70">
                          <button
                            type="button"
                            onClick={() => toggleGroup(g.groupKey)}
                            className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 py-1 cursor-pointer transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px] text-slate-500">
                              {isExpanded ? 'expand_less' : 'expand_more'}
                            </span>
                            <span>
                              {isExpanded
                                ? 'Скрыть детализацию'
                                : `Показать все работы (${g.works.length})`}
                            </span>
                          </button>

                          {isExpanded && (
                            <div className="mt-2 space-y-1.5 bg-white/80 rounded-xl p-3 border border-slate-200 shadow-xs">
                              <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                                Состав работ:
                              </div>
                              {g.works.map((w) => {
                                const isWorkPaid = w.settlement_status === 'completed';
                                return (
                                  <div
                                    key={w.id}
                                    className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0 group/item hover:bg-slate-50 rounded px-1.5 transition-colors"
                                  >
                                    <div className="flex-1 pr-2">
                                      <span className="font-medium text-slate-800">{w.title}</span>
                                      {w.employee_confirmed === false && (
                                        <button
                                          type="button"
                                          onClick={() => handleConfirmAdmin(w.id)}
                                          disabled={saving}
                                          className="ml-2 text-[9px] text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded px-1.5 py-0.5 font-bold transition-colors cursor-pointer"
                                        >
                                          ✓ Подтвердить
                                        </button>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {editingId === w.id ? (
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={editAmount}
                                            onChange={(e) => setEditAmount(e.target.value)}
                                            className="w-20 border border-emerald-400 rounded px-1.5 py-0.5 text-xs font-bold"
                                            autoFocus
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleSave(w.id)}
                                            disabled={saving}
                                            className="text-xs bg-emerald-600 text-white rounded px-2 py-0.5 font-bold hover:bg-emerald-700 disabled:opacity-50"
                                          >
                                            ✓
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setEditingId(null)}
                                            className="text-xs text-slate-400 hover:text-slate-600 px-1"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ) : (
                                        <>
                                          <span
                                            className={cn(
                                              'font-bold',
                                              isWorkPaid ? 'text-emerald-700' : 'text-rose-600',
                                            )}
                                          >
                                            {w.amount.toLocaleString('ru-RU')} ₽
                                          </span>
                                          <span
                                            className={cn(
                                              'text-[9px] font-black px-1.5 py-0.5 rounded border uppercase',
                                              isWorkPaid
                                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                                : 'bg-rose-100 text-rose-800 border-rose-200',
                                            )}
                                          >
                                            {isWorkPaid ? 'Оплачено' : 'К выплате'}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingId(w.id);
                                              setEditAmount(String(w.amount));
                                            }}
                                            className="text-slate-400 hover:text-blue-600 opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5"
                                            title="Изменить сумму работы"
                                          >
                                            <span className="material-symbols-outlined text-[14px]">
                                              edit
                                            </span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDelete(w.id, w.title)}
                                            disabled={saving}
                                            className="text-slate-400 hover:text-rose-600 opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5"
                                            title="Удалить работу"
                                          >
                                            <span className="material-symbols-outlined text-[14px]">
                                              delete
                                            </span>
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {!hasMultipleWorks && g.works[0] && (
                        <div className="relative z-10 flex items-center justify-end gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {editingId === g.works[0].id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                                className="w-24 border border-emerald-400 rounded-lg px-2 py-1 text-xs font-bold"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSave(g.works[0]!.id)}
                                disabled={saving}
                                className="text-xs bg-emerald-600 text-white rounded-lg px-2.5 py-1 font-bold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                              >
                                ✓ Сохранить
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="text-xs text-slate-400 hover:text-slate-600 px-1.5 py-1"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(g.works[0]!.id);
                                  setEditAmount(String(g.works[0]!.amount));
                                }}
                                className="text-slate-400 hover:text-blue-600 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                                title="Редактировать сумму"
                              >
                                <span className="material-symbols-outlined text-[15px]">edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(g.works[0]!.id, g.title)}
                                disabled={saving}
                                className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                                title="Удалить"
                              >
                                <span className="material-symbols-outlined text-[15px]">
                                  delete
                                </span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* TAB 2: PAYOUTS */}
          {activeTab === 'payouts' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  История выплат ЗП сотруднику
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  Всего {payouts.length} выплат
                </span>
              </div>

              {payouts.length === 0 ? (
                <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                  <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">
                    payments
                  </span>
                  <p className="text-sm font-medium">Нет зарегистрированных выплат ЗП</p>
                </div>
              ) : (
                payouts.map((tx) => {
                  const d = tx.transaction_date || tx.created_at;
                  const dateStr = d
                    ? new Date(d).toLocaleString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—';
                  const walletName =
                    tx.from_wallet?.name ||
                    (tx.description?.includes('Касса')
                      ? '💵 Сейф (Наличные)'
                      : tx.description?.includes('Р/С') || tx.description?.includes('Банк')
                        ? '🏦 Р/С (Банк)'
                        : '💵 Кошелек');

                  return (
                    <div
                      key={tx.id}
                      className="bg-white rounded-2xl p-4.5 border border-slate-200 shadow-xs flex items-start justify-between gap-4 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                          <span className="material-symbols-outlined text-[20px]">payments</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full border border-blue-200">
                              {walletName}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">{dateStr}</span>
                          </div>
                          <p className="text-sm font-bold text-slate-900 leading-snug">
                            {tx.description || 'Выплата заработной платы'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-lg font-black text-blue-600">
                          -&nbsp;{parseFloat(tx.amount || '0').toLocaleString('ru-RU')} ₽
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: ADVANCES & LOANS */}
          {activeTab === 'advances' && (
            <div className="space-y-4">
              {/* Advance Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-purple-50 rounded-2xl p-4 border border-purple-200">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 block">
                    Текущий долг по авансу
                  </span>
                  <span className="text-2xl font-black text-purple-900 mt-1 block">
                    {advanceDebt.toLocaleString('ru-RU')} ₽
                  </span>
                  <span className="text-[10px] text-purple-600 font-medium">
                    {advanceDebt > 0 ? 'Сотрудник должен компании' : 'Долгов по авансам нет'}
                  </span>
                </div>

                <div className="bg-rose-50 rounded-2xl p-4 border border-rose-200">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 block">
                    Всего выдано займов
                  </span>
                  <span className="text-2xl font-black text-rose-700 mt-1 block">
                    + {totalAdvancesGiven.toLocaleString('ru-RU')} ₽
                  </span>
                  <span className="text-[10px] text-rose-600 font-medium">
                    Все выданные авансы за всё время
                  </span>
                </div>

                <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 block">
                    Всего удержано / погашено
                  </span>
                  <span className="text-2xl font-black text-emerald-700 mt-1 block">
                    - {totalAdvancesOffset.toLocaleString('ru-RU')} ₽
                  </span>
                  <span className="text-[10px] text-emerald-600 font-medium">
                    Зачтено из зарплаты или возвращено
                  </span>
                </div>
              </div>

              {/* Operations list */}
              <div className="flex items-center justify-between px-1 pt-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Хронология движения авансов и займов
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  Всего {advancesHistory.length} операций
                </span>
              </div>

              {advancesHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                  <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">
                    savings
                  </span>
                  <p className="text-sm font-medium">История авансов и займов пуста</p>
                </div>
              ) : (
                advancesHistory.map((tx) => {
                  const isGiven = tx.direction === 'expense';
                  const amt = parseFloat(tx.amount || '0') || 0;
                  const d = tx.transaction_date || tx.created_at;
                  const dateStr = d
                    ? new Date(d).toLocaleString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—';

                  return (
                    <div
                      key={tx.id}
                      className={cn(
                        'rounded-2xl p-4.5 shadow-xs border flex items-start justify-between gap-4 transition-all group',
                        isGiven
                          ? 'bg-purple-50/50 border-purple-200 hover:border-purple-300'
                          : 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-300',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5',
                            isGiven
                              ? 'bg-purple-100 border-purple-300 text-purple-700'
                              : 'bg-emerald-100 border-emerald-300 text-emerald-700',
                          )}
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            {isGiven ? 'add_circle' : 'check_circle'}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={cn(
                                'text-xs font-black px-2.5 py-0.5 rounded-full border',
                                isGiven
                                  ? 'bg-purple-100 text-purple-800 border-purple-200'
                                  : 'bg-emerald-100 text-emerald-800 border-emerald-200',
                              )}
                            >
                              {isGiven ? '➕ Выдан аванс / займ' : '➖ Зачёт аванса в ЗП'}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">{dateStr}</span>
                          </div>
                          <p className="text-sm font-bold text-slate-900 leading-snug">
                            {tx.description || (isGiven ? 'Выдача аванса' : 'Зачёт аванса')}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                        <span
                          className={cn(
                            'text-lg font-black tracking-tight',
                            isGiven ? 'text-purple-700' : 'text-emerald-700',
                          )}
                        >
                          {isGiven ? '+' : '−'} {amt.toLocaleString('ru-RU')} ₽
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDelete(tx.id, tx.description || 'Аванс')}
                          disabled={saving}
                          className="text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-white"
                          title="Удалить запись"
                        >
                          <span className="material-symbols-outlined text-[15px]">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {viewingOrderId && (
        <ServiceOrderViewModal orderId={viewingOrderId} onClose={() => setViewingOrderId(null)} />
      )}
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
  onAdjustDebt,
}: {
  user: PayrollUser;
  onSettle: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
  onAdvance?: () => void;
  onManualPay: () => void;
  onHistory: () => void;
  onAdjustDebt?: () => void;
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
                <>
                  <p className="text-[9px] text-violet-600 font-bold">
                    аванс: <Money amount={user.advance_balance} />
                  </p>
                  <p className="text-[8px] text-slate-400">
                    зачёт <Money amount={user.advance_offset} /> · к выдаче{' '}
                    <Money amount={user.payout} />
                  </p>
                </>
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
          {onAdvance && (
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
          )}
          {onAdjustDebt && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAdjustDebt();
              }}
              className="text-xs font-black px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors shrink-0"
              title="Редактировать целевую сумму долга"
            >
              ✏️ Долг
            </button>
          )}
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
  onAdjustDebt,
}: {
  users: PayrollUser[];
  headerBg: string;
  headerTextColor: string;
  onSettle: (u: PayrollUser) => void;
  onEdit: (u: PayrollUser) => void;
  onDeactivate: (u: PayrollUser) => void;
  onAdvance?: (u: PayrollUser) => void;
  onManualPay: (u: PayrollUser) => void;
  onHistory: (u: PayrollUser) => void;
  onAdjustDebt?: (u: PayrollUser) => void;
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
          onAdvance={onAdvance ? () => onAdvance(u) : undefined}
          onManualPay={() => onManualPay(u)}
          onHistory={() => onHistory(u)}
          onAdjustDebt={onAdjustDebt ? () => onAdjustDebt(u) : undefined}
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

type GroupKey = 'drivers' | 'loaders' | 'workshop' | 'debts';

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
  debts: {
    label: 'Долги сотрудников',
    headerBg: 'bg-violet-600',
    headerTextColor: 'text-violet-100',
    tabActive: 'bg-violet-600 text-white shadow-sm',
    tabInactive:
      'bg-white border border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-700',
    countActive: 'bg-white/25 text-white',
    countInactive: 'bg-slate-100 text-slate-500',
    getUsers: (p) => {
      const all = [...p.drivers, ...p.loaders, ...p.mechanics, ...p.office];
      return all.filter((u) => parseFloat(u.advance_balance ?? '0') > 0);
    },
    getCount: (p) => {
      const all = [...p.drivers, ...p.loaders, ...p.mechanics, ...p.office];
      return all.filter((u) => parseFloat(u.advance_balance ?? '0') > 0).length;
    },
  },
};

// ─── AddStaffDebtModal ────────────────────────────────────────────────────────

function AddStaffDebtModal({
  allUsers,
  initialUserId,
  initialAction = 'add',
  onClose,
  onSuccess,
}: {
  allUsers: PayrollUser[];
  initialUserId?: string;
  initialAction?: 'add' | 'repay' | 'adjust';
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [action, setAction] = useState<'add' | 'repay' | 'adjust'>(initialAction);
  const [userId, setUserId] = useState(initialUserId || (allUsers[0]?.id ?? ''));
  const selectedUser = allUsers.find((u) => u.id === userId);
  const currentDebt = selectedUser ? parseFloat(selectedUser.advance_balance ?? '0') : 0;

  const [amount, setAmount] = useState(initialAction === 'adjust' ? currentDebt.toFixed(0) : '');
  const [walletId, setWalletId] = useState('10000000-0000-0000-0000-000000000002'); // Касса по умолчанию
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      fetch('/api/staff/debt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          user_id: userId,
          ...(action === 'adjust'
            ? { target_amount: parseFloat(amount.replace(',', '.')).toFixed(2) }
            : { amount: parseFloat(amount.replace(',', '.')).toFixed(2) }),
          ...(action === 'add'
            ? { from_wallet_id: walletId }
            : action === 'repay'
              ? { to_wallet_id: walletId }
              : {}),
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
    if (!userId) {
      setError('Выберите сотрудника');
      return;
    }
    const val = parseFloat(amount.replace(',', '.'));
    if (isNaN(val) || val < 0) {
      setError('Введите корректную сумму');
      return;
    }
    setError('');
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">
              {action === 'add'
                ? '💳 Записать долг сотруднику'
                : action === 'repay'
                  ? '📥 Погашение долга сотрудником'
                  : '✏️ Редактирование суммы долга'}
            </h2>
            <p className="text-xs text-slate-500">Учёт авансов и внутренних займов</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Режим: Выдать долг / Погасить / Редактировать */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setAction('add');
                setAmount('');
              }}
              className={cn(
                'flex-1 py-2 text-[11px] font-bold rounded-lg transition-all',
                action === 'add'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800',
              )}
            >
              + Записать
            </button>
            <button
              type="button"
              onClick={() => {
                setAction('repay');
                setAmount('');
              }}
              className={cn(
                'flex-1 py-2 text-[11px] font-bold rounded-lg transition-all',
                action === 'repay'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800',
              )}
            >
              ✓ Погашение
            </button>
            <button
              type="button"
              onClick={() => {
                setAction('adjust');
                setAmount(currentDebt.toFixed(0));
              }}
              className={cn(
                'flex-1 py-2 text-[11px] font-bold rounded-lg transition-all',
                action === 'adjust'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800',
              )}
            >
              ✏️ Задать долг
            </button>
          </div>

          {/* Выбор сотрудника */}
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Сотрудник *</label>
            <select
              value={userId}
              onChange={(e) => {
                const id = e.target.value;
                setUserId(id);
                const u = allUsers.find((x) => x.id === id);
                if (action === 'adjust' && u) {
                  setAmount(parseFloat(u.advance_balance ?? '0').toFixed(0));
                }
              }}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
              {allUsers.map((u) => {
                const adv = parseFloat(u.advance_balance ?? '0');
                return (
                  <option key={u.id} value={u.id}>
                    {u.name} {adv > 0 ? `(Долг: ${adv.toLocaleString('ru-RU')} ₽)` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {currentDebt > 0 && action !== 'adjust' && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5 flex justify-between items-center">
              <span className="text-xs text-violet-700 font-medium">Текущий долг сотрудника:</span>
              <span className="text-sm font-black text-violet-800">
                <Money amount={currentDebt.toFixed(2)} />
              </span>
            </div>
          )}

          {/* Сумма */}
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              {action === 'add'
                ? 'Сумма выдачи/долга, ₽ *'
                : action === 'repay'
                  ? 'Сумма погашения, ₽ *'
                  : 'Новый целевой баланс долга, ₽ *'}
            </label>
            <input
              autoFocus
              type="number"
              min="0"
              step="500"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
              placeholder="0"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-lg font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            {action === 'adjust' && (
              <p className="text-[11px] text-slate-500 mt-1">
                Текущий долг: <b>{currentDebt.toLocaleString('ru-RU')} ₽</b>. Баланс будет
                откорректирован на{' '}
                <b>
                  {(parseFloat(amount || '0') - currentDebt > 0 ? '+' : '') +
                    (parseFloat(amount || '0') - currentDebt).toLocaleString('ru-RU')}{' '}
                  ₽
                </b>
              </p>
            )}
          </div>

          {/* Источник / Касса */}
          {action !== 'adjust' && (
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                {action === 'add' ? 'Списать из' : 'Внести в'}
              </label>
              <select
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
              >
                <option value="10000000-0000-0000-0000-000000000002">💵 Касса (Наличные)</option>
                <option value="10000000-0000-0000-0000-000000000001">🏦 Расчётный счёт</option>
                <option value="none">🚫 Без списания с кошелька (внутренний долг)</option>
              </select>
            </div>
          )}

          {/* Примечание */}
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Причина / Комментарий
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                action === 'add' ? 'На личные нужды, ремонт авто...' : 'Возврат наличными...'
              }
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
          </div>

          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className={cn(
              'flex-1 text-white font-bold text-sm py-3 rounded-xl disabled:opacity-50 transition-colors',
              action === 'add'
                ? 'bg-violet-600 hover:bg-violet-700'
                : 'bg-emerald-600 hover:bg-emerald-700',
            )}
          >
            {mutation.isPending
              ? 'Сохранение...'
              : action === 'add'
                ? '✓ Записать долг'
                : '✓ Внести погашение'}
          </button>
          <button
            onClick={onClose}
            className="text-sm text-slate-500 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [debtModalUser, setDebtModalUser] = useState<{
    user?: PayrollUser;
    action?: 'add' | 'repay' | 'adjust';
  } | null>(null);

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

  const allStaffUsers = payroll
    ? [...payroll.drivers, ...payroll.loaders, ...payroll.mechanics, ...payroll.office].sort(
        (a, b) => a.name.localeCompare(b.name, 'ru'),
      )
    : [];

  const totalDebt = payroll ? parseFloat(payroll.total_debt_alltime) : 0;
  const totalFundMonth = payroll ? parseFloat(payroll.total_earned_month) : 0;
  const totalPaidMonth = payroll ? parseFloat(payroll.total_paid_month) : 0;
  const totalStaff = allStaffUsers.length;

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

      {/* Табы + кнопки действий */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(GROUP_CONFIG) as GroupKey[]).map((key) => {
            const g = GROUP_CONFIG[key];
            const isActive = activeGroup === key;
            const count = payroll ? g.getCount(payroll) : 0;
            return (
              <button
                key={key}
                onClick={() => setActiveGroup(key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all',
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
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setDebtModalUser({ action: 'add' })}
            className="bg-violet-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-violet-700 transition-colors shadow-sm"
          >
            + Записать долг сотрудника
          </button>
          <button
            onClick={() => setEditUser('new')}
            className="bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors"
          >
            + Сотрудник
          </button>
        </div>
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
          onAdvance={activeGroup === 'debts' ? setAdvanceUser : undefined}
          onManualPay={setManualPayUser}
          onHistory={setHistoryUser}
          onAdjustDebt={
            activeGroup === 'debts'
              ? (u) => setDebtModalUser({ user: u, action: 'adjust' })
              : undefined
          }
        />
      )}

      {/* Модал истории транзакций */}
      {historyUser && (
        <PayrollHistoryModal
          user={historyUser}
          onClose={() => setHistoryUser(null)}
          onSettle={() => {
            const u = historyUser;
            setHistoryUser(null);
            setSettleUser(u);
          }}
          onChanged={() => {
            setHistoryUser(null);
            qc.invalidateQueries({ queryKey: ['staff-payroll'] });
          }}
        />
      )}

      {/* Модал зачёта/выплаты */}
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

      {/* Модал универсальной записи/погашения долга */}
      {debtModalUser && (
        <AddStaffDebtModal
          allUsers={allStaffUsers}
          initialUserId={debtModalUser.user?.id}
          initialAction={debtModalUser.action}
          onClose={() => setDebtModalUser(null)}
          onSuccess={() => {
            setDebtModalUser(null);
            qc.invalidateQueries({ queryKey: ['staff-payroll'] });
            qc.invalidateQueries({ queryKey: ['wallets'] });
          }}
        />
      )}

      {/* Модал редактирования сотрудника */}
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
