/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const CASH_METHODS = ['cash'];

/** GET /api/admin/cash-collections — drivers with current cash balances */
export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: drivers, error: driversError } = await (supabase
      .from('users')
      .select('id, name')
      .contains('roles', ['driver'])
      .eq('is_active', true) as any);

    if (driversError) return NextResponse.json({ error: driversError.message }, { status: 500 });
    if (!drivers || drivers.length === 0) return NextResponse.json([]);

    const { data: trips, error: tripsError } = await (supabase
      .from('trips')
      .select('driver_id, trip_orders(amount, payment_method, lifecycle_status)')
      .neq('lifecycle_status', 'cancelled') as any);

    if (tripsError) return NextResponse.json({ error: tripsError.message }, { status: 500 });

    const { data: collections, error: collectionsError } = await (supabase
      .from('cash_collections')
      .select('driver_id, amount') as any);

    if (collectionsError)
      return NextResponse.json({ error: collectionsError.message }, { status: 500 });

    const result = (drivers as any[]).map((driver: any) => {
      const cashIn = ((trips as any[]) ?? [])
        .filter((t: any) => t.driver_id === driver.id)
        .flatMap((t: any) => (t.trip_orders as any[]) ?? [])
        .filter(
          (o: any) => CASH_METHODS.includes(o.payment_method) && o.lifecycle_status !== 'cancelled',
        )
        .reduce((s: number, o: any) => s + parseFloat(o.amount ?? '0'), 0);

      const cashOut = ((collections as any[]) ?? [])
        .filter((c: any) => c.driver_id === driver.id)
        .reduce((s: number, c: any) => s + parseFloat(c.amount ?? '0'), 0);

      return {
        driver_id: driver.id,
        driver_name: driver.name,
        balance: (cashIn - cashOut).toFixed(2),
      };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

/** POST /api/admin/cash-collections — record a cash collection from driver */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const adminId = cookieStore.get('salda_user_id')?.value;
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as {
    driver_id: string;
    amount: string;
    note?: string;
  };

  if (!body.driver_id || !body.amount) {
    return NextResponse.json({ error: 'driver_id и amount обязательны' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data, error } = await (supabase.from('cash_collections') as any)
    .insert({
      driver_id: body.driver_id,
      amount: body.amount,
      collected_by: adminId,
      note: body.note ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
