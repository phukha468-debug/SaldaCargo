/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;
  const body = await request.json();
  const cookieStore = await cookies();
  const userId =
    cookieStore.get('salda_user_id')?.value ||
    request.headers.get('x-salda-user-id') ||
    body.mechanic_id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { part_id, custom_part_name, quantity, unit } = body as {
    part_id?: string;
    custom_part_name?: string;
    quantity?: number | string;
    unit?: string;
  };

  const qty = Math.max(0.1, parseFloat(String(quantity ?? 1)) || 1);
  const supabase = createAdminClient();

  // 1. Ввод запчасти текстом (запчасти предоставил автосервис / куплены под наряд)
  if (custom_part_name && custom_part_name.trim()) {
    const { data: sop, error: sopErr } = await (supabase.from('service_order_parts') as any)
      .insert({
        service_order_id: orderId,
        custom_part_name: custom_part_name.trim(),
        quantity: qty,
        unit: (unit || 'шт').trim() || 'шт',
        unit_price: '0.00',
        client_price: '0.00',
        status: 'reserved',
      })
      .select(
        'id, quantity, custom_part_name, unit, unit_price, client_price, part:parts(id, name, unit)',
      )
      .single();

    if (sopErr) return NextResponse.json({ error: sopErr.message }, { status: 500 });
    return NextResponse.json(sop, { status: 201 });
  }

  // 2. Списание со склада по part_id (если выбрано из номенклатуры)
  if (!part_id) {
    return NextResponse.json(
      { error: 'Укажите название запчасти или выберите со склада' },
      { status: 400 },
    );
  }

  const { data: part } = await (supabase.from('parts') as any)
    .select('purchase_price, client_price')
    .eq('id', part_id)
    .single();

  const { data: movement, error: mvErr } = await (supabase.from('part_movements') as any)
    .insert({
      part_id,
      direction: 'out',
      quantity: qty,
      unit_price: part?.purchase_price ?? 0,
      service_order_id: orderId,
      created_by: userId,
    })
    .select()
    .single();

  if (mvErr) return NextResponse.json({ error: mvErr.message }, { status: 500 });

  const { data: sop, error: sopErr } = await (supabase.from('service_order_parts') as any)
    .insert({
      service_order_id: orderId,
      part_id,
      quantity: qty,
      unit_price: part?.purchase_price ?? 0,
      client_price: part?.client_price ?? 0,
      status: 'consumed',
      part_movement_id: movement.id,
    })
    .select(
      'id, quantity, custom_part_name, unit, unit_price, client_price, part:parts(id, name, unit)',
    )
    .single();

  if (sopErr) return NextResponse.json({ error: sopErr.message }, { status: 500 });
  return NextResponse.json(sop, { status: 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const partItemId = searchParams.get('part_item_id');
  if (!partItemId) {
    return NextResponse.json({ error: 'part_item_id required' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const userId = cookieStore.get('salda_user_id')?.value || request.headers.get('x-salda-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  const { error } = await (supabase.from('service_order_parts') as any)
    .delete()
    .eq('id', partItemId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
