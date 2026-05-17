/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/** GET /api/driver/repair-requests — заявки водителя */
export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('salda_user_id')?.value;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();

  const { data, error } = await (supabase.from('repair_requests') as any)
    .select(
      `
      id, status, custom_description, created_at,
      asset:assets(id, short_name, reg_number),
      fault:fault_catalog(id, name, category),
      service_order:service_orders(id, order_number, status)
    `,
    )
    .eq('driver_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST /api/driver/repair-requests — создать заявку */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('salda_user_id')?.value;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { asset_id, fault_catalog_id, custom_description, idempotency_key } = body;

  if (!asset_id) return NextResponse.json({ error: 'asset_id required' }, { status: 400 });
  if (!fault_catalog_id && !custom_description) {
    return NextResponse.json(
      { error: 'fault_catalog_id или custom_description обязательны' },
      { status: 400 },
    );
  }
  if (!idempotency_key)
    return NextResponse.json({ error: 'idempotency_key required' }, { status: 400 });

  const supabase = createAdminClient();

  const { data, error } = await (supabase.from('repair_requests') as any)
    .insert({
      asset_id,
      driver_id: userId,
      fault_catalog_id: fault_catalog_id ?? null,
      custom_description: custom_description ?? null,
      status: 'new',
      idempotency_key,
    })
    .select(
      `
      id, status, custom_description, created_at,
      asset:assets(id, short_name, reg_number),
      fault:fault_catalog(id, name, category)
    `,
    )
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: existing } = await (supabase.from('repair_requests') as any)
        .select('id, status')
        .eq('idempotency_key', idempotency_key)
        .single();
      return NextResponse.json(existing, { status: 200 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
