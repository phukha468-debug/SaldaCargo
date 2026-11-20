/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const PAYROLL_DRIVER_CAT = 'd79213ee-3bc6-4433-b58a-ca7ea1040d00';
const PAYROLL_LOADER_CAT = '18792fa8-fda8-472d-8e04-e19d2c6c053c';

/** POST /api/trips/:id/return — вернуть рейс водителю на доработку */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: tripData } = await (supabase.from('trips') as any)
    .select('trip_number')
    .eq('id', id)
    .single();

  // Удаляем транзакции рейса, чтобы избежать дублей при повторном апруве
  await Promise.all([
    (supabase.from('transactions') as any).delete().eq('trip_id', id),
    // Легаси: транзакции ЗП без trip_id (созданные до добавления FK)
    ...(tripData?.trip_number
      ? [
          (supabase.from('transactions') as any)
            .delete()
            .ilike('description', `%рейс №${tripData.trip_number}%`)
            .in('category_id', [PAYROLL_DRIVER_CAT, PAYROLL_LOADER_CAT])
            .is('trip_id', null),
        ]
      : []),
  ]);

  // Ставим статус returned, но сохраняем фактически зафиксированный пробег и время завершения,
  // чтобы не ломать цепочку одометров и не создавать конфликт нескольких активных рейсов у водителя.
  const { error } = await (supabase.from('trips') as any)
    .update({
      status: 'completed',
      lifecycle_status: 'returned',
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Откатываем заказы в draft — не должны учитываться в P&L до повторного апрува
  await (supabase.from('trip_orders') as any)
    .update({ lifecycle_status: 'draft' })
    .eq('trip_id', id)
    .neq('lifecycle_status', 'cancelled');

  // Связанную заявку в orders держим в pending_review (с пометкой о возврате)
  await (supabase.from('orders') as any)
    .update({ status: 'pending_review', updated_at: new Date().toISOString() })
    .eq('active_trip_id', id);

  return NextResponse.json({ success: true });
}
