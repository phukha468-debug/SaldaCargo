/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { getVerifiedMiniappUserId } from '@/lib/auth/server';
import { syncTripFinancials } from '@/lib/tripFinancials';
import { editTripOrdersPayloadSchema, executeEditTripOrders } from '@/lib/trips/editTripOrders';
import { NextResponse } from 'next/server';
import {
  generateDeterministicUuid,
  auditTripFuel,
  isStrictDocCounterparty,
} from '@saldacargo/shared';
import { syncStrictOrdersForTrip } from '@saldacargo/domain-service';

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
    console.error('Ошибка обновления остатка топлива ТС после апрува рейса в miniapp:', err);
  }
}

const PAYROLL_DRIVER_CAT = 'd79213ee-3bc6-4433-b58a-ca7ea1040d00';
const PAYROLL_LOADER_CAT = '18792fa8-fda8-472d-8e04-e19d2c6c053c';
const PAYROLL_CATS = [PAYROLL_DRIVER_CAT, PAYROLL_LOADER_CAT];

/** GET /api/admin/trips/:id — полная информация о рейсе */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data, error }, { data: payrollTxns }] = await Promise.all([
    supabase
      .from('trips')
      .select(
        `
        id, trip_number, status, lifecycle_status, started_at, ended_at,
        odometer_start, odometer_end, trip_type, driver_note,
        driver:users!trips_driver_id_fkey(id, name),
        asset:assets(id, short_name, reg_number, notes, asset_type:asset_types(code)),
        loader:users!trips_loader_id_fkey(name),
        trip_orders(
          id, amount, driver_pay, driver_car_pay, driver_loader_pay,
          is_driver_loader, direction, loaders_data,
          loader_id, loader_pay, loader2_id, loader2_pay,
          payment_method, settlement_status, lifecycle_status, description,
          counterparty_id,
          counterparty:counterparties(id, name),
          loader:users!trip_orders_loader_id_fkey(id, name),
          loader2:users!trip_orders_loader2_id_fkey(id, name)
        ),
        trip_expenses(id, amount, payment_method, description, category_id,
          category:transaction_categories(id, name))
      `,
      )
      .eq('id', id)
      .single() as any,

    (supabase.from('transactions') as any)
      .select(
        'id, amount, lifecycle_status, settlement_status, employee_confirmed, cancelled_reason, category_id, related_user_id, user:users!transactions_related_user_id_fkey(name)',
      )
      .eq('trip_id', id)
      .in('category_id', PAYROLL_CATS),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, payroll_txns: payrollTxns ?? [] });
}

