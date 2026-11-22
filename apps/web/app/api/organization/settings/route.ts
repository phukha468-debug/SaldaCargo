import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  DEFAULT_ORGANIZATION_ID,
  OrganizationSettingsSchema,
  SALDA_MODULES,
  getMaxBotEnv,
  getOpti24Env,
  getTBankEnv,
  getWialonEnv,
  getYandexMapsEnv,
} from '@saldacargo/shared';
import type { IntegrationProvider } from '@saldacargo/shared-types';
import { invalidateOrganizationCache } from '@saldacargo/domain-service';
import { createWebApiHandler } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

const MODULE_ENUM = z.enum(SALDA_MODULES);

const KNOWN_PROVIDERS: IntegrationProvider[] = [
  'tbank',
  'wialon',
  'opti24',
  'max_bot',
  'yandex_maps',
  'resend',
];

function hasEnvFallbackForTenant1(provider: IntegrationProvider): boolean {
  switch (provider) {
    case 'tbank':
      return Boolean(getTBankEnv()?.token);
    case 'wialon':
      return Boolean(getWialonEnv()?.token);
    case 'opti24':
      return Boolean(getOpti24Env()?.apiKey);
    case 'max_bot':
      return Boolean(getMaxBotEnv()?.token);
    case 'yandex_maps':
      return Boolean(getYandexMapsEnv()?.apiKey);
    case 'resend':
      return Boolean(process.env.RESEND_API_KEY?.trim());
    default:
      return false;
  }
}

const patchSettingsSchema = z.object({
  name: z.string().trim().min(2, 'Название компании минимум 2 символа').max(120).optional(),
  enabled_modules: z
    .array(MODULE_ENUM)
    .min(1, 'Должен быть включён хотя бы один модуль')
    .optional(),
  settings: z
    .object({
      branding: z
        .object({
          short_name: z.string().trim().max(120).optional(),
          logo_url: z.string().trim().url().optional().or(z.literal('')),
          primary_color: z.string().trim().max(32).optional(),
          timezone: z.string().trim().min(1).max(64).optional(),
        })
        .optional(),
      finance: z
        .object({
          cube_fuel_price_per_liter: z.number().positive().optional(),
          diesel_fuel_price_per_liter: z.number().positive().optional(),
        })
        .optional(),
      fleet_rules: z
        .object({
          directions: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
        })
        .optional(),
    })
    .optional(),
});

export const GET = createWebApiHandler(
  {
    roles: ['owner', 'admin'],
    routeName: 'GET /api/organization/settings',
  },
  async ({ auth }) => {
    const supabase = createAdminClient();
    const { data: integrationRows } = await supabase
      .from('organization_integrations')
      .select('provider, is_enabled, config, encrypted_secrets, updated_at')
      .eq('organization_id', auth.organizationId);

    const rowMap = new Map(
      (integrationRows ?? []).map((r) => [
        r.provider as IntegrationProvider,
        r as {
          provider: string;
          is_enabled: boolean;
          config: Record<string, unknown> | null;
          encrypted_secrets: string | null;
          updated_at: string | null;
        },
      ]),
    );

    // Никогда не возвращаем расшифрованные секреты на клиент — только статус и метаданные
    const integrations = KNOWN_PROVIDERS.map((provider) => {
      const row = rowMap.get(provider);
      if (row) {
        return {
          provider,
          is_enabled: Boolean(row.is_enabled),
          has_secrets:
            typeof row.encrypted_secrets === 'string' && row.encrypted_secrets.length > 0,
          source: 'database' as const,
          config: row.config ?? {},
          updated_at: row.updated_at,
        };
      }
      const envFallback =
        auth.organizationId === DEFAULT_ORGANIZATION_ID && hasEnvFallbackForTenant1(provider);
      return {
        provider,
        is_enabled: envFallback,
        has_secrets: envFallback,
        source: envFallback ? ('env_fallback' as const) : ('none' as const),
        config: {},
        updated_at: null,
      };
    });

    return NextResponse.json({
      organization: {
        id: auth.organizationId,
        slug: auth.organizationSlug,
        name: auth.organizationName,
        enabled_modules: auth.enabledModules,
        settings: auth.orgSettings,
      },
      integrations,
      can_edit: auth.roles.includes('owner'),
    });
  },
);

export const PATCH = createWebApiHandler(
  {
    roles: ['owner'],
    bodySchema: patchSettingsSchema,
    routeName: 'PATCH /api/organization/settings',
  },
  async ({ auth, body }) => {
    const supabase = createAdminClient();
    const current = auth.orgSettings;

    const mergedSettings = OrganizationSettingsSchema.parse({
      ...current,
      branding: {
        ...current.branding,
        ...(body.settings?.branding
          ? {
              short_name:
                body.settings.branding.short_name !== undefined
                  ? body.settings.branding.short_name || undefined
                  : current.branding.short_name,
              logo_url:
                body.settings.branding.logo_url !== undefined
                  ? body.settings.branding.logo_url || undefined
                  : current.branding.logo_url,
              primary_color:
                body.settings.branding.primary_color !== undefined
                  ? body.settings.branding.primary_color || undefined
                  : current.branding.primary_color,
              timezone: body.settings.branding.timezone ?? current.branding.timezone,
            }
          : {}),
      },
      finance: {
        ...current.finance,
        ...(body.settings?.finance ?? {}),
      },
      fleet_rules: {
        ...current.fleet_rules,
        ...(body.settings?.fleet_rules ?? {}),
      },
    });

    const updatePayload: Record<string, unknown> = {
      settings: mergedSettings,
      updated_at: new Date().toISOString(),
    };
    if (body.name !== undefined) {
      updatePayload.name = body.name;
    }
    if (body.enabled_modules !== undefined) {
      updatePayload.enabled_modules = Array.from(new Set(body.enabled_modules));
    }

    const { data, error } = await supabase
      .from('organizations')
      .update(updatePayload)
      .eq('id', auth.organizationId)
      .select('id, slug, name, enabled_modules, settings')
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || 'Не удалось обновить настройки организации' },
        { status: 500 },
      );
    }

    invalidateOrganizationCache(auth.organizationId);

    return NextResponse.json({
      success: true,
      organization: data,
    });
  },
);
