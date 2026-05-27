/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** POST /api/garage/client-vehicles/[id]/recommendations */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { text, due_km, due_date, service_order_id, created_by } = body;

  if (!text) {
    return NextResponse.json({ error: 'text обязателен' }, { status: 400 });
  }

  const supabase = createAdminClient();

  let authorId = created_by || null;
  if (!authorId) {
    const { data: admin } = await (supabase.from('users') as any)
      .select('id')
      .filter('roles', 'cs', '{"admin"}')
      .limit(1)
      .maybeSingle();
    authorId = admin?.id ?? null;
  }
  if (!authorId) {
    return NextResponse.json({ error: 'Не найден пользователь-автор' }, { status: 500 });
  }

  const { data, error } = await (supabase.from('client_vehicle_recommendations') as any)
    .insert({
      client_vehicle_id: id,
      text,
      due_km: due_km ? Number(due_km) : null,
      due_date: due_date || null,
      service_order_id: service_order_id || null,
      created_by: authorId,
    })
    .select('*, created_user:users!client_vehicle_recommendations_created_by_fkey(name)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

/** PATCH /api/garage/client-vehicles/[id]/recommendations?rec_id= */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await params;
  const { searchParams } = new URL(request.url);
  const recId = searchParams.get('rec_id');
  if (!recId) return NextResponse.json({ error: 'rec_id обязателен' }, { status: 400 });

  const body = await request.json();
  const supabase = createAdminClient();

  const updates: Record<string, unknown> = {};
  if (body.is_done !== undefined) {
    updates.is_done = body.is_done;
    if (body.is_done) {
      updates.done_at = new Date().toISOString();
      updates.done_by = body.done_by || null;
    } else {
      updates.done_at = null;
      updates.done_by = null;
    }
  }
  if (body.text !== undefined) updates.text = body.text;
  if (body.due_km !== undefined) updates.due_km = body.due_km ? Number(body.due_km) : null;
  if (body.due_date !== undefined) updates.due_date = body.due_date || null;

  const { data, error } = await (supabase.from('client_vehicle_recommendations') as any)
    .update(updates)
    .eq('id', recId)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
