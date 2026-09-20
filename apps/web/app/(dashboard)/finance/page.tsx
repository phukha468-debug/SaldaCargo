'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ReceivablesPage from '../receivables/page';

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = 'expenses' | 'income' | 'recv' | 'loans' | 'payables';

type ExpenseTx = {
  id: string;
  amount: string;
  description: string | null;
  created_at: string;
  category: { name: string; code: string } | null;
};

type IncomeTx = {
  id: string;
  amount: string;
  description: string | null;
  created_at: string;
  category: { name: string; code: string } | null;
  counterparty: { name: string } | null;
  to_wallet: { name: string } | null;
};

type ExpenseMonthData = {
  transactions: ExpenseTx[];
  income_transactions: IncomeTx[];
  revenue: string;
  pnl: unknown[];
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
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [selectedTx, setSelectedTx] = useState<ExpenseTx | null>(null);
  const queryClient = useQueryClient();

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
    staleTime: 60 * 1000,
    refetchInterval: 30 * 1000,
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || 'Аннулировано администратором' }),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? 'Ошибка');
        return data;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-month'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      queryClient.invalidateQueries({ queryKey: ['recv-summary'] });
      queryClient.invalidateQueries({ queryKey: ['receivables-summary'] });
      queryClient.invalidateQueries({ queryKey: ['payables'] });
      setPendingCancelId(null);
      setCancelReason('');
    },
  });

  const txList = data?.transactions ?? [];
  const tripRevenue = n(data?.revenue);
  const manualIncome = (data?.income_transactions ?? []).reduce((s, t) => s + n(t.amount), 0);
  const allIncome = tripRevenue + manualIncome;

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
  const periodAllIncome = timePeriod === 'month' ? allIncome : 0;
  const profit = periodAllIncome - totalExp;
  const margin = periodAllIncome > 0 ? Math.round((profit / periodAllIncome) * 100) : 0;

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
              ? `маржа ${margin}% · доход ${rub(allIncome)}`
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
                const { cleanTitle, trips } = parseTripsFromDescription(
                  tx.description || tx.category?.name,
                );
                const name = cleanTitle || tx.category?.name || 'Без категории';
                const catName = tx.category?.name ?? null;
                const group = getExpenseGroup(tx);
                const color = group.color;
                const isConfirming = pendingCancelId === tx.id;
                return (
                  <div key={tx.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <div
                      className="group"
                      onClick={() => setSelectedTx(tx)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '6px 14px',
                        transition: 'background .1s',
                        cursor: 'pointer',
                        background: isConfirming ? '#fef2f2' : undefined,
                      }}
                      onMouseOver={(e) => {
                        if (!isConfirming) e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseOut={(e) => {
                        if (!isConfirming) e.currentTarget.style.background = '';
                      }}
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
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span>{name}</span>
                        {trips.length > 0 && (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 800,
                              background: '#dbeafe',
                              color: '#1d4ed8',
                              padding: '1px 6px',
                              borderRadius: 6,
                              flexShrink: 0,
                            }}
                          >
                            {trips.length} рейсов
                          </span>
                        )}
                      </p>
                      <span
                        style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', flexShrink: 0 }}
                      >
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
                      <button
                        title="Аннулировать"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingCancelId(isConfirming ? null : tx.id);
                          setCancelReason('');
                        }}
                        style={{
                          flexShrink: 0,
                          width: 22,
                          height: 22,
                          borderRadius: 4,
                          border: 'none',
                          background: isConfirming ? '#fca5a5' : 'transparent',
                          color: isConfirming ? '#7f1d1d' : '#cbd5e1',
                          cursor: 'pointer',
                          fontSize: 13,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background .15s, color .15s',
                        }}
                        onMouseOver={(e) => {
                          if (!isConfirming) {
                            e.currentTarget.style.background = '#fee2e2';
                            e.currentTarget.style.color = '#dc2626';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (!isConfirming) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#cbd5e1';
                          }
                        }}
                      >
                        ✕
                      </button>
                    </div>
                    {isConfirming && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 14px 8px 28px',
                          background: '#fef2f2',
                        }}
                      >
                        <input
                          type="text"
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          placeholder="Причина (необязательно)"
                          autoFocus
                          style={{
                            flex: 1,
                            height: 28,
                            borderRadius: 6,
                            border: '1px solid #fca5a5',
                            padding: '0 8px',
                            fontSize: 11,
                            outline: 'none',
                            background: '#fff',
                          }}
                        />
                        <button
                          onClick={() => cancelMutation.mutate({ id: tx.id, reason: cancelReason })}
                          disabled={cancelMutation.isPending}
                          style={{
                            height: 28,
                            padding: '0 10px',
                            borderRadius: 6,
                            border: 'none',
                            background: '#dc2626',
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            opacity: cancelMutation.isPending ? 0.6 : 1,
                          }}
                        >
                          {cancelMutation.isPending ? '...' : 'Аннулировать'}
                        </button>
                        <button
                          onClick={() => {
                            setPendingCancelId(null);
                            setCancelReason('');
                          }}
                          style={{
                            height: 28,
                            padding: '0 8px',
                            borderRadius: 6,
                            border: '1px solid #e2e8f0',
                            background: '#fff',
                            fontSize: 11,
                            cursor: 'pointer',
                            color: '#64748b',
                          }}
                        >
                          Отмена
                        </button>
                      </div>
                    )}
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

      {selectedTx && <ExpenseDetailModal tx={selectedTx} onClose={() => setSelectedTx(null)} />}
    </div>
  );
}

