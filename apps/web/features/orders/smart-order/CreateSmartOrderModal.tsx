'use client';

import React, { useEffect, useState } from 'react';
import { LOCATION_PRESETS } from '../constants';
import { OrderCounterpartySelect } from '../OrderCounterpartySelect';
import type {
  ClientOrderPart,
  OrderCounterpartyOption,
  OrderDriverOption,
  OrderItem,
  OrderPresetOption,
  OrderVehicleOption,
  RouteStop,
  SmartOrderFormState,
} from '../types';
import { formatTravelTime, getEstimatedRouteDistance, isShaytankaMaminskoeRoute } from '../utils';
import { SmartOrderCargoSection } from './SmartOrderCargoSection';
import {
  initClientOrdersFromOrder,
  initRoutesFromOrder,
  initSmartOrderForm,
} from './smartOrderInitializers';
import { buildClientPresetPatch } from './smartOrderPresets';
import { SmartOrderRouteSection } from './SmartOrderRouteSection';

export function CreateSmartOrderModal({
  initialOrder,
  presets,
  counterparties,
  vehicles,
  drivers,
  onOpenDriverModal,
  onClose,
  onSuccess,
}: {
  initialOrder?: OrderItem | null;
  presets: OrderPresetOption[];
  loadingPoints?: unknown[];
  counterparties: OrderCounterpartyOption[];
  vehicles: OrderVehicleOption[];
  drivers: OrderDriverOption[];
  onOpenDriverModal?: (driverId?: string) => void;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEditing = Boolean(initialOrder);

  const [selectedClientType, setSelectedClientType] = useState<'vsmpo' | 'geostroy' | 'manual'>(
    'manual',
  );
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isMultiStop, setIsMultiStop] = useState<boolean>(
    Boolean(
      (initialOrder?.routes_json && initialOrder.routes_json.length > 1) ||
      (initialOrder?.raw_parser_payload?.routes &&
        initialOrder.raw_parser_payload.routes.length > 1),
    ),
  );
  const [routes, setRoutes] = useState<RouteStop[]>(() => initRoutesFromOrder(initialOrder));
  const [preventSaldaAutoFinish, setPreventSaldaAutoFinish] = useState<boolean>(
    Boolean(
      initialOrder?.prevent_salda_auto_finish ||
      initialOrder?.raw_parser_payload?.prevent_salda_auto_finish,
    ),
  );
  const [clientOrders, setClientOrders] = useState<ClientOrderPart[]>(() =>
    initClientOrdersFromOrder(initialOrder),
  );
  const [form, setForm] = useState<SmartOrderFormState>(() => initSmartOrderForm(initialOrder));
  const [nextTripNumber, setNextTripNumber] = useState<number | null>(null);

  useEffect(() => {
    if (!isEditing) {
      fetch('/api/orders/next-number')
        .then((r) => r.json())
        .then((data) => {
          if (data?.nextNumber) {
            setNextTripNumber(data.nextNumber);
            setForm((prev) => {
              if (!prev.base_doc_number || prev.base_doc_number === '1') {
                return { ...prev, base_doc_number: String(data.nextNumber) };
              }
              return prev;
            });
          }
        })
        .catch((err) => console.warn('Ошибка загрузки следующего номера рейса:', err));
    }
  }, [isEditing]);

  const handleAddClientOrder = () => {
    if (clientOrders.length >= 6) {
      alert('Максимальное количество заказов/клиентов в одном рейсе — 6');
      return;
    }
    setClientOrders((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        client_id: '',
        client_name: '',
        client_inn: '',
        base_doc_number: '',
        cargo_name: '',
        weight_gross_kg: '',
        price_without_vat: '',
        forwarder_id: '',
        forwarder_name: '— (Прямой заказчик)',
        payment_method: 'bank_invoice',
        payment_terms: 'Безналичный расчет (Дебиторская задолженность)',
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
      updated[idx] = { ...updated[idx]!, ...patch };
      if (idx === 0) {
        setForm((f) => ({
          ...f,
          ...(patch.client_id !== undefined ? { client_id: patch.client_id } : {}),
          ...(patch.client_name !== undefined ? { client_name: patch.client_name } : {}),
          ...(patch.client_inn !== undefined ? { client_inn: patch.client_inn } : {}),
          ...(patch.base_doc_number !== undefined
            ? { base_doc_number: patch.base_doc_number }
            : {}),
          ...(patch.cargo_name !== undefined ? { cargo_name: patch.cargo_name } : {}),
        }));
      }
      return updated;
    });
  };

  const totalClientsRevenue = clientOrders.reduce(
    (sum, co) => sum + (Number(co.price_without_vat) || 0),
    0,
  );
  const totalClientsWeight = clientOrders.reduce(
    (sum, co) => sum + (Number(co.weight_gross_kg) || 0),
    0,
  );

  const selectClientPreset = (type: 'vsmpo' | 'geostroy' | 'manual') => {
    setSelectedClientType(type);
    const patch = buildClientPresetPatch(type, presets, counterparties);
    if (patch.clientOrders) setClientOrders(patch.clientOrders);
    setForm((prev) => ({ ...prev, ...patch.formPatch }));
    setRoutes(patch.routes);
    setStatusMessage(patch.statusMessage);
  };

  const handleUpdateRouteStop = (idx: number, patch: Partial<RouteStop>) => {
    const updated = [...routes];
    const current = updated[idx];
    if (current) {
      updated[idx] = { ...current, ...patch };
      setRoutes(updated);
    }
  };

  const handleAddRouteStop = () => {
    if (routes.length >= 6) {
      alert('Максимальное количество сегментов маршрута для Путевого листа — 6');
      return;
    }
    const prevStop = routes[routes.length - 1];
    setRoutes([
      ...routes,
      {
        id: String(Date.now()),
        loading_city: prevStop?.unloading_city || form.loading_city || '',
        loading_address: prevStop?.unloading_address || form.loading_address || '',
        loading_org: form.loading_org_name || '',
        unloading_city: '',
        unloading_address: '',
        unloading_org: form.client_name || '',
        cargo_name: form.cargo_name || '',
        weight_kg: 0,
      },
    ]);
    setIsMultiStop(true);
  };

  const handleRemoveRouteStop = (idx: number) => {
    if (routes.length <= 1) return;
    const updated = routes.filter((_, i) => i !== idx);
    setRoutes(updated);
    if (updated.length <= 1) setIsMultiStop(false);
  };

  const applyLocationPreset = (
    field: 'loading' | 'unloading',
    presetKey: string,
    stopIdx?: number,
  ) => {
    const loc = LOCATION_PRESETS.find((l) => l.key === presetKey);
    if (!loc) return;

    if (stopIdx !== undefined && isMultiStop) {
      handleUpdateRouteStop(stopIdx, {
        ...(field === 'loading'
          ? {
              loading_city: loc.city,
              loading_address: loc.address,
              ...(loc.loadingOrg ? { loading_org: loc.loadingOrg } : {}),
            }
          : { unloading_city: loc.city, unloading_address: loc.address }),
      });
    } else {
      setForm((prev) => {
        const updated: SmartOrderFormState = {
          ...prev,
          ...(field === 'loading'
            ? {
                loading_city: loc.city,
                loading_address: loc.address,
                ...(loc.loadingOrg ? { loading_org_name: loc.loadingOrg } : {}),
                ...(loc.cargoName &&
                (!prev.cargo_name || prev.cargo_name.includes('Выезд без заявки'))
                  ? { cargo_name: loc.cargoName }
                  : {}),
              }
            : { unloading_city: loc.city, unloading_address: loc.address }),
        };
        const loadCity = field === 'loading' ? loc.city : updated.loading_city;
        const unloadCity = field === 'unloading' ? loc.city : updated.unloading_city;
        if (isShaytankaMaminskoeRoute(loadCity, unloadCity)) {
          updated.price_without_vat = 40000;
          setStatusMessage('⭐ Применен фиксированный тариф Шайтанка ↔ Маминское: 40 000 ₽');
        }
        return updated;
      });
    }

    const currentLoad = field === 'loading' ? loc.city : form.loading_city;
    const currentUnload = field === 'unloading' ? loc.city : form.unloading_city;
    if (
      currentLoad?.toLowerCase().includes('шайтан') &&
      !currentUnload?.toLowerCase().includes('салда')
    ) {
      setPreventSaldaAutoFinish(true);
      setStatusMessage('🛡️ Защита от закрытия в Салде активна (погрузка: Шайтанка).');
    } else if (
      field === 'unloading' &&
      loc.city === 'Верхняя Салда' &&
      currentLoad === 'Верхняя Салда'
    ) {
      setPreventSaldaAutoFinish(false);
    }
  };

  const handlePdfUpload = async (file: File) => {
    setIsParsing(true);
    setStatusMessage(null);
    try {
      const data = new FormData();
      data.append('file', file);
      const res = await fetch('/api/orders/parse-doc', { method: 'POST', body: data });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Ошибка разбора');

      const p = json.parsed;
      setForm((prev) => ({
        ...prev,
        base_doc_number: p.order_number || prev.base_doc_number,
        base_doc_date: p.order_date || prev.base_doc_date,
        cargo_name: p.cargo_name || prev.cargo_name,
        weight_gross_kg: p.weight_gross_kg !== undefined ? p.weight_gross_kg : prev.weight_gross_kg,
        price_without_vat:
          p.price_without_vat !== undefined ? p.price_without_vat : prev.price_without_vat,
        loading_city: p.loading_address?.city || prev.loading_city,
        loading_address: p.loading_address?.raw || prev.loading_address,
        unloading_city: p.unloading_address?.city || prev.unloading_city,
        unloading_address: p.unloading_address?.raw || prev.unloading_address,
        client_id: p.matched_client_id || prev.client_id,
        client_name: p.client_name || prev.client_name,
        forwarder_id: p.matched_forwarder_id || prev.forwarder_id,
        forwarder_name: p.forwarder_name || prev.forwarder_name,
        loading_org_name: p.loading_org_name || prev.loading_org_name,
        planned_loading_at: p.planned_loading_from?.slice(0, 16) || prev.planned_loading_at,
        planned_delivery_at: p.planned_delivery_from?.slice(0, 16) || prev.planned_delivery_at,
      }));

      setRoutes((prevRoutes) => {
        if (prevRoutes.length <= 1) {
          return [
            {
              id: prevRoutes[0]?.id || 'stop-1',
              loading_city: p.loading_address?.city || prevRoutes[0]?.loading_city || '',
              loading_address: p.loading_address?.raw || prevRoutes[0]?.loading_address || '',
              loading_org: p.loading_org_name || prevRoutes[0]?.loading_org || '',
              unloading_city: p.unloading_address?.city || prevRoutes[0]?.unloading_city || '',
              unloading_address: p.unloading_address?.raw || prevRoutes[0]?.unloading_address || '',
              unloading_org: p.client_name || prevRoutes[0]?.unloading_org || '',
              cargo_name: p.cargo_name || prevRoutes[0]?.cargo_name || '',
              weight_kg:
                p.weight_gross_kg !== undefined ? p.weight_gross_kg : prevRoutes[0]?.weight_kg || 0,
            },
          ];
        }
        return prevRoutes;
      });

      const docLabel = p.order_number?.includes('/')
        ? `Заявка № ${p.order_number}`
        : `Документ № ${p.order_number || ''}`;
      const summaryParts = [
        p.order_number ? docLabel : '',
        p.cargo_name || '',
        p.weight_gross_kg ? `${p.weight_gross_kg} кг` : '',
        p.price_without_vat ? `${Number(p.price_without_vat).toLocaleString('ru-RU')} ₽` : '',
      ].filter(Boolean);
      setStatusMessage(`✨ PDF распознан: ${summaryParts.join(' · ')}`);
    } catch (err: unknown) {
      alert(`Ошибка: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      let finalClientId = form.client_id;
      if (!finalClientId && form.client_name) {
        const createCpRes = await fetch('/api/counterparties', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.client_name,
            inn: form.client_inn || null,
            legal_address: form.loading_address || null,
            type: 'client',
            is_regular: true,
          }),
        });
        const createdCpJson = await createCpRes.json();
        const foundId =
          createdCpJson?.id || createdCpJson?.counterparty?.id || createdCpJson?.existing_id;
        if (foundId) finalClientId = foundId;
      }

      const primaryLoadCity = isMultiStop
        ? routes[0]?.loading_city || form.loading_city
        : form.loading_city;
      const primaryLoadAddress = isMultiStop
        ? routes[0]?.loading_address || form.loading_address
        : form.loading_address;
      const primaryUnloadCity = isMultiStop
        ? routes[routes.length - 1]?.unloading_city || form.unloading_city
        : form.unloading_city;
      const primaryUnloadAddress = isMultiStop
        ? routes[routes.length - 1]?.unloading_address || form.unloading_address
        : form.unloading_address;
      const totalWeightKg = isMultiStop
        ? routes.reduce((acc, r) => acc + (Number(r.weight_kg) || 0), 0)
        : Number(form.weight_gross_kg);

      const payload = {
        base_doc_number: form.base_doc_number,
        base_doc_date: form.base_doc_date,
        client_id: finalClientId || null,
        forwarder_id: form.forwarder_id || null,
        preset_id: form.preset_id || null,
        loading_point_id: form.loading_point_id || null,
        cargo_name: form.cargo_name || 'Груз',
        weight_gross_kg: totalClientsWeight > 0 ? totalClientsWeight : totalWeightKg || 0,
        weight_net_kg: totalClientsWeight > 0 ? totalClientsWeight : totalWeightKg || 0,
        places_count: Number(form.places_count) || 1,
        packaging_type: form.packaging_type || 'паллеты',
        price_without_vat:
          totalClientsRevenue > 0 ? totalClientsRevenue : Number(form.price_without_vat) || 0,
        client_orders: clientOrders.map((co, idx) =>
          idx === 0 && !co.client_id
            ? {
                ...co,
                client_id: finalClientId || '',
                client_name: form.client_name || co.client_name,
                client_inn: form.client_inn || co.client_inn,
              }
            : co,
        ),
        payment_terms:
          form.payment_method === 'cash'
            ? 'Оплата наличными водителю (В кассу)'
            : 'Безналичный расчет (Дебиторская задолженность)',
        loading_address_json: { city: primaryLoadCity, raw: primaryLoadAddress },
        unloading_address_json: { city: primaryUnloadCity, raw: primaryUnloadAddress },
        loading_org_name: form.loading_org_name,
        loading_contact_fio: form.loading_contact_fio,
        planned_loading_at: form.planned_loading_at ? `${form.planned_loading_at}:00+05:00` : null,
        planned_delivery_at: form.planned_delivery_at
          ? `${form.planned_delivery_at}:00+05:00`
          : null,
        assigned_vehicle_id: form.assigned_vehicle_id || null,
        assigned_driver_id: form.assigned_driver_id || null,
        ...(isEditing && initialOrder?.status ? { status: initialOrder.status } : {}),
        routes_json: isMultiStop ? routes : [],
        prevent_salda_auto_finish: Boolean(preventSaldaAutoFinish),
        salda_transit_count: initialOrder?.salda_transit_count || 0,
      };

      const res = await fetch(isEditing ? `/api/orders/${initialOrder!.id}` : '/api/orders', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка сохранения заявки');
      }
      alert(
        isEditing
          ? `✅ Заявка № ${form.base_doc_number} успешно обновлена!`
          : `✅ Заявка № ${form.base_doc_number} успешно создана!`,
      );
      onSuccess();
    } catch (err: unknown) {
      alert(`Ошибка: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const effectiveLoadCity = isMultiStop
    ? routes[0]?.loading_city || form.loading_city
    : form.loading_city;
  const effectiveUnloadCity = isMultiStop
    ? routes[routes.length - 1]?.unloading_city || form.unloading_city
    : form.unloading_city;
  const routeDistKm = getEstimatedRouteDistance(effectiveLoadCity, effectiveUnloadCity);
  const routeTimeStr = routeDistKm ? formatTravelTime(routeDistKm) : null;
  const isCurrentShaytankaMaminskoe = isShaytankaMaminskoeRoute(
    effectiveLoadCity,
    effectiveUnloadCity,
  );
  const minBillingPrice = routeDistKm ? routeDistKm * 50 : null;

  const handleAutoSetDeliveryTime = () => {
    if (!routeDistKm || !form.planned_loading_at) return;
    const loadDate = new Date(form.planned_loading_at);
    if (isNaN(loadDate.getTime())) return;
    const deliveryDate = new Date(loadDate.getTime() + (routeDistKm / 70 + 1) * 3600 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const formatted = `${deliveryDate.getFullYear()}-${pad(deliveryDate.getMonth() + 1)}-${pad(
      deliveryDate.getDate(),
    )}T${pad(deliveryDate.getHours())}:${pad(deliveryDate.getMinutes())}`;
    setForm((prev) => ({ ...prev, planned_delivery_at: formatted }));
    setStatusMessage(
      `⏱️ Расчетное время доставки: +${formatTravelTime(routeDistKm)} пути (+1ч на погрузку)`,
    );
  };

  const hasEmptyFields =
    !form.loading_address ||
    !form.unloading_address ||
    !form.cargo_name ||
    !form.price_without_vat ||
    !form.client_name;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-5 max-w-3xl w-full shadow-2xl border border-slate-200 space-y-4 my-8">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              {isEditing
                ? `Редактирование заявки № ${form.base_doc_number}`
                : 'Новая заявка на перевозку'}
            </h3>
            <p className="text-xs text-slate-400">
              Автозаполнение постоянных клиентов (ВСМПО / Геостройиндустрия) или загрузка PDF
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-base cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Быстрые шаблоны */}
        <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          {(
            [
              { id: 'manual', label: '📝 Чистая заявка' },
              { id: 'vsmpo', label: '🏢 Шаблон ВСМПО (Парфенов)' },
              { id: 'geostroy', label: '🏗️ Шаблон Геострой' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => selectClientPreset(t.id)}
              className={`py-1.5 rounded-lg transition cursor-pointer ${
                selectedClientType === t.id
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Drag and Drop PDF */}
        <div className="border border-dashed border-indigo-200 bg-indigo-50/40 rounded-xl p-2.5 text-center flex items-center justify-between gap-3 text-xs">
          <div className="text-left">
            <span className="font-bold text-slate-900 block">
              📄 Загрузить скан / PDF Поручения экспедитору
            </span>
            <span className="text-[11px] text-slate-500">
              Авто-извлечение ИНН, дат, груза, веса и ставки в 1 клик
            </span>
          </div>
          <label className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold cursor-pointer transition shadow-2xs">
            <span>{isParsing ? 'Распознавание...' : 'Загрузить PDF'}</span>
            <input
              type="file"
              accept=".pdf"
              disabled={isParsing}
              onChange={(e) => {
                if (e.target.files?.[0]) handlePdfUpload(e.target.files[0]);
              }}
              className="hidden"
            />
          </label>
        </div>

        {statusMessage && (
          <div className="p-2 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold flex items-center justify-between">
            <span>{statusMessage}</span>
            <span className="text-emerald-600 text-[10px]">Готово</span>
          </div>
        )}

        {hasEmptyFields && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <span>⚠️</span>
              <span>Требуется заполнить поля рейса: маршрут, груз, ставку и заказчика</span>
            </span>
            <span className="text-[10px] bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
              Ожидает заполнения
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {/* Секция 1: Реквизиты */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="font-bold text-slate-700">№ Заявки / Рейса</label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const cur = form.base_doc_number || '';
                      const year = new Date().getFullYear();
                      if (!cur.includes(String(year))) {
                        setForm((prev) => ({
                          ...prev,
                          base_doc_number: cur
                            ? `${cur.replace(/[/\\]\d+/, '')}/${year}`
                            : `/${year}`,
                        }));
                      }
                    }}
                    className="text-[10px] text-purple-700 hover:text-purple-900 font-bold cursor-pointer transition hover:underline"
                    title="Формат Электронного поручения (ЭПЭ) для ВСМПО-АВИСМА"
                  >
                    +ЭПЭ \{new Date().getFullYear()}
                  </button>
                  {nextTripNumber && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, base_doc_number: String(nextTripNumber) }))
                      }
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer transition hover:underline"
                      title="Привязать номер заявки к следующему рейсу по очереди"
                    >
                      #{nextTripNumber}
                    </button>
                  )}
                </div>
              </div>
              <input
                type="text"
                required
                value={form.base_doc_number}
                onChange={(e) => setForm({ ...form, base_doc_number: e.target.value })}
                placeholder={
                  selectedClientType === 'vsmpo'
                    ? `794/${new Date().getFullYear()}`
                    : nextTripNumber
                      ? String(nextTripNumber)
                      : 'Напр. 987'
                }
                className="w-full p-1.5 border border-slate-300 rounded bg-slate-50 font-bold"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-0.5">Дата документа</label>
              <input
                type="date"
                required
                value={form.base_doc_date}
                onChange={(e) => setForm({ ...form, base_doc_date: e.target.value })}
                className="w-full p-1.5 border border-slate-300 rounded bg-slate-50"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-0.5">Заказчик (Клиент)</label>
              <OrderCounterpartySelect
                inputValue={form.client_name}
                counterparties={counterparties}
                onChange={(cp, name) => {
                  setForm((f) => ({
                    ...f,
                    client_id: cp?.id || '',
                    client_name: name,
                    client_inn: cp?.inn || f.client_inn,
                  }));
                  handleUpdateClientOrder(0, {
                    client_id: cp?.id || '',
                    client_name: name,
                    client_inn: cp?.inn || '',
                  });
                }}
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-0.5">Экспедитор</label>
              <input
                type="text"
                readOnly
                value={form.forwarder_name}
                className="w-full p-1.5 border border-slate-200 rounded bg-slate-100 text-slate-600 font-medium"
              />
            </div>
          </div>

          <SmartOrderRouteSection
            form={form}
            setForm={setForm}
            routes={routes}
            isMultiStop={isMultiStop}
            preventSaldaAutoFinish={preventSaldaAutoFinish}
            setPreventSaldaAutoFinish={setPreventSaldaAutoFinish}
            routeDistKm={routeDistKm}
            routeTimeStr={routeTimeStr}
            onAddRouteStop={handleAddRouteStop}
            onRemoveRouteStop={handleRemoveRouteStop}
            onUpdateRouteStop={handleUpdateRouteStop}
            onApplyLocationPreset={applyLocationPreset}
            onAutoSetDeliveryTime={handleAutoSetDeliveryTime}
          />

          <SmartOrderCargoSection
            form={form}
            setForm={setForm}
            clientOrders={clientOrders}
            counterparties={counterparties}
            vehicles={vehicles}
            drivers={drivers}
            totalClientsRevenue={totalClientsRevenue}
            totalClientsWeight={totalClientsWeight}
            isCurrentShaytankaMaminskoe={isCurrentShaytankaMaminskoe}
            minBillingPrice={minBillingPrice}
            onAddClientOrder={handleAddClientOrder}
            onRemoveClientOrder={handleRemoveClientOrder}
            onUpdateClientOrder={handleUpdateClientOrder}
            onOpenDriverModal={onOpenDriverModal}
          />

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
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold shadow-xs cursor-pointer transition active:scale-95"
            >
              {isSubmitting
                ? 'Сохранение...'
                : isEditing
                  ? 'Сохранить изменения'
                  : 'Создать заявку'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
