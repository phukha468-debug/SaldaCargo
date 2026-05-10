/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const fullSelect = `
  id, order_number, machine_type, status, lifecycle_status, priority,
  problem_description, mechanic_note, admin_note, created_at, updated_at,
  asset:assets(id, short_name, reg_number),
  mechanic:users!service_orders_assigned_mechanic_id_fkey(id, name),
  client_vehicle_brand, client_vehicle_model, client_vehicle_reg,
  client_name, client_phone,
  works:service_order_works(
    id, custom_work_name, status, actual_minutes, price_client, norm_minutes,
    work_catalog:work_catalog(name)
  ),
  parts:service_order_parts(
    id, quantity, unit_price,
    part:parts(name, unit)
  )
`;

const lightSelect = `
  id, order_number, machine_type, status, lifecycle_status, priority, created_at,
  asset:assets(short_name, reg_number),
  mechanic:users!service_orders_assigned_mechanic_id_fkey(name),
  client_vehicle_brand, client_vehicle_reg
`;

/** GET /api/admin/service-orders?filter=review|active|history&date=YYYY-MM-DD */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter') ?? 'review';
  const date = searchParams.get('date');

  try {
    const supabase = createAdminClient();

    if (filter === 'history') {
      let q = (supabase.from('service_orders') as any)
        .select(fullSelect)
        .or(
          'lifecycle_status.in.(cancelled,returned),and(lifecycle_status.eq.approved,status.eq.completed)',
        )
        .order('created_at', { ascending: false })
        .limit(100);

      if (date) {
        q = q.gte('created_at', `${date}T00:00:00Z`).lte('created_at', `${date}T23:59:59Z`);
      }

      const { data, error } = await q;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data ?? []);
    }

    let q = (supabase.from('service_orders') as any)
      .select(filter === 'review' ? fullSelect : lightSelect)
      .order('created_at', { ascending: false })
      .limit(50);

    if (filter === 'review') {
      q = q.eq('lifecycle_status', 'draft');
    } else {
      q = q.eq('lifecycle_status', 'approved').in('status', ['created', 'in_progress']);
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
