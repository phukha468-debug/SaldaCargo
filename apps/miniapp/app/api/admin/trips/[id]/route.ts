/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/admin/trips/:id — полная информация о рейсе */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await (supabase
    .from('trips')
    .select(
      `
      id, trip_number, status, lifecycle_status, started_at, ended_at,
      odometer_start, odometer_end, trip_type, driver_note,
      driver:users!trips_driver_id_fkey(id, name),
      asset:assets(short_name, reg_number),
      loader:users!trips_loader_id_fkey(name),
      trip_orders(id, amount, driver_pay, loader_pay, payment_method, settlement_status, lifecycle_status, description,
        counterparty:counterparties(name)),
      trip_expenses(id, amount, payment_method, description,
        category:transaction_categories(name))
    `,
    )
    .eq('id', id)
    .single() as any);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** PATCH /api/admin/trips/:id — одобрить или вернуть рейс */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as { action: 'approve' | 'return'; note?: string };
  const supabase = createAdminClient();

  if (body.action === 'approve') {
    // Одобряем рейс и все его заказы
    const { error: tripError } = await (supabase.from('trips') as any)
      .update({ lifecycle_status: 'approved' })
      .eq('id', id);

    if (tripError) return NextResponse.json({ error: tripError.message }, { status: 500 });

    await (supabase.from('trip_orders') as any)
      .update({ lifecycle_status: 'approved' })
      .eq('trip_id', id)
      .neq('lifecycle_status', 'cancelled');

    return NextResponse.json({ ok: true, action: 'approved' });
  }

  if (body.action === 'return') {
    const { error } = await (supabase.from('trips') as any)
      .update({ lifecycle_status: 'returned', driver_note: body.note ?? null })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'returned' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
