import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_WEB, verifySessionToken } from '@saldacargo/shared/session';
import { verifyCronAuthorization } from '@saldacargo/shared/cron';

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const rawToken = request.cookies.get(SESSION_COOKIE_WEB)?.value;
  const session = rawToken ? await verifySessionToken(rawToken) : null;

  // Публичные маршруты, внешние вебхуки и крон-задачи (cron защищены через CRON_SECRET)
  const isPublicRoute =
    pathname === '/login' ||
    pathname === '/onboarding' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/public');

  if (isPublicRoute) {
    if (session && pathname === '/login') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith('/api/')) {
      // Разрешаем внутренние серверные cron-запросы с валидным Bearer CRON_SECRET
      const cronCheck = verifyCronAuthorization(request.headers.get('authorization'));
      if (cronCheck.ok) {
        return NextResponse.next();
      }
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (rawToken) {
        res.cookies.delete(SESSION_COOKIE_WEB);
      }
      return res;
    }

    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('from', pathname);
    }
    const res = NextResponse.redirect(loginUrl);
    if (rawToken) {
      res.cookies.delete(SESSION_COOKIE_WEB);
    }
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
