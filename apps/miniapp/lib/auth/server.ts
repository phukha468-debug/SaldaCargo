import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE_MINIAPP,
  verifySessionToken,
  type SessionPayload,
} from '@saldacargo/shared/session';
import { createAdminClient } from '@/lib/supabase/admin';

export interface VerifiedMiniappUser {
  userId: string;
  roles: string[];
  session: SessionPayload;
}

export function getMiniappCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 30) {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: maxAgeSeconds,
    path: '/',
  };
}

/**
 * Извлекает и проверяет криптографическую подпись cookie salda_session.
 */
export async function getVerifiedMiniappSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_MINIAPP)?.value;
  return verifySessionToken(rawToken);
}

/**
 * Возвращает проверенный userId из подписанной сессии MiniApp (или null).
 */
export async function getVerifiedMiniappUserId(): Promise<string | null> {
  const session = await getVerifiedMiniappSession();
  return session?.uid ?? null;
}

/**
 * Требует валидную подписанную сессию MiniApp.
 */
export async function requireSession(): Promise<VerifiedMiniappUser | NextResponse> {
  const session = await getVerifiedMiniappSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return { userId: session.uid, roles: session.roles, session };
}

/**
 * Требует валидную подписанную сессию И проверяет актуальные роли/активность в БД.
 */
export async function requireRole(
  allowedRoles: string[],
): Promise<VerifiedMiniappUser | NextResponse> {
  const session = await getVerifiedMiniappSession();
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
