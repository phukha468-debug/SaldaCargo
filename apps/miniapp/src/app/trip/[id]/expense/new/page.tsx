'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'

const EXPENSE_CATEGORIES = [
  { code: 'FUEL', label: '⛽ ГСМ' },
  { code: 'PARKING_EXPENSE', label: '🅿️ Стоянка' },
  { code: 'WASH', label: '🚿 Мойка' },
  { code: 'TOLL_ROAD', label: '🛣 Платная дорога' },
  { code: 'REPAIR_PARTS', label: '🔧 Ремонт' },
  { code: 'OTHER_EXPENSE', label: '📋 Прочее' },
]

export default function NewExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = use(params)
  const router = useRouter()

  const [form, setForm] = useState({
    category_code: 'FUEL',
    amount: '',
    payment_method: 'cash',
    description: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!form.amount) {
      setError('Введите сумму')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/trips/${tripId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_code: form.category_code,
          amount: Number(form.amount),
          payment_method: form.payment_method,
          description: form.description || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await router.push(`/trip/${tripId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 pt-4">
        <button onClick={() => router.back()} className="text-slate-400 text-xl">←</button>
        <h1 className="text-xl font-bold text-slate-800">Расход</h1>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 shadow-sm">
        {/* Категория */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Категория</label>
          <div className="grid grid-cols-2 gap-2">
            {EXPENSE_CATEGORIES.map(c => (
              <button
                key={c.code}
                onClick={() => setForm(f => ({ ...f, category_code: c.code }))}
                className={`py-3 px-3 rounded-lg text-sm border text-left transition-colors font-bold ${
                  form.category_code === c.code
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Сумма */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Сумма *</label>
          <input
            type="number"
            className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base font-mono"
            placeholder="1000"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          />
        </div>

        {/* Оплата */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Оплата</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'cash', label: '💵 Нал' },
              { value: 'card_driver', label: '💳 Карта' },
              { value: 'fuel_card', label: '⛽ Опти24' },
            ].map(m => (
              <button
                key={m.value}
                onClick={() => setForm(f => ({ ...f, payment_method: m.value }))}
                className={`py-2 rounded-lg text-sm border transition-colors font-bold ${
                  form.payment_method === m.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Заметка */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Заметка</label>
          <input
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Необязательно"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
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
        disabled={submitting || !form.amount}
        className="w-full py-4 bg-blue-600 text-white text-lg font-bold rounded-xl
                   disabled:opacity-40 active:bg-blue-700 transition-colors shadow-lg"
      >
        {submitting ? 'Сохраняем...' : '✅ ДОБАВИТЬ'}
      </button>
    </div>
  )
}
