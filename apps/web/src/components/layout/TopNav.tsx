"use client"

import React from 'react'
import {
  LayoutDashboard,
  ClipboardList,
  Truck,
  RefreshCcw,
  Wallet,
  Users,
  LogOut,
} from 'lucide-react'
import { cn } from '@saldacargo/ui'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const menuItems = [
  { id: 'money-map',    icon: LayoutDashboard, label: 'Главная',      href: '/money-map' },
  { id: 'trips',        icon: ClipboardList,   label: 'Ревью смены',  href: '/trips',        badge: 3 },
  { id: 'assets',       icon: Truck,           label: 'Автопарк',     href: '/assets' },
  { id: 'transactions', icon: Wallet,          label: 'Транзакции',   href: '/transactions' },
  { id: 'payroll',      icon: Users,           label: 'Зарплаты',     href: '/payroll' },
  { id: 'integrations', icon: RefreshCcw,      label: 'Интеграции',   href: '/integrations' },
]

export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <header className="h-[52px] bg-navigation border-b border-white/10 flex items-center px-5 gap-0 shrink-0 z-10">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-7 shrink-0">
        <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
          <Truck size={15} className="text-white" />
        </div>
        <span className="text-white font-extrabold text-[15px] tracking-tight">SaldaCargo</span>
      </div>

      {/* Nav */}
      <nav className="flex items-center gap-1 flex-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all whitespace-nowrap',
                isActive
                  ? 'bg-primary text-white'
                  : 'text-white/55 hover:text-white hover:bg-white/[0.08]'
              )}
            >
              <item.icon size={14} />
              {item.label}
              {item.badge && (
                <span className="ml-1 bg-amber-500 text-white rounded-full text-[9px] font-bold px-1.5 py-px">
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="text-right">
          <div className="text-white font-semibold text-xs leading-tight">Администратор</div>
          <div className="text-white/55 text-[10.5px]">admin@saldacargo.ru</div>
        </div>
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-xs">АВ</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-white/55 hover:text-white hover:bg-white/[0.08] text-[12px] font-medium transition-all px-2 py-1.5 rounded-lg"
        >
          <LogOut size={13} /> Выйти
        </button>
      </div>
    </header>
  )
}
