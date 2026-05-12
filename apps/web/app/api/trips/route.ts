/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/trips — рейсы для ревью или истории */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lifecycle = searchParams.get('lifecycle') ?? 'draft';
  const status = searchParams.get('status');
  const date = searchParams.get('date'); // YYYY-MM-DD

  const supabase = createAdminClient();

  let query = supabase
    .from('trips')
    .select(
      `
      id, trip_number, status, lifecycle_status, started_at, ended_at,
      trip_type, odometer_start, odometer_end, driver_note,
      asset:assets(short_name, reg_number),
      driver:users!trips_driver_id_fkey(id, name),
      loader:users!trips_loader_id_fkey(id, name),
      trip_orders(
        id, amount, driver_pay, loader_pay,
        payment_method, settlement_status, lifecycle_status,
        counterparty:counterparties(name)
      ),
      trip_expenses(
        id, amount, payment_method, description,
        category:transaction_categories(name)
      )
    `,
    )
    .eq('lifecycle_status', lifecycle)
    .order('started_at', { ascending: false });

  // Если запрашиваем черновики для ревью — показываем только завершённые
  if (lifecycle === 'draft' && !status) {
    query = query.eq('status', 'completed');
  } else if (status) {
    query = query.eq('status', status);
  }

  if (date) {
    const start = `${date}T00:00:00Z`;
    const end = `${date}T23:59:59Z`;
    query = query.gte('started_at', start).lte('started_at', end);
  }

  const { data, error } = await (query as any);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST /api/trips — ручной ввод рейса (ретро) */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    driver_id: string;
    asset_id: string;
    loader_id?: string;
    trip_type: string;
    odometer_start: number;
    odometer_end: number;
    started_at: string;
    ended_at: string;
    driver_note?: string;
    orders: Array<{
      amount: string;
      driver_pay: string;
      loader_pay: string;
      payment_method: string;
      description?: string;
    }>;
  };

  const supabase = createAdminClient();

  // Создаём рейс
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .insert({
      driver_id: body.driver_id,
      asset_id: body.asset_id,
      loader_id: body.loader_id ?? null,
      trip_type: body.trip_type,
      odometer_start: body.odometer_start,
      odometer_end: body.odometer_end,
      started_at: body.started_at,
      ended_at: body.ended_at,
      status: 'completed',
      lifecycle_status: 'draft', // сразу на ревью
      driver_note: body.driver_note ?? null,
    })
    .select()
    .single();

  if (tripError) return NextResponse.json({ error: tripError.message }, { status: 500 });

  // Создаём заказы
  if (body.orders.length > 0) {
    const ordersToInsert = body.orders.map((o) => ({
      trip_id: trip.id,
      amount: o.amount,
      driver_pay: o.driver_pay,
      loader_pay: o.loader_pay ?? '0',
      payment_method: o.payment_method,
      settlement_status: ['debt_cash'].includes(o.payment_method) ? 'pending' : 'completed',
      lifecycle_status: 'draft',
      description: o.description ?? null,
      idempotency_key: crypto.randomUUID(),
    }));

    const { error: ordersError } = await supabase.from('trip_orders').insert(ordersToInsert);

    if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }

  return NextResponse.json(trip, { status: 201 });
}
