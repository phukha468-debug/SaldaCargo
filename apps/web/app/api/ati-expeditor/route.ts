/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type ExpeditorDocument = {
  id: string;
  category: 'client' | 'carrier' | 'vehicle' | 'finance';
  name: string;
  url?: string;
  created_at: string;
  notes?: string;
};

export type ExpeditorOrder = {
  id: string;
  order_number: string;
  order_date: string;
  stage: number; // 1..6
  doc_type: 'etrn' | 'paper';

  // Тип заказчика: физлицо или юрлицо
  client_type: 'individual' | 'legal';

  // Заказчик (кто платит нам)
  client_id?: string | null;
  client_name: string;
  client_inn?: string;
  client_passport?: string; // для физлиц (полная строка)
  client_passport_series?: string; // серия паспорта
  client_passport_number?: string; // номер паспорта
  client_passport_issued_by?: string; // кем выдан
  client_passport_issued_date?: string; // дата выдачи
  client_passport_code?: string; // код подразделения
  client_reg_address?: string; // адрес регистрации
  client_contact?: string;
  client_phone?: string;
  client_email?: string;
  client_ati_code?: string;
  passenger_in_cabin?: boolean; // Пассажирское место в кабине закреплено за Заказчиком

  // Перевозчик (кому платим мы) — внешний
  carrier_id?: string | null;
  carrier_name: string;
  carrier_inn?: string;
  carrier_ogrnip?: string;
  carrier_passport?: string;
  carrier_reg_address?: string;
  carrier_contact?: string;
  carrier_phone?: string;
  carrier_email?: string;
  carrier_ati_code?: string;
  carrier_account?: string;
  carrier_bank?: string;
  carrier_bik?: string;
  carrier_corr_account?: string;

  // Транспорт и водитель перевозчика
  carrier_vehicle?: string;
  carrier_reg_number?: string;
  carrier_vin?: string;
  carrier_driver_name?: string;
  carrier_driver_phone?: string;
  carrier_driver_license?: string;

  // Маршрут и погрузка
  pickup_route_title?: string;
  pickup_address: string;
  pickup_points?: string[]; // Несколько точек погрузки
  pickup_date_time: string;
  pickup_contact: string;
  cargo_description: string;
  loading_conditions?: string; // Условия ПРР: напр. помощь водителя

  // Выгрузка
  delivery_route_title?: string;
  delivery_address: string;
  delivery_points?: string[]; // Несколько точек выгрузки
  delivery_date: string;
  delivery_contact: string;

  // Финансы
  total_client_price: number; // Общая стоимость для Заказчика (напр. 100 000 ₽)
  carrier_freight_price: number; // Общая ставка перевозчика (напр. 70 000 ₽)

  // Задаток (предоплата при заключении договора)
  deposit_amount?: number; // Задаток (напр. 5 000 ₽)
  deposit_paid?: boolean; // Отметка внесения задатка
  deposit_paid_at?: string;
  deposit_terms?: string;

  // Поэтапная оплата (как в договоре физлица)
  payment_scheme: 'two_stage' | 'full_prepay' | 'full_postpay';
  stage1_amount?: number; // 1 этап: аванс (напр. 20 000 ₽)
  stage1_terms?: string; // "наличными экспедитору сразу после погрузки"
  stage1_paid?: boolean;
  stage1_paid_at?: string;

  stage2_amount?: number; // 2 этап: остаток (напр. 50 000 ₽)
  stage2_terms?: string; // "оплачивается Заказчиком водителю на конечной выгрузке"
  stage2_paid?: boolean;
  stage2_paid_at?: string;

  // Штрафные санкции (из договора)
  penalty_delay_hourly?: number; // 1 000 ₽/час опоздания
  penalty_cancellation?: number; // 24 000 ₽ за срыв более 24 часов
  non_disclosure_penalty?: number; // 200 000 ₽ за прямой контакт с клиентом

  // Документы и файлы по папкам
  documents?: ExpeditorDocument[];

  // Статусы этапов
  docs_signed?: boolean;
  loaded_confirmed?: boolean;
  delivered_confirmed?: boolean;

  // Отмена
  is_cancelled?: boolean;
  cancel_reason?: string;
  cancelled_at?: string;

  notes?: string;
  created_at: string;
  updated_at: string;
};

