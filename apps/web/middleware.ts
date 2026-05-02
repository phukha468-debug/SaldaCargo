import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // В MVP используем простую куку salda_auth_token с ID пользователя
  const authToken = request.cookies.get('salda_auth_token')?.value;
  const { pathname } = request.nextUrl;

  // Публичные пути
  const publicPaths = ['/login', '/auth/callback', '/auth/error', '/api/auth/login'];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  // Если нет токена и путь не публичный — на логин
  if (!authToken && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Если есть токен и мы на логине — в корень
  if (authToken && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
