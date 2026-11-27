/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  syncStrictOrdersForTrip,
  backfillStrictDocOrders,
  syncInvoiceToOrder,
  resetBackfillStrictDocOrdersState,
} from '../orders/orderTripSync';

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const TRIP_ID = '11111111-1111-4111-8111-111111111111';
const CP_VSMPO = 'e5a170aa-a5d5-4915-b5c9-21426612f555';

function makeQueryMock(result: { data?: any; error?: any }) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

describe('orderTripSync', () => {
  beforeEach(() => {
    resetBackfillStrictDocOrdersState();
  });

  it('creates docs_collection orders WITH organization_id for every strict trip_order', async () => {
    const insertedPayloads: any[] = [];
    const updatedPayloads: any[] = [];

    const tripData = {
      id: TRIP_ID,
      organization_id: ORG_ID,
      trip_number: 1079,
      lifecycle_status: 'approved',
      started_at: '2026-11-23T08:00:00Z',
      asset_id: 'asset-1',
      driver_id: 'driver-1',
      trip_orders: [
        {
          id: 'to-1',
          counterparty_id: CP_VSMPO,
          amount: '18000.00',
          payment_method: 'bank_invoice',
          settlement_status: 'pending',
          lifecycle_status: 'approved',
          description: 'Заявка № 853/2026: 30 кг',
          invoice_number: null,
          invoice_date: null,
          counterparty: {
            id: CP_VSMPO,
            name: 'ПАО «Корпорация ВСМПО-АВИСМА»',
            is_legal_entity: true,
          },
        },
        {
          id: 'to-2',
          counterparty_id: CP_VSMPO,
          amount: '3000.00',
          payment_method: 'bank_invoice',
          settlement_status: 'pending',
          lifecycle_status: 'approved',
          description: 'Долг: ПАО «Корпорация ВСМПО-АВИСМА»',
          invoice_number: null,
          invoice_date: null,
          counterparty: {
            id: CP_VSMPO,
            name: 'ПАО «Корпорация ВСМПО-АВИСМА»',
            is_legal_entity: true,
          },
        },
      ],
    };

    const existingOrders = [
      {
        id: 'ord-existing-1',
        status: 'pending_review',
        client_id: CP_VSMPO,
        active_trip_id: TRIP_ID,
        price_without_vat: 18000,
        raw_parser_payload: {},
      },
    ];

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'trips') {
          return makeQueryMock({ data: tripData, error: null });
        }
        if (table === 'orders') {
          return {
            select: vi.fn(() => makeQueryMock({ data: existingOrders, error: null })),
            update: vi.fn((payload: any) => {
              updatedPayloads.push(payload);
              return makeQueryMock({ data: null, error: null });
            }),
            insert: vi.fn((payload: any) => {
              insertedPayloads.push(payload);
              return makeQueryMock({ data: { id: 'ord-new-2' }, error: null });
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const res = await syncStrictOrdersForTrip(supabase, TRIP_ID);

    expect(res).toEqual({ created: 1, updated: 1, cancelled: 0 });
    expect(updatedPayloads).toHaveLength(1);
    expect(updatedPayloads[0].status).toBe('docs_collection');
    expect(updatedPayloads[0].raw_parser_payload.trip_order_id).toBe('to-1');

    expect(insertedPayloads).toHaveLength(1);
    expect(insertedPayloads[0].organization_id).toBe(ORG_ID);
    expect(insertedPayloads[0].status).toBe('docs_collection');
    expect(insertedPayloads[0].active_trip_id).toBe(TRIP_ID);
    expect(insertedPayloads[0].price_without_vat).toBe(3000);
    expect(insertedPayloads[0].raw_parser_payload.trip_order_id).toBe('to-2');
  });

  it('backfillStrictDocOrders detects missing trip_orders and syncs only uncovered trips', async () => {
    const insertedPayloads: any[] = [];
    const pendingTripOrders = [
      {
        id: 'to-missing',
        trip_id: TRIP_ID,
        organization_id: ORG_ID,
        settlement_status: 'pending',
        lifecycle_status: 'approved',
        counterparty: { id: CP_VSMPO, name: 'ПАО «Корпорация ВСМПО-АВИСМА»' },
        trip: { id: TRIP_ID, lifecycle_status: 'approved', started_at: '2026-11-18T10:00:00Z' },
      },
    ];

    const tripData = {
      id: TRIP_ID,
      organization_id: ORG_ID,
      trip_number: 1050,
      lifecycle_status: 'approved',
      started_at: '2026-11-18T10:00:00Z',
      asset_id: 'asset-1',
      driver_id: 'driver-1',
      trip_orders: [
        {
          id: 'to-missing',
          counterparty_id: CP_VSMPO,
          amount: '12000.00',
          payment_method: 'bank_invoice',
          settlement_status: 'pending',
          lifecycle_status: 'approved',
          description: 'Долг: ПАО «Корпорация ВСМПО-АВИСМА»',
          counterparty: {
            id: CP_VSMPO,
            name: 'ПАО «Корпорация ВСМПО-АВИСМА»',
            is_legal_entity: true,
          },
        },
      ],
    };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'trip_orders') {
          return makeQueryMock({ data: pendingTripOrders, error: null });
        }
        if (table === 'trips') {
          return makeQueryMock({ data: tripData, error: null });
        }
        if (table === 'orders') {
          return {
            select: vi.fn(() => makeQueryMock({ data: [], error: null })),
            insert: vi.fn((payload: any) => {
              insertedPayloads.push(payload);
              return makeQueryMock({ data: { id: 'ord-backfilled' }, error: null });
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const summary = await backfillStrictDocOrders(supabase, { organizationId: ORG_ID });

    expect(summary).toEqual({ syncedTrips: 1, created: 1, updated: 0 });
    expect(insertedPayloads).toHaveLength(1);
    expect(insertedPayloads[0].organization_id).toBe(ORG_ID);
    expect(insertedPayloads[0].base_doc_number).toBe('1050');
  });

  it('syncInvoiceToOrder writes invoice_number and invoice_date into orders.raw_parser_payload.billing_docs', async () => {
    const updatedPayloads: any[] = [];
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'orders') {
          return {
            select: vi.fn(() =>
              makeQueryMock({
                data: [
                  {
                    id: 'ord-1',
                    raw_parser_payload: {
                      trip_order_id: 'to-1',
                      billing_docs: { waybill_type: 'paper', invoice_issued: false },
                    },
                  },
                ],
                error: null,
              }),
            ),
            update: vi.fn((payload: any) => {
              updatedPayloads.push(payload);
              return makeQueryMock({ data: null, error: null });
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const ok = await syncInvoiceToOrder(supabase, 'to-1', {
      invoice_number: 'СЧ-777',
      invoice_date: '2026-11-26',
      trip_id: TRIP_ID,
      counterparty_id: CP_VSMPO,
      organization_id: ORG_ID,
    });

    expect(ok).toBe(true);
    expect(updatedPayloads).toHaveLength(1);
    expect(updatedPayloads[0].raw_parser_payload.billing_docs).toMatchObject({
      waybill_type: 'paper',
      invoice_issued: true,
      invoice_number: 'СЧ-777',
      invoice_date: '2026-11-26',
    });
  });

  it('handles PostgreSQL 23505 unique_violation idempotently on concurrent insert race', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const tripData = {
      id: TRIP_ID,
      organization_id: ORG_ID,
      trip_number: 1090,
      lifecycle_status: 'approved',
      started_at: '2026-11-25T08:00:00Z',
      asset_id: 'asset-1',
      driver_id: 'driver-1',
      trip_orders: [
        {
          id: 'to-race-1',
          counterparty_id: CP_VSMPO,
          amount: '20000.00',
          payment_method: 'bank_invoice',
          settlement_status: 'pending',
          lifecycle_status: 'approved',
          description: 'Рейс 1090',
          counterparty: {
            id: CP_VSMPO,
            name: 'ПАО «Корпорация ВСМПО-АВИСМА»',
            is_legal_entity: true,
          },
        },
      ],
    };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'trips') {
          return makeQueryMock({ data: tripData, error: null });
        }
        if (table === 'orders') {
          return {
            select: vi.fn(() => makeQueryMock({ data: [], error: null })),
            insert: vi.fn(() =>
              makeQueryMock({
                data: null,
                error: {
                  code: '23505',
                  message:
                    'duplicate key value violates unique constraint "idx_orders_unique_active_trip_order_id"',
                },
              }),
            ),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const res = await syncStrictOrdersForTrip(supabase, TRIP_ID);

    expect(res).toEqual({ created: 0, updated: 0, cancelled: 0 });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('backfillStrictDocOrders skips trip_order already covered by another active_trip_id (case 916)', async () => {
    const insertedPayloads: any[] = [];
    const pendingTripOrders = [
      {
        id: 'to-916',
        trip_id: TRIP_ID,
        organization_id: ORG_ID,
        settlement_status: 'pending',
        lifecycle_status: 'approved',
        counterparty: { id: CP_VSMPO, name: 'ПАО «Корпорация ВСМПО-АВИСМА»' },
        trip: { id: TRIP_ID, lifecycle_status: 'approved', started_at: '2026-10-30T10:00:00Z' },
      },
    ];

    let ordersSelectCall = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'trip_orders') {
          return makeQueryMock({ data: pendingTripOrders, error: null });
        }
        if (table === 'orders') {
          return {
            select: vi.fn(() => {
              ordersSelectCall += 1;
              // 1st select: by active_trip_id -> empty; 2nd select: by raw_parser_payload->>trip_order_id -> found!
              if (ordersSelectCall === 1) {
                return makeQueryMock({ data: [], error: null });
              }
              return makeQueryMock({
                data: [
                  {
                    id: 'ord-existing-other-trip',
                    active_trip_id: 'other-trip-id',
                    status: 'completed',
                    raw_parser_payload: {
                      trip_order_id: 'to-916',
                      billing_docs: { client_accepted_edo: true },
                    },
                  },
                ],
                error: null,
              });
            }),
            insert: vi.fn((payload: any) => {
              insertedPayloads.push(payload);
              return makeQueryMock({ data: { id: 'should-not-create' }, error: null });
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const summary = await backfillStrictDocOrders(supabase, { organizationId: ORG_ID });

    expect(summary).toEqual({ syncedTrips: 0, created: 0, updated: 0 });
    expect(insertedPayloads).toHaveLength(0);
  });

  it('backfillStrictDocOrders coalesces concurrent calls (single-flight) and respects TTL', async () => {
    let tripOrdersQueries = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'trip_orders') {
          tripOrdersQueries += 1;
          return makeQueryMock({ data: [], error: null });
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    // Two concurrent calls share a single DB pass
    const [r1, r2] = await Promise.all([
      backfillStrictDocOrders(supabase, { organizationId: ORG_ID }),
      backfillStrictDocOrders(supabase, { organizationId: ORG_ID }),
    ]);
    expect(r1).toEqual({ syncedTrips: 0, created: 0, updated: 0 });
    expect(r2).toEqual({ syncedTrips: 0, created: 0, updated: 0 });
    expect(tripOrdersQueries).toBe(1);

    // Immediate subsequent call within TTL does not re-query DB
    await backfillStrictDocOrders(supabase, { organizationId: ORG_ID });
    expect(tripOrdersQueries).toBe(1);

    // force: true bypasses TTL
    await backfillStrictDocOrders(supabase, { organizationId: ORG_ID, force: true });
    expect(tripOrdersQueries).toBe(2);
  });
});
