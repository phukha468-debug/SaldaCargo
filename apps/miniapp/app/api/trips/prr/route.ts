/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { calculateOrderPayroll } from '@saldacargo/domain-payroll';
import { isNoCashCounterparty } from '@saldacargo/shared';
import { syncTripFinancials } from '@/lib/tripFinancials';

/**
 * POST /api/trips/prr
 * Создание рейса и заказа «Погрузо-разгрузочные работы (без авто)»
 * Доступно для: водителя, механика, администратора
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const currentUserId = cookieStore.get('salda_user_id')?.value;

    const body = (await request.json()) as {
      counterparty_id?: string;
      amount: number | string;
      payment_method?: 'cash' | 'qr' | 'debt_cash';
      loaders: Array<{ id: string; name?: string; pay?: string | number }>;
      description?: string;
      creator_note?: string;
      user_id?: string;
      auto_approve?: boolean;
    };

    const effectiveUserId = body.user_id || currentUserId;
    if (!effectiveUserId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const numAmount = Number(body.amount);
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Укажите корректную сумму заказа' }, { status: 400 });
    }

    const loaders = Array.isArray(body.loaders) ? body.loaders : [];
    if (loaders.length === 0) {
      return NextResponse.json({ error: 'Выберите хотя бы одного грузчика' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Находим виртуальный объект "Без авто (ПРР)"
    let { data: asset } = await (supabase
      .from('assets')
      .select('id')
      .eq('reg_number', 'БЕЗ АВТО')
      .maybeSingle() as any);

    if (!asset) {
      const { data: createdAsset, error: assetErr } = await (supabase
        .from('assets')
        .insert({
          reg_number: 'БЕЗ АВТО',
          short_name: 'Без авто (ПРР)',
          year: 2026,
          status: 'active',
          odometer_current: 0,
          current_book_value: 0,
          remaining_depreciation_months: 0,
          notes: 'Виртуальный объект для погрузо-разгрузочных работ без авто',
        })
        .select('id')
        .single() as any);

      if (assetErr) {
        return NextResponse.json(
          { error: 'Не удалось подготовить объект "Без авто": ' + assetErr.message },
          { status: 500 },
        );
      }
      asset = createdAsset;
    }

    // 2. Расчет ЗП грузчиков и компании
    // Формула: Общая сумма делится на кол-во грузчиков, 30% удерживается компании, 70% грузчику
    const payroll = calculateOrderPayroll({
      direction: 'loaders_only',
      amount: numAmount,
      isDriverLoader: false,
      loadersCount: loaders.length,
    });

    const loadersData = loaders.map((l) => ({
      id: l.id,
      name: l.name || 'Грузчик',
      pay:
        l.pay !== undefined && l.pay !== '' && !isNaN(Number(l.pay))
          ? String(l.pay)
          : String(payroll.loaderPayEach),
    }));

    // Проверка запрета наличных для корпоративных клиентов
    let paymentMethod = body.payment_method || 'cash';
    if (paymentMethod === 'cash' && body.counterparty_id) {
      const { data: cp } = await (supabase.from('counterparties') as any)
        .select('name')
        .eq('id', body.counterparty_id)
        .maybeSingle();
      if (isNoCashCounterparty(cp?.name)) {
        paymentMethod = 'debt_cash';
      }
    }

    const settlementStatus = paymentMethod === 'debt_cash' ? 'pending' : 'completed';

    const orderDescription = body.description?.trim() || 'Погрузо-разгрузочные работы (без авто)';
    const tripNote = body.creator_note?.trim() || orderDescription;

    // 3. Создаем рейс "Погрузо-разгрузочные работы (без авто)"
    const tripStatus = 'completed';
    const lifecycleStatus = body.auto_approve ? 'approved' : 'draft';

    const { data: newTrip, error: tripError } = await (supabase
      .from('trips')
      .insert({
        driver_id: effectiveUserId,
        asset_id: asset.id,
        loaders_count: loaders.length,
        trip_type: 'hourly',
        odometer_start: 0,
        odometer_end: 0,
        status: tripStatus,
        lifecycle_status: lifecycleStatus,
        driver_note: tripNote,
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
      })
      .select()
      .single() as any);

    if (tripError) {
      console.error('[API Trips PRR] Trip insert error:', tripError);
      return NextResponse.json({ error: tripError.message }, { status: 500 });
    }

    // 4. Создаем заказ внутри рейса
    const loader1 = loadersData[0] || null;
    const loader2 = loadersData[1] || null;

    const { data: newOrder, error: orderError } = await (supabase
      .from('trip_orders')
      .insert({
        trip_id: newTrip.id,
        direction: 'loaders_only',
        is_driver_loader: false,
        counterparty_id: body.counterparty_id || null,
        description: orderDescription,
        amount: numAmount,
        driver_car_pay: '0',
        driver_loader_pay: '0',
        driver_pay: '0',
        loaders_data: loadersData,
        loader_id: loader1?.id || null,
        loader_pay: loader1?.pay ? String(loader1.pay) : '0',
        loader2_id: loader2?.id || null,
        loader2_pay: loader2?.pay ? String(loader2.pay) : '0',
        payment_method: paymentMethod,
        settlement_status: settlementStatus,
        lifecycle_status: lifecycleStatus,
        idempotency_key: crypto.randomUUID(),
      })
      .select()
      .single() as any);

    if (orderError) {
      console.error('[API Trips PRR] Order insert error:', orderError);
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    // 5. Если auto_approve, сразу синхронизируем финансы
    if (body.auto_approve) {
      try {
        await syncTripFinancials(supabase, newTrip.id, effectiveUserId);
      } catch (finErr) {
        console.error('[API Trips PRR] Financial sync error:', finErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        trip: newTrip,
        order: newOrder,
        payroll,
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('[API Trips PRR] Fatal error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
