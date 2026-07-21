/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/garage/mechanic-stats?month=2026-05 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
  const supabase = createAdminClient();

  const { data: mechanics } = await (supabase.from('users') as any)
    .select('id, name, mechanic_salary_pct')
    .contains('roles', ['mechanic'])
    .eq('is_active', true);

  if (!mechanics?.length) return NextResponse.json([]);

  const startDate = `${month}-01`;
  const endDate = new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + 1))
    .toISOString()
    .slice(0, 10);

  const { data: orders } = await (supabase.from('service_orders') as any)
    .select(
      'id, order_number, created_at, machine_type, assigned_mechanic_id, second_mechanic_id, asset:assets(short_name, reg_number), mechanic:users!service_orders_assigned_mechanic_id_fkey(name), second_mechanic:users!service_orders_second_mechanic_id_fkey(name), works:service_order_works(mechanic_id, second_mechanic_id, norm_minutes, actual_minutes, price_client, status, work_catalog:work_catalog(name), custom_work_name), parts:service_order_parts(quantity, unit_price, part:parts(name, unit))',
    )
    .eq('lifecycle_status', 'approved')
    .gte('created_at', `${startDate}T00:00:00Z`)
    .lt('created_at', `${endDate}T00:00:00Z`)
    .order('created_at', { ascending: false });

  const stats = mechanics.map((m: any) => {
    const mechanicOrders = (orders ?? []).filter(
      (o: any) =>
        o.assigned_mechanic_id === m.id ||
        o.second_mechanic_id === m.id ||
        (o.works ?? []).some((w: any) => w.mechanic_id === m.id || w.second_mechanic_id === m.id),
    );
    let planNormHours = 0,
      factNormHours = 0,
      totalWorksCost = 0;

    for (const order of mechanicOrders) {
      // For legacy orders (no mechanic_id on works), split hours/cost equally when two mechanics worked
      const legacyFactor = order.second_mechanic_id ? 0.5 : 1;

      for (const work of order.works ?? []) {
        let isMyWork = false;
        let factor = 0;

        if (work.mechanic_id || work.second_mechanic_id) {
          // New way: specific mechanic assigned to this work
          if (work.mechanic_id === m.id || work.second_mechanic_id === m.id) {
            isMyWork = true;
            factor = work.mechanic_id && work.second_mechanic_id ? 0.5 : 1;
          }
        } else {
          // Legacy way: if I'm assigned to the order, I get a share
          if (order.assigned_mechanic_id === m.id || order.second_mechanic_id === m.id) {
            isMyWork = true;
            factor = legacyFactor;
          }
        }

        if (isMyWork) {
          planNormHours += ((work.norm_minutes ?? 0) / 60) * factor;
          factNormHours += ((work.actual_minutes ?? 0) / 60) * factor;
          totalWorksCost += parseFloat(work.price_client ?? '0') * factor;
        }
      }
    }

    const pct = parseFloat(m.mechanic_salary_pct ?? '50');
    return {
      mechanic_id: m.id,
      mechanic_name: m.name,
      salary_pct: pct,
      orders_count: mechanicOrders.length,
      plan_norm_hours: Math.round(planNormHours * 10) / 10,
      fact_norm_hours: Math.round(factNormHours * 10) / 10,
      total_works_cost: totalWorksCost.toFixed(2),
      accrued_salary: (totalWorksCost * (pct / 100)).toFixed(2),
      orders: mechanicOrders.map((o: any) => ({
        id: o.id,
        order_number: o.order_number,
        created_at: o.created_at,
        machine_type: o.machine_type,
        vehicle: o.asset?.short_name ?? '—',
        works: (o.works ?? []).map((w: any) => ({
          name: w.work_catalog?.name ?? w.custom_work_name ?? '—',
          norm_minutes: w.norm_minutes,
          actual_minutes: w.actual_minutes,
          price_client: w.price_client,
        })),
      })),
    };
  });

  return NextResponse.json(stats);
}
