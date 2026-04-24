import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createAdminClient()
    
    // Получаем список всех активов
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('*, asset_types(name)')
    
    if (assetsError) throw assetsError

    // Получаем текущую дату и начало месяца
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    // Получаем поездки за месяц
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('*')
      .gte('started_at', startOfMonth)
      .eq('lifecycle_status', 'approved')

    if (tripsError) throw tripsError

    // Получаем расходы на топливо за месяц (из trip_expenses или fuel_transactions_raw)
    // В данном MVP будем использовать trip_expenses с категорией топливо
    const { data: fuelExpenses, error: fuelError } = await supabase
      .from('trip_expenses')
      .select('*, categories!inner(code)')
      .eq('categories.code', 'FUEL')
      .gte('created_at', startOfMonth)

    if (fuelError) throw fuelError

    // Рассчитываем метрики для каждого авто
    const stats = assets.map(asset => {
      const assetTrips = trips?.filter(t => t.asset_id === asset.id) || []
      const mileage = assetTrips.reduce((acc, t) => acc + ((t.odometer_end || 0) - (t.odometer_start || 0)), 0)
      const tripCount = assetTrips.length
      
      // Здесь нужна сложная логика для Revenue, но для начала возьмем сумму из trips
      // В реальной системе нужно джойнить trip_orders
      const revenue = assetTrips.reduce((acc, t) => {
          // В нашей схеме Trips имеет поле revenue
          return acc + Number(t.revenue || 0)
      }, 0)

      const fuelCost = fuelExpenses?.filter(e => e.trip_id && assetTrips.some(at => at.id === e.trip_id))
                                  .reduce((acc, e) => acc + Number(e.amount), 0) || 0

      // Расходы на ремонты (пока из service_orders)
      // TODO: Добавить запрос к service_orders

      const profit = revenue - fuelCost // Упрощенно

      const profitPerKm = mileage > 0 ? profit / mileage : 0
      
      // Для расхода топлива л/100км нам нужны литры, но в trip_expenses только суммы.
      // Если есть fuel_transactions_raw, можно взять оттуда.
      const consumption = 0 // Заглушка

      // Проверка на алерты
      const daysToInsurance = asset.insurance_expiry_date 
        ? Math.ceil((new Date(asset.insurance_expiry_date).getTime() - now.getTime()) / (1000 * 3600 * 24))
        : null
      
      const kmToService = asset.next_service_km ? asset.next_service_km - asset.odometer_current : null

      return {
        ...asset,
        metrics: {
          mileage,
          tripCount,
          revenue,
          fuelCost,
          profit,
          profitPerKm,
          consumption
        },
        alerts: {
          insurance: daysToInsurance !== null && daysToInsurance < 14,
          service: kmToService !== null && kmToService < 1000
        }
      }
    })

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Fleet stats error:', error)
    return NextResponse.json({ error: (error as any).message }, { status: 500 })
  }
}
