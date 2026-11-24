import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { IntegrationProvider } from '@saldacargo/shared-types';
import { invalidateTBankCache, upsertIntegrationConfig } from '@saldacargo/domain-service';
import { createWebApiHandler } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

const ALLOWED_PROVIDERS = new Set<IntegrationProvider>([
  'tbank',
  'wialon',
  'opti24',
  'max_bot',
  'yandex_maps',
  'smtp',
  'resend',
]);

const putIntegrationSchema = z.object({
  is_enabled: z.boolean(),
  config: z.record(z.unknown()).optional(),
  secrets: z.record(z.string()).optional(),
});

export const PUT = createWebApiHandler<z.infer<typeof putIntegrationSchema>, { provider: string }>(
  {
    roles: ['owner'],
    bodySchema: putIntegrationSchema,
    routeName: 'PUT /api/organization/integrations/[provider]',
  },
  async ({ auth, body, params }) => {
    const provider = params.provider as IntegrationProvider;
    if (!ALLOWED_PROVIDERS.has(provider)) {
      return NextResponse.json(
        { error: `Неизвестный провайдер: ${params.provider}` },
        { status: 400 },
      );
    }

    let cleanedSecrets: Record<string, string> | undefined;
    if (body.secrets) {
      const entries = Object.entries(body.secrets)
        .map(([k, v]) => [k, v.trim()] as const)
        .filter(([, v]) => v.length > 0);
      if (entries.length > 0) {
        cleanedSecrets = Object.fromEntries(entries);
      }
    }

    const supabase = createAdminClient();
    const res = await upsertIntegrationConfig(supabase, auth.organizationId, provider, {
      isEnabled: body.is_enabled,
      config: body.config,
      credentials: cleanedSecrets,
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: res.error || 'Не удалось сохранить интеграцию' },
        { status: 500 },
      );
    }

    if (provider === 'tbank') {
      invalidateTBankCache();
    }

    return NextResponse.json({
      success: true,
      provider,
      is_enabled: body.is_enabled,
    });
  },
);
