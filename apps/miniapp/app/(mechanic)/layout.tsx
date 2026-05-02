'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NetworkIndicator } from '@saldacargo/ui';
import { cn } from '@saldacargo/ui';

const tabs = [
  { href: '/mechanic', label: 'Главная', icon: '🏠' },
  { href: '/mechanic/orders', label: 'Наряды', icon: '🔧' },
  { href: '/mechanic/warehouse', label: 'Склад', icon: '📦' },
  { href: '/mechanic/profile', label: 'Профиль', icon: '👤' },
] as const;

export default function MechanicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900">
      {/* Шапка */}
      <header className="sticky top-0 z-50 bg-zinc-900 text-white px-4 h-16 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-600 flex items-center justify-center overflow-hidden shadow-inner">
            <span className="text-xl">🛠</span>
          </div>
          <div>
            <span className="text-lg font-black tracking-tight block leading-none">SaldaService</span>
            <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">СТО / Гараж</span>
          </div>
        </div>
        <NetworkIndicator />
      </header>

      {/* Контент */}
      <main className="flex-1 overflow-y-auto pb-24">{children}</main>

      {/* Таб-бар */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-zinc-200 z-50 h-20 px-2 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="grid grid-cols-4 h-full">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href || (tab.href !== '/mechanic' && pathname.startsWith(tab.href));
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 transition-all active:scale-90',
                  isActive ? 'text-orange-600' : 'text-zinc-400',
                )}
              >
                <div className={cn(
                  'p-1 rounded-xl transition-colors',
                  isActive ? 'bg-orange-50' : 'bg-transparent'
                )}>
                  <span className="text-2xl">{tab.icon}</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
