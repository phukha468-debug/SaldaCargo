import { AlertTriangle, CheckCircle } from 'lucide-react'

interface AlertsCardProps {
  draftsCount: number
  toAlertsCount: number
  overdueReceivables: number
  lowLoad: boolean
}

export default function AlertsCard({
  draftsCount, toAlertsCount, overdueReceivables, lowLoad
}: AlertsCardProps) {
  const fmt = (n: number) => n.toLocaleString('ru-RU')

  const alerts: { type: 'warning' | 'error', text: string }[] = []
  if (draftsCount > 0)        alerts.push({ type: 'warning', text: `${draftsCount} смен ждут ревью` })
  if (toAlertsCount > 0)      alerts.push({ type: 'warning', text: `ТО алерт: ${toAlertsCount} машины` })
  if (overdueReceivables > 0) alerts.push({ type: 'error',   text: `Просрочено 30+: ${fmt(overdueReceivables)} ₽` })
  if (lowLoad)                alerts.push({ type: 'warning', text: 'Загрузка парка < 30%' })

  if (alerts.length === 0) {
    return (
      <div className="bg-[#EEF2F8] rounded-xl border border-green-300/70 p-6 shadow-sm h-full flex items-center">
        <div className="flex items-center gap-3 text-green-600">
          <CheckCircle size={20} />
          <span className="font-bold text-[15px]">Всё в порядке</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#EEF2F8] rounded-xl border border-amber-300/70 p-6 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={16} className="text-amber-500" />
        <h3 className="font-bold text-[14px] text-slate-800">Требует внимания</h3>
      </div>
      <div className="flex flex-col gap-3 flex-1 justify-evenly">
        {alerts.map((a, i) => (
          <div key={i} className={`flex items-center gap-3 rounded-xl px-4 py-3.5 ${
            a.type === 'error' ? 'bg-red-50' : 'bg-amber-50'
          }`}>
            <div className={`w-2 h-2 rounded-full shrink-0 ${
              a.type === 'error' ? 'bg-red-500' : 'bg-amber-500'
            }`} />
            <span className={`text-[14px] font-semibold ${
              a.type === 'error' ? 'text-red-700' : 'text-amber-800'
            }`}>{a.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
