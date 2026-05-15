'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Money } from '@saldacargo/ui';
import { formatDate, formatPhone } from '@saldacargo/shared';

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = 'expenses' | 'recv' | 'loans' | 'payables';

type ExpenseTx = {
  id: string;
  amount: string;
  description: string | null;
  created_at: string;
  category: { name: string; code: string } | null;
};

type ExpenseMonthData = {
  transactions: ExpenseTx[];
  revenue: string;
  pnl: unknown[];
};

type RecvOrder = {
  id: string;
  type: 'trip_order' | 'manual';
  amount: string;
  payment_method: string | null;
  description: string | null;
  created_at: string;
  trip_number: number | null;
  started_at: string | null;
  driver_name: string | null;
};

type FollowUp = {
  status: 'active' | 'promised' | 'disputed' | 'bad_debt';
  promise_date: string | null;
  last_contact_at: string | null;
  next_contact_at: string | null;
  notes: string | null;
  updated_at: string;
};

type Debtor = {
  counterparty_id: string;
  counterparty_name: string;
  counterparty_phone: string | null;
  counterparty_email: string | null;
  counterparty_subname: string | null;
  is_individual: boolean;
  total: string;
  oldest_at: string;
  orders: RecvOrder[];
  follow_up: FollowUp | null;
};

type ReceivablesData = {
  debtors: Debtor[];
  totalAmount: string;
  overdueCount: number;
};

type Loan = {
  id: string;
  lender_name: string;
  loan_type: string;
  purpose: string | null;
  original_amount: string;
  remaining_amount: string;
  annual_rate: string | null;
  monthly_payment: string | null;
  started_at: string;
  ends_at: string | null;
  next_payment_date: string | null;
  notes: string | null;
};

type Supplier = {
  id: string;
  name: string;
  icon: string;
  description: string;
  debt: string;
  debtDays: number;
  history: {
    id: string;
    amount: string;
    description: string | null;
    settlement_status: string;
    created_at: string;
  }[];
};

// ── Helpers ────────────────────────────────────────────────────────────────

function todayMonth() {
  return new Date().toISOString().slice(0, 7);
}
function formatMonthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}
function daysAgo(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}
function shortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
function n(s: string | null | undefined) {
  return parseFloat(s ?? '0') || 0;
}
function rub(amount: number) {
  return amount.toLocaleString('ru-RU') + ' ₽';
}

// ── Category colours ────────────────────────────────────────────────────────

type ExpenseGroup = {
  id: string;
  name: string;
  color: string;
  fixed: boolean;
  match: (tx: {
    category?: { name: string; code: string } | null;
    description?: string | null;
  }) => boolean;
};

const EXPENSE_GROUPS: ExpenseGroup[] = [
  {
    id: 'salary',
    name: 'Зарплата',
    color: '#3b82f6',
    fixed: true,
    match: (tx) =>
      ['зарплат', 'фот', 'аванс', 'payroll', 'зп ', 'оплата труд'].some((kw) =>
        `${tx.category?.name ?? ''} ${tx.description ?? ''}`.toLowerCase().includes(kw),
      ),
  },
  {
    id: 'fuel',
    name: 'ГСМ',
    color: '#10b981',
    fixed: true,
    match: (tx) =>
      ['гсм', 'дерябин', 'опти', 'топлив', 'бензин', 'дизель'].some((kw) =>
        `${tx.category?.name ?? ''} ${tx.description ?? ''}`.toLowerCase().includes(kw),
      ),
  },
  {
    id: 'parts',
    name: 'Запчасти',
    color: '#f59e0b',
    fixed: true,
    match: (tx) =>
      ['запчаст', 'ромашин', 'новиков', 'деталь', 'фильтр', 'масл'].some((kw) =>
        `${tx.category?.name ?? ''} ${tx.description ?? ''}`.toLowerCase().includes(kw),
      ),
  },
  {
    id: 'repair',
    name: 'Ремонт',
    color: '#ef4444',
    fixed: false,
    match: (tx) =>
      ['ремонт'].some((kw) =>
        `${tx.category?.name ?? ''} ${tx.description ?? ''}`.toLowerCase().includes(kw),
      ),
  },
  {
    id: 'credit',
    name: 'Кредиты / Лизинг',
    color: '#8b5cf6',
    fixed: true,
    match: (tx) =>
      ['кредит', 'лизинг'].some((kw) =>
        `${tx.category?.name ?? ''} ${tx.description ?? ''}`.toLowerCase().includes(kw),
      ),
  },
  {
    id: 'tax',
    name: 'Налоги',
    color: '#14b8a6',
    fixed: true,
    match: (tx) =>
      ['налог', 'страхов'].some((kw) =>
        `${tx.category?.name ?? ''} ${tx.description ?? ''}`.toLowerCase().includes(kw),
      ),
  },
  {
    id: 'other',
    name: 'Прочие расходы',
    color: '#64748b',
    fixed: false,
    match: () => true,
  },
];

function getExpenseGroup(tx: {
  category?: { name: string; code: string } | null;
  description?: string | null;
}): ExpenseGroup {
  for (const group of EXPENSE_GROUPS) {
    if (group.id !== 'other' && group.match(tx)) return group;
  }
  return EXPENSE_GROUPS.find((g) => g.id === 'other')!;
}

// ── Shared visual atoms ────────────────────────────────────────────────────

function SumCard({
  gradient,
  label,
  value,
  sub,
}: {
  gradient: string;
  label: string;
  value: React.ReactNode;
  sub: string;
}) {
  return (
    <div
      style={{
        background: gradient,
        borderRadius: 10,
        padding: '10px 14px',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform .15s',
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: -12,
          top: -12,
          width: 54,
          height: 54,
          borderRadius: '50%',
          background: 'rgba(255,255,255,.1)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 6,
          bottom: -18,
          width: 42,
          height: 42,
          borderRadius: '50%',
          background: 'rgba(255,255,255,.07)',
        }}
      />
      <p
        style={{
          fontSize: 8,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '.1em',
          opacity: 0.8,
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: 18, fontWeight: 900, marginTop: 3, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 9, opacity: 0.75, marginTop: 3 }}>{sub}</p>
    </div>
  );
}

function Chip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 16px',
        borderRadius: 24,
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        border: `1.5px solid ${color}`,
        background: active ? color : 'transparent',
        color: active ? '#fff' : color,
        transition: 'all .18s',
      }}
    >
      {label}
    </button>
  );
}

function StackBar({ segments }: { segments: { flex: number; color: string; label: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.flex, 0);
  if (total === 0) return <div style={{ height: 14, borderRadius: 7, background: '#f1f5f9' }} />;
  return (
    <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2 }}>
      {segments
        .filter((s) => s.flex > 0)
        .map((seg, i) => (
          <div
            key={i}
            style={{
              flex: seg.flex,
              background: seg.color,
              cursor: 'default',
              transition: 'opacity .2s',
            }}
            title={seg.label}
            onMouseOver={(e) => (e.currentTarget.style.opacity = '.75')}
            onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
          />
        ))}
    </div>
  );
}

