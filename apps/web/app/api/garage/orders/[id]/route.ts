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
        mechanic_pay, second_mechanic_pay,
        client_vehicle_brand, client_vehicle_model, client_vehicle_reg,
        client_name, client_phone,
        odometer_start, odometer_end,
        created_at, updated_at,
        asset:assets(id, short_name, reg_number),
        mechanic:users!service_orders_assigned_mechanic_id_fkey(id, name),
        second_mechanic:users!service_orders_second_mechanic_id_fkey(id, name),
        works:service_order_works(
          id, status, salary_paid, quantity, norm_minutes, actual_minutes, price_client, work_description,
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

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { password } = await req.json().catch(() => ({}));
    if (password !== '9111') {
      return NextResponse.json({ error: 'Неверный пароль' }, { status: 403 });
    }
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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const supabase = createAdminClient();

    if (body.lifecycle_status === 'approved') {
      const { data: order, error: orderErr } = await (supabase as any)
        .from('service_orders')
        .select(
          `id, lifecycle_status, order_number, machine_type,
           mechanic:users!service_orders_assigned_mechanic_id_fkey(id, name, mechanic_salary_pct),
           second_mechanic:users!service_orders_second_mechanic_id_fkey(id, name, mechanic_salary_pct),
           works:service_order_works(id, status, salary_paid, norm_minutes, actual_minutes)`,
        )
        .eq('id', id)
        .single();

      if (orderErr) throw orderErr;
      if (order.lifecycle_status === 'approved') {
        return NextResponse.json({ error: 'Наряд уже утверждён' }, { status: 409 });
      }

      // Утверждаем наряд
      await (supabase as any)
        .from('service_orders')
        .update({ lifecycle_status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', id);

      // Доход с наряда — SERVICE_REVENUE (сразу completed)
      {
        const CAT_SERVICE_REVENUE = '600e7f70-2797-474d-948b-432230036d67';
        const { data: worksForRevenue } = await (supabase as any)
          .from('service_order_works')
          .select('price_client, status')
          .eq('service_order_id', id)
          .neq('status', 'cancelled');
        const { data: partsForRevenue } = await (supabase as any)
          .from('service_order_parts')
          .select('client_price, quantity')
          .eq('service_order_id', id);

        const worksTotal = ((worksForRevenue ?? []) as any[]).reduce(
          (s: number, w: any) => s + parseFloat(w.price_client ?? '0'),
          0,
        );
        const partsTotal = ((partsForRevenue ?? []) as any[]).reduce(
          (s: number, p: any) =>
            s + parseFloat(p.client_price ?? '0') * parseFloat(p.quantity ?? '1'),
          0,
        );
        const revenueTotal = worksTotal + partsTotal;

        if (revenueTotal > 0) {
          const { data: adminForRevenue } = await (supabase as any)
            .from('users')
            .select('id')
            .filter('roles', 'cs', '{"admin"}')
            .limit(1)
            .maybeSingle();
          await (supabase as any).from('transactions').insert({
            direction: 'income',
            lifecycle_status: 'approved',
            settlement_status: 'completed',
            amount: revenueTotal.toFixed(2),
            category_id: CAT_SERVICE_REVENUE,
            service_order_id: id,
            created_by: adminForRevenue?.id ?? null,
            description: `Выручка — наряд #${order.order_number}`,
            idempotency_key: crypto.randomUUID(),
          });
        }
      }

      // Начисляем ЗП механикам автоматически
      const unpaidWorks = (order.works ?? []).filter(
        (w: any) => w.status === 'completed' && !w.salary_paid,
      );
      if (unpaidWorks.length > 0) {
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
        const { data: adminUser } = await (supabase as any)
          .from('users')
          .select('id')
          .filter('roles', 'cs', '{"admin"}')
          .limit(1)
          .single();
        const createdBy = adminUser?.id ?? null;
        const CAT_PAYROLL_MECHANIC = '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6';

        const unpaidMinutes = unpaidWorks.reduce((s: number, w: any) => {
          return s + (w.actual_minutes > 0 ? w.actual_minutes : (w.norm_minutes ?? 0));
        }, 0);
        const unpaidHours = unpaidMinutes / 60;
        const hasTwo = !!order.second_mechanic;
        const txns: any[] = [];
        const payMap: Record<string, string> = {};

        for (const [mechData, payField] of [
          [order.mechanic, 'mechanic_pay'],
          [order.second_mechanic, 'second_mechanic_pay'],
        ] as [any, string][]) {
          if (!mechData?.id) continue;
          const pct = parseFloat(mechData.mechanic_salary_pct ?? '50');
          const hours = hasTwo ? unpaidHours / 2 : unpaidHours;
          const salary = (hours * hourlyRate * pct) / 100;
          if (salary <= 0) continue;
          payMap[payField] = salary.toFixed(2);
          txns.push({
            direction: 'expense',
            lifecycle_status: 'approved',
            settlement_status: 'pending',
            amount: salary.toFixed(2),
            category_id: CAT_PAYROLL_MECHANIC,
            related_user_id: mechData.id,
            created_by: createdBy,
            description: `ЗП механика ${mechData.name} — наряд #${order.order_number} (${hours.toFixed(1)} нч × ${hourlyRate} ₽ × ${pct}%)`,
            idempotency_key: crypto.randomUUID(),
          });
        }

        if (txns.length > 0) {
          await Promise.all([
            (supabase as any).from('transactions').insert(txns),
            (supabase as any)
              .from('service_order_works')
              .update({ salary_paid: true })
              .in(
                'id',
                unpaidWorks.map((w: any) => w.id),
              ),
            Object.keys(payMap).length
              ? (supabase as any)
                  .from('service_orders')
                  .update({ ...payMap, updated_at: new Date().toISOString() })
                  .eq('id', id)
              : Promise.resolve(),
          ]);
        }
      }

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
      'second_mechanic_id',
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
