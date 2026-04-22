'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LEGAL_ENTITY_PRESET, ASSETS_PRESET, USERS_PRESET } from '@/lib/setup-data'
import Step1Legal from './Step1Legal'
import Step2Assets from './Step2Assets'
import Step3Users from './Step3Users'
import Step4Balances from './Step4Balances'

export type AssetRow = typeof ASSETS_PRESET[0] & {
  residual_value: number | null
  remaining_life_months: number | null
  odometer_current: number | null
  skip?: boolean
}

export type UserRow = typeof USERS_PRESET[0] & {
  phone?: string
}

export type WizardData = {
  legal: typeof LEGAL_ENTITY_PRESET
  assets: AssetRow[]
  users: UserRow[]
  initialBalances: { wallet_code: string; label: string; amount: number }[]
}

const STEPS = ['Юрлицо', 'Автопарк', 'Персонал', 'Остатки']

export default function SetupWizard() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [data, setData] = useState<WizardData>({
    legal: LEGAL_ENTITY_PRESET,
    assets: ASSETS_PRESET.map(a => ({ ...a, residual_value: null, remaining_life_months: null, odometer_current: null })),
    users: USERS_PRESET.map(u => ({ ...u, phone: '' })),
    initialBalances: [
      { wallet_code: 'ip_rs', label: 'Р/с ИП (остаток)', amount: 0 },
      { wallet_code: 'cash_office', label: 'Касса офиса (наличные)', amount: 0 },
      { wallet_code: 'opti24_cards', label: 'Карты Опти24 (баланс)', amount: 0 },
    ],
  })

  const handleNext = () => setStep(s => Math.min(s + 1, STEPS.length - 1))
  const handleBack = () => setStep(s => Math.max(s - 1, 0))

  const handleFinish = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/setup/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Ошибка')
      await router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-3xl bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 text-white p-6">
        <h1 className="text-xl font-bold">SaldaCargo — Первичная настройка</h1>
        <p className="text-slate-400 text-sm mt-1">Заполните данные один раз. После — система готова к работе.</p>
      </div>

      {/* Steps */}
      <div className="flex border-b border-slate-200">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`flex-1 py-3 text-center text-sm font-medium border-b-2 transition-colors ${
              i === step
                ? 'border-blue-600 text-blue-600'
                : i < step
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-slate-400'
            }`}
          >
            <span className="hidden sm:inline">{i + 1}. </span>{label}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {step === 0 && <Step1Legal data={data} onChange={setData} />}
        {step === 1 && <Step2Assets data={data} onChange={setData} />}
        {step === 2 && <Step3Users data={data} onChange={setData} />}
        {step === 3 && <Step4Balances data={data} onChange={setData} />}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            ❌ {error}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center px-6 py-4 bg-slate-50 border-t border-slate-200">
        <button
          onClick={handleBack}
          disabled={step === 0}
          className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-30"
        >
          ← Назад
        </button>
        <span className="text-xs text-slate-400">{step + 1} / {STEPS.length}</span>
        {step < STEPS.length - 1 ? (
          <button
            onClick={handleNext}
            className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            Далее →
          </button>
        ) : (
          <button
            onClick={handleFinish}
            disabled={isLoading}
            className="px-5 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {isLoading ? 'Сохраняем...' : '✅ Завершить настройку'}
          </button>
        )}
      </div>
    </div>
  )
}
