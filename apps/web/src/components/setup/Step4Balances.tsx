'use client'
import type { WizardData } from './SetupWizard'

export default function Step4Balances({ data, onChange }: { data: WizardData; onChange: (d: WizardData) => void }) {
  const updateBalance = (i: number, value: string) => {
    const updated = [...data.initialBalances]
    updated[i] = { ...updated[i], amount: Number(value) || 0 }
    onChange({ ...data, initialBalances: updated })
  }

  const total = data.initialBalances.reduce((sum, b) => sum + b.amount, 0)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Шаг 4: Начальные остатки</h2>
      <p className="text-sm text-slate-500">
        Введите актуальные остатки на сегодня. Это стартовая точка для финансового учёта.
        Можно оставить 0 и ввести позже через Dashboard.
      </p>

      <div className="space-y-3">
        {data.initialBalances.map((b, i) => (
          <div key={i} className="flex items-center gap-4 border border-slate-200 rounded-lg p-4">
            <div className="flex-1">
              <span className="font-medium text-sm text-slate-800">{b.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="w-40 border border-slate-300 rounded-lg px-3 py-2 text-sm text-right"
                placeholder="0"
                value={b.amount || ''}
                onChange={e => updateBalance(i, e.target.value)}
              />
              <span className="text-sm text-slate-500">₽</span>
            </div>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div className="flex justify-between items-center pt-3 border-t border-slate-200">
          <span className="text-sm font-medium text-slate-700">Итого начальные активы:</span>
          <span className="text-lg font-bold text-slate-800">
            {total.toLocaleString('ru-RU')} ₽
          </span>
        </div>
      )}

      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
        ⚠️ После нажатия «Завершить» данные сохранятся в систему. Это действие нельзя отменить автоматически.
      </div>
    </div>
  )
}
