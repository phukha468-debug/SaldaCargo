import type { TBankOperation } from '../integrations/tbank';

/**
 * Дата старта полного контроля привязки банковских списаний (29.11.2026 00:00 +05:00).
 * Все более ранние неразобранные списания считаются закрытыми и не попадают в список долгов по привязке.
 */
export const BANK_DEBIT_CONTROL_START_ISO = '2026-11-29T00:00:00+05:00';

export interface BankDebitLinkRecord {
  id: string;
  bank_operation_id: string;
  transaction_id: string;
  allocated_amount: string | number;
  bank_operation_amount?: string | number;
  bank_operation_date?: string | null;
  bank_operation_desc?: string | null;
}

export interface DebitMatchTransaction {
  id: string;
  amount: string | number;
  direction: string;
  description?: string | null;
  created_at?: string | null;
  transaction_date?: string | null;
  from_wallet_id?: string | null;
  idempotency_key?: string | null;
  category?: { id?: string; name?: string; code?: string } | null;
}

export interface UnmatchedBankDebit {
  operationId: string;
  operationDate: string;
  amount: number;
  linkedAmount: number;
  remainingAmount: number;
  status: 'unmatched' | 'partial' | 'matched';
  receiverName: string;
  description: string;
  isPersonalWithdrawal: boolean;
  isCommission: boolean;
  linkedTransactionIds: string[];
  rawOp: TBankOperation;
}

export interface RankedExpenseCandidate {
  id: string;
  amount: number;
  date: string;
  categoryName: string;
  description: string;
  fromWalletId: string | null;
  isExactAmountMatch: boolean;
  score: number;
}

const COMMISSION_PATTERNS = [
  /комисси/i,
  /плата за/i,
  /тариф/i,
  /обслуживан.*счет/i,
  /оповещени.*операц/i,
  /пополнение по операции сбп/i,
];

const PERSONAL_WITHDRAWAL_PATTERNS = [
  /перевод собственных средств/i,
  /вывел себе на карту/i,
  /личные нужды/i,
  /собственные средства/i,
  /перевод средств на карту/i,
];

