'use client';

import { useEffect, useState } from 'react';

export interface LegalEntityItem {
  id: string;
  name: string;
  type: 'ooo' | 'ip' | 'self_employed' | string;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  tax_regime: string | null;
  legal_address: string | null;
  bank_name: string | null;
  bik: string | null;
  bank_account: string | null;
  corr_account: string | null;
  edo_id: string | null;
  is_active: boolean | null;
}

interface Props {
  isOpen: boolean;
  entity: LegalEntityItem | null;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY_FORM = {
  name: '',
  type: 'ooo',
  inn: '',
  kpp: '',
  ogrn: '',
  tax_regime: '',
  legal_address: '',
  bank_name: '',
  bik: '',
  bank_account: '',
  corr_account: '',
  edo_id: '',
  is_active: true,
};

export function LegalEntityModal({ isOpen, entity, onClose, onSaved }: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (entity) {
      setForm({
        name: entity.name ?? '',
        type: entity.type ?? 'ooo',
        inn: entity.inn ?? '',
        kpp: entity.kpp ?? '',
        ogrn: entity.ogrn ?? '',
        tax_regime: entity.tax_regime ?? '',
        legal_address: entity.legal_address ?? '',
        bank_name: entity.bank_name ?? '',
        bik: entity.bik ?? '',
        bank_account: entity.bank_account ?? '',
        corr_account: entity.corr_account ?? '',
        edo_id: entity.edo_id ?? '',
        is_active: entity.is_active !== false,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [isOpen, entity]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const method = entity ? 'PATCH' : 'POST';
      const payload = entity ? { id: entity.id, ...form } : form;
      const res = await fetch('/api/organization/legal-entities', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Не удалось сохранить реквизиты');
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError('Ошибка сети при сохранении');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-extrabold text-slate-900">
            {entity ? 'Редактирование реквизитов юрлица' : 'Новое юридическое лицо'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Название юрлица *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ООО «Логистика» или ИП Иванов И.И."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Форма
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="ooo">ООО</option>
                <option value="ip">ИП</option>
                <option value="self_employed">Самозанятый</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                ИНН
              </label>
              <input
                type="text"
                value={form.inn}
                onChange={(e) => setForm({ ...form, inn: e.target.value })}
                placeholder="10 или 12 цифр"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                КПП
              </label>
              <input
                type="text"
                value={form.kpp}
                onChange={(e) => setForm({ ...form, kpp: e.target.value })}
                placeholder="9 цифр"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                ОГРН / ОГРНИП
              </label>
              <input
                type="text"
                value={form.ogrn}
                onChange={(e) => setForm({ ...form, ogrn: e.target.value })}
                placeholder="13 или 15 цифр"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Система налогообл.
              </label>
              <input
                type="text"
                value={form.tax_regime}
                onChange={(e) => setForm({ ...form, tax_regime: e.target.value })}
                placeholder="УСН 6% / ОСНО"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Юридический адрес
            </label>
            <input
              type="text"
              value={form.legal_address}
              onChange={(e) => setForm({ ...form, legal_address: e.target.value })}
              placeholder="Индекс, город, улица, дом, офис"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Банк
              </label>
              <input
                type="text"
                value={form.bank_name}
                onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                placeholder="АО «ТБанк»"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                БИК
              </label>
              <input
                type="text"
                value={form.bik}
                onChange={(e) => setForm({ ...form, bik: e.target.value })}
                placeholder="9 цифр"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Расчётный счёт
              </label>
              <input
                type="text"
                value={form.bank_account}
                onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
                placeholder="20 цифр"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Корр. счёт
              </label>
              <input
                type="text"
                value={form.corr_account}
                onChange={(e) => setForm({ ...form, corr_account: e.target.value })}
                placeholder="20 цифр"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                ID ЭДО (Диадок / СБИС)
              </label>
              <input
                type="text"
                value={form.edo_id}
                onChange={(e) => setForm({ ...form, edo_id: e.target.value })}
                placeholder="2BM-..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <label className="flex items-center gap-2 pt-4 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="rounded border-slate-300"
              />
              Активное юридическое лицо
            </label>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-xs font-bold text-white disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