function LegendRow({
  color,
  name,
  pct,
  amount,
  active,
  onClick,
}: {
  color: string;
  name: string;
  pct: number;
  amount: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 8px',
        borderRadius: 8,
        cursor: onClick ? 'pointer' : 'default',
        background: active ? `${color}18` : 'transparent',
        border: active ? `1.5px solid ${color}55` : '1.5px solid transparent',
        transition: 'background .12s, border .12s',
      }}
      onMouseOver={(e) => {
        if (onClick && !active) e.currentTarget.style.background = '#f8fafc';
      }}
      onMouseOut={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: active ? '#1e293b' : '#374151',
          flex: 1,
          minWidth: 0,
        }}
      >
        {name}
      </span>
      <div style={{ width: 64, flexShrink: 0 }}>
        <div style={{ height: 4, background: '#f1f5f9', borderRadius: 2 }}>
          <div
            style={{
              height: '100%',
              width: `${Math.min(pct, 100)}%`,
              background: color,
              borderRadius: 2,
            }}
          />
        </div>
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: '#1e293b',
          minWidth: 32,
          textAlign: 'right',
        }}
      >
        {pct}%
      </span>
      <span style={{ fontSize: 9, color: '#94a3b8', minWidth: 72, textAlign: 'right' }}>
        {rub(amount)}
      </span>
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,.06)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function CardHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid #f1f5f9',
      }}
    >
      <p
        style={{
          fontSize: 10,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '.12em',
          color: '#475569',
        }}
      >
        {title}
      </p>
      {right}
    </div>
  );
}

function TimePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 700,
        background: active ? '#0f172a' : '#f8fafc',
        color: active ? '#fff' : '#475569',
        border: 'none',
        cursor: 'pointer',
        transition: 'all .15s',
      }}
    >
      {label}
    </button>
  );
}

function ProgBar({
  value,
  max,
  color,
  height = 6,
}: {
  value: number;
  max: number;
  color: string;
  height?: number;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ height, background: '#f1f5f9', borderRadius: height / 2, overflow: 'hidden' }}>
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: height / 2,
          transition: 'width .5s',
        }}
      />
    </div>
  );
}

function StatusBadge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 10,
        fontSize: 9,
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '.05em',
        background: bg,
        color,
      }}
    >
      {label}
    </span>
  );
}

// ── Expense chip definitions ────────────────────────────────────────────────

type TxLike = {
  id: string;
  category?: { name: string; code: string } | null;
  description?: string | null;
};

const EXPENSE_CHIPS: {
  id: string;
  label: string;
  color: string;
  match: (tx: TxLike) => boolean;
}[] = [
  { id: 'all', label: 'Все расходы', color: '#6366f1', match: () => true },
  {
    id: 'fixed',
    label: '📌 Постоянные',
    color: '#6366f1',
    match: (tx) => getExpenseGroup(tx).fixed,
  },
  {
    id: 'variable',
    label: '⚡ Переменные',
    color: '#f97316',
    match: (tx) => !getExpenseGroup(tx).fixed,
  },
];

// ── Panel: Расходы ─────────────────────────────────────────────────────────

function weekBounds(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay();
  const monOffset = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d);
  mon.setDate(d.getDate() + monOffset);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { mon: mon.toISOString().slice(0, 10), sun: sun.toISOString().slice(0, 10) };
}

