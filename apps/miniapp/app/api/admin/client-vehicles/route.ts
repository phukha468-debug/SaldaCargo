/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/admin/client-vehicles?search= */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') ?? '';
  const supabase = createAdminClient();

  let query = (supabase.from('client_vehicles') as any)
    .select(
      `id, brand, model, year, reg_number, color, notes, is_active,
       counterparty:counterparties(id, name, phone)`,
    )
    .eq('is_active', true)
    .order('brand')
    .order('model');

  if (search) {
    query = query.or(
      `brand.ilike.%${search}%,model.ilike.%${search}%,reg_number.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST /api/admin/client-vehicles */
export async function POST(request: Request) {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const adminId = cookieStore.get('salda_user_id')?.value;
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { brand, model, year, reg_number, vin, color, counterparty_id, notes } = body;

  if (!brand?.trim() || !reg_number?.trim()) {
    return NextResponse.json({ error: 'Марка и госномер обязательны' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await (supabase.from('client_vehicles') as any)
    .insert({
      brand: brand.trim(),
      model: model?.trim() || null,
      year: year ? Number(year) : null,
      reg_number: reg_number.trim(),
      vin: vin?.trim() || null,
      color: color?.trim() || null,
      counterparty_id: counterparty_id || null,
      notes: notes?.trim() || null,
    })
    .select(
      `id, brand, model, year, reg_number, color, notes, is_active,
       counterparty:counterparties(id, name, phone)`,
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
