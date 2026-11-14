/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/admin/trips?filter=review|active|history&date=YYYY-MM-DD&month=YYYY-MM&weekStart=YYYY-MM-DD&weekEnd=YYYY-MM-DD */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter') ?? 'review';
  const date = searchParams.get('date');
  const month = searchParams.get('month'); // YYYY-MM
  const weekStart = searchParams.get('weekStart'); // YYYY-MM-DD
  const weekEnd = searchParams.get('weekEnd'); // YYYY-MM-DD
  const tripNumberParam = searchParams.get('trip_number') || searchParams.get('search');
  const cleanTripNum = tripNumberParam ? tripNumberParam.replace(/[^0-9]/g, '') : null;

  const supabase = createAdminClient();

  if (cleanTripNum) {
    const query = (supabase as any)
      .from('trips')
      .select(
        `
        id, trip_number, status, lifecycle_status, started_at, ended_at,
        trip_type, odometer_start, odometer_end, driver_note,
        driver:users!trips_driver_id_fkey(id, name),
        asset:assets(id, short_name, reg_number, notes, asset_type:asset_types(code, name)),
        trip_orders(
          id, amount, driver_pay, loader_pay, loader2_pay, loaders_data,
          direction, is_driver_loader, driver_loader_pay, driver_car_pay,
          payment_method, settlement_status, lifecycle_status,
          counterparty:counterparties(id, name)
        ),
        trip_expenses(
          id, amount, payment_method, description,
          category:transaction_categories(name)
        )
      `,
      )
      .eq('trip_number', parseInt(cleanTripNum, 10))
      .order('started_at', { ascending: false });

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }

  if (filter === 'history') {
    let query = (supabase as any)
      .from('trips')
      .select(
        `
        id, trip_number, status, lifecycle_status, started_at, ended_at,
        trip_type, odometer_start, odometer_end, driver_note,
        driver:users!trips_driver_id_fkey(id, name),
        asset:assets(id, short_name, reg_number, notes, asset_type:asset_types(code, name)),
        trip_orders(
          id, amount, driver_pay, loader_pay, loader2_pay, loaders_data,
          direction, is_driver_loader, driver_loader_pay, driver_car_pay,
          payment_method, settlement_status, lifecycle_status,
          counterparty:counterparties(id, name)
        ),
        trip_expenses(
          id, amount, payment_method, description,
          category:transaction_categories(name)
        )
      `,
      )
      .eq('lifecycle_status', 'approved')
      .order('started_at', { ascending: false })
      .limit(500);

    if (month) {
      const parts = month.split('-');
      const y = parseInt(parts[0]!, 10);
      const m = parseInt(parts[1]!, 10);
      const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
      const end = new Date(Date.UTC(y, m, 1)).toISOString();
      query = query.gte('started_at', start).lt('started_at', end);
    } else if (weekStart && weekEnd) {
      const start = `${weekStart}T00:00:00Z`;
      const end = `${weekEnd}T23:59:59Z`;
      query = query.gte('started_at', start).lte('started_at', end);
    } else if (date) {
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
    asset:assets(id, short_name, reg_number, notes, asset_type:asset_types(code)),
    trip_orders(
      id, amount, driver_pay, loader_pay, loader2_pay, loaders_data,
      is_driver_loader, driver_loader_pay, driver_car_pay,
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
    trip_orders(amount, driver_pay, loader_pay, loader2_pay, loaders_data, lifecycle_status),
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
