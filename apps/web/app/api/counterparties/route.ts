/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/counterparties — список контрагентов с суммой текущего долга */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'client' | 'supplier' | 'both' | null

    const supabase = createAdminClient();

    let q = (supabase as any)
      .from('counterparties')
      .select('id, name, phone, type, credit_limit, notes, is_active, payable_amount')
      .order('name');

    if (type) q = q.eq('type', type);

    const { data: counterparties, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Суммы pending долгов по каждому контрагенту
    const { data: pendingOrders } = await (supabase as any)
      .from('trip_orders')
      .select('counterparty_id, amount')
      .eq('settlement_status', 'pending')
      .eq('lifecycle_status', 'approved')
      .not('counterparty_id', 'is', null);

    const debtMap = new Map<string, number>();
    for (const o of pendingOrders ?? []) {
      debtMap.set(
        o.counterparty_id,
        (debtMap.get(o.counterparty_id) ?? 0) + parseFloat(o.amount ?? '0'),
      );
    }

    const result = (counterparties ?? []).map((cp: any) => ({
      ...cp,
      outstanding_debt: (debtMap.get(cp.id) ?? 0).toFixed(2),
    }));

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

/** POST /api/counterparties — создать контрагента */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name: string;
      type: string;
      phone?: string;
      credit_limit?: string;
      notes?: string;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Название обязательно' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data, error } = await (supabase.from('counterparties') as any)
      .insert({
        name: body.name.trim(),
        type: body.type || 'client',
        phone: body.phone?.trim() || null,
        credit_limit: body.credit_limit || null,
        notes: body.notes?.trim() || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