/** PATCH /api/admin/trips/:id — одобрить, вернуть или отредактировать заказы */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();
  let adminId = (await getVerifiedMiniappUserId()) || null;
  if (!adminId) {
    const { data: adminUser } = await (supabase.from('users') as any)
      .select('id')
      .filter('roles', 'cs', '{"admin"}')
      .limit(1)
      .maybeSingle();
    adminId = adminUser?.id ?? null;
  }
  const body = (await request.json()) as {
    action?:
      | 'approve'
      | 'return'
      | 'edit_orders'
      | 'reissue_salary'
      | 'confirm_payroll'
      | 'convert_to_repair'
      | 'toggle_cash_hold';
    cash_not_surrendered?: boolean;
    note?: string;
    problem_description?: string;
    driver_pay?: string;
    driver_id?: string | null;
    asset_id?: string | null;
    trip_type?: string;
    odometer_start?: number | null;
    odometer_end?: number | null;
    driver_note?: string;
    admin_note?: string;
    loader_pays?: Array<{ user_id: string; name: string; amount: string }>;
    orders?: Array<{
      id?: string;
      isNew?: boolean;
      amount?: string;
      driver_pay?: string;
      driver_car_pay?: string | number;
      driver_loader_pay?: string | number;
      is_driver_loader?: boolean;
      direction?: string;
      loaders_data?: Array<{ id: string; name: string; pay: string }>;
      loader_pay?: string;
      loader2_pay?: string;
      loader_id?: string | null;
      loader2_id?: string | null;
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
  };

  // Обработка статуса подотчёта наличных (cash_not_surrendered)
  if (body.cash_not_surrendered !== undefined) {
    const { data: tripNoteData } = await (supabase.from('trips') as any)
      .select('id, admin_note, driver_note, lifecycle_status')
      .eq('id', id)
      .single();

    if (tripNoteData) {
      let currentAdminNote = tripNoteData.admin_note || '';
      let currentDriverNote = tripNoteData.driver_note || '';

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
      }

      await (supabase.from('trips') as any)
        .update({
          admin_note: currentAdminNote || null,
          driver_note: currentDriverNote || null,
        })
        .eq('id', id);

      if (tripNoteData.lifecycle_status === 'approved') {
        await syncTripFinancials(supabase, id, adminId);
      }

      if (body.action === 'toggle_cash_hold' || !body.action) {
        return NextResponse.json({ ok: true, cash_not_surrendered: body.cash_not_surrendered });
      }
    }
  }

  if (body.action === 'edit_orders') {
    const parsed = editTripOrdersPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Некорректные данные рейса', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    return executeEditTripOrders({
      supabase,
      tripId: id,
      actorId: adminId,
      allowAdminFields: true,
      payload: parsed.data,
    });
  }

  if (body.action === 'approve') {
    const { data: trip, error: fetchErr } = await (supabase.from('trips') as any)
      .select('id, trip_number, organization_id, lifecycle_status')
      .eq('id', id)
      .single();

    if (fetchErr || !trip) return NextResponse.json({ error: 'Рейс не найден' }, { status: 404 });
    if (trip.lifecycle_status === 'approved') {
      return NextResponse.json({ error: 'Рейс уже утверждён' }, { status: 400 });
    }

    const { error: tripError } = await (supabase.from('trips') as any)
      .update({ lifecycle_status: 'approved' })
      .eq('id', id);

    if (tripError) return NextResponse.json({ error: tripError.message }, { status: 500 });

    await (supabase.from('trip_orders') as any)
      .update({ lifecycle_status: 'approved' })
      .eq('trip_id', id)
      .neq('lifecycle_status', 'cancelled');

    // Синхронизируем «Сбор документов» (orders) для строгих контрагентов (ВСМПО, АВИСМА, Геострой)
    await syncStrictOrdersForTrip(supabase, id, {
      organizationId: trip.organization_id || undefined,
    });

    // Для остальных (не строгих) связанных заявок завершаем статус
    const orConditions = [`active_trip_id.eq.${id}`];
    if (trip.trip_number) orConditions.push(`order_number.eq.${trip.trip_number}`);

    const { data: linkedOrders } = await (supabase.from('orders') as any)
      .select(
        'id, status, client_id, loading_org_name, client:counterparties!orders_client_id_fkey(id, name)',
      )
      .or(orConditions.join(','))
      .in('status', ['in_progress', 'pending_review']);

    for (const ord of linkedOrders || []) {
      const effectiveName = ord.client?.name || ord.loading_org_name || '';
      if (!isStrictDocCounterparty(effectiveName)) {
        await (supabase.from('orders') as any)
          .update({
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', ord.id);
      }
    }

    await syncTripFinancials(supabase, id, adminId);
    await updateAssetFuelAfterApproval(supabase, id);

    return NextResponse.json({ ok: true, action: 'approved' });
  }

  if (body.action === 'return') {
    // Удаляем транзакции рейса, чтобы избежать дублей при повторном апруве
    const { data: tripForReturn } = await (supabase.from('trips') as any)
      .select('trip_number')
      .eq('id', id)
      .single();

    await Promise.all([
      // Новые транзакции (с trip_id)
      (supabase.from('transactions') as any).delete().eq('trip_id', id),
      // Легаси: транзакции ЗП без trip_id (созданные до добавления FK)
      ...(tripForReturn?.trip_number
        ? [
            (supabase.from('transactions') as any)
              .delete()
              .ilike('description', `%рейс №${tripForReturn.trip_number}%`)
              .in('category_id', [PAYROLL_DRIVER_CAT, PAYROLL_LOADER_CAT])
              .is('trip_id', null),
          ]
        : []),
    ]);

    const { error } = await (supabase.from('trips') as any)
      .update({
        status: 'in_progress',
        lifecycle_status: 'returned',
        odometer_end: null,
        ended_at: null,
        driver_note: body.note ?? null,
      })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Откатываем заказы в draft — не должны учитываться в P&L до повторного апрува
    await (supabase.from('trip_orders') as any)
      .update({ lifecycle_status: 'draft' })
      .eq('trip_id', id)
      .neq('lifecycle_status', 'cancelled');

    // Синхронизируем связанную заявку в orders обратно на ревью
    await (supabase.from('orders') as any)
      .update({ status: 'pending_review', updated_at: new Date().toISOString() })
      .eq('active_trip_id', id);

    return NextResponse.json({ ok: true, action: 'returned' });
  }

  if (body.action === 'reissue_salary') {
    const { data: tripInfo } = await (supabase.from('trips') as any)
      .select('driver_id, trip_number, started_at, driver:users!trips_driver_id_fkey(name)')
      .eq('id', id)
      .single();

    if (!tripInfo) return NextResponse.json({ error: 'Рейс не найден' }, { status: 404 });

    // Отменяем pending ЗП-транзакции
    await (supabase.from('transactions') as any)
      .update({ lifecycle_status: 'cancelled', cancelled_reason: 'Переназначено администратором' })
      .eq('trip_id', id)
      .in('category_id', PAYROLL_CATS)
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'pending');

    const newTxns: any[] = [];

    const driverPay = parseFloat(body.driver_pay ?? '0');
    if (driverPay > 0 && tripInfo.driver_id) {
      newTxns.push({
        direction: 'expense',
        category_id: PAYROLL_DRIVER_CAT,
        amount: driverPay.toFixed(2),
        description: `ЗП: ${(tripInfo.driver as any)?.name ?? 'Водитель'} — рейс №${tripInfo.trip_number}`,
        lifecycle_status: 'approved',
        settlement_status: 'pending',
        employee_confirmed: true,
        related_user_id: tripInfo.driver_id,
        trip_id: id,
        transaction_date: tripInfo.started_at,
        created_by: adminId,
        idempotency_key: generateDeterministicUuid(
          `trip-payroll-reissue-driver-${id}-${tripInfo.driver_id}-${Date.now()}`,
        ),
      });
    }

    for (const loader of body.loader_pays ?? []) {
      const amt = parseFloat(loader.amount ?? '0');
      if (amt > 0 && loader.user_id) {
        newTxns.push({
          direction: 'expense',
          category_id: PAYROLL_LOADER_CAT,
          amount: amt.toFixed(2),
          description: `ЗП: ${loader.name ?? 'Грузчик'} — рейс №${tripInfo.trip_number}`,
          lifecycle_status: 'approved',
          settlement_status: 'pending',
          employee_confirmed: true, // Авто-подтверждение: у грузчиков нет приложения
          related_user_id: loader.user_id,
          trip_id: id,
          transaction_date: tripInfo.started_at,
          created_by: adminId,
          idempotency_key: generateDeterministicUuid(
            `trip-payroll-reissue-loader-${id}-${loader.user_id}-${Date.now()}`,
          ),
        });
      }
    }

    if (newTxns.length > 0) {
      await (supabase.from('transactions') as any).insert(newTxns);
    }

    return NextResponse.json({ ok: true, action: 'salary_reissued' });
  }

  if (body.action === 'convert_to_repair') {
    const { data: trip, error: fetchErr } = await (supabase.from('trips') as any)
      .select(
        'id, asset_id, driver_id, trip_number, odometer_start, driver_note, admin_note, asset:assets(short_name, reg_number, odometer_current)',
      )
      .eq('id', id)
      .single();

    if (fetchErr || !trip) return NextResponse.json({ error: 'Рейс не найден' }, { status: 404 });

    // 1. Ищем или создаем заказ-наряд в service_orders
    let serviceOrderId = null;
    const { data: existingSo } = await (supabase.from('service_orders') as any)
      .select('id, order_number')
      .eq('asset_id', trip.asset_id)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSo) {
      serviceOrderId = existingSo.id;
    } else {
      const problemDesc =
        body.problem_description?.trim() ||
        `Поездка на ремонт (рейс №${trip.trip_number || ''})`.trim();
      const odoStart = trip.odometer_start || trip.asset?.odometer_current || null;

      const { data: createdSo, error: soErr } = await (supabase.from('service_orders') as any)
        .insert({
          asset_id: trip.asset_id,
          machine_type: 'own',
          status: 'in_progress',
          lifecycle_status: 'draft',
          problem_description: problemDesc,
          admin_note: `Связанный рейс: ${trip.id}${trip.trip_number ? ' (№' + trip.trip_number + ')' : ''}`,
          odometer_start: odoStart,
          created_by: adminId || trip.driver_id,
          priority: 'normal',
        })
        .select('id, order_number')
        .single();

      if (soErr)
        return NextResponse.json(
          { error: `Ошибка создания заказ-наряда: ${soErr.message}` },
          { status: 500 },
        );
      serviceOrderId = createdSo.id;
    }

    // 2. Находим активный заказ этого рейса
    const { data: orders } = await (supabase.from('orders') as any)
      .select('id, base_doc_name, raw_parser_payload')
      .eq('active_trip_id', id);

    for (const order of orders || []) {
      const payload = (order.raw_parser_payload || {}) as Record<string, any>;
      await (supabase.from('orders') as any)
        .update({
          base_doc_name: '🔧 ПОЕЗДКА НА РЕМОНТ (СТО)',
          cargo_name: 'Поездка на ремонт / СТО',
          raw_parser_payload: {
            ...payload,
            is_repair: true,
            trip_type: 'repair',
            service_order_id: serviceOrderId,
            repair_description: body.problem_description || 'Поездка на ремонт',
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);
    }

    // 3. Обновляем рейс
    const repairMarker = '[РЕЙС_НА_РЕМОНТ]';
    const curDriverNote = trip.driver_note || '';
    const newDriverNote = curDriverNote.includes(repairMarker)
      ? curDriverNote
      : `${repairMarker} Поездка на ремонт (СТО)${body.problem_description ? ': ' + body.problem_description : ''}\n${curDriverNote}`.trim();

    await (supabase.from('trips') as any)
      .update({
        driver_note: newDriverNote,
        admin_note: `${repairMarker} Перегон на СТО (связан с заказ-нарядом)`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return NextResponse.json({ ok: true, action: 'converted_to_repair', serviceOrderId });
  }

  if (body.action === 'confirm_payroll') {
    await (supabase.from('transactions') as any)
      .update({ employee_confirmed: true })
      .eq('trip_id', id)
      .in('category_id', PAYROLL_CATS)
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'pending');
    return NextResponse.json({ ok: true, action: 'payroll_confirmed' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

/** DELETE /api/admin/trips/:id — полное удаление рейса со всеми следами */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  // Мы полагаемся на ON DELETE CASCADE в базе данных для trip_orders, trip_expenses и transactions.
  const { error } = await supabase.from('trips').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
