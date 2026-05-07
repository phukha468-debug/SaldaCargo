/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** DELETE /api/trips/:id/expenses/:expenseId */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; expenseId: string }> },
) {
  const { id: tripId, expenseId } = await params;
  const supabase = createAdminClient();

  // Удаляем только по id — убеждаемся что запись принадлежит этому рейсу
  const { data: existing, error: fetchError } = await (supabase
    .from('trip_expenses')
    .select('id, trip_id')
    .eq('id', expenseId)
    .single() as any);

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Расход не найден' }, { status: 404 });
  }
  if (existing.trip_id !== tripId) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 });
  }

  const { error } = await (supabase.from('trip_expenses').delete().eq('id', expenseId) as any);

  if (error) {
    console.error('[DELETE expense] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
