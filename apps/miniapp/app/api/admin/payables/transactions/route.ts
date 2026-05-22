/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const SUPPLIERS = [
  { id: '20000000-0000-0000-0000-000000000001', name: 'Дерябин ГСМ', icon: '⛽' },
  { id: '20000000-0000-0000-0000-000000000002', name: 'Новиков А.В. Запчасти', icon: '🔧' },
  { id: '20000000-0000-0000-0000-000000000003', name: 'Ромашин Запчасти', icon: '🔧' },
];

/** GET /api/admin/payables/transactions — транзакции по каждому поставщику */
export async function GET() {
  try {
    const supabase = createAdminClient();
    const allIds = SUPPLIERS.map((s) => s.id);

    const { data: txns, error } = await (supabase as any)
      .from('transactions')
      .select('id, amount, description, created_at, settlement_status, direction, counterparty_id')
      .in('counterparty_id', allIds)
      .eq('lifecycle_status', 'approved')
      .eq('direction', 'expense')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const result = SUPPLIERS.map((s) => {
      const supplierTxns = (txns ?? []).filter((t: any) => t.counterparty_id === s.id);
      const pending = supplierTxns.filter((t: any) => t.settlement_status === 'pending');
      const completed = supplierTxns.filter((t: any) => t.settlement_status === 'completed');
      return {
        ...s,
        pending,
        completed,
      };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
