/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const url = new URL(request.url);
  const customUserId =
    cookieStore.get('salda_user_id')?.value ||
    request.headers.get('x-salda-user-id') ||
    url.searchParams.get('user_id');

  console.log('[API /me] Checking auth:', customUserId || 'NOT FOUND');

  if (!customUserId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      {
        status: 401,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }

  try {
    const supabase = createAdminClient();

    // Ищем пользователя по ID из куки
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', customUserId)
      .single();

    const user = data as any;

    if (error || !user) {
      console.error('[API /me] User not found in DB for ID:', customUserId);

      const response = NextResponse.json({ error: 'User not found' }, { status: 401 });
      response.cookies.delete('salda_user_id');
      return response;
    }

    console.log('[API /me] Success for:', user.name);

    return NextResponse.json(user, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' },
    });
  } catch (err) {
    console.error('[API /me] Fatal error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
