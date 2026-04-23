"use client"

import React from "react"
import MainLayout from "@/components/layout/MainLayout"
import { Plus, Calendar } from "lucide-react"

const CATEGORY_MAP: Record<string, { label: string; color: string; bg: string }> = {
  revenue:     { label: 'Выручка',    color: 'text-green-700',  bg: 'bg-green-50' },
  fuel:        { label: 'ГСМ',        color: 'text-orange-700', bg: 'bg-orange-50' },
  salary:      { label: 'ЗП',         color: 'text-blue-700',   bg: 'bg-blue-50' },
  maintenance: { label: 'ТО',         color: 'text-red-700',    bg: 'bg-red-50' },
  insurance:   { label: 'Страховка',  color: 'text-purple-700', bg: 'bg-purple-50' },
  tax:         { label: 'Налоги',     color: 'text-slate-700',  bg: 'bg-slate-100' },
  income:      { label: 'Выручка',    color: 'text-green-700',  bg: 'bg-green-50' },
  expense:     { label: 'Расход',     color: 'text-slate-700',  bg: 'bg-slate-100' },
}

function getCategory(tx: any) {
  const cat = tx.category || tx.direction || ''
  return CATEGORY_MAP[cat] || { label: cat || 'Прочее', color: 'text-slate-600', bg: 'bg-slate-50' }
}

export default function TransactionsPage() {
  const [txs, setTxs] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch('/api/transactions')
      .then(res => res.json())
      .then(data => {
        setTxs(Array.isArray(data) ? data : [])
        setLoading(false)
      })
  }, [])

  const income  = txs.filter(t => t.direction === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expense = txs.filter(t => t.direction === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const net = income - expense
  const fmt = (n: number) => n.toLocaleString('ru-RU')

  const monthLabel = new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
    .replace(/^(\S)/, s => s.toUpperCase())

  return (
    <MainLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Транзакции</h1>
            <p className="text-slate-500 text-[13px] mt-0.5">Движение денег по счетам</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-[13px] text-slate-600 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm">
              <Calendar size={14} className="text-slate-400" />
              {monthLabel}
            </div>
            <button className="flex items-center gap-1.5 text-[13px] text-white bg-primary rounded-lg px-3 py-2 shadow-sm hover:bg-primary/90 transition-colors font-medium">
              <Plus size={13} /> Добавить
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-2">Поступления</p>
            <p className="text-2xl font-extrabold text-green-600 font-mono tabular-nums">+{fmt(income)} ₽</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-2">Расходы</p>
            <p className="text-2xl font-extrabold text-red-600 font-mono tabular-nums">-{fmt(expense)} ₽</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-2">Нетто</p>
            <p className={`text-2xl font-extrabold font-mono tabular-nums ${net >= 0 ? 'text-primary' : 'text-red-600'}`}>
              {net >= 0 ? '+' : ''}{fmt(net)} ₽
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center gap-2">
            <span className="text-primary">💳</span>
            <h2 className="font-bold text-[14px] text-slate-800">Последние операции</h2>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left text-[10px] text-slate-400 uppercase font-bold tracking-wide px-5 py-3 w-24">Дата</th>
                <th className="text-left text-[10px] text-slate-400 uppercase font-bold tracking-wide px-4 py-3">Описание</th>
                <th className="text-left text-[10px] text-slate-400 uppercase font-bold tracking-wide px-4 py-3 w-32">Категория</th>
                <th className="text-right text-[10px] text-slate-400 uppercase font-bold tracking-wide px-5 py-3 w-36">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-slate-400 text-sm">Загрузка...</td>
                </tr>
              ) : txs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-slate-400 text-sm">Транзакций не найдено</td>
                </tr>
              ) : (
                txs.map(tx => {
                  const cat = getCategory(tx)
                  const date = new Date(tx.actual_date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
                  return (
                    <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 text-[13px] text-slate-500 font-mono">{date}</td>
                      <td className="px-4 py-3 text-[13px] text-slate-800 font-medium">{tx.description}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${cat.bg} ${cat.color}`}>
                          {cat.label}
                        </span>
                      </td>
                      <td className={`px-5 py-3 text-right font-mono tabular-nums text-[13px] font-bold ${
                        tx.direction === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {tx.direction === 'income' ? '+' : '-'}{fmt(Number(tx.amount))} ₽
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  )
}
