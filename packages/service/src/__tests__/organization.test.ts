/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_ORGANIZATION_ID,
  encryptJsonSecrets,
  parseOrganizationSettings,
} from '@saldacargo/shared';
import {
  getOrganizationContext,
  invalidateOrganizationCache,
  resolveOrganizationFinanceIds,
  getIntegrationConfig,
  upsertIntegrationConfig,
} from '../organization';

const TEST_MASTER_KEY = 'test-master-key-for-organization-integrations-32chars!';
const OTHER_ORG_ID = '11111111-1111-4111-8111-111111111111';

function createMockSupabase(rows: Record<string, any[]>) {
  const upserted: Array<{ table: string; payload: any }> = [];

  return {
    upserted,
    from(table: string) {
      const filters: Array<{ col: string; val: any }> = [];
      const builder: any = {
        select() {
          return builder;
        },
        eq(col: string, val: any) {
          filters.push({ col, val });
          return builder;
        },
        async maybeSingle() {
          const tableRows = rows[table] ?? [];
          const found = tableRows.find((r) => filters.every((f) => r[f.col] === f.val)) ?? null;
          return { data: found, error: null };
        },
        async upsert(payload: any) {
          upserted.push({ table, payload });
          return { error: null };
        },
      };
      return builder;
    },
  };
}

describe('organization service (settings & encrypted integrations)', () => {
  const prevMasterKey = process.env.ENCRYPTION_MASTER_KEY;
  const prevTbankToken = process.env.TBANK_API_TOKEN;

  beforeEach(() => {
    process.env.ENCRYPTION_MASTER_KEY = TEST_MASTER_KEY;
    process.env.TBANK_API_TOKEN = 'tenant1-env-secret-token';
    invalidateOrganizationCache();
  });

  afterEach(() => {
    if (prevMasterKey === undefined) delete process.env.ENCRYPTION_MASTER_KEY;
    else process.env.ENCRYPTION_MASTER_KEY = prevMasterKey;
    if (prevTbankToken === undefined) delete process.env.TBANK_API_TOKEN;
    else process.env.TBANK_API_TOKEN = prevTbankToken;
    invalidateOrganizationCache();
  });

  it('loads organization context and filters only valid enabled modules', async () => {
    const supabase = createMockSupabase({
      organizations: [
        {
          id: OTHER_ORG_ID,
          slug: 'acme',
          name: 'ООО Акме',
          is_active: true,
          enabled_modules: ['transport', 'finance', 'unknown_module'],
          settings: {
            branding: { short_name: 'АКМЕ', timezone: 'Europe/Moscow' },
          },
        },
      ],
    });

    const ctx = await getOrganizationContext(supabase as any, OTHER_ORG_ID);
    expect(ctx).not.toBeNull();
    expect(ctx?.id).toBe(OTHER_ORG_ID);
    expect(ctx?.enabledModules).toEqual(['transport', 'finance']);
    expect(ctx?.settings.branding.short_name).toBe('АКМЕ');
  });

  it('resolves custom finance wallet/category UUIDs from orgSettings', () => {
    const customBank = '22222222-2222-4222-8222-222222222221';
    const customCash = '22222222-2222-4222-8222-222222222222';
    const settings = parseOrganizationSettings({
      finance: {
        wallets: { bank: customBank, cash: customCash },
      },
    });

    const ids = resolveOrganizationFinanceIds(settings);
    expect(ids.bankId).toBe(customBank);
    expect(ids.cashId).toBe(customCash);
  });

  it('decrypts per-tenant credentials from organization_integrations', async () => {
    const encrypted = encryptJsonSecrets({
      token: 'acme-tbank-token-123',
      account_number: '40702810000000000001',
    });

    const supabase = createMockSupabase({
      organization_integrations: [
        {
          organization_id: OTHER_ORG_ID,
          provider: 'tbank',
          is_enabled: true,
          config: { account_number: '40702810000000000001' },
          encrypted_secrets: encrypted,
        },
      ],
    });

    const cfg = await getIntegrationConfig(supabase as any, OTHER_ORG_ID, 'tbank');
    expect(cfg.isEnabled).toBe(true);
    expect(cfg.source).toBe('database');
    expect(cfg.credentials.token).toBe('acme-tbank-token-123');
  });

  it('NEVER leaks Tenant #1 env secrets to another organization', async () => {
    const supabase = createMockSupabase({
      organization_integrations: [],
    });

    // Новый клиент без записи в organization_integrations НЕ получает process.env.TBANK_API_TOKEN!
    const otherCfg = await getIntegrationConfig(supabase as any, OTHER_ORG_ID, 'tbank');
    expect(otherCfg.isEnabled).toBe(false);
    expect(otherCfg.source).toBe('none');
    expect(otherCfg.credentials.token).toBeUndefined();

    // Тенант №1 получает env_fallback для обратной совместимости
    const tenant1Cfg = await getIntegrationConfig(
      supabase as any,
      DEFAULT_ORGANIZATION_ID,
      'tbank',
    );
    expect(tenant1Cfg.isEnabled).toBe(true);
    expect(tenant1Cfg.source).toBe('env_fallback');
    expect(tenant1Cfg.credentials.token).toBe('tenant1-env-secret-token');
  });

  it('encrypts credentials before upserting into organization_integrations', async () => {
    const supabase = createMockSupabase({});
    const res = await upsertIntegrationConfig(supabase as any, OTHER_ORG_ID, 'wialon', {
      isEnabled: true,
      config: { host: 'https://hst-api.wialon.com' },
      credentials: { token: 'super-secret-wialon-token' },
    });

    expect(res.ok).toBe(true);
    expect(supabase.upserted).toHaveLength(1);
    const saved = supabase.upserted[0]!.payload;
    expect(saved.organization_id).toBe(OTHER_ORG_ID);
    expect(saved.encrypted_secrets).toMatch(/^v1:/);
    expect(saved.encrypted_secrets).not.toContain('super-secret-wialon-token');
  });
});
