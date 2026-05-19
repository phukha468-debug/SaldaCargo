/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TRIP_REVENUE_CATEGORY = '74008cf7-0527-4e9f-afd2-d232b8f8125a';
const CASH_ID = '10000000-0000-0000-0000-000000000002';

/** POST /api/trips/:id/approve — утвердить рейс */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const adminId = cookieStore.get('salda_auth_token')?.value ?? null;
  const supabase = createAdminClient();

  const { data: trip, error: fetchErr } = await (supabase.from('trips') as any)
    .select('id, trip_number, trip_orders(amount, payment_method, lifecycle_status)')
    .eq('id', id)
    .single();

  if (fetchErr || !trip) return NextResponse.json({ error: 'Рейс не найден' }, { status: 404 });

  const { error: tripError } = await (supabase.from('trips') as any)
    .update({ lifecycle_status: 'approved' })
    .eq('id', id);

  if (tripError) return NextResponse.json({ error: tripError.message }, { status: 500 });

  const { error: ordersError } = await (supabase.from('trip_orders') as any)
    .update({ lifecycle_status: 'approved' })
    .eq('trip_id', id)
    .eq('lifecycle_status', 'draft');

  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 });

  // Автоматически зачисляем наличные с рейса в Сейф
  const cashOrders = ((trip.trip_orders as any[]) ?? []).filter(
    (o: any) => o.payment_method === 'cash' && o.lifecycle_status !== 'cancelled',
  );
  const cashTotal = cashOrders.reduce((s: number, o: any) => s + parseFloat(o.amount ?? '0'), 0);

  if (cashTotal > 0) {
    await (supabase.from('transactions') as any).insert({
      direction: 'income',
      category_id: TRIP_REVENUE_CATEGORY,
      amount: cashTotal.toFixed(2),
      to_wallet_id: CASH_ID,
      description: `Наличные рейса №${trip.trip_number}`,
      lifecycle_status: 'approved',
      settlement_status: 'completed',
      created_by: adminId,
      idempotency_key: crypto.randomUUID(),
    });
  }

  return NextResponse.json({ success: true });
}
