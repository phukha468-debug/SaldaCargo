/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/garage/sto-clients/[id] — карточка клиента СТО с машинами и историей нарядов */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: cp, error: cpErr } = await (supabase.from('counterparties') as any)
    .select('id, name, phone, notes')
    .eq('id', id)
    .single();

  if (cpErr) return NextResponse.json({ error: cpErr.message }, { status: 500 });

  const { data: vehicles, error: vErr } = await (supabase.from('client_vehicles') as any)
    .select(
      `id, brand, model, year, reg_number, vin, color, odometer_last, odometer_updated_at, notes, created_at`,
    )
    .eq('counterparty_id', id)
    .eq('is_active', true)
    .order('brand');

  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });

  // История нарядов для каждой машины
  const vehiclesWithHistory = await Promise.all(
    ((vehicles ?? []) as any[]).map(async (v: any) => {
      const { data: orders } = await (supabase.from('service_orders') as any)
        .select(
          `id, order_number, status, lifecycle_status, created_at, problem_description, admin_note,
           mechanic:users!service_orders_assigned_mechanic_id_fkey(name),
           second_mechanic:users!service_orders_second_mechanic_id_fkey(name),
           works:service_order_works(
             id, custom_work_name, status, norm_minutes, actual_minutes, price_client, salary_paid,
             work_catalog:work_catalog(name)
           ),
           parts:service_order_parts(
             id, custom_part_name, quantity, unit, client_price,
             part:parts(name, unit)
           )`,
        )
        .eq('client_vehicle_id', v.id)
        .neq('lifecycle_status', 'cancelled')
        .order('created_at', { ascending: false });

      const ordersWithTotals = ((orders ?? []) as any[]).map((o: any) => {
        const worksTotal = (o.works ?? []).reduce(
          (s: number, w: any) => s + parseFloat(w.price_client ?? '0'),
          0,
        );
        const partsTotal = (o.parts ?? []).reduce(
          (s: number, p: any) =>
            s + parseFloat(p.client_price ?? '0') * parseFloat(p.quantity ?? '1'),
          0,
        );
        return { ...o, total: (worksTotal + partsTotal).toFixed(2) };
      });

      const totalSpent = ordersWithTotals
        .filter((o: any) => o.lifecycle_status === 'approved')
        .reduce((s: number, o: any) => s + parseFloat(o.total), 0);

      return {
        ...v,
        orders: ordersWithTotals,
        total_spent: totalSpent.toFixed(2),
      };
    }),
  );

  return NextResponse.json({ ...cp, vehicles: vehiclesWithHistory });
}

/** PATCH /api/garage/sto-clients/[id] — обновить данные клиента */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { name, phone, notes } = body;

  const supabase = createAdminClient();
  const { data, error } = await (supabase.from('counterparties') as any)
    .update({ name, phone: phone || null, notes: notes || null })
    .eq('id', id)
    .select('id, name, phone, notes')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
