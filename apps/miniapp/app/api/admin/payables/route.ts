/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const OPTI24_ID = '20000000-0000-0000-0000-000000000001';
const NOVIKOV_ID = '20000000-0000-0000-0000-000000000002';
const ROMASHIM_ID = '20000000-0000-0000-0000-000000000003';

const SUPPLIERS = [
  { id: OPTI24_ID, name: 'Опти24', icon: '⛽', autoAccrue: true },
  { id: NOVIKOV_ID, name: 'Новиков А.В.', icon: '🔧', autoAccrue: false },
  { id: ROMASHIM_ID, name: 'Ромашин', icon: '🔧', autoAccrue: false },
];

const sum = (rows: any[]) =>
  (rows ?? []).reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0);

export async function GET() {
  try {
    const supabase = createAdminClient();
    const allIds = SUPPLIERS.map((s) => s.id);

    const [{ data: fuelExpenses }, { data: txPending }, { data: txCompleted }] = await Promise.all([
      (supabase.from('trip_expenses') as any).select('amount').eq('payment_method', 'fuel_card'),
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
    ]);

    const opti24Payments = (txCompleted ?? [])
      .filter((t: any) => t.counterparty_id === OPTI24_ID)
      .reduce((s: number, t: any) => s + parseFloat(t.amount ?? '0'), 0);

    const result = SUPPLIERS.map((s) => {
      let debt: number;
      if (s.autoAccrue) {
        debt = sum(fuelExpenses ?? []) - opti24Payments;
      } else {
        const pending = (txPending ?? [])
          .filter((t: any) => t.counterparty_id === s.id)
          .reduce((acc: number, t: any) => acc + parseFloat(t.amount ?? '0'), 0);
        const paid = (txCompleted ?? [])
          .filter((t: any) => t.counterparty_id === s.id)
          .reduce((acc: number, t: any) => acc + parseFloat(t.amount ?? '0'), 0);
        debt = pending - paid;
      }
      return { ...s, debt: Math.max(0, debt).toFixed(2) };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
