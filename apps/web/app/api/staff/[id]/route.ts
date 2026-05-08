/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { data: user } = await (supabase.from('users') as any)
      .select('id, name, roles')
      .eq('id', id)
      .single();

    if (!user) return NextResponse.json({ error: 'Не найден' }, { status: 404 });

    const roles: string[] = user.roles ?? [];

    // ── Водитель ──────────────────────────────────────────────────────────────
    if (roles.includes('driver')) {
      const { data: trips } = await (supabase.from('trips') as any)
        .select(
          `
          id, trip_number, started_at, ended_at, lifecycle_status, trip_type,
          asset:assets(short_name, reg_number),
          trip_orders(amount, driver_pay, payment_method, lifecycle_status, description)
        `,
        )
        .eq('driver_id', id)
        .gte('started_at', monthStart)
        .lte('started_at', monthEnd)
        .neq('lifecycle_status', 'cancelled')
        .order('started_at', { ascending: false });

      const rows = (trips as any[]) ?? [];

      const totalEarned = rows
        .flatMap((t: any) => (t.trip_orders as any[]) ?? [])
        .filter((o: any) => o.lifecycle_status !== 'cancelled')
        .reduce((s: number, o: any) => s + parseFloat(o.driver_pay ?? '0'), 0);

      const totalRevenue = rows
        .flatMap((t: any) => (t.trip_orders as any[]) ?? [])
        .filter((o: any) => o.lifecycle_status !== 'cancelled')
        .reduce((s: number, o: any) => s + parseFloat(o.amount ?? '0'), 0);

      return NextResponse.json({
        role: 'driver',
        trip_count: rows.length,
        approved_count: rows.filter((t: any) => t.lifecycle_status === 'approved').length,
        total_earned: totalEarned.toFixed(2),
        total_revenue: totalRevenue.toFixed(2),
        trips: rows.map((t: any) => ({
          id: t.id,
          trip_number: t.trip_number,
          started_at: t.started_at,
          lifecycle_status: t.lifecycle_status,
          trip_type: t.trip_type,
          asset: t.asset,
          orders: (t.trip_orders as any[]) ?? [],
          order_total: ((t.trip_orders as any[]) ?? [])
            .filter((o: any) => o.lifecycle_status !== 'cancelled')
            .reduce((s: number, o: any) => s + parseFloat(o.amount ?? '0'), 0)
            .toFixed(2),
          driver_pay_total: ((t.trip_orders as any[]) ?? [])
            .filter((o: any) => o.lifecycle_status !== 'cancelled')
            .reduce((s: number, o: any) => s + parseFloat(o.driver_pay ?? '0'), 0)
            .toFixed(2),
        })),
      });
    }

    // ── Механик ───────────────────────────────────────────────────────────────
    if (roles.includes('mechanic') || roles.includes('mechanic_lead')) {
      const { data: orders } = await (supabase.from('service_orders') as any)
        .select(
          `
          id, order_number, status, machine_type, problem_description,
          created_at,
          asset:assets(short_name, reg_number),
          service_order_works(
            id, custom_work_name, actual_minutes, status,
            work_catalog:work_catalog(name)
          )
        `,
        )
        .eq('assigned_mechanic_id', id)
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      const rows = (orders as any[]) ?? [];

      const totalMinutes = rows
        .flatMap((o: any) => (o.service_order_works as any[]) ?? [])
        .filter((w: any) => w.status !== 'cancelled')
        .reduce((s: number, w: any) => s + (w.actual_minutes ?? 0), 0);

      const completedOrders = rows.filter((o: any) => o.status === 'completed').length;

      return NextResponse.json({
        role: 'mechanic',
        order_count: rows.length,
        completed_count: completedOrders,
        total_minutes: totalMinutes,
        orders: rows.map((o: any) => ({
          id: o.id,
          order_number: o.order_number,
          status: o.status,
          machine_type: o.machine_type,
          problem_description: o.problem_description,
          created_at: o.created_at,
          asset: o.asset,
          works: ((o.service_order_works as any[]) ?? [])
            .filter((w: any) => w.status !== 'cancelled')
            .map((w: any) => ({
              name: w.work_catalog?.name ?? w.custom_work_name ?? 'Без названия',
              actual_minutes: w.actual_minutes ?? 0,
              status: w.status,
            })),
        })),
      });
    }

    return NextResponse.json({ role: 'other' });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
