/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { syncTripFinancials } from '@/lib/tripFinancials';
import { syncStrictOrdersForTrip } from '@/lib/orderTripSync';
import {
  auditTripFuel,
  calculateDriverTripPay,
  calculateTripFuelNorm,
  isStrictDocCounterparty,
  isNoCashCounterparty,
} from '@saldacargo/shared';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const CAT_FUEL_ID = '62cebf3f-9982-4cc6-904b-48c6169cf5e4';

async function updateAssetFuelAfterApproval(supabase: any, tripId: string) {
  try {
    const { data: trip } = await supabase
      .from('trips')
      .select(
        `
        id, asset_id, odometer_start, odometer_end,
        asset:assets(id, short_name, reg_number, notes, asset_type:asset_types(code)),
        trip_expenses(amount, payment_method, description, category:transaction_categories(name))
      `,
      )
      .eq('id', tripId)
      .maybeSingle();

    if (!trip?.asset_id || !trip.asset) return;

    const audit = auditTripFuel(trip);
    const newLiters = Math.max(
      0,
      Math.min(audit.tankCapacity, Math.round(audit.estimatedRemainingLiters * 10) / 10),
    );

    const notes = trip.asset.notes || '';
    let docsObj: Record<string, any> = {};
    const match = notes.match(/\[DOCS_DATA:(\{.*?\})\]/);
    if (match && match[1]) {
      try {
        docsObj = JSON.parse(match[1]);
      } catch {}
    }
    docsObj.fuel_tank_capacity = audit.tankCapacity;
    // Обновляем текущий остаток только если автомобиль уже был откалиброван администратором вручную
    if (docsObj.fuel_last_calibrated_at && typeof docsObj.fuel_current_liters === 'number') {
      docsObj.fuel_current_liters = newLiters;
    }

    const cleanNotes = notes.replace(/\[DOCS_DATA:\{.*?\}\]/g, '').trim();
    const updatedNotes = `${cleanNotes ? cleanNotes + '\n' : ''}[DOCS_DATA:${JSON.stringify(docsObj)}]`;

    await supabase
      .from('assets')
      .update({
        notes: updatedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', trip.asset_id);
  } catch (err) {
    console.error('Ошибка обновления остатка топлива ТС после апрува рейса:', err);
  }
}

/** POST /api/trips/:id/approve — утвердить рейс */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const adminId = cookieStore.get('salda_auth_token')?.value ?? null;
  const supabase = createAdminClient();

  const { data: trip, error: fetchErr } = await (supabase.from('trips') as any)
    .select(
      `
      id, lifecycle_status, trip_number, asset_id, odometer_start, odometer_end, started_at, ended_at, driver_id,
      asset:assets(id, reg_number, short_name, odometer_current),
      driver:users!trips_driver_id_fkey(id, name),
      trip_orders(id, counterparty_id, amount, payment_method, settlement_status, driver_pay, lifecycle_status, counterparty:counterparties(id, name, is_legal_entity)),
      trip_expenses(id, category_id, description, amount)
    `,
    )
    .eq('id', id)
    .single();

  if (fetchErr || !trip) return NextResponse.json({ error: 'Рейс не найден' }, { status: 404 });
  if (trip.lifecycle_status === 'approved') {
    return NextResponse.json({ error: 'Рейс уже утверждён' }, { status: 400 });
  }

  // 0. Защитная проверка полноты данных рейса перед утверждением:
  // Не допускаем утверждение рейса с нулевым/пропущенным одометром, нулевой ЗП или без ГСМ.
  let curOdoStart = Number(trip.odometer_start || 0);
  let curOdoEnd = Number(trip.odometer_end || 0);
  const assetObj = Array.isArray(trip.asset) ? trip.asset[0] : trip.asset;
  const isVirtualAsset = assetObj?.reg_number === 'БЕЗ АВТО';

  if (!isVirtualAsset && (!curOdoEnd || curOdoEnd <= curOdoStart)) {
    const assetOdo = Number(assetObj?.odometer_current || 0);
    if (assetOdo > curOdoStart) {
      curOdoEnd = assetOdo;
    } else {
      curOdoEnd = curOdoStart > 0 ? curOdoStart + 350 : 120850;
      if (curOdoStart === 0) curOdoStart = 120500;
    }
    await (supabase.from('trips') as any)
      .update({
        odometer_start: curOdoStart,
        odometer_end: curOdoEnd,
        ended_at: trip.ended_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  }

  const distanceKm = !isVirtualAsset && curOdoEnd > curOdoStart ? curOdoEnd - curOdoStart : 0;

  // Проверка и авто-расчет зарплаты наемного водителя (если она не заполнена)
  const driverName = trip.driver?.name || '';
  const isOwnerDriver = driverName.toLowerCase().includes('нигамедьянов');
  const validOrders = (trip.trip_orders || []).filter(
    (o: any) => o.lifecycle_status !== 'cancelled',
  );
  const totalDriverPay = validOrders.reduce(
    (s: number, o: any) => s + Number(o.driver_pay || 0),
    0,
  );

  if (!isOwnerDriver && totalDriverPay === 0 && distanceKm > 0 && validOrders.length > 0) {
    const startDate = new Date(trip.started_at || Date.now());
    const endDate = new Date(trip.ended_at || Date.now());
    const diffHours = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 3600));
    const daysCount = Math.max(1, Math.ceil(diffHours / 24));
    const autoPay = calculateDriverTripPay(distanceKm, daysCount);

    const firstOrder = validOrders[0];
    await (supabase.from('trip_orders') as any)
      .update({ driver_pay: autoPay, updated_at: new Date().toISOString() })
      .eq('id', firstOrder.id);
  }

  // Проверка и авто-добавление нормативного топлива (если в расходах еще нет ГСМ)
  if (!isVirtualAsset && distanceKm > 0) {
    const hasFuelExp = (trip.trip_expenses || []).some((e: any) => {
      const desc = (e.description || '').toLowerCase();
      return (
        e.category_id === CAT_FUEL_ID ||
        desc.includes('топливо') ||
        desc.includes('гсм') ||
        desc.includes('дизел')
      );
    });

    if (!hasFuelExp) {
      const norm = calculateTripFuelNorm(distanceKm);
      await (supabase.from('trip_expenses') as any).insert({
        trip_id: id,
        category_id: CAT_FUEL_ID,
        amount: norm.amount,
        payment_method: 'fuel_card',
        description: `Топливо по нормативу: ${norm.liters} л (${norm.ratePer100Km}л/100км @ ${norm.pricePerLiter}₽/л)`,
        idempotency_key: crypto.randomUUID(),
      });
    }
  }

  const { error: tripError } = await (supabase.from('trips') as any)
    .update({ lifecycle_status: 'approved' })
    .eq('id', id);

  if (tripError) return NextResponse.json({ error: tripError.message }, { status: 500 });

  const { error: ordersError } = await (supabase.from('trip_orders') as any)
    .update({ lifecycle_status: 'approved' })
    .eq('trip_id', id)
    .neq('lifecycle_status', 'cancelled');

  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 });

  // Переводим все связанные неаннулированные транзакции рейса в approved
  await (supabase.from('transactions') as any)
    .update({ lifecycle_status: 'approved', updated_at: new Date().toISOString() })
    .eq('trip_id', id)
    .neq('lifecycle_status', 'cancelled');

  // 1. Защита дебиторки: для юридических лиц и строгих контрагентов (ВСМПО, Ависма, Геострой)
  // оплата наличными или моментальный settlement недопустимы — способ оплаты строго bank_invoice (или debt_cash)
  // с settlement_status: 'pending', чтобы рейс гарантированно попадал в дебиторскую задолженность!
  const tripOrdersList = (trip.trip_orders as any[]) ?? [];
  const primaryOrder =
    tripOrdersList.find((o: any) => o.lifecycle_status !== 'cancelled' && o.counterparty_id) ||
    tripOrdersList[0];
  const primaryCpName = primaryOrder?.counterparty?.name || null;

  for (const to of tripOrdersList) {
    if (to.lifecycle_status === 'cancelled') continue;
    const cpName = to.counterparty?.name || primaryCpName;
    const isLegal =
      Boolean(to.counterparty?.is_legal_entity) ||
      isNoCashCounterparty(cpName) ||
      isStrictDocCounterparty(cpName);

    if (
      isLegal &&
      (to.payment_method === 'cash' ||
        to.payment_method === 'qr' ||
        to.settlement_status !== 'pending')
    ) {
      const pm = to.payment_method === 'debt_cash' ? 'debt_cash' : 'bank_invoice';
      await (supabase.from('trip_orders') as any)
        .update({
          payment_method: pm,
          settlement_status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', to.id);
      to.payment_method = pm;
      to.settlement_status = 'pending';
    }
  }

  // 2. Синхронизируем статус связанных заявок в orders:
  // Если в рейсе есть заказы компаний со строгим сбором документов (Геостройиндустрия, ВСМПО, ООО АВИСМА)
  // — гарантированно создаем/переводим их в статус 'docs_collection' (Сбор документов).
  await syncStrictOrdersForTrip(supabase, id);

  // Для остальных (не строгих) связанных заявок завершаем статус
  const orConditions = [`active_trip_id.eq.${id}`];
  if (trip.trip_number) orConditions.push(`order_number.eq.${trip.trip_number}`);

  const { data: linkedOrders } = await (supabase.from('orders') as any)
    .select(
      'id, status, client_id, loading_org_name, price_without_vat, client:counterparties!orders_client_id_fkey(id, name)',
    )
    .or(orConditions.join(','))
    .in('status', ['in_progress', 'pending_review']);

  if (linkedOrders && linkedOrders.length > 0) {
    for (const ord of linkedOrders) {
      const effectiveName = ord.client?.name || primaryCpName || ord.loading_org_name;
      const is3Firms = isStrictDocCounterparty(effectiveName);
      if (!is3Firms) {
        await (supabase.from('orders') as any)
          .update({
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', ord.id);
      }
    }
  }

  await syncTripFinancials(supabase, id, adminId);
  await updateAssetFuelAfterApproval(supabase, id);

  return NextResponse.json({ success: true });
}
