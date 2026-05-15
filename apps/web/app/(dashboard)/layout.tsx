'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Suspense } from 'react';
import { cn } from '@saldacargo/ui';

const navItems = [
  { href: '/', label: 'Главная' },
  { href: '/review', label: 'Ревью' },
  { href: '/fleet', label: 'Автопарк' },
  { href: '/garage', label: 'Гараж' },
  { href: '/finance', label: 'Финансы' },
  { href: '/counterparties', label: 'Контрагенты' },
  { href: '/staff', label: 'Персонал' },
] as const;

const FINANCE_PATHS = ['/finance', '/receivables', '/loans'];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-bright" />}>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </Suspense>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  type AlertsData = {
    fleet: { overdue: boolean }[];
    receivables: { id: string }[];
    loans: { overdue: boolean }[];
    total: number;
  };
  const { data: alerts } = useQuery<AlertsData>({
    queryKey: ['alerts'],
    queryFn: () => fetch('/api/alerts').then((r) => r.json()),
    staleTime: 60000,
    refetchInterval: 5 * 60 * 1000,
  });

  const fleetAlertCount = alerts?.fleet.length ?? 0;
  const fleetHasOverdue = alerts?.fleet.some((i) => i.overdue) ?? false;
  const financeAlertCount = (alerts?.receivables.length ?? 0) + (alerts?.loans.length ?? 0);
  const financeHasOverdue =
    (alerts?.loans.some((i) => i.overdue) ?? false) || (alerts?.receivables.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-surface-bright flex flex-col">
      <header className="bg-white sticky top-0 z-50 border-b border-slate-200">
        <div className="flex items-center w-full px-6 h-16 max-w-[1920px] mx-auto">
          <div className="flex items-center gap-8 flex-1">
            <span className="text-xl font-bold tracking-tight text-slate-900">SaldaCargo</span>
            <nav className="hidden md:flex gap-6 h-16 items-center">
              {navItems.map((item) => {
                const isActive =
                  item.href === '/finance'
                    ? FINANCE_PATHS.some((p) => pathname === p || pathname.startsWith(p))
                    : pathname === item.href ||
                      (item.href !== '/' && pathname.startsWith(item.href));
                const isFleet = item.href === '/fleet';
                const isFinance = item.href === '/finance';
                const badgeCount = isFleet ? fleetAlertCount : isFinance ? financeAlertCount : 0;
                const badgeOverdue = isFleet
                  ? fleetHasOverdue
                  : isFinance
                    ? financeHasOverdue
                    : false;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'font-sans antialiased text-sm font-medium h-full flex items-center gap-1.5 transition-colors border-b-2 mt-[2px]',
                      isActive
                        ? 'text-slate-900 border-slate-900'
                        : 'text-slate-500 hover:text-slate-700 border-transparent',
                    )}
                  >
                    {item.label}
                    {badgeCount > 0 && (
                      <span
                        className={cn(
                          'text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none',
                          badgeOverdue ? 'bg-rose-500 text-white' : 'bg-amber-400 text-white',
                        )}
                      >
                        {badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4 flex-1 justify-end">
            <TodayDate />
            <button className="p-2 hover:bg-slate-50 rounded-full transition-colors flex items-center">
              <span className="material-symbols-outlined text-slate-600">notifications</span>
            </button>
            <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center">
                <span className="material-symbols-outlined text-slate-400">person</span>
              </div>
              <span className="text-sm font-medium text-slate-700">Админ</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1920px] w-full mx-auto px-6 pt-4 pb-8">{children}</main>

      <footer className="mt-auto py-8 px-6 text-center">
        <p className="text-xs text-slate-400">© 2026 SaldaCargo ERP.</p>
      </footer>
    </div>
  );
}

function TodayDate() {
  const now = new Date();
  const day = now.toLocaleDateString('ru-RU', { day: 'numeric' });
  const month = now.toLocaleDateString('ru-RU', { month: 'long' });
  const weekday = now.toLocaleDateString('ru-RU', { weekday: 'long' });
  return (
    <div className="select-none whitespace-nowrap flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2">
      <span className="text-[18px] font-black text-slate-800 leading-none tracking-tight">
        {day}
      </span>
      <span className="text-[13px] font-semibold text-slate-700 capitalize leading-none">
        {month}
      </span>
      <span className="text-[11px] text-slate-400 font-medium capitalize leading-none">
        {weekday}
      </span>
    </div>
  );
}
