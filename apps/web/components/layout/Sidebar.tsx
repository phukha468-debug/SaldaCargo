"use client"

import React from 'react'
import { 
  LayoutDashboard, 
  ClipboardList, 
  Truck, 
  RefreshCcw, 
  Wallet, 
  Users,
  Settings,
  LogOut
} from 'lucide-react'
import { cn } from '@saldacargo/ui'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const menuItems = [
  { id: 'money-map', icon: LayoutDashboard, label: 'Главная', href: '/money-map' },
  { id: 'trips', icon: ClipboardList, label: 'Ревью смены', href: '/trips' },
  { id: 'assets', icon: Truck, label: 'Автопарк', href: '/assets' },
  { id: 'transactions', icon: Wallet, label: 'Транзакции', href: '/transactions' },
  { id: 'payroll', icon: Users, label: 'Зарплаты', href: '/payroll' },
  { id: 'integrations', icon: RefreshCcw, label: 'Интеграции', href: '/integrations' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-[260px] bg-navigation border-r border-white/10 flex flex-col shrink-0">
      <div className="p-6">
        <h2 className="text-xl font-bold text-white mb-8 tracking-tight">SaldaCargo</h2>
        <nav className="flex flex-col gap-2">
          {menuItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-[8px] transition-all font-medium",
                pathname === item.href
                  ? "bg-primary text-white shadow-lg shadow-primary/20"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon size={20} />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      
      <div className="mt-auto p-6 border-t border-white/10">
        <button className="flex items-center gap-3 px-4 py-3 text-white/60 hover:text-white transition-all w-full">
          <LogOut size={20} /> Выйти
        </button>
      </div>
    </aside>
  )
}
