'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MiniappServiceOrder, MiniappServiceOrderWork } from './types';

interface MechanicOption {
  id: string;
  name: string;
  mechanic_salary_pct?: number | string | null;
}

interface PerformerItem {
  id: string;
  name: string;
  pct: number;
}

interface EditableWorkItem {
  key: string;
  isOriginal: boolean;
  name: string;
  minutesStr: string;
  amountStr: string;
  performers: PerformerItem[];
}

function formatHours(mins: number): string {
  const h = mins / 60;
  return `${Number.isInteger(h) ? h.toString() : h.toFixed(1)} ч`;
}

let workItemSeq = 0;
function nextWorkKey(): string {
  workItemSeq += 1;
  return `work-item-${workItemSeq}`;
}

export function ServiceWorkEditModal({
  order,
  work,
  onClose,
  onSaved,
}: {
  order: MiniappServiceOrder;
  work: MiniappServiceOrderWork;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isOwn = order.machine_type === 'own';
  const hourlyRate = Number(order.hourly_rate || (isOwn ? 1600 : 2000));
  const defaultSalaryPct = Number(order.salary_pct || 50);

  const [mechanicsCatalog, setMechanicsCatalog] = useState<MechanicOption[]>([]);
  const [addMechOpenKey, setAddMechOpenKey] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState<string>(order.admin_note || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [items, setItems] = useState<EditableWorkItem[]>(() => {
    const initialMinutes = Math.max(
      0,
      Math.round(
        Number(work.actual_minutes || work.norm_minutes || 0) *
          Math.max(1, Number(work.quantity || 1)),
      ),
    );
    const initialExplicitPrice = parseFloat(String(work.price_client || '0'));
    const initialAmount =
      initialExplicitPrice > 0
        ? Math.round(initialExplicitPrice)
        : Math.round((initialMinutes / 60) * hourlyRate);

    const list: PerformerItem[] = [];
    const primaryId = work.mechanic_id ?? order.assigned_mechanic_id ?? order.mechanic?.id ?? null;
    const primaryName =
      work.mechanic_name ||
      (primaryId && primaryId === order.mechanic?.id ? order.mechanic?.name : null) ||
      (primaryId && primaryId === order.second_mechanic?.id ? order.second_mechanic?.name : null) ||
      order.mechanic?.name ||
      'Механик';
    const primaryPct =
      primaryId && primaryId === order.second_mechanic?.id
        ? Number(order.second_mechanic?.mechanic_salary_pct || defaultSalaryPct)
        : Number(order.mechanic?.mechanic_salary_pct || defaultSalaryPct);

    if (primaryId) {
      list.push({ id: primaryId, name: primaryName, pct: primaryPct });
    }

    const secondId =
      work.second_mechanic_id ??
      (!work.mechanic_id ? (order.second_mechanic_id ?? order.second_mechanic?.id ?? null) : null);
    if (secondId && secondId !== primaryId) {
      const secondName =
        work.second_mechanic_name ||
        (secondId === order.second_mechanic?.id ? order.second_mechanic?.name : null) ||
        (secondId === order.mechanic?.id ? order.mechanic?.name : null) ||
        'Напарник';
      const secondPct = Number(order.second_mechanic?.mechanic_salary_pct || defaultSalaryPct);
      list.push({ id: secondId, name: secondName, pct: secondPct });
    }

    return [
      {
        key: nextWorkKey(),
        isOriginal: true,
        name: work.custom_work_name || work.work_catalog?.name || work.work_description || '',
        minutesStr: initialMinutes > 0 ? String(initialMinutes) : '',
        amountStr: initialAmount > 0 ? String(initialAmount) : '',
        performers: list,
      },
    ];
  });

  useEffect(() => {
    let active = true;
    fetch('/api/admin/mechanics')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: MechanicOption[]) => {
        if (!active || !Array.isArray(rows)) return;
        setMechanicsCatalog(rows);
        setItems((prev) =>
          prev.map((item) => ({
            ...item,
            performers: item.performers.map((p) => {
              const match = rows.find((m) => m.id === p.id);
              if (!match) return p;
              return {
                id: p.id,
                name: match.name || p.name,
                pct: Number(match.mechanic_salary_pct || p.pct || 50),
              };
            }),
          })),
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const updateItem = (key: string, updater: (item: EditableWorkItem) => EditableWorkItem) => {
    setItems((prev) => prev.map((it) => (it.key === key ? updater(it) : it)));
  };

  const handleAmountChange = (key: string, raw: string) => {
    const num = parseFloat(raw.replace(/\s/g, '').replace(',', '.'));
    const nextMinutes = isNaN(num) || num < 0 ? '' : String(Math.round((num / hourlyRate) * 60));
    updateItem(key, (it) => ({ ...it, amountStr: raw, minutesStr: nextMinutes }));
  };

  const handleMinutesChange = (key: string, raw: string) => {
    const mins = parseInt(raw, 10);
    const nextAmount = isNaN(mins) || mins < 0 ? '' : String(Math.round((mins / 60) * hourlyRate));
    updateItem(key, (it) => ({ ...it, minutesStr: raw, amountStr: nextAmount }));
  };

  const handleAddWork = () => {
    const basePerformers = items[0]?.performers ?? [];
    setItems((prev) => [
      ...prev,
      {
        key: nextWorkKey(),
        isOriginal: false,
        name: '',
        minutesStr: '',
        amountStr: '',
        performers: basePerformers.map((p) => ({ ...p })),
      },
    ]);
  };

  const handleRemoveWork = (key: string) => {
    setItems((prev) => prev.filter((it) => it.key !== key));
    if (addMechOpenKey === key) setAddMechOpenKey(null);
  };

  const totals = useMemo(() => {
    let totalAmount = 0;
    let totalMinutes = 0;
    let totalPay = 0;
    for (const it of items) {
      const amt = Math.max(0, parseFloat(it.amountStr.replace(',', '.')) || 0);
      const mins = Math.max(0, parseInt(it.minutesStr, 10) || 0);
      totalAmount += amt;
      totalMinutes += mins;
      if (it.performers.length > 0) {
        const share = amt / it.performers.length;
        for (const p of it.performers) {
          totalPay += Math.round((share * p.pct) / 100);
        }
      }
    }
    return { totalAmount, totalMinutes, totalPay };
  }, [items]);

  const vehicleTitle = isOwn
    ? `${order.asset?.short_name ?? 'Свой ТС'}${order.asset?.reg_number ? ` · ${order.asset.reg_number}` : ''}`
    : `${order.client_vehicle_model || order.client_vehicle_brand || 'Клиентский авто'}${order.client_vehicle_reg ? ` · ${order.client_vehicle_reg}` : ''}`;

  async function handleSave() {
    if (!work.id) {
      setError('Не найден идентификатор работы');
      return;
    }
    const primary = items[0];
    if (!primary || !primary.name.trim()) {
      setError('Введите наименование первой работы');
      return;
    }
    for (let i = 1; i < items.length; i += 1) {
      if (!items[i]?.name.trim()) {
        setError(`Введите наименование работы №${i + 1} или удалите её`);
        return;
      }
    }

    setSaving(true);
    setError('');
    try {
      const primaryMins = Math.max(1, parseInt(primary.minutesStr, 10) || 1);
      const primaryAmt = Math.max(0, parseFloat(primary.amountStr.replace(',', '.')) || 0);

      const extraWorks = items.slice(1).map((it) => ({
        name: it.name.trim(),
        minutes: Math.max(1, parseInt(it.minutesStr, 10) || 1),
        price_client: Math.max(0, parseFloat(it.amountStr.replace(',', '.')) || 0),
        mechanic_id: it.performers[0]?.id ?? null,
        second_mechanic_id: it.performers[1]?.id ?? null,
      }));

      const res = await fetch(`/api/admin/service-orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit_work',
          work_id: work.id,
          name: primary.name.trim(),
          minutes: primaryMins,
          price_client: primaryAmt,
          mechanic_id: primary.performers[0]?.id ?? null,
          second_mechanic_id: primary.performers[1]?.id ?? null,
          extra_works: extraWorks,
          admin_note: adminNote,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Ошибка сохранения работы');
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#f8f9fb] w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl">
        {/* Шапка */}
        <div className="shrink-0 bg-white px-4 py-3.5 border-b border-slate-200/80 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-slate-900 text-base shrink-0">
                Наряд №{order.order_number}
              </h3>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-xl border shrink-0 ${
                  isOwn
                    ? 'bg-sky-50 border-sky-200 text-sky-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                {isOwn
                  ? `🏢 Свой · ${hourlyRate.toLocaleString('ru-RU')} ₽/ч`
                  : `🚗 Клиент · ${hourlyRate.toLocaleString('ru-RU')} ₽/ч`}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-semibold truncate mt-0.5">
              🔧 {vehicleTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Основной контент */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5">
          {items.map((item, idx) => {
            const itemMinutes = Math.max(0, parseInt(item.minutesStr, 10) || 0);
            const itemAmount = Math.max(0, parseFloat(item.amountStr.replace(',', '.')) || 0);
            const shareBase = item.performers.length > 0 ? itemAmount / item.performers.length : 0;
            const availableMechanics = mechanicsCatalog.filter(
              (m) => !item.performers.some((p) => p.id === m.id),
            );
            const isMechDropdownOpen = addMechOpenKey === item.key;

            return (
              <div
                key={item.key}
                className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-3.5"
              >
                {/* Заголовок карточки работы */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                    {items.length > 1 ? `Работа ${idx + 1}` : 'Наименование работы'}
                  </span>
                  <div className="flex items-center gap-2">
                    {idx === 0 && (
                      <button
                        type="button"
                        onClick={handleAddWork}
                        className="text-xs font-extrabold text-orange-600"
                      >
                        + Добавить работу
                      </button>
                    )}
                    {!item.isOriginal && (
                      <button
                        type="button"
                        onClick={() => handleRemoveWork(item.key)}
                        className="text-xs font-bold text-rose-500 px-1.5 py-0.5 rounded-lg bg-rose-50 border border-rose-200"
                      >
                        ✕ Удалить
                      </button>
                    )}
                  </div>
                </div>

                {/* Название работы */}
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItem(item.key, (it) => ({ ...it, name: e.target.value }))}
                  placeholder="Например: Установка лобового стекла"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />

                {/* Сумма работы */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Сумма работы, ₽
                    </label>
                    <span className="text-[11px] font-semibold text-slate-400">
                      Автоподстройка · {hourlyRate.toLocaleString('ru-RU')} ₽/ч
                    </span>
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={item.amountStr}
                    onChange={(e) => handleAmountChange(item.key, e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-2xl font-black text-slate-900 tabular-nums focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  />
                </div>

                {/* Время работы (только ручной ввод) */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Время работы, мин
                    </label>
                    <span className="text-xs font-extrabold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-lg">
                      {formatHours(itemMinutes)}
                    </span>
                  </div>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={item.minutesStr}
                    onChange={(e) => handleMinutesChange(item.key, e.target.value)}
                    placeholder="Введите минуты"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-2xl font-black text-slate-900 tabular-nums focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  />
                </div>

                {/* Кто работал */}
                <div className="pt-2 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Кто работал ({item.performers.length})
                    </span>
                    {item.performers.length < 2 && (
                      <button
                        type="button"
                        onClick={() => setAddMechOpenKey(isMechDropdownOpen ? null : item.key)}
                        className="text-xs font-extrabold text-orange-600"
                      >
                        + Добавить механика
                      </button>
                    )}
                  </div>

                  {item.performers.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-rose-300 bg-rose-50/50 px-3 py-2 text-xs text-rose-600 font-semibold">
                      Нет исполнителей — добавьте механика
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {item.performers.map((m) => {
                        const pay = Math.round((shareBase * m.pct) / 100);
                        return (
                          <div
                            key={m.id}
                            className="flex items-center justify-between gap-2 bg-sky-50/70 border border-sky-200/90 rounded-xl px-3 py-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm shrink-0">👨‍🔧</span>
                              <span className="text-sm font-bold text-slate-900 truncate">
                                {m.name}
                              </span>
                              <span className="text-[11px] font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md shrink-0">
                                {m.pct}%
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-black text-emerald-700 tabular-nums">
                                {pay.toLocaleString('ru-RU')} ₽
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateItem(item.key, (it) => ({
                                    ...it,
                                    performers: it.performers.filter((p) => p.id !== m.id),
                                  }))
                                }
                                className="w-6 h-6 rounded-full active:bg-rose-100 text-rose-500 font-black text-xs flex items-center justify-center"
                                title="Удалить исполнителя"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {isMechDropdownOpen && item.performers.length < 2 && (
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 space-y-1 max-h-40 overflow-y-auto">
                      {availableMechanics.length === 0 ? (
                        <p className="text-xs text-slate-400 px-2 py-1">Нет доступных механиков</p>
                      ) : (
                        availableMechanics.map((m) => {
                          const mPct = Number(m.mechanic_salary_pct || 50);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                updateItem(item.key, (it) => ({
                                  ...it,
                                  performers: [
                                    ...it.performers,
                                    { id: m.id, name: m.name, pct: mPct },
                                  ],
                                }));
                                setAddMechOpenKey(null);
                              }}
                              className="w-full text-left px-3 py-2 rounded-lg active:bg-white text-xs font-bold text-slate-800 flex items-center justify-between"
                            >
                              <span className="truncate">👨‍🔧 {m.name}</span>
                              <span className="text-emerald-600 font-bold shrink-0 ml-2">
                                + Добавить ({mPct}%)
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Кнопка быстрого добавления ещё одной работы снизу */}
          <button
            type="button"
            onClick={handleAddWork}
            className="w-full py-2.5 rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50/50 active:bg-orange-100/70 text-orange-700 text-xs font-black uppercase tracking-wide"
          >
            + Добавить работу (разделить на несколько)
          </button>

          {/* Заметка администратора */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Заметка администратора
            </label>
            <input
              type="text"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Комментарий к проверке (необязательно)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:bg-white focus:border-sky-400"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-bold text-rose-700">
              {error}
            </div>
          )}
        </div>

        {/* Нижний бар */}
        <div className="shrink-0 bg-white px-4 py-3.5 border-t border-slate-200/80 space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-600 flex-wrap">
            {items.length > 1 && (
              <span>
                Работ: <strong className="text-slate-900 font-black">{items.length}</strong>
              </span>
            )}
            <span>
              Сумма:{' '}
              <strong className="text-slate-900 font-black tabular-nums">
                {Math.round(totals.totalAmount).toLocaleString('ru-RU')} ₽
              </strong>
            </span>
            <span>
              Время:{' '}
              <strong className="text-slate-900 font-black tabular-nums">
                {totals.totalMinutes} мин ({formatHours(totals.totalMinutes)})
              </strong>
            </span>
            <span>
              ЗП:{' '}
              <strong className="text-emerald-600 font-black tabular-nums">
                {totals.totalPay.toLocaleString('ru-RU')} ₽
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-[2] py-2.5 rounded-xl bg-orange-600 active:bg-orange-700 text-white text-xs font-black uppercase tracking-wide shadow-sm disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : '✓ Сохранить изменения'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
