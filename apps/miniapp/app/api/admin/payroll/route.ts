/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const SALARY_CATEGORY_IDS = [
  'd79213ee-3bc6-4433-b58a-ca7ea1040d00', // PAYROLL_DRIVER
  '18792fa8-fda8-472d-8e04-e19d2c6c053c', // PAYROLL_LOADER
  '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6', // PAYROLL_MECHANIC
];

const MANAGEMENT_ROLES = ['owner', 'admin'];
const OPERATIONAL_ROLES = ['driver', 'loader', 'mechanic', 'mechanic_lead'];

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
    ] = await Promise.all([
      (supabase as any)
        .from('users')
        .select('id, name, roles, auto_settle, is_active')
        .eq('is_active', true)
        .order('name'),

      (supabase as any)
        .from('transactions')
        .select('related_user_id, amount')
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .in('category_id', SALARY_CATEGORY_IDS)
        .not('related_user_id', 'is', null)
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd),

      (supabase as any)
        .from('transactions')
        .select('related_user_id, amount')
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .in('category_id', SALARY_CATEGORY_IDS)
        .not('related_user_id', 'is', null)
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd),

      (supabase as any)
        .from('transactions')
        .select('related_user_id, amount')
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'pending')
        .in('category_id', SALARY_CATEGORY_IDS)
        .not('related_user_id', 'is', null),
    ]);

    const sumByUser = (rows: any[] | null) => {
      const map = new Map<string, number>();
      for (const r of rows ?? []) {
        const uid = r.related_user_id;
        if (uid) map.set(uid, (map.get(uid) ?? 0) + parseFloat(r.amount ?? '0'));
      }
      return map;
    };

    const earnedMap = sumByUser(earnedThisMonth);
    const paidMap = sumByUser(paidThisMonth);
    const pendingMap = sumByUser(pendingAllTime);

    const result = ((users as any[]) ?? [])
      .map((u: any) => {
        const isManagement = (u.roles as string[]).some((r: string) =>
          MANAGEMENT_ROLES.includes(r),
        );
        const isOp = (u.roles as string[]).some((r: string) => OPERATIONAL_ROLES.includes(r));
        if (!isOp && !isManagement) return null;

        const earned = earnedMap.get(u.id) ?? 0;
        const paid = paidMap.get(u.id) ?? 0;
        const debt = u.auto_settle ? 0 : (pendingMap.get(u.id) ?? 0);

        return {
          id: u.id,
          name: u.name,
          roles: u.roles,
          auto_settle: u.auto_settle,
          is_management: isManagement && !isOp,
          earned: earned.toFixed(2),
          paid: paid.toFixed(2),
          debt: debt.toFixed(2),
        };
      })
      .filter((u): u is NonNullable<typeof u> => u !== null)
      .filter((u) => u.is_management || parseFloat(u.earned) > 0 || parseFloat(u.debt) > 0);

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
