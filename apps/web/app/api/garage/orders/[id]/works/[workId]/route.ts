/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const CAT_PAYROLL_MECHANIC = '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6';

/** PATCH /api/garage/orders/[id]/works/[workId] */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; workId: string }> },
) {
  const { id: orderId, workId } = await params;
  const body = await request.json();

  const allowed = [
    'actual_minutes',
    'price_client',
    'status',
    'salary_paid',
    'work_description',
    'quantity',
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Нет данных для обновления' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Auto-recalculate price when actual_minutes or quantity changed and price_client not explicitly set
  const needsRecalc =
    ('actual_minutes' in updates || 'quantity' in updates) && !('price_client' in updates);

  if (needsRecalc) {
    const { data: currentWork } = await (supabase.from('service_order_works') as any)
      .select('norm_minutes, actual_minutes, quantity')
      .eq('id', workId)
      .single();

    const { data: order } = await (supabase.from('service_orders') as any)
      .select('machine_type')
      .eq('id', orderId)
      .single();
    const { data: sto } = await (supabase.from('sto_settings') as any)
      .select('hourly_rate, hourly_rate_own')
      .limit(1)
      .single();

    const isOwn = order?.machine_type === 'own';
    const rate = parseFloat(
      isOwn ? (sto?.hourly_rate_own ?? '1600') : (sto?.hourly_rate ?? '2000'),
    );

    const effectiveQty = Number(
      'quantity' in updates ? updates.quantity : (currentWork?.quantity ?? 1),
    );
    const effectiveActual =
      'actual_minutes' in updates
        ? Number(updates.actual_minutes)
        : (currentWork?.actual_minutes ?? null);
    const normMinutes = currentWork?.norm_minutes ?? 60;

    const totalMinutes =
      effectiveActual != null && effectiveActual > 0 ? effectiveActual : normMinutes * effectiveQty;

    updates.price_client = ((totalMinutes / 60) * rate).toFixed(2);
  }

  // Update the work
  const { data: updatedWork, error } = await (supabase.from('service_order_works') as any)
    .update(updates)
    .eq('id', workId)
    .select(
      'id, status, salary_paid, quantity, norm_minutes, actual_minutes, price_client, work_description, custom_work_name, work_catalog:work_catalog(id, name)',
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // When work is marked completed and salary not yet paid → auto-accrue as debt (pending)
  if (updates.status === 'completed' && !updatedWork.salary_paid) {
    await accrueWorkSalary(supabase, orderId, updatedWork);
  }

  return NextResponse.json(updatedWork);
}

async function accrueWorkSalary(supabase: any, orderId: string, work: any) {
  const { data: order } = await (supabase.from('service_orders') as any)
    .select(
      `
      id, order_number, machine_type,
      mechanic:users!service_orders_assigned_mechanic_id_fkey(id, name, mechanic_salary_pct),
      second_mechanic:users!service_orders_second_mechanic_id_fkey(id, name, mechanic_salary_pct)
    `,
    )
    .eq('id', orderId)
    .single();

  if (!order?.mechanic) return;

  const workPrice = parseFloat(work.price_client ?? '0');
  if (workPrice <= 0) return;

  const hasTwo = !!order.second_mechanic;
  const txns: any[] = [];

  for (const mechData of [order.mechanic, order.second_mechanic]) {
    if (!mechData) continue;
    const pct = parseFloat(mechData.mechanic_salary_pct ?? '50');
    const base = hasTwo ? workPrice / 2 : workPrice;
    const salary = (base * pct) / 100;
    if (salary <= 0) continue;

    const workName = work.work_catalog?.name ?? work.custom_work_name ?? 'работа';
    txns.push({
      direction: 'expense',
      lifecycle_status: 'approved',
      settlement_status: 'pending',
      amount: salary.toFixed(2),
      category_id: CAT_PAYROLL_MECHANIC,
      related_user_id: mechData.id,
      description: `Долг механику — наряд #${order.order_number}: ${workName} (${pct}% от ${workPrice.toLocaleString('ru-RU')} ₽)`,
      idempotency_key: crypto.randomUUID(),
    });
  }

  if (txns.length > 0) {
    await (supabase.from('transactions') as any).insert(txns);
    await (supabase.from('service_order_works') as any)
      .update({ salary_paid: true })
      .eq('id', work.id);
  }
}

/** DELETE /api/garage/orders/[id]/works/[workId] */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; workId: string }> },
) {
  const { workId } = await params;
  const supabase = createAdminClient();
  const { error } = await (supabase.from('service_order_works') as any).delete().eq('id', workId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
