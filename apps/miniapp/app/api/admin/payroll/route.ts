/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const SALARY_CATEGORY_IDS = [
  'd79213ee-3bc6-4433-b58a-ca7ea1040d00', // PAYROLL_DRIVER
  '18792fa8-fda8-472d-8e04-e19d2c6c053c', // PAYROLL_LOADER
  '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6', // PAYROLL_MECHANIC
];

const MANAGEMENT_ROLES = ['owner', 'admin'];
const OPERATIONAL_ROLES = [
  'driver',
  'loader',
  'mechanic',
  'mechanic_lead',
  'welder',
  'painter',
  'electrician',
  'handyman',
  'cleaner',
];

const ADVANCE_CATEGORY_ID = 'a0000000-0000-0000-0000-000000000001';

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
      // Начислено за месяц: approved payroll-транзакции (pending + completed)
      { data: earnedThisMonth },
      // Выплачено за месяц: approved + completed payroll-транзакции
      { data: paidThisMonth },
      // Долг: all-time pending payroll-транзакции
      { data: pendingAllTime },
      // Выданные авансы / долги (expense)
      { data: advanceGiven },
      // Зачтённые/возвращённые авансы / долги (income)
      { data: advanceOffset },
      // Все рейсы с заказами
      { data: allTrips },
      // Все инкассации
      { data: allCollections },
    ] = await Promise.all([
      (supabase as any)
        .from('users')
        .select('id, name, roles, auto_settle, is_active, notes')
        .eq('is_active', true)
        .order('name'),

      (supabase as any)
        .from('transactions')
        .select('related_user_id, amount, description, from_wallet_id')
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .in('category_id', SALARY_CATEGORY_IDS)
        .not('related_user_id', 'is', null)
        .is('from_wallet_id', null)
        .gte('transaction_date', monthStart)
        .lte('transaction_date', monthEnd),

      (supabase as any)
        .from('transactions')
        .select('related_user_id, amount, description, from_wallet_id')
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .in('category_id', SALARY_CATEGORY_IDS)
        .not('related_user_id', 'is', null)
        .is('from_wallet_id', null)
        .gte('transaction_date', monthStart)
        .lte('transaction_date', monthEnd),

      (supabase as any)
        .from('transactions')
        .select('related_user_id, amount, description, from_wallet_id')
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'pending')
        .in('category_id', SALARY_CATEGORY_IDS)
        .not('related_user_id', 'is', null)
        .is('from_wallet_id', null),

      (supabase as any)
        .from('transactions')
        .select('related_user_id, amount')
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .eq('category_id', ADVANCE_CATEGORY_ID)
        .not('related_user_id', 'is', null),

      (supabase as any)
        .from('transactions')
        .select('related_user_id, amount')
        .eq('direction', 'income')
        .eq('lifecycle_status', 'approved')
        .eq('category_id', ADVANCE_CATEGORY_ID)
        .not('related_user_id', 'is', null),

      (supabase as any)
        .from('trips')
        .select(
          'driver_id, trip_orders(amount, payment_method, lifecycle_status, settlement_status), trip_expenses(amount, payment_method)',
        )
        .neq('lifecycle_status', 'cancelled'),

      (supabase as any).from('cash_collections').select('driver_id, amount'),
    ]);

    const sumByUser = (rows: any[] | null) => {
      const amounts = new Map<string, number>();
      const counts = new Map<string, number>();
      for (const r of rows ?? []) {
        if (r.description && r.description.startsWith('Выплата зарплаты')) continue;
        const uid = r.related_user_id;
        if (uid) {
          amounts.set(uid, (amounts.get(uid) ?? 0) + parseFloat(r.amount ?? '0'));
          counts.set(uid, (counts.get(uid) ?? 0) + 1);
        }
      }
      return { amounts, counts };
    };

    const earned = sumByUser(earnedThisMonth);
    const paid = sumByUser(paidThisMonth);
    const pending = sumByUser(pendingAllTime);
    const advGiven = sumByUser(advanceGiven);
    const advOffset = sumByUser(advanceOffset);

    const userTripsMap = new Map<string, any[]>();
    for (const t of (allTrips as any[]) ?? []) {
      if (!t.driver_id) continue;
      const arr = userTripsMap.get(t.driver_id) ?? [];
      arr.push(t);
      userTripsMap.set(t.driver_id, arr);
    }

    const collectionsMap = new Map<string, number>();
    for (const c of (allCollections as any[]) ?? []) {
      if (!c.driver_id) continue;
      collectionsMap.set(
        c.driver_id,
        (collectionsMap.get(c.driver_id) ?? 0) + parseFloat(c.amount ?? '0'),
      );
    }

    const result = ((users as any[]) ?? [])
      .map((u: any) => {
        const isManagement = (u.roles as string[]).some((r: string) =>
          MANAGEMENT_ROLES.includes(r),
        );
        const isOp = (u.roles as string[]).some((r: string) => OPERATIONAL_ROLES.includes(r));

        const earnedAmt = earned.amounts.get(u.id) ?? 0;
        const earnedCount = earned.counts.get(u.id) ?? 0;
        const paidAmt = paid.amounts.get(u.id) ?? 0;
        const debtAmt = u.auto_settle ? 0 : (pending.amounts.get(u.id) ?? 0);
        const advanceBalance = Math.max(
          0,
          (advGiven.amounts.get(u.id) ?? 0) - (advOffset.amounts.get(u.id) ?? 0),
        );
        const offsetNow = Math.min(debtAmt, advanceBalance);
        const payoutNow = Math.max(0, debtAmt - offsetNow);

        const trips = userTripsMap.get(u.id) ?? [];
        const cashIn = trips
          .flatMap((t: any) => t.trip_orders ?? [])
          .filter(
            (o: any) =>
              o.payment_method === 'cash' &&
              o.lifecycle_status !== 'cancelled' &&
              o.settlement_status === 'completed',
          )
          .reduce((s: number, o: any) => s + parseFloat(o.amount ?? '0'), 0);

        const cashSpent = trips
          .flatMap((t: any) => t.trip_expenses ?? [])
          .filter((e: any) => e.payment_method === 'cash')
          .reduce((s: number, e: any) => s + parseFloat(e.amount ?? '0'), 0);

        const cashCollected = collectionsMap.get(u.id) ?? 0;
        const uncollectedCash = Math.max(
          0,
          Math.round((cashIn - cashSpent - cashCollected) * 100) / 100,
        );

        let isOnline = false;
        let address = '';
        let hasTransport = false;

        if (u.notes) {
          try {
            const parsed = typeof u.notes === 'string' ? JSON.parse(u.notes) : u.notes;
            if (typeof parsed === 'object' && parsed !== null) {
              isOnline = Boolean(parsed.online);
              address = String(parsed.address || '');
              hasTransport = Boolean(parsed.car);
            }
          } catch {
            // ignore non-json notes
          }
        }

        return {
          id: u.id,
          name: u.name,
          roles: u.roles,
          notes: u.notes,
          is_online: isOnline,
          address,
          has_transport: hasTransport,
          auto_settle: u.auto_settle,
          is_management: isManagement && !isOp,
          earned: earnedAmt.toFixed(2),
          paid: paidAmt.toFixed(2),
          debt: debtAmt.toFixed(2),
          advance_balance: advanceBalance.toFixed(2),
          advance_offset: offsetNow.toFixed(2),
          payout: payoutNow.toFixed(2),
          uncollected_cash: uncollectedCash.toFixed(2),
          shifts: earnedCount,
        };
      })
      .filter((u): u is NonNullable<typeof u> => u !== null);

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