function ExpensesPanel() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [anchorDate, setAnchorDate] = useState(todayStr);
  const [activeChip, setActiveChip] = useState('all');
  const [timePeriod, setTimePeriod] = useState<'day' | 'week' | 'month'>('month');
  const [activeCatFilter, setActiveCatFilter] = useState<string | null>(null);

  const selectedMonth = anchorDate.slice(0, 7);

  function navigate(dir: 1 | -1) {
    setAnchorDate((prev) => {
      const d = new Date(prev + 'T12:00:00');
      if (timePeriod === 'day') d.setDate(d.getDate() + dir);
      else if (timePeriod === 'week') d.setDate(d.getDate() + dir * 7);
      else d.setMonth(d.getMonth() + dir);
      return d.toISOString().slice(0, 10);
    });
  }

  function periodLabel() {
    if (timePeriod === 'day') {
      return new Date(anchorDate + 'T12:00:00').toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
    if (timePeriod === 'week') {
      const { mon, sun } = weekBounds(anchorDate);
      const fmt = (s: string) =>
        new Date(s + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      return `${fmt(mon)} – ${fmt(sun)}`;
    }
    return formatMonthLabel(selectedMonth);
  }

  const isCurrent = (() => {
    if (timePeriod === 'day') return anchorDate >= todayStr;
    if (timePeriod === 'week') return weekBounds(anchorDate).sun >= todayStr;
    return selectedMonth >= todayMonth();
  })();

  const { data, isLoading } = useQuery<ExpenseMonthData>({
    queryKey: ['finance-month', selectedMonth],
    queryFn: () => fetch(`/api/finance?month=${selectedMonth}`).then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const txList = data?.transactions ?? [];
  const revenue = n(data?.revenue);

  const allTimeline = [...txList];

  // Filter by period first (so summary cards reflect the selected period)
  const periodItems = allTimeline.filter((tx) => {
    const txDate = tx.created_at.slice(0, 10);
    if (timePeriod === 'day') return txDate === anchorDate;
    if (timePeriod === 'week') {
      const { mon, sun } = weekBounds(anchorDate);
      return txDate >= mon && txDate <= sun;
    }
    return true;
  });

  // Build expense structure using predefined groups
  const groupMap = new Map<string, { group: ExpenseGroup; total: number }>();
  periodItems.forEach((tx) => {
    const group = getExpenseGroup(tx);
    if (!groupMap.has(group.id)) groupMap.set(group.id, { group, total: 0 });
    groupMap.get(group.id)!.total += n(tx.amount);
  });
  const groupedCategories = Array.from(groupMap.values())
    .filter((g) => g.total > 0)
    .sort((a, b) => b.total - a.total);
  const txFixed = groupedCategories.filter((g) => g.group.fixed).reduce((s, g) => s + g.total, 0);
  const txVariable = groupedCategories
    .filter((g) => !g.group.fixed)
    .reduce((s, g) => s + g.total, 0);
  const totalExp = txFixed + txVariable;
  const periodRevenue = timePeriod === 'month' ? revenue : 0;
  const profit = periodRevenue - totalExp;
  const margin = periodRevenue > 0 ? Math.round((profit / periodRevenue) * 100) : 0;

  // Apply chip + group filters to get timeline
  const activeChipDef = EXPENSE_CHIPS.find((c) => c.id === activeChip);
  const chipFiltered = periodItems.filter((tx) => activeChipDef?.match(tx) ?? true);
  const activeGroupFilter = activeCatFilter
    ? (EXPENSE_GROUPS.find((g) => g.id === activeCatFilter) ?? null)
    : null;
  const filteredTimeline = activeGroupFilter
    ? chipFiltered.filter((tx) => getExpenseGroup(tx).id === activeGroupFilter.id)
    : chipFiltered;

  // When chip = fixed/variable and no group filter: show group summaries instead of individual rows
  const showGrouped = activeChip !== 'all' && activeCatFilter === null;
  const visibleGroupsWhenGrouped = groupedCategories.filter(({ group }) =>
    activeChip === 'fixed' ? group.fixed : !group.fixed,
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
      {/* Chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {EXPENSE_CHIPS.map((c) => (
          <Chip
            key={c.id}
            label={c.label}
            active={activeChip === c.id && !activeCatFilter}
            color={c.color}
            onClick={() => {
              setActiveChip(c.id);
              setActiveCatFilter(null);
            }}
          />
        ))}
        {activeGroupFilter && (
          <Chip
            label={`📂 ${activeGroupFilter.name} ×`}
            active={true}
            color={activeGroupFilter.color}
            onClick={() => setActiveCatFilter(null)}
          />
        )}
      </div>

      {/* Summary cards */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}
      >
        <SumCard
          gradient="linear-gradient(135deg,#6366f1,#8b5cf6)"
          label="Постоянные"
          value={rub(txFixed)}
          sub={`${groupedCategories.filter((g) => g.group.fixed).length} статей · ${totalExp > 0 ? Math.round((txFixed / totalExp) * 100) : 0}% расходов`}
        />
        <SumCard
          gradient="linear-gradient(135deg,#f97316,#ef4444)"
          label="Переменные"
          value={rub(txVariable)}
          sub={`ремонты и прочие · ${totalExp > 0 ? Math.round((txVariable / totalExp) * 100) : 0}%`}
        />
        <SumCard
          gradient="linear-gradient(135deg,#10b981,#0891b2)"
          label={
            timePeriod === 'month' ? `Прибыль — ${periodLabel()}` : `Расходы — ${periodLabel()}`
          }
          value={rub(timePeriod === 'month' ? profit : totalExp)}
          sub={
            timePeriod === 'month'
              ? `маржа ${margin}% · выручка ${rub(revenue)}`
              : `за выбранный период`
          }
        />
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
        {/* Timeline */}
        <Card>
          <CardHead
            title={
              activeGroupFilter
                ? `${activeGroupFilter.name} — ${periodLabel()}`
                : `Расходы — ${periodLabel()}`
            }
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => navigate(-1)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ‹
                </button>
                <button
                  disabled={isCurrent}
                  onClick={() => navigate(1)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    cursor: isCurrent ? 'default' : 'pointer',
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isCurrent ? 0.3 : 1,
                  }}
                >
                  ›
                </button>
                <div style={{ display: 'flex', gap: 3 }}>
                  {(['day', 'week', 'month'] as const).map((p) => (
                    <TimePill
                      key={p}
                      label={p === 'day' ? 'День' : p === 'week' ? 'Неделя' : 'Месяц'}
                      active={timePeriod === p}
                      onClick={() => setTimePeriod(p)}
                    />
                  ))}
                </div>
              </div>
            }
          />

          {isLoading ? (
            <div style={{ padding: 16 }}>
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div
                  key={i}
                  style={{ height: 30, background: '#f1f5f9', borderRadius: 4, marginBottom: 2 }}
                />
              ))}
            </div>
          ) : showGrouped && visibleGroupsWhenGrouped.length === 0 ? (
            <p style={{ textAlign: 'center', padding: 48, color: '#94a3b8', fontSize: 13 }}>
              Нет расходов
            </p>
          ) : showGrouped ? (
            <div>
              <p
                style={{
                  fontSize: 10,
                  color: '#94a3b8',
                  fontWeight: 700,
                  padding: '8px 14px 4px',
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                }}
              >
                Нажмите на статью, чтобы увидеть детали
              </p>
              {visibleGroupsWhenGrouped.map(({ group, total }) => {
                const count = chipFiltered.filter(
                  (tx) => getExpenseGroup(tx).id === group.id,
                ).length;
                return (
                  <div
                    key={group.id}
                    onClick={() => setActiveCatFilter(group.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 14px',
                      borderBottom: '1px solid #f8fafc',
                      cursor: 'pointer',
                      transition: 'background .1s',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseOut={(e) => (e.currentTarget.style.background = '')}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: group.color,
                        flexShrink: 0,
                      }}
                    />
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#1e293b',
                        flex: 1,
                      }}
                    >
                      {group.name}
                    </p>
                    <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>
                      {count} оп.
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 900,
                        color: group.color,
                        flexShrink: 0,
                        minWidth: 90,
                        textAlign: 'right',
                      }}
                    >
                      {rub(total)}
                    </span>
                    <span style={{ fontSize: 12, color: '#cbd5e1', flexShrink: 0 }}>›</span>
                  </div>
                );
              })}
            </div>
          ) : filteredTimeline.length === 0 ? (
            <p style={{ textAlign: 'center', padding: 48, color: '#94a3b8', fontSize: 13 }}>
              Нет расходов
            </p>
          ) : (
            <div>
              {filteredTimeline.map((tx) => {
                const name = tx.description || tx.category?.name || 'Без категории';
                const catName = tx.category?.name ?? null;
                const group = getExpenseGroup(tx);
                const color = group.color;
                return (
                  <div
                    key={tx.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '6px 14px',
                      borderBottom: '1px solid #f8fafc',
                      transition: 'background .1s',
                      cursor: 'default',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseOut={(e) => (e.currentTarget.style.background = '')}
                  >
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: color,
                        flexShrink: 0,
                      }}
                    />
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#1e293b',
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {name}
                    </p>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', flexShrink: 0 }}>
                      {catName ?? '—'}
                    </span>
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 8,
                        fontSize: 9,
                        fontWeight: 800,
                        flexShrink: 0,
                        background: !group.fixed ? '#fee2e2' : '#dbeafe',
                        color: !group.fixed ? '#b91c1c' : '#1d4ed8',
                      }}
                    >
                      {!group.fixed ? 'перем.' : 'пост.'}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        color: '#94a3b8',
                        flexShrink: 0,
                        minWidth: 42,
                        textAlign: 'right',
                      }}
                    >
                      {shortDate(tx.created_at)}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 900,
                        color,
                        flexShrink: 0,
                        minWidth: 80,
                        textAlign: 'right',
                      }}
                    >
                      {rub(n(tx.amount))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Right: structure */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <CardHead title="Структура расходов" />
            <div style={{ padding: '14px 16px' }}>
              <StackBar
                segments={groupedCategories.map(({ group, total }) => ({
                  flex: total,
                  color: group.color,
                  label: `${group.name} ${Math.round(totalExp > 0 ? (total / totalExp) * 100 : 0)}%`,
                }))}
              />
            </div>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 8px 12px' }}
            >
              {groupedCategories.map(({ group, total }) => (
                <LegendRow
                  key={group.id}
                  color={group.color}
                  name={group.name}
                  pct={totalExp > 0 ? Math.round((total / totalExp) * 100) : 0}
                  amount={total}
                  active={activeCatFilter === group.id}
                  onClick={() => setActiveCatFilter(activeCatFilter === group.id ? null : group.id)}
                />
              ))}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                padding: '12px 16px',
                borderTop: '1px solid #f8fafc',
              }}
            >
              <div
                style={{
                  padding: '12px 14px',
                  background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)',
                  borderRadius: 10,
                }}
              >
                <p
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '.1em',
                    color: '#6d28d9',
                  }}
                >
                  Постоянные
                </p>
                <p style={{ fontSize: 20, fontWeight: 900, color: '#4c1d95', marginTop: 4 }}>
                  {totalExp > 0 ? Math.round((txFixed / totalExp) * 100) : 0}%
                </p>
                <p style={{ fontSize: 9, color: '#7c3aed', marginTop: 2 }}>{rub(txFixed)}</p>
              </div>
              <div
                style={{
                  padding: '12px 14px',
                  background: 'linear-gradient(135deg,#fff7ed,#fed7aa)',
                  borderRadius: 10,
                }}
              >
                <p
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '.1em',
                    color: '#c2410c',
                  }}
                >
                  Переменные
                </p>
                <p style={{ fontSize: 20, fontWeight: 900, color: '#9a3412', marginTop: 4 }}>
                  {totalExp > 0 ? Math.round((txVariable / totalExp) * 100) : 0}%
                </p>
                <p style={{ fontSize: 9, color: '#ea580c', marginTop: 2 }}>{rub(txVariable)}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Receivables helpers ────────────────────────────────────────────────────

const PAYMENT_LABELS: Record<string, string> = {
  bank_invoice: 'Безнал',
  debt_cash: 'Долг нал',
  qr: 'QR',
  cash: 'Нал',
  card_driver: 'Карта',
};

