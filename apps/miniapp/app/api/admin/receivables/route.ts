/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/admin/receivables — список должников (дебиторка) */
export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: orders, error } = await (supabase as any)
      .from('trip_orders')
      .select(
        `id, amount, payment_method, created_at,
         counterparty:counterparties(id, name, phone),
         trip:trips!inner(trip_number, started_at, lifecycle_status, driver:users!trips_driver_id_fkey(name))`,
      )
      .eq('settlement_status', 'pending')
      .eq('lifecycle_status', 'approved')
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const grouped = new Map<string, any>();

    for (const order of orders ?? []) {
      const cpId = order.counterparty?.id ?? '__unknown__';
      const cpName = order.counterparty?.name ?? 'Без контрагента';

      if (!grouped.has(cpId)) {
        grouped.set(cpId, {
          counterparty_id: cpId,
          counterparty_name: cpName,
          total: 0,
          oldest_at: order.created_at,
          orders: [],
        });
      }

      const g = grouped.get(cpId)!;
      g.total += parseFloat(order.amount ?? '0');
      if (order.created_at < g.oldest_at) g.oldest_at = order.created_at;
      g.orders.push({
        id: order.id,
        amount: order.amount,
        payment_method: order.payment_method,
        created_at: order.created_at,
        trip_number: order.trip?.trip_number,
        started_at: order.trip?.started_at,
        driver_name: order.trip?.driver?.name,
      });
    }

    const debtors = Array.from(grouped.values())
      .map((g) => ({ ...g, total: g.total.toFixed(2) }))
      .sort((a, b) => parseFloat(b.total) - parseFloat(a.total));

    const totalAmount = debtors.reduce((s, g) => s + parseFloat(g.total), 0).toFixed(2);

    return NextResponse.json({ debtors, totalAmount });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
