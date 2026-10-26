'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NetworkIndicator, cn } from '@saldacargo/ui';

const tabs = [
  { href: '/mechanic', label: 'Главная', icon: '🏠' },
  { href: '/mechanic/orders', label: 'Наряды', icon: '📋' },
  { href: '/mechanic/salary', label: 'Зарплата', icon: '💳' },
  { href: '/mechanic/profile', label: 'Профиль', icon: '👤' },
] as const;

export default function MechanicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-screen bg-[#F2F4F7] text-slate-900">
      {/* Шапка в светлом банковском стиле Сбербанк */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 border border-slate-200 bg-[#E8F7EC]">
            <img src="/logo.png" alt="TK501" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-extrabold text-slate-900 leading-none tracking-tight">
                TK<span className="text-[#21A038]">501</span>
              </span>
              <span className="bg-[#E8F7EC] text-[#0E7C5B] text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wide">
                СТО · Гараж
              </span>
            </div>
            <span className="text-[11px] font-semibold text-slate-400 block mt-0.5">
              Кабинет механика
            </span>
          </div>
        </div>
        <NetworkIndicator />
      </header>

      {/* Контент */}
      <main className="flex-1 overflow-y-auto pb-24">{children}</main>

      {/* Нижний таб-бар в стиле Сбербанк */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 z-50 h-20 px-2 shadow-[0_-4px_16px_rgba(15,23,42,0.04)]">
        <div className="grid grid-cols-4 h-full max-w-lg mx-auto">
          {tabs.map((tab) => {
            const isActive =
              pathname === tab.href || (tab.href !== '/mechanic' && pathname.startsWith(tab.href));
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 transition-all active:scale-95 relative',
                  isActive ? 'text-[#21A038]' : 'text-slate-400',
                )}
              >
                {isActive && (
                  <span className="absolute top-0 w-10 h-1 rounded-b-full bg-[#21A038]" />
                )}
                <span className="text-xl leading-none">{tab.icon}</span>
                <span className="text-[11px] font-bold tracking-tight">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
