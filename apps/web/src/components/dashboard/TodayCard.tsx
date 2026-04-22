interface TodayCardProps {
  date: string
  income: number
  expense: number
  profit: number
  onLine: number
  totalActive: number
  loadPercent: number
}

export default function TodayCard({
  date, income, expense, profit, onLine, totalActive, loadPercent
}: TodayCardProps) {
  const fmt = (n: number) => n.toLocaleString('ru-RU')
  const dateStr = new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long'
  })

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h3 className="font-semibold text-slate-700 mb-4">📅 Сегодня ({dateStr})</h3>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-xs text-slate-400 mb-1 uppercase font-bold">Выручка</p>
          <p className="font-bold text-slate-800">{fmt(income)} ₽</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1 uppercase font-bold">Прибыль</p>
          <p className={`font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {profit >= 0 ? '+' : ''}{fmt(profit)} ₽
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <span className="text-sm text-slate-500 font-medium">Машин на линии</span>
        <span className={`text-sm font-bold ${
          loadPercent < 30 ? 'text-red-600' : loadPercent < 60 ? 'text-amber-600' : 'text-green-600'
        }`}>
          {onLine}/{totalActive} ({loadPercent}%)
        </span>
      </div>
    </div>
  )
}
