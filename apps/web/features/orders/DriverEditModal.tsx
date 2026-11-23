'use client';

import React, { useState } from 'react';
import type { OrderDriverOption } from './types';

function getFormDataForId(id: string, allDrivers: OrderDriverOption[]) {
  if (id === 'new') {
    return {
      name: '',
      phone: '',
      inn: '',
      tab_number: '',
      passport_series: '',
      passport_number: '',
      passport_issued_by: '',
      passport_issue_date: '',
      passport_department_code: '',
      license_series: '',
      license_number: '',
      license_issue_date: '',
      license_class: 'C',
    };
  }
  const found = allDrivers.find((d) => d.id === id);
  return {
    name: found?.name || '',
    phone: found?.phone || '',
    inn: found?.inn || '',
    tab_number: found?.tab_number || '',
    passport_series: found?.passport_series || '',
    passport_number: found?.passport_number || '',
    passport_issued_by: found?.passport_issued_by || '',
    passport_issue_date: found?.passport_issue_date || '',
    passport_department_code: found?.passport_department_code || '',
    license_series: found?.license_series || '',
    license_number: found?.license_number || '',
    license_issue_date: found?.license_issue_date || '',
    license_class: found?.license_class || 'C',
  };
}

export function DriverEditModal({
  drivers,
  initialDriverId,
  onClose,
  onSaved,
}: {
  drivers: OrderDriverOption[];
  initialDriverId?: string;
  onClose: () => void;
  onSaved: (driverId: string) => void;
}) {
  const initialId = initialDriverId || (drivers.length > 0 ? drivers[0]!.id : 'new');
  const [selectedId, setSelectedId] = useState<string>(initialId);
  const [formData, setFormData] = useState(() => getFormDataForId(initialId, drivers));
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const isNew = selectedId === 'new';

  const handleSelectDriver = (id: string) => {
    setSelectedId(id);
    setFormData(getFormDataForId(id, drivers));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Укажите ФИО водителя');
      return;
    }
    setIsSaving(true);
    try {
      const commonPayload = {
        name: formData.name.trim(),
        phone: formData.phone || null,
        inn: formData.inn || null,
        tab_number: formData.tab_number || null,
        passport_series: formData.passport_series || null,
        passport_number: formData.passport_number || null,
        passport_issued_by: formData.passport_issued_by || null,
        passport_issue_date: formData.passport_issue_date || null,
        passport_department_code: formData.passport_department_code || null,
        license_series: formData.license_series || null,
        license_number: formData.license_number || null,
        license_issue_date: formData.license_issue_date || null,
        license_class: formData.license_class || 'C',
      };

      if (isNew) {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...commonPayload, roles: ['driver'] }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Ошибка создания водителя');
        }
        const created = await res.json();
        alert(`✅ Водитель ${formData.name} успешно добавлен в справочник!`);
        onSaved(created.id);
      } else {
        const res = await fetch(`/api/users/${selectedId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(commonPayload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Ошибка обновления водителя');
        }
        alert(`✅ Данные водителя ${formData.name} сохранены в справочнике!`);
        onSaved(selectedId);
      }
    } catch (err: unknown) {
      alert(`Ошибка: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-5 max-w-2xl w-full shadow-2xl border border-slate-200 space-y-4 my-8">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              Справочник водителей (паспорт, права, контакты)
            </h3>
            <p className="text-xs text-slate-400">
              Данные сохраняются в системе и подставляются в заявки, ТН, путевые листы и
              доверенности
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-base cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl text-xs">
          <label className="font-bold text-slate-700 shrink-0">Водитель:</label>
          <select
            value={selectedId}
            onChange={(e) => handleSelectDriver(e.target.value)}
            className="flex-1 p-1 bg-white border border-slate-300 rounded font-bold text-slate-900"
          >
            <option value="new">➕ Добавить нового водителя</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} {d.phone ? `(${d.phone})` : ''}
              </option>
            ))}
          </select>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div>
              <label className="font-bold text-slate-700 block mb-0.5">ФИО водителя *</label>
              <input
                type="text"
                required
                placeholder="напр. Насртдинов В.А."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-1.5 border border-slate-300 rounded bg-white font-bold"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-0.5">Телефон</label>
              <input
                type="text"
                placeholder="+7 900 000-00-00"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-1.5 border border-slate-300 rounded bg-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="font-bold text-slate-700 block mb-0.5">ИНН (12 знаков)</label>
                <input
                  type="text"
                  maxLength={12}
                  placeholder="6607..."
                  value={formData.inn}
                  onChange={(e) => setFormData({ ...formData, inn: e.target.value })}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-0.5">Табельный №</label>
                <input
                  type="text"
                  placeholder="096"
                  value={formData.tab_number}
                  onChange={(e) => setFormData({ ...formData, tab_number: e.target.value })}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white"
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
            <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wide">
              🪪 Паспорт гражданина РФ (для доверенностей и пропусков)
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              <div>
                <label className="font-semibold text-slate-600 block mb-0.5">Серия</label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="6521"
                  value={formData.passport_series}
                  onChange={(e) => setFormData({ ...formData, passport_series: e.target.value })}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-0.5">Номер</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="342609"
                  value={formData.passport_number}
                  onChange={(e) => setFormData({ ...formData, passport_number: e.target.value })}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-0.5">Дата выдачи</label>
                <input
                  type="date"
                  value={formData.passport_issue_date}
                  onChange={(e) =>
                    setFormData({ ...formData, passport_issue_date: e.target.value })
                  }
                  className="w-full p-1.5 border border-slate-300 rounded bg-white"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-0.5">Код подр.</label>
                <input
                  type="text"
                  placeholder="660-001"
                  value={formData.passport_department_code}
                  onChange={(e) =>
                    setFormData({ ...formData, passport_department_code: e.target.value })
                  }
                  className="w-full p-1.5 border border-slate-300 rounded bg-white font-mono"
                />
              </div>
            </div>
            <div>
              <label className="font-semibold text-slate-600 block mb-0.5">Кем выдан</label>
              <input
                type="text"
                placeholder="ГУ МВД России по Свердловской области..."
                value={formData.passport_issued_by}
                onChange={(e) => setFormData({ ...formData, passport_issued_by: e.target.value })}
                className="w-full p-1.5 border border-slate-300 rounded bg-white"
              />
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
            <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wide">
              🚚 Водительское удостоверение (для Путевых листов и ЭТрН)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="font-semibold text-slate-600 block mb-0.5">Серия ВУ</label>
                <input
                  type="text"
                  placeholder="99 31"
                  value={formData.license_series}
                  onChange={(e) => setFormData({ ...formData, license_series: e.target.value })}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-0.5">Номер ВУ</label>
                <input
                  type="text"
                  placeholder="051064"
                  value={formData.license_number}
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-0.5">Категории</label>
                <input
                  type="text"
                  placeholder="C, CE"
                  value={formData.license_class}
                  onChange={(e) => setFormData({ ...formData, license_class: e.target.value })}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-0.5">Дата выдачи ВУ</label>
                <input
                  type="date"
                  value={formData.license_issue_date}
                  onChange={(e) => setFormData({ ...formData, license_issue_date: e.target.value })}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs cursor-pointer transition active:scale-95"
            >
              {isSaving ? 'Сохранение...' : 'Сохранить в справочник'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
