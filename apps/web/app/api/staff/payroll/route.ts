/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// PAYROLL category IDs (from transaction_categories seed)
const PAYROLL_CATEGORY_IDS = [
  'd79213ee-3bc6-4433-b58a-ca7ea1040d00', // PAYROLL_DRIVER
  '18792fa8-fda8-472d-8e04-e19d2c6c053c', // PAYROLL_LOADER
  '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6', // PAYROLL_MECHANIC
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()));
    const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1));

    const monthStart = new Date(year, month - 1, 1).toISOString();
    const monthEnd = new Date(year, month, 0, 23, 59, 59).toISOString();

    const supabase = createAdminClient();

    const [
      { data: users },
      { data: driverTrips },
      { data: loader1Trips },
      { data: loader2Trips },
      { data: mechanicOrders },
      { data: paidRows },
    ] = await Promise.all([
      // Все активные сотрудники
      (supabase as any)
        .from('users')
        .select(
          'id, name, roles, auto_settle, max_user_id, current_asset_id, is_active, phone, notes',
        )
        .eq('is_active', true)
        .order('name'),

      // ЗП водителей (driver_pay из одобренных рейсов)
      (supabase as any)
        .from('trips')
        .select('driver_id, trip_orders(driver_pay)')
        .eq('lifecycle_status', 'approved')
        .gte('started_at', monthStart)
        .lte('started_at', monthEnd),

      // ЗП грузчиков (loader_pay — первый грузчик)
      (supabase as any)
        .from('trips')
        .select('loader_id, trip_orders(loader_pay)')
        .eq('lifecycle_status', 'approved')
        .not('loader_id', 'is', null)
        .gte('started_at', monthStart)
        .lte('started_at', monthEnd),

      // ЗП грузчиков (loader2_pay — второй грузчик)
      (supabase as any)
        .from('trips')
        .select('loader2_id, trip_orders(loader2_pay)')
        .eq('lifecycle_status', 'approved')
        .not('loader2_id', 'is', null)
        .gte('started_at', monthStart)
        .lte('started_at', monthEnd),

      // ЗП механиков (mechanic_pay из завершённых нарядов)
      (supabase as any)
        .from('service_orders')
        .select('assigned_mechanic_id, mechanic_pay')
        .eq('status', 'completed')
        .not('assigned_mechanic_id', 'is', null)
        .not('mechanic_pay', 'is', null)
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd),

      // Уже выплаченные ЗП за месяц
      (supabase as any)
        .from('transactions')
        .select('related_user_id, amount')
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .in('category_id', PAYROLL_CATEGORY_IDS)
        .not('related_user_id', 'is', null)
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd),
    ]);

    // ── Агрегация earned по user_id ──────────────────────────────────────────

    const earnedMap = new Map<string, number>();

    for (const trip of (driverTrips as any[]) ?? []) {
      const uid = trip.driver_id;
      if (!uid) continue;
      const pay = ((trip.trip_orders as any[]) ?? []).reduce(
        (s: number, o: any) => s + parseFloat(o.driver_pay ?? '0'),
        0,
      );
      earnedMap.set(uid, (earnedMap.get(uid) ?? 0) + pay);
    }

    for (const trip of (loader1Trips as any[]) ?? []) {
      const uid = trip.loader_id;
      if (!uid) continue;
      const pay = ((trip.trip_orders as any[]) ?? []).reduce(
        (s: number, o: any) => s + parseFloat(o.loader_pay ?? '0'),
        0,
      );
      earnedMap.set(uid, (earnedMap.get(uid) ?? 0) + pay);
    }

    for (const trip of (loader2Trips as any[]) ?? []) {
      const uid = trip.loader2_id;
      if (!uid) continue;
      const pay = ((trip.trip_orders as any[]) ?? []).reduce(
        (s: number, o: any) => s + parseFloat(o.loader2_pay ?? '0'),
        0,
      );
      earnedMap.set(uid, (earnedMap.get(uid) ?? 0) + pay);
    }

    for (const order of (mechanicOrders as any[]) ?? []) {
      const uid = order.assigned_mechanic_id;
      if (!uid) continue;
      earnedMap.set(uid, (earnedMap.get(uid) ?? 0) + parseFloat(order.mechanic_pay ?? '0'));
    }

    // ── Агрегация paid по user_id ────────────────────────────────────────────

    const paidMap = new Map<string, number>();
    for (const tx of (paidRows as any[]) ?? []) {
      const uid = tx.related_user_id;
      if (uid) paidMap.set(uid, (paidMap.get(uid) ?? 0) + parseFloat(tx.amount ?? '0'));
    }

    // ── Подсчёт workCount ────────────────────────────────────────────────────

    const tripCountMap = new Map<string, number>();
    for (const trip of (driverTrips as any[]) ?? []) {
      if (trip.driver_id)
        tripCountMap.set(trip.driver_id, (tripCountMap.get(trip.driver_id) ?? 0) + 1);
    }
    for (const trip of (loader1Trips as any[]) ?? []) {
      if (trip.loader_id)
        tripCountMap.set(trip.loader_id, (tripCountMap.get(trip.loader_id) ?? 0) + 1);
    }
    for (const trip of (loader2Trips as any[]) ?? []) {
      if (trip.loader2_id)
        tripCountMap.set(trip.loader2_id, (tripCountMap.get(trip.loader2_id) ?? 0) + 1);
    }
    const orderCountMap = new Map<string, number>();
    for (const o of (mechanicOrders as any[]) ?? []) {
      if (o.assigned_mechanic_id)
        orderCountMap.set(
          o.assigned_mechanic_id,
          (orderCountMap.get(o.assigned_mechanic_id) ?? 0) + 1,
        );
    }

    // ── Получить машины для отображения ─────────────────────────────────────

    const assetIds = [
      ...new Set(((users as any[]) ?? []).map((u: any) => u.current_asset_id).filter(Boolean)),
    ];
    let assetMap: Record<string, { short_name: string; reg_number: string }> = {};
    if (assetIds.length > 0) {
      const { data: assets } = await (supabase as any)
        .from('assets')
        .select('id, short_name, reg_number')
        .in('id', assetIds);
      for (const a of assets ?? []) assetMap[a.id] = a;
    }

    // ── Построение ответа ────────────────────────────────────────────────────

    const buildUser = (u: any) => {
      const earned = earnedMap.get(u.id) ?? 0;
      const paid = paidMap.get(u.id) ?? 0;
      const isDriver = u.roles.includes('driver');
      const workCount = isDriver ? (tripCountMap.get(u.id) ?? 0) : (orderCountMap.get(u.id) ?? 0);
      return {
        id: u.id,
        name: u.name,
        roles: u.roles,
        auto_settle: u.auto_settle,
        max_user_id: u.max_user_id,
        phone: u.phone,
        notes: u.notes,
        asset: u.current_asset_id ? (assetMap[u.current_asset_id] ?? null) : null,
        earned: earned.toFixed(2),
        paid: paid.toFixed(2),
        debt: Math.max(earned - paid, 0).toFixed(2),
        work_count: workCount,
      };
    };

    const all = ((users as any[]) ?? []).map(buildUser);

    const byRole = (role: string) => all.filter((u) => u.roles.includes(role));
    const isOperational = (u: any) =>
      u.roles.some((r: string) => ['driver', 'loader', 'mechanic', 'mechanic_lead'].includes(r));
    const office = all.filter((u) => !isOperational(u));

    return NextResponse.json({
      drivers: byRole('driver'),
      loaders: byRole('loader'),
      mechanics: [...byRole('mechanic'), ...byRole('mechanic_lead')].filter(
        (u, i, arr) => arr.findIndex((x) => x.id === u.id) === i,
      ),
      office,
      total_debt: all.reduce((s, u) => s + parseFloat(u.debt), 0).toFixed(2),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
