'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/admin', label: 'Главная', icon: '🏠' },
  { href: '/admin/trips', label: 'Рейсы', icon: '🚛' },
  { href: '/admin/finance', label: 'Финансы', icon: '💰' },
  { href: '/admin/orders', label: 'Наряды', icon: '🔧' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      {children}

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-zinc-200 z-50">
        <div className="flex">
          {NAV.map((item) => {
            const active =
              pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
                  active ? 'text-orange-600' : 'text-zinc-400'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-[9px] font-black uppercase tracking-widest">
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
