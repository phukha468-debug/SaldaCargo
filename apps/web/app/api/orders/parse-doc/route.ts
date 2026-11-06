/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parsePdfBuffer, parseForwarderOrderText } from '@saldacargo/domain-service';

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let parsedData: any = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'Файл не найден в запросе' }, { status: 400 });
      }
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      parsedData = await parsePdfBuffer(buffer);
    } else {
      const json = await req.json();
      if (!json.text) {
        return NextResponse.json({ error: 'Поле text обязательно' }, { status: 400 });
      }
      parsedData = parseForwarderOrderText(json.text);
    }

    const supabase = createAdminClient();

    // 1. Поиск контрагентов по ИНН в базе counterparties
    if (parsedData.client_inn) {
      const { data: clientCp } = await (supabase.from('counterparties') as any)
        .select('*')
        .eq('inn', parsedData.client_inn)
        .limit(1)
        .maybeSingle();
      if (clientCp) {
        parsedData.matched_client_id = clientCp.id;
        parsedData.matched_shipper_id = clientCp.id;
        parsedData.matched_consignee_id = clientCp.id;
        parsedData.client_name = clientCp.name;
        if (!parsedData.client_kpp && clientCp.kpp) parsedData.client_kpp = clientCp.kpp;
      }
    }

    if (parsedData.forwarder_inn) {
      const { data: forwarderCp } = await (supabase.from('counterparties') as any)
        .select('*')
        .eq('inn', parsedData.forwarder_inn)
        .limit(1)
        .maybeSingle();
      if (forwarderCp) {
        parsedData.matched_forwarder_id = forwarderCp.id;
        parsedData.forwarder_name = forwarderCp.name;
      }
    }

    // 2. Поиск точки погрузки по ИНН или ГАР GUID
    const { data: loadingPoints } = await (supabase.from('loading_points_directory') as any).select(
      '*',
    );
    if (loadingPoints && loadingPoints.length > 0) {
      const foundLp = loadingPoints.find((lp: any) => {
        if (
          parsedData.loading_address?.gar_guid &&
          lp.gar_guid === parsedData.loading_address.gar_guid
        )
          return true;
        if (parsedData.loading_org_inn && lp.inn === parsedData.loading_org_inn) return true;
        if (
          parsedData.loading_org_name &&
          lp.name?.toLowerCase().includes(parsedData.loading_org_name.toLowerCase())
        )
          return true;
        return false;
      });
      if (foundLp) {
        parsedData.matched_loading_point_id = foundLp.id;
        if (!parsedData.loading_org_name) parsedData.loading_org_name = foundLp.name;
        if (!parsedData.loading_org_inn) parsedData.loading_org_inn = foundLp.inn;
        parsedData.loading_org_kpp = foundLp.kpp;
        parsedData.loading_contact_fio = foundLp.contact_fio;
        parsedData.loading_contact_phone = foundLp.contact_phone;
      }
    }

    // 3. Поиск пресета, связывающего данного клиента и экспедитора
    if (parsedData.matched_client_id && parsedData.matched_forwarder_id) {
      const { data: preset } = await (supabase.from('order_presets') as any)
        .select('*')
        .eq('client_counterparty_id', parsedData.matched_client_id)
        .eq('forwarder_counterparty_id', parsedData.matched_forwarder_id)
        .limit(1)
        .maybeSingle();
      if (preset) {
        parsedData.matched_preset_id = preset.id;
      }
    }

    return NextResponse.json({
      success: true,
      parsed: parsedData,
    });
  } catch (err: any) {
    console.error('Ошибка parse-doc:', err);
    return NextResponse.json({ error: err.message || 'Ошибка парсинга файла' }, { status: 500 });
  }
}
