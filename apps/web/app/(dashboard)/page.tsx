'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Money } from '@saldacargo/ui';
import { formatDate } from '@saldacargo/shared';

type WalletKey = 'bank' | 'cash' | 'card';
type WalletHistoryItem = {
  id: string;
  date: string;
  description: string;
  amount: string;
  direction: 'in' | 'out';
  source: 'trip_order' | 'transaction' | 'cash_collection';
  category: string | null;
  counterparty: string | null;
  trip_number: number | null;
};

type Wallets = {
  bank: { name: string; balance: string };
  cash: { name: string; balance: string };
  card: { name: string; balance: string };
  drivers_accountable: string;
};

type Summary = {
  today: { revenue: string; tripsCount: number };
  alerts: { tripsForReview: number };
};

type AlertsData = {
  fleet: {
    id: string;
    asset_name: string;
    reg_number: string;
    type: 'insurance' | 'inspection';
    expires_at: string | null;
    overdue: boolean;
  }[];
  receivables: { id: string; counterparty: string; amount: string; days_overdue: number }[];
  loans: {
    id: string;
    lender_name: string;
    next_payment_date: string;
    monthly_payment: string;
    overdue: boolean;
  }[];
  service: {
    id: string;
    order_number: number | null;
    description: string;
    vehicle: string;
    mechanic: string | null;
    status: string;
    lifecycle_status: string;
  }[];
  total: number;
};

type ReceivablesSummary = {
  total: string;
  count: number;
  overdueCount: number;
  promisedCount: number;
  urgentToday: number;
};

type ActiveTrips = Array<{
  id: string;
  asset: { short_name: string; reg_number: string } | null;
  driver: { name: string } | null;
}>;

