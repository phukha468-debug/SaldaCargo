"use client"

import { Button, Card, CardContent, Badge } from "@saldacargo/ui"
import { Clock, Plus, Minus, Landmark, Check } from "lucide-react"

export function ActiveTrip({ trip, onAddOrder, onAddExpense, onFinish }: any) {
  return (
    <div className="flex flex-col min-h-full pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white border-b p-4 flex items-center justify-between shadow-sm">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-primary">РЕЙС #2451</span>
            <Badge variant="success" className="text-[9px] h-4">В ПУТИ</Badge>
          </div>
          <span className="text-xs text-accent-secondary font-medium">Газель Next • A001BC</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-sm font-bold tabular-nums flex items-center gap-1">
            <Clock size={14} className="text-accent-secondary" /> 02:45
          </span>
          <span className="text-[10px] text-accent-secondary">на линии</span>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-6">
        {/* Quick Summary Card */}
        <Card className="bg-navigation text-white border-none shadow-xl">
          <CardContent className="p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center opacity-70 text-xs font-bold uppercase tracking-widest">
              <span>Прибыль рейса</span>
              <span className="bg-white/10 px-2 py-0.5 rounded">LIVE</span>
            </div>
            <div className="text-4xl font-bold tabular-nums font-mono">14 200 ₽</div>
            <div className="h-px bg-white/10 w-full" />
            <div className="flex justify-between text-sm">
               <span className="opacity-70">Выручка: +18 500 ₽</span>
               <span className="text-error font-bold">-4 300 ₽ расходы</span>
            </div>
          </CardContent>
        </Card>

        {/* Orders section */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-bold text-accent-secondary uppercase tracking-widest px-1">Заказы (2)</h3>
          <Card className="border-none shadow-sm flex items-center p-4 justify-between">
            <div className="flex flex-col">
               <span className="font-bold">Петрович (центр)</span>
               <span className="text-xs text-accent-secondary">Наличные • ЗП +800 ₽</span>
            </div>
            <span className="font-bold text-lg">7 500 ₽</span>
          </Card>
          <Card className="border-none shadow-sm flex items-center p-4 justify-between">
            <div className="flex flex-col">
               <span className="font-bold">Эльдорадо</span>
               <span className="text-xs text-accent-secondary">Счёт • ЗП +1 200 ₽</span>
            </div>
            <span className="font-bold text-lg">11 000 ₽</span>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 mt-4">
           <div className="grid grid-cols-2 gap-3">
              <Button onClick={onAddOrder} className="h-14 font-bold gap-2">
                <Plus size={20} /> ЗАКАЗ
              </Button>
              <Button onClick={onAddExpense} variant="secondary" className="h-14 font-bold gap-2 border-l-4 border-l-error">
                <Minus size={20} /> РАСХОД
              </Button>
           </div>
           <Button onClick={onFinish} variant="warning" className="h-14 font-bold gap-2 shadow-lg shadow-warning/20">
             <Check size={20} /> ЗАВЕРШИТЬ РЕЙС
           </Button>
        </div>
      </div>
    </div>
  )
}
