/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createWebApiHandler } from '@/lib/api';
import { invalidateWalletsCache } from '@saldacargo/domain-service';
import { NextResponse } from 'next/server';

const TRIP_REVENUE_CATEGORY = '74008cf7-0527-4e9f-afd2-d232b8f8125a';
const BANK_ID = '10000000-0000-0000-0000-000000000001';

const closeAllSchema = z.object({
  orders: z
    .array(
      z.object({
        id: z.string().uuid('Некорректный ID заказа'),
        type: z.enum(['trip_order', 'manual']),
        amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
      }),
    )
    .min(1, 'orders обязателен'),
  to_wallet_id: z.string().uuid().optional(),
  counterparty_name: z.string().max(300).optional(),
});

/**
 * POST /api/receivables/close-all
 * Closes all listed debts in one shot and creates income transactions.
 */
export const POST = createWebApiHandler(
  {
    routeName: 'web:/api/receivables/close-all',
    roles: ['admin', 'owner'],
    bodySchema: closeAllSchema,
  },
  async ({ body, auth }) => {
    const toWalletId = body.to_wallet_id ?? BANK_ID;
    const cpName = body.counterparty_name ?? 'Должник';
    const supabase = createAdminClient();
    const adminId = auth.userId;

    const tripOrders = body.orders.filter((o) => o.type === 'trip_order');
    const manuals = body.orders.filter((o) => o.type === 'manual');

    const nowIso = new Date().toISOString();
    const ops: Promise<any>[] = [];

    if (tripOrders.length > 0) {
      ops.push(
        (supabase as any)
          .from('trip_orders')
          .update({
            settlement_status: 'completed',
            invoice_status: 'paid',
            invoice_paid_at: nowIso,
            updated_at: nowIso,
          })
          .in(
            'id',
            tripOrders.map((o) => o.id),
          )
          .eq('settlement_status', 'pending'),
      );
    }

    if (manuals.length > 0) {
      ops.push(
        (supabase as any)
          .from('manual_receivables')
          .update({ settled: true, settled_at: nowIso })
          .in(
            'id',
            manuals.map((o) => o.id),
          )
          .eq('settled', false),
      );
    }

    // Resolve counterparty_id from body or from first order
    let cpId: string | null = null;
    if (tripOrders.length > 0 && tripOrders[0]) {
      const { data: ord } = await (supabase as any)
        .from('trip_orders')
        .select('counterparty_id')
        .eq('id', tripOrders[0].id)
        .single();
      if (ord?.counterparty_id) cpId = ord.counterparty_id;
    }
    if (!cpId && manuals.length > 0 && manuals[0]) {
      const { data: man } = await (supabase as any)
        .from('manual_receivables')
        .select('counterparty_id')
        .eq('id', manuals[0].id)
        .single();
      if (man?.counterparty_id) cpId = man.counterparty_id;
    }

    await Promise.all(ops);

    const totalAmount = body.orders.reduce((s, o) => s + parseFloat(o.amount ?? '0'), 0).toFixed(2);

    const meta = JSON.stringify({
      type: 'receivables_settlement',
      orders: body.orders.map((o) => ({ id: o.id, type: o.type, amount: o.amount })),
    });

    const { error: txErr } = await (supabase as any).from('transactions').insert({
      direction: 'income',
      category_id: TRIP_REVENUE_CATEGORY,
      amount: totalAmount,
      to_wallet_id: toWalletId,
      counterparty_id: cpId,
      photo_url: meta,
      description: `Погашение задолженности: ${cpName} (${body.orders.length} записей)`,
      lifecycle_status: 'approved',
      settlement_status: 'completed',
      created_by: adminId,
      idempotency_key: crypto.randomUUID(),
    });

    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

    invalidateWalletsCache();
    return NextResponse.json({ ok: true, paid: totalAmount, count: body.orders.length });
  },
);
