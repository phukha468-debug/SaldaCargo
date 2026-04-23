"use client"

import React from "react"
import MainLayout from "@/components/layout/MainLayout"
import { Calendar, Download, Users } from "lucide-react"

const MOCK_PAYROLL = [
  { id: 1, name: "Иванов Сергей Вячеславович",  plate: "А001ВС", trips: 22, revenue: 387500, rate: 31, accrued: 120125, paid:  80000 },
  { id: 2, name: "Петров Алексей Николаевич",    plate: "Е777ЕХ", trips: 18, revenue: 298400, rate: 31, accrued:  92504, paid:  92504 },
  { id: 3, name: "Козлов Роман Александрович",   plate: "Т222КМ", trips: 15, revenue: 241200, rate: 28, accrued:  67536, paid:  40000 },
  { id: 4, name: "Морозов Дмитрий Владимирович", plate: "О888РС", trips: 20, revenue: 334700, rate: 31, accrued: 103757, paid:  60000 },
  { id: 5, name: "Орлов Игорь Петрович",         plate: "К444НС", trips: 12, revenue: 187300, rate: 28, accrued:  52444, paid:  52444 },
]

export default function PayrollPage() {
  const monthLabel = new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
    .replace(/^(\S)/, s => s.toUpperCase())

  const totalAccrued = MOCK_PAYROLL.reduce((s, r) => s + r.accrued, 0)
  const totalPaid    = MOCK_PAYROLL.reduce((s, r) => s + r.paid, 0)
  const totalDue     = totalAccrued - totalPaid
  const fmt = (n: number) => n.toLocaleString('ru-RU')

  return (
    <MainLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Зарплаты</h1>
            <p className="text-slate-500 text-[13px] mt-0.5">Расчёт выплат водителям — {monthLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-[13px] text-slate-600 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm">
              <Calendar size={14} className="text-slate-400" />
              {monthLabel}
            </div>
            <button className="flex items-center gap-1.5 text-[13px] text-white bg-primary rounded-lg px-3 py-2 shadow-sm hover:bg-primary/90 transition-colors font-medium">
              <Download size={13} /> Выгрузить
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-2">Начислено</p>
            <p className="text-2xl font-extrabold text-slate-800 font-mono tabular-nums">{fmt(totalAccrued)} ₽</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-2">Выплачено</p>
            <p className="text-2xl font-extrabold text-green-600 font-mono tabular-nums">{fmt(totalPaid)} ₽</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-2">К выплате</p>
            <p className="text-2xl font-extrabold text-amber-600 font-mono tabular-nums">{fmt(totalDue)} ₽</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center gap-2">
            <Users size={15} className="text-primary" />
            <h2 className="font-bold text-[14px] text-slate-800">Расчётный лист водителей</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                {['Водитель', 'Авто', 'Рейсов', 'Выручка', 'Ставка', 'Начислено', 'Выплачено', 'К выплате'].map(h => (
                  <th key={h} className="text-left text-[10px] text-slate-400 uppercase font-bold tracking-wide px-4 py-3 first:px-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_PAYROLL.map(row => {
                const due = row.accrued - row.paid
                const fullPaid = due <= 0
                return (
                  <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-[13px] text-slate-800">{row.name}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-[12px] font-bold text-primary font-mono">{row.plate}</span>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-[14px] text-slate-800">{row.trips}</td>
                    <td className="px-4 py-3.5 font-mono tabular-nums text-[13px] text-slate-700">{fmt(row.revenue)} ₽</td>
                    <td className="px-4 py-3.5">
                      <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">{row.rate}%</span>
                    </td>
                    <td className="px-4 py-3.5 font-mono tabular-nums text-[13px] text-slate-800 font-bold">{fmt(row.accrued)} ₽</td>
                    <td className="px-4 py-3.5 font-mono tabular-nums text-[13px] text-green-600 font-bold">{fmt(row.paid)} ₽</td>
                    <td className="px-4 py-3.5 font-mono tabular-nums text-[13px] font-bold">
                      {fullPaid ? (
                        <span className="text-green-600">ВЫПЛАЧЕНО</span>
                      ) : (
                        <span className="text-amber-600">{fmt(due)} ₽</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  )
}
