/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

function getPeriodRange(period: string): { start: string; end: string; months: number } {
  const now = new Date();
  if (period === 'last_month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
      end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString(),
      months: 1,
    };
  }
  if (period === 'quarter') {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString(),
      end: now.toISOString(),
      months: 3,
    };
  }
  // current_month (default)
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    end: now.toISOString(),
    months: 1,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') ?? 'current_month';
    const { start: periodStart, end: periodEnd, months: periodMonths } = getPeriodRange(period);

    const supabase = createAdminClient();

    const [
      { data: assets, error: assetsError },
      { data: assetTypes },
      { data: revenueOrders },
      { data: expenseRows },
      { data: kmTrips },
      { data: payRows },
      { data: tripCountRows },
      { data: orderCountRows },
      { data: partsTransactions },
      { data: mechanicPayRows },
    ] = await Promise.all([
      // Все машины
      (supabase as any)
        .from('assets')
        .select(
          `
          id, short_name, reg_number, year, status, odometer_current,
          current_book_value, remaining_depreciation_months,
          monthly_fixed_cost, insurance_expires_at, inspection_expires_at,
          needs_update, notes,
          asset_type:asset_types(id, code, name, capacity_m, has_gps),
          driver:users!assets_assigned_driver_id_fkey(id, name)
        `,
        )
        .not('status', 'in', '("sold","written_off")')
        .order('short_name'),

      // Список типов для формы
      (supabase as any).from('asset_types').select('id, code, name').order('name'),

      // Выручка за период (approved = работа выполнена, settlement не учитываем для аналитики машин)
      (supabase as any)
        .from('trip_orders')
        .select('amount, trip:trips!inner(asset_id, started_at, lifecycle_status)')
        .eq('lifecycle_status', 'approved')
        .eq('trips.lifecycle_status', 'approved')
        .gte('trips.started_at', periodStart)
        .lte('trips.started_at', periodEnd),

      // Расходы рейсов (ГСМ и т.д.)
      (supabase as any)
        .from('trip_expenses')
        .select('amount, trip:trips!inner(asset_id, started_at, lifecycle_status)')
        .eq('trips.lifecycle_status', 'approved')
        .gte('trips.started_at', periodStart)
        .lte('trips.started_at', periodEnd),

      // Километры за период
      (supabase as any)
        .from('trips')
        .select('asset_id, odometer_start, odometer_end')
        .eq('lifecycle_status', 'approved')
        .not('odometer_end', 'is', null)
        .gte('started_at', periodStart)
        .lte('started_at', periodEnd),

      // ЗП водителей и грузчиков
      (supabase as any)
        .from('trip_orders')
        .select('driver_pay, loader_pay, trip:trips!inner(asset_id, started_at, lifecycle_status)')
        .eq('lifecycle_status', 'approved')
        .eq('trips.lifecycle_status', 'approved')
        .gte('trips.started_at', periodStart)
        .lte('trips.started_at', periodEnd),

      // Кол-во рейсов на машину
      (supabase as any)
        .from('trips')
        .select('asset_id')
        .eq('lifecycle_status', 'approved')
        .gte('started_at', periodStart)
        .lte('started_at', periodEnd),

      // Кол-во заказов на машину (для среднего чека)
      (supabase as any)
        .from('trip_orders')
        .select('amount, trip:trips!inner(asset_id, started_at, lifecycle_status)')
        .eq('lifecycle_status', 'approved')
        .eq('trips.lifecycle_status', 'approved')
        .gte('trips.started_at', periodStart)
        .lte('trips.started_at', periodEnd),

      // Общие расходы на запчасти за период (из транзакций) — распределяются поровну по активным машинам
      (supabase as any)
        .from('transactions')
        .select('amount')
        .eq('category_id', '9d18370d-3228-4f2a-8530-52b168cfa8d7')
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .gte('transaction_date', periodStart)
        .lte('transaction_date', periodEnd),

      // ЗП механиков за ремонт своих машин
      (supabase as any)
        .from('service_orders')
        .select('asset_id, mechanic_pay, second_mechanic_pay')
        .eq('machine_type', 'own')
        .eq('lifecycle_status', 'approved')
        .not('asset_id', 'is', null)
        .gte('updated_at', periodStart)
        .lte('updated_at', periodEnd),
    ]);

    if (assetsError) return NextResponse.json({ error: assetsError.message }, { status: 500 });

    // ── Агрегация ──────────────────────────────────────────────────────────────

    const revenueMap = new Map<string, number>();
    const orderCountMap = new Map<string, number>();
    for (const o of (revenueOrders as any[]) ?? []) {
      const id = o.trip?.asset_id;
      if (id) revenueMap.set(id, (revenueMap.get(id) ?? 0) + parseFloat(o.amount ?? '0'));
    }

    const expenseMap = new Map<string, number>();
    for (const e of (expenseRows as any[]) ?? []) {
      const id = e.trip?.asset_id;
      if (id) expenseMap.set(id, (expenseMap.get(id) ?? 0) + parseFloat(e.amount ?? '0'));
    }

    const kmMap = new Map<string, number>();
    for (const t of (kmTrips as any[]) ?? []) {
      const km = (t.odometer_end ?? 0) - (t.odometer_start ?? 0);
      if (km > 0) kmMap.set(t.asset_id, (kmMap.get(t.asset_id) ?? 0) + km);
    }

    const payMap = new Map<string, number>();
    for (const o of (payRows as any[]) ?? []) {
      const id = o.trip?.asset_id;
      if (id) {
        const pay = parseFloat(o.driver_pay ?? '0') + parseFloat(o.loader_pay ?? '0');
        payMap.set(id, (payMap.get(id) ?? 0) + pay);
      }
    }

    const tripCountMap = new Map<string, number>();
    for (const t of (tripCountRows as any[]) ?? []) {
      tripCountMap.set(t.asset_id, (tripCountMap.get(t.asset_id) ?? 0) + 1);
    }

    for (const o of (orderCountRows as any[]) ?? []) {
      const id = o.trip?.asset_id;
      if (id) orderCountMap.set(id, (orderCountMap.get(id) ?? 0) + 1);
    }

    const mechanicPayMap = new Map<string, number>();
    for (const o of (mechanicPayRows as any[]) ?? []) {
      if (o.asset_id) {
        const pay = parseFloat(o.mechanic_pay ?? '0') + parseFloat(o.second_mechanic_pay ?? '0');
        mechanicPayMap.set(o.asset_id, (mechanicPayMap.get(o.asset_id) ?? 0) + pay);
      }
    }

    // Общая сумма расходов на запчасти за период — делим поровну на машины с >3 рейсами
    const totalPartsCost = ((partsTransactions as any[]) ?? []).reduce(
      (s, t) => s + parseFloat(t.amount ?? '0'),
      0,
    );
    const activeAssetIds = ((assets as any[]) ?? []).map((a: any) => a.id);
    const qualifyingCount = activeAssetIds.filter((id) => (tripCountMap.get(id) ?? 0) > 3).length;
    const partsPerVehicle = qualifyingCount > 0 ? totalPartsCost / qualifyingCount : 0;

    // ── Построение строк ───────────────────────────────────────────────────────

    const rows = ((assets as any[]) ?? []).map((a: any) => {
      const revenue = revenueMap.get(a.id) ?? 0;
      const tripExpenses = expenseMap.get(a.id) ?? 0;
      const pay = payMap.get(a.id) ?? 0;
      const tripCount = tripCountMap.get(a.id) ?? 0;
      const maintenanceParts = tripCount > 3 ? partsPerVehicle : 0;
      const maintenanceLabor = mechanicPayMap.get(a.id) ?? 0;
      const maintenance = maintenanceParts + maintenanceLabor; // запчасти (распределённые) + ЗП механиков
      const fixedCost = parseFloat(a.monthly_fixed_cost ?? '0') * periodMonths;
      const operationalCosts = tripExpenses + pay; // операционные (на рейс)
      const totalCosts = operationalCosts + maintenance + fixedCost; // полные
      const km = kmMap.get(a.id) ?? 0;
      const orderCount = orderCountMap.get(a.id) ?? 0;

      return {
        ...a,
        analytics: {
          revenue: revenue.toFixed(2),
          // expenses = только операционные (для отображения рейсовых расходов)
          expenses: operationalCosts.toFixed(2),
          maintenance: maintenance.toFixed(2),
          fixed_cost: fixedCost.toFixed(2),
          total_costs: totalCosts.toFixed(2),
          // profit = операционный (без постоянных/ТО)
          profit: (revenue - operationalCosts).toFixed(2),
          // true_profit = после вычета всех расходов
          true_profit: (revenue - totalCosts).toFixed(2),
          km,
          trip_count: tripCount,
          order_count: orderCount,
          avg_order_value: orderCount > 0 ? (revenue / orderCount).toFixed(2) : null,
          avg_km_per_trip: tripCount > 0 ? Math.round(km / tripCount) : null,
          // операционная себестоимость (без постоянных)
          cost_per_km: km > 0 ? (operationalCosts / km).toFixed(2) : null,
          // полная себестоимость (включая постоянные и ТО)
          true_cost_per_km: km > 0 ? (totalCosts / km).toFixed(2) : null,
          margin_pct: revenue > 0 ? Math.round(((revenue - totalCosts) / revenue) * 100) : null,
        },
      };
    });

    const summary = {
      total: rows.length,
      active: rows.filter((a: any) => a.status === 'active').length,
      repair: rows.filter((a: any) => a.status === 'repair').length,
      reserve: rows.filter((a: any) => a.status === 'reserve').length,
      needsUpdate: rows.filter((a: any) => a.needs_update).length,
    };

    return NextResponse.json({ assets: rows, summary, assetTypes });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, any>;
    const supabase = createAdminClient();

    const payload: Record<string, any> = {
      short_name: body.short_name?.trim(),
      reg_number: body.reg_number?.trim(),
      asset_type_id: body.asset_type_id,
      year: body.year ?? null,
      status: body.status ?? 'active',
      odometer_current: body.odometer_current ?? 0,
      assigned_driver_id: body.assigned_driver_id ?? null,
      current_book_value: body.current_book_value ?? '0.00',
      remaining_depreciation_months: body.remaining_depreciation_months ?? null,
      monthly_fixed_cost: body.monthly_fixed_cost ?? '0.00',
      notes: body.notes ?? null,
      needs_update: false,
    };

    if (!payload.short_name || !payload.reg_number || !payload.asset_type_id) {
      return NextResponse.json(
        { error: 'short_name, reg_number, asset_type_id — обязательны' },
        { status: 400 },
      );
    }

    const { data, error } = await (supabase.from('assets') as any)
      .insert(payload)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
