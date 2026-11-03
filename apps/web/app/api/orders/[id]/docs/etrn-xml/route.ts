/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateEtrnXml } from '@saldacargo/domain-service';

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
        preset:order_presets(*)
      `,
      )
      .eq('id', id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
    }

    const carrierSettings = order.preset?.carrier_settings || {
      inn: '660704814106',
      ogrnip: '321665800053976',
      name: 'ИП Нигамедьянов Александр Сергеевич',
      phone: '+79222970911',
      edo_participant_id: '2BM-660704814106-20260506082129781701600000000',
      address: {
        index: '624760',
        region_code: '66',
        district: 'м.о. Верхнесалдинский',
        city: 'Верхняя Салда',
        street: '25 октября',
        house: '11',
        flat: '22',
      },
    };

    const emchdSigner = order.preset?.emchd_signer || {
      fio: { lastName: 'Симанова', firstName: 'Олеся', middleName: 'Витальевна' },
      position: 'Сотрудник',
      power_of_attorney: {
        number: '532497b2-e630-4925-b6dd-947e6d26534a',
        date: '01.09.2026',
        storage_url:
          'https://m4d.nalog.gov.ru/emchd/check-status?guid=532497b2-e630-4925-b6dd-947e6d26534a',
      },
    };

    // ФИО водителя
    const driverFullName = order.driver?.name || 'Никифоров Денис Викторович';
    const driverParts = driverFullName.split(' ');
    const driverFio = {
      lastName: driverParts[0] || 'Никифоров',
      firstName: driverParts[1] || 'Денис',
      middleName: driverParts[2] || 'Викторович',
    };

    const clientAddr = order.client?.structured_address || {
      index: '624760',
      region_code: '66',
      district: 'м.о. Верхнесалдинский',
      city: 'Верхняя Салда',
      street: 'ул. Парковая',
      house: 'д 1',
    };

    const lpAddr = order.loading_point?.structured_address || {
      index: '624250',
      region_code: '66',
      city: 'Заречный',
      street: 'ул. Промзона БЗСК',
      house: 'строение 2',
    };

    const etrn = generateEtrnXml({
      orderNumber: order.base_doc_number || String(order.order_number),
      orderDate: order.base_doc_date || order.created_at.slice(0, 10),
      baseDocNumber: order.base_doc_number || `№ ${order.order_number}`,
      baseDocDate: order.base_doc_date || order.created_at.slice(0, 10),
      internalOrderNumber: order.internal_order_number || `${order.order_number}/2026`,

      carrier: {
        inn: carrierSettings.inn,
        ogrnip: carrierSettings.ogrnip,
        edoId: carrierSettings.edo_participant_id,
        phone: carrierSettings.phone,
        fio: { lastName: 'Нигамедьянов', firstName: 'Александр', middleName: 'Сергеевич' },
        address: {
          index: carrierSettings.address?.index || '624760',
          regionCode: carrierSettings.address?.region_code || '66',
          district: carrierSettings.address?.district || 'м.о. Верхнесалдинский',
          city: carrierSettings.address?.city || 'Верхняя Салда',
          street: carrierSettings.address?.street || '25 октября',
          house: carrierSettings.address?.house || '11',
          flat: carrierSettings.address?.flat || '22',
        },
      },

      client: {
        name: order.client?.name || 'ПАО «Корпорация ВСМПО-АВИСМА»',
        inn: order.client?.inn || '6607000556',
        kpp: order.client?.kpp || '997550001',
        edoId: order.client?.edo_participant_id || '2BM-6607000556-2013011605491613718210000000000',
        phone: order.client?.contact_phone || '+79667100167',
        address: {
          index: clientAddr.index || '624760',
          regionCode: clientAddr.region_code || '66',
          district: clientAddr.district || 'м.о. Верхнесалдинский',
          city: clientAddr.city || 'Верхняя Салда',
          street: clientAddr.street || 'ул. Парковая',
          house: clientAddr.house || 'д 1',
        },
        contractName: order.client?.default_contract_name || 'договор',
        contractNumber: order.client?.default_contract_number || '10676',
        contractDate: order.client?.default_contract_date || '2012-08-01',
      },

      forwarder: {
        name: order.forwarder?.name || 'ИП Парфенов Андрей Виталиевич',
        inn: order.forwarder?.inn || '660700184414',
        edoId:
          order.forwarder?.edo_participant_id || '2BM-660700184414--2016060605481636716910000000',
        phone: order.forwarder?.contact_phone || '+79630501501',
      },

      consignee: {
        name: order.consignee?.name || order.client?.name || 'ПАО «Корпорация ВСМПО-АВИСМА»',
        inn: order.consignee?.inn || order.client?.inn || '6607000556',
        kpp: order.consignee?.kpp || order.client?.kpp || '997550001',
        phone: order.consignee?.contact_phone || '6-44-26',
        address: {
          index: clientAddr.index || '624760',
          regionCode: clientAddr.region_code || '66',
          district: clientAddr.district || 'м.о. Верхнесалдинский',
          city: clientAddr.city || 'Верхняя Салда',
          street: clientAddr.street || 'ул. Парковая',
          house: clientAddr.house || 'д 1',
        },
      },

      loadingPoint: {
        orgName: order.loading_org_name || order.loading_point?.name || 'ООО "Континенталь"',
        orgInn: order.loading_org_inn || order.loading_point?.inn || '6609002301',
        orgKpp: order.loading_org_kpp || order.loading_point?.kpp || '668301001',
        phone: order.loading_contact_phone || order.loading_point?.contact_phone || '+73432435353',
        contactFio:
          order.loading_contact_fio ||
          order.loading_point?.contact_fio ||
          'Гончарова Марина Владимировна',
        contactPosition: order.loading_contact_position || 'Представитель',
        address: {
          index: lpAddr.index || '624250',
          regionCode: lpAddr.region_code || '66',
          city: lpAddr.city || 'Заречный',
          street: lpAddr.street || 'ул. Промзона БЗСК',
          house: lpAddr.house || 'строение 2',
        },
      },

      cargo: {
        name: order.cargo_name || 'Металлопрокат',
        condition: order.cargo_condition || 'без повреждений',
        packagingType: order.packaging_type || 'палетты',
        packageCode: order.package_code || '00',
        placesCount: order.places_count || 1,
        weightGrossKg: order.weight_gross_kg || 110,
      },

      driver: {
        fio: driverFio,
        inn: order.driver?.inn || '660704282934',
        phone: order.driver?.phone || '+79221672787',
        licenseSeries: order.driver?.license_series || '9945',
        licenseNumber: order.driver?.license_number || '273350',
        licenseIssueDate: order.driver?.license_issue_date || '2026-09-09',
      },

      vehicle: {
        regNumber: order.vehicle?.reg_number || 'О188ТА196',
        brandName: order.vehicle?.brand_name || order.vehicle?.short_name || 'Валдай',
        bodyType: order.vehicle?.body_type_name || 'Грузовой автомобиль',
        payloadTons: order.vehicle?.payload_tons || 3.1,
        capacityM3: order.vehicle?.capacity_m3 || 40,
        ownershipType: order.vehicle?.ownership_type || 1,
      },

      times: {
        plannedLoading: order.planned_loading_at,
        actualLoadingArrival: order.actual_loading_arrival_at,
        actualLoadingDeparture: order.actual_loading_departure_at,
      },

      signer: {
        fio: emchdSigner.fio || {
          lastName: 'Симанова',
          firstName: 'Олеся',
          middleName: 'Витальевна',
        },
        position: emchdSigner.position || 'Сотрудник',
        emchdNumber:
          emchdSigner.power_of_attorney?.number || '532497b2-e630-4925-b6dd-947e6d26534a',
        emchdDate: emchdSigner.power_of_attorney?.date || '2026-09-01',
        emchdStorageUrl:
          emchdSigner.storage_system_id || emchdSigner.power_of_attorney?.storage_url,
      },
    });

    return new Response(new Uint8Array(etrn.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=windows-1251',
        'Content-Disposition': `attachment; filename="${etrn.fileName}"`,
      },
    });
  } catch (err: any) {
    console.error('Ошибка генерации ЭТрН XML:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
