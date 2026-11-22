import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { createWebApiHandler } from '@/lib/api';
import { invalidateWalletsCache } from '@saldacargo/domain-service';

const ADVANCE_CATEGORY_ID = 'a0000000-0000-0000-0000-000000000001';

const advanceSchema = z.object({
  user_id: z.string().uuid('Некорректный user_id'),
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  from_wallet_id: z.string().uuid('Некорректный from_wallet_id'),
  note: z.string().max(500).optional(),
});

/** POST /api/staff/advance — выдать аванс сотруднику */
export const POST = createWebApiHandler(
  {
    routeName: 'web:/api/staff/advance',
    roles: ['admin', 'owner'],
    bodySchema: advanceSchema,
  },
  async ({ body, auth }) => {
    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Некорректная сумма' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: user } = await supabase
      .from('users')
      .select('name')
      .eq('id', body.user_id)
      .single();

    if (!user) return NextResponse.json({ error: 'Сотрудник не найден' }, { status: 404 });

    const description =
      body.note?.trim() ||
      `Аванс: ${user.name} — ${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`;

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        direction: 'expense',
        category_id: ADVANCE_CATEGORY_ID,
        amount: amount.toFixed(2),
        description,
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        related_user_id: body.user_id,
        from_wallet_id: body.from_wallet_id,
        created_by: auth.userId,
        idempotency_key: crypto.randomUUID(),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    invalidateWalletsCache();
    return NextResponse.json(data, { status: 201 });
  },
);
