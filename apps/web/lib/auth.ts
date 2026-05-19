import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Проверяет cookie salda_auth_token в API-роутах WebApp.
 * Возвращает userId (string) если авторизован, иначе 401-ответ.
 *
 * Использование:
 *   const auth = await requireAuth();
 *   if (auth instanceof NextResponse) return auth;
 *   // auth.userId доступен
 */
export async function requireAuth(): Promise<{ userId: string } | NextResponse> {
  const cookieStore = await cookies();
  const userId = cookieStore.get('salda_auth_token')?.value;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return { userId };
}
