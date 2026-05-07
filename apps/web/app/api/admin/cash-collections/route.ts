/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const CASH_METHODS = ['cash', 'card_driver'];

/** GET /api/admin/cash-collections — текущий подотчёт наличных по каждому водителю */
export async function GET() {
  try {
    const supabase = createAdminClient();

    const [
      { data: drivers, error: driversError },
      { data: trips, error: tripsError },
      { data: collections, error: collectionsError },
    ] = await Promise.all([
      supabase
        .from('users')
        .select('id, name')
        .contains('roles', ['driver'])
        .eq('is_active', true) as any,
      supabase
        .from('trips')
        .select('driver_id, trip_orders(amount, payment_method, lifecycle_status)') as any,
      supabase.from('cash_collections').select('driver_id, amount') as any,
    ]);

    if (driversError) return NextResponse.json({ error: driversError.message }, { status: 500 });
    if (tripsError) return NextResponse.json({ error: tripsError.message }, { status: 500 });
    if (collectionsError)
      return NextResponse.json({ error: collectionsError.message }, { status: 500 });

    const result = ((drivers as any[]) ?? []).map((driver: any) => {
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
