/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

const TEST_ORG_ID = '11111111-1111-4111-8111-111111111111';
const TEST_USER_ID = '22222222-2222-4222-8222-222222222222';
const TEST_DRIVER_ID = '33333333-3333-4333-8333-333333333333';
const TEST_CAT_OTHER = 'df1022df-4ea6-46fc-b9aa-f3c9eb4e7f30';
const TEST_BANK_WALLET = '10000000-0000-0000-0000-000000000001';
const TEST_CASH_WALLET = '10000000-0000-0000-0000-000000000002';

interface RecordedInsert {
  table: string;
  payload: any;
}

interface RecordedUpsert {
  table: string;
  payload: any;
}

const insertedRows: RecordedInsert[] = [];
const upsertedRows: RecordedUpsert[] = [];
let tableHandlers: Record<
  string,
  (op: 'select' | 'insert' | 'update' | 'upsert', payload?: any) => any
> = {};

function makeBuilder(table: string) {
  let op: 'select' | 'insert' | 'update' | 'upsert' = 'select';
  let currentPayload: any;

  const resolveResult = () => {
    const handler = tableHandlers[table];
    if (handler) return handler(op, currentPayload);
    if (op === 'insert') {
      const first = Array.isArray(currentPayload) ? currentPayload[0] : currentPayload;
      return {
        data: { id: 'created-id', created_at: '2026-11-28T00:00:00Z', ...first },
        error: null,
      };
    }
    return { data: [], error: null };
  };

  const builder: any = {
    select: () => builder,
    insert: (payload: any) => {
      op = 'insert';
      currentPayload = payload;
      insertedRows.push({ table, payload });
      return builder;
    },
    update: (payload: any) => {
      op = 'update';
      currentPayload = payload;
      return builder;
    },
    upsert: (payload: any) => {
      op = 'upsert';
      currentPayload = payload;
      upsertedRows.push({ table, payload });
      return builder;
    },
    eq: () => builder,
    neq: () => builder,
    in: () => builder,
    gt: () => builder,
    gte: () => builder,
    lte: () => builder,
    or: () => builder,
    filter: () => builder,
    order: () => builder,
    limit: () => builder,
    single: () => Promise.resolve(resolveResult()),
    maybeSingle: () => Promise.resolve(resolveResult()),
    then: (resolve: any, reject: any) => Promise.resolve(resolveResult()).then(resolve, reject),
  };

  return builder;
}

const mockAuthUser = {
  userId: TEST_USER_ID,
  roles: ['admin', 'owner'],
  organizationId: TEST_ORG_ID,
  organizationSlug: 'test-org',
  organizationName: 'Test Org',
  enabledModules: ['transport', 'garage', 'expeditor', 'warehouse', 'payroll', 'finance'],
  orgSettings: {},
  session: {
    uid: TEST_USER_ID,
    oid: TEST_ORG_ID,
    roles: ['admin', 'owner'],
    exp: Math.floor(Date.now() / 1000) + 3600,
  },
};

const requireRoleMock = vi.fn<(...args: any[]) => Promise<any>>(async () => mockAuthUser);
const requireSessionMock = vi.fn<(...args: any[]) => Promise<any>>(async () => mockAuthUser);
const getVerifiedMiniappUserIdMock = vi.fn<(...args: any[]) => Promise<any>>(
  async () => TEST_USER_ID,
);
const invalidateWalletsCacheMock = vi.fn<(...args: any[]) => void>(() => {});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => makeBuilder(table),
  }),
}));

vi.mock('@/lib/auth/server', () => ({
  requireRole: (...args: any[]) => requireRoleMock(...args),
  requireSession: (...args: any[]) => requireSessionMock(...args),
  getVerifiedMiniappUserId: (...args: any[]) => getVerifiedMiniappUserIdMock(...args),
}));

vi.mock('@saldacargo/domain-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@saldacargo/domain-service')>();
  return {
    ...actual,
    invalidateWalletsCache: (...args: any[]) => invalidateWalletsCacheMock(...args),
    syncStrictOrdersForTrip: vi.fn(async () => {}),
  };
});

vi.mock('@/lib/tripFinancials', () => ({
  syncTripFinancials: vi.fn(async () => {}),
}));

vi.mock('@/lib/trips/editTripOrders', () => ({
  editTripOrdersPayloadSchema: { safeParse: vi.fn() },
  executeEditTripOrders: vi.fn(),
}));

