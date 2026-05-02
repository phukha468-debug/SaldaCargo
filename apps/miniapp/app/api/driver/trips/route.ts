/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/** GET /api/driver/trips?driver_id=xxx — история рейсов водителя */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const driverId = searchParams.get('driver_id');

  if (!driverId) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await (supabase
    .from('trips')
    .select(
      `
      id, trip_number, status, lifecycle_status, started_at, ended_at,
      asset:assets(short_name),
      trip_orders(amount, driver_pay, lifecycle_status)
    `,
    )
    .eq('driver_id', driverId)
    .order('started_at', { ascending: false }) as any);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
