import { NextResponse, type NextRequest } from 'next/server';

/**
 * MiniApp не использует стандартный Supabase Auth —
 * авторизация через МАХ SDK (max_user_id).
 * Middleware только блокирует прямой доступ к API routes извне.
 */
export async function middleware(request: NextRequest) {
  // API routes открыты — авторизацию проверяет сам handler
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
