import MainLayout from "@/components/layout/MainLayout"
import { TripReviewTable } from "@/components/features/TripReviewTable"
import { SlidersHorizontal, Plus } from "lucide-react"

export default function TripsPage() {
  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <MainLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Ревью смены</h1>
            <p className="text-slate-500 text-[13px] mt-0.5">Подтверждение рейсов за сегодня — {today}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 text-[13px] text-slate-600 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm hover:bg-slate-50 transition-colors">
              <SlidersHorizontal size={13} /> Фильтр
            </button>
            <button className="flex items-center gap-1.5 text-[13px] text-white bg-primary rounded-lg px-3 py-2 shadow-sm hover:bg-primary/90 transition-colors font-medium">
              <Plus size={13} /> Новый рейс
            </button>
          </div>
        </div>

        <TripReviewTable />
      </div>
    </MainLayout>
  )
}
