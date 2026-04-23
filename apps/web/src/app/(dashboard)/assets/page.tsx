"use client"

import React from "react"
import MainLayout from "@/components/layout/MainLayout"
import { Truck, MapPin, Gauge, User, Plus, SlidersHorizontal } from "lucide-react"

const STATUS_MAP: Record<string, { label: string; color: string; dot: string }> = {
  active:      { label: 'В работе',  color: 'text-green-600',  dot: 'bg-green-500' },
  in_progress: { label: 'В пути',    color: 'text-green-600',  dot: 'bg-green-500' },
  available:   { label: 'Готов',     color: 'text-slate-500',  dot: 'bg-slate-400' },
  reserve:     { label: 'В резерве', color: 'text-amber-600',  dot: 'bg-amber-500' },
  maintenance: { label: 'На ТО',     color: 'text-red-600',    dot: 'bg-red-500' },
}

function getStatus(status: string) {
  return STATUS_MAP[status] || STATUS_MAP['available']
}

export default function AssetsPage() {
  const [assets, setAssets] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch('/api/assets')
      .then(res => res.json())
      .then(data => {
        setAssets(Array.isArray(data) ? data : [])
        setLoading(false)
      })
  }, [])

  const active = assets.filter(a => a.status === 'active' || a.status === 'in_progress')
  const ready  = assets.filter(a => a.status === 'available' || a.status === 'reserve')
  const maintenance = assets.filter(a => a.status === 'maintenance')
  const fleetTotal = assets.reduce((s, a) => s + Number(a.current_book_value || a.residual_value || 0), 0)
  const fmt = (n: number) => n.toLocaleString('ru-RU')

  return (
    <MainLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Автопарк</h1>
            <p className="text-slate-500 text-[13px] mt-0.5">{assets.length} транспортных средств</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 text-[13px] text-slate-600 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm hover:bg-slate-50 transition-colors">
              <SlidersHorizontal size={13} /> Фильтр
            </button>
            <button className="flex items-center gap-1.5 text-[13px] text-white bg-primary rounded-lg px-3 py-2 shadow-sm hover:bg-primary/90 transition-colors font-medium">
              <Plus size={13} /> Добавить ТС
            </button>
          </div>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'На маршруте', value: active.length, color: 'text-green-600' },
            { label: 'Готов',       value: ready.length,  color: 'text-slate-700' },
            { label: 'На ТО',       value: maintenance.length, color: 'text-red-600' },
            { label: 'Баланс парка', value: `${fmt(fleetTotal)} ₽`, color: 'text-slate-800', mono: true },
          ].map(t => (
            <div key={t.label} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-2">{t.label}</p>
              <p className={`text-3xl font-extrabold ${t.color} ${t.mono ? 'font-mono tabular-nums text-2xl' : ''}`}>
                {t.value}
              </p>
            </div>
          ))}
        </div>

        {/* Vehicle cards */}
        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-slate-100 rounded-xl h-48 animate-pulse" />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
            Техника не найдена
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {assets.map(asset => {
              const st = getStatus(asset.status)
              const bookValue = asset.current_book_value || asset.residual_value || 0
              const notes = asset.notes || ''
              const driverMatch = notes.match(/Водитель:\s*([^.]+)/)
              const driverName = driverMatch ? driverMatch[1].trim() : '—'
              const modelGuess = notes.split('Водитель:')[0].trim().replace(/\.$/, '') || 'Грузовой'

              return (
                <div key={asset.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Truck size={15} className="text-slate-400" />
                      <div>
                        <p className="font-extrabold text-[15px] text-slate-800 tracking-tight">
                          {asset.plate_number}
                        </p>
                        <p className="text-[11px] text-slate-400">{modelGuess}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      <span className={`text-[11px] font-bold uppercase tracking-wide ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    <div>
                      <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mb-0.5">
                        <Gauge size={9} className="inline mr-0.5" />Пробег
                      </p>
                      <p className="text-[12px] font-semibold text-slate-700 font-mono tabular-nums">
                        {(asset.odometer_current || 0).toLocaleString('ru-RU')} км
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mb-0.5">
                        <MapPin size={9} className="inline mr-0.5" />Локация
                      </p>
                      <p className="text-[12px] font-semibold text-slate-700">—</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mb-0.5">
                        <User size={9} className="inline mr-0.5" />Водитель
                      </p>
                      <p className="text-[12px] font-semibold text-slate-700">{driverName}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mb-0.5">Балансовая</p>
                      <p className="text-[12px] font-semibold text-slate-700 font-mono tabular-nums">
                        {fmt(bookValue)} ₽
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </MainLayout>
  )
}
