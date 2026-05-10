/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/garage/orders?filter=review|active|history&date=YYYY-MM-DD */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter') ?? 'review';
  const date = searchParams.get('date');

  try {
    const supabase = createAdminClient();

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
        id, quantity, price_per_unit,
        part:parts(name, unit)
      )
    `;

    const activeSelect = `
      id, order_number, machine_type, status, lifecycle_status, priority, created_at,
      asset:assets(short_name, reg_number),
      mechanic:users!service_orders_assigned_mechanic_id_fkey(name),
      client_vehicle_brand, client_vehicle_reg
    `;

    if (filter === 'history') {
      let q = (supabase.from('service_orders') as any)
        .select(fullSelect)
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
      .select(filter === 'review' ? fullSelect : activeSelect)
      .order('created_at', { ascending: false })
      .limit(50);

    if (filter === 'review') {
      q = q.eq('lifecycle_status', 'draft');
    } else if (filter === 'active') {
      q = q.eq('lifecycle_status', 'approved').in('status', ['created', 'in_progress']);
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

export async function POST(request: Request) {
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
      priority?: string;
      admin_note?: string;
    };

    if (!body.problem_description?.trim()) {
      return NextResponse.json({ error: 'Описание проблемы обязательно' }, { status: 400 });
    }
    if (body.machine_type === 'own' && !body.asset_id) {
      return NextResponse.json({ error: 'Выберите машину' }, { status: 400 });
    }
    if (body.machine_type === 'client' && !body.client_vehicle_brand?.trim()) {
      return NextResponse.json({ error: 'Укажите марку клиентской машины' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: adminUsers } = await (supabase as any)
      .from('users')
      .select('id')
      .contains('roles', ['admin'])
      .limit(1)
      .single();

    const { data, error } = await (supabase as any)
      .from('service_orders')
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
        priority: body.priority ?? 'normal',
        admin_note: body.admin_note?.trim() || null,
        status: 'created',
        lifecycle_status: 'approved',
        created_by: adminUsers?.id ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
