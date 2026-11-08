/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

function normalizePlate(reg?: string | null): string {
  if (!reg) return '';
  return reg
    .trim()
    .toUpperCase()
    .replace(/[\s\-]/g, '');
}

export async function GET() {
  try {
    const supabase = createAdminClient();

    // Загружаем исключительно сохраненные пользователем шаблоны из базы данных (order_presets)
    // Никаких жестко закодированных или фиктивных шаблонов по умолчанию!
    const { data: dbPresets, error } = await (supabase.from('order_presets') as any)
      .select('id, title, carrier_settings, updated_at')
      .ilike('title', '[ПЛ]%');

    if (error) {
      console.warn('Ошибка выборки шаблонов ПЛ из БД:', error.message);
    }

    const templates: Record<string, any> = {};

    for (const p of dbPresets || []) {
      const settings = p.carrier_settings || {};
      const rawReg = settings.vehicle_reg || p.title.replace(/^\[ПЛ\]\s*/, '').trim();
      const normReg = normalizePlate(rawReg);
      if (normReg && settings.fields) {
        templates[normReg] = {
          id: p.id,
          name: normReg,
          vehicleReg: rawReg,
          updatedAt: p.updated_at,
          ...settings.fields,
        };
      }
    }

    return NextResponse.json({ templates });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawReg = body.vehicle_reg || body.name;
    const vehicleReg = normalizePlate(rawReg);
    const fields = body.fields || body;

    if (!vehicleReg) {
      return NextResponse.json({ error: 'Укажите гос. номер автомобиля' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const presetTitle = `[ПЛ] ${vehicleReg}`;

    // Проверяем существующий шаблон в order_presets
    const { data: existing } = await (supabase.from('order_presets') as any)
      .select('id')
      .or(`title.eq.${presetTitle},title.eq.[ПЛ] ${rawReg}`)
      .maybeSingle();

    const payload = {
      title: presetTitle,
      carrier_settings: {
        type: 'waybill_template',
        vehicle_reg: vehicleReg,
        fields,
      },
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      await (supabase.from('order_presets') as any).update(payload).eq('id', existing.id);
    } else {
      await (supabase.from('order_presets') as any).insert(payload);
    }

    return NextResponse.json({
      success: true,
      name: vehicleReg,
      message: `Шаблон для автомобиля "${vehicleReg}" сохранен`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawReg = searchParams.get('reg');
    const vehicleReg = normalizePlate(rawReg);

    if (!vehicleReg) {
      return NextResponse.json({ error: 'Не указан номер авто' }, { status: 400 });
    }

    const supabase = createAdminClient();
    await (supabase.from('order_presets') as any)
      .delete()
      .or(`title.eq.[ПЛ] ${vehicleReg},title.eq.[ПЛ] ${rawReg}`);

    return NextResponse.json({ success: true, message: `Шаблон "${vehicleReg}" удален` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
