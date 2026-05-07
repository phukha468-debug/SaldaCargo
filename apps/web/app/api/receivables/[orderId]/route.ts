/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** PATCH /api/receivables/[orderId] — отметить заказ как оплаченный */
export async function PATCH(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const supabase = createAdminClient();

  const { error } = await (supabase as any)
    .from('trip_orders')
    .update({ settlement_status: 'completed' })
    .eq('id', orderId)
    .eq('settlement_status', 'pending');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
