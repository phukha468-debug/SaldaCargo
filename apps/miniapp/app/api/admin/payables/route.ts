/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const OPTI24_ID = '20000000-0000-0000-0000-000000000001';
const NOVIKOV_ID = '20000000-0000-0000-0000-000000000002';
const ROMASHIM_ID = '20000000-0000-0000-0000-000000000003';

const SUPPLIERS = [
  { id: OPTI24_ID, name: 'Дерябин ГСМ', icon: '⛽', autoAccrue: false },
  { id: NOVIKOV_ID, name: 'Новиков А.В. Запчасти', icon: '🔧', autoAccrue: false },
  { id: ROMASHIM_ID, name: 'Ромашин Запчасти', icon: '🔧', autoAccrue: false },
];

export async function GET() {
  try {
    const supabase = createAdminClient();
    const allIds = SUPPLIERS.map((s) => s.id);

    const [{ data: txPending }, { data: txCompleted }, { data: counterparties }] =
      await Promise.all([
        (supabase.from('transactions') as any)
          .select('amount, counterparty_id')
          .in('counterparty_id', allIds)
          .eq('direction', 'expense')
          .eq('settlement_status', 'pending')
          .eq('lifecycle_status', 'approved'),
        (supabase.from('transactions') as any)
          .select('amount, counterparty_id')
          .in('counterparty_id', allIds)
          .eq('direction', 'expense')
          .eq('settlement_status', 'completed')
          .eq('lifecycle_status', 'approved'),
        (supabase.from('counterparties') as any).select('id, payable_amount').in('id', allIds),
      ]);

    const cpPayableMap = new Map<string, number>(
      (counterparties ?? []).map((c: any) => [c.id, parseFloat(c.payable_amount ?? '0')]),
    );

    const result = SUPPLIERS.map((s) => {
      let debt: number;
      const manualDebt = cpPayableMap.get(s.id) ?? 0;

      if (manualDebt > 0) {
        debt = manualDebt;
      } else {
        const pending = (txPending ?? [])
          .filter((t: any) => t.counterparty_id === s.id)
          .reduce((acc: number, t: any) => acc + parseFloat(t.amount ?? '0'), 0);
        const paid = (txCompleted ?? [])
          .filter((t: any) => t.counterparty_id === s.id)
          .reduce((acc: number, t: any) => acc + parseFloat(t.amount ?? '0'), 0);
        debt = Math.max(0, pending - paid);
      }
      return { id: s.id, name: s.name, icon: s.icon, debt: debt.toFixed(2) };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
