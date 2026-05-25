/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const ALLOWED_CATEGORY_IDS = [
  'd79213ee-3bc6-4433-b58a-ca7ea1040d00', // PAYROLL_DRIVER
  '18792fa8-fda8-472d-8e04-e19d2c6c053c', // PAYROLL_LOADER
  '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6', // PAYROLL_MECHANIC
  'a0000000-0000-0000-0000-000000000001', // ADVANCE
];

/** PATCH /api/staff/transactions/[txId] — исправить сумму транзакции */
export async function PATCH(req: Request, { params }: { params: Promise<{ txId: string }> }) {
  const { txId } = await params;
  const body = await req.json();
  const amount = parseFloat(body.amount);

  if (isNaN(amount) || amount < 0) {
    return NextResponse.json({ error: 'Некорректная сумма' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: tx, error: fetchErr } = await (supabase.from('transactions') as any)
    .select('id, category_id, lifecycle_status')
    .eq('id', txId)
    .single();

  if (fetchErr || !tx) {
    return NextResponse.json({ error: 'Транзакция не найдена' }, { status: 404 });
  }
  if (!ALLOWED_CATEGORY_IDS.includes(tx.category_id)) {
    return NextResponse.json(
      { error: 'Редактирование запрещено для этой категории' },
      { status: 403 },
    );
  }

  const { error } = await (supabase.from('transactions') as any)
    .update({ amount: amount.toFixed(2) })
    .eq('id', txId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/staff/transactions/[txId] — удалить транзакцию (только ADVANCE или pending PAYROLL) */
export async function DELETE(_req: Request, { params }: { params: Promise<{ txId: string }> }) {
  const { txId } = await params;
  const supabase = createAdminClient();

  const { data: tx, error: fetchErr } = await (supabase.from('transactions') as any)
    .select('id, category_id, settlement_status')
    .eq('id', txId)
    .single();

  if (fetchErr || !tx) {
    return NextResponse.json({ error: 'Транзакция не найдена' }, { status: 404 });
  }
  if (!ALLOWED_CATEGORY_IDS.includes(tx.category_id)) {
    return NextResponse.json({ error: 'Удаление запрещено для этой категории' }, { status: 403 });
  }

  const { error } = await (supabase.from('transactions') as any).delete().eq('id', txId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
