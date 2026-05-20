/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** PATCH /api/garage/orders/[id]/works/[workId] — update actual_minutes, price_client, status */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; workId: string }> },
) {
  const { id: orderId, workId } = await params;
  const body = await request.json();

  const allowed = ['actual_minutes', 'price_client', 'status', 'salary_paid', 'work_description'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Нет данных для обновления' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Auto-recalculate price when actual_minutes changed and price_client not explicitly set
  if ('actual_minutes' in updates && !('price_client' in updates)) {
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
    const minutes = Number(updates.actual_minutes) || 0;
    updates.price_client = ((minutes / 60) * rate).toFixed(2);
  }
  const { data, error } = await (supabase.from('service_order_works') as any)
    .update(updates)
    .eq('id', workId)
    .select(
      'id, status, salary_paid, norm_minutes, actual_minutes, price_client, work_description, custom_work_name, work_catalog:work_catalog(id, name)',
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
