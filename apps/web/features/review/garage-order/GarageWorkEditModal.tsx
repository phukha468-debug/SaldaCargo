'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ReviewServiceOrder, ReviewServiceOrderWork } from '../types';

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

function formatHours(mins: number): string {
  const h = mins / 60;
  return `${Number.isInteger(h) ? h.toString() : h.toFixed(1)} ч`;
}

export function GarageWorkEditModal({
  order,
  work,
  onClose,
  onSaved,
}: {
  order: ReviewServiceOrder;
  work: ReviewServiceOrderWork;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isOwn = order.machine_type === 'own';
  const hourlyRate = Number(order.hourly_rate || (isOwn ? 1600 : 2000));

  const { data: mechanicsCatalog = [] } = useQuery<MechanicOption[]>({
    queryKey: ['mechanics-staff-list'],
    queryFn: async () => {
      const res = await fetch('/api/users?role=mechanic');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });

  const initialMinutes = Math.max(
    1,
    Math.round(
      Number(work.actual_minutes || work.norm_minutes || 60) *
        Math.max(1, Number(work.quantity || 1)),
    ),
  );
  const initialExplicitPrice = parseFloat(String(work.price_client || '0'));
  const initialAmount =
    initialExplicitPrice > 0
      ? Math.round(initialExplicitPrice)
      : Math.round((initialMinutes / 60) * hourlyRate);

  const [workName, setWorkName] = useState<string>(
    work.custom_work_name || work.work_catalog?.name || work.work_description || '',
  );
  const [minutesStr, setMinutesStr] = useState<string>(String(initialMinutes));
  const [amountStr, setAmountStr] = useState<string>(String(initialAmount));
  const [adminNote, setAdminNote] = useState<string>(order.admin_note || '');
  const [showAddMech, setShowAddMech] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [performers, setPerformers] = useState<PerformerItem[]>(() => {
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
        ? Number(order.second_mechanic?.mechanic_salary_pct || 50)
        : Number(order.mechanic?.mechanic_salary_pct || 50);

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
      const secondPct = Number(order.second_mechanic?.mechanic_salary_pct || 50);
      list.push({ id: secondId, name: secondName, pct: secondPct });
    }
    return list;
  });

  // Обогащаем имена и % из справочника механиков
  const resolvedPerformers = useMemo(() => {
    return performers.map((p) => {
      const match = mechanicsCatalog.find((m) => m.id === p.id);
      if (!match) return p;
      return {
        id: p.id,
        name: match.name || p.name,
        pct: Number(match.mechanic_salary_pct || p.pct || 50),
      };
    });
  }, [performers, mechanicsCatalog]);

  const availableMechanics = useMemo(
    () => mechanicsCatalog.filter((m) => !performers.some((p) => p.id === m.id)),
    [mechanicsCatalog, performers],
  );

  const minutesNum = Math.max(0, parseInt(minutesStr, 10) || 0);
  const amountNum = Math.max(0, parseFloat(amountStr.replace(',', '.')) || 0);

  const handleAmountChange = (raw: string) => {
    setAmountStr(raw);
    const num = parseFloat(raw.replace(/\s/g, '').replace(',', '.'));
    if (isNaN(num) || num < 0) {
      setMinutesStr('0');
    } else {
      setMinutesStr(String(Math.round((num / hourlyRate) * 60)));
    }
  };

  const handleMinutesChange = (raw: string) => {
    setMinutesStr(raw);
    const mins = parseInt(raw, 10);
    if (isNaN(mins) || mins < 0) {
      setAmountStr('0');
    } else {
      setAmountStr(String(Math.round((mins / 60) * hourlyRate)));
    }
  };

  const { totalPay, perMech } = useMemo(() => {
    if (resolvedPerformers.length === 0) {
      return { totalPay: 0, perMech: [] as Array<PerformerItem & { pay: number }> };
    }
    const shareBase = amountNum / resolvedPerformers.length;
    const list = resolvedPerformers.map((m) => ({
      ...m,
      pay: Math.round((shareBase * m.pct) / 100),
    }));
    return {
      totalPay: list.reduce((s, item) => s + item.pay, 0),
      perMech: list,
    };
  }, [resolvedPerformers, amountNum]);

  const vehicleTitle = isOwn
    ? `${order.asset?.short_name ?? 'Свой ТС'}${order.asset?.reg_number ? ` · ${order.asset.reg_number}` : ''}`
    : `${order.client_vehicle_model || order.client_vehicle_brand || 'Клиентский авто'}${order.client_vehicle_reg ? ` · ${order.client_vehicle_reg}` : ''}`;

  async function handleSave() {
    if (!workName.trim()) {
      setError('Введите наименование работы');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/garage/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit_work',
          work_id: work.id,
          name: workName.trim(),
          minutes: Math.max(1, minutesNum || 1),
          price_client: amountNum,
          mechanic_id: performers[0]?.id ?? null,
          second_mechanic_id: performers[1]?.id ?? null,
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-[#f8f9fb] w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Шапка (в стиле TripEditModal) */}
        <div className="shrink-0 bg-white px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            <h3 className="text-lg font-black text-slate-900 shrink-0">
              Наряд №{order.order_number}
            </h3>
            <span className="text-xs font-semibold text-slate-500 truncate">🔧 {vehicleTitle}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${
                isOwn
                  ? 'bg-sky-50 border-sky-200 text-sky-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              {isOwn
                ? `🏢 Свой · ${hourlyRate.toLocaleString('ru-RU')} ₽/ч`
                : `🚗 Клиент · ${hourlyRate.toLocaleString('ru-RU')} ₽/ч`}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Контент: 2 колонки как в TripEditModal */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Левая карточка: Наименование, Сумма, Время */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Наименование работы
              </label>
              <input
                type="text"
                value={workName}
                onChange={(e) => setWorkName(e.target.value)}
                placeholder="Например: Замена тормозных колодок"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </div>

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
                value={amountStr}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-2xl font-black text-slate-900 tabular-nums focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Время работы, мин
                </label>
                <span className="text-xs font-extrabold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-lg">
                  {formatHours(minutesNum)}
                </span>
              </div>
              <input
                type="number"
                value={minutesStr}
                onChange={(e) => handleMinutesChange(e.target.value)}
                placeholder="Введите минуты"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-2xl font-black text-slate-900 tabular-nums focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </div>
          </div>

          {/* Правая карточка: Кто работал + Заметка */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Кто работал ({resolvedPerformers.length})
                </span>
                {resolvedPerformers.length < 2 && (
                  <button
                    type="button"
                    onClick={() => setShowAddMech((v) => !v)}
                    className="text-xs font-extrabold text-orange-600 hover:text-orange-700 cursor-pointer"
                  >
                    + Добавить механика
                  </button>
                )}
              </div>

              {perMech.length === 0 ? (
                <div className="rounded-xl border border-dashed border-rose-300 bg-rose-50/50 px-3 py-2.5 text-xs text-rose-600 font-semibold">
                  Нет исполнителей — добавьте механика
                </div>
              ) : (
                <div className="space-y-2">
                  {perMech.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 bg-sky-50/70 border border-sky-200/90 rounded-xl px-3.5 py-2.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm shrink-0">👨‍🔧</span>
                        <span className="text-sm font-bold text-slate-900 truncate">{m.name}</span>
                        <span className="text-[11px] font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md shrink-0">
                          {m.pct}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-sm font-black text-emerald-700 tabular-nums">
                          {m.pay.toLocaleString('ru-RU')} ₽
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setPerformers((prev) => prev.filter((item) => item.id !== m.id))
                          }
                          className="w-6 h-6 rounded-full hover:bg-rose-100 text-rose-500 font-black text-xs flex items-center justify-center cursor-pointer"
                          title="Удалить исполнителя"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {resolvedPerformers.length > 1 && (
                <p className="text-[11px] text-slate-500 font-medium">
                  Сумма работы делится поровну между 2 механиками (50% / 50%)
                </p>
              )}

              {showAddMech && resolvedPerformers.length < 2 && (
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 space-y-1 max-h-44 overflow-y-auto">
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
                            setPerformers((prev) => [
                              ...prev,
                              { id: m.id, name: m.name, pct: mPct },
                            ]);
                            setShowAddMech(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 text-xs font-bold text-slate-800 flex items-center justify-between cursor-pointer"
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

            <div className="bg-white rounded-2xl border border-slate-200/90 p-4">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Заметка администратора
              </label>
              <input
                type="text"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Комментарий к проверке работы (необязательно)"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:bg-white focus:border-sky-400"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-5 mb-3 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-bold text-rose-700">
            {error}
          </div>
        )}

        {/* Нижний бар (в стиле TripEditModal) */}
        <div className="shrink-0 bg-white px-5 py-3.5 border-t border-slate-200/80 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
            <span>
              Сумма:{' '}
              <strong className="text-slate-900 font-black tabular-nums">
                {Math.round(amountNum).toLocaleString('ru-RU')} ₽
              </strong>
            </span>
            <span>
              Время:{' '}
              <strong className="text-slate-900 font-black tabular-nums">
                {minutesNum} мин ({formatHours(minutesNum)})
              </strong>
            </span>
            <span>
              ЗП:{' '}
              <strong className="text-emerald-600 font-black tabular-nums">
                {totalPay.toLocaleString('ru-RU')} ₽
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-extrabold text-slate-700 cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black uppercase tracking-wide shadow-sm cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : '✓ Сохранить изменения'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
