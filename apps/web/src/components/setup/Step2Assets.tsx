'use client'
import type { WizardData, AssetRow } from './SetupWizard'

export default function Step2Assets({ data, onChange }: { data: WizardData; onChange: (d: WizardData) => void }) {
  const updateAsset = (i: number, field: keyof AssetRow, value: string | number | boolean | null) => {
    const updated = [...data.assets]
    // @ts-ignore
    updated[i] = { ...updated[i], [field]: value }
    onChange({ ...data, assets: updated })
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Шаг 2: Автопарк</h2>
      <p className="text-sm text-slate-500">Введите остаточную стоимость, пробег и срок службы. Машины с галочкой «Пропустить» не будут добавлены.</p>

      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {data.assets.map((asset, i) => (
          <div key={i} className={`border rounded-lg p-3 ${asset.skip ? 'opacity-40' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-2 gap-4">
              <div className="flex-1 flex items-center gap-2">
                <input
                  className="w-20 border border-slate-300 rounded px-2 py-0.5 text-sm font-bold text-slate-800"
                  value={asset.plate_number}
                  onChange={e => updateAsset(i, 'plate_number', e.target.value)}
                  placeholder="000"
                />
                <span className="text-xs text-slate-400 uppercase">{asset.asset_type_code}</span>
              </div>
              <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={!!asset.skip}
                  onChange={e => updateAsset(i, 'skip', e.target.checked)}
                />
                Пропустить
              </label>
            </div>
            {asset.notes && <p className="text-xs text-slate-400 mb-2">{asset.notes}</p>}
            {!asset.skip && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Пробег (км)</label>
                  <input
                    type="number"
                    className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                    placeholder="340000"
                    value={asset.odometer_current ?? ''}
                    onChange={e => updateAsset(i, 'odometer_current', e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Ост. стоимость (₽)</label>
                  <input
                    type="number"
                    className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                    placeholder="1600000"
                    value={asset.residual_value ?? ''}
                    onChange={e => updateAsset(i, 'residual_value', e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Срок (мес)</label>
                  <input
                    type="number"
                    className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                    placeholder="120"
                    value={asset.remaining_life_months ?? ''}
                    onChange={e => updateAsset(i, 'remaining_life_months', e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
