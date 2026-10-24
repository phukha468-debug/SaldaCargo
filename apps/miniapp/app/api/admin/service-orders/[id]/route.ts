/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isOilOrFilterWork } from '@saldacargo/shared';

/** PATCH /api/admin/service-orders/:id */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const adminId = cookieStore.get('salda_user_id')?.value;
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as {
    action:
      | 'approve'
      | 'return'
      | 'cancel'
      | 'edit_note'
      | 'approve_extra_work'
      | 'reject_extra_work';
    admin_note?: string;
    adjusted_norm_minutes?: number;
    work_id?: string;
    mechanic_id?: string;
    second_mechanic_id?: string;
    odometer_start?: number | string;
    odometer_end?: number | string;
  };
  const supabase = createAdminClient();

  // ── Утверждение наряда + начисление ЗП ────────────────────────────────
  if (body.action === 'approve') {
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
        id, asset_id, client_vehicle_id, machine_type, odometer_start, odometer_end,
        mechanic:users!service_orders_assigned_mechanic_id_fkey(id, mechanic_salary_pct),
        second_mechanic:users!service_orders_second_mechanic_id_fkey(id, mechanic_salary_pct),
        service_order_works(id, norm_minutes, actual_minutes, status, extra_work_status, custom_work_name, work_description, work_catalog:work_catalog(name))
      `,
      )
      .eq('id', id)
      .single();

    if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

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
      works.reduce((sum: number, w: any) => sum + (w.actual_minutes ?? w.norm_minutes), 0);

    const [{ data: settings }, { data: payrollCat }] = await Promise.all([
      (supabase.from('sto_settings') as any)
        .select('hourly_rate, hourly_rate_own')
        .limit(1)
        .single(),
      (supabase.from('transaction_categories') as any)
        .select('id')
        .eq('code', 'PAYROLL_MECHANIC')
        .single(),
    ]);
    const hourlyRate =
      order.machine_type === 'client'
        ? parseFloat(settings?.hourly_rate ?? '2000')
        : parseFloat(settings?.hourly_rate_own ?? '1600');
    const payrollCategoryId = payrollCat?.id;

    const accruals: string[] = [];
    const mechanics = [order.mechanic, order.second_mechanic].filter(Boolean);
    const totalNmHours = totalNm / 60;
    const nmPerMechanic = mechanics.length === 2 ? totalNmHours / 2 : totalNmHours;

    for (const mech of mechanics) {
      if (!mech?.id) continue;
      const pct = parseFloat(mech.mechanic_salary_pct ?? '50') / 100;
      const salary = (nmPerMechanic * hourlyRate * pct).toFixed(2);
      accruals.push(`${mech.id}: ${salary} ₽`);

      await (supabase.from('transactions') as any).insert({
        direction: 'expense',
        category_id: payrollCategoryId,
        amount: salary,
        service_order_id: id,
        related_user_id: mech.id,
        lifecycle_status: 'approved',
        settlement_status: 'pending',
        from_wallet_id: null,
        employee_confirmed: false,
        description: `ЗП механика: наряд #${id.slice(0, 6)}`,
        created_by: adminId,
        idempotency_key: crypto.randomUUID(),
      });
    }

    const updatePayload: Record<string, unknown> = {
      lifecycle_status: 'approved',
      approved_by: adminId,
      approved_at: new Date().toISOString(),
      admin_note: body.admin_note ?? null,
    };
    if (body.odometer_start != null && !isNaN(Number(body.odometer_start))) {
      updatePayload.odometer_start = Number(body.odometer_start);
    }
    if (body.odometer_end != null && !isNaN(Number(body.odometer_end))) {
      updatePayload.odometer_end = Number(body.odometer_end);
    }

    const { error } = await (supabase.from('service_orders') as any)
      .update(updatePayload)
      .eq('id', id);

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
  if (body.action === 'return') {
    // Удаляем все финансовые транзакции наряда (ЗП, выручка) — при повторном апруве создадутся заново
    await (supabase.from('transactions') as any).delete().eq('service_order_id', id);

    // Сбрасываем флаг salary_paid на работах — иначе при повторном апруве они не попадут в расчёт
    await (supabase.from('service_order_works') as any)
      .update({ salary_paid: false })
      .eq('service_order_id', id);

    const { error } = await (supabase.from('service_orders') as any)
      .update({
        lifecycle_status: 'returned',
        status: 'in_progress',
        admin_note: body.admin_note ?? null,
      })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'returned' });
  }

  // ── Отмена ────────────────────────────────────────────────────────────
  if (body.action === 'cancel') {
    const { error } = await (supabase.from('service_orders') as any)
      .update({ lifecycle_status: 'cancelled', status: 'cancelled' })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'cancelled' });
  }

  // ── Заметка администратора ────────────────────────────────────────────
  if (body.action === 'edit_note') {
    const { error } = await (supabase.from('service_orders') as any)
      .update({ admin_note: body.admin_note?.trim() ?? null })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Одобрить доп. работу механика ────────────────────────────────────
  if (body.action === 'approve_extra_work') {
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
  if (body.action === 'reject_extra_work') {
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
