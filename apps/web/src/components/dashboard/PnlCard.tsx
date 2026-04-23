interface PnlCardProps {
  income: number
  expense: number
  profit: number
  target: number
  progressPercent: number
}

export default function PnlCard({ income, expense, profit, target, progressPercent }: PnlCardProps) {
  const fmt = (n: number) => n.toLocaleString('ru-RU')

  const barColor =
    progressPercent >= 100 ? 'bg-green-500' :
    progressPercent >= 50  ? 'bg-primary'   : 'bg-amber-500'

  return (
    <div className="bg-[#EEF2F8] rounded-xl border border-slate-300/70 p-6 shadow-sm h-full flex flex-col justify-between">
      <h3 className="font-bold text-[14px] text-slate-800">P&L текущего месяца</h3>

      <div className="grid grid-cols-3 gap-3 flex-1 items-center my-4">
        {[
          { label: 'Выручка', value: fmt(income)  + ' ₽', color: 'text-slate-800' },
          { label: 'Расходы', value: fmt(expense) + ' ₽', color: 'text-slate-800' },
          { label: 'Прибыль', value: (profit >= 0 ? '+' : '') + fmt(profit) + ' ₽',
            color: profit >= 0 ? 'text-green-600' : 'text-red-600' },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <p className="text-[10px] text-slate-400 mb-1.5 uppercase font-bold tracking-wide">{label}</p>
            <p className={`font-bold text-[15px] font-mono tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex justify-between text-[10px] text-slate-400 mb-2 uppercase font-bold tracking-wide">
          <span>Цель {fmt(target)} ₽</span>
          <span className="text-primary">{progressPercent}%</span>
        </div>
        <div className="w-full bg-blue-50 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
