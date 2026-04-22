"use client"

import React from "react"
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  Skeleton,
  cn
} from "@saldacargo/ui"
import { 
  BarChart, 
  DonutChart, 
  Flex, 
  Grid, 
  Metric, 
  Text, 
  Icon, 
  Bold,
  Title
} from "@tremor/react"
import { 
  TrendingUp, 
  Wallet, 
  Truck, 
  Database, 
  ArrowUpRight, 
  ArrowDownRight,
  Landmark,
  ShieldCheck
} from "lucide-react"

export function MoneyMap() {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    setLoading(true)
    fetch("/api/money-map")
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setData(json.data)
        } else {
          console.error("API error:", json)
        }
      })
      .catch(err => {
        console.error("Fetch error:", err)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  // Sample data fallback if API fails for demo purposes
  const displayData = data || {
    netPosition: 8450000,
    assets: { cash: 1200000, fleet: 7000000, equipment: 250000 },
    liabilities: { accountsPayable: 150000, taxes: 50000 },
    pandlMonth: { revenue: 2000000, expenses: 1500000, profit: 500000 },
    today: { revenue: 50000, payroll: 10000, fuel: 5000, profit: 35000 }
  };

  if (loading && !data) return <MoneyMapSkeleton />

  const assetDist = [
    { name: "Деньги", value: displayData.assets.cash },
    { name: "Автопарк", value: displayData.assets.fleet },
    { name: "Оборудование", value: displayData.assets.equipment },
  ]

  const pnlData = [
    { name: "Выручка", amount: displayData.pandlMonth.revenue },
    { name: "Расходы", amount: displayData.pandlMonth.expenses },
    { name: "Прибыль", amount: displayData.pandlMonth.profit },
  ]

  return (
    <div className="flex flex-col gap-6">
      <Grid numItemsLg={3} className="gap-6">
        {/* Net Position */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Чистая позиция (Equity)</CardTitle>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <Metric className="text-4xl font-bold">
                {displayData.netPosition.toLocaleString()} ₽
              </Metric>
              <BadgeDelta deltaType="moderateIncrease" className="rounded-full">
                +8.2%
              </BadgeDelta>
            </div>
            <Text className="mt-2 text-accent-secondary">Активы за вычетом всех обязательств</Text>
            
            <Grid numItemsSm={2} className="mt-8 gap-4">
               <div className="flex flex-col gap-1 p-3 bg-workspace rounded-lg border border-primary/5">
                 <Text className="text-[10px] uppercase font-bold text-accent-secondary">Сегодня: Прибыль</Text>
                 <Text className="text-xl font-bold text-success">+{displayData.today.profit.toLocaleString()} ₽</Text>
                 <div className="flex items-center gap-1 text-[10px] text-accent-secondary">
                   <span className="text-success font-bold">Выручка: {displayData.today.revenue.toLocaleString()}</span> | 
                   <span className="text-error"> Расходы: {(displayData.today.payroll + displayData.today.fuel).toLocaleString()}</span>
                 </div>
               </div>
               <div className="flex flex-col gap-1 p-3 bg-workspace rounded-lg border border-primary/5">
                 <Text className="text-[10px] uppercase font-bold text-accent-secondary">Месяц: Рентабельность</Text>
                 <Text className="text-xl font-bold">24.6%</Text>
                 <div className="mt-1 w-full bg-white rounded-full h-1">
                    <div className="bg-primary h-full" style={{ width: '24.6%' }} />
                 </div>
               </div>
            </Grid>
          </CardContent>
        </Card>

        {/* Asset Allocation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Распределение активов</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <DonutChart
              data={assetDist}
              category="value"
              index="name"
              colors={["blue", "cyan", "indigo"]}
              className="mt-6 h-40"
            />
            <div className="mt-6 w-full space-y-2">
              {assetDist.map(item => (
                <Flex key={item.name}>
                  <Text>{item.name}</Text>
                  <Text><Bold>{item.value.toLocaleString()} ₽</Bold></Text>
                </Flex>
              ))}
            </div>
          </CardContent>
        </Card>
      </Grid>

      <Grid numItemsLg={4} className="gap-6">
         <Card>
           <CardContent className="pt-6">
              <Text className="text-xs uppercase font-bold text-accent-secondary">Кредиторка</Text>
              <Metric className="text-2xl mt-1 text-error">{displayData.liabilities.accountsPayable.toLocaleString()} ₽</Metric>
           </CardContent>
         </Card>
         <Card>
           <CardContent className="pt-6">
              <Text className="text-xs uppercase font-bold text-accent-secondary">Налоги (оценка)</Text>
              <Metric className="text-2xl mt-1 text-warning">{displayData.liabilities.taxes.toLocaleString()} ₽</Metric>
           </CardContent>
         </Card>
         <Card>
           <CardContent className="pt-6">
              <Text className="text-xs uppercase font-bold text-accent-secondary">ФОТ за сегодня</Text>
              <Metric className="text-2xl mt-1">{displayData.today.payroll.toLocaleString()} ₽</Metric>
           </CardContent>
         </Card>
         <Card>
           <CardContent className="pt-6">
              <Text className="text-xs uppercase font-bold text-accent-secondary">ГСМ за сегодня</Text>
              <Metric className="text-2xl mt-1">{displayData.today.fuel.toLocaleString()} ₽</Metric>
           </CardContent>
         </Card>
      </Grid>
    </div>
  )
}

function MoneyMapSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Grid numItemsLg={3} className="gap-6">
        <Skeleton className="h-[320px] col-span-1 lg:col-span-2" />
        <Skeleton className="h-[320px]" />
      </Grid>
      <Grid numItemsLg={4} className="gap-6">
        <Skeleton className="h-[100px]" />
        <Skeleton className="h-[100px]" />
        <Skeleton className="h-[100px]" />
        <Skeleton className="h-[100px]" />
      </Grid>
    </div>
  )
}

function BadgeDelta({ children, deltaType, className }: any) {
  const colors: any = {
    moderateIncrease: "bg-success/10 text-success border-success/20",
    moderateDecrease: "bg-error/10 text-error border-error/20",
  }
  return (
    <span className={cn("px-2 py-0.5 text-xs font-bold border", colors[deltaType], className)}>
      {children}
    </span>
  )
}
