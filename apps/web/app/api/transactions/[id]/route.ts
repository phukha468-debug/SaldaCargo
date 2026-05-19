/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** DELETE /api/transactions/[id] — аннулировать транзакцию (soft-delete) */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reason: string = (body.reason as string) || 'Аннулировано администратором';

  if (!id) return NextResponse.json({ error: 'ID обязателен' }, { status: 400 });

  const supabase = createAdminClient();

  // Проверяем, что транзакция существует и не аннулирована ранее
  const { data: existing, error: fetchErr } = await (supabase.from('transactions') as any)
    .select('id, lifecycle_status')
    .eq('id', id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Транзакция не найдена' }, { status: 404 });
  }
  if (existing.lifecycle_status === 'cancelled') {
    return NextResponse.json({ error: 'Транзакция уже аннулирована' }, { status: 409 });
  }

  const { error } = await (supabase.from('transactions') as any)
    .update({
      lifecycle_status: 'cancelled',
      cancelled_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
