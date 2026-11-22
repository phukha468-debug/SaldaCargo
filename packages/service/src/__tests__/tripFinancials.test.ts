import { describe, it, expect } from 'vitest';
import {
  FINANCIAL_WALLETS,
  FINANCIAL_CATEGORIES,
  generateDeterministicUuid,
} from '@saldacargo/shared';
import { syncTripFinancials } from '../finance/tripFinancials';

interface MockRecord {
  [key: string]: unknown;
}

interface MockOp {
  table: string;
  action: 'insert' | 'update' | 'delete';
  payload?: MockRecord;
  filters: Array<{ op: string; col: string; val: unknown }>;
}

/**
 * Минимальный in-memory мок Supabase-клиента для тестирования syncTripFinancials.
 */
function createMockSupabase(seed: {
  trip: MockRecord | null;
  trip_expenses?: MockRecord[];
  transactions?: MockRecord[];
  wallets?: MockRecord[];
}) {
  const ops: MockOp[] = [];
  const state = {
    trip: seed.trip,
    trip_expenses: [...(seed.trip_expenses ?? [])],
    transactions: [...(seed.transactions ?? [])],
    wallets: [...(seed.wallets ?? [])],
  };

  function matchFilters(
    row: MockRecord,
    filters: Array<{ op: string; col: string; val: unknown }>,
  ): boolean {
    return filters.every((f) => {
      if (f.op === 'eq') return row[f.col] === f.val;
      if (f.op === 'neq') return row[f.col] !== f.val;
      if (f.op === 'in') return Array.isArray(f.val) && f.val.includes(row[f.col]);
      return true;
    });
  }

  function makeBuilder(table: string) {
    let action: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: MockRecord | undefined;
    const filters: Array<{ op: string; col: string; val: unknown }> = [];

    const execute = async (mode: 'many' | 'single' | 'maybeSingle') => {
      if (action === 'insert') {
        const inserted: MockRecord = { id: `tx-${ops.length + 1}`, ...payload };
        ops.push({ table, action: 'insert', payload: inserted, filters: [...filters] });
        if (table === 'transactions') state.transactions.push(inserted);
        return { data: mode === 'many' ? [inserted] : inserted, error: null };
      }

      if (action === 'update') {
        ops.push({ table, action: 'update', payload, filters: [...filters] });
        return { data: null, error: null };
      }

      if (action === 'delete') {
        ops.push({ table, action: 'delete', filters: [...filters] });
        return { data: null, error: null };
      }

      // select
      if (table === 'trips') {
        return { data: state.trip, error: null };
      }
      const list =
        table === 'trip_expenses'
          ? state.trip_expenses
          : table === 'transactions'
            ? state.transactions
            : table === 'wallets'
              ? state.wallets
              : [];
      const matched = list.filter((row) => matchFilters(row, filters));
      if (mode === 'single' || mode === 'maybeSingle') {
        return { data: matched[0] ?? null, error: null };
      }
      return { data: matched, error: null };
    };

    const builder: Record<string, unknown> = {
      select() {
        return builder;
      },
      insert(p: MockRecord) {
        action = 'insert';
        payload = p;
        return builder;
      },
      update(p: MockRecord) {
        action = 'update';
        payload = p;
        return builder;
      },
      delete() {
        action = 'delete';
        return builder;
      },
      eq(col: string, val: unknown) {
        filters.push({ op: 'eq', col, val });
        return builder;
      },
      neq(col: string, val: unknown) {
        filters.push({ op: 'neq', col, val });
        return builder;
      },
      in(col: string, val: unknown[]) {
        filters.push({ op: 'in', col, val });
        return builder;
      },
      limit() {
        return builder;
      },
      single() {
        return execute('single');
      },
      maybeSingle() {
        return execute('maybeSingle');
      },
      then(resolve: (value: unknown) => void, reject?: (err: unknown) => void) {
        return execute('many').then(resolve, reject);
      },
    };

    return builder;
  }

  return {
    supabase: {
      from: (table: string) => makeBuilder(table),
    },
    ops,
  };
}

