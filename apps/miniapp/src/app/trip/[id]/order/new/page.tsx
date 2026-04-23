'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'

const PAYMENT_METHODS = [
  { value: 'cash', label: '💵 Нал' },
  { value: 'qr', label: '📱 QR' },
  { value: 'bank_invoice', label: '🏦 Счёт' },
  { value: 'debt_cash', label: '⏳ Долг' },
  { value: 'card_driver', label: '💳 Карта' },
]

export default function NewOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = use(params)
  const router = useRouter()

  const [form, setForm] = useState({
    client_name: '',
    amount: '',
    driver_pay: '',
    loader_pay: '',
    payment_method: 'cash',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Подсказка 30%
  const hint = form.amount
    ? Math.round(Number(form.amount) * 0.3)
    : null

  const handleSubmit = async () => {
    if (!form.amount) {
      setError('Введите сумму')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/trips/${tripId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: form.client_name || 'б/н',
          amount: Number(form.amount),
          driver_pay: Number(form.driver_pay) || 0,
          loader_pay: Number(form.loader_pay) || 0,
          payment_method: form.payment_method,
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
        <h1 className="text-xl font-bold text-slate-800">Новый заказ</h1>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        {/* Клиент */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Клиент</label>
          <input
            className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
            placeholder="Левша, Интерьер, б/н..."
            value={form.client_name}
            onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
          />
        </div>

        {/* Сумма */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Сумма заказа *</label>
          <input
            type="number"
            className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
            placeholder="2700"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          />
        </div>

        {/* ЗП водителя */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            ЗП водителя
            {hint && <span className="text-slate-400 font-normal"> (подсказка: ~{hint.toLocaleString('ru-RU')} ₽ / 30%)</span>}
          </label>
          <input
            type="number"
            className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
            placeholder={hint ? String(hint) : '0'}
            value={form.driver_pay}
            onChange={e => setForm(f => ({ ...f, driver_pay: e.target.value }))}
          />
        </div>

        {/* ЗП грузчика */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            ЗП грузчика
          </label>
          <input
            type="number"
            className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
            placeholder="0"
            value={form.loader_pay}
            onChange={e => setForm(f => ({ ...f, loader_pay: e.target.value }))}
          />
        </div>

        {/* Способ оплаты */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Оплата</label>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map(m => (
              <button
                key={m.value}
                onClick={() => setForm(f => ({ ...f, payment_method: m.value }))}
                className={`py-2 px-2 rounded-lg text-sm border transition-colors ${
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
