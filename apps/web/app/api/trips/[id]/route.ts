/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** PATCH /api/trips/:id — редактировать заказы рейса */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      orders?: Array<{
        id: string;
        amount?: string;
        driver_pay?: string;
        loader_pay?: string;
        description?: string;
        payment_method?: string;
        counterparty_name?: string;
      }>;
    };

    const supabase = createAdminClient();

    if (body.orders?.length) {
      for (const order of body.orders) {
        const { id: orderId, ...fields } = order;
        const update: Record<string, any> = {};
        if (fields.amount !== undefined) update.amount = parseFloat(fields.amount).toFixed(2);
        if (fields.driver_pay !== undefined)
          update.driver_pay = parseFloat(fields.driver_pay).toFixed(2);
        if (fields.loader_pay !== undefined)
          update.loader_pay = parseFloat(fields.loader_pay).toFixed(2);
        if (fields.description !== undefined)
          update.description = fields.description?.trim() || null;
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
              if (createErr)
                return NextResponse.json({ error: createErr.message }, { status: 500 });
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
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

/** DELETE /api/trips/:id — отменить рейс (soft-delete) */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { error } = await (supabase.from('trips') as any)
      .update({ lifecycle_status: 'cancelled' })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
