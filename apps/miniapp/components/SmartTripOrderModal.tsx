/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

export interface RouteStop {
  id: string;
  loading_city: string;
  loading_address: string;
  loading_org?: string;
  unloading_city: string;
  unloading_address: string;
  unloading_org?: string;
  cargo_name?: string;
  weight_kg?: number;
}

export interface ClientOrderPart {
  id: string;
  client_id: string;
  client_name: string;
  client_inn?: string;
  base_doc_number: string;
  cargo_name: string;
  weight_gross_kg: number | '';
  price_without_vat: number | '';
  forwarder_id?: string;
  forwarder_name?: string;
  payment_method?: 'bank_invoice' | 'cash' | 'qr' | 'debt_cash';
  payment_terms?: string;
}

export interface SmartTripOrderModalProps {
  trip: any;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function SmartTripOrderModal({ trip, isOpen, onClose, onSaved }: SmartTripOrderModalProps) {
  const [selectedClientType, setSelectedClientType] = useState<'vsmpo' | 'geostroy' | 'manual'>(
    'manual',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Загрузка справочника контрагентов
  const { data: counterparties = [] } = useQuery<any[]>({
    queryKey: ['miniapp-counterparties-all'],
    queryFn: () =>
      fetch('/api/driver/counterparties')
        .then((r) => r.json())
        .catch(() => []),
    staleTime: 60000,
  });

  // Загрузка автомобилей
  const { data: vehicles = [] } = useQuery<any[]>({
    queryKey: ['miniapp-vehicles-list'],
    queryFn: () =>
      fetch('/api/vehicles/public')
        .then((r) => r.json())
        .catch(() => []),
    staleTime: 60000,
  });

  // Загрузка водителей
  const { data: drivers = [] } = useQuery<any[]>({
    queryKey: ['miniapp-drivers-list'],
    queryFn: () =>
      fetch('/api/users/public?role=driver')
        .then((r) => r.json())
        .catch(() => []),
    staleTime: 60000,
  });

  // Защита от автозавершения через Салду
  const [preventSaldaAutoFinish, setPreventSaldaAutoFinish] = useState<boolean>(() => {
    const note = (trip?.driver_note || '') + ' ' + (trip?.admin_note || '');
    return note.toLowerCase().includes('шайтан') || note.toLowerCase().includes('мамин');
  });

  // Точки маршрута (мульти-стоп)
  const [routes, setRoutes] = useState<RouteStop[]>(() => {
    const note = (trip?.driver_note || '') + ' ' + (trip?.admin_note || '');
    const isShaytanka = note.toLowerCase().includes('шайтан');
    const isMaminskoe = note.toLowerCase().includes('мамин');

    return [
      {
        id: '1',
        loading_city: isShaytanka ? 'Шайтанка' : 'Верхняя Салда',
        loading_address: isShaytanka ? 'пос. Шайтанка, Свердловская обл.' : 'г. Верхняя Салда',
        loading_org: isShaytanka ? 'ООО "Геостройиндустрия"' : '',
        unloading_city: isMaminskoe ? 'Маминское' : '',
        unloading_address: isMaminskoe ? 'село Маминское, склад 2' : '',
        unloading_org: isMaminskoe ? 'ООО "Геостройиндустрия"' : '',
        cargo_name: isShaytanka ? 'Пробы керна' : 'Груз',
        weight_kg: 0,
      },
    ];
  });

  // Заказы клиентов (мульти-заказы)
  const [clientOrders, setClientOrders] = useState<ClientOrderPart[]>(() => {
    const active = (trip?.trip_orders ?? []).filter(
      (to: any) => to.lifecycle_status !== 'cancelled',
    );
    if (active.length > 0) {
      return active.map((to: any, idx: number) => ({
        id: to.id || String(idx + 1),
        client_id: to.counterparty_id || '',
        client_name: to.counterparty?.name || to.counterparty_name || '',
        base_doc_number: to.invoice_number || String(trip.trip_number || ''),
        cargo_name: to.description || '',
        weight_gross_kg: '',
        price_without_vat: to.amount ? Number(to.amount) : '',
        forwarder_name: '— (Прямой заказчик)',
        payment_method: to.payment_method || 'bank_invoice',
      }));
    }

    return [
      {
        id: '1',
        client_id: '',
        client_name: '',
        base_doc_number: String(trip?.trip_number || ''),
        cargo_name: 'Пробы керна',
        weight_gross_kg: '',
        price_without_vat: 40000,
        payment_method: 'bank_invoice',
      },
    ];
  });

  // Форма общих параметров рейса
  const [form, setForm] = useState<any>(() => {
    const today = new Date().toISOString().slice(0, 10);
    const active = (trip?.trip_orders ?? []).filter(
      (to: any) => to.lifecycle_status !== 'cancelled',
    );
    const firstTo = active[0];

    const totalDriverPay = active.reduce(
      (s: number, o: any) => s + (parseFloat(o.driver_pay || '0') || 0),
      0,
    );

    return {
      base_doc_number: String(trip?.trip_number || ''),
      base_doc_date: trip?.started_at ? trip.started_at.slice(0, 10) : today,
      client_id: firstTo?.counterparty_id || '',
      client_name: firstTo?.counterparty?.name || '',
      assigned_vehicle_id: trip?.asset?.id || trip?.asset_id || '',
      assigned_driver_id: trip?.driver?.id || trip?.driver_id || '',
      driver_pay: totalDriverPay > 0 ? totalDriverPay : 7900,
      admin_note: trip?.admin_note || '',
      driver_note: trip?.driver_note || '',
    };
  });

  const LOCATION_PRESETS = [
    {
      key: 'shaytanka',
      label: 'Шайтанка',
      city: 'Шайтанка',
      address: 'пос. Шайтанка, Свердловская обл.',
      cargo: 'Пробы керна',
    },
    { key: 'maminskoe', label: 'Маминское', city: 'Маминское', address: 'село Маминское, склад 2' },
    { key: 'rezh', label: 'Реж', city: 'Реж', address: 'г. Реж, Свердловская обл.' },
    {
      key: 'karpinsk',
      label: 'Карпинск',
      city: 'Карпинск',
      address: 'г. Карпинск, Свердловская обл.',
    },
    {
      key: 'vorontsovka',
      label: 'Воронцовка',
      city: 'Воронцовка',
      address: 'пос. Воронцовка, Свердловская обл.',
    },
    {
      key: 'salda',
      label: 'В.Салда (База)',
      city: 'Верхняя Салда',
      address: 'г. Верхняя Салда, База',
    },
  ];

  const applyLocationPreset = (field: 'loading' | 'unloading', presetKey: string, stopIdx = 0) => {
    const loc = LOCATION_PRESETS.find((l) => l.key === presetKey);
    if (!loc) return;

    const updated = [...routes];
    if (updated[stopIdx]) {
      updated[stopIdx] = {
        ...updated[stopIdx],
        ...(field === 'loading'
          ? {
              loading_city: loc.city,
              loading_address: loc.address,
              ...(loc.cargo ? { cargo_name: loc.cargo } : {}),
            }
          : { unloading_city: loc.city, unloading_address: loc.address }),
      };
      setRoutes(updated);
    }

    const firstLoad = updated[0]?.loading_city?.toLowerCase() || '';
    const lastUnload = updated[updated.length - 1]?.unloading_city?.toLowerCase() || '';

    if (
      (firstLoad.includes('шайтан') && lastUnload.includes('мамин')) ||
      (firstLoad.includes('мамин') && lastUnload.includes('шайтан'))
    ) {
      setPreventSaldaAutoFinish(true);
      setForm((f: any) => ({ ...f, driver_pay: 7900 }));
      handleUpdateClientOrder(0, { price_without_vat: 40000 });
      setStatusMessage('⭐ Применен маршрут Шайтанка ➔ Маминское (40 000 ₽, ЗП: 7 900 ₽)');
    }
  };

  const selectClientPreset = (type: 'vsmpo' | 'geostroy' | 'manual') => {
    setSelectedClientType(type);
    if (type === 'geostroy') {
      const geoCp = counterparties.find((c: any) => c.name?.toLowerCase().includes('геострой'));
      const geoName = geoCp?.name || 'ООО "Геостройиндустрия"';
      const geoId = geoCp?.id || '';

      setClientOrders([
        {
          id: '1',
          client_id: geoId,
          client_name: geoName,
          base_doc_number: form.base_doc_number || String(trip?.trip_number || '1056'),
          cargo_name: 'Пробы керна',
          weight_gross_kg: 3500,
          price_without_vat: 40000,
          payment_method: 'bank_invoice',
        },
      ]);

      setRoutes([
        {
          id: '1',
          loading_city: 'Шайтанка',
          loading_address: 'пос. Шайтанка, Свердловская обл.',
          loading_org: geoName + ' (ЛОП)',
          unloading_city: 'Маминское',
          unloading_address: 'село Маминское, склад 2',
          unloading_org: geoName,
          cargo_name: 'Пробы керна',
          weight_kg: 3500,
        },
      ]);

      setForm((prev: any) => ({
        ...prev,
        client_id: geoId,
        client_name: geoName,
        driver_pay: 7900,
      }));

      setPreventSaldaAutoFinish(true);
      setStatusMessage(
        '⭐ Шаблон ООО «Геостройиндустрия»: 40 000 ₽ (Шайтанка ➔ Маминское, ЗП 7 900 ₽)',
      );
    } else if (type === 'vsmpo') {
      const vsmpoCp = counterparties.find((c: any) => c.name?.toLowerCase().includes('всмпо'));
      const vsmpoName = vsmpoCp?.name || 'ПАО «Корпорация ВСМПО-АВИСМА»';

      setClientOrders([
        {
          id: '1',
          client_id: vsmpoCp?.id || '',
          client_name: vsmpoName,
          base_doc_number: `794/${new Date().getFullYear()}`,
          cargo_name: 'Пруток 20мм, труба нерж.сталь',
          weight_gross_kg: 1500,
          price_without_vat: 15000,
          forwarder_name: 'ИП Парфенов Андрей Виталиевич',
          payment_method: 'bank_invoice',
        },
      ]);

      setRoutes([
        {
          id: '1',
          loading_city: 'Заречный',
          loading_address: 'г. Заречный, ул. Промзона БЗСК, д 2',
          loading_org: 'ООО "Континенталь"',
          unloading_city: 'Верхняя Салда',
          unloading_address: 'г. Верхняя Салда, ул. Парковая, д 1',
          unloading_org: vsmpoName,
          cargo_name: 'Пруток 20мм, труба нерж.сталь',
          weight_kg: 1500,
        },
      ]);

      setForm((prev: any) => ({
        ...prev,
        client_id: vsmpoCp?.id || '',
        client_name: vsmpoName,
      }));

      setStatusMessage('⭐ Шаблон ПАО «Корпорация ВСМПО-АВИСМА» (ИП Парфенов)');
    } else {
      setStatusMessage('📝 Режим ручного ввода');
    }
  };

  const handleAddClientOrder = () => {
    if (clientOrders.length >= 6) {
      alert('Максимальное количество клиентов в рейсе — 6');
      return;
    }
    setClientOrders((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        client_id: '',
        client_name: '',
        base_doc_number: '',
        cargo_name: '',
        weight_gross_kg: '',
        price_without_vat: '',
        payment_method: 'bank_invoice',
      },
    ]);
  };

  const handleRemoveClientOrder = (idx: number) => {
    if (clientOrders.length <= 1) return;
    setClientOrders((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateClientOrder = (idx: number, patch: Partial<ClientOrderPart>) => {
    setClientOrders((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], ...patch } as ClientOrderPart;
      if (idx === 0 && patch.client_name !== undefined) {
        setForm((f: any) => ({
          ...f,
          client_name: patch.client_name,
          client_id: patch.client_id || f.client_id,
        }));
      }
      return updated;
    });
  };

  const handleAddRouteStop = () => {
    if (routes.length >= 6) {
      alert('Максимальное количество точек — 6');
      return;
    }
    setRoutes((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        loading_city: prev[prev.length - 1]?.unloading_city || 'Верхняя Салда',
        loading_address: prev[prev.length - 1]?.unloading_address || '',
        unloading_city: '',
        unloading_address: '',
        cargo_name: 'Груз',
        weight_kg: 0,
      },
    ]);
  };

  const handleRemoveRouteStop = (idx: number) => {
    if (routes.length <= 1) return;
    setRoutes((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async (andApprove = false) => {
    setSaving(true);
    setError('');
    try {
      const primaryLoadCity = routes[0]?.loading_city || 'Шайтанка';
      const primaryUnloadCity = routes[routes.length - 1]?.unloading_city || 'Маминское';

      const ordersPayload = clientOrders.map((co) => ({
        id: co.id && !co.id.startsWith('new-') && co.id.length > 10 ? co.id : undefined,
        isNew: !co.id || co.id.startsWith('new-') || co.id.length < 10,
        counterparty_id: co.client_id || form.client_id || null,
        counterparty_name: co.client_name || form.client_name,
        amount: String(co.price_without_vat || 0),
        driver_pay: String(
          Math.round(Number(form.driver_pay || 0) / Math.max(1, clientOrders.length)),
        ),
        payment_method: co.payment_method || 'bank_invoice',
        description: `[${primaryLoadCity} ➔ ${primaryUnloadCity}] ${co.cargo_name || 'Груз'}`,
      }));

      // Сохраняем в trips через PATCH /api/admin/trips/:id
      const res = await fetch(`/api/admin/trips/${trip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit_orders',
          orders: ordersPayload,
          driver_pay: String(form.driver_pay),
          driver_id: form.assigned_driver_id || undefined,
          note:
            form.admin_note ||
            `Маршрут: ${primaryLoadCity} ➔ ${primaryUnloadCity} | ЗП: ${form.driver_pay} ₽`,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Ошибка сохранения рейса');
      }

      if (andApprove) {
        const approveRes = await fetch(`/api/admin/trips/${trip.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'approve' }),
        });
        if (!approveRes.ok) {
          const ad = await approveRes.json();
          throw new Error(ad.error || 'Ошибка одобрения рейса');
        }
      }

      setSaving(false);
      onSaved();
    } catch (e: any) {
      setSaving(false);
      setError(e.message || 'Ошибка сети');
    }
  };

  if (!isOpen) return null;

  const totalRevenue = clientOrders.reduce(
    (sum, co) => sum + (Number(co.price_without_vat) || 0),
    0,
  );

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl border border-zinc-200 animate-in slide-in-from-bottom duration-150 overflow-hidden">
        {/* Хэндл для свайпа на мобильных */}
        <div className="pt-2 pb-1 sm:hidden flex justify-center bg-white shrink-0">
          <div className="w-10 h-1 bg-zinc-300 rounded-full" />
        </div>

        {/* Заголовок (зафиксирован вверху) */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5 bg-white shrink-0">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900">
                Рейс #{form.base_doc_number || trip.trip_number}
              </span>
              <span className="text-[10px] font-bold text-zinc-500">
                {trip.asset?.short_name || 'Авто'} ({trip.asset?.reg_number})
              </span>
            </div>
            <h3 className="font-black text-sm text-zinc-900 mt-0.5">
              Редактирование рейса и точек маршрута
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 font-bold active:scale-95 transition-transform"
          >
            ✕
          </button>
        </div>

        {/* Скроллящееся содержимое формы */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 overscroll-contain">
          {/* 1. БЫСТРЫЕ ШАБЛОНЫ (ВСМПО / ГЕОСТРОЙ / РУЧНОЙ) */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">
              Шаблон рейса (в 1 клик):
            </label>
            <div className="grid grid-cols-3 gap-1.5 bg-zinc-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => selectClientPreset('manual')}
                className={`py-1.5 rounded-lg transition ${
                  selectedClientType === 'manual'
                    ? 'bg-white text-indigo-700 shadow-xs font-black'
                    : 'text-zinc-600'
                }`}
              >
                📝 Ручной
              </button>
              <button
                type="button"
                onClick={() => selectClientPreset('geostroy')}
                className={`py-1.5 rounded-lg transition ${
                  selectedClientType === 'geostroy'
                    ? 'bg-white text-indigo-700 shadow-xs font-black'
                    : 'text-zinc-600'
                }`}
              >
                🏗️ Геострой
              </button>
              <button
                type="button"
                onClick={() => selectClientPreset('vsmpo')}
                className={`py-1.5 rounded-lg transition ${
                  selectedClientType === 'vsmpo'
                    ? 'bg-white text-indigo-700 shadow-xs font-black'
                    : 'text-zinc-600'
                }`}
              >
                🏢 ВСМПО
              </button>
            </div>
          </div>

          {statusMessage && (
            <div className="p-2 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900">
              {statusMessage}
            </div>
          )}

          {error && (
            <div className="p-2 bg-rose-50 border border-rose-300 rounded-xl text-xs font-bold text-rose-900">
              ❌ {error}
            </div>
          )}

          {/* 2. ТОЧКИ МАРШРУТА (МУЛЬТИ-СТОП) */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3 space-y-2.5">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-1.5">
              <span className="text-xs font-black text-zinc-900 flex items-center gap-1">
                <span>📍</span>
                <span>Точки маршрута ({routes.length})</span>
              </span>
              <button
                type="button"
                onClick={handleAddRouteStop}
                className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-0.5"
              >
                + Точка
              </button>
            </div>

            <div className="space-y-2">
              {routes.map((stop, idx) => (
                <div
                  key={stop.id}
                  className="bg-white border border-zinc-200 rounded-xl p-2.5 space-y-1.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-zinc-700">
                    <span>
                      {idx === 0
                        ? '📍 Погрузка (Откуда)'
                        : idx === routes.length - 1
                          ? '🏁 Выгрузка (Куда)'
                          : `Точка #${idx + 1}`}
                    </span>
                    {routes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRouteStop(idx)}
                        className="text-rose-600 text-[10px] font-bold"
                      >
                        ✕ Удалить
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] text-zinc-500 font-bold">Откуда:</span>
                        <div className="flex gap-1 overflow-x-auto">
                          {LOCATION_PRESETS.slice(0, 3).map((loc) => (
                            <button
                              key={`load-pre-${loc.key}-${idx}`}
                              type="button"
                              onClick={() => applyLocationPreset('loading', loc.key, idx)}
                              className="text-[9px] bg-zinc-100 hover:bg-zinc-200 px-1 py-0.2 rounded font-semibold text-zinc-700 shrink-0"
                            >
                              {loc.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        type="text"
                        value={stop.loading_address}
                        onChange={(e) => {
                          const updated = [...routes];
                          if (updated[idx]) {
                            updated[idx] = {
                              ...updated[idx],
                              loading_address: e.target.value,
                              loading_city: e.target.value.split(',')[0] || e.target.value,
                            };
                            setRoutes(updated);
                          }
                        }}
                        className="w-full border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] text-zinc-500 font-bold">Куда:</span>
                        <div className="flex gap-1 overflow-x-auto">
                          {LOCATION_PRESETS.slice(1, 4).map((loc) => (
                            <button
                              key={`unload-pre-${loc.key}-${idx}`}
                              type="button"
                              onClick={() => applyLocationPreset('unloading', loc.key, idx)}
                              className="text-[9px] bg-zinc-100 hover:bg-zinc-200 px-1 py-0.2 rounded font-semibold text-zinc-700 shrink-0"
                            >
                              {loc.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        type="text"
                        value={stop.unloading_address}
                        onChange={(e) => {
                          const updated = [...routes];
                          if (updated[idx]) {
                            updated[idx] = {
                              ...updated[idx],
                              unloading_address: e.target.value,
                              unloading_city: e.target.value.split(',')[0] || e.target.value,
                            };
                            setRoutes(updated);
                          }
                        }}
                        className="w-full border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Защита от автозавершения через Салду */}
            <label className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 font-bold text-xs select-none">
              <input
                type="checkbox"
                checked={preventSaldaAutoFinish}
                onChange={(e) => setPreventSaldaAutoFinish(e.target.checked)}
                className="mt-0.5 rounded"
              />
              <div>
                <span>🔄 Составной маршрут через Салду (защита Wialon)</span>
                <span className="block text-[10px] font-normal text-amber-800">
                  Рейс не закроется при заезде на базу перед выгрузкой.
                </span>
              </div>
            </label>
          </div>

          {/* 3. КЛИЕНТЫ И ЗАКАЗЫ В РЕЙСЕ */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-1.5">
              <span className="text-xs font-black text-zinc-900 flex items-center gap-1">
                <span>💼</span>
                <span>Заказчики в рейсе ({clientOrders.length})</span>
              </span>
              <button
                type="button"
                onClick={handleAddClientOrder}
                className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-0.5"
              >
                + Клиент
              </button>
            </div>

            <div className="space-y-2">
              {clientOrders.map((co, idx) => (
                <div
                  key={co.id}
                  className="bg-white border border-zinc-200 rounded-xl p-2.5 space-y-1.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-zinc-700">
                    <span>{idx === 0 ? '👑 Основной заказ' : `📦 Догруз #${idx + 1}`}</span>
                    {clientOrders.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveClientOrder(idx)}
                        className="text-rose-600 text-[10px] font-bold"
                      >
                        ✕ Удалить
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 block mb-0.5">
                      Клиент:
                    </label>
                    <input
                      type="text"
                      value={co.client_name}
                      onChange={(e) =>
                        handleUpdateClientOrder(idx, { client_name: e.target.value })
                      }
                      placeholder="ООО Геостройиндустрия"
                      className="w-full border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 block mb-0.5">
                        Груз:
                      </label>
                      <input
                        type="text"
                        value={co.cargo_name}
                        onChange={(e) =>
                          handleUpdateClientOrder(idx, { cargo_name: e.target.value })
                        }
                        placeholder="Пробы керна"
                        className="w-full border border-zinc-200 rounded-lg px-2 py-1 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 block mb-0.5">
                        Ставка (₽):
                      </label>
                      <input
                        type="number"
                        value={co.price_without_vat}
                        onChange={(e) =>
                          handleUpdateClientOrder(idx, {
                            price_without_vat: Number(e.target.value) || '',
                          })
                        }
                        placeholder="40 000"
                        className="w-full border border-zinc-200 rounded-lg px-2 py-1 text-xs font-black text-indigo-700"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between p-2 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-black text-indigo-950">
              <span>Итого выручка:</span>
              <span>{totalRevenue.toLocaleString('ru-RU')} ₽</span>
            </div>
          </div>

          {/* 4. АВТОМОБИЛЬ, ВОДИТЕЛЬ И ЗП */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-zinc-50 border border-zinc-200 rounded-2xl p-3">
            <div>
              <label className="text-[10px] font-bold text-zinc-500 block mb-0.5">
                Автомобиль:
              </label>
              <select
                value={form.assigned_vehicle_id}
                onChange={(e) => setForm({ ...form, assigned_vehicle_id: e.target.value })}
                className="w-full border border-zinc-200 rounded-lg p-1.5 text-xs font-bold bg-white"
              >
                <option value="">-- Авто --</option>
                {vehicles.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {v.short_name || v.brand_name || 'Авто'} ({v.reg_number})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 block mb-0.5">Водитель:</label>
              <select
                value={form.assigned_driver_id}
                onChange={(e) => setForm({ ...form, assigned_driver_id: e.target.value })}
                className="w-full border border-zinc-200 rounded-lg p-1.5 text-xs font-bold bg-white"
              >
                <option value="">-- Водитель --</option>
                {drivers.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-[10px] font-bold text-zinc-500">ЗП водителя:</label>
                <button
                  type="button"
                  onClick={() => setForm((f: any) => ({ ...f, driver_pay: 7900 }))}
                  className="text-[9px] text-emerald-700 font-bold"
                >
                  ⚡ 7 900 ₽
                </button>
              </div>
              <input
                type="number"
                value={form.driver_pay}
                onChange={(e) => setForm({ ...form, driver_pay: Number(e.target.value) || 0 })}
                className="w-full border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs font-black text-emerald-700 bg-white"
              />
            </div>
          </div>
        </div>

        {/* Кнопки действий (Sticky Footer - ВСЕГДА зафиксированы внизу, не теряются) */}
        <div className="p-3 bg-white border-t border-zinc-200 flex items-center gap-2 shrink-0 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] shadow-lg">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 bg-zinc-100 rounded-xl text-zinc-700 font-bold text-xs uppercase active:scale-95 transition"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase shadow-md active:scale-95 transition disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : 'Сохранить рейс'}
          </button>
          {trip?.lifecycle_status === 'draft' && (
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="py-3 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase shadow-md active:scale-95 transition disabled:opacity-50 flex items-center gap-1 shrink-0"
              title="Сохранить изменения и сразу одобрить рейс"
            >
              <span>✓</span>
              <span>Одобрить</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
