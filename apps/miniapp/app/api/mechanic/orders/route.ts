/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  isOilOrFilterWork,
  extractOrderDates,
  cleanOrderNotes,
  formatOrderDatesNote,
} from '@saldacargo/shared';

function getUserId(
  request: Request,
  cookieStore: any,
  searchParams?: URLSearchParams,
): string | null {
  return (
    searchParams?.get('mechanic_id') ||
    cookieStore.get('salda_user_id')?.value ||
    request.headers.get('x-salda-user-id') ||
    null
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cookieStore = await cookies();
  const mechanicId = getUserId(request, cookieStore, searchParams);
  const status = searchParams.get('status') || undefined;
  const unassigned = searchParams.get('unassigned') === 'true';
  const activeStation = searchParams.get('active_station') === 'true';

  if (!mechanicId && !unassigned && !activeStation) {
    return NextResponse.json({ error: 'mechanic_id is required' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

    if (activeStation) {
      const { data, error } = await (supabase.from('service_orders') as any)
        .select(
          `
          id, order_number, machine_type, status, lifecycle_status, priority, created_at,
          asset:assets(id, short_name, reg_number),
          client_vehicle_brand, client_vehicle_model, client_vehicle_reg,
          problem_description, assigned_mechanic_id, second_mechanic_id
        `,
        )
        .in('status', ['in_progress', 'returned', 'created'])
        .neq('lifecycle_status', 'cancelled')
        .order('order_number', { ascending: false });
      if (error) throw error;
      return NextResponse.json(data ?? []);
    }

    if (unassigned) {
      const { data, error } = await (supabase.from('service_orders') as any)
        .select(
          `
          id, order_number, machine_type, status, lifecycle_status, priority, created_at,
          asset:assets(id, short_name, reg_number),
          client_vehicle_brand, client_vehicle_model, client_vehicle_reg,
          works:service_order_works(id, custom_work_name, status, norm_minutes, actual_minutes, price_client, work_catalog:work_catalog(name)),
          parts:service_order_parts(id, custom_part_name, quantity, unit, part:parts(name, unit))
        `,
        )
        .is('assigned_mechanic_id', null)
        .eq('lifecycle_status', 'approved')
        .in('status', ['created'])
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return NextResponse.json(data ?? []);
    }

    const [{ data: sto }, { data: mechUser }] = await Promise.all([
      (supabase.from('sto_settings') as any)
        .select('hourly_rate, hourly_rate_own')
        .limit(1)
        .maybeSingle(),
      (supabase.from('users') as any)
        .select('id, name, mechanic_salary_pct')
        .eq('id', mechanicId)
        .maybeSingle(),
    ]);

    const rateClient = parseFloat(sto?.hourly_rate ?? '2000') || 2000;
    const rateOwn = parseFloat(sto?.hourly_rate_own ?? '1600') || 1600;
    const salaryPct =
      mechUser?.mechanic_salary_pct != null && !isNaN(Number(mechUser.mechanic_salary_pct))
        ? Number(mechUser.mechanic_salary_pct)
        : 50;

    // 1. Ищем ID нарядов, где данный механик выполнял работы
    const { data: userWorks } = await (supabase.from('service_order_works') as any)
      .select('service_order_id')
      .or(`mechanic_id.eq.${mechanicId},second_mechanic_id.eq.${mechanicId}`);
    const extraOrderIds = Array.from(
      new Set((userWorks || []).map((w: any) => w.service_order_id).filter(Boolean)),
    );

    const orConditions = [
      `assigned_mechanic_id.eq.${mechanicId}`,
      `second_mechanic_id.eq.${mechanicId}`,
      `created_by.eq.${mechanicId}`,
      `status.in.(in_progress,returned,created)`,
    ];
    if (extraOrderIds.length > 0) {
      orConditions.push(`id.in.(${extraOrderIds.join(',')})`);
    }

    let query = (supabase.from('service_orders') as any)
      .select(
        `
        id, order_number, machine_type, status, lifecycle_status, priority,
        created_at, updated_at, odometer_start, odometer_end,
        problem_description, mechanic_note, admin_note,
        mechanic_pay, second_mechanic_pay,
        asset_id, asset:assets(id, short_name, reg_number, odometer_current),
        client_vehicle_id, client_vehicle_brand, client_vehicle_model, client_vehicle_reg,
        works:service_order_works(
          id, custom_work_name, status, norm_minutes, actual_minutes, price_client, quantity,
          mechanic_id, second_mechanic_id,
          work_catalog:work_catalog(id, name, norm_minutes)
        ),
        parts:service_order_parts(
          id, custom_part_name, quantity, unit, unit_price, client_price,
          part:parts(id, name, unit)
        )
      `,
      )
      .or(orConditions.join(','))
      .neq('lifecycle_status', 'cancelled')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: rawOrders, error } = await query;
    if (error) throw error;

    const orders = rawOrders ?? [];
    const orderIds = orders.map((o: any) => o.id);

    // Подтягиваем транзакции ЗП механика по этим нарядам
    const txMap = new Map<
      string,
      { amount: number; settlement_status: string; employee_confirmed: boolean | null }
    >();
    if (orderIds.length > 0 && mechanicId) {
      const { data: txs } = await (supabase.from('transactions') as any)
        .select(
          'id, amount, service_order_id, settlement_status, employee_confirmed, lifecycle_status',
        )
        .eq('related_user_id', mechanicId)
        .eq('direction', 'expense')
        .neq('lifecycle_status', 'cancelled')
        .is('from_wallet_id', null)
        .in('service_order_id', orderIds);

      (txs || []).forEach((t: any) => {
        const cur = txMap.get(t.service_order_id) || {
          amount: 0,
          settlement_status: t.settlement_status,
          employee_confirmed: t.employee_confirmed,
        };
        cur.amount += parseFloat(t.amount || '0');
        if (t.settlement_status === 'completed') cur.settlement_status = 'completed';
        if (t.employee_confirmed !== null) cur.employee_confirmed = t.employee_confirmed;
        txMap.set(t.service_order_id, cur);
      });
    }

    const enrichedOrders = orders.map((o: any) => {
      const txInfo = txMap.get(o.id);
      const isOwn = o.machine_type === 'own';
      const hourlyRate = isOwn ? rateOwn : rateClient;

      const activeWorks = (o.works ?? []).filter((w: any) => w.status !== 'cancelled');
      let totalMinutes = 0;
      let estimatedOrderPay = 0;

      for (const w of activeWorks) {
        const qty = Math.max(1, Number(w.quantity ?? 1));
        const mins = Number(w.actual_minutes || w.norm_minutes || 0) * qty;

        const isPrimary =
          w.mechanic_id === mechanicId || (!w.mechanic_id && o.assigned_mechanic_id === mechanicId);
        const isSecond =
          w.second_mechanic_id === mechanicId ||
          (!w.second_mechanic_id && !w.mechanic_id && o.second_mechanic_id === mechanicId);

        // Если механик не имеет отношения к этой работе (её выполнял другой механик в том же наряде)
        if (!isPrimary && !isSecond && (w.mechanic_id || o.assigned_mechanic_id)) {
          continue;
        }

        totalMinutes += mins;

        const explicitPrice = parseFloat(w.price_client ?? '0');
        const workClientPrice = explicitPrice > 0 ? explicitPrice : (mins / 60) * hourlyRate;

        if (isPrimary && isSecond) {
          estimatedOrderPay += (workClientPrice * salaryPct) / 100;
        } else if (isSecond || (isPrimary && (w.second_mechanic_id || o.second_mechanic_id))) {
          const halfPrice = workClientPrice / 2;
          estimatedOrderPay += (halfPrice * salaryPct) / 100;
        } else {
          estimatedOrderPay += (workClientPrice * salaryPct) / 100;
        }
      }

      const approvedPay = txInfo
        ? txInfo.amount
        : parseFloat(o.mechanic_pay || '0') > 0
          ? parseFloat(o.mechanic_pay)
          : 0;

      const effectivePay = approvedPay > 0 ? approvedPay : estimatedOrderPay;
      const orderDates = extractOrderDates(o);

      return {
        ...o,
        started_at: orderDates.started_at,
        completed_at: orderDates.completed_at,
        mechanic_note: cleanOrderNotes(o.mechanic_note),
        hourly_rate: hourlyRate,
        salary_pct: salaryPct,
        total_minutes: totalMinutes,
        estimated_pay: estimatedOrderPay.toFixed(2),
        mechanic_pay: effectivePay.toFixed(2),
        approved_pay: approvedPay.toFixed(2),
        parts_provided_by_service: (o.parts ?? []).length > 0,
        settlement_status: txInfo?.settlement_status ?? 'pending',
        employee_confirmed: txInfo?.employee_confirmed ?? null,
      };
    });

    return NextResponse.json(enrichedOrders);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/mechanic/orders — открытие / создание заказ-наряда самим механиком
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const body = await request.json();
    const mechanicId =
      body.mechanic_id ||
      cookieStore.get('salda_user_id')?.value ||
      request.headers.get('x-salda-user-id');

    if (!mechanicId) {
      return NextResponse.json({ error: 'Необходима авторизация механика' }, { status: 401 });
    }

    const {
      existing_order_id,
      order_date,
      started_at,
      completed_at,
      machine_type = 'own',
      asset_id,
      client_vehicle_model,
      client_vehicle_brand,
      client_vehicle_reg,
      odometer,
      works = [],
      parts_provided_by_service = false,
      parts = [],
      mechanic_note,
      submit_immediately = true,
    } = body as {
      existing_order_id?: string | null;
      order_date?: string;
      started_at?: string;
      completed_at?: string;
      machine_type: 'own' | 'client';
      asset_id?: string;
      client_vehicle_model?: string;
      client_vehicle_brand?: string;
      client_vehicle_reg?: string;
      odometer?: number | string | null;
      second_mechanic_id?: string | null;
      works?: Array<{
        name: string;
        minutes: number | string;
        work_catalog_id?: string;
        mechanic_id?: string;
        second_mechanic_id?: string | null;
      }>;
      parts_provided_by_service?: boolean;
      parts?: Array<{ name: string; quantity?: number | string; unit?: string }>;
      mechanic_note?: string;
      submit_immediately?: boolean;
    };

    const isOwn = machine_type === 'own';
    const odoNum = odometer != null && String(odometer).trim() !== '' ? Number(odometer) : null;

    const validWorks = (works ?? [])
      .map((w) => ({
        name: (w.name || '').trim(),
        minutes: Math.max(0, Math.round(Number(w.minutes) || 0)),
        work_catalog_id: w.work_catalog_id || null,
        mechanic_id: w.mechanic_id || null,
        second_mechanic_id: w.second_mechanic_id || null,
      }))
      .filter((w) => w.name.length > 0 && w.minutes > 0);

    if (submit_immediately && validWorks.length === 0) {
      return NextResponse.json(
        { error: 'Добавьте хотя бы одну выполненную работу с временем в минутах' },
        { status: 400 },
      );
    }

    const validParts = parts_provided_by_service
      ? (parts ?? [])
          .map((p) => ({
            name: (p.name || '').trim(),
            quantity: Math.max(0.1, parseFloat(String(p.quantity ?? 1)) || 1),
            unit: (p.unit || 'шт').trim() || 'шт',
          }))
          .filter((p) => p.name.length > 0)
      : [];

    const supabase = createAdminClient();

    const [{ data: sto }, { data: mechUser }] = await Promise.all([
      (supabase.from('sto_settings') as any)
        .select('hourly_rate, hourly_rate_own')
        .limit(1)
        .maybeSingle(),
      (supabase.from('users') as any)
        .select('id, name, mechanic_salary_pct')
        .eq('id', mechanicId)
        .maybeSingle(),
    ]);

    const rateClient = parseFloat(sto?.hourly_rate ?? '2000') || 2000;
    const rateOwn = parseFloat(sto?.hourly_rate_own ?? '1600') || 1600;
    const hourlyRate = isOwn ? rateOwn : rateClient;
    const salaryPct =
      mechUser?.mechanic_salary_pct != null && !isNaN(Number(mechUser.mechanic_salary_pct))
        ? Number(mechUser.mechanic_salary_pct)
        : 50;

    let secondSalaryPct = 50;
    const cleanSecondMechId =
      body.second_mechanic_id && body.second_mechanic_id !== mechanicId
        ? String(body.second_mechanic_id)
        : null;

    if (cleanSecondMechId) {
      const { data: secondUser } = await (supabase.from('users') as any)
        .select('id, name, mechanic_salary_pct')
        .eq('id', cleanSecondMechId)
        .maybeSingle();
      if (
        secondUser?.mechanic_salary_pct != null &&
        !isNaN(Number(secondUser.mechanic_salary_pct))
      ) {
        secondSalaryPct = Number(secondUser.mechanic_salary_pct);
      }
    }

    // ── СЦЕНАРИЙ 1: Добавление работ в УЖЕ ОТКРЫТЫЙ заказ-наряд на СТО ──
    const existingOrderId = existing_order_id ? String(existing_order_id) : null;
    if (existingOrderId) {
      const { data: existingOrder, error: fetchErr } = await (
        supabase.from('service_orders') as any
      )
        .select('*')
        .eq('id', existingOrderId)
        .single();

      if (fetchErr || !existingOrder) {
        return NextResponse.json({ error: 'Заказ-наряд не найден' }, { status: 404 });
      }

      const isOrderOwn = existingOrder.machine_type === 'own';
      const orderRate = isOrderOwn ? rateOwn : rateClient;

      // 1. Вставляем работы в существующий наряд (salary_paid = false, так как наряд еще в работе)
      if (validWorks.length > 0) {
        const worksInsert = validWorks.map((w) => {
          const priceClient = ((w.minutes / 60) * orderRate).toFixed(2);
          const wMech1 =
            w.mechanic_id && w.mechanic_id === cleanSecondMechId && !w.second_mechanic_id
              ? cleanSecondMechId
              : w.mechanic_id || mechanicId;
          const wMech2 =
            w.second_mechanic_id ||
            (cleanSecondMechId && (!w.mechanic_id || w.mechanic_id === mechanicId)
              ? cleanSecondMechId
              : null);

          return {
            service_order_id: existingOrderId,
            work_catalog_id: w.work_catalog_id,
            custom_work_name: w.name,
            norm_minutes: w.minutes,
            actual_minutes: w.minutes,
            price_client: priceClient,
            quantity: 1,
            status: submit_immediately ? 'completed' : 'in_progress',
            salary_paid: false,
            mechanic_id: wMech1,
            second_mechanic_id: wMech2,
          };
        });

        const { error: worksErr } = await (supabase.from('service_order_works') as any).insert(
          worksInsert,
        );
        if (worksErr) throw worksErr;
      }

      // 2. Вставляем запчасти автосервиса
      if (validParts.length > 0) {
        const partsInsert = validParts.map((p) => ({
          service_order_id: existingOrderId,
          custom_part_name: p.name,
          quantity: p.quantity,
          unit: p.unit,
          unit_price: '0.00',
          client_price: '0.00',
          status: 'reserved',
        }));

        const { error: partsErr } = await (supabase.from('service_order_parts') as any).insert(
          partsInsert,
        );
        if (partsErr) throw partsErr;
      }

      // 3. Обновляем назначения механиков и заметки (без закрытия наряда)
      const updatePayload: any = {
        updated_at: new Date().toISOString(),
      };
      if (!existingOrder.assigned_mechanic_id) {
        updatePayload.assigned_mechanic_id = mechanicId;
      } else if (
        existingOrder.assigned_mechanic_id !== mechanicId &&
        !existingOrder.second_mechanic_id
      ) {
        updatePayload.second_mechanic_id = mechanicId;
      }
      if (
        odoNum &&
        odoNum > 0 &&
        (!existingOrder.odometer_end || odoNum > existingOrder.odometer_end)
      ) {
        updatePayload.odometer_end = odoNum;
      }
      if (mechanic_note?.trim()) {
        const prevNote = existingOrder.mechanic_note ? `${existingOrder.mechanic_note}; ` : '';
        updatePayload.mechanic_note = `${prevNote}${mechanic_note.trim()}`;
      }

      await (supabase.from('service_orders') as any)
        .update(updatePayload)
        .eq('id', existingOrderId);

      return NextResponse.json({
        ok: true,
        order_id: existingOrderId,
        order_number: existingOrder.order_number,
        message: `Работы успешно прикреплены к наряду #${existingOrder.order_number}`,
      });
    }

    // ── СЦЕНАРИЙ 2: Создание НОВОГО наряда с нуля ──
    if (isOwn && !asset_id) {
      return NextResponse.json({ error: 'Выберите автомобиль из автопарка' }, { status: 400 });
    }

    const cleanModel = (client_vehicle_model || client_vehicle_brand || '').trim();
    const cleanReg = (client_vehicle_reg || '').trim().toUpperCase();

    if (!isOwn) {
      if (!cleanModel) {
        return NextResponse.json(
          { error: 'Для клиентского автомобиля обязательно укажите модель' },
          { status: 400 },
        );
      }
      if (!cleanReg) {
        return NextResponse.json(
          { error: 'Для клиентского автомобиля обязательно укажите госномер' },
          { status: 400 },
        );
      }
      if (!odoNum || isNaN(odoNum) || odoNum <= 0) {
        return NextResponse.json(
          { error: 'Для клиентского автомобиля обязательно укажите пробег (одометр)' },
          { status: 400 },
        );
      }
    }

    const hasOil = validWorks.some((w) => isOilOrFilterWork(w.name));
    if (isOwn && hasOil && (!odoNum || isNaN(odoNum) || odoNum <= 0)) {
      return NextResponse.json(
        { error: 'При замене масла или фильтров обязательно укажите текущий одометр!' },
        { status: 400 },
      );
    }

    // Для клиентского авто находим или создаём карточку в client_vehicles
    let clientVehicleId: string | null = null;
    if (!isOwn && cleanReg) {
      try {
        const { data: existingCv } = await (supabase.from('client_vehicles') as any)
          .select('id')
          .ilike('reg_number', cleanReg)
          .limit(1)
          .maybeSingle();

        if (existingCv?.id) {
          clientVehicleId = existingCv.id;
          if (odoNum && odoNum > 0) {
            await (supabase.from('client_vehicles') as any)
              .update({
                odometer_last: odoNum,
                odometer_updated_at: new Date().toISOString(),
              })
              .eq('id', clientVehicleId);
          }
        } else {
          const { data: newCv } = await (supabase.from('client_vehicles') as any)
            .insert({
              brand: cleanModel,
              model: '',
              reg_number: cleanReg,
              odometer_last: odoNum && odoNum > 0 ? odoNum : null,
              odometer_updated_at: odoNum && odoNum > 0 ? new Date().toISOString() : null,
            })
            .select('id')
            .maybeSingle();
          if (newCv?.id) clientVehicleId = newCv.id;
        }
      } catch {
        // Игнорируем ошибку создания карточки клиентского авто — поля сохраняются в service_orders
      }
    }

    const startedAtIso = started_at
      ? started_at.includes('T')
        ? started_at
        : `${started_at}T08:00:00.000Z`
      : order_date
        ? `${order_date}T08:00:00.000Z`
        : new Date().toISOString();

    const completedAtIso = completed_at
      ? completed_at.includes('T')
        ? completed_at
        : `${completed_at}T17:00:00.000Z`
      : order_date
        ? `${order_date}T17:00:00.000Z`
        : new Date().toISOString();

    const createdAtIso = startedAtIso;

    const problemSummary =
      validWorks.length > 0
        ? validWorks.map((w) => w.name).join('; ')
        : body.problem_description?.trim() || 'Ремонт и обслуживание';

    const noteParts: string[] = [];
    if (parts_provided_by_service) {
      noteParts.push('[Запчасти предоставил автосервис]');
    }
    if (mechanic_note?.trim()) {
      noteParts.push(mechanic_note.trim());
    }
    let finalMechanicNote = noteParts.length > 0 ? noteParts.join(' ') : null;
    finalMechanicNote = formatOrderDatesNote(finalMechanicNote, {
      started_at: startedAtIso,
      completed_at: completedAtIso,
    });

    let totalEstimatedMechanicPay = 0;
    let totalEstimatedSecondPay = 0;
    for (const w of validWorks) {
      const workClientPrice = (w.minutes / 60) * hourlyRate;
      const isBoth = Boolean(w.second_mechanic_id || (cleanSecondMechId && !w.mechanic_id));
      const isSecondOnly =
        cleanSecondMechId && w.mechanic_id === cleanSecondMechId && !w.second_mechanic_id;

      if (isBoth) {
        const halfPrice = workClientPrice / 2;
        totalEstimatedMechanicPay += (halfPrice * salaryPct) / 100;
        totalEstimatedSecondPay += (halfPrice * secondSalaryPct) / 100;
      } else if (isSecondOnly) {
        totalEstimatedSecondPay += (workClientPrice * secondSalaryPct) / 100;
      } else {
        totalEstimatedMechanicPay += (workClientPrice * salaryPct) / 100;
      }
    }

    const orderStatus = submit_immediately ? 'completed' : 'in_progress';

    const baseInsertPayload = {
      machine_type: isOwn ? 'own' : 'client',
      asset_id: isOwn ? asset_id : null,
      client_vehicle_id: isOwn ? null : clientVehicleId,
      client_vehicle_brand: isOwn ? null : cleanModel,
      client_vehicle_model: isOwn ? null : cleanModel,
      client_vehicle_reg: isOwn ? null : cleanReg,
      odometer_start: odoNum && odoNum > 0 ? odoNum : null,
      odometer_end: odoNum && odoNum > 0 ? odoNum : null,
      problem_description: problemSummary,
      mechanic_note: finalMechanicNote,
      assigned_mechanic_id: mechanicId,
      second_mechanic_id: cleanSecondMechId,
      created_by: mechanicId,
      status: orderStatus,
      lifecycle_status: 'draft',
      payment_received: isOwn,
      mechanic_pay: totalEstimatedMechanicPay > 0 ? totalEstimatedMechanicPay.toFixed(2) : null,
      second_mechanic_pay: totalEstimatedSecondPay > 0 ? totalEstimatedSecondPay.toFixed(2) : null,
      priority: 'normal',
      created_at: createdAtIso,
      updated_at: new Date().toISOString(),
    };

    let createdOrder: any = null;
    const { data: orderWithDates, error: datesInsertErr } = await (
      supabase.from('service_orders') as any
    )
      .insert({
        ...baseInsertPayload,
        started_at: startedAtIso,
        completed_at: completedAtIso,
      })
      .select('id, order_number, status, lifecycle_status, machine_type, created_at')
      .single();

    if (!datesInsertErr && orderWithDates) {
      createdOrder = orderWithDates;
    } else {
      // Фолбэк: если физические колонки еще не созданы в БД до запуска миграции,
      // вставляем без них (даты уже зафиксированы в finalMechanicNote)
      const { data: fallbackOrder, error: fallbackErr } = await (
        supabase.from('service_orders') as any
      )
        .insert(baseInsertPayload)
        .select('id, order_number, status, lifecycle_status, machine_type, created_at')
        .single();
      if (fallbackErr) throw fallbackErr;
      createdOrder = fallbackOrder;
    }

    // Вставляем перечень работ
    if (validWorks.length > 0) {
      const worksInsert = validWorks.map((w) => {
        const priceClient = ((w.minutes / 60) * hourlyRate).toFixed(2);
        const wMech1 =
          w.mechanic_id && w.mechanic_id === cleanSecondMechId && !w.second_mechanic_id
            ? cleanSecondMechId
            : mechanicId;
        const wMech2 =
          w.second_mechanic_id ||
          (cleanSecondMechId && (!w.mechanic_id || w.mechanic_id === mechanicId)
            ? cleanSecondMechId
            : null);

        return {
          service_order_id: createdOrder.id,
          work_catalog_id: w.work_catalog_id,
          custom_work_name: w.name,
          norm_minutes: w.minutes,
          actual_minutes: w.minutes,
          price_client: priceClient,
          quantity: 1,
          status: submit_immediately ? 'completed' : 'in_progress',
          mechanic_id: wMech1,
          second_mechanic_id: wMech2,
        };
      });

      const { error: worksErr } = await (supabase.from('service_order_works') as any).insert(
        worksInsert,
      );
      if (worksErr) throw worksErr;
    }

    // Вставляем запчасти автосервиса
    if (validParts.length > 0) {
      const partsInsert = validParts.map((p) => ({
        service_order_id: createdOrder.id,
        custom_part_name: p.name,
        quantity: p.quantity,
        unit: p.unit,
        unit_price: '0.00',
        client_price: '0.00',
        status: 'reserved',
      }));

      const { error: partsErr } = await (supabase.from('service_order_parts') as any).insert(
        partsInsert,
      );
      if (partsErr) throw partsErr;
    }

    // Обновляем одометр своей машины при наличии
    if (isOwn && asset_id && odoNum && odoNum > 0) {
      if (hasOil) {
        const { data: assetData } = await (supabase.from('assets') as any)
          .select('notes')
          .eq('id', asset_id)
          .maybeSingle();

        let docsObj: Record<string, any> = {};
        const existingNotes = assetData?.notes || '';
        const match = existingNotes.match(/\[DOCS_DATA:(.*?)\]/s);
        if (match && match[1]) {
          try {
            docsObj = JSON.parse(match[1]);
          } catch {}
        } else if (existingNotes.trim().startsWith('{') && existingNotes.trim().endsWith('}')) {
          try {
            docsObj = JSON.parse(existingNotes.trim());
          } catch {}
        }

        docsObj.oil_last_km = odoNum;
        docsObj.oil_last_date = order_date || new Date().toISOString().split('T')[0];

        const cleanUserNote = existingNotes.replace(/\[DOCS_DATA:.*?\]/s, '').trim();
        const updatedNotes = cleanUserNote
          ? `${cleanUserNote}\n[DOCS_DATA:${JSON.stringify(docsObj)}]`
          : `[DOCS_DATA:${JSON.stringify(docsObj)}]`;

        await (supabase.from('assets') as any)
          .update({
            odometer_current: odoNum,
            notes: updatedNotes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', asset_id);
      } else {
        await (supabase.from('assets') as any)
          .update({
            odometer_current: odoNum,
            updated_at: new Date().toISOString(),
          })
          .eq('id', asset_id);
      }
    }

    return NextResponse.json(
      {
        ...createdOrder,
        started_at: startedAtIso,
        completed_at: completedAtIso,
        estimated_pay: totalEstimatedMechanicPay.toFixed(2),
        mechanic_pay: totalEstimatedMechanicPay.toFixed(2),
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
