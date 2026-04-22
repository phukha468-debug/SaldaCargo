import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import MoneyMap from '@/components/dashboard/MoneyMap'

export default async function HomePage() {
  const supabase = createAdminClient()
  const { data } = await (supabase
    .from('legal_entities') as any)
    .select('id')
    .limit(1)

  if (!data || data.length === 0) {
    redirect('/setup')
  }

  const today = new Date().toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      {/* Шапка */}
      <header className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between shadow-lg sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-black text-xs italic">SC</div>
          <div>
            <span className="text-lg font-bold tracking-tight">SaldaCargo</span>
            <span className="text-slate-400 text-xs ml-2 uppercase font-black tracking-widest opacity-60">Dashboard</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-xs uppercase font-bold tracking-widest">{today}</span>
          <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-[10px] font-bold">AN</div>
        </div>
      </header>

      {/* Контент */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Карта денег</h1>
          <p className="text-slate-500 text-sm">Финансовое состояние бизнеса на текущий момент</p>
        </div>
        
        <MoneyMap />
      </div>

      {/* Футер */}
      <footer className="py-6 border-t border-slate-200 text-center">
        <p className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em]">SaldaCargo v1.0.0 · 2026</p>
      </footer>
    </main>
  )
}
