/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/garage/client-vehicles?search=&counterparty_id= */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') ?? '';
  const counterpartyId = searchParams.get('counterparty_id');

  const supabase = createAdminClient();

  let query = (supabase.from('client_vehicles') as any)
    .select(
      `id, brand, model, year, reg_number, vin, color, odometer_last, odometer_updated_at, notes, is_active, created_at,
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
  if (counterpartyId) {
    query = query.eq('counterparty_id', counterpartyId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST /api/garage/client-vehicles */
export async function POST(request: Request) {
  const body = await request.json();
  const { brand, model, year, reg_number, vin, color, counterparty_id, odometer_last, notes } =
    body;

  if (!brand || !reg_number) {
    return NextResponse.json({ error: 'brand и reg_number обязательны' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await (supabase.from('client_vehicles') as any)
    .insert({
      brand,
      model: model || null,
      year: year ? Number(year) : null,
      reg_number,
      vin: vin || null,
      color: color || null,
      counterparty_id: counterparty_id || null,
      odometer_last: odometer_last ? Number(odometer_last) : null,
      notes: notes || null,
    })
    .select(
      `id, brand, model, year, reg_number, vin, color, odometer_last, odometer_updated_at, notes, is_active, created_at,
       counterparty:counterparties(id, name, phone)`,
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
