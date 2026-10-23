'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/admin', label: 'Главная', icon: '🏠' },
  { href: '/admin/trips', label: 'Рейсы', icon: '🚛' },
  { href: '/admin/finance', label: 'Финансы', icon: '💰' },
  { href: '/admin/staff', label: 'Персонал', icon: '👥' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      {children}

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-zinc-200 z-50">
        <div className="flex max-w-lg mx-auto">
          {NAV.map((item) => {
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
