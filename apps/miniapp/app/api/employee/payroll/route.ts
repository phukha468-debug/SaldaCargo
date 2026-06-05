/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const PAYROLL_DRIVER_CAT = 'd79213ee-3bc6-4433-b58a-ca7ea1040d00';
const PAYROLL_LOADER_CAT = '18792fa8-fda8-472d-8e04-e19d2c6c053c';
const PAYROLL_MECHANIC_CAT = '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6';
const ALL_PAYROLL_CATS = [PAYROLL_DRIVER_CAT, PAYROLL_LOADER_CAT, PAYROLL_MECHANIC_CAT];

const CATEGORY_LABELS: Record<string, string> = {
  [PAYROLL_DRIVER_CAT]: 'ЗП водителя',
  [PAYROLL_LOADER_CAT]: 'ЗП грузчика',
  [PAYROLL_MECHANIC_CAT]: 'ЗП механика',
};

/** GET /api/employee/payroll — ожидающие подтверждения + накопленная сумма */
export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('salda_user_id')?.value;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();

  const [{ data: pendingConf }, { data: accumulatedRows }, { data: paidRows }] = await Promise.all([
    (supabase.from('transactions') as any)
      .select(
        `id, amount, description, category_id, created_at, transaction_date,
         trip:trips(id, trip_number, started_at, asset:assets(short_name)),
         service_order:service_orders(id, order_number, asset:assets(short_name))`,
      )
      .eq('related_user_id', userId)
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'pending')
      .eq('employee_confirmed', false)
      .in('category_id', ALL_PAYROLL_CATS)
      .order('transaction_date', { ascending: true }),

    (supabase.from('transactions') as any)
      .select('amount')
      .eq('related_user_id', userId)
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'pending')
      .or('employee_confirmed.is.null,employee_confirmed.eq.true')
      .in('category_id', ALL_PAYROLL_CATS),

    (supabase.from('transactions') as any)
      .select('amount')
      .eq('related_user_id', userId)
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'completed')
      .or('employee_confirmed.is.null,employee_confirmed.eq.true')
      .in('category_id', ALL_PAYROLL_CATS),
  ]);

  const accumulated_total = (accumulatedRows ?? [])
    .reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0)
    .toFixed(2);
  const total_paid = (paidRows ?? [])
    .reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0)
    .toFixed(2);

  const pendingItems = (pendingConf ?? []).map((t: any) => {
    const tripDate = t.trip?.started_at ?? t.transaction_date;
    const dateStr = tripDate
      ? new Date(tripDate).toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null;

    let context = '';
    if (t.trip) {
      context = [`Рейс №${t.trip.trip_number}`, t.trip.asset?.short_name ?? null, dateStr]
        .filter(Boolean)
        .join(' · ');
    } else if (t.service_order) {
      context = [
        `Наряд #${t.service_order.order_number}`,
        t.service_order.asset?.short_name ?? null,
        dateStr,
      ]
        .filter(Boolean)
        .join(' · ');
    } else {
      context = dateStr ?? '';
    }

    return {
      id: t.id,
      amount: t.amount,
      category_id: t.category_id,
      label: CATEGORY_LABELS[t.category_id] ?? 'ЗП',
      context,
      trip_id: t.trip?.id ?? null,
      service_order_id: t.service_order?.id ?? null,
      date: tripDate,
    };
  });

  return NextResponse.json({
    pending_confirmation: pendingItems,
    pending_count: pendingItems.length,
    accumulated_total,
    total_paid,
  });
}

/** PATCH /api/employee/payroll — подтвердить или отклонить начисление */
export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('salda_user_id')?.value;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as {
    action: 'confirm' | 'reject';
    ids?: string[];
    id?: string;
  };

  const supabase = createAdminClient();

  if (body.action === 'confirm') {
    let query = (supabase.from('transactions') as any)
      .update({ employee_confirmed: true })
      .eq('related_user_id', userId)
      .eq('employee_confirmed', false)
      .in('category_id', ALL_PAYROLL_CATS);

    if (body.ids && body.ids.length > 0) {
      query = query.in('id', body.ids);
    }

    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'reject') {
    if (!body.id) return NextResponse.json({ error: 'id обязателен' }, { status: 400 });

    const { error } = await (supabase.from('transactions') as any)
      .update({
        lifecycle_status: 'cancelled',
        cancelled_reason: 'Отклонено сотрудником — требует корректировки ЗП',
      })
      .eq('id', body.id)
      .eq('related_user_id', userId)
      .eq('employee_confirmed', false);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
}
