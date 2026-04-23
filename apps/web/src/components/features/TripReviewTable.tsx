"use client"

import React from "react"
import { ClipboardCheck, Truck, User, CircleCheck } from "lucide-react"
import { toast } from "sonner"

export function TripReviewTable() {
  const [trips, setTrips] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  const fetchTrips = React.useCallback(async () => {
    try {
      const res = await fetch("/api/trips/summary")
      const json = await res.json()
      if (json.success) setTrips(json.data)
    } catch {
      toast.error("Не удалось загрузить рейсы")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { fetchTrips() }, [fetchTrips])

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/trips/${id}/approve`, { method: "POST" })
      if (res.ok) {
        toast.success("Рейс одобрен")
        fetchTrips()
      } else {
        toast.error("Ошибка при одобрении")
      }
    } catch {
      toast.error("Ошибка сети")
    }
  }

  const fmt = (n: number) => n.toLocaleString('ru-RU')

  const drafts = trips.filter(t => t.status === 'draft' || t.lifecycle_status === 'draft')

  const totals = trips.reduce((acc, t) => ({
    revenue:   acc.revenue   + Number(t.revenue || 0),
    staffPay:  acc.staffPay  + Number(t.staff_pay || 0),
    expenses:  acc.expenses  + Number(t.expenses_total || 0),
    profit:    acc.profit    + (Number(t.revenue || 0) - Number(t.staff_pay || 0) - Number(t.expenses_total || 0)),
  }), { revenue: 0, staffPay: 0, expenses: 0, profit: 0 })

  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm animate-pulse h-64" />
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={16} className="text-primary" />
          <h2 className="font-bold text-[14px] text-slate-800">Рейсы за сегодня</h2>
        </div>
        <div className="flex items-center gap-3 text-[12px]">
          {drafts.length > 0 && (
            <span className="font-bold text-amber-600 uppercase tracking-wide">
              Черновиков: {drafts.length}
            </span>
          )}
          <span className="text-slate-400 uppercase tracking-wide font-bold">
            Всего: {trips.length}
          </span>
        </div>
      </div>

      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/60">
            <th className="text-left text-[10px] text-slate-400 uppercase font-bold tracking-wide px-5 py-3 w-48">Машина / Водитель</th>
            <th className="text-left text-[10px] text-slate-400 uppercase font-bold tracking-wide px-4 py-3 w-24">Заказы</th>
            <th className="text-left text-[10px] text-slate-400 uppercase font-bold tracking-wide px-4 py-3">Выручка</th>
            <th className="text-left text-[10px] text-slate-400 uppercase font-bold tracking-wide px-4 py-3">ЗП / Расходы</th>
            <th className="text-left text-[10px] text-slate-400 uppercase font-bold tracking-wide px-4 py-3">Прибыль</th>
            <th className="text-right text-[10px] text-slate-400 uppercase font-bold tracking-wide px-5 py-3">Статус</th>
          </tr>
        </thead>
        <tbody>
          {trips.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                За сегодня рейсов не найдено
              </td>
            </tr>
          ) : (
            trips.map(trip => {
              const revenue = Number(trip.revenue || 0)
              const staffPay = Number(trip.staff_pay || 0)
              const expenses = Number(trip.expenses_total || 0)
              const profit = revenue - staffPay - expenses
              const isDraft = trip.status === 'draft' || trip.lifecycle_status === 'draft'
              const isApproved = trip.status === 'approved' || trip.lifecycle_status === 'approved'

              return (
                <tr key={trip.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 font-bold text-[13px] text-slate-800 uppercase tracking-tight">
                        <Truck size={12} className="text-slate-400" />
                        {trip.vehicle?.plate_number || '—'}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <User size={10} />
                        {trip.driver?.full_name || 'Неизвестен'}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-bold text-[13px] text-slate-800">{trip.order_count}</span>
                    <span className="text-[10px] text-slate-400 uppercase ml-1">заказа</span>
                  </td>
                  <td className="px-4 py-3.5 font-mono tabular-nums font-bold text-[13px] text-slate-800">
                    {fmt(revenue)} ₽
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col gap-0.5 text-[12px] font-mono tabular-nums">
                      <span className="text-red-600 font-bold italic">ЗП: -{fmt(staffPay)} ₽</span>
                      <span className="text-slate-400">ГСМ: -{fmt(expenses)} ₽</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`font-bold text-[14px] font-mono tabular-nums ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {profit >= 0 ? '+' : ''}{fmt(profit)} ₽
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded ${
                        isApproved
                          ? 'text-green-700 bg-green-50'
                          : 'text-amber-700 bg-amber-50'
                      }`}>
                        {isApproved ? 'Одобрен' : 'Черновик'}
                      </span>
                      {isDraft && (
                        <button
                          onClick={() => handleApprove(trip.id)}
                          className="flex items-center gap-1.5 text-[12px] text-white bg-green-500 hover:bg-green-600 rounded-lg px-3 py-1.5 font-medium transition-colors"
                        >
                          <CircleCheck size={13} /> Подтвердить
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
        {trips.length > 0 && (
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200">
              <td className="px-5 py-3" colSpan={2}>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Итого выручка</span>
                <p className="font-extrabold text-[13px] text-slate-800 font-mono tabular-nums">{fmt(totals.revenue)} ₽</p>
              </td>
              <td className="px-4 py-3">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Итого ЗП</span>
                <p className="font-extrabold text-[13px] text-slate-800 font-mono tabular-nums">{fmt(totals.staffPay)} ₽</p>
              </td>
              <td className="px-4 py-3">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Итого ГСМ</span>
                <p className="font-extrabold text-[13px] text-slate-800 font-mono tabular-nums">{fmt(totals.expenses)} ₽</p>
              </td>
              <td className="px-4 py-3" colSpan={2}>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Итого прибыль</span>
                <p className={`font-extrabold text-[13px] font-mono tabular-nums ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totals.profit >= 0 ? '+' : ''}{fmt(totals.profit)} ₽
                </p>
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
