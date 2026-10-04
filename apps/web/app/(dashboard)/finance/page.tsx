'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ReceivablesPage from '../receivables/page';
import { PaymentCalendarPanel } from '@/components/PaymentCalendarPanel';

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = 'expenses' | 'income' | 'recv' | 'calendar';

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

// ── Helpers ────────────────────────────────────────────────────────────────

function todayMonth() {
  return new Date().toISOString().slice(0, 7);
}
function formatMonthLabel(ym: string) {
  const parts = ym.split('-').map(Number);
  const y = parts[0] ?? new Date().getFullYear();
  const m = parts[1] ?? new Date().getMonth() + 1;
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
  calendar: 'linear-gradient(135deg,#3b82f6,#2563eb)',
};

export default function FinancePage() {
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as Tab | null;
  const VALID_TABS: Tab[] = ['expenses', 'income', 'recv', 'calendar'];
  const [activeTab, setActiveTab] = useState<Tab>(
    tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'expenses',
  );
  const currentMonth = todayMonth();

  const { data: recvSummary } = useQuery<{ total: string }>({
    queryKey: ['recv-summary'],
    queryFn: () => fetch('/api/receivables/summary').then((r) => r.json()),
    staleTime: 60 * 1000,
  });

  const { data: expSummary } = useQuery<ExpenseMonthData>({
    queryKey: ['finance-month', currentMonth],
    queryFn: () => fetch(`/api/finance?month=${currentMonth}`).then((r) => r.json()),
    staleTime: 60 * 1000,
    refetchInterval: 30 * 1000,
  });

  const { data: calData } = useQuery<{ summary: { remainingThisMonth: number } }>({
    queryKey: ['payment-calendar'],
    queryFn: () => fetch('/api/payment-calendar').then((r) => r.json()),
    staleTime: 60 * 1000,
  });

  const expTotal = (expSummary?.transactions ?? []).reduce((s, t) => s + n(t.amount), 0);
  const incTotal =
    (expSummary?.income_transactions ?? []).reduce((s, t) => s + n(t.amount), 0) +
    n(expSummary?.revenue);

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
      id: 'calendar',
      icon: '📅',
      label: 'Платёжный календарь',
      sub: 'обязательные платежи и прогноз',
      amount: calData?.summary?.remainingThisMonth
        ? rub(calData.summary.remainingThisMonth)
        : 'План',
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
              <TabAmount>{tab.amount}</TabAmount>
            </button>
          );
        })}
      </div>

      {/* Active panel */}
      <div key={activeTab}>
        {activeTab === 'expenses' && <ExpensesPanel />}
        {activeTab === 'income' && <IncomePanel />}
        {activeTab === 'recv' && <ReceivablesPanel />}
        {activeTab === 'calendar' && <PaymentCalendarPanel />}
      </div>
    </div>
  );
}
