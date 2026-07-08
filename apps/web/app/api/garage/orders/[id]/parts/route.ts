/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** POST /api/garage/orders/[id]/parts — добавить запчасть в наряд */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;
  const body = await request.json();
  const { custom_part_name, quantity, unit, client_price } = body as {
    custom_part_name: string;
    quantity: number;
    unit?: string;
    client_price?: string;
  };

  if (!custom_part_name?.trim()) {
    return NextResponse.json({ error: 'Укажите название запчасти' }, { status: 400 });
  }

  const qty = parseFloat(String(quantity)) || 1;
  const price = parseFloat(client_price || '0').toFixed(2);
  const supabase = createAdminClient();

  const { data, error } = await (supabase.from('service_order_parts') as any)
    .insert({
      service_order_id: orderId,
      custom_part_name: custom_part_name.trim(),
      quantity: qty,
      unit: unit || 'шт',
      unit_price: price,
      client_price: price,
      status: 'reserved',
    })
    .select(
      'id, quantity, custom_part_name, unit, unit_price, client_price, part:parts(id, name, unit)',
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
