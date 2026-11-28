/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEFAULT_ORGANIZATION_ID } from '@saldacargo/shared';
import {
  BANK_DEBIT_CONTROL_START_ISO,
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

/**
 * GET /api/finance/unmatched-debits?days=14
 * Возвращает неразобранные и частично разобранные списания с Р/С (Т-Банк API)
 * за последние N дней + кандидаты-расходы для привязки без создания дублей.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const daysParam = parseInt(searchParams.get('days') || '14', 10);
    const days = Math.min(30, Math.max(1, Number.isFinite(daysParam) ? daysParam : 14));
    const forceRefresh = searchParams.get('force') === '1';
    const organizationId = DEFAULT_ORGANIZATION_ID;

    const supabase = createAdminClient();
    const now = new Date();
    const controlStartDate = new Date(BANK_DEBIT_CONTROL_START_ISO);
    const controlStartMs = controlStartDate.getTime();
    const rollingFromDate = new Date(now.getTime() - days * 24 * 3600 * 1000);
    const effectiveFromDate =
      rollingFromDate.getTime() > controlStartMs ? rollingFromDate : controlStartDate;
    const txFromDate = new Date(now.getTime() - (days + 7) * 24 * 3600 * 1000);
    const fromIso = effectiveFromDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const isBeforeControlStart = now.getTime() < controlStartMs;

    // Получаем credentials Т-Банка для организации
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

    const [bankOps, txsRes, linksRes] = await Promise.all([
      isBeforeControlStart
        ? Promise.resolve([])
        : fetchTBankStatement(fromIso, undefined, token, accountNumber, forceRefresh),
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
    ]);

    const txs: DebitMatchTransaction[] = txsRes.data ?? [];
    const links: BankDebitLinkRecord[] = linksRes.error ? [] : (linksRes.data ?? []);

    const allStatuses = computeBankDebitStatuses(bankOps, txs, links).filter((s) => {
      const ts = new Date(s.operationDate).getTime();
      return Number.isNaN(ts) || ts >= controlStartMs;
    });

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
      summary: {
        unmatched_count: unmatchedDebits.length,
        unmatched_total: totalUnmatchedAmount.toFixed(2),
        commissions_count: unmatchedCommissions.length,
        commissions_total: totalCommissionsAmount.toFixed(2),
      },
    });
  } catch (err: any) {
    console.error('Error in GET /api/finance/unmatched-debits:', err);
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
