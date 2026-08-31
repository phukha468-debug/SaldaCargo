/* eslint-disable @typescript-eslint/no-explicit-any */
import { generateDeterministicUuid } from '@saldacargo/shared';

const TRIP_REVENUE_CATEGORY = '74008cf7-0527-4e9f-afd2-d232b8f8125a';
const CASH_ID = '10000000-0000-0000-0000-000000000002';
const BANK_ID = '10000000-0000-0000-0000-000000000001';
const PAYROLL_DRIVER_CAT = 'd79213ee-3bc6-4433-b58a-ca7ea1040d00';
const PAYROLL_LOADER_CAT = '18792fa8-fda8-472d-8e04-e19d2c6c053c';

export async function syncTripFinancials(
  supabase: any,
  tripId: string,
  adminId: string | null = null,
) {
  // 1. Fetch trip and all active orders
  const { data: trip, error: fetchErr } = await (supabase.from('trips') as any)
    .select(
      `
      id, trip_number, driver_id, started_at, lifecycle_status,
      driver:users!trips_driver_id_fkey(id, name),
      trip_orders(
        id, amount, payment_method, settlement_status, lifecycle_status, description,
        direction, is_driver_loader, driver_car_pay, driver_loader_pay, driver_pay,
        loaders_data, loader_id, loader_pay, loader2_id, loader2_pay,
        counterparty:counterparties(name),
        loader:users!trip_orders_loader_id_fkey(id, name),
        loader2:users!trip_orders_loader2_id_fkey(id, name)
      )
      `,
    )
    .eq('id', tripId)
    .single();

  if (fetchErr || !trip) return;

  // Only approved trips participate in financial balances, wallets and receivables
  if (trip.lifecycle_status !== 'approved') return;

  const orders = ((trip.trip_orders as any[]) ?? []).filter(
    (o: any) => o.lifecycle_status !== 'cancelled',
  );

  // 2. Synchronize settlement_status of each order based on payment_method
  for (const o of orders) {
    let expectedSettlement: 'pending' | 'completed' = 'completed';
    if (
      o.payment_method === 'debt_cash' ||
      o.payment_method === 'debt' ||
      o.payment_method === 'debt_bank'
    ) {
      expectedSettlement = 'pending';
    } else if (
      o.payment_method === 'cash' ||
      o.payment_method === 'card_driver' ||
      o.payment_method === 'qr'
    ) {
      expectedSettlement = 'completed';
    }
    if (o.settlement_status !== expectedSettlement) {
      await (supabase.from('trip_orders') as any)
        .update({ settlement_status: expectedSettlement })
        .eq('id', o.id);
      o.settlement_status = expectedSettlement;
    }
  }

  function buildOrderDescription(ordersList: any[], label: string) {
    const names = [
      ...new Set(
        ordersList
          .map((o: any) => (o.counterparty as any)?.name ?? o.description ?? null)
          .filter(Boolean),
      ),
    ] as string[];
    return [
      `Рейс №${trip.trip_number}`,
      (trip.driver as any)?.name ?? null,
      names.length > 0 ? names.join(', ') : null,
      label,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  // 3. Sync Cash Income (cash + card_driver)
  const cashOrders = orders.filter(
    (o: any) => o.payment_method === 'cash' || o.payment_method === 'card_driver',
  );
  const cashTotal = cashOrders.reduce((s: number, o: any) => s + parseFloat(o.amount ?? '0'), 0);
  const cashIdempotency = generateDeterministicUuid(`trip-income-cash-${tripId}`);

  const { data: existingCashTx } = await (supabase.from('transactions') as any)
    .select('id')
    .eq('trip_id', tripId)
    .eq('category_id', TRIP_REVENUE_CATEGORY)
    .eq('to_wallet_id', CASH_ID)
    .maybeSingle();

  if (cashTotal > 0) {
    if (existingCashTx) {
      await (supabase.from('transactions') as any)
        .update({
          amount: cashTotal.toFixed(2),
          description: buildOrderDescription(cashOrders, 'Нал'),
          lifecycle_status: 'approved',
          settlement_status: 'completed',
        })
        .eq('id', existingCashTx.id);
    } else {
      await (supabase.from('transactions') as any).insert({
        direction: 'income',
        category_id: TRIP_REVENUE_CATEGORY,
        amount: cashTotal.toFixed(2),
        to_wallet_id: CASH_ID,
        trip_id: tripId,
        description: buildOrderDescription(cashOrders, 'Нал'),
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        created_by: adminId,
        idempotency_key: cashIdempotency,
      });
    }
  } else if (existingCashTx) {
    await (supabase.from('transactions') as any).delete().eq('id', existingCashTx.id);
  }

  // 4. Sync QR Income
  const qrOrders = orders.filter((o: any) => o.payment_method === 'qr');
  const qrTotal = qrOrders.reduce((s: number, o: any) => s + parseFloat(o.amount ?? '0'), 0);
  const qrIdempotency = generateDeterministicUuid(`trip-income-qr-${tripId}`);

  const { data: existingQrTx } = await (supabase.from('transactions') as any)
    .select('id')
    .eq('trip_id', tripId)
    .eq('category_id', TRIP_REVENUE_CATEGORY)
    .eq('to_wallet_id', BANK_ID)
    .maybeSingle();

  if (qrTotal > 0) {
    if (existingQrTx) {
      await (supabase.from('transactions') as any)
        .update({
          amount: qrTotal.toFixed(2),
          description: buildOrderDescription(qrOrders, 'QR/Безнал'),
          lifecycle_status: 'approved',
          settlement_status: 'completed',
        })
        .eq('id', existingQrTx.id);
    } else {
      await (supabase.from('transactions') as any).insert({
        direction: 'income',
        category_id: TRIP_REVENUE_CATEGORY,
        amount: qrTotal.toFixed(2),
        to_wallet_id: BANK_ID,
        trip_id: tripId,
        description: buildOrderDescription(qrOrders, 'QR/Безнал'),
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        created_by: adminId,
        idempotency_key: qrIdempotency,
      });
    }
  } else if (existingQrTx) {
    await (supabase.from('transactions') as any).delete().eq('id', existingQrTx.id);
  }

  // 5. Sync Driver Payroll
  if (trip.driver_id) {
    const driverPay = orders.reduce((s: number, o: any) => s + parseFloat(o.driver_pay ?? '0'), 0);
    const { data: existingDriverTx } = await (supabase.from('transactions') as any)
      .select('id')
      .eq('trip_id', tripId)
      .eq('category_id', PAYROLL_DRIVER_CAT)
      .eq('related_user_id', trip.driver_id)
      .maybeSingle();

    if (driverPay > 0) {
      if (existingDriverTx) {
        await (supabase.from('transactions') as any)
          .update({ amount: driverPay.toFixed(2) })
          .eq('id', existingDriverTx.id);
      } else {
        await (supabase.from('transactions') as any).insert({
          direction: 'expense',
          category_id: PAYROLL_DRIVER_CAT,
          amount: driverPay.toFixed(2),
          description: `ЗП: ${(trip.driver as any)?.name ?? 'Водитель'} — рейс №${trip.trip_number}`,
          lifecycle_status: 'approved',
          settlement_status: 'pending',
          employee_confirmed: false,
          related_user_id: trip.driver_id,
          trip_id: tripId,
          transaction_date: trip.started_at,
          created_by: adminId,
          idempotency_key: generateDeterministicUuid(
            `trip-payroll-driver-${tripId}-${trip.driver_id}`,
          ),
        });
      }
    } else if (existingDriverTx) {
      await (supabase.from('transactions') as any).delete().eq('id', existingDriverTx.id);
    }
  }

  // 6. Sync Loader Payroll (поддержка динамического loaders_data + fallback на loader_id / loader2_id)
  const loaderPayMap = new Map<string, { name: string; pay: number }>();
  for (const o of orders) {
    if (Array.isArray(o.loaders_data) && o.loaders_data.length > 0) {
      for (const item of o.loaders_data) {
        if (item?.id && parseFloat(item.pay ?? '0') > 0) {
          const prev = loaderPayMap.get(item.id) ?? { name: item.name ?? 'Грузчик', pay: 0 };
          loaderPayMap.set(item.id, { ...prev, pay: prev.pay + parseFloat(item.pay) });
        }
      }
    } else {
      if (o.loader_id && parseFloat(o.loader_pay ?? '0') > 0) {
        const prev = loaderPayMap.get(o.loader_id) ?? { name: o.loader?.name ?? 'Грузчик', pay: 0 };
        loaderPayMap.set(o.loader_id, { ...prev, pay: prev.pay + parseFloat(o.loader_pay) });
      }
      if (o.loader2_id && parseFloat(o.loader2_pay ?? '0') > 0) {
        const prev = loaderPayMap.get(o.loader2_id) ?? {
          name: o.loader2?.name ?? 'Грузчик',
          pay: 0,
        };
        loaderPayMap.set(o.loader2_id, { ...prev, pay: prev.pay + parseFloat(o.loader2_pay) });
      }
    }
  }

  // Получаем все существующие транзакции грузчиков для рейса
  const { data: existingLoaderTxs } = await (supabase.from('transactions') as any)
    .select('id, related_user_id')
    .eq('trip_id', tripId)
    .eq('category_id', PAYROLL_LOADER_CAT);

  const processedUserIds = new Set<string>();

  for (const [userId, { name, pay }] of loaderPayMap) {
    processedUserIds.add(userId);
    const existingTx = (existingLoaderTxs ?? []).find((t: any) => t.related_user_id === userId);

    if (pay > 0) {
      if (existingTx) {
        await (supabase.from('transactions') as any)
          .update({ amount: pay.toFixed(2) })
          .eq('id', existingTx.id);
      } else {
        await (supabase.from('transactions') as any).insert({
          direction: 'expense',
          category_id: PAYROLL_LOADER_CAT,
          amount: pay.toFixed(2),
          description: `ЗП: ${name} — рейс №${trip.trip_number}`,
          lifecycle_status: 'approved',
          settlement_status: 'pending',
          employee_confirmed: true,
          related_user_id: userId,
          trip_id: tripId,
          transaction_date: trip.started_at,
          created_by: adminId,
          idempotency_key: generateDeterministicUuid(`trip-payroll-loader-${tripId}-${userId}`),
        });
      }
    }
  }

  // Удаляем транзакции грузчиков, которые были удалены из заказа
  for (const tx of existingLoaderTxs ?? []) {
    if (!processedUserIds.has(tx.related_user_id)) {
      await (supabase.from('transactions') as any).delete().eq('id', tx.id);
    }
  }
}
