/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createMiniappApiHandler } from '@/lib/api';
import {
  computeBankDebitStatuses,
  fetchTBankStatement,
  getIntegrationConfig,
  rankCandidateExpenses,
  type BankDebitLinkRecord,
  type DebitMatchTransaction,
  type TBankIntegrationCredentials,
} from '@saldacargo/domain-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const querySchema = z.object({
  days: z
    .string()
    .optional()
    .transform((v) => {
      const n = parseInt(v || '14', 10);
      return Math.min(30, Math.max(1, Number.isFinite(n) ? n : 14));
    }),
  force: z.string().optional(),
});

/**
 * GET /api/admin/bank-debits?days=14
 * Возвращает неразобранные списания с Р/С Т-Банка, кандидаты-расходы и категории для MiniApp.
 */
export const GET = createMiniappApiHandler(
  {
    routeName: 'miniapp:/api/admin/bank-debits',
    roles: ['admin', 'owner'],
    requiredModule: 'finance',
    querySchema,
  },
  async ({ query, auth }) => {
    const supabase = createAdminClient();
    const organizationId = auth.organizationId;
    const days = query.days;
    const forceRefresh = query.force === '1';

    const now = new Date();
    const fromDate = new Date(now.getTime() - days * 24 * 3600 * 1000);
    const txFromDate = new Date(now.getTime() - (days + 7) * 24 * 3600 * 1000);
    const fromIso = fromDate.toISOString().replace(/\.\d{3}Z$/, 'Z');

    let token: string | undefined;
    let accountNumber: string | undefined;
    try {
      const tbankInt = await getIntegrationConfig<TBankIntegrationCredentials>(
        supabase,
        organizationId,
        'tbank',
      );
      if (tbankInt.isEnabled && tbankInt.credentials.token) {
        token = tbankInt.credentials.token;
        accountNumber =
          tbankInt.credentials.account_number ||
          (typeof tbankInt.config.account_number === 'string'
            ? tbankInt.config.account_number
            : undefined);
      }
    } catch {
      // fallback to env inside fetchTBankStatement
    }

    const [bankOps, txsRes, linksRes, catsRes] = await Promise.all([
      fetchTBankStatement(fromIso, undefined, token, accountNumber, forceRefresh),
      (supabase.from('transactions') as any)
        .select(
          'id, amount, direction, description, created_at, transaction_date, from_wallet_id, idempotency_key, category:transaction_categories(id, name, code)',
        )
        .eq('organization_id', organizationId)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .gte('created_at', txFromDate.toISOString())
        .order('created_at', { ascending: false }),
      (supabase.from('bank_debit_links') as any)
        .select(
          'id, bank_operation_id, transaction_id, allocated_amount, bank_operation_amount, bank_operation_date, bank_operation_desc',
        )
        .eq('organization_id', organizationId)
        .gte('created_at', txFromDate.toISOString()),
      (supabase.from('transaction_categories') as any)
        .select('id, name, code, direction')
        .eq('direction', 'expense')
        .order('name', { ascending: true }),
    ]);

    const txs: DebitMatchTransaction[] = txsRes.data ?? [];
    const links: BankDebitLinkRecord[] = linksRes.error ? [] : (linksRes.data ?? []);
    const categories: Array<{ id: string; name: string; code?: string }> = catsRes.data ?? [];

    const allStatuses = computeBankDebitStatuses(bankOps, txs, links);

    const unmatchedDebits = allStatuses.filter((s) => s.status !== 'matched' && !s.isCommission);
    const unmatchedCommissions = allStatuses.filter(
      (s) => s.status !== 'matched' && s.isCommission,
    );

    const linkedTxIds = new Set<string>();
    for (const l of links) {
      if (l.transaction_id) linkedTxIds.add(l.transaction_id);
    }
    const bankOpIds = new Set(bankOps.map((o) => String(o.operationId)));
    for (const t of txs) {
      if (t.idempotency_key && bankOpIds.has(String(t.idempotency_key))) {
        linkedTxIds.add(t.id);
      }
    }

    const candidateExpenses = rankCandidateExpenses(
      now.toISOString(),
      unmatchedDebits[0]?.remainingAmount ?? 0,
      txs,
      linkedTxIds,
    );

    const totalUnmatchedAmount =
      Math.round(unmatchedDebits.reduce((s, d) => s + d.remainingAmount, 0) * 100) / 100;
    const totalCommissionsAmount =
      Math.round(unmatchedCommissions.reduce((s, d) => s + d.remainingAmount, 0) * 100) / 100;

    return NextResponse.json({
      days,
      unmatched_debits: unmatchedDebits,
      unmatched_commissions: unmatchedCommissions,
      candidate_expenses: candidateExpenses,
      categories,
      summary: {
        unmatched_count: unmatchedDebits.length,
        unmatched_total: totalUnmatchedAmount.toFixed(2),
        commissions_count: unmatchedCommissions.length,
        commissions_total: totalCommissionsAmount.toFixed(2),
      },
    });
  },
);
