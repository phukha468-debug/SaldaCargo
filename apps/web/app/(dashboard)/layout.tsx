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

  const getBadge = (href: string) => {
    let count = 0;
    let isCritical = false;
    if (href === '/review') count = tripsForReview;
    else if (href === '/fleet') {
      count = fleetAlertCount;
      isCritical = fleetHasOverdue;
    } else if (href === '/finance') {
      count = financeAlertCount;
      isCritical = financeHasOverdue;
    } else if (href === '/garage') {
      count = serviceAlertCount;
    }
    return { count, isCritical };
  };

  const isNavActive = (href: string) => {
    return href === '/finance'
      ? FINANCE_PATHS.some((p) => pathname === p || pathname.startsWith(p))
      : pathname === href || (href !== '/' && pathname.startsWith(href));
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col">
      {/* ── Mobile Navigation Drawer ─────────────────────────────────── */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 lg:hidden flex"
          onClick={() => setMobileNavOpen(false)}
        >
          <div
            className="w-72 bg-white text-slate-800 flex flex-col h-full p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-sky-600 rounded-lg flex items-center justify-center font-bold text-white shadow-sm">
                  A
                </div>
                <span className="font-extrabold text-slate-900 text-base">ancargo66</span>
              </div>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <nav className="mt-4 space-y-1 flex-1 overflow-y-auto">
              {navItems.map((item) => {
                const active = isNavActive(item.href);
                const { count, isCritical } = getBadge(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                      active
                        ? 'bg-sky-50 text-sky-700 border border-sky-200/80 font-bold'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    )}
                  >
                    <span
                      className={cn(
                        'material-symbols-outlined text-[20px]',
                        active ? 'text-sky-600' : 'text-slate-400',
                      )}
                    >
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                    {count > 0 && (
                      <span
                        className={cn(
                          'ml-auto text-xs px-2 py-0.5 rounded-full font-bold border',
                          isCritical
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200',
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* ── Top Header with Brand, Page Title & Live Balance ─────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        {/* Upper Header Row */}
        <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 border border-slate-200"
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>

            {/* Brand Logo */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 bg-sky-600 group-hover:bg-sky-700 transition-colors rounded-xl flex items-center justify-center font-black text-white text-base shadow-sm shadow-sky-600/20">
                S
              </div>
              <div className="hidden sm:block">
                <div className="font-extrabold text-base tracking-tight text-slate-900 leading-tight">
                  ancargo66
                </div>
                <div className="text-[10px] text-slate-400 font-medium leading-none">
                  Управление автопарком
                </div>
              </div>
            </Link>

            <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

            {/* Active Page Header Title */}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                  {currentNav?.label || 'Главная'}
                </h1>
                <span className="bg-sky-50 text-sky-700 border border-sky-200/70 text-[11px] font-bold px-2 py-0.5 rounded-full hidden md:inline-block">
                  ancargo66 ERP
                </span>
              </div>
            </div>
          </div>

          {/* Right Live Balance Summary Widget & Date */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex items-center gap-3 bg-slate-900 text-white px-3.5 sm:px-4 py-2 rounded-2xl shadow-sm">
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
        </div>

        {/* ── Horizontal Navigation Bar (Variant 2: Elevated 3D Cards) ── */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-t border-slate-200/80">
          <nav className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {navItems.map((item) => {
              const active = isNavActive(item.href);
              const { count, isCritical } = getBadge(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center justify-center gap-2 py-3 px-2 rounded-2xl text-xs sm:text-[13px] transition-all duration-200 group cursor-pointer relative select-none',
                    active
                      ? 'bg-gradient-to-b from-blue-50 to-indigo-50 border-2 border-blue-500 text-blue-800 shadow-md shadow-blue-500/15 font-black ring-4 ring-blue-500/10'
                      : 'bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 font-bold text-slate-700 hover:text-blue-600 shadow-2xs',
                  )}
                >
                  <span
                    className={cn(
                      'material-symbols-outlined text-[20px] transition-all duration-200',
                      active
                        ? 'text-blue-600'
                        : 'text-slate-400 group-hover:text-blue-500 group-hover:scale-110',
                    )}
                    style={{
                      fontVariationSettings: active
                        ? "'FILL' 1, 'wght' 600"
                        : "'FILL' 0, 'wght' 500",
                    }}
                  >
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                  {count > 0 && (
                    <span
                      className={cn(
                        'text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 shadow-2xs',
                        isCritical ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white',
                      )}
                    >
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ── Scrollable Page Body (Full Width) ────────────────────────── */}
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto">{children}</main>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="py-4 px-6 border-t border-slate-200 text-center text-xs text-slate-400 bg-white">
        © 2026 ancargo66 ERP · Все финансовые и операционные данные синхронизированы
      </footer>
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
