/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = createAdminClient();
    const { data, error } = await (supabase as any)
      .from('service_orders')
      .select(
        `
        id, order_number, status, lifecycle_status, priority, machine_type,
        problem_description, admin_note, mechanic_note,
        client_vehicle_brand, client_vehicle_model, client_vehicle_reg,
        client_name, client_phone,
        odometer_start, odometer_end,
        created_at, updated_at,
        asset:assets(id, short_name, reg_number),
        mechanic:users!service_orders_assigned_mechanic_id_fkey(id, name),
        works:service_order_works(
          id, status, norm_minutes, actual_minutes,
          custom_work_name,
          work_catalog:work_catalog(id, name, norm_minutes),
          time_logs:work_time_logs(id, started_at, stopped_at, status)
        ),
        parts:service_order_parts(
          id, quantity,
          part:parts(id, name, unit)
        )
      `,
      )
      .eq('id', id)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = createAdminClient();
    const { error } = await (supabase as any)
      .from('service_orders')
      .update({ lifecycle_status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка' }, { status: 500 });
  }
}

const CAT_PAYROLL_MECHANIC = '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const supabase = createAdminClient();

    // Approve: calculate salary and create PAYROLL_MECHANIC transaction
    if (body.lifecycle_status === 'approved') {
      const { data: order, error: orderErr } = await (supabase as any)
        .from('service_orders')
        .select(
          `
          id, order_number, machine_type, lifecycle_status,
          assigned_mechanic_id, second_mechanic_id,
          mechanic:users!service_orders_assigned_mechanic_id_fkey(id, name, mechanic_salary_pct),
          second_mechanic:users!service_orders_second_mechanic_id_fkey(id, name, mechanic_salary_pct),
          works:service_order_works(norm_minutes, actual_minutes, status)
        `,
        )
        .eq('id', id)
        .single();

      if (orderErr) throw orderErr;
      if (order.lifecycle_status === 'approved') {
        return NextResponse.json({ error: 'Наряд уже утверждён' }, { status: 409 });
      }

      const { data: sto } = await (supabase as any)
        .from('sto_settings')
        .select('hourly_rate, hourly_rate_own')
        .limit(1)
        .single();
      const hourlyRate = parseFloat(
        order.machine_type === 'own'
          ? (sto?.hourly_rate_own ?? '1600')
          : (sto?.hourly_rate ?? '2000'),
      );

      const totalMinutes = (order.works ?? []).reduce((s: number, w: any) => {
        const mins =
          w.actual_minutes != null && w.actual_minutes > 0
            ? w.actual_minutes
            : (w.norm_minutes ?? 0);
        return s + mins;
      }, 0);
      const totalHours = totalMinutes / 60;
      const hasTwo = !!order.second_mechanic_id;

      const mechTxns: any[] = [];
      for (const [mechData, isSplit] of [
        [order.mechanic, hasTwo],
        [order.second_mechanic, hasTwo],
      ] as [any, boolean][]) {
        if (!mechData) continue;
        const pct = parseFloat(mechData.mechanic_salary_pct ?? '50');
        const hours = isSplit ? totalHours / 2 : totalHours;
        const salary = (hours * hourlyRate * pct) / 100;
        if (salary > 0) {
          mechTxns.push({
            direction: 'expense',
            lifecycle_status: 'approved',
            settlement_status: 'completed',
            amount: salary.toFixed(2),
            category_id: CAT_PAYROLL_MECHANIC,
            related_user_id: mechData.id,
            description: `ЗП механик — наряд #${order.order_number} (${hours.toFixed(1)} нч × ${hourlyRate} ₽ × ${pct}%)`,
          });
        }
      }

      await (supabase as any)
        .from('service_orders')
        .update({ lifecycle_status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (mechTxns.length) await (supabase as any).from('transactions').insert(mechTxns);

      return NextResponse.json({ id, lifecycle_status: 'approved' });
    }

    // Handle lifecycle changes other than 'approved' (e.g. returned, cancelled)
    if ('lifecycle_status' in body && body.lifecycle_status !== 'approved') {
      await (supabase as any)
        .from('service_orders')
        .update({ lifecycle_status: body.lifecycle_status, updated_at: new Date().toISOString() })
        .eq('id', id);
      return NextResponse.json({ id, lifecycle_status: body.lifecycle_status });
    }

    const allowed = [
      'status',
      'priority',
      'assigned_mechanic_id',
      'admin_note',
      'odometer_start',
      'odometer_end',
      'is_ready_for_pickup',
    ];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    const { data, error } = await (supabase as any)
      .from('service_orders')
      .update(updates)
      .eq('id', id)
      .select('id, status, priority, admin_note, assigned_mechanic_id, lifecycle_status')
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка' }, { status: 500 });
  }
}
