/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { isGeostroyCounterparty, isGeostroyOrderValid } from '@saldacargo/shared';

/** POST /api/trips/:id/finish — завершить рейс */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as {
    odometer_end?: number;
    driver_note?: string;
    fuel_amount?: number;
    fuel_payment_method?: 'fuel_card' | 'cash';
  };

  const supabase = createAdminClient();

  // Защита: для заказов с контрагентом «ООО Геостройиндустрия» обязательны Маршрут и Дата начала (по маске)
  const { data: tripOrders, error: ordersError } = await (supabase.from('trip_orders') as any)
    .select('id, description, lifecycle_status, counterparty:counterparties(name)')
    .eq('trip_id', id);

  if (!ordersError && Array.isArray(tripOrders)) {
    const activeOrders = tripOrders.filter((o: any) => o.lifecycle_status !== 'cancelled');
    for (const order of activeOrders) {
      const cpName = order.counterparty?.name;
      if (isGeostroyCounterparty(cpName)) {
        if (!isGeostroyOrderValid(order.description)) {
          return NextResponse.json(
            {
              error:
                'Нельзя отправить рейс на ревью: для контрагента «ООО Геостройиндустрия» обязательно заполните маршрут и дату начала маршрута (в формате ДД.ММ.ГГГГ).',
            },
            { status: 400 },
          );
        }
      }
    }
  }

  const { data, error } = await ((supabase.from('trips') as any)
    .update({
      status: 'completed',
      lifecycle_status: 'draft', // ждёт апрува админа
      odometer_end: body.odometer_end,
      driver_note: body.driver_note ?? null,
      ended_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'in_progress')
    .select()
    .maybeSingle() as any);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!data) {
    const { data: existingTrip } = await (supabase.from('trips') as any)
      .select()
      .eq('id', id)
      .maybeSingle();

    if (existingTrip && existingTrip.status === 'completed') {
      return NextResponse.json(existingTrip);
    }

    return NextResponse.json({ error: 'Рейс не найден или уже завершён' }, { status: 400 });
  }

  return NextResponse.json(data);
}
