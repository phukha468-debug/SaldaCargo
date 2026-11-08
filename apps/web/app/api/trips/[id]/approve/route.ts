/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { syncTripFinancials } from '@/lib/tripFinancials';
import { auditTripFuel } from '@saldacargo/shared';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

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
    .select('id, lifecycle_status')
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

  // Синхронизируем статус связанной заявки в orders -> перевод в docs_collection (Сбор документов)
  await (supabase.from('orders') as any)
    .update({ status: 'docs_collection', updated_at: new Date().toISOString() })
    .eq('active_trip_id', id);

  await syncTripFinancials(supabase, id, adminId);
  await updateAssetFuelAfterApproval(supabase, id);

  return NextResponse.json({ success: true });
}
