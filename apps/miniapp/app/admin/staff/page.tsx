'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, Suspense } from 'react';
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

type RoleGroup = 'drivers' | 'loaders' | 'mechanics' | 'office';

function getRoleGroup(roles: string[]): RoleGroup {
  if (roles.includes('driver')) return 'drivers';
  if (roles.includes('loader')) return 'loaders';
  if (roles.includes('mechanic') || roles.includes('mechanic_lead')) return 'mechanics';
  return 'office';
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
  { key: 'mechanics', label: 'Механики' },
  { key: 'loaders', label: 'Грузчики' },
  { key: 'office', label: 'Цех/Офис' },
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
    mutationFn: (body: { user_id: string; amount: string; from_wallet_id: string }) =>
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
      setSettleTarget(null);
      setSettleAmount('');
      setSettleWallet('');
    },
  });

  const grouped = {
    drivers: payroll.filter((u) => getRoleGroup(u.roles) === 'drivers'),
    loaders: payroll.filter((u) => getRoleGroup(u.roles) === 'loaders'),
    mechanics: payroll.filter((u) => getRoleGroup(u.roles) === 'mechanics'),
    office: payroll.filter((u) => getRoleGroup(u.roles) === 'office'),
  };

  const totalEarned = payroll.reduce((s, u) => s + parseFloat(u.earned), 0);
  const totalDebt = payroll.reduce((s, u) => s + parseFloat(u.debt), 0);

  const walletList = wallets ? [wallets.cash, wallets.bank, wallets.card] : [];

  const openSettle = (entry: PayrollEntry) => {
    setSettleTarget(entry);
    setSettleAmount(entry.debt);
    setSettleWallet(wallets?.cash.id ?? '');
  };

  const handleSettle = () => {
    if (!settleTarget || !settleWallet || !settleAmount) return;
    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) return;
    settleMutation.mutate({
      user_id: settleTarget.id,
      amount: amt.toFixed(2),
      from_wallet_id: settleWallet,
    });
  };

  const activeList = grouped[activeGroup];

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
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-zinc-200">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Начислено
            </p>
            <p className="text-xl font-black text-zinc-900">
              <Money amount={totalEarned.toFixed(2)} />
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-zinc-200">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Долг
            </p>
            <p
              className={`text-xl font-black ${totalDebt > 0 ? 'text-rose-600' : 'text-zinc-900'}`}
            >
              <Money amount={totalDebt.toFixed(2)} />
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
                  className="bg-white rounded-2xl border border-zinc-200 overflow-hidden"
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
                      onClick={() => openSettle(entry)}
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Выплата ЗП
                </p>
                <p className="text-lg font-black text-zinc-900 mt-0.5">{settleTarget.name}</p>
              </div>
              <button
                onClick={() => setSettleTarget(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">
                Сумма (₽)
              </label>
              <input
                type="number"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                className="w-full border-2 border-zinc-200 rounded-2xl px-4 py-3 text-xl font-black text-zinc-900 focus:border-orange-400 focus:outline-none"
                placeholder="0"
                min="1"
              />
            </div>

            {/* Wallet selector */}
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-2">
                Откуда выплатить
              </label>
              <div className="grid grid-cols-3 gap-2">
                {walletList.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setSettleWallet(w.id)}
                    className={`rounded-2xl p-3 border-2 text-left transition-colors ${
                      settleWallet === w.id
                        ? 'border-orange-400 bg-orange-50'
                        : 'border-zinc-200 bg-white'
                    }`}
                  >
                    <p className="text-[11px] font-black text-zinc-700 leading-tight">{w.name}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      <Money amount={w.balance} />
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSettle}
              disabled={
                settleMutation.isPending ||
                !settleWallet ||
                !settleAmount ||
                parseFloat(settleAmount) <= 0
              }
              className="w-full bg-orange-500 text-white font-black text-base py-4 rounded-2xl disabled:opacity-40 active:bg-orange-700 transition-colors"
            >
              {settleMutation.isPending ? 'Выплата...' : 'Подтвердить выплату'}
            </button>

            {settleMutation.isError && (
              <p className="text-sm text-rose-600 text-center font-semibold">
                {(settleMutation.error as Error).message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
