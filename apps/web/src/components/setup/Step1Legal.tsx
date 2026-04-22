'use client'
import type { WizardData } from './SetupWizard'

export default function Step1Legal({ data, onChange }: { data: WizardData; onChange: (d: WizardData) => void }) {
  const update = (field: string, value: string) =>
    onChange({ ...data, legal: { ...data.legal, [field]: value } })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Шаг 1: Юридическое лицо</h2>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Название</label>
        <input
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          value={data.legal.name}
          onChange={e => update('name', e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">ИНН</label>
        <input
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          placeholder="Введите ИНН ИП"
          value={data.legal.inn}
          onChange={e => update('inn', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Тип</label>
          <select
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={data.legal.type}
            onChange={e => update('type', e.target.value)}
          >
            <option value="IP">ИП</option>
            <option value="OOO">ООО</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Налоговый режим</label>
          <select
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={data.legal.tax_regime}
            onChange={e => update('tax_regime', e.target.value)}
          >
            <option value="PATENT">Патент</option>
            <option value="USN">УСН</option>
            <option value="OSN">ОСН</option>
          </select>
        </div>
      </div>
    </div>
  )
}
