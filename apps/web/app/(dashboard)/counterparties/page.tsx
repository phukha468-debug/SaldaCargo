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
  trips_count: number;
  orders_count: number;
  avg_order: string;
  last_trip_at: string | null;
  preferred_payment: string | null;
  payment_breakdown: Record<string, number>;
  monthly: string[];
  month_labels: string[];
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

// компактный формат суммы для графика
function rubShort(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + ' M₽';
  if (n >= 1000) return Math.round(n / 1000) + ' т₽';
  return n + ' ₽';
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
  onEdit,
  onToggleActive,
  onPromote,
  onDelete,
}: {
  client: Client;
  debt: number;
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
            {c.is_regular ? '↓ В новые' : '★ В пост.'}
          </button>
        </div>
      </div>

      {/* KPI строка — 4 плитки */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-slate-50 rounded-xl p-3.5">
          <div className="text-xs text-slate-400 mb-1">Выручка всего</div>
          <div className="text-lg font-bold text-slate-900">
            {parseFloat(c.total_revenue) > 0 ? <Money amount={c.total_revenue} /> : '—'}
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3.5">
          <div className="text-xs text-slate-400 mb-1">За 30 дней</div>
          <div
            className={`text-lg font-bold ${parseFloat(c.revenue_30d) > 0 ? 'text-slate-900' : 'text-slate-300'}`}
          >
            {parseFloat(c.revenue_30d) > 0 ? <Money amount={c.revenue_30d} /> : '—'}
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

      {/* Столбчатый график по месяцам */}
      <div className="mb-5">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Выручка по месяцам
        </div>
        <div className="flex items-end gap-2 h-28">
          {monthly.map((v, i) => {
            const h = v > 0 ? Math.max(Math.round((v / maxBar) * 100), 4) : 0;
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
      <div className="grid grid-cols-2 gap-4">
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
            <span className="text-slate-700">{c.is_regular ? 'Постоянный' : 'Нерегулярный'}</span>
          </div>
          {c.notes && (
            <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-800 leading-relaxed">
              {c.notes}
            </div>
          )}
          {/* Archive / Delete actions */}
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

// ── Client form modal (slide-in right panel) ───────────────────────────────

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

// ── Tab 2: Разовые / сегменты ──────────────────────────────────────────────

function OneoffTab({ clients, debtMap }: { clients: Client[]; debtMap: Map<string, number> }) {
  const irregular = clients.filter((c) => c.is_active && !c.is_regular);
  const regular = clients.filter((c) => c.is_active && c.is_regular);
  const totalRevIrreg = irregular.reduce((s, c) => s + parseFloat(c.total_revenue), 0);
  const totalRevReg = regular.reduce((s, c) => s + parseFloat(c.total_revenue), 0);
  const totalTripsIrreg = irregular.reduce((s, c) => s + c.trips_count, 0);
  const totalTripsReg = regular.reduce((s, c) => s + c.trips_count, 0);
  const totalTripsAll = totalTripsIrreg + totalTripsReg;
  const tripsPct = totalTripsAll > 0 ? Math.round((totalTripsIrreg / totalTripsAll) * 100) : 0;
  const avgOrd = totalTripsIrreg > 0 ? totalRevIrreg / totalTripsIrreg : 0;
  const avgOrdReg = totalTripsReg > 0 ? totalRevReg / totalTripsReg : 0;

  // Monthly chart — sum of all irregular clients' monthly revenue
  const monthlyData =
    irregular.length > 0
      ? irregular[0].monthly.map((_, i) =>
          irregular.reduce((s, c) => s + parseFloat(c.monthly[i] ?? '0'), 0),
        )
      : [];
  const monthLabels = irregular[0]?.month_labels ?? [];
  const maxMonthly = Math.max(...monthlyData, 1);

  // Sorted irregular clients for the table
  const sorted = [...irregular].sort(
    (a, b) => parseFloat(b.total_revenue) - parseFloat(a.total_revenue),
  );
  const maxRev = parseFloat(sorted[0]?.total_revenue ?? '1') || 1;

  return (
    <div className="space-y-5">
      {/* KPI — 3 плитки */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-xs text-slate-400 mb-1">Всего нерегулярных рейсов</div>
          <div className="text-3xl font-bold text-slate-900">{totalTripsIrreg}</div>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full" style={{ width: `${tripsPct}%` }} />
            </div>
            <span className="text-xs text-slate-400">{tripsPct}% от всех рейсов</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-xs text-slate-400 mb-1">Выручка нерегулярных</div>
          <div className="text-3xl font-bold text-slate-900">
            {totalRevIrreg > 0 ? <Money amount={totalRevIrreg.toFixed(2)} /> : '—'}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            {totalTripsAll > 0
              ? `${Math.round((totalRevIrreg / (totalRevIrreg + totalRevReg)) * 100)}% от общей`
              : '—'}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-xs text-slate-400 mb-1">Средний чек нерегулярного</div>
          <div className="text-3xl font-bold text-slate-900">
            {avgOrd > 0 ? <Money amount={avgOrd.toFixed(2)} /> : '—'}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            {avgOrdReg > 0 ? (
              <>
                vs <Money amount={avgOrdReg.toFixed(2)} /> у постоянных
              </>
            ) : (
              '—'
            )}
          </div>
        </div>
      </div>

      {/* Сетка 2×2 */}
      <div className="grid grid-cols-2 gap-4">
        {/* Нерегулярные клиенты — таблица */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-sm font-semibold text-slate-800 mb-4">Нерегулярные клиенты</div>
          {sorted.length === 0 ? (
            <p className="text-sm text-slate-400">Нет клиентов</p>
          ) : (
            <div className="space-y-3">
              {sorted.map((c) => {
                const debt = debtMap.get(c.id) ?? 0;
                const days = daysAgo(c.last_trip_at);
                const barW = Math.round((parseFloat(c.total_revenue) / maxRev) * 100);
                return (
                  <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${avatarCls(days)}`}
                      >
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-800 truncate">
                          {c.name}
                        </div>
                        <div className="text-xs text-slate-400">
                          {c.trips_count} рейс. · ср. чек{' '}
                          {parseFloat(c.avg_order) > 0 ? <Money amount={c.avg_order} /> : '—'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-slate-900">
                          <Money amount={c.total_revenue} />
                        </div>
                        {debt > 0 && (
                          <div className="text-[10px] text-rose-600 font-semibold">
                            Долг: <Money amount={debt.toFixed(2)} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 w-14">Выручка</span>
                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-400 h-full rounded-full"
                            style={{ width: `${barW}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-bold ml-1 ${actColor(days)}`}>
                          {lastTripLabel(days)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Динамика по месяцам */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold text-slate-800">Динамика нерегулярных</div>
            <div className="flex gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-3 h-1 bg-amber-400 rounded inline-block" />
                Выручка
              </span>
            </div>
          </div>
          {monthlyData.length > 0 ? (
            <>
              <div className="flex items-end gap-2 h-36 mt-2">
                {monthlyData.map((v, i) => {
                  const h = v > 0 ? Math.max(Math.round((v / maxMonthly) * 130), 4) : 0;
                  const isLast = i === monthlyData.length - 1;
                  return (
                    <div key={i} className="flex-1 flex items-end gap-0.5">
                      <div
                        className={`flex-1 rounded-t-md transition-all ${isLast ? 'bg-amber-500' : 'bg-amber-300'}`}
                        style={{ height: `${h}px`, minHeight: v > 0 ? '3px' : '0' }}
                        title={v > 0 ? `${rubShort(v)}` : '—'}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-1">
                {monthLabels.map((m, i) => (
                  <div key={i} className="flex-1 text-center text-[10px] text-slate-400">
                    {m}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-300 text-center py-8">Нет данных</p>
          )}

          {/* Откуда приходят */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Откуда приходят
            </div>
            <div className="space-y-2.5">
              {[
                { icon: '📱', label: 'Мессенджер / звонок', sub: 'Клиент пишет сам', pct: '62%' },
                { icon: '🤝', label: 'Рекомендации', sub: 'От постоянных клиентов', pct: '28%' },
                { icon: '📍', label: 'Объявления', sub: 'Авито, 2GIS', pct: '10%' },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center text-sm shrink-0">
                    {s.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-slate-700 font-medium">{s.label}</div>
                    <div className="text-[10px] text-slate-400">{s.sub}</div>
                  </div>
                  <div className="text-xs font-bold text-slate-700">{s.pct}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Совет */}
        <div className="col-span-2 bg-slate-50 rounded-2xl border border-slate-200 px-5 py-4 flex items-start gap-3">
          <span className="text-xl shrink-0">💡</span>
          <div className="text-sm text-slate-500 leading-relaxed">
            <strong className="text-slate-700">Разовые физлица без профиля</strong> (переезды,
            доставки из магазинов) не видны здесь — они не привязаны к контрагенту. Если клиент
            вернулся повторно — создайте профиль. Все долги по разовым видны в{' '}
            <strong>Финансы → Дебиторка</strong>.
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
  const [filter, setFilter] = useState<'all' | 'active' | 'debt' | 'dormant'>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSelected, setMergeSelected] = useState<Set<string>>(new Set());
  const [mergeError, setMergeError] = useState('');

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

  const debtMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of receivables?.debtors ?? []) {
      if (!String(d.counterparty_id).startsWith('__')) {
        m.set(d.counterparty_id, parseFloat(d.total));
      }
    }
    return m;
  }, [receivables]);

  // Derived
  const activeClients = clients.filter((c) => c.is_active);
  const regular = activeClients.filter((c) => c.is_regular);
  const irregular = activeClients.filter((c) => !c.is_regular);
  const totalRevReg = regular.reduce((s, c) => s + parseFloat(c.total_revenue), 0);
  const totalRevIrreg = irregular.reduce((s, c) => s + parseFloat(c.total_revenue), 0);
  const totalRevAll = totalRevReg + totalRevIrreg;
  const totalTripsIrreg = irregular.reduce((s, c) => s + c.trips_count, 0);
  const revPctReg = totalRevAll > 0 ? Math.round((totalRevReg / totalRevAll) * 100) : 0;
  const revPctIrreg = totalRevAll > 0 ? Math.round((totalRevIrreg / totalRevAll) * 100) : 0;

  // Filtered list
  function getFiltered() {
    const q = search.toLowerCase();
    return clients
      .filter((c) => {
        if (!showInactive && !c.is_active) return false;
        if (filter === 'active') return parseFloat(c.revenue_30d) > 0;
        if (filter === 'debt') return (debtMap.get(c.id) ?? 0) > 0;
        if (filter === 'dormant') {
          const d = daysAgo(c.last_trip_at);
          return d === null || d > 60;
        }
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

  const list = getFiltered();
  const selectedClient = clients.find((c) => c.id === selectedId) ?? null;

  // Auto-select first
  const firstId = list[0]?.id;
  if (!selectedId && firstId) setSelectedId(firstId);

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
    }).then(() => qc.invalidateQueries({ queryKey: ['clients'] }));

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

  // ── Render ──

  return (
    <>
      <style>{`
        .client-row { border-left: 2px solid transparent; }
        .client-row.selected { background: #f8fafc; border-left-color: #0f172a; }
        .client-row:not(.selected):hover { background: #f8fafc; }
      `}</style>

      <div className="flex flex-col max-w-7xl mx-auto animate-in fade-in duration-300">
        {/* ── Заголовок ── */}
        <div className="pt-2 pb-3 flex items-start justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Контрагенты</h1>
        </div>

        {/* ── KPI плитки — grid 5 колонок ── */}
        <div className="grid grid-cols-5 gap-3 mb-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="text-xs text-slate-400 mb-1">Постоянных клиентов</div>
            <div className="text-2xl font-bold text-slate-900">{regular.length}</div>
            <div className="text-xs text-emerald-600 mt-1">
              {irregular.length > 0 ? `+ ${irregular.length} нерегулярных` : 'все активны'}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="text-xs text-slate-400 mb-1">Выручка постоянных</div>
            <div className="text-2xl font-bold text-slate-900">
              {totalRevReg > 0 ? <Money amount={totalRevReg.toFixed(2)} /> : '—'}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {revPctReg > 0 ? `${revPctReg}% от общей` : '—'}
            </div>
          </div>
          <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
            <div className="text-xs text-amber-600 mb-1">Нерегулярных рейсов</div>
            <div className="text-2xl font-bold text-amber-700">{totalTripsIrreg}</div>
            <div className="text-xs text-amber-500 mt-1">за всё время</div>
          </div>
          <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
            <div className="text-xs text-amber-600 mb-1">Выручка нерегулярных</div>
            <div className="text-2xl font-bold text-amber-700">
              {totalRevIrreg > 0 ? <Money amount={totalRevIrreg.toFixed(2)} /> : '—'}
            </div>
            <div className="text-xs text-amber-500 mt-1">
              {revPctIrreg > 0 ? `${revPctIrreg}% от общей` : '—'}
            </div>
          </div>
          <div className="bg-slate-900 rounded-2xl p-4 text-white">
            <div className="text-xs text-slate-400 mb-1">Всего выручки</div>
            <div className="text-2xl font-bold">
              {totalRevAll > 0 ? <Money amount={totalRevAll.toFixed(2)} /> : '—'}
            </div>
            <div className="text-xs text-slate-400 mt-1">все клиенты</div>
          </div>
        </div>

        {/* ── Табы ── */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-4">
          <button
            onClick={() => setTab('regular')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'regular' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
          >
            Постоянные клиенты
            <span
              className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-md font-semibold ${tab === 'regular' ? 'bg-white text-slate-600' : 'bg-white text-slate-600'}`}
            >
              {regular.length}
            </span>
          </button>
          <button
            onClick={() => setTab('oneoff')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'oneoff' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
          >
            Разовые / сегменты
            <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md font-semibold">
              {totalTripsIrreg}
            </span>
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

        {/* ══ Таб 1: Постоянные клиенты ══ */}
        {tab === 'regular' && (
          <div className="flex gap-4">
            {/* ── Левая панель: список (w-80) ── */}
            <div className="w-80 flex-shrink-0">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {/* Поиск + фильтры */}
                <div className="p-3 border-b border-slate-100 space-y-2">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Поиск по имени..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-slate-300 outline-none"
                  />
                  <div className="flex gap-1">
                    {(['all', 'active', 'debt', 'dormant'] as const).map((f) => {
                      const labels = {
                        all: 'Все',
                        active: 'Активные',
                        debt: 'С долгом',
                        dormant: 'Спящие',
                      };
                      return (
                        <button
                          key={f}
                          onClick={() => setFilter(f)}
                          className={`flex-1 py-1 text-xs rounded-lg font-medium transition-colors ${filter === f ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                        >
                          {labels[f]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Список */}
                <div
                  className="overflow-y-auto divide-y divide-slate-100"
                  style={{ maxHeight: '580px' }}
                >
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
                        onSelect={() => setSelectedId(c.id)}
                        onMergeToggle={() => handleMergeToggle(c.id)}
                      />
                    ))
                  )}
                </div>

                {/* Нижняя панель */}
                <div className="p-3 border-t border-slate-100 space-y-2">
                  <button
                    onClick={openCreate}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors"
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setMergeMode((v) => !v);
                        setMergeSelected(new Set());
                        setMergeError('');
                      }}
                      className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${mergeMode ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                    >
                      {mergeMode ? '✕ Отмена' : '⇋ Объединить'}
                    </button>
                    <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer ml-auto">
                      <input
                        type="checkbox"
                        checked={showInactive}
                        onChange={(e) => setShowInactive(e.target.checked)}
                        className="accent-slate-600"
                      />
                      Архив
                    </label>
                    <span className="text-[10px] text-slate-300">{list.length} кл.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Правая панель: детали ── */}
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-2xl border border-slate-200">
                {selectedClient ? (
                  <ClientDetail
                    client={selectedClient}
                    debt={debtMap.get(selectedClient.id) ?? 0}
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

        {/* ══ Таб 2: Разовые / сегменты ══ */}
        {tab === 'oneoff' && <OneoffTab clients={clients} debtMap={debtMap} />}
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
