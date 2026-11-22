import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE_WEB,
  verifySessionToken,
  type SessionPayload,
} from '@saldacargo/shared/session';
import { createAdminClient } from '@/lib/supabase/admin';

export interface VerifiedWebUser {
  userId: string;
  roles: string[];
  session: SessionPayload;
}

/**
 * Извлекает и проверяет криптографическую подпись cookie salda_auth_token.
 * Возвращает null, если сессия отсутствует или невалидна.
 */
export async function getVerifiedWebSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_WEB)?.value;
  return verifySessionToken(rawToken);
}

/**
 * Возвращает проверенный userId из подписанной сессии WebApp (или null).
 */
export async function getVerifiedWebUserId(): Promise<string | null> {
  const session = await getVerifiedWebSession();
  return session?.uid ?? null;
}

/**
 * Проверяет подписанную cookie salda_auth_token в API-роутах WebApp.
 * Возвращает { userId, roles, session } если авторизован, иначе 401-ответ.
 */
export async function requireAuth(): Promise<VerifiedWebUser | NextResponse> {
  const session = await getVerifiedWebSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return { userId: session.uid, roles: session.roles, session };
}

/**
 * Проверяет сессию И актуальные роли/активность пользователя в БД.
 * Защищает финансовые и административные эндпоинты от повышения привилегий
 * и от доступа деактивированных сотрудников.
 */
export async function requireRole(allowedRoles: string[]): Promise<VerifiedWebUser | NextResponse> {
  const session = await getVerifiedWebSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: user, error } = await supabase
    .from('users')
    .select('id, roles, is_active')
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

  return { userId: user.id, roles: dbRoles, session };
}
