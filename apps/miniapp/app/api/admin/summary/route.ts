/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/admin/summary — сводка для дашборда админа */
export async function GET() {
  const supabase = createAdminClient();

  const [tripsRes, reviewRes, todayRes] = await Promise.all([
    // Активные рейсы прямо сейчас (без отменённых)
    supabase
      .from('trips')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'in_progress')
      .neq('lifecycle_status', 'cancelled') as any,
    // Рейсы ожидающие ревью (завершены, но ещё draft)
    supabase
      .from('trips')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .eq('lifecycle_status', 'draft') as any,
    // Выручка за сегодня (одобренные заказы)
    supabase
      .from('trip_orders')
      .select('amount')
      .eq('lifecycle_status', 'approved')
      .gte('created_at', new Date().toISOString().slice(0, 10)) as any,
  ]);

  const todayRevenue = (todayRes.data ?? []).reduce(
    (s: number, o: any) => s + parseFloat(o.amount),
    0,
  );

  return NextResponse.json({
    activeTrips: tripsRes.count ?? 0,
    pendingReview: reviewRes.count ?? 0,
    todayRevenue: todayRevenue.toFixed(2),
  });
}
