'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Money } from '@saldacargo/ui';
import { formatPhone } from '@saldacargo/shared';

// ── Types ──────────────────────────────────────────────────────────────────

type Client = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  credit_limit: string | null;
  is_active: boolean;
  is_regular: boolean;
  total_revenue: string;
  revenue_30d: string;
  net_profit: string;
  overhead_pct: number;
  trips_count: number;
  orders_count: number;
  avg_order: string;
  last_trip_at: string | null;
  preferred_payment: string | null;
  payment_breakdown: Record<string, number>;
  monthly: string[];
  month_labels: string[];
};

type TripRecord = {
  id: string;
  trip_id: string;
  started_at: string | null;
  driver_name: string | null;
  asset_name: string | null;
  amount: string;
  driver_pay: string;
  loader_pay: string;
  fuel_allocated: string;
  gross_profit: string;
  payment_method: string;
};

type RecvData = {
  debtors: { counterparty_id: string; counterparty_name: string; total: string }[];
  totalAmount: string;
  overdueCount: number;
};

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Наличные',
  qr: 'QR-код',
  card_driver: 'Карта вод.',
  debt_cash: 'Долг',
  bank_invoice: 'Безналичный',
};

const PAYMENT_COLOR: Record<string, string> = {
  cash: 'bg-emerald-400',
  qr: 'bg-violet-400',
  card_driver: 'bg-blue-400',
  debt_cash: 'bg-rose-400',
  bank_invoice: 'bg-amber-400',
};

const emptyForm = { name: '', phone: '', email: '', credit_limit: '', notes: '' };

// ── Helpers ────────────────────────────────────────────────────────────────

function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function lastTripLabel(days: number | null) {
  if (days === null) return 'нет рейсов';
  if (days === 0) return 'сегодня';
  if (days === 1) return 'вчера';
  return `${days} дн. назад`;
}

function actColor(days: number | null) {
  if (days === null) return 'text-slate-300';
  if (days <= 7) return 'text-emerald-600';
  if (days <= 30) return 'text-slate-500';
  if (days <= 90) return 'text-amber-500';
  return 'text-rose-400';
}

function avatarCls(days: number | null) {
  if (days !== null && days <= 7) return 'bg-emerald-100 text-emerald-700';
  if (days !== null && days <= 30) return 'bg-orange-100 text-orange-700';
  if (days !== null && days <= 90) return 'bg-amber-50 text-amber-600';
  return 'bg-slate-100 text-slate-400';
}

function actBadge(days: number | null) {
  if (days === null) return null;
  if (days <= 7) return { label: 'Активен', cls: 'bg-emerald-50 text-emerald-700' };
  if (days <= 30) return { label: 'Активен', cls: 'bg-slate-100 text-slate-500' };
  if (days <= 90) return { label: 'Тихо', cls: 'bg-amber-50 text-amber-600' };
  return { label: 'Спящий', cls: 'bg-rose-50 text-rose-500' };
}

function rubShort(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + ' M₽';
  if (n >= 1000) return Math.round(n / 1000) + ' т₽';
  return n + ' ₽';
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

// ── Email copy ─────────────────────────────────────────────────────────────

function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() =>
        navigator.clipboard.writeText(email).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
      }
      className="ml-1 text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
    >
      {copied ? '✓' : 'копир.'}
    </button>
  );
}

// ── Client list row ────────────────────────────────────────────────────────

