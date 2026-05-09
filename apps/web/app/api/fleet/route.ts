/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

function getPeriodRange(period: string): { start: string; end: string } {
  const now = new Date();
  if (period === 'last_month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
      end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString(),
    };
  }
  if (period === 'quarter') {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString(),
      end: now.toISOString(),
    };
  }
  // current_month (default)
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    end: now.toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') ?? 'current_month';
    const { start: periodStart, end: periodEnd } = getPeriodRange(period);

    const supabase = createAdminClient();

    const [
      { data: assets, error: assetsError },
      { data: assetTypes },
      { data: revenueOrders },
      { data: expenseRows },
      { data: kmTrips },
      { data: payRows },
    ] = await Promise.all([
      // Все машины
      (supabase as any)
        .from('assets')
        .select(
          `
          id, short_name, reg_number, year, status, odometer_current,
          current_book_value, remaining_depreciation_months, needs_update, notes,
          asset_type:asset_types(id, code, name, capacity_m, has_gps),
          driver:users!assets_assigned_driver_id_fkey(id, name)
        `,
        )
        .not('status', 'in', '("sold","written_off")')
        .order('short_name'),

      // Список типов для формы
      (supabase as any).from('asset_types').select('id, code, name').order('name'),

      // Выручка за период: trip_orders approved+completed → trips approved
      (supabase as any)
        .from('trip_orders')
        .select('amount, trip:trips!inner(asset_id, started_at, lifecycle_status)')
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .eq('trips.lifecycle_status', 'approved')
        .gte('trips.started_at', periodStart)
        .lte('trips.started_at', periodEnd),

      // Расходы за период: trip_expenses → trips approved
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
        .eq('status', 'completed')
        .not('odometer_end', 'is', null)
        .gte('started_at', periodStart)
        .lte('started_at', periodEnd),

      // ЗП водителей и грузчиков за период (для себестоимости)
      (supabase as any)
        .from('trip_orders')
        .select('driver_pay, loader_pay, trip:trips!inner(asset_id, started_at, lifecycle_status)')
        .eq('lifecycle_status', 'approved')
        .eq('trips.lifecycle_status', 'approved')
        .gte('trips.started_at', periodStart)
        .lte('trips.started_at', periodEnd),
    ]);

    if (assetsError) return NextResponse.json({ error: assetsError.message }, { status: 500 });

    // Агрегация по asset_id
    const revenueMap = new Map<string, number>();
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

    const rows = ((assets as any[]) ?? []).map((a: any) => {
      const revenue = revenueMap.get(a.id) ?? 0;
      const tripExpenses = expenseMap.get(a.id) ?? 0;
      const pay = payMap.get(a.id) ?? 0;
      const totalCosts = tripExpenses + pay;
      const km = kmMap.get(a.id) ?? 0;
      return {
        ...a,
        analytics: {
          revenue: revenue.toFixed(2),
          expenses: totalCosts.toFixed(2),
          profit: (revenue - totalCosts).toFixed(2),
          km,
          cost_per_km: km > 0 ? (totalCosts / km).toFixed(2) : null,
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

    return NextResponse.json({ assets: rows, summary, assetTypes: assetTypes ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      short_name: string;
      reg_number: string;
      asset_type_id: string;
      year?: number;
      status?: string;
      odometer_current?: number;
      assigned_driver_id?: string;
      current_book_value?: string;
      remaining_depreciation_months?: number;
      notes?: string;
    };

    if (!body.short_name?.trim() || !body.reg_number?.trim() || !body.asset_type_id) {
      return NextResponse.json({ error: 'Название, госномер и тип обязательны' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await (supabase.from('assets') as any)
      .insert({
        short_name: body.short_name.trim(),
        reg_number: body.reg_number.trim(),
        asset_type_id: body.asset_type_id,
        year: body.year ?? null,
        status: body.status ?? 'active',
        odometer_current: body.odometer_current ?? 0,
        assigned_driver_id: body.assigned_driver_id || null,
        current_book_value: body.current_book_value || null,
        remaining_depreciation_months: body.remaining_depreciation_months ?? null,
        notes: body.notes?.trim() || null,
        needs_update: false,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
