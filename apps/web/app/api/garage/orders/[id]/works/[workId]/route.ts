/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** PATCH /api/garage/orders/[id]/works/[workId] — update actual_minutes, price_client, status, quantity */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; workId: string }> },
) {
  const { id: orderId, workId } = await params;
  const body = await request.json();

  const allowed = [
    'actual_minutes',
    'price_client',
    'status',
    'salary_paid',
    'work_description',
    'quantity',
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Нет данных для обновления' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Auto-recalculate price when actual_minutes or quantity changed and price_client not explicitly set
  const needsRecalc =
    ('actual_minutes' in updates || 'quantity' in updates) && !('price_client' in updates);

  if (needsRecalc) {
    // Fetch current work row to get values not present in updates
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

    // Use actual if set, otherwise norm × quantity
    const totalMinutes =
      effectiveActual != null && effectiveActual > 0 ? effectiveActual : normMinutes * effectiveQty;

    updates.price_client = ((totalMinutes / 60) * rate).toFixed(2);
  }

  const { data, error } = await (supabase.from('service_order_works') as any)
    .update(updates)
    .eq('id', workId)
    .select(
      'id, status, salary_paid, quantity, norm_minutes, actual_minutes, price_client, work_description, custom_work_name, work_catalog:work_catalog(id, name)',
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE /api/garage/orders/[id]/works/[workId] */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; workId: string }> },
) {
  const { workId } = await params;
  const supabase = createAdminClient();
  const { error } = await (supabase.from('service_order_works') as any).delete().eq('id', workId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
