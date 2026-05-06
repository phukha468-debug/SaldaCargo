import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const userId = request.cookies.get('salda_user_id')?.value;
  const { pathname } = request.nextUrl;

  console.log(`[Middleware Debug] Path: ${pathname}, UserID in Cookie: ${userId || 'NONE'}`);

  const isAuthPage = pathname === '/login';
  const isAuthApi = pathname.startsWith('/api/auth/');
  const isPublicApi = pathname.startsWith('/api/users/public') || pathname === '/api/vehicles/public';

  if (!userId && !isAuthPage && !isAuthApi && !isPublicApi && pathname !== '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (userId && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
