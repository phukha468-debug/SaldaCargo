'use client'

import { useState, useEffect, useCallback } from 'react'
import TripReviewCard from './TripReviewCard'

interface DayTotal {
  revenue: number
  driverPay: number
  loaderPay: number
  expenses: number
  profit: number
}

interface ReviewData {
  date: string
  trips: any[]
  dayTotal: DayTotal
}

export default function ReviewPage() {
  const [data, setData] = useState<ReviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/review?date=${date}`)
      if (!res.ok) throw new Error('Ошибка загрузки')
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { load() }, [load])

  const handleApprove = async (tripId: string) => {
    const res = await fetch(`/api/review/${tripId}/approve`, { method: 'POST' })
    const result = await res.json()
    if (!res.ok) throw new Error(result.error || 'Ошибка подтверждения')
  }

  const fmt = (n: number) => n.toLocaleString('ru-RU')

  const dateLabel = new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Заголовок + выбор даты */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">📋 Ревью смены</h1>
          <p className="text-slate-500 text-sm mt-1">{dateLabel}</p>
        </div>
        <input
          type="date"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          value={date}
          onChange={e => setDate(e.target.value)}
        />
      </div>

      {/* Итого за день */}
      {data && data.trips.length > 0 && (
        <div className="bg-slate-800 text-white rounded-xl p-5 grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Выручка', value: fmt(data.dayTotal.revenue) },
            { label: 'ФОТ водит.', value: fmt(data.dayTotal.driverPay) },
            { label: 'ФОТ груз.', value: fmt(data.dayTotal.loaderPay) },
            { label: 'ГСМ+расходы', value: fmt(data.dayTotal.expenses) },
            { label: 'Прибыль', value: fmt(data.dayTotal.profit), highlight: true },
          ].map(item => (
            <div key={item.label} className="text-center">
              <p className="text-slate-400 text-[10px] uppercase font-bold mb-1 tracking-wider">{item.label}</p>
              <p className={`font-black text-xl font-mono ${item.highlight
                ? data.dayTotal.profit >= 0 ? 'text-green-400' : 'text-red-400'
                : 'text-white'
              }`}>
                {item.value} ₽
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Загрузка */}
      {loading && (
        <div className="flex items-center justify-center h-32">
          <p className="text-slate-400">Загрузка рейсов...</p>
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          ❌ {error}
        </div>
      )}

      {/* Пусто */}
      {!loading && !error && data && data.trips.length === 0 && (
        <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-medium">Нет рейсов для ревью за {dateLabel}</p>
          <p className="text-sm mt-1">Все рейсы подтверждены или не было активности</p>
        </div>
      )}

      {/* Список рейсов */}
      <div className="space-y-6">
        {!loading && data && data.trips.map(trip => (
          <TripReviewCard
            key={trip.id}
            trip={trip}
            onApprove={handleApprove}
          />
        ))}
      </div>
    </div>
  )
}
