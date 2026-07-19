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
    .select('id, lifecycle_status, idempotency_key, category_id, direction')
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

  const WALLET_TRANSFER_CAT = 'b9946a5e-4a33-4ed9-a272-5dee12d4ca93';
  const ADVANCE_CATEGORY_ID = 'a0000000-0000-0000-0000-000000000001';
  const PAYROLL_CATEGORY_IDS = [
    'd79213ee-3bc6-4433-b58a-ca7ea1040d00',
    '18792fa8-fda8-472d-8e04-e19d2c6c053c',
    '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6',
  ];

  if (existing.idempotency_key && (existing.category_id === WALLET_TRANSFER_CAT || existing.category_id === ADVANCE_CATEGORY_ID)) {
    const { data: batchTxs } = await (supabase.from('transactions') as any)
      .select('id, category_id')
      .eq('idempotency_key', existing.idempotency_key);
    
    if (batchTxs) {
      const payrollIds = batchTxs
        .filter((t: any) => PAYROLL_CATEGORY_IDS.includes(t.category_id))
        .map((t: any) => t.id);

      if (payrollIds.length > 0) {
        await (supabase.from('transactions') as any)
          .update({ settlement_status: 'pending', idempotency_key: null })
          .in('id', payrollIds);
      }
      
      const otherIds = batchTxs
        .filter((t: any) => t.id !== id && !PAYROLL_CATEGORY_IDS.includes(t.category_id))
        .map((t: any) => t.id);
        
      if (otherIds.length > 0) {
        await (supabase.from('transactions') as any)
          .update({
            lifecycle_status: 'cancelled',
            cancelled_reason: 'Аннулирована связанная транзакция выплаты',
            updated_at: new Date().toISOString(),
          })
          .in('id', otherIds);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
