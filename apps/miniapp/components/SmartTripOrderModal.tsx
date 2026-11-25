/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FINANCIAL_CATEGORIES } from '@saldacargo/shared';

export interface SmartTripOrderModalProps {
  trip: any;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type TripKind = 'intercity' | 'local' | 'prr';
type OrderPayMethod = 'bank_invoice' | 'cash' | 'debt_cash';

interface EditableOrder {
  id: string;
  isNew?: boolean;
  counterparty_id: string;
  counterparty_name: string;
  is_legal_entity?: boolean;
  amount: string;
  driver_pay: string;
  driver_loader_pay: string;
  payment_method: OrderPayMethod;
  description: string;
  loaders: Array<{ id: string; name: string; pay: string }>;
}

interface EditableExpense {
  id: string;
  isNew?: boolean;
  kind: 'cube' | 'fuel' | 'other';
  liters: string;
  amount: string;
  payment_method: string;
  description: string;
  category_id: string;
}

const TRIP_KINDS: Array<{ value: TripKind; label: string }> = [
  { value: 'intercity', label: '🛣 Межгород' },
  { value: 'local', label: '🏙 По городу' },
  { value: 'prr', label: '👷 ПРР' },
];

const PAY_OPTIONS: Array<{
  value: OrderPayMethod;
  icon: string;
  label: string;
  activeCls: string;
}> = [
  {
    value: 'bank_invoice',
    icon: '🏦',
    label: 'Р/С',
    activeCls: 'border-purple-600 bg-purple-50 ring-2 ring-purple-200 text-purple-900',
  },
  {
    value: 'cash',
    icon: '💵',
    label: 'Наличные',
    activeCls: 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-200 text-emerald-900',
  },
  {
    value: 'debt_cash',
    icon: '⏳',
    label: 'Долг',
    activeCls: 'border-rose-600 bg-rose-50 ring-2 ring-rose-200 text-rose-900',
  },
];

let tempIdSeq = 0;
function makeTempId(prefix: string): string {
  tempIdSeq += 1;
  return `${prefix}-${tempIdSeq}`;
}

function normalizeTripKind(raw: unknown): TripKind {
  if (raw === 'local' || raw === 'moving') return 'local';
  if (raw === 'prr' || raw === 'loaders_only') return 'prr';
  return 'intercity';
}

function normalizePayMethod(raw: unknown): OrderPayMethod {
  if (raw === 'cash') return 'cash';
  if (raw === 'debt_cash' || raw === 'debt') return 'debt_cash';
  return 'bank_invoice';
}

function parseCubeLiters(desc: string | null | undefined): string {
  if (!desc) return '';
  const m = desc.match(/(\d+(?:[.,]\d+)?)\s*л/i);
  return m?.[1] ? m[1].replace(',', '.') : '';
}

function extractLoadersFromOrder(order: any): Array<{ id: string; name: string; pay: string }> {
  if (Array.isArray(order?.loaders_data) && order.loaders_data.length > 0) {
    return order.loaders_data.map((l: any) => ({
      id: String(l.id || ''),
      name: String(l.name || ''),
      pay: String(l.pay ?? '0'),
    }));
  }
  const list: Array<{ id: string; name: string; pay: string }> = [];
  if (order?.loader_id || Number(order?.loader_pay || 0) > 0) {
    list.push({
      id: String(order.loader_id || ''),
      name: String(order.loader?.name || ''),
      pay: String(order.loader_pay ?? '0'),
    });
  }
  if (order?.loader2_id || Number(order?.loader2_pay || 0) > 0) {
    list.push({
      id: String(order.loader2_id || ''),
      name: String(order.loader2?.name || ''),
      pay: String(order.loader2_pay ?? '0'),
    });
  }
  return list;
}

export function SmartTripOrderModal({ trip, isOpen, onClose, onSaved }: SmartTripOrderModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tripTypeOpen, setTripTypeOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchByIdx, setSearchByIdx] = useState<Record<number, string>>({});

  const [tripKind, setTripKind] = useState<TripKind>(() => normalizeTripKind(trip?.trip_type));
  const [assetId, setAssetId] = useState<string>(() => trip?.asset?.id || trip?.asset_id || '');
  const [driverId, setDriverId] = useState<string>(() => trip?.driver?.id || trip?.driver_id || '');
  const [odometerStart, setOdometerStart] = useState<string>(() =>
    trip?.odometer_start != null ? String(trip.odometer_start) : '',
  );
  const [odometerEnd, setOdometerEnd] = useState<string>(() =>
    trip?.odometer_end != null ? String(trip.odometer_end) : '',
  );
  const [adminNote, setAdminNote] = useState<string>(() => trip?.admin_note || '');

