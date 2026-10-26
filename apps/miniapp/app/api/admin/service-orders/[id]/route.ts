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

const PAYROLL_MECHANIC_CAT = '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6';

async function resolveAdminId(
  request: Request,
  cookieStore: any,
  supabase: any,
  bodyAdminId?: string,
): Promise<string | null> {
  const explicit =
    bodyAdminId ||
    cookieStore.get('salda_user_id')?.value ||
    request.headers.get('x-salda-user-id') ||
    null;
  if (explicit) return explicit;

  const { data: adminUser } = await (supabase.from('users') as any)
    .select('id')
    .filter('roles', 'cs', '{"admin"}')
    .limit(1)
    .maybeSingle();
  return adminUser?.id ?? null;
}

/** GET /api/admin/service-orders/:id */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = createAdminClient();
    const { data, error } = await (supabase.from('service_orders') as any)
      .select(
        `
        id, order_number, machine_type, status, lifecycle_status, priority, payment_received,
        problem_description, mechanic_note, admin_note, created_at, updated_at,
        mechanic_pay, second_mechanic_pay, odometer_start, odometer_end,
        asset_id, asset:assets(id, short_name, reg_number, odometer_current),
        assigned_mechanic_id, mechanic:users!service_orders_assigned_mechanic_id_fkey(id, name, mechanic_salary_pct),
        second_mechanic_id, second_mechanic:users!service_orders_second_mechanic_id_fkey(id, name, mechanic_salary_pct),
        client_vehicle_id, client_vehicle_brand, client_vehicle_model, client_vehicle_reg,
        client_name, client_phone,
        works:service_order_works(
          id, custom_work_name, work_description, status, salary_paid, actual_minutes, price_client, norm_minutes, quantity, mechanic_id, second_mechanic_id,
          work_catalog:work_catalog(id, name, norm_minutes)
        ),
        parts:service_order_parts(
          id, custom_part_name, quantity, unit_price, client_price, unit,
          part:parts(id, name, unit)
        )
      `,
      )
      .eq('id', id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Заказ-наряд не найден' }, { status: 404 });

    const orderDates = extractOrderDates(data);
    data.started_at = orderDates.started_at;
    data.completed_at = orderDates.completed_at;
    if (data.admin_note) data.admin_note = cleanOrderNotes(data.admin_note);
    if (data.mechanic_note) data.mechanic_note = cleanOrderNotes(data.mechanic_note);

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

/** PATCH /api/admin/service-orders/:id */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const body = (await request.json()) as {
    action?:
      | 'approve'
      | 'return'
      | 'cancel'
      | 'edit_note'
      | 'edit_order'
      | 'approve_extra_work'
      | 'reject_extra_work';
    lifecycle_status?: string;
    admin_id?: string;
    admin_note?: string;
    mechanic_note?: string;
    adjusted_norm_minutes?: number;
    mechanic_pay?: number | string;
    work_id?: string;
    mechanic_id?: string;
    second_mechanic_id?: string;
    odometer_start?: number | string | null;
    odometer_end?: number | string | null;
    client_vehicle_model?: string;
    client_vehicle_reg?: string;
    started_at?: string;
    completed_at?: string;
    works?: Array<{
      id?: string;
      name: string;
      minutes: number | string;
      price_client?: number | string;
    }>;
    parts?: Array<{
      id?: string;
      name: string;
      quantity: number | string;
      unit?: string;
      client_price?: number | string;
    }>;
  };

  const supabase = createAdminClient();
  const adminId = await resolveAdminId(request, cookieStore, supabase, body.admin_id);
  const action =
    body.action ||
    (body.lifecycle_status === 'approved'
      ? 'approve'
      : body.lifecycle_status === 'returned'
        ? 'return'
        : body.lifecycle_status === 'cancelled'
          ? 'cancel'
          : undefined);

  // ── Редактирование заказ-наряда на ревью ──────────────────────────────
  if (action === 'edit_order') {
    const { data: ord, error: ordErr } = await (supabase.from('service_orders') as any)
      .select('id, machine_type, assigned_mechanic_id')
      .eq('id', id)
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
    if (body.client_vehicle_model !== undefined) {
      updates.client_vehicle_model = body.client_vehicle_model.trim() || null;
      updates.client_vehicle_brand = updates.client_vehicle_model;
    }
    if (body.client_vehicle_reg !== undefined) {
      updates.client_vehicle_reg = body.client_vehicle_reg.trim().toUpperCase() || null;
    }
    if (body.admin_note !== undefined) {
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
      updates.admin_note = formatOrderDatesNote(updates.admin_note ?? (ord as any).admin_note, {
        started_at: updates.started_at,
        completed_at: updates.completed_at,
      });
    }

    if (Array.isArray(body.works)) {
      const validWorks = body.works
        .map((w) => ({
          name: (w.name || '').trim(),
          minutes: Math.max(1, Math.round(Number(w.minutes) || 0)),
          price_client:
            w.price_client != null && !isNaN(Number(w.price_client)) && Number(w.price_client) > 0
              ? Number(w.price_client).toFixed(2)
              : ((Math.max(1, Math.round(Number(w.minutes) || 0)) / 60) * hourlyRate).toFixed(2),
        }))
        .filter((w) => w.name.length > 0);

      await (supabase.from('service_order_works') as any).delete().eq('service_order_id', id);
      if (validWorks.length > 0) {
        await (supabase.from('service_order_works') as any).insert(
          validWorks.map((w) => ({
            service_order_id: id,
            custom_work_name: w.name,
            norm_minutes: w.minutes,
            actual_minutes: w.minutes,
            price_client: w.price_client,
            quantity: 1,
            status: 'completed',
            mechanic_id: ord.assigned_mechanic_id,
          })),
        );
        updates.problem_description = validWorks.map((w) => w.name).join('; ');
      }
    }

    if (Array.isArray(body.parts)) {
      const validParts = body.parts
        .map((p) => ({
          name: (p.name || '').trim(),
          quantity: Math.max(0.1, parseFloat(String(p.quantity ?? 1)) || 1),
          unit: (p.unit || 'шт').trim() || 'шт',
          client_price: (parseFloat(String(p.client_price ?? 0)) || 0).toFixed(2),
        }))
        .filter((p) => p.name.length > 0);

      await (supabase.from('service_order_parts') as any).delete().eq('service_order_id', id);
      if (validParts.length > 0) {
        await (supabase.from('service_order_parts') as any).insert(
          validParts.map((p) => ({
            service_order_id: id,
            custom_part_name: p.name,
            quantity: p.quantity,
            unit: p.unit,
            unit_price: p.client_price,
            client_price: p.client_price,
            status: 'reserved',
          })),
        );
      }
    }

    let updErr: any = null;
    const resWithDates = await (supabase.from('service_orders') as any)
      .update(updates)
      .eq('id', id);
    if (resWithDates.error) {
      const fallbackUpdates = { ...updates };
      delete fallbackUpdates.started_at;
      delete fallbackUpdates.completed_at;
      const resFallback = await (supabase.from('service_orders') as any)
        .update(fallbackUpdates)
        .eq('id', id);
      updErr = resFallback.error;
    } else {
      updErr = resWithDates.error;
    }
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'edited' });
  }

  // ── Утверждение наряда + начисление ЗП ────────────────────────────────
  if (action === 'approve') {
    if (body.mechanic_id !== undefined || body.second_mechanic_id !== undefined) {
      await (supabase.from('service_orders') as any)
        .update({
          assigned_mechanic_id: body.mechanic_id || null,
          second_mechanic_id: body.second_mechanic_id || null,
        })
        .eq('id', id);
    }

    const { data: order, error: orderErr } = await (supabase.from('service_orders') as any)
      .select(
        `
        id, order_number, asset_id, client_vehicle_id, machine_type, odometer_start, odometer_end,
        lifecycle_status, mechanic_pay,
        mechanic:users!service_orders_assigned_mechanic_id_fkey(id, name, mechanic_salary_pct),
        second_mechanic:users!service_orders_second_mechanic_id_fkey(id, name, mechanic_salary_pct),
        service_order_works(id, norm_minutes, actual_minutes, price_client, quantity, status, extra_work_status, custom_work_name, work_description, work_catalog:work_catalog(name))
      `,
      )
      .eq('id', id)
      .single();

    if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });
    if (order.lifecycle_status === 'approved') {
      return NextResponse.json({ ok: true, action: 'already_approved' });
    }

    // Проверка обязательности одометра при замене масла/фильтров
    const hasOilWork = (order.service_order_works ?? []).some(
      (w: any) =>
        isOilOrFilterWork(w.work_catalog?.name) ||
        isOilOrFilterWork(w.custom_work_name) ||
        isOilOrFilterWork(w.work_description),
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

    const approvedNm = body.adjusted_norm_minutes ?? null;
    const works = (order.service_order_works ?? []).filter(
      (w: any) => w.status !== 'cancelled' && w.extra_work_status !== 'rejected',
    );
    const totalNm =
      approvedNm ??
      works.reduce(
        (sum: number, w: any) =>
          sum +
          Number(w.actual_minutes ?? w.norm_minutes ?? 0) * Math.max(1, Number(w.quantity ?? 1)),
        0,
      );

    const [{ data: settings }, { data: existingPayrollTx }] = await Promise.all([
      (supabase.from('sto_settings') as any)
        .select('hourly_rate, hourly_rate_own')
        .limit(1)
        .maybeSingle(),
      (supabase.from('transactions') as any)
        .select('id')
        .eq('service_order_id', id)
        .eq('category_id', PAYROLL_MECHANIC_CAT)
        .neq('lifecycle_status', 'cancelled')
        .limit(1)
        .maybeSingle(),
    ]);

    const hourlyRate =
      order.machine_type === 'client'
        ? parseFloat(settings?.hourly_rate ?? '2000') || 2000
        : parseFloat(settings?.hourly_rate_own ?? '1600') || 1600;

    const accruals: string[] = [];
    const mechanics = [order.mechanic, order.second_mechanic].filter(Boolean);
    const totalNmHours = totalNm / 60;
    const nmPerMechanic = mechanics.length === 2 ? totalNmHours / 2 : totalNmHours;

    const manualOverridePay =
      body.mechanic_pay != null &&
      !isNaN(Number(body.mechanic_pay)) &&
      Number(body.mechanic_pay) > 0
        ? Number(body.mechanic_pay)
        : null;

    let primaryMechanicPay: string | null = null;

    if (!existingPayrollTx) {
      for (let idx = 0; idx < mechanics.length; idx++) {
        const mech = mechanics[idx];
        if (!mech?.id) continue;
        const pct = (parseFloat(mech.mechanic_salary_pct ?? '50') || 50) / 100;
        const calcSalary =
          manualOverridePay != null && mechanics.length === 1
            ? manualOverridePay
            : nmPerMechanic * hourlyRate * pct;
        const salary = calcSalary.toFixed(2);
        if (idx === 0) primaryMechanicPay = salary;
        accruals.push(`${mech.name || mech.id}: ${salary} ₽`);

        if (calcSalary > 0) {
          await (supabase.from('transactions') as any).insert({
            direction: 'expense',
            category_id: PAYROLL_MECHANIC_CAT,
            amount: salary,
            service_order_id: id,
            related_user_id: mech.id,
            lifecycle_status: 'approved',
            settlement_status: 'pending',
            from_wallet_id: null,
            employee_confirmed: false,
            description:
              `ЗП механика ${mech.name || ''}: наряд #${order.order_number || id.slice(0, 6)}`.trim(),
            created_by: adminId,
            idempotency_key: crypto.randomUUID(),
          });
        }
      }
    }

    const updatePayload: Record<string, unknown> = {
      status: 'completed',
      lifecycle_status: 'approved',
      payment_received: order.machine_type === 'own',
      approved_by: adminId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      admin_note: body.admin_note ?? null,
    };
    if (primaryMechanicPay) {
      updatePayload.mechanic_pay = primaryMechanicPay;
    }
    if (body.odometer_start != null && !isNaN(Number(body.odometer_start))) {
      updatePayload.odometer_start = Number(body.odometer_start);
    }
    if (body.odometer_end != null && !isNaN(Number(body.odometer_end))) {
      updatePayload.odometer_end = Number(body.odometer_end);
    }

    const [{ error }] = await Promise.all([
      (supabase.from('service_orders') as any).update(updatePayload).eq('id', id),
      (supabase.from('service_order_works') as any)
        .update({ status: 'completed', salary_paid: true })
        .eq('service_order_id', id)
        .neq('status', 'cancelled'),
    ]);

    // Обновляем одометр в карточке авто
    if (finalOdo && finalOdo > 0) {
      if (order.client_vehicle_id) {
        await (supabase.from('client_vehicles') as any)
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

          await (supabase.from('assets') as any)
            .update({
              odometer_current: finalOdo,
              notes: updatedNotes,
              updated_at: new Date().toISOString(),
            })
            .eq('id', order.asset_id);
        } else {
          await (supabase.from('assets') as any)
            .update({ odometer_current: finalOdo, updated_at: new Date().toISOString() })
            .eq('id', order.asset_id);
        }
      }
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'approved', accruals });
  }

  // ── Возврат на доработку ───────────────────────────────────────────────
  if (action === 'return') {
    await (supabase.from('transactions') as any).delete().eq('service_order_id', id);
    await (supabase.from('service_order_works') as any)
      .update({ salary_paid: false })
      .eq('service_order_id', id);

    const { error } = await (supabase.from('service_orders') as any)
      .update({
        lifecycle_status: 'returned',
        status: 'in_progress',
        admin_note: body.admin_note ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'returned' });
  }

  // ── Отмена ────────────────────────────────────────────────────────────
  if (action === 'cancel') {
    await (supabase.from('transactions') as any).delete().eq('service_order_id', id);
    const { error } = await (supabase.from('service_orders') as any)
      .update({
        lifecycle_status: 'cancelled',
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'cancelled' });
  }

  // ── Заметка администратора ────────────────────────────────────────────
  if (action === 'edit_note') {
    const { error } = await (supabase.from('service_orders') as any)
      .update({ admin_note: body.admin_note?.trim() ?? null })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Одобрить доп. работу механика ────────────────────────────────────
  if (action === 'approve_extra_work') {
    if (!body.work_id) return NextResponse.json({ error: 'work_id required' }, { status: 400 });
    const { error } = await (supabase.from('service_order_works') as any)
      .update({
        extra_work_status: 'approved',
        extra_work_approved_by: adminId,
        extra_work_approved_at: new Date().toISOString(),
      })
      .eq('id', body.work_id)
      .eq('service_order_id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'extra_work_approved' });
  }

  // ── Отклонить доп. работу механика ───────────────────────────────────
  if (action === 'reject_extra_work') {
    if (!body.work_id) return NextResponse.json({ error: 'work_id required' }, { status: 400 });
    const { error } = await (supabase.from('service_order_works') as any)
      .update({
        extra_work_status: 'rejected',
        extra_work_approved_by: adminId,
        extra_work_approved_at: new Date().toISOString(),
        status: 'cancelled',
      })
      .eq('id', body.work_id)
      .eq('service_order_id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'extra_work_rejected' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

/** DELETE /api/admin/service-orders/:id */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = createAdminClient();
    const { data: workIds } = await (supabase.from('service_order_works') as any)
      .select('id')
      .eq('service_order_id', id);
    if (workIds?.length) {
      await (supabase.from('work_time_logs') as any).delete().in(
        'service_order_work_id',
        workIds.map((w: any) => w.id),
      );
    }

    await Promise.all([
      (supabase.from('service_order_parts') as any).delete().eq('service_order_id', id),
      (supabase.from('service_order_works') as any).delete().eq('service_order_id', id),
      (supabase.from('transactions') as any).delete().eq('service_order_id', id),
      (supabase.from('purchase_requests') as any).delete().eq('service_order_id', id),
      (supabase.from('repair_requests') as any)
        .update({ service_order_id: null })
        .eq('service_order_id', id),
    ]);

    const { error } = await (supabase.from('service_orders') as any).delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка удаления' }, { status: 500 });
  }
}
