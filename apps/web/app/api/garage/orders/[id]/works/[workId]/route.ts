/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** PATCH /api/garage/orders/[id]/works/[workId] */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; workId: string }> },
) {
  const { id: orderId, workId } = await params;
  const body = await request.json();

  const allowed = [
    'actual_minutes',
    'norm_minutes',
    'price_client',
    'status',
    'salary_paid',
    'work_description',
    'custom_work_name',
    'custom_work_description',
    'quantity',
    'mechanic_id',
    'second_mechanic_id',
    'notes',
    'created_at',
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (body.work_date) {
    const d = new Date(body.work_date);
    if (!isNaN(d.getTime())) {
      updates.created_at = d.toISOString();
    }
  }

  if (body.category !== undefined) {
    const cleanCat = String(body.category || '').trim();
    updates.custom_work_description = cleanCat || null;
    const existingNotes = String(body.notes || updates.notes || '');
    const cleanedNotes = existingNotes.replace(/\[category:[^\]]+\]/g, '').trim();
    if (cleanCat) {
      updates.notes = cleanedNotes
        ? `${cleanedNotes} [category:${cleanCat}]`
        : `[category:${cleanCat}]`;
    } else {
      updates.notes = cleanedNotes || null;
    }
  }
  if ('custom_salary_pct' in body) {
    if (body.custom_salary_pct != null && body.custom_salary_pct !== '') {
      let pctVal = Number(body.custom_salary_pct);
      if (pctVal > 100 && 'price_client' in body) {
        const p = parseFloat(body.price_client);
        if (p > 0) pctVal = (pctVal / p) * 100;
      }
      if (pctVal > 100) pctVal = 100;
      if (pctVal < 0) pctVal = 0;
      const existingNotes = String(body.notes || updates.notes || '');
      const cleanedNotes = existingNotes.replace(/\[salary_pct:\d+(?:\.\d+)?\]/g, '').trim();
      updates.notes = cleanedNotes
        ? `${cleanedNotes} [salary_pct:${pctVal}]`
        : `[salary_pct:${pctVal}]`;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Нет данных для обновления' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Auto-recalculate price when actual_minutes or quantity changed and price_client not explicitly set in body
  const needsRecalc =
    ('actual_minutes' in updates || 'quantity' in updates) && !('price_client' in body);

  if (needsRecalc) {
    const { data: currentWork } = await (supabase.from('service_order_works') as any)
      .select('norm_minutes, actual_minutes, quantity')
      .eq('id', workId)
      .single();

    const { data: order } = await (supabase.from('service_orders') as any)
      .select('machine_type')
      .eq('id', orderId)
      .single();
    const { data: sto } = await (supabase.from('sto_settings') as any)
      .select('hourly_rate, hourly_rate_own')
      .limit(1)
      .single();

    const isOwn = order?.machine_type === 'own';
    const rate = parseFloat(
      isOwn ? (sto?.hourly_rate_own ?? '1600') : (sto?.hourly_rate ?? '2000'),
    );

    const effectiveQty = Number(
      'quantity' in updates ? updates.quantity : (currentWork?.quantity ?? 1),
    );
    const effectiveActual =
      'actual_minutes' in updates
        ? Number(updates.actual_minutes)
        : (currentWork?.actual_minutes ?? null);
    const normMinutes = currentWork?.norm_minutes ?? 60;

    const totalMinutes =
      effectiveActual != null && effectiveActual > 0 ? effectiveActual : normMinutes * effectiveQty;

    updates.price_client = ((totalMinutes / 60) * rate).toFixed(2);
  }

  // Update the work
  const { data: updatedWork, error } = await (supabase.from('service_order_works') as any)
    .update(updates)
    .eq('id', workId)
    .select(
      'id, status, salary_paid, quantity, norm_minutes, actual_minutes, price_client, work_description, custom_work_name, custom_work_description, created_at, mechanic_id, second_mechanic_id, notes, work_catalog:work_catalog(id, name)',
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(updatedWork);
}

/** DELETE /api/garage/orders/[id]/works/[workId] */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; workId: string }> },
) {
  const { id: orderId, workId } = await params;
  const supabase = createAdminClient();

  const { data: work } = await (supabase.from('service_order_works') as any)
    .select('id, custom_work_name, work_catalog(name)')
    .eq('id', workId)
    .single();

  const { data: order } = await (supabase.from('service_orders') as any)
    .select('order_number')
    .eq('id', orderId)
    .single();

  const workName = work?.work_catalog?.name ?? work?.custom_work_name ?? 'работа';
  const desc = `Наряд #${order?.order_number}: ${workName}`;

  const { error } = await (supabase.from('service_order_works') as any).delete().eq('id', workId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await (supabase.from('transactions') as any)
    .update({
      lifecycle_status: 'cancelled',
      cancelled_reason: 'Удалена работа в заказ-наряде',
      updated_at: new Date().toISOString(),
    })
    .eq('service_order_id', orderId)
    .eq('description', desc);

  return NextResponse.json({ ok: true });
}
