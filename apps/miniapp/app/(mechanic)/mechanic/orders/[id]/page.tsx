/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Money, cn } from '@saldacargo/ui';
import { formatDate, isOilOrFilterWork } from '@saldacargo/shared';

interface WorkItem {
  id: string;
  work_catalog?: { name: string; norm_minutes: number };
  custom_work_name?: string;
  status: string;
  norm_minutes: number;
  actual_minutes: number;
  price_client?: string;
}

interface OrderDetail {
  id: string;
  order_number: number;
  status: string;
  lifecycle_status: string;
  machine_type: 'own' | 'client';
  created_at: string;
  asset?: { id: string; short_name: string; reg_number: string };
  client_vehicle_brand?: string;
  client_vehicle_model?: string;
  client_vehicle_reg?: string;
  problem_description: string;
  mechanic_note?: string;
  admin_note?: string;
  odometer_start?: number | null;
  odometer_end?: number | null;
  hourly_rate?: number;
  salary_pct?: number;
  total_minutes?: number;
  estimated_pay?: string;
  approved_pay?: string;
  mechanic_pay?: string;
  parts_provided_by_service?: boolean;
  settlement_status?: string;
  works: WorkItem[];
  parts: Array<{
    id: string;
    custom_part_name?: string;
    unit?: string;
    part?: { name: string; unit: string };
    quantity: number;
  }>;
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [workNameInput, setWorkNameInput] = useState('');
  const [workMinutesInput, setWorkMinutesInput] = useState('');
  const [partsProvided, setPartsProvided] = useState<boolean | null>(null);
  const [partNameInput, setPartNameInput] = useState('');
  const [partQtyInput, setPartQtyInput] = useState('1');
  const [partUnitInput, setPartUnitInput] = useState('шт');
  const [odometerInput, setOdometerInput] = useState('');
  const [actionError, setActionError] = useState('');

