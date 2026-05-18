/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** PATCH /api/garage/maintenance/:id */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const allowed = [
    'work_name',
    'interval_km',
    'interval_months',
    'last_done_km',
    'last_done_at',
    'next_due_km',
    'next_due_at',
    'alert_status',
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const supabase = createAdminClient();

  // Auto-recalculate next_due_km if last_done_km or interval_km changed but next_due_km not provided
  if (('last_done_km' in body || 'interval_km' in body) && !('next_due_km' in body)) {
    const { data: current } = await (supabase.from('maintenance_items') as any)
      .select('last_done_km, interval_km')
      .eq('id', id)
      .single();
    if (current) {
      const lastDoneKm =
        'last_done_km' in body ? (body.last_done_km as number | null) : current.last_done_km;
      const intervalKm =
        'interval_km' in body ? (body.interval_km as number | null) : current.interval_km;
      updates.next_due_km = lastDoneKm && intervalKm ? lastDoneKm + intervalKm : null;
    }
  }
  const { data, error } = await (supabase.from('maintenance_items') as any)
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE /api/garage/maintenance/:id */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await (supabase.from('maintenance_items') as any).delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
