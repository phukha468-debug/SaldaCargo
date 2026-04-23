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
  const dateStr = new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })

  const loadColor =
    loadPercent < 30 ? 'text-red-600' :
    loadPercent < 60 ? 'text-amber-600' : 'text-green-600'

  return (
    <div className="bg-[#EEF2F8] rounded-xl border border-slate-300/70 p-6 shadow-sm h-full flex flex-col justify-between">
      <h3 className="font-bold text-[14px] text-slate-800">Сегодня — {dateStr}</h3>

      <div className="grid grid-cols-2 gap-4 flex-1 items-center my-4">
        <div>
          <p className="text-[10px] text-slate-400 mb-1.5 uppercase font-bold tracking-wide">Выручка</p>
          <p className="font-bold text-[15px] text-slate-800 font-mono tabular-nums">{fmt(income)} ₽</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 mb-1.5 uppercase font-bold tracking-wide">Прибыль</p>
          <p className={`font-bold text-[15px] font-mono tabular-nums ${
            profit >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {profit >= 0 ? '+' : ''}{fmt(profit)} ₽
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-200/60">
        <span className="text-[13px] text-slate-500 font-medium">Машин на линии</span>
        <span className={`text-[14px] font-bold font-mono tabular-nums ${loadColor}`}>
          {onLine}/{totalActive} ({loadPercent}%)
        </span>
      </div>
    </div>
  )
}
