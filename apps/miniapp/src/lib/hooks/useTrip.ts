'use client'

import { useState, useEffect, useCallback } from 'react'

export interface TripOrder {
  id: string
  order_number: number
  client_name: string
  amount: number
  driver_pay: number
  loader_pay: number
  driver_pay_percent: number
  payment_method: string
  settlement_status: string
}

export interface TripExpense {
  id: string
  amount: number
  description: string
  payment_method: string
  categories: { code: string; name: string }
}

export interface TripSummary {
  ordersCount: number
  totalRevenue: number
  totalDriverPay: number
  totalLoaderPay: number
  totalExpenses: number
  profit: number
}

export function useTrip(tripId: string) {
  const [trip, setTrip] = useState<Record<string, unknown> | null>(null)
  const [orders, setOrders] = useState<TripOrder[]>([])
  const [expenses, setExpenses] = useState<TripExpense[]>([])
  const [summary, setSummary] = useState<TripSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/trips/${tripId}`)
      if (!res.ok) throw new Error('Ошибка загрузки рейса')
      const data = await res.json()
      setTrip(data.trip)
      setOrders(data.orders)
      setExpenses(data.expenses)
      setSummary(data.summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => { load() }, [load])

  return { trip, orders, expenses, summary, loading, error, reload: load }
}
