/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@saldacargo/ui';
import { isOilOrFilterWork } from '@saldacargo/shared';

interface WorkDraft {
  id: string;
  name: string;
  minutes: number;
}

interface PartDraft {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface CreateOrderModalProps {
  open: boolean;
  onClose: () => void;
  mechanicId?: string;
  hourlyRateClient?: number;
  hourlyRateOwn?: number;
  salaryPct?: number;
}

export default function CreateOrderModal({
  open,
  onClose,
  mechanicId,
  hourlyRateClient = 2000,
  hourlyRateOwn = 1600,
  salaryPct = 50,
}: CreateOrderModalProps) {
  const queryClient = useQueryClient();
  const todayStr = new Date().toISOString().split('T')[0] ?? '';

  // 1. Даты начала и окончания
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  // 2. Свой или клиентский
  const [machineType, setMachineType] = useState<'own' | 'client'>('client');
  // 3. Данные автомобиля
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [clientModel, setClientModel] = useState<string>('');
  const [clientReg, setClientReg] = useState<string>('');
  const [odometer, setOdometer] = useState<string>('');

  // 4. Перечень работ
  const [works, setWorks] = useState<WorkDraft[]>([]);
  const [workNameInput, setWorkNameInput] = useState<string>('');
  const [workMinutesInput, setWorkMinutesInput] = useState<string>('');

  // 5. Чекбокс запчастей автосервиса
  const [partsProvidedByService, setPartsProvidedByService] = useState<boolean>(false);
  const [parts, setParts] = useState<PartDraft[]>([]);
  const [partNameInput, setPartNameInput] = useState<string>('');
  const [partQtyInput, setPartQtyInput] = useState<string>('1');
  const [partUnitInput, setPartUnitInput] = useState<string>('шт');

  const [mechanicNote, setMechanicNote] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const { data: assets = [] } = useQuery<any[]>({
    queryKey: ['driver-assets'],
    queryFn: async () => {
      const res = await fetch('/api/driver/assets');
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data.filter((a) => a.id !== 'err' && a.id !== 'empty') : [];
    },
    enabled: open,
    staleTime: 60000,
  });

  const activeRate = machineType === 'own' ? hourlyRateOwn : hourlyRateClient;
  const mechanicHourlyShare = Math.round((activeRate * salaryPct) / 100);

  const calcWorkPay = (mins: number) => Math.round(((mins / 60) * activeRate * salaryPct) / 100);

  // Учитываем в превью и уже добавленные работы, и текущую вводимую строку
  const pendingInputMins =
    workNameInput.trim() && Number(workMinutesInput) > 0 ? Number(workMinutesInput) : 0;
  const totalMinutes = works.reduce((sum, w) => sum + w.minutes, 0) + pendingInputMins;
  const totalEstimatedPay = calcWorkPay(totalMinutes);

  const hasOilWork =
    works.some((w) => isOilOrFilterWork(w.name)) || isOilOrFilterWork(workNameInput);

  const handleAddWork = () => {
    setErrorMsg('');
    const cleanName = workNameInput.trim();
    const mins = Math.round(Number(workMinutesInput) || 0);
    if (!cleanName) {
      setErrorMsg('Введите наименование выполненной работы');
      return;
    }
    if (mins <= 0) {
      setErrorMsg('Укажите время выполнения работы в минутах');
      return;
    }
    setWorks((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, name: cleanName, minutes: mins },
    ]);
    setWorkNameInput('');
    setWorkMinutesInput('');
  };

  const handleRemoveWork = (id: string) => {
    setWorks((prev) => prev.filter((w) => w.id !== id));
  };

