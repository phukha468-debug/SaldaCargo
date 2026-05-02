'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@saldacargo/ui';

const navItems = [
  { href: '/', label: 'Главная' },
  { href: '/review', label: 'Ревью' },
  { href: '/fleet', label: 'Автопарк' },
  { href: '/garage', label: 'Гараж' },
  { href: '/finance', label: 'Финансы' },
  { href: '/staff', label: 'Персонал' },
  { href: '/settings', label: 'Настройки' },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-surface-bright flex flex-col">
      {/* TopNavBar (Global Navigation Shell) */}
      <header className="bg-white sticky top-0 z-50 border-b border-slate-200">
        <div className="flex justify-between items-center w-full px-6 h-16 max-w-[1920px] mx-auto">
          <div className="flex items-center gap-8">
            <span className="text-xl font-bold tracking-tight text-slate-900">SaldaCargo</span>
            <nav className="hidden md:flex gap-6 h-16 items-center">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'font-sans antialiased text-sm font-medium h-full flex items-center transition-colors border-b-2 mt-[2px]',
                      isActive
                        ? 'text-slate-900 border-slate-900'
                        : 'text-slate-500 hover:text-slate-700 border-transparent',
                    )}
                  >
                    {item.label}
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

      {/* Filters Sub-header (Stub for now) */}
      <section className="bg-slate-50 border-b border-slate-200 sticky top-16 z-40">
        <div className="flex items-center w-full px-6 h-10 max-w-[1920px] mx-auto gap-4">
          <span className="font-sans text-[10px] uppercase tracking-wider text-emerald-600 font-bold cursor-pointer">
            Текущий месяц
          </span>
          <span className="font-sans text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-900 cursor-pointer">
            Прошлый месяц
          </span>
          <span className="font-sans text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-900 cursor-pointer">
            Квартал
          </span>
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
        <p className="text-xs text-slate-400">
          © 2026 SaldaCargo ERP. Системный мониторинг логистических процессов.
        </p>
      </footer>
    </div>
  );
}
