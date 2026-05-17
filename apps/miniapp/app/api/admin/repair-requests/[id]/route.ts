/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * PATCH /api/admin/repair-requests/:id
 * action: 'approve' — одобрить заявку и создать наряд
 * action: 'reject'  — отклонить заявку
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const adminId = cookieStore.get('salda_user_id')?.value;
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { action, admin_note, mechanic_id, second_mechanic_id, odometer, work_ids } = body as {
    action: 'approve' | 'reject';
    admin_note?: string;
    mechanic_id?: string;
    second_mechanic_id?: string;
    odometer?: number;
    work_ids?: string[]; // UUID из work_catalog
  };

  const supabase = createAdminClient();

  if (action === 'reject') {
    const { error } = await (supabase.from('repair_requests') as any)
      .update({
        status: 'rejected',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        admin_note: admin_note ?? null,
      })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'rejected' });
  }

  if (action === 'approve') {
    // Получаем заявку
    const { data: req, error: reqErr } = await (supabase.from('repair_requests') as any)
      .select('asset_id, driver_id, fault_catalog_id, custom_description')
      .eq('id', id)
      .single();

    if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 500 });

    // Составляем описание проблемы
    let problemDesc = req.custom_description ?? '';
    if (req.fault_catalog_id) {
      const { data: fault } = await (supabase.from('fault_catalog') as any)
        .select('name')
        .eq('id', req.fault_catalog_id)
        .single();
      if (fault) problemDesc = fault.name;
    }

    // Создаём заказ-наряд
    const { data: order, error: orderErr } = await (supabase.from('service_orders') as any)
      .insert({
        machine_type: 'own',
        asset_id: req.asset_id,
        odometer_start: odometer ?? null,
        problem_description: problemDesc,
        assigned_mechanic_id: mechanic_id ?? null,
        second_mechanic_id: second_mechanic_id ?? null,
        status: 'created',
        lifecycle_status: 'draft',
        priority: 'normal',
        created_by: adminId,
      })
      .select('id, order_number')
      .single();

    if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

    // Добавляем выбранные работы из каталога
    if (work_ids?.length) {
      const { data: catalog } = await (supabase.from('work_catalog') as any)
        .select('id, norm_minutes, default_price_client')
        .in('id', work_ids);

      if (catalog?.length) {
        const works = catalog.map((w: any) => ({
          service_order_id: order.id,
          work_catalog_id: w.id,
          norm_minutes: w.norm_minutes,
          price_client: w.default_price_client,
          status: 'pending',
        }));
        await (supabase.from('service_order_works') as any).insert(works);
      }
    }

    // Обновляем заявку
    await (supabase.from('repair_requests') as any)
      .update({
        status: 'approved',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        admin_note: admin_note ?? null,
        service_order_id: order.id,
      })
      .eq('id', id);

    return NextResponse.json({
      ok: true,
      action: 'approved',
      service_order_id: order.id,
      order_number: order.order_number,
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
