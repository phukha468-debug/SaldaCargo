import MainLayout from "@/components/layout/MainLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@saldacargo/ui"
import { Truck } from "lucide-react"

export default function AssetsPage() {
  return (
    <MainLayout>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Автопарк</h1>
          <p className="text-accent-secondary">Управление транспортными средствами и оборудованием</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              Список техники
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-accent-secondary py-8 text-center border-2 border-dashed rounded-lg">
              Раздел находится в разработке
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
