/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { isGazelleAsset, isTruckAsset } from '@saldacargo/shared';

/**
 * POST /api/driver/vehicle-odometer
 * Обновление текущего показания одометра автомобиля (например, ежемесячный ввод для Валдая/Кантера)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { asset_id, odometer } = body as { asset_id?: string; odometer?: number | string };

    if (!asset_id) {
      return NextResponse.json({ error: 'Не указан ID автомобиля' }, { status: 400 });
    }

    const odoNum = Number(odometer);
    if (odometer == null || isNaN(odoNum) || odoNum <= 0) {
      return NextResponse.json(
        { error: 'Укажите корректный одометр (положительное число)' },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const { data: asset, error: assetErr } = await (supabase.from('assets') as any)
      .select('id, short_name, reg_number, odometer_current, asset_type:asset_types(code)')
      .eq('id', asset_id)
      .maybeSingle();

    if (assetErr || !asset) {
      return NextResponse.json({ error: 'Автомобиль не найден' }, { status: 404 });
    }

    const prevOdo = Number(asset.odometer_current || 0);
    if (prevOdo > 0 && odoNum < prevOdo) {
      return NextResponse.json(
        {
          error: `Новый одометр (${odoNum.toLocaleString('ru-RU')} км) не может быть меньше текущего (${prevOdo.toLocaleString('ru-RU')} км)`,
        },
        { status: 400 },
      );
    }

    const { error: updateErr } = await (supabase.from('assets') as any)
      .update({
        odometer_current: odoNum,
        updated_at: new Date().toISOString(),
      })
      .eq('id', asset_id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      asset_id,
      odometer_current: odoNum,
      delta: prevOdo > 0 ? odoNum - prevOdo : 0,
      is_truck: isTruckAsset(asset),
      is_gazelle: isGazelleAsset(asset),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
