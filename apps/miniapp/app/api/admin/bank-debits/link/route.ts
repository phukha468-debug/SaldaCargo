/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createMiniappApiHandler } from '@/lib/api';
import { invalidateWalletsCache, resolveOrganizationFinanceIds } from '@saldacargo/domain-service';

const FALLBACK_BANK_ID = '10000000-0000-0000-0000-000000000001';
const DEFAULT_OTHER_EXPENSE_CAT = 'df1022df-4ea6-46fc-b9aa-f3c9eb4e7f30';

const LinkExistingSchema = z.object({
  mode: z.literal('link_existing'),
  bank_operation_id: z.string().min(1),
  bank_operation_date: z.string().optional(),
  bank_operation_amount: z.number().positive(),
  bank_operation_desc: z.string().optional(),
  allocations: z
    .array(
      z.object({
        transaction_id: z.string().uuid(),
        allocated_amount: z.number().positive(),
      }),
    )
    .min(1),
});

const CreateAndLinkSchema = z.object({
  mode: z.literal('create_and_link'),
  bank_operation_id: z.string().min(1),
  bank_operation_date: z.string().optional(),
  bank_operation_amount: z.number().positive(),
  bank_operation_desc: z.string().optional(),
  items: z
    .array(
      z.object({
        category_id: z.string().uuid().optional().nullable(),
        description: z.string().min(1),
        amount: z.number().positive(),
      }),
    )
    .min(1),
});

const BatchCommissionsSchema = z.object({
  mode: z.literal('batch_commissions'),
  operations: z
    .array(
      z.object({
        operationId: z.string().min(1),
        operationDate: z.string().optional(),
        amount: z.number().positive(),
        description: z.string().optional(),
      }),
    )
    .min(1),
});

const RequestSchema = z.discriminatedUnion('mode', [
  LinkExistingSchema,
  CreateAndLinkSchema,
  BatchCommissionsSchema,
]);

/**
 * POST /api/admin/bank-debits/link
 * Привязка банковского списания к расходам / сплит / проведение комиссий из MiniApp.
 */
export const POST = createMiniappApiHandler(
  {
    routeName: 'miniapp:/api/admin/bank-debits/link',
    roles: ['admin', 'owner'],
    requiredModule: 'finance',
    bodySchema: RequestSchema,
  },
  async ({ body, auth }) => {
    const supabase = createAdminClient();
    const organizationId = auth.organizationId;
    const actorId = auth.userId;

    const financeIds = resolveOrganizationFinanceIds(auth.orgSettings);
    const bankWalletId = financeIds.bankId || FALLBACK_BANK_ID;

    if (body.mode === 'link_existing') {
      const rows = body.allocations.map((a) => ({
        organization_id: organizationId,
        bank_operation_id: body.bank_operation_id,
        bank_operation_date: body.bank_operation_date || new Date().toISOString(),
        bank_operation_amount: body.bank_operation_amount.toFixed(2),
        bank_operation_desc: body.bank_operation_desc || null,
        transaction_id: a.transaction_id,
        allocated_amount: a.allocated_amount.toFixed(2),
        created_by: actorId,
      }));

      const { data: savedLinks, error: linkErr } = await (supabase.from('bank_debit_links') as any)
        .upsert(rows, { onConflict: 'organization_id,bank_operation_id,transaction_id' })
        .select('*');

      if (linkErr) {
        return NextResponse.json({ error: linkErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        mode: 'link_existing',
        links: savedLinks ?? [],
      });
    }

    if (body.mode === 'create_and_link') {
      const txDate = body.bank_operation_date || new Date().toISOString();
      const createdTxs: any[] = [];
      const createdLinks: any[] = [];

      for (let i = 0; i < body.items.length; i++) {
        const item = body.items[i]!;
        const idempKey = `debit-split:${body.bank_operation_id}:${i}:${Date.now()}`;
        const { data: tx, error: txErr } = await (supabase.from('transactions') as any)
          .insert({
            organization_id: organizationId,
            direction: 'expense',
            amount: item.amount.toFixed(2),
            category_id: item.category_id || DEFAULT_OTHER_EXPENSE_CAT,
            from_wallet_id: bankWalletId,
            to_wallet_id: null,
            description: item.description.trim(),
            lifecycle_status: 'approved',
            settlement_status: 'completed',
            transaction_date: txDate,
            created_at: txDate,
            idempotency_key: idempKey,
            created_by: actorId,
          })
          .select('*')
          .single();

        if (txErr || !tx) {
          return NextResponse.json(
            { error: txErr?.message || 'Ошибка создания транзакции' },
            { status: 500 },
          );
        }
        createdTxs.push(tx);

        const { data: linkRow, error: linkErr } = await (supabase.from('bank_debit_links') as any)
          .insert({
            organization_id: organizationId,
            bank_operation_id: body.bank_operation_id,
            bank_operation_date: txDate,
            bank_operation_amount: body.bank_operation_amount.toFixed(2),
            bank_operation_desc: body.bank_operation_desc || null,
            transaction_id: tx.id,
            allocated_amount: item.amount.toFixed(2),
            created_by: actorId,
          })
          .select('*')
          .single();

        if (linkErr) {
          return NextResponse.json({ error: linkErr.message }, { status: 500 });
        }
        createdLinks.push(linkRow);
      }

      invalidateWalletsCache();
      return NextResponse.json({
        success: true,
        mode: 'create_and_link',
        transactions: createdTxs,
        links: createdLinks,
      });
    }

    // mode === 'batch_commissions'
    const { data: commCat } = await (supabase.from('transaction_categories') as any)
      .select('id, name')
      .or('name.ilike.%банковск%,name.ilike.%комисси%')
      .limit(1)
      .maybeSingle();

    const categoryId: string = commCat?.id || DEFAULT_OTHER_EXPENSE_CAT;
    let createdCount = 0;

    for (const op of body.operations) {
      const txDate = op.operationDate || new Date().toISOString();
      const { data: existing } = await (supabase.from('transactions') as any)
        .select('id')
        .eq('organization_id', organizationId)
        .eq('idempotency_key', op.operationId)
        .maybeSingle();

      if (existing) continue;

      const { error: insErr } = await (supabase.from('transactions') as any).insert({
        organization_id: organizationId,
        direction: 'expense',
        amount: op.amount.toFixed(2),
        category_id: categoryId,
        from_wallet_id: bankWalletId,
        to_wallet_id: null,
        description: (op.description || 'Комиссия Т-Банка').trim(),
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        transaction_date: txDate,
        created_at: txDate,
        idempotency_key: op.operationId,
        created_by: actorId,
      });

      if (!insErr) createdCount++;
    }

    invalidateWalletsCache();
    return NextResponse.json({
      success: true,
      mode: 'batch_commissions',
      created_count: createdCount,
    });
  },
);
