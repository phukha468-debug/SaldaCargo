'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTrip } from '@/lib/hooks/useTrip'

export default function CompleteTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { summary, loading } = useTrip(id)

  const [odometerEnd, setOdometerEnd] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fmt = (n: number) => n.toLocaleString('ru-RU')

  const handleComplete = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/trips/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          odometer_end: odometerEnd ? Number(odometerEnd) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-slate-400">Загрузка...</p>
    </div>
  )

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 pt-4">
        <button onClick={() => router.back()} className="text-slate-400 text-xl">←</button>
        <h1 className="text-xl font-bold text-slate-800">Завершение рейса</h1>
      </div>

      {/* Итоги */}
      {summary && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-sm">
          <h2 className="font-bold text-slate-800 uppercase text-[11px] tracking-widest border-b pb-2">Итоги рейса</h2>
          <div className="space-y-2 text-sm pt-1">
            {[
              { label: 'Заказов', value: String(summary.ordersCount) },
              { label: 'Выручка', value: `${fmt(summary.totalRevenue)} ₽` },
              { label: 'ЗП водителя', value: `${fmt(summary.totalDriverPay)} ₽` },
              { label: 'ЗП грузчика', value: `${fmt(summary.totalLoaderPay)} ₽` },
              { label: 'Расходы', value: `${fmt(summary.totalExpenses)} ₽` },
            ].map(row => (
              <div key={row.label} className="flex justify-between">
                <span className="text-slate-500 font-medium">{row.label}</span>
                <span className="font-bold text-slate-800 font-mono">{row.value}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3 border-t border-slate-100 mt-2">
              <span className="font-black text-slate-700 uppercase text-[10px]">Прибыль фирмы</span>
              <span className={`font-black text-xl font-mono ${summary.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmt(summary.profit)} ₽
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Одометр */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <label className="block text-sm font-bold text-slate-700 mb-2">
          Одометр конечный (км)
        </label>
        <input
          type="number"
          className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base font-mono"
          placeholder="340060"
          value={odometerEnd}
          onChange={e => setOdometerEnd(e.target.value)}
        />
      </div>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs font-bold leading-relaxed">
        ⚠️ После отправки рейс уйдёт на ревью администратору. Редактирование будет недоступно.
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          ❌ {error}
        </div>
      )}

      <button
        onClick={handleComplete}
        disabled={submitting}
        className="w-full py-4 bg-green-600 text-white text-lg font-black rounded-2xl
                   disabled:opacity-40 active:scale-95 transition-transform shadow-xl shadow-green-200 mt-4"
      >
        {submitting ? 'Отправляем...' : '📤 ОТПРАВИТЬ НА РЕВЬЮ'}
      </button>
    </div>
  )
}
