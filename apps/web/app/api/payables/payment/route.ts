import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { createWebApiHandler } from '@/lib/api';
import { invalidateWalletsCache } from '@saldacargo/domain-service';
import { SUPPLIERS } from '../route';

const payablePaymentSchema = z.object({
  supplier_id: z.string().min(1, 'supplier_id обязателен'),
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  from_wallet_id: z.string().uuid('Некорректный from_wallet_id'),
  description: z.string().max(500).optional(),
});

export const POST = createWebApiHandler(
  {
    routeName: 'web:/api/payables/payment',
    roles: ['admin', 'owner'],
    requiredModule: 'finance',
    bodySchema: payablePaymentSchema,
  },
  async ({ body, auth }) => {
    const supplier = SUPPLIERS.find((s) => s.id === body.supplier_id);
    if (!supplier) {
      return NextResponse.json({ error: 'Неверный поставщик' }, { status: 400 });
    }

    const amt = parseFloat(body.amount);
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Сумма должна быть больше 0' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const description = body.description?.trim() || `Оплата долга: ${supplier.name}`;

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        organization_id: auth.organizationId,
        direction: 'expense',
        amount: amt.toFixed(2),
        category_id: supplier.category,
        from_wallet_id: body.from_wallet_id,
        counterparty_id: body.supplier_id,
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        description,
        created_by: auth.userId,
        idempotency_key: crypto.randomUUID(),
      })
      .select('id')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    invalidateWalletsCache(auth.organizationId);
    return NextResponse.json(data, { status: 201 });
  },
);
