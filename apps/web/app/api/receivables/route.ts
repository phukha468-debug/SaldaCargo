/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const supabase = createAdminClient();

    const [{ data: orders, error }, { data: manuals, error: manualError }] = await Promise.all([
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (manualError) return NextResponse.json({ error: manualError.message }, { status: 500 });

    const grouped = new Map<string, any>();

    for (const order of orders ?? []) {
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
          orders: [],
          oldest_at: order.created_at,
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

    for (const m of manuals ?? []) {
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
          orders: [],
          oldest_at: m.date,
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

    const result = Array.from(grouped.values())
      .map((g) => ({ ...g, total: g.total.toFixed(2) }))
      .sort((a, b) => parseFloat(b.total) - parseFloat(a.total));

    const totalAmount = result.reduce((s, g) => s + parseFloat(g.total), 0).toFixed(2);
    const overdueCount = result.filter((g) => {
      const days = (Date.now() - new Date(g.oldest_at).getTime()) / 86400000;
      return days > 30;
    }).length;

    return NextResponse.json({ debtors: result, totalAmount, overdueCount });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { counterparty_id, amount, date, description } = body;

    if (!counterparty_id || !amount || !date) {
      return NextResponse.json(
        { error: 'counterparty_id, amount, date — обязательны' },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const cookieStore = await cookies();
    let adminId = cookieStore.get('salda_user_id')?.value ?? null;

    if (!adminId) {
      const { data: adminUser } = await (supabase as any)
        .from('users')
        .select('id')
        .contains('roles', ['admin'])
        .limit(1)
        .maybeSingle();
      adminId = adminUser?.id ?? 'e9a1c980-eb1e-5c87-9f6d-c7f67eb28a1d';
    }

    const { data, error } = await (supabase as any)
      .from('manual_receivables')
      .insert({
        counterparty_id,
        amount: parseFloat(amount).toFixed(2),
        date,
        description: description?.trim() || null,
        created_by: adminId,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
