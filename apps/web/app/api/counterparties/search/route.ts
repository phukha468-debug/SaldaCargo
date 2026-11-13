/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/counterparties/search?q=&sto_only=1 — лёгкий поиск клиентов для форм привязки */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';
  const stoOnly = searchParams.get('sto_only') === '1';
  const supabase = createAdminClient();

  // sto_only=1 — только те у кого есть хотя бы одна машина в client_vehicles
  const selectFields = stoOnly ? 'id, name, phone, client_vehicles!inner(id)' : 'id, name, phone';

  let query = (supabase.from('counterparties') as any)
    .select(selectFields)
    .in('type', ['client', 'both'])
    .eq('is_active', true)
    .order('name')
    .limit(20);

  if (q) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // убрать вложенный client_vehicles из ответа
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const result = (data ?? []).map(({ client_vehicles: _cv, ...cp }: any) => cp);
  return NextResponse.json(result);
}

/** POST /api/counterparties/search — создать нового клиента или вернуть существующего */
export async function POST(request: Request) {
  const body = await request.json();
  const { name, phone } = body;

  const cleanName = name?.trim();
  if (!cleanName) {
    return NextResponse.json({ error: 'Имя клиента обязательно' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 1. Защита от дублирования ВСМПО-АВИСМА
  const lowerName = cleanName.toLowerCase();
  if (lowerName.includes('всмпо') || lowerName.includes('ависма')) {
    const { data: vsmpoMaster } = await (supabase.from('counterparties') as any)
      .select('id, name, phone')
      .or('id.eq.6024c9f4-5d67-4b8c-93ae-e4e66ce21441,inn.eq.6607000556')
      .eq('is_active', true)
      .maybeSingle();

    if (vsmpoMaster) {
      return NextResponse.json(vsmpoMaster, { status: 200 });
    }
  }

  // 2. Поиск существующего по точному наименованию среди активных
  const { data: existingByName } = await (supabase.from('counterparties') as any)
    .select('id, name, phone')
    .ilike('name', cleanName)
    .eq('is_active', true)
    .maybeSingle();

  if (existingByName) {
    return NextResponse.json(existingByName, { status: 200 });
  }

  const { data, error } = await (supabase.from('counterparties') as any)
    .insert({
      name: cleanName,
      phone: phone?.trim() || null,
      type: 'client',
      is_active: true,
      is_regular: true,
    })
    .select('id, name, phone')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
