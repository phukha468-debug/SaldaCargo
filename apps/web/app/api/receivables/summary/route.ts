/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/receivables/summary — lightweight summary for dashboard widget */
export async function GET() {
  try {
    const supabase = createAdminClient();
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    const [ordersRes, manualsRes, followUpsRes] = await Promise.all([
      (supabase as any)
        .from('trip_orders')
        .select('amount, counterparty_id, created_at')
        .eq('settlement_status', 'pending')
        .eq('lifecycle_status', 'approved'),
      (supabase as any).from('manual_receivables').select('amount').eq('settled', false),
      (supabase as any)
        .from('receivable_follow_ups')
        .select('status, promise_date, counterparty_id'),
    ]);

    const orders: any[] = ordersRes.data ?? [];
    const manuals: any[] = manualsRes.data ?? [];
    const followUps: any[] = followUpsRes.data ?? [];

    const total = [...orders, ...manuals]
      .reduce((s, r) => s + parseFloat(r.amount ?? '0'), 0)
      .toFixed(2);

    // Unique real counterparty debtors
    const counterpartyIds = new Set(orders.map((o) => o.counterparty_id).filter(Boolean));
    const count = counterpartyIds.size + manuals.length;

    // Overdue: oldest order per counterparty > 30 days (simplified: any order > 30 days)
    const overdueIds = new Set(
      orders.filter((o) => o.created_at < thirtyDaysAgo).map((o) => o.counterparty_id),
    );
    const overdueCount = overdueIds.size;

    // Promised debtors
    const promisedCount = followUps.filter((f) => f.status === 'promised').length;

    // Urgent: promise_date today or overdue
    const urgentToday = followUps.filter((f) => f.promise_date && f.promise_date <= today).length;

    return NextResponse.json({ total, count, overdueCount, promisedCount, urgentToday });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
