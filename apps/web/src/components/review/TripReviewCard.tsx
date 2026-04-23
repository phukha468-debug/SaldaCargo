'use client'

import { useState } from 'react'

const PAYMENT_LABELS: Record<string, string> = {
  cash: '💵 Нал',
  qr: '📱 QR',
  bank_invoice: '🏦 Счёт',
  debt_cash: '⏳ Долг',
  card_driver: '💳 Карта',
}

interface Order {
  id: string
  order_number: number
  client_name: string
  amount: number
  driver_pay: number
  loader_pay: number
  driver_pay_percent: number
  payment_method: string
  settlement_status: string
}

interface Expense {
  id: string
  amount: number
  description: string
  categories: { code: string; name: string }
}

interface TripSummary {
  totalRevenue: number
  totalDriverPay: number
  totalLoaderPay: number
  totalExpenses: number
  profit: number
  avgDriverPercent: number
  ordersCount: number
}

interface TripReviewCardProps {
  trip: {
    id: string
    assets: { plate_number: string; asset_types: { name: string } }
    driver: { id: string; full_name: string }
    loader?: { id: string; full_name: string }
    orders: Order[]
    expenses: Expense[]
    summary: TripSummary
  }
  onApprove: (tripId: string) => Promise<void>
}

export default function TripReviewCard({ trip, onApprove }: TripReviewCardProps) {
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fmt = (n: number) => n.toLocaleString('ru-RU')

  const handleApprove = async () => {
    setApproving(true)
    setError(null)
    try {
      await onApprove(trip.id)
      setApproved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setApproving(false)
    }
  }

  if (approved) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 font-medium">
        ✅ {trip.assets.plate_number} — подтверждён
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Заголовок */}
      <div className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center">
        <div>
          <span className="font-bold">🚚 {trip.assets.plate_number}</span>
          <span className="text-slate-400 text-sm ml-2">{trip.assets.asset_types?.name}</span>
        </div>
        <div className="text-sm text-slate-300">
          {trip.driver.full_name}
          {trip.loader && ` + ${trip.loader.full_name}`}
        </div>
      </div>

      {/* Таблица заказов */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2 text-slate-500 font-medium">#</th>
              <th className="text-left px-3 py-2 text-slate-500 font-medium">Клиент</th>
              <th className="text-right px-3 py-2 text-slate-500 font-medium">Сумма</th>
              <th className="text-right px-3 py-2 text-slate-500 font-medium">ЗП вод.</th>
              <th className="text-right px-3 py-2 text-slate-500 font-medium">%</th>
              {trip.loader && (
                <th className="text-right px-3 py-2 text-slate-500 font-medium">ЗП гр.</th>
              )}
              <th className="text-left px-3 py-2 text-slate-500 font-medium">Оплата</th>
            </tr>
          </thead>
          <tbody>
            {trip.orders.map(order => {
              const pct = order.driver_pay_percent
              const isWarning = pct > 40 || (pct > 0 && pct < 25)
              return (
                <tr key={order.id} className={`border-b border-slate-100 ${isWarning ? 'bg-amber-50' : ''}`}>
                  <td className="px-3 py-2 text-slate-400">{order.order_number}</td>
                  <td className="px-3 py-2 text-slate-800">{order.client_name}</td>
                  <td className="px-3 py-2 text-right font-medium font-mono">{fmt(order.amount)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(order.driver_pay)}</td>
                  <td className={`px-3 py-2 text-right font-medium font-mono ${isWarning ? 'text-amber-600' : 'text-slate-600'}`}>
                    {isWarning ? '⚠️ ' : ''}{pct}%
                  </td>
                  {trip.loader && (
                    <td className="px-3 py-2 text-right font-mono">{fmt(order.loader_pay || 0)}</td>
                  )}
                  <td className="px-3 py-2 text-slate-500 text-xs">
                    {PAYMENT_LABELS[order.payment_method] || order.payment_method}
                    {order.settlement_status === 'pending' && ' ⏳'}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-semibold border-t-2 border-slate-200">
              <td className="px-3 py-2 text-slate-500" colSpan={2}>Итого</td>
              <td className="px-3 py-2 text-right font-mono">{fmt(trip.summary.totalRevenue)}</td>
              <td className="px-3 py-2 text-right font-mono">{fmt(trip.summary.totalDriverPay)}</td>
              <td className="px-3 py-2 text-right text-slate-500 font-mono">{trip.summary.avgDriverPercent}%</td>
              {trip.loader && (
                <td className="px-3 py-2 text-right font-mono">{fmt(trip.summary.totalLoaderPay)}</td>
              )}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Расходы */}
      {trip.expenses.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-100 flex flex-wrap gap-3">
          {trip.expenses.map(exp => (
            <span key={exp.id} className="text-sm text-slate-500">
              {exp.categories?.name || 'Расход'}: <span className="text-red-600 font-medium font-mono">−{fmt(exp.amount)} ₽</span>
            </span>
          ))}
        </div>
      )}

      {/* Итоговая строка */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
        <div className="text-sm text-slate-600 space-x-4">
          <span>ГСМ и расходы: <strong className="font-mono">{fmt(trip.summary.totalExpenses)} ₽</strong></span>
          <span>Прибыль: <strong className={`font-mono ${trip.summary.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {fmt(trip.summary.profit)} ₽
          </strong></span>
        </div>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-700 text-sm">
          ❌ {error}
        </div>
      )}

      {/* Кнопки */}
      <div className="px-4 py-3 border-t border-slate-200 flex gap-2">
        <button
          onClick={handleApprove}
          disabled={approving}
          className="flex-1 py-2 bg-green-600 text-white font-semibold rounded-lg
                     hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
        >
          {approving ? 'Подтверждаем...' : '✅ Подтвердить'}
        </button>
      </div>
    </div>
  )
}
