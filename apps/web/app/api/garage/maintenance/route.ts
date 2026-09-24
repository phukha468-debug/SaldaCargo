/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export function computeAlertStatus({
  next_due_km,
  next_due_at,
  interval_km,
  odometer_current,
}: {
  next_due_km?: number | null;
  next_due_at?: string | null;
  interval_km?: number | null;
  odometer_current?: number | null;
}): 'ok' | 'soon' | 'overdue' {
  let kmStatus: 'ok' | 'soon' | 'overdue' | null = null;
  let dateStatus: 'ok' | 'soon' | 'overdue' | null = null;

  if (next_due_km && odometer_current) {
    const rem = next_due_km - odometer_current;
    if (rem <= 0) kmStatus = 'overdue';
    else if (rem <= Math.max(1000, (interval_km ?? 10000) * 0.15)) kmStatus = 'soon';
    else kmStatus = 'ok';
  }

  if (next_due_at) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(next_due_at);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) dateStatus = 'overdue';
    else if (diffDays <= 30) dateStatus = 'soon';
    else dateStatus = 'ok';
  }

  const statuses = [kmStatus, dateStatus].filter(Boolean) as Array<'ok' | 'soon' | 'overdue'>;
  if (statuses.includes('overdue')) return 'overdue';
  if (statuses.includes('soon')) return 'soon';
  return 'ok';
}

/** GET /api/garage/maintenance?asset_id=&alert_status= */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const asset_id = searchParams.get('asset_id');
  const alert_status = searchParams.get('alert_status');

  const supabase = createAdminClient();
  let query = (supabase.from('maintenance_items') as any).select(
    'id, work_name, interval_km, interval_months, last_done_km, last_done_at, next_due_km, next_due_at, alert_status, created_at, asset:assets(id, short_name, reg_number, odometer_current)',
  );

  if (asset_id) query = query.eq('asset_id', asset_id);
  if (alert_status) query = query.eq('alert_status', alert_status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (data ?? []).map((item: any) => {
    let nextDueAt = item.next_due_at;
    if (!nextDueAt && item.last_done_at && item.interval_months) {
      const d = new Date(item.last_done_at);
      d.setMonth(d.getMonth() + Number(item.interval_months));
      nextDueAt = d.toISOString().split('T')[0];
    }
    const computedAlert = computeAlertStatus({
      next_due_km: item.next_due_km,
      next_due_at: nextDueAt,
      interval_km: item.interval_km,
      odometer_current: item.asset?.odometer_current,
    });
    return {
      ...item,
      next_due_at: nextDueAt,
      alert_status: item.alert_status === 'active_order' ? 'active_order' : computedAlert,
    };
  });

  const statusPriority: Record<string, number> = { overdue: 0, soon: 1, ok: 2, active_order: 3 };
  items.sort((a: any, b: any) => {
    const pa = statusPriority[a.alert_status] ?? 99;
    const pb = statusPriority[b.alert_status] ?? 99;
    if (pa !== pb) return pa - pb;
    if (a.next_due_at && b.next_due_at) return a.next_due_at.localeCompare(b.next_due_at);
    return (a.next_due_km ?? 9999999) - (b.next_due_km ?? 9999999);
  });

  return NextResponse.json(items);
}

/** POST /api/garage/maintenance */
export async function POST(request: Request) {
  const body = await request.json();
  const { asset_id, work_name, interval_km, interval_months, last_done_km, last_done_at } =
    body as {
      asset_id: string;
      work_name: string;
      interval_km?: number | null;
      interval_months?: number | null;
      last_done_km?: number | null;
      last_done_at?: string | null;
    };

  if (!asset_id || !work_name?.trim()) {
    return NextResponse.json({ error: 'asset_id и work_name обязательны' }, { status: 400 });
  }

  let next_due_at: string | null = null;
  if (last_done_at && interval_months) {
    const d = new Date(last_done_at);
    d.setMonth(d.getMonth() + Number(interval_months));
    next_due_at = d.toISOString().split('T')[0] || null;
  }
  const next_due_km =
    interval_km && last_done_km ? Number(last_done_km) + Number(interval_km) : null;

  const supabase = createAdminClient();
  const { data: asset } = await (supabase.from('assets') as any)
    .select('odometer_current')
    .eq('id', asset_id)
    .single();
  const odo = asset?.odometer_current ?? null;

  const alert_status = computeAlertStatus({
    next_due_km,
    next_due_at,
    interval_km: interval_km ? Number(interval_km) : null,
    odometer_current: odo,
  });

  const { data, error } = await (supabase.from('maintenance_items') as any)
    .insert({
      asset_id,
      work_name: work_name.trim(),
      interval_km: interval_km ? Number(interval_km) : null,
      interval_months: interval_months ? Number(interval_months) : null,
      last_done_km: last_done_km ? Number(last_done_km) : null,
      last_done_at: last_done_at || null,
      next_due_km,
      next_due_at,
      alert_status,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
