/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, any>;

    const allowed = [
      'name',
      'phone',
      'max_user_id',
      'pin_code',
      'roles',
      'current_asset_id',
      'is_active',
      'auto_settle',
      'notes',
      'is_officially_employed',
      'official_salary_amount',
      'official_salary_day',
      'has_court_orders',
      'court_order_pct',
      'court_order_notes',
    ];
    const update: Record<string, any> = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }
    if (update.name) update.name = update.name.trim();
    if ('pin_code' in update) {
      update.pin_code = update.pin_code ? String(update.pin_code).trim() : null;
    }

    const supabase = createAdminClient();
    const { data, error } = await (supabase.from('users') as any)
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
