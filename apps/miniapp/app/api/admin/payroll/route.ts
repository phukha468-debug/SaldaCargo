/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const PAYROLL_CATEGORY_IDS = [
  'd79213ee-3bc6-4433-b58a-ca7ea1040d00', // PAYROLL_DRIVER
  '18792fa8-fda8-472d-8e04-e19d2c6c053c', // PAYROLL_LOADER
  '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6', // PAYROLL_MECHANIC
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()));
    const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1));

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
      (supabase as any)
        .from('users')
        .select('id, name, roles, auto_settle')
        .eq('is_active', true)
        .order('name'),

      (supabase as any)
        .from('trips')
        .select('driver_id, trip_orders(driver_pay)')
        .eq('lifecycle_status', 'approved')
        .gte('started_at', monthStart)
        .lte('started_at', monthEnd),

      (supabase as any)
        .from('trips')
        .select('loader_id, trip_orders(loader_pay)')
        .eq('lifecycle_status', 'approved')
        .not('loader_id', 'is', null)
        .gte('started_at', monthStart)
        .lte('started_at', monthEnd),

      (supabase as any)
        .from('trips')
        .select('loader2_id, trip_orders(loader2_pay)')
        .eq('lifecycle_status', 'approved')
        .not('loader2_id', 'is', null)
        .gte('started_at', monthStart)
        .lte('started_at', monthEnd),

      (supabase as any)
        .from('service_orders')
        .select('assigned_mechanic_id, mechanic_pay')
        .eq('status', 'completed')
        .not('assigned_mechanic_id', 'is', null)
        .not('mechanic_pay', 'is', null)
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd),

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

    const paidMap = new Map<string, number>();
    for (const tx of (paidRows as any[]) ?? []) {
      const uid = tx.related_user_id;
      if (uid) paidMap.set(uid, (paidMap.get(uid) ?? 0) + parseFloat(tx.amount ?? '0'));
    }

    const OPERATIONAL = ['driver', 'loader', 'mechanic', 'mechanic_lead'];
    const result = ((users as any[]) ?? [])
      .filter((u: any) => u.roles.some((r: string) => OPERATIONAL.includes(r)))
      .map((u: any) => {
        const earned = earnedMap.get(u.id) ?? 0;
        const paid = paidMap.get(u.id) ?? 0;
        const debt = u.auto_settle ? 0 : Math.max(earned - paid, 0);
        return {
          id: u.id,
          name: u.name,
          roles: u.roles,
          auto_settle: u.auto_settle,
          earned: earned.toFixed(2),
          paid: paid.toFixed(2),
          debt: debt.toFixed(2),
        };
      })
      .filter((u) => parseFloat(u.earned) > 0 || parseFloat(u.debt) > 0);

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
