/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const BANK_ID = '10000000-0000-0000-0000-000000000001';
const CASH_ID = '10000000-0000-0000-0000-000000000002';
const CARD_ID = '10000000-0000-0000-0000-000000000003';

const WALLET_META: Record<string, { id: string; name: string }> = {
  bank: { id: BANK_ID, name: 'Банк' },
  cash: { id: CASH_ID, name: 'Касса' },
  card: { id: CARD_ID, name: 'Карта' },
};

export type WalletHistoryItem = {
  id: string;
  date: string;
  description: string;
  amount: string;
  direction: 'in' | 'out';
  source: 'trip_order' | 'transaction' | 'cash_collection';
  category: string | null;
  counterparty: string | null;
  trip_number: number | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet') ?? 'bank';
  const from = searchParams.get('from'); // YYYY-MM-DD
  const to = searchParams.get('to'); // YYYY-MM-DD

  const meta = WALLET_META[wallet];
  if (!meta) return NextResponse.json({ error: 'Неизвестный кошелёк' }, { status: 400 });

  const fromISO = from ? `${from}T00:00:00.000Z` : null;
  const toISO = to ? `${to}T23:59:59.999Z` : null;

  const supabase = createAdminClient();
  const items: WalletHistoryItem[] = [];

  if (wallet === 'bank' || wallet === 'card') {
    const methods = wallet === 'bank' ? ['bank_invoice', 'qr'] : ['card_driver'];
    let q = (supabase.from('trip_orders') as any)
      .select(
        `id, amount, created_at, payment_method,
        trip:trips!inner(trip_number, driver:users!trips_driver_id_fkey(name)),
        counterparty:counterparties(name), description`,
      )
      .in('payment_method', methods)
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'completed')
      .order('created_at', { ascending: false })
      .limit(300);
    if (fromISO) q = q.gte('created_at', fromISO);
    if (toISO) q = q.lte('created_at', toISO);

    const { data: orders } = await q;
    for (const o of (orders as any[]) ?? []) {
      const cpName = o.counterparty?.name ?? o.description ?? null;
      items.push({
        id: o.id,
        date: o.created_at,
        description:
          [cpName, o.trip?.driver?.name ? `вод. ${o.trip.driver.name}` : null]
            .filter(Boolean)
            .join(' · ') || 'Оплата рейса',
        amount: o.amount,
        direction: 'in',
        source: 'trip_order',
        category: 'Выручка',
        counterparty: cpName,
        trip_number: o.trip?.trip_number ?? null,
      });
    }
  }

  if (wallet === 'cash') {
    let q = (supabase.from('cash_collections') as any)
      .select('id, amount, created_at, note, driver:users!cash_collections_driver_id_fkey(name)')
      .order('created_at', { ascending: false })
      .limit(300);
    if (fromISO) q = q.gte('created_at', fromISO);
    if (toISO) q = q.lte('created_at', toISO);

    const { data: collections } = await q;
    for (const c of (collections as any[]) ?? []) {
      items.push({
        id: c.id,
        date: c.created_at,
        description: `Инкассация — ${c.driver?.name ?? 'Водитель'}${c.note ? ` · ${c.note}` : ''}`,
        amount: c.amount,
        direction: 'in',
        source: 'cash_collection',
        category: 'Инкассация',
        counterparty: c.driver?.name ?? null,
        trip_number: null,
      });
    }
  }

  // Transactions in/out for this wallet
  const buildTxQuery = (q: any) => {
    if (fromISO) q = q.gte('created_at', fromISO);
    if (toISO) q = q.lte('created_at', toISO);
    return q;
  };

  const txSelect =
    'id, amount, created_at, description, category:transaction_categories(name), counterparty:counterparties(name), related_user:users!transactions_related_user_id_fkey(name)';

  const [{ data: txIn }, { data: txOut }] = await Promise.all([
    buildTxQuery(
      (supabase.from('transactions') as any)
        .select(txSelect)
        .eq('to_wallet_id', meta.id)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .order('created_at', { ascending: false })
        .limit(300),
    ),
    buildTxQuery(
      (supabase.from('transactions') as any)
        .select(txSelect)
        .eq('from_wallet_id', meta.id)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .order('created_at', { ascending: false })
        .limit(300),
    ),
  ]);

  for (const tx of (txIn as any[]) ?? []) {
    items.push({
      id: tx.id,
      date: tx.created_at,
      description:
        tx.description ||
        tx.counterparty?.name ||
        tx.related_user?.name ||
        tx.category?.name ||
        'Поступление',
      amount: tx.amount,
      direction: 'in',
      source: 'transaction',
      category: tx.category?.name ?? null,
      counterparty: tx.counterparty?.name ?? null,
      trip_number: null,
    });
  }
  for (const tx of (txOut as any[]) ?? []) {
    items.push({
      id: tx.id,
      date: tx.created_at,
      description:
        tx.description ||
        tx.counterparty?.name ||
        tx.related_user?.name ||
        tx.category?.name ||
        'Расход',
      amount: tx.amount,
      direction: 'out',
      source: 'transaction',
      category: tx.category?.name ?? null,
      counterparty: tx.counterparty?.name ?? null,
      trip_number: null,
    });
  }

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({ wallet, wallet_name: meta.name, items });
}