export default function DashboardHome() {
  const { data, isLoading, isError } = useQuery<Summary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => fetch('/api/dashboard/summary').then((r) => r.json()),
    staleTime: 120000,
    refetchInterval: 3 * 60 * 1000,
  });

  const { data: wallets, isLoading: walletsLoading } = useQuery<Wallets>({
    queryKey: ['wallets'],
    queryFn: () => fetch('/api/wallets').then((r) => r.json()),
    staleTime: 120000,
    refetchInterval: 3 * 60 * 1000,
  });

  const { data: driverAccountable } = useQuery<
    { driver_id: string; driver_name: string; balance: string }[]
  >({
    queryKey: ['driver-accountable'],
    queryFn: () => fetch('/api/admin/cash-collections').then((r) => r.json()),
    staleTime: 120000,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: activeTrips } = useQuery<ActiveTrips>({
    queryKey: ['active-trips'],
    queryFn: () => fetch('/api/trips?status=in_progress&lifecycle=draft').then((r) => r.json()),
    staleTime: 120000,
    refetchInterval: 3 * 60 * 1000,
  });

  const { data: alertsData } = useQuery<AlertsData>({
    queryKey: ['alerts'],
    queryFn: () => fetch('/api/alerts').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  const { data: receivablesSummary } = useQuery<ReceivablesSummary>({
    queryKey: ['receivables-summary'],
    queryFn: () => fetch('/api/receivables/summary').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const [drawerWallet, setDrawerWallet] = useState<WalletKey | null>(null);

  const today = data?.today;
  const alerts = data?.alerts;
  const activeTripsCount = activeTrips?.length ?? 0;

  const alertRows: Array<{
    id: string;
    type: 'critical' | 'warning' | 'info';
    icon: string;
    title: string;
    description: string;
    amount?: string;
    amountLabel?: string;
    dateLabel?: string;
    href?: string;
  }> = [];

  // Receivables
  if (receivablesSummary && parseFloat(receivablesSummary.total) > 0) {
    const overdueCount = receivablesSummary.overdueCount;
    const topNames = (alertsData?.receivables ?? [])
      .slice(0, 3)
      .map((r) => `${r.counterparty} ${r.days_overdue} дн`)
      .join(' · ');

    alertRows.push({
      id: 'receivables',
      type: overdueCount > 0 ? 'critical' : 'warning',
      icon: overdueCount > 0 ? '🔴' : '🟡',
      title: `Дебиторка — ${receivablesSummary.count} должник${plural(receivablesSummary.count)}`,
      description: topNames || `${receivablesSummary.count} должн.`,
      amount: receivablesSummary.total,
      dateLabel: overdueCount > 0 ? 'просрочка' : 'ожидают',
      href: '/finance?tab=recv',
    });
  }

  // Loans
  for (const loan of alertsData?.loans ?? []) {
    const daysLeft = daysBetween(new Date(), new Date(loan.next_payment_date));
    const daysLabel =
      daysLeft < 0
        ? `просрочен ${Math.abs(daysLeft)} дн`
        : daysLeft === 0
          ? 'сегодня'
          : `через ${daysLeft} дн`;
    alertRows.push({
      id: loan.id,
      type: loan.overdue ? 'critical' : 'warning',
      icon: loan.overdue ? '🔴' : '🟡',
      title: loan.lender_name,
      description: `Платёж ${formatDate(loan.next_payment_date)} · ${daysLabel}`,
      amount: loan.monthly_payment,
      dateLabel: daysLabel,
      href: '/loans',
    });
  }

  // Fleet alerts
  for (const fa of alertsData?.fleet ?? []) {
    const label = fa.type === 'insurance' ? 'Страховка' : 'Техосмотр';
    const dateStr = fa.expires_at ? formatDate(fa.expires_at) : 'не указана';
    alertRows.push({
      id: fa.id,
      type: fa.overdue ? 'critical' : 'warning',
      icon: fa.overdue ? '🔴' : '🟡',
      title: `${fa.asset_name} (${fa.reg_number}) — ${label}`,
      description: fa.overdue ? `Просрочен — ${dateStr}` : `Истекает ${dateStr}`,
      dateLabel: fa.overdue ? 'просрочен' : 'скоро',
      href: '/fleet',
    });
  }

  // Review (trips)
  const reviewCount = alerts?.tripsForReview ?? 0;
  if (reviewCount > 0) {
    alertRows.push({
      id: 'review',
      type: 'info',
      icon: '🟢',
      title: `На ревью — ${reviewCount} рейс${plural(reviewCount)}`,
      description: 'Ожидают подтверждения',
      href: '/review',
    });
  }

  // Service orders — on review (draft)
  const serviceOnReview = (alertsData?.service ?? []).filter((s) => s.lifecycle_status === 'draft');
  if (serviceOnReview.length > 0) {
    alertRows.push({
      id: 'service-review',
      type: 'warning',
      icon: '🟡',
      title: `Наряд на ревью — ${serviceOnReview.length} шт.`,
      description: serviceOnReview
        .map((s) => `${s.vehicle}: ${s.description}`)
        .slice(0, 2)
        .join(' · '),
      href: '/garage',
    });
  }

  // Service orders — active (in progress)
  for (const s of (alertsData?.service ?? []).filter((s) => s.lifecycle_status === 'approved')) {
    const statusLabel = s.status === 'in_progress' ? 'В работе' : 'Создан';
    const mechLabel = s.mechanic ? ` · ${s.mechanic}` : '';
    alertRows.push({
      id: `service-${s.id}`,
      type: 'info',
      icon: '🔵',
      title: `Наряд #${s.order_number ?? '—'} — ${s.vehicle}`,
      description: `${statusLabel}${mechLabel} · ${s.description}`,
      href: '/garage',
    });
  }

  const totalAlerts = alertRows.length;

  const activeVehicles = (activeTrips ?? []).filter((t) => t.asset).map((t) => t.asset!.short_name);

  const driversWithBalance = (driverAccountable ?? []).filter((d) => parseFloat(d.balance) > 0);

  return (
    <div className="space-y-4 max-w-[1200px] mx-auto animate-in fade-in duration-500">
      {isError && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-[12px] text-rose-700 font-bold">
          Ошибка загрузки данных
        </div>
      )}

      {/* ═══ SECTION: СЧЕТА КОМПАНИИ ═══ */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-[10px]">
          {/* Bank */}
          <div
            onClick={() => setDrawerWallet('bank')}
            className="relative overflow-hidden rounded-xl text-white min-h-[78px] flex flex-col justify-between shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              padding: '14px 16px',
            }}
          >
            <div className="absolute -right-3.5 -top-3.5 w-[60px] h-[60px] rounded-full bg-white/12 pointer-events-none" />
            <div className="absolute right-2.5 -bottom-5 w-12 h-12 rounded-full bg-white/7 pointer-events-none" />
            <div className="relative">
              <div className="text-[8px] font-extrabold uppercase tracking-[.1em] text-white/80 mb-1">
                Банк
              </div>
              {walletsLoading ? (
                <div className="h-6 w-24 bg-white/20 rounded animate-pulse mt-1" />
              ) : (
                <div className="text-[20px] font-black tracking-tight leading-none mt-1">
                  <Money amount={wallets?.bank?.balance ?? '0'} />
                </div>
              )}
              <div className="text-[9px] text-white/75 mt-[3px]">Расчётный счёт</div>
            </div>
          </div>

          {/* Cash */}
          <div
            onClick={() => setDrawerWallet('cash')}
            className="relative overflow-hidden rounded-xl text-white min-h-[78px] flex flex-col justify-between shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              padding: '14px 16px',
            }}
          >
            <div className="absolute -right-3.5 -top-3.5 w-[60px] h-[60px] rounded-full bg-white/12 pointer-events-none" />
            <div className="absolute right-2.5 -bottom-5 w-12 h-12 rounded-full bg-white/7 pointer-events-none" />
            <div className="relative">
              <div className="text-[8px] font-extrabold uppercase tracking-[.1em] text-white/80 mb-1">
                Касса
              </div>
              {walletsLoading ? (
                <div className="h-6 w-24 bg-white/20 rounded animate-pulse mt-1" />
              ) : (
                <div className="text-[20px] font-black tracking-tight leading-none mt-1">
                  <Money amount={wallets?.cash?.balance ?? '0'} />
                </div>
              )}
              <div className="text-[9px] text-white/75 mt-[3px]">Наличные в кассе</div>
            </div>
          </div>

          {/* Card */}
          <div
            onClick={() => setDrawerWallet('card')}
            className="relative overflow-hidden rounded-xl text-white min-h-[78px] flex flex-col justify-between shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              padding: '14px 16px',
            }}
          >
            <div className="absolute -right-3.5 -top-3.5 w-[60px] h-[60px] rounded-full bg-white/12 pointer-events-none" />
            <div className="absolute right-2.5 -bottom-5 w-12 h-12 rounded-full bg-white/7 pointer-events-none" />
            <div className="relative">
              <div className="text-[8px] font-extrabold uppercase tracking-[.1em] text-white/80 mb-1">
                Карта
              </div>
              {walletsLoading ? (
                <div className="h-6 w-24 bg-white/20 rounded animate-pulse mt-1" />
              ) : (
                <div className="text-[20px] font-black tracking-tight leading-none mt-1">
                  <Money amount={wallets?.card?.balance ?? '0'} />
                </div>
              )}
              <div className="text-[9px] text-white/75 mt-[3px]">Корпоративная карта</div>
            </div>
          </div>
        </div>

        {/* Driver accountable strip — per driver */}
        {driversWithBalance.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 flex items-center gap-2 shadow-sm flex-wrap">
            <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap mr-1">
              Подотчёт:
            </span>
            {driversWithBalance.map((d) => (
              <div
                key={d.driver_id}
                className="flex items-center gap-1.5 bg-slate-100 rounded-md px-2.5 py-1"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                <span className="text-[12px] font-semibold text-slate-700">{d.driver_name}</span>
                <span className="text-[12px] font-bold text-slate-500">
                  <Money amount={d.balance} />
                </span>
              </div>
            ))}
            <span className="ml-auto text-[12px] font-bold text-slate-800 whitespace-nowrap">
              Итого:{' '}
              <Money
                amount={driversWithBalance
                  .reduce((s, d) => s + parseFloat(d.balance), 0)
                  .toFixed(2)}
              />
            </span>
          </div>
        )}
      </section>

      {/* ═══ SECTION: СЕЙЧАС ═══ */}
      <section>
        <div className="grid grid-cols-3 gap-3">
          <a
            href="/review?mode=active"
            className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-px hover:border-slate-300 transition-all duration-200 flex items-center gap-3 block"
            style={{ padding: '10px 14px' }}
          >
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-[.06em] truncate">
                Рейсы в пути
              </div>
              {isLoading ? (
                <div className="h-6 w-10 bg-slate-100 rounded animate-pulse mt-0.5" />
              ) : (
                <div className="text-[22px] font-black text-blue-600 tracking-tight leading-none mt-0.5">
                  {activeTripsCount}
                </div>
              )}
            </div>
            {activeVehicles.length > 0 && (
              <span className="flex-shrink-0 text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full hidden sm:inline">
                🚛 {activeVehicles.join(', ')}
              </span>
            )}
          </a>

          <a
            href="/review"
            className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-px hover:border-slate-300 transition-all duration-200 flex items-center gap-3 block"
            style={{ padding: '10px 14px' }}
          >
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-[.06em]">
                На ревью
              </div>
              {isLoading ? (
                <div className="h-6 w-10 bg-slate-100 rounded animate-pulse mt-0.5" />
              ) : (
                <div className="text-[22px] font-black text-amber-500 tracking-tight leading-none mt-0.5">
                  {reviewCount}
                </div>
              )}
            </div>
            {reviewCount > 0 && (
              <span className="flex-shrink-0 text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">
                ⏳
              </span>
            )}
          </a>

          <div
            className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-200 flex items-center gap-3"
            style={{ padding: '10px 14px' }}
          >
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-[.06em]">
                Выручка сегодня
              </div>
              {isLoading ? (
                <div className="h-6 w-24 bg-slate-100 rounded animate-pulse mt-0.5" />
              ) : (
                <div className="text-[22px] font-black text-emerald-600 tracking-tight leading-none mt-0.5">
                  <Money amount={today?.revenue ?? '0'} />
                </div>
              )}
            </div>
            {!isLoading && (today?.tripsCount ?? 0) > 0 && (
              <span className="flex-shrink-0 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full hidden sm:inline">
                {today!.tripsCount} рейс{plural(today!.tripsCount)}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ═══ SECTION: АЛЕРТЫ ═══ */}
      <section>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-[18px] py-3.5 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[13px] font-bold text-slate-800">⚡ Требует внимания</span>
            <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {totalAlerts} событ{totalAlerts === 1 ? 'ие' : totalAlerts < 5 ? 'ия' : 'ий'}
            </span>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-2 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[46px] bg-slate-100 rounded" />
              ))}
            </div>
          ) : alertRows.length === 0 ? (
            <div className="px-[18px] py-8 text-center text-[13px] text-slate-400">
              Нет событий, требующих внимания
            </div>
          ) : (
            <div>
              {alertRows.map((row, i) => (
                <AlertRow key={row.id} row={row} isLast={i === alertRows.length - 1} />
              ))}
            </div>
          )}
        </div>
      </section>

      {drawerWallet && (
        <WalletDrawer
          wallet={drawerWallet}
          onClose={() => setDrawerWallet(null)}
          wallets={wallets}
        />
      )}
    </div>
  );
}

