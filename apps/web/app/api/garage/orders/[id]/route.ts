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
        id, order_number, status, priority, machine_type,
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
    const { error } = await (supabase as any).from('service_orders').delete().eq('id', id);
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
    const allowed = [
      'status',
      'priority',
      'assigned_mechanic_id',
      'admin_note',
      'odometer_start',
      'odometer_end',
      'is_ready_for_pickup',
      'lifecycle_status',
    ];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    const supabase = createAdminClient();
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
