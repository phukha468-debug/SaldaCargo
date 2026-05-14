/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** POST /api/driver/counterparties/new — создать нового клиента (с проверкой дублей) */
export async function POST(request: Request) {
  const body = (await request.json()) as { name: string; type?: string };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: 'Название обязательно' }, { status: 400 });

  const supabase = createAdminClient();

  // Check for existing counterparty with same name (case-insensitive)
  const { data: existing } = await (supabase as any)
    .from('counterparties')
    .select('id, name, phone, is_active')
    .ilike('name', name)
    .in('type', ['client', 'both'])
    .limit(3);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      {
        error: 'duplicate',
        message: `Клиент с похожим именем уже существует`,
        existing,
      },
      { status: 409 },
    );
  }

  const { data, error } = await (supabase as any)
    .from('counterparties')
    .insert({ name, type: body.type || 'client', is_active: true })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
