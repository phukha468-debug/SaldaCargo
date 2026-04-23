"use client"

import React from "react"
import WalletCard from "@/components/dashboard/WalletCard"
import PnlCard from "@/components/dashboard/PnlCard"
import TodayCard from "@/components/dashboard/TodayCard"
import AlertsCard from "@/components/dashboard/AlertsCard"

const EMPTY: any = {
  netPosition: 0,
  cash: { total: 0, wallets: [] },
  fleet: { total: 0, count: 0 },
  receivables: { total: 0, overdue: 0 },
  payables: { total: 0 },
  pnl: { income: 0, expense: 0, profit: 0, target: 1500000, progressPercent: 0 },
  today: {
    date: new Date().toISOString().split('T')[0],
    income: 0, expense: 0, profit: 0,
    onLine: 0, totalActive: 0, loadPercent: 0,
  },
  alerts: { draftsCount: 0, toAlertsCount: 0, overdueReceivables: 0, lowLoad: false },
}

export function MoneyMap() {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch("/api/money-map")
      .then(res => res.json())
      .then(json => { if (json.success) setData(json.data) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <MoneyMapSkeleton />

  const d = data || EMPTY
  const fmt = (n: number) => n.toLocaleString('ru-RU')

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">

      {/* Тёмный баннер — фиксированный размер */}
      <div className="bg-[#1E293B] rounded-2xl px-8 py-5 flex items-center justify-between shrink-0">
        <div>
          <p className="text-white/50 text-[10px] uppercase font-bold tracking-widest mb-1.5">
            Чистая позиция (Активы – Долги)
          </p>
          <p className="text-white text-[36px] font-extrabold font-mono tabular-nums leading-none">
            {fmt(d.netPosition)} ₽
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-10 gap-y-3 text-right">
          <div>
            <p className="text-white/50 text-[9px] uppercase font-bold tracking-widest mb-0.5">Наличные/Безнал</p>
            <p className="text-white font-bold text-[15px] font-mono tabular-nums">{fmt(d.cash.total)} ₽</p>
          </div>
          <div>
            <p className="text-white/50 text-[9px] uppercase font-bold tracking-widest mb-0.5">Баланс Автопарка</p>
            <p className="text-white font-bold text-[15px] font-mono tabular-nums">{fmt(d.fleet.total)} ₽</p>
          </div>
          <div>
            <p className="text-white/50 text-[9px] uppercase font-bold tracking-widest mb-0.5">Дебиторка</p>
            <p className="text-white font-bold text-[15px] font-mono tabular-nums">{fmt(d.receivables.total)} ₽</p>
          </div>
          <div>
            <p className="text-white/50 text-[9px] uppercase font-bold tracking-widest mb-0.5">Кредиторка</p>
            <p className={`font-bold text-[15px] font-mono tabular-nums ${d.payables.total > 0 ? 'text-red-400' : 'text-white'}`}>
              {d.payables.total > 0 ? `-${fmt(d.payables.total)}` : fmt(d.payables.total)} ₽
            </p>
          </div>
        </div>
      </div>

      {/* Строка 3 карточки — flex-1, растягивается */}
      <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
        <WalletCard wallets={d.cash.wallets} total={d.cash.total} />
        <PnlCard
          income={d.pnl.income}
          expense={d.pnl.expense}
          profit={d.pnl.profit}
          target={d.pnl.target}
          progressPercent={d.pnl.progressPercent}
        />
        <TodayCard
          date={d.today.date}
          income={d.today.income}
          expense={d.today.expense}
          profit={d.today.profit}
          onLine={d.today.onLine}
          totalActive={d.today.totalActive}
          loadPercent={d.today.loadPercent}
        />
      </div>

      {/* Строка 2 карточки — flex-1, растягивается */}
      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        <div className="bg-[#EEF2F8] rounded-xl border border-slate-300/70 p-6 shadow-sm h-full flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-[14px] text-slate-800">Автопарк</h3>
              <span className="text-[16px] font-extrabold text-slate-800 font-mono tabular-nums">
                {fmt(d.fleet.total)} ₽
              </span>
            </div>
            <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wide">
              {d.fleet.count} машин · Балансовая стоимость
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6 mt-4">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-1.5">Дебиторка</p>
              <p className="font-bold text-[18px] font-mono tabular-nums text-slate-800">{fmt(d.receivables.total)} ₽</p>
              {d.receivables.overdue > 0 && (
                <p className="text-[11px] text-red-500 mt-1">
                  ▲ {fmt(d.receivables.overdue)} ₽ просрочено
                </p>
              )}
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-1.5">Кредиторка</p>
              <p className={`font-bold text-[18px] font-mono tabular-nums ${d.payables.total > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                {d.payables.total > 0 ? `-${fmt(d.payables.total)}` : fmt(d.payables.total)} ₽
              </p>
            </div>
          </div>
        </div>

        <AlertsCard
          draftsCount={d.alerts.draftsCount}
          toAlertsCount={d.alerts.toAlertsCount}
          overdueReceivables={d.alerts.overdueReceivables}
          lowLoad={d.alerts.lowLoad}
        />
      </div>

    </div>
  )
}

function MoneyMapSkeleton() {
  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 animate-pulse">
      <div className="bg-slate-200 rounded-2xl h-24 shrink-0" />
      <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
        <div className="bg-slate-100 rounded-xl" />
        <div className="bg-slate-100 rounded-xl" />
        <div className="bg-slate-100 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        <div className="bg-slate-100 rounded-xl" />
        <div className="bg-slate-100 rounded-xl" />
      </div>
    </div>
  )
}
