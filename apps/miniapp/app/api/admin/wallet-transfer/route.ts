import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { createMiniappApiHandler } from '@/lib/api';
import { invalidateWalletsCache } from '@saldacargo/domain-service';

const WALLET_TRANSFER_CAT = 'b9946a5e-4a33-4ed9-a272-5dee12d4ca93';

const WALLET_NAMES: Record<string, string> = {
  '10000000-0000-0000-0000-000000000001': 'Расчётный счёт',
  '10000000-0000-0000-0000-000000000002': 'Сейф (Наличные)',
};

const walletTransferSchema = z.object({
  from_wallet_id: z.string().uuid('Некорректный from_wallet_id'),
  to_wallet_id: z.string().uuid('Некорректный to_wallet_id'),
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  description: z.string().max(500).optional(),
});

export const POST = createMiniappApiHandler(
  {
    routeName: 'miniapp:/api/admin/wallet-transfer',
    roles: ['admin', 'owner'],
    bodySchema: walletTransferSchema,
  },
  async ({ body, auth }) => {
    if (body.from_wallet_id === body.to_wallet_id) {
      return NextResponse.json({ error: 'Нельзя переводить в тот же кошелёк' }, { status: 400 });
    }
    if (!WALLET_NAMES[body.from_wallet_id] || !WALLET_NAMES[body.to_wallet_id]) {
      return NextResponse.json({ error: 'Неверный кошелёк' }, { status: 400 });
    }
    const amt = parseFloat(body.amount);
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Сумма должна быть больше 0' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const description =
      body.description?.trim() ||
      `Перевод: ${WALLET_NAMES[body.from_wallet_id]} → ${WALLET_NAMES[body.to_wallet_id]}`;

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        direction: 'transfer',
        amount: amt.toFixed(2),
        category_id: WALLET_TRANSFER_CAT,
        from_wallet_id: body.from_wallet_id,
        to_wallet_id: body.to_wallet_id,
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        description,
        created_by: auth.userId,
        idempotency_key: crypto.randomUUID(),
      })
      .select('id')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    invalidateWalletsCache();
    return NextResponse.json(data, { status: 201 });
  },
);
