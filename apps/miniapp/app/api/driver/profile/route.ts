/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { getVerifiedMiniappUserId } from '@/lib/auth/server';
import { NextResponse } from 'next/server';

/** GET /api/driver/profile — профиль текущего водителя */
export async function GET() {
  const driverId = await getVerifiedMiniappUserId();

  if (!driverId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();

  const { data: user, error } = await (supabase
    .from('users')
    .select('id, name, phone, roles, current_asset_id')
    .eq('id', driverId)
    .single() as any);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Получаем текущую машину если есть
  let currentAsset = null;
  if (user?.current_asset_id) {
    const { data: asset } = await (supabase
      .from('assets')
      .select('id, short_name, reg_number')
      .eq('id', user.current_asset_id)
      .single() as any);
    currentAsset = asset;
  }

  return NextResponse.json({ ...user, asset: currentAsset });
}

/** PATCH /api/driver/profile — обновить закреплённую машину */
export async function PATCH(request: Request) {
  const driverId = await getVerifiedMiniappUserId();

  if (!driverId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { asset_id } = (await request.json()) as { asset_id: string | null };
  const supabase = createAdminClient();

  const { error } = await (supabase.from('users') as any)
    .update({ current_asset_id: asset_id })
    .eq('id', driverId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let asset = null;
  if (asset_id) {
    const { data: assetData } = await (supabase
      .from('assets')
      .select('id, short_name, reg_number, odometer_current')
      .eq('id', asset_id)
      .single() as any);
    asset = assetData;
  }

  return NextResponse.json({ ok: true, current_asset_id: asset_id, asset });
}
