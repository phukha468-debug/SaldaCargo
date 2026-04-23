'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useTrip } from '@/lib/hooks/useTrip'

const PAYMENT_LABELS: Record<string, string> = {
  cash: '💵 Нал',
  qr: '📱 QR',
  bank_invoice: '🏦 Счёт',
  debt_cash: '⏳ Долг',
  card_driver: '💳 Карта',
}

export default function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { trip, orders, expenses, summary, loading, error } = useTrip(id)

  const fmt = (n: number) => n.toLocaleString('ru-RU')

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-slate-400">Загрузка рейса...</p>
    </div>
  )

  if (error) return (
    <div className="p-4">
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        ❌ {error}
      </div>
    </div>
  )

  const tripData = trip as any
  const assets = tripData?.assets
  const assetTypes = assets?.asset_types
  const driver = tripData?.driver
  const loader = tripData?.loader

  return (
    <div className="pb-32">
      {/* Шапка рейса */}
      <div className="bg-slate-800 text-white p-4">
        <div className="flex items-center gap-3 pt-2">
           <button onClick={() => router.push('/')} className="text-white/60">← Назад</button>
        </div>
        <div className="flex items-center gap-2 mt-4 mb-1">
          <span className="text-lg font-bold">
            🚚 {assets?.plate_number}
          </span>
          <span className="text-slate-400 text-sm">
            {assetTypes?.name}
          </span>
        </div>
        <p className="text-slate-400 text-sm">
          {driver?.full_name}
          {loader ? ` + ${loader.full_name}` : ''}
        </p>
      </div>

      {/* Сводка */}
      {summary && (
        <div className="bg-slate-700 text-white px-4 py-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] uppercase text-slate-400 font-bold">Выручка</p>
            <p className="font-bold text-sm">{fmt(summary.totalRevenue)} ₽</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-400 font-bold">ЗП вод.</p>
            <p className="font-bold text-sm">{fmt(summary.totalDriverPay)} ₽</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-400 font-bold">Прибыль</p>
            <p className={`font-bold text-sm ${summary.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {fmt(summary.profit)} ₽
            </p>
          </div>
        </div>
      )}

      {/* Список заказов */}
      <div className="p-4 space-y-3">
        <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">
          Заказы ({orders.length})
        </h2>
        {orders.length === 0 && (
          <p className="text-slate-400 text-sm py-8 text-center bg-white rounded-xl border border-dashed">Нет заказов</p>
        )}
        {orders.map(order => (
          <div key={order.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-slate-400 mr-2">#{order.order_number}</span>
                <span className="font-bold text-slate-800">{order.client_name}</span>
              </div>
              <span className="font-black text-slate-800 font-mono text-sm">{fmt(order.amount)} ₽</span>
            </div>
            <div className="flex justify-between mt-2 pt-2 border-t border-slate-50 text-[11px] text-slate-500">
              <span className="font-medium">
                ЗП: {fmt(order.driver_pay)} ₽
                {order.loader_pay > 0 && ` + ${fmt(order.loader_pay)} ₽`}
                {' '}({order.driver_pay_percent}%)
              </span>
              <span className="font-bold">{PAYMENT_LABELS[order.payment_method] || order.payment_method}</span>
            </div>
          </div>
        ))}

        {/* Расходы */}
        {expenses.length > 0 && (
          <>
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1 pt-4">
              Расходы
            </h2>
            {expenses.map(exp => (
              <div key={exp.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                <div className="flex justify-between">
                  <span className="text-sm font-bold text-slate-700">
                    {exp.categories?.name || exp.description || 'Расход'}
                  </span>
                  <span className="font-black text-red-600 font-mono">−{fmt(exp.amount)} ₽</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Нижние кнопки */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/80 backdrop-blur-lg border-t border-slate-200 p-4 space-y-2 z-50">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => router.push(`/trip/${id}/order/new`)}
            className="py-3 bg-blue-600 text-white font-bold rounded-xl active:scale-95 transition-transform shadow-lg shadow-blue-200"
          >
            ➕ Заказ
          </button>
          <button
            onClick={() => router.push(`/trip/${id}/expense/new`)}
            className="py-3 bg-slate-100 text-slate-700 font-bold rounded-xl active:scale-95 transition-transform"
          >
            💸 Расход
          </button>
        </div>
        <button
          onClick={() => router.push(`/trip/${id}/complete`)}
          className="w-full py-3 bg-green-600 text-white font-bold rounded-xl active:scale-95 transition-transform shadow-lg shadow-green-200"
        >
          🏁 Завершить рейс
        </button>
      </div>
    </div>
  )
}
