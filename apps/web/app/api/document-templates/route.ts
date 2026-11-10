/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export function normalizePlate(reg?: string | null): string {
  if (!reg) return '';
  const latToCyr: Record<string, string> = {
    A: 'А',
    B: 'В',
    E: 'Е',
    K: 'К',
    M: 'М',
    H: 'Н',
    O: 'О',
    P: 'Р',
    C: 'С',
    T: 'Т',
    Y: 'У',
    X: 'Х',
  };
  return reg
    .trim()
    .toUpperCase()
    .replace(/[\s\-]/g, '')
    .replace(/[ABEKMHOPCTYX]/g, (m) => latToCyr[m] || m);
}

/**
 * GET /api/document-templates?type=waybill|tn|all
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = (searchParams.get('type') || 'all').toLowerCase();
    const supabase = createAdminClient();

    let query = (supabase.from('order_presets') as any)
      .select('id, title, carrier_settings, updated_at, created_at')
      .eq('is_active', true);

    if (type === 'waybill') {
      query = query.ilike('title', '[ПЛ]%');
    } else if (type === 'tn') {
      query = query.ilike('title', '[ТН]%');
    } else {
      query = query.or('title.ilike.[ПЛ]%,title.ilike.[ТН]%');
    }

    const { data: dbPresets, error } = await query.order('updated_at', { ascending: false });

    if (error) {
      console.warn('Ошибка выборки шаблонов документов из БД:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const templates: Record<string, any> = {};
    const list: any[] = [];

    for (const p of dbPresets || []) {
      const settings = p.carrier_settings || {};
      const isPl = p.title.startsWith('[ПЛ]');
      const prefix = isPl ? '[ПЛ]' : '[ТН]';
      const rawName = settings.name || settings.vehicle_reg || p.title.replace(prefix, '').trim();
      const normName = isPl ? normalizePlate(rawName) : rawName.trim();
      const docType = isPl ? 'waybill' : 'tn';

      const item = {
        id: p.id,
        name: normName,
        displayName: rawName,
        title: p.title,
        type: docType,
        updatedAt: p.updated_at || p.created_at,
        fields: settings.fields || {},
      };

      templates[normName] = item;
      list.push(item);
    }

    return NextResponse.json({ success: true, templates, list });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/document-templates
 * Создание или перезапись шаблона по имени/типу
 * Body: { id?, name, type: 'waybill' | 'tn', fields }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const docType: 'waybill' | 'tn' = body.type === 'tn' ? 'tn' : 'waybill';
    const rawName = (body.name || body.vehicle_reg || '').trim();

    if (!rawName) {
      return NextResponse.json(
        { error: 'Укажите название шаблона (или госномер авто)' },
        { status: 400 },
      );
    }

    const normName = docType === 'waybill' ? normalizePlate(rawName) : rawName;
    const prefix = docType === 'waybill' ? '[ПЛ]' : '[ТН]';
    const presetTitle = `${prefix} ${normName}`;
    const fields = body.fields || {};

    const supabase = createAdminClient();

    // Проверяем существующий шаблон по ID или точному названию
    let existingId = body.id || null;
    if (!existingId) {
      const { data: existing } = await (supabase.from('order_presets') as any)
        .select('id')
        .or(`title.eq.${presetTitle},title.eq.${prefix} ${rawName}`)
        .maybeSingle();
      if (existing?.id) existingId = existing.id;
    }

    const payload = {
      title: presetTitle,
      carrier_settings: {
        type: docType === 'waybill' ? 'waybill_template' : 'tn_template',
        name: normName,
        vehicle_reg: docType === 'waybill' ? normName : undefined,
        fields,
      },
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    let resultId = existingId;
    if (existingId) {
      const { error: updateErr } = await (supabase.from('order_presets') as any)
        .update(payload)
        .eq('id', existingId);
      if (updateErr) throw updateErr;
    } else {
      const { data: inserted, error: insertErr } = await (supabase.from('order_presets') as any)
        .insert(payload)
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      resultId = inserted?.id;
    }

    return NextResponse.json({
      success: true,
      id: resultId,
      name: normName,
      title: presetTitle,
      type: docType,
      message: `Шаблон "${normName}" успешно сохранен!`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/document-templates
 * Обновление/переименование существующего шаблона по ID
 * Body: { id, name?, fields? }
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const id = body.id;
    if (!id) {
      return NextResponse.json({ error: 'Параметр id обязателен' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: current, error: getErr } = await (supabase.from('order_presets') as any)
      .select('id, title, carrier_settings')
      .eq('id', id)
      .single();

    if (getErr || !current) {
      return NextResponse.json({ error: 'Шаблон не найден' }, { status: 404 });
    }

    const isPl = current.title.startsWith('[ПЛ]');
    const docType: 'waybill' | 'tn' = isPl ? 'waybill' : 'tn';
    const prefix = isPl ? '[ПЛ]' : '[ТН]';

    const newRawName = body.name !== undefined ? String(body.name).trim() : null;
    const normName =
      newRawName !== null
        ? docType === 'waybill'
          ? normalizePlate(newRawName)
          : newRawName
        : current.carrier_settings?.name || current.title.replace(prefix, '').trim();

    const newTitle = `${prefix} ${normName}`;
    const newFields =
      body.fields !== undefined ? body.fields : current.carrier_settings?.fields || {};

    const updatePayload = {
      title: newTitle,
      carrier_settings: {
        ...current.carrier_settings,
        name: normName,
        ...(docType === 'waybill' ? { vehicle_reg: normName } : {}),
        fields: newFields,
      },
      updated_at: new Date().toISOString(),
    };

    const { error: updateErr } = await (supabase.from('order_presets') as any)
      .update(updatePayload)
      .eq('id', id);

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      id,
      name: normName,
      title: newTitle,
      type: docType,
      message: `Шаблон "${normName}" обновлен!`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/document-templates?id=... (или ?name=...&type=waybill|tn)
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const rawName = searchParams.get('name') || searchParams.get('reg');
    const type = searchParams.get('type') || 'waybill';

    const supabase = createAdminClient();

    if (id) {
      const { error } = await (supabase.from('order_presets') as any).delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Шаблон успешно удален' });
    }

    if (rawName) {
      const isPl = type === 'waybill';
      const norm = isPl ? normalizePlate(rawName) : rawName.trim();
      const prefix = isPl ? '[ПЛ]' : '[ТН]';
      const { error } = await (supabase.from('order_presets') as any)
        .delete()
        .or(`title.eq.${prefix} ${norm},title.eq.${prefix} ${rawName}`);
      if (error) throw error;
      return NextResponse.json({ success: true, message: `Шаблон "${norm}" удален` });
    }

    return NextResponse.json({ error: 'Укажите id или name шаблона' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
