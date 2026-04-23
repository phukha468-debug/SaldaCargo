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
    <main className="min-h-screen bg-slate-50">
      {/* Шапка */}
      <header className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center font-black text-xs italic">SC</div>
          <div>
            <span className="text-lg font-bold tracking-tight">SaldaCargo</span>
            <span className="text-slate-400 text-xs ml-2 uppercase font-black tracking-widest opacity-60">Dashboard</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/review"
            className="px-4 py-2 bg-amber-500 text-white text-sm font-semibold
                       rounded-lg hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20"
          >
            📋 Ревью смены
          </Link>
          <span className="text-slate-400 text-xs uppercase font-bold tracking-widest hidden md:block">{today}</span>
        </div>
      </header>

      {/* Контент */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <MoneyMap />
      </div>
    </main>
  )
}