  const handleAddPart = () => {
    setErrorMsg('');
    const cleanName = partNameInput.trim();
    const qty = parseFloat(partQtyInput) || 1;
    if (!cleanName) {
      setErrorMsg('Введите название запчасти');
      return;
    }
    setParts((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        name: cleanName,
        quantity: qty > 0 ? qty : 1,
        unit: partUnitInput,
      },
    ]);
    setPartNameInput('');
    setPartQtyInput('1');
  };

  const handleRemovePart = (id: string) => {
    setParts((prev) => prev.filter((p) => p.id !== id));
  };

  const createOrderMutation = useMutation({
    mutationFn: async (submitImmediately: boolean) => {
      setErrorMsg('');

      // Если механик вписал работу в поля ввода, но не нажал «+ Добавить», подхватываем её автоматически
      const finalWorks = [...works];
      if (workNameInput.trim() && Number(workMinutesInput) > 0) {
        finalWorks.push({
          id: 'auto-work',
          name: workNameInput.trim(),
          minutes: Math.round(Number(workMinutesInput)),
        });
      }

      const finalParts = [...parts];
      if (partsProvidedByService && partNameInput.trim()) {
        finalParts.push({
          id: 'auto-part',
          name: partNameInput.trim(),
          quantity: parseFloat(partQtyInput) || 1,
          unit: partUnitInput,
        });
      }

      if (machineType === 'own' && !selectedAssetId) {
        throw new Error('Выберите автомобиль из нашего автопарка');
      }
      if (machineType === 'client') {
        if (!clientModel.trim()) throw new Error('Укажите модель клиентского автомобиля');
        if (!clientReg.trim()) throw new Error('Укажите госномер клиентского автомобиля');
        if (!odometer.trim() || Number(odometer) <= 0) {
          throw new Error('Для клиентского автомобиля обязательно укажите одометр (пробег)');
        }
      }

      if (submitImmediately && finalWorks.length === 0) {
        throw new Error('Добавьте хотя бы одну работу и укажите время в минутах');
      }

      const res = await fetch('/api/mechanic/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mechanic_id: mechanicId,
          order_date: startDate,
          started_at: startDate,
          completed_at: endDate,
          machine_type: machineType,
          asset_id: machineType === 'own' ? selectedAssetId : undefined,
          client_vehicle_model: machineType === 'client' ? clientModel.trim() : undefined,
          client_vehicle_brand: machineType === 'client' ? clientModel.trim() : undefined,
          client_vehicle_reg: machineType === 'client' ? clientReg.trim().toUpperCase() : undefined,
          odometer: odometer.trim() ? Number(odometer) : null,
          works: finalWorks.map((w) => ({ name: w.name, minutes: w.minutes })),
          parts_provided_by_service: partsProvidedByService,
          parts: partsProvidedByService
            ? finalParts.map((p) => ({ name: p.name, quantity: p.quantity, unit: p.unit }))
            : [],
          mechanic_note: mechanicNote.trim() || undefined,
          submit_immediately: submitImmediately,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Не удалось сохранить заказ-наряд');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mechanic-works-history'] });
      queryClient.invalidateQueries({ queryKey: ['mechanic-salary'] });
      // Сбрасываем форму
      setWorks([]);
      setWorkNameInput('');
      setWorkMinutesInput('');
      setParts([]);
      setPartNameInput('');
      setPartQtyInput('1');
      setPartsProvidedByService(false);
      setClientModel('');
      setClientReg('');
      setOdometer('');
      setMechanicNote('');
      setErrorMsg('');
      onClose();
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-[#F2F4F7] sm:rounded-3xl rounded-t-3xl max-h-[94vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
        {/* Шапка модалки в стиле Сбербанк */}
        <div className="bg-white px-5 py-4 border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#21A038] block">
              СТО · Новый документ
            </span>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
              Открыть заказ-наряд
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 font-bold text-lg flex items-center justify-center active:scale-95 transition-transform"
          >
            ✕
          </button>
        </div>

        {/* Тело формы */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* ШАГ 1 и 2: Дата + Тип автомобиля (Свой / Клиентский) */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                1. Даты проведения работ (начало и окончание)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 mb-1">Начат</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (endDate < e.target.value) setEndDate(e.target.value);
                    }}
                    className="w-full h-11 px-3 rounded-xl bg-[#F2F4F7] border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#21A038] focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 mb-1">Закончен</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-[#F2F4F7] border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#21A038] focus:bg-white transition-colors"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  2. Чей автомобиль
                </label>
                <span className="text-[11px] font-extrabold text-[#21A038] bg-[#E8F7EC] px-2.5 py-0.5 rounded-full">
                  Ставка: {activeRate.toLocaleString('ru-RU')} ₽/ч · ЗП {mechanicHourlyShare} ₽/ч
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-[#F2F4F7] p-1.5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setMachineType('own');
                    setErrorMsg('');
                  }}
                  className={cn(
                    'py-3 px-3 rounded-xl text-left transition-all',
                    machineType === 'own'
                      ? 'bg-white text-slate-900 shadow-xs border border-[#21A038]/40'
                      : 'text-slate-500',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold">🚛 Свой автопарк</span>
                    {machineType === 'own' && (
                      <span className="w-2 h-2 rounded-full bg-[#21A038]" />
                    )}
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                    {hourlyRateOwn.toLocaleString('ru-RU')} ₽/час
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMachineType('client');
                    setErrorMsg('');
                  }}
                  className={cn(
                    'py-3 px-3 rounded-xl text-left transition-all',
                    machineType === 'client'
                      ? 'bg-white text-slate-900 shadow-xs border border-[#21A038]/40'
                      : 'text-slate-500',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold">🚗 Клиентский</span>
                    {machineType === 'client' && (
                      <span className="w-2 h-2 rounded-full bg-[#21A038]" />
                    )}
                  </div>
                  <p className="text-[11px] font-semibold text-[#21A038] mt-0.5">
                    {hourlyRateClient.toLocaleString('ru-RU')} ₽/час
                  </p>
                </button>
              </div>
            </div>
          </div>

          {/* ШАГ 3: Автомобиль и Одометр */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                3. Данные автомобиля
              </label>
              {machineType === 'client' && (
                <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  Все поля обязательны *
                </span>
              )}
            </div>

            {machineType === 'own' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Машина из автопарка <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedAssetId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedAssetId(id);
                      const found = assets.find((a) => a.id === id);
                      if (found?.odometer_current && !odometer) {
                        setOdometer(String(found.odometer_current));
                      }
                    }}
                    className="w-full h-12 px-3.5 rounded-xl bg-[#F2F4F7] border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#21A038] focus:bg-white"
                  >
                    <option value="">— Выберите машину —</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.short_name} ({a.reg_number})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Одометр (пробег, км){' '}
                    {hasOilWork ? (
                      <span className="text-red-500 font-extrabold">* обязательно (ТО/масло)</span>
                    ) : (
                      <span className="text-slate-400 font-normal">(при наличии)</span>
                    )}
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={odometer}
                    onChange={(e) => setOdometer(e.target.value)}
                    placeholder="Например: 185400"
                    className="w-full h-12 px-3.5 rounded-xl bg-[#F2F4F7] border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#21A038] focus:bg-white"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Модель автомобиля <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={clientModel}
                    onChange={(e) => setClientModel(e.target.value)}
                    placeholder="Например: ГАЗель Next / Лада Веста"
                    className="w-full h-12 px-3.5 rounded-xl bg-[#F2F4F7] border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#21A038] focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Госномер <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={clientReg}
                      onChange={(e) => setClientReg(e.target.value.toUpperCase())}
                      placeholder="А123ВС 96"
                      className="w-full h-12 px-3.5 rounded-xl bg-[#F2F4F7] border border-slate-200 text-sm font-extrabold uppercase text-slate-900 focus:outline-none focus:border-[#21A038] focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Одометр, км <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={odometer}
                      onChange={(e) => setOdometer(e.target.value)}
                      placeholder="142000"
                      className="w-full h-12 px-3.5 rounded-xl bg-[#F2F4F7] border border-slate-200 text-sm font-extrabold text-slate-900 focus:outline-none focus:border-[#21A038] focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ШАГ 4: Перечень работ (1 строка - название, 2 строка - время в минутах) */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                4. Перечень выполненных работ ({works.length})
              </label>
              {totalMinutes > 0 && (
                <span className="text-xs font-extrabold text-[#21A038]">
                  {totalMinutes} мин · +{totalEstimatedPay.toLocaleString('ru-RU')} ₽
                </span>
              )}
            </div>

            {/* Список уже добавленных работ */}
            {works.length > 0 && (
              <div className="space-y-2">
                {works.map((w, idx) => {
                  const pay = calcWorkPay(w.minutes);
                  return (
                    <div
                      key={w.id}
                      className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-3 flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold text-slate-900 leading-snug">
                          {idx + 1}. {w.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-bold text-slate-500">
                            ⏱ Время: {w.minutes} мин
                          </span>
                          <span className="text-xs font-extrabold text-[#21A038] bg-[#E8F7EC] px-2 py-0.5 rounded-md">
                            +{pay.toLocaleString('ru-RU')} ₽ в ЗП
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveWork(w.id)}
                        className="w-7 h-7 rounded-lg bg-red-50 text-red-500 font-bold text-xs flex items-center justify-center shrink-0 active:scale-95"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Поля ввода новой работы (в 2 строки: Название -> Время в минутах) */}
            <div className="bg-[#F2F4F7] rounded-2xl p-3 space-y-2.5 border border-slate-200/70">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                  Строка 1 — Наименование работы
                </label>
                <input
                  type="text"
                  value={workNameInput}
                  onChange={(e) => setWorkNameInput(e.target.value)}
                  placeholder="К примеру: Замена глушителя (бочка)"
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
                      Начисление: +{calcWorkPay(Number(workMinutesInput)).toLocaleString('ru-RU')} ₽
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
                    onClick={handleAddWork}
                    className="px-4 h-11 rounded-xl bg-[#21A038] text-white font-extrabold text-xs uppercase tracking-wide active:scale-95 transition-transform shrink-0 shadow-xs"
                  >
                    + Добавить
                  </button>
                </div>

                {/* Быстрые кнопки минут */}
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
          </div>

          {/* ШАГ 5: Чек-бокс «Запчасти предоставил автосервис (мы)» */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-3.5">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={partsProvidedByService}
                onChange={(e) => setPartsProvidedByService(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded-md accent-[#21A038] shrink-0"
              />
              <div className="flex-1">
                <p className="text-sm font-extrabold text-slate-900 leading-tight">
                  Запчасти предоставил автосервис (мы)
                </p>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                  Отметьте, если механик или мастер-приёмщик ездили за запчастями или их привезли в
                  гараж
                </p>
              </div>
            </label>

            {partsProvidedByService && (
              <div className="pt-2 border-t border-slate-100 space-y-3">
                {parts.length > 0 && (
                  <div className="space-y-1.5">
                    {parts.map((p, idx) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between bg-[#E8F7EC]/60 border border-[#21A038]/20 rounded-xl px-3 py-2"
                      >
                        <span className="text-xs font-extrabold text-slate-800">
                          {idx + 1}. {p.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-[#0E7C5B]">
                            {p.quantity} {p.unit}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemovePart(p.id)}
                            className="w-6 h-6 rounded-md bg-white text-red-500 font-bold text-xs flex items-center justify-center"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-[#F2F4F7] rounded-2xl p-3 space-y-2 border border-slate-200/70">
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                    Впишите купленные запчасти по одной
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
                      className="w-24 h-11 px-3 rounded-xl bg-white border border-slate-200 text-sm font-extrabold text-slate-900 focus:outline-none focus:border-[#21A038]"
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
                      onClick={handleAddPart}
                      className="flex-1 h-11 rounded-xl bg-slate-900 text-white font-extrabold text-xs uppercase tracking-wide active:scale-95 transition-transform"
                    >
                      + Запчасть
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Комментарий (необязательно) */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Комментарий / рекомендации (необязательно)
            </label>
            <input
              type="text"
              value={mechanicNote}
              onChange={(e) => setMechanicNote(e.target.value)}
              placeholder="Заметка для мастера-приёмщика или клиента..."
              className="w-full h-11 px-3.5 rounded-xl bg-[#F2F4F7] border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:border-[#21A038] focus:bg-white"
            />
          </div>

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-3.5 text-xs font-bold text-center">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Нижний банковский бар с итоговой ЗП и кнопками */}
        <div className="bg-white border-t border-slate-200 px-5 py-4 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Ваша ЗП за этот наряд
              </p>
              <p className="text-xs font-semibold text-slate-500">
                Время: {totalMinutes} мин ({(totalMinutes / 60).toFixed(1)} ч)
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-[#21A038] tracking-tight">
                +{totalEstimatedPay.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => createOrderMutation.mutate(false)}
              disabled={createOrderMutation.isPending}
              className="px-4 py-3.5 rounded-2xl border border-slate-200 bg-[#F2F4F7] text-slate-700 font-extrabold text-xs uppercase tracking-wide active:scale-95 transition-transform disabled:opacity-50"
            >
              В работу
            </button>
            <button
              type="button"
              onClick={() => createOrderMutation.mutate(true)}
              disabled={createOrderMutation.isPending}
              className="flex-1 py-3.5 rounded-2xl bg-[#21A038] hover:bg-[#1b8a2f] text-white font-extrabold text-sm uppercase tracking-wide shadow-md shadow-[#21A038]/20 active:scale-[0.99] transition-all disabled:opacity-50"
            >
              {createOrderMutation.isPending ? 'Сохранение...' : '✓ Записать и закрыть наряд'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
