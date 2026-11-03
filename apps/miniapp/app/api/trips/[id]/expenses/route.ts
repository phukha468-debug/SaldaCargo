/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** POST /api/trips/:id/expenses — добавить расход */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const body = (await request.json()) as {
    category_id: string;
    amount: string;
    payment_method: string;
    description?: string;
    receipt_photo?: string;
    idempotency_key: string;
    odometer_end?: number | string | null;
  };

  const supabase = createAdminClient();

  // Если передан одометр рейса — сразу обновляем рейс и одометр актива
  if (
    body.odometer_end != null &&
    !isNaN(Number(body.odometer_end)) &&
    Number(body.odometer_end) > 0
  ) {
    const odoNum = Number(body.odometer_end);
    const { data: trip } = await (supabase.from('trips') as any)
      .update({ odometer_end: odoNum, updated_at: new Date().toISOString() })
      .eq('id', tripId)
      .select('asset_id, odometer_start')
      .maybeSingle();

    if (trip?.asset_id) {
      await (supabase.from('assets') as any)
        .update({ odometer_current: odoNum, updated_at: new Date().toISOString() })
        .eq('id', trip.asset_id);
    }
  }

  const { data, error } = await ((supabase.from('trip_expenses') as any)
    .insert({
      trip_id: tripId,
      category_id: body.category_id,
      amount: body.amount,
      payment_method: body.payment_method,
      description: body.description ?? null,
      receipt_photo: body.receipt_photo ?? null,
      idempotency_key: body.idempotency_key,
    })
    .select()
    .single() as any);

  if (error) {
    // Idempotency
    if (error.code === '23505') {
      const { data: existing } = await (supabase
        .from('trip_expenses')
        .select()
        .eq('idempotency_key', body.idempotency_key)
        .single() as any);
      return NextResponse.json(existing, { status: 200 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
