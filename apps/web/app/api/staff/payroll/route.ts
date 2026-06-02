/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const SALARY_CATEGORY_IDS = [
  'd79213ee-3bc6-4433-b58a-ca7ea1040d00', // PAYROLL_DRIVER
  '18792fa8-fda8-472d-8e04-e19d2c6c053c', // PAYROLL_LOADER
  '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6', // PAYROLL_MECHANIC
];
const ADVANCE_CATEGORY_ID = 'a0000000-0000-0000-0000-000000000001';

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
      // ЗП начисленная за месяц (pending + completed, approved) — "заработал"
      { data: earnedThisMonth },
      // ЗП выплаченная за месяц (completed) — "получил деньгами"
      { data: paidThisMonth },
      // Всего pending ЗП (all-time) — "долг к выплате"
      { data: pendingAllTime },
      // Всего выплачено ЗП (all-time completed) — для общей статистики
      { data: paidAllTime },
      // Авансы выданные (all-time expense)
      { data: advanceGiven },
      // Авансы зачтённые (all-time income offset records)
      { data: advanceOffset },
      // История выплат + авансов для каждого сотрудника
      { data: payHistory },
    ] = await Promise.all([
      (supabase as any)
        .from('users')
        .select(
          'id, name, roles, auto_settle, max_user_id, current_asset_id, is_active, phone, notes',
        )
        .eq('is_active', true)
        .order('name'),

      (supabase as any)
        .from('transactions')
        .select('related_user_id, amount, settlement_status')
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

      (supabase as any)
        .from('transactions')
        .select('related_user_id, amount')
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .in('category_id', SALARY_CATEGORY_IDS)
        .not('related_user_id', 'is', null),

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

      // История: все PAYROLL + ADVANCE транзакции, последние 50 на сотрудника
      (supabase as any)
        .from('transactions')
        .select(
          'id, related_user_id, amount, direction, description, created_at, settlement_status, category_id',
        )
        .eq('lifecycle_status', 'approved')
        .or(`category_id.in.(${[...SALARY_CATEGORY_IDS, ADVANCE_CATEGORY_ID].join(',')})`)
        .not('related_user_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    // Машины
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

    // Агрегация по сотруднику
    const sumByUser = (rows: any[] | null) => {
      const map = new Map<string, number>();
      for (const r of rows ?? []) {
        const uid = r.related_user_id;
        if (uid) map.set(uid, (map.get(uid) ?? 0) + parseFloat(r.amount ?? '0'));
      }
      return map;
    };

    const countByUser = (rows: any[] | null) => {
      const map = new Map<string, number>();
      for (const r of rows ?? []) {
        const uid = r.related_user_id;
        if (uid) map.set(uid, (map.get(uid) ?? 0) + 1);
      }
      return map;
    };

    const earnedThisMonthMap = sumByUser(earnedThisMonth);
    const shiftsThisMonthMap = countByUser(earnedThisMonth);
    const paidThisMonthMap = sumByUser(paidThisMonth);
    const pendingMap = sumByUser(pendingAllTime);
    const paidAllTimeMap = sumByUser(paidAllTime);
    const advanceGivenMap = sumByUser(advanceGiven);
    const advanceOffsetMap = sumByUser(advanceOffset);

    // История по сотруднику (map: userId → последние записи)
    const historyMap = new Map<string, any[]>();
    for (const r of (payHistory as any[]) ?? []) {
      const uid = r.related_user_id;
      if (!uid) continue;
      const list = historyMap.get(uid) ?? [];
      if (list.length < 50) list.push(r);
      historyMap.set(uid, list);
    }

    const buildUser = (u: any) => {
      const earnedMonth = earnedThisMonthMap.get(u.id) ?? 0;
      const paidMonth = paidThisMonthMap.get(u.id) ?? 0;
      const pendingDebt = pendingMap.get(u.id) ?? 0; // долг к выплате (all-time)
      const paidAlltime = paidAllTimeMap.get(u.id) ?? 0;
      const advGiven = advanceGivenMap.get(u.id) ?? 0;
      const advOffset = advanceOffsetMap.get(u.id) ?? 0;
      const advanceBalance = Math.max(0, advGiven - advOffset); // остаток долга по авансу

      // К выплате = pending ЗП − аванс (остаток), не меньше 0
      const offsetNow = Math.min(pendingDebt, advanceBalance);
      const payoutNow = Math.max(0, pendingDebt - offsetNow);

      return {
        id: u.id,
        name: u.name,
        roles: u.roles,
        auto_settle: u.auto_settle,
        max_user_id: u.max_user_id,
        phone: u.phone,
        notes: u.notes,
        asset: u.current_asset_id ? (assetMap[u.current_asset_id] ?? null) : null,
        // Этот месяц
        shifts: shiftsThisMonthMap.get(u.id) ?? 0, // количество начислений за месяц
        earned: earnedMonth.toFixed(2), // начислено за месяц
        paid: paidMonth.toFixed(2), // выплачено за месяц (completed)
        // All-time долги
        debt: pendingDebt.toFixed(2), // всего pending к выплате
        advance_balance: advanceBalance.toFixed(2), // остаток долга по авансу
        advance_offset: offsetNow.toFixed(2), // сколько зачтётся
        payout: payoutNow.toFixed(2), // сколько реально выплатить деньгами
        // Статистика
        all_time_paid: paidAlltime.toFixed(2),
        // История выплат и авансов
        history: historyMap.get(u.id) ?? [],
      };
    };

    const all = ((users as any[]) ?? []).map(buildUser);

    const byRole = (role: string) => all.filter((u) => u.roles.includes(role));

    // Деdup: каждый пользователь попадает только в один таб.
    // Приоритет: mechanic_lead > mechanic > driver > loader > office.
    const assignedIds = new Set<string>();

    const mechanics = (() => {
      const raw = [...byRole('mechanic_lead'), ...byRole('mechanic')]
        .filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i)
        .filter((u) => !assignedIds.has(u.id));
      raw.forEach((u) => assignedIds.add(u.id));
      return raw;
    })();

    const drivers = (() => {
      const raw = byRole('driver').filter((u) => !assignedIds.has(u.id));
      raw.forEach((u) => assignedIds.add(u.id));
      return raw;
    })();

    const loaders = (() => {
      const raw = byRole('loader').filter((u) => !assignedIds.has(u.id));
      raw.forEach((u) => assignedIds.add(u.id));
      return raw;
    })();

    const office = all.filter((u) => !assignedIds.has(u.id));

    return NextResponse.json({
      drivers,
      loaders,
      mechanics,
      office,
      total_earned_month: all.reduce((s, u) => s + parseFloat(u.earned), 0).toFixed(2),
      total_paid_month: all.reduce((s, u) => s + parseFloat(u.paid), 0).toFixed(2),
      total_debt_alltime: all.reduce((s, u) => s + parseFloat(u.debt), 0).toFixed(2),
      total_payout_alltime: all.reduce((s, u) => s + parseFloat(u.payout), 0).toFixed(2),
      total_paid_alltime: all.reduce((s, u) => s + parseFloat(u.all_time_paid), 0).toFixed(2),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
