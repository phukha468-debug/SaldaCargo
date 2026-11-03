/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateWaybill4cHtml } from '@saldacargo/domain-service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: order, error } = await (supabase.from('orders') as any)
      .select(
        `
        *,
        client:counterparties!orders_client_id_fkey(*),
        vehicle:assets(*),
        driver:users!orders_assigned_driver_id_fkey(*),
        loading_point:loading_points_directory(*),
        trip:trips(*)
      `,
      )
      .eq('id', id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
    }

    const trip = order.trip;
    let phase: 'planned' | 'departed' | 'completed' = 'planned';
    if (order.status === 'in_progress') phase = 'departed';
    else if (
      order.status === 'pending_review' ||
      order.status === 'completed' ||
      trip?.status === 'completed'
    )
      phase = 'completed';

    const odoStart = trip?.odometer_start || order.vehicle?.odometer_current || 120500;
    const odoEnd = trip?.odometer_end || (phase === 'completed' ? odoStart + 350 : undefined);

    const html = generateWaybill4cHtml({
      series: '9937',
      number: order.waybill_number?.replace('ПЛ-', '') || String(order.order_number),
      date: order.base_doc_date || order.created_at.slice(0, 10),
      organization: {
        name: 'ИП Нигамедьянов Александр Сергеевич',
        inn: '660704814106',
        ogrnip: '321665800053976',
        address: '624760, Свердловская область, г. Верхняя Салда, ул. 25 Октября, д. 11, кв. 22',
        phone: '+79222970911',
      },
      vehicle: {
        brand: order.vehicle?.brand_name || order.vehicle?.short_name || 'Валдай',
        regNumber: order.vehicle?.reg_number || 'О188ТА196',
        garageNumber: order.vehicle?.garage_number || '096',
        fuelType: order.vehicle?.fuel_type || 'ДТ',
        fuelNorm: order.vehicle?.fuel_norm_liters || 150,
      },
      driver: {
        fio: order.driver?.name || 'Никифоров Д.В.',
        tabNumber: order.driver?.tab_number || '096',
        licenseSeries: order.driver?.license_series || '9945',
        licenseNumber: order.driver?.license_number || '273350',
        licenseClass: order.driver?.license_class || 'C, E',
      },
      assignment: {
        clientName: order.client?.name || 'ПАО «Корпорация ВСМПО-АВИСМА»',
        loadingAddress: order.loading_address_json?.raw || 'г. Заречный, ул. Промзона БЗСК, д 2',
        unloadingAddress:
          order.unloading_address_json?.raw || 'г. Верхняя Салда, ул. Парковая, д 1',
        cargoName: order.cargo_name || 'Металлопрокат',
        weightTons: (order.weight_gross_kg || 110) / 1000,
        tripsCount: 1,
        distanceKm: odoEnd && odoStart ? odoEnd - odoStart : undefined,
      },
      execution: {
        phase,
        odometerStart: odoStart,
        odometerEnd: odoEnd,
        actualDeparture:
          trip?.started_at || order.actual_loading_arrival_at || '2026-10-30T08:00:00+05:00',
        actualArrival:
          trip?.ended_at || order.actual_loading_departure_at || '2026-10-30T17:45:00+05:00',
        fuelStartLiters: 150,
        fuelGivenLiters: 150,
        fuelEndLiters: 15,
      },
      dispatchAndControl: {
        dispatcherFio: 'Шахмаев А.О.',
        mechanicFio: 'Шахмаев А.О.',
      },
    });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (err: any) {
    console.error('Ошибка генерации Путевого листа:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
