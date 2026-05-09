'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Suspense } from 'react';
import { cn } from '@saldacargo/ui';

type Period = 'current_month' | 'last_month' | 'quarter';
const PERIODS: { value: Period; label: string }[] = [
  { value: 'current_month', label: 'Текущий месяц' },
  { value: 'last_month', label: 'Прошлый месяц' },
  { value: 'quarter', label: 'Квартал' },
];

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const activePeriod = (searchParams.get('period') as Period) ?? 'current_month';

  const { data: loanAlerts } = useQuery<{ count: number; items: { overdue: boolean }[] }>({
    queryKey: ['loan-alerts'],
    queryFn: () => fetch('/api/loans/alerts').then((r) => r.json()),
    staleTime: 60000,
    refetchInterval: 5 * 60 * 1000,
  });
  const alertCount = loanAlerts?.count ?? 0;
  const hasOverdue = loanAlerts?.items.some((i) => i.overdue) ?? false;

  const setPeriod = (p: Period) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', p);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-surface-bright flex flex-col">
      <header className="bg-white sticky top-0 z-50 border-b border-slate-200">
        <div className="flex justify-between items-center w-full px-6 h-16 max-w-[1920px] mx-auto">
          <div className="flex items-center gap-8">
            <span className="text-xl font-bold tracking-tight text-slate-900">SaldaCargo</span>
            <nav className="hidden md:flex gap-6 h-16 items-center">
              {navItems.map((item) => {
                const isActive =
                  item.href === '/finance'
                    ? FINANCE_PATHS.some((p) => pathname === p || pathname.startsWith(p))
                    : pathname === item.href ||
                      (item.href !== '/' && pathname.startsWith(item.href));
                const showAlert = item.href === '/finance' && alertCount > 0;
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
                    {showAlert && (
                      <span
                        className={cn(
                          'text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none',
                          hasOverdue ? 'bg-rose-500 text-white' : 'bg-amber-400 text-white',
                        )}
                      >
                        {alertCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <input
                className="bg-slate-50 border-slate-200 rounded text-sm px-4 py-2 w-64 focus:ring-1 focus:ring-primary focus:outline-none"
                placeholder="Поиск по системе..."
                type="text"
              />
            </div>
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

      <section className="bg-slate-50 border-b border-slate-200 sticky top-16 z-40">
        <div className="flex items-center w-full px-6 h-10 max-w-[1920px] mx-auto gap-1">
          {PERIODS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={cn(
                'font-sans text-[10px] uppercase tracking-wider font-bold px-3 h-full transition-colors border-b-2',
                activePeriod === value
                  ? 'text-emerald-600 border-emerald-500'
                  : 'text-slate-500 hover:text-slate-900 border-transparent',
              )}
            >
              {label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="font-sans text-[10px] uppercase tracking-wider text-slate-600 font-bold">
              Online
            </span>
          </div>
        </div>
      </section>

      <main className="flex-1 max-w-[1920px] w-full mx-auto p-6">{children}</main>

      <footer className="mt-auto py-8 px-6 text-center">
        <p className="text-xs text-slate-400">© 2026 SaldaCargo ERP.</p>
      </footer>
    </div>
  );
}
