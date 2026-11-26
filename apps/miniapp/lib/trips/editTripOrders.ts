/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  isDebtPaymentMethod,
  isNoCashCounterparty,
  isStrictDocCounterparty,
  resolveKnownMasterCounterpartyId,
  cleanCounterpartySearchName,
  escapePostgrestValue,
} from '@saldacargo/shared';
import { syncTripFinancials } from '@/lib/tripFinancials';
import { syncStrictOrdersForTrip } from '@saldacargo/domain-service';

const moneyValueSchema = z.union([z.string(), z.number()]).optional();

const orderItemSchema = z.object({
  id: z.string().optional(),
  isNew: z.boolean().optional(),
  counterparty_id: z.string().nullable().optional(),
  counterparty_name: z.string().nullable().optional(),
  amount: moneyValueSchema,
  driver_pay: moneyValueSchema,
  driver_car_pay: moneyValueSchema,
  driver_loader_pay: moneyValueSchema,
  is_driver_loader: z.boolean().optional(),
  direction: z.string().optional(),
  loaders_data: z.array(z.any()).optional(),
  loader_id: z.string().nullable().optional(),
  loader_pay: moneyValueSchema,
  loader2_id: z.string().nullable().optional(),
  loader2_pay: moneyValueSchema,
  payment_method: z.string().optional(),
  description: z.string().nullable().optional(),
});

const expenseItemSchema = z.object({
  id: z.string().optional(),
  isNew: z.boolean().optional(),
  amount: moneyValueSchema,
  payment_method: z.string().optional(),
  description: z.string().nullable().optional(),
  category_id: z.string().nullable().optional(),
});

export const editTripOrdersPayloadSchema = z.object({
  action: z.literal('edit_orders'),
  trip_type: z.string().optional(),
  asset_id: z.string().nullable().optional(),
  driver_id: z.string().nullable().optional(),
  odometer_start: z.number().nullable().optional(),
  odometer_end: z.number().nullable().optional(),
  driver_note: z.string().nullable().optional(),
  admin_note: z.string().nullable().optional(),
  orders: z.array(orderItemSchema).optional(),
  deleted_order_ids: z.array(z.string()).optional(),
  expenses: z.array(expenseItemSchema).optional(),
  deleted_expense_ids: z.array(z.string()).optional(),
});

export type EditTripOrdersPayload = z.infer<typeof editTripOrdersPayloadSchema>;

export interface ExecuteEditTripOrdersOptions {
  supabase: any;
  tripId: string;
  actorId: string | null;
  organizationId?: string;
  allowAdminFields: boolean;
  payload: EditTripOrdersPayload;
}

const CAT_FUEL = '62cebf3f-9982-4cc6-904b-48c6169cf5e4';

