'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, Suspense, useEffect } from 'react';
import { Money } from '@saldacargo/ui';

// ── Types ──────────────────────────────────────────────────────

type PayrollEntry = {
  id: string;
  name: string;
  roles: string[];
  auto_settle: boolean;
  earned: string;
  paid: string;
  debt: string;
  is_management: boolean;
};

type Wallet = {
  id: string;
  name: string;
  balance: string;
};

type WalletsResponse = {
  bank: Wallet;
  cash: Wallet;
  card: Wallet;
};

// ── Helpers ────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  driver: 'Водитель',
  loader: 'Грузчик',
  mechanic: 'Механик',
  mechanic_lead: 'Мастер',
  admin: 'Администратор',
  owner: 'Владелец',
  accountant: 'Бухгалтер',
  welder: 'Сварщик',
  painter: 'Маляр',
  electrician: 'Электрик',
  handyman: 'Разнорабочий',
};

type RoleGroup = 'drivers' | 'loaders' | 'workshop';

function getRoleGroup(roles: string[]): RoleGroup {
  if (roles.includes('driver')) return 'drivers';
  if (roles.includes('loader')) return 'loaders';
  return 'workshop';
}

function primaryRoleLabel(roles: string[]): string {
  const priority = [
    'driver',
    'loader',
    'mechanic_lead',
    'mechanic',
    'accountant',
    'welder',
    'painter',
    'electrician',
    'handyman',
    'admin',
    'owner',
  ];
  for (const r of priority) {
    if (roles.includes(r)) return ROLE_LABELS[r] ?? r;
  }
  return roles[0] ?? '—';
}

const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

const GROUP_TABS: { key: RoleGroup; label: string }[] = [
  { key: 'drivers', label: 'Водители' },
  { key: 'loaders', label: 'Грузчики' },
  { key: 'workshop', label: 'Цех' },
];

// ── Page ───────────────────────────────────────────────────────

export default function StaffPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 animate-pulse space-y-3">
          <div className="h-10 bg-zinc-200 rounded" />
          <div className="h-64 bg-zinc-200 rounded" />
        </div>
      }
    >
      <StaffContent />
    </Suspense>
  );
}

