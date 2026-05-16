/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const FUEL_CATEGORY_ID = '62cebf3f-9982-4cc6-904b-48c6169cf5e4';

function last6MonthKeys(): string[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

/** GET /api/counterparties — список клиентов с аналитикой */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const onlyActive = searchParams.get('active') === '1';

    const supabase = createAdminClient();
    const monthKeys = last6MonthKeys();

    let q = (supabase as any)
      .from('counterparties')
      .select('id, name, phone, email, credit_limit, notes, is_active, is_regular')
      .in('type', ['client', 'both'])
      .order('name');

    if (onlyActive) q = q.eq('is_active', true);

    const { data: counterparties, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const cpIds = (counterparties ?? []).map((c: any) => c.id);
    if (cpIds.length === 0) return NextResponse.json([]);

    // Заказы клиентов с ЗП
    const { data: orders } = await (supabase as any)
      .from('trip_orders')
      .select(
        'counterparty_id, trip_id, amount, driver_pay, loader_pay, payment_method, lifecycle_status, settlement_status, trip:trips(started_at)',
      )
      .in('counterparty_id', cpIds)
      .neq('lifecycle_status', 'cancelled');

    // Все уникальные trip_id клиентских заказов
    const allTripIds = [
      ...new Set((orders ?? []).map((o: any) => o.trip_id).filter(Boolean)),
    ] as string[];

    // Расходы на ГСМ по этим рейсам
    const { data: fuelExpenses } =
      allTripIds.length > 0
        ? await (supabase as any)
            .from('trip_expenses')
            .select('trip_id, amount')
            .in('trip_id', allTripIds)
            .eq('category_id', FUEL_CATEGORY_ID)
        : { data: [] };

    const tripFuelMap = new Map<string, number>();
    for (const e of fuelExpenses ?? []) {
      tripFuelMap.set(e.trip_id, (tripFuelMap.get(e.trip_id) ?? 0) + parseFloat(e.amount ?? '0'));
    }

    // Суммарная выручка каждого рейса (для пропорции ГСМ)
    const { data: allTripOrders } =
      allTripIds.length > 0
        ? await (supabase as any)
            .from('trip_orders')
            .select('trip_id, amount, lifecycle_status, settlement_status')
            .in('trip_id', allTripIds)
            .eq('lifecycle_status', 'approved')
            .eq('settlement_status', 'completed')
            .neq('lifecycle_status', 'cancelled')
        : { data: [] };

    const tripTotalRevenueMap = new Map<string, number>();
    for (const o of allTripOrders ?? []) {
      tripTotalRevenueMap.set(
        o.trip_id,
        (tripTotalRevenueMap.get(o.trip_id) ?? 0) + parseFloat(o.amount ?? '0'),
      );
    }

    // Статистика по каждому клиенту
    const now = Date.now();

    type Stats = {
      total_revenue: number;
      revenue_30d: number;
      revenue_orders: number;
      driver_costs: number;
      trip_ids: Set<string>;
      trip_client_revenue: Map<string, number>;
      last_trip_at: string | null;
      payments: Record<string, number>;
      monthly: Record<string, number>;
    };

    const statsMap = new Map<string, Stats>();
    for (const cpId of cpIds) {
      statsMap.set(cpId, {
        total_revenue: 0,
        revenue_30d: 0,
        revenue_orders: 0,
        driver_costs: 0,
        trip_ids: new Set(),
        trip_client_revenue: new Map(),
        last_trip_at: null,
        payments: {},
        monthly: {},
      });
    }

    for (const o of orders ?? []) {
      const s = statsMap.get(o.counterparty_id);
      if (!s) continue;

      const amount = parseFloat(o.amount ?? '0');
      const startedAt: string | null = o.trip?.started_at ?? null;

      if (o.trip_id) s.trip_ids.add(o.trip_id);
      if (startedAt && (!s.last_trip_at || startedAt > s.last_trip_at)) {
        s.last_trip_at = startedAt;
      }

      if (o.lifecycle_status === 'approved' && o.settlement_status === 'completed') {
        s.total_revenue += amount;
        s.revenue_orders++;
        s.driver_costs += parseFloat(o.driver_pay ?? '0') + parseFloat(o.loader_pay ?? '0');
        s.trip_client_revenue.set(o.trip_id, (s.trip_client_revenue.get(o.trip_id) ?? 0) + amount);
        if (startedAt && now - new Date(startedAt).getTime() <= THIRTY_DAYS) {
          s.revenue_30d += amount;
        }
        s.payments[o.payment_method] = (s.payments[o.payment_method] ?? 0) + amount;
        const mk = startedAt ? startedAt.slice(0, 7) : null;
        if (mk && monthKeys.includes(mk)) {
          s.monthly[mk] = (s.monthly[mk] ?? 0) + amount;
        }
      }
    }

    const result = (counterparties ?? []).map((cp: any) => {
      const s = statsMap.get(cp.id)!;

      // Пропорциональное распределение ГСМ по рейсам
      let fuelAllocated = 0;
      for (const [tripId, clientRev] of s.trip_client_revenue) {
        const tripTotal = tripTotalRevenueMap.get(tripId) ?? 0;
        const tripFuel = tripFuelMap.get(tripId) ?? 0;
        if (tripTotal > 0 && tripFuel > 0) {
          fuelAllocated += (clientRev / tripTotal) * tripFuel;
        }
      }

      const netProfit = s.total_revenue - s.driver_costs - fuelAllocated;

      const preferredPayment =
        Object.entries(s.payments)
          .filter(([pm]) => pm !== 'debt_cash')
          .sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

      const totalForPct = s.total_revenue || 1;
      const paymentBreakdown: Record<string, number> = {};
      for (const [pm, val] of Object.entries(s.payments)) {
        paymentBreakdown[pm] = Math.round((val / totalForPct) * 100);
      }

      return {
        id: cp.id,
        name: cp.name,
        phone: cp.phone ?? null,
        email: cp.email ?? null,
        notes: cp.notes ?? null,
        credit_limit: cp.credit_limit ?? null,
        is_active: cp.is_active,
        is_regular: cp.is_regular ?? false,
        total_revenue: s.total_revenue.toFixed(2),
        revenue_30d: s.revenue_30d.toFixed(2),
        net_profit: netProfit.toFixed(2),
        trips_count: s.trip_ids.size,
        orders_count: s.revenue_orders,
        avg_order: s.revenue_orders > 0 ? (s.total_revenue / s.revenue_orders).toFixed(2) : '0.00',
        last_trip_at: s.last_trip_at,
        preferred_payment: preferredPayment,
        payment_breakdown: paymentBreakdown,
        monthly: monthKeys.map((k) => (s.monthly[k] ?? 0).toFixed(2)),
        month_labels: monthKeys.map((k) => {
          const [y, m] = k.split('-').map(Number);
          return new Date(y, m - 1, 1).toLocaleDateString('ru-RU', { month: 'short' });
        }),
      };
    });

    result.sort(
      (a: any, b: any) =>
        parseFloat(b.revenue_30d) - parseFloat(a.revenue_30d) ||
        parseFloat(b.total_revenue) - parseFloat(a.total_revenue),
    );

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

/** POST /api/counterparties — создать клиента */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name: string;
      phone?: string;
      email?: string;
      credit_limit?: string;
      notes?: string;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Название обязательно' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data, error } = await (supabase.from('counterparties') as any)
      .insert({
        name: body.name.trim(),
        type: 'client',
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        credit_limit: body.credit_limit || null,
        notes: body.notes?.trim() || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
