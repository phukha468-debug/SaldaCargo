/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/** PATCH /api/admin/service-orders/:id */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const adminId = cookieStore.get('salda_user_id')?.value;
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as {
    action:
      | 'approve'
      | 'return'
      | 'cancel'
      | 'edit_note'
      | 'approve_extra_work'
      | 'reject_extra_work';
    admin_note?: string;
    adjusted_norm_minutes?: number;
    work_id?: string;
  };
  const supabase = createAdminClient();

  // ── Утверждение наряда + начисление ЗП ────────────────────────────────
  if (body.action === 'approve') {
    const { data: order, error: orderErr } = await (supabase.from('service_orders') as any)
      .select(
        `
        id, asset_id,
        mechanic:users!service_orders_assigned_mechanic_id_fkey(id, mechanic_salary_pct),
        second_mechanic:users!service_orders_second_mechanic_id_fkey(id, mechanic_salary_pct),
        service_order_works(id, norm_minutes, actual_minutes, status, extra_work_status)
      `,
      )
      .eq('id', id)
      .single();

    if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

    const approvedNm = body.adjusted_norm_minutes ?? null;
    const works = (order.service_order_works ?? []).filter(
      (w: any) => w.status !== 'cancelled' && w.extra_work_status !== 'rejected',
    );
    const totalNm =
      approvedNm ??
      works.reduce((sum: number, w: any) => sum + (w.actual_minutes ?? w.norm_minutes), 0);

    const [{ data: settings }, { data: payrollCat }] = await Promise.all([
      (supabase.from('sto_settings') as any).select('hourly_rate').limit(1).single(),
      (supabase.from('transaction_categories') as any)
        .select('id')
        .eq('code', 'PAYROLL_MECHANIC')
        .single(),
    ]);
    const hourlyRate = parseFloat(settings?.hourly_rate ?? '2000');
    const payrollCategoryId = payrollCat?.id;

    const accruals: string[] = [];
    const mechanics = [order.mechanic, order.second_mechanic].filter(Boolean);
    const totalNmHours = totalNm / 60;
    const nmPerMechanic = mechanics.length === 2 ? totalNmHours / 2 : totalNmHours;

    for (const mech of mechanics) {
      if (!mech?.id) continue;
      const pct = parseFloat(mech.mechanic_salary_pct ?? '50') / 100;
      const salary = (nmPerMechanic * hourlyRate * pct).toFixed(2);
      accruals.push(`${mech.id}: ${salary} ₽`);

      await (supabase.from('transactions') as any).insert({
        direction: 'expense',
        category_id: payrollCategoryId,
        amount: salary,
        service_order_id: id,
        lifecycle_status: 'approved',
        settlement_status: 'pending',
        description: `ЗП механика: наряд #${id.slice(0, 6)}`,
        created_by: adminId,
        idempotency_key: crypto.randomUUID(),
      });
    }

    const { error } = await (supabase.from('service_orders') as any)
      .update({
        lifecycle_status: 'approved',
        approved_by: adminId,
        approved_at: new Date().toISOString(),
        admin_note: body.admin_note ?? null,
      })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'approved', accruals });
  }

  // ── Возврат на доработку ───────────────────────────────────────────────
  if (body.action === 'return') {
    const { error } = await (supabase.from('service_orders') as any)
      .update({
        lifecycle_status: 'returned',
        status: 'in_progress',
        admin_note: body.admin_note ?? null,
      })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'returned' });
  }

  // ── Отмена ────────────────────────────────────────────────────────────
  if (body.action === 'cancel') {
    const { error } = await (supabase.from('service_orders') as any)
      .update({ lifecycle_status: 'cancelled', status: 'cancelled' })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'cancelled' });
  }

  // ── Заметка администратора ────────────────────────────────────────────
  if (body.action === 'edit_note') {
    const { error } = await (supabase.from('service_orders') as any)
      .update({ admin_note: body.admin_note?.trim() ?? null })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Одобрить доп. работу механика ────────────────────────────────────
  if (body.action === 'approve_extra_work') {
    if (!body.work_id) return NextResponse.json({ error: 'work_id required' }, { status: 400 });
    const { error } = await (supabase.from('service_order_works') as any)
      .update({
        extra_work_status: 'approved',
        extra_work_approved_by: adminId,
        extra_work_approved_at: new Date().toISOString(),
      })
      .eq('id', body.work_id)
      .eq('service_order_id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'extra_work_approved' });
  }

  // ── Отклонить доп. работу механика ───────────────────────────────────
  if (body.action === 'reject_extra_work') {
    if (!body.work_id) return NextResponse.json({ error: 'work_id required' }, { status: 400 });
    const { error } = await (supabase.from('service_order_works') as any)
      .update({
        extra_work_status: 'rejected',
        extra_work_approved_by: adminId,
        extra_work_approved_at: new Date().toISOString(),
        status: 'cancelled',
      })
      .eq('id', body.work_id)
      .eq('service_order_id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'extra_work_rejected' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
