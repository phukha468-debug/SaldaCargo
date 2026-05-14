/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const OPTI24_ID = '20000000-0000-0000-0000-000000000001';
export const NOVIKOV_ID = '20000000-0000-0000-0000-000000000002';
export const ROMASHIM_ID = '20000000-0000-0000-0000-000000000003';

const CAT_FUEL = '62cebf3f-9982-4cc6-904b-48c6169cf5e4';
const CAT_PARTS = '9d18370d-3228-4f2a-8530-52b168cfa8d7';

export const SUPPLIERS = [
  {
    id: OPTI24_ID,
    name: 'Дерябин ГСМ',
    icon: '⛽',
    category: CAT_FUEL,
    debtDays: 15,
    autoAccrue: true,
    description: 'ГСМ · расход по карте → автоматически в долг',
  },
  {
    id: NOVIKOV_ID,
    name: 'Новиков А.В.',
    icon: '🔧',
    category: CAT_PARTS,
    debtDays: 30,
    autoAccrue: false,
    description: 'Запчасти · отсрочка 30 дней',
  },
  {
    id: ROMASHIM_ID,
    name: 'Ромашин',
    icon: '🔧',
    category: CAT_PARTS,
    debtDays: 30,
    autoAccrue: false,
    description: 'Запчасти · отсрочка 30 дней',
  },
];

const sum = (rows: any[]) =>
  (rows ?? []).reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0);

export async function GET() {
  try {
    const supabase = createAdminClient();

    const allSupplierIds = SUPPLIERS.map((s) => s.id);

    const [
      { data: fuelExpenses },
      { data: supplierTxPending },
      { data: supplierTxCompleted },
      { data: recentEntries },
    ] = await Promise.all([
      // Расходы по топливной карте (источник долга Опти24)
      (supabase.from('trip_expenses') as any).select('amount').eq('payment_method', 'fuel_card'),

      // Pending транзакции = неоплаченные долги (Новиков/Ромашин)
      (supabase.from('transactions') as any)
        .select('amount, counterparty_id')
        .in('counterparty_id', allSupplierIds)
        .eq('direction', 'expense')
        .eq('settlement_status', 'pending')
        .eq('lifecycle_status', 'approved'),

      // Completed транзакции = платежи поставщикам
      (supabase.from('transactions') as any)
        .select('amount, counterparty_id')
        .in('counterparty_id', allSupplierIds)
        .eq('direction', 'expense')
        .eq('settlement_status', 'completed')
        .eq('lifecycle_status', 'approved'),

      // Последние записи для истории (pending + completed, все поставщики)
      (supabase.from('transactions') as any)
        .select('id, amount, description, settlement_status, created_at, counterparty_id')
        .in('counterparty_id', allSupplierIds)
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const opti24FuelTotal = sum(fuelExpenses ?? []);
    const opti24Payments = (supplierTxCompleted ?? [])
      .filter((t: any) => t.counterparty_id === OPTI24_ID)
      .reduce((s: number, t: any) => s + parseFloat(t.amount ?? '0'), 0);
    const opti24ManualPending = (supplierTxPending ?? [])
      .filter((t: any) => t.counterparty_id === OPTI24_ID)
      .reduce((s: number, t: any) => s + parseFloat(t.amount ?? '0'), 0);

    const result = SUPPLIERS.map((s) => {
      let debt: number;

      if (s.autoAccrue) {
        // Дерябин ГСМ: fuel_card расходы + ручные pending − все платежи
        debt = opti24FuelTotal + opti24ManualPending - opti24Payments;
      } else {
        // Новиков/Ромашин: pending минус completed
        const pending = (supplierTxPending ?? [])
          .filter((t: any) => t.counterparty_id === s.id)
          .reduce((acc: number, t: any) => acc + parseFloat(t.amount ?? '0'), 0);
        const paid = (supplierTxCompleted ?? [])
          .filter((t: any) => t.counterparty_id === s.id)
          .reduce((acc: number, t: any) => acc + parseFloat(t.amount ?? '0'), 0);
        debt = pending - paid;
      }

      const history = (recentEntries ?? [])
        .filter((t: any) => t.counterparty_id === s.id)
        .slice(0, 5);

      return {
        ...s,
        debt: debt.toFixed(2),
        history,
      };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
