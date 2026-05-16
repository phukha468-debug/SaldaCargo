/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const SALARY_CATEGORY_IDS = [
  'd79213ee-3bc6-4433-b58a-ca7ea1040d00', // PAYROLL_DRIVER
  '18792fa8-fda8-472d-8e04-e19d2c6c053c', // PAYROLL_LOADER
  '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6', // PAYROLL_MECHANIC
];
const ADVANCE_CATEGORY_ID = 'a0000000-0000-0000-0000-000000000001';
const PAYROLL_CATEGORY_IDS = [...SALARY_CATEGORY_IDS, ADVANCE_CATEGORY_ID];

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
      { data: loaderTrips },
      { data: mechanicOrders },
      { data: paidRows },
      // All-time data for balance calculation
      { data: allTimeDriverTrips },
      { data: allTimeLoaderTrips },
      { data: allTimeMechanicOrders },
      { data: allTimePaid },
      { data: allTimeAdvances },
    ] = await Promise.all([
      // Все активные сотрудники
      (supabase as any)
        .from('users')
        .select(
          'id, name, roles, auto_settle, max_user_id, current_asset_id, is_active, phone, notes',
        )
        .eq('is_active', true)
        .order('name'),

      // ЗП водителей (driver_pay из одобренных рейсов — этот месяц)
      (supabase as any)
        .from('trips')
        .select('driver_id, trip_orders(driver_pay, lifecycle_status)')
        .eq('lifecycle_status', 'approved')
        .gte('started_at', monthStart)
        .lte('started_at', monthEnd),

      // ЗП грузчиков (этот месяц)
      (supabase as any)
        .from('trips')
        .select('trip_orders(loader_id, loader2_id, loader_pay, loader2_pay, lifecycle_status)')
        .eq('lifecycle_status', 'approved')
        .gte('started_at', monthStart)
        .lte('started_at', monthEnd),

      // ЗП механиков (этот месяц)
      (supabase as any)
        .from('service_orders')
        .select('assigned_mechanic_id, mechanic_pay')
        .eq('status', 'completed')
        .not('assigned_mechanic_id', 'is', null)
        .not('mechanic_pay', 'is', null)
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd),

      // Выплаченная ЗП + авансы за этот месяц (совпадает с группой "Зарплата" в финансах)
      (supabase as any)
        .from('transactions')
        .select('related_user_id, amount')
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .in('category_id', PAYROLL_CATEGORY_IDS)
        .not('related_user_id', 'is', null)
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd),

      // All-time: заработок водителей (для баланса)
      (supabase as any)
        .from('trips')
        .select('driver_id, trip_orders(driver_pay, lifecycle_status)')
        .eq('lifecycle_status', 'approved'),

      // All-time: заработок грузчиков
      (supabase as any)
        .from('trips')
        .select('trip_orders(loader_id, loader2_id, loader_pay, loader2_pay, lifecycle_status)')
        .eq('lifecycle_status', 'approved'),

      // All-time: заработок механиков
      (supabase as any)
        .from('service_orders')
        .select('assigned_mechanic_id, mechanic_pay')
        .eq('status', 'completed')
        .not('assigned_mechanic_id', 'is', null)
        .not('mechanic_pay', 'is', null),

      // All-time: выплаченная ЗП (без авансов — для расчёта баланса)
      (supabase as any)
        .from('transactions')
        .select('related_user_id, amount')
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .in('category_id', SALARY_CATEGORY_IDS)
        .not('related_user_id', 'is', null),

      // All-time: только авансы с датами (для расчёта и отображения)
      (supabase as any)
        .from('transactions')
        .select('related_user_id, amount, created_at')
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .eq('category_id', ADVANCE_CATEGORY_ID)
        .not('related_user_id', 'is', null)
        .order('created_at', { ascending: false }),
    ]);

    // ── Агрегация earned (этот месяц) ───────────────────────────────────────

    const earnedMap = new Map<string, number>();

    for (const trip of (driverTrips as any[]) ?? []) {
      const uid = trip.driver_id;
      if (!uid) continue;
      const pay = ((trip.trip_orders as any[]) ?? [])
        .filter((o: any) => o.lifecycle_status !== 'cancelled')
        .reduce((s: number, o: any) => s + parseFloat(o.driver_pay ?? '0'), 0);
      earnedMap.set(uid, (earnedMap.get(uid) ?? 0) + pay);
    }

    for (const trip of (loaderTrips as any[]) ?? []) {
      for (const order of (trip.trip_orders as any[]) ?? []) {
        if (order.lifecycle_status === 'cancelled') continue;
        if (order.loader_id) {
          earnedMap.set(
            order.loader_id,
            (earnedMap.get(order.loader_id) ?? 0) + parseFloat(order.loader_pay ?? '0'),
          );
        }
        if (order.loader2_id) {
          earnedMap.set(
            order.loader2_id,
            (earnedMap.get(order.loader2_id) ?? 0) + parseFloat(order.loader2_pay ?? '0'),
          );
        }
      }
    }

    for (const order of (mechanicOrders as any[]) ?? []) {
      const uid = order.assigned_mechanic_id;
      if (!uid) continue;
      earnedMap.set(uid, (earnedMap.get(uid) ?? 0) + parseFloat(order.mechanic_pay ?? '0'));
    }

    // ── Агрегация paid (этот месяц) ─────────────────────────────────────────

    const paidMap = new Map<string, number>();
    for (const tx of (paidRows as any[]) ?? []) {
      const uid = tx.related_user_id;
      if (uid) paidMap.set(uid, (paidMap.get(uid) ?? 0) + parseFloat(tx.amount ?? '0'));
    }

    // ── All-time баланс (заработок − выплаты − авансы) ──────────────────────

    const allEarnedMap = new Map<string, number>();

    for (const trip of (allTimeDriverTrips as any[]) ?? []) {
      const uid = trip.driver_id;
      if (!uid) continue;
      const pay = ((trip.trip_orders as any[]) ?? [])
        .filter((o: any) => o.lifecycle_status !== 'cancelled')
        .reduce((s: number, o: any) => s + parseFloat(o.driver_pay ?? '0'), 0);
      allEarnedMap.set(uid, (allEarnedMap.get(uid) ?? 0) + pay);
    }

    for (const trip of (allTimeLoaderTrips as any[]) ?? []) {
      for (const order of (trip.trip_orders as any[]) ?? []) {
        if (order.lifecycle_status === 'cancelled') continue;
        if (order.loader_id) {
          allEarnedMap.set(
            order.loader_id,
            (allEarnedMap.get(order.loader_id) ?? 0) + parseFloat(order.loader_pay ?? '0'),
          );
        }
        if (order.loader2_id) {
          allEarnedMap.set(
            order.loader2_id,
            (allEarnedMap.get(order.loader2_id) ?? 0) + parseFloat(order.loader2_pay ?? '0'),
          );
        }
      }
    }

    for (const order of (allTimeMechanicOrders as any[]) ?? []) {
      const uid = order.assigned_mechanic_id;
      if (!uid) continue;
      allEarnedMap.set(uid, (allEarnedMap.get(uid) ?? 0) + parseFloat(order.mechanic_pay ?? '0'));
    }

    const allPaidMap = new Map<string, number>();
    for (const tx of (allTimePaid as any[]) ?? []) {
      const uid = tx.related_user_id;
      if (uid) allPaidMap.set(uid, (allPaidMap.get(uid) ?? 0) + parseFloat(tx.amount ?? '0'));
    }

    const allAdvanceMap = new Map<string, number>();
    const allAdvanceListMap = new Map<string, { amount: string; date: string }[]>();
    for (const tx of (allTimeAdvances as any[]) ?? []) {
      const uid = tx.related_user_id;
      if (!uid) continue;
      allAdvanceMap.set(uid, (allAdvanceMap.get(uid) ?? 0) + parseFloat(tx.amount ?? '0'));
      const list = allAdvanceListMap.get(uid) ?? [];
      list.push({ amount: parseFloat(tx.amount).toFixed(2), date: tx.created_at });
      allAdvanceListMap.set(uid, list);
    }

    // ── workCount ────────────────────────────────────────────────────────────

    const tripCountMap = new Map<string, number>();
    for (const trip of (driverTrips as any[]) ?? []) {
      if (trip.driver_id)
        tripCountMap.set(trip.driver_id, (tripCountMap.get(trip.driver_id) ?? 0) + 1);
    }
    for (const trip of (loaderTrips as any[]) ?? []) {
      const loaderIds = new Set<string>();
      for (const order of (trip.trip_orders as any[]) ?? []) {
        if (order.lifecycle_status === 'cancelled') continue;
        if (order.loader_id) loaderIds.add(order.loader_id);
        if (order.loader2_id) loaderIds.add(order.loader2_id);
      }
      for (const uid of loaderIds) {
        tripCountMap.set(uid, (tripCountMap.get(uid) ?? 0) + 1);
      }
    }
    const orderCountMap = new Map<string, number>();
    for (const o of (mechanicOrders as any[]) ?? []) {
      if (o.assigned_mechanic_id)
        orderCountMap.set(
          o.assigned_mechanic_id,
          (orderCountMap.get(o.assigned_mechanic_id) ?? 0) + 1,
        );
    }

    // ── Машины ──────────────────────────────────────────────────────────────

    const assetIds = [
      ...new Set(((users as any[]) ?? []).map((u: any) => u.current_asset_id).filter(Boolean)),
    ];
    const assetMap: Record<string, { short_name: string; reg_number: string }> = {};
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

      const allEarned = allEarnedMap.get(u.id) ?? 0;
      const allPaidSalary = allPaidMap.get(u.id) ?? 0;
      const allPaidAdvance = allAdvanceMap.get(u.id) ?? 0;

      // Аванс висит «в долг» только если выданный аванс превышает незакрытый заработок
      const uncoveredEarnings = Math.max(0, allEarned - allPaidSalary);
      const advanceOutstanding = Math.max(0, allPaidAdvance - uncoveredEarnings);

      // Долг к выплате: если аванс ещё не покрыт — к выплате 0, иначе earned−paid за месяц
      const allTimeBalance = allEarned - allPaidSalary - allPaidAdvance;
      const debt = allTimeBalance > 0 ? Math.max(earned - paid, 0) : 0;

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
        debt: debt.toFixed(2),
        advance_outstanding: advanceOutstanding.toFixed(2),
        advances: allAdvanceListMap.get(u.id) ?? [],
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
