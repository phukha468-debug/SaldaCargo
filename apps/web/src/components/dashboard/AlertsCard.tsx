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
  const alerts: string[] = []

  if (draftsCount > 0) alerts.push(`${draftsCount} смен ждут ревью`)
  if (toAlertsCount > 0) alerts.push(`${toAlertsCount} алертов ТО`)
  if (overdueReceivables > 0) alerts.push(`Просрочено 30+: ${fmt(overdueReceivables)} ₽`)
  if (lowLoad) alerts.push('Загрузка парка < 30% ⚠️')

  if (alerts.length === 0) return (
    <div className="bg-white rounded-xl border border-green-200 p-5 shadow-sm">
      <h3 className="font-semibold text-slate-700 mb-2">✅ Требует внимания</h3>
      <p className="text-sm text-green-600">Всё в порядке</p>
    </div>
  )

  return (
    <div className="bg-white rounded-xl border border-amber-200 p-5 shadow-sm">
      <h3 className="font-semibold text-slate-700 mb-3">⚠️ Требует внимания</h3>
      <ul className="space-y-2">
        {alerts.map((a, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
            <span className="mt-0.5">•</span>
            <span className="font-medium">{a}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
