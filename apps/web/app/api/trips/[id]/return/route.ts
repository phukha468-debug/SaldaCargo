/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** POST /api/trips/:id/return — вернуть рейс водителю на доработку */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  // Сбрасываем статус на in_progress и lifecycle на draft (или returned)
  // Также очищаем конечные данные, чтобы водитель заполнил их заново
  const { error } = await (supabase.from('trips') as any)
    .update({
      status: 'in_progress',
      lifecycle_status: 'returned',
      odometer_end: null,
      ended_at: null,
      driver_note: null,
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Откатываем заказы в draft — не должны учитываться в P&L до повторного апрува
  await (supabase.from('trip_orders') as any)
    .update({ lifecycle_status: 'draft' })
    .eq('trip_id', id)
    .neq('lifecycle_status', 'cancelled');

  return NextResponse.json({ success: true });
}
