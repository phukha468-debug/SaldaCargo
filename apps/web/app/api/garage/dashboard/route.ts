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
    { data: allServiceOrders },
    { data: salaryTxs },
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

    // Все наряды с работами и запчастями для детализированной финансовой статистики
    (supabase.from('service_orders') as any).select(
      'id, machine_type, client_vehicle_id, status, lifecycle_status, created_at, service_order_works(price_client, status), service_order_parts(client_price, quantity)',
    ),

    // Начислено ЗП механикам (без транзакций выплат)
    (supabase.from('transactions') as any)
      .select('amount, created_at, description, from_wallet_id')
      .eq('category_id', PAYROLL_MECHANIC_CAT)
      .eq('lifecycle_status', 'approved')
      .is('from_wallet_id', null),
  ]);

  const activeArr = activeOrders ?? [];
  const uniqueVehicles = new Set(activeArr.map((o: any) => o.asset?.reg_number).filter(Boolean))
    .size;

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
    if (o.lifecycle_status === 'cancelled') return;

    const isClient = o.machine_type === 'client' || o.client_vehicle_id != null;
    const isApproved = o.lifecycle_status === 'approved';
    const isThisMonth = o.created_at >= monthStart;
    const isActive = o.lifecycle_status === 'draft' && o.status !== 'completed';

    if (isActive) inProgressOrdersCount++;
    if (isApproved) {
      completedOrdersAllTime++;
      if (isThisMonth) completedOrdersThisMonth++;
    }

    const worksSum = (o.service_order_works ?? [])
      .filter((w: any) => w.status !== 'cancelled')
      .reduce((s: number, w: any) => s + parseFloat(w.price_client ?? '0'), 0);

    const partsSum = (o.service_order_parts ?? []).reduce(
      (s: number, p: any) =>
        s + parseFloat(p.client_price ?? '0') * (parseFloat(p.quantity ?? '1') || 1),
      0,
    );

    const orderTotal = worksSum + partsSum;

    if (isClient) {
      if (isApproved) {
        clientRevenueAllTime += orderTotal;
        if (isThisMonth) clientRevenueThisMonth += orderTotal;
      }
      if (isActive) {
        clientActiveSum += orderTotal;
        clientActiveCount++;
      }
    } else {
      if (isApproved) {
        ownFleetAllTime += orderTotal;
        if (isThisMonth) ownFleetThisMonth += orderTotal;
      }
    }
  });

  const salaryArr = ((salaryTxs ?? []) as any[]).filter(
    (t: any) =>
      !t.from_wallet_id && (!t.description || !t.description.startsWith('Выплата зарплаты')),
  );
  const salaryThisMonth = salaryArr
    .filter((t: any) => t.created_at >= monthStart)
    .reduce((s: number, t: any) => s + parseFloat(t.amount ?? '0'), 0);
  const salaryAllTime = salaryArr.reduce((s: number, t: any) => s + parseFloat(t.amount ?? '0'), 0);

  const clientProfitThisMonth = clientRevenueThisMonth - salaryThisMonth;
  const clientProfitAllTime = clientRevenueAllTime - salaryAllTime;

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
      completedOrders: completedOrdersThisMonth,
      revenue: clientProfitThisMonth.toFixed(2),
      salaryAccrued: salaryThisMonth.toFixed(2),
    },
    stats: {
      clientRevenueThisMonth,
      clientRevenueAllTime,
      clientProfitThisMonth,
      clientProfitAllTime,
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