// Сидовая заявка № 1 (в точности по загруженному вами фото договора с Вельбой В.М.)
const SEED_EXPEDITOR_ORDER_001: Omit<ExpeditorOrder, 'id'> = {
  order_number: '№ 1 от 22.10.2026',
  order_date: '2026-10-22',
  stage: 2, // Оформление / подготовка к погрузке 30.10.2026
  doc_type: 'paper',
  client_type: 'individual',
  client_name: 'Вельбой Василий Михайлович',
  client_phone: '+7 961 226-94-95',
  client_passport_series: '6500',
  client_passport_number: '794763',
  client_passport_issued_by: 'ОВД г.Верхняя Салда, по Свердловской области',
  client_passport_issued_date: '13.07.2001г.',
  client_passport_code: '662020',
  client_reg_address: 'Свердловская обл., г. Верхняя Салда, ул. Энгельса, д. 85, корп. 2, кв. 135',
  client_passport:
    'Паспорт РФ: серия 6500 № 794763, выдан ОВД г.Верхняя Салда, по Свердловской области 13.07.2001г., код подр. 662020. Зарег.: г. Верхняя Салда, ул. Энгельса, д. 85, корп. 2, кв. 135',
  passenger_in_cabin: true, // В кабине совместно с водителем следует Заказчик

  carrier_name: 'ИП Салихов Руслан Маснавиевич',
  carrier_inn: '741701150716',
  carrier_ogrnip: '314745717500013',
  carrier_passport:
    'серия 75 25 № 412915, выдан 18.07.2025 г. ГУ МВД России по Челябинской обл., код 740-031',
  carrier_reg_address: '456920, Челябинская обл., Саткинский р-н, рп. Сулея, ул. Лермонтова, д. 91',
  carrier_bank: 'АО «ТБанк»',
  carrier_account: '40802810400004121397',
  carrier_bik: '044525974',
  carrier_corr_account: '30101810145250000974',
  carrier_phone: '+7 (982) 360-02-56',
  carrier_email: 'ruslansalichov65@yandex.ru',

  carrier_vehicle: 'ГАЗ 2824DH (бортовой тентованный)',
  carrier_reg_number: 'В 003 ХС 174',
  carrier_vin: 'XU42824DHJ0003324',
  carrier_driver_name: 'Салихов Руслан Маснавиевич',
  carrier_driver_phone: '+7 (982) 360-02-56',
  carrier_driver_license: 'В/у: 74 32 432701 (кат. A, A1, B, B1, C, C1, M)',

  pickup_route_title: 'Свердловская обл., г. Верхняя Салда',
  pickup_address: 'г. Верхняя Салда (2 адреса погрузки)',
  pickup_points: ['г. Верхняя Салда, Адрес 1', 'г. Верхняя Салда, Адрес 2'],
  pickup_date_time: '30.10.2026 г. ровно к 08:00',
  pickup_contact: '+7 961 226-94-95 / Вельбой В.М.',
  cargo_description:
    'Личные (домашние) вещи физического лица, бытовой инвентарь. Способ: исключительно задняя погрузка, без растентовки кузова.',
  loading_conditions:
    'Погрузка в г. Верхняя Салда осуществляется Заказчиком. Перевозчик (водитель) обязан оказать помощь при разгрузке на обеих точках в р.п. Кольцово.',

  delivery_route_title: 'Новосибирская обл., р.п. Кольцово',
  delivery_address: 'Новосибирская обл., р.п. Кольцово (2 адреса разгрузки)',
  delivery_points: [
    'Новосибирская обл., р.п. Кольцово, Адрес 1',
    'Новосибирская обл., р.п. Кольцово, Адрес 2',
  ],
  delivery_date: '02.11.2026',
  delivery_contact: 'Заказчик в кабине (Вельбой В.М.) / +7 961 226-94-95',

  total_client_price: 100000,
  carrier_freight_price: 70000,

  deposit_amount: 5000,
  deposit_paid: true,
  deposit_paid_at: '2026-10-22T11:00:00.000Z',
  deposit_terms: 'Задаток при заключении договора (оплачен Заказчиком Экспедитору)',

  payment_scheme: 'two_stage',
  stage1_amount: 20000,
  stage1_terms:
    'Выплачивается Экспедитором наличными сразу после завершения погрузки на обеих точках непосредственно перед отправлением.',
  stage1_paid: false,

  stage2_amount: 50000,
  stage2_terms:
    'Оплачивается Заказчиком (физлицом) наличными средствами Перевозчику на второй (конечной) точке разгрузки.',
  stage2_paid: false,

  penalty_delay_hourly: 1000,
  penalty_cancellation: 24000,
  non_disclosure_penalty: 200000,

  documents: [
    {
      id: 'doc-1',
      category: 'carrier',
      name: 'Договор-Заявка № 1 с ИП Салихов (подписана со штампом)',
      created_at: '2026-10-22T07:15:00.000Z',
    },
    {
      id: 'doc-2',
      category: 'carrier',
      name: 'Договор-Оферта на организацию перевозок грузов (ред. 22.10.2026)',
      created_at: '2026-10-22T07:15:00.000Z',
    },
    {
      id: 'doc-3',
      category: 'vehicle',
      name: 'Водительское удостоверение 74 32 432701 (Салихов Р.М.)',
      created_at: '2026-10-22T07:20:00.000Z',
    },
    {
      id: 'doc-4',
      category: 'finance',
      name: 'Расписка / Фиксация выплаты аванса 20 000 ₽ на погрузке',
      created_at: '2026-10-22T07:25:00.000Z',
    },
  ],

  notes:
    'Юридическая фиксация инцидентов и согласование через мессенджер MAX. Защита коммерческих интересов: запрет прямого контакта 24 месяца.',
  created_at: '2026-10-22T07:00:00.000Z',
  updated_at: '2026-10-22T07:30:00.000Z',
};

