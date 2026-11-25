/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { getVerifiedWebUserId } from '@/lib/auth';
import { syncTripFinancials } from '@/lib/tripFinancials';
import {
  isNoCashCounterparty,
  isTerritoryCounterparty,
  isGeostroyCounterparty,
  isGeostroyOrderValid,
  isInternalCounterparty,
  isDebtPaymentMethod,
  isStrictDocCounterparty,
  resolveKnownMasterCounterpartyId,
  cleanCounterpartySearchName,
  escapePostgrestValue,
} from '@saldacargo/shared';
import { NextResponse } from 'next/server';

/** GET /api/trips/:id — получить детали одного рейса (по UUID или номеру рейса) */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const cleanNum = id.replace(/[^0-9]/g, '');

    let query = supabase.from('trips').select(
      `
      id, trip_number, status, lifecycle_status, started_at, ended_at, created_at,
      trip_type, odometer_start, odometer_end, driver_note, admin_note,
      asset:assets(id, short_name, reg_number, notes, asset_type:asset_types(code, name)),
      driver:users!trips_driver_id_fkey(id, name),
      loader:users!trips_loader_id_fkey(id, name),
      trip_orders(
        id, amount, driver_pay, loader_pay, loader2_pay,
        loader_id, loader2_id, description,
        direction, is_driver_loader, driver_car_pay, driver_loader_pay, loaders_data,
        loader:users!trip_orders_loader_id_fkey(id, name),
        loader2:users!trip_orders_loader2_id_fkey(id, name),
        payment_method, settlement_status, lifecycle_status,
        counterparty_id,
        counterparty:counterparties(id, name)
      ),
      trip_expenses(
        id, amount, payment_method, description,
        category:transaction_categories(id, name)
      )
    `,
    );

    if (isUuid) {
      query = query.eq('id', id);
    } else if (cleanNum) {
      // Защита от падения maybeSingle() на исторических дубликатах trip_number (#1016-#1060)
      query = query
        .eq('trip_number', parseInt(cleanNum, 10))
        .order('created_at', { ascending: false })
        .limit(1);
    } else {
      query = query.eq('id', id);
    }

    const { data, error } = await (query as any).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Рейс не найден' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

