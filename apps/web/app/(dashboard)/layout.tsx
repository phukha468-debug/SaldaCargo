'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { cn } from '@saldacargo/ui';

const navItems = [
  { href: '/', label: 'Главная', icon: 'dashboard' },
  { href: '/review', label: 'Ревью рейсов', icon: 'rate_review' },
  { href: '/finance', label: 'Финансы / P&L', icon: 'account_balance_wallet' },
  { href: '/fleet', label: 'Автопарк', icon: 'local_shipping' },
  { href: '/garage', label: 'Гараж / СТО', icon: 'build' },
  { href: '/counterparties', label: 'Контрагенты', icon: 'corporate_fare' },
  { href: '/staff', label: 'Персонал', icon: 'badge' },
  { href: '/retro', label: 'Ретро-ввод', icon: 'history' },
] as const;

const FINANCE_PATHS = ['/finance', '/receivables', '/loans', '/payables'];

type Wallets = {
  bank: { name: string; balance: string };
  cash: { name: string; balance: string };
  card?: { name: string; balance: string };
  fuel_card?: { name: string; balance: string };
};

type AlertsData = {
  fleet: { overdue: boolean }[];
  receivables: { id: string }[];
  loans: { overdue: boolean }[];
  service?: { id: string }[];
  total: number;
};

