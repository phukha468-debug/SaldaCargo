/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { syncTripFinancials } from '@/lib/tripFinancials';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/** POST /api/trips/:id/approve — утвердить рейс */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const adminId = cookieStore.get('salda_auth_token')?.value ?? null;
  const supabase = createAdminClient();

  const { data: trip, error: fetchErr } = await (supabase.from('trips') as any)
    .select('id, lifecycle_status')
    .eq('id', id)
    .single();

  if (fetchErr || !trip) return NextResponse.json({ error: 'Рейс не найден' }, { status: 404 });
  if (trip.lifecycle_status === 'approved') {
    return NextResponse.json({ error: 'Рейс уже утверждён' }, { status: 400 });
  }

  const { error: tripError } = await (supabase.from('trips') as any)
    .update({ lifecycle_status: 'approved' })
    .eq('id', id);

  if (tripError) return NextResponse.json({ error: tripError.message }, { status: 500 });

  const { error: ordersError } = await (supabase.from('trip_orders') as any)
    .update({ lifecycle_status: 'approved' })
    .eq('trip_id', id)
    .neq('lifecycle_status', 'cancelled');

  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 });

  await syncTripFinancials(supabase, id, adminId);

  return NextResponse.json({ success: true });
}