  const [deletedOrderIds, setDeletedOrderIds] = useState<string[]>([]);
  const [deletedExpenseIds, setDeletedExpenseIds] = useState<string[]>([]);

  const [orders, setOrders] = useState<EditableOrder[]>(() => {
    const active = (trip?.trip_orders ?? []).filter((o: any) => o.lifecycle_status !== 'cancelled');
    if (active.length > 0) {
      return active.map((o: any) => ({
        id: String(o.id),
        isNew: false,
        counterparty_id: String(o.counterparty_id || o.counterparty?.id || ''),
        counterparty_name: String(o.counterparty?.name || o.counterparty_name || ''),
        amount: o.amount != null ? String(Number(o.amount)) : '',
        driver_pay: o.driver_pay != null ? String(Number(o.driver_pay)) : '',
        driver_loader_pay:
          o.driver_loader_pay != null && Number(o.driver_loader_pay) > 0
            ? String(Number(o.driver_loader_pay))
            : '',
        payment_method: normalizePayMethod(o.payment_method),
        description: String(o.description || ''),
        loaders: extractLoadersFromOrder(o),
      }));
    }
    return [
      {
        id: makeTempId('new-order'),
        isNew: true,
        counterparty_id: '',
        counterparty_name: '',
        amount: '',
        driver_pay: '',
        driver_loader_pay: '',
        payment_method: 'debt_cash',
        description: '',
        loaders: [],
      },
    ];
  });

  const [expenses, setExpenses] = useState<EditableExpense[]>(() =>
    (trip?.trip_expenses ?? []).map((e: any) => {
      const isCube = e.payment_method === 'cube';
      const isFuel =
        isCube ||
        e.category_id === FINANCIAL_CATEGORIES.FUEL ||
        String(e.category?.name || '')
          .toLowerCase()
          .includes('топлив') ||
        String(e.category?.name || '')
          .toLowerCase()
          .includes('гсм');
      return {
        id: String(e.id),
        isNew: false,
        kind: isCube ? 'cube' : isFuel ? 'fuel' : 'other',
        liters: isCube ? parseCubeLiters(e.description) : '',
        amount: e.amount != null ? String(Number(e.amount)) : '',
        payment_method: String(e.payment_method || (isCube ? 'cube' : 'fuel_card')),
        description: String(e.description || ''),
        category_id: String(
          e.category_id ||
            e.category?.id ||
            (isFuel ? FINANCIAL_CATEGORIES.FUEL : FINANCIAL_CATEGORIES.OTHER),
        ),
      };
    }),
  );