function StaffContent() {
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [activeGroup, setActiveGroup] = useState<RoleGroup>('drivers');

  // Settle modal state
  const [settleTarget, setSettleTarget] = useState<PayrollEntry | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleWallet, setSettleWallet] = useState('');
  const [settleOffset, setSettleOffset] = useState('');
  const [maxAdvance, setMaxAdvance] = useState(0);

  // Details modal state
  const [detailsTarget, setDetailsTarget] = useState<PayrollEntry | null>(null);

  const shiftMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  const { data: payroll = [], isLoading } = useQuery<PayrollEntry[]>({
    queryKey: ['admin-payroll', year, month],
    queryFn: () =>
      fetch(`/api/admin/payroll?year=${year}&month=${month}`)
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
    staleTime: 30000,
  });

  const { data: wallets } = useQuery<WalletsResponse>({
    queryKey: ['wallets'],
    queryFn: () => fetch('/api/wallets').then((r) => r.json()),
    staleTime: 60000,
  });

  const settleMutation = useMutation({
    mutationFn: (body: {
      user_id: string;
      partial_amount: string;
      from_wallet_id: string;
      partial_offset: string;
    }) =>
      fetch('/api/admin/staff-settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? 'Ошибка');
        return json;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-payroll'] });
      qc.invalidateQueries({ queryKey: ['staff-settle-details'] });
      setSettleTarget(null);
      setSettleAmount('');
      setSettleWallet('');
      setSettleOffset('');
    },
  });

  const grouped = {
    drivers: payroll.filter((u) => getRoleGroup(u.roles) === 'drivers'),
    loaders: payroll.filter((u) => getRoleGroup(u.roles) === 'loaders'),
    workshop: payroll.filter((u) => getRoleGroup(u.roles) === 'workshop'),
  };

  const totalEarned = payroll.reduce((s, u) => s + parseFloat(u.earned), 0);
  const totalPaid = payroll.reduce((s, u) => s + parseFloat(u.paid), 0);
  const totalDebt = payroll.reduce((s, u) => s + parseFloat(u.debt), 0);

  const walletList = wallets ? [wallets.cash, wallets.bank] : [];

  const openSettle = async (entry: PayrollEntry) => {
    // Fetch fresh advance data
    try {
      const r = await fetch(`/api/admin/staff-settle?user_id=${entry.id}`);
      const data = await r.json();
      const advanceBalance = parseFloat(data.advance_balance || '0');
      const salaryTotal = parseFloat(data.salary_total || '0');

      setSettleTarget(entry);
      // Logic from WebApp:
      // Initial payout amount (what goes from wallet) = salary - automatic offset
      const initialOffset = Math.min(salaryTotal, advanceBalance);
      const initialPayout = Math.max(0, salaryTotal - initialOffset);

      setSettleAmount(initialPayout.toFixed(0));
      setSettleOffset(initialOffset.toFixed(0));
      setMaxAdvance(advanceBalance);
      setSettleWallet(wallets?.cash.id ?? '');
    } catch (e) {
      console.error('Failed to load settle data', e);
    }
  };

  const handleSettle = () => {
    if (!settleTarget || !settleWallet) return;
    const payoutAmt = parseFloat(settleAmount) || 0;
    const offsetAmt = parseFloat(settleOffset) || 0;

    if (payoutAmt === 0 && offsetAmt === 0) return;

    settleMutation.mutate({
      user_id: settleTarget.id,
      partial_amount: (payoutAmt + offsetAmt).toFixed(2),
      partial_offset: offsetAmt.toFixed(2),
      from_wallet_id: settleWallet,
    });
  };

  const activeList = grouped[activeGroup];

  // Lock scroll when modal is open
  useEffect(() => {
    if (settleTarget || detailsTarget) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [settleTarget, detailsTarget]);

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-black text-zinc-900 mb-3">Персонал</h1>

        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => shiftMonth(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 font-bold text-lg"
          >
            ‹
          </button>
          <span className="font-bold text-zinc-800">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button
            onClick={() => shiftMonth(1)}
            disabled={year === now.getFullYear() && month === now.getMonth() + 1}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 font-bold text-lg disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl p-3 border border-zinc-200">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1 truncate">
              Фонд ЗП
            </p>
            <p className="text-sm font-black text-zinc-900">
              <Money amount={totalEarned.toFixed(0)} />
            </p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-zinc-200">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1 truncate">
              Выплачено
            </p>
            <p className="text-sm font-black text-emerald-600">
              <Money amount={totalPaid.toFixed(0)} />
            </p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-zinc-200">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1 truncate">
              Долг
            </p>
            <p
              className={`text-sm font-black ${totalDebt > 0 ? 'text-rose-600' : 'text-zinc-900'}`}
            >
              <Money amount={totalDebt.toFixed(0)} />
            </p>
          </div>
        </div>

        {/* Role group tabs */}
        <div className="flex gap-1 bg-zinc-100 p-1 rounded-2xl">
          {GROUP_TABS.map((tab) => {
            const count = grouped[tab.key].length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveGroup(tab.key)}
                className={`flex-1 py-2 rounded-xl text-[11px] font-black transition-colors ${
                  activeGroup === tab.key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400'
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`ml-1 ${activeGroup === tab.key ? 'text-orange-500' : ''}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Employee list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-zinc-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : activeList.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-200 p-10 text-center">
            <p className="text-3xl mb-2">👤</p>
            <p className="text-sm font-semibold text-zinc-400">Нет сотрудников</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeList.map((entry) => {
              const hasDebt = parseFloat(entry.debt) > 0;
              return (
                <div
                  key={entry.id}
                  onClick={() => setDetailsTarget(entry)}
                  className="bg-white rounded-2xl border border-zinc-200 overflow-hidden active:scale-[0.98] transition-all"
                >
                  <div className="px-4 pt-4 pb-3">
                    {/* Name + role */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-black text-zinc-900">{entry.name}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {primaryRoleLabel(entry.roles)}
                        </p>
                      </div>
                      {entry.auto_settle && (
                        <span className="text-[10px] font-bold bg-sky-100 text-sky-600 px-2 py-0.5 rounded-full">
                          Авто
                        </span>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-zinc-50 rounded-xl py-2">
                        <p className="text-[10px] font-semibold text-zinc-400 mb-0.5">Начислено</p>
                        <p className="text-sm font-black text-zinc-800">
                          <Money amount={entry.earned} />
                        </p>
                      </div>
                      <div className="bg-zinc-50 rounded-xl py-2">
                        <p className="text-[10px] font-semibold text-zinc-400 mb-0.5">Выплачено</p>
                        <p className="text-sm font-black text-zinc-800">
                          <Money amount={entry.paid} />
                        </p>
                      </div>
                      <div className={`rounded-xl py-2 ${hasDebt ? 'bg-rose-50' : 'bg-zinc-50'}`}>
                        <p className="text-[10px] font-semibold text-zinc-400 mb-0.5">Долг</p>
                        <p
                          className={`text-sm font-black ${hasDebt ? 'text-rose-600' : 'text-zinc-800'}`}
                        >
                          <Money amount={entry.debt} />
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action */}
                  {hasDebt && !entry.auto_settle && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openSettle(entry);
                      }}
                      className="w-full bg-orange-500 text-white font-black text-sm py-3 hover:bg-orange-600 active:bg-orange-700 transition-colors"
                    >
                      Рассчитаться — <Money amount={entry.debt} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Settle modal */}
      {settleTarget && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center animate-in fade-in duration-200"
          onClick={() => setSettleTarget(null)}
        >
          <div
            className="bg-white w-full max-h-[92vh] overflow-y-auto rounded-t-[2.5rem] p-6 space-y-6 shadow-2xl animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                  Выплата ЗП
                </p>
                <p className="text-xl font-black text-zinc-900 mt-1">{settleTarget.name}</p>
              </div>
              <button
                onClick={() => setSettleTarget(null)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 font-bold active:scale-90 transition-all"
              >
                ✕
              </button>
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block ml-1">
                  На руки, ₽
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full border-2 border-zinc-100 bg-zinc-50 rounded-2xl px-4 py-3 text-xl font-black text-zinc-900 focus:border-orange-500 focus:bg-white focus:outline-none transition-all"
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block ml-1">
                  Зачесть аванс, ₽
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={settleOffset}
                  onChange={(e) => setSettleOffset(e.target.value)}
                  className={`w-full border-2 rounded-2xl px-4 py-3 text-xl font-black focus:outline-none transition-all ${
                    parseFloat(settleOffset) > 0
                      ? 'border-sky-100 bg-sky-50 text-sky-700 focus:border-sky-500'
                      : 'border-zinc-100 bg-zinc-50 text-zinc-400 focus:border-orange-500'
                  }`}
                  placeholder="0"
                />
                {maxAdvance > 0 && (
                  <p className="text-[9px] font-bold text-zinc-400 ml-1 uppercase">
                    Доступно: <Money amount={maxAdvance.toString()} />
                  </p>
                )}
              </div>
            </div>

            {/* Total Row */}
            <div className="bg-zinc-900 rounded-2xl p-4 flex justify-between items-center text-white">
              <div>
                <p className="text-[10px] font-bold uppercase opacity-50">Итого списание долга</p>
                <p className="text-sm font-black">
                  <Money
                    amount={((parseFloat(settleAmount) || 0) + (parseFloat(settleOffset) || 0)).toFixed(
                      2,
                    )}
                  />
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase opacity-50">На руки</p>
                <p className="text-xl font-black text-orange-400">
                  <Money amount={(parseFloat(settleAmount) || 0).toFixed(2)} />
                </p>
              </div>
            </div>

            {/* Wallet selector */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block ml-1">
                Источник средств
              </label>
              <div className="grid grid-cols-2 gap-3">
                {walletList.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setSettleWallet(w.id)}
                    className={`rounded-2xl p-4 border-2 text-left transition-all active:scale-[0.97] ${
                      settleWallet === w.id
                        ? 'border-orange-500 bg-orange-50 ring-4 ring-orange-500/10'
                        : 'border-zinc-100 bg-zinc-50 text-zinc-600'
                    }`}
                  >
                    <p className="text-xs font-black uppercase tracking-tight leading-tight">
                      {w.name.split(' ')[0]}
                    </p>
                    <p
                      className={`text-sm font-black mt-1 ${settleWallet === w.id ? 'text-orange-600' : 'text-zinc-900'}`}
                    >
                      <Money amount={w.balance} />
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 pb-10">
              <button
                onClick={handleSettle}
                disabled={
                  settleMutation.isPending ||
                  !settleWallet ||
                  (parseFloat(settleAmount || '0') <= 0 && parseFloat(settleOffset || '0') <= 0)
                }
                className="w-full bg-zinc-900 text-white font-black text-base py-5 rounded-2xl disabled:opacity-20 active:scale-[0.98] transition-all shadow-xl shadow-zinc-200"
              >
                {settleMutation.isPending ? 'Проводим выплату...' : 'Подтвердить и выплатить'}
              </button>

              {settleMutation.isError && (
                <p className="text-sm text-rose-600 text-center font-bold mt-4 bg-rose-50 p-3 rounded-xl">
                  {(settleMutation.error as Error).message}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {detailsTarget && (
        <StaffDetailsModal
          user={detailsTarget}
          year={year}
          month={month}
          onClose={() => setDetailsTarget(null)}
          onSettle={() => {
            setDetailsTarget(null);
            openSettle(detailsTarget);
          }}
        />
      )}
    </div>
  );
}

interface StaffSettleDetails {
  history: any[];
}

function StaffDetailsModal({
  user,
  year,
  month,
  onClose,
  onSettle,
}: {
  user: PayrollEntry;
  year: number;
  month: number;
  onClose: () => void;
  onSettle: () => void;
}) {
  const { data, isLoading } = useQuery<StaffSettleDetails>({
    queryKey: ['staff-settle-details', user.id, year, month],
    queryFn: () =>
      fetch(`/api/admin/staff-settle?user_id=${user.id}&year=${year}&month=${month}`).then((r) =>
        r.json(),
      ),
  });

  const history = data?.history ?? [];
  const accruals = history.filter(
    (t: any) => t.direction === 'expense' && t.is_payroll,
  );
  const payments = history.filter(
    (t: any) =>
      (t.direction === 'expense' && t.is_advance) || (t.direction === 'income' && t.is_advance),
  );

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-h-[92vh] overflow-y-auto rounded-t-[2.5rem] p-6 space-y-6 shadow-2xl animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">
              Детализация за {MONTH_NAMES[month - 1]}
            </p>
            <p className="text-xl font-black text-zinc-900 mt-1">{user.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 font-bold active:scale-90 transition-all"
          >
            ✕
          </button>
        </div>

        {/* Monthly Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-50 rounded-2xl p-4">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
              Начислено (мес)
            </p>
            <p className="text-xl font-black text-zinc-900 mt-1">
              <Money amount={user.earned} />
            </p>
          </div>
          <div className="bg-zinc-50 rounded-2xl p-4">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
              Выплачено (мес)
            </p>
            <p className="text-xl font-black text-emerald-600 mt-1">
              <Money amount={user.paid} />
            </p>
          </div>
        </div>

        {/* Accruals List */}
        <div className="space-y-3">
          <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">
            Начисления за месяц
          </h3>
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-16 bg-zinc-50 rounded-xl animate-pulse" />
              <div className="h-16 bg-zinc-50 rounded-xl animate-pulse" />
            </div>
          ) : accruals.length === 0 ? (
            <p className="text-sm text-zinc-400 font-bold text-center py-4">Нет начислений</p>
          ) : (
            <div className="space-y-2">
              {accruals.map((t: any) => (
                <div key={t.id} className="bg-zinc-50 rounded-xl p-3 flex justify-between items-start">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase mb-0.5">
                      {new Date(t.created_at).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                      })}
                      {t.trip && ` · Рейс №${t.trip.trip_number}`}
                      {t.service_order && ` · Наряд №${t.service_order.order_number}`}
                    </p>
                    <p className="text-sm font-bold text-zinc-800 leading-tight">
                      {t.description.replace('ЗП: ', '')}
                    </p>
                    {t.trip?.driver?.name && t.trip.driver.name !== user.name && (
                      <p className="text-[10px] font-bold text-sky-600 mt-1 uppercase">
                        Водитель: {t.trip.driver.name}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <Money amount={t.amount} className="font-black text-zinc-900" />
                    <p
                      className={`text-[9px] font-black uppercase mt-1 ${t.settlement_status === 'completed' ? 'text-emerald-500' : 'text-amber-500'}`}
                    >
                      {t.settlement_status === 'completed' ? 'Выплачено' : 'Долг'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payments List */}
        {payments.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">
              Выплаты и авансы
            </h3>
            <div className="space-y-2">
              {payments.map((t: any) => {
                const isAdvanceGiven = t.direction === 'expense'; // Выдан аванс
                return (
                  <div
                    key={t.id}
                    className="bg-zinc-50 rounded-xl p-3 flex justify-between items-center"
                  >
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase">
                        {new Date(t.created_at).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                      <p className="text-sm font-bold text-zinc-800">{t.description}</p>
                    </div>
                    <div className="text-right">
                      <Money
                        amount={t.amount}
                        className={`font-black ${isAdvanceGiven ? 'text-rose-600' : 'text-emerald-600'}`}
                        prefix={isAdvanceGiven ? '−' : '+'}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="pt-4 pb-10">
          {parseFloat(user.debt) > 0 ? (
            <button
              onClick={onSettle}
              className="w-full bg-orange-500 text-white font-black text-base py-5 rounded-2xl active:scale-[0.98] transition-all shadow-xl shadow-orange-100"
            >
              Выплатить долг — <Money amount={user.debt} />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="w-full bg-zinc-900 text-white font-black text-base py-5 rounded-2xl active:scale-[0.98] transition-all shadow-xl shadow-zinc-200"
            >
              Закрыть
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
