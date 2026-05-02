/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/** GET /api/driver/finance?driver_id=xxx — финансовая информация водителя */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const driverId = searchParams.get('driver_id');

  if (!driverId) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }

  const supabase = await createClient();

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
    // История транзакций (последние 20)
    const { data: txns } = await (supabase
      .from('transactions')
      .select(`
        id, amount, direction, description, created_at,
        from_wallet:wallets!transactions_from_wallet_id_fkey(name),
        to_wallet:wallets!transactions_to_wallet_id_fkey(name),
        category:transaction_categories(name)
      `)
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'completed')
      .or(`from_wallet_id.eq.${wallet.id},to_wallet_id.eq.${wallet.id}`)
      .order('created_at', { ascending: false })
      .limit(20) as any);

    accountableTransactions = txns ?? [];

    // Баланс (пересчитываем для надежности)
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
    .select(`
      id, trip_number, started_at, lifecycle_status,
      asset:assets(short_name),
      trip_orders(driver_pay, lifecycle_status)
    `)
    .eq('driver_id', driverId)
    .gte('started_at', monthStart)
    .order('started_at', { ascending: false }) as any);

  return NextResponse.json({
    accountable: {
      balance: accountableBalance,
      transactions: accountableTransactions,
    },
    salary: {
      trips: salaryTrips ?? [],
    },
  });
}
