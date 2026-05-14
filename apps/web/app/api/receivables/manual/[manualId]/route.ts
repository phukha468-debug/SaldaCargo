/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TRIP_REVENUE_CATEGORY = '74008cf7-0527-4e9f-afd2-d232b8f8125a';
const CASH_ID = '10000000-0000-0000-0000-000000000002';

/** PATCH /api/receivables/manual/[manualId] — погасить ручной долг */
export async function PATCH(_req: Request, { params }: { params: Promise<{ manualId: string }> }) {
  const { manualId } = await params;
  const supabase = createAdminClient();

  const cookieStore = await cookies();
  let adminId = cookieStore.get('salda_user_id')?.value ?? null;

  if (!adminId) {
    const { data: adminUser } = await (supabase as any)
      .from('users')
      .select('id')
      .contains('roles', ['admin'])
      .limit(1)
      .maybeSingle();
    adminId = adminUser?.id ?? 'e9a1c980-eb1e-5c87-9f6d-c7f67eb28a1d';
  }

  const { data: manual, error: fetchErr } = await (supabase as any)
    .from('manual_receivables')
    .select('id, amount, counterparty_id, settled')
    .eq('id', manualId)
    .single();

  if (fetchErr || !manual) {
    return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 });
  }
  if (manual.settled) {
    return NextResponse.json({ error: 'Долг уже погашен' }, { status: 400 });
  }

  const { error: updateErr } = await (supabase as any)
    .from('manual_receivables')
    .update({ settled: true, settled_at: new Date().toISOString() })
    .eq('id', manualId)
    .eq('settled', false);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  const { error: txErr } = await (supabase as any).from('transactions').insert({
    direction: 'income',
    category_id: TRIP_REVENUE_CATEGORY,
    amount: manual.amount,
    counterparty_id: manual.counterparty_id,
    to_wallet_id: CASH_ID,
    description: 'Погашение исторического долга',
    lifecycle_status: 'approved',
    settlement_status: 'completed',
    created_by: adminId,
    idempotency_key: crypto.randomUUID(),
  });

  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/** DELETE /api/receivables/manual/[manualId] — удалить ошибочно введённый долг */
export async function DELETE(_req: Request, { params }: { params: Promise<{ manualId: string }> }) {
  const { manualId } = await params;
  const supabase = createAdminClient();

  const { error } = await (supabase as any)
    .from('manual_receivables')
    .delete()
    .eq('id', manualId)
    .eq('settled', false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