describe('syncTripFinancials', () => {
  it('does nothing for non-approved (draft/pending_review) trips', async () => {
    const { supabase, ops } = createMockSupabase({
      trip: {
        id: 'trip-draft-1',
        trip_number: 10,
        lifecycle_status: 'pending_review',
        trip_orders: [],
      },
    });

    await syncTripFinancials(supabase, 'trip-draft-1', 'admin-1');
    expect(ops).toHaveLength(0);
  });

  it('soft-cancels all active transactions when trip is cancelled', async () => {
    const { supabase, ops } = createMockSupabase({
      trip: {
        id: 'trip-cancel-1',
        trip_number: 11,
        lifecycle_status: 'cancelled',
        trip_orders: [],
      },
    });

    await syncTripFinancials(supabase, 'trip-cancel-1', 'admin-1');
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      table: 'transactions',
      action: 'update',
      payload: { lifecycle_status: 'cancelled' },
    });
  });

  it('syncs cash, qr, debt settlement_status, manual driver_pay, and loaders with idempotency keys', async () => {
    const tripId = 'trip-approved-1';
    const { supabase, ops } = createMockSupabase({
      trip: {
        id: tripId,
        trip_number: 42,
        driver_id: 'driver-1',
        driver: { id: 'driver-1', name: 'Иван Водитель' },
        started_at: '2026-11-20T08:00:00Z',
        created_at: '2026-11-20T08:00:00Z',
        lifecycle_status: 'approved',
        admin_note: '',
        driver_note: '',
        trip_orders: [
          {
            id: 'ord-cash',
            amount: '5000.00',
            payment_method: 'cash',
            settlement_status: 'pending', // should become completed
            lifecycle_status: 'approved',
            driver_pay: '1500.00',
            counterparty: { name: 'ООО Клиент 1' },
            loaders_data: [{ id: 'loader-1', name: 'Пётр Грузчик', pay: '700.00' }],
          },
          {
            id: 'ord-qr',
            amount: '3000.00',
            payment_method: 'qr',
            settlement_status: 'completed',
            lifecycle_status: 'approved',
            driver_pay: '900.00',
            counterparty: { name: 'ИП Клиент 2' },
          },
          {
            id: 'ord-debt',
            amount: '4000.00',
            payment_method: 'bank_invoice',
            settlement_status: 'completed', // should become pending
            lifecycle_status: 'approved',
            driver_pay: '1200.00',
            counterparty: { name: 'Завод' },
          },
          {
            id: 'ord-cancelled',
            amount: '99999.00',
            payment_method: 'cash',
            settlement_status: 'completed',
            lifecycle_status: 'cancelled', // MUST be excluded
            driver_pay: '9999.00',
          },
        ],
      },
    });

    await syncTripFinancials(supabase, tripId, 'admin-1');

    // 1. Settlement statuses updated for ord-cash -> completed and ord-debt -> pending
    const orderUpdates = ops.filter((o) => o.table === 'trip_orders' && o.action === 'update');
    expect(orderUpdates).toHaveLength(2);
    expect(orderUpdates[0]?.payload).toEqual({ settlement_status: 'completed' });
    expect(orderUpdates[1]?.payload).toEqual({ settlement_status: 'pending' });

    const inserts = ops.filter((o) => o.table === 'transactions' && o.action === 'insert');

    // 2. Cash income -> CASH wallet (5000.00, excludes cancelled 99999)
    const cashTx = inserts.find(
      (i) =>
        i.payload?.to_wallet_id === FINANCIAL_WALLETS.CASH && i.payload?.direction === 'income',
    );
    expect(cashTx?.payload).toMatchObject({
      amount: '5000.00',
      category_id: FINANCIAL_CATEGORIES.TRIP_REVENUE,
      lifecycle_status: 'approved',
      settlement_status: 'completed',
      idempotency_key: generateDeterministicUuid(`trip-income-cash-${tripId}`),
    });

    // 3. QR income -> BANK wallet (3000.00)
    const qrTx = inserts.find(
      (i) =>
        i.payload?.to_wallet_id === FINANCIAL_WALLETS.BANK && i.payload?.direction === 'income',
    );
    expect(qrTx?.payload).toMatchObject({
      amount: '3000.00',
      category_id: FINANCIAL_CATEGORIES.TRIP_REVENUE,
      lifecycle_status: 'approved',
      settlement_status: 'completed',
      idempotency_key: generateDeterministicUuid(`trip-income-qr-${tripId}`),
    });

    // 4. Driver payroll = manual sum 1500 + 900 + 1200 = 3600.00 (settlement pending)
    const driverTx = inserts.find(
      (i) => i.payload?.category_id === FINANCIAL_CATEGORIES.PAYROLL_DRIVER,
    );
    expect(driverTx?.payload).toMatchObject({
      amount: '3600.00',
      related_user_id: 'driver-1',
      lifecycle_status: 'approved',
      settlement_status: 'pending',
      idempotency_key: generateDeterministicUuid(`trip-payroll-driver-${tripId}-driver-1`),
    });

    // 5. Loader payroll = 700.00 (settlement pending)
    const loaderTx = inserts.find(
      (i) => i.payload?.category_id === FINANCIAL_CATEGORIES.PAYROLL_LOADER,
    );
    expect(loaderTx?.payload).toMatchObject({
      amount: '700.00',
      related_user_id: 'loader-1',
      lifecycle_status: 'approved',
      settlement_status: 'pending',
      idempotency_key: generateDeterministicUuid(`trip-payroll-loader-${tripId}-loader-1`),
    });
  });

  it('creates pending CASH_COLLECT hold minus cash expenses when [CASH_NOT_SURRENDERED]', async () => {
    const tripId = 'trip-hold-1';
    const { supabase, ops } = createMockSupabase({
      trip: {
        id: tripId,
        trip_number: 55,
        driver_id: 'driver-2',
        driver: { id: 'driver-2', name: 'Сергей' },
        started_at: '2026-11-21T09:00:00Z',
        lifecycle_status: 'approved',
        admin_note: '[CASH_NOT_SURRENDERED]',
        driver_note: '',
        trip_orders: [
          {
            id: 'ord-1',
            amount: '6000.00',
            payment_method: 'cash',
            settlement_status: 'completed',
            lifecycle_status: 'approved',
            driver_pay: '0',
            counterparty: { name: 'Клиент' },
          },
        ],
      },
      trip_expenses: [
        {
          id: 'exp-1',
          organization_id: '00000000-0000-4000-8000-000000000001',
          trip_id: tripId,
          payment_method: 'cash',
          amount: '1200.00',
        },
      ],
      wallets: [
        {
          id: 'wallet-driver-2',
          organization_id: '00000000-0000-4000-8000-000000000001',
          owner_user_id: 'driver-2',
          type: 'driver_accountable',
        },
      ],
    });

    await syncTripFinancials(supabase, tripId, 'admin-1');

    const inserts = ops.filter((o) => o.table === 'transactions' && o.action === 'insert');
    const holdTx = inserts.find(
      (i) => i.payload?.category_id === FINANCIAL_CATEGORIES.CASH_COLLECT,
    );

    expect(holdTx?.payload).toMatchObject({
      direction: 'transfer',
      amount: '4800.00', // 6000 - 1200
      from_wallet_id: 'wallet-driver-2',
      to_wallet_id: FINANCIAL_WALLETS.CASH,
      lifecycle_status: 'approved',
      settlement_status: 'pending',
      idempotency_key: generateDeterministicUuid(`trip-cash-hold-${tripId}`),
    });

    // Safe income must NOT be created when cash is not surrendered
    const safeIncome = inserts.find(
      (i) =>
        i.payload?.category_id === FINANCIAL_CATEGORIES.TRIP_REVENUE &&
        i.payload?.to_wallet_id === FINANCIAL_WALLETS.CASH,
    );
    expect(safeIncome).toBeUndefined();
  });
});
