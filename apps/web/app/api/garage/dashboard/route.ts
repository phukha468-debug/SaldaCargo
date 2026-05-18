/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/garage/dashboard — сводка дашборда Гараж */
export async function GET() {
  const supabase = createAdminClient();

  const [
    { data: repairRequests },
    { data: activeOrders },
    { data: pendingApproval },
    { data: maintenanceAlerts },
  ] = await Promise.all([
    (supabase.from('repair_requests') as any)
      .select(
        'id, created_at, custom_description, asset:assets(short_name, reg_number), driver:users!repair_requests_driver_id_fkey(name), fault:fault_catalog(name, category)',
      )
      .eq('status', 'new')
      .order('created_at', { ascending: false }),

    (supabase.from('service_orders') as any)
      .select(
        'id, order_number, status, created_at, machine_type, asset:assets(short_name, reg_number), mechanic:users!service_orders_assigned_mechanic_id_fkey(name), second_mechanic:users!service_orders_second_mechanic_id_fkey(name)',
      )
      .in('status', ['created', 'in_progress'])
      .neq('lifecycle_status', 'cancelled')
      .order('created_at', { ascending: false }),

    (supabase.from('service_orders') as any)
      .select(
        'id, order_number, created_at, machine_type, asset:assets(short_name, reg_number), mechanic:users!service_orders_assigned_mechanic_id_fkey(name), service_order_works(norm_minutes, actual_minutes, status)',
      )
      .eq('status', 'completed')
      .eq('lifecycle_status', 'draft')
      .order('created_at', { ascending: false }),

    (supabase.from('maintenance_items') as any)
      .select(
        'id, work_name, alert_status, next_due_km, next_due_at, asset:assets(short_name, reg_number, odometer_current)',
      )
      .in('alert_status', ['overdue', 'soon'])
      .order('alert_status', { ascending: false })
      .order('next_due_km', { ascending: true }),
  ]);

  const activeArr = activeOrders ?? [];
  const uniqueVehicles = new Set(activeArr.map((o: any) => o.asset?.reg_number).filter(Boolean))
    .size;

  return NextResponse.json({
    repairRequests: repairRequests ?? [],
    activeOrders: activeArr,
    pendingApproval: pendingApproval ?? [],
    maintenanceAlerts: maintenanceAlerts ?? [],
    counts: {
      repairRequests: (repairRequests ?? []).length,
      pendingApproval: (pendingApproval ?? []).length,
      activeOrders: activeArr.length,
      maintenanceAlerts: (maintenanceAlerts ?? []).length,
      vehiclesInRepair: uniqueVehicles,
    },
  });
}
