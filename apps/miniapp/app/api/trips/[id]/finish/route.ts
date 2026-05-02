/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/** POST /api/trips/:id/finish — завершить рейс */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as {
    odometer_end: number;
    driver_note?: string;
  };

  const supabase = await createClient();

  const { data, error } = await ((supabase
    .from('trips') as any)
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
  return NextResponse.json(data);
}
