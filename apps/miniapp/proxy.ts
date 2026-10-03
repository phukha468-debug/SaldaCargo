import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const userId = request.cookies.get('salda_user_id')?.value;
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname === '/login';
  const isAuthApi = pathname.startsWith('/api/auth/');
  const isPublicApi =
    pathname.startsWith('/api/users/public') ||
    pathname === '/api/vehicles/public' ||
    pathname.startsWith('/api/public/') ||
    pathname.startsWith('/api/wallets');

  // API-запросы не должны редиректиться на HTML страницу
  if (pathname.startsWith('/api/')) {
    if (!userId && !isAuthApi && !isPublicApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Устаревшая страница логина
  if (isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Защищенные экраны: если пользователь не авторизован, направляем на выбор роли
  if (!userId && pathname !== '/') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json)$).*)',
  ],
};
