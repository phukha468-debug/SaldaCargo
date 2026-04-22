interface PnlCardProps {
  income: number
  expense: number
  profit: number
  target: number
  progressPercent: number
}

export default function PnlCard({ income, expense, profit, target, progressPercent }: PnlCardProps) {
  const fmt = (n: number) => n.toLocaleString('ru-RU')

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h3 className="font-semibold text-slate-700 mb-4">💰 P&L текущего месяца</h3>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <p className="text-xs text-slate-400 mb-1 uppercase font-bold">Выручка</p>
          <p className="font-bold text-slate-800">{fmt(income)} ₽</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1 uppercase font-bold">Расходы</p>
          <p className="font-bold text-slate-800">{fmt(expense)} ₽</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1 uppercase font-bold">Прибыль</p>
          <p className={`font-bold text-lg ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {profit >= 0 ? '+' : ''}{fmt(profit)} ₽
          </p>
        </div>
      </div>

      {/* Прогресс к цели */}
      <div>
        <div className="flex justify-between text-[10px] text-slate-400 mb-1 uppercase font-bold">
          <span>Цель {fmt(target)} ₽</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              progressPercent >= 100
                ? 'bg-green-500'
                : progressPercent >= 50
                ? 'bg-blue-500'
                : 'bg-amber-500'
            }`}
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
