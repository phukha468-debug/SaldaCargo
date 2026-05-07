/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/trips/:id — детали рейса */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await (supabase
    .from('trips')
    .select(
      `
      *,
      asset:assets(short_name, reg_number),
      driver:users!trips_driver_id_fkey(name),
      trip_orders(
        id, amount, driver_pay, loader_pay, loader2_pay, payment_method,
        settlement_status, lifecycle_status, description,
        counterparty:counterparties(name)
      ),
      trip_expenses(
        id, amount, payment_method, description,
        category:transaction_categories(name)
      )
      `,
    )
    .eq('id', id)
    .single() as any);

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

/** PATCH /api/trips/:id — обновить рейс */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const supabase = createAdminClient();

  const { data, error } = await ((supabase.from('trips') as any)
    .update(body)
    .eq('id', id)
    .select()
    .single() as any);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
