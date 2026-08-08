/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/garage/reminders — получить список активных напоминаний о ТО для прозвона клиентам */
export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: recs, error } = await (supabase as any)
      .from('client_vehicle_recommendations')
      .select(
        `
        id, text, due_km, due_date, is_done, done_at, created_at,
        client_vehicle_id, service_order_id,
        vehicle:client_vehicles(
          id, brand, model, reg_number,
          counterparty:counterparties(id, name, phone)
        ),
        order:service_orders!client_vehicle_recommendations_service_order_id_fkey(
          id, order_number, odometer_end
        )
      `,
      )
      .eq('is_done', false)
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return NextResponse.json(recs ?? []);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

/** PATCH /api/garage/reminders — отметить прозвон клиенту выполненным (is_done = true) */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, is_done } = body as { id: string; is_done?: boolean };

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const supabase = createAdminClient();
    const { data, error } = await (supabase as any)
      .from('client_vehicle_recommendations')
      .update({
        is_done: is_done ?? true,
        done_at: is_done === false ? null : new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
