/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const FUEL_CATEGORY_ID = '62cebf3f-9982-4cc6-904b-48c6169cf5e4';
export const DERYABIN_ID = '20000000-0000-0000-0000-000000000001';

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

/** GET /api/counterparties/[id]/trips — история рейсов клиента ИЛИ поставок/счетов поставщика */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    // Проверяем тип контрагента
    const { data: cp } = await (supabase.from('counterparties') as any)
      .select('type, name')
      .eq('id', id)
      .single();

    const isSupplier = cp?.type === 'supplier';

    if (isSupplier) {
      // Для поставщиков возвращаем историю расходов, оплат и заправок
      if (id === DERYABIN_ID) {
        // Топливные заправки
        const fuelExpenses = await fetchAllRows((from, to) =>
          (supabase as any)
            .from('trip_expenses')
            .select(
              'id, amount, created_at, description, trip:trips(trip_number, driver:users!trips_driver_id_fkey(name), asset:assets(short_name, reg_number))',
            )
            .eq('payment_method', 'fuel_card')
            .order('created_at', { ascending: false })
            .range(from, to),
        );

        const result = fuelExpenses.map((f: any) => ({
          id: f.id,
          trip_id: null,
          trip_number: f.trip?.trip_number ?? null,
          started_at: f.created_at,
          driver_name: f.trip?.driver?.name ?? '—',
          asset_name: f.trip?.asset?.short_name ?? f.trip?.asset?.reg_number ?? '—',
          amount: parseFloat(f.amount ?? '0').toFixed(2),
          driver_pay: '0.00',
          loader_pay: '0.00',
          fuel_allocated: parseFloat(f.amount ?? '0').toFixed(2),
          gross_profit: '0.00',
          payment_method: 'fuel_card',
          settlement_status: 'completed',
          description: f.description || 'Заправка по топливной карте Опти24',
        }));
        return NextResponse.json(result);
      }

      // Обычный поставщик: транзакции по нему
      const txs = await fetchAllRows((from, to) =>
        (supabase as any)
          .from('transactions')
          .select('id, amount, created_at, description, settlement_status, direction')
          .eq('counterparty_id', id)
          .order('created_at', { ascending: false })
          .range(from, to),
      );

      const result = txs.map((t: any) => ({
        id: t.id,
        trip_id: null,
        trip_number: null,
        started_at: t.created_at,
        driver_name: '—',
        asset_name: '—',
        amount: parseFloat(t.amount ?? '0').toFixed(2),
        driver_pay: '0.00',
        loader_pay: '0.00',
        fuel_allocated: '0.00',
        gross_profit: '0.00',
        payment_method: 'bank_invoice',
        settlement_status: t.settlement_status,
        description: t.description || 'Поставка / Услуга',
      }));
      return NextResponse.json(result);
    }

    // Для клиентов: стандартные клиентские рейсы
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
