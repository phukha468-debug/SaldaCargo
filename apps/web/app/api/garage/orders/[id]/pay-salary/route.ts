/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const CAT_PAYROLL_MECHANIC = '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6';

/**
 * POST /api/garage/orders/[id]/pay-salary
 * Начислить ЗП за выполненные работы наряда (salary_paid=false, status=completed).
 * Создаёт PAYROLL_MECHANIC транзакцию, сохраняет mechanic_pay в service_orders.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;

  const cookieStore = await cookies();
  const userId = cookieStore.get('salda_auth_token')?.value;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();

  // Fetch order with mechanic info and unpaid completed works
  const { data: order, error: orderErr } = await (supabase as any)
    .from('service_orders')
    .select(
      `
      id, order_number, machine_type,
      mechanic_pay, second_mechanic_pay,
      mechanic:users!service_orders_assigned_mechanic_id_fkey(id, name, mechanic_salary_pct),
      second_mechanic:users!service_orders_second_mechanic_id_fkey(id, name, mechanic_salary_pct),
      works:service_order_works(id, status, salary_paid, norm_minutes, actual_minutes)
    `,
    )
    .eq('id', orderId)
    .single();

  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

  const unpaidWorks = (order.works ?? []).filter(
    (w: any) => w.status === 'completed' && !w.salary_paid,
  );

  if (unpaidWorks.length === 0) {
    return NextResponse.json({ error: 'Нет выполненных работ без начисления ЗП' }, { status: 400 });
  }

  // Get hourly rate from STO settings
  const { data: sto } = await (supabase as any)
    .from('sto_settings')
    .select('hourly_rate, hourly_rate_own')
    .limit(1)
    .single();
  const hourlyRate = parseFloat(
    order.machine_type === 'own' ? (sto?.hourly_rate_own ?? '1600') : (sto?.hourly_rate ?? '2000'),
  );

  // Calculate minutes from unpaid works
  const unpaidMinutes = unpaidWorks.reduce((s: number, w: any) => {
    const mins =
      w.actual_minutes != null && w.actual_minutes > 0 ? w.actual_minutes : (w.norm_minutes ?? 0);
    return s + mins;
  }, 0);
  const unpaidHours = unpaidMinutes / 60;
  const hasTwo = !!order.second_mechanic;

  const txns: any[] = [];
  const payMap: Record<string, string> = {};

  for (const [mechData, payField] of [
    [order.mechanic, 'mechanic_pay'],
    [order.second_mechanic, 'second_mechanic_pay'],
  ] as [any, string][]) {
    if (!mechData) continue;
    const pct = parseFloat(mechData.mechanic_salary_pct ?? '50');
    const hours = hasTwo ? unpaidHours / 2 : unpaidHours;
    const salary = (hours * hourlyRate * pct) / 100;
    if (salary <= 0) continue;

    const prev = parseFloat(order[payField] ?? '0');
    payMap[payField] = (prev + salary).toFixed(2);

    txns.push({
      direction: 'expense',
      lifecycle_status: 'approved',
      settlement_status: 'completed',
      amount: salary.toFixed(2),
      category_id: CAT_PAYROLL_MECHANIC,
      related_user_id: mechData.id,
      created_by: userId,
      description: `ЗП механик — наряд #${order.order_number} (${hours.toFixed(1)} нч × ${hourlyRate} ₽ × ${pct}%)`,
      idempotency_key: crypto.randomUUID(),
    });
  }

  if (txns.length === 0) {
    return NextResponse.json({ error: 'ЗП по данному нормативу равна нулю' }, { status: 400 });
  }

  // Mark works as salary_paid
  const workIds = unpaidWorks.map((w: any) => w.id);
  await (supabase as any)
    .from('service_order_works')
    .update({ salary_paid: true })
    .in('id', workIds);

  // Save accumulated mechanic_pay to order
  if (Object.keys(payMap).length) {
    await (supabase as any)
      .from('service_orders')
      .update({ ...payMap, updated_at: new Date().toISOString() })
      .eq('id', orderId);
  }

  // Create salary transactions
  await (supabase as any).from('transactions').insert(txns);

  return NextResponse.json({
    ok: true,
    works_paid: workIds.length,
    transactions: txns.length,
    total_salary: txns.reduce((s: number, t: any) => s + parseFloat(t.amount), 0).toFixed(2),
  });
}
