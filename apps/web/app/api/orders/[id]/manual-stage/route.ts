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
        if (stage === 'in_progress') {
          tripUpdatePayload.status = 'in_progress';
        } else {
          tripUpdatePayload.status = 'completed';
          tripUpdatePayload.ended_at = now;
          if (['docs_collection', 'completed'].includes(stage)) {
            tripUpdatePayload.lifecycle_status = 'approved';
          }
        }
        await (supabase.from('trips') as any).update(tripUpdatePayload).eq('id', activeTripId);
      }

      // 3. Создаем или обновляем запись в trip_orders (для Дебиторки)
      if (activeTripId) {
        const { data: existingTripOrders } = await (supabase.from('trip_orders') as any)
          .select('id')
          .eq('trip_id', activeTripId)
          .limit(1);

        if (!existingTripOrders || existingTripOrders.length === 0) {
          await (supabase.from('trip_orders') as any).insert({
            idempotency_key: crypto.randomUUID(),
            trip_id: activeTripId,
            counterparty_id: order.client_id || null,
            amount: Number(order.price_without_vat) || 0,
            payment_method: order.payment_terms?.includes('Наличные') ? 'cash' : 'bank_invoice',
            description: `Заявка № ${order.base_doc_number || order.order_number}: ${order.cargo_name || 'Перевозка'}`,
            lifecycle_status: 'approved',
            settlement_status: 'pending',
            invoice_status: 'unbilled',
          });
        } else if (['docs_collection', 'completed'].includes(stage)) {
          await (supabase.from('trip_orders') as any)
            .update({ lifecycle_status: 'approved', updated_at: now })
            .eq('trip_id', activeTripId);
        }
      }
    }

    // 4. Обновляем статус заказа
    const updateOrderPayload: Record<string, any> = {
      status: stage,
      active_trip_id: activeTripId || null,
      updated_at: now,
    };

    if (stage === 'in_progress' && !order.actual_loading_arrival_at) {
      updateOrderPayload.actual_loading_arrival_at = now;
    }
    if (
      ['pending_review', 'docs_collection', 'completed'].includes(stage) &&
      !order.actual_delivery_arrival_at
    ) {
      updateOrderPayload.actual_delivery_arrival_at = now;
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
