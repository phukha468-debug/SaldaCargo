/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/** GET /api/mechanic/salary?year=2026&month=5 — начисления ЗП механика */
export async function GET(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('salda_user_id')?.value;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()));
  const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1));

  const periodStart = new Date(year, month - 1, 1).toISOString();
  const periodEnd = new Date(year, month, 0, 23, 59, 59).toISOString();

  const supabase = createAdminClient();

  const { data: payrollCat } = await (supabase.from('transaction_categories') as any)
    .select('id')
    .eq('code', 'PAYROLL_MECHANIC')
    .single();

  const categoryId = payrollCat?.id;

  const [{ data: accruals, error }, { data: pendingConf }, { count: unconfirmedCount }] =
    await Promise.all([
      // Подтверждённые начисления за период
      (supabase.from('transactions') as any)
        .select(
          `
          id, amount, settlement_status, lifecycle_status, description, created_at, transaction_date,
          service_order:service_orders(
            id, order_number,
            asset:assets(short_name, reg_number),
            service_order_works(norm_minutes, actual_minutes, status)
          )
        `,
        )
        .eq('direction', 'expense')
        .eq('related_user_id', userId)
        .eq('category_id', categoryId)
        .eq('lifecycle_status', 'approved')
        .or('employee_confirmed.is.null,employee_confirmed.eq.true')
        .gte('transaction_date', periodStart)
        .lte('transaction_date', periodEnd)
        .order('transaction_date', { ascending: false }),

      // Ожидают подтверждения (all-time, для отображения в шапке)
      (supabase.from('transactions') as any)
        .select(
          `id, amount, description, transaction_date,
           service_order:service_orders(id, order_number, asset:assets(short_name))`,
        )
        .eq('direction', 'expense')
        .eq('related_user_id', userId)
        .eq('category_id', categoryId)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'pending')
        .eq('employee_confirmed', false)
        .order('transaction_date', { ascending: true }),

      // Счётчик неподтверждённых (for badge)
      (supabase.from('transactions') as any)
        .select('*', { count: 'exact', head: true })
        .eq('related_user_id', userId)
        .eq('category_id', categoryId)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'pending')
        .eq('employee_confirmed', false),
    ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totalAccrued = (accruals ?? []).reduce(
    (sum: number, t: any) => sum + parseFloat(t.amount ?? '0'),
    0,
  );
  const totalPaid = (accruals ?? [])
    .filter((t: any) => t.settlement_status === 'completed')
    .reduce((sum: number, t: any) => sum + parseFloat(t.amount ?? '0'), 0);

  const pendingItems = (pendingConf ?? []).map((t: any) => {
    const d = t.transaction_date;
    const dateStr = d
      ? new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
      : null;
    return {
      id: t.id,
      amount: t.amount,
      context: [
        t.service_order ? `Наряд #${t.service_order.order_number}` : null,
        t.service_order?.asset?.short_name ?? null,
        dateStr,
      ]
        .filter(Boolean)
        .join(' · '),
    };
  });

  return NextResponse.json({
    accruals: accruals ?? [],
    pending_confirmation: pendingItems,
    pending_confirmation_count: unconfirmedCount ?? 0,
    summary: {
      total_accrued: totalAccrued.toFixed(2),
      total_paid: totalPaid.toFixed(2),
      to_pay: (totalAccrued - totalPaid).toFixed(2),
    },
  });
}
