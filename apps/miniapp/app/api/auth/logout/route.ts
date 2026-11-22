import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_MINIAPP } from '@saldacargo/shared/session';
import { getMiniappCookieOptions } from '@/lib/auth/server';

export async function POST() {
  const supabase = await createClient();

  // 1. Выход из Supabase Auth
  await supabase.auth.signOut();

  // 2. Очистка подписанной куки сессии и legacy salda_user_id
  const cookieStore = await cookies();
  const expiredOpts = { ...getMiniappCookieOptions(0), expires: new Date(0) };

  cookieStore.delete(SESSION_COOKIE_MINIAPP);
  cookieStore.set(SESSION_COOKIE_MINIAPP, '', expiredOpts);

  cookieStore.delete('salda_user_id');
  cookieStore.set('salda_user_id', '', { ...expiredOpts, httpOnly: false });

  return NextResponse.json({ success: true });
}
