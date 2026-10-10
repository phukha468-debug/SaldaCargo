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
      loaders_count?: number;
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
      .neq('lifecycle_status', 'cancelled')
      .maybeSingle() as any);

    if (existing) {
      return NextResponse.json(
        { error: `У вас уже есть активный рейс №${existing.trip_number}` },
        { status: 409 },
      );
    }

    // 1.5. Проверяем: если рейс создаётся на "БЕЗ АВТО", разрешено ли пользователю
    const { data: asset } = await (supabase
      .from('assets')
      .select('id, short_name, reg_number')
      .eq('id', body.asset_id)
      .maybeSingle() as any);

    const isPrrAsset =
      asset?.reg_number === 'БЕЗ АВТО' || asset?.short_name?.toLowerCase().includes('без авто');

    if (isPrrAsset) {
      const { data: user } = await (supabase
        .from('users')
        .select('name, roles')
        .eq('id', userId)
        .maybeSingle() as any);

      const roles = Array.isArray(user?.roles) ? user.roles : [];
      const isPrrAdmin =
        roles.includes('admin') ||
        roles.includes('owner') ||
        Boolean(user?.name && /Нигамед|Шахмаев|Роман.*Радик|Радикович/i.test(user.name));

      if (!isPrrAdmin) {
        return NextResponse.json(
          { error: 'Рейс без автомобиля могут создавать только администраторы' },
          { status: 403 },
        );
      }
    }

    // 2. Создаем новый рейс
    const finalTripType = isPrrAsset ? 'loaders_only' : (body.trip_type as any);

    const { data, error } = await ((supabase.from('trips') as any)
      .insert({
        driver_id: userId,
        asset_id: body.asset_id,
        loaders_count: body.loaders_count ?? 0,
        trip_type: finalTripType,
        odometer_start: body.odometer_start ?? 0,
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
