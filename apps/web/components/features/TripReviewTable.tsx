"use client"

import React from "react"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow,
  Badge,
  Button,
  Skeleton
} from "@saldacargo/ui"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { Check, ClipboardCheck, Truck, User, ArrowRight } from "lucide-react"
import { toast } from "sonner"

export function TripReviewTable() {
  const [trips, setTrips] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  const fetchTrips = React.useCallback(async () => {
    try {
      const res = await fetch("/api/trips/summary")
      const json = await res.json()
      if (json.success) setTrips(json.data)
    } catch (error) {
      toast.error("Не удалось загрузить рейсы")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchTrips()
  }, [fetchTrips])

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/trips/${id}/approve`, { method: "POST" })
      if (res.ok) {
        toast.success("Рейс успешно одобрен")
        fetchTrips()
      } else {
        toast.error("Ошибка при одобрении")
      }
    } catch {
      toast.error("Ошибка сети")
    }
  }

  if (loading) return <Skeleton className="w-full h-[400px]" />

  return (
    <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] overflow-hidden">
      <div className="p-6 border-b flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ClipboardCheck className="text-primary" /> Ревью рейсов за сегодня
        </h2>
        <div className="flex gap-2">
          <Badge variant="outline" className="h-6">Черновиков: {trips.filter(t => t.status === 'draft').length}</Badge>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="bg-workspace/30">
            <TableHead className="w-[200px]">Машина / Водитель</TableHead>
            <TableHead>Заказы</TableHead>
            <TableHead>Выручка</TableHead>
            <TableHead>ЗП / Расходы</TableHead>
            <TableHead>Прибыль</TableHead>
            <TableHead className="text-right">Статус</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trips.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-10 text-accent-secondary">
                За сегодня рейсов не найдено
              </TableCell>
            </TableRow>
          ) : (
            trips.map((trip) => (
              <TableRow 
                key={trip.id}
                className={cn(
                  "border-l-4 transition-all",
                  trip.status === 'approved' ? "border-l-success" : "border-l-warning"
                )}
              >
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 font-bold uppercase tracking-tight">
                      <Truck size={14} className="text-accent-secondary" /> {trip.vehicle?.plate}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-accent-secondary">
                      <User size={12} /> {trip.driver?.display_name || "Неизвестен"}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 font-bold">
                    {trip.order_count} <span className="text-[10px] font-normal text-accent-secondary uppercase">заказа</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono tabular-nums font-bold">
                  {Number(trip.revenue).toLocaleString()} ₽
                </TableCell>
                <TableCell>
                  <div className="flex flex-col text-xs">
                    <span className="text-error font-bold italic">ЗП: -{Number(trip.staff_pay).toLocaleString()} ₽</span>
                    <span className="text-accent-secondary">ГСМ/Прочее: -{Number(trip.expenses_total).toLocaleString()} ₽</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className={cn(
                    "text-lg font-bold tabular-nums font-mono px-2 py-1 rounded inline-block",
                    trip.profit >= 0 ? "text-success bg-success/5" : "text-error bg-error/5"
                  )}>
                    {trip.profit >= 0 ? "+" : ""}{Number(trip.profit).toLocaleString()} ₽
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Badge variant={trip.status === 'approved' ? 'success' : 'warning'} className="uppercase text-[10px]">
                      {trip.status === 'approved' ? 'Одобрен' : 'Черновик'}
                    </Badge>
                    {trip.status === 'draft' && (
                      <Button 
                        size="sm" 
                        onClick={() => handleApprove(trip.id)}
                        className="bg-success hover:bg-success/90 h-9 px-3 gap-1 shadow-sm transition-transform active:scale-95"
                      >
                        <Check size={14} /> Подтвердить
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ")
}
