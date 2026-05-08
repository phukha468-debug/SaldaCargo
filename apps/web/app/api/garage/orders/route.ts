/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';

  try {
    const supabase = createAdminClient();
    let query = (supabase as any)
      .from('service_orders')
      .select(
        `
        id, order_number, status, priority, machine_type,
        problem_description, created_at, updated_at,
        asset:assets(id, short_name, reg_number),
        client_vehicle_brand, client_vehicle_reg, client_name,
        mechanic:users!service_orders_assigned_mechanic_id_fkey(id, name),
        works:service_order_works(id, status)
      `,
      )
      .order('created_at', { ascending: false })
      .limit(100);

    if (status) {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.or(
        `problem_description.ilike.%${search}%,client_vehicle_brand.ilike.%${search}%,client_name.ilike.%${search}%`,
      );
    }

    const { data, error } = await query;
    if (error) throw error;

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
        lifecycle_status: 'draft',
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