/** PATCH /api/trips/:id — редактировать заказы рейса */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      orders?: Array<{
        id?: string;
        isNew?: boolean;
        amount?: string;
        driver_pay?: string;
        loader_pay?: string;
        loader2_pay?: string;
        loader_id?: string | null;
        loader2_id?: string | null;
        direction?: string;
        is_driver_loader?: boolean;
        driver_car_pay?: string | number;
        driver_loader_pay?: string | number;
        loaders_data?: any;
        description?: string;
        payment_method?: string;
        counterparty_id?: string | null;
        counterparty_name?: string;
      }>;
      deleted_order_ids?: string[];
      expenses?: Array<{
        id?: string;
        isNew?: boolean;
        amount?: string;
        payment_method?: string;
        description?: string;
        category_id?: string;
      }>;
      deleted_expense_ids?: string[];
      odometer_start?: number;
      odometer_end?: number;
      trip_type?: string;
      asset_id?: string | null;
      driver_id?: string | null;
      admin_note?: string;
      driver_note?: string;
      cash_not_surrendered?: boolean;
    };

    const supabase = createAdminClient();

    // 1. Получаем данные рейса (статус, грузчики, водитель)
    const { data: trip, error: tripError } = await (supabase.from('trips') as any)
      .select(
        'id, organization_id, lifecycle_status, driver_id, loader_id, loader2_id, admin_note, driver_note',
      )
      .eq('id', id)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: tripError?.message ?? 'Рейс не найден' }, { status: 404 });
    }

    // 1.1 Обновление данных самого рейса (одометр, тип, ТС, заметки, подотчёт наличных, водитель)
    const tripUpdates: Record<string, any> = {};
    if (body.odometer_start !== undefined) tripUpdates.odometer_start = body.odometer_start;
    if (body.odometer_end !== undefined) tripUpdates.odometer_end = body.odometer_end;
    if (body.trip_type !== undefined) tripUpdates.trip_type = body.trip_type;
    if (body.asset_id !== undefined && body.asset_id) tripUpdates.asset_id = body.asset_id;
    if (body.admin_note !== undefined) tripUpdates.admin_note = body.admin_note;
    if (body.driver_note !== undefined) tripUpdates.driver_note = body.driver_note;

    if (body.driver_id !== undefined && body.driver_id !== null) {
      tripUpdates.driver_id = body.driver_id;

      // Если была метка [УТОЧНИТЬ_ВОДИТЕЛЯ], снимаем её при сохранении водителя
      let currentAdminNote =
        (tripUpdates.admin_note !== undefined ? tripUpdates.admin_note : (trip.admin_note ?? '')) ||
        '';
      if (currentAdminNote.includes('[УТОЧНИТЬ_ВОДИТЕЛЯ]')) {
        currentAdminNote = currentAdminNote
          .replace(/\[УТОЧНИТЬ_ВОДИТЕЛЯ\]/g, '')
          .replace(/\n{2,}/g, '\n')
          .trim();
        tripUpdates.admin_note = currentAdminNote || null;
      }

      let currentDriverNote =
        (tripUpdates.driver_note !== undefined
          ? tripUpdates.driver_note
          : (trip.driver_note ?? '')) || '';
      if (currentDriverNote.includes('ТРЕБУЕТСЯ УТОЧНИТЬ ВОДИТЕЛЯ')) {
        currentDriverNote = currentDriverNote
          .replace(/⚠️\s*ТРЕБУЕТСЯ УТОЧНИТЬ ВОДИТЕЛЯ[^\n]*\n?/g, '')
          .replace(/\n{2,}/g, '\n')
          .trim();
        tripUpdates.driver_note = currentDriverNote || null;
      }
    }

    if (body.cash_not_surrendered !== undefined) {
      let currentAdminNote =
        (tripUpdates.admin_note !== undefined ? tripUpdates.admin_note : (trip.admin_note ?? '')) ||
        '';
      let currentDriverNote =
        (tripUpdates.driver_note !== undefined
          ? tripUpdates.driver_note
          : (trip.driver_note ?? '')) || '';

      if (body.cash_not_surrendered) {
        if (!currentAdminNote.includes('[CASH_NOT_SURRENDERED]')) {
          currentAdminNote = currentAdminNote.trim()
            ? `${currentAdminNote.trim()}\n[CASH_NOT_SURRENDERED]`
            : '[CASH_NOT_SURRENDERED]';
        }
      } else {
        currentAdminNote = currentAdminNote
          .replace(/\[CASH_NOT_SURRENDERED\]/g, '')
          .replace(/\n{2,}/g, '\n')
          .trim();

        currentDriverNote = currentDriverNote
          .replace(/\[НЕ СДАНО В КАССУ:[^\]]+\]/g, '')
          .replace(/\[CARRYOVER[^\]]*\]/g, '')
          .replace(/\[CASH_NOT_COLLECTED\]/g, '')
          .replace(/\n{2,}/g, '\n')
          .trim();
        tripUpdates.driver_note = currentDriverNote || null;
      }
      tripUpdates.admin_note = currentAdminNote || null;
    }

    if (Object.keys(tripUpdates).length > 0) {
      tripUpdates.updated_at = new Date().toISOString();
      await (supabase.from('trips') as any).update(tripUpdates).eq('id', id);
    }

    if (body.driver_id) {
      await (supabase.from('orders') as any)
        .update({
          assigned_driver_id: body.driver_id,
          updated_at: new Date().toISOString(),
        })
        .eq('active_trip_id', id);
    }

    // 2. Вспомогательная функция для резолвинга/создания контрагента
    async function resolveCounterpartyId(cpId?: string | null, cpName?: string) {
      if (cpId) {
        // Проверяем, не передан ли старый дубль мастер-контрагента
        const { data: cpObj } = await (supabase.from('counterparties') as any)
          .select('id, name')
          .eq('id', cpId)
          .maybeSingle();
        const masterId = resolveKnownMasterCounterpartyId(cpObj?.name);
        if (masterId) return masterId;
        return cpId;
      }
      const name = cpName?.trim();
      if (!name) return null;

      // 1. Защита от дублей мастер-контрагентов (ВСМПО, АВИСМА, Геостройиндустрия)
      const masterId = resolveKnownMasterCounterpartyId(name);
      if (masterId) return masterId;

      // 2. Поиск среди существующих активных контрагентов (с учётом форм собственности и кавычек)
      const simplifiedName = cleanCounterpartySearchName(name);
      const safeName = escapePostgrestValue(name);
      const safeSimplified = escapePostgrestValue(simplifiedName || name);
      const { data: foundList } = safeName
        ? await (supabase.from('counterparties') as any)
            .select('id, name')
            .eq('is_active', true)
            .or(`name.ilike.%${safeName}%,name.ilike.%${safeSimplified || safeName}%`)
            .limit(5)
        : { data: [] };

      const matched = (foundList || []).find((c: any) => {
        const cClean = cleanCounterpartySearchName(c.name);
        return cClean === simplifiedName || c.name.toLowerCase() === name.toLowerCase();
      });

      if (matched) return matched.id;

      // Если контрагент новый, помечаем юр. лицом, если в названии есть ООО/АО/ПАО/ЗАО
      const isLegal = /\b(ооо|пао|зао|ао)\b/i.test(name);
      const { data: created, error: createErr } = await (supabase.from('counterparties') as any)
        .insert({ name, type: 'client', is_active: true, is_legal_entity: isLegal })
        .select('id')
        .single();
      if (createErr) throw createErr;
      return created.id;
    }

    // 3. Обработка удалённых заказов (soft-delete через lifecycle_status = 'cancelled')
    if (body.deleted_order_ids?.length) {
      const { error: delErr } = await (supabase.from('trip_orders') as any)
        .update({
          lifecycle_status: 'cancelled',
          cancelled_reason: 'Удалено администратором при редактировании',
        })
        .in('id', body.deleted_order_ids)
        .eq('trip_id', id);
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    // 4. Обработка заказов (создание новых или обновление существующих)
    if (body.orders?.length) {
      for (const order of body.orders) {
        const isNew =
          order.isNew || !order.id || order.id.startsWith('temp-') || order.id.startsWith('new-');

        const resolvedCounterpartyId = await resolveCounterpartyId(
          order.counterparty_id,
          order.counterparty_name,
        );

        let cpName = order.counterparty_name;
        if (!cpName && resolvedCounterpartyId) {
          const { data: cpData } = await (supabase.from('counterparties') as any)
            .select('name')
            .eq('id', resolvedCounterpartyId)
            .maybeSingle();
          cpName = cpData?.name;
        }

        if (isTerritoryCounterparty(cpName) && !order.description?.trim()) {
          return NextResponse.json(
            {
              error:
                'Для контрагента «Территория» обязательно укажите адрес (улица + дом) и описание работы',
            },
            { status: 400 },
          );
        }

        if (isGeostroyCounterparty(cpName) && !isGeostroyOrderValid(order.description)) {
          return NextResponse.json(
            {
              error:
                'Для контрагента «ООО Геостройиндустрия» обязательно укажите маршрут и дату начала маршрута по маске (ДД.ММ.ГГГГ)',
            },
            { status: 400 },
          );
        }

        let paymentMethod = order.payment_method || 'debt_cash';
        const isInternal = isInternalCounterparty(cpName);
        const isNoCash = isNoCashCounterparty(cpName) || isStrictDocCounterparty(cpName);
        if (isInternal) {
          paymentMethod = 'cash';
        } else if (isNoCash && (paymentMethod === 'cash' || paymentMethod === 'qr')) {
          paymentMethod = 'bank_invoice';
        }

        const isDebt = !isInternal && isDebtPaymentMethod(paymentMethod);
        const settlementStatus = isDebt ? 'pending' : 'completed';

        if (isNew) {
          // Создание новой заявки
          const newOrderPayload = {
            trip_id: id,
            counterparty_id: resolvedCounterpartyId,
            description: order.description?.trim() || null,
            amount: isInternal ? '0.00' : parseFloat(order.amount ?? '0').toFixed(2),
            driver_pay: parseFloat(order.driver_pay ?? '0').toFixed(2),
            loader_id: order.loader_id ?? trip.loader_id ?? null,
            loader_pay: parseFloat(order.loader_pay ?? '0').toFixed(2),
            loader2_id: order.loader2_id ?? trip.loader2_id ?? null,
            loader2_pay: parseFloat(order.loader2_pay ?? '0').toFixed(2),
            direction: order.direction || 'local',
            is_driver_loader: Boolean(order.is_driver_loader),
            driver_car_pay: parseFloat(String(order.driver_car_pay ?? '0')).toFixed(2),
            driver_loader_pay: parseFloat(String(order.driver_loader_pay ?? '0')).toFixed(2),
            ...(order.loaders_data ? { loaders_data: order.loaders_data } : {}),
            payment_method: paymentMethod,
            settlement_status: settlementStatus,
            lifecycle_status: trip.lifecycle_status === 'approved' ? 'approved' : 'draft',
            idempotency_key: crypto.randomUUID(),
          };

          const { error: insErr } = await (supabase.from('trip_orders') as any).insert(
            newOrderPayload,
          );
          if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
        } else {
          // Обновление существующей заявки
          const update: Record<string, any> = {};
          if (order.amount !== undefined) update.amount = parseFloat(order.amount).toFixed(2);
          if (order.driver_pay !== undefined)
            update.driver_pay = parseFloat(order.driver_pay).toFixed(2);
          if (order.loader_pay !== undefined)
            update.loader_pay = parseFloat(order.loader_pay).toFixed(2);
          if (order.loader2_pay !== undefined)
            update.loader2_pay = parseFloat(order.loader2_pay).toFixed(2);
          if (order.direction !== undefined) update.direction = order.direction;
          if (order.is_driver_loader !== undefined)
            update.is_driver_loader = Boolean(order.is_driver_loader);
          if (order.driver_car_pay !== undefined)
            update.driver_car_pay = parseFloat(String(order.driver_car_pay)).toFixed(2);
          if (order.driver_loader_pay !== undefined)
            update.driver_loader_pay = parseFloat(String(order.driver_loader_pay)).toFixed(2);
          if (order.loaders_data !== undefined) update.loaders_data = order.loaders_data;
          if (order.description !== undefined)
            update.description = order.description?.trim() || null;
          if (order.payment_method !== undefined) {
            update.payment_method = paymentMethod;
            update.settlement_status = settlementStatus;
          }
          if (order.counterparty_id !== undefined || order.counterparty_name !== undefined) {
            update.counterparty_id = resolvedCounterpartyId;
          }
          if (isInternal) {
            update.amount = '0.00';
            update.payment_method = 'cash';
            update.settlement_status = 'completed';
          }

          if (Object.keys(update).length > 0) {
            const { error: updErr } = await (supabase.from('trip_orders') as any)
              .update(update)
              .eq('id', order.id)
              .eq('trip_id', id);
            if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
          }
        }
      }
    }

    // 5. Обработка удалённых расходов
    if (body.deleted_expense_ids?.length) {
      const { error: delExpErr } = await (supabase.from('trip_expenses') as any)
        .delete()
        .in('id', body.deleted_expense_ids)
        .eq('trip_id', id);
      if (delExpErr) return NextResponse.json({ error: delExpErr.message }, { status: 500 });
    }

    // 6. Обработка расходов (создание новых или обновление существующих)
    if (body.expenses?.length) {
      const CAT_FUEL = '62cebf3f-9982-4cc6-904b-48c6169cf5e4';
      for (const exp of body.expenses) {
        const isNew =
          exp.isNew || !exp.id || exp.id.startsWith('new-') || exp.id.startsWith('temp-');
        const amountNum = parseFloat(exp.amount ?? '0');
        const paymentMethod = exp.payment_method || 'fuel_card';

        if (isNew) {
          if (amountNum > 0) {
            const { error: insExpErr } = await (supabase.from('trip_expenses') as any).insert({
              ...(trip.organization_id ? { organization_id: trip.organization_id } : {}),
              trip_id: id,
              category_id: exp.category_id || CAT_FUEL,
              amount: amountNum.toFixed(2),
              payment_method: paymentMethod,
              description: exp.description?.trim() || null,
              idempotency_key: crypto.randomUUID(),
            });
            if (insExpErr) return NextResponse.json({ error: insExpErr.message }, { status: 500 });
          }
        } else {
          const update: Record<string, any> = {};
          if (exp.amount !== undefined) update.amount = amountNum.toFixed(2);
          if (exp.payment_method !== undefined) update.payment_method = paymentMethod;
          if (exp.description !== undefined) update.description = exp.description?.trim() || null;
          if (exp.category_id !== undefined) update.category_id = exp.category_id;

          if (Object.keys(update).length > 0) {
            const { error: updExpErr } = await (supabase.from('trip_expenses') as any)
              .update(update)
              .eq('id', exp.id)
              .eq('trip_id', id);
            if (updExpErr) return NextResponse.json({ error: updExpErr.message }, { status: 500 });
          }
        }
      }
    }

    // Синхронизируем client_id в связанной заявке orders, если он не был заполнен
    const firstCpId =
      (body.orders as any[])?.find((o: any) => o._selectedId || o.counterparty_id)?._selectedId ||
      (body.orders as any[])?.find((o: any) => o.counterparty_id)?.counterparty_id;
    if (firstCpId) {
      await (supabase.from('orders') as any)
        .update({ client_id: firstCpId, updated_at: new Date().toISOString() })
        .eq('active_trip_id', id)
        .is('client_id', null);
    }

    const adminId = (await getVerifiedWebUserId()) ?? null;
    await syncTripFinancials(supabase, id, adminId);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

/** DELETE /api/trips/:id — отменить рейс (soft-delete) */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { error } = await (supabase.from('trips') as any)
      .update({ lifecycle_status: 'cancelled' })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Отвязываем связанную заявку и возвращаем в лист ожидания
    await (supabase.from('orders') as any)
      .update({
        status: 'waiting_vehicle',
        active_trip_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('active_trip_id', id);

    const adminId = (await getVerifiedWebUserId()) ?? null;
    await syncTripFinancials(supabase, id, adminId);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
