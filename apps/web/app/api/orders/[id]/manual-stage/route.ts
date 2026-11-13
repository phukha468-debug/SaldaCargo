/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const stage = body.stage; // 'waiting_vehicle' | 'assigned' | 'in_progress' | 'pending_review' | 'docs_collection' | 'completed'

    const VALID_STAGES = [
      'waiting_vehicle',
      'assigned',
      'in_progress',
      'pending_review',
      'docs_collection',
      'completed',
    ];
    if (!VALID_STAGES.includes(stage)) {
      return NextResponse.json({ error: `Недопустимый этап: ${stage}` }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Загружаем текущий заказ
    const { data: order, error: orderErr } = await (supabase.from('orders') as any)
      .select('*, vehicle:assets(*), driver:users!orders_assigned_driver_id_fkey(*)')
      .eq('id', id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Парсим номер рейса из номера заявки (если это не ЭПЭ с дробью вроде 793/2026)
    const rawOrderNum = order.base_doc_number || order.internal_order_number || order.order_number;
    const cleanNumStr = String(rawOrderNum || '')
      .replace(/^№\s*/, '')
      .replace(/^Заявка\s*№?\s*/i, '');
    const isEpeWithSlash = cleanNumStr.includes('/') || cleanNumStr.includes('\\');
    const parsedTripNum = !isEpeWithSlash
      ? parseInt((cleanNumStr.split('/')[0] || '').trim(), 10)
      : NaN;
    const validTripNum =
      !isNaN(parsedTripNum) && parsedTripNum > 0 && parsedTripNum < 100000 ? parsedTripNum : null;

    let activeTripId = order.active_trip_id;

    // 4. Подготавливаем обновление статуса заказа
    const updateOrderPayload: Record<string, any> = {
      status: stage,
      active_trip_id: activeTripId || null,
      updated_at: now,
    };

    if (stage === 'in_progress' && !order.actual_loading_arrival_at) {
      updateOrderPayload.actual_loading_arrival_at = now;
    }

    // 2. Если перемещаем в «В пути», «На ревью», «Сбор документов» или «Завершён», проверяем наличие связанного рейса
    if (['in_progress', 'pending_review', 'docs_collection', 'completed'].includes(stage)) {
      if (!activeTripId) {
        // Создаем рейс trips вручную (для машин без Wialon)
        const currentOdo = order.vehicle?.odometer_current || 120500;
        const isApprovedStage = ['docs_collection', 'completed'].includes(stage);
        const tripInsertPayload: Record<string, any> = {
          asset_id: order.assigned_vehicle_id || null,
          driver_id: order.assigned_driver_id || null,
          trip_type: 'intercity',
          status: stage === 'in_progress' ? 'in_progress' : 'completed',
          lifecycle_status: isApprovedStage ? 'approved' : 'draft',
          odometer_start: stage === 'in_progress' ? currentOdo : Math.max(0, currentOdo - 350),
          odometer_end: currentOdo,
          started_at: order.planned_loading_at || now,
          ended_at: stage !== 'in_progress' ? now : null,
          driver_note: `Ручной перевод этапа: ${stage} (без Wialon). Заявка № ${order.base_doc_number || order.order_number}`,
        };

        if (validTripNum) {
          tripInsertPayload.trip_number = validTripNum;
        }

        const { data: newTrip, error: tripErr } = await (supabase.from('trips') as any)
          .insert(tripInsertPayload)
          .select()
          .single();

        if (tripErr) {
          console.error('Ошибка создания рейса:', tripErr);
        } else if (newTrip) {
          activeTripId = newTrip.id;
        }
      } else {
        // Обновляем существующий рейс
        const tripUpdatePayload: Record<string, any> = {
          updated_at: now,
        };
        let computedDriverPay: number | null = null;
        let computedDistanceKm = 0;

        if (stage === 'in_progress') {
          tripUpdatePayload.status = 'in_progress';
        } else {
          tripUpdatePayload.status = 'completed';
          tripUpdatePayload.ended_at = now;
          if (['docs_collection', 'completed'].includes(stage)) {
            tripUpdatePayload.lifecycle_status = 'approved';
          }

          // Проверяем, зафиксирован ли конечный одометр рейса
          const { data: existingTrip } = await (supabase.from('trips') as any)
            .select('id, odometer_start, odometer_end, started_at, asset_id')
            .eq('id', activeTripId)
            .single();

          if (existingTrip && !existingTrip.odometer_end) {
            const currentOdo =
              order.vehicle?.odometer_current || existingTrip.odometer_start || 120500;
            const odoStart = existingTrip.odometer_start || Math.max(0, currentOdo - 350);
            const odoEnd = Math.max(odoStart, currentOdo);
            computedDistanceKm = Math.max(1, odoEnd - odoStart);
            tripUpdatePayload.odometer_start = odoStart;
            tripUpdatePayload.odometer_end = odoEnd;

            const startDate = new Date(existingTrip.started_at || now);
            const diffHours = Math.max(
              1,
              (new Date(now).getTime() - startDate.getTime()) / (1000 * 3600),
            );
            const daysCount = Math.max(1, Math.ceil(diffHours / 24));
            const kmPay = computedDistanceKm * 10;
            const perDiemPay = daysCount * 1000;
            computedDriverPay = Math.floor((kmPay + perDiemPay) / 100) * 100;

            const fuelLiters = Number(((computedDistanceKm * 18) / 100).toFixed(1));
            const fuelCost = Math.round((fuelLiters * 82) / 100) * 100;
            tripUpdatePayload.admin_note = `Ручной перевод этапа: ${stage}. Пробег: ${computedDistanceKm} км (${kmPay} ₽) + Суточные: ${daysCount} дн (${perDiemPay} ₽) = Итого ЗП: ${computedDriverPay} ₽ | Норматив ГСМ: ${fuelLiters} л (~${fuelCost} ₽)`;

            // Создаем нормативный расход на ГСМ в trip_expenses
            const CAT_FUEL_ID = '62cebf3f-9982-4cc6-904b-48c6169cf5e4';
            const { data: existExp } = await (supabase.from('trip_expenses') as any)
              .select('id')
              .eq('trip_id', activeTripId)
              .eq('category_id', CAT_FUEL_ID);

            if (!existExp || existExp.length === 0) {
              await (supabase.from('trip_expenses') as any).insert({
                trip_id: activeTripId,
                category_id: CAT_FUEL_ID,
                amount: fuelCost,
                payment_method: 'fuel_card',
                description: `Топливо по нормативу (Валдай): ${fuelLiters} л (18л/100км @ 82₽/л)`,
                idempotency_key: crypto.randomUUID(),
              });
            }
          }
        }
        await (supabase.from('trips') as any).update(tripUpdatePayload).eq('id', activeTripId);

        // Обновляем зарплату водителя в trip_orders если она была рассчитана
        if (computedDriverPay !== null) {
          await (supabase.from('trip_orders') as any)
            .update({
              driver_pay: computedDriverPay,
              updated_at: now,
            })
            .eq('trip_id', activeTripId);
        }
      }

      // 3. Создаем или обновляем запись в trip_orders (для Дебиторки)
      if (activeTripId) {
        let existingTripOrderId = order.raw_parser_payload?.trip_order_id;
        let existingOrderRecord = null;

        if (existingTripOrderId) {
          const { data: foundById } = await (supabase.from('trip_orders') as any)
            .select('id')
            .eq('id', existingTripOrderId)
            .maybeSingle();
          existingOrderRecord = foundById;
        }

        if (!existingOrderRecord) {
          // Ищем по номеру заявки в описании для этого рейса
          const orderNumSearch = order.base_doc_number || String(order.order_number);
          const { data: foundByDesc } = await (supabase.from('trip_orders') as any)
            .select('id')
            .eq('trip_id', activeTripId)
            .ilike('description', `%${orderNumSearch}%`)
            .maybeSingle();
          existingOrderRecord = foundByDesc;
          if (existingOrderRecord) existingTripOrderId = existingOrderRecord.id;
        }

        if (!existingOrderRecord) {
          const isApprovedStage = ['docs_collection', 'completed'].includes(stage);
          const { data: createdTo, error: insToErr } = await (supabase.from('trip_orders') as any)
            .insert({
              idempotency_key: crypto.randomUUID(),
              trip_id: activeTripId,
              counterparty_id: order.client_id || null,
              amount: Number(order.price_without_vat) || 0,
              payment_method: order.payment_terms?.includes('Наличные') ? 'cash' : 'bank_invoice',
              description: `Заявка № ${order.base_doc_number || order.order_number}: ${order.cargo_name || 'Перевозка'}`,
              lifecycle_status: isApprovedStage ? 'approved' : 'draft',
              settlement_status: 'pending',
              invoice_status: 'unbilled',
            })
            .select('id')
            .single();

          if (!insToErr && createdTo) {
            existingTripOrderId = createdTo.id;
          }
        } else if (['docs_collection', 'completed'].includes(stage)) {
          await (supabase.from('trip_orders') as any)
            .update({ lifecycle_status: 'approved', updated_at: now })
            .eq('id', existingTripOrderId);
        }

        if (
          existingTripOrderId &&
          existingTripOrderId !== order.raw_parser_payload?.trip_order_id
        ) {
          updateOrderPayload.raw_parser_payload = {
            ...(order.raw_parser_payload || {}),
            trip_order_id: existingTripOrderId,
          };
        }
      }
    }

    const { data: updatedOrder, error: updateErr } = await (supabase.from('orders') as any)
      .update(updateOrderPayload)
      .eq('id', id)
      .select(
        '*, client:counterparties!orders_client_id_fkey(*), vehicle:assets(*), driver:users!orders_assigned_driver_id_fkey(*)',
      )
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      stage,
      order: updatedOrder,
      message: `Заявка успешно переведена на этап: ${stage}`,
    });
  } catch (err: any) {
    console.error('Ошибка manual-stage:', err);
    return NextResponse.json({ error: err.message || 'Ошибка сервера' }, { status: 500 });
  }
}
