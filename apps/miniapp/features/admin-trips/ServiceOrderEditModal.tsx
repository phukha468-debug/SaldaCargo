'use client';

import { useState } from 'react';
import type { MiniappServiceOrder } from './types';

export function ServiceOrderEditModal({
  order,
  onClose,
  onSaved,
}: {
  order: MiniappServiceOrder;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isOwn = order.machine_type === 'own';
  const hourlyRate = Number(order.hourly_rate || (isOwn ? 1600 : 2000));
  const salaryPct = Number(order.salary_pct || 50);

  const [odometer, setOdometer] = useState<string>(
    String(order.odometer_end || order.odometer_start || ''),
  );
  const [clientModel, setClientModel] = useState<string>(
    order.client_vehicle_model || order.client_vehicle_brand || '',
  );
  const [clientReg, setClientReg] = useState<string>(order.client_vehicle_reg || '');
  const [works, setWorks] = useState<Array<{ name: string; minutes: string; notes?: string }>>(
    () => {
      const active = (order.works ?? []).filter((w) => w.status !== 'cancelled');
      if (active.length === 0) return [{ name: order.problem_description || '', minutes: '60' }];
      return active.map((w) => ({
        name: w.custom_work_name || w.work_catalog?.name || w.work_description || '',
        minutes: String(w.actual_minutes || w.norm_minutes || 30),
        notes: w.notes || undefined,
      }));
    },
  );
  const [parts, setParts] = useState<Array<{ name: string; quantity: string; unit: string }>>(() =>
    (order.parts ?? []).map((p) => ({
      name: p.custom_part_name || p.part?.name || '',
      quantity: String(p.quantity || 1),
      unit: p.unit || p.part?.unit || 'шт',
    })),
  );
  const [manualPay, setManualPay] = useState<string>(order.mechanic_pay || '');
  const [adminNote, setAdminNote] = useState<string>(order.admin_note || '');
  const [saving, setSaving] = useState(false);

  const totalMinutes = works.reduce((s, w) => s + (parseInt(w.minutes, 10) || 0), 0);
  const autoPay = works
    .reduce((s, w) => {
      const mins = parseInt(w.minutes, 10) || 0;
      const customPctMatch = w.notes
        ? String(w.notes).match(/\[salary_pct:(\d+(?:\.\d+)?)\]/)
        : null;
      const wPct = customPctMatch && customPctMatch[1] ? parseFloat(customPctMatch[1]) : salaryPct;
      return s + (mins / 60) * hourlyRate * (wPct / 100);
    }, 0)
    .toFixed(2);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/service-orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit_order',
          odometer_start: odometer ? Number(odometer) : null,
          odometer_end: odometer ? Number(odometer) : null,
          client_vehicle_model: !isOwn ? clientModel : undefined,
          client_vehicle_reg: !isOwn ? clientReg : undefined,
          works: works.map((w) => ({
            name: w.name,
            minutes: parseInt(w.minutes, 10) || 0,
            notes: w.notes,
          })),
          parts: parts.map((p) => ({
            name: p.name,
            quantity: parseFloat(p.quantity) || 1,
            unit: p.unit || 'шт',
          })),
          mechanic_pay: manualPay ? parseFloat(manualPay) : parseFloat(autoPay),
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
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-end justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92dvh] flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center justify-between border-b border-zinc-100 px-5 pt-4 pb-3">
          <div>
            <h3 className="font-black text-zinc-900 text-base">
              Редактировать наряд №{order.order_number}
            </h3>
            <p className="text-xs text-zinc-400 font-bold">
              {isOwn ? '🏢 Свой автопарк (1 600 ₽/ч)' : '🚗 Клиентский авто (2 000 ₽/ч)'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-500 font-bold flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {!isOwn && (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-400 block mb-1">
                  Модель авто
                </label>
                <input
                  type="text"
                  value={clientModel}
                  onChange={(e) => setClientModel(e.target.value)}
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-400 block mb-1">
                  Госномер
                </label>
                <input
                  type="text"
                  value={clientReg}
                  onChange={(e) => setClientReg(e.target.value.toUpperCase())}
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold uppercase"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-black uppercase text-zinc-400 block mb-1">
              Пробег (одометр, км)
            </label>
            <input
              type="number"
              value={odometer}
              onChange={(e) => setOdometer(e.target.value)}
              placeholder="Пробег в км"
              className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-zinc-400">
                Перечень работ ({works.length})
              </span>
              <button
                type="button"
                onClick={() => setWorks((prev) => [...prev, { name: '', minutes: '30' }])}
                className="text-xs font-black text-emerald-600"
              >
                + Добавить работу
              </button>
            </div>
            {works.map((w, idx) => (
              <div
                key={idx}
                className="bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={w.name}
                    onChange={(e) =>
                      setWorks((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, name: e.target.value } : item,
                        ),
                      )
                    }
                    placeholder="Наименование работы"
                    className="flex-1 bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                  />
                  {works.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setWorks((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-rose-500 text-xs font-black px-1.5"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-500 font-bold">Время (мин):</span>
                  <input
                    type="number"
                    value={w.minutes}
                    onChange={(e) =>
                      setWorks((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, minutes: e.target.value } : item,
                        ),
                      )
                    }
                    className="w-24 bg-white border border-zinc-200 rounded-lg px-2.5 py-1 text-xs font-black"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-zinc-400">
                Запчасти автосервиса ({parts.length})
              </span>
              <button
                type="button"
                onClick={() =>
                  setParts((prev) => [...prev, { name: '', quantity: '1', unit: 'шт' }])
                }
                className="text-xs font-black text-emerald-600"
              >
                + Добавить запчасть
              </button>
            </div>
            {parts.map((p, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) =>
                    setParts((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item)),
                    )
                  }
                  placeholder="Название запчасти"
                  className="flex-1 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                />
                <input
                  type="number"
                  value={p.quantity}
                  onChange={(e) =>
                    setParts((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, quantity: e.target.value } : item,
                      ),
                    )
                  }
                  className="w-16 border border-zinc-200 rounded-lg px-2 py-1.5 text-xs font-bold text-center"
                />
                <button
                  type="button"
                  onClick={() => setParts((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-rose-500 text-xs font-black px-1.5"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-emerald-900">
                ЗП Механика (авторасчёт: {autoPay} ₽)
              </span>
              <button
                type="button"
                onClick={() => setManualPay(autoPay)}
                className="text-[10px] font-black text-emerald-700 underline"
              >
                По времени ({totalMinutes} мин)
              </button>
            </div>
            <input
              type="number"
              step="0.01"
              value={manualPay}
              onChange={(e) => setManualPay(e.target.value)}
              placeholder={autoPay}
              className="w-full bg-white border border-emerald-300 rounded-lg px-3 py-2 text-sm font-black text-emerald-900"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-zinc-400 block mb-1">
              Комментарий руководителя
            </label>
            <input
              type="text"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Заметка к наряду..."
              className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-xs font-medium"
            />
          </div>
        </div>

        <div className="shrink-0 flex gap-2 border-t border-zinc-100 bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-zinc-200 font-bold text-xs text-zinc-600"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-wider disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
