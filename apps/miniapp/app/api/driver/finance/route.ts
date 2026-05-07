/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/** GET /api/driver/finance — финансовая информация текущего водителя */
export async function GET() {
  const cookieStore = await cookies();
  const driverId = cookieStore.get('salda_user_id')?.value;

  if (!driverId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();

  // 1. Кошелёк подотчёта
  const { data: wallet } = await (supabase
    .from('wallets')
    .select('id, name')
    .eq('owner_user_id', driverId)
    .eq('type', 'driver_accountable')
    .maybeSingle() as any);

  let accountableTransactions: any[] = [];
  let accountableBalance = '0';

  if (wallet) {
    const { data: txns } = await (supabase
      .from('transactions')
      .select(
        `id, amount, direction, description, created_at,
         category:transaction_categories(name)`,
      )
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'completed')
      .or(`from_wallet_id.eq.${wallet.id},to_wallet_id.eq.${wallet.id}`)
      .order('created_at', { ascending: false })
      .limit(20) as any);

    accountableTransactions = txns ?? [];

    const { data: allTxns } = await (supabase
      .from('transactions')
      .select('amount, from_wallet_id, to_wallet_id')
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'completed')
      .or(`from_wallet_id.eq.${wallet.id},to_wallet_id.eq.${wallet.id}`) as any);

    const balance = (allTxns ?? []).reduce((sum: number, t: any) => {
      const amount = parseFloat(t.amount);
      if (t.to_wallet_id === wallet.id) return sum + amount;
      if (t.from_wallet_id === wallet.id) return sum - amount;
      return sum;
    }, 0);
    accountableBalance = balance.toFixed(2);
  }

  // 2. ЗП по рейсам (текущий месяц)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: salaryTrips } = await (supabase
    .from('trips')
    .select(
      `id, trip_number, started_at, lifecycle_status,
       asset:assets(short_name),
       trip_orders(driver_pay, lifecycle_status)`,
    )
    .eq('driver_id', driverId)
    .gte('started_at', monthStart)
    .order('started_at', { ascending: false }) as any);

  return NextResponse.json({
    accountable: { balance: accountableBalance, transactions: accountableTransactions },
    salary: { trips: salaryTrips ?? [] },
  });
}
