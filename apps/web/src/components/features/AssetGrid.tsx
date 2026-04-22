"use client"

import { Card, CardContent, Badge } from "@saldacargo/ui"
import { Truck, MapPin, Gauge } from "lucide-react"

const mockAssets = [
  { id: "1", plate: "A001BC", model: "Газель Next", type: "gazelle", status: "in_trip", odometer: 125400 },
  { id: "2", plate: "E777EX", model: "Валдай 8", type: "valday", status: "available", odometer: 45200 },
  { id: "3", plate: "M555YM", model: "Mitsubishi Fuso", type: "mitsubishi", status: "service", odometer: 210800 },
];

export function AssetGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
      {mockAssets.map((asset) => (
        <Card key={asset.id} className="overflow-hidden hover:border-primary transition-colors cursor-pointer">
          <div className="bg-workspace p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded shadow-sm">
                <Truck className="h-5 w-5 text-navigation" />
              </div>
              <div>
                <div className="font-bold uppercase tracking-tight">{asset.plate}</div>
                <div className="text-xs text-accent-secondary">{asset.model}</div>
              </div>
            </div>
            <Badge variant={asset.status === 'in_trip' ? 'success' : asset.status === 'service' ? 'destructive' : 'secondary'}>
              {asset.status === 'in_trip' ? 'В ПУТИ' : asset.status === 'service' ? 'ТО' : 'ГОТОВ'}
            </Badge>
          </div>
          <CardContent className="p-4 grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <div className="text-[10px] uppercase font-bold text-accent-secondary flex items-center gap-1">
                <Gauge size={12} /> Пробег
              </div>
              <div className="font-mono font-bold tabular-nums">{asset.odometer.toLocaleString()} км</div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-[10px] uppercase font-bold text-accent-secondary flex items-center gap-1">
                 <MapPin size={12} /> Локация
              </div>
              <div className="text-sm font-medium truncate">Нижний Новгород</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
