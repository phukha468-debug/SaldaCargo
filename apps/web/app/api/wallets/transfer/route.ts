import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { createWebApiHandler } from '@/lib/api';
import { invalidateWalletsCache } from '@saldacargo/domain-service';

const WALLET_IDS: Record<string, string> = {
  bank: '10000000-0000-0000-0000-000000000001',
  cash: '10000000-0000-0000-0000-000000000002',
  fuel_card: '10000000-0000-0000-0000-000000000004',
  garage: '10000000-0000-0000-0000-000000000005',
};

const WALLET_TO_METHOD: Record<string, string> = {
  bank: 'bank_invoice',
  cash: 'cash',
};

const transferSchema = z.object({
  item_id: z.string().uuid('Некорректный item_id'),
  source: z.enum(['trip_order', 'transaction']),
  direction: z.enum(['in', 'out']).optional(),
  target_wallet: z.enum(['bank', 'cash', 'card', 'fuel_card', 'garage']),
});

/**
 * POST /api/wallets/transfer
 */
export const POST = createWebApiHandler(
  {
    routeName: 'web:/api/wallets/transfer',
    roles: ['admin', 'owner'],
    bodySchema: transferSchema,
  },
  async ({ body }) => {
    const { item_id, source, direction, target_wallet } = body;
    const supabase = createAdminClient();

    if (source === 'trip_order') {
      const newMethod = WALLET_TO_METHOD[target_wallet];
      if (!newMethod) {
        return NextResponse.json(
          { error: 'Недопустимый кошелёк для заказа рейса' },
          { status: 400 },
        );
      }
      const { error } = await supabase
        .from('trip_orders')
        .update({ payment_method: newMethod, settlement_status: 'completed' })
        .eq('id', item_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const walletId = WALLET_IDS[target_wallet];
      if (!walletId) {
        return NextResponse.json({ error: 'Недопустимый целевой кошелёк' }, { status: 400 });
      }
      const field = direction === 'in' ? 'to_wallet_id' : 'from_wallet_id';
      const { error } = await supabase
        .from('transactions')
        .update({ [field]: walletId })
        .eq('id', item_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateWalletsCache();
    return NextResponse.json({ ok: true });
  },
);
