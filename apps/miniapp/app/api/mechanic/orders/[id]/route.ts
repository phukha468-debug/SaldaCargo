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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const cookieStore = await cookies();
    const mechanicId =
      cookieStore.get('salda_user_id')?.value || request.headers.get('x-salda-user-id') || null;

    const supabase = createAdminClient();

    const [{ data: order, error }, { data: sto }] = await Promise.all([
      (supabase.from('service_orders') as any)
        .select(
          `
          id, order_number, status, lifecycle_status, priority, machine_type,
          problem_description, admin_note, mechanic_note,
          mechanic_pay, second_mechanic_pay,
          client_vehicle_id, client_vehicle_brand, client_vehicle_model, client_vehicle_reg,
          client_name, client_phone,
          odometer_start, odometer_end,
          assigned_mechanic_id, second_mechanic_id, created_by,
          created_at, updated_at,
          asset_id, asset:assets(id, short_name, reg_number, odometer_current),
          works:service_order_works(
            id, status, salary_paid, quantity, norm_minutes, actual_minutes, price_client, work_description,
            custom_work_name, mechanic_id, second_mechanic_id,
            work_catalog:work_catalog(id, name, norm_minutes),
            time_logs:work_time_logs(id, started_at, stopped_at, status)
          ),
          parts:service_order_parts(
            id, quantity, custom_part_name, unit, unit_price, client_price,
            part:parts(id, name, unit)
          )
        `,
        )
        .eq('id', id)
        .maybeSingle(),
      (supabase.from('sto_settings') as any)
        .select('hourly_rate, hourly_rate_own')
        .limit(1)
        .maybeSingle(),
    ]);

    if (error) throw error;
    if (!order) return NextResponse.json({ error: 'Заказ-наряд не найден' }, { status: 404 });

    const targetMechanicId = mechanicId || order.assigned_mechanic_id || order.created_by;
    let salaryPct = 50;
    if (targetMechanicId) {
      const { data: mechUser } = await (supabase.from('users') as any)
        .select('mechanic_salary_pct')
        .eq('id', targetMechanicId)
        .maybeSingle();
      if (mechUser?.mechanic_salary_pct != null && !isNaN(Number(mechUser.mechanic_salary_pct))) {
        salaryPct = Number(mechUser.mechanic_salary_pct);
      }
    }

    const rateClient = parseFloat(sto?.hourly_rate ?? '2000') || 2000;
    const rateOwn = parseFloat(sto?.hourly_rate_own ?? '1600') || 1600;
    const isOwn = order.machine_type === 'own';
    const hourlyRate = isOwn ? rateOwn : rateClient;

    let approvedPay = 0;
    let settlementStatus = 'pending';
    let employeeConfirmed: boolean | null = null;

    if (targetMechanicId) {
      const { data: txs } = await (supabase.from('transactions') as any)
        .select('id, amount, settlement_status, employee_confirmed, lifecycle_status')
        .eq('service_order_id', id)
        .eq('related_user_id', targetMechanicId)
        .eq('direction', 'expense')
        .neq('lifecycle_status', 'cancelled')
        .is('from_wallet_id', null);

      for (const t of txs ?? []) {
        approvedPay += parseFloat(t.amount || '0');
        if (t.settlement_status === 'completed') settlementStatus = 'completed';
        if (t.employee_confirmed !== null) employeeConfirmed = t.employee_confirmed;
      }
    }

    const activeWorks = (order.works ?? []).filter((w: any) => w.status !== 'cancelled');
    let totalMinutes = 0;
    let estimatedOrderPay = 0;

    for (const w of activeWorks) {
      const qty = Math.max(1, Number(w.quantity ?? 1));
      const mins = Number(w.actual_minutes || w.norm_minutes || 0) * qty;
      totalMinutes += mins;

      const explicitPrice = parseFloat(w.price_client ?? '0');
      const workClientPrice = explicitPrice > 0 ? explicitPrice : (mins / 60) * hourlyRate;
      estimatedOrderPay += (workClientPrice * salaryPct) / 100;
    }

    const effectivePay =
      approvedPay > 0
        ? approvedPay
        : parseFloat(order.mechanic_pay || '0') > 0
          ? parseFloat(order.mechanic_pay)
          : estimatedOrderPay;

    const normalizedParts = (order.parts ?? []).map((p: any) => ({
      ...p,
      part: p.part ?? {
        id: p.id,
        name: p.custom_part_name || 'Запчасть',
        unit: p.unit || 'шт',
      },
    }));

    const orderDates = extractOrderDates(order);

    return NextResponse.json({
      ...order,
      started_at: orderDates.started_at,
      completed_at: orderDates.completed_at,
      mechanic_note: cleanOrderNotes(order.mechanic_note),
      admin_note: cleanOrderNotes(order.admin_note),
      parts: normalizedParts,
      hourly_rate: hourlyRate,
      salary_pct: salaryPct,
      total_minutes: totalMinutes,
      estimated_pay: estimatedOrderPay.toFixed(2),
      approved_pay: approvedPay.toFixed(2),
      mechanic_pay: effectivePay.toFixed(2),
      parts_provided_by_service:
        normalizedParts.length > 0 ||
        Boolean(order.mechanic_note?.includes('[Запчасти предоставил автосервис]')),
      settlement_status: settlementStatus,
      employee_confirmed: employeeConfirmed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const body = await request.json();
    const {
      status,
      odometer_end,
      odometer_start,
      mechanic_note,
      client_vehicle_brand,
      client_vehicle_model,
      client_vehicle_reg,
      parts_provided_by_service,
    } = body as {
      status?: string;
      odometer_end?: number | string;
      odometer_start?: number | string;
      mechanic_note?: string;
      client_vehicle_brand?: string;
      client_vehicle_model?: string;
      client_vehicle_reg?: string;
      parts_provided_by_service?: boolean;
    };

    const supabase = createAdminClient();

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) update.status = status;
    if (status === 'completed') update.lifecycle_status = 'draft';

    if (
      odometer_end != null &&
      String(odometer_end).trim() !== '' &&
      !isNaN(Number(odometer_end))
    ) {
      update.odometer_end = Number(odometer_end);
    }
    if (
      odometer_start != null &&
      String(odometer_start).trim() !== '' &&
      !isNaN(Number(odometer_start))
    ) {
      update.odometer_start = Number(odometer_start);
    }
    if (client_vehicle_brand !== undefined) update.client_vehicle_brand = client_vehicle_brand;
    if (client_vehicle_model !== undefined) update.client_vehicle_model = client_vehicle_model;
    if (client_vehicle_reg !== undefined) update.client_vehicle_reg = client_vehicle_reg;
    if (mechanic_note !== undefined) {
      update.mechanic_note = mechanic_note;
    } else if (parts_provided_by_service !== undefined) {
      update.mechanic_note = parts_provided_by_service ? '[Запчасти предоставил автосервис]' : null;
    }

    if (body.started_at !== undefined) {
      const sVal = body.started_at ? String(body.started_at).trim() : null;
      update.started_at = sVal ? (sVal.includes('T') ? sVal : `${sVal}T08:00:00.000Z`) : null;
    }
    if (body.completed_at !== undefined) {
      const cVal = body.completed_at ? String(body.completed_at).trim() : null;
      update.completed_at = cVal ? (cVal.includes('T') ? cVal : `${cVal}T17:00:00.000Z`) : null;
    }
    if (update.started_at !== undefined || update.completed_at !== undefined) {
      update.mechanic_note = formatOrderDatesNote(update.mechanic_note as string | undefined, {
        started_at: update.started_at as string | null,
        completed_at: update.completed_at as string | null,
      });
    }

    if (status === 'completed') {
      const { data: ord } = await (supabase as any)
        .from('service_orders')
        .select(
          `id, machine_type, asset_id, client_vehicle_id, client_vehicle_brand, client_vehicle_model, client_vehicle_reg, odometer_start, odometer_end,
           works:service_order_works(id, status, norm_minutes, actual_minutes, custom_work_name, work_description, notes, work_catalog:work_catalog(name))`,
        )
        .eq('id', id)
        .single();

      if (ord) {
        const activeWorks = (ord.works || []).filter((w: any) => w.status !== 'cancelled');
        if (activeWorks.length === 0) {
          return NextResponse.json(
            { error: 'Добавьте хотя бы одну работу перед закрытием наряда!' },
            { status: 400 },
          );
        }

        const hasOil = activeWorks.some(
          (w: any) =>
            isOilOrFilterWork(w.work_catalog?.name) ||
            isOilOrFilterWork(w.custom_work_name) ||
            isOilOrFilterWork(w.work_description) ||
            isOilOrFilterWork(w.notes),
        );

        const curOdo =
          update.odometer_end != null
            ? Number(update.odometer_end)
            : update.odometer_start != null
              ? Number(update.odometer_start)
              : ord.odometer_end || ord.odometer_start || null;

        if (ord.machine_type === 'client' && (!curOdo || curOdo <= 0)) {
          return NextResponse.json(
            { error: 'Для клиентского автомобиля обязательно укажите пробег (одометр)!' },
            { status: 400 },
          );
        }

        if (hasOil && (!curOdo || curOdo <= 0)) {
          return NextResponse.json(
            { error: 'При замене масла или фильтров необходимо указать текущий одометр!' },
            { status: 400 },
          );
        }

        // Автоматически переводим незавершённые работы в completed (с actual_minutes = norm_minutes)
        for (const w of activeWorks) {
          if (w.status !== 'completed') {
            await (supabase as any)
              .from('service_order_works')
              .update({
                status: 'completed',
                actual_minutes: w.actual_minutes || w.norm_minutes || 60,
              })
              .eq('id', w.id);
          }
        }

        if (curOdo && curOdo > 0 && ord.asset_id) {
          if (hasOil) {
            const { data: assetData } = await (supabase.from('assets') as any)
              .select('notes')
              .eq('id', ord.asset_id)
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

            docsObj.oil_last_km = curOdo;
            docsObj.oil_last_date = new Date().toISOString().split('T')[0];

            const cleanUserNote = existingNotes.replace(/\[DOCS_DATA:.*?\]/s, '').trim();
            const updatedNotes = cleanUserNote
              ? `${cleanUserNote}\n[DOCS_DATA:${JSON.stringify(docsObj)}]`
              : `[DOCS_DATA:${JSON.stringify(docsObj)}]`;

            await (supabase as any)
              .from('assets')
              .update({
                odometer_current: curOdo,
                notes: updatedNotes,
                updated_at: new Date().toISOString(),
              })
              .eq('id', ord.asset_id);
          } else {
            await (supabase as any)
              .from('assets')
              .update({ odometer_current: curOdo, updated_at: new Date().toISOString() })
              .eq('id', ord.asset_id);
          }
        }
      }
    }

    let data: any = null;
    let error: any = null;

    const resWithDates = await (supabase as any)
      .from('service_orders')
      .update(update)
      .eq('id', id)
      .select('id, status, lifecycle_status, odometer_end')
      .single();

    if (resWithDates.error) {
      const fallbackUpdate = { ...update };
      delete fallbackUpdate.started_at;
      delete fallbackUpdate.completed_at;
      const resFallback = await (supabase as any)
        .from('service_orders')
        .update(fallbackUpdate)
        .eq('id', id)
        .select('id, status, lifecycle_status, odometer_end')
        .single();
      data = resFallback.data;
      error = resFallback.error;
    } else {
      data = resWithDates.data;
      error = resWithDates.error;
    }

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