type Summary = {
  today: { revenue: string; tripsCount: number };
  alerts: { tripsForReview: number };
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100" />}>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </Suspense>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { data: alerts } = useQuery<AlertsData>({
    queryKey: ['alerts'],
    queryFn: () => fetch('/api/alerts').then((r) => r.json()),
    staleTime: 60000,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: summary } = useQuery<Summary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => fetch('/api/dashboard/summary').then((r) => r.json()),
    staleTime: 30000,
  });

  const { data: wallets } = useQuery<Wallets>({
    queryKey: ['wallets'],
    queryFn: () => fetch('/api/wallets').then((r) => r.json()),
    staleTime: 30000,
  });

  const bankNum = parseFloat(wallets?.bank?.balance ?? '0');
  const cashNum = parseFloat(wallets?.cash?.balance ?? '0');
  const cardNum = parseFloat(wallets?.card?.balance ?? '0');
  const fuelNum = parseFloat(wallets?.fuel_card?.balance ?? '0');
  const totalBalance = bankNum + cashNum + cardNum + fuelNum;

  const tripsForReview = summary?.alerts?.tripsForReview ?? 0;
  const fleetAlertCount = alerts?.fleet?.length ?? 0;
  const fleetHasOverdue = alerts?.fleet?.some((i) => i.overdue) ?? false;
  const financeAlertCount = (alerts?.receivables?.length ?? 0) + (alerts?.loans?.length ?? 0);
  const financeHasOverdue =
    (alerts?.loans?.some((i) => i.overdue) ?? false) || (alerts?.receivables?.length ?? 0) > 0;
  const serviceAlertCount = alerts?.service?.length ?? 0;

  // Active section title
  const currentNav =
    navItems.find((item) =>
      item.href === '/finance'
        ? FINANCE_PATHS.some((p) => pathname === p || pathname.startsWith(p))
        : pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)),
    ) ?? navItems[0];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex">
      {/* ── Sidebar (Desktop) ────────────────────────────────────────── */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 hidden lg:flex min-h-screen sticky top-0 h-screen z-30">
        {/* Brand */}
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 bg-sky-500 rounded-xl flex items-center justify-center font-black text-white text-xl shadow-sm">
            S
          </div>
          <div>
            <div className="font-extrabold text-base tracking-tight text-white leading-snug">
              SaldaCargo
            </div>
            <div className="text-[11px] text-slate-400 font-medium">Управление автопарком</div>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
            Навигация
          </div>
          {navItems.map((item) => {
            const isActive =
              item.href === '/finance'
                ? FINANCE_PATHS.some((p) => pathname === p || pathname.startsWith(p))
                : pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

            let badgeCount = 0;
            let badgeIsCritical = false;

            if (item.href === '/review') {
              badgeCount = tripsForReview;
            } else if (item.href === '/fleet') {
              badgeCount = fleetAlertCount;
              badgeIsCritical = fleetHasOverdue;
            } else if (item.href === '/finance') {
              badgeCount = financeAlertCount;
              badgeIsCritical = financeHasOverdue;
            } else if (item.href === '/garage') {
              badgeCount = serviceAlertCount;
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all',
                  isActive
                    ? 'bg-sky-500/15 text-sky-400 font-bold border border-sky-500/20 shadow-xs'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent',
                )}
              >
                <span className="material-symbols-outlined text-[20px] shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
                {badgeCount > 0 && (
                  <span
                    className={cn(
                      'ml-auto text-xs px-2 py-0.5 rounded-full font-bold border',
                      badgeIsCritical
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/30',
                    )}
                  >
                    {badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 text-xs text-slate-400 text-center">
          Версия 2.4 · SaldaCargo ERP
        </div>
      </aside>

      {/* ── Mobile Header Overlay ────────────────────────────────────── */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 lg:hidden flex"
          onClick={() => setMobileNavOpen(false)}
        >
          <div
            className="w-64 bg-slate-900 text-white flex flex-col h-full p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center font-bold text-white">
                  S
                </div>
                <span className="font-bold text-white">SaldaCargo</span>
              </div>
              <button onClick={() => setMobileNavOpen(false)} className="text-slate-400">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <nav className="mt-4 space-y-1 flex-1 overflow-y-auto">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800 text-sm font-medium"
                >
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* ── Main Area ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                  {currentNav?.label || 'Главная'}
                </h1>
                <span className="bg-sky-100 text-sky-700 text-xs font-bold px-2.5 py-0.5 rounded-full hidden sm:inline-block">
                  SaldaCargo ERP
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5 hidden sm:block">
                Оперативная сводка финансовых потоков и статистики рейсов
              </p>
            </div>
          </div>

          {/* Right Live Balance Summary Widget */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 bg-slate-900 text-white px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-[20px] sm:text-[22px]">
                  account_balance
                </span>
                <div>
                  <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                    Совокупный Баланс
                  </div>
                  <div className="text-sm sm:text-base font-black text-white leading-none mt-0.5">
                    {totalBalance.toLocaleString('ru-RU')} ₽
                  </div>
                </div>
              </div>
              <div className="h-6 w-px bg-slate-700 mx-1 hidden md:block" />
              <div className="text-xs text-slate-300 hidden md:block">
                <span className="text-sky-400 font-bold">Банк:</span>{' '}
                {bankNum.toLocaleString('ru-RU')} ₽ <br />
                <span className="text-emerald-400 font-bold">Касса:</span>{' '}
                {cashNum.toLocaleString('ru-RU')} ₽
              </div>
            </div>

            <TodayDate />
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">{children}</main>

        <footer className="py-4 px-6 border-t border-slate-200 text-center text-xs text-slate-400 bg-white">
          © 2026 SaldaCargo ERP · Все финансовые и операционные данные синхронизированы
        </footer>
      </div>
    </div>
  );
}

function TodayDate() {
  const now = new Date();
  const day = now.toLocaleDateString('ru-RU', { day: 'numeric' });
  const month = now.toLocaleDateString('ru-RU', { month: 'short' });
  const weekday = now.toLocaleDateString('ru-RU', { weekday: 'short' });
  return (
    <div className="select-none whitespace-nowrap hidden sm:flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs">
      <span className="font-black text-slate-800 leading-none">{day}</span>
      <span className="font-semibold text-slate-700 capitalize leading-none">{month}</span>
      <span className="text-slate-400 font-medium capitalize leading-none">({weekday})</span>
    </div>
  );
}
