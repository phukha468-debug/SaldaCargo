/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type AtiOrder = {
  id: string;
  order_number: string;
  order_date: string;
  stage: number; // 1..8
  doc_type: 'etrn' | 'paper';
  // Контрагент
  counterparty_id?: string | null;
  counterparty_name: string;
  counterparty_inn?: string;
  counterparty_contact?: string;
  counterparty_phone?: string;
  counterparty_email?: string;
  ati_code?: string;
  // Перевозчик
  carrier_name: string;
  carrier_inn: string;
  carrier_contact: string;
  carrier_account: string;
  carrier_bank: string;
  carrier_bik: string;
  // Транспорт и водитель
  asset_name: string;
  asset_reg_number: string;
  driver_name: string;
  driver_phone: string;
  driver_passport: string;
  driver_license: string;
  // Погрузка (2.3)
  shipper_name: string;
  pickup_address: string;
  pickup_date_time: string;
  pickup_contact: string;
  cargo_description: string;
  // Выгрузка (2.4)
  consignee_name: string;
  delivery_address: string;
  delivery_date: string;
  delivery_contact: string;
  // Финансы и оплата (2.5)
  price: number;
  payment_terms: string;
  postal_address?: string;
  postal_tracking_number?: string;
  // Отмена и срыв
  is_cancelled?: boolean;
  cancel_reason?: string;
  cancelled_at?: string;
  // Претензионная работа
  has_claim?: boolean;
  claim_status?: 'none' | 'issued' | 'agreed' | 'waiting_payment' | 'paid' | 'rejected';
  claim_number?: string;
  claim_date?: string;
  claim_amount?: number;
  claim_penalty_amount?: number;
  claim_empty_run_amount?: number;
  claim_idle_amount?: number;
  claim_due_days?: number;
  claim_due_date?: string;
  claim_agreed_at?: string;
  claim_paid_at?: string;
  claim_notes?: string;
  // Дополнительно
  notes?: string;
  created_at: string;
  updated_at: string;
};

// Начальная предзаполненная заявка № 001 на основе реального документа
const SEED_ORDER_001: Omit<AtiOrder, 'id'> = {
  order_number: '№ 001 от 14.10.2026',
  order_date: '2026-10-14',
  stage: 1,
  doc_type: 'etrn',
  counterparty_name: 'ООО «ТРАНССЕРВИС»',
  counterparty_inn: '6679091866',
  counterparty_contact: 'Радик, (343)286-73-65 (доб.447)',
  counterparty_phone: '+7-952-147-6114',
  counterparty_email: 'bautdinov@tr-tech.ru',
  ati_code: 'АТИ 923131',
  carrier_name: 'ИП НИГАМЕДЬЯНОВ АЛЕКСАНДР СЕРГЕЕВИЧ',
  carrier_inn: '660704814106',
  carrier_contact: '7 922 180-09-11 Александр',
  carrier_account: '40802810500001961654',
  carrier_bank: 'АО «ТБанк»',
  carrier_bik: '044525974',
  asset_name: 'Валдай 4 тонник тент',
  asset_reg_number: 'О188ТА 196',
  driver_name: 'Насртдинов Вячеслав Аксанович',
  driver_phone: '+79956610685',
  driver_passport: '6521 342609 Выдан ГУ МВД по Свердловской обл. 27.07.2021',
  driver_license: 'ВУ 9931 051064 от 12.01.2024',
  shipper_name: 'ООО Совместное предприятие Торговый Дом «МАГЕЛЛАН»',
  pickup_address: 'Свердловская обл., г. Арамиль, переулок Речной д. 2А/1',
  pickup_date_time: '15.10.2026 г. 09:00',
  pickup_contact: 'Склад 89992853010',
  cargo_description: 'Подоконники, 4т, габариты 6*2*1 (5 поддонов), боковая погрузка, ремни',
  consignee_name: 'Створ ООО (Уфа)',
  delivery_address: 'г. Уфа, ул. Губкина, 10/1',
  delivery_date: '16.10.2026',
  delivery_contact: '8-919-151-77-80 Эльмира',
  price: 30000,
  payment_terms: '10 б.д. по ЭТрН и бухгалтерские документы',
  postal_address:
    '620000 Свердловская обл., г. Екатеринбург, Ленина пр-кт, стр.39, а/я 494 на имя ООО «Транссервис»',
  notes: 'В течение 3 дней выслать копии бух. документов. Оригиналы в течение 30 дней.',
  created_at: new Date('2026-10-14T09:00:00.000Z').toISOString(),
  updated_at: new Date().toISOString(),
};

