/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;
  const body = await request.json();
  const cookieStore = await cookies();
  const userId = cookieStore.get('salda_user_id')?.value;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { part_id, quantity } = body as { part_id: string; quantity: number };
  if (!part_id || !quantity)
    return NextResponse.json({ error: 'part_id and quantity required' }, { status: 400 });

  const supabase = createAdminClient();

  // Get part snapshot prices
  const { data: part } = await (supabase.from('parts') as any)
    .select('purchase_price, client_price')
    .eq('id', part_id)
    .single();

  // Create part movement (stock out)
  const { data: movement, error: mvErr } = await (supabase.from('part_movements') as any)
    .insert({
      part_id,
      direction: 'out',
      quantity,
      unit_price: part?.purchase_price ?? 0,
      service_order_id: orderId,
      created_by: userId,
    })
    .select()
    .single();

  if (mvErr) return NextResponse.json({ error: mvErr.message }, { status: 500 });

  // Create service_order_parts record
  const { data: sop, error: sopErr } = await (supabase.from('service_order_parts') as any)
    .insert({
      service_order_id: orderId,
      part_id,
      quantity,
      unit_price: part?.purchase_price ?? 0,
      client_price: part?.client_price ?? 0,
      status: 'consumed',
      part_movement_id: movement.id,
    })
    .select()
    .single();

  if (sopErr) return NextResponse.json({ error: sopErr.message }, { status: 500 });
  return NextResponse.json(sop, { status: 201 });
}
