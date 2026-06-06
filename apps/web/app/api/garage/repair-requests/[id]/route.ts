/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** PATCH /api/garage/repair-requests/:id — attach_json | approve | reject */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { action, admin_note, mechanic_id, second_mechanic_id, odometer, work_ids, service_json } =
    body as {
      action: 'attach_json' | 'approve' | 'reject';
      admin_note?: string;
      mechanic_id?: string;
      second_mechanic_id?: string;
      odometer?: number;
      work_ids?: string[];
      service_json?: Record<string, any>;
    };

  const supabase = createAdminClient();

  if (action === 'attach_json') {
    const { data: req, error: reqErr } = await (supabase.from('repair_requests') as any)
      .select('status, service_order_id')
      .eq('id', id)
      .single();
    if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 500 });

    const { error } = await (supabase.from('repair_requests') as any)
      .update({ service_json: service_json ?? null })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Если заявка уже одобрена — применяем JSON к существующему наряду
    if (req.status === 'approved' && req.service_order_id && service_json) {
      const sj = service_json as Record<string, any>;
      // Поддерживаем AI-формат { order: {...}, works: [...] } и упрощённый { problem_description, works: [...] }
      const orderData = sj.order ?? sj;
      const works: any[] = Array.isArray(sj.works) ? sj.works : [];
      const parts: any[] = Array.isArray(sj.parts) ? sj.parts : [];

      // Обновляем наряд
      const updateFields: Record<string, any> = {};
      if (orderData.problem_description) updateFields.problem_description = orderData.problem_description;
      if (orderData.priority && ['low', 'normal', 'urgent'].includes(orderData.priority)) {
        updateFields.priority = orderData.priority;
      }
      if (orderData.mechanic_note !== undefined) updateFields.mechanic_note = orderData.mechanic_note;

      if (Object.keys(updateFields).length > 0) {
        await (supabase.from('service_orders') as any)
          .update(updateFields)
          .eq('id', req.service_order_id);
      }

      // Добавляем работы (не дублируем по имени)
      if (works.length > 0) {
        const { data: existingWorks } = await (supabase.from('service_order_works') as any)
          .select('custom_work_name')
          .eq('service_order_id', req.service_order_id);

        const existingNames = new Set(
          ((existingWorks as any[]) ?? []).map((w: any) => w.custom_work_name?.trim().toLowerCase()),
        );

        const newWorks = works
          .filter((w) => {
            const name = (w.custom_work_name ?? w.name ?? '').trim();
            return name && !existingNames.has(name.toLowerCase());
          })
          .map((w) => ({
            service_order_id: req.service_order_id,
            custom_work_name: (w.custom_work_name ?? w.name ?? '').trim(),
            work_description: w.work_description?.trim() || null,
            norm_minutes: Math.max(1, Math.round(w.norm_minutes ?? 60)),
            price_client: parseFloat(w.price_client || '0').toFixed(2),
            status: 'pending',
            manual_entry: true,
          }));

        if (newWorks.length > 0) {
          await (supabase.from('service_order_works') as any).insert(newWorks);
        }
      }

      // Добавляем запчасти
      if (parts.length > 0) {
        const partsToInsert = parts
          .filter((p) => p.name?.trim())
          .map((p) => ({
            service_order_id: req.service_order_id,
            part_id: null,
            custom_part_name: p.name.trim(),
            unit: p.unit || 'шт',
            quantity: parseFloat(String(p.quantity)) || 1,
            unit_price: parseFloat(p.unit_price || '0').toFixed(2),
            client_price: parseFloat(p.unit_price || '0').toFixed(2),
            status: 'reserved',
          }));

        if (partsToInsert.length > 0) {
          await (supabase.from('service_order_parts') as any).insert(partsToInsert);
        }
      }
    }

    return NextResponse.json({ ok: true });
  }

  if (action === 'reject') {
    const { error } = await (supabase.from('repair_requests') as any)
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        admin_note: admin_note ?? null,
      })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'rejected' });
  }

  if (action === 'approve') {
    const { data: req, error: reqErr } = await (supabase.from('repair_requests') as any)
      .select('asset_id, driver_id, fault_catalog_id, custom_description, status, service_json')
      .eq('id', id)
      .single();
    if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 500 });
    if (req.status !== 'new') {
      return NextResponse.json({ error: 'Заявка уже обработана' }, { status: 409 });
    }

    const { data: adminUser } = await (supabase.from('users') as any)
      .select('id')
      .contains('roles', ['admin'])
      .limit(1)
      .maybeSingle();
    if (!adminUser?.id) {
      return NextResponse.json({ error: 'Администратор не найден' }, { status: 500 });
    }

    // JSON от ИИ имеет приоритет над текстом водителя
    // Поддерживаем AI-формат { order: {...}, works: [...] } и упрощённый { problem_description, works: [...] }
    const rawSj: Record<string, any> | null = req.service_json ?? null;
    const sjOrder = rawSj?.order ?? rawSj;
    const sjWorks: any[] = Array.isArray(rawSj?.works) ? rawSj.works : [];
    const sjParts: any[] = Array.isArray(rawSj?.parts) ? rawSj.parts : [];

    let problemDesc = req.custom_description ?? '';
    if (!rawSj && req.fault_catalog_id) {
      const { data: fault } = await (supabase.from('fault_catalog') as any)
        .select('name')
        .eq('id', req.fault_catalog_id)
        .single();
      if (fault) problemDesc = fault.name;
    }

    const { data: order, error: orderErr } = await (supabase.from('service_orders') as any)
      .insert({
        machine_type: 'own',
        asset_id: req.asset_id,
        odometer_start: odometer ?? null,
        problem_description: sjOrder?.problem_description ?? problemDesc,
        mechanic_note: sjOrder?.mechanic_note ?? null,
        assigned_mechanic_id: mechanic_id ?? null,
        second_mechanic_id: second_mechanic_id ?? null,
        status: 'created',
        lifecycle_status: 'draft',
        priority: ['low', 'normal', 'urgent'].includes(sjOrder?.priority ?? '')
          ? sjOrder.priority
          : 'normal',
        payment_received: true,
        created_by: adminUser.id,
      })
      .select('id, order_number')
      .single();
    if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

    // Работы из JSON (приоритет) или из каталога
    if (sjWorks.length > 0) {
      const worksToInsert = sjWorks.map((w: any) => ({
        service_order_id: order.id,
        custom_work_name: (w.custom_work_name ?? w.name ?? '').trim(),
        work_description: w.work_description?.trim() || null,
        norm_minutes: Math.max(1, Math.round(w.norm_minutes ?? 60)),
        price_client: parseFloat(w.price_client || '0').toFixed(2),
        status: 'pending',
        manual_entry: true,
      }));
      await (supabase.from('service_order_works') as any).insert(worksToInsert);
    }

    // Запчасти из JSON
    if (sjParts.length > 0) {
      const partsToInsert = sjParts
        .filter((p: any) => p.name?.trim())
        .map((p: any) => ({
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
        await (supabase.from('service_order_parts') as any).insert(partsToInsert);
      }
    }

    if (sjWorks.length === 0 && work_ids?.length) {
      const { data: catalog } = await (supabase.from('work_catalog') as any)
        .select('id, norm_minutes, default_price_client')
        .in('id', work_ids);
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

    await (supabase.from('repair_requests') as any)
      .update({
        status: 'approved',
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
