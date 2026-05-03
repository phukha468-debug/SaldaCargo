/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/** POST /api/trips — создать рейс */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('salda_user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      asset_id: string;
      loader_id?: string;
      trip_type: string;
      odometer_start: number;
      idempotency_key: string;
    };

    const supabase = createAdminClient();

    // 1. Проверяем нет ли активного рейса у этого водителя
    const { data: existing } = await (supabase
      .from('trips')
      .select('id, trip_number')
      .eq('driver_id', userId)
      .eq('status', 'in_progress')
      .maybeSingle() as any);

    if (existing) {
      return NextResponse.json(
        { error: `У вас уже есть активный рейс №${existing.trip_number}` },
        { status: 409 },
      );
    }

    // 2. Создаем новый рейс
    const { data, error } = await ((supabase
      .from('trips') as any)
      .insert({
        driver_id: userId,
        asset_id: body.asset_id,
        loader_id: body.loader_id || null,
        trip_type: body.trip_type as any,
        odometer_start: body.odometer_start,
        status: 'in_progress',
        lifecycle_status: 'draft',
        started_at: new Date().toISOString(),
      })
      .select()
      .single() as any);

    if (error) {
      console.error('[API Trips] Insert Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error('[API Trips] Fatal Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
