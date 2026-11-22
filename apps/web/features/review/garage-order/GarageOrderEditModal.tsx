'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ReviewServiceOrder } from '../types';
import {
  GarageOrderWorksPartsEditor,
  type EditableGaragePart,
  type EditableGarageWork,
} from './GarageOrderWorksPartsEditor';

export function GarageOrderEditModal({
  order,
  onClose,
  onSaved,
}: {
  order: ReviewServiceOrder;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isOwn = order.machine_type === 'own';
  const hourlyRate = isOwn ? 1600 : 2000;

  const { data: mechanicsList = [] } = useQuery<
    Array<{ id: string; name: string; roles?: string[]; mechanic_salary_pct?: number | string }>
  >({
    queryKey: ['mechanics-staff-list'],
    queryFn: async () => {
      const res = await fetch('/api/users?role=mechanic');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const defaultPrimaryId = order.assigned_mechanic_id || order.mechanic?.id || '';
  const defaultSecondId = order.second_mechanic_id || order.second_mechanic?.id || '';

  const [assignedMechanicId, setAssignedMechanicId] = useState<string>(defaultPrimaryId);
  const [secondMechanicId, setSecondMechanicId] = useState<string>(defaultSecondId);

  const defaultStartDate = order.started_at
    ? order.started_at.slice(0, 10)
    : order.created_at
      ? order.created_at.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  const defaultEndDate = order.completed_at ? order.completed_at.slice(0, 10) : defaultStartDate;

  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(defaultEndDate);

  const [odometer, setOdometer] = useState<string>(
    String(order.odometer_end || order.odometer_start || ''),
  );
  const [clientModel, setClientModel] = useState<string>(
    order.client_vehicle_model || order.client_vehicle_brand || '',
  );
  const [clientReg, setClientReg] = useState<string>(order.client_vehicle_reg || '');

  const [works, setWorks] = useState<EditableGarageWork[]>(() => {
    const active = (order.works ?? []).filter((w) => w.status !== 'cancelled');
    if (active.length === 0) {
      return [
        {
          name: order.problem_description || '',
          minutes: '60',
          performer: defaultSecondId ? 'both' : 'primary',
          mechanic_id: defaultPrimaryId || null,
          second_mechanic_id: defaultSecondId || null,
        },
      ];
    }
    return active.map((w) => {
      let performer: 'both' | 'primary' | 'second' = 'primary';
      if (w.second_mechanic_id) {
        performer = 'both';
      } else if (defaultSecondId && w.mechanic_id === defaultSecondId) {
        performer = 'second';
      }
      return {
        name: w.custom_work_name || w.work_catalog?.name || w.work_description || '',
        minutes: String(w.actual_minutes || w.norm_minutes || 30),
        notes: w.notes || undefined,
        performer,
        mechanic_id: w.mechanic_id || defaultPrimaryId || null,
        second_mechanic_id: w.second_mechanic_id || null,
      };
    });
  });

  const [parts, setParts] = useState<EditableGaragePart[]>(() =>
    (order.parts ?? []).map((p) => {
      const uPrice = parseFloat(p.unit_price || '0') || 0;
      const cPrice =
        p.client_price !== undefined &&
        p.client_price !== null &&
        String(p.client_price).trim() !== ''
          ? parseFloat(String(p.client_price)) || 0
          : uPrice;
      return {
        name: p.custom_part_name || p.part?.name || '',
        quantity: String(p.quantity || 1),
        unit: p.unit || p.part?.unit || 'шт',
        unit_price: uPrice > 0 ? String(uPrice) : '',
        client_price: cPrice > 0 ? String(cPrice) : '',
      };
    }),
  );

  const [manualPay, setManualPay] = useState<string>(order.mechanic_pay || '');
  const [manualSecondPay, setManualSecondPay] = useState<string>(order.second_mechanic_pay || '');
  const [adminNote, setAdminNote] = useState<string>(order.admin_note || '');
  const [saving, setSaving] = useState(false);

  const primaryMech = mechanicsList.find((m) => m.id === assignedMechanicId) || order.mechanic;
  const secondMech = mechanicsList.find((m) => m.id === secondMechanicId) || order.second_mechanic;

  const primaryMechName = primaryMech?.name ?? 'Основной механик';
  const secondMechName = secondMech?.name ?? 'Второй механик';

  const pct1 = Number(primaryMech?.mechanic_salary_pct || 50);
  const pct2 = Number(secondMech?.mechanic_salary_pct || 50);

  const calcWorkPayShares = (w: EditableGarageWork) => {
    const mins = parseInt(w.minutes, 10) || 0;
    const clientPrice = (mins / 60) * hourlyRate;
    const customPctMatch = w.notes ? String(w.notes).match(/\[salary_pct:(\d+(?:\.\d+)?)\]/) : null;
    const workPct1 = customPctMatch && customPctMatch[1] ? parseFloat(customPctMatch[1]) : pct1;
    const workPct2 = customPctMatch && customPctMatch[1] ? parseFloat(customPctMatch[1]) : pct2;

    if (!secondMechanicId) {
      return { price: clientPrice, pay1: (clientPrice * workPct1) / 100, pay2: 0 };
    }
    if (w.performer === 'both') {
      const half = clientPrice / 2;
      return {
        price: clientPrice,
        pay1: (half * workPct1) / 100,
        pay2: (half * workPct2) / 100,
      };
    }
    if (w.performer === 'second') {
      return { price: clientPrice, pay1: 0, pay2: (clientPrice * workPct2) / 100 };
    }
    return { price: clientPrice, pay1: (clientPrice * workPct1) / 100, pay2: 0 };
  };

  const autoPay1 = works.reduce((s, w) => s + calcWorkPayShares(w).pay1, 0);
  const autoPay2 = works.reduce((s, w) => s + calcWorkPayShares(w).pay2, 0);

  const totalPartsCost = parts.reduce((s, p) => {
    const qty = parseFloat(p.quantity) || 1;
    const cost = parseFloat(p.unit_price) || 0;
    return s + cost * qty;
  }, 0);

  const totalPartsClient = parts.reduce((s, p) => {
    const qty = parseFloat(p.quantity) || 1;
    const price = parseFloat(p.client_price) || parseFloat(p.unit_price) || 0;
    return s + price * qty;
  }, 0);

  const totalPartsMargin = Math.max(0, totalPartsClient - totalPartsCost);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/garage/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit_order',
          assigned_mechanic_id: assignedMechanicId || null,
          second_mechanic_id: secondMechanicId || null,
          started_at: startDate,
          completed_at: endDate,
          odometer_start: odometer ? Number(odometer) : null,
          odometer_end: odometer ? Number(odometer) : null,
          client_vehicle_model: !isOwn ? clientModel : undefined,
          client_vehicle_reg: !isOwn ? clientReg : undefined,
          works: works.map((w) => ({
            name: w.name,
            minutes: parseInt(w.minutes, 10) || 0,
            notes: w.notes,
            mechanic_id: w.performer === 'second' ? secondMechanicId : assignedMechanicId || null,
            second_mechanic_id: w.performer === 'both' ? secondMechanicId || null : null,
          })),
          parts: parts.map((p) => {
            const uPrice = parseFloat(p.unit_price) || 0;
            const cPrice =
              p.client_price !== '' && !isNaN(parseFloat(p.client_price))
                ? parseFloat(p.client_price)
                : uPrice;
            return {
              name: p.name,
              quantity: parseFloat(p.quantity) || 1,
              unit: p.unit || 'шт',
              unit_price: uPrice,
              client_price: cPrice,
            };
          }),
          mechanic_pay: manualPay ? parseFloat(manualPay) : autoPay1,
          second_mechanic_pay: secondMechanicId
            ? manualSecondPay
              ? parseFloat(manualSecondPay)
              : autoPay2
            : null,
          admin_note: adminNote,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка сохранения');
      onSaved();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-black text-slate-900 text-lg">
              Редактировать заказ-наряд №{order.order_number}
            </h3>
            <p className="text-xs text-slate-500 font-bold">
              {isOwn ? '🏢 Свой автопарк (1 600 ₽/ч)' : '🚗 Клиентский авто (2 000 ₽/ч)'} ·{' '}
              {primaryMechName}
              {secondMechanicId ? ` + ${secondMechName}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div>
            <label className="text-xs font-bold uppercase text-slate-500 block mb-1">
              👨‍🔧 Основной механик
            </label>
            <select
              value={assignedMechanicId}
              onChange={(e) => setAssignedMechanicId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-800"
            >
              <option value="">— Не назначен —</option>
              {mechanicsList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.mechanic_salary_pct || 50}%)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-slate-500 block mb-1">
              👥 Второй механик (напарник)
            </label>
            <select
              value={secondMechanicId}
              onChange={(e) => setSecondMechanicId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-800"
            >
              <option value="">— Нет (один механик) —</option>
              {mechanicsList
                .filter((m) => m.id !== assignedMechanicId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.mechanic_salary_pct || 50}%)
                  </option>
                ))}
            </select>
          </div>
        </div>

        {!isOwn && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase text-slate-400 block mb-1">
                Модель авто
              </label>
              <input
                type="text"
                value={clientModel}
                onChange={(e) => setClientModel(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-slate-400 block mb-1">
                Госномер
              </label>
              <input
                type="text"
                value={clientReg}
                onChange={(e) => setClientReg(e.target.value.toUpperCase())}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold uppercase"
              />
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-bold uppercase text-slate-400 block mb-1">
            Пробег (одометр, км)
          </label>
          <input
            type="number"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
            placeholder="Пробег в км"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div>
            <label className="text-xs font-bold uppercase text-slate-500 block mb-1">
              Дата начала
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (endDate < e.target.value) setEndDate(e.target.value);
              }}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-800"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-slate-500 block mb-1">
              Дата окончания
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-800"
            />
          </div>
        </div>

        <GarageOrderWorksPartsEditor
          works={works}
          setWorks={setWorks}
          parts={parts}
          setParts={setParts}
          assignedMechanicId={assignedMechanicId}
          secondMechanicId={secondMechanicId}
          primaryMechName={primaryMechName}
          secondMechName={secondMechName}
          calcWorkPayShares={calcWorkPayShares}
          totalPartsCost={totalPartsCost}
          totalPartsClient={totalPartsClient}
          totalPartsMargin={totalPartsMargin}
        />

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-emerald-900">
              ЗП: {primaryMechName} (авторасчёт: {Math.round(autoPay1)} ₽)
            </span>
            <button
              type="button"
              onClick={() => setManualPay(String(Math.round(autoPay1)))}
              className="text-xs font-black text-emerald-700 underline cursor-pointer"
            >
              Сбросить
            </button>
          </div>
          <input
            type="number"
            step="0.01"
            value={manualPay}
            onChange={(e) => setManualPay(e.target.value)}
            placeholder={String(Math.round(autoPay1))}
            className="w-full bg-white border border-emerald-300 rounded-lg px-3 py-2 text-sm font-black text-emerald-900"
          />

          {secondMechanicId && (
            <div className="pt-2 border-t border-emerald-200/70 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-sky-900">
                  ЗП: {secondMechName} (авторасчёт: {Math.round(autoPay2)} ₽)
                </span>
                <button
                  type="button"
                  onClick={() => setManualSecondPay(String(Math.round(autoPay2)))}
                  className="text-xs font-black text-sky-700 underline cursor-pointer"
                >
                  Сбросить
                </button>
              </div>
              <input
                type="number"
                step="0.01"
                value={manualSecondPay}
                onChange={(e) => setManualSecondPay(e.target.value)}
                placeholder={String(Math.round(autoPay2))}
                className="w-full bg-white border border-sky-300 rounded-lg px-3 py-2 text-sm font-black text-sky-900"
              />
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-bold uppercase text-slate-400 block mb-1">
            Комментарий руководителя
          </label>
          <input
            type="text"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder="Заметка к заказ-наряду..."
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium"
          />
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 font-bold text-sm text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-wider disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