export function getBankOpAmount(
  op: Pick<TBankOperation, 'operationAmount' | 'rubleAmount'>,
): number {
  const raw = op.operationAmount ?? op.rubleAmount ?? 0;
  const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

export function getBankOpEffectiveDate(
  op: TBankOperation & {
    authorizationDate?: string;
    trxnPostDate?: string;
    operationTime?: string;
  },
): string {
  return (
    op.authorizationDate ||
    op.trxnPostDate ||
    op.operationDate ||
    op.operationTime ||
    new Date().toISOString()
  );
}

export function isBankCommissionOp(
  op: Pick<TBankOperation, 'description' | 'payPurpose' | 'category'>,
): boolean {
  if (op.category === 'commission') return true;
  const text = `${op.description || ''} ${op.payPurpose || ''}`.trim();
  return COMMISSION_PATTERNS.some((re) => re.test(text));
}

export function isPersonalWithdrawalBankOp(
  op: Pick<TBankOperation, 'description' | 'payPurpose'>,
): boolean {
  const text = `${op.description || ''} ${op.payPurpose || ''}`.trim();
  return PERSONAL_WITHDRAWAL_PATTERNS.some((re) => re.test(text));
}

/**
 * Вычисляет состояние разбора для каждого списания (Debit) из выписки Т-Банка.
 * Учитывает как прямую привязку через `transactions.idempotency_key === op.operationId`,
 * так и гибкие связи многие-ко-многим из `bank_debit_links`.
 */
export function computeBankDebitStatuses(
  bankOps: TBankOperation[],
  transactions: DebitMatchTransaction[],
  links: BankDebitLinkRecord[],
): UnmatchedBankDebit[] {
  const txByIdemp = new Map<string, DebitMatchTransaction>();
  for (const tx of transactions) {
    if (tx.idempotency_key) {
      txByIdemp.set(String(tx.idempotency_key), tx);
    }
  }

  const linksByOp = new Map<string, BankDebitLinkRecord[]>();
  for (const l of links) {
    const key = String(l.bank_operation_id);
    const list = linksByOp.get(key) ?? [];
    list.push(l);
    linksByOp.set(key, list);
  }

  const results: UnmatchedBankDebit[] = [];

  for (const op of bankOps) {
    if (op.typeOfOperation !== 'Debit') continue;
    const total = getBankOpAmount(op);
    if (total <= 0) continue;

    const opId = String(op.operationId);
    const directTx = txByIdemp.get(opId);
    const opLinks = linksByOp.get(opId) ?? [];

    let linkedAmount = 0;
    const linkedTxIds = new Set<string>();

    if (opLinks.length > 0) {
      for (const l of opLinks) {
        const val = parseFloat(String(l.allocated_amount ?? '0')) || 0;
        linkedAmount += val;
        if (l.transaction_id) linkedTxIds.add(l.transaction_id);
      }
    } else if (directTx) {
      linkedAmount = total;
      linkedTxIds.add(directTx.id);
    }

    linkedAmount = Math.round(Math.min(total, linkedAmount) * 100) / 100;
    const remainingAmount = Math.max(0, Math.round((total - linkedAmount) * 100) / 100);

    let status: 'unmatched' | 'partial' | 'matched' = 'unmatched';
    if (remainingAmount <= 0.01) {
      status = 'matched';
    } else if (linkedAmount > 0.01) {
      status = 'partial';
    }

    const receiverName = op.receiver?.name || op.counterParty?.name || 'Контрагент';
    const description = (op.description || op.payPurpose || '').replace(/\s+/g, ' ').trim();

    results.push({
      operationId: opId,
      operationDate: getBankOpEffectiveDate(op),
      amount: total,
      linkedAmount,
      remainingAmount,
      status,
      receiverName,
      description,
      isPersonalWithdrawal: isPersonalWithdrawalBankOp(op),
      isCommission: isBankCommissionOp(op),
      linkedTransactionIds: Array.from(linkedTxIds),
      rawOp: op,
    });
  }

  return results.sort(
    (a, b) => new Date(b.operationDate).getTime() - new Date(a.operationDate).getTime(),
  );
}

/**
 * Сортирует непривязанные расходные транзакции по релевантности для конкретного списания с Р/С:
 * 1. Точное совпадение суммы с остатком списания (приоритет №1).
 * 2. Сумма расхода <= остатка списания (может быть частью сплита).
 * 3. Близость по дате к банковскому списанию.
 */
export function rankCandidateExpenses(
  bankOpDateIso: string,
  remainingAmount: number,
  expenses: DebitMatchTransaction[],
  alreadyLinkedTxIds: Set<string>,
): RankedExpenseCandidate[] {
  const opTime = new Date(bankOpDateIso).getTime();

  const candidates: RankedExpenseCandidate[] = [];
  for (const tx of expenses) {
    if (tx.direction !== 'expense') continue;
    if (alreadyLinkedTxIds.has(tx.id)) continue;

    const amt = Math.round((parseFloat(String(tx.amount ?? '0')) || 0) * 100) / 100;
    if (amt <= 0) continue;

    const desc = (tx.description || '').trim();
    if (/корректировка остатка|корректировка баланса/i.test(desc)) continue;

    const txDate = tx.transaction_date || tx.created_at || '';
    const txTime = txDate ? new Date(txDate).getTime() : 0;
    const daysDiff =
      Number.isFinite(opTime) && txTime > 0 ? Math.abs(txTime - opTime) / (24 * 3600 * 1000) : 30;

    const isExactAmountMatch = Math.abs(amt - remainingAmount) < 1;
    let score = 0;
    if (isExactAmountMatch) score += 1000;
    else if (amt <= remainingAmount + 0.01) score += 200;

    // Бонус за близость даты (в пределах 7 дней)
    score += Math.max(0, 100 - Math.round(daysDiff * 12));

    candidates.push({
      id: tx.id,
      amount: amt,
      date: txDate,
      categoryName: tx.category?.name || 'Без статьи',
      description: desc || 'Расход',
      fromWalletId: tx.from_wallet_id ?? null,
      isExactAmountMatch,
      score,
    });
  }

  return candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}
