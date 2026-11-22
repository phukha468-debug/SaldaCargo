import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  DEFAULT_ORGANIZATION_ID,
  hasModule,
  type OrganizationSettings,
  type SaldaModule,
} from '@saldacargo/shared';
import {
  SESSION_COOKIE_WEB,
  verifySessionToken,
  type SessionPayload,
} from '@saldacargo/shared/session';
import { getOrganizationContext } from '@saldacargo/domain-service';
import { createAdminClient } from '@/lib/supabase/admin';

export interface VerifiedWebUser {
  userId: string;
  roles: string[];
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  enabledModules: SaldaModule[];
  orgSettings: OrganizationSettings;
  session: SessionPayload;
}

export async function getVerifiedWebSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_WEB)?.value;
  return verifySessionToken(rawToken);
}

export async function getVerifiedWebUserId(): Promise<string | null> {
  const session = await getVerifiedWebSession();
  return session?.uid ?? null;
}

async function resolveVerifiedWebUser(
  session: SessionPayload,
  roles: string[],
  requiredModule?: SaldaModule,
): Promise<VerifiedWebUser | NextResponse> {
  const supabase = createAdminClient();
  const organizationId = session.oid || DEFAULT_ORGANIZATION_ID;
  const org = await getOrganizationContext(supabase, organizationId);

  if (!org || !org.isActive) {
    return NextResponse.json(
      { error: 'Организация не найдена или деактивирована', code: 'ORGANIZATION_INACTIVE' },
      { status: 403 },
    );
  }

  if (requiredModule && !hasModule(org.enabledModules, requiredModule)) {
    return NextResponse.json(
      {
        error: 'Модуль отключён для вашей организации',
        code: 'MODULE_DISABLED',
        module: requiredModule,
      },
      { status: 403 },
    );
  }

  return {
    userId: session.uid,
    roles,
    organizationId: org.id,
    organizationSlug: org.slug,
    organizationName: org.name,
    enabledModules: org.enabledModules,
    orgSettings: org.settings,
    session,
  };
}

/**
 * Проверяет подписанную cookie salda_auth_token и контекст организации в API-роутах WebApp.
 */
export async function requireAuth(
  requiredModule?: SaldaModule,
): Promise<VerifiedWebUser | NextResponse> {
  const session = await getVerifiedWebSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return resolveVerifiedWebUser(session, session.roles, requiredModule);
}

/**
 * Проверяет сессию, актуальные роли/активность пользователя в БД, контекст организации и модуль.
 */
export async function requireRole(
  allowedRoles: string[],
  requiredModule?: SaldaModule,
): Promise<VerifiedWebUser | NextResponse> {
  const session = await getVerifiedWebSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: user, error } = await supabase
    .from('users')
    .select('id, roles, is_active, default_organization_id')
    .eq('id', session.uid)
    .maybeSingle();

  if (error || !user || !user.is_active) {
    return NextResponse.json({ error: 'Аккаунт не найден или деактивирован' }, { status: 403 });
  }

  const dbRoles = Array.isArray(user.roles) ? user.roles : [];
  const hasRole = allowedRoles.some((r) => dbRoles.includes(r));
  if (!hasRole) {
    return NextResponse.json({ error: 'Недостаточно прав доступа' }, { status: 403 });
  }

  const effectiveSession: SessionPayload = {
    ...session,
    oid:
      session.oid ||
      (user as { default_organization_id?: string | null }).default_organization_id ||
      DEFAULT_ORGANIZATION_ID,
  };

  return resolveVerifiedWebUser(effectiveSession, dbRoles, requiredModule);
}
