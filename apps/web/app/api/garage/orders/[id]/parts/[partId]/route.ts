/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** PATCH /api/garage/orders/[id]/parts/[partId] — update part price */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; partId: string }> },
) {
  const { partId } = await params;
  const body = await request.json();

  const { client_price, unit_price } = body as {
    client_price?: string;
    unit_price?: string;
  };

  const updates: Record<string, unknown> = {};
  if (client_price !== undefined) updates.client_price = client_price;
  if (unit_price !== undefined) updates.unit_price = unit_price;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Нет данных для обновления' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await (supabase.from('service_order_parts') as any)
    .update(updates)
    .eq('id', partId)
    .select(
      'id, quantity, custom_part_name, unit, unit_price, client_price, part:parts(id, name, unit)',
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE /api/garage/orders/[id]/parts/[partId] — удалить запчасть */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; partId: string }> },
) {
  const { partId } = await params;
  const supabase = createAdminClient();
  const { error } = await (supabase.from('service_order_parts') as any).delete().eq('id', partId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
