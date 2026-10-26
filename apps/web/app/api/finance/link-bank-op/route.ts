/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateDeterministicUuid } from '@saldacargo/shared';

const BANK_WALLET_ID = '10000000-0000-0000-0000-000000000001';
const TRIP_REVENUE_CAT_ID = '74008cf7-0527-4e9f-afd2-d232b8f8125a'; // Выручка с рейса
const STO_REVENUE_CAT_ID = '600e7f70-2797-474d-948b-432230036d67'; // Выручка с ремонта (SERVICE_REVENUE)

/**
 * Поиск существующих транзакций, привязанных к данной банковской операции:
 * по прямому idempotency_key (UUID) или по маркеру [bank_op:UUID] в description.
 */
async function findExistingTransactions(supabase: any, idempotencyKey: string) {
  const { data, error } = await (supabase.from('transactions') as any)
    .select('id, trip_order_id, idempotency_key, description')
    .or(`idempotency_key.eq.${idempotencyKey},description.ilike.%${idempotencyKey}%`);

  if (error) {
    console.error('Error finding existing transactions for link-bank-op:', error);
    return [];
  }
  return data || [];
}

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
      const existingTxs = await findExistingTransactions(supabase, idempotencyKey);

      if (existingTxs.length > 0) {
        const txIds = existingTxs.map((t: any) => t.id);
        const orderIds = existingTxs.map((t: any) => t.trip_order_id).filter(Boolean);

        const { error: delErr } = await (supabase.from('transactions') as any)
          .delete()
          .in('id', txIds);
        if (delErr) {
          console.error('Error deleting transactions on unlink:', delErr);
          return NextResponse.json(
            { error: `Ошибка отвязки транзакции: ${delErr.message}` },
            { status: 500 },
          );
        }

        if (orderIds.length > 0) {
          await (supabase.from('trip_orders') as any)
            .update({
              settlement_status: 'pending',
              invoice_paid_at: null,
            })
            .in('id', orderIds);
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

    const opDate =
      body.operationDate ||
      (body.date ? `${body.date}T12:00:00.000Z` : null) ||
      new Date().toISOString();

    const amountVal = parseFloat(body.amount || '0');

    // 2. ВАРИАНТ А: СВЯЗКА С РЕЙСАМИ АВТОПАРКА (Один или сразу несколько рейсов)
    if (linkType === 'trip') {
      const targetOrderIds: string[] =
        Array.isArray(body.tripOrderIds) && body.tripOrderIds.length > 0
          ? body.tripOrderIds
          : tripOrderId
            ? [tripOrderId]
            : [];

      if (targetOrderIds.length === 0) {
        return NextResponse.json(
          { error: 'Не указаны рейсы автопарка для привязки' },
          { status: 400 },
        );
      }

      // Очищаем старые транзакции для этой банковской операции (если была предыдущая привязка)
      const prevTxs = await findExistingTransactions(supabase, idempotencyKey);

      if (prevTxs.length > 0) {
        const prevTxIds = prevTxs.map((t: any) => t.id);
        const prevOrderIds = prevTxs
          .map((t: any) => t.trip_order_id)
          .filter((id: string) => Boolean(id) && !targetOrderIds.includes(id));

        const { error: delErr } = await (supabase.from('transactions') as any)
          .delete()
          .in('id', prevTxIds);
        if (delErr) {
          console.error('Error cleaning prev transactions in link-bank-op:', delErr);
          return NextResponse.json(
            { error: `Ошибка обновления связки: ${delErr.message}` },
            { status: 500 },
          );
        }

        if (prevOrderIds.length > 0) {
          await (supabase.from('trip_orders') as any)
            .update({
              settlement_status: 'pending',
              invoice_paid_at: null,
            })
            .in('id', prevOrderIds);
        }
      }

      // Получаем выбранные заказы
      const { data: orders, error: ordersErr } = await (supabase.from('trip_orders') as any)
        .select(
          'id, amount, trip_id, counterparty_id, payment_method, trip:trips(id, trip_number, driver_id, driver:users!trips_driver_id_fkey(id, name))',
        )
        .in('id', targetOrderIds);

      if (ordersErr || !orders || orders.length === 0) {
        return NextResponse.json({ error: 'Заказы рейсов не найдены' }, { status: 404 });
      }

      const isSingle = orders.length === 1;
      const newTxs: any[] = [];

      for (const order of orders) {
        const tripNumber = order.trip?.trip_number ? `Рейс №${order.trip.trip_number}` : 'Рейс';
        const driverName = order.trip?.driver?.name || 'Водитель';
        const orderAmt = parseFloat(order.amount || '0');

        // Если 1 рейс — берём сумму операции или сумму заказа; если несколько — сумму конкретного заказа
        const txAmount = isSingle ? amountVal || orderAmt : orderAmt;
        const txKey = isSingle
          ? idempotencyKey
          : generateDeterministicUuid(`${idempotencyKey}:${order.id}`);

        newTxs.push({
          direction: 'income',
          amount: txAmount,
          category_id: TRIP_REVENUE_CAT_ID,
          to_wallet_id: BANK_WALLET_ID,
          from_wallet_id: null,
          counterparty_id: order.counterparty_id || null,
          trip_order_id: order.id,
          trip_id: order.trip_id,
          related_user_id: order.trip?.driver_id || null,
          lifecycle_status: 'approved',
          settlement_status: 'completed',
          description: `Оплата по СБП / Р/С · ${tripNumber} (${driverName}) [bank_op:${idempotencyKey}]`,
          idempotency_key: txKey,
          transaction_date: opDate,
          created_at: opDate,
          created_by: adminUser?.id || null,
        });
      }

      const { error: insErr } = await (supabase.from('transactions') as any).insert(newTxs);
      if (insErr) {
        console.error('Error inserting transactions in link-bank-op:', insErr);
        return NextResponse.json(
          { error: `Не удалось сохранить транзакцию: ${insErr.message}` },
          { status: 500 },
        );
      }

      await (supabase.from('trip_orders') as any)
        .update({
          settlement_status: 'completed',
          lifecycle_status: 'approved',
          invoice_paid_at: new Date().toISOString(),
        })
        .in('id', targetOrderIds);

      return NextResponse.json({
        success: true,
        linked: true,
        type: 'trip',
        count: orders.length,
        trip_numbers: orders.map((o: any) => o.trip?.trip_number).filter(Boolean),
        driver_name: isSingle ? orders[0].trip?.driver?.name || 'Водитель' : undefined,
      });
    }

    // Очищаем старые транзакции для этой банковской операции перед записью СТО / Диспетчера
    const prevTxs = await findExistingTransactions(supabase, idempotencyKey);

    if (prevTxs.length > 0) {
      const prevTxIds = prevTxs.map((t: any) => t.id);
      const prevOrderIds = prevTxs.map((t: any) => t.trip_order_id).filter(Boolean);

      const { error: delErr } = await (supabase.from('transactions') as any)
        .delete()
        .in('id', prevTxIds);
      if (delErr) {
        console.error('Error cleaning prev transactions before STO/dispatcher:', delErr);
        return NextResponse.json(
          { error: `Ошибка обновления связки: ${delErr.message}` },
          { status: 500 },
        );
      }

      if (prevOrderIds.length > 0) {
        await (supabase.from('trip_orders') as any)
          .update({
            settlement_status: 'pending',
            invoice_paid_at: null,
          })
          .in('id', prevOrderIds);
      }
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
        description: `Оплата заказ-наряда · ${orderLabel} (${clientName}) [bank_op:${idempotencyKey}]`,
        idempotency_key: idempotencyKey,
        transaction_date: opDate,
        created_at: opDate,
        created_by: adminUser?.id || null,
      };

      const { error: stoErr } = await (supabase.from('transactions') as any).insert(txPayload);
      if (stoErr) {
        console.error('Error inserting STO transaction:', stoErr);
        return NextResponse.json(
          { error: `Не удалось сохранить транзакцию СТО: ${stoErr.message}` },
          { status: 500 },
        );
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
        description: `Диспетчерский рейс · ${details} (${clientName}) [bank_op:${idempotencyKey}]`,
        idempotency_key: idempotencyKey,
        transaction_date: opDate,
        created_at: opDate,
        created_by: adminUser?.id || null,
      };

      const { error: dispErr } = await (supabase.from('transactions') as any).insert(txPayload);
      if (dispErr) {
        console.error('Error inserting Dispatcher transaction:', dispErr);
        return NextResponse.json(
          { error: `Не удалось сохранить транзакцию диспетчера: ${dispErr.message}` },
          { status: 500 },
        );
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
