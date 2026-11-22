/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import {
  resolveKnownMasterCounterpartyId,
  cleanCounterpartySearchName,
  buildIlikeOrFilter,
  escapePostgrestValue,
} from '@saldacargo/shared';

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

  const searchFilter = buildIlikeOrFilter(['name', 'phone'], q);
  if (searchFilter) {
    query = query.or(searchFilter);
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

  // 1. Защита от дублирования мастер-контрагентов (ВСМПО, АВИСМА, Геостройиндустрия)
  const masterId = resolveKnownMasterCounterpartyId(cleanName);
  if (masterId) {
    const { data: masterCp } = await (supabase.from('counterparties') as any)
      .select('id, name, phone')
      .eq('id', masterId)
      .maybeSingle();

    if (masterCp) {
      return NextResponse.json(masterCp, { status: 200 });
    }
  }

  // 2. Поиск существующего по наименованию (с учётом очистки от кавычек и форм собственности)
  const simplifiedName = cleanCounterpartySearchName(cleanName);
  const safeClean = escapePostgrestValue(cleanName);
  const safeSimplified = escapePostgrestValue(simplifiedName || cleanName);
  const { data: existingList } = safeClean
    ? await (supabase.from('counterparties') as any)
        .select('id, name, phone')
        .eq('is_active', true)
        .or(`name.ilike.%${safeClean}%,name.ilike.%${safeSimplified || safeClean}%`)
        .limit(5)
    : { data: [] };

  const existingByName = (existingList || []).find((cp: any) => {
    const existingClean = cleanCounterpartySearchName(cp.name);
    return existingClean === simplifiedName || cp.name.toLowerCase() === cleanName.toLowerCase();
  });

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
