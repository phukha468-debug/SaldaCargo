import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_MINIAPP, verifySessionToken } from '@saldacargo/shared/session';

export async function proxy(request: NextRequest) {
  const rawToken = request.cookies.get(SESSION_COOKIE_MINIAPP)?.value;
  const session = rawToken ? await verifySessionToken(rawToken) : null;
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname === '/login';
  const isAuthApi = pathname.startsWith('/api/auth/');
  const isPublicApi =
    pathname.startsWith('/api/users/public') ||
    pathname === '/api/vehicles/public' ||
    pathname.startsWith('/api/public/');

  // API-запросы не должны редиректиться на HTML страницу
  if (pathname.startsWith('/api/')) {
    if (isAuthApi || isPublicApi) {
      return NextResponse.next();
    }

    if (!session) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (rawToken) {
        res.cookies.delete(SESSION_COOKIE_MINIAPP);
      }
      return res;
    }

    // Базовый RBAC-барьер на уровне edge для админских API
    if (pathname.startsWith('/api/admin/')) {
      const isAdmin = session.roles.includes('admin') || session.roles.includes('owner');
      if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    return NextResponse.next();
  }

  // Устаревшая страница логина
  if (isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Защищенные экраны: если пользователь не авторизован, направляем на выбор роли
  if (!session && pathname !== '/') {
    const res = NextResponse.redirect(new URL('/', request.url));
    if (rawToken) {
      res.cookies.delete(SESSION_COOKIE_MINIAPP);
    }
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json)$).*)',
  ],
};
