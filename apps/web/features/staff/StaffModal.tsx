'use client';

import { useState } from 'react';
import { cn } from '@saldacargo/ui';
import { DriverDocuments } from '@/components/DriverDocuments';
import { ALL_ROLES, emptyForm, ROLE_COLOR, ROLE_LABEL } from './constants';
import type { Asset, StaffUser, UserRole } from './types';
import { parseUserNotesAndPassport } from './utils';

export function StaffModal({
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
  const hasHashedPin = Boolean(editUser?.pin_code?.startsWith('scrypt:'));
  const [pinCleared, setPinCleared] = useState(false);

  const [form, setForm] = useState(
    editUser
      ? {
          name: editUser.name,
          phone: editUser.phone ?? '',
          max_user_id: editUser.max_user_id ?? '',
          pin_code: hasHashedPin ? '' : (editUser.pin_code ?? ''),
          roles: editUser.roles,
          current_asset_id: editUser.current_asset_id ?? '',
          auto_settle: editUser.auto_settle,
          notes: parseUserNotesAndPassport(editUser).noteText ?? '',
          is_officially_employed: editUser.is_officially_employed ?? false,
          official_salary_amount: editUser.official_salary_amount ?? '22500',
          official_salary_day: editUser.official_salary_day ?? 10,
          has_court_orders: editUser.has_court_orders ?? false,
          court_order_pct: editUser.court_order_pct ?? '50',
          court_order_notes: editUser.court_order_notes ?? '',
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
    if (form.pin_code && form.pin_code.trim().length !== 4) {
      setError('PIN-код должен состоять ровно из 4 цифр');
      return;
    }
    setSaving(true);
    setError('');
    const payload: Record<string, unknown> = {
      name: form.name,
      phone: form.phone || null,
      max_user_id: form.max_user_id || null,
      roles: form.roles,
      current_asset_id: form.current_asset_id || null,
      auto_settle: form.auto_settle,
      notes: form.notes || null,
      is_officially_employed: form.is_officially_employed,
      official_salary_amount: parseFloat(form.official_salary_amount || '22500') || 22500,
      official_salary_day: parseInt(String(form.official_salary_day || '10'), 10) || 10,
      has_court_orders: form.has_court_orders,
      court_order_pct: parseFloat(form.court_order_pct || '50') || 50,
      court_order_notes: form.court_order_notes || null,
    };
    if (form.pin_code.trim()) {
      payload.pin_code = form.pin_code.trim();
    } else if (!hasHashedPin || pinCleared) {
      payload.pin_code = null;
    }
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
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <span>🔒</span>
                <span>Личный PIN-код (4 цифры)</span>
              </label>
              {(form.pin_code || (hasHashedPin && !pinCleared)) && (
                <button
                  type="button"
                  onClick={() => {
                    setForm((p) => ({ ...p, pin_code: '' }));
                    setPinCleared(true);
                  }}
                  className="text-[11px] text-rose-600 font-semibold hover:underline"
                >
                  Сбросить PIN
                </button>
              )}
            </div>
            <input
              className={cn(
                inputCls,
                'font-mono tracking-widest text-base font-bold bg-white text-slate-800 placeholder:text-xs placeholder:font-normal placeholder:tracking-normal',
              )}
              placeholder={
                hasHashedPin && !pinCleared
                  ? 'PIN установлен (введите 4 цифры для смены)'
                  : 'Не установлен (напр. 1234)'
              }
              maxLength={4}
              value={form.pin_code}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                setForm((p) => ({ ...p, pin_code: val }));
                if (val) setPinCleared(false);
              }}
            />
            <p className="text-[11px] text-amber-800/80 mt-1.5 leading-snug">
              Используется для авторизации в боте MAX и Web. Оставьте пустым, чтобы сотрудник задал
              его сам при входе.
            </p>
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

          {/* ТК РФ */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.is_officially_employed}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, is_officially_employed: e.target.checked }))
                  }
                  className="w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-bold text-emerald-950 text-sm">ТК РФ</span>
              </label>
              {form.is_officially_employed && (
                <span className="text-[10px] bg-emerald-200/80 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
                  Налог 5 000 ₽ в долг 1-го числа
                </span>
              )}
            </div>

            {form.is_officially_employed && (
              <div className="space-y-2 pt-0.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                      Официальная ЗП (₽)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="500"
                      value={form.official_salary_amount}
                      onChange={f('official_salary_amount')}
                      className="w-full border border-emerald-300 bg-white rounded-lg px-2.5 py-1.5 font-black text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-emerald-700">
                      Официальная выплата (22 500 ₽)
                    </span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                      День выплаты ЗП
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={form.official_salary_day}
                      onChange={f('official_salary_day')}
                      className="w-full border border-emerald-300 bg-white rounded-lg px-2.5 py-1.5 font-black text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-emerald-700">Напоминание в МАКС</span>
                  </div>
                </div>

                <div className="p-2 bg-emerald-100/60 rounded-lg border border-emerald-200/80 text-[11px] text-emerald-900 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span>🏛️ Налог в счёт компании:</span>
                    <strong className="text-emerald-950 font-black">10 000 ₽ / мес</strong>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-semibold">
                    1-го числа в долг сотрудника
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Исполнительный лист (ФССП) */}
          {form.is_officially_employed && (
            <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.has_court_orders}
                    onChange={(e) => setForm((p) => ({ ...p, has_court_orders: e.target.checked }))}
                    className="w-4 h-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="font-bold text-rose-950 text-sm">
                    Исполнительный лист (ФССП)
                  </span>
                </label>
                {form.has_court_orders && (
                  <span className="text-[10px] bg-rose-200 text-rose-900 font-bold px-2 py-0.5 rounded-full">
                    Удержание {parseFloat(form.court_order_pct || '50') || 50}%
                  </span>
                )}
              </div>

              {form.has_court_orders && (
                <div className="space-y-2.5 pt-0.5">
                  <div>
                    <label className="block text-[11px] font-bold text-rose-900 mb-1">
                      Размер удержания (алименты / исп. лист, %)
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative w-28 shrink-0">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          step="1"
                          value={form.court_order_pct}
                          onChange={f('court_order_pct')}
                          className="w-full border border-rose-300 bg-white rounded-lg px-2.5 py-1.5 font-black text-rose-950 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none pr-6"
                        />
                        <span className="absolute right-2.5 top-1.5 text-xs font-bold text-rose-500">
                          %
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {[25, 33, 34, 50, 70].map((pctVal) => (
                          <button
                            key={pctVal}
                            type="button"
                            onClick={() =>
                              setForm((p) => ({ ...p, court_order_pct: String(pctVal) }))
                            }
                            className={cn(
                              'px-2 py-1 text-[11px] font-bold rounded-lg border transition-all',
                              String(form.court_order_pct) === String(pctVal)
                                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                : 'bg-white text-rose-900 border-rose-200 hover:bg-rose-100/70',
                            )}
                          >
                            {pctVal}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const salary = parseFloat(form.official_salary_amount || '22500') || 22500;
                    const pct = Math.min(
                      100,
                      Math.max(0, parseFloat(form.court_order_pct || '50') || 50),
                    );
                    const courtSum = Math.round(salary * (pct / 100));
                    const driverSum = Math.max(0, salary - courtSum);
                    const driverPct = 100 - pct;

                    return (
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2 bg-rose-100/80 rounded-lg border border-rose-200 font-bold text-rose-900">
                            <div className="text-[9px] uppercase text-rose-700">
                              🏛️ Приставам ({pct}%):
                            </div>
                            <div className="text-sm font-black text-rose-950">
                              {courtSum.toLocaleString('ru-RU')} ₽
                            </div>
                          </div>
                          <div className="p-2 bg-emerald-100/80 rounded-lg border border-emerald-200 font-bold text-emerald-900">
                            <div className="text-[9px] uppercase text-emerald-700">
                              💳 Водителю на карту ({driverPct}%):
                            </div>
                            <div className="text-sm font-black text-emerald-950">
                              {driverSum.toLocaleString('ru-RU')} ₽
                            </div>
                          </div>
                        </div>

                        <div className="p-2 bg-rose-100/60 rounded-lg border border-rose-200/80 text-[11px] text-rose-900 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-medium">
                            <span>⚖️ Начисление долга за алименты / ФССП:</span>
                            <strong className="text-rose-950 font-black">
                              {courtSum.toLocaleString('ru-RU')} ₽ / мес
                            </strong>
                          </div>
                          <span className="text-[10px] text-rose-700 font-semibold">
                            1-го числа в долг сотрудника (без деления по дням)
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  <div>
                    <label className="block text-[11px] font-bold text-rose-900 mb-1">
                      Реквизиты ИП / РОСП
                    </label>
                    <input
                      type="text"
                      placeholder="ИП № 12345/26/66001-ИП, Верхнесалдинское РОСП"
                      value={form.court_order_notes}
                      onChange={f('court_order_notes')}
                      className="w-full border border-rose-300 bg-white rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
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