  const { data: order, isLoading } = useQuery<OrderDetail>({
    queryKey: ['order-detail', id],
    queryFn: async () => {
      const res = await fetch(`/api/mechanic/orders/${id}`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
    refetchInterval: 15000,
  });

  const addWorkMutation = useMutation({
    mutationFn: async () => {
      setActionError('');
      const cleanName = workNameInput.trim();
      const mins = Math.round(Number(workMinutesInput) || 0);
      if (!cleanName) throw new Error('Введите наименование работы');
      if (mins <= 0) throw new Error('Укажите время выполнения в минутах');

      const res = await fetch(`/api/mechanic/orders/${id}/works`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          custom_work_name: cleanName,
          minutes: mins,
          norm_minutes: mins,
          actual_minutes: mins,
          completed: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось добавить работу');
      return data;
    },
    onSuccess: () => {
      setWorkNameInput('');
      setWorkMinutesInput('');
      queryClient.invalidateQueries({ queryKey: ['order-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['mechanic-works-history'] });
      queryClient.invalidateQueries({ queryKey: ['mechanic-salary'] });
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const deleteWorkMutation = useMutation({
    mutationFn: async (workId: string) => {
      const res = await fetch(`/api/mechanic/orders/${id}/works?work_id=${workId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Ошибка удаления работы');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['mechanic-works-history'] });
      queryClient.invalidateQueries({ queryKey: ['mechanic-salary'] });
    },
  });

  const addPartMutation = useMutation({
    mutationFn: async () => {
      setActionError('');
      const cleanName = partNameInput.trim();
      const qty = parseFloat(partQtyInput) || 1;
      if (!cleanName) throw new Error('Введите название запчасти');

      const res = await fetch(`/api/mechanic/orders/${id}/parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          custom_part_name: cleanName,
          quantity: qty,
          unit: partUnitInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось добавить запчасть');
      return data;
    },
    onSuccess: () => {
      setPartNameInput('');
      setPartQtyInput('1');
      queryClient.invalidateQueries({ queryKey: ['order-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['mechanic-works-history'] });
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const deletePartMutation = useMutation({
    mutationFn: async (partItemId: string) => {
      const res = await fetch(`/api/mechanic/orders/${id}/parts?part_item_id=${partItemId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Ошибка удаления запчасти');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['mechanic-works-history'] });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      setActionError('');
      const res = await fetch(`/api/mechanic/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Ошибка обновления наряда');
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['order-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['mechanic-works-history'] });
      queryClient.invalidateQueries({ queryKey: ['mechanic-salary'] });
      if (variables.status === 'completed') {
        router.push('/mechanic/orders');
      }
    },
    onError: (e: Error) => setActionError(e.message),
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 animate-pulse max-w-lg mx-auto">
        <div className="h-24 bg-white rounded-3xl" />
        <div className="h-40 bg-white rounded-3xl" />
        <div className="h-40 bg-white rounded-3xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-4 text-center max-w-lg mx-auto">
        <div className="bg-white rounded-3xl p-8 border border-slate-200">
          <p className="text-sm font-extrabold text-red-500">Заказ-наряд не найден</p>
        </div>
      </div>
    );
  }

  const isApproved = order.lifecycle_status === 'approved';
  const isCompleted = order.status === 'completed';
  const isEditable = !isApproved;

  const isOwn = order.machine_type === 'own';
  const hourlyRate = order.hourly_rate ?? (isOwn ? 1600 : 2000);
  const salaryPct = order.salary_pct ?? 50;
  const calcWorkPay = (mins: number) => Math.round(((mins / 60) * hourlyRate * salaryPct) / 100);

  const safeWorks = order.works || [];
  const safeParts = order.parts || [];
  const isPartsChecked =
    partsProvided !== null
      ? partsProvided
      : Boolean(order.parts_provided_by_service || safeParts.length > 0);

  const currentOdo = order.odometer_end || order.odometer_start || null;
  const hasOil = safeWorks.some(
    (w) => isOilOrFilterWork(w.work_catalog?.name) || isOilOrFilterWork(w.custom_work_name),
  );

  const vehicleTitle = isOwn
    ? order.asset?.short_name || 'Свой автопарк'
    : order.client_vehicle_brand || order.client_vehicle_model || 'Клиентский автомобиль';
  const vehicleReg = isOwn ? order.asset?.reg_number : order.client_vehicle_reg;

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto pb-28">
      {/* ── 1. БАНКОВСКАЯ ШАПКА НАРЯДА ── */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) {
                router.back();
              } else {
                router.push('/mechanic/orders');
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-600 bg-[#F2F4F7] px-3 py-1.5 rounded-xl active:scale-95 transition-transform"
          >
            ← Назад
          </button>

          <span
            className={cn(
              'text-[11px] font-extrabold px-3 py-1 rounded-full',
              isApproved
                ? 'bg-[#E8F7EC] text-[#0E7C5B]'
                : isCompleted
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-blue-50 text-blue-700',
            )}
          >
            {isApproved
              ? '✓ Закрыт и утверждён'
              : isCompleted
                ? '⏳ На проверке у администратора'
                : '🔧 В работе'}
          </span>
        </div>

        <div className="flex items-start justify-between gap-3 pt-1">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900">
                Заказ-наряд #{order.order_number}
              </h1>
              <span
                className={cn(
                  'text-[10px] font-extrabold px-2 py-0.5 rounded-md',
                  isOwn ? 'bg-slate-100 text-slate-700' : 'bg-blue-50 text-blue-700',
                )}
              >
                {isOwn ? `🚛 Свой (${hourlyRate} ₽/ч)` : `🚗 Клиент (${hourlyRate} ₽/ч)`}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">
              Дата: {formatDate(order.created_at)}
            </p>
          </div>

          <div className="text-right shrink-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Ваша ЗП</p>
            <p className="text-xl font-black text-[#21A038]">
              +<Money amount={order.mechanic_pay || order.estimated_pay || '0'} />
            </p>
          </div>
        </div>

        {/* Автомобиль и одометр */}
        <div className="bg-[#F2F4F7] rounded-2xl p-3.5 grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Автомобиль</p>
            <p className="text-sm font-extrabold text-slate-900 mt-0.5">{vehicleTitle}</p>
            {vehicleReg && (
              <p className="text-xs font-bold text-slate-500 uppercase">{vehicleReg}</p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Одометр (пробег)</p>
            <p className="text-sm font-extrabold text-slate-900 mt-0.5">
              {currentOdo ? `${Number(currentOdo).toLocaleString('ru-RU')} км` : 'Не указан'}
            </p>
            <p className="text-[11px] font-semibold text-[#21A038]">
              Время: {order.total_minutes ?? 0} мин
            </p>
          </div>
        </div>

        {order.admin_note && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
            <p className="text-[10px] font-extrabold text-amber-800 uppercase">
              Комментарий администратора:
            </p>
            <p className="text-xs font-semibold text-amber-900 mt-0.5">{order.admin_note}</p>
          </div>
        )}
      </div>

      {/* ── 2. ПЕРЕЧЕНЬ ВЫПОЛНЕННЫХ РАБОТ ── */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
            Перечень работ ({safeWorks.length})
          </h2>
          <span className="text-xs font-extrabold text-[#21A038]">
            Итого: {order.total_minutes ?? 0} мин
          </span>
        </div>

        {safeWorks.length === 0 ? (
          <p className="text-xs font-semibold text-slate-400 text-center py-4">
            Работы ещё не записаны — добавьте выполненную работу ниже
          </p>
        ) : (
          <div className="space-y-2">
            {safeWorks.map((w, idx) => {
              const name = w.custom_work_name || w.work_catalog?.name || 'Работа';
              const mins = w.actual_minutes || w.norm_minutes || 0;
              const workPay = calcWorkPay(mins);
              return (
                <div
                  key={w.id}
                  className="bg-[#F8FAFC] border border-slate-200/80 rounded-2xl p-3.5 flex items-start justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-slate-900">
                      {idx + 1}. {name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold text-slate-500">⏱ Время: {mins} мин</span>
                      <span className="text-xs font-extrabold text-[#21A038] bg-[#E8F7EC] px-2 py-0.5 rounded-md">
                        +{workPay.toLocaleString('ru-RU')} ₽ в ЗП
                      </span>
                    </div>
                  </div>
                  {isEditable && (
                    <button
                      type="button"
                      onClick={() => deleteWorkMutation.mutate(w.id)}
                      disabled={deleteWorkMutation.isPending}
                      className="w-7 h-7 rounded-lg bg-red-50 text-red-500 font-bold text-xs flex items-center justify-center shrink-0 active:scale-95"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Форма добавления работы (1 строка - название, 2 строка - минуты) */}
        {isEditable && (
          <div className="bg-[#F2F4F7] rounded-2xl p-3.5 space-y-2.5 border border-slate-200/70">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                Строка 1 — Наименование работы
              </label>
              <input
                type="text"
                value={workNameInput}
                onChange={(e) => setWorkNameInput(e.target.value)}
                placeholder="Например: Замена глушителя (бочка)"
                className="w-full h-11 px-3 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#21A038]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Строка 2 — Время в минутах
                </label>
                {Number(workMinutesInput) > 0 && (
                  <span className="text-[11px] font-extrabold text-[#21A038]">
                    +{calcWorkPay(Number(workMinutesInput)).toLocaleString('ru-RU')} ₽ в ЗП
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={workMinutesInput}
                  onChange={(e) => setWorkMinutesInput(e.target.value)}
                  placeholder="Минуты (напр. 60)"
                  className="flex-1 h-11 px-3 rounded-xl bg-white border border-slate-200 text-sm font-extrabold text-slate-900 focus:outline-none focus:border-[#21A038]"
                />
                <button
                  type="button"
                  onClick={() => addWorkMutation.mutate()}
                  disabled={addWorkMutation.isPending}
                  className="px-4 h-11 rounded-xl bg-[#21A038] text-white font-extrabold text-xs uppercase tracking-wide active:scale-95 transition-transform shrink-0"
                >
                  {addWorkMutation.isPending ? '...' : '+ Добавить'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[30, 45, 60, 90, 120, 180].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setWorkMinutesInput(String(m))}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors',
                      Number(workMinutesInput) === m
                        ? 'bg-[#21A038] text-white'
                        : 'bg-white text-slate-600 border border-slate-200',
                    )}
                  >
                    {m} мин
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 3. ЗАПЧАСТИ АВТОСЕРВИСА ── */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-3.5">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isPartsChecked}
            disabled={!isEditable}
            onChange={(e) => {
              setPartsProvided(e.target.checked);
              updateOrderMutation.mutate({ parts_provided_by_service: e.target.checked });
            }}
            className="mt-0.5 w-5 h-5 rounded-md accent-[#21A038] shrink-0"
          />
          <div className="flex-1">
            <p className="text-sm font-extrabold text-slate-900 leading-tight">
              Запчасти предоставил автосервис (мы)
            </p>
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">
              Механик или мастер-приёмщик ездили за запчастями или их привезли в гараж
            </p>
          </div>
        </label>

        {(isPartsChecked || safeParts.length > 0) && (
          <div className="pt-2 border-t border-slate-100 space-y-3">
            {safeParts.length === 0 ? (
              <p className="text-xs font-semibold text-slate-400 text-center py-2">
                Впишите купленные запчасти по одной ниже
              </p>
            ) : (
              <div className="space-y-1.5">
                {safeParts.map((p, idx) => {
                  const pName = p.custom_part_name || p.part?.name || 'Запчасть';
                  const pUnit = p.unit || p.part?.unit || 'шт';
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between bg-[#E8F7EC]/60 border border-[#21A038]/20 rounded-xl px-3.5 py-2.5"
                    >
                      <span className="text-xs font-extrabold text-slate-900">
                        {idx + 1}. {pName}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-[#0E7C5B]">
                          {p.quantity} {pUnit}
                        </span>
                        {isEditable && (
                          <button
                            type="button"
                            onClick={() => deletePartMutation.mutate(p.id)}
                            disabled={deletePartMutation.isPending}
                            className="w-6 h-6 rounded-md bg-white text-red-500 font-bold text-xs flex items-center justify-center"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {isEditable && (
              <div className="bg-[#F2F4F7] rounded-2xl p-3 space-y-2 border border-slate-200/70">
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Добавить купленную запчасть
                </label>
                <input
                  type="text"
                  value={partNameInput}
                  onChange={(e) => setPartNameInput(e.target.value)}
                  placeholder="Название запчасти (напр. Глушитель бочка)"
                  className="w-full h-11 px-3 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#21A038]"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={partQtyInput}
                    onChange={(e) => setPartQtyInput(e.target.value)}
                    placeholder="Кол-во"
                    className="w-20 h-11 px-3 rounded-xl bg-white border border-slate-200 text-sm font-extrabold text-slate-900"
                  />
                  <select
                    value={partUnitInput}
                    onChange={(e) => setPartUnitInput(e.target.value)}
                    className="w-24 h-11 px-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700"
                  >
                    <option value="шт">шт</option>
                    <option value="л">л</option>
                    <option value="компл">компл</option>
                    <option value="м">м</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => addPartMutation.mutate()}
                    disabled={addPartMutation.isPending}
                    className="flex-1 h-11 rounded-xl bg-slate-900 text-white font-extrabold text-xs uppercase tracking-wide active:scale-95 transition-transform"
                  >
                    + Запчасть
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 4. ОДОМЕТР (если не был указан) ── */}
      {isEditable && (!currentOdo || hasOil) && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-2">
          <label className="block text-xs font-extrabold text-slate-700">
            Пробег по одометру (км){' '}
            {(!isOwn || hasOil) && <span className="text-red-500">* обязательно</span>}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={odometerInput}
              onChange={(e) => setOdometerInput(e.target.value)}
              placeholder={currentOdo ? String(currentOdo) : 'Например: 154200'}
              className="flex-1 h-11 px-3.5 rounded-xl bg-[#F2F4F7] border border-slate-200 text-sm font-extrabold text-slate-900"
            />
            {odometerInput.trim() && (
              <button
                type="button"
                onClick={() => updateOrderMutation.mutate({ odometer_end: Number(odometerInput) })}
                disabled={updateOrderMutation.isPending}
                className="px-4 h-11 rounded-xl bg-[#E8F7EC] text-[#0E7C5B] font-extrabold text-xs uppercase"
              >
                Сохранить км
              </button>
            )}
          </div>
        </div>
      )}

      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-3.5 text-xs font-bold text-center">
          {actionError}
        </div>
      )}

      {/* ── 5. ФИКСИРОВАННАЯ ПАНЕЛЬ ЗАКРЫТИЯ НАРЯДА ── */}
      {!isApproved && (
        <div className="fixed bottom-20 left-0 right-0 z-40 px-4">
          <div className="max-w-lg mx-auto bg-white border border-slate-200 shadow-xl rounded-2xl p-3.5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Расчётная ЗП</p>
              <p className="text-lg font-black text-[#21A038]">
                +<Money amount={order.mechanic_pay || order.estimated_pay || '0'} />
              </p>
            </div>
            {order.status !== 'completed' ? (
              <button
                type="button"
                onClick={() => {
                  const odoVal = odometerInput.trim() ? Number(odometerInput) : currentOdo;
                  updateOrderMutation.mutate({
                    status: 'completed',
                    ...(odoVal ? { odometer_end: odoVal } : {}),
                  });
                }}
                disabled={updateOrderMutation.isPending}
                className="px-6 py-3 rounded-xl bg-[#21A038] text-white font-extrabold text-xs uppercase tracking-wide shadow-md shadow-[#21A038]/20 active:scale-95 transition-transform disabled:opacity-50"
              >
                {updateOrderMutation.isPending ? 'Сохраняем...' : '✓ Закрыть заказ-наряд'}
              </button>
            ) : (
              <span className="text-xs font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-xl">
                ⏳ Передан на проверку
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
