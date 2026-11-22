/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  syncValdaiTelematics,
  fetchWialonValdaiPositions,
  getIntegrationConfig,
  type WialonIntegrationCredentials,
} from '@saldacargo/domain-service';
import {
  DEFAULT_ORGANIZATION_ID,
  hasModule,
  isEnvConfigError,
  verifyCronAuthorization,
  notifyCronFailure,
} from '@saldacargo/shared';
import { requireRole } from '@/lib/auth';

const DEFAULT_WIALON_HOST = 'https://host.local4.wialon.host';

export async function GET(req: Request) {
  try {
    const supabase = createAdminClient();
    const cronAuth = verifyCronAuthorization(req.headers.get('authorization'));
    let scopedOrgId: string | null = null;

    if (!cronAuth.ok) {
      const roleAuth = await requireRole(['admin', 'owner', 'dispatcher'], 'transport');
      if (roleAuth instanceof NextResponse) {
        return roleAuth;
      }
      scopedOrgId = roleAuth.organizationId;
    }

    const url = new URL(req.url);
    const viewOnly = url.searchParams.get('view') === '1';

    // Если вызвано авторизованным пользователем из UI — работаем строго в рамках его организации
    if (scopedOrgId) {
      const wialon = await getIntegrationConfig<WialonIntegrationCredentials>(
        supabase,
        scopedOrgId,
        'wialon',
      );
      if (!wialon.isEnabled || !wialon.credentials.token) {
        return NextResponse.json(
          { error: 'Интеграция Wialon не настроена для вашей организации' },
          { status: 503 },
        );
      }
      const host =
        typeof wialon.config.host === 'string' && wialon.config.host
          ? wialon.config.host
          : DEFAULT_WIALON_HOST;

      if (viewOnly) {
        const positions = await fetchWialonValdaiPositions(host, wialon.credentials.token);
        return NextResponse.json({ success: true, positions });
      }

      const result = await syncValdaiTelematics(supabase, {
        host,
        token: wialon.credentials.token,
      });
      return NextResponse.json(result);
    }

    // Cron-режим: итерируем по всем активным организациям с включённым модулем transport
    const { data: orgs } = await (supabase.from('organizations') as any)
      .select('id, slug, enabled_modules')
      .eq('is_active', true);

    const activeOrgs: Array<{ id: string; slug: string; enabled_modules?: string[] }> =
      Array.isArray(orgs) && orgs.length > 0
        ? orgs
        : [{ id: DEFAULT_ORGANIZATION_ID, slug: 'tk501', enabled_modules: ['transport'] }];

    const results: Array<{
      organizationId: string;
      slug: string;
      result?: unknown;
      skipped?: string;
    }> = [];

    for (const org of activeOrgs) {
      if (!hasModule(org.enabled_modules, 'transport')) {
        results.push({ organizationId: org.id, slug: org.slug, skipped: 'module_disabled' });
        continue;
      }
      const wialon = await getIntegrationConfig<WialonIntegrationCredentials>(
        supabase,
        org.id,
        'wialon',
      );
      if (!wialon.isEnabled || !wialon.credentials.token) {
        results.push({ organizationId: org.id, slug: org.slug, skipped: 'integration_disabled' });
        continue;
      }
      const host =
        typeof wialon.config.host === 'string' && wialon.config.host
          ? wialon.config.host
          : DEFAULT_WIALON_HOST;

      if (viewOnly) {
        const positions = await fetchWialonValdaiPositions(host, wialon.credentials.token);
        results.push({ organizationId: org.id, slug: org.slug, result: { positions } });
      } else {
        const syncRes = await syncValdaiTelematics(supabase, {
          host,
          token: wialon.credentials.token,
        });
        results.push({ organizationId: org.id, slug: org.slug, result: syncRes });
      }
    }

    return NextResponse.json({ ok: true, organizations: results });
  } catch (err: any) {
    if (!isEnvConfigError(err)) {
      await notifyCronFailure('wialon-sync', err);
    }
    const status = isEnvConfigError(err) ? 503 : 500;
    return NextResponse.json({ error: err.message || 'Внутренняя ошибка' }, { status });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
