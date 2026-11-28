import { describe, expect, it } from 'vitest';
import type { TBankOperation } from '../integrations/tbank';
import {
  computeBankDebitStatuses,
  isBankCommissionOp,
  isPersonalWithdrawalBankOp,
  rankCandidateExpenses,
} from '../finance/bankDebitMatching';

function makeOp(overrides: Partial<TBankOperation> = {}): TBankOperation {
  return {
    operationId: 'op-1',
    operationDate: '2026-11-27T16:53:00Z',
    typeOfOperation: 'Debit',
    operationAmount: 69000,
    description: 'Перевод собственных средств на счет. НДС не облагается.',
    receiver: { name: 'НИГАМЕДЬЯНОВ АЛЕКСАНДР' },
    ...overrides,
  };
}

describe('bankDebitMatching', () => {
  it('recognizes personal withdrawals and bank commissions accurately', () => {
    expect(isPersonalWithdrawalBankOp(makeOp())).toBe(true);
    expect(isBankCommissionOp(makeOp())).toBe(false);

    const comm = makeOp({
      operationId: 'op-comm',
      operationAmount: 16.24,
      description: 'Плата за пополнение по операции СБП 2137420563',
    });
    expect(isBankCommissionOp(comm)).toBe(true);
    expect(isPersonalWithdrawalBankOp(comm)).toBe(false);
  });

  it('computes unmatched, partial, and matched debit statuses without double-counting', () => {
    const ops: TBankOperation[] = [
      makeOp({ operationId: 'op-unmatched', operationAmount: 55000 }),
      makeOp({ operationId: 'op-partial', operationAmount: 69000 }),
      makeOp({ operationId: 'op-full-link', operationAmount: 14850 }),
      makeOp({ operationId: 'op-direct-tx', operationAmount: 12000 }),
      makeOp({ operationId: 'op-credit', typeOfOperation: 'Credit', operationAmount: 50000 }),
    ];

    const txs = [
      {
        id: 'tx-direct',
        amount: '12000.00',
        direction: 'expense',
        idempotency_key: 'op-direct-tx',
      },
    ];

    const links = [
      {
        id: 'l-1',
        bank_operation_id: 'op-partial',
        transaction_id: 'tx-tax',
        allocated_amount: '40896.00',
      },
      {
        id: 'l-2',
        bank_operation_id: 'op-full-link',
        transaction_id: 'tx-zp',
        allocated_amount: '14850.00',
      },
    ];

    const statuses = computeBankDebitStatuses(ops, txs, links);
    expect(statuses).toHaveLength(4);

    const byId = new Map(statuses.map((s) => [s.operationId, s]));
    expect(byId.get('op-unmatched')?.status).toBe('unmatched');
    expect(byId.get('op-unmatched')?.remainingAmount).toBe(55000);

    expect(byId.get('op-partial')?.status).toBe('partial');
    expect(byId.get('op-partial')?.linkedAmount).toBe(40896);
    expect(byId.get('op-partial')?.remainingAmount).toBe(28104);

    expect(byId.get('op-full-link')?.status).toBe('matched');
    expect(byId.get('op-full-link')?.remainingAmount).toBe(0);

    expect(byId.get('op-direct-tx')?.status).toBe('matched');
    expect(byId.get('op-direct-tx')?.remainingAmount).toBe(0);
  });

  it('ranks exact-amount candidate expenses first and excludes already linked ones', () => {
    const ranked = rankCandidateExpenses(
      '2026-11-25T10:48:00Z',
      14850,
      [
        {
          id: 'tx-1',
          amount: '40896.00',
          direction: 'expense',
          description: 'Транспорт+недвижимость',
          transaction_date: '2026-11-28T03:55:00Z',
          category: { name: 'Налоги' },
        },
        {
          id: 'tx-2',
          amount: '14850.00',
          direction: 'expense',
          description: 'Выплата зарплаты: Нигамедьянов Е.З.',
          transaction_date: '2026-11-25T11:03:00Z',
          category: { name: 'ЗП водителя' },
        },
        {
          id: 'tx-linked',
          amount: '14850.00',
          direction: 'expense',
          description: 'Уже привязано',
          transaction_date: '2026-11-25T11:05:00Z',
        },
      ],
      new Set(['tx-linked']),
    );

    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.id).toBe('tx-2');
    expect(ranked[0]?.isExactAmountMatch).toBe(true);
  });
});
