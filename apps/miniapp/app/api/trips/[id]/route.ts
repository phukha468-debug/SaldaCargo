/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

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
        id, counterparty_id, amount, driver_pay, loader_pay, loader2_pay, payment_method,
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

/** PATCH /api/trips/:id — обновить поля рейса (только loaders_count, trip_type) */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const driverId = cookieStore.get('salda_user_id')?.value;
  if (!driverId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as Record<string, unknown>;
  const supabase = createAdminClient();

  const { data: trip } = await (supabase.from('trips') as any)
    .select('driver_id, lifecycle_status')
    .eq('id', id)
    .single();

  if (!trip) return NextResponse.json({ error: 'Рейс не найден' }, { status: 404 });
  if (trip.driver_id !== driverId)
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 });
  if (trip.lifecycle_status === 'approved') {
    return NextResponse.json({ error: 'Рейс уже одобрен администратором' }, { status: 403 });
  }

  const allowed = ['loaders_count', 'trip_type'];
  const update = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

  const { data, error } = await (supabase.from('trips') as any)
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE /api/trips/:id — отменить рейс (soft-delete, только свой и не апрувнутый) */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const driverId = cookieStore.get('salda_user_id')?.value;
  if (!driverId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();

  const { data: trip } = await (supabase.from('trips') as any)
    .select('driver_id, lifecycle_status')
    .eq('id', id)
    .single();

  if (!trip) return NextResponse.json({ error: 'Рейс не найден' }, { status: 404 });
  if (trip.driver_id !== driverId)
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 });
  if (trip.lifecycle_status === 'approved') {
    return NextResponse.json({ error: 'Рейс уже одобрен администратором' }, { status: 403 });
  }

  const { error } = await (supabase.from('trips') as any)
    .update({ lifecycle_status: 'cancelled' })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