let expCache: { data: any; timestamp: number } | null = null;
const EXP_CACHE_TTL = 15000;

export const STORAGE_LIMITS = {
  MAX_ORDERS: 500,
  PURGE_THRESHOLD: 450,
  PURGE_BATCH: 150,
};

export function invalidateExpCache() {
  expCache = null;
}

/**
 * Авто-ротация: удаление первых 150 старых закрытых/отмененных заявок при достижении 450
 */
async function autoPurgeOldOrdersIfExceeded(supabase: any) {
  try {
    const { data: rows, error: countErr } = await supabase
      .from('audit_log')
      .select('id, new_values, changed_at')
      .eq('table_name', 'ati_expeditor_orders')
      .order('changed_at', { ascending: true });

    if (countErr || !rows || rows.length < STORAGE_LIMITS.PURGE_THRESHOLD) {
      return 0;
    }

    // Ищем старые завершенные (stage === 6) или отмененные (is_cancelled === true)
    const candidatesForPurge = rows.filter((r: any) => {
      const v = r.new_values || {};
      return v.stage === 6 || v.is_cancelled === true;
    });

    const toDeleteIds = candidatesForPurge
      .slice(0, STORAGE_LIMITS.PURGE_BATCH)
      .map((r: any) => r.id);

    if (toDeleteIds.length > 0) {
      await supabase
        .from('audit_log')
        .delete()
        .in('id', toDeleteIds)
        .eq('table_name', 'ati_expeditor_orders');

      invalidateExpCache();
      return toDeleteIds.length;
    }
  } catch (err) {
    console.error('Error during autoPurgeOldOrdersIfExceeded:', err);
  }
  return 0;
}

