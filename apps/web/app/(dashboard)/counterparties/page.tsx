'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useEffect } from 'react';
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
  if (days <= 7) return 'text-emerald-600 font-semibold';
  if (days <= 30) return 'text-slate-500';
  if (days <= 90) return 'text-amber-500';
  return 'text-rose-400';
}

function avatarCls(days: number | null) {
  if (days !== null && days <= 7) return 'bg-emerald-100 text-emerald-700';
  if (days !== null && days <= 30) return 'bg-orange-100 text-orange-700';
  return 'bg-slate-100 text-slate-500';
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
        'flex items-center gap-2.5 px-3 py-2.5 cursor-pointer border-l-2 transition-colors select-none border-b border-slate-50',
        selected && !mergeMode
          ? 'bg-slate-900 border-l-slate-900'
          : 'border-l-transparent hover:bg-slate-50',
        mergeMode && mergeSelected ? 'bg-blue-50 border-l-blue-400' : '',
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
          className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${selected && !mergeMode ? 'bg-white/20 text-white' : avatarCls(days)}`}
        >
          {c.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-semibold truncate leading-tight ${selected && !mergeMode ? 'text-white' : 'text-slate-800'}`}
        >
          {c.name}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className={`text-[10px] ${selected && !mergeMode ? 'text-slate-300' : actColor(days)}`}
          >
            {lastTripLabel(days)}
          </span>
          {debt > 0 && (
            <span
              className={`text-[10px] font-bold ${selected ? 'text-rose-300' : 'text-rose-500'}`}
            >
              · долг
            </span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div
          className={`text-xs font-semibold ${selected && !mergeMode ? 'text-slate-200' : 'text-slate-600'}`}
        >
          {parseFloat(c.total_revenue) > 0 ? <Money amount={c.total_revenue} /> : '—'}
        </div>
        <div
          className={`text-[10px] ${selected && !mergeMode ? 'text-slate-400' : 'text-slate-400'}`}
        >
          {c.trips_count} рейс.
        </div>
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
  const netProfit = parseFloat(c.net_profit);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Name + badges */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-start gap-3">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center text-base font-bold shrink-0 ${avatarCls(days)}`}
          >
            {c.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-900 leading-tight">{c.name}</h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {c.is_regular ? (
                <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded uppercase tracking-wide">
                  Постоянный
                </span>
              ) : (
                <span className="text-[9px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded uppercase tracking-wide">
                  Новый
                </span>
              )}
              {!c.is_active && (
                <span className="text-[9px] font-bold px-2 py-0.5 bg-rose-100 text-rose-600 rounded uppercase tracking-wide">
                  Архив
                </span>
              )}
              <span className={`text-[10px] ${actColor(days)}`}>{lastTripLabel(days)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Debt banner — from receivables only */}
      {debt > 0 && (
        <div className="mx-4 mt-3 px-3 py-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold text-rose-500 uppercase tracking-wide">
              Дебиторская задолженность
            </p>
            <p className="text-base font-black text-rose-700 mt-0.5">
              <Money amount={debt.toFixed(2)} />
            </p>
          </div>
          <span className="text-[9px] text-rose-400 text-right leading-tight">
            из раздела
            <br />
            Финансы
          </span>
        </div>
      )}

      {/* KPI grid */}
      <div className="px-5 py-4 grid grid-cols-2 gap-2.5 border-b border-slate-100">
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            Выручка всего
          </p>
          <p className="text-base font-black text-slate-900 mt-1">
            {parseFloat(c.total_revenue) > 0 ? <Money amount={c.total_revenue} /> : '—'}
          </p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            За 30 дней
          </p>
          <p
            className={`text-base font-black mt-1 ${parseFloat(c.revenue_30d) > 0 ? 'text-emerald-600' : 'text-slate-300'}`}
          >
            {parseFloat(c.revenue_30d) > 0 ? <Money amount={c.revenue_30d} /> : '—'}
          </p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            Чистая прибыль
          </p>
          <p
            className={`text-base font-black mt-1 ${netProfit > 0 ? 'text-indigo-600' : netProfit < 0 ? 'text-rose-500' : 'text-slate-300'}`}
          >
            {parseFloat(c.total_revenue) > 0 ? <Money amount={c.net_profit} /> : '—'}
          </p>
          {parseFloat(c.total_revenue) > 0 && (
            <p className="text-[9px] text-slate-400 mt-0.5">выручка − ЗП − ГСМ</p>
          )}
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            Рейсов / ср. чек
          </p>
          <p className="text-base font-black text-slate-900 mt-1">{c.trips_count}</p>
          {parseFloat(c.avg_order) > 0 && (
            <p className="text-[10px] text-slate-400 mt-0.5">
              ср. <Money amount={c.avg_order} />
            </p>
          )}
        </div>
      </div>

      {/* Contacts */}
      <div className="px-5 py-3 space-y-2 border-b border-slate-100">
        {c.phone && (
          <div className="flex items-center gap-2">
            <span className="text-slate-300 text-sm shrink-0">📞</span>
            <a
              href={`tel:${c.phone}`}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {formatPhone(c.phone)}
            </a>
          </div>
        )}
        {c.email && (
          <div className="flex items-center gap-2">
            <span className="text-slate-300 text-sm shrink-0">✉</span>
            <span className="text-sm text-slate-600">{c.email}</span>
            <CopyEmail email={c.email} />
          </div>
        )}
        {c.notes && (
          <div className="flex items-start gap-2">
            <span className="text-slate-300 text-sm shrink-0 mt-0.5">💬</span>
            <p className="text-sm text-slate-400 italic">{c.notes}</p>
          </div>
        )}
        {!c.phone && !c.email && !c.notes && (
          <p className="text-xs text-slate-300">Контакты не указаны</p>
        )}
      </div>

      {/* Payment breakdown */}
      {Object.keys(c.payment_breakdown).length > 0 && (
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
            Способы оплаты
          </p>
          <div className="space-y-1.5">
            {Object.entries(c.payment_breakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([pm, pct]) => (
                <div key={pm} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 w-24 shrink-0">
                    {PAYMENT_LABEL[pm] ?? pm}
                  </span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`${PAYMENT_COLOR[pm] ?? 'bg-slate-400'} h-full rounded-full`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 w-8 text-right">
                    {pct}%
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-4 space-y-2 mt-auto">
        <button
          onClick={onEdit}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <span>✎</span> Редактировать
        </button>
        <button
          onClick={onPromote}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-colors ${c.is_regular ? 'border-slate-200 text-slate-400 hover:bg-slate-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}
        >
          <span>{c.is_regular ? '↓' : '★'}</span>
          {c.is_regular ? 'Перевести в новые' : 'В постоянные'}
        </button>
        <button
          onClick={onToggleActive}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-400 hover:bg-slate-50 transition-colors"
        >
          <span>{c.is_active ? '⊗' : '↺'}</span>
          {c.is_active ? 'В архив' : 'Восстановить'}
        </button>
        {c.orders_count === 0 && (
          <button
            onClick={onDelete}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-rose-100 bg-white text-sm font-semibold text-rose-400 hover:bg-rose-50 transition-colors"
          >
            <span>🗑</span> Удалить
          </button>
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
    'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 transition-colors';
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-black text-slate-900">
            {editId ? 'Редактировать клиента' : 'Новый клиент'}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-lg flex items-center justify-center transition-colors"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-5 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
              Название / Имя *
            </label>
            <input
              className={inp}
              placeholder="ООО Агрострой или Иванов П.П."
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
              Телефон
            </label>
            <input
              className={inp}
              placeholder="+7 999 123-45-67"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
              E-mail
            </label>
            <input
              type="email"
              className={inp}
              placeholder="client@company.ru"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
              Кредитный лимит (₽)
            </label>
            <input
              type="number"
              className={inp}
              placeholder="50 000"
              value={form.credit_limit}
              onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
              Примечание
            </label>
            <input
              className={inp}
              placeholder="Постоянный с 2024"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        {error && <p className="mx-6 mb-3 text-xs text-rose-600 font-medium">{error}</p>}
        <div className="px-6 pb-5 flex gap-2">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 bg-slate-900 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            onClick={onClose}
            className="px-5 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab 2: Разовые / сегменты ──────────────────────────────────────────────

function OneoffTab({ clients, debtMap }: { clients: Client[]; debtMap: Map<string, number> }) {
  const irregular = clients.filter((c) => c.is_active && !c.is_regular);
  const totalRev = irregular.reduce((s, c) => s + parseFloat(c.total_revenue), 0);
  const totalTrips = irregular.reduce((s, c) => s + c.trips_count, 0);
  const active30 = irregular.filter((c) => parseFloat(c.revenue_30d) > 0).length;
  const avgOrder = totalTrips > 0 ? totalRev / totalTrips : 0;
  const totalDebt = irregular.reduce((s, c) => s + (debtMap.get(c.id) ?? 0), 0);

  const sorted = [...irregular].sort(
    (a, b) => parseFloat(b.total_revenue) - parseFloat(a.total_revenue),
  );
  const maxRev = parseFloat(sorted[0]?.total_revenue ?? '1') || 1;

  return (
    <div className="space-y-4">
      {/* KPI */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <p className="text-xs text-amber-600 mb-1">Нерегулярных клиентов</p>
          <p className="text-2xl font-bold text-amber-800">{irregular.length}</p>
          <p className="text-xs text-amber-500 mt-1">{active30} активны в 30 дн.</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-xs text-slate-400 mb-1">Выручка</p>
          <p className="text-2xl font-bold text-slate-900">
            {totalRev > 0 ? <Money amount={totalRev.toFixed(2)} /> : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-1">{totalTrips} рейсов</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-xs text-slate-400 mb-1">Средний чек</p>
          <p className="text-2xl font-bold text-slate-900">
            {avgOrder > 0 ? <Money amount={avgOrder.toFixed(2)} /> : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-1">за рейс</p>
        </div>
        <div
          className={`${totalDebt > 0 ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-200'} border rounded-2xl p-4`}
        >
          <p className={`text-xs mb-1 ${totalDebt > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
            Дебиторка
          </p>
          <p className={`text-2xl font-bold ${totalDebt > 0 ? 'text-rose-700' : 'text-slate-300'}`}>
            {totalDebt > 0 ? <Money amount={totalDebt.toFixed(2)} /> : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-1">из Финансы → Дебиторка</p>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-slate-700">Нерегулярные клиенты</span>
            <span className="ml-2 text-xs text-slate-400">отсортированы по выручке</span>
          </div>
          <span className="text-xs text-slate-400 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
            Чтобы перевести в постоянные — выберите на вкладке «Постоянные»
          </span>
        </div>

        {/* Table header */}
        <div
          className="grid px-5 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wide"
          style={{ gridTemplateColumns: '1fr 9rem 7rem 7rem 7rem 8rem' }}
        >
          <div>Клиент</div>
          <div className="text-right">Выручка</div>
          <div className="text-right">30 дней</div>
          <div className="text-right">Рейсов</div>
          <div className="text-right">Ср. чек</div>
          <div>Активность</div>
        </div>

        {sorted.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">Нерегулярных клиентов нет</div>
        ) : (
          sorted.map((c) => {
            const days = daysAgo(c.last_trip_at);
            const debt = debtMap.get(c.id) ?? 0;
            const barW = Math.round((parseFloat(c.total_revenue) / maxRev) * 100);
            return (
              <div
                key={c.id}
                className="grid px-5 py-3 border-b border-slate-100 hover:bg-slate-50 items-center"
                style={{ gridTemplateColumns: '1fr 9rem 7rem 7rem 7rem 8rem' }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">{c.name}</span>
                    {debt > 0 && (
                      <span className="text-[10px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded font-bold">
                        Долг <Money amount={debt.toFixed(2)} />
                      </span>
                    )}
                  </div>
                  <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden w-40">
                    <div
                      className="h-full bg-amber-300 rounded-full"
                      style={{ width: `${barW}%` }}
                    />
                  </div>
                </div>
                <div className="text-right text-sm font-semibold text-slate-700">
                  {parseFloat(c.total_revenue) > 0 ? <Money amount={c.total_revenue} /> : '—'}
                </div>
                <div
                  className={`text-right text-sm ${parseFloat(c.revenue_30d) > 0 ? 'text-emerald-600 font-semibold' : 'text-slate-300'}`}
                >
                  {parseFloat(c.revenue_30d) > 0 ? <Money amount={c.revenue_30d} /> : '—'}
                </div>
                <div className="text-right text-sm text-slate-600">{c.trips_count}</div>
                <div className="text-right text-sm text-slate-600">
                  {parseFloat(c.avg_order) > 0 ? <Money amount={c.avg_order} /> : '—'}
                </div>
                <div className={`text-sm ${actColor(days)}`}>{lastTripLabel(days)}</div>
              </div>
            );
          })
        )}
      </div>

      {/* Hint */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 px-5 py-4 flex items-start gap-3">
        <span className="text-xl shrink-0">💡</span>
        <div className="text-sm text-slate-500 leading-relaxed">
          <strong className="text-slate-700">Разовые без профиля</strong> (физлица, которым звонят
          напрямую) не отображаются здесь, так как не привязаны к контрагенту. Если клиент приехал
          снова — создайте профиль и привяжите к нему рейсы. Долги по разовым видны в{' '}
          <strong>Финансы → Дебиторка</strong>.
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

  // Debt map — keyed by counterparty_id, real counterparties only
  const debtMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of receivables?.debtors ?? []) {
      if (!String(d.counterparty_id).startsWith('__')) {
        m.set(d.counterparty_id, parseFloat(d.total));
      }
    }
    return m;
  }, [receivables]);

  // Derived counts
  const activeClients = clients.filter((c) => c.is_active);
  const regular = activeClients.filter((c) => c.is_regular);
  const irregular = activeClients.filter((c) => !c.is_regular);
  const activeCount = activeClients.filter((c) => parseFloat(c.revenue_30d) > 0).length;
  const totalRevenue = activeClients.reduce((s, c) => s + parseFloat(c.total_revenue), 0);
  const totalDebt = parseFloat(receivables?.totalAmount ?? '0');

  // Auto-select first on mount / filter change
  useEffect(() => {
    const list = getFiltered();
    if (list.length > 0 && !list.find((c) => c.id === selectedId)) {
      setSelectedId(list[0]?.id ?? null);
    }
  }, [clients, filter, search, showInactive]);

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

  // ── Render ──

  return (
    <div className="flex flex-col gap-3 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* ── Компактная шапка: заголовок + KPI плитки ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-black text-slate-900 shrink-0">Контрагенты</h1>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm flex flex-col items-center min-w-[72px]">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              Постоянных
            </p>
            <p className="text-lg font-black text-slate-900">{regular.length}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm flex flex-col items-center min-w-[72px]">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              Активных
            </p>
            <p className="text-lg font-black text-emerald-600">{activeCount}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm flex flex-col items-center min-w-[88px]">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Выручка</p>
            <p className="text-lg font-black text-orange-600">
              {totalRevenue > 0 ? <Money amount={totalRevenue.toFixed(2)} /> : '—'}
            </p>
          </div>
          {totalDebt > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 shadow-sm flex flex-col items-center min-w-[88px]">
              <p className="text-[9px] font-bold text-rose-400 uppercase tracking-widest">
                Дебиторка
              </p>
              <p className="text-lg font-black text-rose-600">
                <Money amount={totalDebt.toFixed(2)} />
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Табы ── */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('regular')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab === 'regular' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Постоянные
          <span
            className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-md font-bold ${tab === 'regular' ? 'bg-white/20 text-white' : 'bg-white text-slate-600'}`}
          >
            {regular.length}
          </span>
        </button>
        <button
          onClick={() => setTab('oneoff')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab === 'oneoff' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Нерегулярные
          <span
            className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-md font-bold ${tab === 'oneoff' ? 'bg-amber-400/80 text-white' : 'bg-amber-100 text-amber-700'}`}
          >
            {irregular.length}
          </span>
        </button>
      </div>

      {/* ── Merge panel ── */}
      {mergeMode && (
        <MergePanel
          clients={clients}
          selected={mergeSelected}
          onConfirm={(s, t) => mergeMutation.mutate({ source_id: s, target_id: t })}
          pending={mergeMutation.isPending}
          error={mergeError}
        />
      )}

      {/* ══ Таб 1: Постоянные ══ */}
      {tab === 'regular' && (
        <div className="grid grid-cols-[320px_1fr] gap-4 items-start">
          {/* Левая панель: список */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {/* Фильтры */}
            <div className="px-3 pt-3 pb-0">
              <div className="flex gap-1 mb-2">
                {(['all', 'active', 'debt', 'dormant'] as const).map((f) => {
                  const labels = {
                    all: 'Все',
                    active: 'Активные',
                    debt: 'Долг',
                    dormant: 'Спящие',
                  };
                  return (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`flex-1 py-1 text-[11px] font-semibold rounded-lg transition-colors ${filter === f ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                    >
                      {labels[f]}
                    </button>
                  );
                })}
              </div>
              <div className="relative mb-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-sm">
                  🔍
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-400 transition-colors"
                />
              </div>
            </div>

            {/* Список */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
              {isLoading ? (
                <div className="space-y-0">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="h-12 border-b border-slate-50 animate-pulse bg-slate-50"
                    />
                  ))}
                </div>
              ) : list.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-2xl mb-2">🏢</p>
                  <p className="text-sm font-semibold text-slate-400">
                    {search ? 'Ничего не найдено' : 'Список пуст'}
                  </p>
                </div>
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

            {/* Нижняя панель списка: добавить + утилиты */}
            <div className="px-3 py-2.5 border-t border-slate-100 space-y-2">
              <button
                onClick={openCreate}
                className="w-full flex items-center justify-center gap-2 py-2 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors"
              >
                + Добавить клиента
              </button>
              <div className="flex items-center gap-3">
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

          {/* Правая панель: детали */}
          <div
            className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden sticky top-4"
            style={{ maxHeight: 'calc(100vh - 160px)' }}
          >
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
      )}

      {/* ══ Таб 2: Нерегулярные ══ */}
      {tab === 'oneoff' && <OneoffTab clients={clients} debtMap={debtMap} />}

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
    </div>
  );
}