function jsonReq(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('MiniApp Finance API routes — organization_id & business logic', () => {
  beforeEach(() => {
    insertedRows.length = 0;
    upsertedRows.length = 0;
    tableHandlers = {};
    requireRoleMock.mockReset().mockResolvedValue(mockAuthUser);
    requireSessionMock.mockReset().mockResolvedValue(mockAuthUser);
    getVerifiedMiniappUserIdMock.mockReset().mockResolvedValue(TEST_USER_ID);
    invalidateWalletsCacheMock.mockReset();
  });

  it('POST /api/admin/transactions inserts expense with organization_id and invalidates wallets cache', async () => {
    const { POST } = await import('@/app/api/admin/transactions/route');
    const res = await POST(
      jsonReq('http://localhost/api/admin/transactions', 'POST', {
        direction: 'expense',
        category_id: TEST_CAT_OTHER,
        amount: '3500',
        payment_method: 'bank_transfer',
        description: 'Нива',
      }),
    );

    expect(res.status).toBe(201);
    const txInsert = insertedRows.find((r) => r.table === 'transactions');
    expect(txInsert).toBeDefined();
    expect(txInsert!.payload.organization_id).toBe(TEST_ORG_ID);
    expect(txInsert!.payload.amount).toBe('3500.00');
    expect(txInsert!.payload.from_wallet_id).toBe(TEST_BANK_WALLET);
    expect(txInsert!.payload.to_wallet_id).toBeNull();
    expect(txInsert!.payload.description).toBe('Нива');
    expect(invalidateWalletsCacheMock).toHaveBeenCalledWith(TEST_ORG_ID);
  });

  it('POST /api/admin/transactions rejects unauthorized requests', async () => {
    requireRoleMock.mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as any,
    );
    const { POST } = await import('@/app/api/admin/transactions/route');
    const res = await POST(
      jsonReq('http://localhost/api/admin/transactions', 'POST', {
        direction: 'expense',
        category_id: TEST_CAT_OTHER,
        amount: '3500',
        payment_method: 'cash',
      }),
    );

    expect(res.status).toBe(401);
    expect(insertedRows).toHaveLength(0);
  });

  it('POST /api/admin/cash-collections sets organization_id on cash_collections and transactions', async () => {
    tableHandlers = {
      transaction_categories: () => ({ data: { id: 'cat-cash-collect' }, error: null }),
      wallets: () => ({ data: { id: 'driver-wallet-1' }, error: null }),
      users: () => ({ data: { name: 'Иван' }, error: null }),
    };
    const { POST } = await import('@/app/api/admin/cash-collections/route');
    const res = await POST(
      jsonReq('http://localhost/api/admin/cash-collections', 'POST', {
        driver_id: TEST_DRIVER_ID,
        amount: '5000',
        note: 'Инкассация',
      }),
    );

    expect(res.status).toBe(201);
    const ccInsert = insertedRows.find((r) => r.table === 'cash_collections');
    const txInsert = insertedRows.find((r) => r.table === 'transactions');
    expect(ccInsert?.payload.organization_id).toBe(TEST_ORG_ID);
    expect(txInsert?.payload.organization_id).toBe(TEST_ORG_ID);
  });

  it('POST & PATCH /api/admin/driver-cash-holds set organization_id on transactions and cash_collections', async () => {
    tableHandlers = {
      wallets: () => ({ data: { id: 'driver-wallet-1' }, error: null }),
    };
    const { POST, PATCH } = await import('@/app/api/admin/driver-cash-holds/route');

    const postRes = await POST(
      jsonReq('http://localhost/api/admin/driver-cash-holds', 'POST', {
        driver_id: TEST_DRIVER_ID,
        amount: 4000,
        note: 'Остаток',
      }),
    );
    expect(postRes.status).toBe(201);
    expect(insertedRows[0]?.table).toBe('transactions');
    expect(insertedRows[0]?.payload.organization_id).toBe(TEST_ORG_ID);

    // Partial PATCH by hold_id
    insertedRows.length = 0;
    tableHandlers = {
      transactions: (op) =>
        op === 'select'
          ? {
              data: {
                id: 'hold-1',
                amount: '4000.00',
                related_user_id: TEST_DRIVER_ID,
                from_wallet_id: 'driver-wallet-1',
                description: '[CARRYOVER] Остаток',
                created_at: '2026-11-28T00:00:00Z',
              },
              error: null,
            }
          : { data: { id: 'tx-part' }, error: null },
    };

    const patchHoldRes = await PATCH(
      jsonReq('http://localhost/api/admin/driver-cash-holds', 'PATCH', {
        hold_id: 'hold-1',
        collected_amount: 1500,
      }),
    );
    expect(patchHoldRes.status).toBe(200);
    expect(insertedRows.find((r) => r.table === 'cash_collections')?.payload.organization_id).toBe(
      TEST_ORG_ID,
    );
    expect(insertedRows.find((r) => r.table === 'transactions')?.payload.organization_id).toBe(
      TEST_ORG_ID,
    );

    // Partial PATCH by driver_id
    insertedRows.length = 0;
    tableHandlers = {
      transactions: (op) =>
        op === 'select'
          ? {
              data: [
                {
                  id: 'hold-1',
                  amount: '4000.00',
                  related_user_id: TEST_DRIVER_ID,
                  from_wallet_id: 'driver-wallet-1',
                  description: '[CARRYOVER] Остаток',
                },
              ],
              error: null,
            }
          : { data: { id: 'tx-part-2' }, error: null },
    };

    const patchDriverRes = await PATCH(
      jsonReq('http://localhost/api/admin/driver-cash-holds', 'PATCH', {
        driver_id: TEST_DRIVER_ID,
        collected_amount: 1000,
      }),
    );
    expect(patchDriverRes.status).toBe(200);
    expect(insertedRows.find((r) => r.table === 'cash_collections')?.payload.organization_id).toBe(
      TEST_ORG_ID,
    );
    expect(insertedRows.find((r) => r.table === 'transactions')?.payload.organization_id).toBe(
      TEST_ORG_ID,
    );
  });

  it('POST /api/admin/loan-payment sets organization_id on transaction', async () => {
    tableHandlers = {
      loans: (op) =>
        op === 'select'
          ? {
              data: {
                id: 'loan-1',
                lender_name: 'Сбербанк',
                remaining_amount: '100000.00',
                monthly_payment: '10000.00',
                next_payment_date: '2026-12-01',
              },
              error: null,
            }
          : { data: null, error: null },
    };
    const { POST } = await import('@/app/api/admin/loan-payment/route');
    const res = await POST(
      jsonReq('http://localhost/api/admin/loan-payment', 'POST', {
        loan_id: 'loan-1',
        amount: '10000',
        from_wallet_id: TEST_BANK_WALLET,
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.new_remaining).toBe('90000.00');
    expect(insertedRows.find((r) => r.table === 'transactions')?.payload.organization_id).toBe(
      TEST_ORG_ID,
    );
  });

  it('POST /api/admin/payable-debt sets organization_id on transaction', async () => {
    const { POST } = await import('@/app/api/admin/payable-debt/route');
    const res = await POST(
      jsonReq('http://localhost/api/admin/payable-debt', 'POST', {
        supplier_id: '20000000-0000-0000-0000-000000000002',
        amount: '12500',
        description: 'Тормозные колодки',
      }),
    );

    expect(res.status).toBe(201);
    const txInsert = insertedRows.find((r) => r.table === 'transactions');
    expect(txInsert?.payload.organization_id).toBe(TEST_ORG_ID);
    expect(txInsert?.payload.settlement_status).toBe('pending');
  });

  it('POST /api/admin/supplier-payment sets organization_id on transaction', async () => {
    tableHandlers = {
      counterparties: (op) =>
        op === 'select'
          ? { data: { id: 'sup-1', name: 'Автозапчасти', payable_amount: '20000.00' }, error: null }
          : { data: null, error: null },
    };
    const { POST } = await import('@/app/api/admin/supplier-payment/route');
    const res = await POST(
      jsonReq('http://localhost/api/admin/supplier-payment', 'POST', {
        supplier_id: 'sup-1',
        amount: '5000',
        from_wallet_id: TEST_BANK_WALLET,
      }),
    );

    expect(res.status).toBe(201);
    expect(insertedRows.find((r) => r.table === 'transactions')?.payload.organization_id).toBe(
      TEST_ORG_ID,
    );
  });

  it('POST /api/admin/manual-receivable sets organization_id on manual_receivables', async () => {
    const { POST } = await import('@/app/api/admin/manual-receivable/route');
    const res = await POST(
      jsonReq('http://localhost/api/admin/manual-receivable', 'POST', {
        counterparty_id: 'cp-1',
        amount: '8000',
        description: 'Старый долг',
      }),
    );

    expect(res.status).toBe(201);
    expect(
      insertedRows.find((r) => r.table === 'manual_receivables')?.payload.organization_id,
    ).toBe(TEST_ORG_ID);
  });

  it('POST /api/admin/receivables/close-all sets organization_id on transaction', async () => {
    tableHandlers = {
      trip_orders: (op) =>
        op === 'select'
          ? { data: { counterparty_id: 'cp-1' }, error: null }
          : { data: null, error: null },
    };
    const { POST } = await import('@/app/api/admin/receivables/close-all/route');
    const res = await POST(
      jsonReq('http://localhost/api/admin/receivables/close-all', 'POST', {
        orders: [{ id: 'ord-1', type: 'trip_order', amount: '15000' }],
        counterparty_name: 'ООО Ромашка',
      }),
    );

    expect(res.status).toBe(200);
    expect(insertedRows.find((r) => r.table === 'transactions')?.payload.organization_id).toBe(
      TEST_ORG_ID,
    );
  });

  it('POST /api/admin/receivables/settle sets organization_id for both manual and trip_order', async () => {
    const { POST } = await import('@/app/api/admin/receivables/settle/route');

    // manual
    tableHandlers = {
      manual_receivables: (op) =>
        op === 'select'
          ? {
              data: { id: 'm-1', amount: '5000.00', counterparty_id: 'cp-1', settled: false },
              error: null,
            }
          : { data: null, error: null },
    };
    const manualRes = await POST(
      jsonReq('http://localhost/api/admin/receivables/settle', 'POST', {
        id: 'm-1',
        type: 'manual',
      }),
    );
    expect(manualRes.status).toBe(200);
    expect(insertedRows.find((r) => r.table === 'transactions')?.payload.organization_id).toBe(
      TEST_ORG_ID,
    );

    // trip_order
    insertedRows.length = 0;
    tableHandlers = {
      trip_orders: (op) =>
        op === 'select'
          ? {
              data: {
                id: 'ord-1',
                amount: '12000.00',
                counterparty_id: 'cp-1',
                payment_method: 'bank_invoice',
                settlement_status: 'pending',
                counterparty: { name: 'ООО Тест', is_legal_entity: true },
              },
              error: null,
            }
          : { data: null, error: null },
    };
    const orderRes = await POST(
      jsonReq('http://localhost/api/admin/receivables/settle', 'POST', {
        id: 'ord-1',
        type: 'trip_order',
      }),
    );
    expect(orderRes.status).toBe(200);
    expect(insertedRows.find((r) => r.table === 'transactions')?.payload.organization_id).toBe(
      TEST_ORG_ID,
    );
  });

  it('POST /api/admin/staff-settle sets organization_id on direct and pending payouts, offset, netting & surplus', async () => {
    const { POST } = await import('@/app/api/admin/staff-settle/route');

    // Case 1: direct payout (no pending payroll)
    tableHandlers = {
      users: () => ({ data: { name: 'Петров', roles: ['driver'] }, error: null }),
      transactions: (op) =>
        op === 'select' ? { data: [], error: null } : { data: {}, error: null },
    };
    const directRes = await POST(
      jsonReq('http://localhost/api/admin/staff-settle', 'POST', {
        user_id: TEST_DRIVER_ID,
        partial_amount: '3000',
        from_wallet_id: TEST_CASH_WALLET,
      }),
    );
    expect(directRes.status).toBe(200);
    expect(insertedRows.find((r) => r.table === 'transactions')?.payload.organization_id).toBe(
      TEST_ORG_ID,
    );

    // Case 2: pending payroll with partial split, advance offset, netting, and surplus collection
    insertedRows.length = 0;
    let txSelectCall = 0;
    tableHandlers = {
      users: () => ({ data: { name: 'Петров', roles: ['driver'] }, error: null }),
      transactions: (op) => {
        if (op === 'select') {
          txSelectCall += 1;
          // 1: recentDuplicate (empty), 2: pendingPayroll, 3: advanceGiven, 4: advanceOffset, 5: activeHolds
          if (txSelectCall === 1) return { data: [], error: null };
          if (txSelectCall === 2) {
            return {
              data: [
                {
                  id: 'pay-1',
                  amount: '10000.00',
                  description: 'ЗП: Петров',
                  created_at: '2026-11-27T00:00:00Z',
                  category_id: 'd79213ee-3bc6-4433-b58a-ca7ea1040d00',
                  direction: 'expense',
                  lifecycle_status: 'approved',
                  related_user_id: TEST_DRIVER_ID,
                  created_by: TEST_USER_ID,
                },
              ],
              error: null,
            };
          }
          if (txSelectCall === 3) return { data: [{ amount: '1000.00' }], error: null };
          if (txSelectCall === 4) return { data: [], error: null };
          if (txSelectCall === 5)
            return { data: [{ id: 'hold-1', amount: '2000.00' }], error: null };
          return { data: [], error: null };
        }
        return { data: {}, error: null };
      },
    };

    const fullRes = await POST(
      jsonReq('http://localhost/api/admin/staff-settle', 'POST', {
        user_id: TEST_DRIVER_ID,
        partial_amount: '6000',
        from_wallet_id: TEST_CASH_WALLET,
        is_netting: true,
        collect_surplus: false,
      }),
    );
    expect(fullRes.status).toBe(200);
    const allTxInserts = insertedRows.filter((r) => r.table === 'transactions');
    // payout + split remainder + netting + advance offset = 4 inserts
    expect(allTxInserts.length).toBeGreaterThanOrEqual(4);
    for (const ins of allTxInserts) {
      expect(ins.payload.organization_id).toBe(TEST_ORG_ID);
    }
  });

  it('PATCH /api/admin/trips/[id] sets organization_id on reissue_salary and convert_to_repair', async () => {
    const { PATCH } = await import('@/app/api/admin/trips/[id]/route');

    // reissue_salary
    tableHandlers = {
      trips: () => ({
        data: {
          driver_id: TEST_DRIVER_ID,
          organization_id: TEST_ORG_ID,
          trip_number: 42,
          started_at: '2026-11-28T00:00:00Z',
          driver: { name: 'Сидоров' },
        },
        error: null,
      }),
    };
    const reissueRes = await PATCH(
      jsonReq('http://localhost/api/admin/trips/trip-1', 'PATCH', {
        action: 'reissue_salary',
        driver_pay: '4500',
        loader_pays: [{ user_id: 'loader-1', name: 'Грузчик', amount: '1500' }],
      }),
      { params: Promise.resolve({ id: 'trip-1' }) },
    );
    expect(reissueRes.status).toBe(200);
    const batchInsert = insertedRows.find((r) => r.table === 'transactions');
    expect(Array.isArray(batchInsert?.payload)).toBe(true);
    expect(batchInsert?.payload).toHaveLength(2);
    for (const row of batchInsert!.payload) {
      expect(row.organization_id).toBe(TEST_ORG_ID);
    }

    // convert_to_repair
    insertedRows.length = 0;
    tableHandlers = {
      trips: () => ({
        data: {
          id: 'trip-1',
          organization_id: TEST_ORG_ID,
          asset_id: 'asset-1',
          driver_id: TEST_DRIVER_ID,
          trip_number: 42,
          odometer_start: 10000,
          asset: { short_name: 'ГАЗель', reg_number: 'А111АА', odometer_current: 10000 },
        },
        error: null,
      }),
      service_orders: (op) =>
        op === 'select'
          ? { data: null, error: null }
          : { data: { id: 'so-1', order_number: 7 }, error: null },
    };
    const repairRes = await PATCH(
      jsonReq('http://localhost/api/admin/trips/trip-1', 'PATCH', {
        action: 'convert_to_repair',
        problem_description: 'Стук в подвеске',
      }),
      { params: Promise.resolve({ id: 'trip-1' }) },
    );
    expect(repairRes.status).toBe(200);
    expect(insertedRows.find((r) => r.table === 'service_orders')?.payload.organization_id).toBe(
      TEST_ORG_ID,
    );
  });

  it('POST /api/wallets/set-balance sets organization_id on adjustment transaction and audit upsert', async () => {
    tableHandlers = {
      users: () => ({ data: { id: TEST_USER_ID, name: 'Директор' }, error: null }),
      daily_finance_audits: (op) =>
        op === 'select'
          ? {
              data: { safe_cash_actual: 10000, fuel_card_balance: 500, date: '2026-11-27' },
              error: null,
            }
          : { data: null, error: null },
    };
    const { POST } = await import('@/app/api/wallets/set-balance/route');
    const res = await POST(
      jsonReq('http://localhost/api/wallets/set-balance', 'POST', {
        wallet: 'cash',
        target_amount: 12500,
        notes: 'Ревизия',
      }),
    );

    expect(res.status).toBe(200);
    expect(insertedRows.find((r) => r.table === 'transactions')?.payload.organization_id).toBe(
      TEST_ORG_ID,
    );
    expect(
      upsertedRows.find((r) => r.table === 'daily_finance_audits')?.payload.organization_id,
    ).toBe(TEST_ORG_ID);
    expect(invalidateWalletsCacheMock).toHaveBeenCalledWith(TEST_ORG_ID);
  });
});
