"use client"

import React from "react"
import { Button, Card, CardContent, Badge, Skeleton } from "@saldacargo/ui"
import { Play, ClipboardList, Wallet, Truck } from "lucide-react"

export function DriverHome({ onStartTrip }: { onStartTrip: () => void }) {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    // В реальности здесь был бы запрос к API для конкретного водителя
    // Для демо используем данные, похожие на те, что в скриншотах
    setTimeout(() => {
      setData({
        driverName: "Александр",
        balance: 42500,
        tripsCount: 18,
        lastTrip: {
          date: "22 апреля, Ср",
          vehicle: "Валдай 096",
          revenue: 12500,
          status: "approved"
        }
      })
      setLoading(false)
    }, 1000)
  }, [])

  if (loading) return <div className="p-4 space-y-6"><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /></div>

  return (
    <div className="flex flex-col gap-6 p-4 pb-24">
      <header className="flex flex-col gap-1 py-4">
        <h1 className="text-2xl font-black tracking-tight text-slate-800">Привет, {data.driverName}! 👋</h1>
        <p className="text-slate-500 text-sm font-medium">Сегодня хороший день для работы.</p>
      </header>

      {/* Main Action */}
      <Button 
        className="h-20 text-xl font-black gap-3 rounded-2xl shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 transition-transform active:scale-95"
        onClick={onStartTrip}
      >
        <Play fill="currentColor" size={24} /> НАЧАТЬ РЕЙС
      </Button>

      {/* Stats Quick View */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-white border-none shadow-md rounded-2xl">
          <CardContent className="p-5 flex flex-col gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <Wallet className="text-green-600 h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Мой Баланс</span>
              <span className="text-xl font-black tabular-nums text-slate-800 font-mono">
                {data.balance.toLocaleString()} ₽
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-none shadow-md rounded-2xl">
          <CardContent className="p-5 flex flex-col gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <ClipboardList className="text-primary h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Рейсов (апр)</span>
              <span className="text-xl font-black tabular-nums text-slate-800 font-mono">
                {data.tripsCount}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Last Trip */}
      <div className="flex flex-col gap-4">
        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Последний рейс</h3>
        <Card className="border-none shadow-md rounded-2xl bg-white p-4 flex items-center justify-between">
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
               <Truck size={24} />
             </div>
             <div className="flex flex-col">
               <span className="font-black text-sm text-slate-800">{data.lastTrip.date}</span>
               <span className="text-xs font-bold text-slate-400">{data.lastTrip.vehicle}</span>
             </div>
           </div>
           <div className="flex flex-col items-end gap-1">
             <span className="font-black text-green-600 font-mono">+{data.lastTrip.revenue.toLocaleString()} ₽</span>
             <Badge className="text-[9px] font-black uppercase bg-green-100 text-green-700 border-none px-2 h-5">
               {data.lastTrip.status === 'approved' ? 'Одобрено' : 'В обработке'}
             </Badge>
           </div>
        </Card>
      </div>

      {/* Motivation/Tips */}
      <div className="mt-4 p-5 bg-slate-800 rounded-3xl text-white relative overflow-hidden">
        <div className="relative z-10">
          <h4 className="font-black text-lg mb-1">Бонусы за неделю</h4>
          <p className="text-slate-400 text-xs font-bold">Выполни еще 2 рейса без опозданий и получи +2000 ₽ к выплате.</p>
        </div>
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-primary/20 rounded-full blur-2xl" />
      </div>
    </div>
  )
}
