'use client'
import type { WizardData, UserRow } from './SetupWizard'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  driver: 'Водитель',
  loader: 'Грузчик',
  mechanic: 'Механик',
}

export default function Step3Users({ data, onChange }: { data: WizardData; onChange: (d: WizardData) => void }) {
  const updateUser = (i: number, field: keyof UserRow, value: string) => {
    const updated = [...data.users]
    // @ts-ignore
    updated[i] = { ...updated[i], [field]: value }
    onChange({ ...data, users: updated })
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Шаг 3: Персонал</h2>
      <p className="text-sm text-slate-500">Список сотрудников предзаполнен. Добавьте номера телефонов если нужно.</p>

      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {data.users.map((user, i) => (
          <div key={i} className="flex items-center gap-3 border border-slate-200 rounded-lg p-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <input
                  className="flex-1 border border-slate-300 rounded px-2 py-0.5 text-sm font-medium text-slate-800"
                  value={user.full_name}
                  onChange={e => updateUser(i, 'full_name', e.target.value)}
                  placeholder="ФИО сотрудника"
                />
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase font-bold shrink-0">
                  {ROLE_LABELS[user.role] || user.role}
                </span>
              </div>
              <input
                className="w-full bg-transparent border-none text-[11px] text-slate-400 italic focus:ring-0 p-0 placeholder:text-slate-300"
                value={user.notes || ''}
                onChange={e => updateUser(i, 'notes', e.target.value)}
                placeholder="Добавить примечание..."
              />
            </div>
            <div className="shrink-0">
              <label className="block text-[10px] text-slate-400 mb-0.5 ml-1 font-bold uppercase">Телефон</label>
              <input
                type="tel"
                className="w-32 border border-slate-300 rounded px-2 py-1 text-xs"
                placeholder="+7..."
                value={user.phone || ''}
                onChange={e => updateUser(i, 'phone', e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
