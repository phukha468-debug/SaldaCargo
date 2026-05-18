/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/garage/vehicle-history?asset_id= */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const asset_id = searchParams.get('asset_id');
  if (!asset_id) return NextResponse.json({ error: 'asset_id обязателен' }, { status: 400 });

  const supabase = createAdminClient();
  const { data: orders, error } = await (supabase.from('service_orders') as any)
    .select(
      'id, order_number, created_at, status, lifecycle_status, machine_type, problem_description, odometer_start, mechanic:users!service_orders_assigned_mechanic_id_fkey(name), works:service_order_works(norm_minutes, actual_minutes, price_client, status, work_catalog:work_catalog(name)), parts:service_order_parts(quantity, unit_price, part:parts(name, unit))',
    )
    .eq('asset_id', asset_id)
    .neq('lifecycle_status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = (orders ?? []).map((o: any) => {
    const worksCost = (o.works ?? []).reduce(
      (s: number, w: any) => s + parseFloat(w.price_client ?? '0'),
      0,
    );
    const partsCost = (o.parts ?? []).reduce(
      (s: number, p: any) => s + parseFloat(p.unit_price ?? '0') * p.quantity,
      0,
    );
    return {
      ...o,
      works_cost: worksCost.toFixed(2),
      parts_cost: partsCost.toFixed(2),
      total_cost: (worksCost + partsCost).toFixed(2),
      total_norm_minutes: (o.works ?? []).reduce(
        (s: number, w: any) => s + (w.norm_minutes ?? 0),
        0,
      ),
      total_actual_minutes: (o.works ?? []).reduce(
        (s: number, w: any) => s + (w.actual_minutes ?? 0),
        0,
      ),
    };
  });

  return NextResponse.json(enriched);
}
