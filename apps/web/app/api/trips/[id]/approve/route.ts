/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TRIP_REVENUE_CATEGORY = '74008cf7-0527-4e9f-afd2-d232b8f8125a';
const CASH_ID = '10000000-0000-0000-0000-000000000002';
const BANK_ID = '10000000-0000-0000-0000-000000000001';
const PAYROLL_DRIVER_CAT = 'd79213ee-3bc6-4433-b58a-ca7ea1040d00';
const PAYROLL_LOADER_CAT = '18792fa8-fda8-472d-8e04-e19d2c6c053c';

/** POST /api/trips/:id/approve — утвердить рейс */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const adminId = cookieStore.get('salda_auth_token')?.value ?? null;
  const supabase = createAdminClient();

  const { data: trip, error: fetchErr } = await (supabase.from('trips') as any)
    .select(
      `
      id, trip_number, driver_id,
      driver:users!trips_driver_id_fkey(id, name),
      trip_orders(
        amount, payment_method, lifecycle_status, description,
        driver_pay, loader_id, loader_pay, loader2_id, loader2_pay,
        counterparty:counterparties(name),
        loader:users!trip_orders_loader_id_fkey(id, name),
        loader2:users!trip_orders_loader2_id_fkey(id, name)
      )
    `,
    )
    .eq('id', id)
    .single();

  if (fetchErr || !trip) return NextResponse.json({ error: 'Рейс не найден' }, { status: 404 });

  const { error: tripError } = await (supabase.from('trips') as any)
    .update({ lifecycle_status: 'approved' })
    .eq('id', id);

  if (tripError) return NextResponse.json({ error: tripError.message }, { status: 500 });

  const { error: ordersError } = await (supabase.from('trip_orders') as any)
    .update({ lifecycle_status: 'approved' })
    .eq('trip_id', id)
    .eq('lifecycle_status', 'draft');

  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 });

  // Наличные и QR — оплачены сразу, отмечаем как settled
  await (supabase.from('trip_orders') as any)
    .update({ settlement_status: 'completed' })
    .eq('trip_id', id)
    .in('payment_method', ['cash', 'qr', 'card_driver'])
    .neq('lifecycle_status', 'cancelled');

  const activeOrders = ((trip.trip_orders as any[]) ?? []).filter(
    (o: any) => o.lifecycle_status !== 'cancelled',
  );

  function buildOrderDescription(orders: any[], label: string) {
    const names = [
      ...new Set(
        orders
          .map((o: any) => (o.counterparty as any)?.name ?? o.description ?? null)
          .filter(Boolean),
      ),
    ] as string[];
    return [`Рейс №${trip.trip_number}`, trip.driver?.name ?? null, names.join(', ') || null, label]
      .filter(Boolean)
      .join(' · ');
  }

  const payrollTxns: any[] = [];

  // Начисляем ЗП водителю (pending — выплатится через /staff)
  if (trip.driver_id) {
    const driverPay = activeOrders.reduce(
      (s: number, o: any) => s + parseFloat(o.driver_pay ?? '0'),
      0,
    );
    if (driverPay > 0) {
      payrollTxns.push({
        direction: 'expense',
        category_id: PAYROLL_DRIVER_CAT,
        amount: driverPay.toFixed(2),
        description: `ЗП: ${trip.driver?.name ?? 'Водитель'} — рейс №${trip.trip_number}`,
        lifecycle_status: 'approved',
        settlement_status: 'pending',
        related_user_id: trip.driver_id,
        created_by: adminId,
        idempotency_key: crypto.randomUUID(),
      });
    }
  }

  // Начисляем ЗП грузчикам (pending)
  const loaderPayMap = new Map<string, { name: string; pay: number }>();
  for (const o of activeOrders) {
    if (o.loader_id && parseFloat(o.loader_pay ?? '0') > 0) {
      const prev = loaderPayMap.get(o.loader_id) ?? { name: o.loader?.name ?? 'Грузчик', pay: 0 };
      loaderPayMap.set(o.loader_id, { ...prev, pay: prev.pay + parseFloat(o.loader_pay) });
    }
    if (o.loader2_id && parseFloat(o.loader2_pay ?? '0') > 0) {
      const prev = loaderPayMap.get(o.loader2_id) ?? { name: o.loader2?.name ?? 'Грузчик', pay: 0 };
      loaderPayMap.set(o.loader2_id, { ...prev, pay: prev.pay + parseFloat(o.loader2_pay) });
    }
  }
  for (const [userId, { name, pay }] of loaderPayMap) {
    payrollTxns.push({
      direction: 'expense',
      category_id: PAYROLL_LOADER_CAT,
      amount: pay.toFixed(2),
      description: `ЗП: ${name} — рейс №${trip.trip_number}`,
      lifecycle_status: 'approved',
      settlement_status: 'pending',
      related_user_id: userId,
      created_by: adminId,
      idempotency_key: crypto.randomUUID(),
    });
  }

  const inserts: Promise<any>[] = [];

  // Наличные + card_driver → Касса
  const cashOrders = activeOrders.filter(
    (o: any) => o.payment_method === 'cash' || o.payment_method === 'card_driver',
  );
  const cashTotal = cashOrders.reduce((s: number, o: any) => s + parseFloat(o.amount ?? '0'), 0);
  if (cashTotal > 0) {
    inserts.push(
      (supabase.from('transactions') as any).insert({
        direction: 'income',
        category_id: TRIP_REVENUE_CATEGORY,
        amount: cashTotal.toFixed(2),
        to_wallet_id: CASH_ID,
        description: buildOrderDescription(cashOrders, 'Нал'),
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        created_by: adminId,
        idempotency_key: crypto.randomUUID(),
      }),
    );
  }

  // QR/Безнал → Расчётный счёт
  const qrOrders = activeOrders.filter((o: any) => o.payment_method === 'qr');
  const qrTotal = qrOrders.reduce((s: number, o: any) => s + parseFloat(o.amount ?? '0'), 0);
  if (qrTotal > 0) {
    inserts.push(
      (supabase.from('transactions') as any).insert({
        direction: 'income',
        category_id: TRIP_REVENUE_CATEGORY,
        amount: qrTotal.toFixed(2),
        to_wallet_id: BANK_ID,
        description: buildOrderDescription(qrOrders, 'QR/Безнал'),
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        created_by: adminId,
        idempotency_key: crypto.randomUUID(),
      }),
    );
  }

  if (payrollTxns.length > 0) {
    inserts.push((supabase.from('transactions') as any).insert(payrollTxns));
  }

  await Promise.all(inserts);

  return NextResponse.json({ success: true });
}
