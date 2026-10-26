/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ADVANCE_CATEGORY_ID = 'a0000000-0000-0000-0000-000000000001';
const PAYROLL_MECHANIC_CAT = '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6';

const WALLET_LABELS: Record<string, string> = {
  '10000000-0000-0000-0000-000000000001': 'Р/С (Банк)',
  '10000000-0000-0000-0000-000000000002': 'Касса (Наличные)',
  '10000000-0000-0000-0000-000000000003': 'Перевод на карту',
  '10000000-0000-0000-0000-000000000005': 'Касса СТО (Гараж)',
};

/** GET /api/mechanic/salary?year=2026&month=5 — начисления ЗП и история выплат механика */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cookieStore = await cookies();
  const userId =
    searchParams.get('mechanic_id') ||
    cookieStore.get('salda_user_id')?.value ||
    request.headers.get('x-salda-user-id');

  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()));
  const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1));

  const periodStart = new Date(year, month - 1, 1).toISOString();
  const periodEnd = new Date(year, month, 0, 23, 59, 59).toISOString();

  const supabase = createAdminClient();

  const { data: payrollCat } = await (supabase.from('transaction_categories') as any)
    .select('id')
    .eq('code', 'PAYROLL_MECHANIC')
    .maybeSingle();

  const categoryId = payrollCat?.id || PAYROLL_MECHANIC_CAT;

  const [
    { data: accruals, error },
    { data: pendingConf },
    { count: unconfirmedCount },
    { data: allTimeUnpaidRows },
    { data: payoutsRows },
    { data: sto },
    { data: mechUser },
    { data: draftOrders },
  ] = await Promise.all([
    // 1. Подтверждённые начисления за выбранный месяц (без транзакций фактической выплаты из кошелька)
    (supabase.from('transactions') as any)
      .select(
        `
        id, amount, settlement_status, lifecycle_status, description, created_at, transaction_date, from_wallet_id,
        service_order:service_orders(
          id, order_number, machine_type, client_vehicle_brand, client_vehicle_model, client_vehicle_reg,
          asset:assets(short_name, reg_number),
          service_order_works(norm_minutes, actual_minutes, status, custom_work_name, work_catalog:work_catalog(name))
        )
      `,
      )
      .eq('direction', 'expense')
      .eq('related_user_id', userId)
      .eq('category_id', categoryId)
      .eq('lifecycle_status', 'approved')
      .is('from_wallet_id', null)
      .not('description', 'ilike', 'Выплата зарплаты%')
      .or('employee_confirmed.is.null,employee_confirmed.eq.true')
      .gte('transaction_date', periodStart)
      .lte('transaction_date', periodEnd)
      .order('transaction_date', { ascending: false }),

    // 2. Ожидают подтверждения механиком (all-time)
    (supabase.from('transactions') as any)
      .select(
        `id, amount, description, transaction_date,
         service_order:service_orders(
           id, order_number, machine_type, client_vehicle_brand, client_vehicle_model, client_vehicle_reg,
           asset:assets(short_name, reg_number)
         )`,
      )
      .eq('direction', 'expense')
      .eq('related_user_id', userId)
      .eq('category_id', categoryId)
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'pending')
      .is('from_wallet_id', null)
      .eq('employee_confirmed', false)
      .order('transaction_date', { ascending: true }),

    // 3. Счётчик неподтверждённых
    (supabase.from('transactions') as any)
      .select('*', { count: 'exact', head: true })
      .eq('related_user_id', userId)
      .eq('category_id', categoryId)
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'pending')
      .is('from_wallet_id', null)
      .eq('employee_confirmed', false),

    // 4. Вся невыплаченная подтверждённая ЗП (all-time К выплате сейчас)
    (supabase.from('transactions') as any)
      .select('amount')
      .eq('direction', 'expense')
      .eq('related_user_id', userId)
      .eq('category_id', categoryId)
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'pending')
      .is('from_wallet_id', null)
      .not('description', 'ilike', 'Выплата зарплаты%')
      .or('employee_confirmed.is.null,employee_confirmed.eq.true'),

    // 5. История выплат (фактические выплаты из кассы/банка и авансы)
    (supabase.from('transactions') as any)
      .select(
        'id, amount, direction, description, created_at, transaction_date, category_id, from_wallet_id, settlement_status',
      )
      .eq('related_user_id', userId)
      .eq('lifecycle_status', 'approved')
      .or(
        `from_wallet_id.not.is.null,description.ilike.Выплата зарплаты%,category_id.eq.${ADVANCE_CATEGORY_ID}`,
      )
      .order('transaction_date', { ascending: false })
      .limit(50),

    // 6. Настройки СТО
    (supabase.from('sto_settings') as any)
      .select('hourly_rate, hourly_rate_own')
      .limit(1)
      .maybeSingle(),

    // 7. Процент механика
    (supabase.from('users') as any).select('mechanic_salary_pct').eq('id', userId).maybeSingle(),

    // 8. Наряды на проверке (draft), чтобы показать расчётную сумму на проверке
    (supabase.from('service_orders') as any)
      .select(
        `id, machine_type, status, lifecycle_status,
         works:service_order_works(status, norm_minutes, actual_minutes, price_client, quantity)`,
      )
      .or(`assigned_mechanic_id.eq.${userId},created_by.eq.${userId}`)
      .eq('lifecycle_status', 'draft'),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rateClient = parseFloat(sto?.hourly_rate ?? '2000') || 2000;
  const rateOwn = parseFloat(sto?.hourly_rate_own ?? '1600') || 1600;
  const salaryPct =
    mechUser?.mechanic_salary_pct != null && !isNaN(Number(mechUser.mechanic_salary_pct))
      ? Number(mechUser.mechanic_salary_pct)
      : 50;

  let draftPayTotal = 0;
  for (const ord of draftOrders ?? []) {
    const isOwn = ord.machine_type === 'own';
    const hourlyRate = isOwn ? rateOwn : rateClient;
    for (const w of ord.works ?? []) {
      if (w.status === 'cancelled') continue;
      const qty = Math.max(1, Number(w.quantity ?? 1));
      const mins = Number(w.actual_minutes || w.norm_minutes || 0) * qty;
      const explicitPrice = parseFloat(w.price_client ?? '0');
      const workClientPrice = explicitPrice > 0 ? explicitPrice : (mins / 60) * hourlyRate;
      draftPayTotal += (workClientPrice * salaryPct) / 100;
    }
  }

  const totalAccrued = (accruals ?? []).reduce(
    (sum: number, t: any) => sum + parseFloat(t.amount ?? '0'),
    0,
  );
  const totalPaidInPeriod = (accruals ?? [])
    .filter((t: any) => t.settlement_status === 'completed')
    .reduce((sum: number, t: any) => sum + parseFloat(t.amount ?? '0'), 0);

  const allTimeToPay = (allTimeUnpaidRows ?? []).reduce(
    (sum: number, t: any) => sum + parseFloat(t.amount ?? '0'),
    0,
  );

  const formattedPayouts = (payoutsRows ?? [])
    .filter((t: any) => {
      // Исключаем зачёты аванса (income ADVANCE_CATEGORY_ID без кошелька), оставляя реальные выплаты и выданные авансы
      if (t.category_id === ADVANCE_CATEGORY_ID && t.direction === 'income') return false;
      return true;
    })
    .map((t: any) => {
      const isAdvance = t.category_id === ADVANCE_CATEGORY_ID;
      const walletLabel = t.from_wallet_id
        ? WALLET_LABELS[t.from_wallet_id] || 'Выплата из кассы'
        : isAdvance
          ? 'Аванс'
          : 'Выплата зарплаты';
      return {
        id: t.id,
        amount: parseFloat(t.amount ?? '0').toFixed(2),
        description: t.description || (isAdvance ? 'Выдача аванса' : 'Выплата зарплаты'),
        wallet_label: walletLabel,
        is_advance: isAdvance,
        date: t.transaction_date || t.created_at,
      };
    });

  const pendingItems = (pendingConf ?? []).map((t: any) => {
    const d = t.transaction_date;
    const dateStr = d
      ? new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
      : null;
    const so = t.service_order;
    const vehicleLabel = so
      ? so.machine_type === 'own'
        ? so.asset?.short_name
        : [so.client_vehicle_brand || so.client_vehicle_model, so.client_vehicle_reg]
            .filter(Boolean)
            .join(' ')
      : null;

    return {
      id: t.id,
      amount: t.amount,
      context: [so ? `Наряд #${so.order_number}` : null, vehicleLabel || null, dateStr]
        .filter(Boolean)
        .join(' · '),
    };
  });

  return NextResponse.json({
    accruals: accruals ?? [],
    payouts: formattedPayouts,
    pending_confirmation: pendingItems,
    pending_confirmation_count: unconfirmedCount ?? 0,
    rates: {
      hourly_rate_client: rateClient,
      hourly_rate_own: rateOwn,
      mechanic_salary_pct: salaryPct,
    },
    summary: {
      total_accrued: totalAccrued.toFixed(2),
      total_paid: totalPaidInPeriod.toFixed(2),
      to_pay: allTimeToPay.toFixed(2),
      draft_pay: draftPayTotal.toFixed(2),
    },
  });
}
