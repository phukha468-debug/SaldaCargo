/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { RouteStop, ClientOrderPart, OrderItem } from './OrdersPipelineView';

export interface SmartOrderModalProps {
  initialOrder?: OrderItem | null;
  initialTrip?: any | null;
  presets?: any[];
  loadingPoints?: any[];
  counterparties?: any[];
  vehicles?: any[];
  drivers?: any[];
  onOpenDriverModal?: (driverId?: string) => void;
  onClose: () => void;
  onSuccess: () => void;
}

// ── Быстрый селект контрагента с умным автодополнением ──
function OrderCounterpartySelect({
  inputValue,
  counterparties = [],
  onChange,
}: {
  inputValue: string;
  counterparties: any[];
  onChange: (cp: any | null, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(inputValue || '');

  useEffect(() => {
    setQuery(inputValue || '');
  }, [inputValue]);

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/["'«»]/g, '')
      .replace(/^(ооо|зао|пао|ао|ип)\s+/i, '')
      .trim();

  const filtered = (counterparties || []).filter((c) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase().trim();
    const qNorm = normalize(query);
    const n = (c.name || '').toLowerCase();
    const nNorm = normalize(c.name || '');
    const inn = c.inn || '';
    return n.includes(q) || (qNorm.length > 2 && nNorm.includes(qNorm)) || inn.includes(q);
  });

  const exactMatch = (counterparties || []).some(
    (c) =>
      c.name?.toLowerCase().trim() === query.toLowerCase().trim() ||
      (normalize(c.name || '') === normalize(query) && normalize(query).length > 2),
  );

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <input
          type="text"
          className={`w-full pl-6 pr-6 py-1.5 border rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
            !query.trim()
              ? 'border-amber-400 bg-amber-50/50 text-slate-800 placeholder:text-amber-700/60'
              : 'border-slate-300 bg-white text-slate-800 placeholder:text-slate-400'
          }`}
          value={query}
          placeholder="⚠️ Выберите контрагента из списка..."
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            setOpen(true);
            const valTrim = val.trim();
            if (!valTrim) {
              onChange(null, '');
            } else {
              const valNorm = normalize(valTrim);
              const matched = (counterparties || []).find((c) => {
                if (!c?.name) return false;
                const nNorm = normalize(c.name);
                return (
                  c.name.toLowerCase().trim() === valTrim.toLowerCase() ||
                  (valNorm.length > 2 && nNorm === valNorm)
                );
              });
              onChange(matched || null, val);
            }
          }}
        />
        <span className="absolute left-2 text-slate-400 pointer-events-none text-xs">🔍</span>
        {query && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery('');
              onChange(null, '');
            }}
            className="absolute right-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 text-[10px] font-bold cursor-pointer transition"
          >
            ×
          </button>
        )}
      </div>

      {open && (filtered.length > 0 || (query.trim() && !exactMatch)) && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl py-1 text-xs"
        >
          {filtered.slice(0, 40).map((cp) => (
            <button
              key={cp.id}
              type="button"
              onClick={() => {
                setQuery(cp.name);
                setOpen(false);
                onChange(cp, cp.name);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 hover:text-indigo-900 flex items-center justify-between transition cursor-pointer border-b border-slate-50 last:border-0"
            >
              <span className="font-semibold text-slate-800 truncate pr-2">{cp.name}</span>
              {cp.inn && (
                <span className="shrink-0 text-[10px] font-mono text-slate-400 bg-slate-100 px-1 py-0.2 rounded">
                  ИНН {cp.inn}
                </span>
              )}
            </button>
          ))}

          {query.trim() && !exactMatch && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onChange(null, query.trim());
              }}
              className="w-full text-left px-3 py-2 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-700 font-bold flex items-center gap-1.5 transition cursor-pointer border-t border-indigo-100"
            >
              <span>➕ Использовать:</span>
              <span className="italic truncate font-semibold">«{query.trim()}»</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function SmartOrderModal({
  initialOrder,
  initialTrip,
  presets = [],
  counterparties = [],
  vehicles = [],
  drivers = [],
  onOpenDriverModal,
  onClose,
  onSuccess,
}: SmartOrderModalProps) {
  const isEditing = Boolean(initialOrder || initialTrip);

  const safeVehicles = Array.isArray(vehicles)
    ? vehicles
    : Array.isArray((vehicles as any)?.assets)
      ? (vehicles as any).assets
      : [];
  const safeDrivers = Array.isArray(drivers) ? drivers : [];
  const safeCounterparties = Array.isArray(counterparties) ? counterparties : [];

  const [selectedClientType, setSelectedClientType] = useState<'vsmpo' | 'geostroy' | 'manual'>(
    'manual',
  );
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Мульти-стоп маршрут (до 6 точек)
  const [isMultiStop, setIsMultiStop] = useState<boolean>(() => {
    if (initialOrder?.routes_json && initialOrder.routes_json.length > 1) return true;
    if (
      initialOrder?.raw_parser_payload?.routes &&
      initialOrder.raw_parser_payload.routes.length > 1
    )
      return true;
    return false;
  });

  const [routes, setRoutes] = useState<RouteStop[]>(() => {
    const existing = initialOrder?.routes_json || initialOrder?.raw_parser_payload?.routes;
    if (existing && Array.isArray(existing) && existing.length > 0) {
      return existing.map((r: any, idx: number) => ({
        id: String(idx + 1),
        loading_city: r.loading_city || r.loadingCity || '',
        loading_address: r.loading_address || r.loadingAddress || '',
        loading_org: r.loading_org || r.clientName || '',
        unloading_city: r.unloading_city || r.unloadingCity || '',
        unloading_address: r.unloading_address || r.unloadingAddress || '',
        unloading_org: r.unloading_org || '',
        cargo_name: r.cargo_name || r.cargoName || '',
        weight_kg: r.weight_kg ? Number(r.weight_kg) : 0,
      }));
    }

    // Если передан рейс
    const rawNote = (initialTrip?.driver_note || '') + ' ' + (initialTrip?.admin_note || '');
    const isShaytanka =
      rawNote.toLowerCase().includes('шайтан') ||
      initialOrder?.loading_address_json?.raw?.includes('Шайтан');
    const isMaminskoe =
      rawNote.toLowerCase().includes('мамин') ||
      initialOrder?.unloading_address_json?.raw?.includes('Мамин');

    return [
      {
        id: '1',
        loading_city: isShaytanka
          ? 'Шайтанка'
          : initialOrder?.loading_address_json?.city || 'Верхняя Салда',
        loading_address: isShaytanka
          ? 'пос. Шайтанка, Свердловская обл.'
          : initialOrder?.loading_address_json?.raw || '',
        loading_org: isShaytanka ? 'ООО "Геостройиндустрия"' : initialOrder?.loading_org_name || '',
        unloading_city: isMaminskoe
          ? 'Маминское'
          : initialOrder?.unloading_address_json?.city || '',
        unloading_address: isMaminskoe
          ? 'село Маминское, склад 2'
          : initialOrder?.unloading_address_json?.raw || '',
        unloading_org: isMaminskoe ? 'ООО "Геостройиндустрия"' : initialOrder?.client?.name || '',
        cargo_name: isShaytanka ? 'Пробы керна' : initialOrder?.cargo_name || 'Груз',
        weight_kg: initialOrder?.weight_gross_kg || 0,
      },
    ];
  });

  // Защита от автозавершения через Салду
  const [preventSaldaAutoFinish, setPreventSaldaAutoFinish] = useState<boolean>(() => {
    if (initialOrder?.prevent_salda_auto_finish) return true;
    if (initialOrder?.raw_parser_payload?.prevent_salda_auto_finish) return true;
    const note = (initialTrip?.driver_note || '') + ' ' + (initialTrip?.admin_note || '');
    if (note.toLowerCase().includes('шайтан') || note.toLowerCase().includes('мамин')) return true;
    return false;
  });

  // Мульти-заказы клиентов в одном рейсе (до 6 клиентов)
  const [clientOrders, setClientOrders] = useState<ClientOrderPart[]>(() => {
    const existing = initialOrder?.client_orders || initialOrder?.raw_parser_payload?.client_orders;
    if (Array.isArray(existing) && existing.length > 0) {
      return existing.map((co: any, idx: number) => ({
        id: co.id || String(idx + 1),
        client_id: co.client_id || '',
        client_name: co.client_name || '',
        client_inn: co.client_inn || '',
        base_doc_number: co.base_doc_number || '',
        cargo_name: co.cargo_name || '',
        weight_gross_kg: co.weight_gross_kg !== undefined ? co.weight_gross_kg : '',
        price_without_vat: co.price_without_vat !== undefined ? co.price_without_vat : '',
        forwarder_id: co.forwarder_id || '',
        forwarder_name: co.forwarder_name || '— (Прямой заказчик)',
        payment_method: co.payment_method || 'bank_invoice',
        payment_terms: co.payment_terms || 'Безналичный расчет (Дебиторская задолженность)',
      }));
    }

    if (
      initialTrip &&
      Array.isArray(initialTrip.trip_orders) &&
      initialTrip.trip_orders.length > 0
    ) {
      const activeTripOrders = initialTrip.trip_orders.filter(
        (to: any) => to.lifecycle_status !== 'cancelled',
      );
      if (activeTripOrders.length > 0) {
        return activeTripOrders.map((to: any, idx: number) => ({
          id: to.id || String(idx + 1),
          client_id: to.counterparty_id || '',
          client_name: to.counterparty?.name || '',
          client_inn: to.counterparty?.inn || '',
          base_doc_number: to.invoice_number || String(initialTrip.trip_number || ''),
          cargo_name: to.description || '',
          weight_gross_kg: '',
          price_without_vat: to.amount ? Number(to.amount) : '',
          forwarder_id: '',
          forwarder_name: '— (Прямой заказчик)',
          payment_method: to.payment_method || 'bank_invoice',
          payment_terms: 'Безналичный расчет (Дебиторская задолженность)',
        }));
      }
    }

    if (initialOrder) {
      return [
        {
          id: '1',
          client_id: initialOrder.client?.id || '',
          client_name: initialOrder.client?.name || '',
          client_inn: initialOrder.client?.inn || '',
          base_doc_number: initialOrder.base_doc_number || String(initialOrder.order_number || ''),
          cargo_name: initialOrder.cargo_name || '',
          weight_gross_kg: initialOrder.weight_gross_kg || '',
          price_without_vat: initialOrder.price_without_vat || '',
          forwarder_id: initialOrder.forwarder?.id || '',
          forwarder_name: initialOrder.forwarder?.name || '— (Прямой заказчик)',
          payment_method: (initialOrder.payment_terms?.includes('Наличные')
            ? 'cash'
            : 'bank_invoice') as any,
          payment_terms:
            initialOrder.payment_terms || 'Безналичный расчет (Дебиторская задолженность)',
        },
      ];
    }

    return [
      {
        id: '1',
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
    ];
  });

  const handleAddClientOrder = () => {
    if (clientOrders.length >= 6) {
      alert('Максимальное количество заказов/клиентов в одном рейсе — 6');
      return;
    }
    const newPart: ClientOrderPart = {
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
    };
    setClientOrders((prev) => [...prev, newPart]);
  };

  const handleRemoveClientOrder = (idx: number) => {
    if (clientOrders.length <= 1) return;
    setClientOrders((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateClientOrder = (idx: number, patch: Partial<ClientOrderPart>) => {
    setClientOrders((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], ...patch } as ClientOrderPart;
      if (idx === 0) {
        setForm((f: any) => ({
          ...f,
          ...(patch.client_id !== undefined ? { client_id: patch.client_id } : {}),
          ...(patch.client_name !== undefined ? { client_name: patch.client_name } : {}),
          ...(patch.client_inn !== undefined ? { client_inn: patch.client_inn } : {}),
          ...(patch.base_doc_number !== undefined
            ? { base_doc_number: patch.base_doc_number }
            : {}),
          ...(patch.cargo_name !== undefined ? { cargo_name: patch.cargo_name } : {}),
          ...(patch.price_without_vat !== undefined
            ? { price_without_vat: patch.price_without_vat }
            : {}),
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

  // Форма заявки
  const [form, setForm] = useState<any>(() => {
    const today = new Date().toISOString().slice(0, 10);
    const primaryCp = initialOrder?.client || initialTrip?.trip_orders?.[0]?.counterparty;
    const primaryOrder = initialTrip?.trip_orders?.[0];

    const docNum =
      initialOrder?.base_doc_number ||
      (initialTrip?.trip_number ? String(initialTrip.trip_number) : '') ||
      (initialOrder?.order_number ? String(initialOrder.order_number) : '');

    return {
      base_doc_number: docNum,
      base_doc_date:
        initialOrder?.base_doc_date ||
        (initialTrip?.started_at ? initialTrip.started_at.slice(0, 10) : today),
      preset_id: (initialOrder as any)?.preset_id || '',
      loading_point_id: (initialOrder as any)?.loading_point_id || '',

      client_id: primaryCp?.id || (initialOrder as any)?.client_id || '',
      client_name: primaryCp?.name || initialOrder?.client?.name || '',
      client_inn: primaryCp?.inn || initialOrder?.client?.inn || '',

      forwarder_id: initialOrder?.forwarder?.id || '',
      forwarder_name: initialOrder?.forwarder?.name || '— (Прямой заказчик)',

      loading_address:
        routes[0]?.loading_address || initialOrder?.loading_address_json?.raw || 'пос. Шайтанка',
      loading_city:
        routes[0]?.loading_city || initialOrder?.loading_address_json?.city || 'Шайтанка',
      loading_org_name: routes[0]?.loading_org || initialOrder?.loading_org_name || '',

      unloading_address:
        routes[routes.length - 1]?.unloading_address ||
        initialOrder?.unloading_address_json?.raw ||
        'село Маминское, склад 2',
      unloading_city:
        routes[routes.length - 1]?.unloading_city ||
        initialOrder?.unloading_address_json?.city ||
        'Маминское',

      cargo_name: initialOrder?.cargo_name || primaryOrder?.description || 'Пробы керна',
      weight_gross_kg: initialOrder?.weight_gross_kg || '',
      price_without_vat:
        initialOrder?.price_without_vat ||
        (primaryOrder?.amount ? Number(primaryOrder.amount) : 40000),

      payment_method:
        primaryOrder?.payment_method ||
        (initialOrder?.payment_terms?.includes('Наличные') ? 'cash' : 'bank_invoice'),

      planned_loading_at:
        initialOrder?.planned_loading_at?.slice(0, 16) ||
        initialTrip?.started_at?.slice(0, 16) ||
        `${today}T08:00`,
      planned_delivery_at:
        initialOrder?.planned_delivery_at?.slice(0, 16) ||
        initialTrip?.ended_at?.slice(0, 16) ||
        `${today}T18:00`,

      assigned_vehicle_id:
        initialOrder?.assigned_vehicle_id || initialTrip?.asset?.id || initialTrip?.asset_id || '',
      assigned_driver_id:
        initialOrder?.assigned_driver_id || initialTrip?.driver?.id || initialTrip?.driver_id || '',

      driver_pay: primaryOrder?.driver_pay ? Number(primaryOrder.driver_pay) : 7900,
      admin_note: initialTrip?.admin_note || '',
      driver_note: initialTrip?.driver_note || '',
    };
  });

  // Пресеты опорных локаций
  const LOCATION_PRESETS = [
    {
      key: 'shaytanka',
      label: 'Шайтанка',
      city: 'Шайтанка',
      address: 'пос. Шайтанка, Свердловская обл.',
      loadingOrg: 'ООО "Геостройиндустрия" (ЛОП)',
      cargoName: 'Пробы керна',
    },
    {
      key: 'maminskoe',
      label: 'Маминское',
      city: 'Маминское',
      address: 'село Маминское, Свердловская обл., склад 2',
      loadingOrg: 'ООО "Геостройиндустрия"',
    },
    {
      key: 'vorontsovka',
      label: 'Воронцовка',
      city: 'Воронцовка',
      address: 'пос. Воронцовка, Свердловская обл.',
    },
    { key: 'rezh', label: 'Реж', city: 'Реж', address: 'г. Реж, Свердловская обл.' },
    {
      key: 'karpinsk',
      label: 'Карпинск',
      city: 'Карпинск',
      address: 'г. Карпинск, Свердловская обл.',
    },
    {
      key: 'salda',
      label: 'В.Салда (База)',
      city: 'Верхняя Салда',
      address: 'г. Верхняя Салда, База',
    },
    {
      key: 'ekaterinburg',
      label: 'Екатеринбург',
      city: 'Екатеринбург',
      address: 'г. Екатеринбург',
    },
    { key: 'tagil', label: 'Н.Тагил', city: 'Нижний Тагил', address: 'г. Нижний Тагил' },
  ];

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
      setForm((prev: any) => {
        const updated = {
          ...prev,
          ...(field === 'loading'
            ? {
                loading_city: loc.city,
                loading_address: loc.address,
                ...(loc.loadingOrg ? { loading_org_name: loc.loadingOrg } : {}),
                ...(loc.cargoName ? { cargo_name: loc.cargoName } : {}),
              }
            : {
                unloading_city: loc.city,
                unloading_address: loc.address,
              }),
        };

        const loadCity = field === 'loading' ? loc.city : updated.loading_city;
        const unloadCity = field === 'unloading' ? loc.city : updated.unloading_city;

        if (
          (loadCity?.toLowerCase().includes('шайтан') &&
            unloadCity?.toLowerCase().includes('мамин')) ||
          (loadCity?.toLowerCase().includes('мамин') &&
            unloadCity?.toLowerCase().includes('шайтан'))
        ) {
          updated.price_without_vat = 40000;
          updated.driver_pay = 7900;
          setPreventSaldaAutoFinish(true);
          setStatusMessage(
            '⭐ Применен фиксированный тариф Шайтанка ↔ Маминское: 40 000 ₽ (ЗП: 7 900 ₽)',
          );
        }

        return updated;
      });
    }
  };

  // Быстрый выбор шаблона (активен как при создании, так и при редактировании)
  const selectClientPreset = (type: 'vsmpo' | 'geostroy' | 'manual') => {
    setSelectedClientType(type);
    if (type === 'geostroy') {
      const geoCp = safeCounterparties.find((c: any) => c.name?.toLowerCase().includes('геострой'));
      const geoName = geoCp?.name || 'ООО "Геостройиндустрия"';
      const geoId = geoCp?.id || '';

      setClientOrders([
        {
          id: '1',
          client_id: geoId,
          client_name: geoName,
          client_inn: geoCp?.inn || '',
          base_doc_number:
            form.base_doc_number ||
            (initialTrip?.trip_number ? String(initialTrip.trip_number) : '1056'),
          cargo_name: 'Пробы керна',
          weight_gross_kg: 3500,
          price_without_vat: 40000,
          forwarder_id: '',
          forwarder_name: '— (Прямой заказчик)',
          payment_method: 'bank_invoice',
          payment_terms: 'Безналичный расчет (Дебиторская задолженность, отсрочка)',
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
        client_inn: geoCp?.inn || '',
        loading_city: 'Шайтанка',
        loading_address: 'пос. Шайтанка, Свердловская обл.',
        loading_org_name: geoName + ' (ЛОП)',
        unloading_city: 'Маминское',
        unloading_address: 'село Маминское, склад 2',
        cargo_name: 'Пробы керна',
        weight_gross_kg: 3500,
        price_without_vat: 40000,
        driver_pay: 7900,
      }));

      setPreventSaldaAutoFinish(true);
      setStatusMessage(
        '⭐ Применен шаблон ООО «Геостройиндустрия»: 40 000 ₽ (Шайтанка ➔ Маминское, ЗП 7 900 ₽)',
      );
    } else if (type === 'vsmpo') {
      const vsmpoPreset = presets.find((p: any) => p.title?.includes('ВСМПО')) || presets[0];
      const vsmpoCp = counterparties.find((c: any) => c.name?.toLowerCase().includes('всмпо'));
      const vsmpoName = vsmpoCp?.name || 'ПАО «Корпорация ВСМПО-АВИСМА»';

      setClientOrders([
        {
          id: '1',
          client_id: vsmpoCp?.id || '',
          client_name: vsmpoName,
          client_inn: '6607000556',
          base_doc_number: `794/${new Date().getFullYear()}`,
          cargo_name: 'Пруток 20мм, труба нерж.сталь',
          weight_gross_kg: 1500,
          price_without_vat: 15000,
          forwarder_id: vsmpoPreset?.forwarder_counterparty_id || '',
          forwarder_name: 'ИП Парфенов Андрей Виталиевич',
          payment_method: 'bank_invoice',
          payment_terms: 'Безналичный расчет (Дебиторская задолженность, ЭДО)',
        },
      ]);

      setRoutes([
        {
          id: '1',
          loading_city: 'Заречный',
          loading_address: '624250, Свердловская область, г. Заречный, ул. Промзона БЗСК, д 2',
          loading_org: 'ООО "Континенталь"',
          unloading_city: 'Верхняя Салда',
          unloading_address: '624760, Свердловская область, г. Верхняя Салда, ул. Парковая, д 1',
          unloading_org: vsmpoName,
          cargo_name: 'Пруток 20мм, труба нерж.сталь',
          weight_kg: 1500,
        },
      ]);

      setForm((prev: any) => ({
        ...prev,
        client_id: vsmpoCp?.id || '',
        client_name: vsmpoName,
        client_inn: '6607000556',
        forwarder_name: 'ИП Парфенов Андрей Виталиевич',
        loading_city: 'Заречный',
        loading_address: '624250, Свердловская область, г. Заречный, ул. Промзона БЗСК, д 2',
        loading_org_name: 'ООО "Континенталь"',
        unloading_city: 'Верхняя Салда',
        unloading_address: '624760, Свердловская область, г. Верхняя Салда, ул. Парковая, д 1',
        cargo_name: 'Пруток 20мм, труба нерж.сталь',
        weight_gross_kg: 1500,
        price_without_vat: 15000,
      }));

      setStatusMessage('⭐ Применен шаблон ПАО «Корпорация ВСМПО-АВИСМА» (ИП Парфенов)');
    } else {
      setStatusMessage('📝 Режим ручного ввода');
    }
  };

  const handleAddRouteStop = () => {
    if (routes.length >= 6) {
      alert('Максимальное количество точек маршрута — 6');
      return;
    }
    const newStop: RouteStop = {
      id: String(Date.now()),
      loading_city: routes[routes.length - 1]?.unloading_city || 'Верхняя Салда',
      loading_address: routes[routes.length - 1]?.unloading_address || '',
      unloading_city: '',
      unloading_address: '',
      cargo_name: form.cargo_name || 'Груз',
      weight_kg: 0,
    };
    setRoutes([...routes, newStop]);
    setIsMultiStop(true);
  };

  const handleRemoveRouteStop = (idx: number) => {
    if (routes.length <= 1) return;
    const updated = routes.filter((_, i) => i !== idx);
    setRoutes(updated);
    if (updated.length <= 1) setIsMultiStop(false);
  };

  const handleUpdateRouteStop = (idx: number, patch: Partial<RouteStop>) => {
    const updated = [...routes];
    const current = updated[idx];
    if (current) {
      updated[idx] = { ...current, ...patch } as RouteStop;
      setRoutes(updated);
    }
  };

  // Парсинг PDF
  const handlePdfUpload = async (file: File) => {
    setIsParsing(true);
    setStatusMessage(null);
    try {
      const data = new FormData();
      data.append('file', file);
      const res = await fetch('/api/orders/parse-doc', { method: 'POST', body: data });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Ошибка разбора PDF');

      const p = json.parsed;
      setForm((prev: any) => ({
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
      }));
      setStatusMessage(`✨ Документ распознан: № ${p.order_number || ''} · ${p.cargo_name || ''}`);
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        : Number(form.weight_gross_kg) || 0;

      const orderPayload = {
        base_doc_number: form.base_doc_number,
        base_doc_date: form.base_doc_date,
        client_id: finalClientId || null,
        forwarder_id: form.forwarder_id || null,
        preset_id: form.preset_id || null,
        cargo_name: form.cargo_name || 'Груз',
        weight_gross_kg: totalClientsWeight > 0 ? totalClientsWeight : totalWeightKg,
        weight_net_kg: totalClientsWeight > 0 ? totalClientsWeight : totalWeightKg,
        places_count: 1,
        packaging_type: 'паллеты',
        price_without_vat:
          totalClientsRevenue > 0 ? totalClientsRevenue : Number(form.price_without_vat) || 0,
        client_orders: clientOrders.map((co: any, idx: number) => {
          if (idx === 0 && (!co.client_id || co.client_id === '')) {
            return {
              ...co,
              client_id: finalClientId || '',
              client_name: form.client_name || co.client_name,
              client_inn: form.client_inn || co.client_inn,
            };
          }
          return co;
        }),
        payment_terms:
          form.payment_method === 'cash'
            ? 'Оплата наличными водителю'
            : 'Безналичный расчет (Дебиторская задолженность)',
        loading_address_json: { city: primaryLoadCity, raw: primaryLoadAddress },
        unloading_address_json: { city: primaryUnloadCity, raw: primaryUnloadAddress },
        loading_org_name: form.loading_org_name,
        planned_loading_at: form.planned_loading_at ? `${form.planned_loading_at}:00+05:00` : null,
        planned_delivery_at: form.planned_delivery_at
          ? `${form.planned_delivery_at}:00+05:00`
          : null,
        assigned_vehicle_id: form.assigned_vehicle_id || null,
        assigned_driver_id: form.assigned_driver_id || null,
        routes_json: isMultiStop ? routes : [],
        prevent_salda_auto_finish: Boolean(preventSaldaAutoFinish),
        ...(initialTrip ? { active_trip_id: initialTrip.id } : {}),
      };

      // 1. Сохраняем в orders
      let targetOrderId = initialOrder?.id;
      if (!targetOrderId && initialTrip?.id) {
        try {
          const res = await fetch(`/api/orders?active_trip_id=${initialTrip.id}`);
          if (res.ok) {
            const list = await res.json();
            if (Array.isArray(list) && list.length > 0) {
              targetOrderId = list[0].id;
            }
          }
        } catch {}
      }

      if (targetOrderId) {
        await fetch(`/api/orders/${targetOrderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload),
        });
      } else {
        await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload),
        });
      }

      // 2. Если редактируется связанный рейс (или initialTrip) — обновляем trips и trip_orders
      const tripId = initialTrip?.id || (initialOrder as any)?.active_trip_id;
      if (tripId) {
        const tripOrdersPayload = clientOrders.map((co, idx) => ({
          id: co.id && !co.id.startsWith('new-') && co.id.length > 10 ? co.id : undefined,
          isNew: !co.id || co.id.startsWith('new-') || co.id.length < 10,
          counterparty_id: co.client_id || finalClientId || null,
          counterparty_name: co.client_name || form.client_name,
          amount: String(co.price_without_vat || (idx === 0 ? form.price_without_vat : '0')),
          driver_pay: String(
            Math.round(Number(form.driver_pay || 0) / Math.max(1, clientOrders.length)),
          ),
          payment_method: co.payment_method || form.payment_method || 'bank_invoice',
          description: `[${primaryLoadCity} -> ${primaryUnloadCity}] ${co.cargo_name || form.cargo_name}`,
        }));

        await fetch(`/api/trips/${tripId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orders: tripOrdersPayload,
            admin_note:
              form.admin_note ||
              `Маршрут: ${primaryLoadCity} ➔ ${primaryUnloadCity} | ЗП: ${Number(form.driver_pay || 0)} ₽`,
            driver_note: form.driver_note || undefined,
            ...(form.assigned_driver_id ? { driver_id: form.assigned_driver_id } : {}),
          }),
        });
      }

      alert(`✅ Рейс № ${form.base_doc_number || ''} успешно сохранён!`);
      onSuccess();
    } catch (err: any) {
      alert(`Ошибка сохранения: ${err.message}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl p-4 sm:p-5 max-w-3xl w-full shadow-2xl border border-slate-200 space-y-3.5 my-auto max-h-[95vh] overflow-y-auto">
        {/* Заголовок */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                {isEditing
                  ? `Рейс #${form.base_doc_number || initialTrip?.trip_number || ''}`
                  : 'Новый рейс'}
              </span>
              {initialTrip?.lifecycle_status && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {initialTrip.lifecycle_status === 'approved' ? '✓ Утверждён' : 'На проверке'}
                </span>
              )}
            </div>
            <h3 className="font-bold text-sm text-slate-900 mt-0.5">
              {isEditing ? 'Редактирование рейса и точек маршрута' : 'Создание нового рейса'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 1. БЫСТРЫЕ ШАБЛОНЫ (АКТИВНЫ ВСЕГДА: И ДЛЯ НОВЫХ, И ДЛЯ РЕДАКТИРОВАНИЯ) */}
        <div className="space-y-1">
          <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">
            Быстрый шаблон рейса:
          </label>
          <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => selectClientPreset('manual')}
              className={`py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                selectedClientType === 'manual'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📝</span>
              <span>Ручной ввод</span>
            </button>
            <button
              type="button"
              onClick={() => selectClientPreset('geostroy')}
              className={`py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                selectedClientType === 'geostroy'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🏗️</span>
              <span>Геострой (40к)</span>
            </button>
            <button
              type="button"
              onClick={() => selectClientPreset('vsmpo')}
              className={`py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                selectedClientType === 'vsmpo'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🏢</span>
              <span>ВСМПО-АВИСМА</span>
            </button>
          </div>
        </div>

        {/* Статус-сообщение */}
        {statusMessage && (
          <div className="p-2 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold flex items-center justify-between">
            <span>{statusMessage}</span>
            <span className="text-emerald-600 text-[10px]">Готово</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {/* Секция 1: Реквизиты рейса */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div>
              <label className="font-bold text-slate-700 block mb-0.5">№ Заявки / Рейса</label>
              <input
                type="text"
                required
                value={form.base_doc_number}
                onChange={(e) => setForm({ ...form, base_doc_number: e.target.value })}
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
                className="w-full p-1.5 border border-slate-300 rounded bg-slate-50 font-medium"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 block mb-0.5">
                Основной клиент (Контрагент)
              </label>
              <OrderCounterpartySelect
                inputValue={form.client_name}
                counterparties={safeCounterparties}
                onChange={(cp, name) => {
                  setForm((f: any) => ({
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
          </div>

          {/* Секция 2: Маршрут перевозки (точки маршрута) */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 flex-wrap gap-1">
              <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <span>📍</span>
                <span>Точки маршрута (погрузки / выгрузки)</span>
              </span>
              <button
                type="button"
                onClick={handleAddRouteStop}
                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded font-bold text-[10.5px] cursor-pointer transition active:scale-95 flex items-center gap-1"
              >
                <span>+ Добавить точку маршрута ({routes.length}/6)</span>
              </button>
            </div>

            {/* Карточки точек маршрута */}
            <div className="space-y-2">
              {routes.map((stop, idx) => (
                <div
                  key={stop.id}
                  className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1.5 shadow-2xs relative"
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-indigo-900 border-b border-slate-100 pb-1">
                    <span>
                      {idx === 0
                        ? '📍 Начальная точка (Погрузка)'
                        : idx === routes.length - 1
                          ? '🏁 Конечная точка (Выгрузка)'
                          : `Точка #${idx + 1}`}
                    </span>
                    {routes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRouteStop(idx)}
                        className="text-rose-500 hover:text-rose-700 text-[10.5px] font-bold cursor-pointer"
                      >
                        ✕ Удалить точку
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="font-semibold text-slate-600 block text-[10px]">
                          {idx === 0 ? 'Пункт погрузки (Откуда):' : `Погрузка точки #${idx + 1}:`}
                        </label>
                        <select
                          value=""
                          onChange={(e) => applyLocationPreset('loading', e.target.value, idx)}
                          className="text-[10px] py-0.5 px-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded text-slate-700 font-semibold cursor-pointer"
                        >
                          <option value="" disabled>
                            ⚡ Пресет...
                          </option>
                          {LOCATION_PRESETS.map((loc) => (
                            <option key={`load-${loc.key}-${idx}`} value={loc.key}>
                              {loc.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <input
                        type="text"
                        required
                        value={stop.loading_address}
                        onChange={(e) =>
                          handleUpdateRouteStop(idx, {
                            loading_address: e.target.value,
                            loading_city: e.target.value.split(',')[0] || e.target.value,
                          })
                        }
                        placeholder="Адрес погрузки..."
                        className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs font-medium"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="font-semibold text-slate-600 block text-[10px]">
                          {idx === routes.length - 1
                            ? 'Пункт выгрузки (Куда):'
                            : `Выгрузка точки #${idx + 1}:`}
                        </label>
                        <select
                          value=""
                          onChange={(e) => applyLocationPreset('unloading', e.target.value, idx)}
                          className="text-[10px] py-0.5 px-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded text-slate-700 font-semibold cursor-pointer"
                        >
                          <option value="" disabled>
                            ⚡ Пресет...
                          </option>
                          {LOCATION_PRESETS.map((loc) => (
                            <option key={`unload-${loc.key}-${idx}`} value={loc.key}>
                              {loc.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <input
                        type="text"
                        required
                        value={stop.unloading_address}
                        onChange={(e) =>
                          handleUpdateRouteStop(idx, {
                            unloading_address: e.target.value,
                            unloading_city: e.target.value.split(',')[0] || e.target.value,
                          })
                        }
                        placeholder="Адрес выгрузки..."
                        className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs font-medium"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ЧЕКБОКС: ЗАЩИТА ОТ РАЗРЫВА ПРИ ЗАЕЗДЕ В САЛДУ */}
            <label className="flex items-start gap-2 p-2 bg-amber-50/90 border border-amber-300 rounded-lg text-amber-950 font-bold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={preventSaldaAutoFinish}
                onChange={(e) => setPreventSaldaAutoFinish(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-indigo-600 rounded cursor-pointer"
              />
              <div className="text-xs">
                <span className="flex items-center gap-1.5">
                  🔄 Составной маршрут через Верхнюю Салду (транзит / защита от закрытия Wialon)
                  {preventSaldaAutoFinish && (
                    <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded text-[10px] font-bold">
                      🛡️ Защита активна
                    </span>
                  )}
                </span>
                <span className="block font-normal text-[10.5px] text-amber-900 mt-0.5">
                  Если машина проезжает или ночует в Салде перед утренней выгрузкой (Шайтанка ➔
                  Маминское), рейс останется единым.
                </span>
              </div>
            </label>
          </div>

          {/* Секция 3: Заказчики и ставки (до 6 клиентов в одном рейсе) */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 flex-wrap gap-1">
              <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <span>📦</span>
                <span>Заказы клиентов в этом рейсе ({clientOrders.length})</span>
              </span>
              <button
                type="button"
                onClick={handleAddClientOrder}
                className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[11px] font-bold cursor-pointer transition flex items-center gap-1 active:scale-95"
              >
                <span>+ Добавить клиента / заказ ({clientOrders.length}/6)</span>
              </button>
            </div>

            <div className="space-y-2">
              {clientOrders.map((co, idx) => (
                <div
                  key={co.id || idx}
                  className="p-2 bg-white border border-slate-200 rounded-lg space-y-1.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 border-b border-slate-100 pb-1">
                    <span className="text-indigo-900">
                      {idx === 0 ? '👑 Основной заказчик' : `📦 Заказчик #${idx + 1}`}
                    </span>
                    {clientOrders.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveClientOrder(idx)}
                        className="text-rose-500 hover:text-rose-700 text-[10.5px] font-bold cursor-pointer"
                      >
                        ✕ Удалить
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-1.5 items-end">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-slate-500 font-bold block mb-0.5">
                        Клиент (Контрагент):
                      </label>
                      <OrderCounterpartySelect
                        inputValue={co.client_name}
                        counterparties={safeCounterparties}
                        onChange={(cp, name) =>
                          handleUpdateClientOrder(idx, {
                            client_id: cp?.id || '',
                            client_name: name,
                            client_inn: cp?.inn || '',
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold block mb-0.5">
                        Груз:
                      </label>
                      <input
                        type="text"
                        value={co.cargo_name || ''}
                        onChange={(e) =>
                          handleUpdateClientOrder(idx, { cargo_name: e.target.value })
                        }
                        placeholder="Пробы керна"
                        className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold block mb-0.5">
                        Ставка (₽):
                      </label>
                      <input
                        type="number"
                        value={co.price_without_vat || ''}
                        onChange={(e) =>
                          handleUpdateClientOrder(idx, {
                            price_without_vat: Number(e.target.value) || '',
                          })
                        }
                        placeholder="40 000"
                        className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs font-bold text-indigo-700"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-bold text-indigo-950">
              <span>
                Итого выручка: <b>{totalClientsRevenue.toLocaleString('ru-RU')} ₽</b>
              </span>
              <span className="text-[10.5px] text-indigo-700 font-semibold">
                ✓ Автоматическое разделение по счетам клиентов
              </span>
            </div>
          </div>

          {/* Секция 4: Автомобиль, Водитель и ЗП */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div>
              <label className="font-bold text-slate-700 block mb-0.5">Грузовой автомобиль</label>
              <select
                value={form.assigned_vehicle_id}
                onChange={(e) => setForm({ ...form, assigned_vehicle_id: e.target.value })}
                className="w-full p-1.5 border border-slate-300 rounded bg-white font-bold"
              >
                <option value="">-- Выбрать авто --</option>
                {safeVehicles.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {v.brand_name || v.short_name || 'Авто'} ({v.reg_number})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="font-bold text-slate-700 block">Водитель</label>
                {onOpenDriverModal && (
                  <button
                    type="button"
                    onClick={() => onOpenDriverModal(form.assigned_driver_id || undefined)}
                    className="text-[10.5px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                  >
                    ⚙️ Водители
                  </button>
                )}
              </div>
              <select
                value={form.assigned_driver_id}
                onChange={(e) => setForm({ ...form, assigned_driver_id: e.target.value })}
                className="w-full p-1.5 border border-slate-300 rounded bg-white font-bold"
              >
                <option value="">-- Выбрать водителя --</option>
                {safeDrivers.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="font-bold text-slate-700 block">ЗП водителя (₽)</label>
                <button
                  type="button"
                  onClick={() => {
                    // Расчет по формуле: 600 км * 10 ₽ + 1000 ₽ суточные + 900 ₽ Шайтанка = 7900 ₽
                    setForm((f: any) => ({ ...f, driver_pay: 7900 }));
                  }}
                  className="text-[10px] text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
                >
                  ⚡ 7 900 ₽ (Шайт.)
                </button>
              </div>
              <input
                type="number"
                value={
                  form.driver_pay === '' || form.driver_pay === undefined ? '' : form.driver_pay
                }
                onChange={(e) => {
                  const val = e.target.value;
                  setForm({ ...form, driver_pay: val === '' ? '' : Number(val) });
                }}
                placeholder="0"
                className="w-full p-1.5 border border-slate-300 rounded bg-white font-bold text-emerald-700"
              />
            </div>
          </div>

          {/* Загрузка PDF (доступна всегда) */}
          <div className="flex items-center justify-between p-2 bg-indigo-50/50 border border-indigo-100 rounded-lg text-xs">
            <span className="text-slate-600 font-medium">
              📄 Прикрепить скан или PDF Поручения экспедитору:
            </span>
            <label className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold cursor-pointer transition shadow-2xs text-[11px]">
              <span>{isParsing ? 'Распознавание...' : 'Загрузить PDF'}</span>
              <input
                type="file"
                accept=".pdf"
                disabled={isParsing}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) handlePdfUpload(e.target.files[0]);
                }}
                className="hidden"
              />
            </label>
          </div>

          {/* Кнопки действий */}
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
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs cursor-pointer transition active:scale-95"
            >
              {isEditing ? 'Сохранить изменения' : 'Создать заявку'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
