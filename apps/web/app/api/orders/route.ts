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

    return NextResponse.json({ orders: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = createAdminClient();

    const insertPayload: any = {
      source_type: body.source_type || 'direct_ad',
      status:
        body.assigned_vehicle_id && body.assigned_driver_id
          ? 'assigned'
          : body.status || 'waiting_vehicle',
      base_doc_name: body.base_doc_name || 'Поручение экспедитору',
      base_doc_number: body.base_doc_number || null,
      base_doc_date: body.base_doc_date || null,
      internal_order_number: body.internal_order_number || body.base_doc_number || null,

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
      routes_json: body.routes_json || [],
      prevent_salda_auto_finish: Boolean(body.prevent_salda_auto_finish),
      salda_transit_count: Number(body.salda_transit_count) || 0,
      raw_parser_payload: {
        ...(body.raw_parser_payload || {}),
        routes: body.routes_json || [],
        prevent_salda_auto_finish: Boolean(body.prevent_salda_auto_finish),
      },
    };

    if (insertPayload.assigned_vehicle_id && !insertPayload.waybill_number) {
      const year = String(new Date().getFullYear()).slice(-2);
      insertPayload.waybill_number = `ПЛ-${year}/${Math.floor(1000 + Math.random() * 9000)}`;
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

    return NextResponse.json({ order: created });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
