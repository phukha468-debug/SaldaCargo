/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/admin/receivables — список должников (дебиторка) */
export async function GET() {
  try {
    const supabase = createAdminClient();

    const [ordersRes, manualsRes] = await Promise.all([
      (supabase as any)
        .from('trip_orders')
        .select(
          `id, amount, payment_method, created_at, description,
           counterparty:counterparties(id, name, phone),
           trip:trips!inner(trip_number, started_at, lifecycle_status, driver:users!trips_driver_id_fkey(name))`,
        )
        .eq('settlement_status', 'pending')
        .eq('lifecycle_status', 'approved')
        .order('created_at', { ascending: true }),

      (supabase as any)
        .from('manual_receivables')
        .select('id, amount, date, description, counterparty:counterparties(id, name, phone)')
        .eq('settled', false)
        .order('date', { ascending: true }),
    ]);

    if (ordersRes.error)
      return NextResponse.json({ error: ordersRes.error.message }, { status: 500 });
    if (manualsRes.error)
      return NextResponse.json({ error: manualsRes.error.message }, { status: 500 });

    const grouped = new Map<string, any>();

    for (const order of ordersRes.data ?? []) {
      const hasDescription = !!order.description?.trim();
      const groupKey = hasDescription
        ? `__individual__${order.id}`
        : (order.counterparty?.id ?? '__unknown__');
      const displayName = hasDescription
        ? order.description.trim()
        : (order.counterparty?.name ?? 'Без контрагента');

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          counterparty_id: groupKey,
          counterparty_name: displayName,
          counterparty_phone: hasDescription ? null : (order.counterparty?.phone ?? null),
          counterparty_subname: hasDescription ? (order.counterparty?.name ?? null) : null,
          is_individual: hasDescription,
          total: 0,
          oldest_at: order.created_at,
          orders: [],
        });
      }

      const g = grouped.get(groupKey)!;
      g.total += parseFloat(order.amount ?? '0');
      if (order.created_at < g.oldest_at) g.oldest_at = order.created_at;
      g.orders.push({
        id: order.id,
        type: 'trip_order' as const,
        amount: order.amount,
        payment_method: order.payment_method,
        description: order.description ?? null,
        created_at: order.created_at,
        trip_number: order.trip?.trip_number,
        started_at: order.trip?.started_at,
        driver_name: order.trip?.driver?.name,
      });
    }

    for (const m of manualsRes.data ?? []) {
      const groupKey = m.counterparty?.id ?? '__unknown__';
      const displayName = m.counterparty?.name ?? 'Без контрагента';

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          counterparty_id: groupKey,
          counterparty_name: displayName,
          counterparty_phone: m.counterparty?.phone ?? null,
          counterparty_subname: null,
          is_individual: false,
          total: 0,
          oldest_at: m.date,
          orders: [],
        });
      }

      const g = grouped.get(groupKey)!;
      g.total += parseFloat(m.amount ?? '0');
      if (m.date < g.oldest_at) g.oldest_at = m.date;
      g.orders.push({
        id: m.id,
        type: 'manual' as const,
        amount: m.amount,
        payment_method: null,
        description: m.description ?? null,
        created_at: m.date,
        trip_number: null,
        started_at: m.date,
        driver_name: null,
      });
    }

    const partialResult = Array.from(grouped.values())
      .map((g) => ({ ...g, total: g.total.toFixed(2) }))
      .sort((a, b) => parseFloat(b.total) - parseFloat(a.total));

    // Attach follow-up data for real counterparty groups
    const realCpIds = partialResult
      .filter((g) => !g.is_individual && !String(g.counterparty_id).startsWith('__'))
      .map((g) => g.counterparty_id);

    let followUpMap = new Map<string, any>();
    if (realCpIds.length > 0) {
      const { data: followUps } = await (supabase as any)
        .from('receivable_follow_ups')
        .select('counterparty_id, status, promise_date, last_contact_at, next_contact_at, notes')
        .in('counterparty_id', realCpIds);
      followUpMap = new Map((followUps ?? []).map((f: any) => [f.counterparty_id, f]));
    }

    const debtors = partialResult.map((g) => ({
      ...g,
      follow_up: followUpMap.get(g.counterparty_id) ?? null,
    }));

    const totalAmount = debtors.reduce((s, g) => s + parseFloat(g.total), 0).toFixed(2);

    return NextResponse.json({ debtors, totalAmount });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
