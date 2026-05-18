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

/** POST /api/admin/service-orders — создать наряд напрямую */
export async function POST(request: Request) {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const adminId = cookieStore.get('salda_user_id')?.value;
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await request.json()) as {
      machine_type: 'own' | 'client';
      asset_id?: string;
      client_vehicle_brand?: string;
      client_vehicle_model?: string;
      client_vehicle_reg?: string;
      client_name?: string;
      client_phone?: string;
      problem_description: string;
      assigned_mechanic_id?: string;
      second_mechanic_id?: string;
      odometer_start?: number;
      work_ids?: string[];
    };

    if (!body.problem_description?.trim()) {
      return NextResponse.json({ error: 'Описание проблемы обязательно' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: order, error: orderErr } = await (supabase.from('service_orders') as any)
      .insert({
        machine_type: body.machine_type,
        asset_id: body.asset_id || null,
        client_vehicle_brand: body.client_vehicle_brand?.trim() || null,
        client_vehicle_model: body.client_vehicle_model?.trim() || null,
        client_vehicle_reg: body.client_vehicle_reg?.trim() || null,
        client_name: body.client_name?.trim() || null,
        client_phone: body.client_phone?.trim() || null,
        problem_description: body.problem_description.trim(),
        assigned_mechanic_id: body.assigned_mechanic_id || null,
        second_mechanic_id: body.second_mechanic_id || null,
        odometer_start: body.odometer_start ?? null,
        status: 'created',
        lifecycle_status: 'draft',
        priority: 'normal',
        created_by: adminId,
      })
      .select('id, order_number')
      .single();

    if (orderErr) throw orderErr;

    if (body.work_ids?.length) {
      const { data: catalog } = await (supabase.from('work_catalog') as any)
        .select('id, norm_minutes, default_price_client')
        .in('id', body.work_ids);
      if (catalog?.length) {
        await (supabase.from('service_order_works') as any).insert(
          catalog.map((w: any) => ({
            service_order_id: order.id,
            work_catalog_id: w.id,
            norm_minutes: w.norm_minutes,
            price_client: w.default_price_client,
            status: 'pending',
          })),
        );
      }
    }

    return NextResponse.json(order, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
