/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/garage/client-vehicles/[id] — полная карточка машины */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data: vehicle, error: vErr }, { data: orders }, { data: rules }, { data: recs }] =
    await Promise.all([
      (supabase.from('client_vehicles') as any)
        .select(
          `id, brand, model, year, reg_number, vin, color, odometer_last, odometer_updated_at, notes, is_active, created_at, updated_at,
           counterparty:counterparties(id, name, phone)`,
        )
        .eq('id', id)
        .single(),

      // История нарядов по этой машине
      (supabase.from('service_orders') as any)
        .select(
          `id, order_number, created_at, status, lifecycle_status, problem_description, odometer_start, odometer_end,
           mechanic:users!service_orders_assigned_mechanic_id_fkey(id, name),
           works:service_order_works(id, status, price_client, norm_minutes, actual_minutes, custom_work_name, work_catalog:work_catalog(name)),
           parts:service_order_parts(id, quantity, unit_price, client_price, custom_part_name, part:parts(name, unit))`,
        )
        .eq('client_vehicle_id', id)
        .neq('lifecycle_status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(50),

      // Плановые регламенты
      (supabase.from('client_vehicle_maintenance_rules') as any)
        .select('*')
        .eq('client_vehicle_id', id)
        .eq('is_active', true)
        .order('work_name'),

      // Рекомендации мастера
      (supabase.from('client_vehicle_recommendations') as any)
        .select(
          '*, created_user:users!client_vehicle_recommendations_created_by_fkey(name), done_user:users!client_vehicle_recommendations_done_by_fkey(name)',
        )
        .eq('client_vehicle_id', id)
        .order('is_done')
        .order('created_at', { ascending: false }),
    ]);

  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });

  const enrichedOrders = (orders ?? []).map((o: any) => {
    const worksCost = (o.works ?? []).reduce(
      (s: number, w: any) => s + parseFloat(w.price_client ?? '0'),
      0,
    );
    const partsCost = (o.parts ?? []).reduce(
      (s: number, p: any) =>
        s + parseFloat(p.client_price ?? p.unit_price ?? '0') * (p.quantity ?? 1),
      0,
    );
    return {
      ...o,
      works_cost: worksCost.toFixed(2),
      parts_cost: partsCost.toFixed(2),
      total_cost: (worksCost + partsCost).toFixed(2),
    };
  });

  return NextResponse.json({
    vehicle,
    orders: enrichedOrders,
    rules: rules ?? [],
    recommendations: recs ?? [],
  });
}

/** PATCH /api/garage/client-vehicles/[id] */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const supabase = createAdminClient();

  const allowed = [
    'brand',
    'model',
    'year',
    'reg_number',
    'vin',
    'color',
    'counterparty_id',
    'odometer_last',
    'notes',
    'is_active',
  ];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key] === '' ? null : body[key];
  }
  if ('odometer_last' in body && body.odometer_last) {
    updates.odometer_last = Number(body.odometer_last);
    updates.odometer_updated_at = new Date().toISOString();
  }

  const { data, error } = await (supabase.from('client_vehicles') as any)
    .update(updates)
    .eq('id', id)
    .select(
      `id, brand, model, year, reg_number, vin, color, odometer_last, notes, counterparty:counterparties(id, name)`,
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
