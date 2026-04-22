import MainLayout from "@/components/layout/MainLayout"
import { TripReviewTable } from "@/components/features/TripReviewTable"

export default function TripsPage() {
  return (
    <MainLayout>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Ревью смены</h1>
          <p className="text-accent-secondary">Проверка и подтверждение отчетов водителей</p>
        </div>
        
        <TripReviewTable />
      </div>
    </MainLayout>
  )
}
