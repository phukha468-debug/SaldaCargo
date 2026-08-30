/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { syncTripFinancials } from '@/lib/tripFinancials';
import { cookies } from 'next/headers';
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
      id, trip_number, status, lifecycle_status, started_at, ended_at,
      trip_type, odometer_start, odometer_end, driver_note,
      asset:assets(short_name, reg_number),
      driver:users!trips_driver_id_fkey(id, name),
      loader:users!trips_loader_id_fkey(id, name),
      trip_orders(
        id, amount, driver_pay, loader_pay, loader2_pay,
        loader_id, loader2_id,
        loader:users!trip_orders_loader_id_fkey(id, name),
        loader2:users!trip_orders_loader2_id_fkey(id, name),
        payment_method, settlement_status, lifecycle_status,
        counterparty_id,
        counterparty:counterparties(name)
      ),
      trip_expenses(
        id, amount, payment_method, description,
        category:transaction_categories(name)
      )
    `,
    );

    if (isUuid) {
      query = query.eq('id', id);
    } else if (cleanNum) {
      query = query.or(`trip_number.eq.${cleanNum},id.eq.${id}`);
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
        description?: string;
        payment_method?: string;
        counterparty_id?: string | null;
        counterparty_name?: string;
      }>;
      deleted_order_ids?: string[];
    };

    const supabase = createAdminClient();

    // 1. Получаем данные рейса (статус, грузчики, водитель)
    const { data: trip, error: tripError } = await (supabase.from('trips') as any)
      .select('id, lifecycle_status, driver_id, loader_id, loader2_id')
      .eq('id', id)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: tripError?.message ?? 'Рейс не найден' }, { status: 404 });
    }

    // 2. Вспомогательная функция для резолвинга/создания контрагента
    async function resolveCounterpartyId(cpId?: string | null, cpName?: string) {
      if (cpId) return cpId;
      const name = cpName?.trim();
      if (!name) return null;
      const { data: found } = await (supabase.from('counterparties') as any)
        .select('id')
        .ilike('name', name)
        .maybeSingle();
      if (found) return found.id;
      const { data: created, error: createErr } = await (supabase.from('counterparties') as any)
        .insert({ name, type: 'client' })
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

        const paymentMethod = order.payment_method || 'debt_cash';
        const isDebt =
          paymentMethod === 'debt_cash' ||
          paymentMethod === 'debt' ||
          paymentMethod === 'debt_bank';
        const settlementStatus = isDebt ? 'pending' : 'completed';

        if (isNew) {
          // Создание новой заявки
          const newOrderPayload = {
            trip_id: id,
            counterparty_id: resolvedCounterpartyId,
            description: order.description?.trim() || null,
            amount: parseFloat(order.amount ?? '0').toFixed(2),
            driver_pay: parseFloat(order.driver_pay ?? '0').toFixed(2),
            loader_id: order.loader_id ?? trip.loader_id ?? null,
            loader_pay: parseFloat(order.loader_pay ?? '0').toFixed(2),
            loader2_id: order.loader2_id ?? trip.loader2_id ?? null,
            loader2_pay: parseFloat(order.loader2_pay ?? '0').toFixed(2),
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
          if (order.description !== undefined)
            update.description = order.description?.trim() || null;
          if (order.payment_method !== undefined) {
            update.payment_method = order.payment_method;
            update.settlement_status = settlementStatus;
          }
          if (order.counterparty_id !== undefined || order.counterparty_name !== undefined) {
            update.counterparty_id = resolvedCounterpartyId;
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

    const cookieStore = await cookies();
    const adminId = cookieStore.get('salda_auth_token')?.value ?? null;
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
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
