/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_ORGANIZATION_SETTINGS,
  hasModule,
  createApiHandler,
  type SaldaModule,
} from '@saldacargo/shared';
import { getWalletsSummary, invalidateWalletsCache, syncTripFinancials } from '../finance';

const ORG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('Multi-tenancy cross-tenant isolation', () => {
  beforeEach(() => {
    invalidateWalletsCache();
  });

  it('isolates getWalletsSummary queries and cache per organization_id', async () => {
    const recordedOrgFilters: string[] = [];

    const makeMockSupabase = () => ({
      from(table: string) {
        let filteredOrgId: string | null = null;
        let toWallet: string | null = null;
        let fromWallet: string | null = null;

        const builder: any = {
          select() {
            return builder;
          },
          eq(col: string, val: any) {
            if (col === 'organization_id') {
              filteredOrgId = val;
              recordedOrgFilters.push(`${table}:${val}`);
            }
            if (col === 'to_wallet_id') toWallet = val;
            if (col === 'from_wallet_id') fromWallet = val;
            return builder;
          },
          neq() {
            return builder;
          },
          in() {
            return builder;
          },
          gt() {
            return builder;
          },
          order() {
            return builder;
          },
          limit() {
            return builder;
          },
          async maybeSingle() {
            if (table === 'organization_integrations') {
              return { data: null, error: null };
            }
            if (table === 'daily_finance_audits') {
              // Только у ORG_A есть подтверждённый аудит на 50 000 ₽
              if (filteredOrgId === ORG_A) {
                return {
                  data: {
                    safe_cash_actual: 50000,
                    fuel_card_balance: 1000,
                    audited_at: '2026-11-01T00:00:00Z',
                  },
                  error: null,
                };
              }
              return { data: null, error: null };
            }
            return { data: null, error: null };
          },
          then(resolve: any) {
            if (table === 'transactions' && filteredOrgId === ORG_A && toWallet && !fromWallet) {
              return resolve({ data: [{ amount: '10000.00', trip_order_id: null }], error: null });
            }
            return resolve({ data: [], error: null });
          },
        };
        return builder;
      },
    });

    const supabase = makeMockSupabase();

    const summaryA = await getWalletsSummary(supabase as any, {
      organizationId: ORG_A,
      orgSettings: DEFAULT_ORGANIZATION_SETTINGS,
    });
    const summaryB = await getWalletsSummary(supabase as any, {
      organizationId: ORG_B,
      orgSettings: DEFAULT_ORGANIZATION_SETTINGS,
    });

    // ORG_A видит свои 50000 + 10000 = 60000 в сейфе
    expect(summaryA.cash.balance).toBe('60000.00');
    // ORG_B не получает кэш ORG_A и не получает хардкод 29000 Тенанта №1 — баланс 0.00!
    expect(summaryB.cash.balance).toBe('0.00');
    expect(summaryB.fuel_card.balance).toBe('0.00');
    expect(recordedOrgFilters.some((f) => f === `transactions:${ORG_A}`)).toBe(true);
    expect(recordedOrgFilters.some((f) => f === `transactions:${ORG_B}`)).toBe(true);
  });

  it('refuses to sync trip financials when trip belongs to another organization', async () => {
    const writes: any[] = [];
    const supabase = {
      from() {
        const builder: any = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          async single() {
            return {
              data: {
                id: 'trip-1',
                organization_id: ORG_A,
                trip_number: 42,
                lifecycle_status: 'approved',
                trip_orders: [],
              },
              error: null,
            };
          },
          insert(payload: any) {
            writes.push(payload);
            return builder;
          },
          update(payload: any) {
            writes.push(payload);
            return builder;
          },
        };
        return builder;
      },
    };

    // Попытка синхронизировать рейс ORG_A из контекста ORG_B не должна делать никаких записей
    await syncTripFinancials(supabase as any, 'trip-1', 'admin-b', {
      organizationId: ORG_B,
    });
    expect(writes).toHaveLength(0);
  });

  it('blocks API handler with 403 MODULE_DISABLED when required module is turned off', async () => {
    const checkAccess = (enabledModules: SaldaModule[], requiredModule: SaldaModule) => {
      if (!hasModule(enabledModules, requiredModule)) {
        return new Response(
          JSON.stringify({
            error: 'Модуль отключён для вашей организации',
            code: 'MODULE_DISABLED',
            module: requiredModule,
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return { organizationId: ORG_B, enabledModules };
    };

    const handler = createApiHandler(
      {
        routeName: 'POST /api/garage/orders/1/pay-salary',
        resolveAuth: async () => checkAccess(['transport', 'finance'], 'garage'),
      },
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const res = await handler(new Request('http://localhost/api/garage/orders/1/pay-salary'));
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; module: string };
    expect(body.code).toBe('MODULE_DISABLED');
    expect(body.module).toBe('garage');
  });
});
