/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const supabase = createAdminClient();
    let query = (supabase.from('orders') as any)
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
        trip:trips(*)
      `,
      )
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const isStrictDocCounterparty = (name?: string | null) => {
      if (!name) return false;
      const n = name.toLowerCase();
      return n.includes('всмпо') || n.includes('ависма') || n.includes('геострой');
    };

    const enriched = (data || []).map((o: any) => {
      let currentStatus = o.status;

      // Автоматическая фоновая синхронизация со связанным рейсом (trips)
      if (o.trip) {
        if (o.trip.lifecycle_status === 'approved') {
          const targetStatus = isStrictDocCounterparty(o.client?.name)
            ? 'docs_collection'
            : 'completed';
          if (currentStatus === 'in_progress' || currentStatus === 'pending_review') {
            currentStatus = targetStatus;
            (supabase.from('orders') as any)
              .update({ status: targetStatus, updated_at: new Date().toISOString() })
              .eq('id', o.id)
              .then();
          }
        } else if (o.trip.status === 'completed' && currentStatus === 'in_progress') {
          currentStatus = 'pending_review';
          (supabase.from('orders') as any)
            .update({ status: 'pending_review', updated_at: new Date().toISOString() })
            .eq('id', o.id)
            .then();
        }
      }

      return {
        ...o,
        status: currentStatus,
        routes_json: o.routes_json || o.raw_parser_payload?.routes || [],
        prevent_salda_auto_finish: Boolean(
          o.prevent_salda_auto_finish || o.raw_parser_payload?.prevent_salda_auto_finish,
        ),
        salda_transit_count: Number(
          o.salda_transit_count || o.raw_parser_payload?.salda_transit_count || 0,
        ),
        billing_docs: o.raw_parser_payload?.billing_docs || null,
      };
    });

    return NextResponse.json({ orders: enriched });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = createAdminClient();

    let finalDocNumber = body.base_doc_number;
    if (!finalDocNumber || finalDocNumber === '1') {
      const { data: maxTrip } = await (supabase.from('trips') as any)
        .select('trip_number')
        .order('trip_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: recentOrders } = await (supabase.from('orders') as any)
        .select('base_doc_number, internal_order_number')
        .order('created_at', { ascending: false })
        .limit(50);

      let maxOrderNum = 0;
      for (const o of recentOrders || []) {
        const clean1 = String(o.base_doc_number || '')
          .replace(/^№\s*/, '')
          .replace(/^Заявка\s*№?\s*/i, '');
        const num1 = parseInt((clean1.split('/')[0] || '').trim(), 10);
        if (!isNaN(num1) && num1 > maxOrderNum && num1 < 100000) maxOrderNum = num1;

        const clean2 = String(o.internal_order_number || '')
          .replace(/^№\s*/, '')
          .replace(/^Заявка\s*№?\s*/i, '');
        const num2 = parseInt((clean2.split('/')[0] || '').trim(), 10);
        if (!isNaN(num2) && num2 > maxOrderNum && num2 < 100000) maxOrderNum = num2;
      }
      const nextNum = Math.max(maxTrip?.trip_number || 0, maxOrderNum) + 1;
      finalDocNumber = String(nextNum);
    }

    const insertPayload: any = {
      source_type: body.source_type || 'direct_ad',
      status:
        body.assigned_vehicle_id && body.assigned_driver_id
          ? 'assigned'
          : body.status || 'waiting_vehicle',
      base_doc_name: body.base_doc_name || 'Поручение экспедитору',
      base_doc_number: finalDocNumber,
      base_doc_date: body.base_doc_date || new Date().toISOString().slice(0, 10),
      internal_order_number: body.internal_order_number || finalDocNumber,

      client_id: body.client_id || null,
      forwarder_id: body.forwarder_id || null,
      shipper_id: body.shipper_id || body.client_id || null,
      consignee_id: body.consignee_id || body.client_id || null,
      preset_id: body.preset_id || null,

      loading_point_id: body.loading_point_id || null,
      loading_org_name: body.loading_org_name || null,
      loading_org_inn: body.loading_org_inn || null,
      loading_org_kpp: body.loading_org_kpp || null,
      loading_contact_fio: body.loading_contact_fio || null,
      loading_contact_phone: body.loading_contact_phone || null,

      cargo_name: body.cargo_name || 'Металлопрокат',
      cargo_condition: body.cargo_condition || 'без повреждений',
      packaging_type: body.packaging_type || 'палетты',
      package_code: body.package_code || '00',
      places_count: body.places_count ? Number(body.places_count) : 1,
      weight_gross_kg: body.weight_gross_kg ? Number(body.weight_gross_kg) : 0,
      weight_net_kg: body.weight_net_kg ? Number(body.weight_net_kg) : 0,
      dimensions_text: body.dimensions_text || null,
      cargo_declared_value: body.cargo_declared_value ? Number(body.cargo_declared_value) : 0,

      loading_address_json: body.loading_address_json || {},
      unloading_address_json: body.unloading_address_json || {},
      planned_loading_at: body.planned_loading_at || null,
      planned_delivery_at: body.planned_delivery_at || null,

      price_without_vat: body.price_without_vat ? Number(body.price_without_vat) : 0,
      vat_rate: body.vat_rate || 'без НДС',
      payment_terms: body.payment_terms || 'По факту доставки и оригиналов документов',

      assigned_vehicle_id: body.assigned_vehicle_id || null,
      assigned_driver_id: body.assigned_driver_id || null,

      // Сохраняем составные маршруты и флаги транзита внутри jsonb raw_parser_payload
      raw_parser_payload: {
        ...(body.raw_parser_payload || {}),
        routes: body.routes_json || body.raw_parser_payload?.routes || [],
        prevent_salda_auto_finish: Boolean(body.prevent_salda_auto_finish),
        salda_transit_count: Number(body.salda_transit_count) || 0,
      },
    };

    if (insertPayload.assigned_vehicle_id && !insertPayload.waybill_number) {
      const year = String(new Date().getFullYear()).slice(-2);
      insertPayload.waybill_number = `ПЛ-${year}/${finalDocNumber}`;
    }

    const { data: created, error } = await (supabase.from('orders') as any)
      .insert(insertPayload)
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

    const enriched = {
      ...created,
      routes_json: created.raw_parser_payload?.routes || [],
      prevent_salda_auto_finish: Boolean(created.raw_parser_payload?.prevent_salda_auto_finish),
      salda_transit_count: Number(created.raw_parser_payload?.salda_transit_count || 0),
    };

    return NextResponse.json({ order: enriched });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
