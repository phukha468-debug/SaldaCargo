/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** DELETE /api/trips/:id/expenses/:expenseId */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; expenseId: string }> },
) {
  const { expenseId } = await params;
  const supabase = createAdminClient();

  const { data, error } = await (supabase
    .from('trip_expenses')
    .delete()
    .eq('id', expenseId)
    .select() as any);

  console.log('[DELETE expense] id:', expenseId, '| deleted:', data, '| error:', error);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: `Расход не найден (id: ${expenseId})` }, { status: 404 });
  }

  return NextResponse.json({ ok: true, deleted: data.length });
}
