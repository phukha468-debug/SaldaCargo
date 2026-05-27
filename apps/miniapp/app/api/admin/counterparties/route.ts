/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/admin/counterparties?search= — поиск клиентов для привязки к машине */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') ?? '';
  const supabase = createAdminClient();

  let query = (supabase.from('counterparties') as any)
    .select('id, name, phone')
    .in('type', ['client', 'both'])
    .eq('is_active', true)
    .order('name')
    .limit(20);

  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST /api/admin/counterparties — создать нового клиента */
export async function POST(request: Request) {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const adminId = cookieStore.get('salda_user_id')?.value;
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, phone } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Имя клиента обязательно' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await (supabase.from('counterparties') as any)
    .insert({
      name: name.trim(),
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