export async function GET(request?: Request) {
  try {
    const url = request ? new URL(request.url) : null;
    const forceRefresh = url?.searchParams.get('force') === '1';

    if (!forceRefresh && expCache && Date.now() - expCache.timestamp < EXP_CACHE_TTL) {
      return NextResponse.json(expCache.data);
    }

    const supabase = createAdminClient();

    const [ordersRes, counterpartiesRes] = await Promise.all([
      (supabase.from('audit_log') as any)
        .select('id, new_values, changed_at')
        .eq('table_name', 'ati_expeditor_orders')
        .order('changed_at', { ascending: false }),

      (supabase.from('counterparties') as any)
        .select('id, name, phone, email, is_legal_entity, inn, ati_code, contact_person')
        .eq('is_active', true)
        .order('name'),
    ]);

    const { data: rawOrders, error } = ordersRes;
    const { data: counterparties } = counterpartiesRes;

    if (error) {
      console.error('Error fetching expeditor orders:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let orders: ExpeditorOrder[] = (rawOrders || []).map((row: any) => {
      const v = row.new_values || {};
      return {
        id: row.id,
        ...v,
        stage: Number(v.stage ?? 1),
      };
    });

    // Если список пуст — создаем начальную заявку № 1 (ИП Салихов)
    if (orders.length === 0) {
      const { data: inserted, error: insertErr } = await (supabase.from('audit_log') as any)
        .insert({
          table_name: 'ati_expeditor_orders',
          record_id: '00000000-0000-0000-0000-000000000002',
          action: 'insert',
          new_values: SEED_EXPEDITOR_ORDER_001,
        })
        .select('id, new_values')
        .single();

      if (!insertErr && inserted) {
        orders = [{ id: inserted.id, ...inserted.new_values }];
      }
    }

    const result = {
      success: true,
      orders,
      counterparties: counterparties || [],
      storage_stats: {
        total_orders: orders.length,
        max_orders: STORAGE_LIMITS.MAX_ORDERS,
        purge_threshold: STORAGE_LIMITS.PURGE_THRESHOLD,
        purge_batch: STORAGE_LIMITS.PURGE_BATCH,
        is_near_limit: orders.length >= STORAGE_LIMITS.PURGE_THRESHOLD,
      },
    };

    expCache = { data: result, timestamp: Date.now() };

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Fatal GET /api/ati-expeditor error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    invalidateExpCache();
    const supabase = createAdminClient();

    // Авто-ротация: если накопилось 450+ заявок, автоматически очищаем 150 старых закрытых
    await autoPurgeOldOrdersIfExceeded(supabase);

    const body = await request.json();

    const orderData: Omit<ExpeditorOrder, 'id'> = {
      order_number:
        body.order_number ||
        `№ ${Date.now().toString().slice(-3)} от ${new Date().toLocaleDateString('ru-RU')}`,
      order_date: body.order_date || new Date().toISOString().split('T')[0],
      stage: 1, // 1. Поиск / Оформление
      doc_type: body.doc_type || 'paper',
      client_type: body.client_type || 'individual',

      client_id: body.client_id || null,
      client_name: body.client_name || 'Заказчик',
      client_inn: body.client_inn || '',
      client_passport: body.client_passport || '',
      client_passport_series: body.client_passport_series || '',
      client_passport_number: body.client_passport_number || '',
      client_passport_issued_by: body.client_passport_issued_by || '',
      client_passport_issued_date: body.client_passport_issued_date || '',
      client_passport_code: body.client_passport_code || '',
      client_reg_address: body.client_reg_address || '',
      client_contact: body.client_contact || '',
      client_phone: body.client_phone || '',
      client_email: body.client_email || '',
      client_ati_code: body.client_ati_code || '',
      passenger_in_cabin: Boolean(body.passenger_in_cabin),

      carrier_name: body.carrier_name || '',
      carrier_inn: body.carrier_inn || '',
      carrier_ogrnip: body.carrier_ogrnip || '',
      carrier_passport: body.carrier_passport || '',
      carrier_reg_address: body.carrier_reg_address || '',
      carrier_contact: body.carrier_contact || '',
      carrier_phone: body.carrier_phone || '',
      carrier_email: body.carrier_email || '',
      carrier_ati_code: body.carrier_ati_code || '',
      carrier_account: body.carrier_account || '',
      carrier_bank: body.carrier_bank || 'АО «ТБанк»',
      carrier_bik: body.carrier_bik || '044525974',
      carrier_corr_account: body.carrier_corr_account || '30101810145250000974',

      carrier_vehicle: body.carrier_vehicle || '',
      carrier_reg_number: body.carrier_reg_number || '',
      carrier_vin: body.carrier_vin || '',
      carrier_driver_name: body.carrier_driver_name || '',
      carrier_driver_phone: body.carrier_driver_phone || '',
      carrier_driver_license: body.carrier_driver_license || '',

      pickup_route_title: body.pickup_route_title || body.pickup_address || '',
      pickup_address: body.pickup_address || '',
      pickup_points: body.pickup_points || [],
      pickup_date_time: body.pickup_date_time || '',
      pickup_contact: body.pickup_contact || '',
      cargo_description: body.cargo_description || '',
      loading_conditions: body.loading_conditions || '',

      delivery_route_title: body.delivery_route_title || body.delivery_address || '',
      delivery_address: body.delivery_address || '',
      delivery_points: body.delivery_points || [],
      delivery_date: body.delivery_date || '',
      delivery_contact: body.delivery_contact || '',

      total_client_price: Number(body.total_client_price || 0),
      carrier_freight_price: Number(body.carrier_freight_price || 0),

      deposit_amount: Number(body.deposit_amount || 0),
      deposit_paid: Boolean(body.deposit_paid),
      deposit_paid_at: body.deposit_paid
        ? body.deposit_paid_at || new Date().toISOString()
        : undefined,
      deposit_terms: body.deposit_terms || 'Задаток при заключении договора (оплачен клиентом)',

      payment_scheme: body.payment_scheme || 'two_stage',
      stage1_amount: Number(body.stage1_amount || 0),
      stage1_terms: body.stage1_terms || 'Наличными экспедитору на погрузке',
      stage1_paid: false,

      stage2_amount: Number(body.stage2_amount || 0),
      stage2_terms: body.stage2_terms || 'Оплачивается Заказчиком водителю на выгрузке',
      stage2_paid: false,

      penalty_delay_hourly: Number(body.penalty_delay_hourly || 1000),
      penalty_cancellation: Number(body.penalty_cancellation || 24000),
      non_disclosure_penalty: Number(body.non_disclosure_penalty || 200000),

      documents: [],
      notes: body.notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await (supabase.from('audit_log') as any)
      .insert({
        table_name: 'ati_expeditor_orders',
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
    console.error('Fatal POST /api/ati-expeditor error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