/* ── Wallet Modal ─────────────────────────────────── */
const WALLET_LABELS: Record<WalletKey, { name: string; sub: string; color: string }> = {
  bank: { name: 'Банк', sub: 'Расчётный счёт', color: '#3b82f6' },
  cash: { name: 'Касса', sub: 'Наличные', color: '#10b981' },
  card: { name: 'Карта', sub: 'Корпоративная карта', color: '#8b5cf6' },
};
const OTHER_WALLETS: Record<WalletKey, { key: WalletKey; label: string }[]> = {
  bank: [
    { key: 'cash', label: 'Касса' },
    { key: 'card', label: 'Карта' },
  ],
  cash: [
    { key: 'bank', label: 'Банк' },
    { key: 'card', label: 'Карта' },
  ],
  card: [
    { key: 'bank', label: 'Банк' },
    { key: 'cash', label: 'Касса' },
  ],
};

type Period = 'day' | 'week' | 'month';

function getPeriodRange(
  period: Period,
  offset: number,
): { from: string; to: string; label: string } {
  const now = new Date();
  if (period === 'day') {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    const iso = d.toISOString().slice(0, 10);
    return {
      from: iso,
      to: iso,
      label: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' }),
    };
  }
  if (period === 'week') {
    const mon = new Date(now);
    const dow = mon.getDay();
    mon.setDate(mon.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7);
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    return {
      from: mon.toISOString().slice(0, 10),
      to: sun.toISOString().slice(0, 10),
      label: `${mon.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — ${sun.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`,
    };
  }
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    from: d.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
    label: d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
  };
}

