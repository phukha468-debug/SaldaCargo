/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const DERYABIN_ID = '20000000-0000-0000-0000-000000000001';
export const NOVIKOV_ID = '20000000-0000-0000-0000-000000000002';
export const ROMASHIM_ID = '20000000-0000-0000-0000-000000000003';

// Kept for backwards-compat imports
export const OPTI24_ID = DERYABIN_ID;

const CAT_FUEL = '62cebf3f-9982-4cc6-904b-48c6169cf5e4';
const CAT_PARTS = '9d18370d-3228-4f2a-8530-52b168cfa8d7';

const DERYABIN_DISCOUNT_PCT = 12;

export const SUPPLIERS = [
  {
    id: DERYABIN_ID,
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
    const allIds = SUPPLIERS.map((s) => s.id);

    const [{ data: fuelExpensesAllTime }, { data: txAllTime }] = await Promise.all([
      (supabase.from('trip_expenses') as any)
        .select(
          'amount, created_at, description, trips(trip_number, assets(short_name, reg_number))',
        )
        .eq('payment_method', 'fuel_card')
        .order('created_at', { ascending: false }),

      (supabase.from('transactions') as any)
        .select(
          'id, amount, counterparty_id, settlement_status, description, created_at, direction',
        )
        .in('counterparty_id', allIds)
        .eq('lifecycle_status', 'approved')
        .order('created_at', { ascending: false }),
    ]);

    const allTx = (txAllTime ?? []) as any[];
    const allFuel = (fuelExpensesAllTime ?? []) as any[];

    const result = SUPPLIERS.map((s) => {
      let debt: number;
      let accumulated: number | null = null;
      let discount: number | null = null;

      const sTxAll = allTx.filter((t) => t.counterparty_id === s.id);
      const pending = sum(
        sTxAll.filter((t) => t.settlement_status === 'pending' && t.direction === 'expense'),
      );
      const payments = sum(
        sTxAll.filter((t) => t.settlement_status === 'completed' && t.direction === 'expense'),
      );

      if (s.id === DERYABIN_ID) {
        const fuelTotal = sum(allFuel);
        accumulated = fuelTotal + pending;
        discount = accumulated * (DERYABIN_DISCOUNT_PCT / 100);
        debt = Math.max(0, accumulated - discount - payments);
      } else {
        debt = Math.max(0, pending - payments);
      }

      let history: any[];
      if (s.id === DERYABIN_ID) {
        const fuelRows = allFuel.map((f: any) => ({
          id: `fuel_${f.created_at}`,
          amount: f.amount,
          description: f.description || 'Топливо по карте',
          trip_number: f.trips?.trip_number ?? null,
          asset_short_name: f.trips?.assets?.short_name ?? null,
          asset_reg_number: f.trips?.assets?.reg_number ?? null,
          settlement_status: 'pending',
          created_at: f.created_at,
          source: 'fuel_card',
          direction: 'expense',
        }));
        history = [...sTxAll.map((t: any) => ({ ...t, source: 'manual' })), ...fuelRows].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      } else {
        history = sTxAll;
      }

      return {
        ...s,
        debt: debt.toFixed(2),
        accumulated: accumulated !== null ? accumulated.toFixed(2) : null,
        discount: discount !== null ? discount.toFixed(2) : null,
        history,
      };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
