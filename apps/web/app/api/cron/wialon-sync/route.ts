import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  WialonTelematicsProvider,
  getIntegrationConfig,
  getOrganizationContext,
  syncOrganizationTelematics,
  type WialonIntegrationCredentials,
} from '@saldacargo/domain-service';
import {
  DEFAULT_ORGANIZATION_ID,
  hasModule,
  isEnvConfigError,
  logger,
  notifyCronFailure,
  verifyCronAuthorization,
} from '@saldacargo/shared';
import { requireRole } from '@/lib/auth';

const DEFAULT_WIALON_HOST = 'https://host.local4.wialon.host';
const CRON_TOTAL_BUDGET_MS = 45_000;

interface OrgRow {
  id: string;
  slug: string;
  enabled_modules?: string[] | null;
}

async function runForOrganization(
  supabase: SupabaseClient,
  orgId: string,
  slug: string,
  viewOnly: boolean,
  source: 'cron' | 'manual',
  remainingBudgetMs: number,
): Promise<{
  organizationId: string;
  slug: string;
  result?: unknown;
  skipped?: string;
  error?: string;
}> {
  const orgCtx = await getOrganizationContext(supabase, orgId);
  if (!orgCtx || !orgCtx.isActive) {
    return { organizationId: orgId, slug, skipped: 'org_inactive' };
  }
  if (!hasModule(orgCtx.enabledModules, 'transport')) {
    return { organizationId: orgId, slug, skipped: 'module_disabled' };
  }

  const wialon = await getIntegrationConfig<WialonIntegrationCredentials>(
    supabase,
    orgId,
    'wialon',
  );
  if (!wialon.isEnabled || !wialon.credentials.token) {
    return { organizationId: orgId, slug, skipped: 'integration_disabled' };
  }

  const host =
    typeof wialon.config.host === 'string' && wialon.config.host
      ? wialon.config.host
      : DEFAULT_WIALON_HOST;

  const provider = new WialonTelematicsProvider({
    host,
    token: wialon.credentials.token,
  });

  if (viewOnly) {
    const snapshots = await provider.fetchUnitsSnapshot();
    return { organizationId: orgId, slug, result: { positions: snapshots } };
  }

  if (!orgCtx.settings.telematics.autopilot_enabled && source === 'cron') {
    return { organizationId: orgId, slug, skipped: 'autopilot_disabled' };
  }

  const report = await syncOrganizationTelematics({
    supabase,
    organizationId: orgId,
    orgSettings: orgCtx.settings,
    provider,
    source,
    timeBudgetMs: Math.max(5_000, remainingBudgetMs),
    concurrency: 3,
  });

  return { organizationId: orgId, slug, result: report };
}

export async function GET(req: Request) {
  const startedAt = Date.now();
  try {
    const supabase = createAdminClient() as unknown as SupabaseClient;
    const cronAuth = verifyCronAuthorization(req.headers.get('authorization'));
    let scopedOrgId: string | null = null;
    let scopedSlug = '';

    if (!cronAuth.ok) {
      const roleAuth = await requireRole(['admin', 'owner', 'dispatcher'], 'transport');
      if (roleAuth instanceof NextResponse) {
        return roleAuth;
      }
      scopedOrgId = roleAuth.organizationId;
      scopedSlug = roleAuth.organizationSlug;
    }

    const url = new URL(req.url);
    const viewOnly = url.searchParams.get('view') === '1';

    if (scopedOrgId) {
      const single = await runForOrganization(
        supabase,
        scopedOrgId,
        scopedSlug,
        viewOnly,
        'manual',
        CRON_TOTAL_BUDGET_MS,
      );
      if (single.skipped === 'integration_disabled') {
        return NextResponse.json(
          { error: 'Интеграция Wialon не настроена для вашей организации' },
          { status: 503 },
        );
      }
      return NextResponse.json({ success: true, ...single });
    }

    // Cron-режим: опрашиваем все активные организации с бюджетом времени и изоляцией ошибок
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, slug, enabled_modules')
      .eq('is_active', true);

    const activeOrgs: OrgRow[] =
      Array.isArray(orgs) && orgs.length > 0
        ? (orgs as OrgRow[])
        : [{ id: DEFAULT_ORGANIZATION_ID, slug: 'tk501', enabled_modules: ['transport'] }];

    const results: Array<{
      organizationId: string;
      slug: string;
      result?: unknown;
      skipped?: string;
      error?: string;
    }> = [];

    for (const org of activeOrgs) {
      const elapsed = Date.now() - startedAt;
      const remaining = CRON_TOTAL_BUDGET_MS - elapsed;
      if (remaining < 3_000) {
        results.push({ organizationId: org.id, slug: org.slug, skipped: 'time_budget_exceeded' });
        continue;
      }
      if (!hasModule(org.enabled_modules ?? undefined, 'transport')) {
        results.push({ organizationId: org.id, slug: org.slug, skipped: 'module_disabled' });
        continue;
      }

      try {
        const res = await runForOrganization(
          supabase,
          org.id,
          org.slug,
          viewOnly,
          'cron',
          remaining,
        );
        results.push(res);
      } catch (orgErr) {
        const errMsg = orgErr instanceof Error ? orgErr.message : String(orgErr);
        logger.error(
          'Cron wialon-sync failed for organization',
          { organizationId: org.id },
          orgErr,
        );
        results.push({ organizationId: org.id, slug: org.slug, error: errMsg });
      }
    }

    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - startedAt,
      organizations: results,
    });
  } catch (err) {
    if (!isEnvConfigError(err)) {
      await notifyCronFailure('wialon-sync', err);
    }
    const status = isEnvConfigError(err) ? 503 : 500;
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка';
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
