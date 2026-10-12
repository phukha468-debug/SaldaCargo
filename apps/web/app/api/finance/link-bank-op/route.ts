/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const BANK_WALLET_ID = '10000000-0000-0000-0000-000000000001';
const TRIP_REVENUE_CAT_ID = '74008cf7-0527-4e9f-afd2-d232b8f8125a';

/**
 * POST /api/finance/link-bank-op
 * Связать банковскую операцию (СБП/QR/эквайринг) с заказом рейса водителя,
 * либо отвязать её.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { operationId, tripOrderId, action } = body;

    if (!operationId) {
      return NextResponse.json({ error: 'Не указан operationId' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const idempotencyKey = `tbank:${operationId}`;

    // 1. Действие: ОТВЯЗАТЬ
    if (action === 'unlink') {
      // Ищем существующую транзакцию привязки
      const { data: existingTx } = await (supabase.from('transactions') as any)
        .select('id, trip_order_id')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existingTx) {
        // Удаляем транзакцию
        await (supabase.from('transactions') as any).delete().eq('id', existingTx.id);

        // Если заказ был привязан к этой транзакции, возвращаем статус в pending
        if (existingTx.trip_order_id) {
          await (supabase.from('trip_orders') as any)
            .update({
              settlement_status: 'pending',
              invoice_paid_at: null,
            })
            .eq('id', existingTx.trip_order_id);
        }
      }

      return NextResponse.json({ success: true, unlinked: true });
    }

    // 2. Действие: СВЯЗАТЬ С ЗАКАЗОМ
    if (!tripOrderId) {
      return NextResponse.json({ error: 'Не указан tripOrderId для привязки' }, { status: 400 });
    }

    // Загружаем данные заказа
    const { data: order, error: orderErr } = await (supabase.from('trip_orders') as any)
      .select(
        'id, amount, trip_id, counterparty_id, payment_method, trip:trips(id, trip_number, driver_id, driver:users!trips_driver_id_fkey(id, name))',
      )
      .eq('id', tripOrderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Заказ рейса не найден' }, { status: 404 });
    }

    const tripNumber = order.trip?.trip_number ? `Рейс №${order.trip.trip_number}` : 'Рейс';
    const driverName = order.trip?.driver?.name || 'Водитель';
    const amountVal = parseFloat(body.amount || order.amount || '0');

    // Находим системного админа для created_by
    const { data: adminUser } = await (supabase.from('users') as any)
      .select('id')
      .or('roles.cs.{admin},roles.cs.{owner}')
      .limit(1)
      .single();

    // Проверяем, существует ли уже транзакция для этой банковской операции
    const { data: existingTx } = await (supabase.from('transactions') as any)
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    const txPayload = {
      direction: 'income',
      amount: amountVal,
      category_id: TRIP_REVENUE_CAT_ID,
      to_wallet_id: BANK_WALLET_ID,
      from_wallet_id: null,
      counterparty_id: order.counterparty_id || null,
      trip_order_id: order.id,
      trip_id: order.trip_id,
      related_user_id: order.trip?.driver_id || null,
      lifecycle_status: 'approved',
      settlement_status: 'completed',
      description: `Оплата по СБП · ${tripNumber} (${driverName})`,
      idempotency_key: idempotencyKey,
      created_by: adminUser?.id || null,
    };

    if (existingTx) {
      await (supabase.from('transactions') as any).update(txPayload).eq('id', existingTx.id);
    } else {
      await (supabase.from('transactions') as any).insert(txPayload);
    }

    // Помечаем заказ рейса как полностью оплаченный
    await (supabase.from('trip_orders') as any)
      .update({
        settlement_status: 'completed',
        lifecycle_status: 'approved',
        invoice_paid_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    return NextResponse.json({
      success: true,
      linked: true,
      trip_number: order.trip?.trip_number,
      driver_name: driverName,
      order_id: order.id,
    });
  } catch (err: any) {
    console.error('Error linking bank operation to trip:', err);
    return NextResponse.json({ error: err.message || 'Ошибка сервера' }, { status: 500 });
  }
}
