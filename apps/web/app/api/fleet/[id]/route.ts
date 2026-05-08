/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { count } = await (supabase.from('trips') as any)
      .select('id', { count: 'exact', head: true })
      .eq('asset_id', id);

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Нельзя удалить: у машины ${count} рейс(ов). Переведите в статус "Списана".` },
        { status: 409 },
      );
    }

    const { error } = await (supabase.from('assets') as any).delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, any>;

    const allowed = [
      'short_name',
      'reg_number',
      'asset_type_id',
      'year',
      'status',
      'odometer_current',
      'assigned_driver_id',
      'current_book_value',
      'remaining_depreciation_months',
      'notes',
      'needs_update',
    ];

    const update: Record<string, any> = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }
    if (update.short_name) update.short_name = update.short_name.trim();
    if (update.reg_number) update.reg_number = update.reg_number.trim();

    const supabase = createAdminClient();
    const { data, error } = await (supabase.from('assets') as any)
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
