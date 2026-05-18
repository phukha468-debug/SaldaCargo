/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/garage/maintenance?asset_id=&alert_status= */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const asset_id = searchParams.get('asset_id');
  const alert_status = searchParams.get('alert_status');

  const supabase = createAdminClient();
  let query = (supabase.from('maintenance_items') as any)
    .select(
      'id, work_name, interval_km, interval_months, last_done_km, last_done_at, next_due_km, next_due_at, alert_status, created_at, asset:assets(id, short_name, reg_number, odometer_current)',
    )
    .order('alert_status', { ascending: false })
    .order('next_due_km', { ascending: true });

  if (asset_id) query = query.eq('asset_id', asset_id);
  if (alert_status) query = query.eq('alert_status', alert_status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST /api/garage/maintenance */
export async function POST(request: Request) {
  const body = await request.json();
  const { asset_id, work_name, interval_km, interval_months, last_done_km, last_done_at } =
    body as {
      asset_id: string;
      work_name: string;
      interval_km?: number;
      interval_months?: number;
      last_done_km?: number;
      last_done_at?: string;
    };

  if (!asset_id || !work_name?.trim()) {
    return NextResponse.json({ error: 'asset_id и work_name обязательны' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await (supabase.from('maintenance_items') as any)
    .insert({
      asset_id,
      work_name: work_name.trim(),
      interval_km: interval_km ?? null,
      interval_months: interval_months ?? null,
      last_done_km: last_done_km ?? null,
      last_done_at: last_done_at ?? null,
      next_due_km: interval_km && last_done_km ? last_done_km + interval_km : null,
      alert_status: 'ok',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
