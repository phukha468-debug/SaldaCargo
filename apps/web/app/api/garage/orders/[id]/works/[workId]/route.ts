/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** PATCH /api/garage/orders/[id]/works/[workId] — update actual_minutes, price_client, status */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; workId: string }> },
) {
  const { workId } = await params;
  const body = await request.json();

  const allowed = ['actual_minutes', 'price_client', 'status', 'salary_paid'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Нет данных для обновления' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await (supabase.from('service_order_works') as any)
    .update(updates)
    .eq('id', workId)
    .select(
      'id, status, salary_paid, norm_minutes, actual_minutes, price_client, custom_work_name, work_catalog:work_catalog(id, name)',
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
