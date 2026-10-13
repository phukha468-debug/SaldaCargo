'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NetworkIndicator } from '@saldacargo/ui';
import { cn } from '@saldacargo/ui';

const tabs = [
  { href: '/mechanic', label: 'Главная', icon: '🏠' },
  { href: '/mechanic/orders', label: 'Работы', icon: '🔧' },
  { href: '/mechanic/salary', label: 'Зарплата', icon: '💰' },
  { href: '/mechanic/profile', label: 'Профиль', icon: '👤' },
] as const;

export default function MechanicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900">
      {/* Шапка */}
      <header className="sticky top-0 z-50 bg-white border-b-2 border-zinc-200 px-4 h-16 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 shadow-xs border border-zinc-200">
            <img src="/logo.png" alt="TK501" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black text-zinc-900 leading-none">
                TK<span className="text-orange-600">501</span>
              </span>
              <span className="bg-orange-100 text-orange-700 text-[9px] font-black uppercase px-1.5 py-0.5 rounded tracking-wide">
                СТО
              </span>
            </div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mt-0.5">
              Механик
            </span>
          </div>
        </div>
        <NetworkIndicator />
      </header>

      {/* Контент */}
      <main className="flex-1 overflow-y-auto pb-24">{children}</main>

      {/* Таб-бар */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-zinc-200 z-50 h-20 px-2 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
        <div className="grid grid-cols-4 h-full">
          {tabs.map((tab) => {
            const isActive =
              pathname === tab.href || (tab.href !== '/mechanic' && pathname.startsWith(tab.href));
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 transition-transform active:scale-95',
                  isActive ? 'text-orange-600 border-t-4 border-orange-600' : 'text-zinc-400 pt-1',
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
