'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface Asset {
  id: string
  plate_number: string
  notes: string
  asset_types: { code: string; name: string }
}

interface User {
  id: string
  full_name: string
  role: string
}

function NewTripForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const driverId = searchParams.get('driver_id') || ''

  const [assets, setAssets] = useState<Asset[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    asset_id: '',
    loader_id: '',
    trip_type: 'local',
    odometer_start: '',
  })

  useEffect(() => {
    const load = async () => {
      try {
        const [assetsRes, usersRes] = await Promise.all([
          fetch('/api/assets'),
          fetch('/api/drivers'),
        ])
        setAssets(await assetsRes.json())
        setUsers(await usersRes.json())
      } catch (err) {
        console.error('[NewTrip] load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSubmit = async () => {
    if (!form.asset_id) {
      setError('Выберите машину')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/trips/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: form.asset_id,
          driver_id: driverId,
          loader_id: form.loader_id || null,
          trip_type: form.trip_type,
          odometer_start: form.odometer_start ? Number(form.odometer_start) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await router.push(`/trip/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setSubmitting(false)
    }
  }

  const loaders = users.filter(u => u.role === 'loader' || u.role === 'driver')

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-slate-400">Загрузка...</p>
    </div>
  )

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 pt-4">
        <button onClick={() => router.back()} className="text-slate-400 text-xl">←</button>
        <h1 className="text-xl font-bold text-slate-800">Начало рейса</h1>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        {/* Машина */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Машина *</label>
          <select
            className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
            value={form.asset_id}
            onChange={e => setForm(f => ({ ...f, asset_id: e.target.value }))}
          >
            <option value="">— Выберите машину —</option>
            {assets.map(a => (
              <option key={a.id} value={a.id}>
                {a.plate_number} — {a.asset_types?.name}
              </option>
            ))}
          </select>
        </div>

        {/* Грузчик */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Грузчик</label>
          <select
            className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
            value={form.loader_id}
            onChange={e => setForm(f => ({ ...f, loader_id: e.target.value }))}
          >
            <option value="">— Без грузчика —</option>
            {loaders.map(u => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </div>

        {/* Тип рейса */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Тип рейса</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'local', label: '🏙 Город' },
              { value: 'intercity', label: '🛣 Межгород' },
              { value: 'moving', label: '📦 Переезд' },
              { value: 'hourly', label: '⏱ Почасовой' },
            ].map(t => (
              <button
                key={t.value}
                onClick={() => setForm(f => ({ ...f, trip_type: t.value }))}
                className={`py-2 px-3 rounded-lg text-sm border transition-colors ${
                  form.trip_type === t.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Одометр */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Одометр начальный (км)
          </label>
          <input
            type="number"
            className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
            placeholder="340000"
            value={form.odometer_start}
            onChange={e => setForm(f => ({ ...f, odometer_start: e.target.value }))}
          />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          ❌ {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || !form.asset_id}
        className="w-full py-4 bg-blue-600 text-white text-lg font-bold rounded-xl
                   disabled:opacity-40 active:bg-blue-700 transition-colors"
      >
        {submitting ? 'Создаём рейс...' : '▶ ПОЕХАЛИ'}
      </button>
    </div>
  )
}

export default function NewTripPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><p className="text-slate-400">Загрузка...</p></div>}>
      <NewTripForm />
    </Suspense>
  )
}