export async function executeEditTripOrders({
  supabase,
  tripId,
  actorId,
  organizationId,
  allowAdminFields,
  payload,
}: ExecuteEditTripOrdersOptions): Promise<NextResponse> {
  // 1. Получаем рейс для статуса, организации и грузчиков
  const { data: trip, error: tripError } = await (supabase.from('trips') as any)
    .select('id, organization_id, lifecycle_status, driver_id, loader_id, loader2_id')
    .eq('id', tripId)
    .single();

  if (tripError || !trip) {
    return NextResponse.json({ error: tripError?.message ?? 'Рейс не найден' }, { status: 404 });
  }

  if (organizationId && trip.organization_id && trip.organization_id !== organizationId) {
    return NextResponse.json({ error: 'Нет доступа к рейсу другой организации' }, { status: 403 });
  }

  if (!allowAdminFields) {
    if (!actorId || trip.driver_id !== actorId) {
      return NextResponse.json(
        { error: 'Нет доступа к редактированию этого рейса' },
        { status: 403 },
      );
    }
    if (trip.lifecycle_status === 'approved') {
      return NextResponse.json({ error: 'Рейс уже одобрен администратором' }, { status: 403 });
    }
  }

  // 1.1 Обновляем поля самого рейса (тип, машина, водитель, одометр, заметки)
  const tripUpdates: Record<string, any> = {};
  if (payload.trip_type !== undefined) tripUpdates.trip_type = payload.trip_type;
  if (payload.asset_id !== undefined && payload.asset_id) tripUpdates.asset_id = payload.asset_id;
  if (allowAdminFields && payload.driver_id !== undefined && payload.driver_id) {
    tripUpdates.driver_id = payload.driver_id;
  }
  if (payload.odometer_start !== undefined) tripUpdates.odometer_start = payload.odometer_start;
  if (payload.odometer_end !== undefined) tripUpdates.odometer_end = payload.odometer_end;
  if (payload.driver_note !== undefined) tripUpdates.driver_note = payload.driver_note;
  if (allowAdminFields && payload.admin_note !== undefined) {
    tripUpdates.admin_note = payload.admin_note;
  }
  if (Object.keys(tripUpdates).length > 0) {
    tripUpdates.updated_at = new Date().toISOString();
    const { error: tripUpdErr } = await (supabase.from('trips') as any)
      .update(tripUpdates)
      .eq('id', tripId);
    if (tripUpdErr) return NextResponse.json({ error: tripUpdErr.message }, { status: 500 });
  }

  const effectiveOrgId = trip.organization_id || organizationId || null;

  async function resolveCounterpartyId(cpId?: string | null, cpName?: string | null) {
    if (cpId) {
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

    let foundList: any[] = [];
    if (safeName) {
      let query = (supabase.from('counterparties') as any).select('id, name').eq('is_active', true);
      if (effectiveOrgId) {
        query = query.eq('organization_id', effectiveOrgId);
      }
      const { data } = await query
        .or(`name.ilike.%${safeName}%,name.ilike.%${safeSimplified || safeName}%`)
        .limit(5);
      foundList = data ?? [];
    }

    const matched = foundList.find((c: any) => {
      const cClean = cleanCounterpartySearchName(c.name);
      return cClean === simplifiedName || c.name.toLowerCase() === name.toLowerCase();
    });

    if (matched) return matched.id;

    // Если контрагент новый, помечаем юр. лицом, если в названии есть ООО/АО/ПАО/ЗАО
    const isLegal = /\b(ооо|пао|зао|ао)\b/i.test(name);
    const { data: created, error: createErr } = await (supabase.from('counterparties') as any)
      .insert({
        ...(effectiveOrgId ? { organization_id: effectiveOrgId } : {}),
        name,
        type: 'client',
        is_active: true,
        is_legal_entity: isLegal,
      })
      .select('id')
      .single();
    if (createErr) throw createErr;
    return created.id;
  }

  // 2. Обработка удалённых заказов
  if (payload.deleted_order_ids?.length) {
    const { error: delErr } = await (supabase.from('trip_orders') as any)
      .update({
        lifecycle_status: 'cancelled',
        cancelled_reason: allowAdminFields
          ? 'Удалено администратором при редактировании'
          : 'Удалено водителем при редактировании',
      })
      .in('id', payload.deleted_order_ids)
      .eq('trip_id', tripId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  // 3. Обработка заказов
  if (payload.orders?.length) {
    for (const order of payload.orders) {
      const isNew =
        order.isNew || !order.id || order.id.startsWith('temp-') || order.id.startsWith('new-');

      let resolvedCounterpartyId: string | null = null;
      try {
        resolvedCounterpartyId = await resolveCounterpartyId(
          order.counterparty_id,
          order.counterparty_name,
        );
      } catch (cpErr: any) {
        return NextResponse.json(
          { error: cpErr?.message ?? 'Ошибка создания контрагента' },
          { status: 500 },
        );
      }

      let paymentMethod = order.payment_method || 'debt_cash';
      const isNoCash =
        isNoCashCounterparty(order.counterparty_name ?? undefined) ||
        isStrictDocCounterparty(order.counterparty_name ?? undefined);
      if (isNoCash && (paymentMethod === 'cash' || paymentMethod === 'qr')) {
        paymentMethod = 'bank_invoice';
      }
      const isDebt = isDebtPaymentMethod(paymentMethod);
      const settlementStatus = isDebt ? 'pending' : 'completed';

      if (isNew) {
        const newOrderPayload = {
          ...(effectiveOrgId ? { organization_id: effectiveOrgId } : {}),
          trip_id: tripId,
          counterparty_id: resolvedCounterpartyId,
          description: order.description?.trim() || null,
          amount: parseFloat(String(order.amount ?? '0')).toFixed(2),
          driver_pay: parseFloat(String(order.driver_pay ?? '0')).toFixed(2),
          driver_car_pay: parseFloat(String(order.driver_car_pay ?? '0')).toFixed(2),
          driver_loader_pay: parseFloat(String(order.driver_loader_pay ?? '0')).toFixed(2),
          is_driver_loader: Boolean(order.is_driver_loader),
          direction: order.direction || 'local',
          ...(order.loaders_data ? { loaders_data: order.loaders_data } : {}),
          loader_id: order.loader_id ?? trip.loader_id ?? null,
          loader_pay: parseFloat(String(order.loader_pay ?? '0')).toFixed(2),
          loader2_id: order.loader2_id ?? trip.loader2_id ?? null,
          loader2_pay: parseFloat(String(order.loader2_pay ?? '0')).toFixed(2),
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
        const update: Record<string, any> = {};
        if (order.amount !== undefined) update.amount = parseFloat(String(order.amount)).toFixed(2);
        if (order.driver_pay !== undefined)
          update.driver_pay = parseFloat(String(order.driver_pay)).toFixed(2);
        if (order.driver_car_pay !== undefined)
          update.driver_car_pay = parseFloat(String(order.driver_car_pay)).toFixed(2);
        if (order.driver_loader_pay !== undefined)
          update.driver_loader_pay = parseFloat(String(order.driver_loader_pay)).toFixed(2);
        if (order.is_driver_loader !== undefined)
          update.is_driver_loader = Boolean(order.is_driver_loader);
        if (order.direction !== undefined) update.direction = order.direction;
        if (order.loaders_data !== undefined) update.loaders_data = order.loaders_data;
        if (order.loader_id !== undefined) update.loader_id = order.loader_id;
        if (order.loader_pay !== undefined)
          update.loader_pay = parseFloat(String(order.loader_pay)).toFixed(2);
        if (order.loader2_id !== undefined) update.loader2_id = order.loader2_id;
        if (order.loader2_pay !== undefined)
          update.loader2_pay = parseFloat(String(order.loader2_pay)).toFixed(2);
        if (order.description !== undefined) update.description = order.description?.trim() || null;
        if (order.payment_method !== undefined) {
          update.payment_method = paymentMethod;
          update.settlement_status = settlementStatus;
        }
        if (order.counterparty_id !== undefined || order.counterparty_name !== undefined) {
          update.counterparty_id = resolvedCounterpartyId;
        }

        if (Object.keys(update).length > 0) {
          const { error: updErr } = await (supabase.from('trip_orders') as any)
            .update(update)
            .eq('id', order.id)
            .eq('trip_id', tripId);
          if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
        }
      }
    }
  }

  // 4. Удалённые расходы
  if (payload.deleted_expense_ids?.length) {
    const { error: delExpErr } = await (supabase.from('trip_expenses') as any)
      .delete()
      .in('id', payload.deleted_expense_ids)
      .eq('trip_id', tripId);
    if (delExpErr) return NextResponse.json({ error: delExpErr.message }, { status: 500 });
  }

  // 5. Создание / обновление расходов (Кубик, АЗС, Прочие)
  if (payload.expenses?.length) {
    for (const exp of payload.expenses) {
      const isNew = exp.isNew || !exp.id || exp.id.startsWith('new-') || exp.id.startsWith('temp-');
      const amountNum = parseFloat(String(exp.amount ?? '0'));
      const paymentMethod = exp.payment_method || 'fuel_card';

      if (isNew) {
        if (amountNum > 0) {
          const { error: insExpErr } = await (supabase.from('trip_expenses') as any).insert({
            ...(effectiveOrgId ? { organization_id: effectiveOrgId } : {}),
            trip_id: tripId,
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
            .eq('trip_id', tripId);
          if (updExpErr) return NextResponse.json({ error: updExpErr.message }, { status: 500 });
        }
      }
    }
  }

  await syncTripFinancials(supabase, tripId, actorId);

  if (trip.lifecycle_status === 'approved') {
    await syncStrictOrdersForTrip(supabase, tripId, {
      organizationId: effectiveOrgId || undefined,
    });
  }

  return NextResponse.json({ ok: true });
}
