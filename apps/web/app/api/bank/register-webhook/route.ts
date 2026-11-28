import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEFAULT_ORGANIZATION_ID, getTBankEnv } from '@saldacargo/shared';
import {
  getIntegrationConfig,
  listTBankWebhooks,
  registerTBankWebhook,
  type TBankIntegrationCredentials,
} from '@saldacargo/domain-service';

async function resolveTBankToken(): Promise<string | null> {
  const supabase = createAdminClient();
  try {
    const tbankInt = await getIntegrationConfig<TBankIntegrationCredentials>(
      supabase,
      DEFAULT_ORGANIZATION_ID,
      'tbank',
    );
    if (tbankInt.isEnabled && tbankInt.credentials.token) {
      return tbankInt.credentials.token;
    }
  } catch {
    // fallback to env
  }
  return getTBankEnv()?.token || null;
}

/**
 * GET /api/bank/register-webhook — список активных вебхуков Т-Банка.
 */
export async function GET() {
  const token = await resolveTBankToken();
  if (!token) {
    return NextResponse.json({ error: 'Токен Т-Банка не настроен' }, { status: 503 });
  }
  const result = await listTBankWebhooks(token);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, webhooks: result.data });
}

/**
 * POST /api/bank/register-webhook — регистрация вебхука `oper-feed-operation` в Т-Бизнесе.
 */
export async function POST(req: Request) {
  const token = await resolveTBankToken();
  if (!token) {
    return NextResponse.json({ error: 'Токен Т-Банка не настроен' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const defaultBaseUrl = (
    process.env.NEXT_PUBLIC_WEB_URL || 'https://salda-cargo-web.vercel.app'
  ).replace(/\/+$/, '');
  const url =
    (typeof body?.url === 'string' && body.url.trim()) || `${defaultBaseUrl}/api/webhooks/tbank`;
  const authSecret = process.env.TBANK_WEBHOOK_SECRET || undefined;

  const result = await registerTBankWebhook({
    apiToken: token,
    url,
    eventType: 'oper-feed-operation',
    email: typeof body?.email === 'string' ? body.email : undefined,
    authSecret,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, webhook: result.data, url });
}
