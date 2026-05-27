/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** POST /api/garage/client-vehicles/[id]/rules */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { work_name, interval_km, interval_months, last_done_km, last_done_at } = body;

  if (!work_name) {
    return NextResponse.json({ error: 'work_name обязателен' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await (supabase.from('client_vehicle_maintenance_rules') as any)
    .insert({
      client_vehicle_id: id,
      work_name,
      interval_km: interval_km ? Number(interval_km) : null,
      interval_months: interval_months ? Number(interval_months) : null,
      last_done_km: last_done_km ? Number(last_done_km) : null,
      last_done_at: last_done_at || null,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

/** PATCH /api/garage/client-vehicles/[id]/rules?rule_id= */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await params;
  const { searchParams } = new URL(request.url);
  const ruleId = searchParams.get('rule_id');
  if (!ruleId) return NextResponse.json({ error: 'rule_id обязателен' }, { status: 400 });

  const body = await request.json();
  const supabase = createAdminClient();

  const allowed = [
    'work_name',
    'interval_km',
    'interval_months',
    'last_done_km',
    'last_done_at',
    'is_active',
  ];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key] === '' ? null : body[key];
  }
  if ('interval_km' in body && body.interval_km) updates.interval_km = Number(body.interval_km);
  if ('interval_months' in body && body.interval_months)
    updates.interval_months = Number(body.interval_months);
  if ('last_done_km' in body && body.last_done_km) updates.last_done_km = Number(body.last_done_km);

  const { data, error } = await (supabase.from('client_vehicle_maintenance_rules') as any)
    .update(updates)
    .eq('id', ruleId)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE /api/garage/client-vehicles/[id]/rules?rule_id= */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await params;
  const { searchParams } = new URL(_req.url);
  const ruleId = searchParams.get('rule_id');
  if (!ruleId) return NextResponse.json({ error: 'rule_id обязателен' }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await (supabase.from('client_vehicle_maintenance_rules') as any)
    .update({ is_active: false })
    .eq('id', ruleId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
