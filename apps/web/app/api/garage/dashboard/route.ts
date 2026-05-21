/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const PAYROLL_MECHANIC_CAT = '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6';

/** GET /api/garage/dashboard — сводка дашборда Гараж */
export async function GET() {
  const supabase = createAdminClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    { data: repairRequests },
    { data: activeOrders },
    { data: pendingApproval },
    { data: maintenanceAlerts },
    { data: completedThisMonth },
    { data: salaryThisMonth },
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
      .eq('lifecycle_status', 'draft')
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

    // Наряды, закрытые в этом месяце (lifecycle=approved)
    (supabase.from('service_orders') as any)
      .select('id, service_order_works(price_client, status)')
      .eq('lifecycle_status', 'approved')
      .gte('updated_at', monthStart),

    // Начисленная ЗП механикам за этот месяц (approved PAYROLL_MECHANIC)
    (supabase.from('transactions') as any)
      .select('amount')
      .eq('category_id', PAYROLL_MECHANIC_CAT)
      .eq('lifecycle_status', 'approved')
      .gte('created_at', monthStart),
  ]);

  const activeArr = activeOrders ?? [];
  const uniqueVehicles = new Set(activeArr.map((o: any) => o.asset?.reg_number).filter(Boolean))
    .size;

  // Выручка за месяц = сумма price_client завершённых работ в закрытых нарядах
  const closedArr = (completedThisMonth ?? []) as any[];
  const revenueThisMonth = closedArr.reduce((total: number, order: any) => {
    const worksRevenue = (order.service_order_works ?? [])
      .filter((w: any) => w.status === 'completed')
      .reduce((s: number, w: any) => s + parseFloat(w.price_client ?? '0'), 0);
    return total + worksRevenue;
  }, 0);

  // ЗП начислено механикам за месяц
  const salaryArr = (salaryThisMonth ?? []) as any[];
  const salaryAccruedThisMonth = salaryArr.reduce(
    (s: number, t: any) => s + parseFloat(t.amount ?? '0'),
    0,
  );

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
    month: {
      completedOrders: closedArr.length,
      revenue: revenueThisMonth.toFixed(2),
      salaryAccrued: salaryAccruedThisMonth.toFixed(2),
    },
  });
}