const FU_STATUS: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  active: { label: 'В работе', bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
  promised: { label: 'Обещание', bg: '#dbeafe', color: '#1e40af', dot: '#3b82f6' },
  disputed: { label: 'Оспаривает', bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' },
  bad_debt: { label: 'Безнадёжный', bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
};

function FollowUpPanel({
  counterpartyId,
  current,
  onClose,
  onSaved,
}: {
  counterpartyId: string;
  current: FollowUp | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<keyof typeof FU_STATUS>(current?.status ?? 'active');
  const [promiseDate, setPromiseDate] = useState(current?.promise_date ?? '');
  const [nextContact, setNextContact] = useState(current?.next_contact_at?.slice(0, 10) ?? '');
  const [notes, setNotes] = useState(current?.notes ?? '');
  const [err, setErr] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/receivables/follow-up/${counterpartyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          promise_date: promiseDate || null,
          next_contact_at: nextContact || null,
          notes: notes || null,
        }),
      }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        return j;
      }),
    onSuccess: onSaved,
    onError: (e: Error) => setErr(e.message),
  });

  const inputStyle: React.CSSProperties = {
    width: '100%',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 12,
    outline: 'none',
    boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '.08em',
    color: '#64748b',
    display: 'block',
    marginBottom: 4,
  };

  return (
    <div
      style={{
        margin: '0 0 0 0',
        padding: '12px 16px',
        background: '#f8fafc',
        borderTop: '1px solid #e2e8f0',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '.1em',
            color: '#475569',
          }}
        >
          Фиксация звонка
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#94a3b8',
            fontSize: 16,
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {(Object.entries(FU_STATUS) as [string, (typeof FU_STATUS)[string]][]).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setStatus(key as keyof typeof FU_STATUS)}
            style={{
              padding: '4px 10px',
              borderRadius: 20,
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              border: `2px solid ${status === key ? cfg.dot : '#e2e8f0'}`,
              background: status === key ? cfg.bg : 'transparent',
              color: status === key ? cfg.color : '#64748b',
            }}
          >
            {cfg.label}
          </button>
        ))}
      </div>
      {status === 'promised' && (
        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>Обещает оплатить</label>
          <input
            type="date"
            value={promiseDate}
            onChange={(e) => setPromiseDate(e.target.value)}
            style={inputStyle}
          />
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <label style={labelStyle}>Следующий звонок</label>
          <input
            type="date"
            value={nextContact}
            onChange={(e) => setNextContact(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Заметка</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Итог звонка..."
            style={inputStyle}
          />
        </div>
      </div>
      {err && <p style={{ fontSize: 11, color: '#ef4444', marginBottom: 6 }}>{err}</p>}
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        style={{
          width: '100%',
          padding: '8px',
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          opacity: mutation.isPending ? 0.6 : 1,
        }}
      >
        {mutation.isPending ? 'Сохранение...' : '✓ Зафиксировать звонок'}
      </button>
    </div>
  );
}

function AddDebtModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [cpId, setCpId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: counterparties = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['counterparties-active'],
    queryFn: () => fetch('/api/counterparties?active=1').then((r) => r.json()),
    staleTime: 60000,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cpId || !amount) return;
    setSaving(true);
    setError('');
    try {
      const r = await fetch('/api/receivables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counterparty_id: cpId, amount, date, description }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `Статус ${r.status}`);
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '.08em',
    color: '#64748b',
    display: 'block',
    marginBottom: 4,
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,.45)',
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,.2)',
          width: '100%',
          maxWidth: 420,
          padding: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <p style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>
            Добавить исторический долг
          </p>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 18,
              color: '#94a3b8',
            }}
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Контрагент</label>
            <select
              value={cpId}
              onChange={(e) => setCpId(e.target.value)}
              required
              style={{ ...inputStyle, background: '#fff' }}
            >
              <option value="">Выберите...</option>
              {(Array.isArray(counterparties) ? counterparties : []).map((cp) => (
                <option key={cp.id} value={cp.id}>
                  {cp.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Сумма, ₽</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Дата возникновения</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                style={inputStyle}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Описание</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="За что долг..."
              style={inputStyle}
            />
          </div>
          {error && <p style={{ fontSize: 11, color: '#ef4444' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '9px',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                background: '#fff',
                color: '#475569',
              }}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving || !cpId || !amount}
              style={{
                flex: 1,
                padding: '9px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                opacity: saving || !cpId || !amount ? 0.5 : 1,
              }}
            >
              {saving ? 'Сохранение...' : 'Добавить долг'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Panel: Дебиторка ────────────────────────────────────────────────────────

function ReceivablesPanel() {
  const queryClient = useQueryClient();
  const [agingFilter, setAgingFilter] = useState<'all' | '0-30' | '31-60' | '60+'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [partialOrder, setPartialOrder] = useState<RecvOrder | null>(null);
  const [partialAmount, setPartialAmount] = useState('');
  const [partialWallet, setPartialWallet] = useState<'bank' | 'cash' | 'card'>('bank');
  const [partialSaving, setPartialSaving] = useState(false);

  const { data, isLoading } = useQuery<ReceivablesData>({
    queryKey: ['receivables'],
    queryFn: () => fetch('/api/receivables').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!expandedId) return;
    const el = document.querySelector(`[data-debtor="${expandedId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [expandedId]);

  const allDebtors = data?.debtors ?? [];

  function passesFilter(d: Debtor) {
    const da = daysAgo(d.oldest_at);
    if (agingFilter === '0-30') return da <= 30;
    if (agingFilter === '31-60') return da > 30 && da <= 60;
    if (agingFilter === '60+') return da > 60;
    return true;
  }

  const debtors = allDebtors.filter(passesFilter);
  const overdue = allDebtors.filter((d) => daysAgo(d.oldest_at) > 30);
  const overdueTotal = overdue.reduce((s, d) => s + n(d.total), 0);
  const promisedCount = allDebtors.filter((d) => d.follow_up?.status === 'promised').length;

  function dayColor(da: number) {
    if (da > 30) return { text: '#ef4444', bg: '#fee2e2' };
    if (da >= 10) return { text: '#f59e0b', bg: '#fef3c7' };
    return { text: '#10b981', bg: '#d1fae5' };
  }

  async function handleMarkPaid(order: RecvOrder) {
    setMarkingId(order.id);
    try {
      const url =
        order.type === 'manual'
          ? `/api/receivables/manual/${order.id}`
          : `/api/receivables/${order.id}`;
      const r = await fetch(url, { method: 'PATCH' });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `Статус ${r.status}`);
      await queryClient.invalidateQueries({ queryKey: ['receivables'] });
      await queryClient.invalidateQueries({ queryKey: ['recv-summary'] });
    } catch (e: unknown) {
      alert('Ошибка: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setMarkingId(null);
    }
  }

  async function handleDeleteManual(orderId: string) {
    if (!confirm('Удалить эту запись?')) return;
    setDeletingId(orderId);
    try {
      const r = await fetch(`/api/receivables/manual/${orderId}`, { method: 'DELETE' });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `Статус ${r.status}`);
      await queryClient.invalidateQueries({ queryKey: ['receivables'] });
      await queryClient.invalidateQueries({ queryKey: ['recv-summary'] });
    } catch (e: unknown) {
      alert('Ошибка: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDeletingId(null);
    }
  }

  async function handlePartialPay() {
    if (!partialOrder) return;
    const amt = parseFloat(partialAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Введите корректную сумму');
      return;
    }
    if (amt >= parseFloat(partialOrder.amount)) {
      alert('Сумма должна быть меньше долга');
      return;
    }
    setPartialSaving(true);
    const WALLET_IDS = {
      bank: '10000000-0000-0000-0000-000000000001',
      cash: '10000000-0000-0000-0000-000000000002',
      card: '10000000-0000-0000-0000-000000000003',
    };
    try {
      const r = await fetch(`/api/receivables/manual/${partialOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partial_amount: amt.toFixed(2),
          to_wallet_id: WALLET_IDS[partialWallet],
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `Статус ${r.status}`);
      setPartialOrder(null);
      setPartialAmount('');
      await queryClient.invalidateQueries({ queryKey: ['receivables'] });
      await queryClient.invalidateQueries({ queryKey: ['recv-summary'] });
    } catch (e: unknown) {
      alert('Ошибка: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPartialSaving(false);
    }
  }

  function handleAddSuccess() {
    setShowAddForm(false);
    queryClient.invalidateQueries({ queryKey: ['receivables'] });
    queryClient.invalidateQueries({ queryKey: ['recv-summary'] });
  }

  function handleFollowUpSaved() {
    setEditingFollowUpId(null);
    queryClient.invalidateQueries({ queryKey: ['receivables'] });
  }

  const agingChips = [
    { id: 'all' as const, label: `Все (${allDebtors.length})`, color: '#f59e0b' },
    {
      id: '0-30' as const,
      label: `🟢 0–30 дн. (${allDebtors.filter((d) => daysAgo(d.oldest_at) <= 30).length})`,
      color: '#10b981',
    },
    {
      id: '31-60' as const,
      label: `🟡 31–60 дн. (${
        allDebtors.filter((d) => {
          const x = daysAgo(d.oldest_at);
          return x > 30 && x <= 60;
        }).length
      })`,
      color: '#f59e0b',
    },
    {
      id: '60+' as const,
      label: `🔴 60+ дн. (${allDebtors.filter((d) => daysAgo(d.oldest_at) > 60).length})`,
      color: '#ef4444',
    },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
      {showAddForm && (
        <AddDebtModal onClose={() => setShowAddForm(false)} onSuccess={handleAddSuccess} />
      )}

      {partialOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setPartialOrder(null)}
        >
          <div
            style={{
              background: '#1e293b',
              borderRadius: 16,
              padding: 24,
              width: 340,
              color: '#f1f5f9',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Частичная оплата</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
              Долг: <Money amount={partialOrder.amount} /> — {partialOrder.description ?? ''}
            </div>
            <label style={{ fontSize: 12, color: '#94a3b8' }}>Сумма оплаты (₽)</label>
            <input
              type="number"
              value={partialAmount}
              onChange={(e) => setPartialAmount(e.target.value)}
              placeholder="например 30000"
              style={{
                width: '100%',
                marginTop: 4,
                marginBottom: 12,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #334155',
                background: '#0f172a',
                color: '#f1f5f9',
                fontSize: 14,
              }}
            />
            <label style={{ fontSize: 12, color: '#94a3b8' }}>Зачислить на счёт</label>
            <select
              value={partialWallet}
              onChange={(e) => setPartialWallet(e.target.value as 'bank' | 'cash' | 'card')}
              style={{
                width: '100%',
                marginTop: 4,
                marginBottom: 20,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #334155',
                background: '#0f172a',
                color: '#f1f5f9',
                fontSize: 14,
              }}
            >
              <option value="bank">Банк (р/с)</option>
              <option value="cash">Наличные</option>
              <option value="card">Карта</option>
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setPartialOrder(null)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 8,
                  border: '1px solid #334155',
                  background: 'transparent',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Отмена
              </button>
              <button
                onClick={handlePartialPay}
                disabled={partialSaving}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#2563eb',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 700,
                  opacity: partialSaving ? 0.5 : 1,
                }}
              >
                {partialSaving ? '...' : 'Зачислить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chips + Add button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        {agingChips.map((c) => (
          <Chip
            key={c.id}
            label={c.label}
            active={agingFilter === c.id}
            color={c.color}
            onClick={() => setAgingFilter(c.id)}
          />
        ))}
        <button
          onClick={() => setShowAddForm(true)}
          style={{
            marginLeft: 'auto',
            padding: '7px 16px',
            borderRadius: 24,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: '#2563eb',
            color: '#fff',
          }}
        >
          + Добавить долг
        </button>
      </div>

      {/* Summary cards */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 14 }}
      >
        <SumCard
          gradient="linear-gradient(135deg,#f59e0b,#f97316)"
          label="Общая дебиторка"
          value={<Money amount={data?.totalAmount ?? '0.00'} />}
          sub={`${allDebtors.length} должников`}
        />
        <SumCard
          gradient="linear-gradient(135deg,#ef4444,#b91c1c)"
          label="Просрочено >30 дн."
          value={rub(overdueTotal)}
          sub={`${overdue.length} контрагентов`}
        />
        <SumCard
          gradient="linear-gradient(135deg,#3b82f6,#6366f1)"
          label="Обещали заплатить"
          value={String(promisedCount)}
          sub="контрагентов с обещанием"
        />
      </div>

      {/* Debtor list */}
      <Card>
        <CardHead
          title="Список должников"
          right={
            overdue.length > 0 ? (
              <StatusBadge label={`${overdue.length} просрочено`} bg="#fee2e2" color="#b91c1c" />
            ) : undefined
          }
        />
        {isLoading ? (
          <div style={{ padding: 12 }}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{ height: 44, background: '#f1f5f9', borderRadius: 6, marginBottom: 4 }}
              />
            ))}
          </div>
        ) : debtors.length === 0 ? (
          <p style={{ textAlign: 'center', padding: 48, color: '#94a3b8', fontSize: 13 }}>
            Нет задолженностей в этой категории
          </p>
        ) : (
          <div>
            {debtors.map((debtor) => {
              const da = daysAgo(debtor.oldest_at);
              const col = dayColor(da);
              const isExpanded = expandedId === debtor.counterparty_id;
              const fu = debtor.follow_up;
              const fuCfg = fu ? FU_STATUS[fu.status] : null;
              const isReal =
                !debtor.is_individual && !String(debtor.counterparty_id).startsWith('__');

              return (
                <div key={debtor.counterparty_id} data-debtor={debtor.counterparty_id}>
                  {/* Row */}
                  <div
                    onClick={() => {
                      setExpandedId(isExpanded ? null : debtor.counterparty_id);
                      setEditingFollowUpId(null);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 14px',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      background: isExpanded ? '#f8fafc' : '',
                      transition: 'background .1s',
                    }}
                    onMouseOver={(e) => {
                      if (!isExpanded) e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseOut={(e) => {
                      if (!isExpanded) e.currentTarget.style.background = '';
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: col.bg,
                        color: col.text,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: 12,
                        flexShrink: 0,
                      }}
                    >
                      {debtor.counterparty_name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                          {debtor.counterparty_name}
                        </span>
                        {fuCfg && (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 8,
                              background: fuCfg.bg,
                              color: fuCfg.color,
                            }}
                          >
                            {fuCfg.label}
                          </span>
                        )}
                        {fu?.promise_date &&
                          (() => {
                            const diff = Math.ceil(
                              (new Date(fu.promise_date).getTime() - Date.now()) / 86400000,
                            );
                            return (
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 8,
                                  background: diff < 0 ? '#fee2e2' : '#dbeafe',
                                  color: diff < 0 ? '#b91c1c' : '#1e40af',
                                }}
                              >
                                {diff < 0 ? `⚠ обещание просрочено` : `обещает через ${diff} дн.`}
                              </span>
                            );
                          })()}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                        <span style={{ fontSize: 9, color: col.text, fontWeight: 700 }}>
                          {da} дн.
                        </span>
                        <span style={{ fontSize: 9, color: '#94a3b8' }}>
                          {debtor.orders?.length ?? 0} записей
                        </span>
                        {debtor.counterparty_phone && (
                          <a
                            href={`tel:${debtor.counterparty_phone}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              fontSize: 9,
                              color: '#3b82f6',
                              fontWeight: 700,
                              textDecoration: 'none',
                            }}
                          >
                            📞 {formatPhone(debtor.counterparty_phone)}
                          </a>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 900, color: col.text, flexShrink: 0 }}>
                      <Money amount={debtor.total} />
                    </span>
                    <span
                      style={{
                        fontSize: 14,
                        color: '#94a3b8',
                        transition: 'transform .2s',
                        transform: isExpanded ? 'rotate(180deg)' : 'none',
                      }}
                    >
                      ▾
                    </span>
                  </div>

                  {/* Expanded */}
                  {isExpanded && (
                    <div style={{ background: '#fafafa', borderBottom: '1px solid #e2e8f0' }}>
                      {/* Follow-up */}
                      {isReal && !editingFollowUpId && (
                        <div
                          style={{
                            padding: '8px 14px',
                            borderBottom: '1px solid #f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          {fu ? (
                            <div
                              style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                flexWrap: 'wrap',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  padding: '2px 7px',
                                  borderRadius: 8,
                                  background: fuCfg?.bg,
                                  color: fuCfg?.color,
                                }}
                              >
                                {fuCfg?.label}
                              </span>
                              {fu.last_contact_at && (
                                <span style={{ fontSize: 9, color: '#94a3b8' }}>
                                  Звонок: {formatDate(fu.last_contact_at)}
                                </span>
                              )}
                              {fu.next_contact_at && (
                                <span style={{ fontSize: 9, color: '#3b82f6', fontWeight: 600 }}>
                                  Следующий:{' '}
                                  {new Date(fu.next_contact_at + 'T12:00:00').toLocaleDateString(
                                    'ru-RU',
                                    { day: 'numeric', month: 'short' },
                                  )}
                                </span>
                              )}
                              {fu.notes && (
                                <span
                                  style={{ fontSize: 9, color: '#64748b', fontStyle: 'italic' }}
                                >
                                  «{fu.notes}»
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 9, color: '#94a3b8' }}>
                              Звонки не фиксировались
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFollowUpId(debtor.counterparty_id);
                            }}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 6,
                              fontSize: 10,
                              fontWeight: 700,
                              cursor: 'pointer',
                              border: '1px solid #e2e8f0',
                              background: '#fff',
                              color: '#3b82f6',
                              flexShrink: 0,
                            }}
                          >
                            📞 {fu ? 'Обновить' : 'Зафиксировать звонок'}
                          </button>
                        </div>
                      )}

                      {isReal && editingFollowUpId === debtor.counterparty_id && (
                        <FollowUpPanel
                          counterpartyId={debtor.counterparty_id}
                          current={debtor.follow_up}
                          onClose={() => setEditingFollowUpId(null)}
                          onSaved={handleFollowUpSaved}
                        />
                      )}

                      {/* Orders table */}
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#f1f5f9' }}>
                              {['Рейс / Запись', 'Водитель', 'Дата', 'Тип', 'Сумма', ''].map(
                                (h) => (
                                  <th
                                    key={h}
                                    style={{
                                      padding: '6px 12px',
                                      fontSize: 9,
                                      fontWeight: 800,
                                      textTransform: 'uppercase',
                                      letterSpacing: '.08em',
                                      color: '#64748b',
                                      textAlign: h === 'Сумма' ? 'right' : 'left',
                                    }}
                                  >
                                    {h}
                                  </th>
                                ),
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {(debtor.orders ?? []).map((order) => (
                              <tr key={order.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                                <td
                                  style={{
                                    padding: '7px 12px',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: order.type === 'manual' ? '#2563eb' : '#374151',
                                  }}
                                >
                                  {order.type === 'manual'
                                    ? 'Ручная запись'
                                    : `№${order.trip_number}`}
                                  {order.description && (
                                    <span
                                      style={{
                                        display: 'block',
                                        fontSize: 9,
                                        color: '#94a3b8',
                                        fontWeight: 400,
                                      }}
                                    >
                                      {order.description}
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '7px 12px', fontSize: 11, color: '#64748b' }}>
                                  {order.driver_name ?? '—'}
                                </td>
                                <td
                                  style={{
                                    padding: '7px 12px',
                                    fontSize: 11,
                                    color: '#64748b',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {order.started_at ? formatDate(order.started_at) : '—'}
                                </td>
                                <td style={{ padding: '7px 12px' }}>
                                  <span
                                    style={{
                                      padding: '2px 6px',
                                      borderRadius: 6,
                                      fontSize: 9,
                                      fontWeight: 700,
                                      background: order.type === 'manual' ? '#dbeafe' : '#fef3c7',
                                      color: order.type === 'manual' ? '#1e40af' : '#92400e',
                                    }}
                                  >
                                    {order.type === 'manual'
                                      ? 'Ист. долг'
                                      : (PAYMENT_LABELS[order.payment_method ?? ''] ??
                                        order.payment_method ??
                                        '—')}
                                  </span>
                                </td>
                                <td
                                  style={{
                                    padding: '7px 12px',
                                    fontSize: 12,
                                    fontWeight: 900,
                                    color: '#1e293b',
                                    textAlign: 'right',
                                  }}
                                >
                                  <Money amount={order.amount} />
                                </td>
                                <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'flex-end',
                                      gap: 6,
                                    }}
                                  >
                                    {order.type === 'manual' && (
                                      <>
                                        <button
                                          onClick={() => {
                                            setPartialOrder(order);
                                            setPartialAmount('');
                                            setPartialWallet('bank');
                                          }}
                                          style={{
                                            padding: '4px 8px',
                                            background: '#2563eb',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: 6,
                                            fontSize: 10,
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                          }}
                                          title="Частичная оплата"
                                        >
                                          Частично
                                        </button>
                                        <button
                                          onClick={() => handleDeleteManual(order.id)}
                                          disabled={deletingId === order.id}
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#ef4444',
                                            fontSize: 14,
                                            opacity: deletingId === order.id ? 0.4 : 1,
                                          }}
                                          title="Удалить"
                                        >
                                          🗑
                                        </button>
                                      </>
                                    )}
                                    <button
                                      onClick={() => handleMarkPaid(order)}
                                      disabled={markingId === order.id}
                                      style={{
                                        padding: '4px 10px',
                                        background: '#059669',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 6,
                                        fontSize: 10,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        opacity: markingId === order.id ? 0.5 : 1,
                                      }}
                                    >
                                      {markingId === order.id ? '...' : '✓ Оплачено'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Panel: Кредиты и лизинг ────────────────────────────────────────────────

function LoansPanel() {
  const [activeChip, setActiveChip] = useState('all');

  const { data: loans = [], isLoading } = useQuery<Loan[]>({
    queryKey: ['loans-all'],
    queryFn: () => fetch('/api/loans').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const filtered = loans.filter((l) => {
    if (activeChip === 'all') return true;
    if (activeChip === 'credit') return l.loan_type === 'credit';
    if (activeChip === 'leasing') return l.loan_type === 'leasing';
    return true;
  });

  const totalRemaining = loans.reduce((s, l) => s + n(l.remaining_amount), 0);
  const totalOriginal = loans.reduce((s, l) => s + n(l.original_amount), 0);
  const totalPaid = totalOriginal - totalRemaining;
  const monthlyTotal = loans.reduce((s, l) => s + n(l.monthly_payment), 0);

  const loanColor = (type: string) =>
    type === 'leasing'
      ? 'linear-gradient(90deg,#0891b2,#10b981)'
      : 'linear-gradient(90deg,#3b82f6,#6366f1)';

  function paymentStatus(
    dateStr: string | null,
  ): { label: string; bg: string; color: string; days: number } | null {
    if (!dateStr) return null;
    const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
    if (days < 0)
      return { label: `Просрочено ${Math.abs(days)} дн.`, bg: '#fee2e2', color: '#b91c1c', days };
    if (days <= 7) return { label: `Через ${days} дн.`, bg: '#fef3c7', color: '#b45309', days };
    return { label: `Через ${days} дн.`, bg: '#d1fae5', color: '#065f46', days };
  }

  const nextMonths = [1, 2, 3].map((offset) => {
    const d = new Date();
    d.setMonth(d.getMonth() + offset);
    return {
      label: d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
    };
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <Chip
          label="Все"
          active={activeChip === 'all'}
          color="#3b82f6"
          onClick={() => setActiveChip('all')}
        />
        <Chip
          label="🏦 Кредиты"
          active={activeChip === 'credit'}
          color="#3b82f6"
          onClick={() => setActiveChip('credit')}
        />
        <Chip
          label="🚛 Лизинг"
          active={activeChip === 'leasing'}
          color="#0891b2"
          onClick={() => setActiveChip('leasing')}
        />
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}
      >
        <SumCard
          gradient="linear-gradient(135deg,#3b82f6,#0891b2)"
          label="Общий остаток"
          value={rub(totalRemaining)}
          sub={`${loans.length} договора`}
        />
        <SumCard
          gradient="linear-gradient(135deg,#6366f1,#4f46e5)"
          label="Платёж в месяц"
          value={rub(monthlyTotal)}
          sub="суммарный ежемесячный"
        />
        <SumCard
          gradient="linear-gradient(135deg,#10b981,#059669)"
          label="Погашено всего"
          value={rub(totalPaid)}
          sub={`${totalOriginal > 0 ? Math.round((totalPaid / totalOriginal) * 100) : 0}% от суммы займов`}
        />
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 180,
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
              }}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))',
            gap: 14,
          }}
        >
          {filtered.map((loan) => {
            const paid = n(loan.original_amount) - n(loan.remaining_amount);
            const paidPct =
              n(loan.original_amount) > 0 ? Math.round((paid / n(loan.original_amount)) * 100) : 0;
            const isLeasing = loan.loan_type === 'leasing';
            return (
              <Card key={loan.id}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '14px 16px',
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: isLeasing ? '#d1fae5' : '#dbeafe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      flexShrink: 0,
                    }}
                  >
                    {isLeasing ? '🚛' : '🏦'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: '#1e293b',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {loan.lender_name}
                    </p>
                    {loan.purpose && (
                      <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{loan.purpose}</p>
                    )}
                  </div>
                  <StatusBadge label="активен" bg="#d1fae5" color="#065f46" />
                </div>
                {loan.next_payment_date &&
                  (() => {
                    const ps = paymentStatus(loan.next_payment_date);
                    if (!ps) return null;
                    const dateLabel = new Date(loan.next_payment_date).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                    });
                    return (
                      <div
                        style={{
                          margin: '0 16px 0',
                          padding: '8px 12px',
                          borderRadius: 8,
                          background: ps.bg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 0,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14 }}>
                            {ps.days < 0 ? '🔴' : ps.days <= 7 ? '🟡' : '🟢'}
                          </span>
                          <div>
                            <p
                              style={{
                                fontSize: 9,
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '.08em',
                                color: ps.color,
                              }}
                            >
                              Следующий платёж
                            </p>
                            <p
                              style={{
                                fontSize: 13,
                                fontWeight: 900,
                                color: ps.color,
                                marginTop: 1,
                              }}
                            >
                              {dateLabel}
                            </p>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: '3px 10px',
                              borderRadius: 20,
                              background: ps.color,
                              color: '#fff',
                            }}
                          >
                            {ps.label}
                          </span>
                          {loan.monthly_payment && (
                            <p
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: ps.color,
                                marginTop: 3,
                              }}
                            >
                              {rub(n(loan.monthly_payment))}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 10,
                    padding: '12px 16px',
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '.08em',
                        color: '#94a3b8',
                      }}
                    >
                      Остаток
                    </p>
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 900,
                        marginTop: 2,
                        color: isLeasing ? '#0891b2' : '#3b82f6',
                      }}
                    >
                      {rub(n(loan.remaining_amount))}
                    </p>
                  </div>
                  <div>
                    <p
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '.08em',
                        color: '#94a3b8',
                      }}
                    >
                      Платёж/мес
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 900, marginTop: 2 }}>
                      {loan.monthly_payment ? rub(n(loan.monthly_payment)) : '—'}
                    </p>
                  </div>
                  <div>
                    <p
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '.08em',
                        color: '#94a3b8',
                      }}
                    >
                      Ставка
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 900, marginTop: 2 }}>
                      {loan.annual_rate ? `${loan.annual_rate}%` : '—'}
                    </p>
                  </div>
                </div>
                <div style={{ padding: '0 16px 14px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 9,
                      color: '#94a3b8',
                      marginBottom: 5,
                    }}
                  >
                    <span>Погашено: {rub(paid)}</span>
                    <span>{paidPct}%</span>
                  </div>
                  <ProgBar
                    value={paid}
                    max={n(loan.original_amount)}
                    color={loanColor(loan.loan_type)}
                    height={8}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Payment calendar */}
      {loans.length > 0 && (
        <Card style={{ marginTop: 14 }}>
          <CardHead title="Платёжный календарь — следующие 3 месяца" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>
            {nextMonths.map((m, idx) => (
              <div
                key={idx}
                style={{
                  padding: '14px 20px',
                  borderRight: idx < 2 ? '1px solid #f1f5f9' : undefined,
                }}
              >
                <p
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '.1em',
                    color: '#94a3b8',
                    marginBottom: 10,
                  }}
                >
                  {m.label}
                </p>
                {loans
                  .filter((l) => l.monthly_payment)
                  .map((l) => {
                    const ps = paymentStatus(l.next_payment_date);
                    return (
                      <div
                        key={l.id}
                        style={{
                          marginBottom: 8,
                          padding: '7px 8px',
                          borderRadius: 7,
                          background: ps ? ps.bg : 'transparent',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: '#374151',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '55%',
                            }}
                          >
                            {l.lender_name}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 900,
                              color: l.loan_type === 'leasing' ? '#0891b2' : '#3b82f6',
                            }}
                          >
                            {rub(n(l.monthly_payment))}
                          </span>
                        </div>
                        {l.next_payment_date && (
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}
                          >
                            <span style={{ fontSize: 10 }}>
                              {ps && ps.days < 0 ? '🔴' : ps && ps.days <= 7 ? '🟡' : '📅'}
                            </span>
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                color: ps ? ps.color : '#64748b',
                              }}
                            >
                              {new Date(l.next_payment_date).toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'short',
                              })}
                              {ps && ` · ${ps.label}`}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                <div
                  style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#475569' }}>Итого</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#ef4444' }}>
                    {rub(monthlyTotal)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Panel: Долги поставщикам ────────────────────────────────────────────────

function PayablesPanel() {
  const [activeChip, setActiveChip] = useState('all');

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ['payables-all'],
    queryFn: () => fetch('/api/payables').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const totalDebt = suppliers.reduce((s, sup) => s + n(sup.debt), 0);
  const largest = suppliers.reduce((a, b) => (n(a.debt) > n(b.debt) ? a : b), suppliers[0]);
  const paidThisMonth = suppliers.reduce((s, sup) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return (
      s +
      (sup.history ?? [])
        .filter((h) => h.created_at >= monthStart && h.settlement_status === 'completed')
        .reduce((a, h) => a + n(h.amount), 0)
    );
  }, 0);

  const filtered = suppliers.filter((s) =>
    activeChip === 'all' ? true : s.name.includes(activeChip),
  );

  const supColors: Record<string, string> = {
    Дерябин: '#ef4444',
    Новиков: '#ec4899',
    Ромашин: '#f59e0b',
  };

  function supColor(name: string) {
    for (const [kw, c] of Object.entries(supColors)) {
      if (name.includes(kw)) return c;
    }
    return '#64748b';
  }

  function supBg(name: string) {
    if (name.includes('Дерябин')) return '#fee2e2';
    if (name.includes('Новиков')) return '#fce7f3';
    if (name.includes('Ромашин')) return '#fef3c7';
    return '#f8fafc';
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        <Chip
          label="Все поставщики"
          active={activeChip === 'all'}
          color="#ef4444"
          onClick={() => setActiveChip('all')}
        />
        {suppliers.map((s) => (
          <Chip
            key={s.id}
            label={`${s.icon} ${s.name}`}
            active={activeChip === s.name}
            color={supColor(s.name)}
            onClick={() => setActiveChip(s.name)}
          />
        ))}
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}
      >
        <SumCard
          gradient="linear-gradient(135deg,#ef4444,#e11d48)"
          label="Общий долг"
          value={rub(totalDebt)}
          sub={`${suppliers.length} поставщика`}
        />
        <SumCard
          gradient="linear-gradient(135deg,#f97316,#f59e0b)"
          label="Крупнейший долг"
          value={largest ? rub(n(largest.debt)) : '—'}
          sub={largest?.name ?? ''}
        />
        <SumCard
          gradient="linear-gradient(135deg,#10b981,#059669)"
          label="Оплачено в этом мес."
          value={rub(paidThisMonth)}
          sub="платежи поставщикам"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {isLoading
            ? [1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 64,
                    background: '#fff',
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                  }}
                />
              ))
            : filtered.map((sup) => {
                const debt = n(sup.debt);
                const color = supColor(sup.name);
                const bg = supBg(sup.name);
                const LIMIT = 100000;
                const usedPct = Math.min(Math.round((debt / LIMIT) * 100), 100);
                return (
                  <Card key={sup.id} style={{ padding: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 14px',
                      }}
                    >
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 8,
                          background: bg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 15,
                          flexShrink: 0,
                        }}
                      >
                        {sup.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}
                        >
                          <p style={{ fontSize: 12, fontWeight: 800, color: '#1e293b' }}>
                            {sup.name}
                          </p>
                          <StatusBadge
                            label={debt > 0 ? `${sup.debtDays ?? 0} дн.` : 'ок'}
                            bg={debt > 0 ? '#fee2e2' : '#d1fae5'}
                            color={debt > 0 ? '#b91c1c' : '#065f46'}
                          />
                        </div>
                        <ProgBar
                          value={debt}
                          max={LIMIT}
                          color={`linear-gradient(90deg,${color},${color}aa)`}
                          height={4}
                        />
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p
                          style={{
                            fontSize: 14,
                            fontWeight: 900,
                            color: debt > 0 ? color : '#10b981',
                          }}
                        >
                          {rub(debt)}
                        </p>
                        <p style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>
                          лимит {usedPct}% · {sup.history?.length ?? 0} опер.
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <CardHead title="Структура долга" />
            <div style={{ padding: '14px 16px' }}>
              <StackBar
                segments={suppliers.map((s) => ({
                  flex: Math.max(n(s.debt), 0),
                  color: supColor(s.name),
                  label: s.name,
                }))}
              />
            </div>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px 16px' }}
            >
              {suppliers.map((s) => (
                <LegendRow
                  key={s.id}
                  color={supColor(s.name)}
                  name={s.name}
                  pct={totalDebt > 0 ? Math.round((n(s.debt) / totalDebt) * 100) : 0}
                  amount={n(s.debt)}
                />
              ))}
            </div>
          </Card>

          <Card style={{ padding: 16 }}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '.1em',
                color: '#475569',
                marginBottom: 12,
              }}
            >
              Действия
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a
                href="/payables"
                style={{
                  display: 'block',
                  padding: '10px',
                  background: '#0f172a',
                  color: '#fff',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: 'none',
                  textAlign: 'center',
                }}
              >
                + Добавить долг
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Tab amount helpers ─────────────────────────────────────────────────────

function TabAmount({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 900, opacity: 0.85 }}>
      {children}
    </span>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

const TAB_GRADIENTS: Record<Tab, string> = {
  expenses: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
  recv: 'linear-gradient(135deg,#f59e0b,#f97316)',
  loans: 'linear-gradient(135deg,#3b82f6,#0891b2)',
  payables: 'linear-gradient(135deg,#ef4444,#e11d48)',
};

export default function FinancePage() {
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as Tab | null;
  const VALID_TABS: Tab[] = ['expenses', 'recv', 'loans', 'payables'];
  const [activeTab, setActiveTab] = useState<Tab>(
    tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'expenses',
  );
  const currentMonth = todayMonth();

  const { data: recvSummary } = useQuery<{ total: string }>({
    queryKey: ['recv-summary'],
    queryFn: () => fetch('/api/receivables/summary').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const { data: loans = [] } = useQuery<Loan[]>({
    queryKey: ['loans-all'],
    queryFn: () => fetch('/api/loans').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['payables-all'],
    queryFn: () => fetch('/api/payables').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const { data: expSummary } = useQuery<ExpenseMonthData>({
    queryKey: ['finance-month', currentMonth],
    queryFn: () => fetch(`/api/finance?month=${currentMonth}`).then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const expTotal = (expSummary?.transactions ?? []).reduce((s, t) => s + n(t.amount), 0);
  const loansTotal = loans.reduce((s, l) => s + n(l.remaining_amount), 0);
  const payablesTotal = suppliers.reduce((s, sup) => s + n(sup.debt), 0);

  const tabs: { id: Tab; icon: string; label: string; sub: string; amount: string }[] = [
    {
      id: 'expenses',
      icon: '📊',
      label: 'Расходы',
      sub: 'структура и аналитика',
      amount: rub(expTotal),
    },
    {
      id: 'recv',
      icon: '📋',
      label: 'Дебиторка',
      sub: 'долги контрагентов',
      amount: recvSummary?.total ? rub(n(recvSummary.total)) : '...',
    },
    {
      id: 'loans',
      icon: '🏦',
      label: 'Кредиты и лизинг',
      sub: 'обязательства компании',
      amount: rub(loansTotal),
    },
    {
      id: 'payables',
      icon: '🧾',
      label: 'Долги поставщикам',
      sub: 'Дерябин, Новиков, Ромашин',
      amount: rub(payablesTotal),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                border: '2px solid transparent',
                background: isActive ? TAB_GRADIENTS[tab.id] : '#fff',
                color: isActive ? '#fff' : '#64748b',
                boxShadow: isActive ? '0 4px 16px rgba(0,0,0,.18)' : '0 1px 3px rgba(0,0,0,.06)',
                transform: isActive ? 'translateY(-1px)' : 'none',
                transition: 'all .22s cubic-bezier(.4,0,.2,1)',
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'left' }}>
                <span style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.1 }}>{tab.label}</span>
                <span
                  style={{ fontSize: 9, fontWeight: 600, opacity: 0.7, letterSpacing: '.03em' }}
                >
                  {tab.sub}
                </span>
              </span>
              <TabAmount>{tab.amount}</TabAmount>
            </button>
          );
        })}
      </div>

      {/* Active panel */}
      <div key={activeTab}>
        {activeTab === 'expenses' && <ExpensesPanel />}
        {activeTab === 'recv' && <ReceivablesPanel />}
        {activeTab === 'loans' && <LoansPanel />}
        {activeTab === 'payables' && <PayablesPanel />}
      </div>
    </div>
  );
}
