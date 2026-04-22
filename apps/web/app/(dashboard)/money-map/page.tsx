import MainLayout from "@/components/layout/MainLayout"
import { MoneyMap } from "@/components/features/MoneyMap"
import { TripReviewTable } from "@/components/features/TripReviewTable"

export default function MoneyMapPage() {
  return (
    <MainLayout>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Главная</h1>
          <p className="text-accent-secondary">Сводка по активам и прибыли в реальном времени</p>
        </div>
        
        <MoneyMap />
        
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          <TripReviewTable />
        </div>
      </div>
    </MainLayout>
  )
}
