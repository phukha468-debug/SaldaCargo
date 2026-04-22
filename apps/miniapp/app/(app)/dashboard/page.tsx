import { DriverHome } from "@/components/features/DriverHome"

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-workspace">
      <DriverHome onStartTrip={() => {}} />
      
      {/* Bottom Nav Simulation */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-[#E2E8F0] flex items-center justify-around z-50">
        <button className="flex flex-col items-center gap-1 text-primary">
          <span className="text-xl">🏠</span>
          <span className="text-[10px] font-bold uppercase">Главная</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-accent-secondary">
          <span className="text-xl">📋</span>
          <span className="text-[10px] font-bold uppercase">Рейсы</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-accent-secondary">
          <span className="text-xl">⚙️</span>
          <span className="text-[10px] font-bold uppercase">Профиль</span>
        </button>
      </nav>
    </main>
  )
}
