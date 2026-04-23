'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Driver {
  id: string
  full_name: string
  role: string
}

export default function DriverHome() {
  const router = useRouter()
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [selectedDriver, setSelectedDriver] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/drivers')
        const data = await res.json()
        setDrivers(data.filter((d: Driver) => d.role === 'driver'))
      } catch (err) {
        console.error('[DriverHome] load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleStart = () => {
    if (!selectedDriver) return
    router.push(`/trip/new?driver_id=${selectedDriver}`)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-slate-400">Загрузка...</p>
    </div>
  )

  return (
    <div className="p-4 space-y-6">
      {/* Шапка */}
      <div className="pt-6 pb-2">
        <h1 className="text-2xl font-bold text-slate-800 text-center italic">SC</h1>
        <h2 className="text-xl font-bold text-slate-800 text-center">SaldaCargo</h2>
        <p className="text-slate-500 text-sm mt-1 text-center">Путевые листы</p>
      </div>

      {/* Выбор водителя */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          Кто вы?
        </label>
        <select
          className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
          value={selectedDriver}
          onChange={e => setSelectedDriver(e.target.value)}
        >
          <option value="">— Выберите водителя —</option>
          {drivers.map(d => (
            <option key={d.id} value={d.id}>{d.full_name}</option>
          ))}
        </select>
      </div>

      {/* Кнопка начать рейс */}
      <button
        onClick={handleStart}
        disabled={!selectedDriver}
        className="w-full py-4 bg-blue-600 text-white text-lg font-bold rounded-xl
                   disabled:opacity-40 disabled:cursor-not-allowed
                   active:bg-blue-700 transition-colors"
      >
        🚚 Начать рейс
      </button>
    </div>
  )
}