type ParsedTrip = {
  label: string;
  amount: string;
};

function parseTripsFromDescription(description?: string | null): {
  cleanTitle: string;
  trips: ParsedTrip[];
} {
  if (!description) return { cleanTitle: 'Без описания', trips: [] };
  const firstParen = description.indexOf('(');
  const lastParen = description.lastIndexOf(')');
  if (firstParen === -1 || lastParen === -1 || firstParen >= lastParen) {
    return { cleanTitle: description, trips: [] };
  }

  const cleanTitle = description.slice(0, firstParen).trim();
  const innerStr = description.slice(firstParen + 1, lastParen).trim();

  const regex = /([^,\(\)]+?(?:\s*—\s*[^,\(\)]+)?)\s*\(([^)]+)\)/g;
  const trips: ParsedTrip[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(innerStr)) !== null) {
    if (m[1]) {
      trips.push({ label: m[1].trim(), amount: (m[2] ?? '').trim() });
    }
  }

  if (trips.length === 0 && innerStr) {
    const rawItems = innerStr.split(', ');
    rawItems.forEach((item) => trips.push({ label: item.trim(), amount: '' }));
  }

  return { cleanTitle, trips };
}

function ExpenseDetailModal({ tx, onClose }: { tx: ExpenseTx; onClose: () => void }) {
  const { cleanTitle, trips } = parseTripsFromDescription(tx.description);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 20,
          width: '100%',
          maxWidth: 520,
          padding: 24,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Детали финансовой операции
            </p>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>
              {tx.category?.name || 'Расход'}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: '#f1f5f9',
              border: 'none',
              color: '#64748b',
              fontWeight: 700,
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ background: '#f8fafc', borderRadius: 16, padding: 16, textAlign: 'center' }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 4,
            }}
          >
            Сумма списания
          </p>
          <p style={{ fontSize: 28, fontWeight: 900, color: '#ef4444' }}>
            {parseFloat(tx.amount || '0').toLocaleString('ru-RU')} ₽
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: 12 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: '#94a3b8',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: 2,
              }}
            >
              Описание
            </span>
            <span style={{ fontWeight: 700, color: '#1e293b' }}>{cleanTitle}</span>
          </div>

          <div
            style={{
              background: '#f8fafc',
              borderRadius: 12,
              padding: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: '#94a3b8',
                textTransform: 'uppercase',
              }}
            >
              Дата проведения
            </span>
            <span style={{ fontWeight: 700, color: '#1e293b' }}>
              {new Date(tx.created_at).toLocaleString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        {trips.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              paddingTop: 14,
              borderTop: '1px solid #f1f5f9',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Входящие в эту сумму рейсы
              </p>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  background: '#dbeafe',
                  color: '#1d4ed8',
                  padding: '2px 8px',
                  borderRadius: 8,
                }}
              >
                {trips.length} рейсов
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: 260,
                overflowY: 'auto',
                paddingRight: 4,
              }}
            >
              {trips.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>🚛</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                      {item.label}
                    </span>
                  </div>
                  {item.amount && (
                    <span style={{ fontSize: 13, fontWeight: 900, color: '#16a34a' }}>
                      {item.amount}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Panel: Дебиторка ────────────────────────────────────────────────────────

function ReceivablesPanel() {
  return <ReceivablesPage />;
}

// ── Panel: Кредиты и лизинг ────────────────────────────────────────────────

function LoansPanel() {
  const [activeChip, setActiveChip] = useState('all');
  const [payLoan, setPayLoan] = useState<Loan | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payWallet, setPayWallet] = useState<'bank' | 'cash'>('bank');
  const [payDesc, setPayDesc] = useState('');
  const [payPending, setPayPending] = useState(false);
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [addLoanPending, setAddLoanPending] = useState(false);
  const [addForm, setAddForm] = useState({
    lender_name: '',
    loan_type: 'credit',
    purpose: '',
    original_amount: '',
    remaining_amount: '',
    annual_rate: '',
    monthly_payment: '',
    started_at: '',
    next_payment_date: '',
    notes: '',
    to_wallet_id: '10000000-0000-0000-0000-000000000001', // Р/С (Банк) default
  });
  const queryClient = useQueryClient();

  const { data: loans = [], isLoading } = useQuery<Loan[]>({
    queryKey: ['loans-all'],
    queryFn: () => fetch('/api/loans').then((r) => r.json()),
    staleTime: 60 * 1000,
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

  const WALLET_IDS = {
    bank: '10000000-0000-0000-0000-000000000001',
    cash: '10000000-0000-0000-0000-000000000002',
  };

  async function handlePayLoan() {
    if (!payLoan) return;
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Введите корректную сумму');
      return;
    }
    setPayPending(true);
    try {
      const r = await fetch(`/api/loans/${payLoan.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt.toFixed(2),
          from_wallet_id: WALLET_IDS[payWallet],
          description: payDesc.trim() || undefined,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `Статус ${r.status}`);
      setPayLoan(null);
      setPayAmount('');
      setPayDesc('');
      await queryClient.invalidateQueries({ queryKey: ['loans-all'] });
      if (json.fully_repaid) alert('Кредит полностью погашен!');
    } catch (e: unknown) {
      alert('Ошибка: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPayPending(false);
    }
  }

  async function handleCreateLoan() {
    if (!addForm.lender_name.trim()) return alert('Укажите кредитора');
    if (!addForm.original_amount) return alert('Укажите первоначальную сумму');
    setAddLoanPending(true);
    try {
      const r = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...addForm,
          remaining_amount: addForm.remaining_amount || addForm.original_amount,
          started_at: addForm.started_at || new Date().toISOString().split('T')[0],
        }),
      });
      if (!r.ok) {
        const json = await r.json();
        throw new Error(json.error || 'Ошибка при сохранении');
      }
      setShowAddLoan(false);
      setAddForm({
        lender_name: '',
        loan_type: 'credit',
        purpose: '',
        original_amount: '',
        remaining_amount: '',
        annual_rate: '',
        monthly_payment: '',
        started_at: '',
        next_payment_date: '',
        notes: '',
        to_wallet_id: '10000000-0000-0000-0000-000000000001',
      });
      await queryClient.invalidateQueries({ queryKey: ['loans-all'] });
    } catch (e: unknown) {
      alert('Ошибка: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setAddLoanPending(false);
    }
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
      {showAddLoan && (
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
          onClick={() => setShowAddLoan(false)}
        >
          <div
            style={{
              background: '#1e293b',
              borderRadius: 16,
              padding: 24,
              width: 440,
              maxHeight: '90vh',
              overflowY: 'auto',
              color: '#f1f5f9',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 16 }}>
              Новый кредит / лизинг
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8' }}>Кредитор / Банк *</label>
                <input
                  type="text"
                  placeholder="Сбербанк"
                  value={addForm.lender_name}
                  onChange={(e) => setAddForm({ ...addForm, lender_name: e.target.value })}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#f1f5f9',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8' }}>Тип обязательства</label>
                <select
                  value={addForm.loan_type}
                  onChange={(e) => setAddForm({ ...addForm, loan_type: e.target.value })}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#f1f5f9',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="credit">Кредит</option>
                  <option value="leasing">Лизинг</option>
                  <option value="borrow">Займ</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8' }}>Исходная сумма (₽) *</label>
                <input
                  type="number"
                  placeholder="1500000"
                  value={addForm.original_amount}
                  onChange={(e) => setAddForm({ ...addForm, original_amount: e.target.value })}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#f1f5f9',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8' }}>Зачислить на кошелёк</label>
                <select
                  value={addForm.to_wallet_id}
                  onChange={(e) => setAddForm({ ...addForm, to_wallet_id: e.target.value })}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#f1f5f9',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="10000000-0000-0000-0000-000000000001">Р/С (Банк)</option>
                  <option value="10000000-0000-0000-0000-000000000002">Сейф (Наличные)</option>
                  <option value="10000000-0000-0000-0000-000000000003">Карта</option>
                  <option value="10000000-0000-0000-0000-000000000004">
                    Топливная карта (ГСМ)
                  </option>
                  <option value="">Без зачисления на кошелёк</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8' }}>Остаток долга (₽)</label>
                <input
                  type="number"
                  placeholder="1500000"
                  value={addForm.remaining_amount}
                  onChange={(e) => setAddForm({ ...addForm, remaining_amount: e.target.value })}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#f1f5f9',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8' }}>Ежемесячный платёж (₽)</label>
                <input
                  type="number"
                  placeholder="45000"
                  value={addForm.monthly_payment}
                  onChange={(e) => setAddForm({ ...addForm, monthly_payment: e.target.value })}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#f1f5f9',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8' }}>Дата следующего платежа</label>
                <input
                  type="date"
                  value={addForm.next_payment_date}
                  onChange={(e) => setAddForm({ ...addForm, next_payment_date: e.target.value })}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#f1f5f9',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8' }}>Назначение / Цель</label>
                <input
                  type="text"
                  placeholder="Валдай 2022, оборотные средства..."
                  value={addForm.purpose}
                  onChange={(e) => setAddForm({ ...addForm, purpose: e.target.value })}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#f1f5f9',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button
                onClick={() => setShowAddLoan(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 8,
                  border: '1px solid #334155',
                  background: 'transparent',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Отмена
              </button>
              <button
                onClick={handleCreateLoan}
                disabled={addLoanPending}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#2563eb',
                  color: '#fff',
                  cursor: addLoanPending ? 'default' : 'pointer',
                  fontWeight: 700,
                  fontSize: 13,
                  opacity: addLoanPending ? 0.5 : 1,
                }}
              >
                {addLoanPending ? 'Сохранение...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {payLoan && (
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
          onClick={() => setPayLoan(null)}
        >
          <div
            style={{
              background: '#1e293b',
              borderRadius: 16,
              padding: 24,
              width: 360,
              color: '#f1f5f9',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Погасить кредит</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
              {payLoan.lender_name}
              {payLoan.monthly_payment && <> · платёж {rub(n(payLoan.monthly_payment))}</>}
            </div>
            <label style={{ fontSize: 12, color: '#94a3b8' }}>Сумма платежа (₽)</label>
            <input
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder={payLoan.monthly_payment ? String(n(payLoan.monthly_payment)) : '0'}
              autoFocus
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
                boxSizing: 'border-box',
              }}
            />
            <label style={{ fontSize: 12, color: '#94a3b8' }}>Списать со счёта</label>
            <select
              value={payWallet}
              onChange={(e) => setPayWallet(e.target.value as 'bank' | 'cash')}
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
                boxSizing: 'border-box',
              }}
            >
              <option value="bank">Банк (р/с)</option>
              <option value="cash">Касса (наличные)</option>
            </select>
            <label style={{ fontSize: 12, color: '#94a3b8' }}>Описание (необязательно)</label>
            <input
              type="text"
              value={payDesc}
              onChange={(e) => setPayDesc(e.target.value)}
              placeholder={`Платёж по кредиту: ${payLoan.lender_name}`}
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
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setPayLoan(null)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 8,
                  border: '1px solid #334155',
                  background: 'transparent',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Отмена
              </button>
              <button
                onClick={handlePayLoan}
                disabled={payPending || !payAmount}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#2563eb',
                  color: '#fff',
                  cursor: payPending || !payAmount ? 'default' : 'pointer',
                  fontWeight: 700,
                  fontSize: 13,
                  opacity: payPending || !payAmount ? 0.5 : 1,
                }}
              >
                {payPending ? '...' : 'Провести платёж'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
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
        <button
          onClick={() => setShowAddLoan(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#0f172a',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            padding: '6px 14px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          + Добавить кредит
        </button>
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
                  <button
                    onClick={() => {
                      setPayLoan(loan);
                      setPayAmount(loan.monthly_payment ? String(n(loan.monthly_payment)) : '');
                      setPayWallet('bank');
                      setPayDesc('');
                    }}
                    style={{
                      marginTop: 10,
                      width: '100%',
                      padding: '8px',
                      borderRadius: 8,
                      border: 'none',
                      background: isLeasing
                        ? 'linear-gradient(90deg,#0891b2,#10b981)'
                        : 'linear-gradient(90deg,#3b82f6,#6366f1)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Погасить кредит
                  </button>
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
    queryKey: ['payables'],
    queryFn: () => fetch('/api/payables').then((r) => r.json()),
    staleTime: 60 * 1000,
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
              Управление
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
                Управлять долгами поставщиков →
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Panel: Доходы ──────────────────────────────────────────────────────────

const INCOME_PAYMENT_LABELS: Record<string, string> = {
  cash: 'Нал',
  qr: 'QR / Р/С',
  bank_invoice: 'Р/С (договор)',
  card_driver: 'Карта',
  debt_cash: 'Долг нал',
};

function IncomePanel() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [anchorDate, setAnchorDate] = useState(todayStr);
  const [timePeriod, setTimePeriod] = useState<'day' | 'week' | 'month'>('month');
  const [activeChip, setActiveChip] = useState<'all' | 'trips' | 'manual'>('all');
  const [activeCatFilter, setActiveCatFilter] = useState<string | null>(null);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const queryClient = useQueryClient();

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
    return selectedMonth >= todayStr.slice(0, 7);
  })();

  const { data, isLoading } = useQuery<ExpenseMonthData>({
    queryKey: ['finance-month', selectedMonth],
    queryFn: () => fetch(`/api/finance?month=${selectedMonth}`).then((r) => r.json()),
    staleTime: 60 * 1000,
    refetchInterval: 30 * 1000,
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || 'Аннулировано администратором' }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Ошибка');
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-month'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      queryClient.invalidateQueries({ queryKey: ['recv-summary'] });
      queryClient.invalidateQueries({ queryKey: ['receivables-summary'] });
      queryClient.invalidateQueries({ queryKey: ['payables'] });
      setPendingCancelId(null);
      setCancelReason('');
    },
  });

  const allIncomeTxs = data?.income_transactions ?? [];
  const revenue = n(data?.revenue);

  const periodIncomeTxs = allIncomeTxs.filter((tx) => {
    const txDate = tx.created_at.slice(0, 10);
    if (timePeriod === 'day') return txDate === anchorDate;
    if (timePeriod === 'week') {
      const { mon, sun } = weekBounds(anchorDate);
      return txDate >= mon && txDate <= sun;
    }
    return true;
  });

  // TRIP_REVENUE transactions: cash collected at trip approval → belong in "Выручка с рейсов" row
  const tripRevenueTxs = periodIncomeTxs.filter((tx) => tx.category?.code === 'TRIP_REVENUE');
  const tripRevenueTxTotal = tripRevenueTxs.reduce((s, t) => s + n(t.amount), 0);
  const nonTripIncomeTxs = periodIncomeTxs.filter((tx) => tx.category?.code !== 'TRIP_REVENUE');

  // Month: use trip_orders revenue (covers all settled payment methods).
  // Day/week: use TRIP_REVENUE transactions (real-time cash events from trip approvals).
  const periodRevenue = timePeriod === 'month' ? revenue : 0;
  const tripsTotal = timePeriod === 'month' ? periodRevenue : tripRevenueTxTotal;
  const txTotal = nonTripIncomeTxs.reduce((s, t) => s + n(t.amount), 0);
  const grandTotal = txTotal + tripsTotal;

  // Dynamic income groups by category (excluding TRIP_REVENUE which is merged above)
  const CAT_COLORS = ['#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#64748b'];
  const catMap = new Map<string, number>();
  nonTripIncomeTxs.forEach((tx) => {
    const key = tx.category?.name ?? 'Прочие поступления';
    catMap.set(key, (catMap.get(key) ?? 0) + n(tx.amount));
  });
  const manualGroups = Array.from(catMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, total], i) => ({
      id: name,
      name,
      color: CAT_COLORS[i % CAT_COLORS.length] ?? '#64748b',
      total,
    }));

  const structureGroups = [
    ...(tripsTotal > 0
      ? [{ id: '__trips__', name: 'Выручка с рейсов', color: '#10b981', total: tripsTotal }]
      : []),
    ...manualGroups.filter((g) => g.total > 0),
  ];

  // Visibility logic for chip + category filter
  const showTripsRevenue =
    activeCatFilter === '__trips__'
      ? true
      : activeCatFilter !== null
        ? false
        : activeChip !== 'manual';

  // In day/week mode: TRIP_REVENUE transactions are shown directly in the list under "Рейсы"
  const visibleTxs =
    timePeriod !== 'month'
      ? activeChip === 'manual'
        ? nonTripIncomeTxs
        : activeChip === 'trips' || activeCatFilter === '__trips__'
          ? tripRevenueTxs
          : activeCatFilter !== null
            ? nonTripIncomeTxs.filter(
                (tx) => (tx.category?.name ?? 'Прочие поступления') === activeCatFilter,
              )
            : [...tripRevenueTxs, ...nonTripIncomeTxs]
      : activeChip === 'trips' && activeCatFilter === null
        ? []
        : activeCatFilter === '__trips__'
          ? tripRevenueTxs
          : activeCatFilter !== null
            ? nonTripIncomeTxs.filter(
                (tx) => (tx.category?.name ?? 'Прочие поступления') === activeCatFilter,
              )
            : activeChip === 'trips'
              ? []
              : nonTripIncomeTxs;

  const activeCatGroup = activeCatFilter
    ? (structureGroups.find((g) => g.id === activeCatFilter) ?? null)
    : null;

  const INCOME_CHIPS = [
    { id: 'all' as const, label: 'Все доходы', color: '#10b981' },
    { id: 'trips' as const, label: '🚛 Рейсы', color: '#059669' },
    { id: 'manual' as const, label: '💳 Поступления', color: '#0891b2' },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
      {/* Chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {INCOME_CHIPS.map((c) => (
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
        {activeCatGroup && (
          <Chip
            label={`📂 ${activeCatGroup.name} ×`}
            active={true}
            color={activeCatGroup.color}
            onClick={() => setActiveCatFilter(null)}
          />
        )}
      </div>

      {/* Summary cards */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}
      >
        <SumCard
          gradient="linear-gradient(135deg,#10b981,#059669)"
          label="Выручка с рейсов"
          value={timePeriod === 'month' ? rub(tripsTotal) : '—'}
          sub={timePeriod === 'month' ? 'рейсы + ручной ввод' : 'только за месяц'}
        />
        <SumCard
          gradient="linear-gradient(135deg,#0891b2,#3b82f6)"
          label="Прочие поступления"
          value={rub(txTotal)}
          sub={`${nonTripIncomeTxs.length} транзакц.`}
        />
        <SumCard
          gradient="linear-gradient(135deg,#6366f1,#8b5cf6)"
          label="Итого"
          value={rub(grandTotal)}
          sub={timePeriod !== 'month' ? 'без выручки с рейсов' : 'все поступления'}
        />
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
        {/* Timeline */}
        <Card>
          <CardHead
            title={
              activeCatGroup
                ? `${activeCatGroup.name} — ${periodLabel()}`
                : `Доходы — ${periodLabel()}`
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
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{ height: 48, background: '#f1f5f9', borderRadius: 6, marginBottom: 6 }}
                />
              ))}
            </div>
          ) : (
            <div>
              {/* Trip revenue row — clickable filter */}
              {showTripsRevenue && tripsTotal > 0 && (
                <div
                  onClick={() =>
                    setActiveCatFilter(activeCatFilter === '__trips__' ? null : '__trips__')
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 14px',
                    borderBottom: '1px solid #f1f5f9',
                    background: activeCatFilter === '__trips__' ? '#dcfce7' : '#f0fdf4',
                    cursor: 'pointer',
                    transition: 'background .1s',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = '#dcfce7')}
                  onMouseOut={(e) =>
                    (e.currentTarget.style.background =
                      activeCatFilter === '__trips__' ? '#dcfce7' : '#f0fdf4')
                  }
                >
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: '#10b981',
                      flexShrink: 0,
                    }}
                  />
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#166534',
                      flex: 1,
                    }}
                  >
                    Выручка с рейсов
                  </p>
                  <p
                    style={{
                      fontSize: 9,
                      color: '#6b7280',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      flexShrink: 0,
                      maxWidth: 220,
                      textAlign: 'right',
                    }}
                  >
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {Object.entries((data as any)?.revenue_breakdown ?? {})
                      .filter(([, v]) => (v as number) > 0)
                      .map(([k, v]) => `${INCOME_PAYMENT_LABELS[k] ?? k}: ${rub(n(String(v)))}`)
                      .join(' · ')}
                  </p>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 900,
                      color: '#059669',
                      flexShrink: 0,
                      minWidth: 80,
                      textAlign: 'right',
                    }}
                  >
                    +{rub(tripsTotal)}
                  </span>
                </div>
              )}

              {/* Manual income transactions */}
              {visibleTxs.length === 0 && (!showTripsRevenue || tripsTotal === 0) ? (
                <p style={{ textAlign: 'center', padding: 48, color: '#94a3b8', fontSize: 13 }}>
                  Поступлений нет
                </p>
              ) : visibleTxs.length === 0 ? null : (
                visibleTxs.map((tx) => {
                  const catKey = tx.category?.name ?? 'Прочие поступления';
                  const group = manualGroups.find((g) => g.id === catKey);
                  const color = group?.color ?? '#64748b';
                  const isConfirming = pendingCancelId === tx.id;
                  return (
                    <div key={tx.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '6px 14px',
                          transition: 'background .1s',
                          cursor: 'default',
                          background: isConfirming ? '#fef2f2' : undefined,
                        }}
                        onMouseOver={(e) => {
                          if (!isConfirming) e.currentTarget.style.background = '#f8fafc';
                        }}
                        onMouseOut={(e) => {
                          if (!isConfirming) e.currentTarget.style.background = '';
                        }}
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
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: '#1e293b',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {tx.category?.code === 'TRIP_REVENUE'
                              ? (tx.description ?? tx.category?.name ?? '—')
                              : (tx.category?.name ?? tx.description ?? '—')}
                          </p>
                          {tx.category?.code !== 'TRIP_REVENUE' && tx.counterparty?.name && (
                            <p style={{ fontSize: 10, color: '#2563eb', marginTop: 1 }}>
                              {tx.counterparty.name}
                            </p>
                          )}
                        </div>
                        {tx.to_wallet?.name && tx.category?.code !== 'TRIP_REVENUE' && (
                          <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>
                            {tx.to_wallet.name}
                          </span>
                        )}
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
                          +{rub(n(tx.amount))}
                        </span>
                        <button
                          title="Аннулировать"
                          onClick={() => {
                            setPendingCancelId(isConfirming ? null : tx.id);
                            setCancelReason('');
                          }}
                          style={{
                            flexShrink: 0,
                            width: 22,
                            height: 22,
                            borderRadius: 4,
                            border: 'none',
                            background: isConfirming ? '#fca5a5' : 'transparent',
                            color: isConfirming ? '#7f1d1d' : '#cbd5e1',
                            cursor: 'pointer',
                            fontSize: 13,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background .15s, color .15s',
                          }}
                          onMouseOver={(e) => {
                            if (!isConfirming) {
                              e.currentTarget.style.background = '#fee2e2';
                              e.currentTarget.style.color = '#dc2626';
                            }
                          }}
                          onMouseOut={(e) => {
                            if (!isConfirming) {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.color = '#cbd5e1';
                            }
                          }}
                        >
                          ✕
                        </button>
                      </div>
                      {isConfirming && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 14px 8px 28px',
                            background: '#fef2f2',
                          }}
                        >
                          <input
                            type="text"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="Причина (необязательно)"
                            autoFocus
                            style={{
                              flex: 1,
                              height: 28,
                              borderRadius: 6,
                              border: '1px solid #fca5a5',
                              padding: '0 8px',
                              fontSize: 11,
                              outline: 'none',
                              background: '#fff',
                            }}
                          />
                          <button
                            onClick={() =>
                              cancelMutation.mutate({ id: tx.id, reason: cancelReason })
                            }
                            disabled={cancelMutation.isPending}
                            style={{
                              height: 28,
                              padding: '0 10px',
                              borderRadius: 6,
                              border: 'none',
                              background: '#dc2626',
                              color: '#fff',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              opacity: cancelMutation.isPending ? 0.6 : 1,
                            }}
                          >
                            {cancelMutation.isPending ? '...' : 'Аннулировать'}
                          </button>
                          <button
                            onClick={() => {
                              setPendingCancelId(null);
                              setCancelReason('');
                            }}
                            style={{
                              height: 28,
                              padding: '0 8px',
                              borderRadius: 6,
                              border: '1px solid #e2e8f0',
                              background: '#fff',
                              fontSize: 11,
                              cursor: 'pointer',
                              color: '#64748b',
                            }}
                          >
                            Отмена
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </Card>

        {/* Right: structure */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <CardHead title="Структура доходов" />
            <div style={{ padding: '14px 16px' }}>
              <StackBar
                segments={structureGroups.map(({ color, total, name }) => ({
                  flex: total,
                  color,
                  label: `${name} ${grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0}%`,
                }))}
              />
            </div>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 8px 12px' }}
            >
              {structureGroups.map(({ id, name, color, total }) => (
                <LegendRow
                  key={id}
                  color={color}
                  name={name}
                  pct={grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0}
                  amount={total}
                  active={activeCatFilter === id}
                  onClick={() => {
                    const next = activeCatFilter === id ? null : id;
                    setActiveCatFilter(next);
                    if (next === '__trips__') setActiveChip('trips');
                    else if (next !== null) setActiveChip('manual');
                    else setActiveChip('all');
                  }}
                />
              ))}
              {structureGroups.length === 0 && (
                <p style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 12 }}>
                  Нет данных
                </p>
              )}
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
                  background: 'linear-gradient(135deg,#dcfce7,#bbf7d0)',
                  borderRadius: 10,
                }}
              >
                <p
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '.1em',
                    color: '#166534',
                  }}
                >
                  Рейсы
                </p>
                <p style={{ fontSize: 20, fontWeight: 900, color: '#14532d', marginTop: 4 }}>
                  {grandTotal > 0 ? Math.round((tripsTotal / grandTotal) * 100) : 0}%
                </p>
                <p style={{ fontSize: 9, color: '#16a34a', marginTop: 2 }}>{rub(tripsTotal)}</p>
              </div>
              <div
                style={{
                  padding: '12px 14px',
                  background: 'linear-gradient(135deg,#dbeafe,#bfdbfe)',
                  borderRadius: 10,
                }}
              >
                <p
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '.1em',
                    color: '#1e40af',
                  }}
                >
                  Поступления
                </p>
                <p style={{ fontSize: 20, fontWeight: 900, color: '#1e3a8a', marginTop: 4 }}>
                  {grandTotal > 0 ? Math.round((txTotal / grandTotal) * 100) : 0}%
                </p>
                <p style={{ fontSize: 9, color: '#2563eb', marginTop: 2 }}>{rub(txTotal)}</p>
              </div>
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
  income: 'linear-gradient(135deg,#10b981,#0891b2)',
  recv: 'linear-gradient(135deg,#f59e0b,#f97316)',
  loans: 'linear-gradient(135deg,#3b82f6,#0891b2)',
  payables: 'linear-gradient(135deg,#ef4444,#e11d48)',
};

export default function FinancePage() {
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as Tab | null;
  const VALID_TABS: Tab[] = ['expenses', 'income', 'recv', 'loans', 'payables'];
  const [activeTab, setActiveTab] = useState<Tab>(
    tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'expenses',
  );
  const currentMonth = todayMonth();

  const { data: recvSummary } = useQuery<{ total: string }>({
    queryKey: ['recv-summary'],
    queryFn: () => fetch('/api/receivables/summary').then((r) => r.json()),
    staleTime: 60 * 1000,
  });
  const { data: loans = [] } = useQuery<Loan[]>({
    queryKey: ['loans-all'],
    queryFn: () => fetch('/api/loans').then((r) => r.json()),
    staleTime: 60 * 1000,
  });
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['payables'],
    queryFn: () => fetch('/api/payables').then((r) => r.json()),
    staleTime: 60 * 1000,
  });
  const { data: expSummary } = useQuery<ExpenseMonthData>({
    queryKey: ['finance-month', currentMonth],
    queryFn: () => fetch(`/api/finance?month=${currentMonth}`).then((r) => r.json()),
    staleTime: 60 * 1000,
    refetchInterval: 30 * 1000,
  });

  const expTotal = (expSummary?.transactions ?? []).reduce((s, t) => s + n(t.amount), 0);
  const incTotal =
    (expSummary?.income_transactions ?? []).reduce((s, t) => s + n(t.amount), 0) +
    n(expSummary?.revenue);
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
      id: 'income',
      icon: '📈',
      label: 'Доходы',
      sub: 'поступления за месяц',
      amount: rub(incTotal),
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
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 4,
          scrollbarWidth: 'none',
        }}
      >
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
                flexShrink: 0,
                whiteSpace: 'nowrap',
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
              {tab.id !== 'payables' && <TabAmount>{tab.amount}</TabAmount>}
            </button>
          );
        })}
      </div>

      {/* Active panel */}
      <div key={activeTab}>
        {activeTab === 'expenses' && <ExpensesPanel />}
        {activeTab === 'income' && <IncomePanel />}
        {activeTab === 'recv' && <ReceivablesPanel />}
        {activeTab === 'loans' && <LoansPanel />}
        {activeTab === 'payables' && <PayablesPanel />}
      </div>
    </div>
  );
}
