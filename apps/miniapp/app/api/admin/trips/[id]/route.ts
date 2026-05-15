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

/** PATCH /api/admin/trips/:id — одобрить, вернуть или отредактировать заказы */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as {
    action: 'approve' | 'return' | 'edit_orders';
    note?: string;
    orders?: Array<{
      id: string;
      amount?: string;
      driver_pay?: string;
      loader_pay?: string;
      payment_method?: string;
      counterparty_name?: string;
    }>;
  };
  const supabase = createAdminClient();

  if (body.action === 'edit_orders') {
    if (!body.orders?.length) return NextResponse.json({ ok: true });
    for (const order of body.orders) {
      const { id: orderId, ...fields } = order;
      const update: Record<string, any> = {};
      if (fields.amount !== undefined) update.amount = parseFloat(fields.amount).toFixed(2);
      if (fields.driver_pay !== undefined)
        update.driver_pay = parseFloat(fields.driver_pay).toFixed(2);
      if (fields.loader_pay !== undefined)
        update.loader_pay = parseFloat(fields.loader_pay).toFixed(2);
      if (fields.payment_method !== undefined) update.payment_method = fields.payment_method;
      if (fields.counterparty_name !== undefined) {
        const name = fields.counterparty_name.trim();
        if (name) {
          const { data: found } = await (supabase.from('counterparties') as any)
            .select('id')
            .ilike('name', name)
            .maybeSingle();
          if (found) {
            update.counterparty_id = found.id;
          } else {
            const { data: created, error: createErr } = await (
              supabase.from('counterparties') as any
            )
              .insert({ name, type: 'client' })
              .select('id')
              .single();
            if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });
            update.counterparty_id = created.id;
          }
        }
      }
      if (Object.keys(update).length > 0) {
        const { error } = await (supabase.from('trip_orders') as any)
          .update(update)
          .eq('id', orderId)
          .eq('trip_id', id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: true });
  }

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
      .update({
        status: 'in_progress',
        lifecycle_status: 'returned',
        odometer_end: null,
        ended_at: null,
        driver_note: body.note ?? null,
      })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Откатываем заказы в draft — не должны учитываться в P&L до повторного апрува
    await (supabase.from('trip_orders') as any)
      .update({ lifecycle_status: 'draft' })
      .eq('trip_id', id)
      .neq('lifecycle_status', 'cancelled');

    return NextResponse.json({ ok: true, action: 'returned' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
