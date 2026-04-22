"use client"

import { Button, Card, CardContent, Badge } from "@saldacargo/ui"
import { Play, ClipboardList, Wallet, Settings } from "lucide-react"

export function DriverHome({ onStartTrip }: { onStartTrip: () => void }) {
  return (
    <div className="flex flex-col gap-6 p-4 pb-20">
      <header className="flex flex-col gap-1 py-4">
        <h1 className="text-2xl font-bold">Привет, Водитель! 👋</h1>
        <p className="text-accent-secondary">Сегодня хороший день для работы.</p>
      </header>

      {/* Main Action */}
      <Button 
        className="h-20 text-xl font-bold gap-3 rounded-2xl shadow-lg shadow-primary/20"
        onClick={onStartTrip}
      >
        <Play fill="currentColor" size={24} /> НАЧАТЬ РЕЙС
      </Button>

      {/* Stats Quick View */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-white border-none shadow-sm">
          <CardContent className="p-4 flex flex-col gap-2">
            <Wallet className="text-success h-5 w-5" />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-accent-secondary uppercase">Баланс</span>
              <span className="text-lg font-bold tabular-nums">42 500 ₽</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-none shadow-sm">
          <CardContent className="p-4 flex flex-col gap-2">
            <ClipboardList className="text-primary h-5 w-5" />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-accent-secondary uppercase">Рейсы (апр)</span>
              <span className="text-lg font-bold tabular-nums">18</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-bold text-accent-secondary uppercase tracking-widest px-1">Последние рейсы</h3>
        <Card className="border-none shadow-sm h-16 flex items-center px-4 justify-between">
           <div className="flex flex-col">
             <span className="font-bold text-sm">21 апреля, Вт</span>
             <span className="text-xs text-accent-secondary">Газель A001BC • 4 заказа</span>
           </div>
           <div className="flex flex-col items-end">
             <span className="font-bold text-success">+3 200 ₽</span>
             <Badge variant="success" className="text-[9px] h-4">ОДОБРЕНО</Badge>
           </div>
        </Card>
      </div>
    </div>
  )
}
