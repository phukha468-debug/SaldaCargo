import { describe, it, expect } from 'vitest';
import {
  addMoney,
  generateDeterministicUuid,
  calculateWalletBalance,
  calcTripTotals,
  isDebtPaymentMethod,
  calcPartStock,
  getStockStatus,
} from '../index';

describe('financial & domain invariants', () => {
  it('addMoney sums string and number amounts to 2 decimal places', () => {
    expect(addMoney('100.50', '200.25')).toBe('300.75');
    expect(addMoney('0.1', '0.2')).toBe('0.30');
    expect(addMoney('1000', -250.5)).toBe('749.50');
  });

  it('generateDeterministicUuid is idempotent and produces valid UUID format', () => {
    const u1 = generateDeterministicUuid('trip-income-cash-123');
    const u2 = generateDeterministicUuid('trip-income-cash-123');
    const u3 = generateDeterministicUuid('trip-income-cash-124');

    expect(u1).toBe(u2);
    expect(u1).not.toBe(u3);
    expect(u1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('calculateWalletBalance honors dual-axis invariant (approved && completed only)', () => {
    const walletId = 'wallet-cash';
    const txs = [
      // +10000 (approved + completed) -> counts
      {
        direction: 'income',
        amount: '10000.00',
        from_wallet_id: null,
        to_wallet_id: walletId,
        lifecycle_status: 'approved',
        settlement_status: 'completed',
      },
      // -2500.50 (approved + completed) -> counts
      {
        direction: 'expense',
        amount: '2500.50',
        from_wallet_id: walletId,
        to_wallet_id: null,
        lifecycle_status: 'approved',
        settlement_status: 'completed',
      },
      // +5000 (approved + pending debt/hold) -> MUST NOT count
      {
        direction: 'income',
        amount: '5000.00',
        from_wallet_id: null,
        to_wallet_id: walletId,
        lifecycle_status: 'approved',
        settlement_status: 'pending',
      },
      // -9999 (cancelled + completed) -> MUST NOT count
      {
        direction: 'expense',
        amount: '9999.00',
        from_wallet_id: walletId,
        to_wallet_id: null,
        lifecycle_status: 'cancelled',
        settlement_status: 'completed',
      },
      // +1000 (draft + completed) -> MUST NOT count
      {
        direction: 'income',
        amount: '1000.00',
        from_wallet_id: null,
        to_wallet_id: walletId,
        lifecycle_status: 'draft',
        settlement_status: 'completed',
      },
    ];

    expect(calculateWalletBalance(txs, walletId)).toBe('7499.50');
  });

  it('calcTripTotals excludes cancelled orders (soft-delete invariant)', () => {
    const totals = calcTripTotals([
      { amount: '5000', driver_pay: '1500', loader_pay: '700', lifecycle_status: 'approved' },
      { amount: '3000', driver_pay: '900', loader_pay: '0', lifecycle_status: 'draft' },
      { amount: '99999', driver_pay: '9999', loader_pay: '9999', lifecycle_status: 'cancelled' },
    ]);

    expect(totals).toEqual({
      revenue: '8000.00',
      driverPay: '2400.00',
      loaderPay: '700.00',
    });
  });

  it('identifies debt payment methods correctly', () => {
    expect(isDebtPaymentMethod('debt_cash')).toBe(true);
    expect(isDebtPaymentMethod('debt')).toBe(true);
    expect(isDebtPaymentMethod('debt_bank')).toBe(true);
    expect(isDebtPaymentMethod('bank_invoice')).toBe(true);
    expect(isDebtPaymentMethod('cash')).toBe(false);
    expect(isDebtPaymentMethod('qr')).toBe(false);
    expect(isDebtPaymentMethod(null)).toBe(false);
  });

  it('calculates warehouse part stock and status', () => {
    expect(
      calcPartStock([
        { quantity: 10, direction: 'in' },
        { quantity: 4, direction: 'out' },
        { quantity: 2, direction: 'in' },
      ]),
    ).toBe(8);

    expect(getStockStatus(0, 5)).toBe('empty');
    expect(getStockStatus(3, 5)).toBe('low');
    expect(getStockStatus(6, 5)).toBe('ok');
  });
});
