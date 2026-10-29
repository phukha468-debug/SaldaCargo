/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import {
  isOilOrFilterWork,
  extractOrderDates,
  cleanOrderNotes,
  formatOrderDatesNote,
} from '@saldacargo/shared';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = createAdminClient();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const cleanNum = id.replace(/[^0-9]/g, '');

    let query = (supabase as any).from('service_orders').select(
      `
        id, order_number, status, lifecycle_status, priority, machine_type,
        problem_description, admin_note, mechanic_note,
        mechanic_pay, second_mechanic_pay,
        client_vehicle_brand, client_vehicle_model, client_vehicle_reg,
        client_name, client_phone,
        odometer_start, odometer_end,
        created_at, updated_at,
        asset:assets(id, short_name, reg_number),
        mechanic:users!service_orders_assigned_mechanic_id_fkey(id, name, roles, mechanic_salary_pct),
        second_mechanic:users!service_orders_second_mechanic_id_fkey(id, name, roles, mechanic_salary_pct),
        works:service_order_works(
          id, status, salary_paid, quantity, norm_minutes, actual_minutes, price_client, work_description,
          custom_work_name, mechanic_id, second_mechanic_id,
          work_catalog:work_catalog(id, name, norm_minutes),
          time_logs:work_time_logs(id, started_at, stopped_at, status)
        ),
        parts:service_order_parts(
          id, quantity, custom_part_name, unit, unit_price, client_price,
          part:parts(id, name, unit)
        ),
        transactions:transactions(
          id, amount, description, category_id, related_user_id,
          related_user:users!transactions_related_user_id_fkey(name, roles)
        )
      `,
    );

    if (isUuid) {
      query = query.eq('id', id);
    } else if (cleanNum) {
      query = query.or(`order_number.eq.${cleanNum},id.eq.${id}`);
    } else {
      query = query.eq('id', id);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Заказ-наряд не найден' }, { status: 404 });

    // Enrichen performers (mechanics, welders, electricians, painters) on the order and on each work
    const userIds = new Set<string>();
    if (data.assigned_mechanic_id) userIds.add(data.assigned_mechanic_id);
    if (data.second_mechanic_id) userIds.add(data.second_mechanic_id);
    for (const w of data.works ?? []) {
      if (w.mechanic_id) userIds.add(w.mechanic_id);
      if (w.second_mechanic_id) userIds.add(w.second_mechanic_id);
    }
    for (const t of data.transactions ?? []) {
      if (t.related_user_id) userIds.add(t.related_user_id);
    }

    if (userIds.size > 0) {
      const { data: usersList } = await (supabase.from('users') as any)
        .select('id, name, roles, mechanic_salary_pct')
        .in('id', Array.from(userIds));

      const userMap = new Map<string, any>();
      for (const u of usersList ?? []) {
        userMap.set(u.id, u);
      }

      if (!data.mechanic && data.assigned_mechanic_id && userMap.has(data.assigned_mechanic_id)) {
        data.mechanic = userMap.get(data.assigned_mechanic_id);
      }
      if (
        !data.second_mechanic &&
        data.second_mechanic_id &&
        userMap.has(data.second_mechanic_id)
      ) {
        data.second_mechanic = userMap.get(data.second_mechanic_id);
      }

      for (const w of data.works ?? []) {
        if (w.mechanic_id && userMap.has(w.mechanic_id)) {
          w.mechanic = userMap.get(w.mechanic_id);
        }
        if (w.second_mechanic_id && userMap.has(w.second_mechanic_id)) {
          w.second_mechanic = userMap.get(w.second_mechanic_id);
        }
      }

      for (const t of data.transactions ?? []) {
        if (t.related_user_id && userMap.has(t.related_user_id)) {
          t.related_user = userMap.get(t.related_user_id);
        }
      }

      const executorIds = new Set<string>();
      if (data.assigned_mechanic_id) executorIds.add(data.assigned_mechanic_id);
      if (data.second_mechanic_id) executorIds.add(data.second_mechanic_id);
      for (const w of data.works ?? []) {
        if (w.mechanic_id) executorIds.add(w.mechanic_id);
        if (w.second_mechanic_id) executorIds.add(w.second_mechanic_id);
      }
      for (const t of data.transactions ?? []) {
        if (t.related_user_id) executorIds.add(t.related_user_id);
      }

      data.executors = Array.from(executorIds)
        .map((uid) => userMap.get(uid))
        .filter(Boolean);
    } else {
      data.executors = [];
    }

    const orderDates = extractOrderDates(data);
    data.started_at = orderDates.started_at;
    data.completed_at = orderDates.completed_at;
    if (data.admin_note) data.admin_note = cleanOrderNotes(data.admin_note);
    if (data.mechanic_note) data.mechanic_note = cleanOrderNotes(data.mechanic_note);

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.password !== undefined && body.password !== '9111') {
      return NextResponse.json({ error: 'Неверный пароль' }, { status: 403 });
    }
    const supabase = createAdminClient();

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const cleanNum = id.replace(/[^0-9]/g, '');
    let targetId = id;
    if (!isUuid) {
      let q = (supabase.from('service_orders') as any).select('id');
      if (cleanNum) {
        q = q.or(`order_number.eq.${cleanNum},id.eq.${id}`);
      } else {
        q = q.eq('id', id);
      }
      const { data: found } = await q.maybeSingle();
      if (!found) {
        return NextResponse.json({ error: 'Заказ-наряд не найден' }, { status: 404 });
      }
      targetId = found.id;
    }

    // 1. Таймеры механиков (зависят от works)
    const { data: workIds } = await (supabase as any)
      .from('service_order_works')
      .select('id')
      .eq('service_order_id', targetId);
    if (workIds?.length) {
      await (supabase as any)
        .from('work_time_logs')
        .delete()
        .in(
          'service_order_work_id',
          workIds.map((w: any) => w.id),
        );
    }

    // 2. Запчасти
    await (supabase as any).from('service_order_parts').delete().eq('service_order_id', targetId);

    // 3. Работы
    await (supabase as any).from('service_order_works').delete().eq('service_order_id', targetId);

    // 4. Финансовые транзакции (ЗП механиков, выручка СТО)
    await (supabase as any).from('transactions').delete().eq('service_order_id', targetId);

    // 5. Заявки на закупку
    await (supabase as any).from('purchase_requests').delete().eq('service_order_id', targetId);

    // 6. Заявки на ремонт (если есть связь)
    await (supabase as any)
      .from('repair_requests')
      .update({ service_order_id: null })
      .eq('service_order_id', targetId);

    // 7. Сам наряд
    const { error } = await (supabase as any).from('service_orders').delete().eq('id', targetId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const supabase = createAdminClient();

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const cleanNum = id.replace(/[^0-9]/g, '');
    let targetId = id;
    if (!isUuid) {
      let q = (supabase.from('service_orders') as any).select('id');
      if (cleanNum) {
        q = q.or(`order_number.eq.${cleanNum},id.eq.${id}`);
      } else {
        q = q.eq('id', id);
      }
      const { data: found } = await q.maybeSingle();
      if (!found) {
        return NextResponse.json({ error: 'Заказ-наряд не найден' }, { status: 404 });
      }
      targetId = found.id;
    }

    if (body.action === 'edit_order') {
      const { data: ord, error: ordErr } = await (supabase.from('service_orders') as any)
        .select('id, machine_type, assigned_mechanic_id, admin_note, mechanic_note')
        .eq('id', targetId)
        .single();
      if (ordErr || !ord) {
        return NextResponse.json({ error: ordErr?.message ?? 'Наряд не найден' }, { status: 404 });
      }

      const { data: sto } = await (supabase.from('sto_settings') as any)
        .select('hourly_rate, hourly_rate_own')
        .limit(1)
        .maybeSingle();
      const hourlyRate =
        ord.machine_type === 'client'
          ? parseFloat(sto?.hourly_rate ?? '2000') || 2000
          : parseFloat(sto?.hourly_rate_own ?? '1600') || 1600;

      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (body.odometer_start !== undefined) {
        updates.odometer_start =
          body.odometer_start != null && String(body.odometer_start).trim() !== ''
            ? Number(body.odometer_start)
            : null;
        updates.odometer_end = updates.odometer_start;
      }
      if (body.odometer_end !== undefined) {
        updates.odometer_end =
          body.odometer_end != null && String(body.odometer_end).trim() !== ''
            ? Number(body.odometer_end)
            : null;
      }
      if (typeof body.client_vehicle_model === 'string') {
        updates.client_vehicle_model = body.client_vehicle_model.trim() || null;
        updates.client_vehicle_brand = updates.client_vehicle_model;
      }
      if (typeof body.client_vehicle_reg === 'string') {
        updates.client_vehicle_reg = body.client_vehicle_reg.trim().toUpperCase() || null;
      }
      if (typeof body.admin_note === 'string') {
        updates.admin_note = body.admin_note.trim() || null;
      }
      if (body.mechanic_pay !== undefined) {
        const mp = parseFloat(String(body.mechanic_pay));
        updates.mechanic_pay = !isNaN(mp) && mp >= 0 ? mp.toFixed(2) : null;
      }
      if (body.started_at !== undefined) {
        const sVal = body.started_at ? String(body.started_at).trim() : null;
        updates.started_at = sVal ? (sVal.includes('T') ? sVal : `${sVal}T08:00:00.000Z`) : null;
      }
      if (body.completed_at !== undefined) {
        const cVal = body.completed_at ? String(body.completed_at).trim() : null;
        updates.completed_at = cVal ? (cVal.includes('T') ? cVal : `${cVal}T17:00:00.000Z`) : null;
      }
      if (updates.started_at !== undefined || updates.completed_at !== undefined) {
        const currDates = extractOrderDates(ord ?? {});
        const effectiveStarted =
          updates.started_at !== undefined ? updates.started_at : currDates.started_at;
        const effectiveCompleted =
          updates.completed_at !== undefined ? updates.completed_at : currDates.completed_at;
        const baseNote =
          typeof updates.admin_note === 'string' ? updates.admin_note : (ord?.admin_note ?? '');
        updates.admin_note = formatOrderDatesNote(baseNote, {
          started_at: effectiveStarted as string | null,
          completed_at: effectiveCompleted as string | null,
        });
        delete updates.started_at;
        delete updates.completed_at;
      }

      if (Array.isArray(body.works)) {
        const validWorks = (body.works as any[])
          .map((w) => ({
            name: String(w.name || '').trim(),
            minutes: Math.max(1, Math.round(Number(w.minutes) || 0)),
            notes: typeof w.notes === 'string' && w.notes.trim() ? w.notes.trim() : null,
            price_client:
              w.price_client != null && !isNaN(Number(w.price_client)) && Number(w.price_client) > 0
                ? Number(w.price_client).toFixed(2)
                : ((Math.max(1, Math.round(Number(w.minutes) || 0)) / 60) * hourlyRate).toFixed(2),
          }))
          .filter((w) => w.name.length > 0);

        await (supabase.from('service_order_works') as any)
          .delete()
          .eq('service_order_id', targetId);
        if (validWorks.length > 0) {
          await (supabase.from('service_order_works') as any).insert(
            validWorks.map((w) => ({
              service_order_id: targetId,
              custom_work_name: w.name,
              norm_minutes: w.minutes,
              actual_minutes: w.minutes,
              price_client: w.price_client,
              notes: w.notes,
              quantity: 1,
              status: 'completed',
              mechanic_id: ord.assigned_mechanic_id,
            })),
          );
          updates.problem_description = validWorks.map((w) => w.name).join('; ');
        }
      }

      if (Array.isArray(body.parts)) {
        const validParts = (body.parts as any[])
          .map((p) => {
            const qty = Math.max(0.1, parseFloat(String(p.quantity ?? 1)) || 1);
            const unitPriceNum = parseFloat(String(p.unit_price ?? p.price ?? 0)) || 0;
            const clientPriceNum =
              p.client_price !== undefined &&
              p.client_price !== null &&
              String(p.client_price).trim() !== ''
                ? parseFloat(String(p.client_price)) || 0
                : unitPriceNum;
            return {
              name: String(p.name || p.custom_part_name || '').trim(),
              quantity: qty,
              unit: String(p.unit || 'шт').trim() || 'шт',
              unit_price: unitPriceNum.toFixed(2),
              client_price: clientPriceNum.toFixed(2),
            };
          })
          .filter((p) => p.name.length > 0);

        await (supabase.from('service_order_parts') as any)
          .delete()
          .eq('service_order_id', targetId);
        if (validParts.length > 0) {
          await (supabase.from('service_order_parts') as any).insert(
            validParts.map((p) => ({
              service_order_id: targetId,
              custom_part_name: p.name,
              quantity: p.quantity,
              unit: p.unit,
              unit_price: p.unit_price,
              client_price: p.client_price,
              status: 'reserved',
            })),
          );
        }
      }

      const { error: updErr } = await (supabase.from('service_orders') as any)
        .update(updates)
        .eq('id', targetId);
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
      return NextResponse.json({ ok: true, action: 'edited', id: targetId });
    }

    if (body.action === 'approve') body.lifecycle_status = 'approved';
    if (body.action === 'return') body.lifecycle_status = 'returned';
    if (body.action === 'cancel') body.lifecycle_status = 'cancelled';

    if (body.lifecycle_status === 'approved') {
      if (body.assigned_mechanic_id !== undefined || body.second_mechanic_id !== undefined) {
        const mechanicUpdate: Record<string, string | null> = {};
        if (body.assigned_mechanic_id !== undefined)
          mechanicUpdate.assigned_mechanic_id = (body.assigned_mechanic_id as string) || null;
        if (body.second_mechanic_id !== undefined)
          mechanicUpdate.second_mechanic_id = (body.second_mechanic_id as string) || null;
        await (supabase as any).from('service_orders').update(mechanicUpdate).eq('id', targetId);
      }

      const { data: order, error: orderErr } = await (supabase as any)
        .from('service_orders')
        .select(
          `id, lifecycle_status, order_number, machine_type, asset_id, client_vehicle_id, odometer_start, odometer_end,
           mechanic:users!service_orders_assigned_mechanic_id_fkey(id, name, mechanic_salary_pct),
           second_mechanic:users!service_orders_second_mechanic_id_fkey(id, name, mechanic_salary_pct),
           works:service_order_works(id, status, salary_paid, norm_minutes, actual_minutes, mechanic_id, second_mechanic_id, price_client, custom_work_name, work_description, notes, work_catalog:work_catalog(name))`,
        )
        .eq('id', targetId)
        .single();

      if (orderErr) throw orderErr;
      if (order.lifecycle_status === 'approved') {
        return NextResponse.json({ error: 'Наряд уже утверждён' }, { status: 409 });
      }

      // Проверка обязательности одометра при замене масла/фильтров
      const hasOilWork = (order.works ?? []).some(
        (w: any) =>
          isOilOrFilterWork(w.work_catalog?.name) ||
          isOilOrFilterWork(w.custom_work_name) ||
          isOilOrFilterWork(w.work_description) ||
          isOilOrFilterWork(w.notes),
      );

      const finalOdo =
        body.odometer_end != null &&
        !isNaN(Number(body.odometer_end)) &&
        Number(body.odometer_end) > 0
          ? Number(body.odometer_end)
          : body.odometer_start != null &&
              !isNaN(Number(body.odometer_start)) &&
              Number(body.odometer_start) > 0
            ? Number(body.odometer_start)
            : order.odometer_end || order.odometer_start || null;

      if (hasOilWork && (!finalOdo || finalOdo <= 0)) {
        return NextResponse.json(
          {
            error:
              'В заказ-наряде присутствует замена масла/фильтров. Ввод показаний одометра обязателен!',
          },
          { status: 400 },
        );
      }

      // Утверждаем наряд; own-машины не требуют оплаты от клиента
      const orderUpdatePayload: Record<string, unknown> = {
        status: 'completed',
        lifecycle_status: 'approved',
        payment_received: order.machine_type === 'own',
        updated_at: new Date().toISOString(),
      };
      if (typeof body.mechanic_note === 'string') {
        orderUpdatePayload.mechanic_note = body.mechanic_note;
      }
      if (body.odometer_start != null && !isNaN(Number(body.odometer_start))) {
        orderUpdatePayload.odometer_start = Number(body.odometer_start);
      }
      if (body.odometer_end != null && !isNaN(Number(body.odometer_end))) {
        orderUpdatePayload.odometer_end = Number(body.odometer_end);
      }

      await Promise.all([
        (supabase as any).from('service_orders').update(orderUpdatePayload).eq('id', targetId),
        (supabase as any)
          .from('service_order_works')
          .update({ status: 'completed' })
          .eq('service_order_id', targetId)
          .neq('status', 'cancelled'),
      ]);

      // Обновляем одометр в карточке автомобиля
      if (finalOdo && finalOdo > 0) {
        if (order.client_vehicle_id) {
          await (supabase as any)
            .from('client_vehicles')
            .update({ odometer_last: finalOdo, odometer_updated_at: new Date().toISOString() })
            .eq('id', order.client_vehicle_id);
        } else if (order.asset_id) {
          if (hasOilWork) {
            const { data: assetData } = await (supabase.from('assets') as any)
              .select('notes')
              .eq('id', order.asset_id)
              .single();

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

            docsObj.oil_last_km = finalOdo;
            docsObj.oil_last_date = new Date().toISOString().split('T')[0];

            const cleanUserNote = existingNotes.replace(/\[DOCS_DATA:.*?\]/s, '').trim();
            const updatedNotes = cleanUserNote
              ? `${cleanUserNote}\n[DOCS_DATA:${JSON.stringify(docsObj)}]`
              : `[DOCS_DATA:${JSON.stringify(docsObj)}]`;

            await (supabase as any)
              .from('assets')
              .update({
                odometer_current: finalOdo,
                notes: updatedNotes,
                updated_at: new Date().toISOString(),
              })
              .eq('id', order.asset_id);
          } else {
            await (supabase as any)
              .from('assets')
              .update({ odometer_current: finalOdo, updated_at: new Date().toISOString() })
              .eq('id', order.asset_id);
          }
        }
      }

      if (typeof body.mechanic_note === 'string' && body.mechanic_note.trim()) {
        const { data: fullOrder } = await (supabase as any)
          .from('service_orders')
          .select('client_vehicle_id, created_by')
          .eq('id', targetId)
          .single();

        if (fullOrder?.client_vehicle_id) {
          const { data: adminUser } = await (supabase as any)
            .from('users')
            .select('id')
            .filter('roles', 'cs', '{"admin"}')
            .limit(1)
            .maybeSingle();

          await (supabase as any).from('client_vehicle_recommendations').insert({
            client_vehicle_id: fullOrder.client_vehicle_id,
            service_order_id: targetId,
            text: body.mechanic_note.trim(),
            due_km: body.due_km ? Number(body.due_km) : null,
            due_date: body.due_date || null,
            created_by: adminUser?.id ?? fullOrder.created_by,
          });
        }
      }

      // Доход с наряда — только для клиентских машин, КОГДА ДЕНЬГИ ФАКТИЧЕСКИ ПОЛУЧЕНЫ
      if (order.machine_type === 'client' && body.payment_received === true) {
        const CAT_SERVICE_REVENUE = '600e7f70-2797-474d-948b-432230036d67';
        const { data: worksForRevenue } = await (supabase as any)
          .from('service_order_works')
          .select('price_client, status')
          .eq('service_order_id', targetId)
          .neq('status', 'cancelled');
        const { data: partsForRevenue } = await (supabase as any)
          .from('service_order_parts')
          .select('client_price, unit_price, quantity')
          .eq('service_order_id', targetId);

        const worksTotal = ((worksForRevenue ?? []) as any[]).reduce(
          (s: number, w: any) => s + parseFloat(w.price_client ?? '0'),
          0,
        );
        const partsTotal = ((partsForRevenue ?? []) as any[]).reduce(
          (s: number, p: any) =>
            s +
            (parseFloat(p.client_price ?? p.unit_price ?? '0') || 0) *
              (parseFloat(p.quantity ?? '1') || 1),
          0,
        );
        const revenueTotal = worksTotal + partsTotal;

        if (revenueTotal > 0) {
          const GARAGE_WALLET_ID = '10000000-0000-0000-0000-000000000005';
          const { data: adminForRevenue } = await (supabase as any)
            .from('users')
            .select('id')
            .filter('roles', 'cs', '{"admin"}')
            .limit(1)
            .maybeSingle();
          await (supabase as any).from('transactions').insert({
            direction: 'income',
            lifecycle_status: 'approved',
            settlement_status: 'completed',
            amount: revenueTotal.toFixed(2),
            category_id: CAT_SERVICE_REVENUE,
            service_order_id: targetId,
            to_wallet_id: GARAGE_WALLET_ID,
            created_by: adminForRevenue?.id ?? null,
            description: `Выручка — наряд #${order.order_number}`,
            idempotency_key: crypto.randomUUID(),
          });
        }
      }

      // Расход с наряда — для своих машин (сторонний ремонт или покупка запчастей)
      if (order.machine_type === 'own') {
        const isExt = Boolean(
          (order.admin_note && order.admin_note.includes('[Сторонний сервис')) ||
          (order.problem_description && order.problem_description.includes('[Сторонний сервис')),
        );
        if (isExt) {
          const { data: existingTx } = await (supabase as any)
            .from('transactions')
            .select('id')
            .eq('service_order_id', targetId)
            .limit(1)
            .maybeSingle();

          if (!existingTx) {
            const { data: worksForCost } = await (supabase as any)
              .from('service_order_works')
              .select('price_client, status')
              .eq('service_order_id', targetId)
              .neq('status', 'cancelled');
            const { data: partsForCost } = await (supabase as any)
              .from('service_order_parts')
              .select('client_price, unit_price, quantity')
              .eq('service_order_id', targetId);

            const worksTotal = ((worksForCost ?? []) as any[]).reduce(
              (s: number, w: any) => s + parseFloat(w.price_client ?? '0'),
              0,
            );
            const partsTotal = ((partsForCost ?? []) as any[]).reduce(
              (s: number, p: any) =>
                s +
                (parseFloat(p.client_price ?? p.unit_price ?? '0') || 0) *
                  (parseFloat(p.quantity ?? '1') || 1),
              0,
            );
            const costTotal = worksTotal + partsTotal;

            const paymentWallet =
              body.payment_wallet_id === 'none'
                ? null
                : body.payment_wallet_id || '10000000-0000-0000-0000-000000000002';

            if (costTotal > 0 && paymentWallet) {
              const REPAIR_EXTERNAL_CAT = '8c5f3080-d0a8-49ea-b759-3286f2084940';
              const { data: adminUser } = await (supabase as any)
                .from('users')
                .select('id')
                .filter('roles', 'cs', '{"admin"}')
                .limit(1)
                .maybeSingle();

              await (supabase as any).from('transactions').insert({
                direction: 'expense',
                amount: costTotal.toFixed(2),
                category_id: REPAIR_EXTERNAL_CAT,
                from_wallet_id: paymentWallet,
                to_wallet_id: null,
                asset_id: order.asset_id || null,
                service_order_id: targetId,
                lifecycle_status: 'approved',
                settlement_status: 'completed',
                transaction_date: order.created_at || new Date().toISOString(),
                created_at: order.created_at || new Date().toISOString(),
                description: `Наряд ТО #${order.order_number}: ${order.problem_description || 'Сторонний ремонт'}`,
                idempotency_key: crypto.randomUUID(),
                created_by: adminUser?.id ?? null,
              });
            }
          }
        }
      }

      // Начисляем ЗП механикам
      const unpaidWorks = (order.works ?? []).filter(
        (w: any) => w.status !== 'cancelled' && !w.salary_paid,
      );
      const manualPays = body.mechanic_pays as Record<string, number> | undefined;
      const hasManualPay = manualPays && Object.keys(manualPays).length > 0;

      if (hasManualPay || unpaidWorks.length > 0) {
        const CAT_PAYROLL_MECHANIC = '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6';
        const { data: adminUser } = await (supabase as any)
          .from('users')
          .select('id')
          .filter('roles', 'cs', '{"admin"}')
          .limit(1)
          .maybeSingle();
        const createdBy = adminUser?.id ?? null;
        const txns: any[] = [];
        const payMap: Record<string, string> = {}; // Keep empty unless needed for legacy

        if (hasManualPay) {
          const mechanicIds = Object.keys(manualPays);
          if (mechanicIds.length > 0) {
            const { data: mechs } = await (supabase as any)
              .from('users')
              .select('id, name')
              .in('id', mechanicIds);

            for (const mech of mechs || []) {
              const salary = parseFloat(String(manualPays[mech.id]));
              if (isNaN(salary) || salary <= 0) continue;

              txns.push({
                direction: 'expense',
                lifecycle_status: 'approved',
                settlement_status: 'pending',
                from_wallet_id: null,
                employee_confirmed: false,
                amount: salary.toFixed(2),
                category_id: CAT_PAYROLL_MECHANIC,
                related_user_id: mech.id,
                service_order_id: targetId,
                created_by: createdBy,
                description: `ЗП механика ${mech.name} — наряд #${order.order_number}`,
                idempotency_key: crypto.randomUUID(),
              });
              if (!payMap.mechanic_pay) payMap.mechanic_pay = salary.toFixed(2);
            }
          }
        } else {
          // Автоматический расчёт на основе нормо-часов для каждой неоплаченной работы отдельно
          const { data: stoSettings } = await (supabase as any)
            .from('sto_settings')
            .select('hourly_rate, hourly_rate_own')
            .limit(1)
            .maybeSingle();
          const defaultHourlyRate =
            order.machine_type === 'client'
              ? parseFloat(stoSettings?.hourly_rate ?? '2000') || 2000
              : parseFloat(stoSettings?.hourly_rate_own ?? '1600') || 1600;

          // Сначала получим данные механиков для этих работ
          const mechanicIds = [
            ...new Set(
              unpaidWorks
                .flatMap((w: any) => [w.mechanic_id, w.second_mechanic_id])
                .filter(Boolean),
            ),
          ];

          let specificMechanics: any[] = [];
          if (mechanicIds.length > 0) {
            const { data: mechs } = await (supabase as any)
              .from('users')
              .select('id, name, mechanic_salary_pct')
              .in('id', mechanicIds);
            if (mechs) specificMechanics = mechs;
          }

          const getWorkPct = (
            w: any,
            defaultUserPct: string | number | null | undefined,
          ): number => {
            if (w.notes) {
              const match = String(w.notes).match(/\[salary_pct:(\d+(?:\.\d+)?)\]/);
              if (match && match[1]) {
                const pct = parseFloat(match[1]);
                if (pct >= 0 && pct <= 100) return pct;
              }
            }
            if (defaultUserPct != null && !isNaN(Number(defaultUserPct))) {
              const pct = Number(defaultUserPct);
              if (pct >= 0 && pct <= 100) return pct;
            }
            return 50;
          };

          let totalPrimaryPay = 0;

          for (const work of unpaidWorks) {
            const workMechs = [work.mechanic_id, work.second_mechanic_id].filter(Boolean);
            const targetMechs =
              workMechs.length > 0
                ? specificMechanics.filter((m) => workMechs.includes(m.id))
                : [order.mechanic, order.second_mechanic].filter(Boolean);

            if (targetMechs.length === 0) continue;

            const explicitPrice = parseFloat(work.price_client ?? '0');
            const mins = Number(work.actual_minutes ?? work.norm_minutes ?? 0);
            const workPrice =
              explicitPrice > 0 ? explicitPrice : mins > 0 ? (mins / 60) * defaultHourlyRate : 0;
            if (workPrice <= 0) continue;

            const basePrice = targetMechs.length === 2 ? workPrice / 2 : workPrice;
            const workName = work.work_catalog?.name ?? work.custom_work_name ?? 'работа';

            for (const mechData of targetMechs) {
              if (!mechData) continue;

              const pct = getWorkPct(work, mechData.mechanic_salary_pct);
              const salary = (basePrice * pct) / 100;

              if (salary <= 0) continue;
              totalPrimaryPay += salary;

              txns.push({
                direction: 'expense',
                lifecycle_status: 'approved',
                settlement_status: 'pending',
                from_wallet_id: null,
                employee_confirmed: false,
                amount: salary.toFixed(2),
                category_id: CAT_PAYROLL_MECHANIC,
                related_user_id: mechData.id,
                service_order_id: targetId,
                created_by: createdBy,
                description: `ЗП механика ${mechData.name} — наряд #${order.order_number}: ${workName} (${pct}% от ${Math.round(basePrice).toLocaleString('ru-RU')} ₽)`,
                idempotency_key: crypto.randomUUID(),
              });
            }
          }
          if (totalPrimaryPay > 0) {
            payMap.mechanic_pay = totalPrimaryPay.toFixed(2);
          }
        }

        if (txns.length > 0 || Object.keys(payMap).length > 0) {
          await Promise.all([
            txns.length > 0
              ? (supabase as any).from('transactions').insert(txns)
              : Promise.resolve(),
            unpaidWorks.length > 0
              ? (supabase as any)
                  .from('service_order_works')
                  .update({ salary_paid: true })
                  .in(
                    'id',
                    unpaidWorks.map((w: any) => w.id),
                  )
              : Promise.resolve(),
            Object.keys(payMap).length > 0
              ? (supabase as any)
                  .from('service_orders')
                  .update({ ...payMap, updated_at: new Date().toISOString() })
                  .eq('id', targetId)
              : Promise.resolve(),
          ]);
        }
      }

      return NextResponse.json({ id: targetId, lifecycle_status: 'approved' });
    }

    // Handle lifecycle changes other than 'approved' (e.g. returned, cancelled)
    if ('lifecycle_status' in body && body.lifecycle_status !== 'approved') {
      const returnUpdates: Record<string, unknown> = {
        lifecycle_status: body.lifecycle_status,
        updated_at: new Date().toISOString(),
      };
      if (typeof body.admin_note === 'string') {
        returnUpdates.admin_note = body.admin_note.trim() || null;
      }

      // При возврате наряда — откатываем финансы: удаляем транзакции и сбрасываем salary_paid
      if (body.lifecycle_status === 'returned') {
        returnUpdates.status = 'in_progress';
        await Promise.all([
          (supabase as any).from('transactions').delete().eq('service_order_id', targetId),
          (supabase as any)
            .from('service_order_works')
            .update({ salary_paid: false })
            .eq('service_order_id', targetId),
        ]);
      } else if (body.lifecycle_status === 'cancelled') {
        returnUpdates.status = 'cancelled';
        await (supabase as any).from('transactions').delete().eq('service_order_id', targetId);
      }

      await (supabase as any).from('service_orders').update(returnUpdates).eq('id', targetId);
      return NextResponse.json({ id: targetId, lifecycle_status: body.lifecycle_status });
    }

    const allowed = [
      'status',
      'priority',
      'assigned_mechanic_id',
      'second_mechanic_id',
      'admin_note',
      'mechanic_note',
      'odometer_start',
      'odometer_end',
      'is_ready_for_pickup',
      'payment_received',
      'started_at',
      'completed_at',
    ];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }
    if (body.started_at !== undefined) {
      const sVal = body.started_at ? String(body.started_at).trim() : null;
      updates.started_at = sVal ? (sVal.includes('T') ? sVal : `${sVal}T08:00:00.000Z`) : null;
    }
    if (body.completed_at !== undefined) {
      const cVal = body.completed_at ? String(body.completed_at).trim() : null;
      updates.completed_at = cVal ? (cVal.includes('T') ? cVal : `${cVal}T17:00:00.000Z`) : null;
    }
    if (updates.started_at !== undefined || updates.completed_at !== undefined) {
      const { data: currOrd } = await (supabase.from('service_orders') as any)
        .select('id, admin_note, mechanic_note')
        .eq('id', targetId)
        .single();
      const currDates = extractOrderDates(currOrd ?? {});
      const effectiveStarted =
        updates.started_at !== undefined ? updates.started_at : currDates.started_at;
      const effectiveCompleted =
        updates.completed_at !== undefined ? updates.completed_at : currDates.completed_at;
      const baseNote =
        typeof updates.admin_note === 'string' ? updates.admin_note : (currOrd?.admin_note ?? '');
      updates.admin_note = formatOrderDatesNote(baseNote, {
        started_at: effectiveStarted as string | null,
        completed_at: effectiveCompleted as string | null,
      });
      delete updates.started_at;
      delete updates.completed_at;
    }

    if (updates.status === 'completed') {
      const { data: ord } = await (supabase as any)
        .from('service_orders')
        .select(
          `id, asset_id, odometer_start, odometer_end, works:service_order_works(custom_work_name, work_description, notes, work_catalog:work_catalog(name))`,
        )
        .eq('id', targetId)
        .single();

      if (ord) {
        const hasOil = (ord.works || []).some(
          (w: any) =>
            isOilOrFilterWork(w.work_catalog?.name) ||
            isOilOrFilterWork(w.custom_work_name) ||
            isOilOrFilterWork(w.work_description) ||
            isOilOrFilterWork(w.notes),
        );
        const odoToCheck =
          updates.odometer_end ?? updates.odometer_start ?? ord.odometer_end ?? ord.odometer_start;
        if (hasOil && (!odoToCheck || Number(odoToCheck) <= 0)) {
          return NextResponse.json(
            { error: 'При замене масла или фильтров ввод одометра обязателен!' },
            { status: 400 },
          );
        }
      }
    }

    if (updates.payment_received === true) {
      // Создаем доходную транзакцию выручки при фактическом получении денег
      const { data: existingRevenueTx } = await (supabase as any)
        .from('transactions')
        .select('id')
        .eq('service_order_id', targetId)
        .eq('direction', 'income')
        .maybeSingle();

      if (!existingRevenueTx) {
        const { data: ord } = await (supabase as any)
          .from('service_orders')
          .select(
            `id, order_number, machine_type,
             works:service_order_works(price_client, status),
             parts:service_order_parts(client_price, unit_price, quantity)`,
          )
          .eq('id', targetId)
          .single();

        if (ord && ord.machine_type === 'client') {
          const worksTotal = ((ord.works ?? []) as any[])
            .filter((w: any) => w.status !== 'cancelled')
            .reduce((s: number, w: any) => s + parseFloat(w.price_client ?? '0'), 0);
          const partsTotal = ((ord.parts ?? []) as any[]).reduce(
            (s: number, p: any) =>
              s +
              (parseFloat(p.client_price ?? p.unit_price ?? '0') || 0) *
                (parseFloat(p.quantity ?? '1') || 1),
            0,
          );
          const revenueTotal = worksTotal + partsTotal;

          if (revenueTotal > 0) {
            const CAT_SERVICE_REVENUE = '600e7f70-2797-474d-948b-432230036d67';
            const GARAGE_WALLET_ID =
              (body.to_wallet_id as string) || '10000000-0000-0000-0000-000000000005';
            const { data: adminForRevenue } = await (supabase as any)
              .from('users')
              .select('id')
              .filter('roles', 'cs', '{"admin"}')
              .limit(1)
              .maybeSingle();

            await (supabase as any).from('transactions').insert({
              direction: 'income',
              lifecycle_status: 'approved',
              settlement_status: 'completed',
              amount: revenueTotal.toFixed(2),
              category_id: CAT_SERVICE_REVENUE,
              service_order_id: targetId,
              to_wallet_id: GARAGE_WALLET_ID,
              created_by: adminForRevenue?.id ?? null,
              description: `Выручка — наряд #${ord.order_number}`,
              idempotency_key: crypto.randomUUID(),
            });
          }
        }
      }
    } else if (updates.payment_received === false) {
      // Если оплату отменили — удаляем ошибочно созданную доходную транзакцию
      await (supabase as any)
        .from('transactions')
        .delete()
        .eq('service_order_id', targetId)
        .eq('direction', 'income');
    }

    const { data, error } = await (supabase as any)
      .from('service_orders')
      .update(updates)
      .eq('id', targetId)
      .select(
        'id, status, priority, admin_note, mechanic_note, assigned_mechanic_id, lifecycle_status, created_at, updated_at',
      )
      .single();

    if (error) throw error;
    const dates = extractOrderDates(data);
    const retData = {
      ...data,
      started_at: dates.started_at,
      completed_at: dates.completed_at,
    };
    if (retData.admin_note) retData.admin_note = cleanOrderNotes(retData.admin_note);
    return NextResponse.json(retData);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка' }, { status: 500 });
  }
}
