/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// Опти24 — специальный поставщик с автоматическим расчётом долга по топливным картам
const OPTI24_ID = '20000000-0000-0000-0000-000000000001';

export async function GET() {
  try {
    const supabase = createAdminClient();

    // Берём всех активных поставщиков
    const { data: suppliers, error: suppliersError } = await (
      supabase.from('counterparties') as any
    )
      .select('id, name, payable_amount')
      .in('type', ['supplier', 'both'])
      .eq('is_active', true)
      .order('name');

    if (suppliersError) throw new Error(suppliersError.message);

    const result: { id: string; name: string; icon: string; debt: string }[] = [];

    for (const s of suppliers ?? []) {
      if (s.id === OPTI24_ID) {
        // Опти24: автоматический расчёт — расходы по топливной карте минус оплаченные транзакции
        const [{ data: fuelExpenses }, { data: txCompleted }] = await Promise.all([
          (supabase.from('trip_expenses') as any)
            .select('amount')
            .eq('payment_method', 'fuel_card'),
          (supabase.from('transactions') as any)
            .select('amount')
            .eq('counterparty_id', OPTI24_ID)
            .eq('direction', 'expense')
            .eq('settlement_status', 'completed')
            .eq('lifecycle_status', 'approved'),
        ]);

        const totalFuel = (fuelExpenses ?? []).reduce(
          (acc: number, r: any) => acc + parseFloat(r.amount ?? '0'),
          0,
        );
        const totalPaid = (txCompleted ?? []).reduce(
          (acc: number, r: any) => acc + parseFloat(r.amount ?? '0'),
          0,
        );
        const debt = Math.max(0, totalFuel - totalPaid);
        result.push({ id: s.id, name: s.name, icon: '⛽', debt: debt.toFixed(2) });
      } else {
        // Остальные поставщики — ручной ввод через counterparties.payable_amount
        const debt = parseFloat(s.payable_amount ?? '0');
        if (debt > 0) {
          result.push({ id: s.id, name: s.name, icon: '🏢', debt: debt.toFixed(2) });
        }
      }
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
