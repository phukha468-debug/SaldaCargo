/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { getVerifiedMiniappUserId, requireSession } from '@/lib/auth/server';
import { syncTripFinancials } from '@/lib/tripFinancials';
import { editTripOrdersPayloadSchema, executeEditTripOrders } from '@/lib/trips/editTripOrders';
import { NextResponse } from 'next/server';

/** GET /api/trips/:id — детали рейса */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await (supabase
    .from('trips')
    .select(
      `
      *,
      asset:assets(id, short_name, reg_number, odometer_current, asset_type:asset_types(code)),
      driver:users!trips_driver_id_fkey(name),
      trip_orders(
        id, counterparty_id, amount, driver_pay, driver_car_pay, driver_loader_pay,
        is_driver_loader, direction, loaders_data, loader_id, loader_pay, loader2_id, loader2_pay,
        payment_method, settlement_status, lifecycle_status, description,
        counterparty:counterparties(name)
      ),
      trip_expenses(
        id, amount, payment_method, description,
        category:transaction_categories(name)
      )
      `,
    )
    .eq('id', id)
    .single() as any);

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

/** PATCH /api/trips/:id — обновить поля рейса или отредактировать заказы/расходы (edit_orders) */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireSession('transport');
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (body.action === 'edit_orders') {
    const parsed = editTripOrdersPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Некорректные данные рейса', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { data: caller } = await (supabase.from('users') as any)
      .select('roles, is_active')
      .eq('id', auth.userId)
      .maybeSingle();

    if (!caller || caller.is_active === false) {
      return NextResponse.json({ error: 'Аккаунт не найден или деактивирован' }, { status: 403 });
    }

    const dbRoles = Array.isArray(caller.roles) ? caller.roles : auth.roles;
    const isAdmin = dbRoles.some((r: string) =>
      ['admin', 'owner', 'director', 'dispatcher'].includes(r),
    );

    return executeEditTripOrders({
      supabase,
      tripId: id,
      actorId: auth.userId,
      organizationId: auth.organizationId,
      allowAdminFields: isAdmin,
      payload: parsed.data,
    });
  }

  const { data: trip } = await (supabase.from('trips') as any)
    .select('driver_id, lifecycle_status')
    .eq('id', id)
    .single();

  if (!trip) return NextResponse.json({ error: 'Рейс не найден' }, { status: 404 });
  if (trip.driver_id !== auth.userId)
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 });
  if (trip.lifecycle_status === 'approved') {
    return NextResponse.json({ error: 'Рейс уже одобрен администратором' }, { status: 403 });
  }

  const allowed = ['trip_type'];
  const update = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

  const { data, error } = await (supabase.from('trips') as any)
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE /api/trips/:id — отменить/удалить рейс (водитель — свой не апрувнутый, администратор — любой) */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const callerId = await getVerifiedMiniappUserId();
  if (!callerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();

  const [{ data: trip }, { data: caller }] = await Promise.all([
    (supabase.from('trips') as any).select('driver_id, lifecycle_status').eq('id', id).single(),
    (supabase.from('users') as any).select('roles').eq('id', callerId).single(),
  ]);

  if (!trip) return NextResponse.json({ error: 'Рейс не найден' }, { status: 404 });

  const isAdmin =
    Array.isArray(caller?.roles) &&
    caller.roles.some((r: string) => ['admin', 'owner', 'director'].includes(r));

  if (!isAdmin && trip.driver_id !== callerId)
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 });
  if (!isAdmin && trip.lifecycle_status === 'approved') {
    return NextResponse.json({ error: 'Рейс уже одобрен администратором' }, { status: 403 });
  }

  // Если удаляет администратор тестовый или черновой рейс — удаляем полностью через cascade
  if (isAdmin) {
    const { error: delError } = await supabase.from('trips').delete().eq('id', id);
    if (!delError) return NextResponse.json({ ok: true, deleted: true });
  }

  // Иначе мягкая отмена (soft-delete)
  const { error } = await (supabase.from('trips') as any)
    .update({ lifecycle_status: 'cancelled' })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await syncTripFinancials(supabase, id, callerId);
  return NextResponse.json({ ok: true });
}
