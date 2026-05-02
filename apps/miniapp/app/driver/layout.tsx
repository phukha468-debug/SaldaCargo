'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NetworkIndicator } from '@saldacargo/ui';
import { cn } from '@saldacargo/ui';

const tabs = [
  { href: '/driver', label: 'Главная', icon: '🏠' },
  { href: '/driver/trips', label: 'Рейсы', icon: '📋' },
  { href: '/driver/finance', label: 'Финансы', icon: '💰' },
  { href: '/driver/profile', label: 'Профиль', icon: '👤' },
] as const;


export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Шапка */}
      <header className="sticky top-0 z-50 bg-white border-b-2 border-zinc-200 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center overflow-hidden">
            <span className="text-xl">👤</span>
          </div>
          <span className="text-xl font-black text-zinc-900">SaldaCargo</span>
        </div>
        <NetworkIndicator />
      </header>

      {/* Контент */}
      <main className="flex-1 overflow-y-auto pb-24">{children}</main>

      {/* Таб-бар */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-zinc-200 z-50 h-20 px-2">
        <div className="grid grid-cols-4 h-full">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 transition-transform active:scale-95',
                  isActive ? 'text-orange-600 border-t-4 border-orange-600' : 'text-zinc-500 pt-1',
                )}
              >
                <span className="text-2xl">{tab.icon}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