const EDIT_PASSWORD = '9111';

function WalletDrawer({
  wallet,
  onClose,
  wallets,
}: {
  wallet: WalletKey;
  onClose: () => void;
  wallets:
    | { bank: { balance: string }; cash: { balance: string }; card: { balance: string } }
    | undefined;
}) {
  const [period, setPeriod] = useState<Period>('day');
  const [offset, setOffset] = useState(0);
  const [transferItem, setTransferItem] = useState<WalletHistoryItem | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [editMode, setEditMode] = useState<'idle' | 'password' | 'amount'>('idle');
  const [pwdInput, setPwdInput] = useState('');
  const [pwdError, setPwdError] = useState(false);
  const [newBalance, setNewBalance] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const qc = useQueryClient();

  const meta = WALLET_LABELS[wallet];
  const balance = wallets?.[wallet]?.balance ?? '0';
  const range = getPeriodRange(period, offset);

  // Reset offset when period changes
  const changePeriod = (p: Period) => {
    setPeriod(p);
    setOffset(0);
  };

  const { data, isLoading } = useQuery<{ items: WalletHistoryItem[] }>({
    queryKey: ['wallet-history', wallet, range.from, range.to],
    queryFn: () =>
      fetch(`/api/wallets/history?wallet=${wallet}&from=${range.from}&to=${range.to}`).then((r) =>
        r.json(),
      ),
    staleTime: 30000,
  });

  const items = data?.items ?? [];

  const inTotal = items
    .filter((i) => i.direction === 'in' && i.description !== 'Корректировка остатка')
    .reduce((s, i) => s + parseFloat(i.amount), 0);
  const outTotal = items
    .filter((i) => i.direction === 'out' && i.description !== 'Корректировка остатка')
    .reduce((s, i) => s + parseFloat(i.amount), 0);

  const doTransfer = async (targetWallet: WalletKey) => {
    if (!transferItem) return;
    setTransferring(true);
    await fetch('/api/wallets/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: transferItem.id,
        source: transferItem.source,
        direction: transferItem.direction,
        target_wallet: targetWallet,
      }),
    });
    setTransferring(false);
    setTransferItem(null);
    qc.invalidateQueries({ queryKey: ['wallet-history'] });
    qc.invalidateQueries({ queryKey: ['wallets'] });
  };

  const submitPassword = () => {
    if (pwdInput === EDIT_PASSWORD) {
      setPwdError(false);
      setPwdInput('');
      setNewBalance(parseFloat(balance).toFixed(0));
      setEditMode('amount');
    } else {
      setPwdError(true);
    }
  };

  const submitBalance = async () => {
    const val = parseFloat(newBalance.replace(',', '.'));
    if (isNaN(val) || val < 0) {
      setSaveError('Введите корректную сумму');
      return;
    }
    setSaving(true);
    setSaveError(null);
    const res = await fetch('/api/wallets/set-balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, target_amount: val.toFixed(2) }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setSaveError(json.error ?? 'Ошибка');
      return;
    }
    setEditMode('idle');
    setNewBalance('');
    qc.invalidateQueries({ queryKey: ['wallets'] });
    qc.invalidateQueries({ queryKey: ['wallet-history'] });
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col animate-in zoom-in-95 duration-200"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-6 py-4 text-white rounded-t-2xl flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${meta.color}cc 0%, ${meta.color} 100%)` }}
        >
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-75">
              {meta.sub}
            </div>
            <div className="text-[20px] font-black leading-tight">{meta.name}</div>
            {/* Balance row with edit toggle */}
            {editMode === 'idle' && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[15px] font-bold opacity-90">
                  <Money amount={balance} />
                </span>
                <button
                  onClick={() => {
                    setEditMode('password');
                    setPwdInput('');
                    setPwdError(false);
                  }}
                  className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/20 hover:bg-white/35 transition-colors"
                  title="Изменить остаток"
                >
                  ✏️ изменить
                </button>
              </div>
            )}
            {/* Step 1: password */}
            {editMode === 'password' && (
              <div className="flex items-center gap-2 mt-1">
                <input
                  autoFocus
                  type="password"
                  maxLength={6}
                  value={pwdInput}
                  onChange={(e) => {
                    setPwdInput(e.target.value);
                    setPwdError(false);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && submitPassword()}
                  placeholder="Пароль"
                  className="w-24 px-2 py-1 rounded text-slate-900 text-[13px] font-bold focus:outline-none"
                  style={{ border: pwdError ? '2px solid #fca5a5' : '2px solid transparent' }}
                />
                <button
                  onClick={submitPassword}
                  className="text-[11px] font-bold px-2 py-1 rounded bg-white/30 hover:bg-white/50 transition-colors"
                >
                  OK
                </button>
                <button
                  onClick={() => setEditMode('idle')}
                  className="text-[11px] opacity-60 hover:opacity-90 transition-opacity"
                >
                  отмена
                </button>
                {pwdError && (
                  <span className="text-[10px] text-red-200 font-bold">Неверный пароль</span>
                )}
              </div>
            )}
            {/* Step 2: new amount */}
            {editMode === 'amount' && (
              <div className="flex items-center gap-2 mt-1">
                <input
                  autoFocus
                  type="number"
                  min="0"
                  step="100"
                  value={newBalance}
                  onChange={(e) => {
                    setNewBalance(e.target.value);
                    setSaveError(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && submitBalance()}
                  placeholder="Новый остаток"
                  className="w-32 px-2 py-1 rounded text-slate-900 text-[13px] font-bold focus:outline-none"
                  style={{ border: saveError ? '2px solid #fca5a5' : '2px solid transparent' }}
                />
                <button
                  onClick={submitBalance}
                  disabled={saving}
                  className="text-[11px] font-bold px-3 py-1 rounded bg-white/30 hover:bg-white/50 disabled:opacity-50 transition-colors"
                >
                  {saving ? '...' : 'Сохранить'}
                </button>
                <button
                  onClick={() => setEditMode('idle')}
                  className="text-[11px] opacity-60 hover:opacity-90 transition-opacity"
                >
                  отмена
                </button>
                {saveError && (
                  <span className="text-[10px] text-red-200 font-bold">{saveError}</span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-[20px] font-bold transition-colors ml-4"
          >
            ×
          </button>
        </div>

        {/* ── Period selector ── */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 flex-shrink-0 bg-slate-50/60">
          {(['day', 'week', 'month'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => changePeriod(p)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all"
              style={
                period === p
                  ? { background: meta.color, color: '#fff' }
                  : { background: '#f1f5f9', color: '#64748b' }
              }
            >
              {p === 'day' ? 'День' : p === 'week' ? 'Неделя' : 'Месяц'}
            </button>
          ))}

          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => setOffset((o) => o - 1)}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-black text-[16px] transition-colors"
            >
              ‹
            </button>
            <span className="text-[13px] font-semibold text-slate-700 px-2 min-w-[160px] text-center capitalize">
              {range.label}
            </span>
            <button
              onClick={() => setOffset((o) => o + 1)}
              disabled={offset >= 0}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 flex items-center justify-center text-slate-600 font-black text-[16px] transition-colors"
            >
              ›
            </button>
          </div>

          {/* Totals */}
          <div className="flex items-center gap-3 ml-4 text-[12px] font-bold">
            <span className="text-emerald-600">
              +<Money amount={inTotal.toFixed(2)} />
            </span>
            <span className="text-rose-500">
              −<Money amount={outTotal.toFixed(2)} />
            </span>
          </div>
        </div>

        {/* ── Transaction list ── */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-2 animate-pulse">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-[46px] bg-slate-100 rounded" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[13px] text-slate-400">
              Операций за период не найдено
            </div>
          ) : (
            items.map((item) => {
              const isIn = item.direction === 'in';
              const canTransfer = item.source !== 'cash_collection';
              const sourceLabel =
                item.source === 'cash_collection'
                  ? 'Инкассация'
                  : item.source === 'trip_order'
                    ? 'Выручка'
                    : (item.category ?? 'Транзакция');

              const isTransferTarget = transferItem?.id === item.id;

              return (
                <div
                  key={item.id}
                  className={`border-b border-slate-100 last:border-0 ${isTransferTarget ? 'bg-blue-50' : ''}`}
                >
                  <div
                    className="flex items-center px-5 gap-3 hover:bg-slate-50 transition-colors"
                    style={{ height: 46 }}
                  >
                    <div
                      className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold"
                      style={{
                        background: isIn ? '#d1fae5' : '#fee2e2',
                        color: isIn ? '#065f46' : '#991b1b',
                      }}
                    >
                      {isIn ? '+' : '−'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800 truncate leading-none">
                        {item.trip_number ? `Рейс #${item.trip_number} · ` : ''}
                        {item.description}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate leading-none mt-0.5">
                        {sourceLabel} ·{' '}
                        {new Date(item.date).toLocaleTimeString('ru-RU', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div
                      className="flex-shrink-0 text-[14px] font-black"
                      style={{ color: isIn ? '#059669' : '#dc2626' }}
                    >
                      {isIn ? '+' : '−'}
                      <Money amount={item.amount} />
                    </div>
                    {canTransfer && (
                      <button
                        onClick={() => setTransferItem(isTransferTarget ? null : item)}
                        className="flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-md border transition-colors ml-1"
                        style={
                          isTransferTarget
                            ? { borderColor: meta.color, color: meta.color, background: '#eff6ff' }
                            : { borderColor: '#e2e8f0', color: '#94a3b8' }
                        }
                        title="Перенести в другой счёт"
                      >
                        ⇄
                      </button>
                    )}
                  </div>

                  {/* Transfer target selector */}
                  {isTransferTarget && (
                    <div className="px-5 pb-3 flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 font-medium">Перенести в:</span>
                      {OTHER_WALLETS[wallet].map((w) => (
                        <button
                          key={w.key}
                          onClick={() => doTransfer(w.key)}
                          disabled={transferring}
                          className="text-[11px] font-bold px-3 py-1 rounded-lg border-2 border-slate-200 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                        >
                          {transferring ? '...' : w.label}
                        </button>
                      ))}
                      <button
                        onClick={() => setTransferItem(null)}
                        className="text-[11px] text-slate-400 ml-1"
                      >
                        отмена
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Alert Row ─────────────────────────────────────── */
function AlertRow({
  row,
  isLast,
}: {
  row: {
    type: 'critical' | 'warning' | 'info';
    icon: string;
    title: string;
    description: string;
    amount?: string;
    dateLabel?: string;
    href?: string;
  };
  isLast: boolean;
}) {
  const barColor =
    row.type === 'critical' ? '#ef4444' : row.type === 'warning' ? '#f59e0b' : '#10b981';
  const amountColor =
    row.type === 'critical' ? '#ef4444' : row.type === 'warning' ? '#f59e0b' : '#1e293b';

  const content = (
    <div
      className={`flex items-center hover:bg-slate-50 transition-colors relative ${isLast ? '' : 'border-b border-slate-100'}`}
      style={{ height: 46, padding: '0 18px', gap: 12 }}
    >
      {/* Left bar */}
      <div
        className="absolute rounded-r"
        style={{ left: 0, top: 8, bottom: 8, width: 3, background: barColor }}
      />

      {/* Icon */}
      <span className="flex-shrink-0" style={{ fontSize: 16, marginLeft: 8 }}>
        {row.icon}
      </span>

      {/* Title + description in one line */}
      <p
        className="flex-1 min-w-0 truncate"
        style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}
      >
        {row.title}
        {row.description && (
          <span style={{ fontWeight: 400, fontSize: 11, color: '#64748b', marginLeft: 6 }}>
            · {row.description}
          </span>
        )}
      </p>

      {/* Right: amount + date + arrow */}
      <div className="flex-shrink-0 flex items-center" style={{ gap: 10 }}>
        {row.amount && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: amountColor }}>
              <Money amount={row.amount} />
            </div>
            {row.dateLabel && <div style={{ fontSize: 11, color: '#64748b' }}>{row.dateLabel}</div>}
          </div>
        )}
        {!row.amount && row.dateLabel && (
          <span style={{ fontSize: 11, color: '#64748b' }}>{row.dateLabel}</span>
        )}
        {row.href && (
          <span
            style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6', opacity: 0.7, padding: 4 }}
          >
            →
          </span>
        )}
      </div>
    </div>
  );

  if (row.href) {
    return (
      <a href={row.href} className="block">
        {content}
      </a>
    );
  }
  return content;
}

/* ── Helpers ───────────────────────────────────── */
function plural(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return '';
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'а';
  return 'ов';
}

function daysBetween(a: Date, b: Date): number {
  const diff = b.getTime() - a.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
