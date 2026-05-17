/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/** POST /api/mechanic/orders/:id/claim — механик берёт незакреплённый наряд */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const userId = cookieStore.get('salda_user_id')?.value;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();

  // Проверяем что наряд существует и не назначен
  const { data: order, error: fetchErr } = await (supabase.from('service_orders') as any)
    .select('id, assigned_mechanic_id, status')
    .eq('id', id)
    .single();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: 'Наряд не найден' }, { status: 404 });
  if (order.assigned_mechanic_id) {
    return NextResponse.json({ error: 'Наряд уже назначен другому механику' }, { status: 409 });
  }
  if (order.status === 'cancelled') {
    return NextResponse.json({ error: 'Наряд отменён' }, { status: 409 });
  }

  const { data, error } = await (supabase.from('service_orders') as any)
    .update({
      assigned_mechanic_id: userId,
      status: 'in_progress',
    })
    .eq('id', id)
    .eq('assigned_mechanic_id', null) // оптимистичная блокировка
    .select('id, order_number, status')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Наряд уже взят' }, { status: 409 });

  return NextResponse.json(data);
}
