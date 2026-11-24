/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ApiError, encryptJsonSecrets } from '@saldacargo/shared';
import { resolveEmailProvider, SmtpEmailProvider } from '../providers/email';

const TEST_MASTER_KEY = 'test-master-key-for-email-provider-tests-32chars!';
const ORG_ID = '22222222-2222-4222-8222-222222222222';

function createMockSupabase(rows: any[]) {
  return {
    from() {
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
          const found = rows.find((r) => filters.every((f) => r[f.col] === f.val)) ?? null;
          return { data: found, error: null };
        },
      };
      return builder;
    },
  } as any;
}

describe('resolveEmailProvider (SMTP only)', () => {
  const prevMasterKey = process.env.ENCRYPTION_MASTER_KEY;
  const prevNodeEnv = process.env.NODE_ENV;
  const prevSmtpUser = process.env.SMTP_USER;
  const prevSmtpPass = process.env.SMTP_PASS;
  const prevSmtpHost = process.env.SMTP_HOST;
  const prevSmtpPort = process.env.SMTP_PORT;
  const prevSmtpFromName = process.env.SMTP_FROM_NAME;

  beforeEach(() => {
    process.env.ENCRYPTION_MASTER_KEY = TEST_MASTER_KEY;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_FROM_NAME;
  });

  afterEach(() => {
    if (prevMasterKey === undefined) delete process.env.ENCRYPTION_MASTER_KEY;
    else process.env.ENCRYPTION_MASTER_KEY = prevMasterKey;
    (process.env as Record<string, string | undefined>).NODE_ENV = prevNodeEnv;
    if (prevSmtpUser === undefined) delete process.env.SMTP_USER;
    else process.env.SMTP_USER = prevSmtpUser;
    if (prevSmtpPass === undefined) delete process.env.SMTP_PASS;
    else process.env.SMTP_PASS = prevSmtpPass;
    if (prevSmtpHost === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = prevSmtpHost;
    if (prevSmtpPort === undefined) delete process.env.SMTP_PORT;
    else process.env.SMTP_PORT = prevSmtpPort;
    if (prevSmtpFromName === undefined) delete process.env.SMTP_FROM_NAME;
    else process.env.SMTP_FROM_NAME = prevSmtpFromName;
  });

  it('resolves SmtpEmailProvider from enabled organization_integrations record', async () => {
    const encrypted = encryptJsonSecrets({ pass: 'mailru-app-password' });
    const supabase = createMockSupabase([
      {
        organization_id: ORG_ID,
        provider: 'smtp',
        is_enabled: true,
        config: {
          host: 'smtp.mail.ru',
          port: '465',
          user: 'dispatch@mail.ru',
          from_name: 'Диспетчерская',
        },
        encrypted_secrets: encrypted,
      },
    ]);

    const provider = await resolveEmailProvider(supabase, ORG_ID);
    expect(provider).toBeInstanceOf(SmtpEmailProvider);
    expect(provider.name).toBe('smtp');
    expect(provider.fromEmail).toBe('"Диспетчерская" <dispatch@mail.ru>');
  });

  it('throws EMAIL_NOT_CONFIGURED when SMTP integration is disabled in DB', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    const encrypted = encryptJsonSecrets({ pass: 'mailru-app-password' });
    const supabase = createMockSupabase([
      {
        organization_id: ORG_ID,
        provider: 'smtp',
        is_enabled: false,
        config: { host: 'smtp.mail.ru', port: '465', user: 'dispatch@mail.ru' },
        encrypted_secrets: encrypted,
      },
    ]);

    await expect(resolveEmailProvider(supabase, ORG_ID)).rejects.toMatchObject({
      statusCode: 503,
      code: 'EMAIL_NOT_CONFIGURED',
    });
  });

  it('uses SMTP_* env fallback only outside production', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    process.env.SMTP_USER = 'dev@mail.ru';
    process.env.SMTP_PASS = 'dev-pass';
    process.env.SMTP_HOST = 'smtp.mail.ru';
    process.env.SMTP_PORT = '465';

    const supabase = createMockSupabase([]);
    const provider = await resolveEmailProvider(supabase, ORG_ID);
    expect(provider).toBeInstanceOf(SmtpEmailProvider);
    expect(provider.fromEmail).toBe('dev@mail.ru');

    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    await expect(resolveEmailProvider(supabase, ORG_ID)).rejects.toBeInstanceOf(ApiError);
  });
});
