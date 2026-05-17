/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const CASH_METHODS = ['cash'];

/**
 * POST /api/admin/cash-collections — инкассация: забрать наличные у водителя в кассу.
 * Создаёт только запись в cash_collections (НЕ транзакцию — это не расход, а перемещение денег).
 */
export async function POST(request: Request) {
  try {
    const { driver_id, amount } = (await request.json()) as {
      driver_id: string;
      amount: string;
      driver_name?: string;
    };
    if (!driver_id || !amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: 'driver_id и amount обязательны' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: adminUser } = await (supabase.from('users') as any)
      .select('id')
      .overlaps('roles', ['admin', 'owner'])
      .limit(1)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: 'Администратор не найден' }, { status: 500 });
    }

    const { error: collErr } = await (supabase.from('cash_collections') as any).insert({
      driver_id,
      amount,
      collected_by: adminUser.id,
      note: 'Закрытие подотчёта',
    });
    if (collErr) return NextResponse.json({ error: collErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, collection_amount: amount });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

/**
 * GET /api/admin/cash-collections — текущий подотчёт наличных по каждому водителю.
 * Формула: cash-заказы − cash-расходы − инкассации (единая с MiniApp).
 */
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

    const { data: expenses, error: expensesError } = await (supabase
      .from('trip_expenses')
      .select('amount, payment_method, trips!inner(driver_id, lifecycle_status)')
      .neq('trips.lifecycle_status', 'cancelled') as any);

    if (expensesError) return NextResponse.json({ error: expensesError.message }, { status: 500 });

    const { data: collections, error: collectionsError } = await (supabase
      .from('cash_collections')
      .select('driver_id, amount') as any);

    if (collectionsError)
      return NextResponse.json({ error: collectionsError.message }, { status: 500 });

    const result = ((drivers as any[]) ?? []).map((driver: any) => {
      const driverTrips = ((trips as any[]) ?? []).filter((t: any) => t.driver_id === driver.id);

      const cashIn = driverTrips
        .flatMap((t: any) => (t.trip_orders as any[]) ?? [])
        .filter(
          (o: any) => CASH_METHODS.includes(o.payment_method) && o.lifecycle_status !== 'cancelled',
        )
        .reduce((s: number, o: any) => s + parseFloat(o.amount ?? '0'), 0);

      const driverExpenses = ((expenses as any[]) ?? []).filter(
        (e: any) => e.trips?.driver_id === driver.id,
      );
      const cashSpent = driverExpenses
        .filter((e: any) => CASH_METHODS.includes(e.payment_method))
        .reduce((s: number, e: any) => s + parseFloat(e.amount ?? '0'), 0);

      const driverCollections = ((collections as any[]) ?? []).filter(
        (c: any) => c.driver_id === driver.id,
      );
      const cashCollected = driverCollections.reduce(
        (s: number, c: any) => s + parseFloat(c.amount ?? '0'),
        0,
      );

      return {
        driver_id: driver.id,
        driver_name: driver.name,
        balance: Math.max(0, cashIn - cashSpent - cashCollected).toFixed(2),
      };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
