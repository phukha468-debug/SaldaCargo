/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/** GET /api/driver/profile?driver_id=xxx — профиль водителя */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const driverId = searchParams.get('driver_id');

  if (!driverId) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: user, error } = await (supabase
    .from('users')
    .select('id, name, phone, role, current_asset_id, asset:assets(short_name)')
    .eq('id', driverId)
    .single() as any);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(user);
}
