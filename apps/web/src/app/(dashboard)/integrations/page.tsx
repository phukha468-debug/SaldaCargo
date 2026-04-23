"use client"

import React from "react"
import MainLayout from "@/components/layout/MainLayout"
import { Plus, Settings, RefreshCw, Building2, BarChart3, Truck, Package, Satellite } from "lucide-react"

const SERVICES = [
  {
    id: 'tbank',
    icon: Building2,
    name: 'Т-Банк',
    description: 'Расчётный счёт, автовыгрузка выписок',
    status: 'connected',
    lastSync: '5 мин назад',
  },
  {
    id: 'sber',
    icon: Building2,
    name: 'Сбербанк',
    description: 'Расчётный счёт',
    status: 'connected',
    lastSync: '12 мин назад',
  },
  {
    id: '1c',
    icon: BarChart3,
    name: '1С Бухгалтерия',
    description: 'Синхронизация проводок и актов',
    status: 'disconnected',
    lastSync: null,
  },
  {
    id: 'yandex',
    icon: Package,
    name: 'Яндекс.Доставка',
    description: 'Импорт заказов из маркетплейса',
    status: 'connected',
    lastSync: '1 час назад',
  },
  {
    id: 'glonass',
    icon: Satellite,
    name: 'ГЛОНАСС/GPS',
    description: 'Телематика и отслеживание ТС',
    status: 'error',
    lastSync: 'Ошибка синхронизации',
  },
  {
    id: 'moysklad',
    icon: Package,
    name: 'Мой Склад',
    description: 'Складской учёт и накладные',
    status: 'disconnected',
    lastSync: null,
  },
]

const STATUS_CONFIG = {
  connected:    { label: 'ПОДКЛЮЧЕНО',    color: 'text-green-600',  syncColor: 'text-slate-500' },
  disconnected: { label: 'НЕ ПОДКЛЮЧЕНО', color: 'text-slate-400',  syncColor: 'text-slate-400' },
  error:        { label: 'ОШИБКА',        color: 'text-red-600',    syncColor: 'text-red-500' },
}

export default function IntegrationsPage() {
  return (
    <MainLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Интеграции</h1>
            <p className="text-slate-500 text-[13px] mt-0.5">Подключённые сервисы и синхронизация данных</p>
          </div>
          <button className="flex items-center gap-1.5 text-[13px] text-white bg-primary rounded-lg px-3 py-2 shadow-sm hover:bg-primary/90 transition-colors font-medium">
            <Plus size={13} /> Добавить
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {SERVICES.map(s => {
            const st = STATUS_CONFIG[s.status as keyof typeof STATUS_CONFIG]
            const Icon = s.icon
            return (
              <div key={s.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Icon size={18} className="text-slate-500" />
                    </div>
                    <div>
                      <p className="font-bold text-[14px] text-slate-800">{s.name}</p>
                      <p className="text-[12px] text-slate-400">{s.description}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold tracking-wide ${st.color}`}>
                    {st.label}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <div>
                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide">Синхронизация</p>
                    <p className={`text-[11px] font-medium mt-0.5 ${st.syncColor}`}>
                      {s.lastSync || 'Не подключено'}
                    </p>
                  </div>
                  {s.status === 'connected' && (
                    <button className="flex items-center gap-1.5 text-[12px] text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors">
                      <Settings size={12} /> Настроить
                    </button>
                  )}
                  {s.status === 'disconnected' && (
                    <button className="flex items-center gap-1.5 text-[12px] text-white bg-primary rounded-lg px-3 py-1.5 hover:bg-primary/90 transition-colors font-medium">
                      <Plus size={12} /> Подключить
                    </button>
                  )}
                  {s.status === 'error' && (
                    <button className="flex items-center gap-1.5 text-[12px] text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors">
                      <RefreshCw size={12} /> Переподключить
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </MainLayout>
  )
}
