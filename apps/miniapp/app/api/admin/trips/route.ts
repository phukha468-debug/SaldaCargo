/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/admin/trips?filter=review|active|history&date=YYYY-MM-DD */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter') ?? 'review';
  const date = searchParams.get('date');

  const supabase = createAdminClient();

  if (filter === 'history') {
    let query = (supabase as any)
      .from('trips')
      .select(
        `
        id, trip_number, status, lifecycle_status, started_at, ended_at,
        trip_type, odometer_start, odometer_end, driver_note,
        driver:users!trips_driver_id_fkey(id, name),
        asset:assets(short_name, reg_number),
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
      .neq('lifecycle_status', 'cancelled')
      .order('started_at', { ascending: false })
      .limit(100);

    if (date) {
      const start = `${date}T00:00:00Z`;
      const end = `${date}T23:59:59Z`;
      query = query.gte('started_at', start).lte('started_at', end);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }

  const reviewSelect = `
    id, trip_number, status, lifecycle_status, started_at, ended_at,
    trip_type, odometer_start, odometer_end, driver_note,
    driver:users!trips_driver_id_fkey(id, name),
    asset:assets(short_name, reg_number),
    trip_orders(
      id, amount, driver_pay, loader_pay,
      payment_method, settlement_status, lifecycle_status,
      counterparty:counterparties(name)
    ),
    trip_expenses(
      id, amount, payment_method, description,
      category:transaction_categories(name)
    )
  `;

  const activeSelect = `
    id, trip_number, status, lifecycle_status, started_at, ended_at, trip_type,
    driver:users!trips_driver_id_fkey(name),
    asset:assets(short_name, reg_number),
    trip_orders(amount, driver_pay, lifecycle_status),
    trip_expenses(amount)
  `;

  let query = (supabase as any)
    .from('trips')
    .select(filter === 'review' ? reviewSelect : activeSelect)
    .order('started_at', { ascending: false })
    .limit(50);

  if (filter === 'review') {
    query = query.eq('status', 'completed').eq('lifecycle_status', 'draft');
  } else if (filter === 'active') {
    query = query.eq('status', 'in_progress').neq('lifecycle_status', 'cancelled');
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
