import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { createWebApiHandler } from '@/lib/api';
import { invalidateWalletsCache, resolveOrganizationFinanceIds } from '@saldacargo/domain-service';

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
    requiredModule: 'finance',
    bodySchema: transferSchema,
  },
  async ({ body, auth }) => {
    const { item_id, source, direction, target_wallet } = body;
    const supabase = createAdminClient();
    const ids = resolveOrganizationFinanceIds(auth.orgSettings);
    const walletIds: Record<string, string> = {
      bank: ids.bankId,
      cash: ids.cashId,
      fuel_card: ids.fuelCardId,
      garage: ids.garageId,
    };

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
        .eq('id', item_id)
        .eq('organization_id', auth.organizationId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const walletId = walletIds[target_wallet];
      if (!walletId) {
        return NextResponse.json({ error: 'Недопустимый целевой кошелёк' }, { status: 400 });
      }
      const field = direction === 'in' ? 'to_wallet_id' : 'from_wallet_id';
      const { error } = await supabase
        .from('transactions')
        .update({ [field]: walletId })
        .eq('id', item_id)
        .eq('organization_id', auth.organizationId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateWalletsCache(auth.organizationId);
    return NextResponse.json({ ok: true });
  },
);
