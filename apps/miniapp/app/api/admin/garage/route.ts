/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const PAYROLL_MECHANIC_CAT = '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6';

/** GET /api/admin/garage — сводка дашборда Гараж */
export async function GET() {
  const supabase = createAdminClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    { data: repairRequests },
    { data: activeOrders },
    { data: pendingApproval },
    { data: extraWorkPending },
    { data: maintenanceAlerts },
    { data: allServiceOrders },
    { data: salaryTxs },
  ] = await Promise.all([
    // Новые заявки от водителей
    (supabase.from('repair_requests') as any)
      .select(
        `
        id, created_at, custom_description,
        asset:assets(short_name, reg_number),
        driver:users!repair_requests_driver_id_fkey(name),
        fault:fault_catalog(name, category)
      `,
      )
      .eq('status', 'new')
      .order('created_at', { ascending: false }),

    // Активные наряды (в работе + открытые)
    (supabase.from('service_orders') as any)
      .select(
        `
        id, order_number, status, created_at,
        asset:assets(short_name, reg_number),
        mechanic:users!service_orders_assigned_mechanic_id_fkey(name),
        second_mechanic:users!service_orders_second_mechanic_id_fkey(name)
      `,
      )
      .in('status', ['created', 'in_progress'])
      .neq('lifecycle_status', 'cancelled')
      .order('created_at', { ascending: false }),

    // Наряды на утверждении (механик завершил)
    (supabase.from('service_orders') as any)
      .select(
        `
        id, order_number, created_at, machine_type,
        asset:assets(short_name, reg_number),
        mechanic:users!service_orders_assigned_mechanic_id_fkey(id, name),
        second_mechanic:users!service_orders_second_mechanic_id_fkey(id, name),
        service_order_works(norm_minutes, actual_minutes, status)
      `,
      )
      .eq('status', 'completed')
      .eq('lifecycle_status', 'draft')
      .order('created_at', { ascending: false }),

    // Доп. работы на согласовании
    (supabase.from('service_order_works') as any)
      .select(
        `
        id, extra_work_mechanic_note, norm_minutes, created_at, custom_work_name,
        work:work_catalog(name),
        service_order:service_orders(
          id, order_number,
          asset:assets(short_name, reg_number),
          mechanic:users!service_orders_assigned_mechanic_id_fkey(name)
        )
      `,
      )
      .eq('extra_work_status', 'pending_approval')
      .order('created_at', { ascending: false }),

    // Алерты ТО
    (supabase.from('maintenance_items') as any)
      .select(
        `
        id, work_name, alert_status, next_due_km, next_due_at,
        asset:assets(short_name, reg_number, odometer_current)
      `,
      )
      .in('alert_status', ['overdue', 'soon'])
      .order('alert_status', { ascending: false })
      .order('next_due_km', { ascending: true }),

    // Все наряды с работами
    (supabase.from('service_orders') as any).select(
      'id, client_vehicle_id, status, lifecycle_status, created_at, updated_at, service_order_works(price_client, status)',
    ),

    // Начислено / выплачено ЗП механикам
    (supabase.from('transactions') as any)
      .select('amount, created_at')
      .eq('category_id', PAYROLL_MECHANIC_CAT)
      .eq('lifecycle_status', 'approved'),
  ]);

  let clientRevenueThisMonth = 0;
  let clientRevenueAllTime = 0;
  let clientActiveSum = 0;
  let clientActiveCount = 0;

  let ownFleetThisMonth = 0;
  let ownFleetAllTime = 0;

  let completedOrdersThisMonth = 0;
  let completedOrdersAllTime = 0;
  let inProgressOrdersCount = 0;

  (allServiceOrders || []).forEach((o: any) => {
    const isClient = o.client_vehicle_id != null;
    const isApproved = o.lifecycle_status === 'approved';
    const isCompletedOrApproved = o.status === 'completed' || isApproved;
    const isThisMonth = (o.updated_at || o.created_at) >= monthStart;
    const isActive = o.status === 'created' || o.status === 'in_progress';

    if (isActive) inProgressOrdersCount++;
    if (isCompletedOrApproved) {
      completedOrdersAllTime++;
      if (isThisMonth) completedOrdersThisMonth++;
    }

    const worksSum = (o.service_order_works ?? [])
      .filter((w: any) => w.status === 'completed' || isCompletedOrApproved || isActive)
      .reduce((s: number, w: any) => s + parseFloat(w.price_client ?? '0'), 0);

    if (isClient) {
      if (isCompletedOrApproved) {
        clientRevenueAllTime += worksSum;
        if (isThisMonth) clientRevenueThisMonth += worksSum;
      }
      if (isActive) {
        clientActiveSum += worksSum;
        clientActiveCount++;
      }
    } else {
      if (isCompletedOrApproved) {
        ownFleetAllTime += worksSum;
        if (isThisMonth) ownFleetThisMonth += worksSum;
      }
    }
  });

  const salaryArr = (salaryTxs ?? []) as any[];
  const salaryThisMonth = salaryArr
    .filter((t: any) => t.created_at >= monthStart)
    .reduce((s: number, t: any) => s + parseFloat(t.amount ?? '0'), 0);
  const salaryAllTime = salaryArr.reduce((s: number, t: any) => s + parseFloat(t.amount ?? '0'), 0);

  return NextResponse.json({
    repairRequests: repairRequests ?? [],
    activeOrders: activeOrders ?? [],
    pendingApproval: pendingApproval ?? [],
    extraWorkPending: extraWorkPending ?? [],
    maintenanceAlerts: maintenanceAlerts ?? [],
    counts: {
      repairRequests: (repairRequests ?? []).length,
      pendingApproval: (pendingApproval ?? []).length,
      activeOrders: (activeOrders ?? []).length,
      extraWorkPending: (extraWorkPending ?? []).length,
      maintenanceAlerts: (maintenanceAlerts ?? []).length,
    },
    stats: {
      clientRevenueThisMonth,
      clientRevenueAllTime,
      clientActiveSum,
      clientActiveCount,
      salaryThisMonth,
      salaryAllTime,
      ownFleetThisMonth,
      ownFleetAllTime,
      completedOrdersThisMonth,
      completedOrdersAllTime,
      inProgressOrdersCount,
    },
  });
}
