'use client'

import { useEffect, useState } from 'react'
import WalletCard from './WalletCard'
import PnlCard from './PnlCard'
import TodayCard from './TodayCard'
import AlertsCard from './AlertsCard'

interface MoneyMapData {
  netPosition: number
  cash: { total: number; wallets: Array<{ id: string; code: string; name: string; type: string; balance: number }> }
  fleet: { total: number; count: number }
  receivables: { total: number; overdue: number }
  payables: { total: number }
  pnl: { income: number; expense: number; profit: number; target: number; progressPercent: number }
  today: { date: string; income: number; expense: number; profit: number; onLine: number; totalActive: number; loadPercent: number }
  alerts: { draftsCount: number; toAlertsCount: number; overdueReceivables: number; lowLoad: boolean }
}

export default function MoneyMap() {
  const [data, setData] = useState<MoneyMapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/money-map')
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Ошибка загрузки')
        }
        const json = await res.json()
        setData(json.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const fmt = (n: number) => n.toLocaleString('ru-RU')

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-400 text-sm animate-pulse">Загрузка данных...</div>
    </div>
  )

  if (error) return (
    <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
      ❌ {error}
    </div>
  )

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Чистая позиция */}
      <div className="bg-slate-800 text-white rounded-xl p-6 shadow-md border border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Чистая позиция (активы - долги)</p>
            <p className="text-4xl font-black">{fmt(data.netPosition)} ₽</p>
          </div>
          <div className="text-sm text-slate-400 space-y-1">
            <div className="flex justify-between gap-6"><span>Наличные/Безнал:</span> <span className="text-white font-medium">{fmt(data.cash.total)} ₽</span></div>
            <div className="flex justify-between gap-6"><span>Баланс автопарка:</span> <span className="text-white font-medium">{fmt(data.fleet.total)} ₽</span></div>
            <div className="flex justify-between gap-6"><span>Дебиторка:</span> <span className="text-white font-medium">{fmt(data.receivables.total)} ₽</span></div>
            <div className="flex justify-between gap-6 pt-1 border-t border-slate-700"><span>Кредиторка:</span> <span className="text-red-400 font-medium">−{fmt(data.payables.total)} ₽</span></div>
          </div>
        </div>
      </div>

      {/* Основная сетка */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WalletCard wallets={data.cash.wallets} total={data.cash.total} />

        {/* Автопарк и Дебиторка */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-700">🚛 Автопарк</h3>
            <span className="text-lg font-bold text-slate-800">{fmt(data.fleet.total)} ₽</span>
          </div>
          <p className="text-xs text-slate-400 uppercase font-bold">
            {data.fleet.count} машин в работе · балансовая стоимость
          </p>
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">Дебиторка</p>
              <p className="font-bold text-slate-700">{fmt(data.receivables.total)} ₽</p>
              {data.receivables.overdue > 0 && (
                <p className="text-[10px] text-red-500 font-medium mt-1">⚠️ {fmt(data.receivables.overdue)} ₽ просрочено</p>
              )}
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">Кредиторка</p>
              <p className="font-bold text-slate-700">{fmt(data.payables.total)} ₽</p>
            </div>
          </div>
        </div>

        <PnlCard {...data.pnl} />
        <TodayCard {...data.today} />
      </div>

      {/* Алерты */}
      <AlertsCard {...data.alerts} />
    </div>
  )
}
