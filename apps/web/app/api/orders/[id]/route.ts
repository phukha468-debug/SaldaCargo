/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: order, error } = await (supabase.from('orders') as any)
      .select(
        `
        *,
        client:counterparties!orders_client_id_fkey(*),
        forwarder:counterparties!orders_forwarder_id_fkey(*),
        shipper:counterparties!orders_shipper_id_fkey(*),
        consignee:counterparties!orders_consignee_id_fkey(*),
        vehicle:assets(*),
        driver:users!orders_assigned_driver_id_fkey(*),
        loading_point:loading_points_directory(*),
        preset:order_presets(*),
        trip:trips(*)
      `,
      )
      .eq('id', id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: error?.message || 'Заявка не найдена' }, { status: 404 });
    }

    const enriched = {
      ...order,
      routes_json: order.routes_json || order.raw_parser_payload?.routes || [],
      prevent_salda_auto_finish: Boolean(
        order.prevent_salda_auto_finish || order.raw_parser_payload?.prevent_salda_auto_finish,
      ),
      salda_transit_count: Number(
        order.salda_transit_count || order.raw_parser_payload?.salda_transit_count || 0,
      ),
      billing_docs: order.raw_parser_payload?.billing_docs || null,
    };

    return NextResponse.json({ order: enriched });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const supabase = createAdminClient();

    // Загружаем текущий raw_parser_payload и статус заявки, чтобы не потерять параметры
    const { data: currentOrder } = await (supabase.from('orders') as any)
      .select('status, active_trip_id, raw_parser_payload')
      .eq('id', id)
      .single();

    const existingPayload = currentOrder?.raw_parser_payload || {};

    const updatePayload: any = {
      ...body,
      updated_at: new Date().toISOString(),
    };

    // Удаляем из верхнего уровня поля, которых нет в схеме таблицы orders
    delete updatePayload.routes_json;
    delete updatePayload.prevent_salda_auto_finish;
    delete updatePayload.salda_transit_count;

    // Сохраняем составные маршруты и флаг транзита внутри jsonb raw_parser_payload
    updatePayload.raw_parser_payload = {
      ...existingPayload,
      ...(body.raw_parser_payload || {}),
      ...(body.routes_json !== undefined ? { routes: body.routes_json } : {}),
      ...(body.prevent_salda_auto_finish !== undefined
        ? { prevent_salda_auto_finish: Boolean(body.prevent_salda_auto_finish) }
        : {}),
      ...(body.salda_transit_count !== undefined
        ? { salda_transit_count: Number(body.salda_transit_count) }
        : {}),
    };

    // Если назначили ТС и водителя, но статус был waiting_vehicle — переводим в assigned
    // ВАЖНО: никогда не сбрасываем статус, если заявка уже в пути (in_progress), на ревью или в сборе документов!
    if (
      updatePayload.assigned_vehicle_id &&
      updatePayload.assigned_driver_id &&
      currentOrder?.status === 'waiting_vehicle' &&
      (!updatePayload.status || updatePayload.status === 'waiting_vehicle')
    ) {
      updatePayload.status = 'assigned';
      if (!updatePayload.waybill_number) {
        const year = String(new Date().getFullYear()).slice(-2);
        updatePayload.waybill_number = `ПЛ-${year}/${Math.floor(1000 + Math.random() * 9000)}`;
      }
    } else if (
      updatePayload.status === 'assigned' &&
      currentOrder?.status &&
      ['in_progress', 'pending_review', 'docs_collection', 'completed'].includes(
        currentOrder.status,
      )
    ) {
      // Защита: смена водителя/ТС не должна сбрасывать статус заявки в пути или на ревью/завершённой
      updatePayload.status = currentOrder.status;
    } else if (!updatePayload.status && currentOrder?.status) {
      // Сохраняем текущий статус заявки, если он не был явно передан в теле запроса!
      updatePayload.status = currentOrder.status;
    }

    const { data: updated, error } = await (supabase.from('orders') as any)
      .update(updatePayload)
      .eq('id', id)
      .select(
        `
        *,
        client:counterparties!orders_client_id_fkey(*),
        forwarder:counterparties!orders_forwarder_id_fkey(*),
        vehicle:assets(*),
        driver:users!orders_assigned_driver_id_fkey(*)
      `,
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Синхронизация ставки на лету (в пути): обновляем связанный trip_orders при изменении price_without_vat
    const targetTripId = currentOrder?.active_trip_id || updated.active_trip_id;
    if (updatePayload.price_without_vat !== undefined && targetTripId) {
      const newPrice = Number(updatePayload.price_without_vat) || 0;
      await (supabase.from('trip_orders') as any)
        .update({ amount: newPrice })
        .eq('trip_id', targetTripId);
    }

    // Синхронизация водителя в связанном рейсе при смене водителя на заявке
    if (updatePayload.assigned_driver_id && targetTripId) {
      await (supabase.from('trips') as any)
        .update({
          driver_id: updatePayload.assigned_driver_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetTripId);
    }

    if (['docs_collection', 'completed'].includes(updatePayload.status) && targetTripId) {
      await (supabase.from('trips') as any)
        .update({
          status: 'completed',
          lifecycle_status: 'approved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetTripId);
      await (supabase.from('trip_orders') as any)
        .update({ lifecycle_status: 'approved' })
        .eq('trip_id', targetTripId)
        .neq('lifecycle_status', 'cancelled');
    }

    const enriched = {
      ...updated,
      routes_json: updated.raw_parser_payload?.routes || [],
      prevent_salda_auto_finish: Boolean(updated.raw_parser_payload?.prevent_salda_auto_finish),
      salda_transit_count: Number(updated.raw_parser_payload?.salda_transit_count || 0),
      billing_docs: updated.raw_parser_payload?.billing_docs || null,
    };

    return NextResponse.json({ order: enriched });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { error } = await (supabase.from('orders') as any).delete().eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