  // Справочники
  const { data: orgCtx } = useQuery<{
    settings?: { finance?: { cube_fuel_price_per_liter?: number } };
  }>({
    queryKey: ['miniapp-org-context'],
    queryFn: () =>
      fetch('/api/organization/context')
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({})),
    staleTime: 60_000,
    enabled: isOpen,
  });

  const cubePrice = Number(orgCtx?.settings?.finance?.cube_fuel_price_per_liter ?? 60) || 60;

  const { data: counterparties = [] } = useQuery<any[]>({
    queryKey: ['miniapp-counterparties-all'],
    queryFn: () =>
      fetch('/api/driver/counterparties')
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    staleTime: 60_000,
    enabled: isOpen,
  });

  const { data: vehicles = [] } = useQuery<any[]>({
    queryKey: ['miniapp-vehicles-list'],
    queryFn: () =>
      fetch('/api/vehicles/public')
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    staleTime: 60_000,
    enabled: isOpen,
  });

  const { data: drivers = [] } = useQuery<any[]>({
    queryKey: ['miniapp-drivers-list'],
    queryFn: () =>
      fetch('/api/users/public?role=driver')
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    staleTime: 60_000,
    enabled: isOpen,
  });

  const { data: allLoaders = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['miniapp-loaders-list'],
    queryFn: () =>
      fetch('/api/driver/loaders')
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    staleTime: 60_000,
    enabled: isOpen,
  });

  const topCounterparties = useMemo(
    () => counterparties.filter((c) => c.is_top).slice(0, 6),
    [counterparties],
  );

  if (!isOpen || !trip) return null;

  const currentKindLabel = TRIP_KINDS.find((k) => k.value === tripKind)?.label ?? '🛣 Межгород';

  const updateOrder = (idx: number, patch: Partial<EditableOrder>) => {
    setOrders((prev) => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  };

  const addOrder = () => {
    setOrders((prev) => [
      ...prev,
      {
        id: makeTempId('new-order'),
        isNew: true,
        counterparty_id: '',
        counterparty_name: '',
        amount: '',
        driver_pay: '0',
        driver_loader_pay: '',
        payment_method: 'debt_cash',
        description: '',
        loaders: [],
      },
    ]);
  };

  const removeOrder = (idx: number) => {
    const target = orders[idx];
    if (!target) return;
    if (!target.isNew) {
      setDeletedOrderIds((prev) => [...prev, target.id]);
    }
    if (orders.length === 1) {
      setOrders([
        {
          id: makeTempId('new-order'),
          isNew: true,
          counterparty_id: '',
          counterparty_name: '',
          amount: '',
          driver_pay: '',
          driver_loader_pay: '',
          payment_method: 'debt_cash',
          description: '',
          loaders: [],
        },
      ]);
    } else {
      setOrders((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const addLoaderToOrder = (orderIdx: number) => {
    const first = allLoaders[0];
    setOrders((prev) =>
      prev.map((o, i) =>
        i === orderIdx
          ? {
              ...o,
              loaders: [...o.loaders, { id: first?.id || '', name: first?.name || '', pay: '' }],
            }
          : o,
      ),
    );
  };

  const updateLoader = (
    orderIdx: number,
    loaderIdx: number,
    patch: Partial<{ id: string; name: string; pay: string }>,
  ) => {
    setOrders((prev) =>
      prev.map((o, i) =>
        i === orderIdx
          ? {
              ...o,
              loaders: o.loaders.map((l, li) => (li === loaderIdx ? { ...l, ...patch } : l)),
            }
          : o,
      ),
    );
  };

  const removeLoader = (orderIdx: number, loaderIdx: number) => {
    setOrders((prev) =>
      prev.map((o, i) =>
        i === orderIdx ? { ...o, loaders: o.loaders.filter((_, li) => li !== loaderIdx) } : o,
      ),
    );
  };

  const addExpenseRow = (kind: 'cube' | 'fuel' | 'other') => {
    setExpenses((prev) => [
      ...prev,
      {
        id: makeTempId('new-exp'),
        isNew: true,
        kind,
        liters: '',
        amount: '',
        payment_method: kind === 'cube' ? 'cube' : kind === 'fuel' ? 'fuel_card' : 'cash',
        description: kind === 'cube' ? 'Заправка из кубика' : kind === 'fuel' ? 'Топливо АЗС' : '',
        category_id: kind === 'other' ? FINANCIAL_CATEGORIES.OTHER : FINANCIAL_CATEGORIES.FUEL,
      },
    ]);
  };

  const updateExpense = (idx: number, patch: Partial<EditableExpense>) => {
    setExpenses((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };

  const removeExpense = (idx: number) => {
    const target = expenses[idx];
    if (!target) return;
    if (!target.isNew) {
      setDeletedExpenseIds((prev) => [...prev, target.id]);
    }
    setExpenses((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const ordersPayload = orders
        .filter(
          (o) =>
            !o.isNew ||
            o.counterparty_id ||
            o.counterparty_name.trim() ||
            Number(o.amount || 0) > 0 ||
            Number(o.driver_pay || 0) > 0,
        )
        .map((o) => {
          const validLoaders = o.loaders.filter((l) => l.id || Number(l.pay || 0) > 0);
          const loadingPayNum = tripKind === 'local' ? Number(o.driver_loader_pay || 0) : 0;
          return {
            id: o.isNew ? undefined : o.id,
            isNew: o.isNew,
            counterparty_id: o.counterparty_id || null,
            counterparty_name: o.counterparty_name.trim() || undefined,
            amount: String(Number(o.amount || 0)),
            driver_pay: String(Number(o.driver_pay || 0)),
            driver_loader_pay: String(loadingPayNum),
            is_driver_loader: loadingPayNum > 0,
            direction:
              tripKind === 'local' ? 'local' : tripKind === 'prr' ? 'loaders_only' : 'intercity',
            loaders_data: validLoaders,
            loader_id: validLoaders[0]?.id || null,
            loader_pay: String(Number(validLoaders[0]?.pay || 0)),
            loader2_id: validLoaders[1]?.id || null,
            loader2_pay: String(Number(validLoaders[1]?.pay || 0)),
            payment_method: o.payment_method,
            description: o.description.trim() || undefined,
          };
        });

      const expensesPayload = expenses
        .filter((e) => !e.isNew || Number(e.amount || 0) > 0)
        .map((e) => {
          const desc =
            e.kind === 'cube'
              ? e.liters
                ? `Заправка из кубика: ${e.liters} л`
                : e.description || 'Заправка из кубика'
              : e.description.trim() || (e.kind === 'fuel' ? 'Топливо АЗС' : 'Расход в рейсе');
          return {
            id: e.isNew ? undefined : e.id,
            isNew: e.isNew,
            amount: String(Number(e.amount || 0)),
            payment_method: e.kind === 'cube' ? 'cube' : e.payment_method,
            description: desc,
            category_id: e.category_id,
          };
        });

      const res = await fetch(`/api/admin/trips/${trip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit_orders',
          trip_type: tripKind,
          asset_id: assetId || undefined,
          driver_id: driverId || undefined,
          odometer_start: odometerStart !== '' ? Number(odometerStart) : undefined,
          odometer_end: odometerEnd !== '' ? Number(odometerEnd) : undefined,
          admin_note: adminNote,
          orders: ordersPayload,
          deleted_order_ids: deletedOrderIds,
          expenses: expensesPayload,
          deleted_expense_ids: deletedExpenseIds,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка сохранения рейса');
      }

      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-50 flex flex-col overflow-hidden">
      {/* ── Шапка ── */}
      <header className="bg-white border-b-2 border-zinc-200 px-4 h-16 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 text-2xl font-bold p-1 -ml-1 active:scale-95"
          >
            ←
          </button>
          <div className="min-w-0">
            <h1 className="font-black text-zinc-900 text-lg leading-tight truncate">
              Рейс №{trip.trip_number}
            </h1>
            <p className="text-xs text-zinc-500 font-bold truncate">
              🚚 {trip.asset?.short_name || 'Авто'}
              {trip.asset?.reg_number ? ` · ${trip.asset.reg_number}` : ''}
              {trip.driver?.name ? ` · ${trip.driver.name}` : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-xl bg-zinc-100 text-zinc-600 font-black text-lg flex items-center justify-center shrink-0"
        >
          ✕
        </button>
      </header>

      {/* ── Скроллируемая форма ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 max-w-lg w-full mx-auto space-y-4">
        {/* 1. Тип рейса: ОДНА кнопка-спойлер (3 выбора: Межгород / По городу / ПРР) */}
        <div className="bg-white border-2 border-zinc-200 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setTripTypeOpen((v) => !v)}
            className="w-full px-4 py-3 flex items-center justify-between text-left active:bg-zinc-50"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider shrink-0">
                Тип:
              </span>
              <span className="font-black text-base text-zinc-900 truncate">
                {currentKindLabel}
              </span>
            </div>
            <span className="text-sm font-black text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg shrink-0">
              {tripTypeOpen ? 'Свернуть ▴' : 'Изменить ▾'}
            </span>
          </button>

          {tripTypeOpen && (
            <div className="px-3 pb-3 pt-1 border-t border-zinc-100 grid grid-cols-3 gap-2">
              {TRIP_KINDS.map((k) => {
                const active = tripKind === k.value;
                return (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() => {
                      setTripKind(k.value);
                      setTripTypeOpen(false);
                    }}
                    className={`border-2 rounded-xl py-2.5 px-2 font-black text-sm text-center active:scale-95 transition-all ${
                      active
                        ? 'border-orange-600 bg-orange-50 text-orange-900'
                        : 'border-zinc-200 bg-white text-zinc-800'
                    }`}
                  >
                    {k.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 2–5. Заказы / Клиенты рейса */}
        {orders.map((order, idx) => {
          const searchVal = (searchByIdx[idx] ?? '').trim().toLowerCase();
          const filteredCps = searchVal
            ? counterparties
                .filter((c) =>
                  String(c.name || '')
                    .toLowerCase()
                    .includes(searchVal),
                )
                .slice(0, 8)
            : [];

          return (
            <div
              key={order.id}
              className="space-y-4 bg-white border-2 border-zinc-200 rounded-2xl p-3.5"
            >
              {/* Шапка контрагента */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-0.5">
                  <label className="text-xs font-extrabold text-zinc-500 uppercase tracking-wider">
                    {orders.length > 1 ? `Контрагент #${idx + 1}` : 'Контрагент'}
                  </label>
                  <div className="flex items-center gap-3">
                    {idx === 0 && (
                      <button
                        type="button"
                        onClick={addOrder}
                        className="text-xs font-black text-orange-600 active:scale-95"
                      >
                        + Ещё клиент
                      </button>
                    )}
                    {orders.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeOrder(idx)}
                        className="text-xs font-black text-rose-600 active:scale-95"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </div>

                {order.counterparty_name ? (
                  <div className="flex items-center justify-between border-2 bg-blue-50 border-blue-300 rounded-2xl px-4 min-h-[54px] py-2">
                    <span className="font-black text-base text-blue-950 truncate pr-2">
                      {order.counterparty_name}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateOrder(idx, { counterparty_id: '', counterparty_name: '' })
                      }
                      className="w-9 h-9 rounded-xl bg-white text-rose-600 font-black text-lg flex items-center justify-center shrink-0 active:scale-95"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {topCounterparties.length > 0 && !searchVal && (
                      <div className="flex flex-wrap gap-1.5">
                        {topCounterparties.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              updateOrder(idx, {
                                counterparty_id: String(c.id),
                                counterparty_name: String(c.name),
                              });
                              setSearchByIdx((p) => ({ ...p, [idx]: '' }));
                            }}
                            className="px-3 py-2 rounded-xl border-2 border-zinc-200 bg-zinc-50 text-sm font-black text-zinc-800 active:scale-95"
                          >
                            {c.is_legal_entity ? '🏢' : '👤'} {c.name}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="relative">
                      <input
                        type="text"
                        value={searchByIdx[idx] ?? ''}
                        onChange={(e) => setSearchByIdx((p) => ({ ...p, [idx]: e.target.value }))}
                        placeholder="Поиск контрагента..."
                        className="w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 h-12 text-base font-bold text-zinc-900 focus:border-orange-500 focus:outline-none"
                      />
                      {filteredCps.length > 0 && (
                        <div className="mt-1 bg-white border-2 border-zinc-200 rounded-2xl shadow-lg max-h-48 overflow-y-auto divide-y divide-zinc-100">
                          {filteredCps.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                updateOrder(idx, {
                                  counterparty_id: String(c.id),
                                  counterparty_name: String(c.name),
                                });
                                setSearchByIdx((p) => ({ ...p, [idx]: '' }));
                              }}
                              className="w-full text-left px-4 py-3 text-sm font-black text-zinc-900 hover:bg-orange-50"
                            >
                              {c.is_legal_entity ? '🏢' : '👤'} {c.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Сумма заказа */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-zinc-500 uppercase tracking-wider pl-0.5">
                  Сумма заказа, ₽
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={order.amount}
                  onChange={(e) => updateOrder(idx, { amount: e.target.value })}
                  placeholder="0"
                  className="w-full rounded-2xl border-2 border-zinc-300 bg-white px-4 h-16 text-3xl font-black text-zinc-900 focus:border-orange-500 focus:outline-none"
                />
              </div>

              {/* Сумма за погрузку — ТОЛЬКО при «По городу» */}
              {tripKind === 'local' && (
                <div className="space-y-1.5 bg-orange-50/70 border-2 border-orange-200 rounded-2xl p-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-orange-900 uppercase tracking-wider">
                      📦 Сумма за погрузку, ₽
                    </label>
                    {order.driver_loader_pay && (
                      <button
                        type="button"
                        onClick={() => updateOrder(idx, { driver_loader_pay: '' })}
                        className="text-xs font-black text-rose-600"
                      >
                        Очистить
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={order.driver_loader_pay}
                    onChange={(e) => updateOrder(idx, { driver_loader_pay: e.target.value })}
                    placeholder="0"
                    className="w-full rounded-xl border-2 border-orange-300 bg-white px-4 h-12 text-2xl font-black text-zinc-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Способ оплаты — 3 компактные 1-строчные кнопки */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-zinc-500 uppercase tracking-wider pl-0.5">
                  Способ оплаты
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PAY_OPTIONS.map((opt) => {
                    const active = order.payment_method === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateOrder(idx, { payment_method: opt.value })}
                        className={`border-2 rounded-xl py-2.5 px-2 flex items-center justify-center gap-1 transition-all active:scale-95 ${
                          active ? opt.activeCls : 'border-zinc-200 bg-white text-zinc-800'
                        }`}
                      >
                        <span className="text-base leading-none">{opt.icon}</span>
                        <span className="font-black text-sm leading-none">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ЗП водителя + грузчики */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-0.5">
                  <label className="text-xs font-extrabold text-zinc-500 uppercase tracking-wider">
                    ЗП водителя, ₽
                  </label>
                  <button
                    type="button"
                    onClick={() => addLoaderToOrder(idx)}
                    className="text-xs font-black text-orange-600 active:scale-95"
                  >
                    + Грузчик
                  </button>
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  value={order.driver_pay}
                  onChange={(e) => updateOrder(idx, { driver_pay: e.target.value })}
                  placeholder="0"
                  className="w-full rounded-2xl border-2 border-zinc-300 bg-white px-4 h-14 text-2xl font-black text-zinc-900 focus:border-orange-500 focus:outline-none"
                />

                {order.loaders.length > 0 && (
                  <div className="space-y-2">
                    {order.loaders.map((loader, lIdx) => (
                      <div
                        key={lIdx}
                        className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl p-2"
                      >
                        <select
                          value={loader.id}
                          onChange={(e) => {
                            const found = allLoaders.find((x) => x.id === e.target.value);
                            updateLoader(idx, lIdx, {
                              id: e.target.value,
                              name: found?.name || '',
                            });
                          }}
                          className="flex-1 min-w-0 rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm font-black text-zinc-900"
                        >
                          <option value="">Грузчик</option>
                          {allLoaders.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={loader.pay}
                          onChange={(e) => updateLoader(idx, lIdx, { pay: e.target.value })}
                          placeholder="₽"
                          className="w-24 rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-base font-black text-zinc-900"
                        />
                        <button
                          type="button"
                          onClick={() => removeLoader(idx, lIdx)}
                          className="w-9 h-9 rounded-lg bg-white border border-zinc-200 text-rose-600 font-black text-lg flex items-center justify-center shrink-0"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Комментарий к заказу */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-zinc-500 uppercase tracking-wider pl-0.5">
                  Комментарий / груз
                </label>
                <input
                  type="text"
                  value={order.description}
                  onChange={(e) => updateOrder(idx, { description: e.target.value })}
                  placeholder="Груз, маршрут, адрес..."
                  className="w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 h-12 text-base font-bold text-zinc-900 focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>
          );
        })}

        {/* 6. Топливо и расходы (Кубик / АЗС / Расход) */}
        <div className="bg-white border-2 border-zinc-200 rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <span className="text-xs font-extrabold text-zinc-600 uppercase tracking-wider">
              ⛽ Топливо и расходы
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => addExpenseRow('cube')}
                className="text-xs font-black px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 active:scale-95"
              >
                + Кубик
              </button>
              <button
                type="button"
                onClick={() => addExpenseRow('fuel')}
                className="text-xs font-black px-2.5 py-1 rounded-lg bg-orange-100 text-orange-800 active:scale-95"
              >
                + АЗС
              </button>
              <button
                type="button"
                onClick={() => addExpenseRow('other')}
                className="text-xs font-black px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-700 active:scale-95"
              >
                + Расход
              </button>
            </div>
          </div>

          {expenses.length > 0 && (
            <div className="space-y-2">
              {expenses.map((exp, eIdx) =>
                exp.kind === 'cube' ? (
                  <div
                    key={exp.id}
                    className="flex items-center gap-1.5 bg-amber-50/70 border border-amber-200 rounded-xl p-2"
                  >
                    <span className="text-sm font-black text-amber-950 shrink-0 pl-1">🛢 Куб</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={exp.liters}
                      onChange={(e) => {
                        const liters = e.target.value;
                        const num = Number(liters) || 0;
                        updateExpense(eIdx, {
                          liters,
                          amount: num > 0 ? String(Math.round(num * cubePrice)) : exp.amount,
                        });
                      }}
                      placeholder="Л"
                      className="w-16 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm font-black text-zinc-900"
                    />
                    <span className="text-xs font-bold text-amber-800 shrink-0">л =</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={exp.amount}
                      onChange={(e) => updateExpense(eIdx, { amount: e.target.value })}
                      placeholder="₽"
                      className="flex-1 min-w-0 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-base font-black text-zinc-900"
                    />
                    <button
                      type="button"
                      onClick={() => removeExpense(eIdx)}
                      className="w-8 h-8 rounded-lg bg-white border border-amber-200 text-rose-600 font-black text-base flex items-center justify-center shrink-0"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div
                    key={exp.id}
                    className="space-y-1.5 bg-zinc-50 border border-zinc-200 rounded-xl p-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-zinc-800 shrink-0 pl-1">
                        {exp.kind === 'fuel' ? '⛽ АЗС' : '🧾 Расх.'}
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={exp.amount}
                        onChange={(e) => updateExpense(eIdx, { amount: e.target.value })}
                        placeholder="₽"
                        className="w-24 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-base font-black text-zinc-900"
                      />
                      <select
                        value={exp.payment_method}
                        onChange={(e) => updateExpense(eIdx, { payment_method: e.target.value })}
                        className="flex-1 min-w-0 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs font-bold text-zinc-700"
                      >
                        <option value="fuel_card">Карта / Opti24</option>
                        <option value="cash">Наличные</option>
                        <option value="bank_invoice">Р/С</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeExpense(eIdx)}
                        className="w-8 h-8 rounded-lg bg-white border border-zinc-200 text-rose-600 font-black text-base flex items-center justify-center shrink-0"
                      >
                        ×
                      </button>
                    </div>
                    {exp.kind === 'other' && (
                      <input
                        type="text"
                        value={exp.description}
                        onChange={(e) => updateExpense(eIdx, { description: e.target.value })}
                        placeholder="За что расход (мойка, шиномонтаж...)"
                        className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-bold text-zinc-800"
                      />
                    )}
                  </div>
                ),
              )}
            </div>
          )}
        </div>

        {/* 7. Спойлер: Машина, водитель, одометр, примечание */}
        <div className="bg-white border-2 border-zinc-200 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="w-full px-4 py-3 flex items-center justify-between text-left active:bg-zinc-50"
          >
            <span className="font-black text-sm text-zinc-800">⚙️ Машина, водитель, пробег</span>
            <span className="text-base font-black text-zinc-400">{moreOpen ? '▴' : '▾'}</span>
          </button>

          {moreOpen && (
            <div className="px-4 pb-4 pt-2 border-t border-zinc-100 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-extrabold text-zinc-500 uppercase mb-1">
                    Автомобиль
                  </label>
                  <select
                    value={assetId}
                    onChange={(e) => setAssetId(e.target.value)}
                    className="w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-2.5 h-11 text-sm font-black text-zinc-900"
                  >
                    <option value="">Не выбрано</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.short_name} ({v.reg_number})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold text-zinc-500 uppercase mb-1">
                    Водитель
                  </label>
                  <select
                    value={driverId}
                    onChange={(e) => setDriverId(e.target.value)}
                    className="w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-2.5 h-11 text-sm font-black text-zinc-900"
                  >
                    <option value="">Не выбран</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-extrabold text-zinc-500 uppercase mb-1">
                    Одометр старт
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={odometerStart}
                    onChange={(e) => setOdometerStart(e.target.value)}
                    className="w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-3 h-11 text-base font-black text-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold text-zinc-500 uppercase mb-1">
                    Одометр финиш
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={odometerEnd}
                    onChange={(e) => setOdometerEnd(e.target.value)}
                    className="w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-3 h-11 text-base font-black text-zinc-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-zinc-500 uppercase mb-1">
                  Заметка администратора
                </label>
                <input
                  type="text"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-3 h-11 text-sm font-bold text-zinc-900"
                />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl px-4 py-3 text-rose-700 text-sm font-black">
            {error}
          </div>
        )}
      </div>

      {/* ── Закреплённая нижняя кнопка ── */}
      <div className="shrink-0 p-4 bg-white border-t-2 border-zinc-200 shadow-lg pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full h-14 rounded-2xl bg-orange-600 hover:bg-orange-500 active:bg-orange-700 active:scale-[0.99] text-white font-black text-base uppercase tracking-wider shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span>✅</span>
            <span>{saving ? 'Сохраняем...' : 'Сохранить изменения'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
