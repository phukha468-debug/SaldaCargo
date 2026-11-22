import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_MINIAPP } from '@saldacargo/shared/session';
import { getVerifiedMiniappSession, getMiniappCookieOptions } from '@/lib/auth/server';

/** GET /api/auth/session — возвращает информацию о текущей проверенной сессии */
export async function GET() {
  const session = await getVerifiedMiniappSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.uid,
      roles: session.roles,
    },
  });
}

/**
 * POST /api/auth/session — ЗАБЛОКИРОВАН.
 * Сессия выдаётся исключительно после криптографической проверки в /api/auth/verify-pin, /api/auth/set-pin, /api/auth/max или /api/auth/verify.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Прямая установка сессии запрещена. Используйте авторизацию по PIN или MAX SDK.' },
    { status: 405 },
  );
}

/** DELETE /api/auth/session — удаляет куку сессии */
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const expiredOpts = { ...getMiniappCookieOptions(0), expires: new Date(0) };

    cookieStore.delete(SESSION_COOKIE_MINIAPP);
    cookieStore.set(SESSION_COOKIE_MINIAPP, '', expiredOpts);

    // Очищаем также legacy cookie salda_user_id, если осталась в браузере
    cookieStore.delete('salda_user_id');
    cookieStore.set('salda_user_id', '', { ...expiredOpts, httpOnly: false });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[API /auth/session] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
