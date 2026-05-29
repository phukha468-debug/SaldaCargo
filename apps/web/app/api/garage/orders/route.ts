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
      id, order_number, machine_type, status, lifecycle_status, priority, payment_received,
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

    const activeSelect = `
      id, order_number, machine_type, status, lifecycle_status, priority, payment_received, created_at,
      problem_description, admin_note,
      asset:assets(id, short_name, reg_number),
      mechanic:users!service_orders_assigned_mechanic_id_fkey(id, name),
      client_vehicle_brand, client_vehicle_model, client_vehicle_reg, client_name,
      works:service_order_works(
        id, custom_work_name, status, salary_paid, actual_minutes, price_client, norm_minutes,
        work_catalog:work_catalog(name)
      )
    `;

    if (filter === 'history') {
      const month = searchParams.get('month');
      let q = (supabase.from('service_orders') as any)
        .select(fullSelect)
        .or(
          'lifecycle_status.in.(cancelled,returned),and(lifecycle_status.eq.approved,status.eq.completed)',
        )
        .order('created_at', { ascending: false })
        .limit(300);

      if (date) {
        q = q.gte('created_at', `${date}T00:00:00Z`).lte('created_at', `${date}T23:59:59Z`);
      } else if (month) {
        const [y, m] = month.split('-').map(Number);
        const start = `${month}-01T00:00:00.000Z`;
        const nextM = m === 12 ? 1 : m + 1;
        const nextY = m === 12 ? y + 1 : y;
        const end = `${nextY}-${String(nextM).padStart(2, '0')}-01T00:00:00.000Z`;
        q = q.gte('created_at', start).lt('created_at', end);
      }

      const { data, error } = await q;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data ?? []);
    }

    // 'all' needs fullSelect to include lifecycle_status and works for client-side filtering
    const selectStr = filter === 'active' ? activeSelect : fullSelect;

    let q = (supabase.from('service_orders') as any)
      .select(selectStr)
      .order('created_at', { ascending: false })
      .limit(50);

    if (filter === 'review') {
      // draft orders that mechanic completed (status=completed) and admin hasn't closed yet
      q = q.eq('lifecycle_status', 'draft').eq('status', 'completed');
    } else if (filter === 'active') {
      // All open (draft) orders regardless of work status
      q = q.eq('lifecycle_status', 'draft');
    } else if (filter === 'pending_payment') {
      // Approved client orders waiting for cash payment
      q = q
        .eq('lifecycle_status', 'approved')
        .eq('machine_type', 'client')
        .eq('payment_received', false);
    } else if (filter === 'all') {
      q = q.neq('lifecycle_status', 'cancelled');
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
      client_vehicle_id?: string;
      problem_description: string;
      assigned_mechanic_id?: string;
      priority?: string;
      admin_note?: string;
    };

    if (!body.problem_description?.trim()) {
      return NextResponse.json({ error: 'Описание проблемы обязательно' }, { status: 400 });
    }
    if (body.machine_type === 'own' && !body.asset_id) {
      return NextResponse.json({ error: 'Выберите автомобиль из парка' }, { status: 400 });
    }
    if (body.machine_type === 'client' && !body.client_vehicle_id) {
      return NextResponse.json(
        { error: 'Выберите или создайте клиентский автомобиль' },
        { status: 400 },
      );
    }
    if (!body.assigned_mechanic_id) {
      return NextResponse.json({ error: 'Назначьте исполнителя' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: adminUsers } = await (supabase as any)
      .from('users')
      .select('id')
      .contains('roles', ['admin'])
      .limit(1)
      .maybeSingle();

    // Денормализуем данные клиентской машины для отображения в старых запросах
    let clientVehicleFields: Record<string, string | null> = {};
    if (body.client_vehicle_id) {
      const { data: cv } = await (supabase as any)
        .from('client_vehicles')
        .select('brand, model, reg_number, counterparty:counterparties(name, phone)')
        .eq('id', body.client_vehicle_id)
        .single();
      if (cv) {
        clientVehicleFields = {
          client_vehicle_brand: cv.brand ?? null,
          client_vehicle_model: cv.model ?? null,
          client_vehicle_reg: cv.reg_number ?? null,
          client_name: cv.counterparty?.name ?? null,
          client_phone: cv.counterparty?.phone ?? null,
        };
      }
    }

    const { data, error } = await (supabase as any)
      .from('service_orders')
      .insert({
        machine_type: body.machine_type,
        asset_id: body.asset_id || null,
        client_vehicle_id: body.client_vehicle_id || null,
        ...clientVehicleFields,
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
