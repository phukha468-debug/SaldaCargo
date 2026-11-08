/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Стандартные предзаполненные шаблоны для основного автопарка компании
export const DEFAULT_VEHICLE_TEMPLATES: Record<string, any> = {
  'О 188 ТА 196': {
    vehBrand: 'ГАЗ 2834-LM (Валдай 6м)',
    vehReg: 'О 188 ТА 196',
    vehGarage: '096',
    driverTab: '096',
    driverFio: 'Никифоров Д.В.',
    driverLic: '99 45 273350',
    driverClass: 'B, C, CE',
    licRegNum: 'СТ-66/096',
    licSeries: 'АА',
    licNumber: '014829',
    code_workMode: '1',
    code_col: '1',
    code_brig: '1',
    t2_fuelBrand: 'ДТ',
    t2_fuelCode: '03',
    t2_fuelGiven: '150',
    t2_fuelStart: '45',
    dispFio: 'Шахмаев А.О.',
    dispSig: 'Шахмаев',
    mechOutFio: 'Нигомедьянов Р.Р.',
    mechOutSig: 'Нигомедьянов',
    driverAcceptFio: 'Никифоров Д.В.',
    driverAcceptSig: 'Никифоров',
    medRole: 'Медсестра',
    medSig: 'Шахмаева',
    medFio: 'Шахмаева О.В.',
    note1: 'Замечаний к ТС и водителю нет.',
  },
  'А 096 МВ 196': {
    vehBrand: 'ГАЗ 3010 FD (Валдай 6м)',
    vehReg: 'А 096 МВ 196',
    vehGarage: '095',
    driverTab: '095',
    driverFio: 'Насртдинов В.А.',
    driverLic: '66 12 841920',
    driverClass: 'B, C',
    licRegNum: 'СТ-66/095',
    licSeries: 'АА',
    licNumber: '014830',
    code_workMode: '1',
    code_col: '1',
    code_brig: '1',
    t2_fuelBrand: 'ДТ',
    t2_fuelCode: '03',
    t2_fuelGiven: '150',
    t2_fuelStart: '50',
    dispFio: 'Шахмаев А.О.',
    dispSig: 'Шахмаев',
    mechOutFio: 'Нигомедьянов Р.Р.',
    mechOutSig: 'Нигомедьянов',
    driverAcceptFio: 'Насртдинов В.А.',
    driverAcceptSig: 'Насртдинов',
    medRole: 'Медсестра',
    medSig: 'Шахмаева',
    medFio: 'Шахмаева О.В.',
    note1: 'Замечаний к ТС и водителю нет.',
  },
  'А 661 ТМ 196': {
    vehBrand: 'FUSO CANTER FE85DJ (5т)',
    vehReg: 'А 661 ТМ 196',
    vehGarage: '085',
    driverTab: '085',
    driverFio: 'Никифоров Д.В.',
    driverLic: '99 45 273350',
    driverClass: 'B, C, CE',
    licRegNum: 'СТ-66/085',
    licSeries: 'АА',
    licNumber: '014831',
    code_workMode: '1',
    code_col: '1',
    code_brig: '1',
    t2_fuelBrand: 'ДТ',
    t2_fuelCode: '03',
    t2_fuelGiven: '180',
    t2_fuelStart: '60',
    dispFio: 'Шахмаев А.О.',
    dispSig: 'Шахмаев',
    mechOutFio: 'Нигомедьянов Р.Р.',
    mechOutSig: 'Нигомедьянов',
    driverAcceptFio: 'Никифоров Д.В.',
    driverAcceptSig: 'Никифоров',
    medRole: 'Медсестра',
    medSig: 'Шахмаева',
    medFio: 'Шахмаева О.В.',
    note1: 'Замечаний к ТС и водителю нет.',
  },
  'У 883 АР 96': {
    vehBrand: 'ГАЗ 331061 (Валдай 5м)',
    vehReg: 'У 883 АР 96',
    vehGarage: '083',
    driverTab: '083',
    driverFio: 'Насртдинов В.А.',
    driverLic: '66 12 841920',
    driverClass: 'B, C',
    licRegNum: 'СТ-66/083',
    licSeries: 'АА',
    licNumber: '014832',
    code_workMode: '1',
    code_col: '1',
    code_brig: '1',
    t2_fuelBrand: 'ДТ',
    t2_fuelCode: '03',
    t2_fuelGiven: '140',
    t2_fuelStart: '40',
    dispFio: 'Шахмаев А.О.',
    dispSig: 'Шахмаев',
    mechOutFio: 'Нигомедьянов Р.Р.',
    mechOutSig: 'Нигомедьянов',
    driverAcceptFio: 'Насртдинов В.А.',
    driverAcceptSig: 'Насртдинов',
    medRole: 'Медсестра',
    medSig: 'Шахмаева',
    medFio: 'Шахмаева О.В.',
    note1: 'Замечаний к ТС и водителю нет.',
  },
};

function normalizePlate(reg?: string | null): string {
  if (!reg) return '';
  return reg.trim().toUpperCase().replace(/\s+/g, ' ');
}

export async function GET() {
  try {
    const supabase = createAdminClient();

    // Загружаем сохраненные шаблоны из базы данных (order_presets)
    const { data: dbPresets, error } = await (supabase.from('order_presets') as any)
      .select('id, title, carrier_settings, updated_at')
      .ilike('title', '[ПЛ]%');

    if (error) {
      console.warn('Ошибка выборки шаблонов ПЛ из БД:', error.message);
    }

    const templates: Record<string, any> = { ...DEFAULT_VEHICLE_TEMPLATES };

    for (const p of dbPresets || []) {
      const settings = p.carrier_settings || {};
      const vehicleReg = settings.vehicle_reg || p.title.replace(/^\[ПЛ\]\s*/, '').trim();
      const normReg = normalizePlate(vehicleReg);
      if (normReg && settings.fields) {
        templates[normReg] = {
          id: p.id,
          name: normReg,
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
    const vehicleReg = normalizePlate(body.vehicle_reg || body.name);
    const fields = body.fields || body;

    if (!vehicleReg) {
      return NextResponse.json({ error: 'Укажите гос. номер автомобиля' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const presetTitle = `[ПЛ] ${vehicleReg}`;

    // Проверяем существующий шаблон в order_presets
    const { data: existing } = await (supabase.from('order_presets') as any)
      .select('id')
      .eq('title', presetTitle)
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
    const vehicleReg = normalizePlate(searchParams.get('reg'));

    if (!vehicleReg) {
      return NextResponse.json({ error: 'Не указан номер авто' }, { status: 400 });
    }

    const supabase = createAdminClient();
    await (supabase.from('order_presets') as any).delete().eq('title', `[ПЛ] ${vehicleReg}`);

    return NextResponse.json({ success: true, message: `Шаблон "${vehicleReg}" удален` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
