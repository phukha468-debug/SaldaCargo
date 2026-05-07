/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** POST /api/trips/:id/orders — добавить заказ */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const body = (await request.json()) as {
    counterparty_id?: string;
    description?: string;
    amount: string;
    driver_pay: string;
    loader_pay: string;
    loader2_pay: string;
    payment_method: string;
    idempotency_key: string;
  };

  const supabase = createAdminClient();

  // Определяем settlement_status по способу оплаты
  const pendingMethods = ['bank_invoice', 'debt_cash'];
  const settlementStatus = pendingMethods.includes(body.payment_method) ? 'pending' : 'completed';

  const { data, error } = await ((supabase.from('trip_orders') as any)
    .insert({
      trip_id: tripId,
      counterparty_id: body.counterparty_id ?? null,
      description: body.description ?? null,
      amount: body.amount,
      driver_pay: body.driver_pay,
      loader_pay: body.loader_pay,
      loader2_pay: body.loader2_pay ?? '0',
      payment_method: body.payment_method,
      settlement_status: settlementStatus,
      lifecycle_status: 'draft',
      idempotency_key: body.idempotency_key,
    })
    .select()
    .single() as any);

  if (error) {
    // Idempotency: если ключ уже есть — возвращаем существующий
    if (error.code === '23505') {
      const { data: existing } = await (supabase
        .from('trip_orders')
        .select()
        .eq('idempotency_key', body.idempotency_key)
        .single() as any);
      return NextResponse.json(existing, { status: 200 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
