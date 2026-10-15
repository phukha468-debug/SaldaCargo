/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const BANK_WALLET_ID = '10000000-0000-0000-0000-000000000001';
const TRIP_REVENUE_CAT_ID = '74008cf7-0527-4e9f-afd2-d232b8f8125a';
const STO_REVENUE_CAT_ID = '00000000-0000-0000-0000-000000000010'; // Выручка СТО / услуги

/**
 * POST /api/finance/link-bank-op
 * Связать банковскую операцию:
 * 1) С рейсом автопарка (trip)
 * 2) С заказ-нарядом автосервиса / гаража (service_order)
 * 3) С диспетчерским рейсом на чужом автомобиле / АТИ (dispatcher)
 * Либо отвязать её.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      operationId,
      tripOrderId,
      serviceOrderId,
      dispatcherDetails,
      linkType = 'trip',
      action,
    } = body;

    if (!operationId) {
      return NextResponse.json({ error: 'Не указан operationId' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const idempotencyKey = operationId;

    // 1. Действие: ОТВЯЗАТЬ
    if (action === 'unlink') {
      const { data: existingTx } = await (supabase.from('transactions') as any)
        .select('id, trip_order_id')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existingTx) {
        await (supabase.from('transactions') as any).delete().eq('id', existingTx.id);

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

    // Находим системного пользователя для created_by
    const { data: adminUser } = await (supabase.from('users') as any)
      .select('id')
      .or('roles.cs.{admin},roles.cs.{owner}')
      .limit(1)
      .single();

    // Проверяем, существует ли уже транзакция
    const { data: existingTx } = await (supabase.from('transactions') as any)
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    const opDate =
      body.operationDate ||
      (body.date ? `${body.date}T12:00:00.000Z` : null) ||
      new Date().toISOString();

    const amountVal = parseFloat(body.amount || '0');

    // 2. ВАРИАНТ А: СВЯЗКА С РЕЙСОМ АВТОПАРКА
    if (linkType === 'trip') {
      if (!tripOrderId) {
        return NextResponse.json({ error: 'Не указан tripOrderId для привязки' }, { status: 400 });
      }

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

      const txPayload = {
        direction: 'income',
        amount: amountVal || parseFloat(order.amount || '0'),
        category_id: TRIP_REVENUE_CAT_ID,
        to_wallet_id: BANK_WALLET_ID,
        from_wallet_id: null,
        counterparty_id: order.counterparty_id || null,
        trip_order_id: order.id,
        trip_id: order.trip_id,
        related_user_id: order.trip?.driver_id || null,
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        description: `Оплата по СБП / Р/С · ${tripNumber} (${driverName})`,
        idempotency_key: idempotencyKey,
        transaction_date: opDate,
        created_at: existingTx?.created_at || opDate,
        created_by: adminUser?.id || null,
      };

      if (existingTx) {
        await (supabase.from('transactions') as any).update(txPayload).eq('id', existingTx.id);
      } else {
        await (supabase.from('transactions') as any).insert(txPayload);
      }

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
        type: 'trip',
        trip_number: order.trip?.trip_number,
        driver_name: driverName,
      });
    }

    // 3. ВАРИАНТ Б: СВЯЗКА С ЗАКАЗ-НАРЯДОМ ГАРАЖА / СТО
    if (linkType === 'service_order') {
      const orderLabel = serviceOrderId || body.orderNumber || 'Заказ-наряд СТО';
      const clientName = body.clientName || 'Клиент автосервиса';

      const txPayload = {
        direction: 'income',
        amount: amountVal,
        category_id: STO_REVENUE_CAT_ID,
        to_wallet_id: BANK_WALLET_ID,
        from_wallet_id: null,
        counterparty_id: body.counterpartyId || null,
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        description: `Оплата заказ-наряда · ${orderLabel} (${clientName})`,
        idempotency_key: idempotencyKey,
        transaction_date: opDate,
        created_at: existingTx?.created_at || opDate,
        created_by: adminUser?.id || null,
      };

      if (existingTx) {
        await (supabase.from('transactions') as any).update(txPayload).eq('id', existingTx.id);
      } else {
        await (supabase.from('transactions') as any).insert(txPayload);
      }

      return NextResponse.json({
        success: true,
        linked: true,
        type: 'service_order',
        order_number: orderLabel,
      });
    }

    // 4. ВАРИАНТ В: ДИСПЕТЧЕРСКИЙ РЕЙС / ЧУЖОЙ АВТОМОБИЛЬ (АТИ / ЭКСПЕДИРОВАНИЕ)
    if (linkType === 'dispatcher') {
      const details = dispatcherDetails || body.details || 'Диспетчерский рейс';
      const clientName = body.clientName || 'Заказчик АТИ';

      const txPayload = {
        direction: 'income',
        amount: amountVal,
        category_id: TRIP_REVENUE_CAT_ID,
        to_wallet_id: BANK_WALLET_ID,
        from_wallet_id: null,
        counterparty_id: body.counterpartyId || null,
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        description: `Диспетчерский рейс · ${details} (${clientName})`,
        idempotency_key: idempotencyKey,
        transaction_date: opDate,
        created_at: existingTx?.created_at || opDate,
        created_by: adminUser?.id || null,
      };

      if (existingTx) {
        await (supabase.from('transactions') as any).update(txPayload).eq('id', existingTx.id);
      } else {
        await (supabase.from('transactions') as any).insert(txPayload);
      }

      return NextResponse.json({
        success: true,
        linked: true,
        type: 'dispatcher',
        details,
      });
    }

    return NextResponse.json({ error: 'Неизвестный тип привязки' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in link-bank-op:', err);
    return NextResponse.json({ error: err.message || 'Ошибка сервера' }, { status: 500 });
  }
}
