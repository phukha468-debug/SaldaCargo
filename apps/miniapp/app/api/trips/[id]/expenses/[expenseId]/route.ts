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

  const { error } = await (supabase.from('trip_expenses').delete().eq('id', expenseId) as any);

  if (error) {
    console.error('[DELETE expense] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