let atiCache: { data: any; timestamp: number } | null = null;
const ATI_CACHE_TTL = 15000; // 15 секунд

export function invalidateAtiCache() {
  atiCache = null;
}

export async function GET(request?: Request) {
  try {
    const url = request ? new URL(request.url) : null;
    const forceRefresh = url?.searchParams.get('force') === '1';

    if (!forceRefresh && atiCache && Date.now() - atiCache.timestamp < ATI_CACHE_TTL) {
      return NextResponse.json(atiCache.data, {
        headers: {
          'Cache-Control': 'public, max-age=10, stale-while-revalidate=20',
          'X-Cache': 'HIT',
        },
      });
    }

    const supabase = createAdminClient();

    // 1. Получаем заявки АТИ из audit_log
    const { data: rawOrders, error } = await (supabase.from('audit_log') as any)
      .select('id, new_values, changed_at')
      .eq('table_name', 'ati_orders')
      .order('changed_at', { ascending: false });

    if (error) {
      console.error('Error fetching ati_orders from audit_log:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let orders: AtiOrder[] = (rawOrders || []).map((row: any) => ({
      id: row.id,
      ...row.new_values,
    }));

    // Если база пуста — создаем сид заявки № 001
    if (orders.length === 0) {
      // Проверим, есть ли в counterparties ООО «ТРАНССЕРВИС»
      const { data: existingCp } = await (supabase.from('counterparties') as any)
        .select('id')
        .ilike('name', '%ТРАНССЕРВИС%')
        .limit(1);

      let cpId = existingCp?.[0]?.id;
      if (!cpId) {
        // Создадим контрагента
        const { data: newCp } = await (supabase.from('counterparties') as any)
          .insert({
            name: 'ООО «ТРАНССЕРВИС»',
            phone: '+79521476114',
            email: 'bautdinov@tr-tech.ru',
            is_legal_entity: true,
            is_active: true,
            type: 'client',
            notes: 'Заказчик АТИ 923131, ИНН 6679091866',
          })
          .select('id')
          .single();
        cpId = newCp?.id;
      }

      const orderWithCp = {
        ...SEED_ORDER_001,
        counterparty_id: cpId || null,
      };

      const { data: inserted, error: insertErr } = await (supabase.from('audit_log') as any)
        .insert({
          table_name: 'ati_orders',
          record_id: '00000000-0000-0000-0000-000000000001',
          action: 'insert',
          new_values: orderWithCp,
        })
        .select('id, new_values')
        .single();

      if (!insertErr && inserted) {
        orders = [{ id: inserted.id, ...inserted.new_values }];
      }
    }

    // 2. Получаем список контрагентов для выпадающего списка
    const { data: counterparties } = await (supabase.from('counterparties') as any)
      .select('id, name, phone, email, is_legal_entity')
      .eq('is_active', true)
      .order('name');

    // 3. Получаем список автомобилей
    const { data: assets } = await (supabase.from('assets') as any)
      .select('id, name, short_name, reg_number')
      .eq('is_active', true)
      .order('name');

    // 4. Получаем список водителей
    const { data: drivers } = await (supabase.from('users') as any)
      .select('id, name, phone')
      .eq('role', 'driver')
      .eq('is_active', true)
      .order('name');

    const result = {
      success: true,
      orders,
      counterparties: counterparties || [],
      assets: assets || [],
      drivers: drivers || [],
    };

    atiCache = { data: result, timestamp: Date.now() };

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=10, stale-while-revalidate=20',
        'X-Cache': 'MISS',
      },
    });
  } catch (err: any) {
    console.error('Fatal GET /api/ati error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    invalidateAtiCache();
    const supabase = createAdminClient();
    const body = await request.json();

    let counterpartyId = body.counterparty_id;

    // Если менеджер нажал "+ Создать нового контрагента"
    if (body.create_counterparty && body.counterparty_name) {
      const { data: newCp, error: cpErr } = await (supabase.from('counterparties') as any)
        .insert({
          name: body.counterparty_name.trim(),
          phone: body.counterparty_phone?.trim() || null,
          email: body.counterparty_email?.trim() || null,
          is_legal_entity: true,
          is_active: true,
          type: 'client',
          client_role: 'forwarder',
          inn: body.counterparty_inn?.trim() || null,
          contact_person: body.counterparty_contact?.trim() || null,
          ati_code: body.ati_code?.trim() || null,
          legal_address: body.postal_address?.trim() || null,
          notes: body.notes?.trim() || null,
        })
        .select('id')
        .single();

      if (!cpErr && newCp) {
        counterpartyId = newCp.id;
      }
    } else if (counterpartyId) {
      // Авто-обогащение существующего контрагента реквизитами из заявки
      const cpUpdate: Record<string, any> = {};
      if (body.counterparty_inn) cpUpdate.inn = body.counterparty_inn.trim();
      if (body.counterparty_contact) cpUpdate.contact_person = body.counterparty_contact.trim();
      if (body.ati_code) cpUpdate.ati_code = body.ati_code.trim();
      if (body.counterparty_phone) cpUpdate.phone = body.counterparty_phone.trim();
      if (body.counterparty_email) cpUpdate.email = body.counterparty_email.trim();
      if (body.postal_address) cpUpdate.legal_address = body.postal_address.trim();
      if (Object.keys(cpUpdate).length > 0) {
        await (supabase.from('counterparties') as any).update(cpUpdate).eq('id', counterpartyId);
      }
    }

    const orderData: Omit<AtiOrder, 'id'> = {
      order_number: body.order_number || `№ АТИ-${Date.now().toString().slice(-4)}`,
      order_date: body.order_date || new Date().toISOString().split('T')[0],
      stage: 1, // Старт: "1. Договор на почте"
      doc_type: body.doc_type === 'paper' ? 'paper' : 'etrn',
      counterparty_id: counterpartyId || null,
      counterparty_name: body.counterparty_name || 'ООО Заказчик',
      counterparty_inn: body.counterparty_inn || '',
      counterparty_contact: body.counterparty_contact || '',
      counterparty_phone: body.counterparty_phone || '',
      counterparty_email: body.counterparty_email || '',
      ati_code: body.ati_code || '',
      carrier_name: body.carrier_name || 'ИП НИГАМЕДЬЯНОВ АЛЕКСАНДР СЕРГЕЕВИЧ',
      carrier_inn: body.carrier_inn || '660704814106',
      carrier_contact: body.carrier_contact || '7 922 180-09-11 Александр',
      carrier_account: body.carrier_account || '40802810500001961654',
      carrier_bank: body.carrier_bank || 'АО «ТБанк»',
      carrier_bik: body.carrier_bik || '044525974',
      asset_name: body.asset_name || 'Валдай О188ТА 196',
      asset_reg_number: body.asset_reg_number || 'О188ТА 196',
      driver_name: body.driver_name || 'Водитель',
      driver_phone: body.driver_phone || '',
      driver_passport: body.driver_passport || '',
      driver_license: body.driver_license || '',
      shipper_name: body.shipper_name || '',
      pickup_address: body.pickup_address || '',
      pickup_date_time: body.pickup_date_time || '',
      pickup_contact: body.pickup_contact || '',
      cargo_description: body.cargo_description || '',
      consignee_name: body.consignee_name || '',
      delivery_address: body.delivery_address || '',
      delivery_date: body.delivery_date || '',
      delivery_contact: body.delivery_contact || '',
      price: Number(body.price || 0),
      payment_terms: body.payment_terms || '10 б.д. по оригиналам / ЭТрН',
      postal_address: body.postal_address || '',
      postal_tracking_number: body.postal_tracking_number || '',
      notes: body.notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await (supabase.from('audit_log') as any)
      .insert({
        table_name: 'ati_orders',
        record_id: '00000000-0000-0000-0000-000000000000',
        action: 'insert',
        new_values: orderData,
      })
      .select('id, new_values')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      order: {
        id: inserted.id,
        ...inserted.new_values,
      },
    });
  } catch (err: any) {
    console.error('Fatal POST /api/ati error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
