/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

type ImportWork = {
  group?: string;
  custom_work_name: string;
  work_description?: string;
  norm_minutes: number;
  price_client: string;
};

type ImportPart = {
  name: string;
  quantity: number;
  unit?: string;
  unit_price: string;
  total_price?: string;
};

type ImportBody = {
  order: {
    machine_type: 'own' | 'client';
    asset_id?: string;
    client_vehicle_brand?: string;
    client_vehicle_model?: string;
    client_vehicle_reg?: string;
    client_name?: string;
    client_phone?: string;
    odometer_start?: number | null;
    problem_description: string;
    priority?: string;
    assigned_mechanic_id?: string;
  };
  works: ImportWork[];
  parts: ImportPart[];
  ai_generated_text?: string;
};

export async function POST(request: Request) {
  try {
    const body: ImportBody = await request.json();

    if (!body.order?.problem_description?.trim()) {
      return NextResponse.json({ error: 'Описание проблемы обязательно' }, { status: 400 });
    }
    if (body.order.machine_type === 'own' && !body.order.asset_id) {
      return NextResponse.json({ error: 'Выберите машину' }, { status: 400 });
    }
    if (body.order.machine_type === 'client' && !body.order.client_vehicle_brand?.trim()) {
      return NextResponse.json({ error: 'Укажите марку клиентской машины' }, { status: 400 });
    }
    if (!Array.isArray(body.works) || body.works.length === 0) {
      return NextResponse.json({ error: 'Список работ пуст' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: adminUser } = await (supabase as any)
      .from('users')
      .select('id')
      .contains('roles', ['admin'])
      .limit(1)
      .maybeSingle();

    const { data: order, error: orderErr } = await (supabase as any)
      .from('service_orders')
      .insert({
        machine_type: body.order.machine_type,
        asset_id: body.order.asset_id || null,
        client_vehicle_brand: body.order.client_vehicle_brand?.trim() || null,
        client_vehicle_model: body.order.client_vehicle_model?.trim() || null,
        client_vehicle_reg: body.order.client_vehicle_reg?.trim() || null,
        client_name: body.order.client_name?.trim() || null,
        client_phone: body.order.client_phone?.trim() || null,
        odometer_start: body.order.odometer_start ?? null,
        problem_description: body.order.problem_description.trim(),
        assigned_mechanic_id: body.order.assigned_mechanic_id || null,
        priority: body.order.priority ?? 'normal',
        status: 'created',
        lifecycle_status: 'draft',
        ai_generated_text: body.ai_generated_text || null,
        created_by: adminUser?.id ?? null,
      })
      .select('id, order_number')
      .single();

    if (orderErr) throw orderErr;

    // Создаём работы
    if (body.works.length > 0) {
      const worksToInsert = body.works.map((w) => ({
        service_order_id: order.id,
        custom_work_name: w.custom_work_name.trim(),
        work_description: w.work_description?.trim() || null,
        norm_minutes: Math.max(1, Math.round(w.norm_minutes)),
        price_client: parseFloat(w.price_client || '0').toFixed(2),
        status: 'pending',
        manual_entry: true,
        requires_admin_review: false,
      }));

      const { error: worksErr } = await (supabase as any)
        .from('service_order_works')
        .insert(worksToInsert);

      if (worksErr) throw worksErr;
    }

    // Создаём запчасти (без привязки к каталогу — свободный текст)
    if (Array.isArray(body.parts) && body.parts.length > 0) {
      const partsToInsert = body.parts
        .filter((p) => p.name?.trim())
        .map((p) => ({
          service_order_id: order.id,
          part_id: null,
          custom_part_name: p.name.trim(),
          unit: p.unit || 'шт',
          quantity: parseFloat(String(p.quantity)) || 1,
          unit_price: parseFloat(p.unit_price || '0').toFixed(2),
          client_price: parseFloat(p.unit_price || '0').toFixed(2),
          status: 'reserved',
        }));

      if (partsToInsert.length > 0) {
        const { error: partsErr } = await (supabase as any)
          .from('service_order_parts')
          .insert(partsToInsert);

        if (partsErr) throw partsErr;
      }
    }

    return NextResponse.json({ id: order.id, order_number: order.order_number }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
