/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateTransportWaybillHtml } from '@saldacargo/domain-service';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const isEmpty = searchParams.get('empty') === '1' || searchParams.get('empty') === 'true';
    const supabase = createAdminClient();

    let order: any = null;

    if (id === 'blank' || id === 'new') {
      order = {
        id: 'blank',
        order_number: '______',
        base_doc_number: '______',
        created_at: new Date().toISOString(),
        client: {
          name: 'ПАО «Корпорация ВСМПО-АВИСМА»',
          inn: '6607000556',
          legal_address: '624760, Свердловская область, г. Верхняя Салда, ул. Парковая, д 1',
        },
      };
    } else {
      const { data: dbOrder, error } = await (supabase.from('orders') as any)
        .select(
          `
          *,
          client:counterparties!orders_client_id_fkey(*),
          forwarder:counterparties!orders_forwarder_id_fkey(*),
          shipper:counterparties!orders_shipper_id_fkey(*),
          consignee:counterparties!orders_consignee_id_fkey(*),
          vehicle:assets(*),
          driver:users!orders_assigned_driver_id_fkey(*),
          loading_point:loading_points_directory(*)
        `,
        )
        .eq('id', id)
        .single();

      if (error || !dbOrder) {
        return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
      }
      order = dbOrder;
    }

    const html = generateTransportWaybillHtml(
      {
        orderNumber: order.base_doc_number || String(order.order_number),
        orderDate: order.base_doc_date || order.created_at.slice(0, 10),
        waybillNumber: order.waybill_number || `№ ${order.order_number}`,
        shipper: {
          name: order.shipper?.name || order.client?.name || 'ПАО «Корпорация ВСМПО-АВИСМА»',
          inn: order.shipper?.inn || order.client?.inn || '6607000556',
          kpp: order.shipper?.kpp || order.client?.kpp || '997550001',
          address:
            order.shipper?.legal_address ||
            '624760, Свердловская область, г. Верхняя Салда, ул. Парковая, д 1',
          phone: order.shipper?.contact_phone || '+79667100167',
          isForwarder: true,
        },
        client: {
          name: order.client?.name || 'ПАО «Корпорация ВСМПО-АВИСМА»',
          inn: order.client?.inn || '6607000556',
          address:
            order.client?.legal_address ||
            '624760, Свердловская область, г. Верхняя Салда, ул. Парковая, д 1',
          contractName: order.client?.default_contract_name || 'договор',
          contractNumber: order.client?.default_contract_number || '10676',
          contractDate: order.client?.default_contract_date || '01.08.2012',
        },
        consignee: {
          name: order.consignee?.name || order.client?.name || 'ПАО «Корпорация ВСМПО-АВИСМА»',
          inn: order.consignee?.inn || order.client?.inn || '6607000556',
          address:
            order.consignee?.legal_address ||
            '624760, Свердловская область, г. Верхняя Салда, ул. Парковая, д 1',
          deliveryAddress:
            order.unloading_address_json?.raw ||
            '624760, Свердловская область, г. Верхняя Салда, ул. Парковая, д 1, склад 0802',
          phone: order.consignee?.contact_phone || '6-44-26',
        },
        cargo: {
          name: order.cargo_name || 'Металлопрокат',
          placesCount: order.places_count || 1,
          packagingType: order.packaging_type || 'палетты',
          weightGrossKg: order.weight_gross_kg || 110,
          weightNetKg: order.weight_net_kg || 110,
          dimensionsText: order.dimensions_text,
          declaredValue: order.cargo_declared_value || 60000,
        },
        carrier: {
          name: 'ИП Нигамедьянов Александр Сергеевич',
          inn: '660704814106',
          ogrnip: '321665800053976',
          address: '624760, Свердловская область, г. Верхняя Салда, ул. 25 Октября, д. 11, кв. 22',
          phone: '+79222970911',
        },
        driver: {
          fio: order.driver?.name || (order as any).driver_name || 'Шахмаев А.С.',
          phone: order.driver?.phone || '+79221672787',
          licenseSeries: order.driver?.license_series || '9945',
          licenseNumber: order.driver?.license_number || '273350',
        },
        vehicle: {
          regNumber: order.vehicle?.reg_number || 'О188ТА196',
          brandName: order.vehicle?.brand_name || order.vehicle?.short_name || 'Валдай',
          bodyType: order.vehicle?.body_type_name || 'Грузовой автомобиль',
          payloadTons: order.vehicle?.payload_tons || 3.1,
          capacityM3: order.vehicle?.capacity_m3 || 40,
          ownershipType: 1,
        },
        loading: {
          orgName: order.loading_org_name || order.loading_point?.name || 'ООО "Континенталь"',
          orgInn: order.loading_org_inn || order.loading_point?.inn || '6609002301',
          address:
            order.loading_address_json?.raw ||
            '624250, Свердловская область, г. Заречный, ул. Промзона БЗСК, д 2',
          plannedAt: order.planned_loading_at?.slice(0, 16).replace('T', ' '),
          actualArrivalAt: order.actual_loading_arrival_at?.slice(0, 16).replace('T', ' '),
          actualDepartureAt: order.actual_loading_departure_at?.slice(0, 16).replace('T', ' '),
          contactFio:
            order.loading_contact_fio || order.loading_point?.contact_fio || 'Гончарова М.В.',
        },
        unloading: {
          address:
            order.unloading_address_json?.raw ||
            '624760, Свердловская область, г. Верхняя Салда, ул. Парковая, д 1, склад 0802',
          plannedAt: order.planned_delivery_at?.slice(0, 16).replace('T', ' '),
          actualArrivalAt: order.actual_loading_departure_at?.slice(0, 16).replace('T', ' '),
          contactFio: (order as any).unloading_contact_fio || 'Кладовщик скл. 813 / Черникова Н.В.',
        },
        finance: {
          priceWithoutVat: order.price_without_vat || 15000,
          vatRate: order.vat_rate || 'без НДС',
        },
      },
      { isEmpty },
    );

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (err: any) {
    console.error('Ошибка генерации ТН:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
