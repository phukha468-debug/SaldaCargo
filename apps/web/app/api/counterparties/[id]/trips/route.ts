/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const FUEL_CATEGORY_ID = '62cebf3f-9982-4cc6-904b-48c6169cf5e4';

async function fetchAllRows<T = any>(
  queryBuilder: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let page = 0;
  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await queryBuilder(from, to);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  return all;
}

/** GET /api/counterparties/[id]/trips — история рейсов клиента */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const orders = await fetchAllRows((from, to) =>
      (supabase as any)
        .from('trip_orders')
        .select(
          'id, trip_id, amount, driver_pay, loader_pay, payment_method, settlement_status,' +
            ' trip:trips!inner(trip_number, started_at, driver:users!trips_driver_id_fkey(name), asset:assets(short_name, reg_number), lifecycle_status)',
        )
        .eq('counterparty_id', id)
        .eq('lifecycle_status', 'approved')
        .eq('trips.lifecycle_status', 'approved')
        .order('created_at', { ascending: false })
        .range(from, to),
    );

    const tripIds = [
      ...new Set((orders ?? []).map((o: any) => o.trip_id).filter(Boolean)),
    ] as string[];

    const [fuelExpenses, allTripOrders] = await Promise.all([
      tripIds.length > 0
        ? fetchAllRows((from, to) =>
            (supabase as any)
              .from('trip_expenses')
              .select('trip_id, amount')
              .in('trip_id', tripIds)
              .eq('category_id', FUEL_CATEGORY_ID)
              .range(from, to),
          )
        : Promise.resolve([]),
      tripIds.length > 0
        ? fetchAllRows((from, to) =>
            (supabase as any)
              .from('trip_orders')
              .select('trip_id, amount')
              .in('trip_id', tripIds)
              .eq('lifecycle_status', 'approved')
              .neq('lifecycle_status', 'cancelled')
              .range(from, to),
          )
        : Promise.resolve([]),
    ]);

    const tripFuelMap = new Map<string, number>();
    for (const e of fuelExpenses ?? []) {
      tripFuelMap.set(e.trip_id, (tripFuelMap.get(e.trip_id) ?? 0) + parseFloat(e.amount ?? '0'));
    }

    const tripTotalMap = new Map<string, number>();
    for (const o of allTripOrders ?? []) {
      tripTotalMap.set(o.trip_id, (tripTotalMap.get(o.trip_id) ?? 0) + parseFloat(o.amount ?? '0'));
    }

    const result = (orders ?? []).map((o: any) => {
      const amount = parseFloat(o.amount ?? '0');
      const driverPay = parseFloat(o.driver_pay ?? '0');
      const loaderPay = parseFloat(o.loader_pay ?? '0');
      const tripFuel = tripFuelMap.get(o.trip_id) ?? 0;
      const tripTotal = tripTotalMap.get(o.trip_id) ?? 0;
      const fuelAllocated = tripTotal > 0 ? (amount / tripTotal) * tripFuel : 0;

      return {
        id: o.id,
        trip_id: o.trip_id,
        trip_number: o.trip?.trip_number ?? null,
        started_at: o.trip?.started_at ?? null,
        driver_name: o.trip?.driver?.name ?? null,
        asset_name: o.trip?.asset?.short_name ?? o.trip?.asset?.reg_number ?? null,
        amount: amount.toFixed(2),
        driver_pay: driverPay.toFixed(2),
        loader_pay: loaderPay.toFixed(2),
        fuel_allocated: fuelAllocated.toFixed(2),
        gross_profit: (amount - driverPay - loaderPay - fuelAllocated).toFixed(2),
        payment_method: o.payment_method,
        settlement_status: o.settlement_status,
      };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
