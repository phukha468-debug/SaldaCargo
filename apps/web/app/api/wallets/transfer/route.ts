/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const WALLET_IDS: Record<string, string> = {
  bank: '10000000-0000-0000-0000-000000000001',
  cash: '10000000-0000-0000-0000-000000000002',
  card: '10000000-0000-0000-0000-000000000003',
};

// payment_method to use when moving trip_order income to a wallet
const WALLET_TO_METHOD: Record<string, string> = {
  bank: 'bank_invoice',
  cash: 'cash',
  card: 'card_driver',
};

/**
 * POST /api/wallets/transfer
 * Body: { item_id, source: 'trip_order'|'transaction', direction: 'in'|'out', target_wallet: 'bank'|'cash'|'card' }
 */
export async function POST(request: Request) {
  try {
    const { item_id, source, direction, target_wallet } = (await request.json()) as {
      item_id: string;
      source: 'trip_order' | 'transaction';
      direction: 'in' | 'out';
      target_wallet: 'bank' | 'cash' | 'card';
    };

    if (!item_id || !source || !target_wallet) {
      return NextResponse.json(
        { error: 'item_id, source, target_wallet обязательны' },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    if (source === 'trip_order') {
      const newMethod = WALLET_TO_METHOD[target_wallet];
      const { error } = await (supabase.from('trip_orders') as any)
        .update({ payment_method: newMethod, settlement_status: 'completed' })
        .eq('id', item_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else if (source === 'transaction') {
      const walletId = WALLET_IDS[target_wallet];
      const field = direction === 'in' ? 'to_wallet_id' : 'from_wallet_id';
      const { error } = await (supabase.from('transactions') as any)
        .update({ [field]: walletId })
        .eq('id', item_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      return NextResponse.json({ error: 'cash_collection нельзя перенести' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка' }, { status: 500 });
  }
}
