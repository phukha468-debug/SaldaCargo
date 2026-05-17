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

  // Транзакции начисления ЗП по этому механику за период
  const { data: accruals, error } = await (supabase.from('transactions') as any)
    .select(
      `
      id, amount, settlement_status, lifecycle_status, description, created_at,
      service_order:service_orders(
        id, order_number,
        asset:assets(short_name, reg_number),
        service_order_works(norm_minutes, actual_minutes, status)
      )
    `,
    )
    .eq('direction', 'expense')
    .eq('category_id', payrollCat?.id)
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Считаем итоги
  const totalAccrued = (accruals ?? []).reduce(
    (sum: number, t: any) => sum + parseFloat(t.amount ?? '0'),
    0,
  );
  const totalPaid = (accruals ?? [])
    .filter((t: any) => t.settlement_status === 'completed')
    .reduce((sum: number, t: any) => sum + parseFloat(t.amount ?? '0'), 0);

  return NextResponse.json({
    accruals: accruals ?? [],
    summary: {
      total_accrued: totalAccrued.toFixed(2),
      total_paid: totalPaid.toFixed(2),
      to_pay: (totalAccrued - totalPaid).toFixed(2),
    },
  });
}
