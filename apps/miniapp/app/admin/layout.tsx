'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { SaldaModule } from '@saldacargo/shared';

interface MiniappNavItem {
  href: string;
  label: string;
  icon: string;
  module?: SaldaModule;
}

const NAV: MiniappNavItem[] = [
  { href: '/admin', label: 'Главная', icon: '🏠' },
  { href: '/admin/trips', label: 'Рейсы', icon: '🚛', module: 'transport' },
  { href: '/admin/send-docs', label: 'Документы', icon: '📄', module: 'transport' },
  { href: '/admin/finance', label: 'Финансы', icon: '💰', module: 'finance' },
  { href: '/admin/staff', label: 'Персонал', icon: '👥', module: 'payroll' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [enabledModules, setEnabledModules] = useState<SaldaModule[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/organization/context')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { enabled_modules?: SaldaModule[] } | null) => {
        if (!cancelled && Array.isArray(data?.enabled_modules)) {
          setEnabledModules(data.enabled_modules);
        }
      })
      .catch(() => {
        // Fallback: показываем все пункты при временной ошибке сети
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleNav = NAV.filter(
    (item) => !item.module || !enabledModules || enabledModules.includes(item.module),
  );

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      {children}

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-zinc-200 z-30">
        <div className="flex max-w-lg mx-auto">
          {visibleNav.map((item) => {
            const active =
              pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-all ${
                  active ? 'text-orange-600 font-bold' : 'text-zinc-400 hover:text-zinc-600'
                }`}
              >
                <span className="text-xl leading-none">{item.icon}</span>
                <span className="text-[10px] font-black uppercase tracking-wider">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