function ClientRow({
  client: c,
  debt,
  selected,
  mergeMode,
  mergeSelected,
  onSelect,
  onMergeToggle,
}: {
  client: Client;
  debt: number;
  selected: boolean;
  mergeMode: boolean;
  mergeSelected: boolean;
  onSelect: () => void;
  onMergeToggle: () => void;
}) {
  const days = daysAgo(c.last_trip_at);
  return (
    <div
      onClick={mergeMode ? onMergeToggle : onSelect}
      className={[
        'client-row flex items-center gap-3 px-4 py-3 cursor-pointer border-l-2 border-transparent transition-colors',
        selected && !mergeMode ? 'selected' : 'hover:bg-slate-50',
        mergeMode && mergeSelected ? 'bg-blue-50 !border-l-blue-400' : '',
        !c.is_active ? 'opacity-40' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {mergeMode ? (
        <div
          className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${mergeSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}
        >
          {mergeSelected && <span className="text-white text-[9px] font-black">✓</span>}
        </div>
      ) : (
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${avatarCls(days)}`}
        >
          {c.name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-800 truncate leading-tight">{c.name}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-400">
            <Money amount={c.total_revenue} />
          </span>
          {debt > 0 && (
            <span className="text-[10px] bg-rose-50 text-rose-600 px-1 py-px rounded font-semibold">
              Долг
            </span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-[11px] ${actColor(days)}`}>{lastTripLabel(days)}</div>
        <div className="text-[10px] text-slate-400 mt-0.5">{c.trips_count} рейс.</div>
      </div>
    </div>
  );
}

// ── Detail panel ───────────────────────────────────────────────────────────

function ClientDetail({
  client: c,
  debt,
  tripHistory,
  onEdit,
  onToggleActive,
  onPromote,
  onDelete,
}: {
  client: Client;
  debt: number;
  tripHistory: TripRecord[] | undefined;
  onEdit: () => void;
  onToggleActive: () => void;
  onPromote: () => void;
  onDelete: () => void;
}) {
  const days = daysAgo(c.last_trip_at);
  const badge = actBadge(days);
  const monthly = c.monthly.map((v) => parseFloat(v));
  const maxBar = Math.max(...monthly, 1);
  const labels = c.month_labels;
  const topPay = Object.entries(c.payment_breakdown)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  const overheadPct = c.overhead_pct;
  const netProfit = parseFloat(c.net_profit);
  const isNetPositive = netProfit >= 0;

  return (
    <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
      {/* Шапка клиента */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0 ${avatarCls(days)}`}
          >
            {c.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 leading-tight">{c.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {c.phone && (
                <a href={`tel:${c.phone}`} className="text-sm text-slate-500 hover:text-slate-700">
                  {formatPhone(c.phone)}
                </a>
              )}
              {c.email && (
                <span className="text-sm text-slate-400 flex items-center">
                  {c.email}
                  <CopyEmail email={c.email} />
                </span>
              )}
              {badge && (
                <span className={`text-[10px] ${badge.cls} px-1.5 py-0.5 rounded font-semibold`}>
                  {badge.label}
                </span>
              )}
              {c.is_regular && (
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">
                  Постоянный
                </span>
              )}
              {debt > 0 && (
                <span className="text-[10px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded font-semibold">
                  Долг: <Money amount={debt.toFixed(2)} />
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onEdit}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors"
          >
            Редакт.
          </button>
          <button
            onClick={onPromote}
            className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium"
          >
            {c.is_regular ? '↓ В разовые' : '★ В пост.'}
          </button>
        </div>
      </div>

      {/* KPI — 4 плитки */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-slate-50 rounded-xl p-3.5">
          <div className="text-xs text-slate-400 mb-1">Выручка всего</div>
          <div className="text-lg font-bold text-slate-900">
            {parseFloat(c.total_revenue) > 0 ? <Money amount={c.total_revenue} /> : '—'}
          </div>
        </div>
        <div className={`rounded-xl p-3.5 ${isNetPositive ? 'bg-emerald-50' : 'bg-rose-50'}`}>
          <div className={`text-xs mb-1 ${isNetPositive ? 'text-emerald-600' : 'text-rose-500'}`}>
            Чист. прибыль
          </div>
          <div
            className={`text-lg font-bold ${isNetPositive ? 'text-emerald-700' : 'text-rose-600'}`}
          >
            {parseFloat(c.total_revenue) > 0 ? <Money amount={c.net_profit} /> : '—'}
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3.5">
          <div className="text-xs text-slate-400 mb-1">Рейсов</div>
          <div className="text-lg font-bold text-slate-900">{c.trips_count}</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3.5">
          <div className="text-xs text-slate-400 mb-1">Ср. выручка / рейс</div>
          <div className="text-lg font-bold text-slate-900">
            {parseFloat(c.avg_order) > 0 ? <Money amount={c.avg_order} /> : '—'}
          </div>
        </div>
      </div>

      {/* Состав чист. прибыли */}
      {parseFloat(c.total_revenue) > 0 && (
        <div className="mb-5 px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
          <span>
            Выручка{' '}
            <span className="text-slate-700 font-semibold">
              <Money amount={c.total_revenue} />
            </span>
          </span>
          <span className="text-slate-300">−</span>
          <span>
            ЗП+ГСМ{' '}
            <span className="text-slate-700 font-semibold">
              <Money
                amount={(
                  parseFloat(c.total_revenue) * (1 - overheadPct) -
                  parseFloat(c.net_profit)
                ).toFixed(2)}
              />
            </span>
          </span>
          <span className="text-slate-300">−</span>
          <span>
            Накладные{' '}
            <span className="text-slate-700 font-semibold">{Math.round(overheadPct * 100)}%</span>
          </span>
          <span className="text-slate-300">=</span>
          <span
            className={isNetPositive ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}
          >
            <Money amount={c.net_profit} />
          </span>
        </div>
      )}

      {/* Столбчатый график по месяцам */}
      <div className="mb-5">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Выручка по месяцам
        </div>
        <div className="flex items-end gap-2 h-20">
          {monthly.map((v, i) => {
            const h = v > 0 ? Math.max(Math.round((v / maxBar) * 72), 4) : 0;
            const isLast = i === monthly.length - 1;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[10px] text-slate-400 font-medium">
                  {v > 0 ? rubShort(v) : '—'}
                </div>
                <div
                  className={`w-full rounded-t-lg transition-all ${isLast ? 'bg-slate-900' : 'bg-slate-200'}`}
                  style={{ height: `${h}px`, minHeight: v > 0 ? '4px' : '0' }}
                />
                <div className="text-[10px] text-slate-400">{labels[i]}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Нижний ряд: оплата + детали */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Способы оплаты
          </div>
          {topPay.length > 0 ? (
            <div className="space-y-2">
              {topPay.map(([pm, pct]) => (
                <div key={pm} className="flex items-center gap-2">
                  <div className="w-28 text-xs text-slate-600 shrink-0">
                    {PAYMENT_LABEL[pm] ?? pm}
                  </div>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`${PAYMENT_COLOR[pm] ?? 'bg-slate-400'} h-full rounded-full`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-xs font-bold text-slate-600 w-8 text-right">{pct}%</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-300">Нет данных</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Детали
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Последний рейс</span>
            <span className={`${actColor(days)} font-medium`}>{lastTripLabel(days)}</span>
          </div>
          {c.credit_limit && parseFloat(c.credit_limit) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Кредитный лимит</span>
              <span className="text-slate-700 font-medium">
                <Money amount={c.credit_limit} />
              </span>
            </div>
          )}
          {debt > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Дебиторка</span>
              <span className="text-rose-600 font-semibold">
                <Money amount={debt.toFixed(2)} />
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Статус</span>
            <span className="text-slate-700">{c.is_regular ? 'Постоянный' : 'Разовый'}</span>
          </div>
          {c.notes && (
            <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-800 leading-relaxed">
              {c.notes}
            </div>
          )}
          <div className="pt-2 space-y-1.5">
            <button
              onClick={onToggleActive}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-400 hover:bg-slate-50 transition-colors"
            >
              <span>{c.is_active ? '⊗' : '↺'}</span>
              {c.is_active ? 'В архив' : 'Восстановить'}
            </button>
            {c.orders_count === 0 && (
              <button
                onClick={onDelete}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl border border-rose-100 text-xs font-semibold text-rose-400 hover:bg-rose-50 transition-colors"
              >
                <span>🗑</span> Удалить
              </button>
            )}
          </div>
        </div>
      </div>

      {/* История рейсов */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          История рейсов
        </div>
        {tripHistory === undefined ? (
          <div className="space-y-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse bg-slate-50 rounded-xl" />
            ))}
          </div>
        ) : tripHistory.length === 0 ? (
          <p className="text-xs text-slate-300 py-3 text-center">Нет завершённых рейсов</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-slate-400 uppercase tracking-wide border-b border-slate-100">
                  <th className="text-left pb-2 font-semibold">Дата</th>
                  <th className="text-left pb-2 font-semibold">Водитель</th>
                  <th className="text-left pb-2 font-semibold">Машина</th>
                  <th className="text-right pb-2 font-semibold">Выручка</th>
                  <th className="text-right pb-2 font-semibold">ЗП+Груз</th>
                  <th className="text-right pb-2 font-semibold">ГСМ</th>
                  <th className="text-right pb-2 font-semibold">Чистая</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tripHistory.map((t) => {
                  const amount = parseFloat(t.amount);
                  const labor = parseFloat(t.driver_pay) + parseFloat(t.loader_pay);
                  const fuel = parseFloat(t.fuel_allocated);
                  const gross = parseFloat(t.gross_profit);
                  const net = gross - amount * overheadPct;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 text-slate-500">{fmtDate(t.started_at)}</td>
                      <td className="py-2.5 text-slate-700 font-medium max-w-[100px] truncate">
                        {t.driver_name ?? '—'}
                      </td>
                      <td className="py-2.5 text-slate-500">{t.asset_name ?? '—'}</td>
                      <td className="py-2.5 text-right text-slate-700 font-medium">
                        <Money amount={t.amount} />
                      </td>
                      <td className="py-2.5 text-right text-slate-400">
                        {labor > 0 ? <Money amount={labor.toFixed(2)} /> : '—'}
                      </td>
                      <td className="py-2.5 text-right text-slate-400">
                        {fuel > 0 ? <Money amount={fuel.toFixed(2)} /> : '—'}
                      </td>
                      <td
                        className={`py-2.5 text-right font-semibold ${net >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}
                      >
                        <Money amount={net.toFixed(2)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Merge panel ────────────────────────────────────────────────────────────

function MergePanel({
  clients,
  selected,
  onConfirm,
  pending,
  error,
}: {
  clients: Client[];
  selected: Set<string>;
  onConfirm: (sourceId: string, targetId: string) => void;
  pending: boolean;
  error: string;
}) {
  const [a, b] = Array.from(selected);
  if (!a || !b) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 font-medium">
        Выберите двух клиентов из списка ({selected.size} / 2)
      </div>
    );
  }
  const ca = clients.find((c) => c.id === a)!;
  const cb = clients.find((c) => c.id === b)!;
  const targetId = parseFloat(ca.total_revenue) >= parseFloat(cb.total_revenue) ? a : b;
  const sourceId = targetId === a ? b : a;
  const target = clients.find((c) => c.id === targetId)!;
  const source = clients.find((c) => c.id === sourceId)!;
  const mergedRevenue = (
    parseFloat(source.total_revenue) + parseFloat(target.total_revenue)
  ).toFixed(2);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
        Предпросмотр объединения
      </p>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
        <div className="bg-white rounded-lg border border-rose-200 px-3 py-2">
          <p className="text-[9px] font-bold text-rose-400 uppercase">Будет деактивирован</p>
          <p className="text-sm font-bold text-slate-800 truncate mt-0.5">{source.name}</p>
        </div>
        <span className="text-blue-300 font-black text-lg">+</span>
        <div className="bg-white rounded-lg border border-emerald-200 px-3 py-2">
          <p className="text-[9px] font-bold text-emerald-500 uppercase">Останется</p>
          <p className="text-sm font-bold text-slate-800 truncate mt-0.5">{target.name}</p>
        </div>
      </div>
      <div className="bg-white rounded-lg border-2 border-blue-300 px-3 py-2 flex items-center justify-between">
        <p className="text-sm font-bold text-slate-900">{target.name}</p>
        <p className="text-sm font-black text-slate-900">
          <Money amount={mergedRevenue} />
        </p>
      </div>
      {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}
      <button
        onClick={() => onConfirm(sourceId, targetId)}
        disabled={pending}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
      >
        {pending ? 'Объединяю...' : `Объединить → ${target.name}`}
      </button>
    </div>
  );
}

// ── Client form modal ──────────────────────────────────────────────────────

function ClientModal({
  editId,
  form,
  setForm,
  onSave,
  onClose,
  saving,
  error,
}: {
  editId: string | null;
  form: typeof emptyForm;
  setForm: (f: typeof emptyForm) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  error: string;
}) {
  const inp =
    'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-slate-300 outline-none';
  return (
    <div className="fixed inset-0 z-50" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-96 bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">
            {editId ? 'Редактировать клиента' : 'Новый клиент'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Название / Имя *
            </label>
            <input
              className={inp}
              placeholder="ООО Металлург или Иванов И.И."
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Телефон</label>
            <input
              type="tel"
              className={inp}
              placeholder="+7 922 000-00-00"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Email</label>
            <input
              type="email"
              className={inp}
              placeholder="client@company.ru"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Кредитный лимит
            </label>
            <input
              type="number"
              className={inp}
              placeholder="0 — без лимита"
              value={form.credit_limit}
              onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
            />
            <p className="text-xs text-slate-400 mt-1">
              При превышении — предупреждение при создании рейса
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Заметки</label>
            <textarea
              rows={3}
              className={`${inp} resize-none`}
              placeholder="Особенности работы, контактное лицо..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        {error && <p className="mx-5 mb-2 text-xs text-rose-600 font-medium">{error}</p>}
        <div className="p-5 border-t border-slate-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 py-2.5 text-sm bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Oneoff aggregate tab ───────────────────────────────────────────────────

function OneoffAggregateTab({ irregular, regular }: { irregular: Client[]; regular: Client[] }) {
  const overhead_pct = irregular[0]?.overhead_pct ?? regular[0]?.overhead_pct ?? 0;

  const totalRevIrreg = irregular.reduce((s, c) => s + parseFloat(c.total_revenue), 0);
  const totalRevReg = regular.reduce((s, c) => s + parseFloat(c.total_revenue), 0);
  const totalRevAll = totalRevIrreg + totalRevReg;

  const totalNetIrreg = irregular.reduce((s, c) => s + parseFloat(c.net_profit), 0);
  const totalNetReg = regular.reduce((s, c) => s + parseFloat(c.net_profit), 0);
  const totalNetAll = totalNetIrreg + totalNetReg;

  const totalGrossIrreg = totalNetIrreg + totalRevIrreg * overhead_pct;
  const totalGrossReg = totalNetReg + totalRevReg * overhead_pct;
  const totalGrossAll = totalGrossIrreg + totalGrossReg;

  const tripsIrreg = irregular.reduce((s, c) => s + c.trips_count, 0);
  const tripsReg = regular.reduce((s, c) => s + c.trips_count, 0);

  const avgRevIrreg = tripsIrreg > 0 ? totalRevIrreg / tripsIrreg : 0;
  const avgRevReg = tripsReg > 0 ? totalRevReg / tripsReg : 0;
  const avgNetIrreg = tripsIrreg > 0 ? totalNetIrreg / tripsIrreg : 0;
  const avgNetReg = tripsReg > 0 ? totalNetReg / tripsReg : 0;
  const marginIrreg = totalRevIrreg > 0 ? (totalNetIrreg / totalRevIrreg) * 100 : 0;
  const marginReg = totalRevReg > 0 ? (totalNetReg / totalRevReg) * 100 : 0;

  const revShareIrreg = totalRevAll > 0 ? Math.round((totalRevIrreg / totalRevAll) * 100) : 0;
  const grossShareIrreg =
    totalGrossAll > 0 ? Math.round((totalGrossIrreg / totalGrossAll) * 100) : 0;
  const netShareIrreg =
    totalNetAll !== 0 ? Math.round((totalNetIrreg / Math.abs(totalNetAll)) * 100) : 0;

  const monthlyData =
    irregular.length > 0
      ? irregular[0].monthly.map((_, i) =>
          irregular.reduce((s, c) => s + parseFloat(c.monthly[i] ?? '0'), 0),
        )
      : Array(6).fill(0);
  const monthLabels = irregular[0]?.month_labels ?? [];
  const maxMonthly = Math.max(...monthlyData, 1);

  return (
    <div className="space-y-4">
      {/* KPI — 4 плитки */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-3">
          <div className="text-[11px] text-slate-400 mb-1">Разовых клиентов</div>
          <div className="text-xl font-bold text-slate-900">{irregular.length}</div>
          <div className="text-[11px] text-amber-600 mt-1">{tripsIrreg} рейсов всего</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-3">
          <div className="text-[11px] text-slate-400 mb-1">Выручка разовых</div>
          <div className="text-xl font-bold text-slate-900">
            {totalRevIrreg > 0 ? <Money amount={totalRevIrreg.toFixed(2)} /> : '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">{revShareIrreg}% от общей выручки</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-3">
          <div className="text-[11px] text-slate-400 mb-1">Валовая прибыль</div>
          <div className="text-xl font-bold text-slate-900">
            {totalGrossIrreg > 0 ? <Money amount={totalGrossIrreg.toFixed(2)} /> : '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">{grossShareIrreg}% от общей вал.п.</div>
        </div>
        <div
          className={`rounded-2xl border p-3 ${totalNetIrreg >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}
        >
          <div
            className={`text-[11px] mb-1 ${totalNetIrreg >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}
          >
            Чистая прибыль
          </div>
          <div
            className={`text-xl font-bold ${totalNetIrreg >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}
          >
            {totalRevIrreg > 0 ? <Money amount={totalNetIrreg.toFixed(2)} /> : '—'}
          </div>
          <div
            className={`text-[11px] mt-1 ${totalNetIrreg >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}
          >
            {netShareIrreg}% от общей ЧП
          </div>
        </div>
      </div>

      {/* Сетка 2×1 */}
      <div className="grid grid-cols-2 gap-4">
        {/* Сравнение с постоянными */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-sm font-semibold text-slate-800 mb-4">
            Разовые vs Постоянные клиенты
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-slate-400 uppercase tracking-wide">
                <th className="text-left pb-2 font-semibold">Метрика</th>
                <th className="text-right pb-2 font-semibold text-slate-600">Пост.</th>
                <th className="text-right pb-2 font-semibold text-amber-600">Разовые</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <tr>
                <td className="py-2.5 text-slate-500 text-xs">Рейсов</td>
                <td className="py-2.5 text-right font-semibold text-slate-700">{tripsReg}</td>
                <td className="py-2.5 text-right font-semibold text-amber-700">{tripsIrreg}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-500 text-xs">Ср. выручка / рейс</td>
                <td className="py-2.5 text-right font-semibold text-slate-700">
                  {avgRevReg > 0 ? <Money amount={avgRevReg.toFixed(2)} /> : '—'}
                </td>
                <td className="py-2.5 text-right font-semibold text-amber-700">
                  {avgRevIrreg > 0 ? <Money amount={avgRevIrreg.toFixed(2)} /> : '—'}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-500 text-xs">Ср. ЧП / рейс</td>
                <td className="py-2.5 text-right font-semibold text-slate-700">
                  {avgNetReg !== 0 ? <Money amount={avgNetReg.toFixed(2)} /> : '—'}
                </td>
                <td className="py-2.5 text-right font-semibold text-amber-700">
                  {avgNetIrreg !== 0 ? <Money amount={avgNetIrreg.toFixed(2)} /> : '—'}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-500 text-xs">Маржинальность</td>
                <td className="py-2.5 text-right">
                  <span
                    className={`font-bold text-sm ${marginReg >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                  >
                    {marginReg.toFixed(1)}%
                  </span>
                </td>
                <td className="py-2.5 text-right">
                  <span
                    className={`font-bold text-sm ${marginIrreg >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                  >
                    {marginIrreg.toFixed(1)}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Доля в структуре */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide mb-2.5">
              Доля в общей прибыли
            </div>
            {[
              { label: 'Выручка', val: revShareIrreg },
              { label: 'Вал. прибыль', val: grossShareIrreg },
              { label: 'Чист. прибыль', val: netShareIrreg },
            ].map(({ label, val }) => (
              <div key={label} className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] text-slate-500 w-24 shrink-0">{label}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-400 h-full rounded-full"
                    style={{ width: `${Math.max(0, val)}%` }}
                  />
                </div>
                <span className="text-[11px] font-bold text-amber-700 w-8 text-right">{val}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Динамика */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-sm font-semibold text-slate-800 mb-4">Динамика выручки</div>
          {monthlyData.some((v) => v > 0) ? (
            <>
              <div className="flex items-end gap-2 h-36">
                {monthlyData.map((v, i) => {
                  const h = v > 0 ? Math.max(Math.round((v / maxMonthly) * 130), 4) : 0;
                  const isLast = i === monthlyData.length - 1;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-[10px] text-slate-400">{v > 0 ? rubShort(v) : ''}</div>
                      <div
                        className={`w-full rounded-t-lg ${isLast ? 'bg-amber-500' : 'bg-amber-200'}`}
                        style={{ height: `${h}px`, minHeight: v > 0 ? '4px' : '0' }}
                      />
                      <div className="text-[10px] text-slate-400">{monthLabels[i]}</div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-300 text-center py-10">Нет данных за 6 месяцев</p>
          )}

          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide mb-3">
              Вывод
            </div>
            {totalRevIrreg > 0 ? (
              <div className="text-sm text-slate-600 leading-relaxed">
                {marginIrreg > marginReg ? (
                  <span>
                    Разовые клиенты <strong className="text-emerald-700">выгоднее</strong>{' '}
                    постоянных по маржинальности: {marginIrreg.toFixed(1)}% vs{' '}
                    {marginReg.toFixed(1)}%.
                  </span>
                ) : marginIrreg > 0 ? (
                  <span>
                    Постоянные клиенты выгоднее: маржа {marginReg.toFixed(1)}% vs{' '}
                    {marginIrreg.toFixed(1)}% у разовых.
                  </span>
                ) : (
                  <span className="text-rose-600">
                    Разовые клиенты убыточны при текущих расходах.
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Нет завершённых рейсов</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Client list panel (shared by both tabs) ────────────────────────────────

function ClientListPanel({
  list,
  isLoading,
  selectedId,
  debtMap,
  mergeMode,
  mergeSelected,
  showInactive,
  search,
  onSearch,
  onSelect,
  onMergeToggle,
  onToggleInactive,
  onToggleMerge,
}: {
  list: Client[];
  isLoading: boolean;
  selectedId: string | null;
  debtMap: Map<string, number>;
  mergeMode: boolean;
  mergeSelected: Set<string>;
  showInactive: boolean;
  search: string;
  onSearch: (v: string) => void;
  onSelect: (id: string) => void;
  onMergeToggle: (id: string) => void;
  onToggleInactive: () => void;
  onToggleMerge: () => void;
}) {
  return (
    <div className="w-80 flex-shrink-0">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-100">
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Поиск по имени..."
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-slate-300 outline-none"
          />
        </div>

        <div className="overflow-y-auto divide-y divide-slate-100" style={{ maxHeight: '580px' }}>
          {isLoading ? (
            [1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-[60px] animate-pulse bg-slate-50 border-b border-slate-50"
              />
            ))
          ) : list.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400">Нет клиентов</div>
          ) : (
            list.map((c) => (
              <ClientRow
                key={c.id}
                client={c}
                debt={debtMap.get(c.id) ?? 0}
                selected={selectedId === c.id}
                mergeMode={mergeMode}
                mergeSelected={mergeSelected.has(c.id)}
                onSelect={() => onSelect(c.id)}
                onMergeToggle={() => onMergeToggle(c.id)}
              />
            ))
          )}
        </div>

        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleMerge}
              className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${mergeMode ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
            >
              {mergeMode ? '✕ Отмена' : '⇋ Объединить'}
            </button>
            <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer ml-auto">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={onToggleInactive}
                className="accent-slate-600"
              />
              Архив
            </label>
            <span className="text-[10px] text-slate-300">{list.length} кл.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const qc = useQueryClient();

  const [tab, setTab] = useState<'regular' | 'oneoff'>('regular');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSelected, setMergeSelected] = useState<Set<string>>(new Set());
  const [mergeError, setMergeError] = useState('');

  const [oneoffView, setOneoffView] = useState<'analytics' | 'list'>('analytics');

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => fetch('/api/counterparties').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const { data: receivables } = useQuery<RecvData>({
    queryKey: ['receivables'],
    queryFn: () => fetch('/api/receivables').then((r) => r.json()),
    staleTime: 2 * 60 * 1000,
  });

  const { data: tripHistory } = useQuery<TripRecord[]>({
    queryKey: ['client-trips', selectedId],
    queryFn: () => fetch(`/api/counterparties/${selectedId!}/trips`).then((r) => r.json()),
    enabled: !!selectedId,
    staleTime: 5 * 60 * 1000,
  });

  const debtMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of receivables?.debtors ?? []) {
      if (!String(d.counterparty_id).startsWith('__')) {
        m.set(d.counterparty_id, parseFloat(d.total));
      }
    }
    return m;
  }, [receivables]);

  // Derived lists
  const activeClients = clients.filter((c) => c.is_active);
  const regular = activeClients.filter((c) => c.is_regular);
  const irregular = activeClients.filter((c) => !c.is_regular);
  const totalRevReg = regular.reduce((s, c) => s + parseFloat(c.total_revenue), 0);
  const totalRevIrreg = irregular.reduce((s, c) => s + parseFloat(c.total_revenue), 0);
  const totalRevAll = totalRevReg + totalRevIrreg;
  const totalTripsIrreg = irregular.reduce((s, c) => s + c.trips_count, 0);
  const revPctReg = totalRevAll > 0 ? Math.round((totalRevReg / totalRevAll) * 100) : 0;
  const revPctIrreg = totalRevAll > 0 ? Math.round((totalRevIrreg / totalRevAll) * 100) : 0;

  function getList(isRegular: boolean) {
    const q = search.toLowerCase();
    return clients
      .filter((c) => {
        if (!showInactive && !c.is_active) return false;
        if (c.is_regular !== isRegular) return false;
        if (q)
          return (
            c.name.toLowerCase().includes(q) ||
            (c.phone ?? '').includes(q) ||
            (c.email ?? '').toLowerCase().includes(q)
          );
        return true;
      })
      .sort((a, b) => parseFloat(b.total_revenue) - parseFloat(a.total_revenue));
  }

  const regularList = getList(true);
  const currentList = tab === 'regular' ? regularList : getList(false);
  const selectedClient = clients.find((c) => c.id === selectedId) ?? null;

  // Auto-select first in regular list
  const firstId = regularList[0]?.id;
  if (tab === 'regular' && !selectedId && firstId) setSelectedId(firstId);

  // ── Mutations ──

  const saveMutation = useMutation({
    mutationFn: (body: typeof emptyForm) => {
      const url = editId ? `/api/counterparties/${editId}` : '/api/counterparties';
      return fetch(url, {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? 'Ошибка');
        return json;
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      setFormError('');
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const mergeMutation = useMutation({
    mutationFn: ({ source_id, target_id }: { source_id: string; target_id: string }) =>
      fetch('/api/counterparties/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id, target_id }),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? 'Ошибка');
        return json;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      setMergeMode(false);
      setMergeSelected(new Set());
      setMergeError('');
    },
    onError: (e: Error) => setMergeError(e.message),
  });

  const toggleActive = (c: Client) =>
    fetch(`/api/counterparties/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !c.is_active }),
    }).then(() => qc.invalidateQueries({ queryKey: ['clients'] }));

  const promoteClient = (c: Client) =>
    fetch(`/api/counterparties/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_regular: !c.is_regular }),
    }).then(() => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      setSelectedId(null);
    });

  const deleteClient = async (c: Client) => {
    if (!confirm(`Удалить «${c.name}»? Это действие необратимо.`)) return;
    const res = await fetch(`/api/counterparties/${c.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error ?? 'Ошибка удаления');
      return;
    }
    if (selectedId === c.id) setSelectedId(null);
    qc.invalidateQueries({ queryKey: ['clients'] });
  };

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (c: Client) => {
    setEditId(c.id);
    setForm({
      name: c.name,
      phone: c.phone ?? '',
      email: c.email ?? '',
      credit_limit: c.credit_limit ?? '',
      notes: c.notes ?? '',
    });
    setFormError('');
    setShowForm(true);
  };

  const handleMergeToggle = (id: string) => {
    setMergeSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 2) {
        next.add(id);
      }
      return next;
    });
    setMergeError('');
  };

  const switchTab = (t: 'regular' | 'oneoff') => {
    setTab(t);
    setSelectedId(null);
    setSearch('');
    setMergeMode(false);
    if (t === 'regular') setOneoffView('analytics');
    setMergeSelected(new Set());
  };

  // ── Render ──

  return (
    <>
      <style>{`
        .client-row { border-left: 2px solid transparent; }
        .client-row.selected { background: #f8fafc; border-left-color: #0f172a; }
        .client-row:not(.selected):hover { background: #f8fafc; }
      `}</style>

      <div className="flex flex-col max-w-7xl mx-auto animate-in fade-in duration-300">
        {/* ── KPI плитки — grid 5 колонок ── */}
        <div className="grid grid-cols-5 gap-3 mb-4 pt-2">
          <div className="bg-white rounded-2xl border border-slate-200 p-3">
            <div className="text-[11px] text-slate-400 mb-0.5">Постоянных клиентов</div>
            <div className="text-xl font-bold text-slate-900">{regular.length}</div>
            <div className="text-[11px] text-emerald-600 mt-0.5">
              {irregular.length > 0 ? `+ ${irregular.length} разовых` : 'все активны'}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-3">
            <div className="text-[11px] text-slate-400 mb-0.5">Выручка постоянных</div>
            <div className="text-xl font-bold text-slate-900">
              {totalRevReg > 0 ? <Money amount={totalRevReg.toFixed(2)} /> : '—'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {revPctReg > 0 ? `${revPctReg}% от общей` : '—'}
            </div>
          </div>
          <div className="bg-amber-50 rounded-2xl border border-amber-100 p-3">
            <div className="text-[11px] text-amber-600 mb-0.5">Разовых рейсов</div>
            <div className="text-xl font-bold text-amber-700">{totalTripsIrreg}</div>
            <div className="text-[11px] text-amber-500 mt-0.5">за всё время</div>
          </div>
          <div className="bg-amber-50 rounded-2xl border border-amber-100 p-3">
            <div className="text-[11px] text-amber-600 mb-0.5">Выручка разовых</div>
            <div className="text-xl font-bold text-amber-700">
              {totalRevIrreg > 0 ? <Money amount={totalRevIrreg.toFixed(2)} /> : '—'}
            </div>
            <div className="text-[11px] text-amber-500 mt-0.5">
              {revPctIrreg > 0 ? `${revPctIrreg}% от общей` : '—'}
            </div>
          </div>
          <div className="bg-slate-900 rounded-2xl p-3 text-white">
            <div className="text-[11px] text-slate-400 mb-0.5">Всего выручки</div>
            <div className="text-xl font-bold">
              {totalRevAll > 0 ? <Money amount={totalRevAll.toFixed(2)} /> : '—'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">все клиенты</div>
          </div>
        </div>

        {/* ── Табы + кнопка ── */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => switchTab('regular')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'regular' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            >
              Постоянные клиенты
              <span className="ml-1.5 text-xs bg-white text-slate-600 px-1.5 py-0.5 rounded-md font-semibold">
                {regular.length}
              </span>
            </button>
            <button
              onClick={() => switchTab('oneoff')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'oneoff' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            >
              Разовые клиенты
              <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md font-semibold">
                {irregular.length}
              </span>
            </button>
          </div>

          {tab === 'oneoff' && (
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              <button
                onClick={() => {
                  setOneoffView('analytics');
                  setSelectedId(null);
                  setSearch('');
                  setMergeMode(false);
                  setMergeSelected(new Set());
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${oneoffView === 'analytics' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                📊 Аналитика
              </button>
              <button
                onClick={() => setOneoffView('list')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${oneoffView === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                📋 Список
              </button>
            </div>
          )}

          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Добавить клиента
          </button>
        </div>

        {/* ── Merge panel ── */}
        {mergeMode && (
          <div className="mb-4">
            <MergePanel
              clients={clients}
              selected={mergeSelected}
              onConfirm={(s, t) => mergeMutation.mutate({ source_id: s, target_id: t })}
              pending={mergeMutation.isPending}
              error={mergeError}
            />
          </div>
        )}

        {/* ══ Таб 1: Постоянные — список + детали ══ */}
        {tab === 'regular' && (
          <div className="flex gap-4">
            <ClientListPanel
              list={currentList}
              isLoading={isLoading}
              selectedId={selectedId}
              debtMap={debtMap}
              mergeMode={mergeMode}
              mergeSelected={mergeSelected}
              showInactive={showInactive}
              search={search}
              onSearch={setSearch}
              onSelect={setSelectedId}
              onMergeToggle={handleMergeToggle}
              onToggleInactive={() => setShowInactive((v) => !v)}
              onToggleMerge={() => {
                setMergeMode((v) => !v);
                setMergeSelected(new Set());
                setMergeError('');
              }}
            />

            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-2xl border border-slate-200">
                {selectedClient ? (
                  <ClientDetail
                    client={selectedClient}
                    debt={debtMap.get(selectedClient.id) ?? 0}
                    tripHistory={tripHistory}
                    onEdit={() => openEdit(selectedClient)}
                    onToggleActive={() => toggleActive(selectedClient)}
                    onPromote={() => promoteClient(selectedClient)}
                    onDelete={() => deleteClient(selectedClient)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                    <p className="text-3xl mb-3">👈</p>
                    <p className="text-sm font-bold text-slate-400">Выберите клиента</p>
                    <p className="text-xs text-slate-300 mt-1">Детали появятся здесь</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ Таб 2: Разовые — аналитика или список ══ */}
        {tab === 'oneoff' && oneoffView === 'analytics' && (
          <OneoffAggregateTab irregular={irregular} regular={regular} />
        )}
        {tab === 'oneoff' && oneoffView === 'list' && (
          <div className="flex gap-4">
            <ClientListPanel
              list={currentList}
              isLoading={isLoading}
              selectedId={selectedId}
              debtMap={debtMap}
              mergeMode={mergeMode}
              mergeSelected={mergeSelected}
              showInactive={showInactive}
              search={search}
              onSearch={setSearch}
              onSelect={setSelectedId}
              onMergeToggle={handleMergeToggle}
              onToggleInactive={() => setShowInactive((v) => !v)}
              onToggleMerge={() => {
                setMergeMode((v) => !v);
                setMergeSelected(new Set());
                setMergeError('');
              }}
            />
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-2xl border border-slate-200">
                {selectedClient ? (
                  <ClientDetail
                    client={selectedClient}
                    debt={debtMap.get(selectedClient.id) ?? 0}
                    tripHistory={tripHistory}
                    onEdit={() => openEdit(selectedClient)}
                    onToggleActive={() => toggleActive(selectedClient)}
                    onPromote={() => promoteClient(selectedClient)}
                    onDelete={() => deleteClient(selectedClient)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                    <p className="text-3xl mb-3">👈</p>
                    <p className="text-sm font-bold text-slate-400">Выберите клиента</p>
                    <p className="text-xs text-slate-300 mt-1">Детали появятся здесь</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Модалка ── */}
      {showForm && (
        <ClientModal
          editId={editId}
          form={form}
          setForm={setForm}
          onSave={() => saveMutation.mutate(form)}
          onClose={() => {
            setShowForm(false);
            setEditId(null);
            setFormError('');
          }}
          saving={saveMutation.isPending}
          error={formError}
        />
      )}
    </>
  );
}
