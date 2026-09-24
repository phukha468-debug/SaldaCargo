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

  // Fetch current item with asset odometer
  const { data: current } = await (supabase.from('maintenance_items') as any)
    .select('*, asset:assets(odometer_current)')
    .eq('id', id)
    .single();

  if (current) {
    const lastDoneKm =
      'last_done_km' in body ? (body.last_done_km as number | null) : current.last_done_km;
    const intervalKm =
      'interval_km' in body ? (body.interval_km as number | null) : current.interval_km;

    if (!('next_due_km' in body)) {
      updates.next_due_km =
        lastDoneKm && intervalKm ? Number(lastDoneKm) + Number(intervalKm) : null;
    }

    const lastDoneAt =
      'last_done_at' in body ? (body.last_done_at as string | null) : current.last_done_at;
    const intervalMonths =
      'interval_months' in body ? (body.interval_months as number | null) : current.interval_months;

    if (!('next_due_at' in body)) {
      if (lastDoneAt && intervalMonths) {
        const d = new Date(lastDoneAt);
        d.setMonth(d.getMonth() + Number(intervalMonths));
        updates.next_due_at = d.toISOString().split('T')[0] || null;
      } else {
        updates.next_due_at = null;
      }
    }

    if (!('alert_status' in body)) {
      const targetDueKm =
        'next_due_km' in updates ? (updates.next_due_km as number | null) : current.next_due_km;
      const targetDueAt =
        'next_due_at' in updates ? (updates.next_due_at as string | null) : current.next_due_at;
      const odo = current.asset?.odometer_current ?? null;

      let kmStatus: 'ok' | 'soon' | 'overdue' | null = null;
      let dateStatus: 'ok' | 'soon' | 'overdue' | null = null;

      if (targetDueKm && odo) {
        const rem = targetDueKm - odo;
        if (rem <= 0) kmStatus = 'overdue';
        else if (rem <= Math.max(1000, (intervalKm ?? 10000) * 0.15)) kmStatus = 'soon';
        else kmStatus = 'ok';
      }

      if (targetDueAt) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(targetDueAt);
        due.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) dateStatus = 'overdue';
        else if (diffDays <= 30) dateStatus = 'soon';
        else dateStatus = 'ok';
      }

      const statuses = [kmStatus, dateStatus].filter(Boolean) as Array<'ok' | 'soon' | 'overdue'>;
      if (statuses.includes('overdue')) updates.alert_status = 'overdue';
      else if (statuses.includes('soon')) updates.alert_status = 'soon';
      else updates.alert_status = 'ok';
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
