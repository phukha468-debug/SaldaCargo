/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const includeBlanks = searchParams.get('all') === '1' || searchParams.get('type') === 'all';
    const supabase = createAdminClient();

    let query = (supabase.from('order_presets') as any)
      .select(
        '*, client:counterparties!order_presets_client_counterparty_id_fkey(*), forwarder:counterparties!order_presets_forwarder_counterparty_id_fkey(*), loading_point:loading_points_directory(*)',
      )
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (!includeBlanks) {
      // Исключаем шаблоны бланков [ПЛ] и [ТН], возвращая только бизнес-пресеты клиентов / ЭТрн
      query = query.not('title', 'ilike', '[ПЛ]%').not('title', 'ilike', '[ТН]%');
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ presets: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/order-presets
 * Создание нового пресета ЭТрн / Заявки
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = (body.title || body.name || '').trim();

    if (!title) {
      return NextResponse.json({ error: 'Укажите название шаблона/пресета ЭТрн' }, { status: 400 });
    }

    const payload = {
      title,
      client_counterparty_id: body.client_counterparty_id || null,
      forwarder_counterparty_id: body.forwarder_counterparty_id || null,
      default_loading_point_id: body.default_loading_point_id || null,
      carrier_settings: body.carrier_settings || null,
      emchd_signer: body.emchd_signer || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const supabase = createAdminClient();
    const { data, error } = await (supabase.from('order_presets') as any)
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      preset: data,
      message: `Шаблон ЭТрн "${title}" создан`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/order-presets
 * Редактирование пресета ЭТрн по ID
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const id = body.id;
    if (!id) {
      return NextResponse.json({ error: 'Параметр id обязателен' }, { status: 400 });
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined) updateData.title = String(body.title).trim();
    if (body.client_counterparty_id !== undefined)
      updateData.client_counterparty_id = body.client_counterparty_id;
    if (body.forwarder_counterparty_id !== undefined)
      updateData.forwarder_counterparty_id = body.forwarder_counterparty_id;
    if (body.default_loading_point_id !== undefined)
      updateData.default_loading_point_id = body.default_loading_point_id;
    if (body.carrier_settings !== undefined) updateData.carrier_settings = body.carrier_settings;
    if (body.emchd_signer !== undefined) updateData.emchd_signer = body.emchd_signer;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    const supabase = createAdminClient();
    const { data, error } = await (supabase.from('order_presets') as any)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, preset: data, message: 'Шаблон ЭТрн обновлен' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/order-presets?id=...
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Параметр id обязателен' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await (supabase.from('order_presets') as any).delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Шаблон ЭТрн удален' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
