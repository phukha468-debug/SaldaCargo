/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');
  const includeInactive = searchParams.get('includeInactive') === 'true';

  const supabase = createAdminClient();
  let query = (supabase.from('users') as any)
    .select('id, name, phone, max_user_id, roles, current_asset_id, is_active, notes, created_at')
    .order('name');

  if (!includeInactive) query = query.eq('is_active', true);
  if (role) query = query.contains('roles', [role]);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, any>;
    const { name, phone, max_user_id, roles, current_asset_id, notes } = body;

    if (!name?.trim() || !roles?.length) {
      return NextResponse.json({ error: 'Имя и роль обязательны' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await (supabase.from('users') as any)
      .insert({
        name: name.trim(),
        phone: phone || null,
        max_user_id: max_user_id || null,
        roles,
        current_asset_id: current_asset_id || null,
        notes: notes || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
