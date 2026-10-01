/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

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

  const { data, error } = await ((supabase.from('trips') as any)
    .update({
      status: 'completed',
      lifecycle_status: 'draft', // ждёт апрува админа
      odometer_end: body.odometer_end,
      driver_note: body.driver_note ?? null,
      ended_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'in_progress') // защита от двойного завершения
    .select()
    .single() as any);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Если водитель указал заправку в конце смены — создаем расход по рейсу
  if (body.fuel_amount && Number(body.fuel_amount) > 0) {
    const FUEL_CAT_ID = '62cebf3f-9982-4cc6-904b-48c6169cf5e4';
    await (supabase.from('trip_expenses') as any).insert({
      trip_id: id,
      category_id: FUEL_CAT_ID,
      amount: String(body.fuel_amount),
      payment_method: body.fuel_payment_method || 'fuel_card',
      description:
        body.fuel_payment_method === 'cash'
          ? 'Заправка в конце смены (наличные)'
          : 'Заправка в конце смены (Топливная карта ТК)',
      idempotency_key: crypto.randomUUID(),
    });
  }

  return NextResponse.json(data);
}
