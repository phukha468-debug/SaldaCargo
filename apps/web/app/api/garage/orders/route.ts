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
      mechanic_pay, second_mechanic_pay, odometer_start, odometer_end,
      asset:assets(id, short_name, reg_number, odometer_current),
      mechanic:users!service_orders_assigned_mechanic_id_fkey(id, name),
      client_vehicle_brand, client_vehicle_model, client_vehicle_reg,
      client_name, client_phone,
      works:service_order_works(
        id, custom_work_name, status, salary_paid, actual_minutes, price_client, norm_minutes, mechanic_id, second_mechanic_id,
        work_catalog:work_catalog(name)
      ),
      parts:service_order_parts(
        id, custom_part_name, quantity, unit_price, client_price, unit,
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
        id, custom_work_name, status, salary_paid, actual_minutes, price_client, norm_minutes, mechanic_id, second_mechanic_id,
        work_catalog:work_catalog(name)
      ),
      parts:service_order_parts(
        id, custom_part_name, quantity, unit_price, client_price, unit,
        part:parts(name, unit)
      )
    `;

    if (filter === 'history') {
      const month = searchParams.get('month');
      const weekStart = searchParams.get('weekStart');
      const weekEnd = searchParams.get('weekEnd');
      const machineType = searchParams.get('machine_type');

      let q = (supabase.from('service_orders') as any)
        .select(fullSelect)
        .or(
          'lifecycle_status.in.(cancelled,returned),and(lifecycle_status.eq.approved,payment_received.eq.true)',
        )
        .order('created_at', { ascending: false })
        .limit(300);

      if (machineType) {
        q = q.eq('machine_type', machineType);
      }

      if (date) {
        q = q.gte('created_at', `${date}T00:00:00Z`).lte('created_at', `${date}T23:59:59Z`);
      } else if (weekStart && weekEnd) {
        q = q.gte('created_at', `${weekStart}T00:00:00Z`).lte('created_at', `${weekEnd}T23:59:59Z`);
      } else if (month) {
        const [yStr, mStr] = month.split('-');
        const y = Number(yStr);
        const m = Number(mStr);
        if (!isNaN(y) && !isNaN(m)) {
          const start = `${month}-01T00:00:00.000Z`;
          const nextM = m === 12 ? 1 : m + 1;
          const nextY = m === 12 ? y + 1 : y;
          const end = `${nextY}-${String(nextM).padStart(2, '0')}-01T00:00:00.000Z`;
          q = q.gte('created_at', start).lt('created_at', end);
        }
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

    const machineType = searchParams.get('machine_type');
    if (machineType) {
      q = q.eq('machine_type', machineType);
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

      // External & Retro repair fields:
      is_external?: boolean;
      contractor_name?: string;
      external_doc_number?: string;
      order_date?: string; // YYYY-MM-DD
      works_cost?: number | string;
      parts_cost?: number | string;
      work_description?: string;
      parts_description?: string;
      is_completed?: boolean;
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

    const isExternal = Boolean(body.is_external);
    const orderCreatedAt = body.order_date
      ? `${body.order_date}T12:00:00.000Z`
      : new Date().toISOString();

    let adminNote = body.admin_note?.trim() || null;
    let problemDesc = body.problem_description.trim();

    if (isExternal) {
      const contractorPart = body.contractor_name?.trim()
        ? ` Исполнитель: ${body.contractor_name.trim()}.`
        : '';
      const docPart = body.external_doc_number?.trim()
        ? ` Документ/Акт №: ${body.external_doc_number.trim()}.`
        : '';
      adminNote = `[Сторонний сервис]${contractorPart}${docPart} ${adminNote || ''}`.trim();
      if (!problemDesc.includes('[Сторонний сервис]')) {
        problemDesc = `[Сторонний сервис${body.contractor_name ? `: ${body.contractor_name.trim()}` : ''}] ${problemDesc}`;
      }
    }

    const isCompleted = isExternal ? body.is_completed !== false : false;

    const { data, error } = await (supabase as any)
      .from('service_orders')
      .insert({
        machine_type: body.machine_type,
        asset_id: body.asset_id || null,
        client_vehicle_id: body.client_vehicle_id || null,
        ...clientVehicleFields,
        problem_description: problemDesc,
        assigned_mechanic_id: isExternal ? null : body.assigned_mechanic_id || null,
        priority: body.priority ?? 'normal',
        admin_note: adminNote,
        status: isCompleted ? 'completed' : 'in_progress',
        lifecycle_status: isCompleted ? 'approved' : 'draft',
        payment_received: isCompleted ? true : body.machine_type === 'own',
        mechanic_pay: isExternal ? 0 : null,
        second_mechanic_pay: isExternal ? 0 : null,
        created_by: adminUsers?.id ?? null,
        created_at: orderCreatedAt,
        updated_at: orderCreatedAt,
      })
      .select()
      .single();

    if (error) throw error;

    // If external service, insert work & parts items
    if (isExternal && data?.id) {
      const worksCost = Number(body.works_cost) || 0;
      const partsCost = Number(body.parts_cost) || 0;

      if (worksCost > 0 || body.work_description) {
        await (supabase as any).from('service_order_works').insert({
          service_order_id: data.id,
          custom_work_name: body.work_description?.trim() || 'Работы стороннего сервиса',
          price_client: worksCost,
          status: 'completed',
          salary_paid: true,
          created_at: orderCreatedAt,
        });
      }

      if (partsCost > 0 || body.parts_description) {
        await (supabase as any).from('service_order_parts').insert({
          service_order_id: data.id,
          custom_part_name: body.parts_description?.trim() || 'Запчасти стороннего сервиса',
          quantity: 1,
          unit_price: partsCost,
          client_price: partsCost,
          unit: 'компл',
          created_at: orderCreatedAt,
        });
      }
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
