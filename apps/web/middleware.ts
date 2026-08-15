import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const DEFAULT_ADMIN_ID = 'e9a1c980-eb1e-5c87-9f6d-c7f67eb28a1d';

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Если пользователь перешел на /login — сразу редиректим на главную без ввода пароля
  if (pathname === '/login') {
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.set('salda_auth_token', DEFAULT_ADMIN_ID, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 год
      path: '/',
    });
    return response;
  }

  const token = request.cookies.get('salda_auth_token')?.value;

  // Если токена нет — автоматически авторизуем как Администратора
  if (!token) {
    const response = NextResponse.next();
    response.cookies.set('salda_auth_token', DEFAULT_ADMIN_ID, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
