/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** PATCH /api/trips/:id/orders/:orderId — отменить заказ (soft-delete) */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string; orderId: string }> },
) {
  const { id: tripId, orderId } = await params;
  const supabase = createAdminClient();

  const { error } = await (supabase.from('trip_orders') as any)
    .update({ lifecycle_status: 'cancelled' })
    .eq('id', orderId)
    .eq('trip_id', tripId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
