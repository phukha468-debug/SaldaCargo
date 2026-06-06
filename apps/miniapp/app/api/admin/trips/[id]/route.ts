/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TRIP_REVENUE_CATEGORY = '74008cf7-0527-4e9f-afd2-d232b8f8125a';
const CASH_ID = '10000000-0000-0000-0000-000000000002';
const BANK_ID = '10000000-0000-0000-0000-000000000001';
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
        asset:assets(short_name, reg_number),
        loader:users!trips_loader_id_fkey(name),
        trip_orders(
          id, amount, driver_pay, loader_id, loader_pay, loader2_id, loader2_pay,
          payment_method, settlement_status, lifecycle_status, description,
          counterparty:counterparties(name),
          loader:users!trip_orders_loader_id_fkey(id, name),
          loader2:users!trip_orders_loader2_id_fkey(id, name)
        ),
        trip_expenses(id, amount, payment_method, description,
          category:transaction_categories(name))
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
  const cookieStore = await cookies();
  const adminId = cookieStore.get('salda_user_id')?.value ?? null;
  const body = (await request.json()) as {
    action: 'approve' | 'return' | 'edit_orders' | 'reissue_salary' | 'confirm_payroll';
    note?: string;
    driver_pay?: string;
    loader_pays?: Array<{ user_id: string; name: string; amount: string }>;
    orders?: Array<{
      id: string;
      amount?: string;
      driver_pay?: string;
      loader_pay?: string;
      payment_method?: string;
      counterparty_name?: string;
    }>;
  };
  const supabase = createAdminClient();

  if (body.action === 'edit_orders') {
    if (!body.orders?.length) return NextResponse.json({ ok: true });
    for (const order of body.orders) {
      const { id: orderId, ...fields } = order;
      const update: Record<string, any> = {};
      if (fields.amount !== undefined) update.amount = parseFloat(fields.amount).toFixed(2);
      if (fields.driver_pay !== undefined)
        update.driver_pay = parseFloat(fields.driver_pay).toFixed(2);
      if (fields.loader_pay !== undefined)
        update.loader_pay = parseFloat(fields.loader_pay).toFixed(2);
      if (fields.payment_method !== undefined) update.payment_method = fields.payment_method;
      if (fields.counterparty_name !== undefined) {
        const name = fields.counterparty_name.trim();
        if (name) {
          const { data: found } = await (supabase.from('counterparties') as any)
            .select('id')
            .ilike('name', name)
            .maybeSingle();
          if (found) {
            update.counterparty_id = found.id;
          } else {
            const { data: created, error: createErr } = await (
              supabase.from('counterparties') as any
            )
              .insert({ name, type: 'client' })
              .select('id')
              .single();
            if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });
            update.counterparty_id = created.id;
          }
        }
      }
      if (Object.keys(update).length > 0) {
        const { error } = await (supabase.from('trip_orders') as any)
          .update(update)
          .eq('id', orderId)
          .eq('trip_id', id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'approve') {
    const { data: trip, error: fetchErr } = await (supabase.from('trips') as any)
      .select(
        `id, trip_number, driver_id, lifecycle_status, started_at,
         driver:users!trips_driver_id_fkey(id, name),
         trip_orders(
           amount, payment_method, lifecycle_status, description,
           driver_pay, loader_id, loader_pay, loader2_id, loader2_pay,
           counterparty:counterparties(name),
           loader:users!trip_orders_loader_id_fkey(id, name),
           loader2:users!trip_orders_loader2_id_fkey(id, name)
         )`,
      )
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

    // Наличные и QR — оплачены сразу, отмечаем как settled
    await (supabase.from('trip_orders') as any)
      .update({ settlement_status: 'completed' })
      .eq('trip_id', id)
      .in('payment_method', ['cash', 'qr', 'card_driver'])
      .neq('lifecycle_status', 'cancelled');

    const activeOrders = ((trip.trip_orders as any[]) ?? []).filter(
      (o: any) => o.lifecycle_status !== 'cancelled',
    );

    const inserts: Promise<any>[] = [];

    function buildOrderDescription(orders: any[], label: string) {
      const names = [
        ...new Set(
          orders
            .map((o: any) => (o.counterparty as any)?.name ?? o.description ?? null)
            .filter(Boolean),
        ),
      ] as string[];
      return [
        `Рейс №${trip.trip_number}`,
        (trip.driver as any)?.name ?? null,
        names.length > 0 ? names.join(', ') : null,
        label,
      ]
        .filter(Boolean)
        .join(' · ');
    }

    // Наличные + card_driver → Касса
    const cashOrders = activeOrders.filter(
      (o: any) => o.payment_method === 'cash' || o.payment_method === 'card_driver',
    );
    const cashTotal = cashOrders.reduce((s: number, o: any) => s + parseFloat(o.amount ?? '0'), 0);
    if (cashTotal > 0) {
      inserts.push(
        (supabase.from('transactions') as any).insert({
          direction: 'income',
          category_id: TRIP_REVENUE_CATEGORY,
          amount: cashTotal.toFixed(2),
          to_wallet_id: CASH_ID,
          trip_id: id, // Добавлено: привязка к рейсу
          description: buildOrderDescription(cashOrders, 'Нал'),
          lifecycle_status: 'approved',
          settlement_status: 'completed',
          created_by: adminId,
          idempotency_key: crypto.randomUUID(),
        }),
      );
    }

    // QR/Безнал → Расчётный счёт
    const qrOrders = activeOrders.filter((o: any) => o.payment_method === 'qr');
    const qrTotal = qrOrders.reduce((s: number, o: any) => s + parseFloat(o.amount ?? '0'), 0);
    if (qrTotal > 0) {
      inserts.push(
        (supabase.from('transactions') as any).insert({
          direction: 'income',
          category_id: TRIP_REVENUE_CATEGORY,
          amount: qrTotal.toFixed(2),
          to_wallet_id: BANK_ID,
          trip_id: id, // Добавлено: привязка к рейсу
          description: buildOrderDescription(qrOrders, 'QR/Безнал'),
          lifecycle_status: 'approved',
          settlement_status: 'completed',
          created_by: adminId,
          idempotency_key: crypto.randomUUID(),
        }),
      );
    }

    const payrollTxns: any[] = [];

    // ЗП водителю (pending, ожидает подтверждения водителем)
    if (trip.driver_id) {
      const driverPay = activeOrders.reduce(
        (s: number, o: any) => s + parseFloat(o.driver_pay ?? '0'),
        0,
      );
      if (driverPay > 0) {
        payrollTxns.push({
          direction: 'expense',
          category_id: PAYROLL_DRIVER_CAT,
          amount: driverPay.toFixed(2),
          description: `ЗП: ${(trip.driver as any)?.name ?? 'Водитель'} — рейс №${trip.trip_number}`,
          lifecycle_status: 'approved',
          settlement_status: 'pending',
          employee_confirmed: false,
          related_user_id: trip.driver_id,
          trip_id: id,
          transaction_date: trip.started_at,
          created_by: adminId,
          idempotency_key: crypto.randomUUID(),
        });
      }
    }

    // ЗП грузчикам (pending, агрегируем по userId)
    const loaderPayMap = new Map<string, { name: string; pay: number }>();
    for (const o of activeOrders) {
      if (o.loader_id && parseFloat(o.loader_pay ?? '0') > 0) {
        const prev = loaderPayMap.get(o.loader_id) ?? {
          name: (o.loader as any)?.name ?? 'Грузчик',
          pay: 0,
        };
        loaderPayMap.set(o.loader_id, { ...prev, pay: prev.pay + parseFloat(o.loader_pay) });
      }
      if (o.loader2_id && parseFloat(o.loader2_pay ?? '0') > 0) {
        const prev = loaderPayMap.get(o.loader2_id) ?? {
          name: (o.loader2 as any)?.name ?? 'Грузчик',
          pay: 0,
        };
        loaderPayMap.set(o.loader2_id, { ...prev, pay: prev.pay + parseFloat(o.loader2_pay) });
      }
    }
    for (const [userId, { name, pay }] of loaderPayMap) {
      payrollTxns.push({
        direction: 'expense',
        category_id: PAYROLL_LOADER_CAT,
        amount: pay.toFixed(2),
        description: `ЗП: ${name} — рейс №${trip.trip_number}`,
        lifecycle_status: 'approved',
        settlement_status: 'pending',
        employee_confirmed: false,
        related_user_id: userId,
        trip_id: id,
        transaction_date: trip.started_at,
        created_by: adminId,
        idempotency_key: crypto.randomUUID(),
      });
    }

    if (payrollTxns.length > 0) {
      inserts.push((supabase.from('transactions') as any).insert(payrollTxns));
    }

    await Promise.all(inserts);

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

    return NextResponse.json({ ok: true, action: 'returned' });
  }

  if (body.action === 'reissue_salary') {
    const { data: tripInfo } = await (supabase.from('trips') as any)
      .select('driver_id, trip_number, started_at, driver:users!trips_driver_id_fkey(name)')
      .eq('id', id)
      .single();

    if (!tripInfo) return NextResponse.json({ error: 'Рейс не найден' }, { status: 404 });

    // Отменяем только неподтверждённые pending ЗП-транзакции
    await (supabase.from('transactions') as any)
      .update({ lifecycle_status: 'cancelled', cancelled_reason: 'Переназначено администратором' })
      .eq('trip_id', id)
      .in('category_id', PAYROLL_CATS)
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'pending')
      .eq('employee_confirmed', false);

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
        employee_confirmed: false,
        related_user_id: tripInfo.driver_id,
        trip_id: id,
        transaction_date: tripInfo.started_at,
        created_by: adminId,
        idempotency_key: crypto.randomUUID(),
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
          employee_confirmed: false,
          related_user_id: loader.user_id,
          trip_id: id,
          transaction_date: tripInfo.started_at,
          created_by: adminId,
          idempotency_key: crypto.randomUUID(),
        });
      }
    }

    if (newTxns.length > 0) {
      await (supabase.from('transactions') as any).insert(newTxns);
    }

    return NextResponse.json({ ok: true, action: 'salary_reissued' });
  }

  if (body.action === 'confirm_payroll') {
    await (supabase.from('transactions') as any)
      .update({ employee_confirmed: true })
      .eq('trip_id', id)
      .in('category_id', PAYROLL_CATS)
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'pending')
      .eq('employee_confirmed', false);
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
