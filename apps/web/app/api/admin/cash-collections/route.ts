/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const CASH_METHODS = ['cash', 'card_driver'];

const CAT_PAYROLL_DRIVER = 'd79213ee-3bc6-4433-b58a-ca7ea1040d00';

/**
 * POST /api/admin/cash-collections — закрыть подотчёт водителя:
 *   1. Инкассация на полную сумму подотчёта
 *   2. Расход «ЗП водителя» на сумму driver_pay с кассовых рейсов
 */
export async function POST(request: Request) {
  try {
    const { driver_id, amount, driver_name } = (await request.json()) as {
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

    // Считаем ЗП водителя по кассовым рейсам (driver_pay ещё не выплачена как транзакция)
    const { data: cashOrders } = await (supabase.from('trips') as any)
      .select('trip_orders(driver_pay, payment_method, lifecycle_status)')
      .eq('driver_id', driver_id);

    const driverPay = ((cashOrders as any[]) ?? [])
      .flatMap((t: any) => (t.trip_orders as any[]) ?? [])
      .filter(
        (o: any) => CASH_METHODS.includes(o.payment_method) && o.lifecycle_status !== 'cancelled',
      )
      .reduce((s: number, o: any) => s + parseFloat(o.driver_pay ?? '0'), 0);

    // 1. Инкассация — полный подотчёт
    const { error: collErr } = await (supabase.from('cash_collections') as any).insert({
      driver_id,
      amount,
      collected_by: adminUser.id,
      note: 'Закрытие подотчёта',
    });
    if (collErr) return NextResponse.json({ error: collErr.message }, { status: 500 });

    // 2. Расход ЗП — если есть что записать
    if (driverPay > 0) {
      const { error: txErr } = await (supabase.from('transactions') as any).insert({
        direction: 'expense',
        amount: driverPay.toFixed(2),
        category_id: CAT_PAYROLL_DRIVER,
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        description: `ЗП ${driver_name ?? 'водителя'} (закрытие подотчёта)`,
        created_by: adminUser.id,
        idempotency_key: crypto.randomUUID(),
      });
      if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      collection_amount: amount,
      payroll_amount: driverPay.toFixed(2),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

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
