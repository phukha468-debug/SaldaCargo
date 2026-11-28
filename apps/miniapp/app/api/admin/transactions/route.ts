import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createMiniappApiHandler } from '@/lib/api';
import { invalidateWalletsCache, resolveOrganizationFinanceIds } from '@saldacargo/domain-service';
import { NextResponse } from 'next/server';

const getTransactionsQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Некорректный формат даты')
    .optional(),
});

const createTransactionSchema = z.object({
  direction: z.enum(['income', 'expense']),
  category_id: z.string().uuid('Выберите категорию'),
  amount: z.union([z.string(), z.number()]).transform((v) => String(v).trim()),
  description: z.string().max(1000).optional().nullable(),
  payment_method: z.enum(['cash', 'bank_transfer']).optional().default('cash'),
});

/** GET /api/admin/transactions?date=YYYY-MM-DD — транзакции за день */
export const GET = createMiniappApiHandler(
  {
    routeName: 'miniapp:/api/admin/transactions',
    roles: ['admin', 'owner'],
    requiredModule: 'finance',
    querySchema: getTransactionsQuerySchema,
  },
  async ({ query, auth }) => {
    const supabase = createAdminClient();

    let q = supabase
      .from('transactions')
      .select(
        'id, amount, direction, description, created_at, lifecycle_status, category:transaction_categories(name, code), to_wallet:wallets!to_wallet_id(name), from_wallet:wallets!from_wallet_id(name), counterparty:counterparties(name), related_user:users!transactions_related_user_id_fkey(name)',
      )
      .eq('organization_id', auth.organizationId)
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'completed')
      .or('from_wallet_id.not.is.null,to_wallet_id.not.is.null')
      .or('description.is.null,description.neq.Корректировка остатка')
      .order('created_at', { ascending: false });

    if (query.date) {
      q = q
        .gte('created_at', `${query.date}T00:00:00.000Z`)
        .lte('created_at', `${query.date}T23:59:59.999Z`);
    } else {
      q = q.limit(50);
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  },
);

/** POST /api/admin/transactions — добавить доход или расход */
export const POST = createMiniappApiHandler(
  {
    routeName: 'miniapp:/api/admin/transactions',
    roles: ['admin', 'owner'],
    requiredModule: 'finance',
    bodySchema: createTransactionSchema,
  },
  async ({ body, auth }) => {
    const parsedAmount = parseFloat(body.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Введите корректную сумму' }, { status: 400 });
    }

    const ids = resolveOrganizationFinanceIds(auth.orgSettings);
    const walletId = body.payment_method === 'cash' ? ids.cashId : ids.bankId;
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        organization_id: auth.organizationId,
        direction: body.direction,
        category_id: body.category_id,
        amount: parsedAmount.toFixed(2),
        description: body.description?.trim() || null,
        // Привязка к кошельку — влияет на балансы в /api/wallets
        to_wallet_id: body.direction === 'income' ? walletId : null,
        from_wallet_id: body.direction === 'expense' ? walletId : null,
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        created_by: auth.userId,
        idempotency_key: crypto.randomUUID(),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    invalidateWalletsCache(auth.organizationId);
    return NextResponse.json(data, { status: 201 });
  },
);
