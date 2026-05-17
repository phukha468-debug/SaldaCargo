/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/admin/garage — сводка дашборда Гараж */
export async function GET() {
  const supabase = createAdminClient();

  const [
    { data: repairRequests },
    { data: activeOrders },
    { data: pendingApproval },
    { data: extraWorkPending },
    { data: maintenanceAlerts },
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
        id, order_number, created_at,
        asset:assets(short_name, reg_number),
        mechanic:users!service_orders_assigned_mechanic_id_fkey(name),
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
  ]);

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
  });
}
