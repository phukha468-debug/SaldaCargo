/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEFAULT_ORGANIZATION_ID } from '@saldacargo/shared';
import { invalidateDailyBalanceCache } from '../daily-balance/route';

const BANK_ID = '10000000-0000-0000-0000-000000000001';
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
        obligation_id: z.string().optional().nullable(),
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
 * POST /api/finance/link-debit
 * Привязка банковского списания с Р/С к существующим расходам (без дублей),
 * создание/сплит новых расходов или пакетное проведение комиссий банка.
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    const parsed = RequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Некорректные данные запроса', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const body = parsed.data;
    const supabase = createAdminClient();
    const organizationId = DEFAULT_ORGANIZATION_ID;

    const { data: adminUser } = await (supabase.from('users') as any)
      .select('id')
      .eq('organization_id', organizationId)
      .or('roles.cs.{admin},roles.cs.{owner}')
      .limit(1)
      .maybeSingle();
    const actorId: string | null = adminUser?.id ?? null;

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

      invalidateDailyBalanceCache();
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
            from_wallet_id: BANK_ID,
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

        if (item.obligation_id && item.obligation_id !== 'none') {
          const period = txDate.slice(0, 7);
          await (supabase.from('payment_calendar_overrides') as any).upsert({
            id: `${period}:${item.obligation_id}`,
            organization_id: organizationId,
            period,
            obligation_id: item.obligation_id,
            paid_amount: item.amount,
            paid_at: txDate,
            wallet_id: BANK_ID,
            custom_notes: `Оплачено через Р/С [tx:${tx.id}]`,
            updated_at: new Date().toISOString(),
          });
        }
      }

      invalidateDailyBalanceCache();
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
        from_wallet_id: BANK_ID,
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

    invalidateDailyBalanceCache();
    return NextResponse.json({
      success: true,
      mode: 'batch_commissions',
      created_count: createdCount,
    });
  } catch (err: any) {
    console.error('Error in POST /api/finance/link-debit:', err);
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
